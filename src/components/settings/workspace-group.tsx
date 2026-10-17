import { useMutation } from "@apollo/client/react";
import { Link, useNavigate } from "@tanstack/react-router";
import { type FormEvent, type ReactNode, useState } from "react";
import { projectColor } from "#/components/projects/bits";
import { Av } from "#/components/q/av";
import { ConfirmModal } from "#/components/q/confirm";
import {
	Menu,
	MenuContent,
	MenuItem,
	MenuLabel,
	MenuSeparator,
	MenuSub,
	MenuSubContent,
	MenuSubTrigger,
	MenuTrigger,
} from "#/components/q/menu";
import { Modal } from "#/components/q/modal";
import {
	ARCHIVE_PROJECT,
	DELETE_PROJECT,
	INVITE_MEMBERS,
	REMOVE_MEMBER,
	RESEND_INVITE,
	REVOKE_INVITE,
	type SettingsMember,
	UPDATE_MEMBER_ROLE,
	UPDATE_WORKSPACE,
} from "#/graphql/operations";
import { EMAIL_RE } from "#/lib/onboarding";
import {
	can,
	canInvite,
	PERMISSIONS,
	type Permission,
	ROLES,
} from "#/lib/permissions";
import { ROLE_LABEL } from "#/lib/preferences";
import { toast } from "#/lib/toast";
import { cn } from "#/lib/utils";
import type { SectionProps } from "./general";
import { SBlock, Select, SettingsHeader, SRow, Toggle } from "./ui";

// Our roles shown with the reference app's names.
const ROLE_HELP: Record<string, string> = {
	moderator: "Manage members, settings, and all projects",
	member: "Create projects and work on tasks",
	guest: "Only sees projects they are invited to",
};

const MEMBER_REFETCH = { refetchQueries: ["Settings", "MemberStats"] };

const ROLE_CHOICES = ["moderator", "member", "guest"] as const;

/** Changes a member's role with the toast the reference shows. */
function useChangeRole(slug: string) {
	const [updateRole] = useMutation(UPDATE_MEMBER_ROLE, MEMBER_REFETCH);
	return async (m: SettingsMember, role: string) => {
		if (m.role === role) return;
		try {
			await updateRole({ variables: { slug, memberId: m.id, role } });
			toast.success(
				`${m.name} is now ${role === "moderator" ? "an admin" : `a ${ROLE_LABEL[role]?.toLowerCase()}`}`,
			);
		} catch (error) {
			toast.error("Couldn't change the role", {
				desc: (error as Error).message,
			});
		}
	};
}

function RoleChoices({ slug, m }: { slug: string; m: SettingsMember }) {
	const changeRole = useChangeRole(slug);
	return (
		<>
			<MenuLabel>Role for {m.name}</MenuLabel>
			{ROLE_CHOICES.map((r) => (
				<MenuItem
					key={r}
					checked={m.role === r}
					onSelect={() => changeRole(m, r)}
				>
					<div className="grow" style={{ whiteSpace: "normal" }}>
						<div style={{ fontWeight: 500 }}>{ROLE_LABEL[r]}</div>
						<div className="faint" style={{ fontSize: 11.5 }}>
							{ROLE_HELP[r]}
						</div>
					</div>
				</MenuItem>
			))}
		</>
	);
}

const canManage = (m: SettingsMember, canAdmin: boolean) =>
	canAdmin && !m.isMe && m.role !== "owner";

/** Role pill: fixed for the owner and non-admins, a role picker for admins. */
export function MemberRole({
	slug,
	m,
	canAdmin,
}: {
	slug: string;
	m: SettingsMember;
	canAdmin: boolean;
}) {
	if (m.role === "owner")
		return (
			<span className="pillbtn">
				<span
					className="icon-[solar--crown-linear] size-[13px]"
					aria-hidden="true"
				/>
				Owner
			</span>
		);
	if (!canManage(m, canAdmin))
		return <span className="pillbtn">{ROLE_LABEL[m.role]}</span>;
	return (
		<Menu>
			<MenuTrigger className="pillbtn bordered">
				{ROLE_LABEL[m.role]}
				<span
					className="icon-[solar--alt-arrow-down-linear] size-3"
					aria-hidden="true"
				/>
			</MenuTrigger>
			<MenuContent width={260}>
				<RoleChoices slug={slug} m={m} />
			</MenuContent>
		</Menu>
	);
}

