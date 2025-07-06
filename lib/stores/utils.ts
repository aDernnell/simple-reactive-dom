import { noop } from '../utils/misc';
import { Invalidator, Readable, RxUnsubscriber, Unsubscriber } from './types';

export const safeNotEqual = (a: unknown, b: unknown): boolean => {
    return a !== b || (a !== null && (typeof a === 'object' || typeof a === 'function'));
};

export const runAll = (arr: Array<Function>) => {
    for (var i = 0; i < arr.length; i++) {
        arr[i]();
    }
};

const isRxUnsub = (unsub: Unsubscriber | RxUnsubscriber): unsub is RxUnsubscriber => {
    return typeof unsub == 'object' && unsub.unsubscribe !== undefined;
}

export const subscribeToStore = <T>(
    store: Readable<T> | null | undefined,
    run: (value?: T) => void,
    invalidate?: Invalidator<T>
): Unsubscriber => {
    if (store == null) {
        run(undefined);
        invalidate?.(undefined);
        return noop;
    }

    const unsub = store.subscribe(run, invalidate);
    // Also support RxJS
    return isRxUnsub(unsub) ? () => unsub.unsubscribe() : unsub;
};
