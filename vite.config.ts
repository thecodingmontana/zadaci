import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import { checkRegions, SERVER_REGION } from "./src/lib/deploy-region.ts";

// every build (Vercel sets DATABASE_URL) stops if the database isn't next to the server
checkRegions(process.env.DATABASE_URL);

// one id per build, in both the browser code and /api/version: an open tab (or the installed
// app) that differs from the server knows a new version is out and offers to reload
const BUILD = process.env.VERCEL_GIT_COMMIT_SHA ?? `dev-${Date.now()}`;

const config = defineConfig({
	resolve: { tsconfigPaths: true },
	define: { __BUILD__: JSON.stringify(BUILD) },
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
