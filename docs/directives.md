Directives
==========

Directives are utility functions whose results have a special meaning in templates or that allow to transform values in a specific manner.

## Description

In order to templates to be more expressive and as close as possible to HTML, the framework provides a set of directives that can be used in templates. These directives allow you to handle common scenarios such as conditional attributes, event handlers, and value transformations:

- **opt**  
    Allow to convert nullish values to an empty string.
- **when**   
    Allow to conditionally render attributes.
- **call**  
    Allow to declare inline event handlers.

## Examples

### `opt`
```js
const store = writable(null);
const value = undefined;

html`<input value="${opt(store)}" />`
html`<span>${opt(value)}</span>`
```

### `when`
```js
const isChecked = writable(false);
const isLoading = writable(false);
const selectedStore = writable('yes');

html`<input type="checkbox" checked=${when(isChecked)} />`
html`<button disabled=${when(isLoading)} />`
html`<input checked=${when(selectedStore, 'yes')} />`
```
Note: Quotes are optional around the attribute value when using `when`.

### `call`
```js
const onClickHandler = (event) => console.log('Button clicked!', event);

html`<button onclick=${call(onClickHandler)}>Click me</button>`
```
Note: Quotes are optional around the attribute value when using `call`.

## API Reference

<big>**opt**</big>

Transforms `null` and `undefined` values into an empty string for display, whether for a simple value or a store.

_Signature:_
```typescript
opt(param: unknown): string | unknown
```

_Parameters:_
- `param` — The value or store to transform.

_Returns:_  
The original value or store, with `null`/`undefined` replaced by `""`.

---

<big>**when**</big>

Allows an attribute to be conditionally rendered, based on a boolean or a store. Useful for attributes like `checked`, `disabled`, etc.

The resulting object `ConditionalAttr` or store can be used directly in the template as an attribute value and is interpreted as a boolean condition for adding or removing the attribute.

_Signatures:_
```typescript
when(store: Readable<unknown>, value: unknown): Readable<ConditionalAttr>
when(store: Readable<boolean>): Readable<ConditionalAttr>
when(cond: boolean): ConditionalAttr
```

_Parameters:_
- `store` — A readable store whose value is compared to `value` (or `true` by default).
- `value` — The value to compare against (optional, defaults to `true`).
- `cond` — A boolean condition.

_Returns:_  
A `ConditionalAttr` object or a readable store of `ConditionalAttr` to use as an attribute value.

---

<big>**call**</big>

Allows you to declare an inline event handler in the template.

The resulting `EventHandler` can be used directly in the template as an attribute value. It is interpreted as an event handler attribute value and the provided handler function will be called when the event is triggered.

_Signature:_
```typescript
call(handler?: (event: Event) => void): EventHandler
```

_Parameters:_
- `handler` — The function to call when the event is triggered.

_Returns:_  
An `EventHandler` object to use as an attribute value.

---