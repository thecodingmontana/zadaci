import { useMutation } from "@apollo/client/react";
import { useNavigate } from "@tanstack/react-router";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { ConfirmModal } from "#/components/q/confirm";
import { WsLogo } from "#/components/q/ws-logo";
import {
	DELETE_WORKSPACE,
	SET_WORKSPACE_IMAGE,
	type SettingsData,
	UPDATE_PREFERENCES,
	UPDATE_WORKSPACE,
	WORKSPACE_LOGO_UPLOAD,
} from "#/graphql/operations";
import {
	type Appearance,
	setAppearance,
	useAppearance,
} from "#/lib/appearance";
import {
	DATE_FMTS,
	LANGS,
	type Preferences,
	TIME_FMTS,
	WEEK_STARTS,
	WS_COLORS,
} from "#/lib/preferences";
import { toast } from "#/lib/toast";
import { cn } from "#/lib/utils";
import { SBlock, Select, SettingsHeader, SRow, Swatches, Toggle } from "./ui";

export type SectionProps = {
	slug: string;
	me: SettingsData["me"];
	workspace: NonNullable<SettingsData["workspace"]>;
	title: string;
};

const ADMIN = ["owner", "moderator"];
const MAX_LOGO_BYTES = 5 * 1024 * 1024;

/** Saves part of the signed-in user's preferences and confirms with a toast. */
export function usePrefs() {
	const [mutate] = useMutation(UPDATE_PREFERENCES, {
		refetchQueries: ["Settings"],
	});
	return async (patch: Preferences, message = "Preference saved") => {
		try {
			await mutate({ variables: { patch } });
			toast.success(message, { duration: 1500 });
		} catch (error) {
			toast.error("Couldn't save that", { desc: (error as Error).message });
		}
	};
}

