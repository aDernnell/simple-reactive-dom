[![Coverage Status](https://coveralls.io/repos/github/aDernnell/simple-reactive-dom/badge.svg?branch=main)](https://coveralls.io/github/aDernnell/simple-reactive-dom?branch=main)
[![npm version](https://badge.fury.io/js/%40adernnell%2Fsimplereactivedom.svg)](https://badge.fury.io/js/%40adernnell%2Fsimplereactivedom)
[![GitHub license](https://img.shields.io/github/license/aDernnell/simple-reactive-dom)](https://img.shields.io/github/license/aDernnell/simple-reactive-dom)

# SimpleReactiveDOM

SimpleReactiveDOM is a lightweight, reactive DOM generation library for modern web development. It provides a simple API for binding data, managing state, and building dynamic user interfaces with minimal overhead.
It emphasizes on explicit over implicit and allow you to express your UI in a composible manner in pure JavaScript while being close to html syntax.

## Features

- **Reactive Data Binding**: Automatically update the DOM when your data changes.
- **Stores**: Centralized state management with reactivity.
- **Templating**: Simple, declarative templates for dynamic content.
- **Tiny Footprint**: Designed to be efficient, minimal and to work seamlessly with DOM API.

## Quickstart

Try on [jsFiddle](https://jsfiddle.net/qenbtdsr/latest/)
Try on [CodeSandbox](https://codesandbox.io/p/sandbox/srdom-web-sandbox-9jqgkw)

See the [Quick Start guide](https://adernnell.github.io/simple-reactive-dom/#/quickstart)

Install via npm:

```bash
npm install @adernnell/simplereactivedom
```

Import and use in your project:

```ts
import { html, node, writable, call } from '@adernnell/simplereactivedom';

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
```

## Documentation

See https://adernnell.github.io/simple-reactive-dom/ for detailed documentation.


## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

Credits to the [Svelte](https://svelte.dev/) team for their store implementation, which has been adapted for this library.
