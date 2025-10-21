import js from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

const browserGlobals = {
  ...globals.browser,
  localStorage: 'readonly',
  AudioContext: 'readonly',
  webkitAudioContext: 'readonly',
};

export default [
  {
    ignores: ['node_modules', 'backend/node_modules', 'coverage', 'backend/coverage'],
  },
  js.configs.recommended,
  prettier,
  {
    files: ['frontend/**/*.js'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      globals: browserGlobals,
    },
    rules: {
      'no-console': 'off',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['backend/**/*.js'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      globals: globals.node,
    },
    rules: {
      'no-console': 'off',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['dev-serve.js'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'script',
      globals: globals.node,
    },
    rules: {
      'no-console': 'off',
    },
  },
];