export function WorkspaceSection({ slug, workspace, title }: SectionProps) {
	const navigate = useNavigate();
	const isAdmin = ADMIN.includes(workspace.role);
	const [name, setName] = useState(workspace.name);
	const [url, setUrl] = useState(workspace.slug);
	const [host, setHost] = useState("");
	const [confirm, setConfirm] = useState(false);
	const [uploading, setUploading] = useState(false);
	const fileRef = useRef<HTMLInputElement>(null);
	useEffect(() => setHost(location.host), []);

	const refetch = { refetchQueries: ["Settings", "Shell"] };
	const [updateWorkspace, { loading: saving }] = useMutation(
		UPDATE_WORKSPACE,
		refetch,
	);
	const [deleteWorkspace] = useMutation(DELETE_WORKSPACE);
	const [signUpload] = useMutation(WORKSPACE_LOGO_UPLOAD);
	const [setImage] = useMutation(SET_WORKSPACE_IMAGE, refetch);

	async function save(event: FormEvent) {
		event.preventDefault();
		const n = name.trim();
		const u = url
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9-]+/g, "-");
		if (!n) return toast.error("Workspace name can't be empty");
		try {
			const { data } = await updateWorkspace({
				variables: { slug, input: { name: n, slug: u || slug } },
			});
			toast.success("Workspace settings saved");
			if (data && data.updateWorkspace.slug !== slug) {
				navigate({
					to: "/w/$slug/settings",
					params: { slug: data.updateWorkspace.slug },
					search: { sec: "workspace" },
					replace: true,
				});
			}
		} catch (error) {
			toast.error("Couldn't save workspace", {
				desc: (error as Error).message,
			});
		}
	}

	async function upload(file: File) {
		if (!file.type.startsWith("image/"))
			return toast.error("Choose an image file");
		if (file.size > MAX_LOGO_BYTES)
			return toast.error("Images must be 5 MB or smaller");
		setUploading(true);
		try {
			const { data } = await signUpload({ variables: { slug } });
			if (!data) throw new Error("No upload signature");
			const s = data.workspaceLogoUpload;
			const form = new FormData();
			form.append("file", file);
			form.append("api_key", s.apiKey);
			form.append("timestamp", String(s.timestamp));
			form.append("signature", s.signature);
			form.append("folder", s.folder);
			form.append("public_id", s.publicId);
			form.append("overwrite", "true");
			form.append("invalidate", "true");
			form.append("allowed_formats", "png,jpg,jpeg,webp,gif");
			const res = await fetch(s.url, { method: "POST", body: form });
			const body = (await res.json()) as {
				secure_url?: string;
				error?: { message: string };
			};
			if (!res.ok || !body.secure_url)
				throw new Error(body.error?.message ?? "Upload failed");
			await setImage({ variables: { slug, imageUrl: body.secure_url } });
			toast.success("Workspace icon updated");
		} catch (error) {
			toast.error("Couldn't upload that image", {
				desc: (error as Error).message,
			});
		} finally {
			setUploading(false);
			if (fileRef.current) fileRef.current.value = "";
		}
	}

	return (
		<>
			<SettingsHeader
				title={title}
				lead="Your workspace name, address, and identity."
			/>
			<form onSubmit={save}>
				<SBlock first>
					<div className="row" style={{ gap: 14, marginBottom: 18 }}>
						<WsLogo workspace={workspace} px={52} />
						<div>
							<div className="label" style={{ marginBottom: 6 }}>
								Workspace icon
							</div>
							<div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
								<Swatches
									colors={WS_COLORS}
									value={workspace.color}
									size={22}
									label="Workspace color"
									onPick={async (color) => {
										if (!isAdmin) return;
										try {
											await updateWorkspace({
												variables: { slug, input: { color } },
											});
										} catch (error) {
											toast.error("Couldn't change the color", {
												desc: (error as Error).message,
											});
										}
									}}
								/>
								{isAdmin && (
									<>
										<input
											ref={fileRef}
											type="file"
											accept="image/png,image/jpeg,image/webp,image/gif"
											className="sr"
											aria-label="Upload workspace image"
											onChange={(e) =>
												e.target.files?.[0] && upload(e.target.files[0])
											}
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
										{workspace.imageUrl && (
											<button
												type="button"
												className="btn btn-ghost btn-sm"
												onClick={async () => {
													await setImage({
														variables: { slug, imageUrl: null },
													});
													toast.success("Workspace image removed");
												}}
											>
												Remove
											</button>
										)}
									</>
								)}
							</div>
						</div>
					</div>
					<div className="col" style={{ gap: 14 }}>
						<div className="field">
							<label className="label" htmlFor="ws-name">
								Workspace name
							</label>
							<input
								className="input"
								id="ws-name"
								value={name}
								onChange={(e) => setName(e.target.value)}
								disabled={!isAdmin}
							/>
						</div>
						<div className="field">
							<label className="label" htmlFor="ws-url">
								Workspace URL
							</label>
							<div className="row" style={{ gap: 0 }}>
								<span
									className="input"
									style={{
										width: "auto",
										background: "var(--q-surface-2)",
										borderRight: 0,
										borderRadius: "6px 0 0 6px",
										display: "flex",
										alignItems: "center",
										color: "var(--q-text-2)",
									}}
								>
									{host}/w/
								</span>
								<input
									className="input"
									id="ws-url"
									value={url}
									onChange={(e) => setUrl(e.target.value)}
									style={{ borderRadius: "0 6px 6px 0" }}
									disabled={!isAdmin}
								/>
							</div>
							<span className="hint">
								{isAdmin
									? "Changing the URL will break existing links."
									: "Only owners and admins can change workspace settings."}
							</span>
						</div>
						{isAdmin && (
							<div>
								<button
									type="submit"
									className={cn("btn btn-primary", saving && "is-loading")}
									disabled={saving}
								>
									Save changes
								</button>
							</div>
						)}
					</div>
				</SBlock>
			</form>
			{workspace.role === "owner" && (
				<SBlock title="Danger zone" danger>
					<SRow
						t="Delete workspace"
						d="Permanently delete this workspace, its projects, tasks, and files. This cannot be undone."
					>
						<button
							type="button"
							className="btn btn-danger-ghost"
							style={{
								border:
									"1px solid color-mix(in srgb,var(--q-red) 35%,transparent)",
							}}
							onClick={() => setConfirm(true)}
						>
							Delete workspace
						</button>
					</SRow>
				</SBlock>
			)}
			<ConfirmModal
				open={confirm}
				onOpenChange={setConfirm}
				title={`Delete ${workspace.name}?`}
				body="Every project, task, file, and comment in this workspace will be permanently deleted for all members."
				ok="Delete workspace"
				danger
				typeName={workspace.name}
				onConfirm={async () => {
					try {
						await deleteWorkspace({ variables: { slug } });
					} catch (error) {
						toast.error("Couldn't delete the workspace", {
							desc: (error as Error).message,
						});
						throw error;
					}
					toast.success(`${workspace.name} was deleted`);
					navigate({ to: "/workspace" });
				}}
			/>
		</>
	);
}

