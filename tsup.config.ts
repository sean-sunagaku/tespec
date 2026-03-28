import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/cli.ts', 'src/commands/*.ts'],
    format: ['esm'],
    dts: true,
    clean: true,
    shims: true,
    sourcemap: true,
    target: 'node18',
  },
  {
    entry: { 'viewer-client': 'src/core/viewer/client-entry.tsx' },
    format: ['esm'],
    outDir: 'dist/viewer',
    platform: 'browser',
    target: 'es2022',
    clean: false,
    bundle: true,
    minify: true,
    sourcemap: false,
    external: [],
    noExternal: ['preact', '@dagrejs/dagre'],
    jsxFactory: 'h',
    jsxFragment: 'Fragment',
    esbuildOptions(options) {
      options.jsx = 'automatic';
      options.jsxImportSource = 'preact';
    },
  },
]);
