import { isEditorActive, resetEditorChromes } from '@sitecore-content-sdk/core/editing';

/**
 * Extract path from TanStack Router context
 * @param {string} path the path to extract
 * @returns {string} the extracted path
 */
export const extractPath = (path: string): string => {
  if (!path || path === '/') {
    return '/';
  }
  
  // Remove leading slash if present
  const normalized = path.startsWith('/') ? path.slice(1) : path;
  
  // Return normalized path with leading slash
  return normalized === '' ? '/' : `/${normalized}`;
};

/**
 * Since Sitecore editors do not support Fast Refresh:
 * 1. Subscribe on events provided by webpack.
 * 2. Reset editor chromes when build is finished
 * @param {boolean} [forceReload] force page reload instead of reset chromes
 */
export const handleEditorFastRefresh = (forceReload = false): void => {
  if (process.env.NODE_ENV !== 'development' || !isEditorActive()) {
    // Only run if development mode and editor is active
    return;
  }
  const eventSource = new window.EventSource('/_next/webpack-hmr');

  window.addEventListener('beforeunload', () => eventSource.close());

  eventSource.onopen = () => console.log('[Sitecore Editor Fast Refresh Listener] Online');

  eventSource.onmessage = (event) => {
    if (event.data.indexOf('{') === -1) return; // heartbeat

    const payload = JSON.parse(event.data);

    console.debug(`[Sitecore Editor Fast Refresh Listener] Saw event: ${JSON.stringify(payload)}`);

    if (payload.action !== 'built') return;

    if (forceReload) return window.location.reload();

    setTimeout(() => {
      console.log(
        '[Sitecore Editor HMR Listener] Sitecore editor does not support Fast Refresh, reloading chromes...'
      );
      resetEditorChromes();
    }, 500);
  };
};

export const getEditingSecret = (): string => {
  const secret = process.env.SITECORE_EDITING_SECRET;
  if (!secret || secret.length === 0) {
    throw new Error('The SITECORE_EDITING_SECRET environment variable is missing or invalid.');
  }
  return secret;
};

/**
 * For TanStack Router, extracts the site and locale information from the rewrite header which is in format /[site]/[locale]/[...path].
 * @param {Headers} headers - The `Headers` object containing the rewrite header.
 * @returns An object containing the `site` and `locale` extracted from the rewrite header.
 */
export const parseRewriteHeader = (headers: Headers) => {
  const REWRITE_HEADER_NAME = 'x-rewrite-path';
  const rewriteHeader = headers.get(REWRITE_HEADER_NAME);
  const rewriteSegments = rewriteHeader?.split('/').filter((segment) => segment) || [];
  const site = rewriteSegments[0];
  const locale = rewriteSegments[1];
  return { site, locale };
};

/**
 * TanStack Start specific utilities
 */
export class TanstackUtils {
  /**
   * Check if the current environment is server-side
   * @returns {boolean} true if server-side
   */
  static isServer(): boolean {
    return typeof window === 'undefined';
  }

  /**
   * Check if the current environment is client-side
   * @returns {boolean} true if client-side
   */
  static isClient(): boolean {
    return typeof window !== 'undefined';
  }

  /**
   * Get the base URL for the application
   * @param {Request} req the request object
   * @returns {string} the base URL
   */
  static getBaseUrl(req: Request): string {
    const url = new URL(req.url);
    return `${url.protocol}//${url.host}`;
  }

  /**
   * Normalize a path for TanStack Router
   * @param {string} path the path to normalize
   * @returns {string} the normalized path
   */
  static normalizePath(path: string): string {
    // Remove leading slash if present
    const normalized = path.startsWith('/') ? path.slice(1) : path;
    // Ensure it doesn't end with slash unless it's root
    return normalized === '' ? '/' : `/${normalized}`;
  }

  /**
   * Create a URL with proper base URL
   * @param {string} path the path
   * @param {string} baseUrl the base URL
   * @returns {string} the full URL
   */
  static createUrl(path: string, baseUrl: string): string {
    const normalizedPath = this.normalizePath(path);
    return `${baseUrl}${normalizedPath}`;
  }

  /**
   * Extract locale from path
   * @param {string} path the path
   * @param {string[]} locales available locales
   * @returns {string | null} the locale or null if not found
   */
  static extractLocaleFromPath(path: string, locales: string[]): string | null {
    const segments = path.split('/').filter(Boolean);
    const firstSegment = segments[0];

    if (firstSegment && locales.includes(firstSegment)) {
      return firstSegment;
    }

    return null;
  }

  /**
   * Remove locale from path
   * @param {string} path the path
   * @param {string} locale the locale to remove
   * @returns {string} the path without locale
   */
  static removeLocaleFromPath(path: string, locale: string): string {
    const localePrefix = `/${locale}`;

    if (path.startsWith(localePrefix)) {
      return path.slice(localePrefix.length) || '/';
    }

    return path;
  }
}
