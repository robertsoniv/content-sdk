/**
 * Type of the shopper the token belongs to.
 * @public
 */
export type ShopperUserType = 'anonymous' | 'registered';

/**
 * SDK representation of an OrderCloud shopper token set.
 * @public
 */
export interface ShopperSession {
  /**
   * OrderCloud access token (bearer).
   */
  accessToken: string;
  /**
   * Epoch milliseconds at which the access token expires.
   */
  expiresAt: number;
  /**
   * Refresh token. Only present for registered sessions, and only when the active storage pattern
   * allows JavaScript to hold it. OrderCloud does not issue refresh tokens for anonymous shoppers.
   */
  refreshToken?: string;
  /**
   * Type of shopper. Set from the grant that minted the token, not inferred from token claims.
   */
  userType: ShopperUserType;
}

/**
 * Key that identifies a stored shopper session. Always `DEFAULT_TOKEN_KEY` in this release.
 * @public
 */
export type TokenKey = string;

/**
 * Raw OrderCloud `/oauth/token` response.
 * @internal
 */
export interface OrderCloudTokenResponse {
  access_token: string;
  /**
   * Access token lifetime, in seconds.
   */
  expires_in?: number;
  token_type?: string;
  refresh_token?: string;
}

/**
 * Minimal subset of the OrderCloud `MeUser` returned by `GET /v1/me`.
 * Additional OrderCloud properties are passed through untyped.
 * @public
 */
export interface MeUser {
  [key: string]: unknown;
  ID: string;
  Username: string;
  FirstName?: string;
  LastName?: string;
  Email?: string;
  Phone?: string;
  Active?: boolean;
  xp?: Record<string, unknown>;
}

/**
 * Fetch options accepted by commerce requests.
 * @public
 */
export type CommerceRequestOptions = Omit<RequestInit, 'method' | 'body' | 'mode'>;
