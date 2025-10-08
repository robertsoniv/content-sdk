import { detectPreviewContext, setPreviewCookie, PreviewContext, PreviewDetectionOptions } from './preview-context';

/**
 * Enhanced middleware base class with preview mode support
 */
export abstract class PreviewAwareMiddleware {
  protected previewOptions: PreviewDetectionOptions;

  constructor(previewOptions: PreviewDetectionOptions = {}) {
    this.previewOptions = {
      previewParams: ['preview', 'sc_preview'],
      previewCookieName: '__preview',
      enableSitecorePreview: true,
      enableNextJsCompatibility: true,
      ...previewOptions,
    };
  }

  /**
   * Detects if the request is in preview mode
   * @param request - The incoming request
   * @returns PreviewContext object
   */
  protected detectPreview(request: Request): PreviewContext {
    return detectPreviewContext(request, this.previewOptions);
  }

  /**
   * Checks if the request is in preview mode (simple boolean check)
   * @param request - The incoming request
   * @returns boolean indicating if in preview mode
   */
  protected isPreview(request: Request): boolean {
    return this.detectPreview(request).isPreview;
  }

  /**
   * Sets preview cookie in response
   * @param response - The response object
   * @param enabled - Whether to enable preview mode
   */
  protected setPreviewCookie(response: Response, enabled: boolean): void {
    setPreviewCookie(response, enabled, this.previewOptions);
  }

  /**
   * Handles preview mode logic in middleware
   * @param request - The incoming request
   * @param response - The response object
   * @returns Modified response or null if preview should be handled differently
   */
  protected handlePreviewMode(request: Request, response: Response): Response | null {
    const previewContext = this.detectPreview(request);
    
    if (previewContext.isPreview) {
      // Set preview cookie for session persistence
      this.setPreviewCookie(response, true);
      
      // Add preview headers for downstream processing
      response.headers.set('X-Preview-Mode', 'true');
      if (previewContext.previewItemId) {
        response.headers.set('X-Preview-Item-Id', previewContext.previewItemId);
      }
      if (previewContext.previewSite) {
        response.headers.set('X-Preview-Site', previewContext.previewSite);
      }
      if (previewContext.previewLanguage) {
        response.headers.set('X-Preview-Language', previewContext.previewLanguage);
      }
    } else {
      // Clear preview cookie if not in preview mode
      this.setPreviewCookie(response, false);
      response.headers.delete('X-Preview-Mode');
      response.headers.delete('X-Preview-Item-Id');
      response.headers.delete('X-Preview-Site');
      response.headers.delete('X-Preview-Language');
    }

    return response;
  }

  /**
   * Abstract method that subclasses must implement
   * @param request - The incoming request
   * @param response - The response object
   * @returns Modified response
   */
  abstract handle(request: Request, response: Response): Promise<Response>;
}

/**
 * Preview-aware redirects middleware
 */
export class PreviewAwareRedirectsMiddleware extends PreviewAwareMiddleware {
  constructor(previewOptions?: PreviewDetectionOptions) {
    super(previewOptions);
  }

  async handle(request: Request, response: Response): Promise<Response> {
    // Skip redirects in preview mode
    if (this.isPreview(request)) {
      console.debug('redirects middleware: skipped (preview mode)');
      return response;
    }

    // Handle preview mode cookies and headers
    this.handlePreviewMode(request, response);

    // Continue with normal redirect logic
    return this.handleRedirects(request, response);
  }

  /**
   * Override this method in subclasses to implement redirect logic
   */
  protected async handleRedirects(_request: Request, response: Response): Promise<Response> {
    // Default implementation - no redirects
    return response;
  }
}

/**
 * Preview-aware personalization middleware
 */
export class PreviewAwarePersonalizeMiddleware extends PreviewAwareMiddleware {
  constructor(previewOptions?: PreviewDetectionOptions) {
    super(previewOptions);
  }

  async handle(request: Request, response: Response): Promise<Response> {
    // Skip personalization in preview mode
    if (this.isPreview(request)) {
      console.debug('personalize middleware: skipped (preview mode)');
      return response;
    }

    // Handle preview mode cookies and headers
    this.handlePreviewMode(request, response);

    // Continue with normal personalization logic
    return this.handlePersonalization(request, response);
  }

  /**
   * Override this method in subclasses to implement personalization logic
   */
  protected async handlePersonalization(_request: Request, response: Response): Promise<Response> {
    // Default implementation - no personalization
    return response;
  }
}

/**
 * Preview-aware multisite middleware
 */
export class PreviewAwareMultisiteMiddleware extends PreviewAwareMiddleware {
  constructor(previewOptions?: PreviewDetectionOptions) {
    super(previewOptions);
  }

  async handle(request: Request, response: Response): Promise<Response> {
    const previewContext = this.detectPreview(request);
    
    // Handle preview mode cookies and headers
    this.handlePreviewMode(request, response);

    // In preview mode, use preview site if specified
    if (previewContext.isPreview && previewContext.previewSite) {
      console.debug('multisite middleware: using preview site', previewContext.previewSite);
      response.headers.set('X-Site-Name', previewContext.previewSite);
      return response;
    }

    // Continue with normal multisite logic
    return this.handleMultisite(request, response);
  }

  /**
   * Override this method in subclasses to implement multisite logic
   */
  protected async handleMultisite(_request: Request, response: Response): Promise<Response> {
    // Default implementation - no multisite logic
    return response;
  }
}
