import { useMutation } from "@apollo/client/react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AuthShell } from "#/components/auth/auth-shell";
import { WsLogo } from "#/components/q/ws-logo";
import { Button } from "#/components/ui/button";
import {
	DECLINE_INVITE,
	INVITE_PREVIEW,
	JOIN_WORKSPACE,
} from "#/graphql/operations";
import { authClient } from "#/lib/auth-client";
import { ROLE_LABEL } from "#/lib/preferences";
import { toast } from "#/lib/toast";

// Where an invite link lands: you see the workspace and who asked you in, then accept or decline.
// Signing in first (new account or not) brings you back here.

export const Route = createFileRoute("/_authed/join/$code")({
	loader: async ({ context, params }) => {
		const { data, error } = await context.apolloClient.query({
			query: INVITE_PREVIEW,
			variables: { code: params.code },
			fetchPolicy: "network-only",
		});
		if (error) throw error;
		return { invite: data?.invitePreview ?? null };
	},
	head: () => ({ meta: [{ title: "Join a workspace · Zadaci" }] }),
	component: JoinPage,
	errorComponent: ({ error }) => (
		<AuthShell
			title="Couldn't open this invite"
			description={
				error instanceof Error ? error.message : "Try the link again."
			}
		>
			<GoHome />
		</AuthShell>
	),
});

function GoHome({ label = "Go to Zadaci" }: { label?: string }) {
	return (
		<Button asChild variant="outline" size="lg" className="w-full">
			<Link to="/workspace">{label}</Link>
		</Button>
	);
}

function JoinPage() {
	const { code } = Route.useParams();
	const { invite } = Route.useLoaderData();
	const { user } = Route.useRouteContext();
	const navigate = useNavigate();
	const [join, joining] = useMutation(JOIN_WORKSPACE);
	const [decline, declining] = useMutation(DECLINE_INVITE);
	const [switching, setSwitching] = useState(false);
	const busy = joining.loading || declining.loading || switching;

	if (!invite)
		return (
			<AuthShell
				title="This invite has expired"
				description="It was used, withdrawn or is too old. Ask whoever invited you for a new link."
			>
				<GoHome />
			</AuthShell>
		);

	if (invite.joinedSlug)
		return (
			<AuthShell
				title={`You're already in ${invite.workspace}`}
				description="Nothing to accept: the workspace is in your list."
			>
				<Button asChild size="lg" className="w-full">
					<Link to="/w/$slug" params={{ slug: invite.joinedSlug }}>
						Open {invite.workspace}
					</Link>
				</Button>
			</AuthShell>
		);

	if (!invite.forYou)
		return (
			<AuthShell
				title="This invite is for someone else"
				description={
					<>
						It was sent to <b className="text-foreground">{invite.email}</b>,
						and you're signed in as{" "}
						<b className="text-foreground">{user.email}</b>.
					</>
				}
			>
				<div className="flex flex-col gap-2">
					<Button
						size="lg"
						className="w-full"
						disabled={busy}
						onClick={async () => {
							setSwitching(true);
							await authClient.signOut();
							await navigate({
								to: "/auth/signin",
								search: { redirect: `/join/${code}` },
							});
						}}
					>
						Sign in as {invite.email}
					</Button>
					<GoHome />
				</div>
			</AuthShell>
		);

	const role = ROLE_LABEL[invite.role] ?? "Member";
	const accept = async () => {
		try {
			const { data } = await join({ variables: { code } });
			if (!data) throw new Error("Couldn't join this workspace");
			await navigate({
				to: "/w/$slug",
				params: { slug: data.joinWorkspace.slug },
			});
		} catch (e) {
			toast.error("Couldn't join the workspace", {
				desc: (e as Error).message,
			});
		}
	};
	const refuse = async () => {
		try {
			await decline({ variables: { code } });
			toast.success(`You declined the invite to ${invite.workspace}`);
			await navigate({ to: "/workspace" });
		} catch (e) {
			toast.error("Couldn't decline the invite", {
				desc: (e as Error).message,
			});
		}
	};

	return (
		<AuthShell
			title={`Join ${invite.workspace}`}
			description={
				invite.inviter
					? `${invite.inviter} invited you to join as ${article(role)} ${role}.`
					: `You've been invited to join as ${article(role)} ${role}.`
			}
		>
			<div className="flex items-center gap-3 rounded-lg border p-4">
				<WsLogo
					workspace={{
						name: invite.workspace,
						color: invite.color,
						imageUrl: invite.imageUrl,
					}}
					px={40}
				/>
				<div className="min-w-0 text-sm">
					<p className="truncate font-medium">{invite.workspace}</p>
					<p className="text-muted-foreground">
						{invite.members} {invite.members === 1 ? "member" : "members"}
					</p>
				</div>
			</div>
			<div className="flex flex-col gap-2">
				<Button
					size="lg"
					className="w-full"
					disabled={busy}
					aria-busy={joining.loading}
					onClick={() => void accept()}
				>
					{joining.loading ? "Joining…" : "Accept and join"}
				</Button>
				<Button
					variant="outline"
					size="lg"
					className="w-full"
					disabled={busy}
					aria-busy={declining.loading}
					onClick={() => void refuse()}
				>
					{declining.loading ? "Declining…" : "Decline"}
				</Button>
			</div>
			<p className="text-center text-xs text-pretty text-muted-foreground">
				Signed in as {user.email}
			</p>
		</AuthShell>
	);
}

const article = (word: string) => (/^[aeiou]/i.test(word) ? "an" : "a");
