import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

const config = defineConfig({
	resolve: { tsconfigPaths: true },
	plugins: [
		devtools(),
		nitro({
			rollupConfig: { external: [/^@sentry\//] },
			// run next to the database (Supabase eu-central-1): every query used to cross the Atlantic
			vercel: { functions: { regions: ["fra1"] } },
		}),
		tailwindcss(),
		tanstackStart(),
		viteReact(),
	],
});

export default config;
