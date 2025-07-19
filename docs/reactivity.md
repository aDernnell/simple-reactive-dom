# Reactivity

This section describes how reactivity is implemented, allowing node issued from templates to automatically update when their underlying data changes.

## Description

Reactivity is based on the concept of [stores](/stores). The framework provides a way to embed these stores into HTML templates, allowing the DOM to automatically update when the store values change.

The reactivity mechanism is set up when a template is converted to a DOM node with one of the following functions: `node()` or `dynNode()`.

For `node()` function, there are 2 modes of operation, depending on its usage:

-   **direct mode**
    Every reactive value is handled by a store embedded in the template and embedded dynamic values that are not stores are not reactive.
-   **watch mode**  
     A function is used to listen to some stores and, when one of them changes, the function is called and the embedded values are updated, updating the DOM accordingly. It allows to embed dynamic values that are not stores. It is useful for re-evaluating embedded expressions.

`dynNode()` is similar to `node()` in watch mode, except that instead of generating a static node whose embedded values are updated, it regenerates the whole node every time the watched stores change. It is useful for creating dynamic nodes that can change their structure and it allows to switch between different templates based on the store values.

These modes can be used together in a single template, allowing for both direct store updates and reactive expressions.

!> When using `node()` in watch mode, the function used to get the template must always return the same top level template structure (same instance of [`HtmlLiterals`](/templating#Types)), even if the embedded values change. This is because the framework uses the structure to determine what parts of the DOM need to be updated. If you need to change the structure of the template, you should use `dynNode()` instead.

## Exemples

```js
// Direct mode: store is embedded directly in the template
const countStore = store(0);
const directNode = node`<button>Count: ${countStore}</button>`;
directNode.addEventListener('click', () => {
  countStore.update(value => value + 1); // Triggers Node update
});

// Watch mode: use a function to watch stores and re-render
// the watch function register a store to be subscribed to and returns the store value
const items = writable(['Item 1', 'Item 2', 'Item 3']);
const watchNode = node(watch => html`
    <ul>
        ${watch(items).forEach(item => html`<li>${item}</li>`)}
    </ul>
`);
items.update(current => [...current, 'Item 4']); // Triggers Node update

// Watch mode can also be used to listen to a store whose value is not part of the template
const count = 0;
const trigger = writable({});
const watchNode2 = node(watch => {
  watch(trigger);
  return html`<div>Expression result: ${count % 2 == 0 ? 'Count is even' : 'Count is Odd'}</div>`;
});
// Can also use a comma operator (,) to be more concise
const watchNode3 = node(watch => (watch(trigger), html`<div>Expression result: ${count > 10 ? 'Count is > 10' : 'Count is < 10'}</div>`));

count = count + 1; // Does not trigger Node update
trigger.set({}); // Triggers Node update

// Direct and watch modes can be used together
const combinedNode = node(watch => (watch(trigger), html`
    <div>
        <span>${count} = ${countStore}</span>
    </div>
`));

// This will log an error, because node() in watch mode expects a function that always returns the same top level template
const invalidNode = node(watch => {
    if (count > 10) {
        return html`<div>Count is greater than 10</div>`;
    } else {
        return html`<div>Count is less than or equal to 10</div>`;
    }
});
// But this is allowed, because it always returns the same top level template, even if the embedded one changes:
const validNode = dynNode(watch => html`
    <div>
        ${watch(countStore) > 10 
            ? html`<div>Count is greater than 10</div>` 
            : html`<div>Count is less than or equal to 10</div>`}
    </div>
`);

// Use dynNode to create a dynamic node that changes its top level structure:
const dynamicNode: Readable<Node> = dynNode(watch => {
    const isEven = watch(countStore) % 2 === 0;
    return isEven 
              ? html`<span>Whatever content when count is even...</span>` 
              : html`<span>Whatever content when count is odd...</span>`;
});

```

## Optimisations

The framework try to update the DOM as efficiently as possible by minimizing the number of changes made to the DOM tree.
There are two main strategies for this:

-   **Granularity of updates** (node() only)
-   **Batching updates** (node() and dynNode())

### Granularity of updates

The reactivity system determines the smallest part of the DOM that needs to be updated based on where the reactive value is located in the template. This means that only the necessary parts of the DOM are updated, rather than the entire node.

The granularity of the DOM update depends on where the substitution occurs in the template:

| Reactive value location | What is updated on reactive value change |
| ----------------------- | ---------------------------------------- |
| Inside orphan Text node | Whole text content of the node           |
| Inside Attribute        | Whole attribute value                    |
| Inside child Text node  | Node generated by the substitution       |

Thus, if two stores are embedded in a child Text node, only the text content associated to the store value is updated when one of the stores changes, rather than the entire node :

```js
const store1 = store('Hello');
const store2 = store('World');
const node = node`<span>${store1} ${store2}</span>`;
store1.set('Hi'); // Only the Text node 'Hello' is replaced, not the whole span !
```

This is possible because the generated Node Tree is as follow : `Span( Text('Hello'), Text(' '), Text('World') )`

In a same way when a template is reevaluated in watch mode, only the parts of the DOM that are affected by the changes in the template are updated, rather than the entire node. This is only true when using `node()` in watch mode, as `dynNode()` always regenerates the whole node.

### Batching updates

DOM updates are optimized by batching them when possible, reducing the number of reflows and repaints in the browser. This is controlled by the `DomUpdateMode` option in the `node()` function.

When set to `BATCHED` (default), updates are queued and applied asynchronously in a [microtask](https://developer.mozilla.org/en-US/docs/Web/API/HTML_DOM_API/Microtask_guide), allowing multiple updates to be processed together. See [Debouncer section](/debouncer) for more details.

When set to `EAGER`, updates are applied synchronously, which can be useful for immediate feedback but may lead to performance issues if many updates occur in quick succession.

Same mecanism is used in watch mode, where watched stores updates are batched and applied in a microtask by default, allowing for efficient updates when multiple stores change.

## API Reference

### Types

<big>**DomUpdateMode**</big>

Enum. Controls how DOM updates are scheduled.

_Values:_

-   `EAGER`  
    Updates are applied synchronously.
-   `BATCHED`  
    Updates are queued and applied asynchronously in a microtask. See [Debouncer section](/debouncer).

---

<big>**DirectOptions**</big>

Options for direct node creation.

_Properties:_

-   `serializer?: (value: any, context?: BindingContext, key?: string) => any`  
    Function to serialize values. See [Serialization section](/templating#Serialization).
-   `updateDomMode?: DomUpdateMode`  
    DOM update mode.

---

<big>**WatcherOptions**</big> (extends `DirectOptions`)

Options for watcher mode.

_Properties:_

-   `debounceWatches?: boolean` — Whether to debounce store updates.

---

<big>**Watcher**</big>

A function: `<T>(store: Readable<T>) => T`

---

### Functions

<big>**node**(template: HtmlLiterals, options?: DirectOptions): Node</big>  
<big>**node**(fn: (watch: Watcher) => HtmlLiterals, options?: WatcherOptions): Node</big>

Transforms a template or a function returning a template into an HTML node and implements reactivity.

-   In direct mode, takes the result of a tag function, i.e. `HtmlLiterals`, and returns a DOM node.
-   In watcher mode, takes a function that returns an `HtmlLiterals` object and automatically updates the node when watched stores change.

_Parameters:_
-   `template` — A template literal, i.e. an `HtmlLiterals` object.
-   `fn` — A function that returns an `HtmlLiterals` object.
-   `options` — Options: `DirectOptions` for direct mode,  or `WatcherOptions` for watcher mode.

_Returns:_  
A DOM node

---

<big>**dynNode**(fn: (watch: Watcher) => HtmlLiterals, options?: WatcherOptions): Readable<Node></big>

Transforms a function returning a template into a reactive HTML node. The whole node is regenerated every time the watched stores change.
Similar to `node()` in watch mode, but regenerates the entire node instead of updating parts of it.

_Parameters:_
-   `fn` — A function that returns an `HtmlLiterals` object.
-   `options` — Options for the watcher, see `WatcherOptions`.

_Returns:_  
A readable store containing the (re)generated node.