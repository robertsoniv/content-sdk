import { useQuery } from '@tanstack/react-query';
import { SitecoreQueryOptions } from '../types';
import { useSitecoreQueryContext } from '../context/SitecoreQueryContext';

/**
 * Hook for fetching Sitecore dictionary data with React Query caching
 * @param {string} site - The site name
 * @param {string} locale - The locale code
 * @param {SitecoreQueryOptions} queryOptions - React Query options
 * @returns {UseQueryResult<DictionaryPhrases>} React Query result with dictionary data
 */
export function useSitecoreDictionary(
  site: string,
  locale: string,
  queryOptions: SitecoreQueryOptions = {}
) {
  const { sitecoreClient } = useSitecoreQueryContext();

  return useQuery({
    queryKey: ['sitecore-dictionary', site, locale],
    queryFn: () => sitecoreClient.getDictionary({ site, locale }),
    staleTime: queryOptions.staleTime ?? 10 * 60 * 1000, // 10 minutes default
    cacheTime: queryOptions.cacheTime ?? 30 * 60 * 1000, // 30 minutes default
    refetchOnWindowFocus: queryOptions.refetchOnWindowFocus ?? false,
    retry: queryOptions.retry ?? 3,
    enabled: queryOptions.enabled ?? true,
  });
}

