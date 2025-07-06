import { derived, Readable, Unsubscriber } from '../../stores';
import { createDomDebouncer, domOp, DomUpdateMode } from '../dom/operation';
import { disposable, dispose } from '../lifecycle/disposable';
import { EventHandler, isConditionalAttr, isEventHandler } from '../template';
import { DomTargetWrapper, updateDomTarget } from './target';
import { extractTemplateKeys, injectValuesInTemplate, getDomLinkTmplDescriptor } from './parse';

/**
 * Objet représentant le lien entre un ensemble de bingings et le DOM.
 * Le lien peut être direct lorsque qu'un binding store entraine sa propre mise à jour du DOM,
 * ou indirect lorsque qu'un binding entraine la mise à jour du DOM par l'intermédiaire d'un store dérivé aggrégeant un ensemble de binding stores.
 */
export type DomLink = {
    /**
     * Store dont la mise à jour entraine la modification du DOM.
     * Dans le cas d'un attribut ou d'un noeud Text orphelin contenant plusieurs binding stores, il s'agit d'un store dérivé aggrégeant l'ensemble des binding stores
     * car le contenu de l'attribut ou du noeud Text orphelin est entièrement remplacé en cas de mise à jour d'un binding store (lien indirect).
     * Si la valeur de l'attribut ou du noeud Text orphelin est composée uniquement d'un binding store, alors il s'agit de ce binding store (lien direct).
     * De même pour les noeuds Text enfants, où chaque maj de binding store implique sa propre mise à jour du DOM, il s'agit du binding store en question (lien direct).
     */
    store: Readable<unknown>;

    /**
     * Cible de liaison dans le DOM.
     * Dans le cas d'un binding sur la valeur d'un attribut, il s'agit de l'attribut lui-même.
     * Dans le cas d'un binding dans un noeud Text orphelin, il s'agit du noeud Text orphelin lui-même.
     * Dans le cas d'un binding dans un noeud Text enfant, il s'agit d'un objet contenant les références vers les noeuds Element ou Text créés.
     */
    target?: /* Attribut */ Attr | /* Noeud Text orphelin */ Text | /* Noeud Text enfant */ DomTargetWrapper;

    /**
     * Template découpé associé au lien, et donc au store.
     * Permet de reconstruire la souscription pour mise à jour du DOM en cas de changement d'un binding store.
     */
    tmpl: {
        strings: Array<string>; // parties litérales du template
        bindingIndices: Array<number>; // positions globales des bindings dans le template literals
    };
};

/**
 * Objet qui encapsule un store lié (binding store) et le lien avec le DOM associé.
 * Un objet Binding est créé pour chaque placeholder #{key} du template.
 */
export type Binding = {
    /**
     * Store lié (binding store)
     */
    store: Readable<unknown>;
    /**
     * Lien entre le store et le DOM.
     * Peut être direct, auquel cas domLink.store = this.store,
     * ou indirect, auquel cas domLink.store est un store dérivé aggrégeant un ensemble de binding stores dont this.store.
     */
    domLink?: DomLink;
};

export const BINDING_AGGREGATE = Symbol.for('binding_aggregate');
export const DOM_TARGET = Symbol.for('dom_target');
export const TMPL = Symbol.for('tmpl');

/**
 * Définit le store associé à la mise à jour du DOM.
 * Il peut s'agir d'un store dérivé aggrégeant un ensemble de binding stores si le template contient plusieurs bindings,
 * ou de l'unique binding store si le template ne contient qu'un seul binding.
 *
 * Exemple: pour le template 'some text #{key1} some text #{key2} some text',
 * on obtient un store dérivé de stores[key1] et stores[key2]
 *
 * @param keys les clés des bindings du template
 * @param stores les stores associés à l'ensemble des clés
 * @returns le store associé à la mise à jour du DOM
 */
const getDomLinkStore = (
    keys: Array<string>,
    stores: { [key: string]: Readable<any> }
): Readable<any | { [key: string]: any }> | undefined => {
    let domLinkStore: Readable<unknown> | undefined = undefined;

    // Le template contient plusieurs bindings :
    // création d'un store dérivé de tous les stores[key] trouvés
    if ((keys?.length ?? 0) > 1) {
        const validKeys = keys!.filter((key) => stores[key] !== undefined);
        const subStores = validKeys.map((key) => stores[key]);
        domLinkStore = derived(
            subStores,
            (values) => {
                const obj: { [key: string | symbol]: any } = Object.fromEntries(
                    validKeys.map((key, i) => [key, values[i]])
                );
                obj[BINDING_AGGREGATE] = true;
                return obj;
            },
            undefined
        );
    } else if ((keys?.length ?? 0) == 1) {
        // le template ne contient qu'un seul binding,
        // le store dérivé est égal à l'unique store concerné par le binding
        domLinkStore = stores[keys![0]];
    }

    return domLinkStore;
};

