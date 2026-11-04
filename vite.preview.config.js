// Bygge för förhandsvisning i Claude (allt i en fil, ingen YouTube-inbäddning).
import base from "./vite.config.js";
export default { ...base, build: { ...base.build, outDir: "dist-forhand", rollupOptions: { output: { inlineDynamicImports: true } } } };
