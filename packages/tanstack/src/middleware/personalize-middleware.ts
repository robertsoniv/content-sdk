import { debug } from '@sitecore-content-sdk/core';
import {
  PersonalizeService,
  PersonalizeServiceConfig,
} from '@sitecore-content-sdk/core/personalize';
import { MiddlewareBase, MiddlewareBaseConfig } from './middleware';

export type PersonalizeMiddlewareConfig = PersonalizeServiceConfig &
  MiddlewareBaseConfig & {
    enabled?: boolean;
    personalizeService?: PersonalizeService;
  };

/**
 * Middleware for handling personalization
 */
export class PersonalizeMiddleware extends MiddlewareBase {
  protected personalizeService: PersonalizeService;

  constructor(protected config: PersonalizeMiddlewareConfig) {
    super(config);
    this.personalizeService = config.personalizeService || new PersonalizeService(config);
  }

  handle = async (req: Request, res: Response): Promise<Response> => {
    if (!this.config.enabled) {
      debug.common('skipped (personalize middleware is disabled)');
      return res;
    }

    try {
      const url = new URL(req.url);
      const pathname = url.pathname;
      const startTimestamp = Date.now();

      debug.common('personalize middleware start: %o', { pathname });

      if (this.disabled(req, res)) {
        debug.common('skipped (personalize middleware is disabled)');
        return res;
      }

      const createResponse = async () => {
        // Skip prefetch requests
        if (this.isPrefetch(req)) {
          debug.common('skipped (prefetch)');
          return res;
        }

        // TODO: Implement personalization logic
        // This would involve:
        // 1. Detecting user context
        // 2. Fetching personalized content
        // 3. Rewriting URLs or modifying responses

        debug.common('personalize middleware end in %dms: %o', Date.now() - startTimestamp, {
          pathname,
        });

        return res;
      };

      return await createResponse();
    } catch (error) {
      console.log('Personalize middleware failed:');
      console.log(error);
      return res;
    }
  };
}
