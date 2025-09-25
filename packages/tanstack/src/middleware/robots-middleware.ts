import { debug } from '@sitecore-content-sdk/core';
import { RobotsService, RobotsServiceConfig } from '@sitecore-content-sdk/core/site';
import { MiddlewareBase, MiddlewareBaseConfig } from './middleware';

export type RobotsMiddlewareConfig = RobotsServiceConfig &
  MiddlewareBaseConfig & {
    enabled?: boolean;
    robotsService?: RobotsService;
  };

/**
 * Middleware for handling robots.txt requests
 */
export class RobotsMiddleware extends MiddlewareBase {
  protected robotsService: RobotsService;

  constructor(protected config: RobotsMiddlewareConfig) {
    super(config);
    this.robotsService = config.robotsService || new RobotsService(config);
  }

  handle = async (req: Request, res: Response): Promise<Response> => {
    if (!this.config.enabled) {
      debug.common('skipped (robots middleware is disabled)');
      return res;
    }

    try {
      const url = new URL(req.url);
      const pathname = url.pathname;
      const startTimestamp = Date.now();

      debug.common('robots middleware start: %o', { pathname });

      if (this.disabled(req, res)) {
        debug.common('skipped (robots middleware is disabled)');
        return res;
      }

      const createResponse = async () => {
        // Check if this is a robots.txt request
        if (pathname !== '/robots.txt') {
          debug.common('skipped (not a robots.txt request)');
          return res;
        }

        try {
          const site = this.getSite(req, res);
          const robotsTxt = await this.robotsService.fetchRobots();

          const response = new Response(robotsTxt, {
            status: 200,
            headers: {
              'Content-Type': 'text/plain',
              'Cache-Control': 'public, max-age=3600',
            },
          });

          debug.common('robots middleware end in %dms: %o', Date.now() - startTimestamp, {
            pathname,
            site: site.name,
          });

          return response;
        } catch (error) {
          console.log('Robots.txt generation failed:', error);
          return res;
        }
      };

      return await createResponse();
    } catch (error) {
      console.log('Robots middleware failed:');
      console.log(error);
      return res;
    }
  };
}
