import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
import MotionResolver from "motion-v/resolver";
import Components from "unplugin-vue-components/vite";
import { env } from "./env";

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
      include: [
        "@lucide/vue",
        "@oslojs/crypto/sha2",
        "@oslojs/encoding",
        "@radix-icons/vue",
        "@supabase/supabase-js",
        "@t3-oss/env-nuxt",
        "@tanstack/vue-query",
        "@unhead/schema-org/vue",
        "@vee-validate/zod",
        "@vueuse/core",
        "class-variance-authority",
        "clsx",
        "date-fns",
        "motion-v",
        "nanoid",
        "reka-ui",
        "rxdb",
        "rxdb/plugins/dev-mode",
        "rxdb/plugins/replication",
        "rxdb/plugins/storage-dexie",
        "rxdb/plugins/validate-ajv",
        "tailwind-merge",
        "vee-validate",
        "zod",
      ],
    },
    build: {
      rollupOptions: {
        onwarn(warning, warn) {
          if (
            warning.code === "SOURCEMAP_ERROR" ||
            warning.code === "PLUGIN_WARNING" ||
            warning.message?.includes("#__PURE__") ||
            warning.message?.includes("Sourcemap is likely to be incorrect")
          ) {
            return;
          }
          warn(warning);
        },
      },
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
    "evlog/nuxt",
    "@pinia/nuxt",
    "@nuxt/image",
    "pinia-plugin-persistedstate/nuxt",
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
    public: {
      supabase: {
        url: env.SUPABASE_URL,
        anonKey: env.SUPABASE_ANON_KEY,
      },
    },
    private: {},
  },
  auth: {
    webAuthn: true,
    hash: {
      driver: "argon2",
      argon2: {
        variant: "id", // argon2id - resistant to both GPU cracking and side-channel attacks
        version: 0x13, // v19, the latest and strongest version
        iterations: 3, // OWASP baseline; raises compute cost per hash
        memory: 65536, // 64 MiB - the actual security lever; higher = harder to brute-force at scale
        parallelism: 4, // threads used per hash; tune to your server's CPU cores
        saltSize: 16, // 16 bytes is standard, no need to increase
        hashLength: 32, // 32 bytes output, standard for argon2id
      },
    },
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
  nitro: {
    rollupConfig: {
      plugins: [vue()],
    },
    experimental: {
      openAPI: true,
    },
    openAPI: {
      route: "/_docs/openapi.json",
      ui: {
        scalar: {
          route: "/_docs/scalar",
        },
        swagger: {
          route: "/_docs/swagger",
        },
      },
    },
  },
  evlog: {
    env: {
      service: "zadaci-app",
    },
  },
  pinia: {
    storesDirs: ["./app/stores/**"],
  },
  piniaPluginPersistedstate: {
    storage: "cookies",
    cookieOptions: {
      sameSite: "lax",
    },
    debug: true,
  },
  app: {
    head: {
      link: [
        // Basic favicon
        { rel: "icon", type: "image/x-icon", href: "/favicon.ico" },

        // Standard sizes
        { rel: "icon", type: "image/png", sizes: "16x16", href: "/favicon-16x16.png" },
        { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32x32.png" },

        // Apple devices
        { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },

        // Android devices
        { rel: "icon", type: "image/png", sizes: "192x192", href: "/android-chrome-192x192.png" },
        { rel: "icon", type: "image/png", sizes: "512x512", href: "/android-chrome-512x512.png" },

        // Web App Manifest
        { rel: "manifest", href: "/site.webmanifest" },
      ],
    },
  },
});
