import { useMutation } from "@apollo/client/react";
import { Link } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { Av } from "#/components/q/av";
import { ConfirmModal } from "#/components/q/confirm";
import {
	Menu,
	MenuContent,
	MenuItem,
	MenuLabel,
	MenuSeparator,
	MenuTrigger,
} from "#/components/q/menu";
import { Modal } from "#/components/q/modal";
import {
	INVITE_MEMBERS,
	REMOVE_MEMBER,
	REVOKE_INVITE,
	type SettingsMember,
	UPDATE_MEMBER_ROLE,
	UPDATE_WORKSPACE,
} from "#/graphql/operations";
import { EMAIL_RE, PCOLORS } from "#/lib/onboarding";
import { toast } from "#/lib/toast";
import { cn } from "#/lib/utils";
import type { SectionProps } from "./general";
import { SBlock, Select, SettingsHeader, SRow, Toggle } from "./ui";

const ADMIN = ["owner", "moderator"];
// Our roles shown with the reference app's names.
const ROLE_LABEL: Record<string, string> = {
	owner: "Owner",
	moderator: "Admin",
	member: "Member",
};
const ROLE_HELP: Record<string, string> = {
	moderator: "Manage members, settings, and all projects",
	member: "Create projects and work on tasks",
};

export function MembersSection({ slug, workspace, title }: SectionProps) {
	const isAdmin = ADMIN.includes(workspace.role);
	const [inviting, setInviting] = useState(false);
	const [removing, setRemoving] = useState<SettingsMember | null>(null);
	const refetch = { refetchQueries: ["Settings"] };
	const [updateRole] = useMutation(UPDATE_MEMBER_ROLE, refetch);
	const [removeMember] = useMutation(REMOVE_MEMBER, refetch);
	const [revokeInvite] = useMutation(REVOKE_INVITE, refetch);
	const people = workspace.members.length + workspace.invites.length;

	return (
		<>
			<SettingsHeader
				title={title}
				lead={`${people} ${people === 1 ? "person has" : "people have"} access to ${workspace.name}.`}
			/>
			<div className="row" style={{ marginBottom: 12 }}>
				{isAdmin && (
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
					to="/w/$slug/$"
					params={{ slug, _splat: "members" }}
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
						{m.role === "owner" ? (
							<span className="pillbtn">
								<span
									className="icon-[solar--crown-linear] size-[13px]"
									aria-hidden="true"
								/>
								Owner
							</span>
						) : isAdmin && !m.isMe ? (
							<>
								<Menu>
									<MenuTrigger className="pillbtn bordered">
										{ROLE_LABEL[m.role]}
										<span
											className="icon-[solar--alt-arrow-down-linear] size-3"
											aria-hidden="true"
										/>
									</MenuTrigger>
									<MenuContent width={260}>
										<MenuLabel>Role for {m.name}</MenuLabel>
										{(["moderator", "member"] as const).map((r) => (
											<MenuItem
												key={r}
												checked={m.role === r}
												onSelect={async () => {
													if (m.role === r) return;
													try {
														await updateRole({
															variables: { slug, memberId: m.id, role: r },
														});
														toast.success(
															`${m.name} is now ${ROLE_LABEL[r]?.toLowerCase() === "admin" ? "an admin" : "a member"}`,
														);
													} catch (error) {
														toast.error("Couldn't change the role", {
															desc: (error as Error).message,
														});
													}
												}}
											>
												<div className="grow" style={{ whiteSpace: "normal" }}>
													<div style={{ fontWeight: 500 }}>{ROLE_LABEL[r]}</div>
													<div className="faint" style={{ fontSize: 11.5 }}>
														{ROLE_HELP[r]}
													</div>
												</div>
											</MenuItem>
										))}
									</MenuContent>
								</Menu>
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
											icon="icon-[solar--letter-linear]"
											onSelect={async () => {
												await navigator.clipboard.writeText(m.email);
												toast.success("Email copied");
											}}
										>
											Copy email
										</MenuItem>
										<MenuSeparator />
										<MenuItem
											icon="icon-[solar--user-minus-linear]"
											danger
											onSelect={() => setRemoving(m)}
										>
											Remove from workspace
										</MenuItem>
									</MenuContent>
								</Menu>
							</>
						) : (
							<span className="pillbtn">{ROLE_LABEL[m.role]}</span>
						)}
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
						<button
							type="button"
							className="btn btn-ghost btn-sm"
							onClick={async () => {
								await revokeInvite({ variables: { slug, id: inv.id } });
								toast.success("Invite revoked");
							}}
						>
							Revoke
						</button>
					</div>
				))}
			</div>
			<InviteModal
				open={inviting}
				onOpenChange={setInviting}
				slug={slug}
				workspace={workspace}
			/>
			<ConfirmModal
				open={!!removing}
				onOpenChange={(o) => !o && setRemoving(null)}
				title={`Remove ${removing?.name ?? ""}?`}
				body="They'll lose access to this workspace and its projects. You can invite them again later."
				ok="Remove"
				danger
				icon="icon-[solar--user-minus-linear]"
				onConfirm={async () => {
					if (!removing) return;
					try {
						await removeMember({ variables: { slug, memberId: removing.id } });
					} catch (error) {
						toast.error("Couldn't remove member", {
							desc: (error as Error).message,
						});
						throw error;
					}
					toast.success(`${removing.name} was removed`);
				}}
			/>
		</>
	);
}

