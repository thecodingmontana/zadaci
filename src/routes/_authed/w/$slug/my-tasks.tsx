import { createFileRoute } from "@tanstack/react-router";
import { WorkspaceTasks } from "#/components/tasks/workspace-tasks";
import { TASKS } from "#/graphql/operations";
import { reloadOnEnter } from "#/lib/routing";

export const Route = createFileRoute("/_authed/w/$slug/my-tasks")({
	shouldReload: reloadOnEnter,
	loader: ({ context, params }) =>
		context.apolloClient.query({
			query: TASKS,
			variables: { slug: params.slug },
			fetchPolicy: "network-only",
		}),
	head: () => ({ meta: [{ title: "My Tasks - Zadaci" }] }),
	component: Page,
});

function Page() {
	const { slug } = Route.useParams();
	return <WorkspaceTasks slug={slug} kind="my" />;
}
