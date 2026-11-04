import { ShopperSession, TokenKey } from '../models';

/**
 * Persists shopper sessions.
 * @public
 */
export interface CommerceTokenStore {
  /**
   * Returns the stored session for a key, or null. May return an expired session; callers decide usability.
   */
  get(key: TokenKey): ShopperSession | null | Promise<ShopperSession | null>;
  /**
   * Stores a session for a key.
   */
  set(key: TokenKey, session: ShopperSession): void | Promise<void>;
  /**
   * Clears the session for a key, or every session this store owns when no key is given.
   */
  clear(key?: TokenKey): void | Promise<void>;
}

/**
 * Cookie options shared by browser and server commerce cookie stores.
 * @public
 */
export interface CommerceCookieOptions {
  /**
   * Cookie domain. Host-only when omitted.
   */
  domain?: string;
  /**
   * Cookie path.
   * @default '/'
   */
  path?: string;
  /**
   * SameSite attribute. `none` is intentionally not supported.
   * @default 'lax'
   */
  sameSite?: 'lax' | 'strict';
  /**
   * Secure attribute. Browsers accept secure cookies on http://localhost.
   * @default true
   */
  secure?: boolean;
  /**
   * Refresh token cookie lifetime in seconds. Should match the buyer API client's `RefreshTokenDuration`.
   * @default 2592000 (30 days)
   */
  refreshTokenMaxAge?: number;
}

/**
 * Attributes applied when writing a cookie.
 * @internal
 */
export interface CookieAttributes {
  domain?: string;
  path: string;
  sameSite: 'lax' | 'strict';
  secure: boolean;
  httpOnly: boolean;
  /**
   * Lifetime in seconds.
   */
  maxAge: number;
}

/**
 * Minimal cookie read/write abstraction used by cookie token stores.
 * @internal
 */
export interface CookieAdapter {
  get(name: string): string | null | undefined;
  set(name: string, value: string, attributes: CookieAttributes): void;
  delete(name: string, attributes: Omit<CookieAttributes, 'httpOnly' | 'maxAge'>): void;
}
