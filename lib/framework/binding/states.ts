import { Readable } from '../../stores';
import { isElement, isText } from '../../utils';
import { domOp, DomUpdateMode, replaceBy } from '../dom/operation';
import { bindAttrValue, Binding, bindNodeValue, bindOrphanTextNodeValue } from './bind';
import { DomTargetWrapper } from './target';
import { splitTemplate } from './parse';

export enum BindingContext {
    ATTR_VALUE,
    CHILD_TEXT,
    ORPHAN_TEXT,
}

/**
 * Lie les valeurs des stores aux placeholders du noeud Text.
 * Découpe le noeud Text en un ensemble de noeuds afin de permettre la mise à jour unitaire de chaque store dans le DOM
 * et de permettre l'injection de noeuds ou de listes de noeuds en plus des valeurs primitives.
 * Cette fonction est utilisée en cas de noeud texte enfant, car dans ce cas il est possible de le découper en plusieurs noeuds qui seront rattachés au parent.
 * Ex:
 * ```html
 * <div>bla bla #{store1} #{store2} bla bla</div>
 * ```
 * ```js
 * tmplTextNode = Text('bla bla #{store1} #{store2} bla bla')
 * nodes = [Text('bla bla '), ..., Text(' bla bla')]
 * ```
 * Les valeurs de stores['store1'] et de stores['store2'] sont injectées dans les placeholders respectifs #{store1} et #{store2}.
 * Chaque placeholder est remplacé par un noeud (Text ou Element) ou une liste de noeuds représentant la valeur du store.
 * Si updateDomMode est 'batched', la mise à jour d'un noeud est asynchrone et n'est effectuée qu'une seule fois si le store est mis à jour plusieurs fois dans la même microtask.
 * Si updateDomMode est 'eager', la mise à jour d'un noeud est synchrone et est effectuée autant de fois que de mise à jour du store au sein de la même microtask.
 *
 * @param tmplTextNode noeud texte concerné
 * @param stores les stores contenant les valeurs à injecter
 * @param updateDomMode mode de maj du DOM
 * @param serializeFn fonction de sérialisation des types contenus dans les stores
 * @returns les nouveaux nodes qui remplacent tmplTextNode ainsi qu'un tableau d'objets bindings triés dans leur ordre d'apparition dans le template.
 */
const bindChildTextNode = (
    tmplTextNode: Text,
    stores: { [key: string]: Readable<any> },
    updateDomMode: DomUpdateMode,
    serializeFn: (value: any, key: string) => string,
    bindingCounter: { index: number }
): { nodes: Array<Node>; bindings: Array<Binding> } => {
    const nodes: Array<Node> = [];
    const bindings: Array<Binding> = [];

    const template = tmplTextNode.textContent ?? '';

    const parts = splitTemplate(template);

    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (part.type == 'lit') {
            // Literal part
            nodes.push(document.createTextNode(part.value));
        } else {
            // Binding part
            const key = part.value;
            const store = stores[key];
            const target: DomTargetWrapper = {};
            if (store) {
                bindings.push(bindNodeValue(target, key, store, updateDomMode, serializeFn, bindingCounter)!);
                // La première fois que target est défini, on doit insèrer le ou les noeuds dans le DOM
                target.array ? nodes.push(...target.array) : nodes.push(target.el ?? target.text!);
            }
        }
    }

    return { nodes, bindings };
};

// fonction de sérialisation par défaut
export const defaultSerializeFn = (value: any, _context?: BindingContext, _key?: string): string => {
    // https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Operators/typeof
    switch (typeof value) {
        case 'undefined':
            return 'undefined';
        // @ts-expect-error Fallthrough is intended
        case 'object':
            if (value === null) return 'null';
        // Fallthrough for non null objects
        case 'symbol':
        case 'function':
            return `[${typeof value}]`;
        case 'string':
        case 'number':
        case 'bigint':
        case 'boolean':
            return `${value}`;
    }
};

// fonction de sérialization globale
let globalSerializeFn: (value: any, context?: BindingContext, key?: string) => string = defaultSerializeFn;

export const getGlobalSerializer = (): (value: any, context?: BindingContext, key?: string) => string => {
    return globalSerializeFn;
}

/**
 * Permet de définir une fonction de sérialisation partielle de manière globale
 * @param partSerializeFn fonction de sérialisation partielle (ne sérialise que certians types et passe les autres tels quels)
 */
