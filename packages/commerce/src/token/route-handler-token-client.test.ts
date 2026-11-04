import { expect } from 'chai';
import sinon from 'sinon';
import { RouteHandlerTokenClient } from './route-handler-token-client';
import { CommerceError } from '../errors';

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('RouteHandlerTokenClient', () => {
  const valid = { accessToken: 'at', expiresAt: 123, userType: 'anonymous' };

  it('should POST to the default endpoint with same-origin credentials', async () => {
    const fetchStub = sinon.stub().resolves(jsonResponse(200, valid));
    const client = new RouteHandlerTokenClient({ fetch: fetchStub });

    const result = await client.getAnonymousToken();

    const [url, init] = fetchStub.firstCall.args;
    expect(url).to.equal('/api/commerce/token');
    expect(init.method).to.equal('POST');
    expect(init.credentials).to.equal('same-origin');
    expect(init.body).to.equal('{}');
    expect((init.headers as Headers).get('Content-Type')).to.equal('application/json');
    expect(result).to.deep.equal({
      session: { accessToken: 'at', expiresAt: 123, userType: 'anonymous' },
      persisted: true,
    });
  });

  it('should ask for a forced refresh and use a custom endpoint', async () => {
    const fetchStub = sinon.stub().resolves(jsonResponse(200, { ...valid, userType: 'registered' }));
    const client = new RouteHandlerTokenClient({ endpoint: '/custom', fetch: fetchStub });

    await client.refresh(undefined);

    const [url, init] = fetchStub.firstCall.args;
    expect(url).to.equal('/custom');
    expect(JSON.parse(init.body)).to.deep.equal({ forceRefresh: true });
  });

  it('should never expose a refresh token even if the endpoint returns one', async () => {
    const fetchStub = sinon
      .stub()
      .resolves(jsonResponse(200, { ...valid, userType: 'registered', refreshToken: 'leak' }));
    const result = await new RouteHandlerTokenClient({ fetch: fetchStub }).getAnonymousToken();
    expect(result.session).not.to.have.property('refreshToken');
  });

  it('should reject invalid responses', async () => {
    const fetchStub = sinon.stub().resolves(jsonResponse(200, { accessToken: 'at' }));
    const error = await new RouteHandlerTokenClient({ fetch: fetchStub })
      .getAnonymousToken()
      .catch((e) => e);
    expect(error).to.be.instanceOf(CommerceError);
    expect(error.message).to.include('invalid response');
  });

  it('should map endpoint errors to sdk errors', async () => {
    const fetchStub = sinon.stub().resolves(jsonResponse(502, { error: 'upstream' }));
    const error = await new RouteHandlerTokenClient({ fetch: fetchStub })
      .getAnonymousToken()
      .catch((e) => e);
    expect(error).to.include({ source: 'sdk', status: 502 });
  });

  it('should surface network errors', async () => {
    const fetchStub = sinon.stub().rejects(new TypeError('offline'));
    const error = await new RouteHandlerTokenClient({ fetch: fetchStub })
      .getAnonymousToken()
      .catch((e) => e);
    expect(error).to.include({ source: 'network', message: 'offline' });
  });

  it('should DELETE to clear', async () => {
    const fetchStub = sinon.stub().resolves(new Response(null, { status: 204 }));
    await new RouteHandlerTokenClient({ fetch: fetchStub }).clear();
    const [url, init] = fetchStub.firstCall.args;
    expect(url).to.equal('/api/commerce/token');
    expect(init.method).to.equal('DELETE');
    expect(init.credentials).to.equal('same-origin');
  });

  it('should declare server-managed refresh', () => {
    expect(new RouteHandlerTokenClient().serverManagedRefresh).to.equal(true);
  });
});
