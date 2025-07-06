import { describe, it, assert } from 'vitest';
import { diffArray, Op, applyOps, objectsAreShallowEqual } from '../utils/diffing';

const keyFn = (item: number) => item.toFixed();

describe('diff arrays', () => {
    it('handles simple addition at the end', () => {
        const oldArray = [1, 2, 3];
        const newArray = [1, 2, 3, 4];
        const result = diffArray(oldArray, newArray, keyFn);

        assert.equal(result.ops.length, 1);
        assert.deepEqual(applyOps(oldArray, result.ops), newArray);
    });

    it('handles simple deletion at the end', () => {
        const oldArray = [1, 2, 3, 4];
        const newArray = [1, 2, 3];
        const result = diffArray(oldArray, newArray, keyFn);

        assert.equal(result.ops.length, 1);
        assert.deepEqual(applyOps(oldArray, result.ops), newArray);
    });

    it('handles simple addition at the beginning', () => {
        const oldArray = [1, 2, 3];
        const newArray = [0, 1, 2, 3];
        const result = diffArray(oldArray, newArray, keyFn);

        assert.equal(result.ops.length, 1);
        assert.deepEqual(applyOps(oldArray, result.ops), newArray);
    });

    it('handles simple deletion at the beginning', () => {
        const oldArray = [0, 1, 2, 3];
        const newArray = [1, 2, 3];
        const result = diffArray(oldArray, newArray, keyFn);

        assert.equal(result.ops.length, 1);
        assert.deepEqual(applyOps(oldArray, result.ops), newArray);
    });

    it('handles simple addition in the middle', () => {
        const oldArray = [1, 2, 4];
        const newArray = [1, 2, 3, 4];
        const result = diffArray(oldArray, newArray, keyFn);

        assert.equal(result.ops.length, 1);
        assert.deepEqual(applyOps(oldArray, result.ops), newArray);
    });

    it('handles simple deletion in the middle', () => {
        const oldArray = [1, 2, 3, 4];
        const newArray = [1, 2, 4];
        const result = diffArray(oldArray, newArray, keyFn);

        assert.equal(result.ops.length, 1);
        assert.deepEqual(applyOps(oldArray, result.ops), newArray);
    });

    it('handles substituting an item by another one', () => {
        const oldArray = [1, 2, 3];
        const newArray = [1, 4, 3];
        const result = diffArray(oldArray, newArray, keyFn);

        assert.equal(result.ops.length, 2);
        assert.deepEqual(applyOps(oldArray, result.ops), newArray);
    });

    it('handles moving an item', () => {
        const oldArray = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        const newArray = [1, 3, 4, 5, 6, 7, 8, 2, 9, 10];
        const result = diffArray(oldArray, newArray, keyFn);

        assert.equal(result.ops.length, 1);
        assert.deepEqual(applyOps(oldArray, result.ops), newArray);
    });

    it('handles swapping two distants items', () => {
        const oldArray = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        const newArray = [1, 9, 3, 4, 5, 6, 7, 8, 2, 10];
        const result = diffArray(oldArray, newArray, keyFn);

        assert.equal(result.ops.length, 2);
        assert.deepEqual(applyOps(oldArray, result.ops), newArray);
    });

    it('handles swapping two adjacents items ', () => {
        const oldArray = [1, 2, 3, 4, 5, 6, 7, 8];
        const newArray = [1, 2, 3, 5, 4, 6, 7, 8];
        const result = diffArray(oldArray, newArray, keyFn);

        assert.equal(result.ops.length, 2);
        assert.deepEqual(applyOps(oldArray, result.ops), newArray);
    });

    it('handles swapping with the last item', () => {
        const oldArray = [1, 2, 3, 4, 5, 6, 7, 8];
        const newArray = [1, 2, 3, 8, 5, 6, 7, 4];
        const result = diffArray(oldArray, newArray, keyFn);

        assert.equal(result.ops.length, 2);
        assert.deepEqual(applyOps(oldArray, result.ops), newArray);
    });

    it('handles multiple additions', () => {
        const oldArray = [1, 2, 3, 4];
        const newArray = [1, 5, 2, 3, 6, 7, 4];
        const result = diffArray(oldArray, newArray, keyFn);

        assert.equal(result.ops.length, 3);
        assert.deepEqual(applyOps(oldArray, result.ops), newArray);
    });

    it('handle multiple deletions', () => {
        const oldArray = [1, 2, 3, 4, 5, 6, 7];
        const newArray = [1, 3, 4, 7];
        const result = diffArray(oldArray, newArray, keyFn);

        assert.deepEqual(result.ops.length, 3);
        assert.deepEqual(applyOps(oldArray, result.ops), newArray);
    });

    it('handles mixing additions and deletions', () => {
        const oldArray = [1, 2, 3, 4];
        const newArray = [3, 4, 5, 6];
        const result = diffArray(oldArray, newArray, keyFn);

        assert.deepEqual(result.ops.length, 4);
        assert.deepEqual(applyOps(oldArray, result.ops), newArray);
    });

    it('handles mixing addition, deletion and moves', () => {
        const oldArray = [1, 2, 3, 4, 6, 7, 8, 9];
        const newArray = [2, 4, 1, 5, 6, 9, 8, 7];
        const result = diffArray(oldArray, newArray, keyFn);

        assert.isTrue(
            (result.ops.length < newArray.length && !result.overkill) ||
                (result.ops.length >= newArray.length && result.overkill)
        );
        if (!result.overkill) {
            assert.deepEqual(applyOps(oldArray, result.ops), newArray);
        }
    });

    it('handles two differents arrays', () => {
        const oldArray = [1, 2, 3, 4, 5, 6];
        const newArray = [7, 8, 9, 10, 11, 12];
        const result = diffArray(oldArray, newArray, keyFn);

        assert.equal(result.overkill, true);
    });
});

describe('shallow compare objects', () => {
    it('detects difference in number of properties', () => {
        const objA = { a: 1, b: 2 };
        const objB = { a: 1 };
        assert.isFalse(objectsAreShallowEqual(objA, objB));
    });

    it('detects difference in property type', () => {
        const objA = { a: 1, b: 2 };
        const objB = { a: 1, b: '2' };
        assert.isFalse(objectsAreShallowEqual(objA, objB));
    });

    it('detects difference in property value for primitive types', () => {
        const objA = { a: 1, b: 2 };
        const objB = { a: 1, b: 3 };
        assert.isFalse(objectsAreShallowEqual(objA, objB));
    });

    it('detects difference in property reference for objects types', () => {
        const objA = { a: 1, b: { c: 3 } };
        const objB = { a: 1, b: { c: 3 } };
        assert.isFalse(objectsAreShallowEqual(objA, objB));
    });

    it('detects equality for identical objects', () => {
        const objA = { a: 1, b: 2, c: { d: 3 } };
        const objB = { a: 1, b: 2, c: objA.c };
        assert.isTrue(objectsAreShallowEqual(objA, objB));
    });

    it('ignores property order', () => {
        const objA = { a: 1, b: 2 };
        const objB = { b: 2, a: 1 };
        assert.isTrue(objectsAreShallowEqual(objA, objB));
    });
});
