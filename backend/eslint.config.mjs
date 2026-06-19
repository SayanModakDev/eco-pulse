import js from "@eslint/js";
import prettierPlugin from "eslint-plugin-prettier";
import eslintConfigPrettier from "eslint-config-prettier";

export default [
  js.configs.recommended,
  eslintConfigPrettier,
  {
    plugins: {
      prettier: prettierPlugin,
    },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        console: "readonly",
        process: "readonly",
        setTimeout: "readonly",
        Math: "readonly",
        parseFloat: "readonly",
        Map: "readonly",
        Set: "readonly",
        Date: "readonly",
      },
    },
    rules: {
      "no-console": "off",
      "prettier/prettier": "error",
      "max-len": ["warn", 100],
      complexity: ["warn", 15],
      "no-unused-vars": ["error", { argsIgnorePattern: "^(next|_)$" }],
    },
  },
];
