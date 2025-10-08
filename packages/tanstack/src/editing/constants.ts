/**
 * Constants for TanStack editing functionality
 */

/**
 * Headers that should be passed through from the original request
 */
export const EDITING_PASS_THROUGH_HEADERS = [
  'accept',
  'accept-encoding',
  'accept-language',
  'cache-control',
  'connection',
  'content-length',
  'content-type',
  'host',
  'origin',
  'referer',
  'user-agent',
  'x-forwarded-for',
  'x-forwarded-host',
  'x-forwarded-proto',
  'x-real-ip',
] as const;

/**
 * Query parameter for Vercel protection bypass
 */
export const QUERY_PARAM_VERCEL_PROTECTION_BYPASS = '__vercel_protection_bypass';

/**
 * Query parameter for setting Vercel bypass cookie
 */
export const QUERY_PARAM_VERCEL_SET_BYPASS_COOKIE = '__vercel_set_bypass_cookie';

/**
 * Default editing secret environment variable name
 */
export const DEFAULT_EDITING_SECRET_ENV = 'SITECORE_EDITING_SECRET';

/**
 * Default editing allowed origins environment variable name
 */
export const DEFAULT_EDITING_ALLOWED_ORIGINS_ENV = 'SITECORE_EDITING_ALLOWED_ORIGINS';

/**
 * Default editing render endpoint path
 */
export const DEFAULT_EDITING_RENDER_PATH = '/api/editing/render';

/**
 * Default editing config endpoint path
 */
export const DEFAULT_EDITING_CONFIG_PATH = '/api/editing/config';

/**
 * Default FEAAS render endpoint path
 */
export const DEFAULT_FEAAS_RENDER_PATH = '/api/editing/feaas';

/**
 * Content Security Policy header for editing mode
 */
export const EDITING_CSP_HEADER = "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:; img-src 'self' data: blob: https:; connect-src 'self' https: wss:; frame-src 'self' https:;";

/**
 * Default timeout for editing requests (in milliseconds)
 */
export const DEFAULT_EDITING_TIMEOUT = 30000;

/**
 * Default cache control for editing responses
 */
export const DEFAULT_EDITING_CACHE_CONTROL = 'no-cache, no-store, must-revalidate';
