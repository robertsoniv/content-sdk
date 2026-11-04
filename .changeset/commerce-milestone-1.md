---
'@sitecore-content-sdk/commerce': minor
'@sitecore-content-sdk/react': minor
'@sitecore-content-sdk/nextjs': minor
---

Add commerce (OrderCloud) shopper session support.

- New `@sitecore-content-sdk/commerce` package: `OrderCloudService` (`auth`, `me.get()`, authorized `request()`), `ShopperSessionManager`, Edge and route-handler token clients, and browser cookie / in-memory token stores. Anonymous tokens are minted through the Sitecore Edge commerce proxy; registered sessions are refreshed; HTTP 401 responses are retried once with a renewed session.
- `@sitecore-content-sdk/react/commerce`: `CommerceProvider`, `useCommerce()` and `useShopper()`. In editing, preview and Design Library modes tokens are kept in memory only.
- `@sitecore-content-sdk/nextjs/commerce`: `CommerceProvider` defaulting to route-handler mode, and `createCommerceTokenRouteHandler` (`@sitecore-content-sdk/nextjs/route-handler`), which keeps the refresh token in an httpOnly cookie.
