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
      "no-unused-vars": ["warn", { "argsIgnorePattern": "^(next|_)$" }],
      "max-len": [
        "warn",
        {
          code: 120,
          ignoreStrings: true,
          ignoreTemplateLiterals: true,
          ignoreComments: true,
        },
      ],
      complexity: ["warn", 15],
    },
  },
];
