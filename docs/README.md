SimpleReactiveDOM
=================

**SimpleReactiveDOM.js** or more simply **srDOM** is a reactive UI framework based on [vanilla Javascript](https://developer.mozilla.org/en-US/docs/Web/JavaScript) and [DOM](https://developer.mozilla.org/en-US/docs/Web/API/Document_Object_Model).


## Features
  * [Stores](./#stores) - Embbeded svelte stores implementation
  * [Templating](./#templating) - Describe HTML content in JS with Tagged Literals
  * [Reactivity](./#reactivity) - Reactivity and state binding
  * [Directives](./#directives) - Conditional attributes, inline event listeners and optional values
  * [Snippets](./#snippets) - Conditional content and loops
  * [Refs](./#refs) - Referencing Elements
  * [Debouncer](./#debouncer) - DOM updates debouncer

### Stores
The library embbed https://svelte.dev/docs/svelte/stores#svelte-store as a way to control states and reactivity. The [source code](https://github.com/sveltejs/svelte/tree/main/packages/svelte/src/store) of svelte store implementation has been copy-pasted and adapted, making srDOM dependency free.

A store is an object with a subscribe() method that allows interested parties to be notified whenever the store value changes and an optional set() method that allows you to set new values for the store. 
This minimal API is known as the [store contract](https://svelte.dev/docs/svelte/stores#Store-contract).

srDOM provides functions for creating [readable](https://svelte.dev/docs/svelte-store#readable), [writable](https://svelte.dev/docs/svelte-store#writable), and [derived](https://svelte.dev/docs/svelte-store#derived) stores as svelte does.

In addition, a slight modification has been added to the readable API : the get() method. Thus, instead of using a function to get the store value, i.e. `get(store)`, you can use the method `store.get()`. The function get() is still available for compatibility with RxJS observable.

?> See [Stores section](/stores) for more informations.

### Templating
Templates in srDOM are handled by the powerful [template literals](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals) feature of JS.

They can describe an HTML Element or a Text Node. For that, srDOM defines two [tag functions](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals#tagged_templates) : _text_ and _html_.

The `node()` function allows to transform the tagged templates result into the corresponding [Node](https://developer.mozilla.org/en-US/docs/Web/API/Node) instance.
```js
const textStr = 'text', elStr = 'element';
const textNode = node(text`This is an orphan ${textStr} node`) as Text; // This is an orphan text node
const elNode = node(html`<span>This is an ${elStr} node</span>`) as Element; // <span>This is an element node<span>
```

?> See [Templating section](/templating) for more informations.

### Reactivity
As stated above, reactivity is based on stores. If a store is embedded in a template, the framework automatically handles the update of the DOM when the store value is updated.
```js
const store = writable(0);
const el = node(html`<div>Value is ${store}</div>`) as Element; // <div>Value is 0</div>
store.update(v => v++);
// el content is now : <div>Value is 1</div>
```

?> See [Reactivity section](/reactivity) for more informations.

### Directives
Directives are special functions that can be used in templates to control how embedded values are handled by the framework. They allow you to conditionally apply attributes (`when()`), add inline event handlers (`call()`), and handle optional values (`opt()`).
```js
const activeClass: Writable<string | undefined> = writable('active');
const handler = () => console.log('Button clicked');
const store: Writable<boolean> = writable(false);
const buttonEl = node(html`
    <button
        class="${opt(activeClass)}"
        onclick=${call(handler)}
        disabled=${when(store)}
    >
        Click me
    </button>
`) as Element;
```

?> See [Directives section](/directives) for more informations.

### Snippets
Snippets are small reusable pieces of code that can be used in templates to add logic in order to dynamically render html content. They allow you to create reactive loops (`loop()`) and reactive conditional content (`cond()`).
```js
const items: Writable<Array<string>> = writable(['Item 1', 'Item 2', 'Item 3']);
const noItem: Readable<boolean> = derived(items, (values) => values.length === 0);
const listWrapperEl = node(html`
    <div>
        ${cond().if(noItem, html`
            <p>No Item</p>
        `).else(html`
            <ul>
                ${loop(items, item => html`<li>${item}</li>`)}
            </ul>
        `)}
    <div>
`) as Element; // <div><ul><li>Item 1</li><li>Item 2</li><li>Item 3</li></ul></div>
```

?> See [Snippets section](/snippets) for more informations.

### Refs
Refs are a way to reference DOM elements in your templates. They allow you to access the underlying DOM nodes directly, which can be useful for manipulating the DOM or integrating with third-party libraries.
```js
const divEl = node(html`
    <div>
        <input type="text" ref:input-el>
    </div>
`) as Element;

const refObj = getElementRefs(divEl);
const inputEl = refObj['input-el'] as HTMLInputElement; // Access the referenced input element
```

?> See [Refs section](/refs) for more informations.

### Debouncer
srDOM uses a debouncer to optimize DOM updates. This ensures that only the last scheduled DOM operation is executed at the end of the current [microtask](https://developer.mozilla.org/en-US/docs/Web/API/HTML_DOM_API/Microtask_guide), reducing the number of DOM manipulations in case of multiple successive updates.

```js
const store1 = writable('Hello');
const store2 = writable('World');
const el = node(html`<div>${store1} ${store2}</div>`)
console.log(el.textContent); // Outputs: "#{0} #{1}" (internal template placeholders representation)
flush(); // Or wait until the end of the current microtask with `await tick()`
console.log(el.textContent); // Outputs: "Hello World"
// Node content was set only once.
```

?> See [Debouncer section](/debouncer) for more informations.


## Example
```js
import { getElementRefs, writable, node, html } from '@adernnell/simplereactivedom';

let count = -1;
const List = () => html`
    <ul>
        ${[1, 2, 3, 4, 5].map((i) => html`<li>${count + i}</li>`)}
    </ul>
`;

const trigger = writable({});

const contentNode = node(html`
    <div>
        <button ref:triggerbtn>Trigger refresh</button>
        ${node((watch) => (watch(trigger), count++, List()))}
    </div>
`) as Element;

const refs = getElementRefs(contentNode);

refs.triggerbtn.addEventListener('click', () => {
    trigger.set({});
});

document.getElementById('app-content')!.replaceChildren(contentNode);
```

## Exports
```js
import { html, text, node} from '@adernnell/simplereactivedom/template/tag';
import { when, call, opt } from '@adernnell/simplereactivedom/template/directives';
import { getElementRefs, setGlobalSerializer, BindingContext} from '@adernnell/simplereactivedom/binding';
import { loop, cond } from '@adernnell/simplereactivedom/snippets';
import { disposable } from '@adernnell/simplereactivedom/lifecycle';
import { flush } from '@adernnell/simplereactivedom/dom/operation';
import { createDebouncer, tick } from '@adernnell/simplereactivedom/utils/debounce';
import { readable, writable, derived, isReadable, isWritable, readonly, get} from '@adernnell/simplereactivedom/stores';

// Everithing is also exported from the main bundle
import { 
    html, text, node, 
    when, call, opt, 
    getElementRefs, setGlobalSerializer, BindingContext, 
    loop, cond, 
    disposable, 
    flush, 
    createDebouncer, tick, 
    readable, writable, derived, isReadable, isWritable, readonly, get 
} from '@adernnell/simplereactivedom';
```

## Credits
[Svelte stores](https://svelte.dev/docs/svelte/stores) - [MIT](https://github.com/sveltejs/svelte/blob/main/LICENSE.md)
