import { getElementRefs, writable } from '../../../lib';
import { node, html } from '../../../lib/framework/template/tag';

let count = -1;
const List = () => html`
    <ul>
        ${[1, 2, 3, 4, 5].map((i) => html`<li>${count + i}</li>`)}
    </ul>
`;

const trigger = writable({});

const contentNode = node(html`
    <div>
        <button bind:triggerbtn>Trigger refresh</button>
        ${node((watch) => (watch(trigger), count++, List()))}
    </div>
`) as Element;

const refs = getElementRefs(contentNode);

refs.triggerbtn.addEventListener('click', () => {
    trigger.set({});
});

document.getElementById('app-content')!.replaceChildren(contentNode);
