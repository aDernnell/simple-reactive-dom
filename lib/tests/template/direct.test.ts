import { assert, describe, expect, it } from 'vitest';
import { html, HtmlLiterals, node, text } from '../../template/tag';
import { derived, writable } from '../../stores';
import { isText, rawHtmlToNode } from '../../utils';
import { cond, loop } from '../../snippets';
import { tick } from '../../utils/debounce';
import { DomUpdateMode, flush } from '../../dom/operation';

describe('node html in direct mode', () => {
    it('binds primitive types', async () => {
        const cls = 'ui-button';
        const count = 42;
        const isActive = true;
        const bigNumber = BigInt(9007199254740991);

        // prettier-ignore
        const el = node(html`
            <button class="${cls}" 
                    data-count="${count}" 
                    data-active="${isActive}" 
                    data-big="${bigNumber}">
                == ${cls} - ${count} - ${isActive} - ${bigNumber} ==
            </button>
        `) as Element;

        await tick();
        expect(el.outerHTML).toBe(
            `<button class="ui-button" data-count="42" data-active="true" data-big="9007199254740991">
                == ui-button - 42 - true - 9007199254740991 ==
            </button>`
        );
    });

    it('binds readable stores of primitive types', async () => {
        const cls = writable('ui-button');
        const count = writable(42);
        const isActive = writable(true);
        const bigNumber = writable(BigInt(9007199254740991));

        const updateCounts = {
            class: 0,
            'data-count': 0,
            'data-active': 0,
            'data-big': 0,
        };

        // prettier-ignore
        const el = node(html`
            <button class="${cls}" 
                    data-count="${count}" 
                    data-active="${isActive}" 
                    data-big="${bigNumber}">
                == ${cls} - ${count} - ${isActive} - ${bigNumber} ==
            </button>
        `) as Element;

        await tick();
        expect(el.outerHTML).toBe(
            `<button class="ui-button" data-count="42" data-active="true" data-big="9007199254740991">
                == ui-button - 42 - true - 9007199254740991 ==
            </button>`
        );

        cls.set('new-class');
        count.set(100);
        isActive.set(false);
        bigNumber.set(BigInt(123456789));

        await tick();
        expect(el.outerHTML).toBe(
            `<button class="new-class" data-count="100" data-active="false" data-big="123456789">
                == new-class - 100 - false - 123456789 ==
            </button>`
        );
    });

    it('binds null and undefined values', async () => {
        const isActive = undefined;
        const bigNumber = null;

        // prettier-ignore
        const el = node(html`
            <button data-active="${isActive}" data-big="${bigNumber}">
                == ${isActive} - ${bigNumber} ==
            </button>
        `) as Element;

        await tick();
        expect(el.outerHTML).toBe(
            `<button data-active="undefined" data-big="null">
                == undefined - null ==
            </button>`
        );
    });

    it('binds readable stores of null and undefined', async () => {
        const isActive = writable<undefined | null>(undefined);
        const bigNumber = writable<undefined | null>(null);

        // prettier-ignore
        const el = node(html`
            <button data-active="${isActive}" data-big="${bigNumber}">
                == ${isActive} - ${bigNumber} ==
            </button>
        `) as Element;

        await tick();
        expect(el.outerHTML).toBe(
            `<button data-active="undefined" data-big="null">
                == undefined - null ==
            </button>`
        );

        isActive.set(null);
        bigNumber.set(undefined);

        await tick();
        expect(el.outerHTML).toBe(
            `<button data-active="null" data-big="undefined">
                == null - undefined ==
            </button>`
        );
    });

    it('allows to specify how null and undefined values are serialized', async () => {
        const isActive = undefined;
        const bigNumber = null;
        const isActiveStore = writable<undefined | null>(undefined);
        const bigNumberStore = writable<undefined | null>(null);

        const _node = (literals: HtmlLiterals) =>
            node(literals, {
                serializer: (value) => (value === undefined || value === null ? '' : value),
            });

        // prettier-ignore
        const el = _node(html`
            <button data-active="${isActive}" data-big="${bigNumber}">
                == ${isActive} - ${bigNumber} ==
            </button>
        `) as Element;
        // prettier-ignore
        const el2 = _node(html`
            <button data-active="${isActiveStore}" data-big="${bigNumberStore}">
                == ${isActiveStore} - ${bigNumberStore} ==
            </button>
        `) as Element;

        await tick();
        expect(el.outerHTML).toBe(
            `<button data-active="" data-big="">
                ==  -  ==
            </button>`
        );
        expect(el2.outerHTML).toBe(
            `<button data-active="" data-big="">
                ==  -  ==
            </button>`
        );
    });

    it('escapes HTML special chars for textual node bindings', async () => {
        const script = "<script>alert('XSS')</script>";
        const scriptStore = writable(script);
        const attrVal = '/*<&>*/javascript:alert("Hello");';
        const attrValStore = writable(attrVal);
        const el = node(html`<span data-test="${attrVal}">${script}</span>`) as Element;
        const el2 = node(html`<span data-test="${attrValStore}">${scriptStore}</span>`) as Element;

        // TODO comprendre comment doivent être encodés les attributs pour éviter les attaques XSS (OWASP ESAPI ?) ?
        // Pour le moment les attributs ne sont pas encodés, c'est .outerHtml qui fait que '&' se retrouve encodé

        await tick();
        expect(el.getAttribute('data-test')).toBe(attrVal);
        expect(el2.getAttribute('data-test')).toBe(attrVal);

        expect(el.outerHTML).toBe(
            '<span data-test="/*<&amp;>*/javascript:alert(&quot;Hello&quot;);">&lt;script&gt;alert(\'XSS\')&lt;/script&gt;</span>'
        );
        expect(el2.outerHTML).toBe(
            '<span data-test="/*<&amp;>*/javascript:alert(&quot;Hello&quot;);">&lt;script&gt;alert(\'XSS\')&lt;/script&gt;</span>'
        );

        scriptStore.update((script) => script.replace('alert', 'console.log'));

        await tick();
        expect(el2.outerHTML).toBe(
            '<span data-test="/*<&amp;>*/javascript:alert(&quot;Hello&quot;);">&lt;script&gt;console.log(\'XSS\')&lt;/script&gt;</span>'
        );
    });

    it('allows to bind html literals', async () => {
        // prettier-ignore
        const scriptHtml = html`<script>alert('XSS')</script>`;
        // prettier-ignore
        const scriptHtmlStore = writable(html`<script>alert('XSS')</script>`);

        const el = node(html`<span>${scriptHtml}</span>`) as Element;
        const el2 = node(html`<span>${scriptHtmlStore}</span>`) as Element;

        await tick();
        expect(el.outerHTML).toBe("<span><script>alert('XSS')</script></span>");
        expect(el2.outerHTML).toBe("<span><script>alert('XSS')</script></span>");

        // prettier-ignore
        scriptHtmlStore.set(html`<script>console.log('XSS')</script>`);

        await tick();
        expect(el2.outerHTML).toBe("<span><script>console.log('XSS')</script></span>");
    });

    it('allows to bind element', async () => {
        const scriptStr = '<script>alert("XSS")</script>';
        const scriptEl = rawHtmlToNode(scriptStr);
        const scriptElStore = writable(rawHtmlToNode(scriptStr));

        const el1 = node(html`<span>${scriptStr}</span>`) as Element;
        const el2 = node(html`<span>${scriptEl}</span>`) as Element;
        const el3 = node(html`<span>${scriptElStore}</span>`) as Element;

        await tick();
        expect(el1.outerHTML).toBe('<span>&lt;script&gt;alert("XSS")&lt;/script&gt;</span>');
        expect(el2.outerHTML).toBe('<span><script>alert("XSS")</script></span>');
        expect(el3.outerHTML).toBe('<span><script>alert("XSS")</script></span>');

        scriptElStore.update((scriptEl) => {
            scriptEl.textContent = 'console.log("XSS")';
            return scriptEl;
        });

        await tick();
        expect(el3.outerHTML).toBe('<span><script>console.log("XSS")</script></span>');

        const span = document.createElement('span');
        span.textContent = 'Hello, world!';

        // prettier-ignore
        const el = node(html`
            <section>
                ${'<span>Hello, world !</span>'}
                ${span}
            </section>
        `) as Element;

        await tick();
        // prettier-ignore
        expect(el.outerHTML).toBe(`
            <section>
                &lt;span&gt;Hello, world !&lt;/span&gt;
                <span>Hello, world!</span>
            </section>
        `.trim());
    });

    it('handles nullish elements as is', async () => {
        const span = document.createElement('span');
        span.textContent = 'Hello, world!';
        const spanStore1 = writable<HTMLSpanElement | null | undefined>(null);
        const spanStore2 = writable<HTMLSpanElement | null | undefined>(span);
        const spanStore3 = writable<HTMLSpanElement | null | undefined>(undefined);

        // prettier-ignore
        const el = node(html`
            <section>
                ${spanStore1}
                ${spanStore2}
                ${spanStore3}
            </section>
        `) as Element;

        await tick();
        // prettier-ignore
        expect(el.outerHTML).toBe(`
            <section>
                null
                <span>Hello, world!</span>
                undefined
            </section>
        `.trim());

        spanStore2.set(null);
        await tick();
        expect(el.outerHTML).toBe(
            `
            <section>
                null
                null
                undefined
            </section>
        `.trim()
        );

        spanStore2.set(
            (() => {
                const otherSpan = document.createElement('span');
                otherSpan.textContent = 'Hello, other span!';
                return otherSpan;
            })()
        );

        await tick();
        // prettier-ignore
        expect(el.outerHTML).toBe(`
            <section>
                null
                <span>Hello, other span!</span>
                undefined
            </section>
        `.trim());

        spanStore2.set(undefined);

        await tick();
        // prettier-ignore
        expect(el.outerHTML).toBe(`
            <section>
                null
                undefined
                undefined
            </section>
        `.trim()
        );

        spanStore2.set(span);

        await tick();
        // prettier-ignore
        expect(el.outerHTML).toBe(`
            <section>
                null
                <span>Hello, world!</span>
                undefined
            </section>
        `.trim());

        spanStore1.set(
            (() => {
                const otherSpan = document.createElement('span');
                otherSpan.textContent = 'Hello, span 1!';
                return otherSpan;
            })()
        );
        spanStore2.update((span) => (span && (span.textContent = 'Hello, span 2!'), span));
        spanStore3.set(
            (() => {
                const otherSpan = document.createElement('span');
                otherSpan.textContent = 'Hello, span 3!';
                return otherSpan;
            })()
        );

        await tick();
        // prettier-ignore
        expect(el.outerHTML).toBe(`
            <section>
                <span>Hello, span 1!</span>
                <span>Hello, span 2!</span>
                <span>Hello, span 3!</span>
            </section>
        `.trim());
    });

    it('deduplicates node instances', async () => {
        const span = document.createElement('span');
        span.textContent = 'Hello, world!';
        const spanStore1 = writable<HTMLSpanElement | undefined>(span);
        const spanStore2 = writable<HTMLSpanElement | undefined>(undefined);

        // prettier-ignore
        const el1 = node(html`
            <section>
                ${span}
                ${span}
                ${span.cloneNode(true)}
            </section>
        `) as Element;

        await tick();
        // prettier-ignore
        expect(el1.outerHTML).toBe(`
            <section>
                
                <span>Hello, world!</span>
                <span>Hello, world!</span>
            </section>
        `.trim());

        // prettier-ignore
        const el2 = node(html`
            <section>
                ${spanStore1}
                ${spanStore2}
            </section>
        `) as Element;

        await tick();
        // prettier-ignore
        expect(el2.outerHTML).toBe(`
            <section>
                <span>Hello, world!</span>
                undefined
            </section>
        `.trim());

        // These lines should be reversed to work as expected
        spanStore2.set(span); // spanStore1 still holds span so span get rendered twice here
        spanStore1.set(undefined);

        await tick();
        // prettier-ignore
        expect(el2.outerHTML).toBe(`
            <section>
                
                undefined
            </section>
        `.trim());
    });

    it('allows conditional nodes and attributes', async () => {
        const condText = writable(true);
        const condClass = derived(condText, (b) => (b ? 'ifTrue' : 'ifFalse'));

        // prettier-ignore
        const el = node(html`
            <button class="${condClass} test">
                ${cond()
                    .if(condText, node(html`
                        <span>C'est la vérité !</span>
                    `))
                    .else(node(html`
                        <span>C'est un mensonge !</span>
                    `))
                }
            </button>
        `) as Element;

        await tick();
        // prettier-ignore
        expect(el.outerHTML).toBe(`
            <button class="ifTrue test">
                <span>C'est la vérité !</span>
            </button>
        `.trim());

        condText.set(false);

        await tick();
        // prettier-ignore
        expect(el.outerHTML).toBe(`
            <button class="ifFalse test">
                <span>C'est un mensonge !</span>
            </button>
        `.trim());

    });

    it('allows looping on dynamic list of nodes', async () => {
        const items = writable([
            { id: 1, value: 'A' },
            { id: 2, value: 'B' },
            { id: 3, value: 'C' },
        ]);

        // prettier-ignore
        const el = node(html`
            <ul>
                ${loop().each(items, (item) => 
                    html`<li>${item.id} - ${item.value}</li>`
                )}
            </ul>
        `) as Element;

        await tick();
        // prettier-ignore
        expect(el.outerHTML).toBe(`
            <ul>
                <li>1 - A</li><li>2 - B</li><li>3 - C</li>
            </ul>
        `.trim());

        items.update((coll) => (coll.push({ id: 4, value: 'D' }), coll));

        await tick();
        // prettier-ignore
        expect(el.outerHTML).toBe(`
            <ul>
                <li>1 - A</li><li>2 - B</li><li>3 - C</li><li>4 - D</li>
            </ul>
        `.trim());

        items.update((coll) => (coll.splice(0, 1), coll));

        await tick();
        // prettier-ignore
        expect(el.outerHTML).toBe(`
            <ul>
                <li>2 - B</li><li>3 - C</li><li>4 - D</li>
            </ul>
        `.trim());

        items.update((coll) => (coll.splice(0), coll));

        await tick();
        // prettier-ignore
        expect(el.outerHTML).toBe(`
            <ul>
                
            </ul>
        `.trim());

        items.update((coll) => (coll.push({ id: 5, value: 'E' }), coll));

        await tick();
        // prettier-ignore
        expect(el.outerHTML).toBe(`
            <ul>
                <li>5 - E</li>
            </ul>
        `.trim());
    });

    it('allows to specify DOM update mode', async () => {
        const cls = writable('ui-button');
        const count = writable(42);
        const isActive = writable(true);

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
            node(html`
                <button data-attr1="${cls} ${count} ${isActive}">Test</button>
            `, { updateDomMode: DomUpdateMode.EAGER });

            // prettier-ignore
            node(html`
                <button data-attr2="${cls} ${count} ${isActive}">Test</button>
            `, { updateDomMode: DomUpdateMode.BATCHED});

            assert.equal(attributeUpdateCount['data-attr1'], 1);
            assert.equal(attributeUpdateCount['data-attr2'], 0);

            await tick();

            assert.equal(attributeUpdateCount['data-attr1'], 1);
            assert.equal(attributeUpdateCount['data-attr2'], 1);

            cls.update((v) => `${v}-updated`);
            count.update((v) => v + 1);
            isActive.update((v) => !v);

            assert.equal(attributeUpdateCount['data-attr1'], 4);
            assert.equal(attributeUpdateCount['data-attr2'], 1);

            await tick();

            assert.equal(attributeUpdateCount['data-attr1'], 4);
            assert.equal(attributeUpdateCount['data-attr2'], 2);
        } finally {
            Element.prototype.setAttribute = originalSetAttribute;
        }
    });

    it('Allows to create orphan Text node', async () => {
        const undefinedStore = undefined;
        const nullStore = null;

        const stringStore = writable('str');
        const numberStore = writable(42);
        const boolStore = writable(true);
        const bigNumberStore = writable(BigInt(9007199254740991));

        const htmlElStore = writable(html`<div>Toto</div>`);
        const htmlTextStore = writable(text`Toto`);
        const elStore = writable(node(html`<div>Toto</div>`));
        const textStore = writable(node(text`Toto`));

        // prettier-ignore
        const textNode = node(
            text`Ceci est un noeud texte; Bindings : 
            ${undefinedStore} ${nullStore}
            ${stringStore} ${numberStore} ${boolStore} ${bigNumberStore}
            ${htmlElStore} ${htmlTextStore} ${elStore} ${textStore}`
        );

        assert.isTrue(isText(textNode));
        flush();

        assert.equal(textNode.textContent, `Ceci est un noeud texte; Bindings : 
            undefined null
            str 42 true 9007199254740991
            [object] [object] [object] [object]`);
    });
});
