import { assert, describe, expect, it, vi } from 'vitest';
import { derived, writable, Readable } from '../../stores';
import { html, node, dynNode } from '../../template/tag';
import { tick } from '../../utils/debounce';
import { disposable, dispose, disposeRec, isDisposable } from '../../lifecycle';

describe('dynamic node html', () => {
    it('switches root template with ternary', async () => {
        const store = writable(true);

        const dyn = dynNode((watch) => (watch(store) ? html`<div class="a">A</div>` : html`<span class="b">B</span>`));

        let el: Node | undefined;
        const unsub = dyn.subscribe((n) => (el = n));

        await tick();
        assert.ok(el instanceof HTMLElement);
        assert.equal((el as Element).outerHTML, '<div class="a">A</div>');

        store.set(false);
        await tick();
        assert.ok(el instanceof HTMLElement);
        assert.equal((el as Element).outerHTML, '<span class="b">B</span>');

        store.set(true);
        await tick();
        assert.ok(el instanceof HTMLElement);
        assert.equal((el as Element).outerHTML, '<div class="a">A</div>');

        unsub();
    });

    it('switches root template with if', async () => {
        const store = writable(0);

        const dyn = dynNode((watch) => {
            const v = watch(store);
            if (v === 0) return html`<div>Zero</div>`;
            if (v === 1) return html`<span>One</span>`;
            return html`<p>${v}</p>`;
        });

        let el: Node | undefined;
        const unsub = dyn.subscribe((n) => (el = n));

        await tick();
        assert.equal((el as Element).outerHTML, '<div>Zero</div>');

        store.set(1);
        await tick();
        assert.equal((el as Element).outerHTML, '<span>One</span>');

        store.set(42);
        await tick();
        assert.equal((el as Element).outerHTML, '<p>42</p>');

        unsub();
    });

    it('disposes previous node on update', async () => {
        const store = writable(true);

        const dyn = dynNode((watch) => (watch(store) ? html`<div class="a">A</div>` : html`<span class="b">B</span>`));

        let el: Node | undefined;
        const unsub = dyn.subscribe((n) => (el = n));

        await tick();
        const nodeA = el as Element;
        assert.isTrue(isDisposable(nodeA));

        store.set(false);
        await tick();
        const nodeB = el as Element;
        assert.isFalse(isDisposable(nodeA));
        assert.isTrue(isDisposable(nodeB));

        store.set(true);
        await tick();
        assert.isFalse(isDisposable(nodeB));

        unsub();
    });

    // TODO to move to disposable tests ?
    it('stops watching on dispose', async () => {
        const store = writable(true);

        const dyn = dynNode((watch) => (watch(store) ? html`<div class="a">A</div>` : html`<span class="b">B</span>`));

        let el: Node | undefined;
        const unsub = dyn.subscribe((n) => (el = n));

        await tick();
        assert.ok(el instanceof HTMLElement);
        assert.equal((el as Element).outerHTML, '<div class="a">A</div>');

        const nodeA = el as Element;
        assert.isTrue(isDisposable(nodeA));
        disposeRec(dyn);
        assert.isFalse(isDisposable(nodeA));

        store.set(false);
        await tick();
        assert.ok(el instanceof HTMLElement);
        assert.equal((el as Element).outerHTML, '<div class="a">A</div>');

        unsub();
    });

    it('is disposed when binding is removed', async () => {
        const store = writable(true);
        let dynNodeDisposed = false;
        let branchADisposed = false;

        const el = node(
            html`<div>
                ${disposable(
                    dynNode((watch) =>
                        watch(store)
                            ? disposable(html`<div class="a">A</div>`, () => (branchADisposed = true))
                            : html`<span class="b">B</span>`
                    ),
                    () => (dynNodeDisposed = true)
                )}
            </div>`
        ) as HTMLDivElement;

        await tick();
        dispose(el);
        assert.isTrue(dynNodeDisposed);
        assert.isTrue(branchADisposed);
    });

    // TODO déplacer les tests associés à dispose ?
    // TODO ajouter les mêmes tests que pour node watch ?
});
