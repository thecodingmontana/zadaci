import { useMutation, useQuery } from "@apollo/client/react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { Modal } from "#/components/q/modal";
import { Button } from "#/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "#/components/ui/command";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "#/components/ui/popover";
import {
	CONNECT_GITHUB,
	DISCONNECT_GITHUB,
	PROJECT_GITHUB,
} from "#/graphql/github-operations";
import { copy, toast } from "#/lib/toast";
import { cn } from "#/lib/utils";

const RESULTS: Record<string, string> = {
	account: "GitHub connected. Now pick a repo for a project.",
	cancelled: "GitHub wasn't approved, so nothing changed.",
	failed: "GitHub didn't answer as expected. Try again in a moment.",
};

/** Back from connecting GitHub (?github=…): say how it went, then tidy the address. */
export function useGitHubResult() {
	const { github } = useSearch({ strict: false }) as { github?: string };
	const navigate = useNavigate();
	useEffect(() => {
		if (!github) return;
		if (github === "account") toast.success(RESULTS.account);
		else
			toast.error("Couldn't connect GitHub", {
				desc: RESULTS[github] ?? RESULTS.failed,
			});
		void navigate({
			to: ".",
			search: (s: Record<string, unknown>) => ({ ...s, github: undefined }),
			replace: true,
		});
	}, [github, navigate]);
}

/** Off to GitHub to connect your account, then back to this page. */
export const connectGitHubAccount = () => {
	location.href = `/api/github/connect?${new URLSearchParams({ back: location.pathname + location.search })}`;
};

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
	// the project menu shows the linked repo, so refresh it too
	const opts = {
		refetchQueries: ["ProjectGitHub", "Shell", "ProjectPage"],
		awaitRefetchQueries: true,
	};
	const [connect, connecting] = useMutation(CONNECT_GITHUB, opts);
	const [disconnect] = useMutation(DISCONNECT_GITHUB, opts);
	const [repo, setRepo] = useState("");
	const [picking, setPicking] = useState(false);
	const link = data?.projectGitHub;
	const account = data?.githubAccount;
	const ready = !!data?.githubConnectReady;

	async function linkRepo(name: string) {
		try {
			await connect({ variables: { ...vars, repo: name } });
			setRepo("");
			toast.success(
				account
					? `Linked ${name}. GitHub now sends its pull requests here.`
					: `Linked ${name}`,
			);
		} catch (err) {
			toast.error("Couldn't link the repo", { desc: (err as Error).message });
		}
	}
	const submit = (e: FormEvent) => {
		e.preventDefault();
		void linkRepo(repo);
	};

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

	const byHand = (body: ReactNode) => (
		<details style={{ fontSize: 13 }}>
			<summary className="faint" style={{ cursor: "pointer" }}>
				Set it up by hand instead
			</summary>
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					gap: 10,
					marginTop: 10,
				}}
			>
				{body}
			</div>
		</details>
	);

	const repoForm = (
		<form onSubmit={submit}>
			<label className="label" htmlFor="gh-repo">
				Which repo?
			</label>
			<div className="row" style={{ gap: 8 }}>
				<input
					id="gh-repo"
					className="input grow"
					value={repo}
					onChange={(e) => setRepo(e.target.value)}
					placeholder="octocat/hello-world, or paste its GitHub link"
					required
				/>
				<button
					type="submit"
					className={cn("btn btn-primary", connecting.loading && "is-loading")}
					disabled={connecting.loading || !repo.trim()}
				>
					Link repo
				</button>
			</div>
		</form>
	);

	function notLinked() {
		if (!ready) return repoForm;
		if (!account)
			return (
				<>
					<p style={{ fontSize: 13 }}>
						Connect your GitHub account once, then pick the repo here and we add
						its webhook for you.
					</p>
					<div>
						<button
							type="button"
							className="btn btn-primary"
							onClick={connectGitHubAccount}
						>
							<span
								className="icon-[simple-icons--github] size-4"
								aria-hidden="true"
							/>
							Connect GitHub
						</button>
					</div>
					{byHand(repoForm)}
				</>
			);
		const ghIcon = (
			<span
				className="icon-[simple-icons--github] size-3.5 shrink-0"
				aria-hidden="true"
			/>
		);
		return (
			<>
				<div>
					<span className="label" id="gh-pick-l">
						Repo
					</span>
					<Popover open={picking} onOpenChange={setPicking}>
						<PopoverTrigger asChild>
							<Button
								type="button"
								variant="outline"
								role="combobox"
								aria-expanded={picking}
								aria-labelledby="gh-pick-l"
								className="w-full justify-start font-normal"
								disabled={connecting.loading}
							>
								{ghIcon}
								<span className="grow text-left text-muted-foreground">
									{connecting.loading ? "Linking…" : "Choose a repo…"}
								</span>
								<span
									className="icon-[solar--alt-arrow-down-linear] size-3.5 opacity-50"
									aria-hidden="true"
								/>
							</Button>
						</PopoverTrigger>
						<PopoverContent
							className="w-(--radix-popover-trigger-width) p-0"
							align="start"
						>
							<Command>
								<CommandInput placeholder="Search your repos…" />
								<CommandList>
									<CommandEmpty>No repos you admin match.</CommandEmpty>
									<CommandGroup>
										{account.repos.map((r) => (
											<CommandItem
												key={r}
												value={r}
												onSelect={() => {
													setPicking(false);
													void linkRepo(r);
												}}
											>
												{ghIcon}
												{r}
											</CommandItem>
										))}
									</CommandGroup>
								</CommandList>
							</Command>
						</PopoverContent>
					</Popover>
					<p className="faint" style={{ fontSize: 12, marginTop: 8 }}>
						Connected as <b>@{account.login}</b>. The list shows public repos
						you admin; we add the webhook for you.
					</p>
				</div>
			</>
		);
	}

	const manual = link && (
		<>
			<p style={{ fontSize: 13 }}>
				On GitHub, open the repo's <b>Settings → Webhooks → Add webhook</b>,
				paste these, set the content type to <code>application/json</code>, and
				pick <b>Let me select individual events → Pull requests</b>.
			</p>
			{copyRow("Payload URL", link.webhookUrl)}
			{copyRow("Secret", link.secret)}
		</>
	);

	return (
		<Modal
			open={open}
			onOpenChange={onOpenChange}
			title={link ? "GitHub" : "Connect with GitHub"}
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
						{account ? byHand(manual) : manual}
						<p className="faint" style={{ fontSize: 12 }}>
							Merges complete tasks as you (the person who linked the repo).
							{account
								? " Unlinking removes the webhook from the repo too."
								: " Linking again makes a new secret."}
						</p>
					</>
				) : (
					notLinked()
				)}
			</div>
		</Modal>
	);
}
