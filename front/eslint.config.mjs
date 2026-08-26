import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import prettierConfig from 'eslint-config-prettier'
import reactHooks from 'eslint-plugin-react-hooks'
import jsxA11y from 'eslint-plugin-jsx-a11y'

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettierConfig,
  // Accessibility. Without this, a mouse-only control reaches production and comes back
  // as a Sonar finding days later; here it fails the pre-commit hook instead.
  // Installed with --legacy-peer-deps: 6.10.2 caps its peer range at eslint 9 and no
  // release supports 10 yet. Verified to run and to flag the real cases under eslint 10 —
  // drop the override once upstream widens the range.
  jsxA11y.flatConfigs.recommended,
  {
    plugins: {
      'react-hooks': reactHooks,
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
