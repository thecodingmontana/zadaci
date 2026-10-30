import { useMutation, useQuery } from "@apollo/client/react";
import { type FormEvent, useState } from "react";
import { Modal } from "#/components/q/modal";
import {
	CONNECT_GITHUB,
	DISCONNECT_GITHUB,
	PROJECT_GITHUB,
} from "#/graphql/github-operations";
import { copy, toast } from "#/lib/toast";
import { cn } from "#/lib/utils";

/** Link a project to a GitHub repo: PRs that mention a task's key show on it; merging completes it. */
export function GitHubModal({
	slug,
	projectId,
	open,
	onOpenChange,
}: {
	slug: string;
	projectId: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const vars = { slug, projectId };
	const { data, loading } = useQuery(PROJECT_GITHUB, {
		variables: vars,
		skip: !open,
		fetchPolicy: "network-only",
	});
	const opts = { refetchQueries: ["ProjectGitHub"], awaitRefetchQueries: true };
	const [connect, connecting] = useMutation(CONNECT_GITHUB, opts);
	const [disconnect] = useMutation(DISCONNECT_GITHUB, opts);
	const [repo, setRepo] = useState("");
	const link = data?.projectGitHub;

	async function submit(e: FormEvent) {
		e.preventDefault();
		try {
			await connect({ variables: { ...vars, repo } });
			setRepo("");
		} catch (err) {
			toast.error("Couldn't link the repo", { desc: (err as Error).message });
		}
	}

	const copyRow = (label: string, value: string) => (
		<div className="row" style={{ gap: 8, alignItems: "center" }}>
			<span className="faint" style={{ width: 92, fontSize: 13, flex: "none" }}>
				{label}
			</span>
			<code className="mcp-cmd grow">{value}</code>
			<button
				type="button"
				className="btn btn-secondary btn-sm"
				onClick={() => copy(value, label.toLowerCase())}
			>
				<span
					className="icon-[solar--copy-linear] size-3.5"
					aria-hidden="true"
				/>
				Copy
			</button>
		</div>
	);

	return (
		<Modal
			open={open}
			onOpenChange={onOpenChange}
			title="GitHub"
			sub="Pull requests that mention a task's key (like WEB-12 in the title, or a branch named web-12-login) show on the task, and merging one completes it."
		>
			<div
				className="modal-b"
				style={{ display: "flex", flexDirection: "column", gap: 14 }}
			>
				{loading && !data ? (
					<span className="sk" style={{ height: 14, width: 220 }} />
				) : link ? (
					<>
						<div className="row" style={{ gap: 8, alignItems: "center" }}>
							<span
								className="icon-[simple-icons--github] size-4"
								aria-hidden="true"
							/>
							<a
								className="grow"
								href={`https://github.com/${link.repo}`}
								target="_blank"
								rel="noopener noreferrer"
								style={{ fontWeight: 600 }}
							>
								{link.repo}
							</a>
							<button
								type="button"
								className="btn btn-danger-ghost btn-sm"
								onClick={() =>
									void toast
										.promise(disconnect({ variables: vars }), {
											loading: "Unlinking…",
											success: "Repo unlinked",
											error: "Couldn't unlink it",
										})
										.catch(() => {})
								}
							>
								Unlink
							</button>
						</div>
						<p style={{ fontSize: 13 }}>
							On GitHub, open the repo's{" "}
							<b>Settings → Webhooks → Add webhook</b>, paste these, set the
							content type to <code>application/json</code>, and pick{" "}
							<b>Let me select individual events → Pull requests</b>.
						</p>
						{copyRow("Payload URL", link.webhookUrl)}
						{copyRow("Secret", link.secret)}
						<p className="faint" style={{ fontSize: 12 }}>
							Merges complete tasks as you (the person who linked the repo).
							Linking again makes a new secret.
						</p>
					</>
				) : (
					<form onSubmit={submit} className="row" style={{ gap: 8 }}>
						<input
							className="input grow"
							value={repo}
							onChange={(e) => setRepo(e.target.value)}
							placeholder="owner/repo, or the repo's GitHub URL"
							aria-label="GitHub repo"
							required
						/>
						<button
							type="submit"
							className={cn(
								"btn btn-primary",
								connecting.loading && "is-loading",
							)}
							disabled={connecting.loading}
						>
							<span
								className="icon-[simple-icons--github] size-4"
								aria-hidden="true"
							/>
							Link repo
						</button>
					</form>
				)}
			</div>
		</Modal>
	);
}