function InviteModal({
	open,
	onOpenChange,
	slug,
	workspace,
}: {
	open: boolean;
	onOpenChange: (o: boolean) => void;
	slug: string;
	workspace: SectionProps["workspace"];
}) {
	const [raw, setRaw] = useState("");
	const [role, setRole] = useState("member");
	const [err, setErr] = useState("");
	const [invite, { loading }] = useMutation(INVITE_MEMBERS, {
		refetchQueries: ["Settings"],
	});

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
			await invite({ variables: { slug, emails: list, role } });
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
			sub="Invited people join with your workspace invite link."
			footer={
				<>
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
				<div className="field">
					<label className="label" htmlFor="inv-role">
						Role
					</label>
					<select
						className="select"
						id="inv-role"
						value={role}
						onChange={(e) => setRole(e.target.value)}
					>
						<option value="member">Member</option>
						<option value="moderator">Admin</option>
					</select>
				</div>
			</form>
		</Modal>
	);
}

export function TeamsSection({ slug, workspace, title }: SectionProps) {
	return (
		<>
			<SettingsHeader title={title} lead="Teams group people and projects." />
			{workspace.teams.length ? (
				<div className="pgrid">
					{workspace.teams.map((t) => (
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
											"--c": PCOLORS[t.color ?? ""] ?? t.color ?? PCOLORS.teal,
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
	const isAdmin = ADMIN.includes(workspace.role);
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
					disabled={!isAdmin}
				/>
			</SRow>
			<SRow t="Show completed tasks on boards">
				<Toggle
					checked={workspace.settings.showDoneBoard}
					onChange={(showDoneBoard) => save({ settings: { showDoneBoard } })}
					label="Show completed tasks on boards"
					disabled={!isAdmin}
				/>
			</SRow>
			<SBlock title="Archived projects">
				<p className="faint" style={{ padding: "12px 0" }}>
					No archived projects. Archived projects are hidden from the sidebar
					but keep all their tasks.
				</p>
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
		</>
	);
}

// Role permissions (reference table minus Billing; our roles: Owner, Admin, Member).
const PERMS: [string, number, number, number][] = [
	["View projects & tasks", 1, 1, 1],
	["Comment on tasks", 1, 1, 1],
	["Create and edit tasks", 1, 1, 1],
	["Create projects", 1, 1, 1],
	["Invite members", 1, 1, 0],
	["Manage roles", 1, 1, 0],
	["Workspace settings", 1, 1, 0],
	["Delete workspace", 1, 0, 0],
];

export function PermissionsSection({ slug, workspace, title }: SectionProps) {
	const isAdmin = ADMIN.includes(workspace.role);
	const [update] = useMutation(UPDATE_WORKSPACE, {
		refetchQueries: ["Settings"],
	});
	const permCreate = workspace.settings.permCreate;
	return (
		<>
			<SettingsHeader title={title} lead="Control what each role can do." />
			<SRow t="Members can create projects">
				<Toggle
					checked={permCreate}
					label="Members can create projects"
					disabled={!isAdmin}
					onChange={async (value) => {
						try {
							await update({
								variables: { slug, input: { settings: { permCreate: value } } },
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
			<SBlock title="Role permissions">
				<div style={{ marginTop: 12 }}>
					<div className="panel" style={{ overflowX: "auto" }}>
						<table className="perm-t" style={{ minWidth: 480 }}>
							<thead>
								<tr>
									<th style={{ paddingLeft: 14 }}>Permission</th>
									<th>Owner</th>
									<th>Admin</th>
									<th>Member</th>
								</tr>
							</thead>
							<tbody>
								{PERMS.map(([name, ...cols]) => {
									const values =
										name === "Create projects"
											? [1, 1, permCreate ? 1 : 0]
											: cols;
									return (
										<tr key={name}>
											<td style={{ paddingLeft: 14 }}>{name}</td>
											{values.map((v, i) => (
												// biome-ignore lint/suspicious/noArrayIndexKey: fixed role columns
												<td key={i}>
													{v ? (
														<span
															style={{
																color: "var(--q-green)",
																display: "inline-flex",
															}}
															role="img"
															aria-label="Allowed"
														>
															<span
																className="icon-[hugeicons--tick-02] size-[15px]"
																aria-hidden="true"
															/>
														</span>
													) : (
														<span
															className="faint"
															style={{ display: "inline-flex" }}
															role="img"
															aria-label="Not allowed"
														>
															<span
																className="icon-[hugeicons--minus-sign] size-[15px]"
																aria-hidden="true"
															/>
														</span>
													)}
												</td>
											))}
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				</div>
			</SBlock>
		</>
	);
}
