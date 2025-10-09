import { ComponentRendering, Field } from '@sitecore-content-sdk/core/layout';

export type TanstackContentSdkComponent = {
  componentName: string;
  dataSource?: string;
  params: Record<string, string>;
  fields: Record<string, Field>;
  getComponentServerProps?: GetComponentServerProps;
  dynamicModule?: () => Promise<TanstackContentSdkComponent>;
};

export type TanstackContext = {
  request: Request;
  response: Response;
  params: Record<string, string>;
  search: Record<string, unknown>;
  url: URL;
};

export type ComponentPropsFetchFunction = (
  rendering: ComponentRendering,
  layoutData: any,
  context: TanstackContext
) => Promise<Record<string, unknown>>;

export type GetComponentServerProps = ComponentPropsFetchFunction;

export type ComponentPropsCollection = {
  [componentUid: string]: unknown | ComponentPropsError;
};

export type ComponentPropsError = { error: string; componentName: string };
