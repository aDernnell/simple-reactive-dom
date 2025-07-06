import { describe, it, expect, vi } from 'vitest';
import { createDebouncer, tick } from '../utils/debounce';

describe('microtask debouncer', () => {
    it('should execute only the last registered function within the same microtask', async () => {
        const debouncer = createDebouncer();
        const mockFnA = vi.fn();
        const mockFnB = vi.fn();

        debouncer(mockFnA);
        debouncer(mockFnA);
        debouncer(mockFnB);

        await tick();

        expect(mockFnA).not.toHaveBeenCalled();
        expect(mockFnB).toHaveBeenCalledTimes(1);
    });

    it('should call the function again in next microtasks', async () => {
        const debouncer = createDebouncer();
        const mockFn = vi.fn();

        debouncer(mockFn);
        debouncer(mockFn);
        debouncer(mockFn);

        await tick();

        debouncer(mockFn);

        await tick();

        expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should not call registered function until end of microtask', async () => {
        const debouncer = createDebouncer();
        const mockFn = vi.fn();

        debouncer(mockFn);
        expect(mockFn).not.toHaveBeenCalled();
        await tick();
        expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('isolates each debouncer instance', async () => {
        const debouncer1 = createDebouncer();
        const debouncer2 = createDebouncer();
        const mockFn = vi.fn();

        debouncer1(mockFn);
        debouncer2(mockFn);
        await tick();
        expect(mockFn).toHaveBeenCalledTimes(2);
    });
});
