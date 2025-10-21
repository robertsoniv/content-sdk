// Note: Site info hooks are not available as getSiteInfo is not implemented in SitecoreTanstackClient
// These hooks can be added when the client supports site info functionality

import { SitecoreQueryOptions } from '../types';

/**
 * Hook for fetching Sitecore site information with React Query caching
 * @param {string} path - The path to get site info for
 * @param {SitecoreQueryOptions} queryOptions - React Query options
 * @returns {UseQueryResult<SiteInfo>} React Query result with site info
 * @deprecated Not available - getSiteInfo not implemented in SitecoreTanstackClient
 */
export function useSitecoreSiteInfo(
  _path: string,
  _queryOptions: SitecoreQueryOptions = {}
) {
  throw new Error('useSitecoreSiteInfo is not available - getSiteInfo not implemented in SitecoreTanstackClient');
}

/**
 * Hook for fetching multiple site information
 * @param {string[]} paths - Array of paths to get site info for
 * @param {SitecoreQueryOptions} queryOptions - React Query options
 * @returns {UseQueryResult<SiteInfo[]>} React Query result with array of site info
 * @deprecated Not available - getSiteInfo not implemented in SitecoreTanstackClient
 */
export function useSitecoreMultipleSiteInfo(
  _paths: string[],
  _queryOptions: SitecoreQueryOptions = {}
) {
  throw new Error('useSitecoreMultipleSiteInfo is not available - getSiteInfo not implemented in SitecoreTanstackClient');
}

