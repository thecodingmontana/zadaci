import { createFileRoute, redirect } from "@tanstack/react-router";
import { WORKSPACES } from "#/graphql/operations";

export const Route = createFileRoute("/_authed/workspace/")({
	loader: async ({ context }) => {
		const { data } = await context.apolloClient.query({
			query: WORKSPACES,
			fetchPolicy: "network-only",
		});
		const first = data?.workspaces[0];
		throw first
			? redirect({ to: "/w/$slug", params: { slug: first.slug } })
			: redirect({ to: "/onboarding" });
	},
});
