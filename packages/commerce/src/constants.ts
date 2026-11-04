/**
 * Path of the OrderCloud storefront commerce proxy, relative to the Edge URL.
 * @internal
 */
export const COMMERCE_PROXY_PATH = '/oc/storefront';

/**
 * OAuth token endpoint path, relative to the commerce proxy.
 * @internal
 */
export const TOKEN_PATH = '/oauth/token';

/**
 * Header carrying the Sitecore context ID.
 * @internal
 */
export const CONTEXT_ID_HEADER = 'x-sitecore-contextid';

/**
 * Token key used for all sessions in Milestone 1. Non-default keys are reserved for future use.
 * @public
 */
export const DEFAULT_TOKEN_KEY = 'default';

/**
 * Default OAuth scope (OrderCloud roles) requested for shopper tokens.
 * @internal
 */
export const DEFAULT_SCOPE: readonly string[] = ['Shopper'];

/**
 * Default buffer before access token expiry at which a session is no longer considered usable.
 * @internal
 */
export const DEFAULT_EXPIRY_BUFFER_MS = 60_000;

/**
 * Default refresh token cookie lifetime, in seconds (30 days).
 * Matches the recommended OrderCloud `RefreshTokenDuration` of 43200 minutes.
 * @internal
 */
export const DEFAULT_REFRESH_TOKEN_MAX_AGE = 2_592_000;

/**
 * Default application endpoint used by the route-handler token client.
 * @internal
 */
export const DEFAULT_TOKEN_ENDPOINT = '/api/commerce/token';

/**
 * Base name of the JS-readable session (access token) cookie.
 * @internal
 */
export const SESSION_COOKIE_NAME = 'sc_oc_s';

/**
 * Base name of the refresh token cookie.
 * @internal
 */
export const REFRESH_COOKIE_NAME = 'sc_oc_rt';
