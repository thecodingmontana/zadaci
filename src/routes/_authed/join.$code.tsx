import { createFileRoute, redirect } from "@tanstack/react-router";
import { JOIN_WORKSPACE } from "#/graphql/operations";

export const Route = createFileRoute("/_authed/join/$code")({
	loader: async ({ context, params }) => {
		const { data, error } = await context.apolloClient.mutate({
			mutation: JOIN_WORKSPACE,
			variables: { code: params.code },
		});
		if (error) throw error;
		if (!data) throw new Error("Couldn't join this workspace");
		throw redirect({
			to: "/w/$slug",
			params: { slug: data.joinWorkspace.slug },
		});
	},
	errorComponent: ({ error }) => (
		<main className="grid min-h-dvh place-items-center p-6 text-center">
			<p className="max-w-sm text-pretty">
				{error instanceof Error
					? error.message
					: "Couldn't join this workspace"}
			</p>
		</main>
	),
});
