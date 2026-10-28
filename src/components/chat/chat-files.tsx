import type { ApolloClient } from "@apollo/client";
import { useEffect, useRef, useState } from "react";
import { sendToCloudinary } from "#/components/tasks/upload";
import { CHAT_UPLOAD, type ChatAttachment } from "#/graphql/chat-operations";
import { fmtSize, maxUpload } from "#/lib/files";
import { toast } from "#/lib/toast";
import { cn } from "#/lib/utils";

// Files in chat: what you're about to send (uploading straight to Cloudinary into the
// conversation's folder), voice notes recorded in the browser, and how sent files show.

const MB = 1024 * 1024;
const MAX_FILES = 10;

/** A file picked, pasted, dropped or recorded: kept in the browser until the message is sent. */
export type Draft = {
	id: string;
	file: File;
	/** a picture's preview (revoke it once it's no longer shown) */
	preview?: string;
	/** a voice note's length */
	seconds?: number;
};

/** The files waiting to go with the next message. Nothing uploads until you send. */
export function useDraftFiles() {
	const [files, setFiles] = useState<Draft[]>([]);
	const latest = useRef(files);
	latest.current = files;
	// leaving without sending: free the previews
	useEffect(
		() => () => {
			for (const f of latest.current)
				if (f.preview) URL.revokeObjectURL(f.preview);
		},
		[],
	);
	const add = (list: File[], seconds?: number) => {
		const room = MAX_FILES - latest.current.length;
		if (list.length > room)
			toast.error(`Send up to ${MAX_FILES} files at a time`);
		const fit = list.slice(0, Math.max(0, room)).filter((file) => {
			const max = maxUpload(file.type);
			if (file.size <= max) return true;
			toast.error(`${file.name} is too big`, {
				desc: `The limit for this kind of file is ${max / MB} MB.`,
			});
			return false;
		});
		setFiles((all) => [
			...all,
			...fit.map((file) => ({
				id: crypto.randomUUID(),
				file,
				seconds,
				preview: file.type.startsWith("image/")
					? URL.createObjectURL(file)
					: undefined,
			})),
		]);
	};
	const remove = (id: string) =>
		setFiles((all) => {
			const f = all.find((x) => x.id === id);
			if (f?.preview) URL.revokeObjectURL(f.preview);
			return all.filter((x) => x.id !== id);
		});
	/** hands the files over to be sent (their previews go with them) */
	const take = () => {
		const out = latest.current;
		latest.current = [];
		setFiles([]);
		return out;
	};
	return { files, add, remove, take };
}

/** The files above the message box, each with a way to drop it. */
export function DraftFiles({
	files,
	onRemove,
}: {
	files: Draft[];
	onRemove: (id: string) => void;
}) {
	if (!files.length) return null;
	return (
		<div className="chat-pending">
			{files.map((f) => (
				<div key={f.id} className="chat-pending-file">
					<FileThumb draft={f} />
					<span className="chat-pending-name">
						<span className="trunc">{f.file.name}</span>
						<span className="faint">{fmtSize(f.file.size)}</span>
					</span>
					<button
						type="button"
						className="ibtn ibtn-xs"
						aria-label={`Remove ${f.file.name}`}
						onClick={() => onRemove(f.id)}
					>
						<span
							className="icon-[solar--close-circle-bold] size-4"
							aria-hidden="true"
						/>
					</button>
				</div>
			))}
		</div>
	);
}

/** A draft's picture preview, or its kind's icon. */
export const FileThumb = ({ draft }: { draft: Draft }) =>
	draft.preview ? (
		<img src={draft.preview} alt="" />
	) : (
		<span
			className={cn(fileIcon(draft.file.type), "size-5 shrink-0")}
			aria-hidden="true"
		/>
	);

/** Uploads one file into the conversation's folder; resolves to what the message carries. */
export async function uploadChatFile(
	client: ApolloClient,
	slug: string,
	channelId: string,
	draft: Draft,
	onProgress: (pct: number) => void,
	signal?: AbortSignal,
): Promise<ChatAttachment> {
	const { file } = draft;
	const { data } = await client.mutate({
		mutation: CHAT_UPLOAD,
		variables: { slug, channelId, file: !file.type.startsWith("image/") },
	});
	if (!data) throw new Error("No upload slot");
	const res = await sendToCloudinary(data.chatUpload, file, onProgress, signal);
	return {
		url: res.secure_url,
		name: file.name,
		size: res.bytes ?? file.size,
		type: file.type || "application/octet-stream",
		seconds: draft.seconds ?? null,
	};
}

