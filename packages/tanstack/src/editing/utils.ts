import {
  DesignLibraryRenderPreviewData,
  EditingRenderQueryParams,
  isDesignLibraryMode,
  PREVIEW_KEY,
  QUERY_PARAM_EDITING_SECRET,
} from '@sitecore-content-sdk/core/editing';
import { DEFAULT_VARIANT } from '@sitecore-content-sdk/core/personalize';
import { SITE_KEY } from '@sitecore-content-sdk/core/site';
import { NativeDataFetcher } from '@sitecore-content-sdk/core';
import { getAllowedOriginsFromEnv } from '@sitecore-content-sdk/core/utils';
import {
  EDITING_PASS_THROUGH_HEADERS,
  QUERY_PARAM_VERCEL_PROTECTION_BYPASS,
  QUERY_PARAM_VERCEL_SET_BYPASS_COOKIE,
  DEFAULT_EDITING_SECRET_ENV,
  DEFAULT_EDITING_ALLOWED_ORIGINS_ENV,
} from './constants';

/**
 * Gets editing secret value from request
 * @param {Request} req incoming request
 * @returns {string | undefined} editing secret value if present
 */
export const getEditingSecretFromRequest = (req: Request): string | undefined => {
  const url = new URL(req.url);
  const searchParams = url.searchParams;
  
  return searchParams.get(QUERY_PARAM_EDITING_SECRET) || undefined;
};

/**
 * Gets editing secret from environment variables
 * @returns {string | undefined} editing secret value if present
 */
export const getEditingSecretFromEnv = (): string | undefined => {
  return process.env[DEFAULT_EDITING_SECRET_ENV] || undefined;
};

/**
 * Validates editing secret
 * @param {Request} req incoming request
 * @returns {boolean} true if secret is valid
 */
export const validateEditingSecret = (req: Request): boolean => {
  const requestSecret = getEditingSecretFromRequest(req);
  const envSecret = getEditingSecretFromEnv();
  
  if (!envSecret) {
    console.warn('No editing secret configured in environment variables');
    return false;
  }
  
  if (!requestSecret) {
    return false;
  }
  
  return requestSecret === envSecret;
};

/**
 * Gets allowed origins for editing requests
 * @returns {string[]} array of allowed origins
 */
export const getAllowedOrigins = (): string[] => {
  const envOrigins = process.env[DEFAULT_EDITING_ALLOWED_ORIGINS_ENV];
  if (envOrigins) {
    return envOrigins.split(',').map(origin => origin.trim());
  }
  
  return getAllowedOriginsFromEnv();
};

/**
 * Validates request origin
 * @param {Request} req incoming request
 * @returns {boolean} true if origin is allowed
 */
export const validateOrigin = (req: Request): boolean => {
  const allowedOrigins = getAllowedOrigins();
  const origin = req.headers.get('origin');
  
  if (!origin) {
    return false;
  }
  
  return allowedOrigins.includes(origin);
};

/**
 * Gets query parameters for propagation
 * @param {Record<string, string>} query query parameters
 * @returns {Record<string, string>} filtered query parameters
 */
export const getQueryParamsForPropagation = (query: Record<string, string>): Record<string, string> => {
  const propagatedParams: Record<string, string> = {};
  
  // Propagate Vercel protection bypass parameters
  if (query[QUERY_PARAM_VERCEL_PROTECTION_BYPASS]) {
    propagatedParams[QUERY_PARAM_VERCEL_PROTECTION_BYPASS] = query[QUERY_PARAM_VERCEL_PROTECTION_BYPASS];
  }
  if (query[QUERY_PARAM_VERCEL_SET_BYPASS_COOKIE]) {
    propagatedParams[QUERY_PARAM_VERCEL_SET_BYPASS_COOKIE] = query[QUERY_PARAM_VERCEL_SET_BYPASS_COOKIE];
  }
  
  return propagatedParams;
};

/**
 * Gets headers for propagation
 * @param {Request} req incoming request
 * @returns {Record<string, string>} filtered headers
 */
export const getHeadersForPropagation = (req: Request): Record<string, string> => {
  const propagatedHeaders: Record<string, string> = {};
  
  for (const headerName of EDITING_PASS_THROUGH_HEADERS) {
    const headerValue = req.headers.get(headerName);
    if (headerValue) {
      propagatedHeaders[headerName] = headerValue;
    }
  }
  
  return propagatedHeaders;
};

/**
 * Gets cookies for propagation
 * @param {Request} req incoming request
 * @returns {string[]} array of cookie strings
 */
export const getCookiesForPropagation = (req: Request): string[] => {
  const cookieHeader = req.headers.get('cookie');
  if (!cookieHeader) {
    return [];
  }
  
  return cookieHeader.split(';').map(cookie => cookie.trim());
};

