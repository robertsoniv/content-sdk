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
  [componentName: string]: Record<string, unknown>;
};

export class ComponentPropsError extends Error {
  constructor(message: string, public componentName: string, public originalError?: Error) {
    super(message);
    this.name = 'ComponentPropsError';
  }
}
