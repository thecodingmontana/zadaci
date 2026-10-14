import type { ApolloClientIntegration } from "@apollo/client-integration-tanstack-start";
import { TanStackDevtools } from "@tanstack/react-devtools";
import {
	createRootRouteWithContext,
	HeadContent,
	ScriptOnce,
	Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { Toaster } from "#/components/toast/toaster";
import { APPEARANCE_SCRIPT } from "#/lib/appearance";
import appCss from "../styles.css?url";

export const Route =
	createRootRouteWithContext<ApolloClientIntegration.RouterContext>()({
		head: () => ({
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
			],
			links: [
				{
					rel: "stylesheet",
					href: appCss,
				},
			],
		}),
		shellComponent: RootDocument,
	});

function RootDocument({ children }: { children: React.ReactNode }) {
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
					]}
				/>
				<Scripts />
			</body>
		</html>
	);
}
