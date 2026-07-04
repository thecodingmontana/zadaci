import withNuxt from "./.nuxt/eslint.config.mjs";
import prettier from "eslint-config-prettier";
import unicorn from "eslint-plugin-unicorn";

export default withNuxt(
  {
    plugins: {
      unicorn,
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "no-empty": "off",
      "no-nested-ternary": "off",
      "default-case": "off",
      "no-void": "off",
      "vue/require-default-prop": "off",
      "unicorn/no-array-for-each": "off",
      "unicorn/filename-case": [
        "error",
        {
          cases: { kebabCase: true },
          ignore: [/^nuxt\.config\./, /^eslint\.config\./, /^tailwind\./, /^\..+/],
        },
      ],
    },
  },
  prettier,
);
