import { HtmlLiterals, isHtmlLiterals, node } from '../template/tag';
import { derived, isReadable, Readable, Unsubscriber, Writable, writable } from '../stores';
import { dispose } from '../lifecycle/disposable';

type ConditionBuilder = {
    if: (
        condition: Readable<boolean>,
        contentIftrue: Node | HtmlLiterals | Readable<Node | HtmlLiterals>
    ) => Readable<Node> & PostIfBuilder;
    elseif: (
        condition: Readable<boolean>,
        contentIftrue: Node | HtmlLiterals | Readable<Node | HtmlLiterals>
    ) => Readable<Node> & PostIfBuilder;
    else: (content: Node | HtmlLiterals | Readable<Node | HtmlLiterals>) => Readable<Node>;
};

type PreIfBuilder = Pick<ConditionBuilder, 'if'>;
type PostIfBuilder = Pick<ConditionBuilder, 'elseif' | 'else'>;

const setContent = (nodeStore: Writable<Node>, content: Node | HtmlLiterals) => {
    if (isHtmlLiterals(content)) {
        nodeStore.set(node(content));
    } else {
        return nodeStore.set(content);
    }
};

const bindContent = (nodeStore: Writable<Node>, content: Readable<Node | HtmlLiterals>): Unsubscriber => {
    return content.subscribe((value) => {
        setContent(nodeStore, value);
    });
};

const applyContent = (
    nodeStore: Writable<Node>,
    content: Node | HtmlLiterals | Readable<Node | HtmlLiterals>
): Unsubscriber | undefined => {
    let unsub: Unsubscriber | undefined = undefined;
    isReadable(content) ? (unsub = bindContent(nodeStore, content)) : setContent(nodeStore, content);
    return unsub;
};

const _sub = (unsubs: Array<Unsubscriber>, unsub: Unsubscriber | undefined): Unsubscriber | undefined => {
    if (unsub) {
        unsubs.push(unsub);
    }
    return unsub;
};

const _unsub = (unsubs: Array<Unsubscriber>, unsub: Unsubscriber | undefined): boolean => {
    if (unsub) {
        unsub();
        const unsubIdx = unsubs.indexOf(unsub);
        unsubIdx != -1 && unsubs.splice(unsubIdx, 1);
        return true;
    }
    return false;
};

export const cond = (): PreIfBuilder => {
    const unsubs: Array<Unsubscriber> = [];
    const anchor: Text = document.createTextNode('');
    let onePrevious: Readable<boolean>;

    const nodeStore = writable<Node>(anchor);

    let previousNode: Node = anchor;
    unsubs.push(
        nodeStore.subscribe(($node) => {
            if ($node !== previousNode) {
                dispose(previousNode);
                previousNode = $node;
            }
        })
    );

    const _if = (
        condition: Readable<boolean>,
        contentIftrue: Node | HtmlLiterals | Readable<Node | HtmlLiterals>
    ): Readable<Node> & PostIfBuilder => {
        let unsub: Unsubscriber | undefined;
        unsubs.push(
            condition.subscribe(($cond) => {
                // TODO microtask debouncer ?
                $cond
                    ? (unsub = _sub(unsubs, applyContent(nodeStore, contentIftrue)))
                    : (_unsub(unsubs, unsub) && (unsub = undefined), nodeStore.set(anchor));
            })
        );
        onePrevious = condition;

        return Object.assign(nodeStore, {
            elseif: _elseif,
            else: _else,
        });
    };

    const _elseif = (
        condition: Readable<boolean>,
        contentIftrue: Node | HtmlLiterals | Readable<Node | HtmlLiterals>
    ): Readable<Node> & PostIfBuilder => {
        const _condition = derived([onePrevious, condition], ([$previous, $current]) => !$previous && $current);
        let unsub: Unsubscriber | undefined;
        unsubs.push(
            _condition.subscribe(($cond) => {
                $cond
                    ? (unsub = _sub(unsubs, applyContent(nodeStore, contentIftrue)))
                    : _unsub(unsubs, unsub) && (unsub = undefined);
            })
        );
        onePrevious = derived([onePrevious, condition], ([$previous, $current]) => $previous || $current);

        return Object.assign(nodeStore, {
            elseif: _elseif,
            else: _else,
        });
    };

    const _else = (content: Node | HtmlLiterals | Readable<Node | HtmlLiterals>): Readable<Node> => {
        let unsub: Unsubscriber | undefined;
        unsubs.push(
            onePrevious.subscribe(($cond) => {
                !$cond
                    ? (unsub = _sub(unsubs, applyContent(nodeStore, content)))
                    : _unsub(unsubs, unsub) && (unsub = undefined);
            })
        );
        return nodeStore;
    };

    return {
        if: _if,
    };
};
