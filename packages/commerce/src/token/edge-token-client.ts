import { CONTEXT_ID_HEADER, DEFAULT_SCOPE, TOKEN_PATH } from '../constants';
import { CommerceError } from '../errors';
import { buildProxyUrl, commerceFetch } from '../http';
import { CommerceRequestOptions, OrderCloudTokenResponse, ShopperUserType } from '../models';
import { toShopperSession } from './session-utils';
import { CommerceTokenClient, TokenClientResult } from './token-client';

/**
 * Configuration for {@link EdgeTokenClient}.
 * @public
 */
export interface EdgeTokenClientConfig {
  /**
   * Sitecore context ID. Identifies the environment's `oc-shopping` resource.
   */
  contextId: string;
  /**
   * Edge URL. Requests go to `{edgeUrl}/oc/storefront/oauth/token`.
   * @default resolved by `resolveEdgeUrl()`
   */
  edgeUrl?: string;
  /**
   * OrderCloud roles to request.
   * @default ['Shopper']
   */
  scope?: string[];
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
 * Obtains shopper tokens directly from the Edge commerce proxy. Works in browsers and on the server.
 * The proxy injects the buyer `client_id`; this client never sends `client_id` or `client_secret`.
 * @public
 */
export class EdgeTokenClient implements CommerceTokenClient {
  /**
   * @param {EdgeTokenClientConfig} config client configuration
   */
  constructor(private config: EdgeTokenClientConfig) {
    if (!config?.contextId) {
      throw new CommerceError('EdgeTokenClient: contextId is required.', { source: 'sdk' });
    }
  }

  private get scope(): string {
    return (this.config.scope ?? DEFAULT_SCOPE).join(' ');
  }

  /**
   * Mints a new anonymous shopper token (`client_credentials` grant).
   * OrderCloud does not issue refresh tokens for anonymous shoppers.
   * @param {CommerceRequestOptions} [options] request options
   * @returns {Promise<TokenClientResult>} anonymous session
   */
  getAnonymousToken(options?: CommerceRequestOptions): Promise<TokenClientResult> {
    return this.requestToken({ grant_type: 'client_credentials', scope: this.scope }, 'anonymous', options);
  }

  /**
   * Refreshes a registered session (`refresh_token` grant). Keeps the existing refresh token when
   * OrderCloud does not return a new one.
   * @param {string | undefined} refreshToken refresh token
   * @param {CommerceRequestOptions} [options] request options
   * @returns {Promise<TokenClientResult>} refreshed registered session
   */
  async refresh(
    refreshToken: string | undefined,
    options?: CommerceRequestOptions
  ): Promise<TokenClientResult> {
    if (!refreshToken) {
      throw new CommerceError('No refresh token available.', { source: 'sdk' });
    }

    const result = await this.requestToken(
      { grant_type: 'refresh_token', refresh_token: refreshToken },
      'registered',
      options
    );
    if (!result.session.refreshToken) result.session.refreshToken = refreshToken;
    return result;
  }

  /**
   * Obtains a registered shopper token (`password` grant). Primitive only: it does not transfer an
   * anonymous cart to the registered user.
   * @param {string} username username
   * @param {string} password password
   * @param {CommerceRequestOptions} [options] request options
   * @returns {Promise<TokenClientResult>} registered session
   */
  getPasswordToken(
    username: string,
    password: string,
    options?: CommerceRequestOptions
  ): Promise<TokenClientResult> {
    return this.requestToken(
      { grant_type: 'password', username, password, scope: this.scope },
      'registered',
      options
    );
  }

  private async requestToken(
    params: Record<string, string>,
    userType: ShopperUserType,
    options: CommerceRequestOptions = {}
  ): Promise<TokenClientResult> {
    const headers = new Headers(options.headers);
    headers.set('Content-Type', 'application/x-www-form-urlencoded');
    headers.set('Accept', 'application/json');
    headers.set(CONTEXT_ID_HEADER, this.config.contextId);

    const response = await commerceFetch<OrderCloudTokenResponse>(
      buildProxyUrl(this.config.edgeUrl, TOKEN_PATH),
      {
        ...options,
        method: 'POST',
        headers,
        body: new URLSearchParams(params).toString(),
      },
      { timeout: this.config.timeout, fetch: this.config.fetch }
    );

    return { session: toShopperSession(response, userType), persisted: false };
  }
}
