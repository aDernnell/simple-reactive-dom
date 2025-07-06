import { noop } from '../utils/misc';
import {
    DerivedFn,
    Invalidator,
    Readable,
    ReadableFn,
    StartStopNotifier,
    Stores,
    Subscriber,
    Unsubscriber,
    Updater,
    Writable,
    WritableFn,
} from './types';
import { runAll, safeNotEqual, subscribeToStore } from './utils';

export * from './types';

const WRITABLE_TAG = Symbol.for('writable');
const READABLE_TAG = Symbol.for('readable');

export const isWritable = (value: unknown): value is Writable<unknown> => {
    return typeof value === 'object' && value != null && value.hasOwnProperty(WRITABLE_TAG);
};

export const isReadable = (value: unknown): value is Readable<unknown> => {
    return typeof value === 'object' && value != null && value.hasOwnProperty(READABLE_TAG);
};

const subscriberQueue: Array<[Subscriber<any>, Invalidator<any>] | any> = [];

export const readable: ReadableFn = <T>(initialValue: T, start?: StartStopNotifier<T>): Readable<T> => {
    const _writable = writable(initialValue, start);
    return {
        subscribe: _writable.subscribe,
        get: _writable.get,
        // @ts-expect-error
        [READABLE_TAG]: true,
    };
};

export const writable: WritableFn = <T>(initialValue: T, start: StartStopNotifier<T> = noop): Writable<T> => {
    let stop: Unsubscriber | null = null;

    const subscribers = new Set<[Subscriber<T>, Invalidator<T>]>();

    let value: T = initialValue;

    const set = (newValue: T) => {
        if (safeNotEqual(value, newValue)) {
            value = newValue;
            if (stop) {
                // store is ready
                const runQueue = !subscriberQueue.length;
                for (const subscriber of subscribers) {
                    subscriber[1]();
                    subscriberQueue.push(subscriber, value);
                }
                if (runQueue) {
                    for (let i = 0; i < subscriberQueue.length; i += 2) {
                        subscriberQueue[i][0](subscriberQueue[i + 1]);
                    }
                    subscriberQueue.length = 0;
                }
            }
        }
    };

    const get = () => {
        let value;
        subscribe((_) => (value = _))();
        return value!;
    };

    const update = (fn: Updater<T>) => {
        set(fn(value));
    };

    const subscribe = (run: Subscriber<T>, invalidate: Invalidator<T> = noop) => {
        const subscriber: [Subscriber<T>, Invalidator<T>] = [run, invalidate];
        subscribers.add(subscriber);
        if (subscribers.size === 1) {
            stop = start(set, update) || noop;
        }
        run(value);
        return () => {
            subscribers.delete(subscriber);
            if (subscribers.size === 0 && stop) {
                stop();
                stop = null;
            }
        };
    };

    return {
        get,
        set,
        update,
        subscribe,
        // @ts-expect-error
        [READABLE_TAG]: true,
        [WRITABLE_TAG]: true,
    };
};

export const derived: DerivedFn = <S extends Stores, T>(stores: S, fn: Function, initialValue: T): Readable<T> => {
    const single: boolean = !Array.isArray(stores);
    const storesArray: Array<Readable<any>> = single ? [stores as Readable<any>] : (stores as Array<Readable<any>>);
    if (!storesArray.every(Boolean)) {
        throw new Error('derived() expects stores as input, got a falsy value');
    }
    const auto = fn.length < 2;
    return readable(initialValue, (set, update) => {
        let started = false;
        const values: Array<T> = [];
        let pending = 0;
        let cleanup = noop;
        const sync = () => {
            if (pending) {
                return;
            }
            cleanup();
            const result = fn(single ? values[0] : values, set, update);
            if (auto) {
                set(result);
            } else {
                cleanup = typeof result === 'function' ? result : noop;
            }
        };
        const unsubscribers = storesArray.map((store, i) =>
            subscribeToStore(
                store,
                (value) => {
                    values[i] = value;
                    pending &= ~(1 << i);
                    if (started) {
                        sync();
                    }
                },
                () => {
                    pending |= 1 << i;
                }
            )
        );
        started = true;
        sync();
        return function stop() {
            runAll(unsubscribers);
            cleanup();
            // We need to set this to false because callbacks can still happen despite having unsubscribed:
            // Callbacks might already be placed in the queue which doesn't know it should no longer
            // invoke this derived store.
            started = false;
        };
    });
};

export const readonly = <T>(store: Writable<T>): Readable<T> => {
    return {
        subscribe: store.subscribe,
        get: store.get,
        // @ts-expect-error
        [READABLE_TAG]: true,
    };
};

/**
 * Get the current value from a store by subscribing and immediately unsubscribing.
 * This function exists mostly for compatibility with RxJS observable,
 * otherwise store.get() should be used instead
 */
export const get = <T>(store: Readable<T>): T => {
    let value;
    subscribeToStore(store, (_) => (value = _))();
    return value!;
};
