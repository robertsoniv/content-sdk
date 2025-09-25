import { debug } from '@sitecore-content-sdk/core';
import { MiddlewareBase, MiddlewareBaseConfig, LOCALE_HEADER_NAME } from './middleware';

export type LocaleMiddlewareConfig = MiddlewareBaseConfig & {
  /**
   * List of supported locales
   */
  locales: string[];
  /**
   * Default locale
   * @default 'en'
   */
  defaultLocale?: string;
  /**
   * Whether to enable locale middleware
   * @default true
   */
  enabled?: boolean;
};

/**
 * Middleware for handling locale detection and routing
 */
export class LocaleMiddleware extends MiddlewareBase {
  private locales: string[];
  private defaultLocale: string;

  constructor(protected config: LocaleMiddlewareConfig) {
    super(config);
    this.locales = config.locales;
    this.defaultLocale = config.defaultLocale || 'en';
  }

  handle = async (req: Request, res: Response): Promise<Response> => {
    if (!this.config.enabled) {
      debug.common('skipped (locale middleware is disabled)');
      return res;
    }

    try {
      const url = new URL(req.url);
      const pathname = url.pathname;
      const startTimestamp = Date.now();

      debug.common('locale middleware start: %o', { pathname });

      if (this.disabled(req, res)) {
        debug.common('skipped (locale middleware is disabled)');
        return res;
      }

      const createResponse = async () => {
        // Skip if already processed
        if (res.headers.get(LOCALE_HEADER_NAME)) {
          debug.common('skipped (locale already set)');
          return res;
        }

        const detectedLocale = this.detectLocale(req);
        const response = new Response(res.body, {
          status: res.status,
          statusText: res.statusText,
          headers: res.headers,
        });

        // Set locale header for other middlewares
        response.headers.set(LOCALE_HEADER_NAME, detectedLocale);

        // If locale is in the path, we might want to rewrite the URL
        const pathSegments = pathname.split('/').filter(Boolean);
        const firstSegment = pathSegments[0];

        if (this.locales.includes(firstSegment)) {
          // Remove locale from path for internal processing
          const newPath = '/' + pathSegments.slice(1).join('/');
          url.pathname = newPath;

          // Rewrite the request URL
          const rewriteResponse = this.rewrite(url.pathname, req, response, true);
          rewriteResponse.headers.set(LOCALE_HEADER_NAME, detectedLocale);
          return rewriteResponse;
        }

        debug.common('locale middleware end in %dms: %o', Date.now() - startTimestamp, {
          detectedLocale,
          pathname,
        });

        return response;
      };

      return await createResponse();
    } catch (error) {
      console.log('Locale middleware failed:');
      console.log(error);
      return res;
    }
  };

  /**
   * Detect locale from request
   * @param {Request} req request
   * @returns {string} detected locale
   */
  private detectLocale(req: Request): string {
    const url = new URL(req.url);
    const pathname = url.pathname;
    const pathSegments = pathname.split('/').filter(Boolean);
    const firstSegment = pathSegments[0];

    // Check if first segment is a locale
    if (firstSegment && this.locales.includes(firstSegment)) {
      return firstSegment;
    }

    // Check Accept-Language header
    const acceptLanguage = req.headers.get('accept-language');
    if (acceptLanguage) {
      const preferredLocales = acceptLanguage
        .split(',')
        .map((lang) => lang.split(';')[0].trim().toLowerCase())
        .map((lang) => lang.split('-')[0]); // Extract language code

      for (const preferred of preferredLocales) {
        const matchingLocale = this.locales.find((locale) =>
          locale.toLowerCase().startsWith(preferred)
        );
        if (matchingLocale) {
          return matchingLocale;
        }
      }
    }

    // Check cookie
    const localeCookie = this.getCookie(req, 'locale');
    if (localeCookie && this.locales.includes(localeCookie)) {
      return localeCookie;
    }

    return this.defaultLocale;
  }
}
