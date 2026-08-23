import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import alias from '@rollup/plugin-alias';
import path from 'path';
import copy from 'rollup-plugin-copy'

export default {
  input: 'dist/index.js',
  output: {
    file: 'dist/bundle.js',
    format: 'esm'
  },  plugins: [
    nodeResolve({
      preferBuiltins: true
    }),
    commonjs({
    }),
    json(),
    alias({
      entries: [
        { find: '@', replacement: path.resolve('dist') }
      ]
    }),
    copy({
      targets: [
        // `npm run build` clears this directory before copying (scripts/copy-docs.mjs);
        // rollup's copy only overwrites, so a page deleted from src would otherwise
        // linger here and keep appearing in the generated index.
        // flatten:false keeps the category folders (common/, security/, ...). Without it
        // every page lands in one flat directory and the category — which the docs tool
        // groups and filters by — is lost.
        {
          src: 'src/tools/powershell/documentation/*',
          dest: 'dist/tools/powershell/documentation',
          flatten: false
        }
      ]
    })
  ],
  // External packages that shouldn't be bundled
  external: [
    'content-type',
    'express',
    'node:crypto',
    'node:*',
    'http',
    'https',
    'path',
    'fs',
    'url',
    'util',
    'assert',
    'stream',
    'events',
    'zlib',
    'statuses'
  ]
};