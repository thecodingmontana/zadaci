import { createEnv } from "@t3-oss/env-nuxt";
import * as z from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.url(),
  },
});
