import { describe, it, assert } from 'vitest';
import { isElement, isText, rawHtmlToNode } from '../../utils/elements';
import { html, HtmlLiterals, rawHtml, text } from '../../framework/template/tag';
import { BindingContext, bindStates, setGlobalSerializer } from '../../framework/binding/states';
import { derived, readable, Unsubscriber, writable } from '../../stores';
import { tick } from '../../utils/debounce';
import { DomUpdateMode, flush } from '../../framework/dom/operation';
import { dispose } from '../../framework';

describe('binding states', () => {
    it('binds single state in text node', async () => {
        const el = rawHtmlToNode(rawHtml`<div>#{str}</div>`) as Element;
        const store = writable('abc');

        bindStates(el, { str: store });
        await tick();
        assert.equal(el.innerHTML, 'abc');

        store.update((str) => `${str}123`);
        await tick();
        assert.equal(el.innerHTML, 'abc123');
    });

    it('binds multiple states in text node', async () => {
        const el = rawHtmlToNode(rawHtml`<div>#{str1} #{str2}</div>`) as Element;
        const store1 = writable('abc');
        const store2 = writable('def');

        bindStates(el, { str1: store1, str2: store2 });
        await tick();
        assert.equal(el.innerHTML, 'abc def');

        store1.update((str) => `${str}123`);
        await tick();
        assert.equal(el.innerHTML, 'abc123 def');

        store1.set('a-b-c');
        store2.set('d-e-f');
        await tick();
        assert.equal(el.innerHTML, 'a-b-c d-e-f');
    });

    it('binds single state in attr', async () => {
        const el = rawHtmlToNode(rawHtml`<div class="#{str}">some text content</div>`) as Element;
        const store = writable('abc');

        bindStates(el, { str: store });
        await tick();
        assert.equal(el.attributes.getNamedItem('class')?.value, 'abc');

        store.update((str) => `${str}123`);
        await tick();
        assert.equal(el.attributes.getNamedItem('class')?.value, 'abc123');
    });

    it('binds multiple states in attr', async () => {
        const el = rawHtmlToNode(rawHtml`<div class="#{str1} #{str2}">some text content</div>`) as Element;
        const store1 = writable('abc');
        const store2 = writable('def');

        let attributeUpdateCount = 0;
        const originalSetAttribute = Element.prototype.setAttribute;
        Element.prototype.setAttribute = function (name: string, value: string) {
            attributeUpdateCount++;
            return originalSetAttribute.call(this, name, value);
        };

        try {
            bindStates(el, { str1: store1, str2: store2 });
            await tick();
            assert.equal(el.attributes.getNamedItem('class')?.value, 'abc def');
            assert.equal(attributeUpdateCount, 1);

            store2.set('456');
            await tick();
            assert.equal(el.attributes.getNamedItem('class')?.value, 'abc 456');
            assert.equal(attributeUpdateCount, 2);

            store1.update((str) => `%${str}%`);
            store2.update((str) => `%${str}%`);
            await tick();
            assert.deepEqual(Array.from(el.classList), ['%abc%', '%456%']);
            assert.equal(attributeUpdateCount, 3); // class update is debounced in 'batched' mode (default) !
        } finally {
            Element.prototype.setAttribute = originalSetAttribute;
        }
    });

    it('binds states in every attrs and text nodes recursivelly', async () => {
        // prettier-ignore
        const el = rawHtmlToNode(rawHtml`
            <div class="my-class #{cls1} my-other-class #{cls2} my-final-class" style="width: #{width}">
                dynamic values in class are: #{cls1} #{cls2}
                <div id="#{id}" title="assertion: #{txt} == #{txt} !">
                    child text content for ##{id} element
                    <span tabindex="#{tabindex}">
                        <ul data-c1="id#{id}" data-c2="#{id}id" data-c3="id#{id}id">
                            <li>--#{cls1}</li>
                            <li>#{cls2}--</li>
                        </ul>
                    </span>
                </div>
            </div>
        `) as Element;

        const cls1 = readable('class1');
        const cls2 = readable('class2');
        const states = {
            cls1,
            cls2,
            width: readable('10px'),
            txt: derived([cls1, cls2], ([$cls1, $cls2]) => `${$cls1}+${$cls2}`),
            id: readable('myid'),
            tabindex: readable('-1'),
        };

        bindStates(el, states);

        // prettier-ignore
        const expected = rawHtmlToNode(rawHtml`
            <div class="my-class class1 my-other-class class2 my-final-class" style="width: 10px">
                dynamic values in class are: class1 class2
                <div id="myid" title="assertion: class1+class2 == class1+class2 !">
                    child text content for #myid element
                    <span tabindex="-1">
                        <ul data-c1="idmyid" data-c2="myidid" data-c3="idmyidid">
                            <li>--class1</li>
                            <li>class2--</li>
                        </ul>
                    </span>
                </div>
            </div>
        `) as Element;

        await tick();
        // Attention, l'indentation doit être identique pour que la comparaison fonctionne
        assert.strictEqual(el.outerHTML, expected.outerHTML);
    });

    it('allows whitespaces in state placeholders', async () => {
        // prettier-ignore
        const el = rawHtmlToNode(rawHtml`<div>#{ str1} #{str2 } #{ str3 } #{   str4 }</div>`) as Element;
        const states = {
            str1: readable('1'),
            str2: readable('2'),
            str3: readable('3'),
            str4: readable('4'),
        };

        bindStates(el, states);
        await tick();
        assert.equal(el.innerHTML, '1 2 3 4');
    });

    it('binds primitive types', async () => {
        const el = rawHtmlToNode(rawHtml`<div>#{num} #{bool} #{str} #{bigint}</div>`) as Element;
        const num = writable(123);
        const bool = writable(true);
        const bigint = writable(BigInt(1234567891011));
        const str = writable('abc');

        const expected = [
            { checkType: isText, value: '123' },
            { checkType: isText, value: ' ' },
            { checkType: isText, value: 'true' },
            { checkType: isText, value: ' ' },
            { checkType: isText, value: 'abc' },
            { checkType: isText, value: ' ' },
            { checkType: isText, value: '1234567891011' },
        ];

        bindStates(el, { num, bool, str, bigint });
        await tick();
        assert.equal(el.innerHTML, '123 true abc 1234567891011');
        assert.equal(el.childNodes.length, 7);
        assert.isTrue(
            Array.from(el.childNodes).every(
                (node, i) => expected[i].checkType(node) && expected[i].value == node.textContent
            )
        );

        num.set(456), (expected[0].value = '456');
        bool.set(false), (expected[2].value = 'false');
        str.set('def'), (expected[4].value = 'def');
        bigint.update((bi) => 10000n * bi), (expected[6].value = '12345678910110000');
        await tick();
        assert.equal(el.innerHTML, '456 false def 12345678910110000');
        assert.equal(el.childNodes.length, 7);
        assert.isTrue(
            Array.from(el.childNodes).every(
                (node, i) => expected[i].checkType(node) && expected[i].value == node.textContent
            )
        );
    });

    it('binds Node type', async () => {
        const elStore = writable<Element>(rawHtmlToNode(rawHtml`<div>Toto</div>`) as Element);
        const textStore = writable<Text>(rawHtmlToNode(rawHtml`Toto`) as Text);
        const htmlElStore = writable<HtmlLiterals>(html`<div>Titi</div>`);
        const htmlTextStore = writable<HtmlLiterals>(text`Titi`);

        const el = rawHtmlToNode(
            rawHtml`<div>#{elStore} #{textStore} #{htmlElStore} #{htmlTextStore}</div>`
        ) as Element;

        bindStates(el, { elStore, textStore, htmlElStore, htmlTextStore });
        await tick();
        assert.equal(el.outerHTML, '<div><div>Toto</div> Toto <div>Titi</div> Titi</div>');
        assert.equal(el.childNodes.length, 7);
        assert.isTrue(isElement(el.childNodes[0])),
            assert.equal((el.childNodes[0] as Element).outerHTML, '<div>Toto</div>');
        assert.isTrue(isText(el.childNodes[1])), assert.equal(el.childNodes[1].textContent, ' ');
        assert.isTrue(isText(el.childNodes[2])), assert.equal(el.childNodes[2].textContent, 'Toto');
        assert.isTrue(isText(el.childNodes[3])), assert.equal(el.childNodes[3].textContent, ' ');
        assert.isTrue(isElement(el.childNodes[4])),
            assert.equal((el.childNodes[4] as Element).outerHTML, '<div>Titi</div>');
        assert.isTrue(isText(el.childNodes[5])), assert.equal(el.childNodes[5].textContent, ' ');
        assert.isTrue(isText(el.childNodes[6])), assert.equal(el.childNodes[6].textContent, 'Titi');

        elStore.update((el) => ((el.textContent = 'tOTO'), el)); // voir @note
        textStore.update((text) => ((text.textContent = 'tOTO'), text)); // voir @note
        htmlElStore.set(html`<div>tITI</div>`);
        htmlTextStore.set(text`tITI`);

        await tick();
        assert.equal(el.outerHTML, '<div><div>tOTO</div> tOTO <div>tITI</div> tITI</div>');
        assert.equal(el.childNodes.length, 7);
        assert.isTrue(isElement(el.childNodes[0])),
            assert.equal((el.childNodes[0] as Element).outerHTML, '<div>tOTO</div>');
        assert.isTrue(isText(el.childNodes[1])), assert.equal(el.childNodes[1].textContent, ' ');
        assert.isTrue(isText(el.childNodes[2])), assert.equal(el.childNodes[2].textContent, 'tOTO');
        assert.isTrue(isText(el.childNodes[3])), assert.equal(el.childNodes[3].textContent, ' ');
        assert.isTrue(isElement(el.childNodes[4])),
            assert.equal((el.childNodes[4] as Element).outerHTML, '<div>tITI</div>');
        assert.isTrue(isText(el.childNodes[5])), assert.equal(el.childNodes[5].textContent, ' ');
        assert.isTrue(isText(el.childNodes[6])), assert.equal(el.childNodes[6].textContent, 'tITI');

        // @note :
        // Il n'est pas nécessaire de maj le store dans le cas où le noeud reste le même.
        // Mise à jour synchrone du contenu textuel du noeud par l'api DOM directement, le mécanisme de binding n'intervient pas.
        elStore.get().textContent = 't0t0';
        textStore.get().textContent = 't0t0';

        assert.equal(el.outerHTML, '<div><div>t0t0</div> t0t0 <div>tITI</div> tITI</div>');
    });

    it('binds Array type', async () => {
        const array = writable([1, 2, 3]);
        const arrElStore = derived(array, (arr) =>
            arr.map((item) => rawHtmlToNode(rawHtml`<li>${item}</li>`) as Element)
        );
        const arrTextStore = derived(array, (arr) => arr.map((item) => rawHtmlToNode(rawHtml`${item}`) as Element));
        const arrHtmlElStore = derived(array, (arr) => arr.map((item) => html`<li>${item}</li>`));
        const arrHtmlTextStore = derived(array, (arr) => arr.map((item) => text`${item}`));
        const arrayObjStore = derived(array, (arr) => arr.map((item) => ({ v: item })));

        const el0 = rawHtmlToNode(rawHtml`<ul>#{array}</ul>`) as Element;
        bindStates(el0, { array });

        const el1 = rawHtmlToNode(rawHtml`<ul>#{arrElStore}</ul>`) as Element;
        bindStates(el1, { arrElStore });

        const el2 = rawHtmlToNode(rawHtml`<ul>#{arrTextStore}</ul>`) as Element;
        bindStates(el2, { arrTextStore });

        const el3 = rawHtmlToNode(rawHtml`<ul>#{arrHtmlElStore}</ul>`) as Element;
        bindStates(el3, { arrHtmlElStore });

        const el4 = rawHtmlToNode(rawHtml`<ul>#{arrHtmlTextStore}</ul>`) as Element;
        bindStates(el4, { arrHtmlTextStore });

        const el5 = rawHtmlToNode(rawHtml`<ul>#{arrayObjStore}</ul>`) as Element;
        bindStates(el5, { arrayObjStore });

        await tick();
        assert.equal(el0.outerHTML, '<ul>123</ul>');
        assert.isTrue(el0.childNodes.length == 3 && Array.from(el0.childNodes).every((child) => isText(child)));

        assert.equal(el1.outerHTML, '<ul><li>1</li><li>2</li><li>3</li></ul>');
        assert.isTrue(el1.childNodes.length == 3 && Array.from(el1.childNodes).every((child) => isElement(child)));

        assert.equal(el2.outerHTML, '<ul>123</ul>');
        assert.isTrue(el2.childNodes.length == 3 && Array.from(el2.childNodes).every((child) => isText(child)));

        assert.equal(el3.outerHTML, '<ul><li>1</li><li>2</li><li>3</li></ul>');
        assert.isTrue(el3.childNodes.length == 3 && Array.from(el3.childNodes).every((child) => isElement(child)));

        assert.equal(el4.outerHTML, '<ul>123</ul>');
        assert.isTrue(el4.childNodes.length == 3 && Array.from(el4.childNodes).every((child) => isText(child)));

        assert.equal(el5.outerHTML, '<ul>[object][object][object]</ul>');
        assert.isTrue(el5.childNodes.length == 3 && Array.from(el5.childNodes).every((child) => isText(child)));

        array.set([]);

        await tick();
        assert.equal(el0.outerHTML, '<ul></ul>');
        assert.isTrue(el0.childNodes.length == 1 && isText(el0.childNodes[0]));
        assert.equal(el1.outerHTML, '<ul></ul>');
        assert.isTrue(el1.childNodes.length == 1 && isText(el1.childNodes[0]));
        assert.equal(el2.outerHTML, '<ul></ul>');
        assert.isTrue(el2.childNodes.length == 1 && isText(el2.childNodes[0]));
        assert.equal(el3.outerHTML, '<ul></ul>');
        assert.isTrue(el3.childNodes.length == 1 && isText(el3.childNodes[0]));
        assert.equal(el4.outerHTML, '<ul></ul>');
        assert.isTrue(el4.childNodes.length == 1 && isText(el4.childNodes[0]));
        assert.equal(el5.outerHTML, '<ul></ul>');
        assert.isTrue(el5.childNodes.length == 1 && isText(el5.childNodes[0]));

        array.update((arr) => (arr.push(6, 5), arr));

        await tick();
        assert.equal(el0.outerHTML, '<ul>65</ul>');
        assert.isTrue(el0.childNodes.length == 2 && Array.from(el0.childNodes).every((child) => isText(child)));

        assert.equal(el1.outerHTML, '<ul><li>6</li><li>5</li></ul>');
        assert.isTrue(el1.childNodes.length == 2 && Array.from(el1.childNodes).every((child) => isElement(child)));

        assert.equal(el2.outerHTML, '<ul>65</ul>');
        assert.isTrue(el2.childNodes.length == 2 && Array.from(el2.childNodes).every((child) => isText(child)));

        assert.equal(el3.outerHTML, '<ul><li>6</li><li>5</li></ul>');
        assert.isTrue(el3.childNodes.length == 2 && Array.from(el3.childNodes).every((child) => isElement(child)));

        assert.equal(el4.outerHTML, '<ul>65</ul>');
        assert.isTrue(el4.childNodes.length == 2 && Array.from(el4.childNodes).every((child) => isText(child)));

        assert.equal(el5.outerHTML, '<ul>[object][object]</ul>');
        assert.isTrue(el5.childNodes.length == 2 && Array.from(el5.childNodes).every((child) => isText(child)));
    });

    it('binds Symbol type', () => {
        const symbolState = writable(Symbol.for('toto'));

        const el = rawHtmlToNode(rawHtml`<div>#{symbolState}</div>`) as Element;

        bindStates(el, { symbolState });

        flush();
        assert.equal(el.innerHTML, '[symbol]');
    });

    it('binds function type', () => {
        const fnState = writable(() => undefined);

        const el = rawHtmlToNode(rawHtml`<div>#{fnState}</div>`) as Element;

        bindStates(el, { fnState });

        flush();
        assert.equal(el.innerHTML, '[function]');
    });

    it('binds objects', async () => {
        const el = rawHtmlToNode(rawHtml`<div>#{obj}</div>`) as Element;
        const obj = writable({ toto: 'value' });

        bindStates(el, { obj });
        await tick();
        assert.equal(el.innerHTML, '[object]');

        obj.set({ toto: 'anotherValue' });
        await tick();
        assert.equal(el.innerHTML, '[object]');
    });

    it('binds objects with custom serializer', async () => {
        const el = rawHtmlToNode(rawHtml`<div>#{obj}</div>`) as Element;
        const obj = writable({ toto: 'value' });

        bindStates(
            el,
            { obj },
            {
                serializer: (value) => JSON.stringify(value),
            }
        );
        await tick();
        assert.equal(el.textContent, '{"toto":"value"}');

        obj.set({ toto: 'anotherValue' });
        await tick();
        assert.equal(el.textContent, '{"toto":"anotherValue"}');
    });

    it('allows custom state serializer', async () => {
        const el = rawHtmlToNode(rawHtml`<div>#{num} #{bool}</div>`) as Element;
        const num = writable(123);
        const bool = writable(true);

        setGlobalSerializer((value) => (typeof value === 'boolean' ? (value ? 'Vrai' : 'Faux') : value));

        bindStates(
            el,
            { num, bool },
            {
                serializer: (value) => (typeof value === 'number' ? value.toFixed(2) : value),
            }
        );
        await tick();
        assert.equal(el.innerHTML, '123.00 Vrai');

        num.set(456);
        bool.update((b) => !b);
        await tick();
        assert.equal(el.innerHTML, '456.00 Faux');

        setGlobalSerializer(undefined);
    });

    it('overrides global serializer with local one', async () => {
        const el1 = rawHtmlToNode(rawHtml`<div>#{num}</div>`) as Element;
        const el2 = rawHtmlToNode(rawHtml`<div>#{num}</div>`) as Element;
        const num = writable(123);

        setGlobalSerializer((value) => (typeof value === 'number' ? value.toFixed(2) : value));

        bindStates(
            el1,
            { num },
            {
                serializer: (value) => (typeof value === 'number' ? value.toFixed(4) : value),
            }
        );
        await tick();
        assert.equal(el1.innerHTML, '123.0000');

        bindStates(el2, { num });
        await tick();
        assert.equal(el2.innerHTML, '123.00');

        setGlobalSerializer(undefined);
    });

    it('allows removing global serializer', async () => {
        const el = rawHtmlToNode(rawHtml`<div>#{bool}</div>`) as Element;
        const bool = writable(true);

        setGlobalSerializer((value) => (typeof value === 'boolean' ? (value ? 'Vrai' : 'Faux') : value));

        bindStates(el, { bool });
        await tick();
        assert.equal(el.innerHTML, 'Vrai');

        setGlobalSerializer(undefined);

        bool.update((b) => !b);
        await tick();
        assert.equal(el.innerHTML, 'false');
    });

    it('allows binding multiple times', async () => {
        const el = rawHtmlToNode(rawHtml`<div>#{bool} #{str}</div>`) as Element;
        const bool = writable(true);
        const str1 = writable('abc');
        const str2 = writable('xyz');

        const firstBindings = bindStates(
            el,
            { bool, str: str1 },
            {
                serializer: (value) => (typeof value === 'boolean' ? (value ? 'Vrai' : 'Faux') : value),
            }
        );
        await tick();
        assert.equal(el.innerHTML, 'Vrai abc');

        const secondBindings = bindStates(el, { bool, str: str2 });
        bool.update((b) => !b);
        str1.update((str) => str + '++');
        await tick();
        assert.equal(el.innerHTML, 'Faux abc++'); // premier binding toujours actif !

        firstBindings.forEach(dispose);
        bool.update((b) => !b);
        str1.set('abc');
        str2.update((str) => str + '--');
        await tick();
        assert.equal(el.innerHTML, 'Faux abc++'); // premier binding plus actif, mais second binding non actif car pas de template lors du bind

        secondBindings.forEach(dispose);
        el.innerHTML = el.innerHTML + ' #{str} #{bool}';
        const thirdBindings = bindStates(el, { bool, str: str2 });
        await tick();
        assert.equal(el.innerHTML, 'Faux abc++ xyz-- true');

        bool.update((b) => !b);
        str2.set('xyz');
        await tick();
        assert.equal(el.innerHTML, 'Faux abc++ xyz false');

        thirdBindings.forEach(dispose);
    });

    it('is incompatible with manual update on text content after binding', async () => {
        const el = rawHtmlToNode(rawHtml`<div>#{str}</div>`) as Element;
        const store = writable('abc');

        bindStates(el, { str: store });
        await tick();
        assert.equal(el.innerHTML, 'abc');

        // le contenu textuel du noeud Text est mis à jour manuellement
        el.childNodes[0].textContent = el.childNodes[0].textContent + 'def';
        assert.equal(el.innerHTML, 'abcdef');

        // la mise à jour du store écrase la modification manuelle
        store.set('ghi');
        await tick();
        assert.equal(el.innerHTML, 'ghi');

        el.innerHTML = el.innerHTML + 'jkl';
        assert.equal(el.innerHTML, 'ghijkl');

        // Le noeud Text est remplacé, le binding ne fonctionne plus !
        store.set('mno');
        await tick();
        assert.equal(el.innerHTML, 'ghijkl');
    });

    it('is incompatible with manual update on binded element', async () => {
        const elStore = writable<Element>(rawHtmlToNode(rawHtml`<div>1</div>`) as Element);
        const htmlElStore = writable<HtmlLiterals>(html`<div>2</div>`);

        const el = rawHtmlToNode(rawHtml`<div>#{elStore}#{htmlElStore}</div>`) as Element;

        bindStates(el, { elStore, htmlElStore });
        await tick();
        assert.equal(el.outerHTML, '<div><div>1</div><div>2</div></div>');

        el.childNodes[0].textContent = el.childNodes[0].textContent + 'm';
        el.childNodes[1].textContent = el.childNodes[1].textContent + 'm';
        assert.equal(el.outerHTML, '<div><div>1m</div><div>2m</div></div>');

        // Equivaut à une modification manuelle car les noeuds ne sont pas remplacés
        elStore.update((el) => ((el.textContent = '3'), el));
        htmlElStore.update((htmlLiterals) => ((htmlLiterals.node!.textContent = '4'), htmlLiterals));
        // La modification est synchrone car appliqué via l'API DOM directement, l'update des stores est inutile dans ce cas
        assert.equal(el.outerHTML, '<div><div>3</div><div>4</div></div>');
        await tick();
        assert.equal(el.outerHTML, '<div><div>3</div><div>4</div></div>');

        const firstChild = document.createElement('div');
        firstChild.textContent = '33';
        el.childNodes[0].replaceWith(firstChild);
        const secondChild = document.createElement('div');
        secondChild.textContent = '44';
        el.childNodes[1].replaceWith(secondChild);
        assert.equal(el.outerHTML, '<div><div>33</div><div>44</div></div>');

        // Les bindings ne fonctionnent plus car les noeuds on été remplacés
        elStore.set(rawHtmlToNode(rawHtml`<div>11</div>`) as Element);
        htmlElStore.set(html`<div>22</div>`);

        await tick();
        assert.equal(el.outerHTML, '<div><div>33</div><div>44</div></div>');
    });

    it('is incompatible with manual update on attr after binding', async () => {
        const el = rawHtmlToNode(rawHtml`<div class="#{str}">...</div>`) as Element;
        const store = writable('abc');

        bindStates(el, { str: store });
        await tick();
        assert.equal(el.attributes.getNamedItem('class')?.value, 'abc');

        el.classList.add('myclass');
        assert.equal(el.attributes.getNamedItem('class')?.value, 'abc myclass');

        store.set('def');
        await tick();
        assert.equal(el.attributes.getNamedItem('class')?.value, 'def');
    });

    it('prevents XSS by default by escaping html in textually binded values', async () => {
        const el = rawHtmlToNode(rawHtml`<div>#{xss}</div>`) as Element;
        const xss = writable(`<img src="x" onerror="alert('XSS Attack')">`);

        bindStates(el, { xss });
        await tick();
        assert.equal(el.innerHTML, '&lt;img src="x" onerror="alert(\'XSS Attack\')"&gt;');
    });

    it('allows different serialization forms depending on context', async () => {
        const el = rawHtmlToNode(rawHtml`<div attr="#{obj}">#{obj}</div>`) as Element;
        const text = rawHtmlToNode(rawHtml`#{obj}`) as Text;
        const obj = writable<{ [key: string]: string }>({ toto: 'value' });

        bindStates(
            el,
            { obj },
            {
                serializer: (value, context) => {
                    if (context == BindingContext.ATTR_VALUE) {
                        return `${Object.values(value)[0]}-${context}`;
                    } else {
                        return JSON.stringify({ ...value, context });
                    }
                },
            }
        );
        bindStates(
            text,
            { obj },
            {
                serializer: (value, context) => {
                    return JSON.stringify({ ...value, context });
                },
            }
        );
        await tick();

        assert.equal(el.getAttribute('attr'), 'value-0');
        assert.equal(el.textContent, '{"toto":"value","context":1}');
        assert.equal(text.textContent, '{"toto":"value","context":2}');

        obj.set({ tata: 'anotherValue' });
        await tick();
        assert.equal(el.getAttribute('attr'), 'anotherValue-0');
        assert.equal(el.textContent, '{"tata":"anotherValue","context":1}');
        assert.equal(text.textContent, '{"tata":"anotherValue","context":2}');
    });

    it('allows different serialization forms depending on binding key', async () => {
        const el = rawHtmlToNode(rawHtml`<div attr="#{obj} #{1}">#{obj} #{2} #{3}</div>`) as Element;
        const obj = writable({ toto: 'value' });

        bindStates(
            el,
            { obj, '1': readable('Un'), '2': readable('Deux'), 3: readable('Trois') },
            {
                serializer: (value, context, key) => {
                    return `${key}-${context}-${value}`;
                },
            }
        );
        await tick();

        assert.equal(
            el.outerHTML,
            '<div attr="obj-0-[object Object] 1-0-Un">obj-1-[object Object] 2-1-Deux 3-1-Trois</div>'
        );
    });

    it('debounces attr updates by default', async () => {
        const el = rawHtmlToNode(rawHtml`<div class="#{str1} #{str2}">some text content</div>`) as Element;
        const store1 = writable('abc');
        const store2 = writable('def');

        let attributeUpdateCount = 0;
        const originalSetAttribute = Element.prototype.setAttribute;
        Element.prototype.setAttribute = function (name: string, value: string) {
            attributeUpdateCount++;
            return originalSetAttribute.call(this, name, value);
        };

        try {
            bindStates(el, { str1: store1, str2: store2 });
            await tick();
            assert.equal(el.attributes.getNamedItem('class')?.value, 'abc def');
            assert.equal(attributeUpdateCount, 1);

            store2.set('456');
            await tick();
            assert.equal(el.attributes.getNamedItem('class')?.value, 'abc 456');
            assert.equal(attributeUpdateCount, 2);

            store1.update((str) => `%${str}%`);
            store2.update((str) => `%${str}%`);
            await tick();
            assert.deepEqual(Array.from(el.classList), ['%abc%', '%456%']);
            assert.equal(attributeUpdateCount, 3);
        } finally {
            Element.prototype.setAttribute = originalSetAttribute;
        }
    });

    it('debounces orphan Text node updates by default', async () => {
        let el = rawHtmlToNode(rawHtml`<div>#{str1} #{str2}</div>`) as Element;
        const store1 = writable('abc');
        const store2 = writable('def');

        let countElSetContent = 0;
        el = new Proxy(el, {
            set(target, prop, newValue, receiver) {
                prop == 'textContent' && countElSetContent++;
                return Reflect.set(target, prop, newValue, receiver);
            },
        });

        bindStates(el, { str1: store1, str2: store2 });
        await tick();
        assert.equal(el.innerHTML, 'abc def');
        // 0 car les mises à jour se font unitairement sur les noeuds Text enfants (el n'est pas un noeud text orphelin)
        assert.equal(countElSetContent, 0);

        let text = rawHtmlToNode(rawHtml`#{str1} #{str2}`) as Text;

        let countTextSetContent = 0;
        text = new Proxy(text, {
            set(target, prop, newValue, receiver) {
                prop == 'textContent' && countTextSetContent++;
                return Reflect.set(target, prop, newValue, receiver);
            },
        });

        bindStates(text, { str1: store1, str2: store2 });
        await tick();
        assert.equal(text.textContent, 'abc def');
        // 1 car noeud text orphelin avec update mode batched
        assert.equal(countTextSetContent, 1);

        let text2 = rawHtmlToNode(rawHtml`#{str1} #{str2}`) as Text;

        let countText2SetContent = 0;
        text2 = new Proxy(text2, {
            set(target, prop, newValue, receiver) {
                prop == 'textContent' && countText2SetContent++;
                return Reflect.set(target, prop, newValue, receiver);
            },
        });

        bindStates(text, { str1: store1, str2: store2 }, { updateDomMode: DomUpdateMode.EAGER });
        assert.equal(text.textContent, 'abc def');
        // 2 car noeud text orphelin avec update mode eager
        assert.equal(countTextSetContent, 1);
    });

    it('allows to switch DOM update mode', () => {
        const el1 = rawHtmlToNode(rawHtml`<div>#{str}</div>`) as Element;
        const store1 = writable('abc');

        bindStates(el1, { str: store1 }, { updateDomMode: DomUpdateMode.BATCHED }); // default mode
        assert.equal(el1.innerHTML, '#{str}');

        store1.update((str) => `${str}123`);
        assert.equal(el1.innerHTML, '#{str}');

        flush(); // equivalent synchrone de await tick();
        assert.equal(el1.innerHTML, 'abc123');

        const el2 = rawHtmlToNode(rawHtml`<div>#{str}</div>`) as Element;
        const store2 = writable('abc');

        bindStates(el2, { str: store2 }, { updateDomMode: DomUpdateMode.EAGER });
        assert.equal(el2.innerHTML, 'abc');

        store2.update((str) => `${str}123`);
        assert.equal(el2.innerHTML, 'abc123');
    });

    it('Allows to bind textual states on an orphan Text node', async () => {
        const textNode = rawHtmlToNode(rawHtml`-- #{num} #{bool} #{str} #{bigint} --`) as Text;
        const num = writable(123);
        const bool = writable(true);
        const bigint = writable(BigInt(1234567891011));
        const str = writable('abc');

        bindStates(textNode, { num, bool, str, bigint });
        await tick();
        assert.equal(textNode.textContent, '-- 123 true abc 1234567891011 --');
    });

    it('Fails at binding Node states on an orphan Text node', async () => {
        const htmlElStore = writable(html`<div>Toto</div>`);
        const htmlTextStore = writable(text`Toto`);
        const nodeStore = writable(rawHtmlToNode(rawHtml`<div>Toto</div>`));
        // TODO tester les listes aussi
        const textNode = rawHtmlToNode(rawHtml`-- #{htmlElStore} #{htmlTextStore} #{nodeStore} --`) as Text;
        bindStates(textNode, { htmlElStore, htmlTextStore, nodeStore });

        await tick();
        assert.equal(textNode.nodeValue, '-- [object] [object] [object] --');
    });
});
