import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactPlugin from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";
import importX from "eslint-plugin-import-x";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "artifacts/api-server/build.mjs",
      "lib/api-zod/src/generated/**",
      "lib/api-client-react/src/generated/**",
      "artifacts/mockup-sandbox/**",
      "scripts/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: { "import-x": importX },
    rules: {
      "import-x/no-duplicates": "error",
      "import-x/order": [
        "warn",
        {
          groups: [
            "builtin",
            "external",
            "internal",
            "parent",
            "sibling",
            "index",
          ],
          "newlines-between": "never",
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],
    },
  },
  {
    files: ["artifacts/finance-app/src/**/*.{ts,tsx}"],
    ...reactPlugin.configs.flat.recommended,
    settings: { react: { version: "detect" } },
    rules: {
      ...reactPlugin.configs.flat.recommended.rules,
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "react/display-name": "off",
    },
  },
  {
    files: ["artifacts/finance-app/src/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/no-nested-components": "off",
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/static-components": "off",
    },
  },
  {
    files: ["artifacts/finance-app/src/**/*.{ts,tsx}"],
    ...jsxA11y.flatConfigs.recommended,
    rules: {
      ...jsxA11y.flatConfigs.recommended.rules,
      "jsx-a11y/label-has-associated-control": ["warn", { assert: "either" }],
      "jsx-a11y/click-events-have-key-events": "warn",
      "jsx-a11y/no-static-element-interactions": "warn",
      "jsx-a11y/no-autofocus": "warn",
      "jsx-a11y/anchor-is-valid": "warn",
    },
  },
  prettier,
  {
    rules: {
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      eqeqeq: ["error", "always", { null: "ignore" }],
      "no-var": "error",
      "prefer-const": "warn",
    },
  },
  {
    files: ["artifacts/api-server/src/**/*.{ts,tsx}"],
    rules: {
      "no-console": "off",
    },
  },
  {
    files: ["**/*.test.{ts,tsx}", "**/test/**/*.{ts,tsx}"],
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
);