export const setGlobalSerializer = (
    partSerializeFn?: (value: any, context?: BindingContext, key?: string) => any
): void => {
    // la fonction de sérialization globale est un chaînage fonction partielle > fonction par défaut
    // i.e le résultat de la fonction partielle est passée en entrée de la fonction par défaut afin de couvrir tous les cas.
    // Si la fonction partielle n'est pas renseignée alors fonction globale = fonction par défaut
    globalSerializeFn = (value, context, key) =>
        defaultSerializeFn(partSerializeFn ? partSerializeFn(value, context, key) : value, context, key);
};

/**
 * Parcourt récursivement les noeuds de l'élément pour trouver
 * - les noeuds contenant des attributs qui contiennent '#{state}' dans leur valeur.
 * - les noeuds dont le contenu textuel contient '#{state}' dans sa valeur.
 *
 * Puis lie les valeurs aux stores fournis en paramètre.
 *
 * @param root élément à parcourir
 * @param stores ensemble des stores des valeurs à lier
 * @param options (optionel) objet contenant les options :
 * - serializer: fonction permettant de sérialiser un ou plusieurs types
 * - updateDomMode:
 * 'eager' => les mises à jour sont synchrones mais non optimisées.
 * 'batched' => les maj sont asynchrones et exécutées par lot dans une microtask, certaines opérations sont optimisées.
 * @returns une liste de stores liés qui désouscrivent aux mises à jour lors de leur destruction via dispose().
 */
export const bindStates = (
    root: Node,
    stores: { [key: string]: Readable<any> },
    options?: {
        serializer?: (value: any, context?: BindingContext, key?: string) => any;
        updateDomMode?: DomUpdateMode;
    }
): Array<Binding> => {
    const bindings: Array<Binding> = [];

    // Compteur de bindings pour définir la position absolue dans le template de chaque binding
    const bindCounter = {
        index: 0,
    };

    // Serialise la valeur en chaîne de caractères
    const serializeFn = (value: any, context: BindingContext, key: string): string => {
        // Chaînage vers la fonction globale afin de couvrir les cas non gérés par la fonction de sérialisation partielle
        return globalSerializeFn(options?.serializer ? options.serializer(value, context, key) : value, context, key);
    };

    const updateDomMode = options?.updateDomMode ?? DomUpdateMode.BATCHED;

    const handleElementNode = (element: Element) => {
        // L'ordre des attributs est conservé tel qu'ils apparaissent dans le code HTML source
        // c'est important pour garantir que le tableau des bindings résultant est trié dans l'ordre d'apparition des bindings dans le template.
        Array.from(element.attributes ?? []).forEach((attr) => {
            if (attr.value.includes('#{')) {
                // Les bindings sont retournés dans leur ordre d'apparition dans le template
                bindings.push(
                    ...bindAttrValue(
                        attr,
                        attr.value,
                        stores,
                        updateDomMode,
                        (value: any, key: string) => serializeFn(value, BindingContext.ATTR_VALUE, key),
                        bindCounter
                    )
                );
            }
        });
    };

    const handleChildTextNode = (text: Text) => {
        const { nodes: replacingNodes, bindings: newBindings } = bindChildTextNode(
            text,
            stores,
            updateDomMode,
            (value: any, key: string) => serializeFn(value, BindingContext.CHILD_TEXT, key),
            bindCounter
        );
        // Les bindings sont retournés dans leur ordre d'apparition dans le template
        bindings.push(...newBindings);
        // Il faut remplacer le noeud texte par les nouveaux noeuds créés initialement,
        // ensuite les maj du dom se font automatiqueemnt via les bindings
        domOp(replaceBy(text, replacingNodes), updateDomMode);
    };

    const handleOrphanTextNode = (text: Text) => {
        // Les bindings sont retournés dans leur ordre d'apparition dans le template
        bindings.push(
            ...bindOrphanTextNodeValue(
                text,
                text.textContent ?? '',
                stores,
                updateDomMode,
                (value: any, key: string) => serializeFn(value, BindingContext.ORPHAN_TEXT, key),
                bindCounter
            )
        );
    };

    // https://developer.mozilla.org/en-US/docs/Web/API/Document/createTreeWalker
    // L'ordre des noeuds est conservé tel qu'ils apparaissent dans le DOM.
    // C'est important pour garantir que le tableau des bindings résultant est trié dans l'ordre d'apparition des bindings dans le template.
    const treeWalker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    do {
        const currNode = treeWalker.currentNode;
        if (isElement(currNode)) {
            handleElementNode(currNode);
        }
        // Un noeud texte racine doit être géré différemment car il faut s'assurer qu'on obtient un noeud unique après application des bindings
        else if (isText(currNode) && currNode == root) {
            handleOrphanTextNode(currNode);
        } else if (currNode.textContent?.includes('#{')) {
            handleChildTextNode(currNode as Text);
        }
    } while (treeWalker.nextNode());

    return bindings;
};
