Quick Start
===========

There are two ways to get started with SimpleReactiveDOM:
 * **CDN Bundle**: Use the library directly in your HTML file without any build tools.
 * **ES Module**: Use the library as an ES module in your JS/TS project with npm.

## CDN Bundle

You can use the srDOM library directly in your HTML file via a CDN. This is the quickest way to get started without any build tools.

The framework is bundled in a single file in IIFE format:
https://cdn.jsdelivr.net/npm/@adernnell/simplereactivedom/dist/bundle.iife.js

For production use, it is advised to specify the version to avoid breaking changes:
https://cdn.jsdelivr.net/npm/@adernnell/simplereactivedom@1.0.4/dist/bundle.iife.js


Include the script in your HTML and use the `srdom` global variable:

```html
<!DOCTYPE html>
<html lang="en">
    <head>
        <meta charset="utf-8" />
        <script type="text/javascript" src="https://cdn.jsdelivr.net/npm/@adernnell/simplereactivedom/dist/bundle.iife.js"></script>
    </head>

    <body>
        <div id="app-content"></div>
    </body>
    
    <script>
        const { html, node, writable, call } = srdom;

        const username = writable('World');
        const contentNode = node(html`
            <div>
                <input 
                    type="text" 
                    value="${username}" 
                    oninput=${call((e) => username.set(e.target.value))}
                />
                <span>Hello ${username} !</span>
            </div>
        `);

        document.getElementById('app-content').replaceChildren(contentNode);
    </script>
</html>
```

?> Try on [jsFiddle](https://jsfiddle.net/qenbtdsr/latest/)


## ES Module

You can also use the ES module version of srDOM in your project. This is the recommended way for modern JavaScript applications using typescript and module bundlers with tree shaking capabilities.

Install via npm:

```bash
npm install @dernnell/simplereactivedom
```

Import and use in your project:

```js
import { writable, type Writable, html, node, call } from '@dernnell/simplereactivedom';

let count = 0;
const List = () => {
    const divLiterals = html`
        <div>
            <p>List start at: ${count + 1}</p>
            <ul>
                ${[1, 2, 3, 4, 5].map((i) => html`<li>${count + i}</li>`)}
            </ul>
        </div>
    `;
    count++;
    return divLiterals;
} as HtmlDivElement;

const trigger: Writable<object> = writable({});

const contentNode = node(html`
    <div>
        <button onclick=${call(() => trigger.set({}))}>Trigger refresh</button>
        ${node((watch) => (watch(trigger), List()))}
    </div>
`);

document.getElementById('app-content').replaceChildren(contentNode);
```
