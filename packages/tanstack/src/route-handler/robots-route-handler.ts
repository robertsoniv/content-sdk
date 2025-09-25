import { RobotsService, RobotsServiceConfig } from '@sitecore-content-sdk/core/site';

export type RobotsRouteHandlerConfig = RobotsServiceConfig;

/**
 * Creates a route handler for robots.txt requests
 * @param {RobotsRouteHandlerConfig} config configuration
 * @returns {Function} route handler function
 */
export function createRobotsRouteHandler(config: RobotsRouteHandlerConfig) {
  const robotsService = new RobotsService(config);

  return async (_req: Request): Promise<Response> => {
    try {
      // const url = new URL(req.url);
      // const siteName = url.searchParams.get('site') || 'default';

      const robotsTxt = await robotsService.fetchRobots();

      return new Response(robotsTxt, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    } catch (error) {
      console.error('Robots route handler failed:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  };
}
