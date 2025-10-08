import {
  ComponentFile,
  GenerateMapArgs,
  GenerateMapFunction,
  getComponentList,
  ComponentImport,
} from '@sitecore-content-sdk/core/tools';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Generate and write componentMap.ts file based on provided params.
 * 
 * TanStack Start uses a simplified approach compared to Next.js App Router:
 * - Generates a single component-map.ts file
 * - No need for separate client/server component maps
 * - No router type detection required
 * 
 * @param {GenerateMapArgs} param0 params for generateMap
 */
export const generateMap: GenerateMapFunction = ({
  paths,
  destination = '.sitecore',
  exclude,
  componentImports,
  mapTemplate = tanstackMapTemplate,
}: GenerateMapArgs) => {
  // Simple approach for TanStack - generate single component map
  const components = getComponentList(paths, exclude);
  const componentMapContent = mapTemplate(components, componentImports);
  const componentMapFile = path.join(process.cwd(), destination, 'component-map.ts');

  try {
    fs.writeFileSync(componentMapFile, componentMapContent, { encoding: 'utf8' });
  } catch (error) {
    console.error(
      `Component Map generation failed. Error writing to file ${destination}:`,
      error
    );
    throw error;
  }
};

/**
 * TanStack component map template - simplified for TanStack Start
 */
const tanstackMapTemplate = (
  components: ComponentFile[],
  componentImports?: ComponentImport[]
): string => {
  const wildcardImports: string[] = [];
  const namedImports: string[] = [];
  const componentMapEntries: string[] = [];

  components.forEach((component) => {
    wildcardImports.push(`import * as ${component.moduleName} from '${component.importPath}';`);
    componentMapEntries.push(`['${component.moduleName}', ${component.moduleName}]`);
  });

  // Process component imports
  componentImports?.forEach((packageEntry) => {
    if (packageEntry.importInfo.namedImports) {
      namedImports.push(
        `import { ${packageEntry.importInfo.namedImports.join(', ')} } from '${
          packageEntry.importInfo.importFrom
        }';`
      );
      packageEntry.importInfo.namedImports.forEach((importName: string) => {
        componentMapEntries.push(`['${importName}', ${importName}]`);
      });
    } else {
      wildcardImports.push(
        `import * as ${packageEntry.importName} from '${packageEntry.importInfo.importFrom}';`
      );
      componentMapEntries.push(`['${packageEntry.importName}', ${packageEntry.importName}]`);
    }
  });

  return `// Below are built-in components that are available in the app, it's recommended to keep them as is
import { BYOCWrapper, TanstackContentSdkComponent, FEaaSWrapper } from '@sitecore-content-sdk/tanstack';
import { Form } from '@sitecore-content-sdk/tanstack';
// end of built-in components

${wildcardImports.join('\n')}
${namedImports.join('\n')}

export const componentMap = new Map<string, TanstackContentSdkComponent>([
  ['BYOCWrapper', BYOCWrapper],
  ['FEaaSWrapper', FEaaSWrapper],
  ['Form', Form],
${componentMapEntries
  .map((component) => {
    return `  ${component},\n`;
  })
  .join('')}]);

export default componentMap;
`;
};
