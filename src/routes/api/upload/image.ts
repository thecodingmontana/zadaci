import { createFileRoute } from "@tanstack/react-router";
import sharp from "sharp";
import {
	cloudinary,
	requireWorkspace,
	signCloudinary,
} from "#/graphql/settings.server";
import { auth } from "#/lib/auth";

// Profile and workspace pictures: the image comes here first, sharp turns it into a small square
// WebP, and only that goes to Cloudinary, so pictures load fast and never store a 5 MB original.

const MAX_IMAGE = 5 * 1024 * 1024;
const SIZE = 512;

const fail = (status: number, error: string) =>
	Response.json({ error }, { status });

export const Route = createFileRoute("/api/upload/image")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				const session = await auth.api.getSession({ headers: request.headers });
				if (!session) return fail(401, "Sign in first");
				const form = await request.formData().catch(() => null);
				const file = form?.get("file");
				const kind = String(form?.get("kind") ?? "");
				if (!(file instanceof File)) return fail(400, "Choose an image");
				if (!file.type.startsWith("image/"))
					return fail(400, "That file isn't an image");
				if (file.size > MAX_IMAGE) return fail(400, "Images can be up to 5 MB");

				// where it goes: your own picture, or a workspace you're allowed to edit
				let folder = "zadaci/avatars";
				let publicId = session.user.id;
				if (kind === "workspace") {
					try {
						const { workspace } = await requireWorkspace(
							{ user: session.user },
							String(form?.get("slug") ?? ""),
							"workspaceSettings",
						);
						folder = "zadaci/workspaces";
						publicId = workspace.id;
					} catch {
						return fail(403, "You can't change this workspace's picture");
					}
				} else if (kind !== "avatar") return fail(400, "Unknown picture");

				let image: Buffer;
				try {
					image = await sharp(Buffer.from(await file.arrayBuffer()), {
						limitInputPixels: 40_000_000,
					})
						.rotate() // honour the photo's orientation
						.resize(SIZE, SIZE, { fit: "cover" })
						.webp({ quality: 82 })
						.toBuffer();
				} catch {
					return fail(400, "Couldn't read that image");
				}

				const { cloud, key, secret } = cloudinary();
				const params = {
					folder,
					public_id: publicId,
					overwrite: "true",
					invalidate: "true",
					timestamp: Math.floor(Date.now() / 1000),
				};
				const body = new FormData();
				body.set(
					"file",
					new Blob([new Uint8Array(image)], { type: "image/webp" }),
				);
				for (const [k, v] of Object.entries(params)) body.set(k, String(v));
				body.set("api_key", key);
				body.set("signature", signCloudinary(params, secret));
				const res = await fetch(
					`https://api.cloudinary.com/v1_1/${cloud}/image/upload`,
					{ method: "POST", body },
				);
				const out = (await res.json().catch(() => null)) as {
					secure_url?: string;
				} | null;
				if (!res.ok || !out?.secure_url) {
					console.error("[upload] cloudinary answered", res.status);
					return fail(502, "Couldn't save the image. Try again.");
				}
				return Response.json({ url: out.secure_url });
			},
		},
	},
});
