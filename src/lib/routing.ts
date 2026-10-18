import type { ApolloClient, OperationVariables } from "@apollo/client";

/**
 * Loaders re-run when you enter a page, not when you stay on it and only the URL's
 * search changes (opening the task drawer, switching a tab). A filter change still
 * reloads, because it changes the loader deps and so counts as entering.
 */
export const reloadOnEnter = ({
	cause,
}: {
	cause: "preload" | "enter" | "stay";
}) => cause !== "stay";

/**
 * A loader's query, stale-while-revalidate: data already in the cache shows at once and is
 * refreshed in the background (the page re-renders when it lands); only a first visit waits.
 */
export function prime<TData, TVariables extends OperationVariables>(
	client: ApolloClient,
	options: ApolloClient.QueryOptions<TData, TVariables>,
): Promise<{ data: TData | undefined }> {
	const fresh = () => client.query({ ...options, fetchPolicy: "network-only" });
	const cached = client.readQuery<TData, TVariables>(
		options as ApolloClient.ReadQueryOptions<TData, TVariables>,
	);
	if (cached == null) return fresh();
	// a failed refresh keeps what's on screen; the next visit tries again
	void fresh().catch(() => {});
	return Promise.resolve({ data: cached });
}
