import { HttpLink } from "@apollo/client";
import {
	ApolloClient,
	InMemoryCache,
	routerWithApolloClient,
} from "@apollo/client-integration-tanstack-start";
import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { PageFailed, PageNotFound } from "#/components/states";
import { routeTree } from "./routeTree.gen";

// During SSR, run GraphQL in-process with the visitor's cookies instead of an HTTP round-trip.
const graphqlFetch = createIsomorphicFn()
	.server((): typeof fetch => async (_input, init) => {
		const [{ yoga }, { getRequestHeaders }] = await Promise.all([
			import("#/graphql/yoga.server"),
			import("@tanstack/react-start/server"),
		]);
		const headers = new Headers(init?.headers);
		const cookie = getRequestHeaders().get("cookie");
		if (cookie) headers.set("cookie", cookie);
		return yoga.fetch(
			new Request("http://internal/api/graphql", { ...init, headers }),
		);
	})
	.client((): typeof fetch => fetch);

export function getRouter() {
	const apolloClient = new ApolloClient({
		cache: new InMemoryCache(),
		link: new HttpLink({ uri: "/api/graphql", fetch: graphqlFetch() }),
		// opening a page shows what's cached at once, then refreshes it from the server, so changes
		// made by Zad or by teammates while you were elsewhere show up; afterwards it reads the cache
		defaultOptions: {
			watchQuery: {
				fetchPolicy: "cache-and-network",
				nextFetchPolicy: "cache-first",
			},
		},
	});

	const router = createTanStackRouter({
		routeTree,
		context: { ...routerWithApolloClient.defaultContext },
		scrollRestoration: true,
		defaultPreload: "intent",
		defaultPreloadStaleTime: 0,
		defaultNotFoundComponent: PageNotFound,
		// a page that throws shows the "Something went wrong" state in its place
		defaultErrorComponent: PageFailed,
		// pages with a loading skeleton show it once loading passes 150ms, for at least 200ms
		defaultPendingMs: 150,
		defaultPendingMinMs: 200,
	});

	return routerWithApolloClient(router, apolloClient);
}

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof getRouter>;
	}
}
