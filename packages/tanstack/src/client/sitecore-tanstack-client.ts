import {
  SitecoreClient,
  SitecoreClientInit,
  Page,
  PageOptions,
  FetchOptions,
} from '@sitecore-content-sdk/core/client';
import {
  LayoutServiceData,
} from '@sitecore-content-sdk/core/layout';
import {
  DesignLibraryRenderPreviewData,
  EditingPreviewData,
} from '@sitecore-content-sdk/core/editing';
import {
  ComponentPropsCollection,
  TanstackContext,
  TanstackContentSdkComponent,
  ComponentPropsError,
} from '../sharedTypes/component-props';
import { ComponentMap } from '@sitecore-content-sdk/react';
import { ComponentPropsService } from '../services/component-props-service';

/**
 * TanStack Start specific client for Sitecore Content SDK
 */
export class SitecoreTanstackClient extends SitecoreClient {
  protected componentPropsService: ComponentPropsService;

  constructor(protected initOptions: SitecoreClientInit) {
    super(initOptions);
    this.componentPropsService = this.getComponentPropsService();
  }

  /**
   * TanStack-specific path parsing
   * @param {string | string[]} path string or string array path
   * @returns {string} string path
   */
  parsePath(path: string | string[]): string {
    // For now, use the base implementation
    // This can be extended for TanStack-specific routing logic
    return super.parsePath(path);
  }

  /**
   * Gets site name based on the provided path
   * @param {string | string[]} path path to get site name from
   * @returns site name, or default site info if not found
   */
  getSiteNameFromPath(_path: string | string[]): string {
    // For TanStack, we can implement site resolution logic here
    // For now, return the default site
    return this.initOptions.defaultSite || 'default';
  }

  /**
   * TanStack-specific page fetching with path handling
   * @param {string | string[]} path the path to fetch
   * @param {PageOptions} pageOptions additional overrides like language, site name and personalization variants
   * @param {FetchOptions} [fetchOptions] Additional fetch options to override GraphQL requests
   * @returns {Promise<Page | null>} page details when page layout is found and null when not
   */
  async getPage(
    path: string | string[],
    pageOptions: PageOptions = {},
    fetchOptions?: FetchOptions
  ): Promise<Page | null> {
    const resolvedPath = this.parsePath(path);
    const site = pageOptions.site || this.getSiteNameFromPath(path);
    
    return super.getPage(
      resolvedPath,
      {
        locale: pageOptions.locale,
        site,
        personalize: pageOptions.personalize,
      },
      fetchOptions
    );
  }

  /**
   * Get design library page details for Design Library mode
   * @param {DesignLibraryRenderPreviewData} designLibData preview data set in 'library' mode
   * @param {FetchOptions} [fetchOptions] Additional fetch options to override GraphQL requests
   * @returns {Promise<Page>} preview page for Design Library
   */
  async getDesignLibraryData(
    designLibData: DesignLibraryRenderPreviewData,
    fetchOptions?: FetchOptions
  ): Promise<Page> {
    return super.getDesignLibraryData(designLibData, fetchOptions);
  }

  /**
   * Retrieves preview page and layout details
   * @param {EditingPreviewData} previewData - The editing preview data for metadata mode
   * @param {FetchOptions} [fetchOptions] Additional fetch options to override GraphQL requests
   * @returns {Promise<Page | null>} preview page
   */
  async getPreview(
    previewData: EditingPreviewData,
    fetchOptions?: FetchOptions
  ): Promise<Page | null> {
    return super.getPreview(previewData, fetchOptions);
  }

  /**
   * Parses components from TanStack component map and layoutData, executes getComponentServerProps methods
   * and returns resulting props from components
   * @param {LayoutServiceData} layoutData layout data to parse components from
   * @param {TanstackContext} context TanStack context
   * @param {ComponentMap<TanstackContentSdkComponent>} components component map to get props for
   * @returns {Promise<ComponentPropsCollection>} component props
   */
  async getComponentData(
    layoutData: LayoutServiceData,
    context: TanstackContext,
    components: ComponentMap<TanstackContentSdkComponent>
  ): Promise<ComponentPropsCollection> {
    let componentProps: ComponentPropsCollection = {};
    if (!layoutData.sitecore.route) return componentProps;
    
    // Retrieve component props using side-effects defined on components level
    componentProps = await this.componentPropsService.fetchComponentProps({
      layoutData: layoutData,
      context,
      components,
    });

    const errors = Object.keys(componentProps)
      .map((id) => {
        const component = componentProps[id];
        
        // Check if this is an error object
        if (component && typeof component === 'object' && 'error' in component) {
          const errorComponent = component as ComponentPropsError;
          return `\nUnable to get component props for ${errorComponent.componentName} (${id}): ${errorComponent.error}`;
        }
        
        return '';
      })
      .join('');

    if (errors.length) {
      throw new Error(errors);
    }

    return componentProps;
  }

  /**
   * Get the component props service instance
   * @returns {ComponentPropsService} component props service
   */
  protected getComponentPropsService(): ComponentPropsService {
    return new ComponentPropsService();
  }
}
