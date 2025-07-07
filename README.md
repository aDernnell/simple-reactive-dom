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

See the [Quick Start guide](https://adernnell.github.io/simple-reactive-dom/#/quickstart)

Install via npm:

```bash
npm install @dernnell/simplereactivedom
```

Import and use in your project:

```ts
import { html, node, writable, call } from '@dernnell/simplereactivedom';

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
