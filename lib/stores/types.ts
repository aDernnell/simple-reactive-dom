/** Callback to inform of a value updates. */
export type Subscriber<T> = (value: T) => void;

/** Unsubscribes from value updates. */
export type Unsubscriber = () => void;
export type RxUnsubscriber = { unsubscribe: () => void };

/** Callback to update a value. */
export type Updater<T> = (value: T) => T;

/** Cleanup logic callback. */
export type Invalidator<T> = (value?: T) => void;

/**
 * Start and stop notification callbacks.
 * This function is called when the first subscriber subscribes.
 *
 * @param set Function that sets the value of the store.
 * @param update Function that sets the value of the store after passing the current value to the update function.
 * @returns Optionally, a cleanup function that is called when the last remaining subscriber unsubscribes.
 */
export type StartStopNotifier<T> = (set: (value: T) => void, update: (fn: Updater<T>) => void) => void | (() => void);

/** Readable interface for subscribing. */
export interface Readable<T> {
    /**
     * Subscribe to value changes.
     * @param run subscriber callback
     * @returns unsubscribe function
     */
    subscribe(this: void, run: Subscriber<T>, invalidate?: Invalidator<T>): Unsubscriber;

    /**
     * Get current value.
     */
    get(this: void): T;
}

/** Writable interface for both updating and subscribing. */
export interface Writable<T> extends Readable<T> {
    /**
     * Set value and inform subscribers.
     * @param value new value
     */
    set(this: void, value: T): void;

    /**
     * Update value using callback and inform subscribers.
     * @param updater callback
     */
    update(this: void, updater: Updater<T>): void;
}

/** Signature for overloads of readable() function */
export type ReadableFn = {
    <T>(value?: T | undefined, start?: StartStopNotifier<T> | undefined): Readable<T>;
    <T>(initialValue: T, start?: StartStopNotifier<T>): Readable<T>;
};

/** Signature for overloads of writable() function */
export type WritableFn = {
    <T>(value?: T | undefined, start?: StartStopNotifier<T> | undefined): Writable<T>;
    <T>(initialValue: T, start: StartStopNotifier<T>): Writable<T>;
};

/** One or more `Readable`s. */
export type Stores = Readable<any> | [Readable<any>, ...Array<Readable<any>>] | Array<Readable<any>>;

/** One or more values from `Readable` stores. */
type StoresValues<T> = T extends Readable<infer U> ? U : { [K in keyof T]: T[K] extends Readable<infer U> ? U : never };

/** Signature for overloads of derived() function, order matters for type inference ! */
export type DerivedFn = {
    <S extends Stores, T>(
        stores: S,
        fn: (values: StoresValues<S>, set: (value: T) => void, update: (fn: Updater<T>) => void) => Unsubscriber | void,
        initialValue?: T | undefined
    ): Readable<T>;
    <S extends Stores, T>(stores: S, fn: (values: StoresValues<S>) => T, initialValue?: T | undefined): Readable<T>;
    <S extends Stores, T>(
        stores: S,
        fn: (values: StoresValues<S>, set: (value: T) => void, update: (fn: Updater<T>) => void) => Unsubscriber | void,
        initialValue: T
    ): Readable<T>;
    <S extends Stores, T>(stores: S, fn: (values: StoresValues<S>) => T, initialValue: T): Readable<T>;
};
