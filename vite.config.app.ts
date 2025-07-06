import { defineConfig } from 'vite';
import * as path from 'path';
import { globSync } from 'glob';
import { fileURLToPath } from 'url';

export default defineConfig({
    root: path.resolve(__dirname, 'src'),
    build: {
        outDir: '../dist-app',
        emptyOutDir: true,
        rollupOptions: {
            input: Object.fromEntries(
                // https://rollupjs.org/configuration-options/#input
                globSync('src/**/*.html').map((file) => [
                    // 1. The name of the entry point (remove 'src/' prefix and file extension)
                    path.relative('src', file.slice(0, file.length - path.extname(file).length)),
                    // 2. The absolute path to the entry file
                    fileURLToPath(new URL(file, import.meta.url)),
                ])
            ),
        },
    },
});
