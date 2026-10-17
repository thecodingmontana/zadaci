import { useMutation, useQuery } from "@apollo/client/react";
import { type FormEvent, useState } from "react";
import { Av } from "#/components/q/av";
import { Modal } from "#/components/q/modal";
import { Select } from "#/components/settings/ui";
import { Sk } from "#/components/tasks/skeletons";
import {
	INVITE_TO_PROJECT,
	PROJECT_SHARE,
	SET_PROJECT_ACCESS,
	SHARE_PROJECT,
	UNSHARE_PROJECT,
} from "#/graphql/operations";
import { EMAIL_RE } from "#/lib/onboarding";
import { PROJECT_RIGHT_LABEL, PROJECT_RIGHTS } from "#/lib/permissions";
import { toast } from "#/lib/toast";
import { cn } from "#/lib/utils";

// Ported from the reference app's Share modal: invite people, set what each person can do
// in the project, and choose whether the whole workspace can open it.

const RIGHT_OPTIONS = PROJECT_RIGHTS.map(
	(r) => [r, PROJECT_RIGHT_LABEL[r]] as const,
);
const REFETCH = { refetchQueries: ["ProjectShare", "Shell", "Activity"] };

export function ShareModal({
	open,
	onOpenChange,
	slug,
	projectId,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	slug: string;
	projectId: string;
}) {
	const { data } = useQuery(PROJECT_SHARE, {
		variables: { slug, projectId },
		skip: !open,
		fetchPolicy: "cache-and-network",
	});
	const [q, setQ] = useState("");
	const [perm, setPerm] = useState("edit");
	const [share] = useMutation(SHARE_PROJECT, REFETCH);
	const [unshare] = useMutation(UNSHARE_PROJECT, REFETCH);
	const [invite, { loading: inviting }] = useMutation(
		INVITE_TO_PROJECT,
		REFETCH,
	);
	const [setAccess] = useMutation(SET_PROJECT_ACCESS, REFETCH);

	const workspace = data?.workspace;
	const project = workspace?.project;
	const canManage = project?.myAccess === "full";
	const onProject = new Set(project?.members.map((m) => m.memberId));
	const query = q.trim().toLowerCase();
	const matches = query
		? (workspace?.members ?? []).filter(
				(m) =>
					!onProject.has(m.id) &&
					(m.name.toLowerCase().includes(query) ||
						m.email.toLowerCase().includes(query)),
			)
		: [];

	const fail = (what: string) => (error: Error) =>
		toast.error(what, { desc: error.message });

	async function add(memberId: string, name: string) {
		try {
			await share({
				variables: { slug, projectId, memberId, permission: perm },
			});
			setQ("");
			toast.success(`Shared with ${name}`);
		} catch (error) {
			fail("Couldn't share the project")(error as Error);
		}
	}

	async function submit(event?: FormEvent) {
		event?.preventDefault();
		const v = q.trim();
		if (!v) return;
		const existing = workspace?.members.find(
			(m) =>
				m.email.toLowerCase() === v.toLowerCase() ||
				m.name.toLowerCase() === v.toLowerCase(),
		);
		if (existing) return add(existing.id, existing.name);
		if (!EMAIL_RE.test(v))
			return toast.error("Enter a valid email address, like name@company.com");
		try {
			await invite({
				variables: { slug, projectId, email: v, permission: perm },
			});
			setQ("");
			toast.success(`Invitation sent to ${v}`);
		} catch (error) {
			fail("Couldn't send the invitation")(error as Error);
		}
	}

	return (
		<Modal
			open={open}
			onOpenChange={onOpenChange}
			title={project ? `Share “${project.title}”` : "Share"}
			footer={
				<>
					<button
						type="button"
						className="btn btn-secondary"
						onClick={async () => {
							await navigator.clipboard.writeText(
								`${location.origin}/w/${slug}/p/${projectId}`,
							);
							toast.success("Link copied");
						}}
					>
						<span
							className="icon-[solar--link-linear] size-3.5"
							aria-hidden="true"
						/>
						Copy link
					</button>
					<span className="sp" />
					<button
						type="button"
						className="btn btn-primary"
						onClick={() => onOpenChange(false)}
					>
						Done
					</button>
				</>
			}
		>
			<div className="modal-b">
				{!project ? (
					// the people list, shaped like it, while the project's members load
					<div aria-busy="true">
						<span className="sr">Loading people with access…</span>
						<Sk w="100%" h={34} r={8} />
						<div className="eyebrow" style={{ margin: "16px 0 4px" }}>
							People with access
						</div>
						{[56, 44, 64].map((w) => (
							<div key={w} className="row" style={{ height: 44 }}>
								<Sk w={28} h={28} r="50%" />
								<div className="grow col" style={{ gap: 6 }}>
									<Sk w={`${w}%`} h={11} />
									<Sk w={`${w - 14}%`} h={9} />
								</div>
								<Sk w={84} h={12} />
							</div>
						))}
					</div>
				) : (
					<>
						{canManage ? (
							<form className="row" style={{ gap: 6 }} onSubmit={submit}>
								<div className="grow">
									<label className="sr" htmlFor="share-in">
										Invite by email
									</label>
									<input
										className="input"
										id="share-in"
										placeholder="Add people by name or email"
										value={q}
										onChange={(e) => setQ(e.target.value)}
										autoComplete="off"
									/>
								</div>
								<Select
									label="Permission"
									value={perm}
									options={RIGHT_OPTIONS}
									onChange={setPerm}
									className="w-[132px] min-w-0"
								/>
								<button
									type="submit"
									className={cn("btn btn-primary", inviting && "is-loading")}
									disabled={inviting}
								>
									Invite
								</button>
							</form>
						) : (
							<div className="alert info">
								<span
									className="i icon-[solar--info-circle-linear] size-3.5 shrink-0"
									aria-hidden="true"
								/>
								<span>
									Only people with full access can change who's on this project.
								</span>
							</div>
						)}
						{query && (
							<div className="panel" style={{ padding: 4 }}>
								{matches.length ? (
									matches.map((m) => (
										<button
											key={m.id}
											type="button"
											className="mi"
											onClick={() => add(m.id, m.name)}
										>
											<Av name={m.name} image={m.image} className="sm" />
											{m.name}
											<span className="r">{m.email}</span>
										</button>
									))
								) : (
									<div className="mi faint" style={{ cursor: "default" }}>
										{q.includes("@")
											? `Press Invite to send an invitation to ${q.trim()}`
											: "No matching members — enter an email to invite someone new"}
									</div>
								)}
							</div>
						)}
						<div>
							<div className="eyebrow" style={{ marginBottom: 4 }}>
								People with access
							</div>
							{project.members.map((m) => (
								<div key={m.memberId} className="row" style={{ height: 44 }}>
									<Av name={m.name} image={m.image} className="md" />
									<div className="grow" style={{ minWidth: 0 }}>
										<div
											className="trunc"
											style={{ fontWeight: 500, fontSize: 13 }}
										>
											{m.name}
											{m.isMe && (
												<span className="faint" style={{ fontWeight: 400 }}>
													{" "}
													(you)
												</span>
											)}
										</div>
										<div className="faint trunc" style={{ fontSize: 11.5 }}>
											{m.email}
											{m.isLead && " · Project lead"}
										</div>
									</div>
									{m.isLead || !canManage ? (
										<span
											className="muted"
											style={{ fontSize: 12.5, paddingRight: 8 }}
										>
											{PROJECT_RIGHT_LABEL[m.permission]}
										</span>
									) : (
										<Select
											label={`Permission for ${m.name}`}
											value={m.permission}
											options={[...RIGHT_OPTIONS, ["remove", "Remove access"]]}
											className="h-[26px] w-auto min-w-0 border-transparent bg-transparent text-xs"
											onChange={async (v) => {
												try {
													if (v === "remove") {
														await unshare({
															variables: {
																slug,
																projectId,
																memberId: m.memberId,
															},
														});
														toast.success(`Removed ${m.name}`);
													} else {
														await share({
															variables: {
																slug,
																projectId,
																memberId: m.memberId,
																permission: v,
															},
														});
														toast.success(
															`${m.name}: ${PROJECT_RIGHT_LABEL[v as keyof typeof PROJECT_RIGHT_LABEL]}`,
															{ duration: 1800 },
														);
													}
												} catch (error) {
													fail("Couldn't update access")(error as Error);
												}
											}}
										/>
									)}
								</div>
							))}
						</div>
						<div
							style={{
								borderTop: "1px solid var(--q-divider)",
								paddingTop: 12,
							}}
						>
							<div className="eyebrow" style={{ marginBottom: 8 }}>
								General access
							</div>
							<div className="row" style={{ gap: 10 }}>
								<span
									className="ftype"
									style={{ "--c": "var(--q-text-2)" } as React.CSSProperties}
								>
									<span
										className={cn(
											project.access === "private"
												? "icon-[solar--lock-keyhole-linear]"
												: "icon-[solar--buildings-2-linear]",
											"size-3.5",
										)}
										aria-hidden="true"
									/>
								</span>
								<div className="grow">
									<Select
										label="General access"
										value={project.access}
										disabled={!canManage}
										options={[
											["private", "Only people invited"],
											[
												"workspace",
												`Everyone at ${workspace?.name ?? "the workspace"}`,
											],
										]}
										className="h-7 w-auto min-w-0 border-transparent pl-1 font-medium"
										onChange={(access) =>
											setAccess({
												variables: { slug, projectId, access },
											}).catch(fail("Couldn't change access"))
										}
									/>
									<div
										className="faint"
										style={{ fontSize: 11.5, paddingLeft: 4 }}
									>
										{project.access === "private"
											? "Only people listed above can open this project."
											: "Anyone in the workspace can view and comment."}
									</div>
								</div>
							</div>
						</div>
					</>
				)}
			</div>
		</Modal>
	);
}
