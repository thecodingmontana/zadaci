import { GraphQLError } from "graphql";
import { badInput, type GraphQLContext, requireUser } from "./schema.server";

// Unsplash photos for covers and note images. Searches go through the server so the access
// key stays private; picking a photo pings Unsplash's download link, as their API asks.

export const unsplashTypeDefs = /* GraphQL */ `
	type UnsplashPhoto {
		id: ID!
		"small preview for the picker"
		thumb: String!
		"the size to use as a cover or image"
		url: String!
		alt: String
		author: String!
		authorUrl: String!
		"ping this when the photo is used (Unsplash's attribution rules)"
		downloadLocation: String!
	}

	type UnsplashResults {
		photos: [UnsplashPhoto!]!
		totalPages: Int!
	}

	extend type Query {
		"photos for a search, or popular ones when the search is empty"
		unsplash(query: String, page: Int): UnsplashResults!
		"whether the server has an Unsplash key (the picker hides the tab otherwise)"
		unsplashEnabled: Boolean!
	}

	extend type Mutation {
		"tells Unsplash a photo was used"
		unsplashPicked(downloadLocation: String!): Boolean!
	}
`;

const API = "https://api.unsplash.com";
// Unsplash asks apps to tag attribution links with these
const UTM = "utm_source=zadaci&utm_medium=referral";

type Photo = {
	id: string;
	alt_description: string | null;
	urls: { small: string; regular: string };
	user: { name: string; links: { html: string } };
	links: { download_location: string };
};

function accessKey() {
	const key = process.env.UNSPLASH_ACCESS_KEY;
	if (!key)
		throw new GraphQLError("Unsplash isn't set up yet", {
			extensions: { code: "UNSPLASH_OFF" },
		});
	return key;
}

async function unsplash<T>(path: string) {
	const res = await fetch(`${API}${path}`, {
		headers: {
			Authorization: `Client-ID ${accessKey()}`,
			"Accept-Version": "v1",
		},
	});
	if (res.status === 403)
		throw new GraphQLError(
			"Unsplash's hourly limit is reached; try again soon",
		);
	if (!res.ok) throw new GraphQLError("Couldn't reach Unsplash");
	return (await res.json()) as T;
}

const shape = (p: Photo) => ({
	id: p.id,
	thumb: p.urls.small,
	url: p.urls.regular,
	alt: p.alt_description,
	author: p.user.name,
	authorUrl: `${p.user.links.html}?${UTM}`,
	downloadLocation: p.links.download_location,
});

export const unsplashResolvers = {
	Query: {
		unsplashEnabled: (_: unknown, __: unknown, ctx: GraphQLContext) => {
			requireUser(ctx);
			return !!process.env.UNSPLASH_ACCESS_KEY;
		},
		unsplash: async (
			_: unknown,
			args: { query?: string | null; page?: number | null },
			ctx: GraphQLContext,
		) => {
			requireUser(ctx);
			const query = (args.query ?? "").trim().slice(0, 100);
			const page = Math.min(50, Math.max(1, args.page ?? 1));
			if (!query) {
				const photos = await unsplash<Photo[]>(
					`/photos?per_page=24&page=${page}&order_by=popular`,
				);
				return { photos: photos.map(shape), totalPages: 50 };
			}
			const found = await unsplash<{ results: Photo[]; total_pages: number }>(
				`/search/photos?per_page=24&page=${page}&orientation=landscape&query=${encodeURIComponent(query)}`,
			);
			return {
				photos: found.results.map(shape),
				totalPages: found.total_pages,
			};
		},
	},
	Mutation: {
		unsplashPicked: async (
			_: unknown,
			args: { downloadLocation: string },
			ctx: GraphQLContext,
		) => {
			requireUser(ctx);
			let url: URL;
			try {
				url = new URL(args.downloadLocation);
			} catch {
				badInput("Not an Unsplash download link");
			}
			// only ever call Unsplash's own API with our key
			if (url.origin !== API || !url.pathname.startsWith("/photos/"))
				badInput("Not an Unsplash download link");
			await unsplash(`${url.pathname}${url.search}`);
			return true;
		},
	},
};