/**
 * Construit les métadonnées de liaison pour un template textuel.
 * Ces métadonnées sont constituées d'un objet Binding par placeholder dans le template.
 *
 * @param templateOrKey template textuel contenant les placeholders #{key} ou clé de binding unique 'key'
 * @param stores les stores contenant les valeurs à injecter
 * @param domTarget cible de liaison dans le DOM
 * @param domLinkStore store qui entraine la mise à jour du DOM pour ce template
 * @param domLinkDisposeFn fonction de nettoyage du DomLink, appelée lors de sa destruction
 * @param bindingCounter compteur de bindings du template literals pour incrémenter le nombre de bindings créés
 * @returns un tableau d'objets Binding triés dans leur ordre d'apparition dans le template.
 */
const createBindingMetadata = (
    templateOrKey: string,
    stores: { [key: string]: Readable<any> },
    domTarget: Attr | Text | DomTargetWrapper,
    domLinkStore: Readable<any> | undefined,
    domLinkDisposeFn: (domLink: DomLink) => void,
    bindingCounter?: { index: number }
): Array<Binding> => {
    if (domLinkStore == undefined) return [];
    const bindings: Array<Binding> = [];
    const [tmplDescr, keys] = getDomLinkTmplDescriptor(templateOrKey, bindingCounter);
    const domLink: DomLink = {
        store: domLinkStore,
        target: domTarget,
        tmpl: tmplDescr,
    };
    disposable(domLink, () => domLinkDisposeFn(domLink));
    bindings.push(
        ...keys.map(
            (bindingKey) => (
                bindingCounter && bindingCounter.index++,
                disposable(
                    {
                        store: stores[bindingKey],
                        domLink,
                    },
                    // Disposer un Binding revient à disposer le DomLink associé
                    () => dispose(domLink)
                )
            )
        )
    );
    return bindings;
};

/**
 * Lie les valeurs des stores aux placeholders de l'attribut.
 * Ex:
 * ```html
 * <div data-attr="#{store1} #{store2}"></div>
 * ```
 * Les valeurs de stores['store1'] et de stores['store2'] sont injectées au format textuel dans les placeholders respectifs #{store1} et #{store2}.
 * La valeur de l'attribut est entièrement remplacée en cas de mise à jour d'un store.
 * Si updateDomMode est 'batched', la mise à jour de l'attribut est asynchrone et n'est effectuée qu'une seule fois si plusieurs stores sont mis à jour dans la même microtask.
 * Si updateDomMode est 'eager', la mise à jour de l'attribut est synchrone et est effectuée autant de fois que de store mis à jour au sein d'une même microtask.
 *
 * @param node noeud contenant l'attribut
 * @param attr l'attribut concerné
 * @param template le contenu textuel de l'attribut contenant les placeholders #{key}
 * @param stores les stores contenant les valeurs à injecter
 * @param updateDomMode mode de maj du DOM
 * @param serializeFn fonction de sérialisation des types contenus dans les stores
 * @param bindingCounter compteur de bindings pour incrémenter le nombre de bindings créés
 * @returns tableau d'objets bindings triés dans leur ordre d'apparition dans le template.
 */
export const bindAttrValue = (
    attr: Attr,
    template: string,
    stores: { [key: string]: Readable<any> },
    updateDomMode: DomUpdateMode,
    serializeFn: (value: any, key: string) => string,
    bindingCounter?: { index: number }
): Array<Binding> => {
    let unsub: Unsubscriber | undefined;

    const node = attr.ownerElement!;
    const keys = extractTemplateKeys(template);
    const domLinkStore = getDomLinkStore(keys, stores);

    let previousListener: EventHandler | undefined;
    if (domLinkStore) {
        const debouncer = updateDomMode == DomUpdateMode.BATCHED ? createDomDebouncer() : undefined;
        // Liaison du store à la valeur de l'attribut
        unsub = domLinkStore.subscribe((value) => {
            const attrValue = injectValuesInTemplate(value, keys, template, attr.name, serializeFn);
            // attribut de type event handler
            if (isEventHandler(attrValue)) {
                // Suppression du gestionnaire d'évènement inline
                attr.name in node && ((node as any)[attr.name] = null);
                domOp(
                    () => {
                        // Suppression de l'attribut placeholder (ne fait rien si l'attribut a déjà été supprimé)
                        node.removeAttribute(attr.name);
                        // Suppression de l'ancien listener s'il existe
                        previousListener &&
                            previousListener.handler &&
                            node.removeEventListener(previousListener.eventName!, previousListener.handler);
                        previousListener = undefined;
                        // Ajout du nouveau listener si besoin
                        if (attrValue.handler) {
                            node.addEventListener(attrValue.eventName!, attrValue.handler);
                            previousListener = attrValue;
                        }
                    },
                    updateDomMode,
                    debouncer
                );
            }
            // attribut de type conditionnel
            else if (isConditionalAttr(attrValue)) {
                domOp(
                    () => (attrValue.cond ? node.setAttribute(attr.name, '') : node.removeAttribute(attr.name)),
                    updateDomMode,
                    debouncer
                );
            }
            // attribut de type textuel
            else {
                domOp(() => node.setAttribute(attr.name, attrValue as string), updateDomMode, debouncer);
            }
        });
    }

    return createBindingMetadata(
        template,
        stores,
        attr,
        domLinkStore,
        (domLink: DomLink) => {
            unsub?.();
            // Si previousListener existe lors de l'appel à dispose, on doit le supprimer du noeud
            previousListener &&
                previousListener.handler &&
                node.removeEventListener(previousListener.eventName!, previousListener.handler);
            delete domLink.target;
        },
        bindingCounter
    );
};

