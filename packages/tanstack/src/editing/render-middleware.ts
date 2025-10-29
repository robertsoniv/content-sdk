import { debug, NativeDataFetcher } from '@sitecore-content-sdk/core';
import { EditingRenderQueryParams } from '@sitecore-content-sdk/core/editing';
import {
  getQueryParamsForPropagation,
  getHeadersForPropagation,
  getCookiesForPropagation,
  cleanupNextPreviewCookies,
  resolveServerUrl,
} from './utils';
import {
  DEFAULT_EDITING_TIMEOUT,
  DEFAULT_EDITING_CACHE_CONTROL,
} from './constants';

/**
 * Base class for render middleware
 */
export abstract class RenderMiddlewareBase {
  protected fetcher: NativeDataFetcher;
  protected timeout: number;

  constructor(fetcher?: NativeDataFetcher, timeout: number = DEFAULT_EDITING_TIMEOUT) {
    this.fetcher = fetcher || new NativeDataFetcher();
    this.timeout = timeout;
  }

  /**
   * Handles the render request
   * @param {Request} req incoming request
   * @param {EditingRenderQueryParams} params editing parameters
   * @returns {Promise<Response>} response with rendered content
   */
  protected async handleRenderRequest(
    req: Request,
    params: EditingRenderQueryParams
  ): Promise<Response> {
    try {
      debug.editing('handling render request for route: %s', params.route);

      // Get propagation data
      const queryParams = getQueryParamsForPropagation(params as Record<string, string>);
      const headers = getHeadersForPropagation(req);
      const cookies = getCookiesForPropagation(req);
      const cleanedCookies = cleanupNextPreviewCookies(cookies);

      // Get the rendered HTML
      const html = await this.getRenderedHtml(req, params, queryParams, headers, cleanedCookies);

      // Create response
      const response = new Response(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': DEFAULT_EDITING_CACHE_CONTROL,
        },
      });

      debug.editing('render request completed successfully');
      return response;

    } catch (error) {
      debug.editing('render request failed: %o', error);
      
      return new Response(
        `<!DOCTYPE html>
<html>
<head>
  <title>Render Error</title>
</head>
<body>
  <h1>Render Error</h1>
  <p>Failed to render content: ${error instanceof Error ? error.message : 'Unknown error'}</p>
</body>
</html>`,
        {
          status: 500,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': DEFAULT_EDITING_CACHE_CONTROL,
          },
        }
      );
    }
  }

  /**
   * Gets the rendered HTML content
   * @param {Request} req incoming request
   * @param {EditingRenderQueryParams} params editing parameters
   * @param {Record<string, string>} queryParams query parameters for propagation
   * @param {Record<string, string>} headers headers for propagation
   * @param {string[]} cookies cookies for propagation
   * @returns {Promise<string>} rendered HTML
   */
  protected async getRenderedHtml(
    req: Request,
    params: EditingRenderQueryParams,
    queryParams: Record<string, string>,
    headers: Record<string, string>,
    cookies: string[]
  ): Promise<string> {
    const serverUrl = resolveServerUrl(req);
    const route = params.route || '/';
    
    // Build the internal request URL
    const url = new URL(route, serverUrl);
    
    // Add query parameters
    for (const [key, value] of Object.entries(queryParams)) {
      if (value) {
        url.searchParams.set(key, value);
      }
    }

    // Make the internal request with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await this.fetcher.fetch(url.toString(), {
        headers: {
          ...headers,
          'Cookie': cookies.join('; '),
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.status < 200 || response.status >= 300) {
        throw new Error(`Internal request failed: ${response.status} ${response.statusText}`);
      }

      return response.data as string;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Validates the request
   * @param {Request} req incoming request
   * @param {EditingRenderQueryParams} params editing parameters
   * @returns {boolean} true if request is valid
   */
  protected validateRequest(_req: Request, params: EditingRenderQueryParams): boolean {
    if (!params.route) {
      debug.editing('validation failed: missing route parameter');
      return false;
    }

    if (!params.mode) {
      debug.editing('validation failed: missing mode parameter');
      return false;
    }

    return true;
  }
}
