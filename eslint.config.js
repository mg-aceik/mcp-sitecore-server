import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Linting is deliberately syntax-only: the type-aware presets would need a second,
// full type-check of every file on top of `npm run typecheck`, which already covers it.
export default tseslint.config(
    {
        // `documentation/` is a verbatim vendored copy of the SPE Book; `dist/` is build output.
        ignores: ['dist/**', 'src/tools/powershell/documentation/**'],
    },
    {
        files: ['**/*.{js,mjs,ts}'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: globals.node,
        },
        extends: [js.configs.recommended],
    },
    {
        files: ['**/*.ts'],
        extends: [tseslint.configs.recommended],
        rules: {
            // A leading underscore is how this codebase spells "positional, unused" —
            // regex capture groups it must skip, callback parameters it does not read.
            '@typescript-eslint/no-unused-vars': ['error', {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_',
                caughtErrorsIgnorePattern: '^_',
                destructuredArrayIgnorePattern: '^_',
                // `const { Link, ...rest } = facet` is how the projection code drops a field.
                ignoreRestSiblings: true,
            }],
            // Four loosely-typed remote surfaces (CLIXML, GraphQL, REST, SPE) mean `any`
            // is still load-bearing here. A warning keeps the count visible without
            // failing the build on debt that predates the linter.
            '@typescript-eslint/no-explicit-any': 'warn',
        },
    },
    {
        // Test doubles stub SDK objects structurally; `any` is the point, not debt.
        files: ['tests/**/*.ts'],
        rules: { '@typescript-eslint/no-explicit-any': 'off' },
    },
);