/** The member "…" menu (reference member context menu). */
export function MemberActions({
	slug,
	m,
	canAdmin,
	openTasks = 0,
}: {
	slug: string;
	m: SettingsMember;
	canAdmin: boolean;
	openTasks?: number;
}) {
	const navigate = useNavigate();
	const [removing, setRemoving] = useState(false);
	const [removeMember] = useMutation(REMOVE_MEMBER, MEMBER_REFETCH);
	return (
		<>
			<Menu>
				<MenuTrigger
					className="ibtn ibtn-sm"
					aria-label={`Options for ${m.name}`}
				>
					<span
						className="icon-[solar--menu-dots-linear] size-3.5"
						aria-hidden="true"
					/>
				</MenuTrigger>
				<MenuContent>
					<MenuItem
						icon="icon-[solar--user-linear]"
						onSelect={() =>
							navigate({
								to: "/w/$slug/members/$memberId",
								params: { slug, memberId: m.id },
							})
						}
					>
						View profile
					</MenuItem>
					<MenuItem
						icon="icon-[solar--letter-linear]"
						onSelect={async () => {
							await navigator.clipboard.writeText(m.email);
							toast.success("Email copied");
						}}
					>
						Copy email
					</MenuItem>
					{canManage(m, canAdmin) && (
						<>
							<MenuSub>
								<MenuSubTrigger icon="icon-[solar--shield-user-linear]">
									Change role…
								</MenuSubTrigger>
								<MenuSubContent width={260}>
									<RoleChoices slug={slug} m={m} />
								</MenuSubContent>
							</MenuSub>
							<MenuSeparator />
							<MenuItem
								icon="icon-[solar--user-minus-linear]"
								danger
								onSelect={() => setRemoving(true)}
							>
								Remove from workspace
							</MenuItem>
						</>
					)}
				</MenuContent>
			</Menu>
			<ConfirmModal
				open={removing}
				onOpenChange={setRemoving}
				title={`Remove ${m.name}?`}
				body={`${m.name} will lose access to this workspace immediately.${openTasks ? ` Their ${openTasks} open task${openTasks > 1 ? "s" : ""} will become unassigned.` : ""}`}
				ok="Remove member"
				danger
				icon="icon-[solar--user-minus-linear]"
				onConfirm={async () => {
					try {
						await removeMember({ variables: { slug, memberId: m.id } });
					} catch (error) {
						toast.error("Couldn't remove member", {
							desc: (error as Error).message,
						});
						throw error;
					}
					toast.success(`Removed ${m.name}`);
				}}
			/>
		</>
	);
}

/** Resend and Revoke buttons for a pending invite. */
export function InviteActions({ slug, id }: { slug: string; id: string }) {
	const [resend, { loading }] = useMutation(RESEND_INVITE);
	const [revoke] = useMutation(REVOKE_INVITE, MEMBER_REFETCH);
	return (
		<>
			<button
				type="button"
				className={cn("btn btn-ghost btn-sm", loading && "is-loading")}
				disabled={loading}
				onClick={() =>
					resend({ variables: { slug, id } })
						.then(() => toast.success("Invite sent again"))
						.catch((error: Error) =>
							toast.error("Couldn't resend the invite", {
								desc: error.message,
							}),
						)
				}
			>
				Resend
			</button>
			<button
				type="button"
				className="btn btn-ghost btn-sm"
				onClick={() =>
					revoke({ variables: { slug, id } })
						.then(() => toast.success("Invite revoked"))
						.catch((error: Error) =>
							toast.error("Couldn't revoke the invite", {
								desc: error.message,
							}),
						)
				}
			>
				Revoke
			</button>
		</>
	);
}