const LIGHT = {
	bg: "#FBFAF8",
	s: "#F2F1EE",
	t: "#1D1C1A",
	b: "#E3E1DC",
	a: "#EA5A32",
};
const DARK = {
	bg: "#1D1D1C",
	s: "#151514",
	t: "#ECEAE5",
	b: "#333230",
	a: "#F9845F",
};

function ThemePreview({ c }: { c: typeof LIGHT }) {
	return (
		<>
			<div className="s" style={{ background: c.s }}>
				<i style={{ background: c.b, width: "70%" }} />
				<i style={{ background: c.a, width: "55%" }} />
				<i style={{ background: c.b, width: "80%" }} />
				<i style={{ background: c.b, width: "60%" }} />
			</div>
			<div className="m" style={{ background: c.bg }}>
				<i style={{ background: c.t, width: "45%", height: 7 }} />
				<i style={{ background: c.b }} />
				<i style={{ background: c.b, width: "80%" }} />
				<i
					style={{ background: c.a, width: "30%", height: 10, marginTop: 4 }}
				/>
			</div>
		</>
	);
}

const ACCENTS = [
	["orange", "#EA5A32"],
	["indigo", "#4B5BD6"],
	["blue", "#2F6CD4"],
	["violet", "#7348CC"],
	["teal", "#1A7F7A"],
	["rose", "#B93D68"],
	["graphite", "#34332F"],
] as const;

function Seg<K extends string>({
	value,
	options,
	onPick,
}: {
	value: K;
	options: K[];
	onPick: (v: K) => void;
}) {
	return (
		<div className="seg">
			{options.map((k) => (
				<button
					key={k}
					type="button"
					className={value === k ? "on" : ""}
					aria-pressed={value === k}
					onClick={() => onPick(k)}
				>
					{k[0]?.toUpperCase() + k.slice(1)}
				</button>
			))}
		</div>
	);
}

export function AppearanceSection({ title }: { title: string }) {
	const a = useAppearance();
	const set = (patch: Partial<Appearance>) => setAppearance(patch);
	return (
		<>
			<SettingsHeader
				title={title}
				lead="Customize how Zadaci looks on this device."
			/>
			<SBlock title="Theme" first>
				<div
					className="themecards"
					style={{ marginTop: 12 }}
					role="radiogroup"
					aria-label="Theme"
				>
					{(
						[
							["light", "Light", "icon-[solar--sun-2-linear]"],
							["dark", "Dark", "icon-[solar--moon-linear]"],
							["system", "System", "icon-[solar--monitor-linear]"],
						] as const
					).map(([k, n, icon]) => (
						<label key={k} className={cn("tcard", a.theme === k && "on")}>
							<input
								type="radio"
								className="sr"
								name="theme"
								checked={a.theme === k}
								onChange={() => set({ theme: k })}
							/>
							<div
								className="tprev"
								style={
									k === "system"
										? { gridTemplateColumns: "1fr 1fr", display: "grid" }
										: undefined
								}
							>
								{k === "system" ? (
									<>
										<div
											style={{
												display: "grid",
												gridTemplateColumns: "30% 1fr",
											}}
										>
											<ThemePreview c={LIGHT} />
										</div>
										<div
											style={{
												display: "grid",
												gridTemplateColumns: "30% 1fr",
											}}
										>
											<ThemePreview c={DARK} />
										</div>
									</>
								) : (
									<ThemePreview c={k === "light" ? LIGHT : DARK} />
								)}
							</div>
							<span
								className="row"
								style={{ fontWeight: 500, fontSize: 13, gap: 6 }}
							>
								<span className={cn(icon, "size-3.5")} aria-hidden="true" />
								{n}
								{a.theme === k && (
									<>
										<span className="sp" />
										<span
											className="icon-[solar--check-circle-bold] size-[15px] text-(--q-accent)"
											aria-hidden="true"
										/>
									</>
								)}
							</span>
						</label>
					))}
				</div>
			</SBlock>
			<SBlock title="Accent color">
				<SRow
					t="Accent"
					d="Used for primary buttons, focus rings, and selection."
				>
					<Swatches
						colors={ACCENTS}
						value={a.accent}
						onPick={(accent) => set({ accent })}
						label="Accent color"
						checkmark
					/>
				</SRow>
			</SBlock>
			<SBlock title="Density">
				<SRow t="Sidebar density" d="Compact fits more projects on screen.">
					<Seg
						value={a.side}
						options={["comfortable", "compact"]}
						onPick={(side) => set({ side })}
					/>
				</SRow>
				<SRow
					t="Task display"
					d="Row height in lists and card padding on boards."
				>
					<Seg
						value={a.density}
						options={["comfortable", "compact"]}
						onPick={(density) => set({ density })}
					/>
				</SRow>
				<SRow
					t="Motion"
					d="Reduce animations for drawers, modals, and transitions."
				>
					<Select
						value={a.motion}
						options={[
							["system", "Follow system"],
							["reduce", "Reduce motion"],
						]}
						onChange={(motion) =>
							set({ motion: motion as Appearance["motion"] })
						}
						label="Motion"
					/>
				</SRow>
			</SBlock>
		</>
	);
}

