import { useMutation, useQuery } from "@apollo/client/react";
import { useRouter } from "@tanstack/react-router";
import { type FormEvent, useRef, useState } from "react";
import { Av } from "#/components/q/av";
import { ConfirmModal } from "#/components/q/confirm";
import { SHORTCUTS, useModKey } from "#/components/shell/command-menu";
import {
	ACCOUNT_DELETION,
	DELETE_MY_ACCOUNT,
	UPDATE_PREFERENCES,
} from "#/graphql/operations";
import { authClient } from "#/lib/auth-client";
import {
	AVATAR_COLORS,
	DIGEST_HOURS,
	HOME_OPTS,
	OPEN_TASKS,
	type Preferences,
} from "#/lib/preferences";
import { toast } from "#/lib/toast";
import { cn } from "#/lib/utils";
import { type SectionProps, usePrefs } from "./general";
import { AvatarPicker, RemovablePicture, uploadPicture } from "./picture";
import { PushDevice } from "./push-device";
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
				"A summary of what's unread, every weekday morning.",
			],
		],
	},
	"notif-push": {
		lead: "Notifications on your desktop or phone, even when Zadaci isn't open.",
		rows: [
			["push_mention", "Mentions"],
			["push_assign", "Assignments"],
			["push_comment", "Comments"],
			[
				"push_due",
				"Due date reminders",
				"The day before and the morning a task is due.",
			],
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
	// push choices only mean something once this device is turned on
	const [deviceOn, setDeviceOn] = useState(false);
	const section = NOTIF_SECTIONS[sec];
	if (!section) return null;
	const locked = sec === "notif-push" && !deviceOn;
	return (
		<>
			<SettingsHeader title={title} lead={section.lead} />
			{sec === "notif-push" && <PushDevice onChange={setDeviceOn} />}
			{section.rows.map(([k, t, d]) => (
				<SRow key={k} t={t} d={d}>
					<Toggle
						checked={!locked && me.preferences.notif[k]}
						disabled={locked}
						onChange={(v) =>
							save({ notif: { [k]: v } }, "Notification preferences saved")
						}
						label={t}
					/>
				</SRow>
			))}
			{sec === "notif-email" && (
				<SRow
					t="Morning time"
					d="When the digest and due-date reminders arrive, in your time zone."
				>
					<Select
						value={me.preferences.digestHour}
						options={DIGEST_HOURS.map(([h]) => [
							h,
							hourLabel(Number(h), me.preferences.timeFmt),
						])}
						onChange={(digestHour) =>
							save(
								{ digestHour: digestHour as Preferences["digestHour"] },
								"Morning time saved",
							)
						}
						label="Morning time"
					/>
				</SRow>
			)}
		</>
	);
}

const hourLabel = (h: number, fmt: string) =>
	fmt === "24"
		? `${String(h).padStart(2, "0")}:00`
		: `${h % 12 || 12}:00 ${h < 12 ? "AM" : "PM"}`;

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
		const run = async () => {
			if (n !== me.name) {
				const { error } = await authClient.updateUser({ name: n });
				if (error) throw new Error(error.message);
			}
			await savePrefs({ variables: { patch: { title: jobTitle.trim() } } });
			await router.invalidate();
		};
		try {
			await toast.promise(run(), {
				loading: "Saving profile…",
				success: "Profile updated",
				error: "Couldn't update your profile",
			});
		} catch {
			// the toast already shows why
		} finally {
			setBusy(false);
		}
	}

	const fileRef = useRef<HTMLInputElement>(null);
	const [uploading, setUploading] = useState(false);
	const [picking, setPicking] = useState(false);
	/** Saves your picture (null removes it); the app shows your initials and colour instead. */
	const setPicture = (image: string | null) =>
		toast
			.promise(
				(async () => {
					const { error } = await authClient.updateUser({ image });
					if (error) throw new Error(error.message);
					await router.invalidate();
				})(),
				{
					loading: image ? "Saving your picture…" : "Removing your picture…",
					success: image ? "Picture updated" : "Picture removed",
					error: (e) => (e as Error).message,
				},
			)
			.catch(() => {});
	const uploadOwn = async (file: File) => {
		setUploading(true);
		try {
			await setPicture(await uploadPicture(file, "avatar"));
		} catch (e) {
			toast.error("Couldn't upload that image", { desc: (e as Error).message });
		} finally {
			setUploading(false);
			if (fileRef.current) fileRef.current.value = "";
		}
	};
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
					<RemovablePicture
						label="Remove your picture"
						onRemove={me.image ? () => void setPicture(null) : undefined}
					>
						<Av
							name={me.name}
							image={me.image}
							color={p.avatarColor}
							className="xl"
						/>
					</RemovablePicture>
					<div>
						<div className="row" style={{ gap: 8, marginBottom: 12 }}>
							<input
								ref={fileRef}
								type="file"
								accept="image/png,image/jpeg,image/webp,image/gif"
								className="sr"
								aria-label="Upload your picture"
								onChange={(e) => {
									const file = e.target.files?.[0];
									if (file) void uploadOwn(file);
								}}
							/>
							<button
								type="button"
								className={cn(
									"btn btn-secondary btn-sm",
									uploading && "is-loading",
								)}
								onClick={() => fileRef.current?.click()}
								disabled={uploading}
							>
								<span
									className="icon-[solar--gallery-add-linear] size-[13px]"
									aria-hidden="true"
								/>
								Upload image
							</button>
							<button
								type="button"
								className="btn btn-secondary btn-sm"
								onClick={() => setPicking(true)}
							>
								<span
									className="icon-[solar--user-circle-linear] size-[13px]"
									aria-hidden="true"
								/>
								Choose avatar
							</button>
						</div>
						<div className="label" style={{ marginBottom: 6 }}>
							Avatar color
						</div>
						<Swatches
							colors={AVATAR_COLORS}
							value={p.avatarColor}
							size={22}
							label="Avatar color"
							onPick={(avatarColor) =>
								toast
									.promise(
										savePrefs({ variables: { patch: { avatarColor } } }),
										{
											loading: "Saving avatar color…",
											success: "Avatar color updated",
											error: "Couldn't save that",
										},
									)
									.catch(() => {})
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
			<AvatarPicker
				open={picking}
				onOpenChange={setPicking}
				onPick={async (url) => {
					await setPicture(url);
					setPicking(false);
				}}
			/>
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

/** Download everything that's yours, or delete your account (it explains what happens first). */
export function DataSection({ me, title }: SectionProps) {
	const { data } = useQuery(ACCOUNT_DELETION, { fetchPolicy: "network-only" });
	const [confirm, setConfirm] = useState(false);
	const [remove] = useMutation(DELETE_MY_ACCOUNT);
	const blockers = data?.accountDeletion.blockers ?? [];
	const solo = data?.accountDeletion.solo ?? [];
	return (
		<>
			<SettingsHeader
				title={title}
				lead="Take a copy of your data, or delete your account."
			/>
			<SRow
				t="Download my data"
				d="Your profile, workspaces, assigned tasks, comments, notes, bookmarks and assistant chats, as one JSON file."
			>
				<a
					className="btn btn-secondary btn-sm"
					href="/api/account/export"
					download
				>
					<span
						className="icon-[solar--download-minimalistic-linear] size-3.5"
						aria-hidden="true"
					/>
					Download
				</a>
			</SRow>
			<SRow
				t="Delete account"
				d={
					blockers.length
						? `You own ${blockers.map((b) => `“${b}”`).join(", ")} with other people. Make someone else the owner in that workspace's settings, or delete it, first.`
						: "Removes your name, email, photo, sign-ins, private notes and bookmarks, and AI keys and chats. Work you shared stays with your team as “Deleted user”."
				}
			>
				<button
					type="button"
					className="btn btn-danger btn-sm"
					disabled={blockers.length > 0}
					onClick={() => setConfirm(true)}
				>
					Delete account
				</button>
			</SRow>
			<ConfirmModal
				open={confirm}
				onOpenChange={setConfirm}
				title="Delete your account?"
				body={
					<>
						This can't be undone. You'll leave every workspace and be signed
						out.
						{solo.length > 0 && (
							<>
								{" "}
								These workspaces have no one else in them and will be deleted
								too: {solo.map((w) => `“${w}”`).join(", ")}.
							</>
						)}{" "}
						Type your email to confirm.
					</>
				}
				ok="Delete my account"
				danger
				icon="icon-[solar--trash-bin-minimalistic-linear]"
				typeName={me.email}
				onConfirm={async () => {
					try {
						await remove({ variables: { email: me.email } });
						await authClient.signOut().catch(() => {});
						window.location.assign("/");
					} catch (e) {
						toast.error("Couldn't delete the account", {
							desc: (e as Error).message,
						});
					}
				}}
			/>
		</>
	);
}
