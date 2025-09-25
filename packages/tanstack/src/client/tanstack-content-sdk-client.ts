import { LayoutService } from '@sitecore-content-sdk/core/layout';
import { TanstackContentSdkClientConfig } from './models';

/**
 * TanStack Start specific client for Sitecore Content SDK
 */
export class TanstackContentSdkClient {
  private layoutService: LayoutService;
  private config: TanstackContentSdkClientConfig;

  constructor(config: TanstackContentSdkClientConfig) {
    this.config = config;
    this.layoutService = new LayoutService(config);
  }

  /**
   * Fetch layout data for a given path
   * @param {string} path the path to fetch
   * @param {string} language the language
   * @param {Record<string, unknown>} params additional parameters
   * @returns {Promise<any>} layout data
   */
  async fetchLayoutData(
    path: string,
    language: string = 'en',
    _params: Record<string, unknown> = {}
  ) {
    try {
      const layoutData = await this.layoutService.fetchLayoutData(path, {
        site: this.config.siteName,
        locale: language,
      });
      return layoutData;
    } catch (error) {
      console.error('Failed to fetch layout data:', error);
      throw error;
    }
  }

  /**
   * Get the configuration
   * @returns {TanstackContentSdkClientConfig} the configuration
   */
  getConfig(): TanstackContentSdkClientConfig {
    return this.config;
  }

  /**
   * Update the configuration
   * @param {Partial<TanstackContentSdkClientConfig>} newConfig partial configuration to update
   */
  updateConfig(newConfig: Partial<TanstackContentSdkClientConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.layoutService = new LayoutService(this.config);
  }
}
