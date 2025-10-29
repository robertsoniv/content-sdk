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
  getCSPHeader,
} from './utils';
import {
  DEFAULT_EDITING_CACHE_CONTROL,
} from './constants';

/**
 * Configuration for the FEAAS Render Middleware
 */
export type FEAASRenderMiddlewareConfig = {
  /**
   * Function used to determine route/page URL to render for FEAAS components.
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
  /**
   * FEAAS-specific configuration
   */
  feaasConfig?: {
    /**
     * Base URL for FEAAS components
     */
    baseUrl?: string;
    /**
     * Default component library
     */
    defaultLibrary?: string;
    /**
     * Component versioning strategy
     */
    versioning?: 'latest' | 'pinned' | 'semver';
  };
};

/**
 * Middleware for handling FEAAS (Frontend as a Service) render requests from Sitecore
 */
export class FEAASRenderMiddleware extends RenderMiddlewareBase {
  private config: FEAASRenderMiddlewareConfig;
  // private _resolveRoute: (route: string) => string; // TODO: Implement route resolution

  constructor(config: FEAASRenderMiddlewareConfig = {}) {
    super(config.fetcher, config.timeout);
    this.config = config;
    // this._resolveRoute = config.resolveRoute || ((route: string) => route); // TODO: Implement route resolution
  }

  /**
   * Handles the FEAAS render request
   * @param {Request} req incoming request
   * @returns {Promise<Response>} response with rendered FEAAS content
   */
  async handle(req: Request): Promise<Response> {
    try {
      debug.editing('feaas render middleware: handling request');

      // Validate request
      if (!this.validateRequest(req)) {
        return this.createErrorResponse('Invalid FEAAS request', 400);
      }

      // Map editing parameters
      const params = mapEditingParams(req);

      // Validate editing secret
      if (!validateEditingSecret(req)) {
        debug.editing('feaas render middleware: invalid secret');
        return this.createErrorResponse('Invalid editing secret', 401);
      }

      // Validate origin if CORS is enabled
      if (this.config.enableCors && !validateOrigin(req)) {
        debug.editing('feaas render middleware: invalid origin');
        return this.createErrorResponse('Invalid origin', 403);
      }

      // Handle FEAAS-specific request
      return this.handleFEAASRequest(req, params);

    } catch (error) {
      debug.editing('feaas render middleware error: %o', error);
      return this.createErrorResponse(
        `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500
      );
    }
  }

  /**
   * Validates the incoming FEAAS request
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

    // FEAAS-specific validation
    if (!searchParams.get('component')) {
      debug.editing('validation failed: missing component parameter for FEAAS');
      return false;
    }

    return true;
  }

  /**
   * Handles FEAAS-specific render requests
   * @param {Request} req incoming request
   * @param {EditingRenderQueryParams} params editing parameters
   * @returns {Promise<Response>} response with rendered FEAAS content
   */
  private async handleFEAASRequest(
    req: Request,
    _params: EditingRenderQueryParams
  ): Promise<Response> {
    debug.editing('handling FEAAS request for component: %s', req.url);

    const url = new URL(req.url);
    const component = url.searchParams.get('component');
    const library = url.searchParams.get('library') || this.config.feaasConfig?.defaultLibrary || null;
    const version = url.searchParams.get('version');

    if (!component) {
      return this.createErrorResponse('Missing component parameter', 400);
    }

    // Build FEAAS component URL
    const feaasUrl = this.buildFEAASComponentUrl(component, library, version);

    try {
      // Fetch FEAAS component content
      const feaasResponse = await this.fetcher.fetch(feaasUrl, {
        headers: {
          'User-Agent': 'TanStack-FEAAS-Middleware/1.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      if (feaasResponse.status < 200 || feaasResponse.status >= 300) {
        throw new Error(`FEAAS component fetch failed: ${feaasResponse.status} ${feaasResponse.statusText}`);
      }

      const feaasContent = feaasResponse.data as string;

      // Create response with FEAAS content
      const response = new Response(feaasContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': DEFAULT_EDITING_CACHE_CONTROL,
          'X-FEAAS-Component': component,
          'X-FEAAS-Library': library || 'default',
          'X-FEAAS-Version': version || 'latest',
        },
      });

      // Add CORS headers if enabled
      if (this.config.enableCors) {
        this.addCorsHeaders(response, req);
      }

      // Add CSP header for FEAAS content
      response.headers.set('Content-Security-Policy', getCSPHeader());

      debug.editing('FEAAS request completed successfully');
      return response;

    } catch (error) {
      debug.editing('FEAAS component fetch failed: %o', error);
      return this.createErrorResponse(
        `Failed to fetch FEAAS component: ${error instanceof Error ? error.message : 'Unknown error'}`,
        502
      );
    }
  }

  /**
   * Builds the FEAAS component URL
   * @param {string} component component name
   * @param {string | null} library library name
   * @param {string | null} version component version
   * @returns {string} FEAAS component URL
   */
  private buildFEAASComponentUrl(
    component: string,
    library: string | null,
    version: string | null
  ): string {
    const baseUrl = this.config.feaasConfig?.baseUrl || 'https://feaas.bloomreach.io';
    const lib = library || this.config.feaasConfig?.defaultLibrary || 'default';
    const ver = version || 'latest';

    // Build URL based on FEAAS API structure
    return `${baseUrl}/components/${lib}/${component}/${ver}`;
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
  <title>FEAAS Error</title>
</head>
<body>
  <h1>FEAAS Error</h1>
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
