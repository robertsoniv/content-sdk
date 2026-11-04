import { expect } from 'chai';
import nock from 'nock';
import sinon from 'sinon';
import { OrderCloudService } from './ordercloud-service';
import { ShopperSessionManager } from './session/shopper-session-manager';
import { createMemoryTokenStore } from './token-store/memory-token-store';
import { CommerceError } from './errors';
import { CommerceTokenClient } from './token/token-client';

const EDGE = 'https://edge.test';
const contextId = 'ctx-123';

const createManager = () => {
  let n = 0;
  const tokenClient: CommerceTokenClient & { getAnonymousToken: sinon.SinonStub } = {
    getAnonymousToken: sinon.stub().callsFake(async () => ({
      session: { accessToken: `at-${++n}`, expiresAt: Date.now() + 600_000, userType: 'anonymous' },
      persisted: false,
    })),
    refresh: sinon.stub().rejects(new Error('unused')),
  };
  return {
    tokenClient,
    sessionManager: new ShopperSessionManager({ tokenClient, tokenStore: createMemoryTokenStore() }),
  };
};

describe('OrderCloudService', () => {
  afterEach(() => nock.cleanAll());

  it('should require a context ID', () => {
    expect(() => new OrderCloudService({ contextId: '' })).to.throw(CommerceError, 'contextId');
  });

  it('should default to an Edge token client with a memory store', async () => {
    nock(EDGE)
      .post('/oc/storefront/oauth/token')
      .reply(200, { access_token: 'anon', expires_in: 600 })
      .get('/oc/storefront/v1/me')
      .matchHeader('authorization', 'Bearer anon')
      .reply(200, { ID: 'u1', Username: 'anon-user' });

    const service = new OrderCloudService({ contextId, edgeUrl: EDGE });

    expect(await service.me.get()).to.deep.equal({ ID: 'u1', Username: 'anon-user' });
    expect((await service.auth.getSession()).accessToken).to.equal('anon');
  });

  it('should send bearer, context and accept headers to /v1/me', async () => {
    const { sessionManager } = createManager();
    nock(EDGE, {
      reqheaders: {
        authorization: 'Bearer at-1',
        'x-sitecore-contextid': contextId,
        accept: 'application/json',
      },
    })
      .get('/oc/storefront/v1/me')
      .reply(200, { ID: 'u1', Username: 'x' });

    const service = new OrderCloudService({ contextId, edgeUrl: EDGE, sessionManager });
    expect((await service.me.get()).ID).to.equal('u1');
  });

  it('should renew the session and retry once on 401', async () => {
    const { sessionManager, tokenClient } = createManager();
    nock(EDGE)
      .get('/oc/storefront/v1/me')
      .matchHeader('authorization', 'Bearer at-1')
      .reply(401, { Errors: [{ ErrorCode: 'InvalidToken', Message: 'Invalid token' }] })
      .get('/oc/storefront/v1/me')
      .matchHeader('authorization', 'Bearer at-2')
      .reply(200, { ID: 'u2', Username: 'x' });

    const service = new OrderCloudService({ contextId, edgeUrl: EDGE, sessionManager });

    expect((await service.me.get()).ID).to.equal('u2');
    expect(tokenClient.getAnonymousToken.calledTwice).to.equal(true);
  });

  it('should surface a second 401', async () => {
    const { sessionManager } = createManager();
    nock(EDGE).get('/oc/storefront/v1/me').twice().reply(401, { Errors: [] });

    const service = new OrderCloudService({ contextId, edgeUrl: EDGE, sessionManager });
    const error = await service.me.get().catch((e) => e);

    expect(error).to.be.instanceOf(CommerceError);
    expect(error.status).to.equal(401);
  });

  it('should not retry other errors', async () => {
    const { sessionManager, tokenClient } = createManager();
    nock(EDGE)
      .get('/oc/storefront/v1/me')
      .reply(403, { Errors: [{ ErrorCode: 'InsufficientRoles', Message: 'no' }] });

    const service = new OrderCloudService({ contextId, edgeUrl: EDGE, sessionManager });
    const error = await service.me.get().catch((e) => e);

    expect(error).to.include({ status: 403, code: 'InsufficientRoles' });
    expect(tokenClient.getAnonymousToken.calledOnce).to.equal(true);
  });

  it('should not refresh when the caller aborted', async () => {
    const { sessionManager, tokenClient } = createManager();
    const controller = new AbortController();
    const abortingFetch = (_url: unknown, init?: RequestInit) =>
      new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const abort = new Error('aborted');
          abort.name = 'AbortError';
          reject(abort);
        });
      });
    const service = new OrderCloudService({
      contextId,
      edgeUrl: EDGE,
      sessionManager,
      fetch: abortingFetch as typeof fetch,
    });

    const pending = service.me.get({ signal: controller.signal });
    await new Promise((resolve) => setTimeout(resolve, 0));
    controller.abort();
    const error = await pending.catch((e) => e);

    expect(error.name).to.equal('AbortError');
    expect(tokenClient.getAnonymousToken.calledOnce).to.equal(true);
  });

  it('should pass method and body through request()', async () => {
    const { sessionManager } = createManager();
    nock(EDGE)
      .post('/oc/storefront/v1/me/addresses', { Street1: 'x' })
      .matchHeader('content-type', 'application/json')
      .reply(201, { ID: 'a1' });

    const service = new OrderCloudService({ contextId, edgeUrl: EDGE, sessionManager });
    const created = await service.request<{ ID: string }>('/v1/me/addresses', {
      method: 'POST',
      body: JSON.stringify({ Street1: 'x' }),
    });
    expect(created.ID).to.equal('a1');
  });

  it('should reject invalid paths', async () => {
    const { sessionManager } = createManager();
    const service = new OrderCloudService({ contextId, edgeUrl: EDGE, sessionManager });
    for (const path of ['/v2/me', '/v1/../admin', '/v1/http://evil']) {
      const error = await service.request(path as '/v1/x').catch((e) => e);
      expect(error, path).to.be.instanceOf(CommerceError);
      expect(error.source).to.equal('sdk');
    }
  });

  it('should reset the session', async () => {
    const { sessionManager, tokenClient } = createManager();
    const service = new OrderCloudService({ contextId, edgeUrl: EDGE, sessionManager });
    await service.auth.getSession();
    const reset = await service.auth.reset();
    expect(reset.accessToken).to.equal('at-2');
    expect(tokenClient.getAnonymousToken.calledTwice).to.equal(true);
  });
});
