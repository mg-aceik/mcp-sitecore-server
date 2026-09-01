import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// The whole suite: the live tests against the endpoint in .env, and the unit tests beside
// them. `npm run test:unit` narrows to the second group with vitest.unit.config.ts.
export default defineConfig({
  resolve: {
    // Without this the unit files fail to collect here -- they import `src/` through the
    // `@/` alias, which only tsconfig and the unit config knew about.
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    // The live tests wait on a CM: an index rebuild or a media upload takes seconds, not
    // milliseconds.
    testTimeout: 25000,

    // Every live file spawns its own server process and seeds its own content, so the
    // default fan-out puts ~150 concurrent PowerShell sessions on one CM. That is what the
    // CM answers with 500s and 25-second waits, not anything the tests did wrong. Four at a
    // time keeps the suite honest and still runs it in a couple of minutes.
    poolOptions: {
      forks: {
        maxForks: 4,
      },
    },

    // One retry, for the same reason: a CM under load occasionally drops a request, and a
    // suite that cries wolf is a suite nobody runs.
    retry: 1,
  },
});
