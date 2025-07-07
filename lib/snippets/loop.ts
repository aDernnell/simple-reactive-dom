import { Readable, Unsubscriber, Writable, writable } from '../stores';
import { diffArray, OpType } from '../utils/diffing';
import { isText } from '../utils/elements';
import { randomUniqueId } from '../utils/uniqueId';
import { domOp, DomUpdateMode } from '../dom/operation';
import { disposable, dispose } from '../lifecycle/disposable';
import { HtmlLiterals, isHtmlLiterals, node } from '../template/tag';

export type LoopOptions = {
    useDiffing?: boolean;
    updateDomMode?: DomUpdateMode;
};

const removeAt = (
    nodesStore: Writable<Text | Array<Node>>,
    index: number,
    anchor: Text,
    updateDomMode: DomUpdateMode,
    disposeNode: boolean = true
): Node | undefined => {
    const nodes = nodesStore.get() as Array<Node>;
    if (nodes && nodes.length > index) {
        const node = nodes.splice(index, 1)[0];
        node.parentElement && domOp(() => (node as ChildNode).remove(), updateDomMode);
        disposeNode && dispose(node);
        if (nodes.length == 0) {
            nodesStore.set(anchor);
        }
        return node;
    }
};

const insertAt = (nodesStore: Writable<Text | Array<Node>>, index: number, el: Node, updateDomMode: DomUpdateMode) => {
    if (el && (isText(nodesStore.get()) || index >= (nodesStore.get() as Array<Node>).length)) {
        append(nodesStore, el, updateDomMode);
    } else if (el) {
        insertBefore(nodesStore, el, index, updateDomMode);
    }
};

const append = (nodesStore: Writable<Text | Array<Node>>, el: Node, updateDomMode: DomUpdateMode) => {
    const nodes = nodesStore.get() as Array<Node>;
    if (nodes && nodes.length) {
        const lastNode = nodes[nodes.length - 1];
        lastNode.parentElement && domOp(() => (lastNode as ChildNode).after(el), updateDomMode);
        nodes.push(el);
    } else {
        const nodes = [el];
        nodesStore.set(nodes);
    }
};

const insertBefore = (
    nodesStore: Writable<Text | Array<Node>>,
    el: Node,
    index: number,
    updateDomMode: DomUpdateMode
) => {
    const nodes = nodesStore.get() as Array<Node>;
    if (nodes && nodes.length > index) {
        const node = nodes[index];
        nodes.splice(index, 0, el);
        node.parentElement && domOp(() => (node as ChildNode).before(el), updateDomMode);
    }
};

const apply = <T>(
    nodesStore: Writable<Text | Array<Node>>,
    anchor: Text,
    prevArr: Array<T> | undefined,
    newArr: Array<T>,
    buildItemContent: (item: T) => Node | HtmlLiterals,
    useDiffing: boolean,
    updateDomMode: DomUpdateMode,
    getItemKey?: (item: T) => string
): void => {
    if (useDiffing && getItemKey) {
        const diffResult = diffArray(prevArr, newArr, getItemKey);
        if (!diffResult.overkill) {
            diffResult.ops.forEach((op) => {
                if (op.type === OpType.DEL) {
                    removeAt(nodesStore, op.index, anchor, updateDomMode);
                } else if (op.type === OpType.MOV) {
                    const itemNode = removeAt(nodesStore, op.index, anchor, updateDomMode, false);
                    itemNode && insertAt(nodesStore, op.indexDst!, itemNode, updateDomMode);
                } else if (op.type === OpType.ADD) {
                    const content = buildItemContent(op.item);
                    const itemNode = isHtmlLiterals(content) ? node(content) : content;
                    insertAt(nodesStore, op.index, itemNode, updateDomMode);
                }
            });
            return;
        }
    }

    // Si pas de clé unique pour les éléments ou si l'algorithme de diffing retourne overkill ou si diffing désactivé :
    // reconstruction de l'ensemble de la liste

    const oldNodes = nodesStore.get();
    let newNodes: Array<Node> = [];

    if (Array.isArray(oldNodes)) {
        // Si le store contenait une liste de noeuds, on les dispose
        oldNodes.forEach(dispose);
    }

    newArr.forEach((item) => {
        const content = buildItemContent(item);
        const itemNode = isHtmlLiterals(content) ? node(content) : content;
        newNodes.push(itemNode);
    });

    // Le store est déclenché et state.ts se charge de la maj du DOM
    // /!\ L'ancienne liste ne doit pas avoir été vidée
    nodesStore.set(newNodes.length ? newNodes : anchor);
};

/**
 * Initie une structure réactive de type boucle
 * @param options (optionnel) objet contenant les paramètres optionnels
 */
export const loop = (options?: LoopOptions) => {
    const anchor: Text = document.createTextNode('');
    const useDiffing = options?.useDiffing ?? true;
    const updateDomMode = options?.updateDomMode ?? DomUpdateMode.BATCHED;

    const nodesStore = writable<Text | Array<Node>>(anchor);

    const id = randomUniqueId(6);
    const itemIdMap = new WeakMap<object, string>();
    let uniqueIdCounter = 0;

    // Générateur de clé unique par défaut pour les éléments de type objet si aucune fonction
    // de génération de clé n'est fournie
    const defaultObjectItemKeyFn = <T>(item: T): string => {
        const obj = item as object;
        if (!itemIdMap.has(obj)) {
            const uniqueId = `${id}-${uniqueIdCounter++}`;
            itemIdMap.set(obj, uniqueId);
        }
        return itemIdMap.get(obj)!;
    };

    // Récupération du générateur de clé unique
    const getItemKeyFn = <T>(
        previousArray: T[] | undefined,
        nextArray: T[],
        getItemKey?: (item: T) => string
    ): ((item: T) => string) | undefined => {
        const valuesAreObjects: boolean | undefined = previousArray?.length
            ? typeof previousArray[0] === 'object'
            : nextArray.length
            ? typeof nextArray[0] === 'object'
            : undefined;

        // Seuls les collections de primitives n'ont pas de générateur de clé, sauf explicitement spécifié
        return getItemKey ?? (valuesAreObjects ? defaultObjectItemKeyFn : undefined);
    };

    /**
     * Génère le rendu réactif d'une collection
     * @param collection Store contenant une collection itérable
     * @param buildItemContent Fonction qui créé la représentation HTML d'un élément sous forme de litéral taggé ou d'objet Element
     * @param getItemKey (optionnel) Fonction qui fournit la clé unique d'un élément au format textuel, cette fonction est ignorée dans le cas d'une collection de primitives
     * @return un store réactif contenant un noeud text vide si la collection est vide, la liste de noeuds sinon
     */
    const each = <T>(
        collection: Readable<Iterable<T>>,
        buildItemContent: (item: T) => Node | HtmlLiterals,
        getItemKey?: (item: T) => string
    ): Readable<Text | Array<Node>> => {
        const unsubs: Array<Unsubscriber> = [];
        let previousArray: Array<T> | undefined;
        let disposed = false;

        unsubs.push(
            collection.subscribe(($collection) => {
                const newArray = [...$collection];
                apply(
                    nodesStore,
                    anchor,
                    previousArray,
                    newArray,
                    buildItemContent,
                    useDiffing,
                    updateDomMode,
                    getItemKeyFn(previousArray, newArray, getItemKey)
                );
                previousArray = [...$collection];
            })
        );

        return disposable(nodesStore, () => {
            if (!disposed) {
                unsubs.splice(0).forEach((unsub) => unsub());
                dispose(nodesStore.get());
                disposed = true;
            }
        });
    };

    return {
        each,
    };
};
