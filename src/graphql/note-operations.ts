import { gql, type TypedDocumentNode } from "@apollo/client";
import type { TaskComment } from "./operations";

// Notes (Notion-style pages). Kept apart from operations.ts, which is already long.

export type NoteItem = {
	id: string;
	parentId: string | null;
	sortOrder: number;
	icon: string | null;
	cover: string | null;
	coverY: number;
	title: string;
	projectId: string | null;
	excerpt: string;
	createdBy: string;
	updatedBy: string | null;
	createdAt: string;
	updatedAt: string;
	canEdit: boolean;
	canDelete: boolean;
	isPrivate: boolean;
	isFavorite: boolean;
	isAuthor: boolean;
};

export type NoteComment = TaskComment & {
	quote: string | null;
	parentId: string | null;
	resolved: boolean;
};

export type NoteDetail = NoteItem & { doc: unknown; comments: NoteComment[] };

export const NOTE_FIELDS = gql`
	fragment NoteFields on Note {
		id
		parentId
		sortOrder
		icon
		cover
		coverY
		title
		projectId
		excerpt
		createdBy
		updatedBy
		createdAt
		updatedAt
		canEdit
		canDelete
		isPrivate
		isFavorite
		isAuthor
	}
`;

export const NOTES: TypedDocumentNode<{ notes: NoteItem[] }, { slug: string }> =
	gql`
		${NOTE_FIELDS}
		query Notes($slug: String!) {
			notes(slug: $slug) {
				...NoteFields
			}
		}
	`;

export const NOTE: TypedDocumentNode<
	{ note: NoteDetail | null },
	{ slug: string; id: string }
> = gql`
	${NOTE_FIELDS}
	query Note($slug: String!, $id: ID!) {
		note(slug: $slug, id: $id) {
			...NoteFields
			doc
			comments {
				id
				text
				createdAt
				author {
					id
					name
					image
				}
				authorMemberId
				isMine
				reactions {
					emoji
					count
					mine
					names
				}
				quote
				parentId
				resolved
			}
		}
	}
`;

export const CREATE_NOTE: TypedDocumentNode<
	{ createNote: NoteItem },
	{
		slug: string;
		input: { parentId?: string | null; title?: string; icon?: string | null };
	}
> = gql`
	${NOTE_FIELDS}
	mutation CreateNote($slug: String!, $input: NewNote!) {
		createNote(slug: $slug, input: $input) {
			...NoteFields
		}
	}
`;

export const UPDATE_NOTE: TypedDocumentNode<
	{ updateNote: NoteItem },
	{
		slug: string;
		id: string;
		patch: {
			title?: string;
			icon?: string | null;
			doc?: unknown;
			isPrivate?: boolean;
			cover?: string | null;
			coverY?: number;
		};
		baseUpdatedAt?: string | null;
	}
> = gql`
	${NOTE_FIELDS}
	mutation UpdateNote(
		$slug: String!
		$id: ID!
		$patch: NotePatch!
		$baseUpdatedAt: String
	) {
		updateNote(
			slug: $slug
			id: $id
			patch: $patch
			baseUpdatedAt: $baseUpdatedAt
		) {
			...NoteFields
		}
	}
`;

export const MOVE_NOTE: TypedDocumentNode<
	{ moveNote: NoteItem },
	{ slug: string; id: string; parentId: string | null; sortOrder: number }
> = gql`
	${NOTE_FIELDS}
	mutation MoveNote(
		$slug: String!
		$id: ID!
		$parentId: ID
		$sortOrder: Float!
	) {
		moveNote(slug: $slug, id: $id, parentId: $parentId, sortOrder: $sortOrder) {
			...NoteFields
		}
	}
`;

export const DUPLICATE_NOTE: TypedDocumentNode<
	{ duplicateNote: NoteItem },
	{ slug: string; id: string }
> = gql`
	${NOTE_FIELDS}
	mutation DuplicateNote($slug: String!, $id: ID!) {
		duplicateNote(slug: $slug, id: $id) {
			...NoteFields
		}
	}
`;

export const DELETE_NOTE: TypedDocumentNode<
	{ deleteNote: boolean },
	{ slug: string; id: string }
> = gql`
	mutation DeleteNote($slug: String!, $id: ID!) {
		deleteNote(slug: $slug, id: $id)
	}
`;

export const TOGGLE_NOTE_FAVORITE: TypedDocumentNode<
	{ toggleNoteFavorite: boolean },
	{ slug: string; id: string }
> = gql`
	mutation ToggleNoteFavorite($slug: String!, $id: ID!) {
		toggleNoteFavorite(slug: $slug, id: $id)
	}
`;

export const NOTE_COVER_UPLOAD: TypedDocumentNode<
	{
		noteCoverUpload: {
			url: string;
			apiKey: string;
			timestamp: number;
			signature: string;
			publicId: string;
			folder: string;
		};
	},
	{ slug: string; id: string }
> = gql`
	mutation NoteCoverUpload($slug: String!, $id: ID!) {
		noteCoverUpload(slug: $slug, id: $id) {
			url
			apiKey
			timestamp
			signature
			publicId
			folder
		}
	}
`;

export type UnsplashPhoto = {
	id: string;
	thumb: string;
	url: string;
	alt: string | null;
	author: string;
	authorUrl: string;
	downloadLocation: string;
};

export const UNSPLASH: TypedDocumentNode<
	{ unsplash: { photos: UnsplashPhoto[]; totalPages: number } },
	{ query?: string; page?: number }
> = gql`
	query Unsplash($query: String, $page: Int) {
		unsplash(query: $query, page: $page) {
			photos {
				id
				thumb
				url
				alt
				author
				authorUrl
				downloadLocation
			}
			totalPages
		}
	}
`;

export const UNSPLASH_PICKED: TypedDocumentNode<
	{ unsplashPicked: boolean },
	{ downloadLocation: string }
> = gql`
	mutation UnsplashPicked($downloadLocation: String!) {
		unsplashPicked(downloadLocation: $downloadLocation)
	}
`;

export const UNSPLASH_ENABLED: TypedDocumentNode<
	{ unsplashEnabled: boolean },
	Record<string, never>
> = gql`
	query UnsplashEnabled {
		unsplashEnabled
	}
`;
