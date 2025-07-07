import { isReadable } from '../stores';

const DISPOSE = Symbol.for('dispose');
export const SHALLOW_DISPOSE = Symbol.for('shallow_dispose');
const ROOT_DISPOSE = Symbol.for('root_dispose');

export interface Disposable {
    // Function that calls all the complementary dispose functions
    [SHALLOW_DISPOSE]?: () => void;
    // Function that calls the root dispose function
    [ROOT_DISPOSE]?: () => void;
    // Function that calls the root dispose function and all the complementary dispose functions
    [DISPOSE]: () => void;
}

export const isDisposable = (value: unknown): value is Disposable => {
    return typeof value === 'object' && value != null && value.hasOwnProperty(DISPOSE);
};

export const shallowDispose = (obj: unknown): void => {
    if (isDisposable(obj)) {
        obj[SHALLOW_DISPOSE]?.();
    } else if (Array.isArray(obj)) {
        obj.forEach(shallowDispose);
    }
};

export const dispose = (obj: unknown): void => {
    if (isDisposable(obj)) {
        obj[DISPOSE]();
        delete (obj as any)[DISPOSE]; // Une fois appelé, l'objet n'est plus considéré comme disposable
    } else if (Array.isArray(obj)) {
        obj.forEach(dispose);
    }
};

export const disposeRec = (value: unknown): void => {
    if (isReadable(value)) {
        dispose(value.get());
    } else if (Array.isArray(value)) {
        value.forEach(disposeRec);
    }
    dispose(value);
};

export const disposable = <T>(obj: T, disposeFn: () => void): T => {
    if (isDisposable(obj)) {
        // If the object is already disposable, we chain the dispose functions
        // and ensure the root dispose function is separated from shallow (complementary) ones.
        const originalDispose = obj[DISPOSE];
        obj[ROOT_DISPOSE] === undefined && (obj[ROOT_DISPOSE] = originalDispose);
        const originalShallowDispose = obj[SHALLOW_DISPOSE];
        obj[SHALLOW_DISPOSE] =
            originalShallowDispose === undefined
                ? disposeFn
                : () => {
                      originalShallowDispose();
                      disposeFn();
                  };

        obj[DISPOSE] = () => {
            obj[ROOT_DISPOSE]!();
            obj[SHALLOW_DISPOSE]?.();
        };

        return obj;
    }
    return Object.defineProperty(obj, DISPOSE, {
        value: disposeFn,
        configurable: true,
        writable: true,
    });
};
