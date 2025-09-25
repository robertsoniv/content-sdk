import { debug } from '@sitecore-content-sdk/core';
import { SitemapXmlService, SitemapXmlServiceConfig } from '@sitecore-content-sdk/core/site';
import { MiddlewareBase, MiddlewareBaseConfig } from './middleware';

export type SitemapMiddlewareConfig = SitemapXmlServiceConfig &
  MiddlewareBaseConfig & {
    enabled?: boolean;
    sitemapService?: SitemapXmlService;
  };

/**
 * Middleware for handling sitemap requests
 */
export class SitemapMiddleware extends MiddlewareBase {
  protected sitemapService: SitemapXmlService;

  constructor(protected config: SitemapMiddlewareConfig) {
    super(config);
    this.sitemapService = config.sitemapService || new SitemapXmlService(config);
  }

  handle = async (req: Request, res: Response): Promise<Response> => {
    if (!this.config.enabled) {
      debug.common('skipped (sitemap middleware is disabled)');
      return res;
    }

    try {
      const url = new URL(req.url);
      const pathname = url.pathname;
      const startTimestamp = Date.now();

      debug.common('sitemap middleware start: %o', { pathname });

      if (this.disabled(req, res)) {
        debug.common('skipped (sitemap middleware is disabled)');
        return res;
      }

      const createResponse = async () => {
        // Check if this is a sitemap request
        if (!pathname.includes('sitemap')) {
          debug.common('skipped (not a sitemap request)');
          return res;
        }

        try {
          const site = this.getSite(req, res);
          const sitemaps = await this.sitemapService.fetchSitemaps();
          const sitemapXml = Array.isArray(sitemaps) ? sitemaps.join('\n') : sitemaps;

          const response = new Response(sitemapXml, {
            status: 200,
            headers: {
              'Content-Type': 'application/xml',
              'Cache-Control': 'public, max-age=3600',
            },
          });

          debug.common('sitemap middleware end in %dms: %o', Date.now() - startTimestamp, {
            pathname,
            site: site.name,
          });

          return response;
        } catch (error) {
          console.log('Sitemap generation failed:', error);
          return res;
        }
      };

      return await createResponse();
    } catch (error) {
      console.log('Sitemap middleware failed:');
      console.log(error);
      return res;
    }
  };
}
