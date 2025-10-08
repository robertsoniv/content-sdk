import React, { createContext, useContext, useEffect, useState } from 'react';

/**
 * Preview context for React components
 */
export interface PreviewContextValue {
  isPreview: boolean;
  previewContext: import('./preview-context').PreviewContext;
  enterPreview: (context?: Partial<import('./preview-context').PreviewContext>) => void;
  exitPreview: () => void;
}

const PreviewContext = createContext<PreviewContextValue | null>(null);

/**
 * Props for PreviewProvider component
 */
export interface PreviewProviderProps {
  children: React.ReactNode;
  /** Initial preview context (usually from server-side detection) */
  initialContext?: import('./preview-context').PreviewContext;
  /** Whether to enable client-side preview mode detection */
  enableClientDetection?: boolean;
}

/**
 * Preview provider component that manages preview state
 */
export const PreviewProvider: React.FC<PreviewProviderProps> = ({
  children,
  initialContext,
  enableClientDetection = true,
}) => {
  const [previewContext, setPreviewContext] = useState<import('./preview-context').PreviewContext>(
    initialContext || { isPreview: false }
  );

  // Client-side preview detection
  useEffect(() => {
    if (!enableClientDetection || typeof window === 'undefined') {
      return;
    }

    const detectClientPreview = () => {
      const url = new URL(window.location.href);
      const searchParams = url.searchParams;
      
      // Check for preview parameters
      const isPreview = !!(
        searchParams.get('preview') === 'true' ||
        searchParams.get('sc_preview') === 'true' ||
        searchParams.get('sc_itemid') ||
        searchParams.get('__prerender_bypass') ||
        searchParams.get('__next_preview_data')
      );

      if (isPreview) {
        setPreviewContext({
          isPreview: true,
          previewToken: searchParams.get('preview_token') || undefined,
          previewItemId: searchParams.get('sc_itemid') || undefined,
          previewSite: searchParams.get('sc_site') || undefined,
          previewLanguage: searchParams.get('sc_lang') || undefined,
        });
      }
    };

    detectClientPreview();

    // Listen for URL changes (for SPA navigation)
    const handlePopState = () => {
      detectClientPreview();
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [enableClientDetection]);

  const enterPreview = (context: Partial<import('./preview-context').PreviewContext> = {}) => {
    const newContext: import('./preview-context').PreviewContext = {
      isPreview: true,
      ...context,
    };
    setPreviewContext(newContext);

    // Update URL with preview parameters
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('preview', 'true');
      
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

      window.history.pushState({}, '', url.toString());
    }
  };

  const exitPreview = () => {
    setPreviewContext({ isPreview: false });

    // Remove preview parameters from URL
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('preview');
      url.searchParams.delete('sc_preview');
      url.searchParams.delete('sc_itemid');
      url.searchParams.delete('sc_site');
      url.searchParams.delete('sc_lang');
      url.searchParams.delete('preview_token');
      url.searchParams.delete('__prerender_bypass');
      url.searchParams.delete('__next_preview_data');

      window.history.pushState({}, '', url.toString());
    }
  };

  const value: PreviewContextValue = {
    isPreview: previewContext.isPreview,
    previewContext,
    enterPreview,
    exitPreview,
  };

  return (
    <PreviewContext.Provider value={value}>
      {children}
    </PreviewContext.Provider>
  );
};

/**
 * Hook to access preview context
 * @returns Preview context value
 */
export const usePreview = (): PreviewContextValue => {
  const context = useContext(PreviewContext);
  if (!context) {
    throw new Error('usePreview must be used within a PreviewProvider');
  }
  return context;
};

/**
 * Hook to check if the current page is in preview mode
 * @returns boolean indicating if in preview mode
 */
export const useIsPreview = (): boolean => {
  const { isPreview } = usePreview();
  return isPreview;
};

/**
 * Component that renders children only in preview mode
 */
export interface PreviewOnlyProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const PreviewOnly: React.FC<PreviewOnlyProps> = ({ children, fallback = null }) => {
  const isPreview = useIsPreview();
  return isPreview ? <>{children}</> : <>{fallback}</>;
};

/**
 * Component that renders children only in normal (non-preview) mode
 */
export interface NormalOnlyProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const NormalOnly: React.FC<NormalOnlyProps> = ({ children, fallback = null }) => {
  const isPreview = useIsPreview();
  return !isPreview ? <>{children}</> : <>{fallback}</>;
};
