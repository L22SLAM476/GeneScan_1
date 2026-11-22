export default [
  { ignores: ["**/node_modules/**", "**/dist/**", "build/**", "android/**", "ios/**"] },
  {
    files: ["**/*.{js,jsx,mjs}"],
    languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
    rules: { "no-duplicate-imports": "error", "no-unreachable": "error", "no-dupe-keys": "error", "valid-typeof": "error" },
  },
];
