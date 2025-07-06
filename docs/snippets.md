Snippets
========

This section describes the set of utilities available for handling dynamic control flow in templates using [direct mode](/reactivity#description).

## Description

Snippets are helpers for common reactive control flow statements, such as rendering lists from stores and handling conditional content in a reactive way.  
They are designed to be an alternative to using watched expressions when using direct mode.
They are essentially functions that return readable stores, and that handle the complexity of the reactive control flow logic.

Currently available snippets:

- **loop**: Render a list of nodes from a reactive collection.
- **cond**: Reactive conditional rendering (if/elseif/else).

---

## Examples

### `loop`

Render a dynamic list from a reactive store:

```js
const items = writable([1, 2, 3]);

const nodesStore = loop().each(items, (item) => html`<li>${item}</li>`);
```

With a custom key for diffing:

```js
const items = writable([
  { id: 'a', label: 'Item A' },
  { id: 'b', label: 'Item B' },
  { id: 'c', label: 'Item C' }
]);

const nodesStore = loop().each(items, (item) => html`<li>${item.label}</li>`, item => item.id);
```

Used in a template:

```js
const nodesStore = node(html`
  <ul>
    ${loop().each(items, (item) => html`<li>${item.label}</li>`)}
  </ul>
`);
```


### `cond`

Basic reactive conditional node:

```js
const isVisible = writable(true);
const nodeStore = cond().if(isVisible, html`<span>Visible !</span>`);
```

With a simple else branch:

```js
const isVisible = writable(true);

const nodeStore = cond()
    .if(isVisible, html`<span>Visible !</span>`)
    .else(html`<span>Hidden</span>`);
```

With multiple conditions:

```js
const status = writable('loading');

const nodeStore = cond()
    .if(status, 'loading', html`<span>Loading...</span>`)
    .elseif(status, 'error', html`<span>Error occurred</span>`)
    .else(html`<span>Content loaded</span>`);
```

Used in a template:

```js
const nodeStore = node(html`
    <div>
        ${cond()
            .if(isVisible, html`<span>Visible !</span>`)
            .else(html`<span>Hidden</span>`)}
    </div>
`);
```

## Diffing

The `loop` snippet supports diffing for efficient DOM updates.  
When using the `each` method, you can provide a function to generate a unique key for each item in the collection. This allows the framework to efficiently update only the changed items in the DOM, rather than re-rendering the entire list.

If no key function is provided, there are two scenario :
1. the array contains **objects**, then the framework will generate a unique pseudo random key for each item. This key is associated to the object reference.
2. the array contains **primitive values**, then no diffing is used, when the collection changes the list is fully re-rendered.

The diffing algorithm used is quite naive and works as follows:

1. **Deletions**: It first detects which items in the old array are not present in the new array and marks them for deletion. These deletions are applied in reverse order to avoid index shifting issues.
2. **Additions**: Next, it detects which items in the new array are not present in the old array and marks them for addition at the correct indices.
3. **Moves**: After applying deletions and additions to a buffer array, it identifies items that are present in both arrays but at different positions, and marks them for movement to their new indices.
4. **Overkill detection**: If the number of operations (deletions, additions, moves) equals or exceeds the size of the new array, or if the arrays are totally different, the algorithm returns early with an `overkill: true` flag, indicating that applying all operations individually is not efficient.
5. **Efficiency**: The algorithm is designed to be simple and efficient for small to medium-sized arrays, but may not always produce the minimal set of operations for large or complex changes.

Every comparison is based on the key of the items.

?> What is to be noted is that the diffing algorithm is great for simple modifications, but may abort early if the changes are too complex, leading to a full re-render of the list.

## API Reference


### Types

<big>**LoopOptions**</big>

_Properties:_
- `useDiffing?: boolean` — Enable diffing for efficient DOM updates.
- `updateDomMode?: DomUpdateMode` — DOM update mode.

---

<big>**DomUpdateMode**</big>

See [Reactivity](/reactivity#types).

---

<big>**HtmlLiterals**</big>

See [Templating](/templating#types).

---

<big>**Readable&lt;T&gt;**</big>

See [Stores](/stores#types).


### Functions

<big>**loop**(options?: LoopOptions): { each }</big>

Initializes a reactive loop structure.

_Parameters:_

- `options` (optional): `LoopOptions`   
By default diffing is used and DOM updates are batched.

_Returns:_  
`{ each }` — An object with the `each` method.

_Sub functions:_

  * .**each**&lt;T&gt;(collection, buildItemContent, getItemKey?)

  Renders a list of nodes from a reactive collection.

  _Parameters:_ 
    - `collection`: `Readable<Iterable<T>>` — Store with an iterable collection.
    - `buildItemContent(item: T): Node | HtmlLiterals` — Function to build a node for each item.
    - `getItemKey?`: `(item: T) => string` — (optional) Function to provide a unique key for each item (for diffing).

  _Returns:_  
  A readable store containing either a placeholder text node (if empty) or an array of nodes.

---

<big>**cond**(): { if, elseif, else }</big>

Initializes a reactive conditional builder.

_Returns:_  
`{ if }` — An object with the `if` method.

_Sub functions:_
  * .**if**(condition, contentIfTrue)  

  Adds the first condition. 

  _Parameters:_
    - `condition`: `Readable<boolean>` — Store representing the condition.
    - `contentIfTrue`: `Node | HtmlLiterals | Readable<Node | HtmlLiterals>` — Content to display if condition is true.

  _Returns:_  
  A readable store containing the current node, with additional `.elseif` and `.else` methods.

  * .**elseif**(condition, contentIfTrue)`

  Adds an additional condition.

  _Parameters:_
    - `condition`: `Readable<boolean>` — Store representing the condition.
    - `contentIfTrue`: `Node | HtmlLiterals | Readable<Node | HtmlLiterals>` — Content to display if condition is true.

  _Returns:_  
  A readable store containing the current node, with additional `.elseif` and `.else` methods.

  * .**else**(content)

  Content to display if no previous condition matched.

  _Parameters:_
    - `content`: `Node | HtmlLiterals | Readable<Node | HtmlLiterals>` — Content to display if no previous condition matched.

  _Returns:_  
  A readable store containing the current node.
