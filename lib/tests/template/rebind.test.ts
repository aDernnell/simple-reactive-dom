import { assert, describe, expect, it } from 'vitest';
import { html, node } from '../../framework';
import { readable } from '../../stores';
import { rebind } from '../../framework/binding/rebind';

describe('rebind', () => {
    it('Replaces the needed bindings in the literals', () => {
        const store = readable('abc');
        const contentStore1 = readable('first content');
        const contentStore2 = readable('second content');
        const lit1 = html`<div id="${store}">${contentStore1}</div>`;
        const el = node(lit1) as Element;

        const bindings = lit1.bindings!;
        assert.equal(bindings.length, 2);
        const [firstBinding0, firstBinding1] = bindings;
        assert.isTrue(firstBinding0.store === store);
        assert.isTrue(firstBinding1.store === contentStore1);
        const firstDomLink0 = firstBinding0.domLink!;
        const firstDomLink1 = firstBinding1.domLink!;
        assert.isTrue(firstDomLink0.store === store);
        assert.isTrue(firstDomLink1.store === contentStore1);

        const lit2 = html`<div id="${store}">${contentStore2}</div>`;

        rebind(lit1, lit2);

        assert.equal(bindings.length, 2);
        const [secondBinding0, secondBinding1] = bindings;
        assert.isTrue(secondBinding0.store === store);
        assert.isTrue(secondBinding1.store === contentStore2);
        const secondDomLink0 = secondBinding0.domLink!;
        const secondDomLink1 = secondBinding1.domLink!;
        assert.isTrue(secondDomLink0.store === store);
        assert.isTrue(secondDomLink1.store === contentStore2);

        assert.isTrue(firstBinding0 === secondBinding0);
        assert.isTrue(firstBinding1 !== secondBinding1);

        assert.isTrue(firstDomLink0 === secondDomLink0);
        assert.isTrue(firstDomLink1 !== secondDomLink1);
    });

    it('Set correct indices in new template', () => {
        const store = readable('abc');
        const contentStore1 = readable('first content');
        const contentStore2 = readable('second content');
        const lit1 = html`<div id="${store}">${contentStore1}</div>`;
        const el = node(lit1) as Element;

        const lit2 = html`<div id="${store}">${contentStore2}</div>`;

        rebind(lit1, lit2);

        const bindings = lit1.bindings!;
        expect(bindings[0].domLink!.tmpl.bindingIndices).toEqual([0]);
        expect(bindings[1].domLink!.tmpl.bindingIndices).toEqual([1]);
    });
});
