import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli.ts', 'src/commands/*.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  shims: true,
  sourcemap: true,
  target: 'node18',
});
