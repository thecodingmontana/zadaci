import type { ApolloClient } from "@apollo/client";
import { ADD_ATTACHMENT, ATTACHMENT_UPLOAD } from "#/graphql/operations";

// Uploads one file straight to Cloudinary with a signed request, then records it on the task.

export const MAX_UPLOAD = 25 * 1024 * 1024;

export async function uploadToTask(
	client: ApolloClient,
	slug: string,
	taskId: string,
	file: File,
	onProgress?: (pct: number) => void,
) {
	if (file.size > MAX_UPLOAD) throw new Error(`${file.name} is over 25 MB`);
	const { data } = await client.mutate({
		mutation: ATTACHMENT_UPLOAD,
		variables: { slug, taskId },
	});
	const params = data?.attachmentUpload;
	if (!params) throw new Error("No upload slot");
	const body = new FormData();
	body.append("file", file);
	body.append("api_key", params.apiKey);
	body.append("timestamp", String(params.timestamp));
	body.append("signature", params.signature);
	body.append("public_id", params.publicId);
	body.append("folder", params.folder);
	const result = await new Promise<{ secure_url: string; bytes: number }>(
		(resolve, reject) => {
			const xhr = new XMLHttpRequest();
			xhr.open("POST", params.url);
			xhr.upload.onprogress = (e) =>
				e.lengthComputable &&
				onProgress?.(Math.round((e.loaded / e.total) * 100));
			xhr.onload = () =>
				xhr.status < 300
					? resolve(JSON.parse(xhr.responseText))
					: reject(new Error("Upload failed"));
			xhr.onerror = () => reject(new Error("Upload failed"));
			xhr.send(body);
		},
	);
	await client.mutate({
		mutation: ADD_ATTACHMENT,
		variables: {
			slug,
			taskId,
			name: file.name,
			url: result.secure_url,
			mime: file.type || null,
			size: result.bytes,
		},
	});
}
