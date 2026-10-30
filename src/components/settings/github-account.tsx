import { useMutation, useQuery } from "@apollo/client/react";
import { useState } from "react";
import {
	connectGitHubAccount,
	useGitHubResult,
} from "#/components/projects/github-modal";
import { ConfirmModal } from "#/components/q/confirm";
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
		// linked projects get unlinked: refresh the menus that show their repo
		refetchQueries: ["GitHubAccount", "Shell", "ProjectPage"],
		awaitRefetchQueries: true,
	});
	const [confirming, setConfirming] = useState(false);
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
					onClick={() => setConfirming(true)}
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
			{account && (
				<ConfirmModal
					open={confirming}
					onOpenChange={setConfirming}
					title="Disconnect GitHub?"
					ok="Disconnect"
					danger
					body={<DisconnectNote linked={account.linkedProjects} />}
					onConfirm={() =>
						toast
							.promise(disconnect(), {
								loading: "Disconnecting GitHub…",
								success: "GitHub disconnected",
								error: "Couldn't disconnect it",
							})
							.catch(() => {})
					}
				/>
			)}
		</SRow>
	);
}

/** What disconnecting does, and doesn't, change. */
function DisconnectNote({
	linked,
}: {
	linked: { title: string; repo: string }[];
}) {
	return (
		<div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
			<p>
				We delete your GitHub access here and revoke Zadaci on GitHub. To link a
				repo again, you connect again.
			</p>
			{linked.length > 0 ? (
				<>
					<p>
						These projects get unlinked and their webhooks removed from the
						repos, so new pull requests stop showing on tasks. The ones already
						on tasks stay.
					</p>
					<ul style={{ paddingLeft: 18, listStyle: "disc" }}>
						{linked.map((l) => (
							<li key={`${l.title}:${l.repo}`}>
								<b>{l.title}</b> <span className="faint">→ {l.repo}</span>
							</li>
						))}
					</ul>
				</>
			) : (
				<p>No projects are linked through your account.</p>
			)}
		</div>
	);
}
