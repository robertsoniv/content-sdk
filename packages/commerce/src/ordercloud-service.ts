import { CONTEXT_ID_HEADER } from './constants';
import { CommerceError } from './errors';
import { buildProxyUrl, commerceFetch } from './http';
import { CommerceRequestOptions, MeUser, ShopperSession } from './models';
import { ShopperSessionManager } from './session/shopper-session-manager';
import { EdgeTokenClient } from './token/edge-token-client';
import { createMemoryTokenStore } from './token-store/memory-token-store';

/**
 * Configuration for {@link OrderCloudService}.
 * @public
 */
export interface OrderCloudServiceConfig {
  /**
   * Sitecore context ID.
   */
  contextId: string;
  /**
   * Edge URL. Requests go to `{edgeUrl}/oc/storefront`.
   * @default resolved by `resolveEdgeUrl()`
   */
  edgeUrl?: string;
  /**
   * Session manager providing shopper tokens.
   * @default Edge token client with an in-memory token store
   */
  sessionManager?: ShopperSessionManager;
  /**
   * Request timeout in milliseconds.
   */
  timeout?: number;
  /**
   * Fetch override.
   */
  fetch?: typeof fetch;
}

/**
 * Path of an OrderCloud buyer API endpoint, relative to the commerce proxy (e.g. `/v1/me`).
 * @public
 */
export type OrderCloudApiPath = `/v1/${string}`;

/**
 * Calls OrderCloud buyer APIs through the Sitecore Edge commerce proxy with SDK-managed shopper tokens.
 * Usable in browsers and on the server.
 * @public
 */
export class OrderCloudService {
  /**
   * Session manager used by this service.
   */
  readonly sessionManager: ShopperSessionManager;

  /**
   * Shopper session operations.
   */
  readonly auth: {
    /**
     * Returns a usable shopper session, acquiring or refreshing one as needed.
     */
    getSession(options?: CommerceRequestOptions): Promise<ShopperSession>;
    /**
     * Drops the current session and starts a new anonymous one.
     */
    reset(options?: CommerceRequestOptions): Promise<ShopperSession>;
  };

  /**
   * Current shopper operations.
   */
  readonly me: {
    /**
     * Gets the current shopper (`GET /v1/me`). Works for anonymous and registered shoppers.
     */
    get(options?: CommerceRequestOptions): Promise<MeUser>;
  };

  /**
   * @param {OrderCloudServiceConfig} config service configuration
   */
  constructor(private config: OrderCloudServiceConfig) {
    if (!config?.contextId) {
      throw new CommerceError('OrderCloudService: contextId is required.', { source: 'sdk' });
    }

    this.sessionManager =
      config.sessionManager ??
      new ShopperSessionManager({
        tokenClient: new EdgeTokenClient({
          contextId: config.contextId,
          edgeUrl: config.edgeUrl,
          timeout: config.timeout,
          fetch: config.fetch,
        }),
        tokenStore: createMemoryTokenStore(),
      });

    this.auth = {
      getSession: (options) => this.sessionManager.ensureSession(options),
      reset: (options) => this.sessionManager.reset(options),
    };

    this.me = {
      get: (options) => this.request<MeUser>('/v1/me', { ...options, method: 'GET' }),
    };
  }

  /**
   * Sends an authorized request to an allowlisted OrderCloud buyer endpoint not yet wrapped by the SDK.
   * On HTTP 401 the session is renewed and the request retried once.
   * This escape hatch may change as typed product and cart APIs are added.
   * @param {OrderCloudApiPath} path OrderCloud path, e.g. `/v1/me/products`
   * @param {RequestInit} [init] request init; JSON bodies must be pre-serialized strings
   * @returns {Promise<T>} response data
   */
  async request<T>(path: OrderCloudApiPath, init: RequestInit = {}): Promise<T> {
    if (typeof path !== 'string' || !path.startsWith('/v1/') || path.includes('..') || path.includes('://')) {
      throw new CommerceError(`Invalid OrderCloud path: "${path}"`, { source: 'sdk' });
    }

    const signalOptions = { signal: init.signal };
    const session = await this.sessionManager.ensureSession(signalOptions);

    try {
      return await this.send<T>(path, init, session.accessToken);
    } catch (error) {
      if (!(error instanceof CommerceError) || error.status !== 401 || init.signal?.aborted) {
        throw error;
      }
      const renewed = await this.sessionManager.invalidate(session.accessToken, signalOptions);
      return this.send<T>(path, init, renewed.accessToken);
    }
  }

  private send<T>(path: OrderCloudApiPath, init: RequestInit, accessToken: string): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${accessToken}`);
    headers.set('Accept', 'application/json');
    headers.set(CONTEXT_ID_HEADER, this.config.contextId);

    return commerceFetch<T>(
      buildProxyUrl(this.config.edgeUrl, path),
      { ...init, headers },
      { timeout: this.config.timeout, fetch: this.config.fetch }
    );
  }
}
