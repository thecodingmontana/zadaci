import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import { checkRegions, SERVER_REGION } from "./src/lib/deploy-region.ts";

// every build (Vercel sets DATABASE_URL) stops if the database isn't next to the server
checkRegions(process.env.DATABASE_URL);

const config = defineConfig({
	resolve: { tsconfigPaths: true },
	plugins: [
		devtools(),
		nitro({
			rollupConfig: { external: [/^@sentry\//] },
			// run next to the database (Supabase eu-central-1): every query used to cross the Atlantic
			vercel: { functions: { regions: [SERVER_REGION] } },
		}),
		tailwindcss(),
		tanstackStart(),
		viteReact(),
	],
});

export default config;
