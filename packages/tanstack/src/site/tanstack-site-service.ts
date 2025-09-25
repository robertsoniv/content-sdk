import {
  SiteInfoService,
  SiteInfoServiceConfig,
  SiteResolver,
} from '@sitecore-content-sdk/core/site';

/**
 * TanStack Start specific site service
 */
export class TanstackSiteService {
  private siteInfoService: SiteInfoService;
  private siteResolver?: SiteResolver;

  constructor(config: SiteInfoServiceConfig) {
    this.siteInfoService = new SiteInfoService(config);
  }

  /**
   * Initialize the site resolver with site information
   * This should be called after fetching site info from Sitecore
   */
  async initialize() {
    try {
      const sites = await this.siteInfoService.fetchSiteInfo();
      this.siteResolver = new SiteResolver(sites);
    } catch (error) {
      console.error('Failed to initialize site resolver:', error);
      throw error;
    }
  }

  /**
   * Get site information by hostname
   * @param {string} hostname the hostname
   * @returns {SiteInfo} site information
   */
  getSiteByHost(hostname: string) {
    if (!this.siteResolver) {
      throw new Error('SiteResolver not initialized. Call initialize() first.');
    }

    try {
      return this.siteResolver.getByHost(hostname);
    } catch (error) {
      console.error('Failed to get site by host:', error);
      throw error;
    }
  }

  /**
   * Get site information by name
   * @param {string} name the site name
   * @returns {SiteInfo | undefined} site information
   */
  getSiteByName(name: string) {
    if (!this.siteResolver) {
      throw new Error('SiteResolver not initialized. Call initialize() first.');
    }

    try {
      return this.siteResolver.getByName(name);
    } catch (error) {
      console.error('Failed to get site by name:', error);
      throw error;
    }
  }

  /**
   * Get all sites
   * @returns {Promise<SiteInfo[]>} all site information
   */
  async getAllSites() {
    try {
      return await this.siteInfoService.fetchSiteInfo();
    } catch (error) {
      console.error('Failed to get all sites:', error);
      throw error;
    }
  }
}
