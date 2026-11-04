import { DEFAULT_EXPIRY_BUFFER_MS, DEFAULT_TOKEN_KEY } from '../constants';
import { debug } from '../debug';
import { isAuthFailure } from '../errors';
import { CommerceRequestOptions, ShopperSession, ShopperUserType, TokenKey } from '../models';
import { isSessionUsable } from '../token/session-utils';
import { createSingleFlight } from '../token/single-flight';
import { CommerceTokenClient, TokenClientResult } from '../token/token-client';
import { CommerceTokenStore } from '../token-store/token-store';

/**
 * Why the session changed.
 * - `acquired`: a session was obtained where none was known before
 * - `refreshed`: same registered identity, new access token
 * - `replaced`: a previous session was lost and a new identity was obtained (e.g. an expired anonymous session)
 * - `cleared`: the session was removed
 * @public
 */
export type SessionChangeReason = 'acquired' | 'refreshed' | 'replaced' | 'cleared';

/**
 * Session change notification.
 * @public
 */
export interface SessionChangeEvent {
  /**
   * Why the session changed.
   */
  reason: SessionChangeReason;
  /**
   * The new session, or null when cleared.
   */
  session: ShopperSession | null;
  /**
   * Set on `replaced`: the userType of the session that was lost.
   */
  previousUserType?: ShopperUserType;
}

/**
 * Configuration for {@link ShopperSessionManager}.
 * @public
 */
export interface ShopperSessionManagerConfig {
  /**
   * Where tokens come from.
   */
  tokenClient: CommerceTokenClient;
  /**
   * Where tokens are kept.
   */
  tokenStore: CommerceTokenStore;
  /**
   * Time before expiry at which a session is renewed.
   * @default 60000
   */
  expiryBufferMs?: number;
}

/**
 * Resolves the storage key for the current session. Always the default key in this release.
 * @returns {TokenKey} token key
 * @internal
 */
export const resolveTokenKey = (): TokenKey => DEFAULT_TOKEN_KEY;

/**
 * Owns the shopper token lifecycle: keeps a usable session available, refreshes registered sessions,
 * replaces expired anonymous sessions, and notifies listeners of identity changes.
 * Concurrent requests for a session share a single upstream call.
 * @public
 */
export class ShopperSessionManager {
  private current: ShopperSession | null = null;
  private flight = createSingleFlight<ShopperSession>();
  private listeners = new Set<(event: SessionChangeEvent) => void>();
  private bufferMs: number;

  /**
   * @param {ShopperSessionManagerConfig} config manager configuration
   */
  constructor(private config: ShopperSessionManagerConfig) {
    this.bufferMs = config.expiryBufferMs ?? DEFAULT_EXPIRY_BUFFER_MS;
  }

  /**
   * Returns a usable session, acquiring or refreshing one as needed.
   * Network and server errors are surfaced; they never silently replace the current identity.
   * @param {CommerceRequestOptions} [options] request options
   * @returns {Promise<ShopperSession>} usable session
   */
  async ensureSession(options?: CommerceRequestOptions): Promise<ShopperSession> {
    const usable = this.pickUsable(await this.readStore());
    if (usable) return usable;
    return this.flight.run(() => this.acquire({ options }));
  }

  /**
   * Replaces a session whose access token was rejected (HTTP 401). If another caller (or tab) already
   * replaced it, the newer session is returned without another upstream call.
   * @param {string} [rejectedAccessToken] the access token that was rejected
   * @param {CommerceRequestOptions} [options] request options
   * @returns {Promise<ShopperSession>} new session
   */
  invalidate(rejectedAccessToken?: string, options?: CommerceRequestOptions): Promise<ShopperSession> {
    return this.flight.run(() => this.acquire({ force: true, rejectedAccessToken, options }));
  }

