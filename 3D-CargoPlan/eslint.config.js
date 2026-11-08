// #created 11/08/2026
import parser from '@typescript-eslint/parser'
export default [{ ignores: ['node_modules/**', 'dist/**', 'dist-server/**'] }, {
  files: ['src/**/*.ts', 'src/**/*.tsx'],
  languageOptions: { parser, parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } } },
  rules: { 'no-debugger': 'error', 'no-duplicate-case': 'error', 'no-unreachable': 'error', 'no-constant-condition': ['error', { checkLoops: false }] }
}]
