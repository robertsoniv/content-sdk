import { SITE_KEY, SiteInfo, SiteResolver } from '@sitecore-content-sdk/core/site';
import { debug, GraphQLRequestClientFactory } from '@sitecore-content-sdk/core';
import {
  createGraphQLClientFactory,
  GraphQLClientOptions,
} from '@sitecore-content-sdk/core/client';

export const REWRITE_HEADER_NAME = 'x-sc-rewrite';
export const LOCALE_HEADER_NAME = 'x-sc-locale';

export type MiddlewareBaseConfig = {
  /**
   * function, determines if middleware execution should be skipped, based on request, response, or other considerations
   * @param {Request} req request object from middleware handler
   * @param {Response} res response object from middleware handler
   */
  skip?: (req: Request, res: Response) => boolean;
  /**
   * Fallback hostname in case `host` header is not present
   * @default localhost
   */
  defaultHostname?: string;
  /**
   * Fallback language in locale cannot be extracted from request URL
   * @default 'en'
   */
  defaultLanguage?: string;
  /**
   * Site resolution implementation by name/hostname
   */
  sites: SiteInfo[];
};

/**
 * Middleware class to be extended by all middleware implementations
 */
export abstract class Middleware {
  /**
   * Handler method to execute middleware logic
   * @param {Request} req request
   * @param {Response} res response
   */
  abstract handle(req: Request, res: Response): Promise<Response>;
}

/**
 * Base middleware class with common methods
 */
export abstract class MiddlewareBase extends Middleware {
  protected defaultHostname: string;
  protected siteResolver: SiteResolver;

  constructor(protected config: MiddlewareBaseConfig) {
    super();
    this.siteResolver = new SiteResolver(config.sites);
    this.defaultHostname = config.defaultHostname || 'localhost';
  }

  /**
   * Determines if mode is preview
   * @param {Request} req request
   * @returns {boolean} is preview
   */
  protected isPreview(req: Request) {
    const url = new URL(req.url);
    
    // Enhanced preview detection with multiple strategies
    return !!(
      // Next.js compatibility
      url.searchParams.get('__prerender_bypass') || 
      url.searchParams.get('__next_preview_data') ||
      
      // Custom preview parameters
      url.searchParams.get('preview') === 'true' ||
      url.searchParams.get('sc_preview') === 'true' ||
      
      // Sitecore-specific preview
      url.searchParams.get('sc_itemid') || // Sitecore item preview
      url.searchParams.get('sc_mode') === 'preview' ||
      
      // Preview cookie check
      this.isPreviewFromCookie(req)
    );
  }

  /**
   * Checks if preview mode is enabled via cookie
   * @param {Request} req request
   * @returns {boolean} is preview from cookie
   */
  private isPreviewFromCookie(req: Request): boolean {
    const cookieHeader = req.headers.get('cookie');
    if (!cookieHeader) {
      return false;
    }
    
    const cookies = cookieHeader
      .split(';')
      .map(c => c.trim())
      .reduce((acc, cookie) => {
        const [name, value] = cookie.split('=');
        acc[name] = value;
        return acc;
      }, {} as Record<string, string>);
    
    return cookies['__preview'] === 'true';
  }

  /**
   * Determines if the request is a prefetch request
   * @param {Request} req request
   * @returns {boolean} is prefetch
   */
  protected isPrefetch(req: Request): boolean {
    const purpose = req.headers.get('purpose');
    const middlewarePrefetch = req.headers.get('x-middleware-prefetch');

    return purpose === 'prefetch' || middlewarePrefetch === '1';
  }

  protected disabled(req: Request, res: Response) {
    const url = new URL(req.url);
    const { pathname } = url;

    return (
      pathname.startsWith('/api/') || // Ignore API calls
      pathname.startsWith('/sitecore/') || // Ignore Sitecore API calls
      pathname.startsWith('/_tanstack') || // Ignore TanStack service calls
      (this.config.skip && this.config.skip(req, res))
    );
  }

  /**
   * Safely extract all headers for debug logging
   * @param {Headers} incomingHeaders Incoming headers
   * @returns Object with headers as key/value pairs
   */
  protected extractDebugHeaders(incomingHeaders: Headers) {
    const headers = {} as { [key: string]: string };
    incomingHeaders.forEach((value, key) => (headers[key] = value));
    return headers;
  }

