import { createCookieTokenStore } from './cookie-token-store';
import { CommerceCookieOptions, CommerceTokenStore, CookieAdapter, CookieAttributes } from './token-store';

/**
 * Options for {@link createBrowserCookieTokenStore}.
 * @public
 */
export interface BrowserCookieTokenStoreOptions {
  /**
   * Where the refresh token is kept in the browser.
   * - `none` (default): not stored by the browser; a server token endpoint owns it in an httpOnly cookie
   * - `memory`: in memory only; lost on reload
   * - `cookie`: JS-readable cookie. Exposed to XSS; explicit opt-in only
   * @default 'none'
   */
  refreshTokenStorage?: 'none' | 'memory' | 'cookie';
  /**
   * Cookie options.
   */
  cookies?: CommerceCookieOptions;
}

const serializeCookie = (name: string, value: string, attributes: CookieAttributes) => {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${attributes.path}`];
  if (attributes.domain) parts.push(`Domain=${attributes.domain}`);
  parts.push(`Max-Age=${attributes.maxAge}`);
  parts.push(`SameSite=${attributes.sameSite === 'strict' ? 'Strict' : 'Lax'}`);
  if (attributes.secure) parts.push('Secure');
  return parts.join('; ');
};

/**
 * Cookie adapter over `document.cookie`. All operations are no-ops when `document` is unavailable (SSR).
 * @internal
 */
export const documentCookieAdapter: CookieAdapter = {
  get(name) {
    if (typeof document === 'undefined') return null;
    const prefix = `${name}=`;
    const match = document.cookie.split(/;\s*/).find((part) => part.startsWith(prefix));
    if (!match) return null;
    try {
      return decodeURIComponent(match.slice(prefix.length));
    } catch {
      return null;
    }
  },
  set(name, value, attributes) {
    if (typeof document === 'undefined') return;
    if (attributes.httpOnly) {
      throw new Error('httpOnly cookies cannot be written from the browser.');
    }
    document.cookie = serializeCookie(name, value, attributes);
  },
  delete(name, attributes) {
    if (typeof document === 'undefined') return;
    document.cookie = serializeCookie(name, '', { ...attributes, httpOnly: false, maxAge: 0 });
  },
};

/**
 * Creates a token store backed by browser cookies. The access token session is stored in a
 * JS-readable cookie; never uses localStorage or sessionStorage. SSR-safe.
 * @param {BrowserCookieTokenStoreOptions} [options] options
 * @returns {CommerceTokenStore} token store
 * @public
 */
export function createBrowserCookieTokenStore(
  options: BrowserCookieTokenStoreOptions = {}
): CommerceTokenStore {
  return createCookieTokenStore(documentCookieAdapter, {
    refreshTokenStorage: options.refreshTokenStorage ?? 'none',
    cookies: options.cookies,
  });
}
