import { useMutation } from "@apollo/client/react";
import { useRouter } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { Av } from "#/components/q/av";
import { SHORTCUTS, useModKey } from "#/components/shell/command-menu";
import { UPDATE_PREFERENCES } from "#/graphql/operations";
import { authClient } from "#/lib/auth-client";
import {
	AVATAR_COLORS,
	HOME_OPTS,
	OPEN_TASKS,
	type Preferences,
} from "#/lib/preferences";
import { toast } from "#/lib/toast";
import { cn } from "#/lib/utils";
import { type SectionProps, usePrefs } from "./general";
import { SBlock, Select, SettingsHeader, SRow, Swatches, Toggle } from "./ui";

type NotifKey = keyof SectionProps["me"]["preferences"]["notif"];

const NOTIF_SECTIONS: Record<
	string,
	{ lead: string; rows: [NotifKey, string, string?][] }
> = {
	"notif-email": {
		lead: "Choose which emails you receive.",
		rows: [
			["email_mention", "Mentions", "When someone @mentions you."],
			["email_assign", "Assignments", "When a task is assigned to you."],
			["email_comment", "Comments", "On tasks you created or are assigned."],
			[
				"email_digest",
				"Daily digest",
				"A summary of what changed, every weekday at 8:00.",
			],
		],
	},
	"notif-push": {
		lead: "Notifications on desktop and mobile.",
		rows: [
			["push_mention", "Mentions"],
			["push_assign", "Assignments"],
			["push_comment", "Comments"],
			["push_due", "Due date reminders", "One day before a task is due."],
		],
	},
	"notif-mentions": {
		lead: "Decide which mentions reach you.",
		rows: [
			["mention_all", "@mentions in comments and descriptions"],
			[
				"mention_team",
				"@team mentions",
				"When your team is mentioned, e.g. @Product.",
			],
			["mention_ws", "@workspace mentions", "Announcements to everyone."],
		],
	},
	"notif-assign": {
		lead: "Updates about tasks assigned to you.",
		rows: [
			["assign_self", "When I'm assigned a task"],
			["assign_status", "When my task changes status"],
			["assign_over", "When my task is overdue"],
		],
	},
};

export function NotificationsSection({
	me,
	title,
	sec,
}: SectionProps & { sec: string }) {
	const save = usePrefs();
	const section = NOTIF_SECTIONS[sec];
	if (!section) return null;
	return (
		<>
			<SettingsHeader title={title} lead={section.lead} />
			{section.rows.map(([k, t, d]) => (
				<SRow key={k} t={t} d={d}>
					<Toggle
						checked={me.preferences.notif[k]}
						onChange={(v) =>
							save({ notif: { [k]: v } }, "Notification preferences saved")
						}
						label={t}
					/>
				</SRow>
			))}
		</>
	);
}

