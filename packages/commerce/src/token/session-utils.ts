import { DEFAULT_EXPIRY_BUFFER_MS } from '../constants';
import { CommerceError } from '../errors';
import { OrderCloudTokenResponse, ShopperSession, ShopperUserType } from '../models';
import { decodeBase64Url } from './base64url';

/**
 * Decodes the payload of a JWT **without verifying it**. For diagnostics and fallbacks only;
 * never use the result for authorization decisions.
 * @param {string} token JWT
 * @returns {Record<string, unknown> | null} claims, or null if the token cannot be decoded
 * @internal
 */
export function readJwtClaims(token: string): Record<string, unknown> | null {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[1]) return null;

  try {
    const claims = JSON.parse(decodeBase64Url(parts[1]));
    return claims && typeof claims === 'object' && !Array.isArray(claims) ? claims : null;
  } catch {
    return null;
  }
}

/**
 * Maps an OrderCloud token response to a {@link ShopperSession}.
 * Expiry comes from `expires_in`; the JWT `exp` claim is used only as a fallback.
 * @param {OrderCloudTokenResponse} response OrderCloud token response
 * @param {ShopperUserType} userType type of shopper the token was minted for
 * @param {number} [now] current time in epoch milliseconds
 * @returns {ShopperSession} shopper session
 * @throws {CommerceError} if the response has no access token or no determinable expiry
 * @internal
 */
export function toShopperSession(
  response: OrderCloudTokenResponse,
  userType: ShopperUserType,
  now: number = Date.now()
): ShopperSession {
  if (!response?.access_token) {
    throw new CommerceError('Token response did not include an access token.', {
      source: 'sdk',
    });
  }

  let expiresAt: number | undefined;
  if (typeof response.expires_in === 'number' && Number.isFinite(response.expires_in)) {
    expiresAt = now + response.expires_in * 1000;
  } else {
    const exp = readJwtClaims(response.access_token)?.exp;
    if (typeof exp === 'number' && Number.isFinite(exp)) expiresAt = exp * 1000;
  }

  if (expiresAt === undefined) {
    throw new CommerceError('Token response did not include an expiry.', { source: 'sdk' });
  }

  return {
    accessToken: response.access_token,
    expiresAt,
    userType,
    ...(response.refresh_token ? { refreshToken: response.refresh_token } : {}),
  };
}

/**
 * Options for {@link isSessionUsable}.
 * @public
 */
export interface SessionUsableOptions {
  /**
   * Time before expiry at which the session is no longer considered usable.
   * @default 60000
   */
  bufferMs?: number;
  /**
   * Current time in epoch milliseconds.
   * @default Date.now()
   */
  now?: number;
}

/**
 * Checks whether a session exists and its access token is not expired (or about to expire).
 * @param {ShopperSession | null | undefined} session session to check
 * @param {SessionUsableOptions} [options] options
 * @returns {boolean} true if the session can be used for requests
 * @public
 */
export function isSessionUsable(
  session: ShopperSession | null | undefined,
  options: SessionUsableOptions = {}
): session is ShopperSession {
  if (!session?.accessToken || typeof session.expiresAt !== 'number') return false;
  const { bufferMs = DEFAULT_EXPIRY_BUFFER_MS, now = Date.now() } = options;
  return session.expiresAt - bufferMs > now;
}
