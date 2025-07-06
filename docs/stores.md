Stores
======

This section describes the set of utilities available for creating and working with reactive stores.

> **Credits:**  
> This API and its implementation are inspired by the [Svelte stores](https://svelte.dev/docs/svelte/svelte-store) module.

## Desciption
Stores are a simple and powerful way to manage states. They allow to create reactive data structures that can be subscribed to, updated, and derived from other stores.
It is a push based solution that require explicit subscription to get notified of changes, making it easy to reason about.

There are basically two types of stores:
- **Readable**: Stores that can be subscribed to and read, but not modified directly.
- **Writable**: Stores that can be subscribed to, read, and modified directly.

The Writable contract is a superset of the Readable contract, meaning that a Writable store can be used wherever a Readable store is expected.

The `derived` function enables to create new stores whose values are computed from one or more existing stores. This allows to express complex, reactive relationships between pieces of state in a declarative way. You can combine multiple stores, transform their values, or even perform side effects when their values change. The derived store automatically updates whenever any of its input stores change, ensuring your application state remains consistent and up-to-date.

## Examples

### Store creation and usage
```js
// Create a writable store
const counter = writable(0);

// Subscribe to changes
const unsubscribe = counter.subscribe(value => {
    console.log('Counter value:', value);
});

// Modify the value
counter.set(1);
counter.update(n => n + 1);

// Create a readable store with start and stop functions
const clock = readable(new Date(), (set) => {
    const interval = setInterval(() => set(new Date()), 1000);
    return () => clearInterval(interval);
});

// Create a derived store
const double = derived(counter, n => n * 2, 0);

// Read the current value of a store
const currentValue = counter.get(); // Or get(counter);

// Check store types
console.log('counter is writable ? ', isWritable(counter)); // true
consolo.log('counter is readabale ? ', isReadable(counter)); // true
console.log('double is readable ? ', isReadable(double)); // true
consolo.log('double is writable ? ', isWritable(double)); // false

unsubscribe();
```
### Store Derivation
```js
// Create a writable store for user data
const user = writable({ name: 'John', age: 30 });

// Derive from one store: format the user's name
const formattedName = derived(user, $user => `User: ${$user.name}`, 'No user');

// Derive from multiple stores: combine user and counter
const userInfo = derived([user, counter], ([$user, $counter]) => {
    return `${$user.name} (age ${$user.age}) - Counter: ${$counter}`;
}, 'No info');

// Default value: the third argument is used until the stores emit their first value
const delayed = derived(counter, n => n > 0 ? 'Started' : 'Waiting', 'Initializing...');

// Use the set parameter in the derived callback for asynchronous or side-effectful updates
const asyncDerived = derived(
    counter,
    (n, set) => {
        set('Loading...');
        setTimeout(() => set(`Counter after delay: ${n}`), 500);
    },
    'Pending...'
);
```

## API Reference

### Types

<big>**Readable&lt;T&gt;**</big>

A store that allows subscribing to value changes and reading the current value, but does not allow direct modification.

_Properties:_
- `subscribe(run: (value: T) => void, invalidate?: (value?: T) => void): Unsubscriber`  
  Subscribe to value changes.
- `get(): T`  
  Get the current value.

---

<big>**Writable&lt;T&gt;**</big>

A store that allows subscribing to value changes, reading the current value, and directly setting or updating the value.

_Properties:_
- `subscribe(run: (value: T) => void, invalidate?: (value?: T) => void): Unsubscriber`  
  Subscribe to value changes.
- `get(): T`  
  Get the current value.
- `set(value: T): void`  
  Set the value.
- `update(fn: (value: T) => T): void`  
  Update the value using a function.

---

<big>**StartStopNotifier&lt;T&gt;**</big>

A function called when the first subscriber subscribes to a store, and optionally returns a cleanup function to be called when the last subscriber unsubscribes.  
It receives two arguments:
- `set`: A function to set the value of the store.
- `update`: A function to update the value of the store using the current value.

_Returns:_  
- Optionally, a cleanup function to run when the last subscriber unsubscribes.

---

### Functions

<big>**readable**&lt;T&gt;(initialValue: T, start?: StartStopNotifier&lt;T&gt;): Readable&lt;T&gt;</big>

Creates a readable store with an initial value. Optionally, a `start` function can be provided for setup/teardown logic.

_Parameters:_
- `initialValue`: The initial value of the store.
- `start`: (optional) A function called when the store gets its first subscriber.

_Returns:_ `Readable<T>`

---

<big>**writable**&lt;T&gt;(initialValue: T, start?: StartStopNotifier&lt;T&gt;): Writable&lt;T&gt;</big>

Creates a writable store with an initial value. Optionally, a `start` function can be provided for setup/teardown logic.

_Parameters:_
- `initialValue`: The initial value of the store.
- `start`: (optional) A function called when the store gets its first subscriber.

_Returns:_ `Writable<T>`

---

<big>**derived**&lt;S extends Stores, T&gt;(stores: S, fn: Function, initialValue: T): Readable&lt;T&gt;</big>

Creates a derived store from one or more input stores.

_Parameters:_
- `stores`: A store or array of stores to derive from.
- `fn`: A function that computes the derived value.
- `initialValue`: The initial value of the derived store.

_Returns:_ `Readable<T>`

---

<big>**readonly**&lt;T&gt;(store: Writable&lt;T&gt;): Readable&lt;T&gt;</big>

Creates a read-only version of a writable store.

_Parameters:_
- `store`: The writable store to wrap.

_Returns:_ `Readable<T>`

---

<big>**get**&lt;T&gt;(store: Readable&lt;T&gt;): T</big>

Gets the current value from a store by subscribing and immediately unsubscribing.

_Parameters:_
- `store`: The store to get the value from.

_Returns:_ `T`

---

<big>**isWritable**(value: unknown): value is Writable&lt;unknown&gt;</big>

Checks if a value is a writable store.

_Parameters:_
- `value`: The value to check.

_Returns:_ `boolean`

---

<big>**isReadable**(value: unknown): value is Readable&lt;unknown&gt;</big>

Checks if a value is a readable store.

_Parameters:_
- `value`: The value to check.

_Returns:_ `boolean`

---

