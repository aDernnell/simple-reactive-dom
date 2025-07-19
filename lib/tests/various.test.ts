import { describe, it, expect } from 'vitest';
import { html, node } from '../template/tag';
import { Readable, writable } from '../stores';
import { cond } from '../snippets/condition';
import { tick } from '../utils';

describe('various tests', () => {
    it('watch > cond', async () => {
        const isEditing = writable(true);
        const entity = writable<{ name: string; uid: string }>({ name: 'toto', uid: '123' });

        const el = node((watch) => {
            const ent = watch(entity);
            return html`
                <div>
                    ${cond()
                        .if(
                            isEditing,
                            html`
                                <div>
                                    <p>Name: ${ent?.name}</p>
                                    <p>UID: ${ent?.uid}</p>
                                </div>
                            `
                        )
                        .else(html`<p>No entity selected.</p>`)}
                </div>
            `;
        }) as HTMLDivElement;

        await tick();

        expect(el.outerHTML).toContain('<p>Name: toto</p>');
        expect(el.outerHTML).toContain('<p>UID: 123</p>');

        isEditing.set(false);
        await tick();
        expect(el.outerHTML).toContain('<p>No entity selected.</p>');
        isEditing.set(true);
        await tick();
        expect(el.outerHTML).toContain('<p>Name: toto</p>');
        expect(el.outerHTML).toContain('<p>UID: 123</p>');
        entity.set({ name: 'tata', uid: '456' });
        await tick();
        expect(el.outerHTML).toContain('<p>Name: tata</p>');
        expect(el.outerHTML).toContain('<p>UID: 456</p>');

        isEditing.set(false);
        await tick();

        entity.set({ name: 'titi', uid: '789' });
        isEditing.set(true);
        await tick();
        expect(el.outerHTML).toContain('<p>Name: titi</p>');
        expect(el.outerHTML).toContain('<p>UID: 789</p>');
    });

    it('cond > watch', async () => {
        const isEditing = writable(true);
        const entity = writable<{ name: string; uid: string }>({ name: 'toto', uid: '123' });

        const el = node(html`
            <div>
                ${cond()
                    .if(
                        isEditing,
                        node((watch) => {
                            const ent = watch(entity);
                            return html`
                                <div>
                                    <p>Name: ${ent?.name}</p>
                                    <p>UID: ${ent?.uid}</p>
                                </div>
                            `;
                        })
                    )
                    .else(html`<p>No entity selected.</p>`)}
            </div>
        `) as HTMLDivElement;

        await tick();

        expect(el.outerHTML).toContain('<p>Name: toto</p>');
        expect(el.outerHTML).toContain('<p>UID: 123</p>');

        isEditing.set(false);
        await tick();
        isEditing.set(true);
        entity.set({ name: 'tata', uid: '456' });
        await tick();
        expect(el.outerHTML).toContain('<p>Name: tata</p>');
        expect(el.outerHTML).toContain('<p>UID: 456</p>');
    });
});