  /**
   * Provides used language
   * @param {Request} req request
   * @param {Response} res response
   * @returns {string} language
   */
  protected getLanguage(req: Request, res?: Response): string {
    return (
      this.getLanguageFromHeader(res) ||
      this.getLanguageFromUrl(req) ||
      this.config.defaultLanguage ||
      'en'
    );
  }

  /**
   * Extract language from locale header of the response
   * set by LocaleMiddleware
   * @param {Response} res response
   * @returns {string | undefined} language or undefined if not found
   */
  protected getLanguageFromHeader(res?: Response): string | undefined {
    return res?.headers.get(LOCALE_HEADER_NAME) ?? undefined;
  }

  /**
   * Extract language from URL
   * @param {Request} req request
   * @returns {string | undefined} language or undefined if not found
   */
  protected getLanguageFromUrl(req: Request): string | undefined {
    const url = new URL(req.url);
    const pathname = url.pathname;
    const segments = pathname.split('/').filter(Boolean);

    // Check if first segment is a language code (2-3 characters)
    if (segments.length > 0 && /^[a-z]{2,3}$/i.test(segments[0])) {
      return segments[0];
    }

    return undefined;
  }

  /**
   * Extract 'host' header
   * @param {Request} req request
   */
  protected getHostHeader(req: Request) {
    return req.headers.get('host')?.split(':')[0];
  }

  /**
   * Get site information. If site name is stored in cookie, use it, otherwise resolve by hostname
   * - If site can't be resolved by site name cookie use default site info based on provided parameters
   * - If site can't be resolved by hostname throw an error
   * @param {Request} req request
   * @param {Response} [res] response
   * @returns {SiteInfo} site information
   */
  protected getSite(req: Request, _res?: Response): SiteInfo {
    const siteNameCookie = this.getCookie(req, SITE_KEY);
    const hostname = this.getHostHeader(req) || this.defaultHostname;

    if (siteNameCookie) {
      // Usually we should be able to resolve site by cookie
      // in case of Sitecore Preview mode, there can be a case that new site was created
      // but it's not present in the sitemap, so we fallback to default site info
      return (
        this.siteResolver.getByName(siteNameCookie) || {
          name: siteNameCookie,
          language: this.getLanguage(req),
          hostName: '*',
        }
      );
    }

    return this.siteResolver.getByHost(hostname);
  }

  protected getClientFactory(graphQLOptions: GraphQLClientOptions): GraphQLRequestClientFactory {
    return createGraphQLClientFactory(graphQLOptions);
  }

  /**
   * Get cookie value from request
   * @param {Request} req request
   * @param {string} name cookie name
   * @returns {string | undefined} cookie value
   */
  protected getCookie(req: Request, name: string): string | undefined {
    const cookieHeader = req.headers.get('cookie');
    if (!cookieHeader) return undefined;

    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      acc[key] = value;
      return acc;
    }, {} as Record<string, string>);

    return cookies[name];
  }

  /**
   * Create a rewrite response
   * @param {string} rewritePath the destination path
   * @param {Request} req the current request
   * @param {Response} res the current response
   * @param {boolean} [skipHeader] don't write 'x-sc-rewrite' header
   */
  protected rewrite(
    rewritePath: string,
    req: Request,
    res: Response,
    skipHeader?: boolean
  ): Response {
    const url = new URL(req.url);
    url.pathname = rewritePath;

    const response = new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: res.headers,
    });

    // Share rewrite path with following executed middlewares
    if (!skipHeader) {
      response.headers.set(REWRITE_HEADER_NAME, rewritePath);
    }

    return response;
  }
}

/**
 * Define a middleware with a list of middlewares
 * @param {Middleware[]} middlewares List of middlewares to execute
 */
export const defineMiddleware = (...middlewares: Middleware[]) => {
  return {
    /**
     * Execute all middlewares
     * @param {Request} req request
     * @param {Response} res response
     */
    exec: async (req: Request, res: Response) => {
      const response = res || new Response();

      debug.common('middleware start');

      const start = Date.now();

      const middlewareResponse = await middlewares.reduce(
        (p, middleware) => p.then((res) => middleware.handle(req, res)),
        Promise.resolve(response)
      );

      debug.common('middleware end in %dms', Date.now() - start);

      return middlewareResponse;
    },
  };
};
