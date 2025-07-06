import { describe, it, assert } from 'vitest';
import { rawHtmlToNode } from '../../utils/elements';
import { rawHtml } from '../../framework/template/tag';
import { getElementRefs } from '../../framework/binding/elements';


describe('referencing elements', () => {
    it('references html element', () => {
        const el = rawHtmlToNode(rawHtml`<div><span ref:nested>...</span></div>`) as Element;

        const obj = getElementRefs(el);
        assert.equal(obj.nested, el.querySelector('span'));
    });

    it('references multiple elements recursivelly', () => {
        const el = rawHtmlToNode(rawHtml`
            <div ref:div>
                <span ref:span1><p ref:paragraph>...</p></span>
                <span ref:span2>...</span>
            </div>
        `) as Element;

        const obj = getElementRefs(el);
        assert.equal(obj.div, el);
        assert.equal(obj.span1, el.querySelectorAll('span')[0]);
        assert.equal(obj.span2, el.querySelectorAll('span')[1]);
        assert.equal(obj.paragraph, el.querySelector('p'));
    });

    it('allows accessing referenced element by multiple names', () => {
        const el = rawHtmlToNode(rawHtml`
            <div>
                <span ref:my-el>...</span>
                <span ref:my_other_el>...</span>
                <span ref:myThirdEl>...</span>
            </div>
        `) as Element;

        const obj = getElementRefs(el, { strictNames: false });
        const myel_span = el.querySelectorAll('span')[0];
        assert.equal(obj['my-el'], myel_span);
        assert.equal(obj.myel, myel_span);
        assert.equal(obj.my_el, myel_span);
        assert.equal(obj.myEl, myel_span);

        assert.equal(obj.myOtherEl, el.querySelectorAll('span')[1]);
        assert.equal(obj.myThirdEl, el.querySelectorAll('span')[2]);
    });

    it('overrides referenced elements with equivalent names', () => {
        const el = rawHtmlToNode(rawHtml`
            <div>
                <span ref:my-el>...</span>
                <span ref:my_el>...</span>
            </div>
        `) as Element;

        const obj = getElementRefs(el, { strictNames: false });
        const secondSpan = el.querySelectorAll('span')[1];
        assert.equal(obj['my-el'], secondSpan);
        assert.equal(obj.my_el, secondSpan);
        assert.equal(obj.myel, secondSpan);
        assert.equal(obj.myEl, secondSpan);
    });

    it('exposes referenced element by strict name by default', () => {
        const el = rawHtmlToNode(rawHtml`<div><span ref:my-el>...</span></div>`) as Element;

        const obj = getElementRefs(el);
        const span = el.querySelector('span');
        assert.equal(obj['my-el'], span);
        assert.equal(obj.myel, undefined);
        assert.equal(obj.my_el, undefined);
        assert.equal(obj.myEl, undefined);
    });

    it('ignores case in strict mode', () => {
        const el = rawHtmlToNode(rawHtml`
            <div>
                <span ref:myel>...</span>
                <span ref:myEl>...</span>
            </div>
        `) as Element;

        const obj = getElementRefs(el, { strictNames: false });
        const secondSpan = el.querySelectorAll('span')[1];
        assert.equal(obj.myEl, secondSpan);
        assert.equal(obj.myel, secondSpan);
    });
});
