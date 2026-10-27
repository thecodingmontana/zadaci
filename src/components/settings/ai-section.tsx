import { useMutation, useQuery } from "@apollo/client/react";
import { type FormEvent, useState } from "react";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "#/components/q/menu";
import { Modal } from "#/components/q/modal";
import {
	AI_STATUS,
	type AiKey,
	type AiStatus,
	REMOVE_AI_KEY,
	SET_AI_KEY,
	SET_AI_MODEL,
	USE_AI_KEY,
} from "#/graphql/operations";
import { PROVIDERS, type Provider } from "#/lib/ai/providers";
import { toast } from "#/lib/toast";
import { cn } from "#/lib/utils";
import { SettingsHeader } from "./ui";

// Settings → AI assistant: the free daily allowance, and your own keys for Claude, ChatGPT, Gemini
// or OpenRouter as cards you connect through a short guided dialog. Keys go to the server once and
// never come back; only their last characters show.

/** Each key mutation answers with the whole status, which becomes the cached one. */
function useSave<T extends Record<string, unknown>>(
	doc: Parameters<typeof useMutation>[0],
	field: string,
) {
	const [run, state] = useMutation(doc, {
		update: (cache, { data }) => {
			const aiStatus = (data as Record<string, AiStatus> | null)?.[field];
			if (aiStatus) cache.writeQuery({ query: AI_STATUS, data: { aiStatus } });
		},
	});
	return [(variables: T) => run({ variables }), state] as const;
}

const fail = (title: string) => (e: unknown) =>
	toast.error(title, { desc: (e as Error).message });

const shortName = (p: Provider) => p.label.replace(/ \(.*\)$/, "");

export function AiSection({ title }: { title: string }) {
	const { data } = useQuery(AI_STATUS);
	const status = data?.aiStatus;
	const [switchKey] = useSave<{ provider: string | null }>(
		USE_AI_KEY,
		"useAiKey",
	);
	const [connecting, setConnecting] = useState<Provider | null>(null);
	const active = status?.keys.find((k) => k.active);
	const limit = status?.limit ?? 2;
	const left = status ? Math.max(0, limit - status.used) : null;

	return (
		<>
			<SettingsHeader
				title={title}
				lead={`Zad, your assistant, gives you ${limit} free messages a day. Connect your own Claude, ChatGPT, Gemini or OpenRouter key to use it as much as you like, with the model you choose.`}
			/>
			<div className="aik-list">
				<div className={cn("aik", !active && "on")}>
					<span className="aik-logo">
						<span
							className="icon-[hugeicons--ai-magic] size-5"
							aria-hidden="true"
						/>
					</span>
					<div className="aik-txt">
						<b>Shared free models</b>
						<span className="faint">
							{left === null ? "…" : `${left} of ${limit} messages left today`}
						</span>
					</div>
					{!active ? (
						<span className="aik-badge">In use</span>
					) : (
						<button
							type="button"
							className="btn btn-secondary btn-sm"
							onClick={() =>
								void switchKey({ provider: null }).catch(
									fail("Couldn't switch"),
								)
							}
						>
							Use this
						</button>
					)}
				</div>
				{PROVIDERS.map((p) => (
					<ProviderCard
						key={p.id}
						provider={p}
						saved={status?.keys.find((k) => k.provider === p.id)}
						onConnect={() => setConnecting(p)}
						onUse={() =>
							void switchKey({ provider: p.id }).catch(fail("Couldn't switch"))
						}
					/>
				))}
			</div>
			<p className="faint aik-note">
				<span
					className="icon-[solar--lock-keyhole-minimalistic-linear] size-3.5"
					aria-hidden="true"
				/>
				Keys are checked with the provider, then encrypted and tied to your
				account before they're stored. Nobody can see them again: not you, other
				members or workspace admins. They're used only to send your assistant
				messages to that provider, and you can remove them any time.
			</p>
			{connecting && (
				<ConnectDialog
					provider={connecting}
					replacing={!!status?.keys.some((k) => k.provider === connecting.id)}
					onClose={() => setConnecting(null)}
				/>
			)}
		</>
	);
}

function ProviderCard({
	provider,
	saved,
	onConnect,
	onUse,
}: {
	provider: Provider;
	saved?: AiKey;
	onConnect: () => void;
	onUse: () => void;
}) {
	const [setModel] = useSave<{ provider: string; model: string }>(
		SET_AI_MODEL,
		"setAiModel",
	);
	const [remove] = useSave<{ provider: string }>(REMOVE_AI_KEY, "removeAiKey");
	const model = provider.models.find((m) => m.id === saved?.model);
	return (
		<div className={cn("aik", saved?.active && "on")}>
			<span className="aik-logo">
				<span className={cn(provider.icon, "size-5")} aria-hidden="true" />
			</span>
			<div className="aik-txt">
				<b>{provider.label}</b>
				<span className="faint">
					{saved
						? `Connected · ${saved.hint}${model?.id ? ` · ${model.label.replace(/ \(.*\)$/, "")}` : ""}`
						: "Not connected"}
				</span>
			</div>
			{!saved ? (
				<button
					type="button"
					className="btn btn-secondary btn-sm"
					onClick={onConnect}
				>
					<span
						className="icon-[solar--link-round-linear] size-3.5"
						aria-hidden="true"
					/>
					Connect
				</button>
			) : (
				<>
					{saved.active ? (
						<span className="aik-badge">In use</span>
					) : (
						<button
							type="button"
							className="btn btn-secondary btn-sm"
							onClick={onUse}
						>
							Use this
						</button>
					)}
					<Menu>
						<MenuTrigger
							className="ibtn ibtn-sm"
							aria-label={`${provider.label} options`}
						>
							<span
								className="icon-[solar--menu-dots-bold] size-4"
								aria-hidden="true"
							/>
						</MenuTrigger>
						<MenuContent width={270}>
							{provider.models.length > 1 &&
								provider.models.map((m) => (
									<MenuItem
										key={m.id}
										checked={m.id === saved.model}
										onSelect={() =>
											void setModel({
												provider: provider.id,
												model: m.id,
											}).catch(fail("Couldn't change the model"))
										}
									>
										{m.label}
									</MenuItem>
								))}
							<MenuItem
								icon="icon-[solar--refresh-linear]"
								onSelect={onConnect}
							>
								Replace key
							</MenuItem>
							<MenuItem
								icon="icon-[solar--trash-bin-minimalistic-linear]"
								danger
								onSelect={() =>
									void toast
										.promise(remove({ provider: provider.id }), {
											loading: "Removing the key…",
											success: `${provider.label} key removed`,
											error: "Couldn't remove the key",
										})
										.catch(() => {})
								}
							>
								Remove key
							</MenuItem>
						</MenuContent>
					</Menu>
				</>
			)}
		</div>
	);
}

