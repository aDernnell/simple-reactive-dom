export enum OpType {
    ADD,
    DEL,
    MOV
}

export type Op<T> = { 
    type: OpType; 
    item: T; 
    index: number; 
    indexDst?: number; // renseigné pour le cas 'mov' uniquement
};

export const applyOps = <T>(arr: Array<T>, ops: Array<Op<T>>): Array<T> => {
    const newArr: Array<T> = [...arr];
    ops.forEach((op) => {
        switch (op.type) {
            case OpType.DEL: // Suppression de l'élément à l'indice
                newArr.splice(op.index, 1);
                break;
            case OpType.ADD: // Ajout d'un élément avant l'indice
                newArr.splice(op.index, 0, op.item);
                break;
            case OpType.MOV: // Déplacement de index vers indexDst
                newArr.splice(op.index, 1);
                newArr.splice(op.indexDst!, 0, op.item);
                break;
        }
    });
    return newArr;
};

type Move<T> = {
    item: T;
    indexSrc: number;
    indexDst: number;
};

/**
 * Compare deux tableaux et retourne une liste de modifications à apporter séquentiellement au premier tableau pour obtenir le second.
 * Les indices des modifications sont exprimés relativement au premier tableau dont les modifications pécédentes ont déjà été appliquées.
 * Si l'algorithme n'est pas en mesure de détecter les modifications les plus pertinentes et fournit trop de modifications successives, l'algorithme est stoppé et l'attribut 'overkill:true' est retourné.
 * Dans ce cas la liste des modifications est incomplète et non pertinente.
 * Le nombre de modifications est considéré exagéré lorsqu'il égalise ou dépasse la taille de newArray.
 * L'attribut 'overkill:true' est également retourné si newArray est totalement différent de oldArray.
 * @param oldArray le premier tableau, peut être undefined
 * @param newArray le second tableau (cible)
 * @returns les ajouts et suppressions à appliquer séquentiellement sur oldArray pour le transformer en newArray si l'attribut overkill n'est pas renseigné
 */
export const diffArray = <T>(
    oldArray: Array<T> | undefined,
    newArray: Array<T>,
    keyFn: (item: T) => string
): { ops: Array<Op<T>>; overkill?: boolean } => {
    if (!oldArray) {
        return { ops: [], overkill: true };
    }

    const additions: Array<Op<T>> = [];
    const deletions: Array<Op<T>> = [];
    const moves: Array<Op<T>> = [];

    const eq = (itemA: T, itemB: T): boolean => {
        return keyFn(itemA) == keyFn(itemB);
    };
    const includes = (arr: T[], searchedItem: T): boolean => {
        return arr.findIndex((item) => eq(item, searchedItem)) != -1;
    };
    const indexOf = (arr: T[], searchedItem: T): number => {
        return arr.findIndex((item) => eq(item, searchedItem));
    };
    const findMove = (currArr: T[], targetArr: T[]): Move<T> | undefined => {
        for (let i = 0; i < currArr.length; i++) {
            const item = currArr[i];
            if (includes(targetArr, item) && !eq(item, targetArr[i])) {
                const indexDst = indexOf(targetArr, item);
                return { item, indexSrc: i, indexDst };
            }
        }
        return undefined;
    };

    const bufferMoves: Array<Op<T>> = [];
    let bufferArr = [...oldArray];

    // 1. Détection des suppressions
    for (let i = bufferArr.length - 1; i >= 0; i--) {
        const item = bufferArr[i];
        if (!includes(newArray, item)) {
            deletions.push({ type: OpType.DEL, item: item, index: i });
        }
    }

    if (deletions.length >= oldArray.length) {
        // Il faut supprimer tous les éléments,
        // il n'est donc pas rentable d'appliquer les modificatinos une à une
        return { ops: [...deletions], overkill: true };
    }

    // 2. Application des suppressions sur le tampon
    bufferArr = applyOps(bufferArr, deletions);

    // 3. Détection des additions
    for (let i = 0; i < newArray.length; i++) {
        const item = newArray[i];
        if (!includes(oldArray, item)) {
            additions.push({ type: OpType.ADD, item, index: i });
        }
    }

    // 3. Application des additions sur le tampon
    bufferArr = applyOps(bufferArr, additions);

    // 4. Identification un à un des déplacements entre le tampon et la cible
    let move;
    while (((move = findMove(bufferArr, newArray)), move)) {
        const delIndex = move.indexSrc;
        const addIndex = move.indexDst;

        bufferMoves.push({ type: OpType.MOV, item: move.item, index: delIndex, indexDst: addIndex });

        // Vérification si il s'agit d'un échange de positions
        if (eq(newArray[delIndex], oldArray[addIndex])) {
            bufferMoves.push({ type: OpType.MOV, item: newArray[delIndex], index: addIndex - 1, indexDst: delIndex });
        }

        // Application du déplacement (ou de l'échange) sur le tampon
        bufferArr = applyOps(bufferArr, bufferMoves);
        moves.push(...bufferMoves);
        bufferMoves.splice(0, bufferMoves.length);

        // overkill:true est retourné pour signifier que l'algorithme fournit trop de modifications,
        // càd qu'il n'est pas en mesure de détecter les modifications les plus pertinentes.
        // Dans ce cas il n'est pas rentable d'appliquer la liste des modifications résultantes une à une
        // et on considère (même si c'est potentiellement faux) que les tableaux sont totallement différents.
        // Identifier le nombre minimum de modifications nécessaires requiert un algorithle plus complexe et donc plus couteux en mémoire ou en temps de calcul.
        if (deletions.length + additions.length + moves.length >= newArray.length) {
            return { ops: [...deletions, ...additions, ...moves], overkill: true };
        }
    }

    const result = [...deletions, ...additions, ...moves];

    return { ops: result };
};

/**
 * Compare les propriétés de premier niveau de 2 objets.
 * La comparaison est stricte et inclus le type, mais ne tient pas compte de l'ordre des propriétés.
 * Pour les propriétés de type objet, ce sont les références qui sont comparées.
 * @param objA
 * @param objB
 * @returns true si égal, false sinon
 */
export const objectsAreShallowEqual = (objA: { [key: string]: any }, objB: { [key: string]: any }): boolean => {
    if (Object.keys(objA).length !== Object.keys(objB).length) {
        return false;
    }
    for (const keyA in objA) {
        if (!Object.hasOwnProperty.call(objB, keyA) || objB[keyA] !== objA[keyA]) {
            return false;
        }
    }
    return true;
};
