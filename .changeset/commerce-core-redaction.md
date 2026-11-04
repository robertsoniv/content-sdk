---
'@sitecore-content-sdk/core': patch
---

`NativeDataFetcher` no longer overrides an explicitly provided `Content-Type` header (requests without one still default to `application/json`), and its debug logging now redacts credentials: `Authorization`, `Cookie` and `Set-Cookie` headers, token/password/secret fields in request bodies and response data, and sensitive query parameters such as `anonUserToken`.
