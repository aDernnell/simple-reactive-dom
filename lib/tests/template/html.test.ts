import { describe, it, expect, assert, vi } from 'vitest';
import { html, HTML_LITERALS, node, raw, rawHtml, text, tmpl } from '../../template/tag';
import { derived, isReadable, writable } from '../../stores';

describe('html tag', () => {
    it('parses the template into string literals and js values', () => {
        const count = writable(0);
        const double = derived(count, (c) => 2 * c);
        const array = new Array(4).fill(0);
        const varName = 'count';

        const div = document.createElement('div');

        // prettier-ignore
        const literals = html`
            <span title="== ${varName} is ${count} ==">
                == ${varName} is <b>${count} ${count.get() < 10 ? '!' : ''}</b> ==
                ${div}
                ${double}
                ${array.map((_, i) => i)}
            </span>
        `;

        const expected = {
            [HTML_LITERALS]: true,
            strings: [
                '\n            <span title="== ',
                ' is ',
                ' ==">\n                == ',
                ' is <b>',
                ' ',
                '</b> ==\n                ',
                '\n                ',
                '\n                ',
                '\n            </span>\n        ',
            ],
            values: ['count', count, 'count', count, '!', div, double, [0, 1, 2, 3]],
        };

        expect(literals).toEqual(expected);
    });

    it('guards against tag bad use', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        html`${'test'}`;
        expect(warnSpy).toHaveBeenCalledWith(
            'HTML literals should not start with a bound value. This may lead to unexpected behavior !'
        );
        html`bla bla ${'test'}`;
        expect(warnSpy).toHaveBeenCalledWith(
            'HTML literals should not start with something else than an opening html tag. This may lead to unexpected behavior !'
        );
        warnSpy.mockRestore();
    });
});

describe('text tag', () => {
    it('parses the template into string literals and js values', () => {
        const count = writable(0);
        const double = derived(count, (c) => 2 * c);
        const array = new Array(4).fill(0);
        const varName = 'count';

        // prettier-ignore
        const literals = text`
            == ${varName} is ${count} ==
            == ${varName} is ${count} ${count.get() < 10 ? '!' : ''} ==
            ${double}
            ${array.map((_, i) => i)}
        `;

        expect(literals).toEqual({
            [HTML_LITERALS]: true,
            strings: [
                '\n            == ',
                ' is ',
                ' ==\n            == ',
                ' is ',
                ' ',
                ' ==\n            ',
                '\n            ',
                '\n        ',
            ],
            values: ['count', count, 'count', count, '!', double, [0, 1, 2, 3]],
        });
    });

    it('guards against tag bad use', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        node(text`bla bla <span>${'test'}</span> bla bla`);
        expect(warnSpy).toHaveBeenCalledWith('Text literals should not contain HTML tags.');
    });

    it('stops parsing template on html node', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const _text = node(text`mon texte </br> sur une nouvelle ligne`);
        expect(warnSpy).toHaveBeenCalledWith('Text literals should not contain HTML tags.');
        expect(_text.textContent).toBe('mon texte ');
    });
});

describe('template', () => {
    it('Replaces values with placeholders and generates binding stores', () => {
        const count = writable(0);
        const double = derived(count, (c) => 2 * c);
        const array = new Array(4).fill(0);
        const varName = 'count';

        const div = document.createElement('div');

        // prettier-ignore
        const literals = html`
            <span title="== ${varName} is ${count} ==">
                == ${varName} is <b>${count} ${count.get() < 10 ? '!' : ''}</b> ==
                ${div}
                ${double}
                ${array.map((_, i) => i)}
            </span>
        `;

        const [template, bindings] = tmpl(literals.strings, literals.values);

        // prettier-ignore
        expect(template).toBe(`
            <span title="== #{0} is #{1} ==">
                == #{2} is <b>#{1} #{4}</b> ==
                #{5}
                #{6}
                #{7}
            </span>
        `);

        /*
            bindedStores[0] = readable('count');
            bindedStores[1] = count;
            bindedStores[2] = readable('count');;
            // 3 => 1
            bindedStores[4] = readable('!');
            bindedStores[5] = readable(div);
            bindedStores[6] = double;
            bindedStores[7] = readable([0, 1, 2, 3]);
        */
        expect(Object.keys(bindings)).toEqual(['0', '1', '2', '4', '5', '6', '7']);
        Object.values(bindings).forEach((b) => assert.isTrue(isReadable(b)));
        expect(bindings[1]).toBe(count);
        expect(bindings[6]).toBe(double);
    });
});

