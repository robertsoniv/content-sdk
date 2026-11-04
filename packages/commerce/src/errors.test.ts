import { expect } from 'chai';
import { CommerceError, isAbortError, isAuthFailure, toCommerceError } from './errors';

const httpError = (status: number, data?: unknown) => ({
  name: 'Error',
  message: `HTTP ${status}`,
  response: { status, statusText: '', data },
});

describe('errors', () => {
  describe('CommerceError', () => {
    it('should carry details and a stable name', () => {
      const error = new CommerceError('msg', { source: 'ordercloud', status: 403, code: 'X' });
      expect(error).to.be.instanceOf(Error);
      expect(error.name).to.equal('CommerceError');
      expect(error.status).to.equal(403);
      expect(error.source).to.equal('ordercloud');
      expect(error.code).to.equal('X');
    });
  });

  describe('toCommerceError', () => {
    it('should return CommerceError instances unchanged', () => {
      const error = new CommerceError('x', { source: 'sdk' });
      expect(toCommerceError(error)).to.equal(error);
    });

    it('should map plain-string 404 to an endpoint-not-enabled proxy error', () => {
      const error = toCommerceError(httpError(404, 'Not Found'));
      expect(error.source).to.equal('proxy');
      expect(error.status).to.equal(404);
      expect(error.message).to.include('does not allow this endpoint');
    });

    it('should map plain-string 400 to a configuration proxy error', () => {
      const error = toCommerceError(httpError(400, 'bad'));
      expect(error.source).to.equal('proxy');
      expect(error.message).to.include('context ID');
    });

    it('should map other plain-string statuses to a generic proxy error', () => {
      expect(toCommerceError(httpError(502, '')).message).to.equal('Commerce proxy error (502).');
    });

    it('should map OrderCloud Errors bodies', () => {
      const errors = [{ ErrorCode: 'NotFound', Message: 'Product not found' }];
      const error = toCommerceError(httpError(404, { Errors: errors }));
      expect(error.source).to.equal('ordercloud');
      expect(error.code).to.equal('NotFound');
      expect(error.message).to.equal('Product not found');
      expect(error.errors).to.deep.equal(errors);
    });

    it('should map OAuth error bodies', () => {
      const error = toCommerceError(
        httpError(400, { error: 'invalid_grant', error_description: 'expired' })
      );
      expect(error.source).to.equal('ordercloud');
      expect(error.code).to.equal('invalid_grant');
      expect(error.message).to.equal('expired');
    });

    it('should map unknown JSON bodies to a generic OrderCloud error', () => {
      expect(toCommerceError(httpError(500, { foo: 1 })).message).to.equal(
        'OrderCloud error (500).'
      );
    });

    it('should map abort errors (timeouts) to network errors', () => {
      const abort = new Error('aborted');
      abort.name = 'AbortError';
      const error = toCommerceError(abort);
      expect(error.source).to.equal('network');
      expect(error.message).to.include('timed out');
    });

    it('should map other errors to network errors', () => {
      const error = toCommerceError(new TypeError('fetch failed'));
      expect(error.source).to.equal('network');
      expect(error.message).to.equal('fetch failed');
      expect(toCommerceError(undefined).message).to.equal('Commerce request failed.');
    });
  });

  describe('isAuthFailure', () => {
    it('should treat 401 as an auth failure', () => {
      expect(isAuthFailure(new CommerceError('x', { source: 'proxy', status: 401 }))).to.equal(true);
    });

    it('should treat OrderCloud and token endpoint 400s as auth failures', () => {
      expect(isAuthFailure(new CommerceError('x', { source: 'ordercloud', status: 400 }))).to.equal(
        true
      );
      expect(isAuthFailure(new CommerceError('x', { source: 'sdk', status: 400 }))).to.equal(true);
    });

    it('should not treat proxy 400s, server errors or non-commerce errors as auth failures', () => {
      expect(isAuthFailure(new CommerceError('x', { source: 'proxy', status: 400 }))).to.equal(false);
      expect(isAuthFailure(new CommerceError('x', { source: 'ordercloud', status: 500 }))).to.equal(
        false
      );
      expect(isAuthFailure(new CommerceError('x', { source: 'network' }))).to.equal(false);
      expect(isAuthFailure(new Error('x'))).to.equal(false);
    });
  });

  describe('isAbortError', () => {
    it('should detect abort errors by name', () => {
      const abort = new Error('x');
      abort.name = 'AbortError';
      expect(isAbortError(abort)).to.equal(true);
      expect(isAbortError(new Error('x'))).to.equal(false);
      expect(isAbortError(undefined)).to.equal(false);
    });
  });
});
