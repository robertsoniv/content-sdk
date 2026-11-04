import { DEFAULT_REFRESH_TOKEN_MAX_AGE, DEFAULT_TOKEN_KEY } from '../constants';
import { ShopperSession, TokenKey } from '../models';
import { decodeSessionCookie, encodeSessionCookie, getCommerceCookieNames } from './cookie-codec';
import {
  CommerceCookieOptions,
  CommerceTokenStore,
  CookieAdapter,
  CookieAttributes,
} from './token-store';

/**
 * Where a cookie token store keeps refresh tokens.
 * - `none`: never stored by this store (e.g. the server owns it in an httpOnly cookie)
 * - `memory`: in memory for the lifetime of the store instance
 * - `cookie`: JS-readable cookie (XSS risk; explicit opt-in)
 * - `http-only`: httpOnly cookie (server-side adapters only)
 * @internal
 */
export type RefreshTokenStorage = 'none' | 'memory' | 'cookie' | 'http-only';

/**
 * Options for {@link createCookieTokenStore}.
 * @internal
 */
export interface CookieTokenStoreOptions {
  refreshTokenStorage: RefreshTokenStorage;
  cookies?: CommerceCookieOptions;
  /**
   * Clock override for tests.
   */
  now?: () => number;
}

/**
 * Resolves cookie attributes from options and defaults.
 * @param {CommerceCookieOptions} [options] cookie options
 * @returns {Pick<CookieAttributes, 'domain' | 'path' | 'sameSite' | 'secure'>} base attributes
 * @internal
 */
export function resolveCookieAttributes(
  options: CommerceCookieOptions = {}
): Pick<CookieAttributes, 'domain' | 'path' | 'sameSite' | 'secure'> {
  return {
    path: options.path ?? '/',
    sameSite: options.sameSite ?? 'lax',
    secure: options.secure ?? true,
    ...(options.domain ? { domain: options.domain } : {}),
  };
}

/**
 * Creates a token store over a cookie adapter. Shared by the browser and Next.js stores so cookie
 * semantics stay identical.
 *
 * Behavior:
 * - The session cookie holds the access token portion only; its max-age follows the token expiry.
 * - Refresh tokens are persisted according to `refreshTokenStorage`, for registered sessions only.
 * - When only a refresh token is found, `get` returns an expired registered session carrying it,
 *   so the session manager refreshes instead of downgrading the shopper to anonymous.
 * @param {CookieAdapter} adapter cookie adapter
 * @param {CookieTokenStoreOptions} options store options
 * @returns {CommerceTokenStore} token store
 * @internal
 */
export function createCookieTokenStore(
  adapter: CookieAdapter,
  options: CookieTokenStoreOptions
): CommerceTokenStore {
  const { refreshTokenStorage, cookies = {}, now = Date.now } = options;
  const base = resolveCookieAttributes(cookies);
  const refreshMaxAge = cookies.refreshTokenMaxAge ?? DEFAULT_REFRESH_TOKEN_MAX_AGE;
  const memoryRefreshTokens = new Map<TokenKey, string>();
  const knownKeys = new Set<TokenKey>([DEFAULT_TOKEN_KEY]);
  const refreshInCookie = refreshTokenStorage === 'cookie' || refreshTokenStorage === 'http-only';

  const readRefreshToken = (key: TokenKey): string | undefined => {
    if (refreshTokenStorage === 'memory') return memoryRefreshTokens.get(key);
    if (refreshInCookie) return adapter.get(getCommerceCookieNames(key).refresh) || undefined;
    return undefined;
  };

  const deleteRefreshToken = (key: TokenKey) => {
    memoryRefreshTokens.delete(key);
    if (refreshInCookie) {
      adapter.delete(getCommerceCookieNames(key).refresh, base);
    }
  };

  const writeRefreshToken = (key: TokenKey, refreshToken: string) => {
    if (refreshTokenStorage === 'memory') {
      memoryRefreshTokens.set(key, refreshToken);
    } else if (refreshInCookie) {
      adapter.set(getCommerceCookieNames(key).refresh, refreshToken, {
        ...base,
        httpOnly: refreshTokenStorage === 'http-only',
        maxAge: refreshMaxAge,
      });
    }
  };

  const clearKey = (key: TokenKey) => {
    adapter.delete(getCommerceCookieNames(key).session, base);
    deleteRefreshToken(key);
  };

  return {
    get(key) {
      const session = decodeSessionCookie(adapter.get(getCommerceCookieNames(key).session));
      const refreshToken = readRefreshToken(key);

      if (!session) {
        return refreshToken
          ? { accessToken: '', expiresAt: 0, userType: 'registered', refreshToken }
          : null;
      }

      return session.userType === 'registered' && refreshToken
        ? { ...session, refreshToken }
        : session;
    },

    set(key, session: ShopperSession) {
      knownKeys.add(key);
      const maxAge = Math.max(0, Math.ceil((session.expiresAt - now()) / 1000));
      adapter.set(getCommerceCookieNames(key).session, encodeSessionCookie(session), {
        ...base,
        httpOnly: false,
        maxAge,
      });

      if (session.userType === 'anonymous') {
        // OrderCloud issues no refresh token for anonymous shoppers; drop a stale registered one
        if (readRefreshToken(key)) deleteRefreshToken(key);
      } else if (session.refreshToken) {
        writeRefreshToken(key, session.refreshToken);
      }
    },

    clear(key) {
      if (key !== undefined) {
        clearKey(key);
        return;
      }
      knownKeys.forEach(clearKey);
    },
  };
}
