import { SitemapXmlService, SitemapXmlServiceConfig } from '@sitecore-content-sdk/core/site';

export type SitemapRouteHandlerConfig = SitemapXmlServiceConfig;

/**
 * Creates a route handler for sitemap.xml requests
 * @param {SitemapRouteHandlerConfig} config configuration
 * @returns {Function} route handler function
 */
export function createSitemapRouteHandler(config: SitemapRouteHandlerConfig) {
  const sitemapService = new SitemapXmlService(config);

  return async (_req: Request): Promise<Response> => {
    try {
      // const _url = new URL(req.url);

      const sitemaps = await sitemapService.fetchSitemaps();
      const sitemapXml = Array.isArray(sitemaps) ? sitemaps.join('\n') : sitemaps;

      return new Response(sitemapXml, {
        status: 200,
        headers: {
          'Content-Type': 'application/xml',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    } catch (error) {
      console.error('Sitemap route handler failed:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  };
}
