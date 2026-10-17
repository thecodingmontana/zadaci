import { useMutation } from "@apollo/client/react";
import { useNavigate } from "@tanstack/react-router";
import { type FormEvent, useEffect, useState } from "react";
import { Av } from "#/components/q/av";
import { ConfirmModal } from "#/components/q/confirm";
import { Modal } from "#/components/q/modal";
import { Swatches } from "#/components/settings/ui";
import {
	CREATE_TEAM,
	DELETE_TEAM,
	type MemberStats,
	type SettingsMember,
	type SettingsTeam,
	UPDATE_TEAM,
} from "#/graphql/operations";
import { PCOLORS, TEAM_ICONS } from "#/lib/onboarding";
import { toast } from "#/lib/toast";
import { cn } from "#/lib/utils";

// Ported from the reference app's team modal: name, description, icon, colour and members.
// Everyone has one primary team, so ticking someone moves them from their current team.

const REFETCH = {
	refetchQueries: ["Shell", "Settings", "MemberStats", "Activity"],
};

export function TeamModal({
	open,
	onOpenChange,
	slug,
	team,
	members,
	teams,
	stats,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	slug: string;
	/** the team being edited; omit to create one */
	team?: SettingsTeam;
	members: SettingsMember[];
	teams: SettingsTeam[];
	stats: MemberStats[];
}) {
	const navigate = useNavigate();
	const teamOf = (memberId: string) =>
		stats.find((s) => s.memberId === memberId)?.teamIds[0];
	const initial = () => ({
		name: team?.name ?? "",
		description: team?.description ?? "",
		icon: team?.icon ?? TEAM_ICONS[0][0],
		color: team?.color && PCOLORS[team.color] ? team.color : "teal",
		memberIds: team
			? members.filter((m) => teamOf(m.id) === team.id).map((m) => m.id)
			: [],
	});
	const [form, setForm] = useState(initial);
	const [err, setErr] = useState("");
	const [deleting, setDeleting] = useState(false);
	const [create, { loading: creating }] = useMutation(CREATE_TEAM, REFETCH);
	const [update, { loading: saving }] = useMutation(UPDATE_TEAM, REFETCH);
	const [remove] = useMutation(DELETE_TEAM, REFETCH);

	// biome-ignore lint/correctness/useExhaustiveDependencies: reset only when the modal opens
	useEffect(() => {
		if (open) {
			setForm(initial());
			setErr("");
		}
	}, [open]);

	const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
		setForm((f) => ({ ...f, [k]: v }));

	async function submit(event?: FormEvent) {
		event?.preventDefault();
		const name = form.name.trim();
		if (!name) return setErr("Give the team a name");
		const clash = teams.find(
			(t) => t.name.toLowerCase() === name.toLowerCase() && t.id !== team?.id,
		);
		if (clash) return setErr(`A team called “${name}” already exists`);
		const input = { ...form, name, description: form.description.trim() };
		try {
			if (team) {
				await toast.promise(
					update({ variables: { slug, id: team.id, input } }),
					{
						loading: `Saving ${name}…`,
						success: `Saved ${name}`,
						error: "Couldn't save the team",
					},
				);
				onOpenChange(false);
			} else {
				const { data } = await toast.promise(
					create({ variables: { slug, input } }),
					{
						loading: `Creating ${name}…`,
						success: `Created ${name}`,
						error: "Couldn't create the team",
					},
				);
				onOpenChange(false);
				if (data)
					navigate({
						to: "/w/$slug/teams/$teamId",
						params: { slug, teamId: data.createTeam.id },
					});
			}
		} catch (error) {
			setErr((error as Error).message);
		}
	}

	const busy = creating || saving;
	return (
		<>
			<Modal
				busy={busy}
				open={open}
				onOpenChange={onOpenChange}
				title={team ? "Edit team" : "New team"}
				sub={
					team
						? undefined
						: "Teams group the people who work on projects together."
				}
				footer={
					<>
						{team && (
							<button
								type="button"
								className="btn btn-danger-ghost"
								onClick={() => setDeleting(true)}
							>
								<span
									className="icon-[solar--trash-bin-minimalistic-linear] size-3.5"
									aria-hidden="true"
								/>
								Delete team
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
							type="submit"
							form="team-form"
							className={cn("btn btn-primary", busy && "is-loading")}
							disabled={busy}
						>
							{team ? "Save changes" : "Create team"}
						</button>
					</>
				}
			>
				<form id="team-form" className="modal-b" onSubmit={submit}>
					<div className="row" style={{ gap: 10, alignItems: "flex-start" }}>
						<span
							className="picon lg"
							style={
								{
									"--c": PCOLORS[form.color],
									marginTop: 22,
								} as React.CSSProperties
							}
							aria-hidden="true"
						>
							<span className={cn(form.icon, "size-[18px]")} />
						</span>
						<div className="field grow">
							<label className="label" htmlFor="tm-name">
								Team name
							</label>
							<input
								className={cn("input", err && "is-error")}
								id="tm-name"
								value={form.name}
								onChange={(e) => {
									set("name", e.target.value);
									if (err && e.target.value.trim()) setErr("");
								}}
								placeholder="e.g. Growth"
								maxLength={255}
								aria-invalid={!!err}
								aria-describedby={err ? "tm-name-err" : undefined}
								// biome-ignore lint/a11y/noAutofocus: the modal opens to type a name, like the reference
								autoFocus
							/>
							{err && (
								<span className="err" id="tm-name-err" role="alert">
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
						<label className="label" htmlFor="tm-desc">
							What does this team own?
						</label>
						<input
							className="input"
							id="tm-desc"
							value={form.description}
							onChange={(e) => set("description", e.target.value)}
							placeholder="e.g. Acquisition experiments and lifecycle email"
							maxLength={500}
						/>
					</div>
					<div
						className="row"
						style={{ gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}
					>
						<div className="field" style={{ flex: 1, minWidth: 220 }}>
							<span className="label" id="tm-icon-l">
								Icon
							</span>
							<div
								className="iconpick"
								role="radiogroup"
								aria-labelledby="tm-icon-l"
							>
								{TEAM_ICONS.map(([icon, label]) => (
									<label key={icon} className={form.icon === icon ? "on" : ""}>
										<input
											type="radio"
											className="sr"
											name="team-icon"
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
									label="Team color"
									colors={Object.entries(PCOLORS)}
									value={form.color}
									onPick={(c) => set("color", c)}
									size={22}
									checkmark
								/>
							</div>
						</div>
					</div>
					<fieldset
						className="field"
						style={{ border: 0, padding: 0, margin: 0 }}
					>
						<legend className="label" style={{ marginBottom: 6 }}>
							Members{" "}
							<span className="faint" style={{ fontWeight: 400 }}>
								· {form.memberIds.length} selected
							</span>
						</legend>
						<div
							className="panel"
							style={{ maxHeight: 220, overflowY: "auto", padding: 4 }}
						>
							{members.map((m) => {
								const current = teamOf(m.id);
								const other =
									current && current !== team?.id
										? teams.find((t) => t.id === current)?.name
										: null;
								return (
									<label
										key={m.id}
										className="mi"
										style={{ cursor: "pointer", minHeight: 36 }}
									>
										<input
											type="checkbox"
											className="check"
											checked={form.memberIds.includes(m.id)}
											onChange={(e) =>
												set(
													"memberIds",
													e.target.checked
														? [...form.memberIds, m.id]
														: form.memberIds.filter((id) => id !== m.id),
												)
											}
										/>
										<Av name={m.name} image={m.image} className="sm" />
										<span className="grow trunc">{m.name}</span>
										{other && <span className="r">{other}</span>}
									</label>
								);
							})}
						</div>
						<span className="hint">
							Everyone belongs to one primary team. Adding someone here moves
							them from their current team.
						</span>
					</fieldset>
				</form>
			</Modal>
			{team && (
				<ConfirmModal
					open={deleting}
					onOpenChange={setDeleting}
					title={`Delete ${team.name}?`}
					body={`${team.memberCount ? `${team.memberCount} member${team.memberCount > 1 ? "s" : ""} will have no team` : "The team has no members"}${team.projectCount ? ` and ${team.projectCount} project${team.projectCount > 1 ? "s" : ""} will need a new team` : ""}. People and projects are not deleted.`}
					ok="Delete team"
					danger
					icon="icon-[solar--users-group-rounded-linear]"
					onConfirm={async () => {
						await toast.promise(remove({ variables: { slug, id: team.id } }), {
							loading: `Deleting ${team.name}…`,
							success: `Deleted ${team.name}`,
							error: "Couldn't delete the team",
						});
						onOpenChange(false);
						navigate({ to: "/w/$slug/teams", params: { slug } });
					}}
				/>
			)}
		</>
	);
}
