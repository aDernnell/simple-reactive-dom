import { isElement, isText } from '../../utils';
import { domOp, DomUpdateMode, replaceBy } from '../dom/operation';
import { HtmlLiterals, isHtmlLiterals, node } from '../template/tag';

export type DomTargetWrapper = {
    el?: Element;
    text?: Text;
    array?: Array<Element | Text>;
};

/**
 * Initie ou met à jour la cible DOM en fonction de la valeur du store lié.
 * Met à jour la référence vers la nouvelle cible DOM du binding dans l'objet `target` si elle est remplacée.
 * La cible peut changer de type en fonction de la valeur du store lié.
 * Par exemple un tableau sera injecté différemment en fonction de son contenu :
 * * si vide -> noeud texte vide
 * * si non vide -> liste de noeuds
 *
 * @param target objet contenant la référence vers la cible du binding dans le DOM
 * @param value nouvelle valeur (du store lié) à appliquer à la cible
 * @param bindingKey clé du binding concerné
 * @param updateDomMode mode de mise à jour du DOM
 * @param serializeFn fonction de sérialisation des types contenus dans les stores
 */
export const updateDomTarget = (
    target: DomTargetWrapper,
    value: Node | HtmlLiterals | Array<Element> | any,
    bindingKey: string,
    updateDomMode: DomUpdateMode,
    serializeFn: (value: any, key: string) => string
) => {
    // Mise à jour ou remplacement d'un noeud Element
    if (target.el) {
        if (isElement(value)) {
            elementToElement(target, value, updateDomMode);
        } else if (isText(value)) {
            elementToText(target, value, updateDomMode);
        } else if (isHtmlLiterals(value)) {
            let newNode = node(value);
            if (isElement(newNode)) {
                elementToElement(target, newNode, updateDomMode);
            } else {
                elementToText(target, newNode as Text, updateDomMode);
            }
        } else {
            elementToText(target, serializeFn(value, bindingKey), updateDomMode);
        }
    }
    // Mise à jour ou remplacement d'un noeud Text
    else if (target.text) {
        if (isElement(value)) {
            textToElement(target, value, updateDomMode);
        } else if (isText(value)) {
            textToText(target, value, updateDomMode);
        } else if (isHtmlLiterals(value)) {
            let newNode = node(value);
            if (isElement(newNode)) {
                textToElement(target, newNode, updateDomMode);
            } else {
                textToText(target, newNode as Text, updateDomMode);
            }
        } else if (Array.isArray(value) && value.length) {
            textToArray(target, mapArray(value, bindingKey, serializeFn), updateDomMode);
        } else if(Array.isArray(value)) { // Empty array
            textToText(target, '', updateDomMode);
        } else {
            textToText(target, serializeFn(value, bindingKey), updateDomMode);
        }
    }
    // Mise à jour ou remplacement d'une liste de noeuds
    else if (target.array && target.array.length) {
        if (Array.isArray(value) && value.length) {
            arrayToArray(target, mapArray(value, bindingKey, serializeFn), updateDomMode);
        } else if (Array.isArray(value)) { // Empty array
            arrayToText(target, '', updateDomMode);
        } else if (isText(value)) {
            arrayToText(target, value, updateDomMode);
        }
    }
    // Initialisation : création de la représentation DOM de la valeur initiale
    else {
        if (isHtmlLiterals(value)) {
            // ⚠ Si le HTML literals est le même, le noeud sera le même !
            const n = node(value);
            if (isElement(n)) {
                target.el = n;
            } else if (isText(n)) {
                target.text = n;
            }
        } else if (isElement(value)) {
            target.el = value;
        } else if (isText(value)) {
            target.text = value;
        } else if (Array.isArray(value) && value.length) {
            target.array = mapArray(value, bindingKey, serializeFn);
        } else if(Array.isArray(value)) { // Empty array
            target.text = document.createTextNode('');
        } else {
            target.text = document.createTextNode(serializeFn(value, bindingKey));
        }
    }
};

/**
 * Convertit une liste de noeuds, de HtmlLiterals ou tout autre objets en une liste de noeuds.
 * Le type des éléments de la liste est inféré à partir du premier élément.
 * Les éléments de la liste sont considérés comme étant tous du même type.
 * @param array 
 * @param bindingKey 
 * @param serializeFn 
 * @returns 
 */
const mapArray = (
    array: Array<Element | Text | HtmlLiterals | any>,
    bindingKey: string,
    serializeFn: (value: any, key: string) => string
): Array<Element | Text> => {
    const firstElement = array[0];
    if (isElement(firstElement) || isText(firstElement)) {
        return array as Array<Element | Text>;
    } else if (isHtmlLiterals(firstElement)) {
        return array.map((htmlLiterals) => node(htmlLiterals)) as Array<Element | Text>;
    } else {
        return array.map((item) => document.createTextNode(serializeFn(item, bindingKey))) as Array<Text>;
    }
};

const elementToElement = (target: DomTargetWrapper, replacement: Element, updateDomMode: DomUpdateMode) => {
    if (replacement !== target.el) {
        domOp(replaceBy(target.el!, replacement), updateDomMode);
        target.el = replacement;
    }
};

const elementToText = (target: DomTargetWrapper, replacement: string | Text, updateDomMode: DomUpdateMode) => {
    const textNode = isText(replacement) ? replacement : document.createTextNode(replacement);
    domOp(replaceBy(target.el!, textNode), updateDomMode);
    target.el = undefined;
    target.text = textNode;
};

const textToElement = (target: DomTargetWrapper, replacement: Element, updateDomMode: DomUpdateMode) => {
    domOp(replaceBy(target.text!, replacement), updateDomMode);
    target.text = undefined;
    target.el = replacement;
};

const textToArray = (target: DomTargetWrapper, replacement: Array<Element | Text>, updateDomMode: DomUpdateMode) => {
    domOp(replaceBy(target.text!, replacement), updateDomMode);
    target.text = undefined;
    target.array = replacement;
};

const textToText = (target: DomTargetWrapper, replacement: string | Text, updateDomMode: DomUpdateMode) => {
    if (replacement !== target.text) {
        if (isText(replacement)) {
            domOp(replaceBy(target.text!, replacement), updateDomMode);
            target.text = replacement;
        } else {
            domOp(() => {
                target.text!.textContent = replacement;
            }, updateDomMode);
        }
    }
};

const arrayToArray = (
    target: DomTargetWrapper,
    replacement: Array<Element | Text>,
    updateDomMode: DomUpdateMode
) => {
    domOp(replaceBy(target.array!, replacement), updateDomMode);
    target.array = replacement;
};

const arrayToText = (target: DomTargetWrapper, replacement: string | Text, updateDomMode: DomUpdateMode) => {
    const textNode = isText(replacement) ? replacement : document.createTextNode(replacement);
    domOp(replaceBy(target.array!, textNode), updateDomMode);
    target.array = undefined;
    target.text = textNode;
};
