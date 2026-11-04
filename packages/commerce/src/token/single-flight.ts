/**
 * Dedupes concurrent async operations: while one is in flight, callers receive the same promise.
 * @internal
 */
export interface SingleFlight<T> {
  /**
   * Runs `fn` unless an operation is already in flight, in which case the in-flight promise is returned.
   */
  run(fn: () => Promise<T>): Promise<T>;
  /**
   * Whether an operation is currently in flight.
   */
  isPending(): boolean;
  /**
   * Resolves once the in-flight operation (if any) settles. Never rejects.
   */
  wait(): Promise<void>;
}

/**
 * Creates a {@link SingleFlight}. The in-flight promise is cleared once it settles (success or failure),
 * so a failed operation can be retried.
 * @returns {SingleFlight<T>} single-flight runner
 * @internal
 */
export function createSingleFlight<T>(): SingleFlight<T> {
  let inflight: Promise<T> | null = null;

  return {
    run(fn) {
      if (inflight) return inflight;

      const settle = () => {
        if (inflight === current) inflight = null;
      };
      const current: Promise<T> = Promise.resolve()
        .then(fn)
        .then(
          (value) => {
            settle();
            return value;
          },
          (error) => {
            settle();
            throw error;
          }
        );
      inflight = current;
      return current;
    },
    isPending: () => inflight !== null,
    wait: async () => {
      if (inflight) await inflight.then(
        () => undefined,
        () => undefined
      );
    },
  };
}
