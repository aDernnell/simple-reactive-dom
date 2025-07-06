import { describe, it, assert, expect } from 'vitest';
import { isAttr, isElement, isText, rawHtmlToNode } from '../../utils/elements';
import { rawHtml } from '../../framework/template/tag';
import { bindStates } from '../../framework/binding/states';
import { readable, writable } from '../../stores';
import { DomTargetWrapper } from '../../framework/binding/target';
import { flush } from '../../framework/dom/operation';
import { rebind } from '../../framework/binding/rebind';

describe('binding metadata', () => {
    it('describes a single binding in an attr', () => {
        const el = rawHtmlToNode(rawHtml`<div id="#{id}"></div>`) as Element;
        const store = readable('abc');

        const bindings = bindStates(el, { id: store });
        assert.equal(bindings.length, 1);
        assert.isTrue(bindings[0].store === store);
        const domLink = bindings[0].domLink!;
        assert.isTrue(domLink.store === store);
        assert.isTrue(isAttr(domLink.target));
        expect(domLink.tmpl.strings).toEqual(['']);
        expect(domLink.tmpl.bindingIndices).toEqual([0]);

        const el2 = rawHtmlToNode(rawHtml`<div id="- #{id} -"></div>`) as Element;
        const bindings2 = bindStates(el2, { id: store });
        expect(bindings2[0].domLink!.tmpl.strings).toEqual(['- ', ' -']);
        expect(bindings2[0].domLink!.tmpl.bindingIndices).toEqual([0]);
    });

    it('describes multiples bindings in an attr', () => {
        const el = rawHtmlToNode(rawHtml`<div toto="begin #{s1} #{s2} #{s3} #{s2} end"></div>`) as Element;
        const store1 = readable('abc');
        const store2 = readable('def');
        const store3 = readable('ghi');

        const bindings = bindStates(el, {
            s1: store1,
            s2: store2,
            s3: store3,
        });

        assert.equal(bindings.length, 4);
        assert.isTrue(bindings[0].store === store1);
        assert.isTrue(bindings[1].store === store2);
        assert.isTrue(bindings[2].store === store3);
        assert.isTrue(bindings[3].store === store2);
        assert.notStrictEqual(bindings[1], bindings[3]);
        const domLink = bindings[0].domLink;
        assert.isDefined(domLink);
        assert.strictEqual(bindings[1].domLink, domLink);
        assert.strictEqual(bindings[2].domLink, domLink);
        assert.strictEqual(bindings[3].domLink, domLink);
        assert.notStrictEqual(domLink.store, store1);
        assert.notStrictEqual(domLink.store, store2);
        assert.notStrictEqual(domLink.store, store3);
        assert.isTrue(isAttr(domLink.target));
        expect(domLink.tmpl.strings).toEqual(['begin ', ' ', ' ', ' ', ' end']);
        expect(domLink.tmpl.bindingIndices).toEqual([0, 1, 2, 3]);
    });

    it('describes a single binding in an orphan text node', () => {
        const text = rawHtmlToNode(rawHtml`#{str}`) as Text;
        const store = readable('abc');

        const bindings = bindStates(text, { str: store });
        assert.equal(bindings.length, 1);
        assert.isTrue(bindings[0].store === store);
        const domLink = bindings[0].domLink!;
        assert.isTrue(domLink.store === store);
        assert.isTrue(isText(domLink.target));
        expect(domLink.tmpl.strings).toEqual(['']);
        expect(domLink.tmpl.bindingIndices).toEqual([0]);

        const text2 = rawHtmlToNode(rawHtml`- #{str} -`) as Element;
        const bindings2 = bindStates(text2, { str: store });
        expect(bindings2[0].domLink!.tmpl.strings).toEqual(['- ', ' -']);
        expect(bindings2[0].domLink!.tmpl.bindingIndices).toEqual([0]);
    });

    it('describes multiples bindings in an orphan text node', () => {
        const text = rawHtmlToNode(rawHtml`#{s1} between #{s1} #{s2} #{s3} end`) as Text;
        const store1 = readable('abc');
        const store2 = readable('def');
        const store3 = readable('ghi');

        const bindings = bindStates(text, {
            s1: store1,
            s2: store2,
            s3: store3,
        });

        assert.equal(bindings.length, 4);
        assert.isTrue(bindings[0].store === store1);
        assert.isTrue(bindings[1].store === store1);
        assert.isTrue(bindings[2].store === store2);
        assert.isTrue(bindings[3].store === store3);
        assert.notStrictEqual(bindings[0], bindings[1]);
        const domLink = bindings[0].domLink;
        assert.isDefined(domLink);
        assert.strictEqual(bindings[1].domLink, domLink);
        assert.strictEqual(bindings[2].domLink, domLink);
        assert.strictEqual(bindings[3].domLink, domLink);
        assert.notStrictEqual(domLink.store, store1);
        assert.notStrictEqual(domLink.store, store2);
        assert.notStrictEqual(domLink.store, store3);
        assert.isTrue(isText(domLink.target));
        expect(domLink.tmpl.strings).toEqual(['', ' between ', ' ', ' ', ' end']);
        expect(domLink.tmpl.bindingIndices).toEqual([0, 1, 2, 3]);
    });

    it('describes a single binding in a child text node', () => {
        const el = rawHtmlToNode(rawHtml`<div>#{str}</div>`) as Element;
        const store = readable('abc');

        const bindings = bindStates(el, { str: store });
        assert.equal(bindings.length, 1);
        assert.isTrue(bindings[0].store === store);
        const domLink = bindings[0].domLink!;
        assert.isTrue(domLink.store === store);
        assert.isTrue(isText((domLink.target as DomTargetWrapper).text));
        flush();
        assert.isTrue((domLink.target as DomTargetWrapper).text!.parentNode === el);
        assert.strictEqual(domLink.store, store);
        expect(domLink.tmpl.strings).toEqual(['']);
        expect(domLink.tmpl.bindingIndices).toEqual([0]);

        const el2 = rawHtmlToNode(rawHtml`<div>- #{str} -</div>`) as Element;
        const bindings2 = bindStates(el2, { str: store });
        expect(bindings2[0].domLink!.tmpl.strings).toEqual(['']);
        expect(bindings2[0].domLink!.tmpl.bindingIndices).toEqual([0]);
    });

    it('describes multiples bindings in a child text node', () => {
        const el = rawHtmlToNode(rawHtml`<div>begin #{s1} #{s2} between #{s3} #{s3} end</div>`) as Element;
        const store1 = readable('abc');
        const store2 = readable('def');
        const store3 = readable('ghi');

        const bindings = bindStates(el, {
            s1: store1,
            s2: store2,
            s3: store3,
        });

        assert.equal(bindings.length, 4);
        assert.isTrue(bindings[0].store === store1);
        assert.isTrue(bindings[1].store === store2);
        assert.isTrue(bindings[2].store === store3);
        assert.isTrue(bindings[3].store === store3);
        assert.notStrictEqual(bindings[2], bindings[3]);
        flush();
        for (let i = 0; i < bindings.length; i++) {
            const domLink = bindings[i].domLink!;
            assert.isDefined(domLink);
            assert.isTrue(isText((domLink.target as DomTargetWrapper).text));
            assert.isTrue((domLink.target as DomTargetWrapper).text!.parentNode === el);
            i == 0 && assert.strictEqual(domLink.store, store1);
            i == 1 && assert.strictEqual(domLink.store, store2);
            i == 2 && assert.strictEqual(domLink.store, store3);
            expect(domLink.tmpl.strings).toEqual(['']);
            expect(domLink.tmpl.bindingIndices).toEqual([i]);
        }
        assert.notStrictEqual(bindings[0].domLink, bindings[1].domLink);
        assert.notStrictEqual(bindings[1].domLink, bindings[2].domLink);
        assert.notStrictEqual(bindings[2].domLink, bindings[3].domLink);

        const el2 = rawHtmlToNode(rawHtml`<div>#{textStore}#{elStore}#{arrayStore}</div>`) as Element;
        const textStore = writable(true);
        const elStore = readable(document.createElement('span'));
        const arrayStore = readable([3, 2, 1]);

        const bindings2 = bindStates(el2, {
            textStore,
            elStore,
            arrayStore,
        });

        assert.equal(bindings2.length, 3);
        assert.isTrue(bindings2[0].store === textStore);
        assert.isTrue(bindings2[1].store === elStore);
        assert.isTrue(bindings2[2].store === arrayStore);
        flush();
        for (let i = 0; i < bindings2.length; i++) {
            const domLink = bindings2[i].domLink!;
            assert.isDefined(domLink);
            if (i == 0) {
                assert.isTrue(isText((domLink.target as DomTargetWrapper).text));
                assert.isTrue((domLink.target as DomTargetWrapper).text!.parentNode === el2);
                assert.strictEqual(domLink.store, textStore);
            } else if (i == 1) {
                assert.isTrue(isElement((domLink.target as DomTargetWrapper).el));
                assert.isTrue((domLink.target as DomTargetWrapper).el!.parentNode === el2);
                assert.strictEqual(domLink.store, elStore);
            } else {
                assert.isTrue(Array.isArray((domLink.target as DomTargetWrapper).array));
                assert.isTrue((domLink.target as DomTargetWrapper).array!.every((node) => node.parentElement === el2));
                assert.strictEqual(domLink.store, arrayStore);
            }
            expect(domLink.tmpl.strings).toEqual(['']);
            expect(domLink.tmpl.bindingIndices).toEqual([i]);
        }
        assert.notStrictEqual(bindings2[0].domLink, bindings2[1].domLink);
        assert.notStrictEqual(bindings2[1].domLink, bindings2[2].domLink);
    });

    it('describes binding indices', () => {
        const orphanTextNode = rawHtmlToNode(rawHtml`#{txt1} #{txt2} #{txt3} #{txt4}`) as Text;

        const el = rawHtmlToNode(rawHtml`
            <div id="#{id}" class="#{classNameA} #{classNameB}">
                <span 
                    onclick="/*#{eventHandler}*/"
                    disabled="#{disabled}"
                >
                    #{text1} #{orphanTextNode} #{text2}
                </span>
            </div>
        `) as Element;

        // Préparer les stores pour chaque binding
        const stores = {
            id: readable('id'),
            classNameA: readable('a'),
            classNameB: readable('b'),
            eventHandler: readable(() => {}),
            disabled: readable(true),
            text1: readable('t1'),
            text2: readable('t2'),
            txt1: readable('ot1'),
            txt2: readable('ot2'),
            txt3: readable('ot3'),
            txt4: readable('ot4'),
            orphanTextNode: readable(orphanTextNode),
        };

        // Bind sur l'orphanTextNode séparément
        const orphanBindings = bindStates(orphanTextNode, {
            txt1: stores.txt1,
            txt2: stores.txt2,
            txt3: stores.txt3,
            txt4: stores.txt4,
        });
        expect(orphanBindings.length).toBe(4);
        for (let i = 0; i < orphanBindings.length - 1; i++) {
            expect(orphanBindings[i].domLink).toBe(orphanBindings[i + 1].domLink);
        }
        expect(orphanBindings[0].domLink!.tmpl.bindingIndices).toEqual([0, 1, 2, 3]);

        // Bind sur l'élément principal
        const bindings = bindStates(el, {
            id: stores.id,
            classNameA: stores.classNameA,
            classNameB: stores.classNameB,
            eventHandler: stores.eventHandler,
            disabled: stores.disabled,
            text1: stores.text1,
            text2: stores.text2,
            orphanTextNode: stores.orphanTextNode,
        });

        // On s'attend à 8 bindings
        expect(bindings.length).toBe(8);

        // Vérifier les indices pour chaque type de binding
        // id
        expect(bindings[0].domLink!.tmpl.bindingIndices).toEqual([0]);
        // classNameA et classNameB (dans le même attribut)
        expect(bindings[1].domLink).toBe(bindings[2].domLink);
        expect(bindings[1].domLink!.tmpl.bindingIndices).toEqual([1, 2]);
        // eventHandler
        expect(bindings[3].domLink!.tmpl.bindingIndices).toEqual([3]);
        // disabled
        expect(bindings[4].domLink!.tmpl.bindingIndices).toEqual([4]);
        // text1, orphanTextNode et text2
        expect(bindings[5].domLink!.tmpl.bindingIndices).toEqual([5]);
        expect(bindings[6].domLink!.tmpl.bindingIndices).toEqual([6]);
        expect(bindings[7].domLink!.tmpl.bindingIndices).toEqual([7]);
    });
});
