import { derived, isReadable, readable, Readable, writable } from '../stores';

const COND_ATTR = Symbol.for('cond_attr');
const EV_HANDLER = Symbol.for('ev_handler');

export type ConditionalAttr = {
    cond: boolean;
    [COND_ATTR]: true;
};

export type EventHandler = {
    handler?: (event: Event) => void;
    eventName?: string;
    [EV_HANDLER]: true;
};

export const isConditionalAttr = (param: unknown): param is ConditionalAttr => {
    return typeof param === 'object' && param !== null && COND_ATTR in param;
};

export const isEventHandler = (param: unknown): param is EventHandler => {
    return typeof param === 'object' && param !== null && EV_HANDLER in param;
};

/**
 * Transforme les valeurs null et undefined en chaîne de caractères vide pour l'affichage
 * @param param valeur ou store de valeur
 * @returns valeur transformée, ou store de valeur transformée
 */
export const opt = (param: unknown): string | unknown => {
    if (isReadable(param)) {
        return derived(param, (value, set) => {
            set(value ?? '');
        });
    } else {
        return param ?? '';
    }
};

/** Signature pour les surcharges de la fonction when() */
export type WhenFn = {
    (store: Readable<unknown>, value: unknown): Readable<ConditionalAttr>;
    (store: Readable<boolean>): Readable<ConditionalAttr>;
    (cond: boolean): ConditionalAttr;
};

/**
 * Créé un objet qui, utilisé en tant que valeur d'un attribut,
 * indique que l'attribut est conditionnel et présise la condition d'ajout/retrait de l'attribut.
 * Cette fonction peut être utilisée pour gérer un attribut conditionnel de type `checked`, `disabled`, etc.
 * Si le paramètre est un store, l'attribut sera ajouté si la valeur du store est égale à `value` (ou `true` par défaut).
 * Si le paramètre est un booléen, l'attribut sera ajouté si la valeur est `true`.
 * @param param store ou boolean
 * @param value valeur du store pour que la condition soit vraie (par défaut `true`)
 * @returns un store contenant un objet ConditionalAttr qui peut être utilisé en tant que valeur d'un attribut HTML
 */
export const when: WhenFn = (param: Readable<unknown> | boolean, value: unknown = true) => {
    return (
        isReadable(param)
            ? derived(param, (v) =>
                  v === value
                      ? ({ cond: true, [COND_ATTR]: true } as ConditionalAttr)
                      : ({ cond: false, [COND_ATTR]: true } as ConditionalAttr)
              )
            : {
                  cond: !!param,
                  [COND_ATTR]: true,
              }
    ) as any;
};

/**
 * Créé un objet qui, utilisé en tant que valeur d'un attribut,
 * indique que l'attribut est un gestionnaire d'événement inline (par exemple `onclick`, `onchange`, etc.).
 * @param handler fonction à appeler lors de l'événement
 * @returns un objet EventHandler qui peut être utilisé en tant que valeur d'un attribut HTML
 */
export const call = (handler?: (event: Event) => void): EventHandler => {
    return {
        handler,
        [EV_HANDLER]: true,
    };
};