describe('raw html', () => {
    it('should return the correct string for a simple template', () => {
        const result = raw(text`Hello, ${'world'}!`);
        const expected = `Hello, ${'world'}!`;
        const expectedRawHtml = rawHtml`Hello, ${'world'}!`;
        assert.equal(result, expected);
        assert.equal(result, expectedRawHtml);
        expect(result).toBe('Hello, world!');
    });

    it('should handle multiple substitutions', () => {
        const name = 'Alice';
        const age = 30;
        const result = raw(text`Name: ${name}, Age: ${age}`);
        const expected = `Name: ${name}, Age: ${age}`;
        const expectedRawHtml = rawHtml`Name: ${name}, Age: ${age}`;
        assert.equal(result, expected);
        assert.equal(result, expectedRawHtml);
        expect(result).toBe('Name: Alice, Age: 30');
    });

    it('should handle empty substitutions', () => {
        const result = raw(text`Hello, ${''}!`);
        const expected = `Hello, ${''}!`;
        const expectedRawHtml = rawHtml`Hello, ${''}!`;
        assert.equal(result, expected);
        assert.equal(result, expectedRawHtml);
        expect(result).toBe('Hello, !');

        const result1 = raw(text`Hello, ${undefined}!`);
        const expected1 = `Hello, ${undefined}!`;
        const expectedRawHtml1 = rawHtml`Hello, ${undefined}!`;
        assert.equal(result1, expected1);
        assert.equal(result1, expectedRawHtml1);
        expect(result1).toBe('Hello, undefined!');

        const result2 = raw(text`Hello, ${null}!`);
        const expected2 = `Hello, ${null}!`;
        const expectedRawHtml2 = rawHtml`Hello, ${null}!`;
        assert.equal(result2, expected2);
        assert.equal(result2, expectedRawHtml2);
        expect(result2).toBe('Hello, null!');
    });

    it('should handle no substitutions', () => {
        const result = raw(text`Just a string with no substitutions.`);
        const expected = `Just a string with no substitutions.`;
        const expectedRawHtml = rawHtml`Just a string with no substitutions.`;
        assert.equal(result, expected);
        assert.equal(result, expectedRawHtml);
        expect(result).toBe('Just a string with no substitutions.');
    });

    it('should handle special characters correctly', () => {
        // prettier-ignore
        const result = raw(text`Line 1\nLine 2\tTabbed  \b\b \
toto \xA9`);
        // prettier-ignore
        const result1 = raw(text`Line 1
Line 2\u{0009}Tabbed  \b\b toto \xA9`);
        // prettier-ignore
        const expected = `Line 1\nLine 2\tTabbed  \b\b \
toto \xA9`;
        // prettier-ignore
        const expectedRawHtml = rawHtml`Line 1\nLine 2\tTabbed  \b\b \
toto \xA9`;
        assert.equal(result, expected);
        assert.equal(result, expectedRawHtml);
        assert.equal(result1, expected);
        assert.equal(result1, expectedRawHtml);
        expect(result).toBe('Line 1\nLine 2\tTabbed  \b\b toto ©');
    });

    it('should handle escaping special chars', () => {
        const result = raw(text`Path: C:\\Users\\Test \${} \``);
        const expected = `Path: C:\\Users\\Test \${} \``;
        const expectedRawHtml = rawHtml`Path: C:\\Users\\Test \${} \``;
        assert.equal(result, expected);
        assert.equal(result, expectedRawHtml);
        expect(result).toBe('Path: C:\\Users\\Test ${} `');
    });

    it('should naivelly concatenates expression values', () => {
        const count = writable(0);
        const double = derived(count, (c) => 2 * c);
        const array = new Array(4).fill(0);
        const varName = 'count';

        const div = document.createElement('div');

        // prettier-ignore
        const literals = html`
            <span title="== ${varName} is ${count} ==">
                == ${varName} is <b>${count} ${count.get() < 10 ? '!' : ''}</b> ==
                ${div}
                ${double}
                ${array.map((_, i) => i)}
            </span>
        `;

        // prettier-ignore
        const expectedRaw = `
            <span title="== count is [object Object] ==">
                == count is <b>[object Object] !</b> ==
                <div></div>
                [object Object]
                0,1,2,3
            </span>
        `;

        expect(raw(literals)).toBe(expectedRaw);
    });
});