export function ProfileSection({ me, title }: SectionProps) {
	const router = useRouter();
	const p = me.preferences;
	const [name, setName] = useState(me.name);
	const [jobTitle, setJobTitle] = useState(p.title);
	const [err, setErr] = useState("");
	const [busy, setBusy] = useState(false);
	const [savePrefs] = useMutation(UPDATE_PREFERENCES, {
		refetchQueries: ["Settings"],
	});

	async function submit(event: FormEvent) {
		event.preventDefault();
		const n = name.trim();
		if (!n) return setErr("Enter your name");
		setErr("");
		setBusy(true);
		try {
			if (n !== me.name) {
				const { error } = await authClient.updateUser({ name: n });
				if (error) throw new Error(error.message);
			}
			await savePrefs({ variables: { patch: { title: jobTitle.trim() } } });
			await router.invalidate();
			toast.success("Profile updated");
		} catch (error) {
			toast.error("Couldn't update your profile", {
				desc: (error as Error).message,
			});
		} finally {
			setBusy(false);
		}
	}

	return (
		<>
			<SettingsHeader
				title={title}
				lead="How you appear to others in the workspace."
			/>
			<form
				onSubmit={submit}
				className="col"
				style={{ gap: 16, maxWidth: 440 }}
			>
				<div className="row" style={{ gap: 14 }}>
					<Av
						name={me.name}
						image={me.image}
						color={p.avatarColor}
						className="xl"
					/>
					<div>
						<div className="label" style={{ marginBottom: 6 }}>
							Avatar color
						</div>
						<Swatches
							colors={AVATAR_COLORS}
							value={p.avatarColor}
							size={22}
							label="Avatar color"
							onPick={(avatarColor) =>
								savePrefs({ variables: { patch: { avatarColor } } }).catch(
									(error) =>
										toast.error("Couldn't save that", {
											desc: (error as Error).message,
										}),
								)
							}
						/>
						{me.image && (
							<div className="hint" style={{ marginTop: 6 }}>
								Shown when your Google photo isn't available.
							</div>
						)}
					</div>
				</div>
				<div className="field">
					<label className="label" htmlFor="pf-name">
						Full name
					</label>
					<input
						className={cn("input", err && "is-error")}
						id="pf-name"
						value={name}
						onChange={(e) => setName(e.target.value)}
						aria-invalid={!!err}
						aria-describedby={err ? "pf-name-err" : undefined}
					/>
					{err && (
						<span className="err" id="pf-name-err" role="alert">
							<span
								className="icon-[solar--danger-circle-linear] size-3"
								aria-hidden="true"
							/>
							{err}
						</span>
					)}
				</div>
				<div className="field">
					<label className="label" htmlFor="pf-title">
						Title
					</label>
					<input
						className="input"
						id="pf-title"
						value={jobTitle}
						onChange={(e) => setJobTitle(e.target.value)}
						maxLength={100}
					/>
				</div>
				<div className="field">
					<label className="label" htmlFor="pf-email">
						Email
					</label>
					<input className="input" id="pf-email" value={me.email} disabled />
					<span className="hint">
						Your sign-in email comes from your Google account.
					</span>
				</div>
				<div>
					<button
						type="submit"
						className={cn("btn btn-primary", busy && "is-loading")}
						disabled={busy}
					>
						Save profile
					</button>
				</div>
			</form>
		</>
	);
}

export function PreferencesSection({ me, title }: SectionProps) {
	const save = usePrefs();
	const p = me.preferences;
	return (
		<>
			<SettingsHeader
				title={title}
				lead="Personal defaults for how you work."
			/>
			<SRow t="Open on launch" d="The page you see when Zadaci opens.">
				<Select
					value={p.home}
					options={HOME_OPTS}
					onChange={(home) => save({ home: home as Preferences["home"] })}
					label="Open on launch"
				/>
			</SRow>
			<SRow t="Open tasks in" d="Side panel keeps your place in the list.">
				<Select
					value={p.openTasks}
					options={OPEN_TASKS}
					onChange={(openTasks) =>
						save({ openTasks: openTasks as Preferences["openTasks"] })
					}
					label="Open tasks in"
				/>
			</SRow>
			<SRow t="Confirm before deleting tasks">
				<Toggle
					checked={p.confirmDel}
					onChange={(confirmDel) => save({ confirmDel })}
					label="Confirm before deleting tasks"
				/>
			</SRow>
		</>
	);
}

export function ShortcutsSection({ title }: { title: string }) {
	const mod = useModKey();
	return (
		<>
			<SettingsHeader title={title} lead="Move faster with the keyboard." />
			{SHORTCUTS.map(([group, list]) => (
				<SBlock key={group} title={group}>
					{list.map(([name, keys]) => (
						<div key={name} className="srow" style={{ padding: "9px 0" }}>
							<span>{name}</span>
							<span className="row" style={{ gap: 4 }}>
								{keys.map((k, i) => (
									<span key={k} className="row" style={{ gap: 4 }}>
										{i > 0 && keys[0] === "G" && (
											<span className="faint" style={{ fontSize: 11 }}>
												then
											</span>
										)}
										<kbd>{k === "mod" ? mod : k}</kbd>
									</span>
								))}
							</span>
						</div>
					))}
				</SBlock>
			))}
		</>
	);
}
