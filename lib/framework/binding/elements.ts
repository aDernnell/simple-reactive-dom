/**
 * Extrait la clé de binding (situées après 'ref:') dans le nom d'un attribut
 * @param attrName le nom de l'attribut
 */
const extractRefAttrKey = (attrName: string): string | undefined => {
    return attrName.match(/^ref:(.+)$/)?.[1];
};

/**
 * Parcourt récursivement les noeuds de l'élément pour récupérer les éléments ayant un attribut ref:key.
 * Retourne un objet associant les éléments à leur clé.
 * Si l'option strictNames == false : l'objet retourné est un proxy qui autorise différents format pour la clé : obj.el_name <=> obj.elname <=> obj.elName <=> obj["el-name"]
 * Sinon le nom exacte de la clé doit être utilisé (hormis les majuscules qui sont ignorées en html) : comportement par défaut
 * @param el élément à parcourir
 * @param options objet optionnel permettant de définir si les noms des clés doivent être résolus de manière stricte ou non. Résolution stricte par défaut.
 * @return un objet associant les éléments trouvés à leurs clés
 */
export const getElementRefs = (
    el: Element,
    options: { strictNames: boolean } = { strictNames: true }
): { [key: string]: Element } => {
    const elements: { [prop: string]: Element } = {};

    // Utilisé seulement si options.strictNames == false
    const bindedElResolver: ProxyHandler<typeof elements> = {
        get(_target, prop: string) {
            // Formes reconnues : obj.el_name ou obj.elname ou obj.elName ou ou obj["el-name"]
            const key = prop.toLowerCase().replace(/[_-]/g, '');
            return _target[key];
        },
    };

    const handleElementNode = (element: Element) => {
        Array.from(element.attributes).forEach((attr) => {
            if (attr.name.startsWith('ref:')) {
                const key = extractRefAttrKey(attr.name);
                if (key) {
                    // Attention :
                    // - dans le cas non strict, $ref:el-name, $ref:elname, $ref:elName et $ref:el_name sont équivalents
                    // - dans le cas strict, $ref:elname, $ref:elName sont équivalents
                    // Les clés équivalentes seront associées à la même variable.
                    // le dernier élément associé écrase les précédents.
                    const keyName = options.strictNames ? key.toLowerCase() : key.toLowerCase().replace(/[_-]/g, '');
                    elements[keyName] = element;
                    element.removeAttribute(attr.name); // TODO à gérer en mode 'batched' avec domOp() ?
                }
            }
        });
    };


    const treeWalker = document.createTreeWalker(el, NodeFilter.SHOW_ELEMENT);

    do {
        handleElementNode(treeWalker.currentNode as Element);
    } while (treeWalker.nextNode());


    if (options.strictNames) {
        return elements;
    } else {
        return new Proxy(elements, bindedElResolver);
    }
};
