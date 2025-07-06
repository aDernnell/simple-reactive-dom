Debouncer
=========

This page documents the `debouncer` utility, which is used internally to optimize DOM updates.

## Description

A debouncer ensures that only the last scheduled function within a given interval is executed. This is useful for batching updates or avoiding redundant operations, especially in UI frameworks. By default, the interval is the current [microtask](https://developer.mozilla.org/en-US/docs/Web/API/HTML_DOM_API/Microtask_guide).

It is used internally to optimize DOM updates, ensuring that only the last scheduled DOM operation is executed at the end of the current microtask, reducing the number of DOM manipulations in case of multiples successive updates.

This utility can also be used in user code to debounce any function execution, not just DOM operations.

## Examples

### Basic usage

```js
const debouncer = createDebouncer();

// After the beginning of the current microtask
debouncer(() => console.log("A"));
debouncer(() => console.log("B"));
debouncer(() => console.log("C")); // Only this callback will run
// Output (after the end of the current microtask):
// C
```

----

### Forcing immediate execution of debounced DOM operations

```js
const store1 = writable('abc');
const store2 = writable('def');
const el = node(text`${store1} ${store2}`) as Text;
flush(); // Forces all debounced DOM operations to run synchronously
// By default the text node content is only populated with stores values at the end of the current microtask
```

----

### Waiting for all microtask debounced operations

```js
debouncer(() => doSomething());
await tick(); // Ensures all debounced operations have run
```

?> `await tick()` can be used in an asynchronous context to wait for all debounced operations to complete, whatever the origin of the debouncer creation (internal or user created). Thus it can be used in place of `flush()` if the context is asynchronous.

----

### Custom scheduler function
You can create a debouncer with a custom scheduler function if you need to control how the debounced functions are executed. For example, you can use `setTimeout` or any other scheduling mechanism.

```js
const customScheduler = (callback) => setTimeout(callback, 100);
const debouncer = createDebouncer(customScheduler);
debouncer(() => console.log("A"));
debouncer(() => console.log("B"));
debouncer(() => console.log("C")); // Only this callback will run
// Output (after 100ms):
// C
```

## API Reference

<big>**createDebouncer**(scheduler?: (callback: () => void))</big>

Creates a debouncer that schedules a function to run at the end of the current microtask (by default). If multiple functions are scheduled before the microtask completes, only the last one is executed.

_Parameters:_
  - `scheduler` (optional): A function to schedule the execution (defaults to `queueMicrotask`).

_Returns:_  
  A function that accepts a callback to debounce.

---

<big>**tick**()</big>

Waits for the current microtask to complete. Useful in asynchronous contexts to ensure all pending debounced operations have been executed. Works only for microtask debouncers.

_Returns:_  
`Promise<void>`

---

<big>**flush**()</big>

Synchronously executes all pending DOM operations without waiting for the end of the current microtask. This is useful if you need to force all queued DOM updates to run immediately. This function cannot be used to flush a custom debouncer, it only works with the internal debouncer used to batch dom operations.

_Returns:_  
`void`