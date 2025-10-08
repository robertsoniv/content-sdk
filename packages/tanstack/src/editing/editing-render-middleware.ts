import { debug, NativeDataFetcher } from '@sitecore-content-sdk/core';
import {
  QUERY_PARAM_EDITING_SECRET,
  EditingRenderQueryParams,
} from '@sitecore-content-sdk/core/editing';
import { RenderMiddlewareBase } from './render-middleware';
import {
  validateEditingSecret,
  validateOrigin,
  mapEditingParams,
  getDesignLibraryPreviewData,
  isDesignLibraryPreviewData,
  getCSPHeader,
} from './utils';
import {
  DEFAULT_EDITING_CACHE_CONTROL,
} from './constants';

/**
 * Configuration for the Editing Render Middleware
 */
export type EditingRenderMiddlewareConfig = {
  /**
   * Function used to determine route/page URL to render.
   * This may be necessary for certain custom TanStack routing configurations.
   */
  resolveRoute?: (route: string) => string;
  /**
   * Custom data fetcher instance
   */
  fetcher?: NativeDataFetcher;
  /**
   * Request timeout in milliseconds
   */
  timeout?: number;
  /**
   * Whether to enable CORS headers
   */
  enableCors?: boolean;
  /**
   * Custom CORS origins (overrides environment variable)
   */
  corsOrigins?: string[];
};

/**
 * Middleware for handling editing render requests from Sitecore
 */
export class EditingRenderMiddleware extends RenderMiddlewareBase {
  private config: EditingRenderMiddlewareConfig;
  private resolveRoute: (route: string) => string;

  constructor(config: EditingRenderMiddlewareConfig = {}) {
    super(config.fetcher, config.timeout);
    this.config = config;
    this.resolveRoute = config.resolveRoute || ((route: string) => route);
  }

  /**
   * Handles the editing render request
   * @param {Request} req incoming request
   * @returns {Promise<Response>} response with rendered content
   */
  async handle(req: Request): Promise<Response> {
    try {
      debug.editing('editing render middleware: handling request');

      // Validate request
      if (!this.validateRequest(req)) {
        return this.createErrorResponse('Invalid request', 400);
      }

      // Map editing parameters
      const params = mapEditingParams(req);

      // Validate editing secret
      if (!validateEditingSecret(req)) {
        debug.editing('editing render middleware: invalid secret');
        return this.createErrorResponse('Invalid editing secret', 401);
      }

      // Validate origin if CORS is enabled
      if (this.config.enableCors && !validateOrigin(req)) {
        debug.editing('editing render middleware: invalid origin');
        return this.createErrorResponse('Invalid origin', 403);
      }

      // Handle design library preview
      if (isDesignLibraryPreviewData(params)) {
        return this.handleDesignLibraryPreview(req, params);
      }

      // Handle normal editing/preview request
      return this.handleEditingRequest(req, params);

    } catch (error) {
      debug.editing('editing render middleware error: %o', error);
      return this.createErrorResponse(
        `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500
      );
    }
  }

  /**
   * Validates the incoming request
   * @param {Request} req incoming request
   * @returns {boolean} true if request is valid
   */
  protected validateRequest(req: Request): boolean {
    const url = new URL(req.url);
    const searchParams = url.searchParams;

    // Check required parameters
    if (!searchParams.get(QUERY_PARAM_EDITING_SECRET)) {
      debug.editing('validation failed: missing editing secret');
      return false;
    }

    if (!searchParams.get('mode')) {
      debug.editing('validation failed: missing mode parameter');
      return false;
    }

    if (!searchParams.get('route')) {
      debug.editing('validation failed: missing route parameter');
      return false;
    }

    return true;
  }

  /**
   * Handles design library preview requests
   * @param {Request} req incoming request
   * @param {EditingRenderQueryParams} params editing parameters
   * @returns {Promise<Response>} response with design library content
   */
  private async handleDesignLibraryPreview(
    req: Request,
    params: EditingRenderQueryParams
  ): Promise<Response> {
    debug.editing('handling design library preview request');

    const designLibraryData = getDesignLibraryPreviewData(params);
    if (!designLibraryData) {
      return this.createErrorResponse('Invalid design library preview data', 400);
    }

    // For design library, we might need special handling
    // This is a simplified implementation
    return this.handleRenderRequest(req, params);
  }

  /**
   * Handles normal editing/preview requests
   * @param {Request} req incoming request
   * @param {EditingRenderQueryParams} params editing parameters
   * @returns {Promise<Response>} response with rendered content
   */
  private async handleEditingRequest(
    req: Request,
    params: EditingRenderQueryParams
  ): Promise<Response> {
    debug.editing('handling editing request for mode: %s, route: %s', params.mode, params.route);

    // Resolve the route
    const resolvedRoute = this.resolveRoute(params.route);

    // Create modified params with resolved route
    const resolvedParams: EditingRenderQueryParams = {
      ...params,
      route: resolvedRoute,
    };

    // Handle the render request
    const response = await this.handleRenderRequest(req, resolvedParams);

    // Add CORS headers if enabled
    if (this.config.enableCors) {
      this.addCorsHeaders(response, req);
    }

    // Add CSP header for editing mode
    response.headers.set('Content-Security-Policy', getCSPHeader());

    return response;
  }

  /**
   * Adds CORS headers to the response
   * @param {Response} response response object
   * @param {Request} req original request
   */
  private addCorsHeaders(response: Response, req: Request): void {
    const origin = req.headers.get('origin');
    if (origin) {
      response.headers.set('Access-Control-Allow-Origin', origin);
    }
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  }

  /**
   * Creates an error response
   * @param {string} message error message
   * @param {number} status HTTP status code
   * @returns {Response} error response
   */
  private createErrorResponse(message: string, status: number): Response {
    return new Response(
      `<!DOCTYPE html>
<html>
<head>
  <title>Editing Error</title>
</head>
<body>
  <h1>Editing Error</h1>
  <p>${message}</p>
</body>
</html>`,
      {
        status,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': DEFAULT_EDITING_CACHE_CONTROL,
        },
      }
    );
  }
}
