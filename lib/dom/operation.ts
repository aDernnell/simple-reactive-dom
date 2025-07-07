import { createDebouncer } from "../utils/debounce";

export enum DomUpdateMode {
    EAGER,
    BATCHED
}

let domOperations: Array<Function> = [];

const runDomOperations = () => {
	const pendingOperations = domOperations.splice(0); // vide le tableau et récupère les opérations en attente
	for (var i = 0; i < pendingOperations.length; i++) {
		pendingOperations[i]();
	}
}

/**
 * Ajoute une opération de mise à jour du DOM à la file d'attenche.
 * Si première opération de la file, planifie une microtask qui se chargera d'éxécuter la file d'attente à la fin du cycle en cours.
 * Voir https://developer.mozilla.org/en-US/docs/Web/API/HTML_DOM_API/Microtask_guide
 * @param fn fonction à ajouter aux opérations en attente
 */
export const queueDomOperation = (fn: Function) => {
	if (domOperations.length === 0) {
		queueMicrotask(runDomOperations);
	}

	domOperations.push(fn);
}


/**
 * Créé un Debouncer pour une opération de mise à jour du DOM
 */
export const createDomDebouncer = () => createDebouncer(queueDomOperation);

/**
 * Planifie l'execution de la maj du DOM en fonction du mode
 * @param fn fonction qui execute la maj
 * @param updateDomMode eager (synchrone) ou batched (asynchrone)
 * @param debouncer (optionnel) débouncer à utiliser si mode batched
 */
export const domOp = (fn: Function, updateDomMode: DomUpdateMode, debouncer?: (fn: Function) => void) => {
    if(updateDomMode == DomUpdateMode.BATCHED) {
        debouncer ? debouncer(fn) : queueDomOperation(fn);
    } else if(updateDomMode == DomUpdateMode.EAGER) {
        fn();
    }
}

export const replaceBy = (toBeReplaced: ChildNode | Array<ChildNode>, replacement: Node | Array<Node>) => {
    return () => {
        if(Array.isArray(toBeReplaced) && Array.isArray(replacement)) {
            toBeReplaced[toBeReplaced.length - 1].after(...replacement); // TODO use fragment ?
            toBeReplaced.forEach((node) => node.remove());
        } else if(Array.isArray(toBeReplaced)) {
            toBeReplaced[0].before(replacement as Node);
            toBeReplaced.forEach((node) => node.remove());
        } else if(Array.isArray(replacement)) {
            toBeReplaced.after(...replacement); // TODO use fragment ?
            toBeReplaced.remove();
        } else {
            toBeReplaced.after(replacement);
            toBeReplaced.remove();
        }
    }
}

/**
 * Execute de manière synchrone les opérations en attente sans attendre la fin de la microtask en cours.
 */
export const flush = () => {
    if(domOperations.length > 0) {
        runDomOperations();
    }
}