import { assert, describe, expect, it, vi } from 'vitest';
import { derived, writable, Readable } from '../../stores';
import { html, node } from '../../template/tag';
import { tick } from '../../utils/debounce';
import { DomUpdateMode } from '../../dom/operation';

describe('node html in watch mode', () => {
    it('watches inside attribute', async () => {
        const count = writable(0);

        // prettier-ignore
        const el1: Element = node((watch) => html`
            <button class="${watch(count) < 10 ? 'count < 10 is true !' : 'count < 10 is false !'}">Test</button>
        `) as Element;

        // prettier-ignore
        const el2: Element = node((watch) => html`
            <button class="count < 10 is ${watch(count) < 10 ? 'true' : 'false'} !">Test</button>
        `) as Element;

        // prettier-ignore
        const el3: Element = node((watch) => html`
            <button class="${'count < 10 is ' + (watch(count) < 10 ? 'true' : 'false') + ' !'}">Test</button>
        `) as Element;

        await tick();
        assert.equal(el1.outerHTML, '<button class="count < 10 is true !">Test</button>');
        assert.equal(el2.outerHTML, '<button class="count < 10 is true !">Test</button>');
        assert.equal(el3.outerHTML, '<button class="count < 10 is true !">Test</button>');

        count.set(20);

        await tick();
        assert.equal(el1.outerHTML, '<button class="count < 10 is false !">Test</button>');
        assert.equal(el2.outerHTML, '<button class="count < 10 is false !">Test</button>');
        assert.equal(el3.outerHTML, '<button class="count < 10 is false !">Test</button>');
    });

    it('watches multiple stores inside attribute', async () => {
        const store1 = writable(5);
        const store2 = writable('hello');

        // prettier-ignore
        const el: Element = node((watch) => html`
            <div class="store1=${watch(store1)} store2=${watch(store2)}"></div>
        `) as Element;

        await tick();
        assert.equal(el.outerHTML, '<div class="store1=5 store2=hello"></div>');

        store1.set(10);
        store2.set('world');

        await tick();
        assert.equal(el.outerHTML, '<div class="store1=10 store2=world"></div>');
    });

    it('allows to specify DOM update mode', async () => {
        const store1 = writable(5);
        const store2 = writable('hello');

        let attributeUpdateCount: { [key: string]: number } = {
            'data-attr1': 0,
            'data-attr2': 0,
        };
        const originalSetAttribute = Element.prototype.setAttribute;
        Element.prototype.setAttribute = function (name: string, value: string) {
            attributeUpdateCount[name]++;
            return originalSetAttribute.call(this, name, value);
        };

        try {
            // prettier-ignore
            node((watch) => html`
                <div data-attr1="store1=${watch(store1)} store2=${watch(store2)}"></div>
            `, { updateDomMode: DomUpdateMode.EAGER });

            // prettier-ignore
            node((watch) => html`
                <div data-attr2="store1=${watch(store1)} store2=${watch(store2)}"></div>
            `, { updateDomMode: DomUpdateMode.BATCHED });

            assert.equal(attributeUpdateCount['data-attr1'], 1);
            assert.equal(attributeUpdateCount['data-attr2'], 0);

            await tick();
            assert.equal(attributeUpdateCount['data-attr1'], 1);
            assert.equal(attributeUpdateCount['data-attr2'], 1);

            store1.set(10);
            store2.set('world');

            assert.equal(attributeUpdateCount['data-attr1'], 1);
            assert.equal(attributeUpdateCount['data-attr2'], 1);

            await tick();

            assert.equal(attributeUpdateCount['data-attr1'], 3);
            assert.equal(attributeUpdateCount['data-attr2'], 2);
        } finally {
            Element.prototype.setAttribute = originalSetAttribute;
        }
    });

    it('allows to watch eagerly (update sync, but no debouncing)', async () => {
        const store1 = writable(5);
        const store2 = writable('hello');

        let attributeUpdateCount: { [key: string]: number } = {
            'data-attr1': 0,
            'data-attr2': 0,
            'data-attr3': 0,
            'data-attr4': 0,
        };
        const originalSetAttribute = Element.prototype.setAttribute;
        Element.prototype.setAttribute = function (name: string, value: string) {
            attributeUpdateCount[name]++;
            return originalSetAttribute.call(this, name, value);
        };

        let processingCount: { [key: string]: number } = {
            'data-attr1': 0,
            'data-attr2': 0,
            'data-attr3': 0,
            'data-attr4': 0,
        };
        const _html = (strings: TemplateStringsArray, ...values: unknown[]) => {
            const key = strings[0].match(/ (data-attr.)=/)?.[1];
            processingCount[key!]++;
            return html(strings, ...values);
        };

        try {
            // prettier-ignore
            node((watch) => _html`
                <div data-attr1="store1=${watch(store1)} store2=${watch(store2)}"></div>
            `, { updateDomMode: DomUpdateMode.EAGER, debounceWatches: false });

            // prettier-ignore
            node((watch) => _html`
                <div data-attr2="store1=${watch(store1)} store2=${watch(store2)}"></div>
            `, { updateDomMode: DomUpdateMode.EAGER, debounceWatches: true });

            // prettier-ignore
            node((watch) => _html`
                <div data-attr3="store1=${watch(store1)} store2=${watch(store2)}"></div>
            `, { updateDomMode: DomUpdateMode.BATCHED, debounceWatches: false  });

            // prettier-ignore
            node((watch) => _html`
                <div data-attr4="store1=${watch(store1)} store2=${watch(store2)}"></div>
            `, { updateDomMode: DomUpdateMode.BATCHED, debounceWatches: true });

            {
                assert.equal(processingCount['data-attr1'], 1);
                assert.equal(processingCount['data-attr2'], 1);
                assert.equal(processingCount['data-attr3'], 1);
                assert.equal(processingCount['data-attr4'], 1);

                assert.equal(attributeUpdateCount['data-attr1'], 1);
                assert.equal(attributeUpdateCount['data-attr2'], 1);
                assert.equal(attributeUpdateCount['data-attr3'], 0);
                assert.equal(attributeUpdateCount['data-attr4'], 0);
            }

            await tick();
            {
                assert.equal(processingCount['data-attr1'], 1);
                assert.equal(processingCount['data-attr2'], 1);
                assert.equal(processingCount['data-attr3'], 1);
                assert.equal(processingCount['data-attr4'], 1);

                assert.equal(attributeUpdateCount['data-attr1'], 1);
                assert.equal(attributeUpdateCount['data-attr2'], 1);
                assert.equal(attributeUpdateCount['data-attr3'], 1);
                assert.equal(attributeUpdateCount['data-attr4'], 1);
            }

            store1.set(10);
            store2.set('world');
            {
                assert.equal(processingCount['data-attr1'], 3);
                assert.equal(processingCount['data-attr2'], 1);
                assert.equal(processingCount['data-attr3'], 3);
                assert.equal(processingCount['data-attr4'], 1);

                assert.equal(attributeUpdateCount['data-attr1'], 3);
                assert.equal(attributeUpdateCount['data-attr2'], 1);
                assert.equal(attributeUpdateCount['data-attr3'], 1);
                assert.equal(attributeUpdateCount['data-attr4'], 1);
            }

            await tick();
            {
                assert.equal(processingCount['data-attr1'], 3);
                assert.equal(processingCount['data-attr2'], 2);
                assert.equal(processingCount['data-attr3'], 3);
                assert.equal(processingCount['data-attr4'], 2);

                assert.equal(attributeUpdateCount['data-attr1'], 3);
                assert.equal(attributeUpdateCount['data-attr2'], 3);
                assert.equal(attributeUpdateCount['data-attr3'], 2);
                assert.equal(attributeUpdateCount['data-attr4'], 2);
            }
        } finally {
            Element.prototype.setAttribute = originalSetAttribute;
        }
    });

    it('mixes watch, store and value in same attribute', async () => {
        const s1 = writable<string | undefined>('s1');
        const s2 = writable('s2');
        const value = 'value';

        // prettier-ignore
        const el1: Element = node((watch) => html`
            <button data-attr="== ${value} ${s2} ${watch(s1) ?? '<undefined>'} ==">Test</button>
        `) as Element;

        await tick();
        assert.equal(el1.outerHTML, '<button data-attr="== value s2 s1 ==">Test</button>');

        s2.set('S2');
        await tick();
        assert.equal(el1.outerHTML, '<button data-attr="== value S2 s1 ==">Test</button>');

        s1.set(undefined);
        await tick();
        assert.equal(el1.outerHTML, '<button data-attr="== value S2 <undefined> ==">Test</button>');
    });

    it('watches inside node content', async () => {
        const count = writable(0);

        // prettier-ignore
        const el: Element = node((watch) => html`
            <div>${watch(count) < 10 ? 'Count is less than 10' : 'Count is 10 or more'}</div>
        `) as Element;

        await tick();
        assert.equal(el.outerHTML, '<div>Count is less than 10</div>');

        count.set(15);

        await tick();
        assert.equal(el.outerHTML, '<div>Count is 10 or more</div>');
    });

    it('watches a mix of value and multiple stores inside node content', async () => {
        const store1 = writable(5);
        const store2 = writable('hello');
        const staticValue = 'Static';

        // prettier-ignore
        const el: Element = node((watch) => html`
            <div>${staticValue} - ${watch(store1)} - ${watch(store2)}</div>
        `) as Element;

        await tick();
        assert.equal(el.outerHTML, '<div>Static - 5 - hello</div>');

        store1.set(10);
        store2.set('world');

        await tick();
        assert.equal(el.outerHTML, '<div>Static - 10 - world</div>');
    });

    it('watches a conditional expression', async () => {
        const store = writable(0);

        // prettier-ignore
        const el: Element = node((watch) => html`
            <div>${watch(store) % 2 === 0 
                ? html`<div class="even">Even</div>` 
                : html`<span class="odd">Odd</span>`
            }</div>
        `) as Element;

        await tick();
        assert.equal(el.outerHTML, '<div><div class="even">Even</div></div>');

        store.set(1);

        await tick();
        assert.equal(el.outerHTML, '<div><span class="odd">Odd</span></div>');

        store.set(2);

        await tick();
        assert.equal(el.outerHTML, '<div><div class="even">Even</div></div>');
    });

    it('disallows dynamic root html literals', async () => {
        const store = writable(0);

        // prettier-ignore
        const el: Element = node((watch) =>
            watch(store) % 2 === 0 
                ? html`<div class="even">Even</div>` 
                : html`<span class="odd">Odd</span>`
        ) as Element;

        await tick();
        assert.equal(el.outerHTML, '<div class="even">Even</div>');

        // Spy on console.error
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        store.set(1);
        await tick();

        expect(errorSpy).toHaveBeenCalled();
        errorSpy.mockRestore();
    });

    it('watches on condition result', async () => {
        const store = writable(0);
        const storeEven = writable(0);
        const storeOdd = writable(0);

        let processingCount = 0;
        const _html = (strings: TemplateStringsArray, ...values: unknown[]) => {
            processingCount++;
            return html(strings, ...values);
        };

        // prettier-ignore
        const el: Element = node((watch) => _html`
            <div>${watch(store) % 2 === 0 
                ? html`<div class="even">${watch(storeEven)}</div>` 
                : html`<div class="odd">${watch(storeOdd)}</div>`
            }</div>
        `) as Element;

        await tick();
        assert.equal(el.outerHTML, '<div><div class="even">0</div></div>');
        assert.equal(processingCount, 1);

        storeOdd.update((n) => n + 1);
        await tick();
        assert.equal(el.outerHTML, '<div><div class="even">0</div></div>');
        assert.equal(processingCount, 1);

        storeEven.update((n) => n + 1);
        await tick();
        assert.equal(el.outerHTML, '<div><div class="even">1</div></div>');
        assert.equal(processingCount, 2);

        store.set(1);
        storeOdd.set(0);
        storeEven.set(0);
        await tick();
        assert.equal(el.outerHTML, '<div><div class="odd">0</div></div>');
        assert.equal(processingCount, 3);

        storeEven.update((n) => n + 1);
        await tick();
        assert.equal(el.outerHTML, '<div><div class="odd">0</div></div>');
        assert.equal(processingCount, 3);

        store.set(2);
        await tick();
        assert.equal(el.outerHTML, '<div><div class="even">1</div></div>');
        assert.equal(processingCount, 4);
    });

    it('watches an array', async () => {
        const store = writable([1, 2, 3]);

        // prettier-ignore
        const el1: Element = node((watch) => html`
            <ul>${watch(store).map((item) => node(html`<li>${item}</li>`))}</ul>
        `) as Element;

        // prettier-ignore
        const el2: Element = node((watch) => html`
            <ul>${watch(store).map((item) => html`<li>${item}</li>`)}</ul>
        `) as Element;

        await tick();
        assert.equal(el1.outerHTML, '<ul><li>1</li><li>2</li><li>3</li></ul>');
        assert.equal(el2.outerHTML, '<ul><li>1</li><li>2</li><li>3</li></ul>');

        store.update((items) => [...items, 4]);

        await tick();
        assert.equal(el1.outerHTML, '<ul><li>1</li><li>2</li><li>3</li><li>4</li></ul>');
    });

    it('watches the root element', async () => {
        const count = writable(0);

        const Ul = (length: number) => html`
            <ul>
                ${Array.from({ length: length }, (_, i) => html`<li>Item ${i + 1}</li>`)}
            </ul>
        `;

        const orphanEl = node((watch) => Ul(watch(count))) as Element;
        const childEl = node((watch) => Ul(watch(count))) as Element;
        const parent = document.createElement('div');
        parent.appendChild(orphanEl);

        await tick();
        assert.notEqual(orphanEl, childEl);
        // prettier-ignore
        assert.equal(
            orphanEl.outerHTML,
            `<ul>
                
            </ul>`
        );
        // prettier-ignore
        assert.equal(
            childEl.outerHTML,
            `<ul>
                
            </ul>`
        );

        count.set(2);
        await tick();
        // prettier-ignore
        assert.equal(
            orphanEl.outerHTML,
            `<ul>
                <li>Item 1</li><li>Item 2</li>
            </ul>`
        );
        // prettier-ignore
        assert.equal(
            childEl.outerHTML,
            `<ul>
                <li>Item 1</li><li>Item 2</li>
            </ul>`
        );
    });

    it('watches a literals with a static readable binding inside it', async () => {
        const store = writable('initial value');
        const readableStore = derived(store, ($store) => `Derived: ${$store}`);
        const watchedStore = writable(false);

        const el = node(
            (watch) => html` <div>${readableStore} - ${watch(watchedStore) ? 'True' : 'False'}</div> `
        ) as Element;
        await tick();

        assert.equal(el.outerHTML, '<div>Derived: initial value - False</div>');
        store.set('new value');
        await tick();
        assert.equal(el.outerHTML, '<div>Derived: new value - False</div>');

        watchedStore.set(true);
        await tick();
        assert.equal(el.outerHTML, '<div>Derived: new value - True</div>');
        store.set('another value');
        await tick();
        assert.equal(el.outerHTML, '<div>Derived: another value - True</div>');
    });

    it('watches a literals with a dynamic readable binding inside it', async () => {
        const store1 = writable('store1 initial');
        const store2 = writable('store2 initial');
        const watchedStore = writable(false);

        let readableStore: Readable<string> | undefined = undefined;
        // On first call, it will derive store1, then switch to derive store2
        const getReadableStore = () =>
            (readableStore = derived(readableStore == undefined ? store1 : store2, ($store) => `Derived: ${$store}`));

        // Add console.warn spy
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const el = node(
            (watch) => html` <div>${getReadableStore()} - ${watch(watchedStore) ? 'True' : 'False'}</div> `
        ) as Element;
        await tick();

        assert.equal(el.outerHTML, '<div>Derived: store1 initial - False</div>');
        store1.set('store1 new');
        await tick();
        assert.equal(el.outerHTML, '<div>Derived: store1 new - False</div>');

        watchedStore.set(true);
        await tick();

        assert.equal(el.outerHTML, '<div>Derived: store2 initial - True</div>');
        store1.set('store1 another');
        await tick();
        assert.equal(el.outerHTML, '<div>Derived: store2 initial - True</div>');
        store2.set('store2 new');
        await tick();
        assert.equal(el.outerHTML, '<div>Derived: store2 new - True</div>');

        // Restore the console.warn spy
        warnSpy.mockRestore();
    });

    it('watches a literals with a static writable binding inside it', async () => {
        const writableStore = writable('initial value');
        const watchedStore = writable(false);

        const el = node(
            (watch) => html` <div>${writableStore} - ${watch(watchedStore) ? 'True' : 'False'}</div> `
        ) as Element;
        await tick();

        assert.equal(el.outerHTML, '<div>initial value - False</div>');
        writableStore.set('new value');
        await tick();
        assert.equal(el.outerHTML, '<div>new value - False</div>');

        watchedStore.set(true);
        await tick();
        assert.equal(el.outerHTML, '<div>new value - True</div>');
        writableStore.set('another value');
        await tick();
        assert.equal(el.outerHTML, '<div>another value - True</div>');
    });

    it('watches a literals with a dynamic writable binding inside it', async () => {
        const store1 = writable('store1 initial');
        const store2 = writable('store2 initial');
        const watchedStore = writable(false);

        let writableStore: Readable<string> | undefined = undefined;
        // On first call, it will use store1, then switch to store2
        const getWritableStore = () => (writableStore = writableStore == undefined ? store1 : store2);

        // Add console.warn spy
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const el = node(
            (watch) => html` <div>${getWritableStore()} - ${watch(watchedStore) ? 'True' : 'False'}</div> `
        ) as Element;
        await tick();

        assert.equal(el.outerHTML, '<div>store1 initial - False</div>');
        store1.set('store1 new');
        await tick();
        assert.equal(el.outerHTML, '<div>store1 new - False</div>');

        watchedStore.set(true);
        await tick();
        expect(warnSpy).toHaveBeenCalledTimes(0);
        assert.equal(el.outerHTML, '<div>store2 initial - True</div>');

        store2.set('store2 new');
        await tick();
        assert.equal(el.outerHTML, '<div>store2 new - True</div>');
    });

    it('watches the same store multiples times', async () => {
        const store = writable('initial value');
        const el = node((watch) => html` <div>${watch(store)} ${watch(store)}</div> `) as Element;
        await tick();

        assert.equal(el.outerHTML, '<div>initial value initial value</div>');
        store.set('new value');
        await tick();
        assert.equal(el.outerHTML, '<div>new value new value</div>');
    });
});
