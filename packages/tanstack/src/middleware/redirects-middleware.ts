import { debug } from '@sitecore-content-sdk/core';
import {
  RedirectsService,
  RedirectsServiceConfig,
  REDIRECT_TYPE_301,
  REDIRECT_TYPE_302,
  REDIRECT_TYPE_SERVER_TRANSFER,
  RedirectInfo,
  SiteInfo,
} from '@sitecore-content-sdk/core/site';
import {
  areURLSearchParamsEqual,
  escapeNonSpecialQuestionMarks,
  isRegexOrUrl,
  mergeURLSearchParams,
} from '@sitecore-content-sdk/core/utils';
import regexParser from 'regex-parser';
import { MiddlewareBase, MiddlewareBaseConfig, REWRITE_HEADER_NAME } from './middleware';

const REGEXP_CONTEXT_SITE_LANG = new RegExp(/\$siteLang/, 'i');
const REGEXP_ABSOLUTE_URL = new RegExp('^(?:[a-z]+:)?//', 'i');

type RedirectResult = RedirectInfo & { matchedQueryString?: string };

/**
 * extended RedirectsMiddlewareConfig config type for RedirectsMiddleware
 */
export type RedirectsMiddlewareConfig = Omit<RedirectsServiceConfig, 'fetch' | 'clientFactory'> &
  MiddlewareBaseConfig & {
    enabled?: boolean;
    locales?: string[];
    redirectsService?: RedirectsService;
    contextId?: string;
    clientContextId?: string;
    edgeUrl?: string;
  };

/**
 * Middleware / handler fetches all redirects from Sitecore instance by graphql service
 * compares with current url and redirects to target url
 */
export class RedirectsMiddleware extends MiddlewareBase {
  protected redirectsService: RedirectsService;
  private locales: string[];

  /**
   * @param {RedirectsMiddlewareConfig} [config] redirects middleware config
   */
  constructor(protected config: RedirectsMiddlewareConfig) {
    super(config);
    const graphQLOptions = {
      api: {
        edge: {
          contextId: this.config.contextId || '',
          clientContextId: this.config.clientContextId || '',
          edgeUrl: this.config.edgeUrl || '',
        },
      },
    };

    this.redirectsService =
      this.config.redirectsService ??
      new RedirectsService({
        ...config,
        clientFactory: this.getClientFactory(graphQLOptions),
        fetch: fetch,
      });
    this.locales = config.locales || [];
  }

