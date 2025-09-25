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