export function LanguageSection({ me, title }: SectionProps) {
	const save = usePrefs();
	const p = me.preferences;
	return (
		<>
			<SettingsHeader title={title} lead="Language and regional formats." />
			<SRow t="Language" d="The language used throughout the interface.">
				<Select
					value={p.lang}
					options={LANGS}
					onChange={(lang) => save({ lang: lang as Preferences["lang"] })}
					label="Language"
				/>
			</SRow>
			<SRow t="Spellcheck" d="Check spelling in descriptions and comments.">
				<Toggle
					checked={p.spell}
					onChange={(spell) => save({ spell })}
					label="Spellcheck"
				/>
			</SRow>
		</>
	);
}

/** Formats a date with one of the DATE_FMTS patterns. */
export function formatDate(date: Date, fmt: string) {
	const d = date.getDate();
	const m = date.getMonth() + 1;
	if (fmt === "d/M") return `${d}/${m}`;
	if (fmt === "M/d") return `${m}/${d}`;
	if (fmt === "yyyy-MM-dd")
		return `${date.getFullYear()}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
	return `${date.toLocaleString("en-US", { month: "short" })} ${d}`;
}

export function DateTimeSection({ me, title }: SectionProps) {
	const save = usePrefs();
	const p = me.preferences;
	const [zones, setZones] = useState<[string, string][]>([["", "Automatic"]]);
	const [preview, setPreview] = useState("");
	useEffect(() => {
		const auto = Intl.DateTimeFormat().resolvedOptions().timeZone;
		setZones([
			["", `Automatic (${auto})`],
			...Intl.supportedValuesOf("timeZone").map((z): [string, string] => [
				z,
				z.replace(/_/g, " "),
			]),
		]);
	}, []);
	useEffect(
		() =>
			setPreview(formatDate(new Date(Date.now() + 8 * 86_400_000), p.dateFmt)),
		[p.dateFmt],
	);

	return (
		<>
			<SettingsHeader
				title={title}
				lead="How dates and times appear across the workspace."
			/>
			<SRow t="Time zone" d="Used for due dates and reminders.">
				<Select
					value={p.tz}
					options={zones}
					onChange={(tz) => save({ tz })}
					label="Time zone"
				/>
			</SRow>
			<SRow
				t="Date format"
				d={
					<>
						Preview: <b>{preview}</b>
					</>
				}
			>
				<Select
					value={p.dateFmt}
					options={DATE_FMTS}
					onChange={(dateFmt) =>
						save({ dateFmt: dateFmt as Preferences["dateFmt"] })
					}
					label="Date format"
				/>
			</SRow>
			<SRow t="Start week on" d="Affects calendars and the timeline.">
				<Select
					value={p.weekStart}
					options={WEEK_STARTS}
					onChange={(weekStart) =>
						save({ weekStart: weekStart as Preferences["weekStart"] })
					}
					label="Start week on"
				/>
			</SRow>
			<SRow t="Time format">
				<Select
					value={p.timeFmt}
					options={TIME_FMTS}
					onChange={(timeFmt) =>
						save({ timeFmt: timeFmt as Preferences["timeFmt"] })
					}
					label="Time format"
				/>
			</SRow>
		</>
	);
}
