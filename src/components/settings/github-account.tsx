import { useMutation, useQuery } from "@apollo/client/react";
import {
	connectGitHubAccount,
	useGitHubResult,
} from "#/components/projects/github-modal";
import {
	DISCONNECT_GITHUB_ACCOUNT,
	GITHUB_ACCOUNT,
} from "#/graphql/github-operations";
import { toast } from "#/lib/toast";
import { SRow } from "./ui";

/** Settings → Connected apps: your GitHub account, connected once for every project. */
export function GitHubAccountRow() {
	useGitHubResult();
	const { data } = useQuery(GITHUB_ACCOUNT, { fetchPolicy: "network-only" });
	const [disconnect] = useMutation(DISCONNECT_GITHUB_ACCOUNT, {
		refetchQueries: ["GitHubAccount"],
		awaitRefetchQueries: true,
	});
	// not set up on this server (no GitHub OAuth app): nothing to connect
	if (!data?.githubConnectReady) return null;
	const account = data.githubAccount;
	return (
		<SRow
			t={
				<span className="row" style={{ gap: 8 }}>
					<span
						className="icon-[simple-icons--github] size-4 shrink-0"
						aria-hidden="true"
					/>
					GitHub
				</span>
			}
			d={
				account
					? `Connected as @${account.login}. Link a repo from a project's ⋯ → Connect with GitHub.`
					: "Link your projects to repos: pull requests show on tasks, and merging one completes it."
			}
		>
			{account ? (
				<button
					type="button"
					className="btn btn-secondary btn-sm"
					onClick={() =>
						void toast
							.promise(disconnect(), {
								loading: "Disconnecting GitHub…",
								success: "GitHub disconnected",
								error: "Couldn't disconnect it",
							})
							.catch(() => {})
					}
				>
					Disconnect
				</button>
			) : (
				<button
					type="button"
					className="btn btn-primary btn-sm"
					onClick={connectGitHubAccount}
				>
					Connect GitHub
				</button>
			)}
		</SRow>
	);
}
