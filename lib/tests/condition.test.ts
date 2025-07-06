import { describe, it, assert, expect } from 'vitest';
import { html, HtmlLiterals, node } from '../framework/template/tag';
import { derived, writable } from '../stores';
import { cond } from '../framework/snippets/condition';

describe('condition', () => {
    it('builds a simple if structure', () => {
        const condition = writable(false);
        const content = html`<span>...</span>`;
        const nodeStore = cond().if(condition, content);

        assert.equal(nodeStore.get().nodeType, 3);
        assert.equal(nodeStore.get().textContent, '');

        condition.set(true);
        assert.equal(nodeStore.get().nodeType, 1);
        expect((nodeStore.get() as Element).outerHTML).toBe(`<span>...</span>`);


        condition.set(false);
        assert.equal(nodeStore.get().nodeType, 3);
        assert.equal(nodeStore.get().textContent, '');
    });

    it('builds a if else structure', () => {
        const condition = writable(false);
        const contentIfTrue = html`<span>1</span>`;
        const contentIfFalse = html`<span>2</span>`;
        const nodeStore = cond().if(condition, contentIfTrue).else(contentIfFalse);

        assert.equal(nodeStore.get().nodeType, 1);
        expect((nodeStore.get() as Element).outerHTML).toBe(`<span>2</span>`);

        condition.set(true);
        assert.equal(nodeStore.get().nodeType, 1);
        expect((nodeStore.get() as Element).outerHTML).toBe(`<span>1</span>`);

        condition.set(false);
        assert.equal(nodeStore.get().nodeType, 1);
        expect((nodeStore.get() as Element).outerHTML).toBe(`<span>2</span>`);
    });

    it('builds a if elseif else structure', () => {
        const conditions = [writable(false), writable(false), writable(false)];
        const contents: HtmlLiterals[] = [
            html`<span>if</span>`,
            html`<span>elseif 1</span>`,
            html`<span>elseif 2</span>`,
            html`<span>else</span>`,
        ];
        // prettier-ignore
        const nodeStore = cond()
            .if(conditions[0], contents[0])
            .elseif(conditions[1], contents[1])
            .elseif(conditions[2], contents[2])
            .else(contents[3]);

        const expected = (i: number) => node(contents[i]) as Element;

        conditions[0].set(false);
        conditions[1].set(false);
        conditions[2].set(false);
        assert.equal(nodeStore.get().nodeType, 1);
        assert.equal((nodeStore.get() as Element).outerHTML, expected(3).outerHTML);

        conditions[0].set(true);
        conditions[1].set(false);
        conditions[2].set(false);
        assert.equal(nodeStore.get().nodeType, 1);
        assert.equal((nodeStore.get() as Element).outerHTML, expected(0).outerHTML);

        conditions[0].set(true);
        conditions[1].set(true);
        conditions[2].set(false);
        assert.equal(nodeStore.get().nodeType, 1);
        assert.equal((nodeStore.get() as Element).outerHTML, expected(0).outerHTML);

        conditions[0].set(false);
        conditions[1].set(true);
        conditions[2].set(true);
        assert.equal(nodeStore.get().nodeType, 1);
        assert.equal((nodeStore.get() as Element).outerHTML, expected(1).outerHTML);

        conditions[0].set(false);
        conditions[1].set(false);
        conditions[2].set(true);
        assert.equal(nodeStore.get().nodeType, 1);
        assert.equal((nodeStore.get() as Element).outerHTML, expected(2).outerHTML);
    });

    it('accepts html literals or element as content', () => {
        const conditions = [writable(false), writable(false)];
        const litSpan = (i: number) => html`<span>${i}</span>`;
        const contents: Array<[HtmlLiterals, Element]> = [
            [litSpan(0), node(litSpan(0)) as Element],
            [litSpan(1), node(litSpan(1)) as Element],
            [litSpan(2), node(litSpan(2)) as Element],
        ];
        // prettier-ignore
        const el1 = cond()
            .if(conditions[0], contents[0][0])
            .elseif(conditions[1], contents[1][1])
            .else(contents[2][0]);

        // prettier-ignore
        const el2 = cond()
            .if(conditions[0], contents[0][1])
            .elseif(conditions[1], contents[1][0])
            .else(contents[2][1]);

        conditions[0].set(false);
        conditions[1].set(false);
        assert.equal(el1.get().nodeType, el2.get().nodeType);
        assert.equal((el1.get() as Element).outerHTML, (el2.get() as Element).outerHTML);

        conditions[0].set(true);
        conditions[1].set(false);
        assert.equal(el1.get().nodeType, el2.get().nodeType);
        assert.equal((el1.get() as Element).outerHTML, (el2.get() as Element).outerHTML);

        conditions[0].set(false);
        conditions[1].set(true);
        assert.equal(el1.get().nodeType, el2.get().nodeType);
        assert.equal((el1.get() as Element).outerHTML, (el2.get() as Element).outerHTML);

        conditions[0].set(true);
        conditions[1].set(true);
        assert.equal(el1.get().nodeType, el2.get().nodeType);
        assert.equal((el1.get() as Element).outerHTML, (el2.get() as Element).outerHTML);
    });

    it('can be nested', () => {
        const conditions = [writable(false), writable(false)];
        const contents: HtmlLiterals[] = [
            html`<span>0</span>`,
            html`<span>1</span>`,
            html`<span>2</span>`,
        ];
        // prettier-ignore
        const nodeStore = cond()
            .if(conditions[0], contents[0])
            .else(cond()
                .if(conditions[1], contents[1])
                .else(contents[2])
            );

        const expected = (i: number) => node(contents[i]);

        conditions[0].set(false);
        conditions[1].set(false);
        assert.equal(nodeStore.get().nodeType, expected(2).nodeType);
        assert.equal(nodeStore.get().textContent, expected(2).textContent);

        conditions[0].set(true);
        conditions[1].set(false);
        assert.equal(nodeStore.get().nodeType, expected(0).nodeType);
        assert.equal(nodeStore.get().textContent, expected(0).textContent);

        conditions[0].set(false);
        conditions[1].set(true);
        assert.equal(nodeStore.get().nodeType, expected(1).nodeType);
        assert.equal(nodeStore.get().textContent, expected(1).textContent);

        conditions[0].set(true);
        conditions[1].set(true);
        assert.equal(nodeStore.get().nodeType, expected(0).nodeType);
        assert.equal(nodeStore.get().textContent, expected(0).textContent);
    });

    it('accepts derived store as condition', () => {
        const storeA = writable(false);
        const storeB = writable(false);
        const condition = derived([storeA, storeB], ([valueA, valueB]) => valueA || valueB);

        const content: HtmlLiterals = html`<span>...</span>`;
        const nodeStore = cond().if(condition, content);

        assert.equal(nodeStore.get().nodeType, 3);
        assert.equal(nodeStore.get().textContent, '');

        storeA.set(true);
        storeB.set(false);
        assert.equal(nodeStore.get().nodeType, 1);
        expect((nodeStore.get() as Element).outerHTML).toBe(`<span>...</span>`);

        storeA.set(false);
        storeB.set(true);
        assert.equal(nodeStore.get().nodeType, 1);
        expect((nodeStore.get() as Element).outerHTML).toBe(`<span>...</span>`);

        storeA.set(true);
        storeB.set(true);
        assert.equal(nodeStore.get().nodeType, 1);
        expect((nodeStore.get() as Element).outerHTML).toBe(`<span>...</span>`);

        storeA.set(false);
        storeB.set(false);
        assert.equal(nodeStore.get().nodeType, 3);
        assert.equal(nodeStore.get().textContent, '');
    });
});