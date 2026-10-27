import type { ApolloClient } from "@apollo/client";
import { ADD_ATTACHMENT, ATTACHMENT_UPLOAD } from "#/graphql/operations";
import { maxUpload } from "#/lib/files";

export { maxUpload };

// Uploads one file straight to Cloudinary with a signed request, then records it on the
// task, or on the project when there is no task.

export async function uploadFile(
	client: ApolloClient,
	slug: string,
	target: { taskId?: string; projectId?: string },
	file: File,
	onProgress?: (pct: number) => void,
) {
	const max = maxUpload(file.type);
	if (file.size > max)
		throw new Error(
			`${file.name} is over ${max / 1024 / 1024} MB, the limit for this kind of file`,
		);
	const { data } = await client.mutate({
		mutation: ATTACHMENT_UPLOAD,
		variables: { slug, ...target },
	});
	const params = data?.attachmentUpload;
	if (!params) throw new Error("No upload slot");
	const result = await sendToCloudinary(params, file, onProgress);
	await client.mutate({
		mutation: ADD_ATTACHMENT,
		variables: {
			slug,
			...target,
			name: file.name,
			url: result.secure_url,
			mime: file.type || null,
			size: result.bytes,
		},
	});
}

export type UploadSlot = {
	url: string;
	apiKey: string;
	timestamp: number;
	signature: string;
	publicId: string;
	folder: string;
};

/** Sends a file to Cloudinary using a slot the server signed. */
export function sendToCloudinary(
	params: UploadSlot,
	file: File,
	onProgress?: (pct: number) => void,
) {
	const body = new FormData();
	body.append("file", file);
	body.append("api_key", params.apiKey);
	body.append("timestamp", String(params.timestamp));
	body.append("signature", params.signature);
	body.append("public_id", params.publicId);
	body.append("folder", params.folder);
	return new Promise<{ secure_url: string; bytes: number }>(
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
}
