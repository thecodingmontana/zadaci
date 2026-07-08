import antfu from "@antfu/eslint-config";
import prettier from "eslint-config-prettier";
import withNuxt from "./.nuxt/eslint.config.mjs";
const antfuConfig = await antfu({
  stylistic: false,
  vue: true,
  typescript: true,
});
export default withNuxt(
  ...antfuConfig,
  {
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
          ignore: [
            /^nuxt\.config\./,
            /^eslint\.config\./,
            /^tailwind\./,
            /^\..+/,
            /^AGENTS\.md$/,
            /^README\.md$/,
            /^\d{14}_[a-z]+(_[a-z]+)*$/,
            /^\[.*\]$/,
          ],
        },
      ],
      "pnpm/yaml-enforce-settings": "off",
      "no-console": "off",
      "node/prefer-global/process": "off",
      "node/prefer-global/buffer": "off",
    },
  },
  prettier,
);
