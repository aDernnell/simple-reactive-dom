import { isReadable, derived, Readable, Unsubscriber, writable, isWritable } from '../stores';
import { rawHtmlToNode } from '../utils';
import { Binding, BindingContext, bindStates } from '../binding';
import { createDebouncer } from '../utils/debounce';
import { DomUpdateMode } from '../dom/operation';
import { disposable, dispose, disposeRec, SHALLOW_DISPOSE, shallowDispose } from '../lifecycle/disposable';
import { isConditionalAttr, isEventHandler } from './directives';
import { rebind } from '../binding/rebind';

export type HtmlLiterals = {
    strings: TemplateStringsArray;
    values: unknown[];
    // cache
    tmpl?: string;
    tmplStores?: { [key: string]: Readable<unknown> };
    node?: Node;
    bindings?: Array<Binding>;
};

export const HTML_LITERALS = Symbol.for('html_literals');
export const SVG_LITERALS = Symbol.for('svg_literals');

export const isHtmlLiterals = (value: unknown): value is HtmlLiterals => {
    return typeof value === 'object' && value != null && value.hasOwnProperty(HTML_LITERALS);
};

/**
 * Fonction tag pour HTML (Element ou Text)
 * @param strings chaînes de caractères statiques du template
 * @param values valeurs à substituer dans le template
 * @returns un objet HtmlLiterals qui contient les chaînes de caractères statiques et les valeurs à substituer
 */
const htmlLit = (strings: TemplateStringsArray, ...values: unknown[]): HtmlLiterals => {
    const literals: HtmlLiterals = {
        // @ts-expect-error
        [HTML_LITERALS]: true,
        strings,
        values,
    };

    return disposable(literals, () => {
        literals.bindings?.splice(0).forEach(dispose);
        disposeRec(literals.values);
        literals.node = undefined;
        literals.bindings = undefined;
        literals.tmpl = undefined;
        literals.tmplStores = undefined;
    });
};

/**
 * Fonction tag pour un element HTML.
 * Effectue des vérifications de syntaxe pour s'assurer que le literals correspond bien à la représentation d'un noeud de type Element (div, span, etc.),
 * puis retourne un objet HtmlLiterals via la fonction htmlLit().
 * @param strings chaînes de caractères statiques du template
 * @param values valeurs à substituer dans le template
 * @returns un objet HtmlLiterals qui contient les chaînes de caractères statiques et les valeurs à substituer
 */
export const html = (strings: TemplateStringsArray, ...values: unknown[]): HtmlLiterals => {
    // TODO conditionnally compile these checks for production, e.g. https://github.com/KeJunMao/unplugin-preprocessor-directives
    if (strings[0] === '') {
        console.warn('HTML literals should not start with a bound value. This may lead to unexpected behavior !');
    } else if (!/^[\s]*<.*/.test(strings[0])) {
        console.warn(
            'HTML literals should not start with something else than an opening html tag. This may lead to unexpected behavior !'
        );
    }
    // TODO also check if the last string ends with a closing tag or not
    return htmlLit(strings, ...values);
};

/**
 * Fonction tag pour un noeud textuel.
 * Effectue des vérifications de syntaxe pour s'assurer que le literals correspond bien à la représentation d'un noeud de type Text (simple chaine de caractère dans le DOM)
 * puis retourne un objet HtmlLiterals via la fonction htmlLit().
 * @param strings chaînes de caractères statiques du template
 * @param values valeurs à substituer dans le template
 * @returns un objet HtmlLiterals qui contient les chaînes de caractères statiques et les valeurs à substituer
 */
export const text = (strings: TemplateStringsArray, ...values: unknown[]): HtmlLiterals => {
    // TODO conditionnally compile these checks for production, e.g. https://github.com/KeJunMao/unplugin-preprocessor-directives
    for (const str of strings) {
        if (/.*<\/?[a-zA-Z]+>.*/.test(str)) {
            console.warn('Text literals should not contain HTML tags.');
            break;
        }
    }
    return htmlLit(strings, ...values);
};

/**
 * Génère le placeholder de substitution pour une valeur dans le template.
 * Gère les cas particuliers des attributs conditionnels et des gestionnaires d'événements inline.
 *
 * ```html
 * <div onclick=${call(fn)}>Click me</div> deviendra <div onclick="\u002F*#{0:0}*\u002F">Click me</div>
 * <button disabled=${when(true)}>Disabled</button> deviendra <button disabled="#{0:0}">Disabled</button>
 * <span class="${value1} ${value2}"></span> deviendra <span class="#{0:0} #{1:1}"></span>
 * ```
 * @param bindingPosition la position du binding dans le template (commence à 0)
 * @param bindingIndex l'index du binding (potentiellement réutilisé) à utiliser dans le placeholder
 * @param value la valeur à injecter dans le template, utilisée pour en déterminer le type
 * @param previousStr la chaîne de caractères précédente dans le template, utilisée pour déterminer si les guillemets doivent être ajoutés ou non
 * @returns le placeholder de substitution pour la valeur dans le template, ex : '#{0:0}'
 */
