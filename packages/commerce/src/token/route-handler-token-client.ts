import { DEFAULT_TOKEN_ENDPOINT } from '../constants';
import { CommerceError } from '../errors';
import { commerceFetch } from '../http';
import { CommerceRequestOptions, ShopperSession } from '../models';
import { CommerceTokenClient, TokenClientResult } from './token-client';

/**
 * Configuration for {@link RouteHandlerTokenClient}.
 * @public
 */
export interface RouteHandlerTokenClientConfig {
  /**
   * Same-origin application endpoint that manages commerce tokens server-side.
   * @default '/api/commerce/token'
   */
  endpoint?: string;
  /**
   * Fetch override.
   */
  fetch?: typeof fetch;
}

/**
 * Response body of the commerce token endpoint. Never contains a refresh token.
 * @public
 */
export interface CommerceTokenEndpointResponse {
  accessToken: string;
  expiresAt: number;
  userType: ShopperSession['userType'];
}

/**
 * Obtains shopper tokens from a same-origin application endpoint (for example the Next.js
 * `createCommerceTokenRouteHandler`). The endpoint keeps the refresh token in an httpOnly cookie,
 * sets the session cookies, and decides which grant to use; the browser never sees a refresh token.
 * @public
 */
export class RouteHandlerTokenClient implements CommerceTokenClient {
  /**
   * The endpoint holds the refresh token and decides whether a refresh is possible.
   */
  readonly serverManagedRefresh = true;
  private endpoint: string;

  /**
   * @param {RouteHandlerTokenClientConfig} [config] client configuration
   */
  constructor(private config: RouteHandlerTokenClientConfig = {}) {
    this.endpoint = config.endpoint ?? DEFAULT_TOKEN_ENDPOINT;
  }

  /**
   * Asks the endpoint for a session. The endpoint returns its current session, refreshes a registered
   * session it holds, or mints a new anonymous session.
   * @param {CommerceRequestOptions} [options] request options
   * @returns {Promise<TokenClientResult>} session (already persisted by the endpoint)
   */
  getAnonymousToken(options?: CommerceRequestOptions): Promise<TokenClientResult> {
    return this.post({}, options);
  }

  /**
   * Asks the endpoint to replace the current access token (after it was rejected or expired).
   * @param {string | undefined} _refreshToken ignored; the endpoint holds the refresh token
   * @param {CommerceRequestOptions} [options] request options
   * @returns {Promise<TokenClientResult>} session (already persisted by the endpoint)
   */
  refresh(_refreshToken: string | undefined, options?: CommerceRequestOptions): Promise<TokenClientResult> {
    return this.post({ forceRefresh: true }, options);
  }

  /**
   * Asks the endpoint to clear the session cookies.
   * @param {CommerceRequestOptions} [options] request options
   */
  async clear(options: CommerceRequestOptions = {}): Promise<void> {
    await commerceFetch<unknown>(
      this.endpoint,
      { ...options, method: 'DELETE', credentials: 'same-origin' },
      { fetch: this.config.fetch }
    );
  }

  private async post(
    body: { forceRefresh?: boolean },
    options: CommerceRequestOptions = {}
  ): Promise<TokenClientResult> {
    const headers = new Headers(options.headers);
    headers.set('Content-Type', 'application/json');
    headers.set('Accept', 'application/json');

    let data: CommerceTokenEndpointResponse;
    try {
      data = await commerceFetch<CommerceTokenEndpointResponse>(
        this.endpoint,
        {
          ...options,
          method: 'POST',
          credentials: 'same-origin',
          headers,
          body: JSON.stringify(body),
        },
        { fetch: this.config.fetch }
      );
    } catch (error) {
      if (error instanceof CommerceError && error.status !== undefined) {
        // the endpoint is SDK-owned, so its errors are not OrderCloud/proxy errors
        throw new CommerceError(`Commerce token endpoint error (${error.status}).`, {
          source: 'sdk',
          status: error.status,
        });
      }
      throw error;
    }

    if (
      !data ||
      typeof data.accessToken !== 'string' ||
      !data.accessToken ||
      typeof data.expiresAt !== 'number' ||
      (data.userType !== 'anonymous' && data.userType !== 'registered')
    ) {
      throw new CommerceError('Commerce token endpoint returned an invalid response.', {
        source: 'sdk',
      });
    }

    return {
      session: { accessToken: data.accessToken, expiresAt: data.expiresAt, userType: data.userType },
      persisted: true,
    };
  }
}
