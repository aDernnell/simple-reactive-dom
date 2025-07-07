import { call, derived, disposable, dispose, loop, Readable, when, Writable, writable } from '../../../lib';
import { DomUpdateMode } from '../../../lib/dom/operation';
import { node, html } from '../../../lib/template/tag';

type Item = {
    id: number;
    label: Readable<string>;
};

const max = writable(0);

const createItem = (id: number): Item => {
    const counter = writable(0);
    const label = derived(counter, (i) => `${i}`);
    let timer = setInterval(() => {
        counter.update((i) => (i + 1 > max.get() ? (max.set(i + 1), i + 1) : i + 1));
    }, 1000);

    return disposable(
        {
            id,
            label,
        },
        () => clearInterval(timer)
    );
};

const updateDomMode = writable<DomUpdateMode>(DomUpdateMode.BATCHED);

const Radio = (updateDomMode: Writable<DomUpdateMode>) => {
    const _node = node(html`
        <div>
            <span>Update DOM mode:</span>
            <label>
                <input
                    type="radio"
                    name="updateDomMode"
                    value="batched"
                    checked=${when(updateDomMode, DomUpdateMode.BATCHED)}
                    onchange=${call(() => updateDomMode.set(DomUpdateMode.BATCHED))}
                />
                Batched
            </label>
            <label>
                <input
                    type="radio"
                    name="updateDomMode"
                    value="eager"
                    checked=${when(updateDomMode, DomUpdateMode.EAGER)}
                    onchange=${call(() => updateDomMode.set(DomUpdateMode.EAGER))}
                />
                Eager
            </label>
        </div>
    `) as Element;

    return _node;
};

const List = (updateDomMode: Readable<DomUpdateMode>) => {
    let count = 0;
    const items = writable<Array<Item>>(Array.from({ length: 100 }, (_, i) => createItem(i)));
    let currentLit;
    let currentLoop;
    const Ul = (mode: DomUpdateMode) => {
        count++;
        const timer = setInterval(() => {
            items.update((items) => {
                // randomly replace an item by a new one
                if (items.length > 0) {
                    const index = Math.floor(Math.random() * items.length);
                    items.splice(index, 1, createItem(index)).forEach(dispose);
                    //console.log(`Item at index ${index} replaced`);
                }
                return items;
            });
        }, 10);

        const oldLit = currentLit;
        const oldLoop = currentLoop;
        let i = 0;
        const id = count;
        return disposable(
            ((currentLit = html`
                <ul class="${count}">
                    ${(currentLoop = loop({ updateDomMode: mode }).each(
                        items,
                        (item) => html`<li>${item.id} : ${item.label}</li>`
                    ))}
                </ul>
            `),
            console.log('lit is', currentLit == oldLit ? 'same' : 'new'),
            console.log('loop is', currentLoop == oldLoop ? 'same' : 'new'),
            currentLit),
            () => {
                clearInterval(timer);
                console.log(`#${id} disposed`);
            }
        );
    };

    return node((watch) => Ul(watch(updateDomMode)));
};

document.getElementById('app-content')!.replaceChildren(
    node(html`
        <div>
            ${Radio(updateDomMode)}
            </br>
            <span>Max reached: ${max}</span>
            ${List(updateDomMode)}
        </div>
    `)
);
