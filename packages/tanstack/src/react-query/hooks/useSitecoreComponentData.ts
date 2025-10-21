import { useQuery } from '@tanstack/react-query';
import { LayoutServiceData } from '@sitecore-content-sdk/core/layout';
import { TanstackContext } from '../../sharedTypes/component-props';
import { ComponentMap } from '@sitecore-content-sdk/react';
import { SitecoreQueryOptions } from '../types';
import { useSitecoreQueryContext } from '../context/SitecoreQueryContext';

/**
 * Hook for fetching Sitecore component data with React Query caching
 * @param {LayoutServiceData} layoutData - Layout data to parse components from
 * @param {TanstackContext} context - TanStack context
 * @param {ComponentMap} components - Component map to get props for
 * @param {SitecoreQueryOptions} queryOptions - React Query options
 * @returns {UseQueryResult<ComponentPropsCollection>} React Query result with component data
 */
export function useSitecoreComponentData(
  layoutData: LayoutServiceData,
  context: TanstackContext,
  components: ComponentMap,
  queryOptions: SitecoreQueryOptions = {}
) {
  const { sitecoreClient } = useSitecoreQueryContext();

  return useQuery({
    queryKey: ['sitecore-component-data', layoutData.sitecore.route?.itemId, context],
    queryFn: () => sitecoreClient.getComponentData(layoutData, context, components),
    staleTime: queryOptions.staleTime ?? 2 * 60 * 1000, // 2 minutes default
    cacheTime: queryOptions.cacheTime ?? 5 * 60 * 1000, // 5 minutes default
    refetchOnWindowFocus: queryOptions.refetchOnWindowFocus ?? false,
    retry: queryOptions.retry ?? 2,
    enabled: queryOptions.enabled ?? true,
  });
}

/**
 * Hook for prefetching component data
 * @param {LayoutServiceData} layoutData - Layout data to parse components from
 * @param {TanstackContext} context - TanStack context
 * @param {ComponentMap} components - Component map to get props for
 * @param {SitecoreQueryOptions} queryOptions - React Query options
 * @returns {void} Prefetches component data
 */
export function usePrefetchSitecoreComponentData(
  layoutData: LayoutServiceData,
  context: TanstackContext,
  components: ComponentMap,
  queryOptions: SitecoreQueryOptions = {}
) {
  const { queryClient, sitecoreClient } = useSitecoreQueryContext();

  return queryClient.prefetchQuery({
    queryKey: ['sitecore-component-data', layoutData.sitecore.route?.itemId, context],
    queryFn: () => sitecoreClient.getComponentData(layoutData, context, components),
    staleTime: queryOptions.staleTime ?? 2 * 60 * 1000,
  });
}

