import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
        base: "./",
        root: "examples",
        resolve: {
                alias: [
                        {
                                find: /^three$/,
                                replacement: resolve(__dirname, "examples/three-shim.ts"),
                        },
                ],
        },
        build: {
                rollupOptions: {
                        input: {
                                main: "./examples/index.html",
                                offscreen: "./examples/offscreen-render.html",
                        },
                },
        },
});
