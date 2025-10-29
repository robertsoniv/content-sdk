/**
 * Preview context interface for TanStack applications
 */
export interface PreviewContext {
  /** Whether the current request is in preview mode */
  isPreview: boolean;
  /** Optional preview token for authentication */
  previewToken?: string;
  /** Sitecore item ID for preview (sc_itemid parameter) */
  previewItemId?: string;
  /** Site name for preview (sc_site parameter) */
  previewSite?: string;
  /** Language for preview (sc_lang parameter) */
  previewLanguage?: string;
  /** Custom preview parameters */
  customParams?: Record<string, string>;
}

/**
 * Preview mode detection options
 */
export interface PreviewDetectionOptions {
  /** Query parameter names to check for preview mode */
  previewParams?: string[];
  /** Cookie name for preview mode persistence */
  previewCookieName?: string;
  /** Whether to check for Sitecore-specific preview parameters */
  enableSitecorePreview?: boolean;
  /** Whether to check for Next.js compatibility parameters */
  enableNextJsCompatibility?: boolean;
}

/**
 * Default preview detection options
 */
export const DEFAULT_PREVIEW_OPTIONS: PreviewDetectionOptions = {
  previewParams: ['preview', 'sc_preview'],
  previewCookieName: '__preview',
  enableSitecorePreview: true,
  enableNextJsCompatibility: true,
};

/**
 * Detects preview context from a request
 * @param request - The incoming request
 * @param options - Preview detection options
 * @returns PreviewContext object
 */
export function detectPreviewContext(
  request: Request,
  options: PreviewDetectionOptions = DEFAULT_PREVIEW_OPTIONS
): PreviewContext {
  const url = new URL(request.url);
  const searchParams = url.searchParams;
  
  // Check query parameters for preview mode
  const isPreviewFromParams = checkPreviewParameters(searchParams, options);
  
  // Check cookies for preview mode
  const isPreviewFromCookie = checkPreviewCookie(request, options);
  
  const isPreview = isPreviewFromParams || isPreviewFromCookie;
  
  if (!isPreview) {
    return { isPreview: false };
  }
  
  // Extract preview context information
  const context: PreviewContext = {
    isPreview: true,
    previewToken: searchParams.get('preview_token') || undefined,
    previewItemId: searchParams.get('sc_itemid') || undefined,
    previewSite: searchParams.get('sc_site') || undefined,
    previewLanguage: searchParams.get('sc_lang') || undefined,
    customParams: extractCustomParams(searchParams, options),
  };
  
  return context;
}

/**
 * Checks if preview parameters are present in the URL
 */
function checkPreviewParameters(
  searchParams: URLSearchParams,
  options: PreviewDetectionOptions
): boolean {
  const { previewParams = [], enableSitecorePreview, enableNextJsCompatibility } = options;
  
  // Check custom preview parameters
  for (const param of previewParams) {
    if (searchParams.get(param) === 'true') {
      return true;
    }
  }
  
  // Check Sitecore-specific preview parameters
  if (enableSitecorePreview) {
    if (searchParams.get('sc_itemid')) {
      return true; // Sitecore item preview
    }
    if (searchParams.get('sc_mode') === 'preview') {
      return true;
    }
  }
  
  // Check Next.js compatibility parameters
  if (enableNextJsCompatibility) {
    if (searchParams.get('__prerender_bypass')) {
      return true;
    }
    if (searchParams.get('__next_preview_data')) {
      return true;
    }
  }
  
  return false;
}

/**
 * Checks if preview cookie is set
 */
function checkPreviewCookie(
  request: Request,
  options: PreviewDetectionOptions
): boolean {
  const { previewCookieName = '__preview' } = options;
  
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) {
    return false;
  }
  
  const cookies = cookieHeader
    .split(';')
    .map(c => c.trim())
    .reduce((acc, cookie) => {
      const [name, value] = cookie.split('=');
      acc[name] = value;
      return acc;
    }, {} as Record<string, string>);
  
  return cookies[previewCookieName] === 'true';
}

/**
 * Extracts custom parameters from the URL
 */
function extractCustomParams(
  searchParams: URLSearchParams,
  options: PreviewDetectionOptions
): Record<string, string> {
  const customParams: Record<string, string> = {};
  const { previewParams = [] } = options;
  
  // Extract all parameters that aren't standard preview parameters
  for (const [key, value] of searchParams.entries()) {
    if (
      !previewParams.includes(key) &&
      !key.startsWith('sc_') &&
      !key.startsWith('__')
    ) {
      customParams[key] = value;
    }
  }
  
  return customParams;
}

/**
 * Sets preview cookie in response headers
 * @param response - The response object
 * @param enabled - Whether to enable or disable preview mode
 * @param options - Preview detection options
 */
export function setPreviewCookie(
  response: Response,
  enabled: boolean,
  options: PreviewDetectionOptions = DEFAULT_PREVIEW_OPTIONS
): void {
  const { previewCookieName = '__preview' } = options;
  const cookieValue = enabled ? 'true' : 'false';
  const cookieString = `${previewCookieName}=${cookieValue}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${enabled ? 3600 : 0}`;
  
  // Get existing Set-Cookie headers
  const existingCookies = response.headers.get('Set-Cookie');
  const newCookies = existingCookies ? `${existingCookies}; ${cookieString}` : cookieString;
  
  response.headers.set('Set-Cookie', newCookies);
}

/**
 * Creates a preview URL with the necessary parameters
 * @param baseUrl - The base URL
 * @param context - Preview context
 * @param options - Preview detection options
 * @returns URL with preview parameters
 */
export function createPreviewUrl(
  baseUrl: string,
  context: PreviewContext,
  options: PreviewDetectionOptions = DEFAULT_PREVIEW_OPTIONS
): string {
  const url = new URL(baseUrl);
  const { previewParams = ['preview'] } = options;
  
  // Set preview parameter
  url.searchParams.set(previewParams[0], 'true');
  
  // Add Sitecore-specific parameters
  if (context.previewItemId) {
    url.searchParams.set('sc_itemid', context.previewItemId);
  }
  if (context.previewSite) {
    url.searchParams.set('sc_site', context.previewSite);
  }
  if (context.previewLanguage) {
    url.searchParams.set('sc_lang', context.previewLanguage);
  }
  if (context.previewToken) {
    url.searchParams.set('preview_token', context.previewToken);
  }
  
  // Add custom parameters
  if (context.customParams) {
    for (const [key, value] of Object.entries(context.customParams)) {
      url.searchParams.set(key, value);
    }
  }
  
  return url.toString();
}
