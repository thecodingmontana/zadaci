import { useMutation, useQuery } from "@apollo/client/react";
import { useNavigate } from "@tanstack/react-router";
import { type FormEvent, useEffect, useState } from "react";
import { Modal } from "#/components/q/modal";
import { Select, Swatches } from "#/components/settings/ui";
import {
	CREATE_PROJECT,
	PROJECTS,
	type ProjectSummary,
	type SettingsMember,
	type SettingsTeam,
	UPDATE_PROJECT,
} from "#/graphql/operations";
import { PCOLORS } from "#/lib/onboarding";
import { PROJECT_ICONS, PROJECT_TEMPLATES } from "#/lib/projects";
import { toast } from "#/lib/toast";
import { cn } from "#/lib/utils";
import { projectColor } from "./bits";

// Ported from the reference app's project modal: "New project" and "Project settings".

const REFETCH = {
	refetchQueries: ["Shell", "Projects", "ProjectPage", "Activity", "Settings"],
};

export function ProjectModal({
	open,
	onOpenChange,
	slug,
	project,
	members,
	teams,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	slug: string;
	/** the project being edited; omit to create one */
	project?: ProjectSummary;
	members: SettingsMember[];
	teams: SettingsTeam[];
}) {
	const navigate = useNavigate();
	const me = members.find((m) => m.isMe)?.id ?? "";
	const initial = () => ({
		title: project?.title ?? "",
		description: project?.description ?? "",
		icon: project?.icon ?? PROJECT_ICONS[0][0],
		color: project?.color && PCOLORS[project.color] ? project.color : "indigo",
		teamId: project?.teamId ?? teams[0]?.id ?? "",
		leadId: project?.leadId ?? me,
		dueDate: project?.dueDate ?? "",
		template: "blank",
	});
	const [form, setForm] = useState(initial);
	const [err, setErr] = useState("");
	const [create, { loading: creating }] = useMutation(CREATE_PROJECT, REFETCH);
	const [update, { loading: saving }] = useMutation(UPDATE_PROJECT, REFETCH);

	// biome-ignore lint/correctness/useExhaustiveDependencies: reset only when the modal opens
	useEffect(() => {
		if (open) {
			setForm(initial());
			setErr("");
		}
	}, [open]);

	const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
		setForm((f) => ({ ...f, [k]: v }));
	// the current icon stays pickable even when it came from a template
	const icons = PROJECT_ICONS.some(([i]) => i === form.icon)
		? PROJECT_ICONS
		: ([[form.icon, "Current icon"], ...PROJECT_ICONS] as const);
	// guests can't lead projects; the lead is whoever already leads it otherwise
	const leads = members.filter(
		(m) => m.role !== "guest" || m.id === form.leadId,
	);
	const canChangeLead = !project || project.myAccess === "full";

	async function submit(event?: FormEvent) {
		event?.preventDefault();
		const title = form.title.trim();
		if (!title) return setErr("Give the project a name");
		const input = {
			title,
			description: form.description.trim() || null,
			icon: form.icon,
			color: form.color,
			teamId: form.teamId || null,
			dueDate: form.dueDate || null,
			...(canChangeLead && { leadId: form.leadId || null }),
		};
		try {
			if (project) {
				await update({ variables: { slug, projectId: project.id, input } });
				onOpenChange(false);
				toast.success("Project updated");
				return;
			}
			const template = PROJECT_TEMPLATES.find((t) => t.id === form.template);
			const { data } = await create({
				variables: { slug, input: { ...input, template: form.template } },
			});
			onOpenChange(false);
			const n = template?.tasks.length ?? 0;
			toast.success(`Created ${title}${n ? ` with ${n} starter tasks` : ""}`);
			if (data)
				navigate({
					to: "/w/$slug/p/$projectId",
					params: { slug, projectId: data.createProject.id },
					search: { tab: n ? "board" : "overview" },
				});
		} catch (error) {
			setErr((error as Error).message);
		}
	}

	const busy = creating || saving;
	return (
		<Modal
			open={open}
			onOpenChange={onOpenChange}
			title={project ? "Project settings" : "New project"}
			sub={
				project
					? undefined
					: "Projects hold tasks, files, and conversations for one body of work."
			}
			footer={
				<>
					<span className="sp" />
					<button
						type="button"
						className="btn btn-secondary"
						onClick={() => onOpenChange(false)}
					>
						Cancel
					</button>
					<button
						type="submit"
						form="project-form"
						className={cn("btn btn-primary", busy && "is-loading")}
						disabled={busy}
					>
						{project ? "Save changes" : "Create project"}
					</button>
				</>
			}
		>
			<form id="project-form" className="modal-b" onSubmit={submit}>
				<div className="row" style={{ gap: 10, alignItems: "flex-start" }}>
					<span
						className="picon lg"
						style={
							{
								"--c": projectColor(form.color),
								flexShrink: 0,
								marginTop: 22,
							} as React.CSSProperties
						}
						aria-hidden="true"
					>
						<span className={cn(form.icon, "size-[18px]")} />
					</span>
					<div className="field grow">
						<label className="label" htmlFor="p-name">
							Project name
						</label>
						<input
							className={cn("input", err && "is-error")}
							id="p-name"
							value={form.title}
							onChange={(e) => {
								set("title", e.target.value);
								if (err && e.target.value.trim()) setErr("");
							}}
							placeholder="e.g. Website Redesign"
							maxLength={255}
							aria-invalid={!!err}
							aria-describedby={err ? "p-name-err" : undefined}
							// biome-ignore lint/a11y/noAutofocus: the modal opens to type a name, like the reference
							autoFocus
						/>
						{err && (
							<span className="err" id="p-name-err" role="alert">
								<span
									className="icon-[solar--danger-circle-linear] size-3"
									aria-hidden="true"
								/>
								{err}
							</span>
						)}
					</div>
				</div>
				<div className="field">
					<label className="label" htmlFor="p-desc">
						Description
					</label>
					<textarea
						className="textarea"
						id="p-desc"
						rows={2}
						value={form.description}
						onChange={(e) => set("description", e.target.value)}
						placeholder="What is this project about?"
						maxLength={5000}
					/>
				</div>
				<div
					className="row"
					style={{ gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}
				>
					<div className="field" style={{ flex: 1, minWidth: 220 }}>
						<span className="label" id="p-icon-l">
							Icon
						</span>
						<div
							className="iconpick"
							role="radiogroup"
							aria-labelledby="p-icon-l"
						>
							{icons.map(([icon, label]) => (
								<label key={icon} className={form.icon === icon ? "on" : ""}>
									<input
										type="radio"
										className="sr"
										name="project-icon"
										checked={form.icon === icon}
										onChange={() => set("icon", icon)}
										aria-label={label}
									/>
									<span
										className={cn(icon, "size-[15px]")}
										aria-hidden="true"
									/>
								</label>
							))}
						</div>
					</div>
					<div className="field">
						<span className="label">Color</span>
						<div style={{ maxWidth: 140 }}>
							<Swatches
								label="Project color"
								colors={Object.entries(PCOLORS)}
								value={form.color}
								onPick={(c) => set("color", c)}
								size={22}
								checkmark
							/>
						</div>
					</div>
				</div>
				<div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
					<div className="field" style={{ flex: 1, minWidth: 150 }}>
						<span className="label">Team</span>
						<Select
							label="Team"
							value={form.teamId}
							options={[
								["", "No team"],
								...teams.map((t) => [t.id, t.name] as const),
							]}
							onChange={(v) => set("teamId", v)}
							className="w-full min-w-0"
						/>
					</div>
					<div className="field" style={{ flex: 1, minWidth: 150 }}>
						<span className="label">Lead</span>
						<Select
							label="Lead"
							value={form.leadId}
							options={leads.map((m) => [m.id, m.name] as const)}
							onChange={(v) => set("leadId", v)}
							disabled={!canChangeLead}
							className="w-full min-w-0"
						/>
					</div>
					<div className="field" style={{ flex: 1, minWidth: 150 }}>
						<label className="label" htmlFor="p-due">
							Target date
						</label>
						<input
							type="date"
							className="input"
							id="p-due"
							value={form.dueDate}
							onChange={(e) => set("dueDate", e.target.value)}
						/>
					</div>
				</div>
				{!project && (
					<div className="field">
						<span className="label" id="p-tmpl-l">
							Template
						</span>
						<div className="tmpls" role="radiogroup" aria-labelledby="p-tmpl-l">
							{PROJECT_TEMPLATES.map((t) => (
								<label
									key={t.id}
									className={cn("opt", form.template === t.id && "on")}
									style={{ padding: 10, cursor: "pointer" }}
								>
									<input
										type="radio"
										className="sr"
										name="project-template"
										checked={form.template === t.id}
										onChange={() => set("template", t.id)}
									/>
									<span className={cn(t.icon, "i size-4")} aria-hidden="true" />
									<b style={{ fontSize: 12.5 }}>{t.name}</b>
									<span>
										{t.tasks.length
											? `${t.tasks.length} starter tasks`
											: t.desc}
									</span>
								</label>
							))}
						</div>
					</div>
				)}
			</form>
		</Modal>
	);
}

/** The project modal for places that don't already hold the data (sidebar, topbar, menus). */
export function ProjectModalLoader({
	open,
	onOpenChange,
	slug,
	projectId,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	slug: string;
	/** edit this project; omit to create one */
	projectId?: string;
}) {
	const { data } = useQuery(PROJECTS, {
		variables: { slug },
		skip: !open,
		fetchPolicy: "cache-and-network",
	});
	const workspace = data?.workspace;
	if (!workspace) return null;
	const project = projectId
		? workspace.projects.find((p) => p.id === projectId)
		: undefined;
	if (projectId && !project) return null;
	return (
		<ProjectModal
			open={open}
			onOpenChange={onOpenChange}
			slug={slug}
			project={project}
			members={workspace.members}
			teams={workspace.teams}
		/>
	);
}