  handle = async (req: Request, res: Response): Promise<Response> => {
    if (!this.config.enabled) {
      debug.redirects('skipped (redirects middleware is disabled globally)');
      return res;
    }

    try {
      const url = new URL(req.url);
      const pathname = url.pathname;
      const language = this.getLanguage(req, res);
      const hostname = this.getHostHeader(req) || this.defaultHostname;
      let site: SiteInfo | undefined;
      const startTimestamp = Date.now();

      debug.redirects('redirects middleware start: %o', {
        pathname,
        language,
        hostname,
      });

      if (this.disabled(req, res)) {
        debug.redirects('skipped (redirects middleware is disabled)');
        return res;
      }

      const createResponse = async () => {
        if (this.isPreview(req)) {
          debug.redirects('skipped (preview)');
          return res;
        }

        // Skip prefetch requests
        if (this.isPrefetch(req)) {
          debug.redirects('skipped (prefetch)');
          const response = new Response(res.body, {
            status: res.status,
            statusText: res.statusText,
            headers: res.headers,
          });
          response.headers.set('x-middleware-cache', 'no-cache');
          response.headers.set('Cache-Control', 'no-store, must-revalidate');
          return response;
        }

        site = this.getSite(req, res);

        // Find the redirect from result of RedirectService
        const existsRedirect = await this.getExistsRedirect(req, site.name);

        if (!existsRedirect) {
          debug.redirects('skipped (redirect does not exist)');
          return res;
        }

        debug.redirects('Matched redirect rule: %o', { existsRedirect });

        // Find context site language and replace token
        if (
          REGEXP_CONTEXT_SITE_LANG.test(existsRedirect.target) &&
          !(
            REGEXP_ABSOLUTE_URL.test(existsRedirect.target) &&
            existsRedirect.target.includes(hostname)
          )
        ) {
          existsRedirect.target = existsRedirect.target.replace(
            REGEXP_CONTEXT_SITE_LANG,
            site.language
          );
        }

        const normalizedUrl = this.normalizeUrl(url);

        // Redirect logic for external (absolute) URLS
        if (REGEXP_ABSOLUTE_URL.test(existsRedirect.target)) {
          return this.dispatchRedirect(
            existsRedirect.target,
            existsRedirect.redirectType,
            req,
            res,
            true
          );
        } else {
          const isUrl = isRegexOrUrl(existsRedirect.pattern) === 'url';
          const targetParts = existsRedirect.target.split('/');
          const urlFirstPart = targetParts[1];

          if (this.locales.includes(urlFirstPart)) {
            existsRedirect.target = existsRedirect.target.replace(`/${urlFirstPart}`, '');
          }

          const targetSegments = isUrl
            ? existsRedirect.target.split('?')
            : normalizedUrl.pathname.replace(/\/*$/gi, '') + existsRedirect.matchedQueryString;

          const [targetPath, targetQueryString] = isUrl
            ? targetSegments
            : (targetSegments as string)
                .replace(regexParser(existsRedirect.pattern), existsRedirect.target)
                .replace(/^\/\//, '/')
                .split('?');

          const mergedQueryString = existsRedirect.isQueryStringPreserved
            ? mergeURLSearchParams(
                new URLSearchParams(normalizedUrl.search ?? ''),
                new URLSearchParams(targetQueryString || '')
              )
            : targetQueryString || '';

          const prepareNewURL = new URL(
            `${targetPath}${mergedQueryString ? '?' + mergedQueryString : ''}`,
            normalizedUrl.origin
          );

          normalizedUrl.href = prepareNewURL.href;
          normalizedUrl.pathname = prepareNewURL.pathname;
          normalizedUrl.search = prepareNewURL.search;
        }

        /** return Response redirect with http code of redirect type */
        return this.dispatchRedirect(normalizedUrl, existsRedirect.redirectType, req, res, false);
      };

      const response = await createResponse();

      debug.redirects('redirects middleware end in %dms: %o', Date.now() - startTimestamp, {
        redirected: response.redirected,
        status: response.status,
        url: response.url,
        headers: this.extractDebugHeaders(response.headers),
      });

      return response;
    } catch (error) {
      console.log('Redirect middleware failed:');
      console.log(error);
      return res;
    }
  };

  /**
   * Method returns RedirectInfo when matches
   * @param {Request} req request
   * @param {string} siteName site name
   * @returns Promise<RedirectInfo | undefined>
   * @private
   */
  protected async getExistsRedirect(
    req: Request,
    siteName: string
  ): Promise<RedirectResult | undefined> {
    const url = new URL(req.url);
    const { pathname: incomingURL, search: incomingQS = '' } = url;
    const locale = this.getLanguage(req);
    const normalizedPath = incomingURL.replace(/\/*$/gi, '').toLowerCase();
    const redirects = await this.redirectsService.fetchRedirects(siteName);
    const language = this.getLanguage(req);
    const modifyRedirects = structuredClone(redirects);
    let matchedQueryString: string | undefined;
    const localePath = `/${locale.toLowerCase()}${normalizedPath}`;

    return modifyRedirects.length
      ? modifyRedirects.find((redirect: RedirectResult) => {
          // process static URL (non-regex) rules
          if (isRegexOrUrl(redirect.pattern) === 'url') {
            const urlArray = redirect.pattern.endsWith('/')
              ? redirect.pattern.slice(0, -1).split('?')
              : redirect.pattern.split('?');
            const patternQS = urlArray[1];
            let patternPath = urlArray[0].toLowerCase();

            // case insensitive lookup of locales
            const patternParts = patternPath.split('/');
            const maybeLocale = patternParts[1]?.toLowerCase();
            if (maybeLocale && new RegExp(this.locales.join('|'), 'i').test(maybeLocale)) {
              patternPath = patternPath.replace(`/${patternParts[1]}`, `/${maybeLocale}`);
            }

            return (
              (patternPath === localePath || patternPath === normalizedPath) &&
              (!patternQS ||
                areURLSearchParamsEqual(
                  new URLSearchParams(patternQS),
                  new URLSearchParams(incomingQS)
                ))
            );
          }

          // process regex rules
          redirect.pattern = escapeNonSpecialQuestionMarks(
            redirect.pattern.replace(new RegExp(`^[^]?/${language}/`, 'gi'), '')
          );

          redirect.pattern = `/^\/${redirect.pattern
            .replace(/^\/|\/$/g, '')
            .replace(/^\^\/|\/\$$/g, '')
            .replace(/^\^|\$$/g, '')
            .replace(/\$\/gi$/g, '')}[\/]?$/i`;

          matchedQueryString = [
            regexParser(redirect.pattern).test(`/${localePath}${incomingQS}`),
            regexParser(redirect.pattern).test(`${normalizedPath}${incomingQS}`),
          ].some(Boolean)
            ? incomingQS
            : undefined;

          redirect.matchedQueryString = matchedQueryString || '';

          return (
            !!(
              regexParser(redirect.pattern).test(`/${locale}${incomingURL}`) ||
              regexParser(redirect.pattern).test(incomingURL) ||
              matchedQueryString
            ) && (redirect.locale ? redirect.locale.toLowerCase() === locale.toLowerCase() : true)
          );
        })
      : undefined;
  }

  /**
   * Normalize URL by removing special parameters
   * @param {URL} url
   * @returns {URL} normalize url
   */
  protected normalizeUrl(url: URL): URL {
    if (!url.search) {
      return url;
    }

    const splittedPathname = url.pathname
      .split('/')
      .filter((route: string) => route)
      .map((route) => `path=${route}`);

    const newQueryString = url.search
      .replace(/^\?/, '')
      .split('&')
      .filter((param) => {
        if (!splittedPathname.includes(param)) {
          return param;
        }
        return false;
      })
      .join('&');

    const newUrl = new URL(`${url.pathname.toLowerCase()}?${newQueryString}`, url.origin);

    url.search = newUrl.search;
    url.pathname = newUrl.pathname.toLowerCase();
    url.href = newUrl.href;

    return url;
  }

  /**
   * Helper function to dispatch a redirect or rewrite based on the redirect type.
   * @param {URL | string} target The final target to redirect/rewrite to.
   * @param {string} type One of `REDIRECT_TYPE_301`, `REDIRECT_TYPE_302`, or `REDIRECT_TYPE_SERVER_TRANSFER`.
   * @param {Request} req The incoming request.
   * @param {Response} res The current response.
   * @param {boolean} isExternal Set to `true` when `target` is an external absolute URL.
   * @returns {Response} The redirect/rewrite response, or `res` if the type is not recognized.
   */
  protected dispatchRedirect(
    target: URL | string,
    type: string,
    req: Request,
    res: Response,
    isExternal = false
  ): Response {
    switch (type) {
      case REDIRECT_TYPE_301:
        return this.createRedirectResponse(target, res, 301, 'Moved Permanently');
      case REDIRECT_TYPE_302:
        return this.createRedirectResponse(target, res, 302, 'Found');
      case REDIRECT_TYPE_SERVER_TRANSFER:
        return this.rewrite(
          typeof target === 'string' ? target : target.href,
          req,
          res,
          isExternal
        );
      default:
        return res;
    }
  }

  /**
   * Helper function to create a redirect response.
   * @param {URL | string} url The URL to redirect to.
   * @param {Response} res The response object.
   * @param {number} status The HTTP status code of the redirect.
   * @param {string} statusText The status text of the redirect.
   * @returns {Response} The redirect response.
   */
  protected createRedirectResponse(
    url: URL | string,
    res: Response | undefined,
    status: number,
    statusText: string
  ): Response {
    const redirect = new Response(null, {
      status,
      statusText,
      headers: res?.headers,
    });

    redirect.headers.set('Location', typeof url === 'string' ? url : url.href);

    if (res?.headers) {
      redirect.headers.delete('x-middleware-next');
      redirect.headers.delete('x-middleware-rewrite');
      redirect.headers.delete(REWRITE_HEADER_NAME);
    }

    return redirect;
  }
}
