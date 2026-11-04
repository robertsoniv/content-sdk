/**
 * Origin of a commerce error.
 * - `ordercloud`: OrderCloud returned an error body (passed through by the proxy)
 * - `proxy`: the commerce proxy rejected the request (plain-text error)
 * - `network`: the request could not be completed (network failure or timeout)
 * - `sdk`: the SDK or token endpoint reported an error
 * @public
 */
export type CommerceErrorSource = 'ordercloud' | 'proxy' | 'network' | 'sdk';

/**
 * OrderCloud API error entry.
 * @public
 */
export interface OrderCloudApiError {
  ErrorCode: string;
  Message: string;
  Data?: unknown;
}

/**
 * Options for creating a {@link CommerceError}.
 * @public
 */
export interface CommerceErrorOptions {
  source: CommerceErrorSource;
  status?: number;
  code?: string;
  errors?: OrderCloudApiError[];
}

/**
 * Error thrown by commerce APIs. Never contains token values or request bodies.
 * @public
 */
export class CommerceError extends Error {
  /**
   * HTTP status, when the error came from an HTTP response.
   */
  readonly status?: number;
  /**
   * Origin of the error.
   */
  readonly source: CommerceErrorSource;
  /**
   * OrderCloud error code (first entry) or OAuth error code, when available.
   */
  readonly code?: string;
  /**
   * OrderCloud `Errors` array, when available.
   */
  readonly errors?: OrderCloudApiError[];

  /**
   * @param {string} message error message
   * @param {CommerceErrorOptions} options error details
   */
  constructor(message: string, options: CommerceErrorOptions) {
    super(message);
    this.name = 'CommerceError';
    this.source = options.source;
    this.status = options.status;
    this.code = options.code;
    this.errors = options.errors;
  }
}

/**
 * Checks whether an error is an abort error (from an AbortSignal or a fetcher timeout).
 * @param {unknown} error error to inspect
 * @returns {boolean} true if the error is an abort error
 * @internal
 */
export function isAbortError(error: unknown): boolean {
  return (error as Error | undefined)?.name === 'AbortError';
}

/**
 * Checks whether an error means the credentials (access or refresh token) were rejected.
 * Network failures and server errors are not auth failures.
 * @param {unknown} error error to inspect
 * @returns {boolean} true for 401 responses and OrderCloud/token-endpoint 400 responses
 * @internal
 */
export function isAuthFailure(error: unknown): boolean {
  if (!(error instanceof CommerceError)) return false;
  if (error.status === 401) return true;
  return error.status === 400 && (error.source === 'ordercloud' || error.source === 'sdk');
}

const proxyMessage = (status: number) => {
  switch (status) {
    case 400:
      return 'Commerce proxy rejected the request (400). Check the context ID and that an oc-shopping resource is configured for it.';
    case 404:
      return 'Commerce proxy does not allow this endpoint (404).';
    default:
      return `Commerce proxy error (${status}).`;
  }
};

/**
 * Normalizes errors thrown by fetch/NativeDataFetcher into a {@link CommerceError}.
 * Callers must re-throw caller-initiated aborts before calling this; remaining abort errors are
 * treated as timeouts.
 * @param {unknown} error error to normalize
 * @returns {CommerceError} normalized error
 * @internal
 */
export function toCommerceError(error: unknown): CommerceError {
  if (error instanceof CommerceError) return error;

  if (isAbortError(error)) {
    return new CommerceError('Commerce request timed out.', { source: 'network' });
  }

  const response = (error as { response?: { status?: number; data?: unknown } } | undefined)
    ?.response;

  if (response && typeof response.status === 'number') {
    const { status, data } = response;

    if (typeof data === 'string' || data === undefined || data === null) {
      return new CommerceError(proxyMessage(status), { source: 'proxy', status });
    }

    const body = data as {
      Errors?: OrderCloudApiError[];
      error?: string;
      error_description?: string;
    };

    if (Array.isArray(body.Errors) && body.Errors.length > 0) {
      const [first] = body.Errors;
      return new CommerceError(first.Message || `OrderCloud error (${status}).`, {
        source: 'ordercloud',
        status,
        code: first.ErrorCode,
        errors: body.Errors,
      });
    }

    if (typeof body.error === 'string') {
      return new CommerceError(body.error_description || body.error, {
        source: 'ordercloud',
        status,
        code: body.error,
      });
    }

    return new CommerceError(`OrderCloud error (${status}).`, { source: 'ordercloud', status });
  }

  const message = (error as Error | undefined)?.message || 'Commerce request failed.';
  return new CommerceError(message, { source: 'network' });
}