export function MembersSection({ slug, workspace, title }: SectionProps) {
	const canAdmin = can(workspace.role, "manageRoles");
	const mayInvite = canInvite(workspace.role, workspace.settings);
	const [inviting, setInviting] = useState(false);
	const people = workspace.members.length + workspace.invites.length;

	return (
		<>
			<SettingsHeader
				title={title}
				lead={`${people} ${people === 1 ? "person has" : "people have"} access to ${workspace.name}.`}
			/>
			<div className="row" style={{ marginBottom: 12 }}>
				{mayInvite && (
					<button
						type="button"
						className="btn btn-primary"
						onClick={() => setInviting(true)}
					>
						<span
							className="icon-[solar--user-plus-linear] size-3.5"
							aria-hidden="true"
						/>
						Invite member
					</button>
				)}
				<Link
					to="/w/$slug/members"
					params={{ slug }}
					className="btn btn-secondary"
				>
					Open member directory
				</Link>
			</div>
			<div className="panel" style={{ overflow: "hidden" }}>
				{workspace.members.map((m) => (
					<div
						key={m.id}
						className="mini"
						style={{ minHeight: 52, cursor: "default" }}
					>
						<Av name={m.name} image={m.image} className="md" />
						<div className="grow">
							<div style={{ fontWeight: 500 }}>
								{m.name}
								{m.isMe && <span className="faint"> (you)</span>}
							</div>
							<div className="faint" style={{ fontSize: 12 }}>
								{m.email}
							</div>
						</div>
						<MemberRole slug={slug} m={m} canAdmin={canAdmin} />
						<MemberActions slug={slug} m={m} canAdmin={canAdmin} />
					</div>
				))}
				{workspace.invites.map((inv) => (
					<div
						key={inv.id}
						className="mini"
						style={{ minHeight: 52, cursor: "default" }}
					>
						<Av name={inv.email} color="#6B7280" className="md" />
						<div className="grow">
							<div style={{ fontWeight: 500 }}>{inv.email}</div>
							<div className="faint" style={{ fontSize: 12 }}>
								{ROLE_LABEL[inv.role]}
							</div>
						</div>
						<span className="badge amber">Invited</span>
						{can(workspace.role, "inviteMembers") && (
							<InviteActions slug={slug} id={inv.id} />
						)}
					</div>
				))}
			</div>
			<InviteModal
				open={inviting}
				onOpenChange={setInviting}
				slug={slug}
				workspace={workspace}
			/>
		</>
	);
}

