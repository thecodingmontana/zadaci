import { createEnv } from "@t3-oss/env-nuxt";
import * as z from "zod";

export const env = createEnv({
  client: {
    NUXT_PUBLIC_SITE_URL: z.url(),
    NUXT_PUBLIC_SITE_NAME: z.string(),
  },
  server: {
    NITRO_PORT: z.coerce.number(),
    NUXT_SESSION_PASSWORD: z.string(),
    ENCRYPTION_KEY: z.string(),

    NUXT_OAUTH_GOOGLE_CLIENT_ID: z.string(),
    NUXT_OAUTH_GOOGLE_CLIENT_SECRET: z.string(),
    NUXT_OAUTH_GOOGLE_REDIRECT_URL: z.url(),

    DATABASE_URL: z.url(),
    SUPABASE_URL: z.string(),
    SUPABASE_ANON_KEY: z.string(),

    NUXT_RESEND_API_KEY: z.string(),

    NUXT_CLOUDINARY_CLOUD_NAME: z.string(),
    NUXT_CLOUDINARY_CLOUD_API_KEY: z.string(),
    NUXT_CLOUDINARY_CLOUD_API_SECRET: z.string(),

    NUXT_OG_IMAGE_SECRET: z.string(),
  },
});
