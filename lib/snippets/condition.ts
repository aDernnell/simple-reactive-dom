import { HtmlLiterals, isHtmlLiterals, node } from '../template/tag';
import { derived, isReadable, Readable, Unsubscriber, Writable, writable } from '../stores';
import { disposeRec } from '../lifecycle/disposable';

type ConditionBuilder = {
    if: (condition: Readable<boolean>, contentIftrue: Content | (() => Content)) => Readable<Node> & PostIfBuilder;
    elseif: (condition: Readable<boolean>, contentIftrue: Content | (() => Content)) => Readable<Node> & PostIfBuilder;
    else: (content: Content | (() => Content)) => Readable<Node>;
};

type PreIfBuilder = Pick<ConditionBuilder, 'if'>;
type PostIfBuilder = Pick<ConditionBuilder, 'elseif' | 'else'>;

type Content = Node | HtmlLiterals | Readable<Node | HtmlLiterals>;

type BranchState = {
    /**
     * Unsubscriber for the branch content subscription if it is provided in a store
     */
    unsub: Unsubscriber | undefined;
    /**
     * Whether the branch is currently active
     */
    active: boolean;
    /**
     * The current node of the branch, undefined if not active
     */
    node: Node | undefined;
};

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
    contentProvider: Content | (() => Content)
): Unsubscriber | undefined => {
    let unsub: Unsubscriber | undefined = undefined;
    const content = typeof contentProvider === 'function' ? contentProvider() : contentProvider;
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

/**
 * Dispose du noeud d'une branche seulement si ce dernier est issus d'une fonction ou d'un literals.
 * En effet, dans ce cas, un nouveau noeud peut être regénéré si la branche est réactivée.
 * Attention : ce n'est vrai que si la fonction de récupération du contenu retourne efectivement une nouvelle instance à chaque appel.
 */
const _dispose = (content: Node, contentOrProvider: Content | (() => Content)): void => {
    // Ne sont disposés que les contenus qui seront regénérés si réinjectés
    if (
        typeof contentOrProvider === 'function' ||
        isHtmlLiterals(contentOrProvider) ||
        (isReadable(contentOrProvider) && isHtmlLiterals(contentOrProvider.get()))
    ) {
        disposeRec(content);
    }
};

const activateBranch = (
    unsubs: Array<Unsubscriber> = [],
    nodeStore: Writable<Node>,
    branchState: BranchState,
    content: Content | (() => Content)
) => {
    branchState.unsub = _sub(unsubs, applyContent(nodeStore, content));
    branchState.node = nodeStore.get();
    branchState.active = true;
};

const deactivateBranch = (
    unsubs: Array<Unsubscriber>,
    branchState: BranchState,
    content: Content | (() => Content)
) => {
    if (branchState.active) {
        _unsub(unsubs, branchState.unsub);
        branchState.unsub = undefined;
        branchState.node && _dispose(branchState.node, content);
        branchState.node = undefined;
        branchState.active = false;
    }
};

export const cond = (): PreIfBuilder => {
    const unsubs: Array<Unsubscriber> = [];
    const anchor: Text = document.createTextNode('');
    let onePrevious: Readable<boolean>;

    const nodeStore = writable<Node>(anchor);

    const _if = (
        condition: Readable<boolean>,
        contentIftrue: Content | (() => Content)
    ): Readable<Node> & PostIfBuilder => {
        const branchState: BranchState = {
            unsub: undefined,
            active: false,
            node: undefined
        };
        unsubs.push(
            condition.subscribe(($cond) => {
                // TODO microtask debouncer ?
                $cond
                    ? activateBranch(unsubs, nodeStore, branchState, contentIftrue)
                    : (deactivateBranch(unsubs, branchState, contentIftrue), nodeStore.set(anchor));
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
        contentIftrue: Content | (() => Content)
    ): Readable<Node> & PostIfBuilder => {
        const _condition = derived([onePrevious, condition], ([$previous, $current]) => !$previous && $current);
        const branchState: BranchState = {
            unsub: undefined,
            active: false,
            node: undefined
        };
        unsubs.push(
            _condition.subscribe(($cond) => {
                $cond
                    ? activateBranch(unsubs, nodeStore, branchState, contentIftrue)
                    : deactivateBranch(unsubs, branchState, contentIftrue);
            })
        );
        onePrevious = derived([onePrevious, condition], ([$previous, $current]) => $previous || $current);

        return Object.assign(nodeStore, {
            elseif: _elseif,
            else: _else,
        });
    };

    const _else = (content: Content | (() => Content)): Readable<Node> => {
        const branchState: BranchState = {
            unsub: undefined,
            active: false,
            node: undefined
        };
        unsubs.push(
            onePrevious.subscribe(($cond) => {
                !$cond
                    ? activateBranch(unsubs, nodeStore, branchState, content)
                    : deactivateBranch(unsubs, branchState, content);
            })
        );
        return nodeStore;
    };

    return {
        if: _if,
    };
};
