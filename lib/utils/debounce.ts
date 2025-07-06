// Sources d'inspiration :
// https://github.com/Polymer/polymer/blob/master/test/unit/debounce.html
// https://polymer-library.polymer-project.org/3.0/api/utils/debounce
// https://stackoverflow.com/questions/64087283/svelte-derived-store-atomic-debounced-updates
// https://github.com/vicary/debounce-microtask

/**
 * Créé un débouncer qui s'assure que seule la dernière fonction enregistrée
 * dans un interval donnée n'est appelée à la fin de cet interval.
 * Par défaut, l'interval est la microtask en cours.
 *
 * Usage:
 * ```typescript
 * const debouncer = createDebouncer();
 *
 * debouncer(() => console.log("Call fn A"));
 * debouncer(() => console.log("Call fn A"));
 * debouncer(() => console.log("Call fn C"));  // Only this will run
 *
 * // Output (all within the same microtask):
 * // Call fn C
 * ```
 */
export const createDebouncer = (scheduler: (callback: () => void) => void = queueMicrotask) => {
    let scheduled = false;
    let debouncedFn: Function | undefined = undefined;

    return function debounce(fn: Function) {
        debouncedFn = fn;

        if (!scheduled) {
            scheduled = true;

            scheduler(() => {
                debouncedFn?.();
                debouncedFn = undefined;
                scheduled = false;
            });
        }
    };
}

/**
 * Attends l'exécution de la microtask en cours.
 * Permet de s'assurer que l'ensemble des opérations en attente aient été exécutées.
 * S'utilise dans un contexte asynchrone uniquement via `await tick();`
 */
export const tick = async () => {
    await Promise.resolve();
}

