import { expect } from 'chai';
import { createSingleFlight } from './single-flight';

describe('createSingleFlight', () => {
  it('should share one in-flight promise between concurrent callers', async () => {
    const flight = createSingleFlight<number>();
    let calls = 0;
    const fn = () =>
      new Promise<number>((resolve) => {
        calls++;
        setTimeout(() => resolve(calls), 5);
      });

    const results = await Promise.all([flight.run(fn), flight.run(fn), flight.run(fn)]);
    expect(results).to.deep.equal([1, 1, 1]);
    expect(calls).to.equal(1);
  });

  it('should reset after settling so the next call runs again', async () => {
    const flight = createSingleFlight<number>();
    let calls = 0;
    const fn = async () => ++calls;

    expect(await flight.run(fn)).to.equal(1);
    expect(flight.isPending()).to.equal(false);
    expect(await flight.run(fn)).to.equal(2);
  });

  it('should reset after rejection so failures can be retried', async () => {
    const flight = createSingleFlight<number>();
    await flight.run(() => Promise.reject(new Error('boom'))).catch(() => undefined);
    expect(flight.isPending()).to.equal(false);
    expect(await flight.run(async () => 5)).to.equal(5);
  });

  it('should capture synchronous throws as rejections', async () => {
    const flight = createSingleFlight<number>();
    const result = await flight
      .run(() => {
        throw new Error('sync');
      })
      .catch((error) => error.message);
    expect(result).to.equal('sync');
  });

  it('should wait for the in-flight operation without rejecting', async () => {
    const flight = createSingleFlight<number>();
    const pending = flight.run(() => Promise.reject(new Error('boom')));
    pending.catch(() => undefined);
    expect(flight.isPending()).to.equal(true);
    await flight.wait();
    expect(flight.isPending()).to.equal(false);
    await flight.wait();
  });
});