  /**
   * Drops the current session and starts a new anonymous one.
   * @param {CommerceRequestOptions} [options] request options
   * @returns {Promise<ShopperSession>} new anonymous session
   */
  async reset(options?: CommerceRequestOptions): Promise<ShopperSession> {
    await this.settlePending();
    return this.flight.run(async () => {
      const previous = (await this.readStore()) ?? this.current;
      await this.clearStorage(options);

      const result = await this.config.tokenClient.getAnonymousToken(options);
      await this.persist(result);
      this.emit(
        previous
          ? { reason: 'replaced', session: result.session, previousUserType: previous.userType }
          : { reason: 'acquired', session: result.session }
      );
      return result.session;
    });
  }

  /**
   * Drops the current session without obtaining a new one.
   * @param {CommerceRequestOptions} [options] request options
   */
  async clear(options?: CommerceRequestOptions): Promise<void> {
    await this.settlePending();
    await this.clearStorage(options);
    this.emit({ reason: 'cleared', session: null });
  }

  /**
   * Last known session, without any I/O. May be stale or expired.
   * @returns {ShopperSession | null} last known session
   */
  peek(): ShopperSession | null {
    return this.current;
  }

  /**
   * Subscribes to session changes.
   * @param {(event: SessionChangeEvent) => void} listener listener
   * @returns {() => void} unsubscribe function
   */
  subscribe(listener: (event: SessionChangeEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private async acquire({
    force = false,
    rejectedAccessToken,
    options,
  }: {
    force?: boolean;
    rejectedAccessToken?: string;
    options?: CommerceRequestOptions;
  }): Promise<ShopperSession> {
    // re-read inside the flight: another caller, tab or server response may have renewed it already
    const stored = await this.readStore();
    const usable = this.pickUsable(stored);
    if (usable && (!force || usable.accessToken !== rejectedAccessToken)) {
      return usable;
    }

    const previous = stored ?? this.current;
    const { tokenClient } = this.config;
    const useRefresh = tokenClient.serverManagedRefresh
      ? force || previous !== null
      : previous?.userType === 'registered' && !!previous.refreshToken;

    let result: TokenClientResult | undefined;
    if (useRefresh) {
      try {
        result = await tokenClient.refresh(previous?.refreshToken, options);
      } catch (error) {
        if (!isAuthFailure(error)) throw error;
        debug('refresh rejected, falling back to anonymous session');
      }
    }
    result = result ?? (await tokenClient.getAnonymousToken(options));
    await this.persist(result);

    const { session } = result;
    if (previous?.userType === 'registered' && session.userType === 'registered' && useRefresh) {
      this.emit({ reason: 'refreshed', session });
    } else if (previous) {
      this.emit({ reason: 'replaced', session, previousUserType: previous.userType });
    } else {
      this.emit({ reason: 'acquired', session });
    }
    return session;
  }

  /**
   * Prefers a usable stored session; falls back to a usable in-memory session so a store that cannot
   * persist (e.g. cookies blocked by the browser) does not cause a new identity on every call.
   * @param {ShopperSession | null} stored session read from the store
   * @returns {ShopperSession | null} usable session, or null
   */
  private pickUsable(stored: ShopperSession | null): ShopperSession | null {
    if (isSessionUsable(stored, { bufferMs: this.bufferMs })) {
      this.current = stored;
      return stored;
    }
    return isSessionUsable(this.current, { bufferMs: this.bufferMs }) ? this.current : null;
  }

  private async readStore(): Promise<ShopperSession | null> {
    return (await this.config.tokenStore.get(resolveTokenKey())) ?? null;
  }

  private async persist(result: TokenClientResult): Promise<void> {
    if (!result.persisted) {
      await this.config.tokenStore.set(resolveTokenKey(), result.session);
    }
    this.current = result.session;
  }

  private async clearStorage(options?: CommerceRequestOptions): Promise<void> {
    this.current = null;
    await this.config.tokenStore.clear(resolveTokenKey());
    await this.config.tokenClient.clear?.(options);
  }

  private async settlePending(): Promise<void> {
    // loop so a flight started while waiting is also settled; callers run synchronously afterwards
    while (this.flight.isPending()) {
      await this.flight.wait();
    }
  }

  private emit(event: SessionChangeEvent): void {
    debug('session %s (%s)', event.reason, event.session?.userType ?? 'none');
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        debug('session listener error: %o', error);
      }
    });
  }
}