const tmplValue = (bindingIndex: number, value: unknown, previousStr: string): string => {
    let addQuotes = false;
    let tmplVal = `#{${bindingIndex}}`;
    // Cas particulier d'un attribut de type inline event handler
    if (isEventHandler(value)) {
        // Dans ce cas il faut que la valeur de l'attribut dans le template soit une expression js valide !
        // Sinon la fonction rawHtmlToNode() appelée dans createNode() ne pourra pas l'interpréter correctement
        // De plus les quillemets englobant la valeur de l'attribut sont facultatifs, on les rajoute si non présents
        addQuotes = !previousStr[previousStr.length - 1].match(/['"]/);
        tmplVal = `/*${tmplVal}*/`; // On englobe le placeholder dans un commentaire js
    }
    // Cas particulier d'un attribut conditionnel
    else if (isConditionalAttr(value) || (isReadable(value) && isConditionalAttr(value.get()))) {
        // Les quillemets englobant la valeur de l'attribut sont facultatifs, on les rajoute si non présents
        addQuotes = !previousStr[previousStr.length - 1].match(/['"]/);
    }

    return addQuotes ? `"${tmplVal}"` : `${tmplVal}`;
};

/**
 * Génère le template HTML à partir des chaînes de caractères statiques et des expressions JS évaluées,
 * et fournit un objet contenant les stores des valeurs dynamiques à injecter associés à leur clé.
 * Ex :
 * ```js
 * literals = html`<span class="${value0} ${store1}">${value2} ${store1}</span>`;
 * template = '<span class="#{0} #{1}">#{2} #{1}</span>';
 * templateStores = {
 *   '0': writable(value0),
 *   '1': store1,
 *   '2': writable(value2)
 * }
 * ```
 * @param literals résultat de l'évaluation de la fonction tag, contient la liste des chaînes de caractère statiques et la liste des expressions js évaluées
 * @returns un tableau contenant le template HTML en première position et l'objet de bindings en seconde position.
 */
export const tmpl = (strings: readonly string[], values: unknown[]): [string, { [key: string]: Readable<unknown> }] => {
    let template = '';
    const stores: Array<Readable<unknown> | null> = [];

    for (let i = 0; i < strings.length; i++) {
        template += strings[i];
        if (i < values.length) {
            const value = values[i];

            let bindingIndex = i;
            let store;

            if (isReadable(value)) {
                // Réutilisation des stores liés plusieurs fois dans le template
                const existingIndex = stores.findIndex((v) => v == value);
                bindingIndex = existingIndex != -1 ? existingIndex : i;

                // Si le store existe déjà, on ne le crée pas à nouveau et on utilise l'index du store existant
                // null sert à indiquer que le store n'existe pas et sera filtré de la collection des bindings
                store = existingIndex != -1 ? null : value;
            } else {
                store = writable(value);
            }

            template += tmplValue(bindingIndex, value, strings[i]);
            stores[i] = store;
        }
    }

    const bindings: { [key: string]: Readable<unknown> } = Object.fromEntries(
        stores.map((s, i) => [i, s]).filter(([_, s]) => s != null)
    );

    return [template, bindings];
};

/**
 * Compile le résultat de l'évaluation de la fonction tag et génère un noeud HTML correspondant au template.
 * Met en place les mécanismes de mise à jour automatique de l'élément en fonction des états des stores.
 * @param literals résultat de l'évaluation de la fonction tag, contient la liste des chaînes de caractère statiques et la liste des expressions js évaluées
 * @param options (optionel) objet contenant les options :
 * - force: force la regénération de l'élément même si ce dernier a été mis en cache
 * - serializer: fonction permettant de spécifier comment sont sérialisés certains types de valeurs
 * - updateDomMode: 'eager' (sync) ou 'batched' (async)
 */
const createNode = (
    literals: HtmlLiterals,
    options?: DirectOptions & {
        force?: boolean;
    }
): Node => {
    const force = options?.force ?? false;
    if (!literals.tmpl || !literals.bindings || force) {
        const [template, tmplStores] = tmpl(literals.strings.raw, literals.values);
        literals.tmpl = template;
        literals.tmplStores = tmplStores;
    }

    if (!literals.node || force) {
        const node = rawHtmlToNode(literals.tmpl);
        literals.bindings?.splice(0).forEach(dispose);
        literals.bindings = bindStates(node, literals.tmplStores!, {
            serializer: options?.serializer,
            updateDomMode: options?.updateDomMode,
        });

        literals.node = node;
    }

    return disposable(literals.node, () => dispose(literals));
};

export type DirectOptions = {
    serializer?: (value: any, context?: BindingContext, key?: string) => any;
    updateDomMode?: DomUpdateMode;
};

export type WatcherOptions = DirectOptions & {
    debounceWatches?: boolean;
    serializer?: (value: any, context?: BindingContext, key?: string) => any;
    updateDomMode?: DomUpdateMode;
};

export type Watcher = <T>(store: Readable<T>) => T;

/** Signature pour les surcharges de la fonction node() */
export type NodeFn = {
    (template: HtmlLiterals, options?: DirectOptions): Node;
    (fn: (watch: Watcher) => HtmlLiterals, options?: WatcherOptions): Node;
};

/**
 * Transforme le paramètre en un noeud HTML
 * 2 modes :
 * - direct -> le paramètre est le résultat de la fonction tag
 * - watcher -> le parmètre est une fonction qui retourne le résultat de la fonction tag, permettant de regénérer les valeurs substituées
 * @param htmlOrFn en mode direct: le résultat de l'évaluation du tag, en mode watcher: la fonction permettant d'évaluer ou réévaluer le tag
 * @param options (optionel) : objet contenant les options
 * - serializer: (optionnel) fonction permettant de spécifier comment sont sérialisés certains types de valeurs
 * - updateDomMode: (défaut = batched) eager (sync) ou batched (async)
 * - debounceWatches: (en mode watch uniquement, défaut = true) aggrège les maj des stores en une seule maj au sein de la microtask (rend la maj asynchrone)
 * @returns un node HTML
 */
export const node: NodeFn = (htmlOrFn: HtmlLiterals | Function, options?: DirectOptions | WatcherOptions): Node => {
    if (isHtmlLiterals(htmlOrFn)) {
        /* Mode direct */
        return createNode(htmlOrFn as HtmlLiterals, options as DirectOptions);
    } else {
        /* Mode watcher */
        const fn = htmlOrFn as Function;
        const unsubs: Array<Unsubscriber> = [];
        const debounceWatches = (options as WatcherOptions)?.debounceWatches ?? true;
        const watched: Array<Readable<any>> = [];

        /**
         * Enregistre un store qui conditionne une valeur à substituer dans le literals
         * Ex: ${'count is < 10 : ' + (watch(count) < 10 ? 'true' : 'false')}
         * La valeur à substituer n'est pas un store mais un string, pour autant elle varie en fonction de l'état du store count
         * donc il faut la recalculer si l'état du store change
         */
        const watch = (store: Readable<unknown>): any => {
            watched.push(store);
            return store.get();
        };

        let literals = fn(watch) as HtmlLiterals;
        const el = createNode(literals, options);

        let triggerUpdateUnsub: Unsubscriber;
        let triggerUpdate: Readable<object>;
        const debounce = debounceWatches ? createDebouncer() : undefined;

        // Construit ou reconstruit le déclencheur de recalculation des substitutions (basé sur les stores enregistrés avec watch())
        const buildWatcher = () => {
            const unsubIdx = triggerUpdateUnsub ? unsubs.indexOf(triggerUpdateUnsub) : -1;
            unsubIdx != -1 && unsubs.splice(unsubIdx, 1);
            triggerUpdateUnsub?.();
            triggerUpdate = derived(watched, (_) => ({}));
            let initDerived = true;
            unsubs.push(
                (triggerUpdateUnsub = triggerUpdate.subscribe(() => {
                    if (!initDerived) {
                        // On exclus le premier appel qui a lieu lors de l'initialisation du store dérivé
                        debounce ? debounce(recalculateSubstitutions) : recalculateSubstitutions();
                    }
                    initDerived = false;
                }))
            );
        };

        const recalculateSubstitutions = () => {
            watched.splice(0);
            const newLiterals = fn(watch) as HtmlLiterals;

            // literals.bindings est mis à jour ici
            rebind(literals, newLiterals, options?.updateDomMode, options?.serializer);

            // On appelle uniquement les fonction dispose ajoutées par l'utilisateur
            // et non la fonction dispose de base du literals (qui désouscrit les bindings et appelle disposeRec() sur les valeurs !)
            shallowDispose(literals);
            // @ts-expect-error (le literals est nécessairement un objet disposable)
            literals[SHALLOW_DISPOSE] = newLiterals[SHALLOW_DISPOSE];
            literals.values = newLiterals.values;

            buildWatcher();
        };

        buildWatcher();

        return disposable(el, () => {
            unsubs.forEach((unsub) => unsub());
        });
    }
};

/**
 * transforme un html literals en une représentation textuelle du html
 * raw(html`<div></div>`) == rawHtml(`<div></div>`) == '<div></div>'
 * @param literals résultat de l'évaluation de la fonction tag, contient la liste des chaînes de caractère statiques et la liste des expressions js évaluées
 * @returns représentation html textuelle
 */
export const raw = (literals: HtmlLiterals): string => {
    let result = '';

    for (let i = 0; i < literals.strings.length; i++) {
        result += literals.strings[i];
        if (i < literals.values.length) {
            result += literals.values[i];
        }
    }

    return result;
};

export const rawHtml = (strings: TemplateStringsArray, ...values: unknown[]) => String.raw({ raw: strings }, ...values);
