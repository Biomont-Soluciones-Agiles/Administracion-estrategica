module.exports = {
  root: true,
  env: { browser: true, es2022: true },
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
  plugins: ['react'],
  rules: { 'no-undef': 'error', 'react/jsx-no-undef': 'error' },
  ignorePatterns: ['dist/', 'node_modules/', 'docs/', 'docx-render/'],
  overrides: [{ files: ['tests/**/*.js', 'api/**/*.js', '.eslintrc.cjs'], env: { node: true } }],
};
