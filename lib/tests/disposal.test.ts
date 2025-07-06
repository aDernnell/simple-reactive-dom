import { assert, describe, expect, it, vi } from 'vitest';
import { html, HtmlLiterals, node, rawHtml, text } from '../framework/template/tag';
import { Readable, Writable, writable } from '../stores';
import { tick } from '../utils/debounce';
import { rawHtmlToNode } from '../utils';
import { disposable, dispose } from '../framework/lifecycle/disposable';
import { call, cond, getElementRefs, loop, when } from '../framework';

describe('dynamic content disposal', () => {
    it('disposes Element node', async () => {
        const store: Writable<number> = writable(0);
        const el = node(html`<div class="${store}">${store}</div>`) as Element;

        const expected = (i: number) => rawHtmlToNode(rawHtml`<div class="${i}">${i}</div>`) as Element;

        await tick();
        assert.strictEqual(el.outerHTML, expected(0).outerHTML);

        store.set(1);
        await tick();
        assert.strictEqual(el.outerHTML, expected(1).outerHTML);

        dispose(el);

        store.set(2);
        await tick();
        // After disposal, the element should not change anymore
        assert.strictEqual(el.outerHTML, expected(1).outerHTML);
    });

    it('disposes inline event handler', async () => {
        const handler = vi.fn();

        const div = node(html`<div onclick=${call(handler)}>Click me</div>`) as HTMLDivElement;
        const addEventListenerSpy = vi.spyOn(div, 'addEventListener');
        const removeEventListenerSpy = vi.spyOn(div, 'removeEventListener');

        await tick();

        div.click();
        expect(handler).toHaveBeenCalledTimes(1);
        expect(addEventListenerSpy).toHaveBeenCalledWith('click', handler);
        expect(removeEventListenerSpy).not.toHaveBeenCalled();

        handler.mockClear();
        removeEventListenerSpy.mockClear();
        dispose(div);
        
        expect(removeEventListenerSpy).toHaveBeenCalledWith('click', handler);
        div.click();
        expect(handler).not.toHaveBeenCalled();
    });

    it('disposes conditional attribute', async () => {
        const disabledCondition = writable(true);
        const el = node(html`<button disabled=${when(disabledCondition)}></button>`) as Element;
        const expected = (disabled: boolean) => `<button${disabled ? ' disabled=""' : ''}></button>`;
        await tick();
        assert.strictEqual(el.outerHTML, expected(true));
        disabledCondition.set(false);
        await tick();
        assert.strictEqual(el.outerHTML, expected(false));

        dispose(el);

        disabledCondition.set(true);
        await tick();
        // After disposal, the attribute should not change anymore
        assert.strictEqual(el.outerHTML, expected(false));
    });

    it('disposes Text node', async () => {
        const store: Writable<number> = writable(0);
        const textNode = node(text`${store}`) as Text;

        await tick();
        assert.strictEqual(textNode.textContent, '0');
        store.set(1);
        await tick();
        assert.strictEqual(textNode.textContent, '1');
        dispose(textNode);
        store.set(2);
        await tick();
        // After disposal, the text node should not change anymore
        assert.strictEqual(textNode.textContent, '1');
    });

    it('disposes child content on parent disposal', async () => {
        const store: Writable<number> = writable(0);

        const HtmlChild = (store: Readable<number>) => {
            return html`<span>HtmlChild : ${store}</span>`;
        };

        const NodeChild = (store: Readable<number>) => {
            return node(html`<span>NodeChild : ${store}</span>`);
        };

        const HtmlStoreChild = (store: Readable<number>) => {
            return writable(html`<span>HtmlStoreChild : ${store}</span>`);
        };

        const NodeStoreChild = (store: Readable<number>) => {
            return writable(node(html`<span>NodeStoreChild : ${store}</span>`));
        };

        const el = node(html`
            <ul>
                <li>${HtmlChild(store)}</li>
                <li>${NodeChild(store)}</li>
                <li>${HtmlStoreChild(store)}</li>
                <li>${NodeStoreChild(store)}</li>
            </ul>
        `) as Element;

        // prettier-ignore
        const expected = (i: number) => rawHtmlToNode(rawHtml`
            <ul>
                <li><span>HtmlChild : ${i}</span></li>
                <li><span>NodeChild : ${i}</span></li>
                <li><span>HtmlStoreChild : ${i}</span></li>
                <li><span>NodeStoreChild : ${i}</span></li>
            </ul>
        `) as Element;

        await tick();
        assert.strictEqual(el.outerHTML, expected(0).outerHTML);

        store.set(1);
        await tick();
        assert.strictEqual(el.outerHTML, expected(1).outerHTML);

        dispose(el);

        store.set(2);
        await tick();
        // After disposal, the element should not change anymore
        assert.strictEqual(el.outerHTML, expected(1).outerHTML);
    });

    it('disposes content recursivelly', async () => {
        const store: Writable<number> = writable(0);
        const el = node(html`
            <div>
                <span>${store}</span>
                ${node(html`<div>
                    <span>${store}</span>
                    ${node(html`<div>
                        <span>${store}</span>
                    </div>`)}
                </div>`)}
            </div>
        `) as Element;

        // prettier-ignore
        const expected = (i: number) => rawHtmlToNode(rawHtml`
            <div>
                <span>${i}</span>
                <div>
                    <span>${i}</span>
                    <div>
                        <span>${i}</span>
                    </div>
                </div>
            </div>
        `) as Element;

        await tick();
        assert.strictEqual(el.outerHTML, expected(0).outerHTML);

        store.set(1);
        await tick();
        assert.strictEqual(el.outerHTML, expected(1).outerHTML);

        dispose(el);
        store.set(2);
        await tick();
        // After disposal, the element should not change anymore
        assert.strictEqual(el.outerHTML, expected(1).outerHTML);
    });

    it('disposes content with custom disposal', async () => {
        const store: Writable<number> = writable(0);

        const El = () => {
            const _node = node(html`
                <div>
                    <button ref:buttonEl>Increment</button>
                    <span>${store}</span>
                </div>
            `) as Element;
            const boundEls = getElementRefs(_node);
            const incrementHandler = () => {
                store.update((value) => value + 1);
            };
            boundEls.buttonel.addEventListener('click', incrementHandler);
            return disposable(_node, () => {
                boundEls.buttonel.removeEventListener('click', incrementHandler);
            });
        };

        const el = El();
        const expected = (i: number) =>
            rawHtmlToNode(rawHtml`
                <div>
                    <button>Increment</button>
                    <span>${i}</span>
                </div>
            `) as Element;

        await tick();
        assert.strictEqual(el.outerHTML, expected(0).outerHTML);
        const button = el.querySelector('button');
        button?.click();
        await tick();
        assert.strictEqual(el.outerHTML, expected(1).outerHTML);
        store.set(2);
        await tick();
        assert.strictEqual(el.outerHTML, expected(2).outerHTML);
        dispose(el);
        button?.click();
        await tick();
        // After disposal, the element should not change anymore
        assert.strictEqual(el.outerHTML, expected(2).outerHTML);
        store.set(3);
        await tick();
        // After disposal, the element should not change anymore
        assert.strictEqual(el.outerHTML, expected(2).outerHTML);
    });

    it('disposes conditional content', async () => {
        // Setup: a writable condition and two stores for true/false branches
        const condStore = writable(true);
        const trueStore = writable('A');
        const falseStore = writable('B');

        const trueEl = node(html`<span>${trueStore}</span>`) as Element;
        const falseEl = node(html`<span>${falseStore}</span>`) as Element;

        // TODO cond snippet could have an option to dispose non active branches ?
        // in that case the conditional branch would be rebuilt each time the condition changes

        const el = node(html` <div>${cond().if(condStore, trueEl).else(falseEl)}</div>`) as Element;

        const expectedEl = (val: string) => `<div><span>${val}</span></div>`;

        const expectedTrueBranch = (val: string) => `<span>${val}</span>`;
        const expectedFalseBranch = (val: string) => `<span>${val}</span>`;

        await tick();
        assert.strictEqual(el.outerHTML, expectedEl('A'));
        assert.strictEqual(trueEl.outerHTML, expectedTrueBranch('A'));
        assert.strictEqual(falseEl.outerHTML, expectedFalseBranch('B'));

        // Update true branch
        trueStore.set('AA');
        await tick();
        assert.strictEqual(el.outerHTML, expectedEl('AA'));
        assert.strictEqual(trueEl.outerHTML, expectedTrueBranch('AA'));
        assert.strictEqual(falseEl.outerHTML, expectedFalseBranch('B'));

        // Switch to false branch
        condStore.set(false);
        await tick();
        assert.strictEqual(el.outerHTML, expectedEl('B'));
        assert.strictEqual(trueEl.outerHTML, expectedTrueBranch('AA'));
        assert.strictEqual(falseEl.outerHTML, expectedFalseBranch('B'));

        // Update false branch
        falseStore.set('BB');
        await tick();
        assert.strictEqual(el.outerHTML, expectedEl('BB'));
        assert.strictEqual(trueEl.outerHTML, expectedTrueBranch('AA'));
        assert.strictEqual(falseEl.outerHTML, expectedFalseBranch('BB'));

        // Dispose
        dispose(el);

        // Try to update both branches and condition
        trueStore.set('AAA');
        falseStore.set('BBB');
        condStore.set(true);
        await tick();

        // Should remain unchanged after disposal
        assert.strictEqual(el.outerHTML, expectedEl('BB'));
        assert.strictEqual(trueEl.outerHTML, expectedTrueBranch('AA'));
        assert.strictEqual(falseEl.outerHTML, expectedFalseBranch('BB'));
    });

    it('disposes loop content', async () => {
        // Setup: a writable array and loop snippet
        const items = writable([
            { id: 1, store: writable(0) },
            { id: 2, store: writable(0) },
        ]);
        const ul = node(
            html`<ul>
                ${loop().each(items, (item) => html`<li>${item.id} : ${item.store}</li>`)}
            </ul>`
        ) as Element;

        const expected = (arr: number[][]) => `<ul>
                ${arr.map(([id, i]) => `<li>${id} : ${i}</li>`).join('')}
            </ul>`;

        await tick();
        assert.strictEqual(
            ul.outerHTML,
            expected([
                [1, 0],
                [2, 0],
            ])
        );

        // Update first item
        items.update((arr) => {
            arr[0].store.update((value) => value + 1);
            return arr;
        });
        await tick();
        assert.strictEqual(
            ul.outerHTML,
            expected([
                [1, 1],
                [2, 0],
            ])
        );

        // Update second item
        items.update((arr) => {
            arr[1].store.update((value) => value + 1);
            return arr;
        });
        await tick();
        assert.strictEqual(
            ul.outerHTML,
            expected([
                [1, 1],
                [2, 1],
            ])
        );

        // Add a new item
        items.update((arr) => {
            arr.push({ id: 3, store: writable(0) });
            return arr;
        });
        await tick();
        assert.strictEqual(
            ul.outerHTML,
            expected([
                [1, 1],
                [2, 1],
                [3, 0],
            ])
        );

        let removedEl: Element = ul.querySelector('li')!;
        let removedItem: { id: number; store: Writable<number> };
        // Remove the first item
        items.update((arr) => {
            removedItem = arr.splice(0, 1)[0];
            return arr;
        });
        await tick();
        assert.strictEqual(
            ul.outerHTML,
            expected([
                [2, 1],
                [3, 0],
            ])
        );
        // assert the removed el is disposed
        assert.isTrue(removedEl.isConnected === false);
        removedItem!.store.set(2);
        assert.strictEqual(removedEl.outerHTML, '<li>1 : 1</li>');

        // Dispose the ul element
        dispose(ul);
        items.update((arr) => {
            arr.forEach((item) => item.store.set(2));
            return arr;
        });
        await tick();
        // After disposal, the element should not change anymore
        assert.strictEqual(
            ul.outerHTML,
            expected([
                [2, 1],
                [3, 0],
            ])
        );

        // check we cannot add new items after disposal
        items.update((arr) => {
            arr.push({ id: 4, store: writable(0) });
            return arr;
        });
        await tick();
        // After disposal, the element should not change anymore
        assert.strictEqual(
            ul.outerHTML,
            expected([
                [2, 1],
                [3, 0],
            ])
        );

        // check we cannot remove items after disposal
        items.update((arr) => {
            arr.splice(0, 1);
            return arr;
        });
        await tick();
        // After disposal, the element should not change anymore
        assert.strictEqual(
            ul.outerHTML,
            expected([
                [2, 1],
                [3, 0],
            ])
        );
    });

    it('disposes watched conditional content', async () => {
        const condStore = writable(true);
        const trueStore = writable('A');
        const falseStore = writable('B');

        const trueEl = node(html`<span>${trueStore}</span>`) as Element;
        const falseEl = node(html`<span>${falseStore}</span>`) as Element;

        const el = node((watch) => html`<div>${watch(condStore) ? trueEl : falseEl}</div>`) as Element;

        const expectedEl = (val: string) => `<div><span>${val}</span></div>`;
        const expectedTrueBranch = (val: string) => `<span>${val}</span>`;
        const expectedFalseBranch = (val: string) => `<span>${val}</span>`;

        await tick();
        assert.strictEqual(el.outerHTML, expectedEl('A'));
        assert.strictEqual(trueEl.outerHTML, expectedTrueBranch('A'));
        assert.strictEqual(falseEl.outerHTML, expectedFalseBranch('B'));

        // Update true branch
        trueStore.set('AA');
        await tick();
        assert.strictEqual(el.outerHTML, expectedEl('AA'));
        assert.strictEqual(trueEl.outerHTML, expectedTrueBranch('AA'));
        assert.strictEqual(falseEl.outerHTML, expectedFalseBranch('B'));

        // Switch to false branch
        condStore.set(false);
        await tick();
        assert.strictEqual(el.outerHTML, expectedEl('B'));
        assert.strictEqual(trueEl.outerHTML, expectedTrueBranch('AA'));
        assert.strictEqual(falseEl.outerHTML, expectedFalseBranch('B'));

        // Update false branch
        falseStore.set('BB');
        await tick();
        assert.strictEqual(el.outerHTML, expectedEl('BB'));
        assert.strictEqual(trueEl.outerHTML, expectedTrueBranch('AA'));
        assert.strictEqual(falseEl.outerHTML, expectedFalseBranch('BB'));

        // Dispose
        dispose(el);

        // Try to update both branches and condition
        trueStore.set('AAA');
        falseStore.set('BBB');
        condStore.set(true);
        await tick();
        // Should remain unchanged after disposal
        assert.strictEqual(el.outerHTML, expectedEl('BB'));
        assert.strictEqual(trueEl.outerHTML, expectedTrueBranch('AA'));
        assert.strictEqual(falseEl.outerHTML, expectedFalseBranch('BB'));
    });

    it('disposes watched looped content', async () => {
        const items = writable([
            { id: 1, store: writable(0) },
            { id: 2, store: writable(0) },
        ]);
        const el = node(
            (watch) => html`<ul>
                ${watch(items).map((item) => html`<li>${item.id} : ${item.store}</li>`)}
            </ul>`
        ) as Element;

        const expected = (arr: number[][]) => `<ul>
                ${arr.map(([id, i]) => `<li>${id} : ${i}</li>`).join('')}
            </ul>`;

        await tick();
        assert.strictEqual(
            el.outerHTML,
            expected([
                [1, 0],
                [2, 0],
            ])
        );

        // Update first item
        items.update((arr) => {
            arr[0].store.update((value) => value + 1);
            return arr;
        });
        await tick();
        assert.strictEqual(
            el.outerHTML,
            expected([
                [1, 1],
                [2, 0],
            ])
        );

        // Update second item
        items.update((arr) => {
            arr[1].store.update((value) => value + 1);
            return arr;
        });
        await tick();
        assert.strictEqual(
            el.outerHTML,
            expected([
                [1, 1],
                [2, 1],
            ])
        );

        // Add a new item
        items.update((arr) => {
            arr.push({ id: 3, store: writable(0) });
            return arr;
        });
        await tick();
        assert.strictEqual(
            el.outerHTML,
            expected([
                [1, 1],
                [2, 1],
                [3, 0],
            ])
        );

        let removedEl: Element = el.querySelector('li')!;
        let removedItem: { id: number; store: Writable<number> };
        // Remove the first item
        items.update((arr) => {
            removedItem = arr.splice(0, 1)[0];
            return arr;
        });
        await tick();
        assert.strictEqual(
            el.outerHTML,
            expected([
                [2, 1],
                [3, 0],
            ])
        );
        // assert the removed el is disposed
        assert.isTrue(removedEl.isConnected === false);
        removedItem!.store.set(2);
        assert.strictEqual(removedEl.outerHTML, '<li>1 : 1</li>');

        // Dispose the element
        dispose(el);
        items.update((arr) => {
            arr.forEach((item) => item.store.set(2));
            return arr;
        });
        await tick();
        // After disposal, the element should not change anymore
        assert.strictEqual(
            el.outerHTML,
            expected([
                [2, 1],
                [3, 0],
            ])
        );

        // check we cannot add new items after disposal
        items.update((arr) => {
            arr.push({ id: 4, store: writable(0) });
            return arr;
        });
        await tick();
        // After disposal, the element should not change anymore
        assert.strictEqual(
            el.outerHTML,
            expected([
                [2, 1],
                [3, 0],
            ])
        );

        // check we cannot remove items after disposal
        items.update((arr) => {
            arr.splice(0, 1);
            return arr;
        });
        await tick();
        // After disposal, the element should not change anymore
        assert.strictEqual(
            el.outerHTML,
            expected([
                [2, 1],
                [3, 0],
            ])
        );
    });

    it('disposes watched root element', async () => {
        const count = writable(0);

        const Ul = (length: number) => {
            const _html = html`
                <ul>
                    ${Array.from({ length: length }, (_, i) => html`<li>Item ${i + 1}</li>`)}
                </ul>
            `;

            return disposable(
                _html,
                /* @ts-expect-error */
                () => (_html.disposed = true)
            );
        };

        let orpanHtml;
        const orphanEl = node((watch) => (orpanHtml = Ul(watch(count)))) as Element;
        let childHtml;
        const childEl = node((watch) => (childHtml = Ul(watch(count)))) as Element;
        const parent = document.createElement('div');
        parent.appendChild(childEl);

        let watchedHtmlFirst: any | undefined;
        let watchedHtmlSecond: any | undefined;
        const saveHtmlLit = (lit: HtmlLiterals): HtmlLiterals => {
            if (watchedHtmlFirst === undefined) {
                watchedHtmlFirst = lit;
            } else if( watchedHtmlSecond === undefined) {
                watchedHtmlSecond = lit;
            }
            return lit;
        };
        const watchedEl = node((watch) => saveHtmlLit(Ul(watch(count)))) as Element;

        await tick();
        assert.isFalse(orpanHtml!.disposed === true);
        assert.isFalse(childHtml!.disposed === true);
        assert.isFalse(watchedHtmlFirst!.disposed === true);

        dispose(orphanEl);
        assert.isTrue(orpanHtml!.disposed);

        dispose(childEl);
        assert.isTrue(childHtml!.disposed);

        count.update((c) => c + 1);
        await tick();

        assert.isTrue(watchedHtmlFirst!.disposed);
        assert.isFalse(watchedHtmlSecond!.disposed === true);
    });
});
