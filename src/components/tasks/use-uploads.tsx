import { useApolloClient } from "@apollo/client/react";
import { type CSSProperties, type ReactNode, useState } from "react";
import { toast } from "#/lib/toast";
import { uploadFile } from "./upload";

// Uploading files to a task or a project: progress per file, a toast when one fails, and a
// file picker to drop into any button. The task drawer and the Files tab share it.

type Upload = { id: string; name: string; pct: number };

export function useUploads(
	slug: string,
	target: { taskId?: string; projectId?: string },
	/** queries to refresh once the files are in */
	refetch: string[],
) {
	const client = useApolloClient();
	const [uploads, setUploads] = useState<Upload[]>([]);

	async function upload(files: FileList | File[]) {
		for (const file of files) {
			const id = crypto.randomUUID();
			setUploads((u) => [...u, { id, name: file.name, pct: 0 }]);
			try {
				await uploadFile(client, slug, target, file, (pct) =>
					setUploads((u) => u.map((x) => (x.id === id ? { ...x, pct } : x))),
				);
			} catch (error) {
				toast.error(`Couldn't upload ${file.name}`, {
					desc: (error as Error).message,
				});
			} finally {
				setUploads((u) => u.filter((x) => x.id !== id));
			}
		}
		await client.refetchQueries({ include: refetch });
	}

	/** A label that opens the file picker; anything can be its body. */
	const picker = (
		body: ReactNode,
		className: string,
		style?: CSSProperties,
	) => (
		<label className={className} style={{ cursor: "pointer", ...style }}>
			{body}
			<input
				type="file"
				multiple
				hidden
				onChange={(e) => e.target.files && upload(e.target.files)}
			/>
		</label>
	);

	return { uploads, upload, picker };
}
