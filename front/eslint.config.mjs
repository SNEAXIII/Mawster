import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import prettierConfig from 'eslint-config-prettier'
import reactHooks from 'eslint-plugin-react-hooks'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import sonarjs from 'eslint-plugin-sonarjs'

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettierConfig,
  // jsx-a11y peers on eslint <=9; the package.json override reconciles it with our 10.
  jsxA11y.flatConfigs.recommended,
  {
    plugins: {
      'react-hooks': reactHooks,
      sonarjs,
    },
    rules: {
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          vars: 'all',
          args: 'after-used',
          ignoreRestSiblings: true,
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      // A ternary inside a ternary hides the branch order it depends on. Use a lookup
      // record, or a small function with early returns, and in JSX separate `{cond && …}`
      // blocks — every one of these was refactored that way, so the rule starts clean.
      'no-nested-ternary': 'error',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/ban-ts-comment': 'warn',
      // Every autoFocus in this codebase is on an input inside a dialog or an inline
      // editor that just opened — focusing it is the expected behaviour, not the
      // steal-focus-on-page-load pattern the rule is aimed at.
      'jsx-a11y/no-autofocus': 'off',
      // `<UsernameEnriched role='owner' />` is a domain prop (owner/officer/member), not
      // an ARIA role. ignoreNonDOM keeps the rule on real DOM elements, where it belongs.
      'jsx-a11y/aria-role': ['error', { ignoreNonDOM: true }],
    },
  },
  {
    // Both rules below need type information, and a rule that needs it and does not get
    // it either crashes the run or silently reports nothing. Hence this block: only the
    // sources go through the TS program — `eslint.config.mjs` is not in it.
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Sonar S6759: props a component never writes to. Suggestion-only as well, so
      // `make fix` reports these without repairing them. Only this rule is enabled from
      // sonarjs — its `recommended` config turns on ~250 rules at once, which this
      // codebase has never been linted against.
      'sonarjs/prefer-read-only-props': 'error',
      // `a ?? b` over `a || b` and over `a !== undefined ? a : b`. Reports suggestions, never
      // fixes (`meta.fixable` is `none`), so `--fix` will not touch these — the IDE quick-fix
      // or a human applies them. A warning, not an error:
      // on a `string`, `||` is often the intent — `champion.alias || '-'` wants the dash for
      // the empty alias too, and `??` would print nothing. `boolean` is ignored outright:
      // there `||` is plain boolean logic with no fallback in sight.
      '@typescript-eslint/prefer-nullish-coalescing': [
        'warn',
        { ignorePrimitives: { boolean: true } },
      ],
    },
  },
  {
    // Build config files run in Node, not in the browser: they legitimately reach for `module`
    // and `process`, which the base config knows nothing about.
    files: ['*.config.js', '*.config.mjs', '*.config.ts'],
    languageOptions: {
      globals: {
        module: 'writable',
        require: 'readonly',
        process: 'readonly',
        __dirname: 'readonly',
      },
    },
  },
  {
    ignores: [
      '.next/**',
      '.next-3001/**',
      'node_modules/**',
      'cypress/**',
      'components/ui/**',
      'postcss.config.js',
    ],
  }
)
