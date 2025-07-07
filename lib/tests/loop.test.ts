import { describe, it, assert } from 'vitest';
import { isElement, isText } from '../utils/elements';
import { html, HtmlLiterals, node } from '../template/tag';
import { isReadable, writable } from '../stores';
import { loop } from '../snippets/loop';
import { tick } from '../utils/debounce';
import { isDisposable } from '../lifecycle';

describe('loop', () => {
    it('creates a simple reactive loop', async () => {
        const items = writable([1, 2, 3]);

        const nodesStore = loop().each(items, (item) => html`<span>${item}</span>`);

        assert.isTrue(isReadable(nodesStore));

        let updateCounts = 0;
        nodesStore.subscribe((_) => {
            updateCounts++;
        });

        // Initial state
        await tick();
        assert.equal(updateCounts, 1);
        assert.isTrue(Array.isArray(nodesStore.get()));
        let list = nodesStore.get() as Array<Element>;
        assert.equal(list.length, 3);
        assert.isTrue(list.every((el) => isElement(el)));
        assert.equal(list[0].outerHTML, `<span>1</span>`);
        assert.equal(list[1].outerHTML, `<span>2</span>`);
        assert.equal(list[2].outerHTML, `<span>3</span>`);

        // Update items
        items.set([4, 5]);
        await tick();
        assert.equal(updateCounts, 2);
        assert.isTrue(Array.isArray(nodesStore.get()));
        assert.isFalse(nodesStore.get() == list);
        list = nodesStore.get() as Array<Element>;
        assert.equal(list.length, 2);
        assert.equal(list[0].outerHTML, `<span>4</span>`);
        assert.equal(list[1].outerHTML, `<span>5</span>`);

        // Add more items
        items.set([4, 5, 6]);
        await tick();
        assert.equal(updateCounts, 3);
        assert.isTrue(Array.isArray(nodesStore.get()));
        assert.isFalse(nodesStore.get() == list);
        list = nodesStore.get() as Array<Element>;
        assert.equal(list.length, 3);
        assert.equal(list[0].outerHTML, `<span>4</span>`);
        assert.equal(list[1].outerHTML, `<span>5</span>`);
        assert.equal(list[2].outerHTML, `<span>6</span>`);

        // Clear items
        items.set([]);
        await tick();
        assert.equal(updateCounts, 4);
        assert.isTrue(isText(nodesStore.get()));
        assert.isFalse(nodesStore.get() == list);
        const text = nodesStore.get() as Text;
        assert.equal(text.nodeValue, '');

        // Add items again
        items.set([7, 8]);
        await tick();
        assert.equal(updateCounts, 5);
        assert.isTrue(Array.isArray(nodesStore.get()));
        assert.isFalse(nodesStore.get() == list);
        list = nodesStore.get() as Array<Element>;
        assert.isTrue(list.every((el) => isElement(el)));
        assert.equal(list.length, 2);
        assert.equal(list[0].outerHTML, `<span>7</span>`);
        assert.equal(list[1].outerHTML, `<span>8</span>`);

        // Clear items again
        items.set([]);
        await tick();
        assert.equal(updateCounts, 6);
        assert.isTrue(isText(nodesStore.get()));
        assert.isFalse(nodesStore.get() == list);
        assert.isTrue(nodesStore.get() == text);
    });

    it('does not diff collection of primitives without key function', () => {
        const items = writable([1, 2, 3]);

        const nodesStore = loop().each(items, (item) => html`<span>${item}</span>`);

        let updateCounts = 0;
        nodesStore.subscribe((_) => {
            updateCounts++;
        });

        assert.equal(updateCounts, 1);
        assert.isTrue(Array.isArray(nodesStore.get()));
        let list = nodesStore.get() as Array<Element>;
        const firstItem = list[0];

        items.update((coll) => (coll.push(4), coll));
        assert.isTrue(Array.isArray(nodesStore.get()));

        // List is fully rebuilt on update (no diffing for primitive types)
        assert.equal(updateCounts, 2);
        assert.isFalse(nodesStore.get() == list);
        assert.isFalse((nodesStore.get() as Array<Element>)[0] == firstItem);
    });

    it('uses diffing if key function is provided', () => {
        const items = writable([1, 2, 3]);

        const nodesStore = loop().each(
            items,
            (item) => html`<span>${item}</span>`,
            (item) => item.toString() // key
        );

        let updateCounts = 0;
        nodesStore.subscribe((_) => {
            updateCounts++;
        });

        assert.equal(updateCounts, 1);
        assert.isTrue(Array.isArray(nodesStore.get()));
        let list = nodesStore.get() as Array<Element>;
        const firstItem = list[0];

        items.update((coll) => (coll.push(4), coll));
        assert.isTrue(Array.isArray(nodesStore.get()));

        // diffing is used: first Node should be kept, list instance should be the same and no store update should occur
        assert.equal(updateCounts, 1);
        assert.isTrue(nodesStore.get() == list);
        assert.isTrue((nodesStore.get() as Array<Element>)[0] == firstItem);
    });

    it('uses reference as key by default for collection of objects', () => {
        const items = writable([{ id: 1 }, { id: 2 }, { id: 3 }]);

        const nodesStore = loop().each(items, (item) => html`<span>${item.id}</span>`);

        let updateCounts = 0;
        nodesStore.subscribe((_) => {
            updateCounts++;
        });

        assert.equal(updateCounts, 1);
        assert.isTrue(Array.isArray(nodesStore.get()));
        let list = nodesStore.get() as Array<Element>;
        const firstItem = list[0];

        items.update((coll) => (coll.push({ id: 4 }), coll));
        assert.isTrue(Array.isArray(nodesStore.get()));
        assert.equal(updateCounts, 1);
        assert.isTrue(nodesStore.get() == list);
        assert.isTrue((nodesStore.get() as Array<Element>)[0] == firstItem);
    });

    it('accepts html literals or element as content', () => {
        const items = writable([1, 2, 3]);

        const nodesStore1 = loop().each(items, (item) => html`<span>${item}</span>`);
        const nodesStore2 = loop().each(items, (item) => node(html`<span>${item}</span>`) as Element);

        assert.isTrue(Array.isArray(nodesStore1.get()));
        const list1 = nodesStore1.get() as Array<Element>;
        assert.isTrue(Array.isArray(nodesStore2.get()));
        const list2 = nodesStore2.get() as Array<Element>;
        assert.isTrue(list1.every((el, i) => el.outerHTML == list2[i].outerHTML));
    });

    it('can be specified to rerender without diffing', () => {
        const items = writable([{ id: 1 }, { id: 2 }, { id: 3 }]);

        const nodesStore = loop({ useDiffing: false }).each(items, (item) => html`<span>${item.id}</span>`);

        let updateCounts = 0;
        nodesStore.subscribe((_) => {
            updateCounts++;
        });

        assert.equal(updateCounts, 1);
        assert.isTrue(Array.isArray(nodesStore.get()));
        let list = nodesStore.get() as Array<Element>;
        const firstItem = list[0];
        assert.equal(list.length, 3);
        assert.isTrue(list.every((el) => isElement(el)));

        // Update items
        items.update((coll) => (coll.push({ id: 4 }), coll));

        assert.isTrue(Array.isArray(nodesStore.get()));
        assert.equal(updateCounts, 2);
        // Verify that the list and the first item are not the same (full rerender occurred)
        assert.isFalse(nodesStore.get() == list);
        assert.isFalse((nodesStore.get() as Array<Element>)[0] == firstItem);
    });

    it('dispose content stores from literals', async () => {
        const firstItem = { id: 1, value: writable('A') };
        const items = writable([firstItem, { id: 2, value: writable('B') }, { id: 3, value: writable('C') }]);
        const firstLiterals = html`<span>${firstItem.value}</span>`;
        
        const nodesStore = loop().each(items, (item) => item == firstItem ? firstLiterals : html`<span>${item.value}</span>`);

        // Initial state
        await tick();

        assert.isTrue(Array.isArray(nodesStore.get()));
        let list = nodesStore.get() as Array<Element>;
        assert.equal(list.length, 3);
        assert.isTrue(list[0].outerHTML == `<span>A</span>`);
        assert.isTrue(list[1].outerHTML == `<span>B</span>`);
        assert.isTrue(list[2].outerHTML == `<span>C</span>`);
        assert.isTrue(isDisposable(firstLiterals));
        assert.isTrue(firstLiterals.bindings!.length > 0);
        assert.isTrue(firstLiterals.bindings?.every((b) => isDisposable(b)));

        // Remove an item with a reactive value
        items.update((coll) => {
            coll.splice(0, 1);
            return coll;
        });
        await tick();
        assert.equal(list.length, 2);
        assert.isTrue(list[0].outerHTML == `<span>B</span>`);
        assert.isTrue(list[1].outerHTML == `<span>C</span>`);
        assert.isFalse(isDisposable(firstLiterals)); // First literals is disposed
        assert.isTrue(firstLiterals.bindings == undefined);
    });

    it('dispose content stores from elements', async () => {
        const firstItem = { id: 1, value: writable('A') };
        const items = writable([firstItem, { id: 2, value: writable('B') }, { id: 3, value: writable('C') }]);

        let firstLiterals: HtmlLiterals | undefined = undefined;
        const nodesStore = loop().each(items, (item) => {
            const htmlLiterals = html`<span>${item.value}</span>`;
            const spanEl = node(htmlLiterals);
            if (item === firstItem) {
                firstLiterals = htmlLiterals;
            }
            return spanEl as Element;
        });

        // Initial state
        await tick();
        assert.isTrue(Array.isArray(nodesStore.get()));
        let list = nodesStore.get() as Array<Element>;
        assert.equal(list.length, 3);
        assert.isTrue(list[0].outerHTML == `<span>A</span>`);
        assert.isTrue(list[1].outerHTML == `<span>B</span>`);
        assert.isTrue(list[2].outerHTML == `<span>C</span>`);
        assert.isTrue(isDisposable(firstLiterals));
        assert.isTrue(firstLiterals!.bindings!.length > 0);
        assert.isTrue(firstLiterals!.bindings?.every((b) => isDisposable(b)));

        // Remove an item with a reactive value
        items.update((coll) => {
            coll.splice(0, 1);
            return coll;
        });
        await tick();
        assert.equal(list.length, 2);
        assert.isTrue(list[0].outerHTML == `<span>B</span>`);
        assert.isTrue(list[1].outerHTML == `<span>C</span>`);
        assert.isFalse(isDisposable(firstLiterals)); // First literals is disposed
        assert.isTrue(firstLiterals!.bindings == undefined);

    });
});