export function InviteModal({
	open,
	onOpenChange,
	slug,
	workspace,
}: {
	open: boolean;
	onOpenChange: (o: boolean) => void;
	slug: string;
	workspace: {
		name: string;
		inviteCode: string;
		role: string;
		settings?: { permCreate: boolean; permGuests: boolean };
		teams: { id: string; name: string }[];
	};
}) {
	// Admins invite anyone; members may only invite guests (when the workspace allows it).
	const roles = (
		can(workspace.role, "inviteMembers")
			? [
					["member", "Member"],
					["moderator", "Admin"],
					["guest", "Guest"],
				]
			: [["guest", "Guest"]]
	) as [string, string][];
	const [raw, setRaw] = useState("");
	const [role, setRole] = useState(roles[0]?.[0] ?? "guest");
	const [teamId, setTeamId] = useState("");
	const [err, setErr] = useState("");
	const [invite, { loading }] = useMutation(INVITE_MEMBERS, MEMBER_REFETCH);

	async function submit(event?: FormEvent) {
		event?.preventDefault();
		const list = raw
			.split(/[\s,;]+/)
			.map((s) => s.trim())
			.filter(Boolean);
		const bad = list.filter((e) => !EMAIL_RE.test(e));
		if (!list.length) return setErr("Enter at least one email address");
		if (bad.length) return setErr(`${bad[0]} isn't a valid email address`);
		setErr("");
		try {
			await invite({
				variables: { slug, emails: list, role, teamId: teamId || null },
			});
			setRaw("");
			onOpenChange(false);
			toast.success(
				`${list.length} invitation${list.length > 1 ? "s" : ""} sent`,
			);
		} catch (error) {
			setErr((error as Error).message);
		}
	}

	return (
		<Modal
			open={open}
			onOpenChange={onOpenChange}
			title={`Invite to ${workspace.name}`}
			sub="We'll email each person a link to join."
			footer={
				<>
					{/* the server only sends the link to people who may invite members */}
					{workspace.inviteCode && (
						<button
							type="button"
							className="btn btn-ghost"
							onClick={async () => {
								await navigator.clipboard.writeText(
									`${location.origin}/join/${workspace.inviteCode}`,
								);
								toast.success("Invite link copied");
							}}
						>
							<span
								className="icon-[solar--link-linear] size-3.5"
								aria-hidden="true"
							/>
							Copy invite link
						</button>
					)}
					<span className="sp" />
					<button
						type="button"
						className="btn btn-secondary"
						onClick={() => onOpenChange(false)}
					>
						Cancel
					</button>
					<button
						type="button"
						className={cn("btn btn-primary", loading && "is-loading")}
						onClick={() => submit()}
						disabled={loading}
					>
						Send invites
					</button>
				</>
			}
		>
			<form className="modal-b" onSubmit={submit}>
				<div className="field">
					<label className="label" htmlFor="inv-emails">
						Email addresses
					</label>
					<textarea
						className={cn("textarea", err && "is-error")}
						id="inv-emails"
						placeholder="name@company.com, another@company.com"
						rows={3}
						value={raw}
						onChange={(e) => setRaw(e.target.value)}
						aria-invalid={!!err}
						aria-describedby="inv-emails-msg"
					/>
					{err ? (
						<span className="err" id="inv-emails-msg" role="alert">
							<span
								className="icon-[solar--danger-circle-linear] size-3"
								aria-hidden="true"
							/>
							{err}
						</span>
					) : (
						<span className="hint" id="inv-emails-msg">
							Separate multiple addresses with commas.
						</span>
					)}
				</div>
				<div className="row" style={{ gap: 12 }}>
					<div className="field grow">
						<span className="label">Role</span>
						<Select
							value={role}
							options={roles}
							onChange={setRole}
							label="Role"
							className="w-full"
						/>
					</div>
					<div className="field grow">
						<span className="label">Team</span>
						<Select
							value={teamId}
							options={[
								["", "No team"],
								...workspace.teams.map((t) => [t.id, t.name] as const),
							]}
							onChange={setTeamId}
							label="Team"
							className="w-full"
						/>
					</div>
				</div>
				<div className="alert info">
					<span
						className="i icon-[solar--info-circle-linear] size-3.5 shrink-0"
						aria-hidden="true"
					/>
					<span>
						<b>Guests</b> can only see projects they're added to and can't
						create projects.
					</span>
				</div>
			</form>
		</Modal>
	);
}

export function TeamsSection({ slug, workspace, title }: SectionProps) {
	return (
		<>
			<SettingsHeader title={title} lead="Teams group people and projects." />
			<TeamsGrid slug={slug} teams={workspace.teams} />
		</>
	);
}

