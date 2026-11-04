import { DEFAULT_TOKEN_KEY, REFRESH_COOKIE_NAME, SESSION_COOKIE_NAME } from '../constants';
import { ShopperSession, ShopperUserType, TokenKey } from '../models';
import { decodeBase64Url, encodeBase64Url } from '../token/base64url';

const VERSION_PREFIX = 'v1.';
const USER_TYPES: ShopperUserType[] = ['anonymous', 'registered'];

interface SessionCookiePayloadV1 {
  at: string;
  exp: number;
  ut: ShopperUserType;
}

/**
 * Cookie names used for a token key.
 * @internal
 */
export interface CommerceCookieNames {
  /**
   * JS-readable cookie holding the access token session.
   */
  session: string;
  /**
   * Cookie holding the refresh token (registered sessions only).
   */
  refresh: string;
}

/**
 * Returns the cookie names for a token key. The default key maps to the unsuffixed names.
 * @param {TokenKey} [key] token key
 * @returns {CommerceCookieNames} cookie names
 * @throws {Error} if a non-default key has no valid characters
 * @internal
 */
export function getCommerceCookieNames(key: TokenKey = DEFAULT_TOKEN_KEY): CommerceCookieNames {
  if (key === DEFAULT_TOKEN_KEY) {
    return { session: SESSION_COOKIE_NAME, refresh: REFRESH_COOKIE_NAME };
  }

  const suffix = key.replace(/[^A-Za-z0-9-]/g, '');
  if (!suffix) throw new Error(`Invalid commerce token key: "${key}"`);

  return { session: `${SESSION_COOKIE_NAME}_${suffix}`, refresh: `${REFRESH_COOKIE_NAME}_${suffix}` };
}

/**
 * Encodes the access-token portion of a session for the session cookie.
 * The refresh token is never included.
 * @param {ShopperSession} session session to encode
 * @returns {string} cookie value
 * @internal
 */
export function encodeSessionCookie(session: ShopperSession): string {
  const payload: SessionCookiePayloadV1 = {
    at: session.accessToken,
    exp: session.expiresAt,
    ut: session.userType,
  };
  return `${VERSION_PREFIX}${encodeBase64Url(JSON.stringify(payload))}`;
}

/**
 * Decodes a session cookie value. Never throws.
 * @param {string | null | undefined} value cookie value
 * @returns {ShopperSession | null} session, or null if the value is missing, malformed or of an unknown version
 * @internal
 */
export function decodeSessionCookie(value: string | null | undefined): ShopperSession | null {
  if (!value || !value.startsWith(VERSION_PREFIX)) return null;

  try {
    const payload = JSON.parse(decodeBase64Url(value.slice(VERSION_PREFIX.length)));
    if (
      !payload ||
      typeof payload.at !== 'string' ||
      !payload.at ||
      typeof payload.exp !== 'number' ||
      !Number.isFinite(payload.exp) ||
      !USER_TYPES.includes(payload.ut)
    ) {
      return null;
    }
    return { accessToken: payload.at, expiresAt: payload.exp, userType: payload.ut };
  } catch {
    return null;
  }
}
