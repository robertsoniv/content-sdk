import { LayoutServiceData } from '@sitecore-content-sdk/core/layout';

export type SitecorePageProps = {
  layoutData: LayoutServiceData;
  notFound?: boolean;
  componentProps?: Record<string, unknown>;
};
