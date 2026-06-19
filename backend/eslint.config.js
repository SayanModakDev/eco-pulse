import js from "@eslint/js";
import globals from "globals";

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "no-console": "warn",
      "max-len": ["warn", 120],
      complexity: ["warn", 12],
    },
  },
];