/** Records a voice note with the microphone; hands back the file when you stop. */
export function VoiceNote({
	onDone,
	disabled,
}: {
	onDone: (file: File, seconds: number) => void;
	disabled?: boolean;
}) {
	const [recording, setRecording] = useState<{
		recorder: MediaRecorder;
		started: number;
	} | null>(null);
	const [elapsed, setElapsed] = useState(0);
	const keep = useRef(true);

	useEffect(() => {
		if (!recording) return;
		const id = setInterval(
			() => setElapsed(Math.round((Date.now() - recording.started) / 1000)),
			250,
		);
		// leaving mid-recording: drop it and let the microphone go
		return () => {
			clearInterval(id);
			if (recording.recorder.state === "recording") {
				keep.current = false;
				recording.recorder.stop();
			}
		};
	}, [recording]);

	const start = async () => {
		if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
			toast.error("This browser can't record audio");
			return;
		}
		let stream: MediaStream;
		try {
			stream = await navigator.mediaDevices.getUserMedia({ audio: true });
		} catch {
			toast.error("Microphone blocked", {
				desc: "Allow the microphone for this site to record a voice note.",
			});
			return;
		}
		const recorder = new MediaRecorder(stream);
		const chunks: Blob[] = [];
		const started = Date.now();
		keep.current = true;
		recorder.ondataavailable = (e) => {
			if (e.data.size) chunks.push(e.data);
		};
		recorder.onstop = () => {
			for (const t of stream.getTracks()) t.stop();
			setRecording(null);
			setElapsed(0);
			if (!keep.current || !chunks.length) return;
			// Chrome and Firefox record webm, Safari mp4
			const type = recorder.mimeType || "audio/webm";
			const ext = type.includes("mp4") ? "m4a" : "webm";
			onDone(
				new File(chunks, `Voice note.${ext}`, { type }),
				Math.max(1, Math.round((Date.now() - started) / 1000)),
			);
		};
		recorder.start();
		setRecording({ recorder, started });
	};
	const stop = (attach: boolean) => {
		keep.current = attach;
		recording?.recorder.stop();
	};

	if (recording)
		return (
			<output className="chat-recording">
				<span className="chat-rec-dot" aria-hidden="true" />
				{clock(elapsed)}
				<button
					type="button"
					className="ibtn ibtn-xs"
					aria-label="Discard voice note"
					data-tip="Discard"
					onClick={() => stop(false)}
				>
					<span
						className="icon-[solar--trash-bin-trash-linear] size-4"
						aria-hidden="true"
					/>
				</button>
				<button
					type="button"
					className="ibtn ibtn-xs"
					aria-label="Stop and attach"
					data-tip="Stop and attach"
					onClick={() => stop(true)}
				>
					<span
						className="icon-[solar--stop-circle-bold] size-4 chat-rec-stop"
						aria-hidden="true"
					/>
				</button>
			</output>
		);
	return (
		<button
			type="button"
			className="ibtn ibtn-sm"
			aria-label="Record a voice note"
			data-tip="Voice note"
			disabled={disabled}
			onClick={() => void start()}
		>
			<span
				className="icon-[solar--microphone-linear] size-4"
				aria-hidden="true"
			/>
		</button>
	);
}

/** "0:07", "12:30". */
const clock = (s: number) =>
	`${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

const fileIcon = (type: string) =>
	type.startsWith("image/")
		? "icon-[solar--gallery-linear]"
		: type.startsWith("video/")
			? "icon-[solar--videocamera-record-linear]"
			: type.startsWith("audio/")
				? "icon-[solar--microphone-linear]"
				: "icon-[solar--document-linear]";

/** A sent message's files: pictures and videos inline, voice notes and audio play in place,
 *  anything else as a card to open. */
export function Attachments({ files }: { files: ChatAttachment[] }) {
	if (!files.length) return null;
	const pictures = files.filter((f) => f.type.startsWith("image/"));
	const rest = files.filter((f) => !f.type.startsWith("image/"));
	return (
		<div className="chat-files">
			{pictures.length > 0 && (
				<div className={cn("chat-pics", pictures.length > 1 && "many")}>
					{pictures.map((f) => (
						<a
							key={f.url}
							href={f.url}
							target="_blank"
							rel="noopener noreferrer"
							className="chat-pic"
						>
							<img src={f.url} alt={f.name} loading="lazy" />
						</a>
					))}
				</div>
			)}
			{rest.map((f) =>
				f.type.startsWith("video/") ? (
					// biome-ignore lint/a11y/useMediaCaption: people's own clips have no captions
					<video
						key={f.url}
						className="chat-video"
						src={f.url}
						controls
						preload="metadata"
					/>
				) : f.type.startsWith("audio/") ? (
					<div key={f.url} className="chat-audio">
						<span
							className="icon-[solar--microphone-linear] size-4 shrink-0"
							aria-hidden="true"
						/>
						{/* biome-ignore lint/a11y/useMediaCaption: voice notes have no captions */}
						<audio src={f.url} controls preload="metadata" />
						{f.seconds != null && (
							<span className="faint">{clock(f.seconds)}</span>
						)}
					</div>
				) : (
					<a
						key={f.url}
						className="chat-file"
						href={f.url}
						target="_blank"
						rel="noopener noreferrer"
						download={f.name}
					>
						<span
							className={cn(fileIcon(f.type), "size-5 shrink-0")}
							aria-hidden="true"
						/>
						<span className="chat-pending-name">
							<span className="trunc">{f.name}</span>
							<span className="faint">{fmtSize(f.size)}</span>
						</span>
						<span
							className="icon-[solar--download-minimalistic-linear] size-4 shrink-0"
							aria-hidden="true"
						/>
					</a>
				),
			)}
		</div>
	);
}