/**
 * Cleans up Next.js preview cookies
 * @param {string[]} cookies array of cookie strings
 * @returns {string[]} filtered cookies
 */
export const cleanupNextPreviewCookies = (cookies: string[]): string[] => {
  return cookies.filter(cookie => {
    const cookieName = cookie.split('=')[0];
    return !cookieName.startsWith('__next') && !cookieName.startsWith('__prerender');
  });
};

/**
 * Gets preview cookies from request
 * @param {Request} req incoming request
 * @returns {string[]} array of preview cookie strings
 */
export const getPreviewCookies = (req: Request): string[] => {
  const cookieHeader = req.headers.get('cookie');
  if (!cookieHeader) {
    return [];
  }
  
  const cookies = cookieHeader.split(';').map(cookie => cookie.trim());
  return cookies.filter(cookie => {
    const cookieName = cookie.split('=')[0];
    return cookieName === PREVIEW_KEY || cookieName === SITE_KEY;
  });
};

/**
 * Gets required editing parameters list
 * @returns {string[]} array of required parameter names
 */
export const getRequiredEditingParamsList = (): string[] => {
  return [
    QUERY_PARAM_EDITING_SECRET,
    'mode',
    'route',
  ];
};

/**
 * Maps editing parameters from request
 * @param {Request} req incoming request
 * @returns {EditingRenderQueryParams} mapped parameters
 */
export const mapEditingParams = (req: Request): EditingRenderQueryParams => {
  const url = new URL(req.url);
  const searchParams = url.searchParams;
  
  return {
    [QUERY_PARAM_EDITING_SECRET]: searchParams.get(QUERY_PARAM_EDITING_SECRET) || '',
    mode: (searchParams.get('mode') || '') as any, // Type assertion for mode
    route: searchParams.get('route') || '',
    sc_itemid: searchParams.get('sc_itemid') || '',
    sc_lang: searchParams.get('sc_lang') || '',
    sc_site: searchParams.get('sc_site') || '',
    sc_variant: searchParams.get('sc_variant') || DEFAULT_VARIANT,
    sc_web: searchParams.get('sc_web') || '',
  };
};

/**
 * Gets editing request HTML
 * @param {string} route route to render
 * @param {EditingRenderQueryParams} params editing parameters
 * @param {string[]} cookies cookies to include
 * @param {Record<string, string>} headers headers to include
 * @param {NativeDataFetcher} fetcher data fetcher
 * @returns {Promise<string>} HTML content
 */
export const getEditingRequestHtml = async (
  route: string,
  params: EditingRenderQueryParams,
  cookies: string[],
  headers: Record<string, string>,
  fetcher: NativeDataFetcher
): Promise<string> => {
  // Build the internal request URL
  const baseUrl = process.env.SITECORE_API_HOST || 'http://localhost:3000';
  const url = new URL(route, baseUrl);
  
  // Add query parameters
  for (const [key, value] of Object.entries(params)) {
    if (value && typeof value === 'string') {
      url.searchParams.set(key, value);
    }
  }
  
  // Make the internal request
  const response = await fetcher.fetch(url.toString(), {
    headers: {
      ...headers,
      'Cookie': cookies.join('; '),
    },
  });
  
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Failed to fetch editing content: ${response.status} ${response.statusText}`);
  }
  
  return response.data as string;
};

/**
 * Gets CSP header for editing mode
 * @returns {string} Content Security Policy header value
 */
export const getCSPHeader = (): string => {
  return process.env.EDITING_CSP_HEADER || "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:; img-src 'self' data: blob: https:; connect-src 'self' https: wss:; frame-src 'self' https:;";
};

/**
 * Resolves server URL for internal requests
 * @param {Request} req incoming request
 * @returns {string} server URL
 */
export const resolveServerUrl = (req: Request): string => {
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
};

/**
 * Checks if the request is for design library preview
 * @param {EditingRenderQueryParams} params editing parameters
 * @returns {boolean} true if design library preview
 */
export const isDesignLibraryPreviewData = (params: EditingRenderQueryParams): boolean => {
  return isDesignLibraryMode(params.mode);
};

/**
 * Gets design library preview data
 * @param {EditingRenderQueryParams} params editing parameters
 * @returns {DesignLibraryRenderPreviewData | null} design library data or null
 */
export const getDesignLibraryPreviewData = (params: EditingRenderQueryParams): DesignLibraryRenderPreviewData | null => {
  if (!isDesignLibraryPreviewData(params)) {
    return null;
  }
  
  return {
    mode: params.mode as any, // Type assertion for design library mode
    site: params.sc_site || '',
    itemId: params.sc_itemid || '',
    renderingId: '', // Not available in params
    componentUid: '', // Not available in params
    language: params.sc_lang || '',
    variant: params.sc_variant,
  };
};
