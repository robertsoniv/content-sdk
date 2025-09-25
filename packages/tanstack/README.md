# @sitecore-content-sdk/tanstack

Sitecore Content SDK for TanStack Start applications.

## Overview

This package provides TanStack Start-specific implementations of the Sitecore Content SDK, enabling you to build modern React applications with TanStack Start that integrate seamlessly with Sitecore XM Cloud.

## Features

- **TanStack Start Integration**: Optimized for TanStack Start framework
- **Server-Side Rendering**: Full SSR support with TanStack Start
- **Component Props**: Server-side data fetching for components
- **Middleware Support**: Built-in middleware for redirects, personalization, and more
- **TypeScript Support**: Full TypeScript support with type definitions
- **Performance Optimized**: Optimized for TanStack Start's performance characteristics

## Installation

```bash
npm install @sitecore-content-sdk/tanstack
```

## Quick Start

### 1. Basic Setup

```typescript
import { TanstackContentSdkClient } from '@sitecore-content-sdk/tanstack';

const client = new TanstackContentSdkClient({
  apiHost: 'https://your-sitecore-instance.com',
  siteName: 'your-site',
  // ... other configuration
});
```

### 2. Using Components

```tsx
import { Link, RichText, Placeholder } from '@sitecore-content-sdk/tanstack';

function MyComponent({ layoutData }) {
  return (
    <div>
      <Link field={layoutData.sitecore.route.fields.title} />
      <RichText field={layoutData.sitecore.route.fields.content} />
      <Placeholder name="main" rendering={layoutData.sitecore.route} />
    </div>
  );
}
```

### 3. Middleware Setup

```typescript
import { defineMiddleware, RedirectsMiddleware, LocaleMiddleware } from '@sitecore-content-sdk/tanstack';

const middleware = defineMiddleware(
  new LocaleMiddleware({
    locales: ['en', 'fr', 'de'],
    sites: [/* your sites */],
  }),
  new RedirectsMiddleware({
    enabled: true,
    sites: [/* your sites */],
  })
);

// Use in your TanStack Start app
export const middleware = middleware.exec;
```

## Components

### Link Component

The `Link` component provides intelligent routing for internal and external links:

```tsx
import { Link } from '@sitecore-content-sdk/tanstack';

<Link 
  field={linkField} 
  preload="intent" 
  internalLinkMatcher={/^\//g}
>
  Click me
</Link>
```

### RichText Component

The `RichText` component renders rich text content with link prefetching:

```tsx
import { RichText } from '@sitecore-content-sdk/tanstack';

<RichText 
  field={richTextField}
  prefetchLinks={true}
  internalLinksSelector="a[href^='/']"
/>
```

### TanstackImage Component

The `TanstackImage` component provides optimized image rendering:

```tsx
import { TanstackImage } from '@sitecore-content-sdk/tanstack';

<TanstackImage 
  field={imageField}
  loading="lazy"
  decoding="async"
/>
```

## Middleware

### Redirects Middleware

Handles redirects from Sitecore:

```typescript
import { RedirectsMiddleware } from '@sitecore-content-sdk/tanstack';

const redirectsMiddleware = new RedirectsMiddleware({
  enabled: true,
  locales: ['en', 'fr'],
  sites: [/* your sites */],
});
```

### Locale Middleware

Handles locale detection and routing:

```typescript
import { LocaleMiddleware } from '@sitecore-content-sdk/tanstack';

const localeMiddleware = new LocaleMiddleware({
  locales: ['en', 'fr', 'de'],
  defaultLocale: 'en',
  sites: [/* your sites */],
});
```

## Server Functions

### Component Props Service

Fetch component-specific data on the server:

```typescript
import { ComponentPropsService } from '@sitecore-content-sdk/tanstack';

const componentPropsService = new ComponentPropsService();

const componentProps = await componentPropsService.fetchComponentProps({
  layoutData,
  context: { request, response, params, search, url },
  components: componentMap,
});
```

## Configuration

### TanstackContentSdkClientConfig

```typescript
interface TanstackContentSdkClientConfig {
  apiHost: string;
  siteName: string;
  apiKey?: string;
  baseUrl?: string;
  enableClientRouting?: boolean;
  enablePrefetching?: boolean;
  // ... other LayoutServiceConfig options
}
```

## TypeScript Support

This package includes full TypeScript definitions. Import types as needed:

```typescript
import type { 
  TanstackContentSdkClientConfig,
  LinkProps,
  RichTextProps,
  TanstackContext 
} from '@sitecore-content-sdk/tanstack';
```

## Migration from Next.js

If you're migrating from the Next.js version, here are the key differences:

1. **Link Component**: Uses `@tanstack/react-router` instead of `next/link`
2. **Image Component**: Uses native `<img>` instead of `next/image`
3. **Middleware**: Adapted for TanStack Start's middleware system
4. **Server Functions**: Uses TanStack Start's server function patterns

## Examples

See the examples directory for complete application examples.

## License

Apache-2.0

## Support

For support and documentation, visit the [Sitecore Content SDK documentation](https://doc.sitecore.com/xmc/en/developers/content-sdk/index.html).
