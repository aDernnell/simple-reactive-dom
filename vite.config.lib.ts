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
        root: path.resolve(__dirname, 'lib'),
        include: ['tests/**/*.test.ts'],
        environment: 'happy-dom',
        coverage: {
            reporter: [['lcov'], ['json', { file: 'coverage.json' }], ['text']],
            reportsDirectory: path.resolve(__dirname, 'coverage'),
            provider: 'v8',
            include: ['**'],
            exclude: ['tests/**', 'index.ts', 'bundle.ts', 'stores/types.ts'],
            extensions: ['.ts'],
        },
    },
}));
