import { describe, it, expect, vi, assert } from 'vitest';
import { writable } from '../../stores';
import { rawHtmlToNode } from '../../utils';
import { bindStates, call, html, node, opt, rawHtml, when } from '../../framework';
import { tick } from '../../utils/debounce';

describe('call directive : binding event handlers', () => {
    it('adds event handler', async () => {
        const handler = vi.fn();

        const div = node(html`<div onclick=${call(handler)}></div>`) as HTMLDivElement;
        await tick();

        const expectedHtml = '<div></div>';
        expect(div.outerHTML).toBe(expectedHtml);

        div.click();
        expect(handler).toHaveBeenCalled();
    });

    it('removes event handler if state become undefined', async () => {
        const store = writable<((ev?: Event) => void) | undefined>(() => {});
        const handler = vi.fn();
        store.set(handler);

        const div = node((watch) => html`<div onclick=${call(watch(store))}></div>`) as HTMLDivElement;
        await tick();

        const expectedHtml = '<div></div>';
        expect(div.outerHTML).toBe(expectedHtml);

        div.click();
        expect(handler).toHaveBeenCalledTimes(1);

        store.set(undefined);
        await tick();

        // TODO vérifier comment ça se fait que undefined soit correctement interprété ici

        expect(div.outerHTML).toBe(expectedHtml);

        handler.mockClear();
        div.click();
        expect(handler).not.toHaveBeenCalled();
    });

    it('does not add event handler if state is initially undefined', async () => {
        const store = writable<((ev?: Event) => void) | undefined>(undefined);
        const handler = vi.fn();

        const div = node((watch) => html`<div onclick=${call(watch(store))}></div>`) as HTMLDivElement;
        const addEventListenerSpy = vi.spyOn(div, 'addEventListener');

        await tick();
        // Check that there is no onclick event handler on the div
        expect(div.outerHTML).toBe('<div></div>');
        expect(div.onclick).toBeNull();
        expect(div.getAttribute('onclick')).toBeNull();

        // Check that addEventListener was never called for 'click'
        expect(addEventListenerSpy.mock.calls.find(([event]) => event === 'click')).toBeUndefined();

        // Now set a valid handler
        store.set(handler);
        await tick();

        expect(div.outerHTML).toBe('<div></div>');

        div.click();
        expect(handler).toHaveBeenCalled();
        expect(addEventListenerSpy).toHaveBeenCalledWith('click', handler);
    });

    it('updates the event handler with a new function on state change', async () => {
        const store = writable(() => {});
        const handler1 = vi.fn();
        const handler2 = vi.fn();
        store.set(handler1);

        const div = node((watch) => html`<div onclick=${call(watch(store))}></div>`) as HTMLDivElement;
        const addEventListenerSpy = vi.spyOn(div, 'addEventListener');
        const removeEventListenerSpy = vi.spyOn(div, 'removeEventListener');

        await tick();
        div.click();
        expect(handler1).toHaveBeenCalledTimes(1);
        expect(handler2).not.toHaveBeenCalled();
        expect(addEventListenerSpy).toHaveBeenCalledWith('click', handler1);
        expect(removeEventListenerSpy).not.toHaveBeenCalled();

        store.set(handler2);
        await tick();

        expect(addEventListenerSpy).toHaveBeenCalledWith('click', handler2);
        expect(removeEventListenerSpy).toHaveBeenCalledWith('click', handler1);

        div.click();
        expect(handler1).toHaveBeenCalledTimes(1);
        expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('accepts custom events', async () => {
        const handler = vi.fn();

        const div = node(html`<div onmycustomevent=${call(handler)}></div>`) as HTMLDivElement;
        const addEventListenerSpy = vi.spyOn(div, 'addEventListener');

        await tick();
        const event = new Event('mycustomevent');
        div.dispatchEvent(event);
        expect(handler).toHaveBeenCalledTimes(1);
        expect(addEventListenerSpy).toHaveBeenCalledWith('mycustomevent', handler);

        const expected = '<div></div>';
        expect(div.outerHTML).toBe(expected);
    });

    it('is ignored on non-event attributes', async () => {
        const handler = vi.fn();
        const div = node(html`<div class=${call(handler)}></div>`) as HTMLDivElement;
        const addEventListenerSpy = vi.spyOn(div, 'addEventListener');
        await tick();
        expect(div.outerHTML).toBe('<div class="/*[object]*/"></div>');
        expect(addEventListenerSpy).not.toHaveBeenCalled();
        div.click();
        expect(handler).not.toHaveBeenCalled();
    });

    it('uses default options for event listeners, no capture, no passive and no once', async () => {
        const handler = vi.fn();
        const store = writable<((ev: Event) => void)>(handler);

        const div = node((watch) => html`<div onclick=${call(watch(store))}></div>`) as HTMLDivElement;

        await tick();
        div.click();
        expect(handler).toHaveBeenCalledTimes(1);

        // Check that once is not used (handler is called every time)
        handler.mockClear();
        div.click();
        div.click();
        expect(handler).toHaveBeenCalledTimes(2);

        // Check that capture is not used (handler is called in bubble phase)
        handler.mockClear();
        let phase: string | null = null;
        // Replace handler with one that records the phase
        const phaseHandler = vi.fn((e: Event) => {
            phase =
                e.eventPhase === Event.CAPTURING_PHASE
                    ? 'capture'
                    : e.eventPhase === Event.AT_TARGET
                    ? 'at_target'
                    : e.eventPhase === Event.BUBBLING_PHASE
                    ? 'bubble'
                    : 'unknown';
        });
        store.set(phaseHandler);
        await tick();

        // Dispatch event in capture phase
        div.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        expect(phaseHandler).toHaveBeenCalled();
        expect(phase).toBeOneOf(['bubble', 'at_target']); // Should only be called in bubble phase

        // Add a capture listener to verify capture phase is possible
        let captureCalled = false;
        div.addEventListener(
            'click',
            () => {
                captureCalled = true;
            },
            { capture: true }
        );
        div.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        expect(captureCalled).toBe(true);
        // The handler from binding should still only be called in bubble phase
        expect(phase).toBeOneOf(['bubble', 'at_target']);

        // Check that passive is not used (preventDefault works)
        let prevented = false;
        store.set((e: Event) => {
            e.preventDefault();
            prevented = e.defaultPrevented;
        });
        await tick();
        div.click();
        expect(prevented).toBe(true);
    });
});

describe('when directive : binding conditional attributes', () => {
    it('binds attribute using boolean', async () => {
        const attrPresentEl = node(html`<button disabled=${when(true)}>test</button>`) as Element;
        const attrAbsentEl = node(html`<button disabled=${when(false)}>test</button>`) as Element;
        await tick();

        assert.equal(attrPresentEl.outerHTML, '<button disabled="">test</button>');
        assert.equal(attrAbsentEl.outerHTML, '<button>test</button>');

        const booleanStore = writable<boolean>(false);
        const el = node((watch) => html`<button disabled=${when(watch(booleanStore))}>test</button>`) as Element;
        
        await tick();
        assert.equal(el.outerHTML, '<button>test</button>');

        booleanStore.set(true);
        await tick();
        assert.equal(el.outerHTML, '<button disabled="">test</button>');

        booleanStore.set(false);
        await tick();
        assert.equal(el.outerHTML, '<button>test</button>');
    });

    it('binds attribute using boolean store', async () => {
        const booleanStore = writable<boolean>(false);
        const el = node(html`<button disabled=${when(booleanStore)}>test</button>`) as Element;
        
        await tick();
        assert.equal(el.outerHTML, '<button>test</button>');

        booleanStore.set(true);
        await tick();
        assert.equal(el.outerHTML, '<button disabled="">test</button>');


        booleanStore.set(false);
        await tick();
        assert.equal(el.outerHTML, '<button>test</button>');
    });

    it('binds attribute using store value', async () => {
        const valueStore = writable<string>('toto');
        const el = node(html`<button disabled=${when(valueStore, 'tata')}>test</button>`) as Element;
        
        await tick();
        assert.equal(el.outerHTML, '<button>test</button>');

        valueStore.set('tata');
        await tick();
        assert.equal(el.outerHTML, '<button disabled="">test</button>');

        valueStore.set('titi');
        await tick();
        assert.equal(el.outerHTML, '<button>test</button>');
    });
});

describe('opt directive : binding optional values', () => {
    it('replaces nullish bound value with empty string', async () => {
        const span = document.createElement('span');
        span.textContent = 'Hello, world!';
        const txt = 'Toto';
        const spanStore = writable<HTMLSpanElement | null | undefined>(span);
        const spanStore1 = writable<HTMLSpanElement | null | undefined>(null);
        const spanStore2 = writable<HTMLSpanElement | null | undefined>(undefined);
        const valueStore = writable<string | null | undefined>(txt);
        const valueStore1 = writable<string | null | undefined>(null);
        const valueStore2 = writable<string | null | undefined>(undefined);

        // prettier-ignore
        const el = node(html`
                <section>
                    ${opt(spanStore)}
                    ${opt(spanStore1)}
                    ${opt(spanStore2)}
                    ${opt(valueStore)}
                    ${opt(valueStore1)}
                    ${opt(valueStore2)}
                </section>
            `) as Element;

        await tick();
        // prettier-ignore
        expect(el.outerHTML).toBe(`
                <section>
                    <span>Hello, world!</span>
                    
                    
                    Toto
                    
                    
                </section>
            `.trim());

        // One child element
        assert.equal(el.childElementCount, 1);
        // One non empty and non whitespace-only child text node
        assert.equal(
            Array.from(el.childNodes).filter((n) => n.nodeType == 3 && n.textContent && /[^\s]/.test(n.textContent))
                .length,
            1
        );

        spanStore.set(undefined);
        spanStore1.set(null);
        spanStore2.set(span);
        valueStore.set(undefined);
        valueStore1.set(null);
        valueStore2.set(txt);

        await tick();
        // prettier-ignore
        expect(el.outerHTML).toBe(`
                <section>
                    
                    
                    <span>Hello, world!</span>
                    
                    
                    Toto
                </section>
            `.trim());

        // One child element
        assert.equal(el.childElementCount, 1);
        // One non empty and non whitespace-only child text node
        assert.equal(
            Array.from(el.childNodes).filter((n) => n.nodeType == 3 && n.textContent && /[^\s]/.test(n.textContent))
                .length,
            1
        );

        spanStore.set(undefined);
        spanStore1.set(span.cloneNode(true) as HTMLSpanElement);
        spanStore2.set(null);
        valueStore.set(undefined);
        valueStore1.set(txt);
        valueStore2.set(null);

        await tick();
        // prettier-ignore
        expect(el.outerHTML).toBe(`
                <section>
                    
                    <span>Hello, world!</span>
                    
                    
                    Toto
                    
                </section>
            `.trim());

        // One child element
        assert.equal(el.childElementCount, 1);
        // One non empty and non whitespace-only child text node
        assert.equal(
            Array.from(el.childNodes).filter((n) => n.nodeType == 3 && n.textContent && /[^\s]/.test(n.textContent))
                .length,
            1
        );
    });
});
