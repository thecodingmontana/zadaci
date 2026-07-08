import tailwindcss from "@tailwindcss/vite";
import MotionResolver from "motion-v/resolver";
import Components from "unplugin-vue-components/vite";

export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
  css: ["~/assets/css/tailwind.css"],

  vite: {
    plugins: [
      tailwindcss(),
      Components({
        dts: true,
        resolvers: [MotionResolver()],
      }),
    ],
    optimizeDeps: {
      include: ["@lucide/vue", "@unhead/schema-org/vue", "@vueuse/core", "motion-v"],
    },
  },

  modules: [
    "@nuxt/eslint",
    "shadcn-nuxt",
    "nuxt-auth-utils",
    "@nuxtjs/seo",
    "@vue-dnd-kit/nuxt",
    "@nuxt/icon",
    "@nuxtjs/color-mode",
  ],
  eslint: {
    config: {
      standalone: false,
    },
  },

  shadcn: {
    /**
     * Prefix for all the imported component.
     * @default "Ui"
     */
    prefix: "",
    /**
     * Directory that the component lives in.
     * Will respect the Nuxt aliases.
     * @link https://nuxt.com/docs/api/nuxt-config#alias
     * @default "@/components/ui"
     */
    componentDir: "@/components/ui",
  },
  runtimeConfig: {
    oauth: {
      google: {
        clientId: process.env.NUXT_OAUTH_GOOGLE_CLIENT_ID,
        clientSecret: process.env.NUXT_OAUTH_GOOGLE_CLIENT_SECRET,
        redirectURL: process.env.NUXT_OAUTH_GOOGLE_REDIRECT_URL,
      },
    },
    private: {},
  },
  auth: {
    webAuthn: true,
  },

  site: {
    url: process.env.NUXT_PUBLIC_SITE_URL || "http://localhost:3001",
    name: process.env.NUXT_PUBLIC_SITE_NAME || "Zadaci",
    description: "A powerful and collaborative task management platform designed for modern teams.",
    defaultLocale: "en",
  },

  schemaOrg: {
    identity: {
      type: "Organization",
      name: "Crow Studio",
    },
  },

  routeRules: {
    "/workspace/**": {
      robots: false,
    },
  },

  colorMode: {
    preference: "light", // default value of $colorMode.preference
    fallback: "light", // fallback value if not system preference found
    globalName: "__NUXT_COLOR_MODE__",
    componentName: "ColorScheme",
    classPrefix: "",
    classSuffix: "",
    storage: "cookie", // or 'sessionStorage' or 'cookie'
    storageKey: "zadaci-color-mode",
    cookieAttrs: { "max-age": "31536000", path: "/" },
  },
});
