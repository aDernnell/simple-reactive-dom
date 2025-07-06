Templating
==========

This section describes the set of utilities available for creating and working with HTML templates.

## Description
The Templating feature is based on JavaScript template literals. It allows to create HTML elements and text nodes using tagged template literals, making it easy to build dynamic and reactive user interfaces.
The templating system supports both static and dynamic content, enabling to embed variables, expressions, and even reactive stores directly into your templates.

It is conceived to allow functional programming style, where templates are pure functions of their inputs, making it easy to compose and test.

Templates are transformed to DOM nodes using the `node()` function, which returns a `Node` instance. See [Reactivity section](/reactivity) for more details on how to use the templating system in a reactive way.

!> When using text tag function, the content of the template is interpreted as a text node, and thus it cannot contain HTML elements. When using html tag function, the content of the template is interpreted as an HTML element, and must contain an unique englobing html tag.

## Examples

```js
const simpleTextLiterals: HtmlLiterals = text`This is an orphan node`; // This is a text literals
const simpleElLiterals: HtmlLiterals = html`<span>This is an element node</span>`; // This is an HTML literals

const staticValue = 'StaticValue';
const dynamicValue: Writable<string> = writable('dynamic-value');
const num = 42;
const nestedTemplate = html`<span>Nested</span>`;

const complexLiterals: html`
    <div class="${staticValue.toLowerCase()}">
        <h1>Title ${staticValue}</h1>
        <p>${dynamicValue} ${num * 2 > 80 ? 'High' : 'Low'}</p>
        <div>${nestedTemplate}</div>
        <ul>
            ${['Item 1', 'Item 2', 'Item 3'].forEach(item => html`<li>${item}</li>`)}
        </ul>
    </div>
`;

// This is not allowed, as it is not a valid Element Node
const invalidNode = html`
  <li>1</li>
  <li>2</li>
  <li>3</li>
`;
```

## Serialization

You can embed the following types of variables in template literals:

- _String_
- _Number_
- _Boolean_
- _BigInt_
- _Symbol_
- _Function_
- _Object_
- _Readable store_ (i.e. Svelte's `Readable`/`Writable`)
- _HtmlLiterals_ (nested templates)
- `null`
- `undefined`

`Readable` stores and `HtmlLiterals` are interpreted in a special way and are not considered as object values. For a `Readable` store, this is the current value that is used in the template and serialized. For `HtmlLiterals`, the template is rendered as a nested template.

All other types will be serialized to a string representation.
The default serialization function is as follows:
```js
export const defaultSerializeFn = (value: any, _context?: BindingContext, _key?: string): string => {
    switch (typeof value) {
        case 'undefined':
            return 'undefined';
        case 'object':
            if (value === null) return 'null';
        // Fallthrough for non null objects
        case 'symbol':
        case 'function':
            return `[${typeof value}]`;
        case 'string':
        case 'number':
        case 'bigint':
        case 'boolean':
            return `${value}`;
    }
};
```
But you can globally define a custom serialization function :
```js
setGlobalSerializer((value) => (typeof value === 'number' ? value.toFixed(2) : value)); // Specify how numbers should be serialized
setGlobalSerializer(undefined); // If you want to reset to default
```

An other option is to pass a serializer function as `node()` parameter. Ex :
```js
const elNode = node(html`<pre>${obj}</pre>`, {
    serializer: (value) => JSON.stringify(value),
}) as Element;
```

Either way, the result of a custom serialization function will be passed as input of defaultSerializeFn.

## API Reference

### Types

<big>**HtmlLiterals**</big>

An object representing a template literal with static strings and dynamic values.

_Properties:_
- `strings: TemplateStringsArray`  
  Static template strings.
- `values: unknown[]`  
  Dynamic values to embed.
- `tmpl?: string`  
  (Internal use) Cached template string including placeholders.
- `tmplStores?: { [key: string]: Readable<unknown> }`  
  (Internal use) Stores mapped to placeholder's keys.
- `node?: Node`  
  (Internal use) Cached node.
- `bindings?: Array<Binding>`  
  (Internal use) Array of binding metadata

---

<big>**BindingContext**</big>

Enum. Indicates the context in which a value is being embedded or serialized in a template.

_Values:_
- `ATTR_VALUE` — The value is embedded in an attribute value.
- `CHILD_TEXT` — The value is embedded within a child text node.
- `ORPHAN_TEXT` — The value is embedded within an orphan text node (standalone text node without known parent).

---

### Functions

<big>**html**(strings: TemplateStringsArray, ...values: unknown[]): HtmlLiterals</big>

Tag function for HTML elements. Returns an `HtmlLiterals` object representing an HTML node with static strings and dynamic values.

---

<big>**text**(strings: TemplateStringsArray, ...values: unknown[]): HtmlLiterals</big>

Tag function for text nodes. Returns an `HtmlLiterals` object representing a text node.

---

<big>**setGlobalSerializer**(partSerializeFn?: (value: any, context?: BindingContext, key?: string) => any): void</big>

Sets a global partial serialization function for template variable values.  
The provided function can serialize specific types and pass others through.  
The result is always passed to the default serializer to ensure all cases are handled.  
If no function is provided, i.e. `undefined` is passed as parameter, it removes the global serializer that was previously set.

_Parameters:_
- `partSerializeFn?`:  
  Optional. A function of type `(value: any, context?: BindingContext, key?: string) => any`  
  - `value`: The value to serialize.  
  - `context`: The binding context (`BindingContext.ATTR_VALUE`, `BindingContext.CHILD_TEXT`, or `BindingContext.ORPHAN_TEXT`).  
  - `key`: The placeholder key corresponding to the value.

---

<big>**raw**(literals: HtmlLiterals): string</big>

Converts an `HtmlLiterals` object into its raw HTML string representation.

---

<big>**rawHtml**(strings: TemplateStringsArray, ...values: unknown[]): string</big>

Returns the raw HTML string from template literals.

---

