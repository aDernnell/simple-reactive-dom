import { isReadable, isWritable, Readable } from '../../stores';
import { DomUpdateMode } from '../dom/operation';
import { dispose, disposeRec } from '../lifecycle/disposable';
import { HtmlLiterals, tmpl } from '../template/tag';
import { DomTargetWrapper } from './target';
import { bindAttrValue, Binding, bindNodeValue, bindOrphanTextNodeValue, DomLink } from './bind';
import { BindingContext, getGlobalSerializer } from './states';

/**
 * Le noeud n'est pas reconstruit, on se contente de mettre à jour les bindings
 * en comparant les valeurs injectées dans l'ancien et le nouveau literals.
 *
 * @param oldLiterals
 * @param newLiterals
 * @param updateDomMode
 * @param serializer
 */
export const rebind = (
    oldLiterals: HtmlLiterals,
    newLiterals: HtmlLiterals,
    updateDomModeOpt?: DomUpdateMode,
    serializerOpt?: (value: any, context?: BindingContext, key?: string) => any
): void => {
    // Serialise la valeur en chaîne de caractères
    const serializeFn = (value: any, context: BindingContext, key?: string): string => {
        // Chaînage vers la fonction globale afin de couvrir les cas non gérés par la fonction de sérialisation partielle
        return getGlobalSerializer()(serializerOpt ? serializerOpt(value, context, key) : value, context, key);
    };

    const updateDomMode = updateDomModeOpt ?? DomUpdateMode.BATCHED;

    const impactedDomLinks: Set<DomLink> = new Set();

    // 1. Mise à jour des valeurs injectées de type simple (même binding store) et collecte des domLinks nécessitant une mise à jour (nouveau binding store)
    for (let i = 0; i < newLiterals.values.length; i++) {
        const newValue = newLiterals.values[i];
        const oldValue = oldLiterals.values[i];
        if (newValue !== oldValue) {
            const bindingStore = oldLiterals.bindings?.[i].store;

            // ⚠ une valeur injectée de type store doit le rester
            if (isReadable(newValue)) {
                const domLink = oldLiterals.bindings?.[i].domLink!;
                impactedDomLinks.add(domLink);
            } else {
                if (isWritable(bindingStore)) {
                    bindingStore.set(newValue);
                    disposeRec(oldValue);
                } else {
                    console.warn(
                        `The value at index ${i} of the literals has changed but the corresponding binding is not writable. The value will not be updated.`
                    );
                }
            }
        }
    }

    // 2. Re-création des domLinks impactés
    impactedDomLinks.forEach((domLink) => {
        const [newTemplate, newBindingStores] = domLinkTmpl(domLink, newLiterals);
        const domTarget = domLink.target!;
        const newBindings: Array<Binding> = [];

        // Nouveau binding sur un attribut
        if ('nodeType' in domTarget && domTarget.nodeType === Node.ATTRIBUTE_NODE) {
            const attr = domTarget as Attr;
            newBindings.push(
                ...bindAttrValue(attr, newTemplate, newBindingStores, updateDomMode, (value: any, key?: string) =>
                    serializeFn(value, BindingContext.ATTR_VALUE, key),
                { index: domLink.tmpl.bindingIndices[0] }
                )
            );
        }
        // Nouveau binding sur un noeud texte orphelin
        else if ('nodeType' in domTarget && domTarget.nodeType === Node.TEXT_NODE) {
            const textNode = domTarget as Text;
            newBindings.push(
                ...bindOrphanTextNodeValue(
                    textNode,
                    newTemplate,
                    newBindingStores,
                    updateDomMode,
                    (value: any, key?: string) => serializeFn(value, BindingContext.ORPHAN_TEXT, key),
                    { index: domLink.tmpl.bindingIndices[0] }
                )
            );
        }
        // Nouveau binding sur un noeud texte enfant
        else {
            const bindingTarget = domTarget as DomTargetWrapper;
            const binding = bindNodeValue(
                bindingTarget,
                Object.keys(newBindingStores)[0],
                Object.values(newBindingStores)[0],
                updateDomMode,
                (value: any, key?: string) => serializeFn(value, BindingContext.CHILD_TEXT, key),
                { index: domLink.tmpl.bindingIndices[0] }
            );
            binding && newBindings.push(binding);
        }

        // Remplacement des bindings dans l'ancien literals réutilisé
        domLink.tmpl.bindingIndices.forEach((bindingIndex, i) => {
            const binding = oldLiterals.bindings?.[bindingIndex];
            if (binding?.domLink !== domLink) {
                console.error(
                    `Binding at index ${bindingIndex} does not match the current DomLink. This may indicate a mismatch in the binding indices.`
                );
            }
            oldLiterals.bindings![bindingIndex] = newBindings[i];
        });

        // Nettoyage du DomLink (un nouveau DomLink a été créé et est stocké dans les nouveaux bindings)
        dispose(domLink);
    });
};

/**
 * Construit le template et l'objet contenant les stores associés à ce DomLink.
 *
 * Le template est construit à partir des literals strings et des positions absolues des bindings contenus dans le DomLink,
 * et il retourne la chaîne de caractères attendue par les fonctions bindAttrValue(), bindOrphanTextNodeValue() ou bindValue().
 *
 * De même, l'objet contenant les stores est construit à partir des positions absolues des bindings du DomLink et des nouvelles valeurs injectées dans newLiterals,
 * et il retourne l'objet attendu par les fonctions de bindAttrValue(), bindOrphanTextNodeValue() ou bindValue().
 *
 * @param domLink - Le DomLink contenant les informations nécessaires pour construire le template et les stores.
 * @param newLiterals - Les nouvelles valeurs injectées dans le template.
 * @return Un tableau contenant le template sous forme de chaîne de caractères et un objet associant les clés des bindings aux stores correspondants.
 */
const domLinkTmpl = (domLink: DomLink, newLiterals: HtmlLiterals): [string, Record<string, Readable<unknown>>] => {
    const tmplBindingIndices: number[] = domLink.tmpl.bindingIndices;
    const tmplStrings: string[] = domLink.tmpl.strings;

    const tmplValues: unknown[] = [];
    // Rempli le tableau tmplValues à partir de tmplBindingIndices et newLiterals.values
    tmplBindingIndices.forEach((bindingIndex) => {
        tmplValues.push(newLiterals.values[bindingIndex]);
    });

    return tmpl(tmplStrings, tmplValues);
};
