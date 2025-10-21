import { ComponentRendering } from '@sitecore-content-sdk/core/layout';
import { ReactContentSdkComponent } from '@sitecore-content-sdk/react';

export type ComponentPropsError = { error: string; componentName: string };

/**
 * Shape of component props storage
 */
export type ComponentPropsCollection = {
  [componentUid: string]: unknown | ComponentPropsError;
};

export type TanstackContext = {
  request: Request;
  response: Response;
  params: Record<string, string>;
  search: Record<string, unknown>;
  url: URL;
};

/**
 * Type of side effect function which could be invoked on component level (getComponentServerProps)
 */
export type ComponentPropsFetchFunction<FetchedProps = unknown> = {
  (
    rendering: ComponentRendering,
    layoutData: any,
    context: TanstackContext
  ): Promise<FetchedProps>;
};

/**
 * Defines the shape of a data-fetching function used at the component level.
 *
 * This function can be used in TanStack Start contexts.
 * It enables component-specific data loading that integrates with TanStack rendering flows.
 *
 * The returned props are passed directly to the component at render time.
 */
export type GetComponentServerProps = ComponentPropsFetchFunction;

/**
 * Represents a TanStack component import
 */
export type TanstackContentSdkComponent = ReactContentSdkComponent & {
  /**
   * Defines the shape of a data-fetching function used at the component level.
   *
   * This function can be used in TanStack Start contexts.
   * It enables component-specific data loading that integrates with TanStack rendering flows.
   *
   * The returned props are passed directly to the component at render time.
   */
  getComponentServerProps?: GetComponentServerProps;
  /**
   * Optional dynamic import for lazy components - allows component props retrieval
   */
  dynamicModule?: () => Promise<ReactContentSdkComponent>;
};
