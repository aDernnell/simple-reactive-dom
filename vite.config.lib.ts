/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import * as path from 'path';

export default defineConfig(({ command }) => ({
    root: command == 'serve' ? path.resolve(__dirname, 'src') : __dirname,
    build: {
        copyPublicDir: false,
        lib: {
            name: 'srdom',
            entry: path.resolve(__dirname, 'lib/bundle.ts'),
            formats: ['iife'],
            fileName: (format) => `bundle.${format}.js`,
        },
        emptyOutDir: false,
    },

    test: {
        root: __dirname,
        include: ['lib/tests/**/*.test.ts'],
        environment: 'happy-dom',
        coverage: {
            reporter: [['lcov'], ['json', { file: 'coverage.json' }], ['text']],
            reportsDirectory: path.resolve(__dirname, 'coverage'),
            provider: 'v8',
            include: ['lib/**'],
            exclude: ['**/tests/**', 'lib/index.ts', 'lib/bundle.ts', 'lib/stores/types.ts'],
            extensions: ['.ts'],
        },
    },
}));
