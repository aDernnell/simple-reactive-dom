import { ActionAttr, ConditionalAttr, EventHandler, isActionAttr, isConditionalAttr, isEventHandler, isProp, Prop } from '../template';
import { BINDING_AGGREGATE } from './bind';

const escapeRegex = (value: string) => {
    return value.replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&');
};

/**
 * Récupère toutes les clés de binding dans un template textuel.
 * par exemple dans 'some text #{key1} some text #{key2} some text' on obtient ['key1', 'key2']
 * De même pour 'some text #{0:0} some text #{1:1} some text #{0:2}' on obtient ['0','1'].
 * L'ordre des clés dans le tableau retourné est conservé par rapport au template.
 *
 * @param template string
 * @returns toutes les clés trouvées
 */
export const extractTemplateKeys = (template: string): Array<string> => {
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Regular_expressions/Lookbehind_assertion
    // https://regex101.com/r/tg0DFK/1
    const allKeys = template.match(/(?<=#{)(\s*[a-zA-Z0-9_-]+\s*)/g)?.map((key) => key.trim());
    // Suppression des doublons potentiels
    return allKeys ? [...new Set(allKeys)] : [];
};

/**
 * Découpe un template textuel en une liste de parties literales et de bindings.
 * Une partie literale est décrite par sa valeur textuelle, un binding par sa clé.
 * Par exemple pour le template 'some text #{key1} some text #{key2} some text', on obtient
 * [{value:'some text ', type:'lit'}, {value:'key1', type:'bind'}, {value:' some text ', type:'lit'}, {value:'key2', type:'bind'}, {value:' some text', type:'lit'}]
 * De même pour le template 'some text #{0:0} some text #{1:1} some text #{0:2}', on obtient
 * [{value:'some text ', type:'lit'}, {value:'0', type:'bind'}, {value:' some text ', type:'lit'}, {value:'1', type:'bind'}, {value:' some text', type:'lit'}, {value:'0', type:'bind'}].
 *
 * @param template le contenu textuel du noeud à découper
 * @returns tableau d'objets literal ou binding
 */
export const splitTemplate = (template: string): Array<{ type: 'lit' | 'bind'; value: string }> => {
    const parts: Array<{ type: 'lit' | 'bind'; value: string }> = [];
    // https://regex101.com/r/LTwGTO/1
    const regex = /#{\s*([a-zA-Z0-9_-]+)(\s*:\s*[0-9]+)?\s*}/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(template)) !== null) {
        // Ajout de la partie literale avant un binding
        if (lastIndex < match.index) {
            parts.push({ type: 'lit', value: template.slice(lastIndex, match.index) });
        }
        // Ajout du binding
        parts.push({ type: 'bind', value: match[1] });
        lastIndex = regex.lastIndex;
    }

    // Ajout de la partie literale après le dernier binding
    if (lastIndex < template.length) {
        parts.push({ type: 'lit', value: template.slice(lastIndex) });
    }

    return parts;
};

/**
 * Injecte les valeurs liées dans le template textuel et retourne la nouvelle valeur.
 * Dans le cas d'un attribut de type textuel ou d'un noeud Text : la nouvelle valeur est textuelle (template avec la ou les valeurs injectées),
 * Dans le cas d'un attribut de type event handler : la nouvelle valeur est un objet contenant une fonction gestionnaire d'évènement et l'évènement concerné.
 * Dans le cas d'un attribut de type conditionnel : la nouvelle valeur est un objet contenant une condition (booléen) et l'attribut concerné.
 *
 * @param value valeur ou ensemble de valeurs à injecter dans le template
 * @param keys clés des bindings à injecter dans le template
 * @param template template textuel contenant les placeholders #{key}
 * @param attrName nom de l'attribut concerné (undefined si le binding concerne un noeud Text)
 * @param serializeFn fonction de sérialisation des valeurs à injecter dans le template
 * @return la nouvelle valeur du template textuel avec les valeurs injectées
 */
export const injectValuesInTemplate = (
    value: any | { [key: string]: any },
    keys: Array<string>,
    template: string,
    attrName: string | undefined,
    serializeFn: (value: any, key: string) => string
): EventHandler | ConditionalAttr | ActionAttr<Node, object> | Prop<unknown> | string => {
    let newValue: EventHandler | ConditionalAttr | ActionAttr<Node, object> | Prop<unknown> | string = template;
    // Cas particulier d'un attribut de type conditionnel
    if (isConditionalAttr(value) && attrName) {
        newValue = value;
    }
    // Cas particulier d'un attribut de type action
    else if (isActionAttr(value) && attrName) {
        newValue = value;
    }
    // Cas particulier d'un attribut de type propriété
    else if (isProp(value) && attrName) {
        newValue = value;
    }
    // Cas particulier d'un attribut de type gestionnaire d'évènement
    else if (isEventHandler(value) && attrName && attrName.match(/^on[a-z]+$/)) {
        value.eventName = attrName?.slice(2); // Suppression du préfixe 'on' pour obtenir le nom de l'événement
        newValue = value;
    }
    // Cas d'une valeur aggrégée (plusieurs valeurs injectées dans un attribut ou un noeud Text)
    else if (typeof value == 'object' && value != null && value.hasOwnProperty(BINDING_AGGREGATE)) {
        // Injection des valeurs issues de l'objet { [key: string]: val }
        // dans chaque placeholder #{key} correspondant (ou #{key:position}, le suffix :position étant ignoré)
        // voir https://regex101.com/r/rV3ruX/1 pour la regex,
        // un double échapement \\ est nécessaire en raison du template litteral
        Object.keys(value).forEach((key) => {
            newValue = (newValue as string).replace(
                new RegExp(`#{\\s*${escapeRegex(key)}(\\s*:\\s*[0-9]+)?\\s*}`, 'g'),
                serializeFn(value[key], key)
            );
        });
    }
    // Cas d'un valeur simple (une seule valeur injectée dans un attribut ou un noeud Text)
    else {
        // Injection de la valeur dans le placeholder #{key} (ou #{key:position}, le suffix :position étant ignoré)
        // voir https://regex101.com/r/rV3ruX/1 pour la regex,
        // un double échapement \\ est nécessaire en raison du template litteral
        newValue = newValue.replace(
            new RegExp(`#{\\s*${escapeRegex(keys[0])}(\\s*:\\s*[0-9]+)?\\s*}`, 'g'),
            serializeFn(value, keys[0])
        );
    }
    return newValue;
};

/**
 * Découpe le template textuel, référence les bindings par leur position globale dans le template literals
 * et génère un tableau des clés de bindings non dédupliquées (une clé par placeholder dans le template).
 *
 * @param templateOrKey template textuel contenant les placeholders '#{key}' ou clé de binding unique 'key'
 * @param bindingCounter compteur de bindings pour générer des indices uniques et correspondants à la position globale des bindings dans le template lierals
 * @returns un tableau contenant :
 * à l'indice 0 : la description du template découpé (tableau de strings pour les literals + tableau d'indices globaux pour les bindings)
 * à l'indice 1 : le tableau des clés de bindings non dédupliquées
 */
export const getDomLinkTmplDescriptor = (
    templateOrKey: string,
    bindingCounter: { index: number } = { index: 0 }
): [{ strings: Array<string>; bindingIndices: Array<number> }, Array<string>] => {
    const strings: Array<string> = [];
    const bindingIndices: Array<number> = [];
    const bindingKeys: Array<string> = [];
    let baseIndex = bindingCounter.index;

    const isTemplate = templateOrKey.match(/.*#{.+}.*/) !== null;
    if (isTemplate) {
        const parts = splitTemplate(templateOrKey);
        if (parts.length > 0) {
            if (parts[0].type === 'bind') {
                strings.push('');
            }
            strings.push(...parts.filter((part) => part.type === 'lit').map((part) => part.value));
            parts
                .filter((part) => part.type === 'bind')
                .forEach((part, i) => {
                    bindingIndices.push(baseIndex + i);
                    bindingKeys.push(part.value);
                });
        }
    } else {
        // Si c'est une clé de binding unique, on l'ajoute comme un template simple
        strings.push('');
        bindingIndices.push(baseIndex);
        bindingKeys.push(templateOrKey);
    }

    return [{ strings, bindingIndices }, bindingKeys];
};
