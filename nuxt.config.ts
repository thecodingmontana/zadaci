import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
import MotionResolver from "motion-v/resolver";
import { defineOrganization } from "nuxt-schema-org/schema";
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
        "@tanstack/vue-hotkeys",
        "@tanstack/vue-hotkeys-devtools",
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
        "rxdb/plugins/migration-schema",
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
    "nuxt-ai-ready",
    "@vue-dnd-kit/nuxt",
    "@nuxt/icon",
    "@nuxtjs/color-mode",
    "evlog/nuxt",
    "@pinia/nuxt",
    "@nuxt/image",
    "pinia-plugin-persistedstate/nuxt",
    "@vueuse/nuxt",
  ],
  eslint: {
    config: {
      standalone: false,
    },
  },

  shadcn: {
    prefix: "",
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
        variant: "id",
        version: 0x13,
        iterations: 3,
        memory: 65536,
        parallelism: 4,
        saltSize: 16,
        hashLength: 32,
      },
    },
  },

  site: {
    url: process.env.NUXT_PUBLIC_SITE_URL || "https://zadaci.vercel.app",
    name: process.env.NUXT_PUBLIC_SITE_NAME || "Zadaci",
    description: "Local-first project management for small teams.",
    defaultLocale: "en",
  },

  robots: {
    disallow: ["/api", "/auth", "/test"],
    groups: [
      {
        userAgent: "*",
        allow: "/",
        contentUsage: {
          bots: "y",
          "train-ai": "n",
        },
        contentSignal: {
          "ai-train": "no",
          search: "yes",
        },
      },
    ],
  },

  sitemap: {
    exclude: ["/auth/**", "/test/**", "/workspace/**"],
  },

  schemaOrg: {
    identity: defineOrganization({
      name: "Crow Studio",
      url: process.env.NUXT_PUBLIC_SITE_URL || "https://zadaci.vercel.app",
      logo: "/logo.png",
      sameAs: ["https://x.com/codewithmontana", "https://github.com/anomalyco"],
    }),
  },

  routeRules: {
    "/workspace/**": {
      robots: false,
    },
    "/auth/**": {
      robots: false,
    },
    "/test/**": {
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
    preset: "vercel",
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
    externals: {
      inline: ["drizzle-orm", "postgres"],
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

  icon: {
    serverBundle: {
      collections: ["hugeicons", "solar"],
    },
  },
});
