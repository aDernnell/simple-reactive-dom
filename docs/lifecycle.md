Lifecycle
=========

This document outlines the lifecycle capabilities of the SimpleReactiveDOM library, detailing how it manages the clean up of generated DOM elements.

## Description

There is no real lifecycle in the traditional sense as seen in frameworks like React or Vue. Instead, SimpleReactiveDOM focuses on a more straightforward approach to DOM management. It just provide a mechanism to clean up DOM elements that are no longer needed.

### Node initialization

When a node is created using the `node` function, it is not immediately attached to the DOM. Instead, it returns a `Node` object that can be manipulated and inserted into the DOM at a later time, letting room for initialization.

### Node cleanup

When a node is no longer needed (e.g. removed from a list), it is passed as parameter to an utility function named `dispose`. This function is responsible for calling a special function attached to the node if present. This special function is typically used to clean up any resources associated with the node, such as event listeners or other side effects.

In fact, the `dispose` function can be used with any object, not just nodes. The only thing to keep in mind it that is has no effect if the object was not marked as disposable with the `disposable` utility.

The role of the `disposable` function is to associate a cleanup function to the object, allowing it to be cleaned up later when the `dispose` function is called.
The cleanup function is added to the object as a property whose key is a symbol, ensuring that it does not interfere with other properties of the object.

This allows for a flexible cleanup mechanism that can be applied to various objects within the library.

## Example

```js
import { html, node, writable, disposable, dispose } from 'simple-reactive-dom';

function TimerComponent() {
  // Initialization
  const count = writable(0);
  const divEl = node(html`<div>Count: ${count}</div>`);
  const interval = setInterval(() => {
    count.update((c) => c + 1);
  }, 1000);

  // Mark as disposable with cleanup function
  return disposable(divEl, () => {
    clearInterval(interval);
  });

  // Note: the node object is modified inplace, so we could also have writen:
  disposable(divEl, () => clearInterval(interval));
  return divEl;
}

// This is a fake exemple because the node is never disposed here...
document.body.appendChild(TimerComponent());
```


## API Reference

### Types

<big>**Disposable**</big>

Interface for objects that can be disposed. Disposable objects have at least one cleanup function attached as a symbol property (`Symbol.for('dispose')`).

If there is only **one cleanup function**, it is registered under `Symbol.for('dispose')`.

When there are **multiple cleanup functions**, they are categorized into shallow and root disposals. The root disposal is the main cleanup function (the first one added), while shallow disposals are additional cleanup functions added afterwards. It is used in a special case where only the user defined cleanup functions must be called and not the one set internally by the frmework.

In this case:
- `Symbol.for('shallow_dispose')` consists of a function that chains all the shallow disposal functions.
- `Symbol.for('dispose')` consists of a function that chains the root disposal function and all shallow disposal functions.

```ts
interface Disposable {
  [Symbol.for('dispose')]: () => void;
  [Symbol.for('shallow_dispose')]?: () => void;
  [Symbol.for('root_dispose')]?: () => void;
}
```

---

### Functions

<big>**disposable**(obj: T, disposeFn: () => void): T</big>

Associates a cleanup function to an object, marking it as disposable.

If the object is already disposable:
- the cleanup functions are chained in a new function registered in `Symbol.for('dispose')` 
- the first cleanup function is saved in `Symbol.for('root_dispose')`
- the new cleanup function is added to `Symbol.for('shallow_dispose')`. If `Symbol.for('shallow_dispose')` already exists, it is replaced with a new function that chains all shallow disposal functions.

_Parameters:_
- `obj`: The object to mark as disposable.
- `disposeFn`: The cleanup function to associate with the object.

_Returns:_  
  The original object, now marked as disposable.

---

<big>**dispose**(obj: unknown): void</big>

Calls the dispose function (i.e. `Symbol.for('dispose')) attached to the object (if any) and removes it from the object properties so that the object is no more marked as disposable. Can also be used with an array of disposables.

_Parameters:_
- `obj`: The object to dispose.

---

<big>**shallowDispose**(obj: unknown): void</big>

Calls the complementary (shallow) dispose functions (i.e. `Symbol.for('shallow_dispose')) attached to the object, if present. Can also be used with an array of disposables.

_Parameters:_
- `obj`: The object to shallow dispose.

---

<big>**disposeRec**(value: unknown): void</big>

Recursively disposes the value and any nested values (nested values are values inside stores or arrays).

_Parameters:_
- `value`: The value to dispose, which can be a store, an array, or any other object.
---

<big>**isDisposable**(value: unknown): value is Disposable</big>

Checks if a value is marked as disposable (i.e. has a defined `Symbol.for('dispose')` property).

_Parameters:_
- `value`: The value to check.

_Returns:_  
  `true` if the value is disposable, `false` otherwise.