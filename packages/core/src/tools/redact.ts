/**
 * Placeholder used in place of sensitive values in debug output.
 * @internal
 */
export const REDACTED = '[REDACTED]';

const SENSITIVE_HEADERS = new Set(['authorization', 'cookie', 'set-cookie']);

const SENSITIVE_KEYS = new Set([
  'access_token',
  'accesstoken',
  'refresh_token',
  'refreshtoken',
  'client_secret',
  'password',
  'newpassword',
  'anonusertoken',
]);

const MAX_DEPTH = 10;

const isSensitiveKey = (key: string) => SENSITIVE_KEYS.has(key.toLowerCase());

/**
 * Checks whether a header is present in a HeadersInit value (case-insensitive).
 * Works for Headers instances, header tuples, and plain records.
 * @param {HeadersInit} [headers] headers to inspect
 * @param {string} name header name
 * @returns {boolean} true if the header is present
 * @internal
 */
export function hasHeader(headers: HeadersInit | undefined, name: string): boolean {
  if (!headers) return false;
  const target = name.toLowerCase();

  if (Array.isArray(headers)) {
    return headers.some(([key]) => key.toLowerCase() === target);
  }

  if (typeof (headers as Headers).has === 'function') {
    return (headers as Headers).has(name);
  }

  return Object.keys(headers).some((key) => key.toLowerCase() === target);
}

/**
 * Returns a copy of debug headers with credential-bearing values redacted.
 * @param {Record<string, string | string[]>} [headers] headers extracted for debug logging
 * @returns {Record<string, string | string[]>} redacted headers
 * @internal
 */
export function redactHeaders(
  headers: Record<string, string | string[]> = {}
): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};
  Object.keys(headers).forEach((key) => {
    result[key] = SENSITIVE_HEADERS.has(key.toLowerCase()) ? REDACTED : headers[key];
  });
  return result;
}

const hasSensitiveParam = (params: URLSearchParams): boolean => {
  let found = false;
  params.forEach((_, key) => {
    if (isSensitiveKey(key)) found = true;
  });
  return found;
};

const redactSearchParams = (params: URLSearchParams): string => {
  const result = new URLSearchParams(params);
  params.forEach((_, key) => {
    if (isSensitiveKey(key)) result.set(key, REDACTED);
  });
  return result.toString().split(encodeURIComponent(REDACTED)).join(REDACTED);
};

/**
 * Redacts sensitive query string parameters from a URL used in debug output.
 * @param {string} url the URL
 * @returns {string} URL with sensitive query values redacted
 * @internal
 */
export function redactUrl(url: string): string {
  if (typeof url !== 'string' || !url.includes('?')) return url;

  const [base, rest] = url.split('?', 2);
  const [query, hash] = rest.split('#', 2);
  const params = new URLSearchParams(query);
  if (!hasSensitiveParam(params)) return url;

  return `${base}?${redactSearchParams(params)}${hash !== undefined ? `#${hash}` : ''}`;
}

/**
 * Recursively redacts sensitive keys from parsed data used in debug output.
 * @param {unknown} data parsed request/response data
 * @param {number} [depth] current recursion depth
 * @returns {unknown} copy of the data with sensitive values redacted
 * @internal
 */
export function redactData(data: unknown, depth = 0): unknown {
  if (data === null || typeof data !== 'object' || depth > MAX_DEPTH) return data;

  if (Array.isArray(data)) {
    return data.map((item) => redactData(item, depth + 1));
  }

  const result: Record<string, unknown> = {};
  Object.entries(data as Record<string, unknown>).forEach(([key, value]) => {
    result[key] = isSensitiveKey(key) ? REDACTED : redactData(value, depth + 1);
  });
  return result;
}

/**
 * Redacts sensitive fields from a request body used in debug output.
 * Handles JSON strings, form-encoded strings and URLSearchParams.
 * Other body types (streams, blobs, form data) are not logged.
 * @param {BodyInit | null} [body] request body
 * @returns {unknown} redacted representation of the body
 * @internal
 */
export function redactBody(body?: BodyInit | null): unknown {
  if (body === undefined || body === null) return body;

  if (body instanceof URLSearchParams) {
    return redactSearchParams(body);
  }

  if (typeof body === 'string') {
    const trimmed = body.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        return JSON.stringify(redactData(JSON.parse(trimmed)));
      } catch {
        return body;
      }
    }

    if (trimmed.includes('=')) {
      const params = new URLSearchParams(trimmed);
      return hasSensitiveParam(params) ? redactSearchParams(params) : body;
    }

    return body;
  }

  return '[non-text body]';
}
