import { useQuery } from '@tanstack/react-query';
import { PageOptions } from '@sitecore-content-sdk/core/client';
import { SitecoreQueryOptions } from '../types';
import { useSitecoreQueryContext } from '../context/SitecoreQueryContext';

/**
 * Hook for fetching Sitecore page data with React Query caching
 * @param {string} path - The page path to fetch
 * @param {PageOptions} pageOptions - Page fetching options (locale, site, etc.)
 * @param {SitecoreQueryOptions} queryOptions - React Query options
 * @returns {UseQueryResult<Page | null>} React Query result with page data
 */
export function useSitecorePage(
  path: string,
  pageOptions: PageOptions = {},
  queryOptions: SitecoreQueryOptions = {}
) {
  const { sitecoreClient } = useSitecoreQueryContext();

  return useQuery({
    queryKey: ['sitecore-page', path, pageOptions],
    queryFn: () => sitecoreClient.getPage(path, pageOptions),
    staleTime: queryOptions.staleTime ?? 5 * 60 * 1000, // 5 minutes default
    cacheTime: queryOptions.cacheTime ?? 10 * 60 * 1000, // 10 minutes default
    refetchOnWindowFocus: queryOptions.refetchOnWindowFocus ?? false,
    retry: queryOptions.retry ?? 3,
    enabled: queryOptions.enabled ?? true,
  });
}

/**
 * Hook for fetching Sitecore preview page data
 * @param {EditingPreviewData} previewData - Preview data for editing mode
 * @param {SitecoreQueryOptions} queryOptions - React Query options
 * @returns {UseQueryResult<Page | null>} React Query result with preview page data
 */
export function useSitecorePreviewPage(
  previewData: any, // EditingPreviewData from core
  queryOptions: SitecoreQueryOptions = {}
) {
  const { sitecoreClient } = useSitecoreQueryContext();

  return useQuery({
    queryKey: ['sitecore-preview-page', previewData],
    queryFn: () => sitecoreClient.getPreview(previewData),
    staleTime: queryOptions.staleTime ?? 0, // Always fresh for preview
    cacheTime: queryOptions.cacheTime ?? 0,
    refetchOnWindowFocus: queryOptions.refetchOnWindowFocus ?? true,
    retry: queryOptions.retry ?? 1,
    enabled: queryOptions.enabled ?? true,
  });
}

/**
 * Hook for fetching Sitecore design library data
 * @param {DesignLibraryRenderPreviewData} designLibData - Design library preview data
 * @param {SitecoreQueryOptions} queryOptions - React Query options
 * @returns {UseQueryResult<Page>} React Query result with design library data
 */
export function useSitecoreDesignLibraryPage(
  designLibData: any, // DesignLibraryRenderPreviewData from core
  queryOptions: SitecoreQueryOptions = {}
) {
  const { sitecoreClient } = useSitecoreQueryContext();

  return useQuery({
    queryKey: ['sitecore-design-library', designLibData],
    queryFn: () => sitecoreClient.getDesignLibraryData(designLibData),
    staleTime: queryOptions.staleTime ?? 0, // Always fresh for design library
    cacheTime: queryOptions.cacheTime ?? 0,
    refetchOnWindowFocus: queryOptions.refetchOnWindowFocus ?? true,
    retry: queryOptions.retry ?? 1,
    enabled: queryOptions.enabled ?? true,
  });
}

