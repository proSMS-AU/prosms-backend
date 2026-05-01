import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: ["dist/", "src/schemas/*.ts"]
  },
  { files: ["**/*.{js,mjs,cjs,ts}"] },
  { languageOptions: { globals: globals.browser } },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "import/prefer-default-export": "off",
      quotes: [2, "double", { avoidEscape: true }],
      "no-multi-spaces": 1,
      "comma-dangle": 0,
      "no-underscore-dangle": 0,
      "no-param-reassign": 1,
      "no-return-assign": 0,
      camelcase: 1,
      "no-plusplus": 1,
      "no-await-in-loop": 1,
      "no-unreachable": 1,
      "no-unused-vars": 1,
      "import/extensions": 0,
      "max-classes-per-file": 0,
      "@typescript-eslint/no-redeclare": 1,
      "no-console": 1,
      // "prettier/prettier": "error",
      "@typescript-eslint/naming-convention": [
        "error",
        {
          selector: "variableLike",
          format: ["camelCase", "PascalCase", "UPPER_CASE"],
          leadingUnderscore: "allow",
          trailingUnderscore: "allow",
          filter: {
            regex: "^_id$",
            match: false
          }
        }
      ]
    }
  },
  eslintPluginPrettierRecommended
];
