export { generateMap } from './generate-map';
export { defaultTemplate } from './templating/default-component';
export { byocTemplate } from './templating/byoc-component';

// Re-export core tools for TanStack
export { 
  generateSites, 
  generateMetadata,
  scaffoldComponent,
  GenerateMapFunction,
  GenerateMapArgs,
} from '@sitecore-content-sdk/core/tools';
