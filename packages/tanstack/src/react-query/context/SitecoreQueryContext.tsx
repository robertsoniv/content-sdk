import React, { createContext, useContext, ReactNode } from 'react';
import { QueryClient } from '@tanstack/react-query';
import { SitecoreTanstackClient } from '../../client';
import { SitecoreRouterContext } from '../types';

const SitecoreQueryContext = createContext<SitecoreRouterContext | null>(null);

/**
 * Provider component for Sitecore Query context
 */
export function SitecoreQueryProvider({
  children,
  queryClient,
  sitecoreClient,
}: {
  children: ReactNode;
  queryClient: QueryClient;
  sitecoreClient: SitecoreTanstackClient;
}) {
  return (
    <SitecoreQueryContext.Provider value={{ queryClient, sitecoreClient }}>
      {children}
    </SitecoreQueryContext.Provider>
  );
}

/**
 * Hook to access Sitecore Query context
 * @returns {SitecoreRouterContext} The router context with queryClient and sitecoreClient
 */
export function useSitecoreQueryContext(): SitecoreRouterContext {
  const context = useContext(SitecoreQueryContext);
  
  if (!context) {
    throw new Error(
      'useSitecoreQueryContext must be used within a SitecoreQueryProvider. ' +
      'Make sure to wrap your app with SitecoreQueryProvider and provide both queryClient and sitecoreClient.'
    );
  }
  
  return context;
}
