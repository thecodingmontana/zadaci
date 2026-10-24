import type { ApolloClientIntegration } from "@apollo/client-integration-tanstack-start";
import { aiDevtoolsPlugin } from "@tanstack/react-ai-devtools";
import { TanStackDevtools } from "@tanstack/react-devtools";
import {
	createRootRouteWithContext,
	HeadContent,
	ScriptOnce,
	Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { useEffect } from "react";
import { Toaster } from "#/components/toast/toaster";
import { APPEARANCE_SCRIPT } from "#/lib/appearance";
import { startPwa } from "#/lib/install";
import { SITE_DESCRIPTION, SITE_URL } from "#/lib/seo";
import appCss from "../styles.css?url";

const pageUrl = (matches: { pathname: string }[]) =>
	`${SITE_URL}${matches[matches.length - 1]?.pathname ?? "/"}`;

export const Route =
	createRootRouteWithContext<ApolloClientIntegration.RouterContext>()({
		head: ({ matches }) => ({
			meta: [
				{
					charSet: "utf-8",
				},
				{
					name: "viewport",
					content: "width=device-width, initial-scale=1",
				},
				{
					title: "Zadaci",
				},
				{ name: "description", content: SITE_DESCRIPTION },
				{ name: "theme-color", content: "#F97452" },
				{ property: "og:site_name", content: "Zadaci" },
				{ property: "og:type", content: "website" },
				{ property: "og:title", content: "Zadaci" },
				{ property: "og:description", content: SITE_DESCRIPTION },
				{ property: "og:image", content: `${SITE_URL}/og.png` },
				{ property: "og:image:width", content: "1200" },
				{ property: "og:image:height", content: "630" },
				{
					property: "og:image:alt",
					content: "Zadaci - collaborative task management",
				},
				{ name: "twitter:card", content: "summary_large_image" },
				{ name: "twitter:title", content: "Zadaci" },
				{ name: "twitter:description", content: SITE_DESCRIPTION },
				{ name: "twitter:image", content: `${SITE_URL}/og.png` },
				// every page's own address, for link previews (pages can still override it)
				{ property: "og:url", content: pageUrl(matches) },
				{ name: "twitter:url", content: pageUrl(matches) },
			],
			links: [
				{
					rel: "stylesheet",
					href: appCss,
				},
				// the main font, self-hosted (see styles.css), fetched early so text doesn't swap
				{
					rel: "preload",
					href: "/fonts/bricolage-grotesque.woff2",
					as: "font",
					type: "font/woff2",
					crossOrigin: "anonymous",
				},
				{ rel: "icon", href: "/favicon.ico", sizes: "any" },
				{
					rel: "icon",
					type: "image/png",
					sizes: "32x32",
					href: "/favicon-32x32.png",
				},
				{
					rel: "icon",
					type: "image/png",
					sizes: "16x16",
					href: "/favicon-16x16.png",
				},
				{
					rel: "apple-touch-icon",
					sizes: "180x180",
					href: "/apple-touch-icon.png",
				},
				{ rel: "manifest", href: "/site.webmanifest" },
			],
		}),
		shellComponent: RootDocument,
	});

function RootDocument({ children }: { children: React.ReactNode }) {
	useEffect(startPwa, []);
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<HeadContent />
				<ScriptOnce>{APPEARANCE_SCRIPT}</ScriptOnce>
			</head>
			{/* browser extensions (e.g. ColorZilla) add attributes to body before hydration */}
			<body suppressHydrationWarning>
				{children}
				<Toaster position="top-center" />
				<TanStackDevtools
					config={{
						position: "bottom-right",
					}}
					plugins={[
						{
							name: "Tanstack Router",
							render: <TanStackRouterDevtoolsPanel />,
						},
						// the assistant's chats, tool calls and stream events
						aiDevtoolsPlugin(),
					]}
				/>
				<Scripts />
			</body>
		</html>
	);
}