/** A guided connect: where to get the key, paste it, pick a model; it's checked before saving. */
function ConnectDialog({
	provider,
	replacing,
	onClose,
}: {
	provider: Provider;
	replacing: boolean;
	onClose: () => void;
}) {
	const [key, setKey] = useState("");
	const [show, setShow] = useState(false);
	const [model, setModel] = useState(provider.models[0]?.id ?? "");
	const [err, setErr] = useState("");
	const [save, saving] = useSave<{
		provider: string;
		key: string;
		model: string;
	}>(SET_AI_KEY, "setAiKey");
	const looksRight = provider.keyPattern.test(key.trim());

	const submit = async (e?: FormEvent) => {
		e?.preventDefault();
		if (!key.trim() || saving.loading) return;
		setErr("");
		try {
			await save({ provider: provider.id, key: key.trim(), model });
			toast.success(`${shortName(provider)} connected; Zad uses it now`);
			onClose();
		} catch (e) {
			setErr((e as Error).message);
		}
	};
	const paste = async () => {
		try {
			setKey((await navigator.clipboard.readText()).trim());
			setErr("");
		} catch {
			setErr("Couldn't read the clipboard. Paste with Ctrl/⌘+V instead.");
		}
	};

	return (
		<Modal
			open
			onOpenChange={(o) => !o && onClose()}
			title={`${replacing ? "Replace your" : "Connect"} ${shortName(provider)} key`}
			busy={saving.loading}
			footer={
				<>
					<span className="sp" />
					<button
						type="button"
						className="btn btn-secondary btn-sm"
						onClick={onClose}
						disabled={saving.loading}
					>
						Cancel
					</button>
					<button
						type="button"
						className="btn btn-primary btn-sm"
						disabled={!key.trim() || saving.loading}
						onClick={() => void submit()}
					>
						{saving.loading ? "Checking…" : "Check and save"}
					</button>
				</>
			}
		>
			<form className="modal-b aik-connect" onSubmit={submit}>
				<ol className="aik-steps">
					<li>
						<span className="aik-n">1</span>
						<span>
							Open{" "}
							<a
								href={provider.keysUrl}
								target="_blank"
								rel="noopener noreferrer"
							>
								your {shortName(provider)} keys page ↗
							</a>{" "}
							and create a new key.
						</span>
					</li>
					<li>
						<span className="aik-n">2</span>
						<span>Copy it and paste it below.</span>
					</li>
				</ol>
				<div className="aik-field">
					<label className="aik-lbl" htmlFor="aik-key">
						API key
					</label>
					<div className={cn("aik-input", err && "bad")}>
						<span className={cn(provider.icon, "size-4")} aria-hidden="true" />
						<input
							id="aik-key"
							type={show ? "text" : "password"}
							autoComplete="off"
							spellCheck={false}
							// biome-ignore lint/a11y/noAutofocus: the dialog exists to take this one value
							autoFocus
							placeholder={provider.keyExample}
							value={key}
							onChange={(e) => {
								setKey(e.target.value);
								setErr("");
							}}
						/>
						{key && (
							<button
								type="button"
								className="ibtn ibtn-xs"
								aria-label={show ? "Hide the key" : "Show the key"}
								onClick={() => setShow(!show)}
							>
								<span
									className={cn(
										"size-4",
										show
											? "icon-[solar--eye-closed-linear]"
											: "icon-[solar--eye-linear]",
									)}
									aria-hidden="true"
								/>
							</button>
						)}
						<button
							type="button"
							className="btn btn-ghost btn-sm"
							onClick={() => void paste()}
						>
							Paste
						</button>
					</div>
					<span className={cn("aik-hint", err ? "bad" : "faint")}>
						{err ||
							(key && !looksRight
								? `${shortName(provider)} keys usually look like ${provider.keyExample}`
								: "We check it with the provider before saving.")}
					</span>
				</div>
				{provider.models.length > 1 && (
					<div className="aik-field">
						<span className="aik-lbl">Model</span>
						<div className="aik-models">
							{provider.models.map((m) => (
								<button
									key={m.id}
									type="button"
									className={cn("aik-model", m.id === model && "on")}
									aria-pressed={m.id === model}
									onClick={() => setModel(m.id)}
								>
									{m.label}
								</button>
							))}
						</div>
					</div>
				)}
				<p className="faint aik-note">
					<span
						className="icon-[solar--lock-keyhole-minimalistic-linear] size-3.5"
						aria-hidden="true"
					/>
					Encrypted before it's stored and never shown again. Your provider
					bills you for what Zad uses.
				</p>
			</form>
		</Modal>
	);
}
