import { debug } from '@sitecore-content-sdk/core';
import { MiddlewareBase, MiddlewareBaseConfig } from '../middleware/middleware';

export type HealthCheckMiddlewareConfig = MiddlewareBaseConfig & {
  enabled?: boolean;
  healthCheckPath?: string;
};

/**
 * Middleware for health check endpoints
 */
export class HealthCheckMiddleware extends MiddlewareBase {
  private healthCheckPath: string;

  constructor(protected config: HealthCheckMiddlewareConfig) {
    super(config);
    this.healthCheckPath = config.healthCheckPath || '/api/health';
  }

  handle = async (req: Request, res: Response): Promise<Response> => {
    if (!this.config.enabled) {
      debug.common('skipped (health check middleware is disabled)');
      return res;
    }

    try {
      const url = new URL(req.url);
      const pathname = url.pathname;

      debug.common('health check middleware start: %o', { pathname });

      if (this.disabled(req, res)) {
        debug.common('skipped (health check middleware is disabled)');
        return res;
      }

      const createResponse = async () => {
        // Check if this is a health check request
        if (pathname !== this.healthCheckPath) {
          debug.common('skipped (not a health check request)');
          return res;
        }

        try {
          const healthStatus = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            version: '1.0.0',
          };

          const response = new Response(JSON.stringify(healthStatus), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache',
            },
          });

          debug.common('health check middleware completed: %o', healthStatus);
          return response;
        } catch (error) {
          console.log('Health check failed:', error);

          const errorStatus = {
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: error instanceof Error ? error.message : 'Unknown error',
          };

          return new Response(JSON.stringify(errorStatus), {
            status: 503,
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache',
            },
          });
        }
      };

      return await createResponse();
    } catch (error) {
      console.log('Health check middleware failed:');
      console.log(error);
      return res;
    }
  };
}

/**
 * Creates a health check middleware
 * @param {HealthCheckMiddlewareConfig} config configuration
 * @returns {HealthCheckMiddleware} middleware instance
 */
export function createHealthCheckMiddleware(
  config: HealthCheckMiddlewareConfig
): HealthCheckMiddleware {
  return new HealthCheckMiddleware(config);
}
