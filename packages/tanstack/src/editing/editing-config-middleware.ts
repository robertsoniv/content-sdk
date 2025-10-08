import { debug } from '@sitecore-content-sdk/core';
import {
  EDITING_ALLOWED_ORIGINS,
  QUERY_PARAM_EDITING_SECRET,
} from '@sitecore-content-sdk/core/editing';
import { Metadata } from '@sitecore-content-sdk/core/editing';
import { EditMode } from '@sitecore-content-sdk/core/layout';
import { getEnforcedCorsHeaders } from '@sitecore-content-sdk/core/utils';
import { validateEditingSecret } from './utils';
import { TanstackContentSdkComponent } from '../sharedTypes/component-props';
import { ComponentMap } from '@sitecore-content-sdk/react';

/**
 * Configuration for the Editing Config Middleware
 */
export type EditingConfigMiddlewareConfig = {
  /**
   * Components available in the application
   */
  components: ComponentMap<TanstackContentSdkComponent>;
  /**
   * Application metadata
   */
  metadata: Metadata;
};

/**
 * Middleware for handling editing config requests from Sitecore
 * Provides configuration information to determine feature compatibility on Pages side
 */
export class EditingConfigMiddleware {
  private config: EditingConfigMiddlewareConfig;

  constructor(config: EditingConfigMiddlewareConfig) {
    this.config = config;
  }

  /**
   * Handles the editing config request
   * @param {Request} req incoming request
   * @returns {Promise<Response>} response with configuration data
   */
  async handle(req: Request): Promise<Response> {
    try {
      debug.editing('editing config middleware: handling request');

      // Validate request
      if (!this.validateRequest(req)) {
        return this.createErrorResponse('Invalid request', 400);
      }

      // Validate editing secret
      if (!validateEditingSecret(req)) {
        debug.editing('editing config middleware: invalid secret');
        return this.createErrorResponse('Invalid editing secret', 401);
      }

      // Handle CORS using the same strategy as Next.js
      const corsHeaders = getEnforcedCorsHeaders({
        requestMethod: req.method,
        headers: req.headers,
        allowedOrigins: EDITING_ALLOWED_ORIGINS,
      });
      
      if (!corsHeaders) {
        debug.editing(
          'invalid origin host - set allowed origins in JSS_ALLOWED_ORIGINS environment variable'
        );
        return this.createErrorResponse('Invalid origin', 403);
      }

      // Generate configuration response
      const configData = this.generateConfigData();

      // Create response with CORS headers
      const response = new Response(JSON.stringify(configData), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          ...corsHeaders,
        },
      });

      debug.editing('editing config middleware: configuration sent successfully');
      return response;

    } catch (error) {
      debug.editing('editing config middleware error: %o', error);
      return this.createErrorResponse(
        `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500
      );
    }
  }

  /**
   * Validates the incoming request
   * @param {Request} req incoming request
   * @returns {boolean} true if request is valid
   */
  private validateRequest(req: Request): boolean {
    const url = new URL(req.url);
    const searchParams = url.searchParams;

    // Check required parameters
    if (!searchParams.get(QUERY_PARAM_EDITING_SECRET)) {
      debug.editing('validation failed: missing editing secret');
      return false;
    }

    return true;
  }

  /**
   * Generates the configuration data for Sitecore
   * @returns {object} configuration data
   */
  private generateConfigData(): object {
    const { components, metadata } = this.config;

    // Convert components map to array format expected by Sitecore
    const componentList = Array.from(components.entries()).map(([name, component]) => ({
      name,
      displayName: name, // Use component name as display name
      description: '', // No description available in TanstackContentSdkComponent
      fields: this.extractComponentFields(component),
      placeholders: this.extractComponentPlaceholders(component),
    }));

    return {
      components: componentList,
      metadata: {
        name: 'TanStack Application',
        version: '1.0.0',
        description: 'TanStack Start application with Sitecore Content SDK',
        author: 'Sitecore',
        framework: 'TanStack Start',
        packages: metadata.packages, // Include the actual packages metadata
        features: {
          serverSideRendering: true,
          staticGeneration: true,
          previewMode: true,
          editingMode: true,
          personalization: true,
          multisite: true,
        },
      },
      capabilities: {
        editMode: EditMode.Metadata,
        previewMode: true,
        designLibrary: true,
        personalization: true,
        multisite: true,
      },
      endpoints: {
        render: '/api/editing/render',
        config: '/api/editing/config',
        feaas: '/api/editing/feaas',
      },
    };
  }

  /**
   * Extracts field information from a component
   * @param {TanstackContentSdkComponent} component component definition
   * @returns {object[]} array of field definitions
   */
  private extractComponentFields(component: TanstackContentSdkComponent): object[] {
    // This is a simplified implementation
    // In a real implementation, you might want to analyze the component's props
    // or use TypeScript reflection to get field information
    return Object.keys(component.fields || {}).map(fieldName => ({
      name: fieldName,
      type: 'text', // Default type, could be determined from field metadata
      required: false,
      displayName: fieldName,
    }));
  }

  /**
   * Extracts placeholder information from a component
   * @param {TanstackContentSdkComponent} component component definition
   * @returns {object[]} array of placeholder definitions
   */
  private extractComponentPlaceholders(_component: TanstackContentSdkComponent): object[] {
    // This is a simplified implementation
    // In a real implementation, you might want to analyze the component's JSX
    // or use static analysis to find Placeholder components
    return [];
  }

  /**
   * Creates an error response
   * @param {string} message error message
   * @param {number} status HTTP status code
   * @returns {Response} error response
   */
  private createErrorResponse(message: string, status: number): Response {
    return new Response(
      JSON.stringify({
        error: message,
        status,
        timestamp: new Date().toISOString(),
      }),
      {
        status,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      }
    );
  }
}