/** Team cards (reference teamsGrid); `avatars` adds each team's member stack. */
export function TeamsGrid({
	slug,
	teams,
	avatars,
}: {
	slug: string;
	teams: SectionProps["workspace"]["teams"];
	avatars?: (teamId: string) => ReactNode;
}) {
	return (
		<>
			{teams.length ? (
				<div className="pgrid">
					{teams.map((t) => (
						<Link
							key={t.id}
							to="/w/$slug/$"
							params={{ slug, _splat: `teams/${t.id}` }}
							className="pcard"
						>
							<div className="row">
								<span
									className="picon"
									style={
										{
											"--c": projectColor(t.color, "teal"),
										} as React.CSSProperties
									}
								>
									<span
										className={cn(
											t.icon ?? "icon-[solar--users-group-rounded-linear]",
											"size-[15px]",
										)}
										aria-hidden="true"
									/>
								</span>
								<b style={{ fontWeight: 600, fontSize: 14 }}>{t.name}</b>
							</div>
							<div className="desc">{t.description}</div>
							<div className="foot">
								<span className="row" style={{ gap: 4 }}>
									<span
										className="icon-[solar--users-group-rounded-linear] size-3"
										aria-hidden="true"
									/>
									{t.memberCount} members
								</span>
								<span className="row" style={{ gap: 4 }}>
									<span
										className="icon-[solar--folder-linear] size-3"
										aria-hidden="true"
									/>
									{t.projectCount} projects
								</span>
								{avatars && (
									<>
										<span className="sp" />
										{avatars(t.id)}
									</>
								)}
							</div>
						</Link>
					))}
				</div>
			) : (
				<div className="panel">
					<div className="empty-state">
						<div className="glyph">
							<span
								className="icon-[solar--users-group-rounded-linear] size-[22px]"
								aria-hidden="true"
							/>
						</div>
						<h2 className="es-h">No teams yet</h2>
						<p>Create a team to group people and give projects an owner.</p>
						<Link
							to="/w/$slug/$"
							params={{ slug, _splat: "teams" }}
							className="btn btn-primary btn-sm"
						>
							<span
								className="icon-[hugeicons--plus-sign] size-3.5"
								aria-hidden="true"
							/>
							New team
						</Link>
					</div>
				</div>
			)}
		</>
	);
}

export function ProjectsSection({ slug, workspace, title }: SectionProps) {
	const canAdmin = can(workspace.role, "workspaceSettings");
	const canEdit = can(workspace.role, "editProjects");
	const canDelete = can(workspace.role, "deleteProjects");
	const [deleting, setDeleting] = useState<{
		id: string;
		title: string;
	} | null>(null);
	const projectRefetch = { refetchQueries: ["Settings", "Shell"] };
	const [archive] = useMutation(ARCHIVE_PROJECT, projectRefetch);
	const [removeProject] = useMutation(DELETE_PROJECT, projectRefetch);
	const [update] = useMutation(UPDATE_WORKSPACE, {
		refetchQueries: ["Settings"],
	});
	const save = async (input: Record<string, unknown>) => {
		try {
			await update({ variables: { slug, input } });
			toast.success("Preference saved", { duration: 1500 });
		} catch (error) {
			toast.error("Couldn't save that", { desc: (error as Error).message });
		}
	};
	return (
		<>
			<SettingsHeader
				title={title}
				lead="Defaults for new projects and archived work."
			/>
			<SRow
				t="Default project view"
				d="The tab that opens when you open a project."
			>
				<Select
					value={workspace.defaultView}
					options={[
						["board", "Board"],
						["list", "List"],
						["table", "Table"],
						["overview", "Overview"],
						["timeline", "Timeline"],
					]}
					onChange={(defaultView) => save({ defaultView })}
					label="Default project view"
					disabled={!canAdmin}
				/>
			</SRow>
			<SRow t="Show completed tasks on boards">
				<Toggle
					checked={workspace.settings.showDoneBoard}
					onChange={(showDoneBoard) => save({ settings: { showDoneBoard } })}
					label="Show completed tasks on boards"
					disabled={!canAdmin}
				/>
			</SRow>
			<SBlock title="Archived projects">
				{workspace.archivedProjects.length ? (
					workspace.archivedProjects.map((p) => (
						<div key={p.id} className="srow">
							<div className="row">
								<span
									className="picon"
									style={
										{
											"--c": projectColor(p.color),
										} as React.CSSProperties
									}
								>
									<span
										className={cn(
											p.icon ?? "icon-[solar--folder-linear]",
											"size-3.5",
										)}
										aria-hidden="true"
									/>
								</span>
								<b style={{ fontWeight: 500 }}>{p.title}</b>
							</div>
							<div className="row">
								{canEdit && (
									<button
										type="button"
										className="btn btn-secondary btn-sm"
										onClick={async () => {
											try {
												await archive({
													variables: { slug, projectId: p.id, archived: false },
												});
												toast.success(`${p.title} restored`);
											} catch (error) {
												toast.error("Couldn't restore the project", {
													desc: (error as Error).message,
												});
											}
										}}
									>
										Restore
									</button>
								)}
								{canDelete && (
									<button
										type="button"
										className="btn btn-danger-ghost btn-sm"
										onClick={() => setDeleting(p)}
									>
										Delete
									</button>
								)}
							</div>
						</div>
					))
				) : (
					<p className="faint" style={{ padding: "12px 0" }}>
						No archived projects. Archived projects are hidden from the sidebar
						but keep all their tasks.
					</p>
				)}
				<div style={{ marginTop: 12 }}>
					<Link
						to="/w/$slug/$"
						params={{ slug, _splat: "archive" }}
						className="btn btn-secondary btn-sm"
					>
						<span
							className="icon-[solar--archive-linear] size-[13px]"
							aria-hidden="true"
						/>
						Open archive
					</Link>
				</div>
			</SBlock>
			<ConfirmModal
				open={!!deleting}
				onOpenChange={(o) => !o && setDeleting(null)}
				title={`Delete ${deleting?.title ?? ""}?`}
				body="The project and all of its tasks will be deleted for everyone in the workspace."
				ok="Delete project"
				danger
				onConfirm={async () => {
					if (!deleting) return;
					try {
						await removeProject({
							variables: { slug, projectId: deleting.id },
						});
					} catch (error) {
						toast.error("Couldn't delete the project", {
							desc: (error as Error).message,
						});
						throw error;
					}
					toast.success(`${deleting.title} was deleted`);
				}}
			/>
		</>
	);
}

