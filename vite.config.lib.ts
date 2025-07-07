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
            fileName: (format) => `simplereactivedom.bundle.${format}.js`,
        },
        emptyOutDir: false,
    },

    test: {
        include: ['../lib/tests/**/*.test.ts'],
        environment: 'happy-dom',
    },
}));