/**
 * Lie les valeurs des stores aux placeholders du noeud Text.
 * Le noeud Text n'est pas découpé et l'ensemble du contenu textuel du noeud text est remplacé en cas de modification d'un store lié.
 * Cette fonction est utilisée en cas de noeud texte orphelin (sans parent), car dans ce cas il n'est pas possible de le découper en plusieurs noeuds.
 * Ex:
 * ```html
 * bla bla #{store1} #{store2} bla bla
 * ```
 * Les valeurs de stores['store1'] et de stores['store2'] sont injectées au format textuel dans les placeholders respectifs #{store1} et #{store2}.
 * La valeur textuelle du noeud Text est entièrement remplacée en cas de mise à jour d'un store.
 * Si updateDomMode est 'batched', la mise à jour du noeud est asynchrone et n'est effectuée qu'une seule fois si plusieurs stores sont mis à jour dans la même microtask.
 * Si updateDomMode est 'eager', la mise à jour du noeud est synchrone et est effectuée autant de fois que de store mis à jour au sein d'une même microtask.
 *
 *
 * @param textNode noeud texte concerné
 * @param template le contenu textuel du noeud texte contenant les placeholders #{key}
 * @param stores les stores contenant les valeurs à injecter
 * @param updateDomMode mode de maj du DOM
 * @param serializeFn fonction de sérialisation des types contenus dans les stores
 * @param bindingCounter compteur de bindings pour incrémenter le nombre de bindings créés
 * @returns tableau d'objets bindings triés dans leur ordre d'apparition dans le template.
 */
export const bindOrphanTextNodeValue = (
    textNode: Text,
    template: string,
    stores: { [key: string]: Readable<any> },
    updateDomMode: DomUpdateMode,
    serializeFn: (value: any, key: string) => string,
    bindingCounter?: { index: number }
): Array<Binding> => {
    let unsub: Unsubscriber | undefined;

    const keys = extractTemplateKeys(template);
    const domLinkStore = getDomLinkStore(keys, stores);

    if (domLinkStore) {
        const debouncer = updateDomMode == DomUpdateMode.BATCHED ? createDomDebouncer() : undefined;
        // Liaison du store à la valeur du noeud texte
        unsub = domLinkStore.subscribe((value) => {
            const textNodeValue = injectValuesInTemplate(value, keys, template, undefined, serializeFn) as string;
            domOp(() => (textNode.textContent = textNodeValue), updateDomMode, debouncer);
        });
    }

    return createBindingMetadata(
        template,
        stores,
        textNode,
        domLinkStore,
        (domLink: DomLink) => {
            unsub?.();
            delete domLink.target;
        },
        bindingCounter
    );
};

/**
 * Lie la valeur du store à la cible dans le DOM (noeud ou ensemble de noeuds)
 * Utilisé pour les placeholders situés dans un noeud Text enfant car le remplacement de la cible nécessite un noeud parent.
 *
 * @param target cible de liaison dans le DOM
 * @param key clé du store lié
 * @param bindingStore store lié à la cible dans le DOM
 * @param updateDomMode mode de maj du DOM
 * @param serializeFn fonction de sérialisation des types contenus dans les stores
 * @param bindingCounter compteur de bindings pour incrémenter le nombre de bindings créés
 * @returns l'objet Binding créé ou undefined si aucun binding réalisé
 */
export const bindNodeValue = (
    target: DomTargetWrapper,
    key: string,
    bindingStore: Readable<any>,
    updateDomMode: DomUpdateMode,
    serializeFn: (value: any, key: string) => string,
    bindingCounter?: { index: number }
): Binding | undefined => {
    let unsub: Unsubscriber | undefined;

    if (bindingStore) {
        // Liaison du store à la cible dans le DOM
        unsub = bindingStore.subscribe((value) => {
            // Lors du premier appel target est mis à jour, mais pas le DOM, il faut insérer le ou les noeuds target manuellement dans le DOM
            // Lors des appels suivants, si le ou les noeuds target ont bien été inséré, le DOM sera mis à jour automatiquement
            updateDomTarget(target, value, key, updateDomMode, serializeFn);
        });
    }

    return createBindingMetadata(
        key,
        { [key]: bindingStore },
        target,
        bindingStore,
        (domLink: DomLink) => {
            unsub?.();
            delete domLink.target;
        },
        bindingCounter
    )[0];
};
