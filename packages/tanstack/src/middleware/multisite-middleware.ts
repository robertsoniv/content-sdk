import { debug } from '@sitecore-content-sdk/core';
import { MiddlewareBase, MiddlewareBaseConfig } from './middleware';

export type MultisiteMiddlewareConfig = MiddlewareBaseConfig & {
  enabled?: boolean;
};

/**
 * Middleware for handling multisite routing
 */
export class MultisiteMiddleware extends MiddlewareBase {
  constructor(protected config: MultisiteMiddlewareConfig) {
    super(config);
  }

  handle = async (req: Request, res: Response): Promise<Response> => {
    if (!this.config.enabled) {
      debug.common('skipped (multisite middleware is disabled)');
      return res;
    }

    try {
      const url = new URL(req.url);
      const pathname = url.pathname;
      const startTimestamp = Date.now();

      debug.common('multisite middleware start: %o', { pathname });

      if (this.disabled(req, res)) {
        debug.common('skipped (multisite middleware is disabled)');
        return res;
      }

      const createResponse = async () => {
        // Skip prefetch requests
        if (this.isPrefetch(req)) {
          debug.common('skipped (prefetch)');
          return res;
        }

        const site = this.getSite(req, res);
        const response = new Response(res.body, {
          status: res.status,
          statusText: res.statusText,
          headers: res.headers,
        });

        // Set site information in headers for other middlewares
        response.headers.set('x-sc-site', site.name);
        response.headers.set('x-sc-language', site.language);

        debug.common('multisite middleware end in %dms: %o', Date.now() - startTimestamp, {
          pathname,
          site: site.name,
          language: site.language,
        });

        return response;
      };

      return await createResponse();
    } catch (error) {
      console.log('Multisite middleware failed:');
      console.log(error);
      return res;
    }
  };
}
