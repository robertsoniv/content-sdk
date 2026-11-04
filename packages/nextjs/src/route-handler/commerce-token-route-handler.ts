import { NextRequest, NextResponse } from 'next/server';
import {
  CommerceCookieOptions,
  CommerceError,
  CommerceTokenEndpointResponse,
  EdgeTokenClient,
  ShopperSession,
  ShopperSessionManager,
} from '@sitecore-content-sdk/commerce';
import { resolveTokenKey } from '@sitecore-content-sdk/commerce/internal';
import debug from '../debug';
import {
  createNextCookieAdapter,
  createNextCookieTokenStore,
} from '../commerce/next-cookie-token-store';

/**
 * Options for {@link createCommerceTokenRouteHandler}.
 * @public
 */
export interface CommerceTokenRouteHandlerOptions {
  /**
   * Sitecore context ID (server-side), e.g. `scConfig.api.edge.contextId`.
   */
  contextId: string;
  /**
   * Edge URL, e.g. `scConfig.api.edge.edgeUrl`.
   */
  edgeUrl?: string;
  /**
   * OrderCloud roles to request.
   * @default ['Shopper']
   */
  scope?: string[];
  /**
   * Upstream request timeout in milliseconds.
   */
  timeout?: number;
  /**
   * Cookie options. Should match the options passed to `CommerceProvider`.
   */
  cookies?: CommerceCookieOptions;
}

const NO_STORE = { 'Cache-Control': 'no-store' };

const jsonResponse = (body: unknown, status: number) =>
  new NextResponse(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...NO_STORE },
  });

/**
 * Rejects cross-site callers: Sec-Fetch-Site must be same-origin/none when present, otherwise the
 * Origin must match the request host.
 * @param {NextRequest} req request
 * @returns {boolean} true when the request comes from the same origin
 */
const isSameOrigin = (req: NextRequest): boolean => {
  const fetchSite = req.headers.get('sec-fetch-site');
  if (fetchSite) return fetchSite === 'same-origin' || fetchSite === 'none';

  const origin = req.headers.get('origin');
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
};

const readForceRefresh = async (req: NextRequest): Promise<boolean | null> => {
  const text = await req.text();
  if (!text) return false;
  try {
    const body = JSON.parse(text);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
    if (body.forceRefresh !== undefined && typeof body.forceRefresh !== 'boolean') return null;
    return body.forceRefresh === true;
  } catch {
    return null;
  }
};

const toEndpointResponse = (session: ShopperSession): CommerceTokenEndpointResponse => ({
  accessToken: session.accessToken,
  expiresAt: session.expiresAt,
  userType: session.userType,
});

/**
 * Creates the commerce token route handler (e.g. `app/api/commerce/token/route.ts`) used by
 * `CommerceProvider` in route-handler mode. The handler obtains shopper tokens from the Edge
 * commerce proxy server-side, keeps the refresh token in an httpOnly cookie, sets the JS-readable
 * session cookie, and never returns the refresh token to the browser.
 *
 * - `POST` (JSON body `{ forceRefresh?: boolean }`): returns the current session, refreshes a
 *   registered session, or mints a new anonymous session. The caller cannot choose the grant.
 * - `DELETE`: clears the commerce cookies.
 * @param {CommerceTokenRouteHandlerOptions} options handler options
 * @returns The route handler object with POST and DELETE methods.
 * @public
 */
export const createCommerceTokenRouteHandler = (options: CommerceTokenRouteHandlerOptions) => {
  const POST = async (req: NextRequest) => {
    if (!isSameOrigin(req)) {
      return jsonResponse({ error: 'Forbidden' }, 403);
    }
    if (!(req.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) {
      return jsonResponse({ error: 'Unsupported Media Type' }, 415);
    }
    if (!options?.contextId) {
      debug.commerce('commerce token route handler: contextId is not configured');
      return jsonResponse({ error: 'Commerce is not configured.' }, 500);
    }

    const forceRefresh = await readForceRefresh(req);
    if (forceRefresh === null) {
      return jsonResponse({ error: 'Bad Request' }, 400);
    }

    const cookies = createNextCookieAdapter(req);
    const tokenStore = createNextCookieTokenStore(cookies, options.cookies);
    const manager = new ShopperSessionManager({
      tokenStore,
      tokenClient: new EdgeTokenClient({
        contextId: options.contextId,
        edgeUrl: options.edgeUrl,
        scope: options.scope,
        timeout: options.timeout,
      }),
    });

    try {
      let session: ShopperSession;
      if (forceRefresh) {
        const current = await tokenStore.get(resolveTokenKey());
        session = await manager.invalidate(current?.accessToken || undefined);
      } else {
        session = await manager.ensureSession();
      }

      const response = jsonResponse(toEndpointResponse(session), 200);
      cookies.applyTo(response);
      return response;
    } catch (error) {
      // existing cookies are left intact; upstream error details are never echoed
      debug.commerce(
        'commerce token route handler failed: %s',
        error instanceof CommerceError ? `${error.source} ${error.status ?? ''}` : 'unexpected error'
      );
      return jsonResponse({ error: 'Commerce token request failed.' }, 502);
    }
  };

  const DELETE = async (req: NextRequest) => {
    if (!isSameOrigin(req)) {
      return jsonResponse({ error: 'Forbidden' }, 403);
    }

    const cookies = createNextCookieAdapter(req);
    await createNextCookieTokenStore(cookies, options?.cookies).clear(resolveTokenKey());

    const response = new NextResponse(null, { status: 204, headers: NO_STORE });
    cookies.applyTo(response);
    return response;
  };

  return { POST, DELETE };
};