export function PermissionsSection({ slug, workspace, title }: SectionProps) {
	const canAdmin = can(workspace.role, "workspaceSettings");
	const [update] = useMutation(UPDATE_WORKSPACE, {
		refetchQueries: ["Settings"],
	});
	return (
		<>
			<SettingsHeader title={title} lead="Control what each role can do." />
			{(
				[
					["permCreate", "Members can create projects", undefined],
					[
						"permGuests",
						"Members can invite guests",
						"Guests only see projects they are added to.",
					],
					[
						"permPublic",
						"Allow public share links",
						"Anyone with the link can view a project.",
					],
				] as const
			).map(([key, t, d]) => (
				<SRow key={key} t={t} d={d}>
					<Toggle
						checked={workspace.settings[key]}
						label={t}
						disabled={!canAdmin}
						onChange={async (value) => {
							try {
								await update({
									variables: { slug, input: { settings: { [key]: value } } },
								});
								toast.success("Preference saved", { duration: 1500 });
							} catch (error) {
								toast.error("Couldn't save that", {
									desc: (error as Error).message,
								});
							}
						}}
					/>
				</SRow>
			))}
			<SBlock title="Role permissions">
				<div style={{ marginTop: 12 }}>
					<PermissionsTable settings={workspace.settings} />
				</div>
			</SBlock>
		</>
	);
}

/** What each role can do, generated from the rules the server enforces. */
export function PermissionsTable({
	settings,
}: {
	settings: { permCreate: boolean; permGuests: boolean };
}) {
	return (
		<div className="panel" style={{ overflowX: "auto" }}>
			<table className="perm-t" style={{ minWidth: 560 }}>
				<thead>
					<tr>
						<th style={{ paddingLeft: 14 }}>Permission</th>
						{ROLES.map((r) => (
							<th key={r}>{ROLE_LABEL[r]}</th>
						))}
					</tr>
				</thead>
				<tbody>
					{(Object.keys(PERMISSIONS) as Permission[]).map((key) => (
						<tr key={key}>
							<td style={{ paddingLeft: 14 }}>{PERMISSIONS[key].label}</td>
							{ROLES.map((r) =>
								can(r, key, settings) ? (
									<td key={r}>
										<span
											className="icon-[hugeicons--tick-02] size-[15px]"
											style={{ color: "var(--q-green)" }}
											role="img"
											aria-label="Allowed"
										/>
									</td>
								) : (
									<td key={r}>
										<span
											className="faint icon-[hugeicons--minus-sign] size-[15px]"
											role="img"
											aria-label="Not allowed"
										/>
									</td>
								),
							)}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
