import { gql, type TypedDocumentNode } from "@apollo/client";

// Bookmarks and their collections. Kept apart from operations.ts, which is already long.

export type BookmarkKind = "article" | "document" | "video";

export type BookmarkItem = {
	id: string;
	url: string;
	title: string;
	description: string | null;
	image: string | null;
	site: string | null;
	kind: BookmarkKind;
	tags: string[];
	collectionIds: string[];
	archivedAt: string | null;
	createdBy: string;
	createdAt: string;
	canEdit: boolean;
	canDelete: boolean;
	isFavorite: boolean;
	isPrivate: boolean;
	isAuthor: boolean;
};

export type BookmarkCollectionItem = {
	id: string;
	name: string;
	icon: string | null;
	isPrivate: boolean;
	projectId: string | null;
	sortOrder: number;
	count: number;
	canEdit: boolean;
	canDelete: boolean;
	isAuthor: boolean;
};

export type LinkPreview = {
	url: string;
	title: string;
	description: string | null;
	image: string | null;
	site: string | null;
	kind: BookmarkKind;
};

export type BookmarkInput = {
	url: string;
	title?: string;
	description?: string | null;
	image?: string | null;
	kind?: BookmarkKind;
	tags?: string[];
	isPrivate?: boolean;
};

const BOOKMARK_FIELDS = gql`
	fragment BookmarkFields on Bookmark {
		id
		url
		title
		description
		image
		site
		kind
		tags
		collectionIds
		archivedAt
		createdBy
		createdAt
		canEdit
		canDelete
		isFavorite
		isPrivate
		isAuthor
	}
`;

const COLLECTION_FIELDS = gql`
	fragment BookmarkCollectionFields on BookmarkCollection {
		id
		name
		icon
		isPrivate
		projectId
		sortOrder
		count
		canEdit
		canDelete
		isAuthor
	}
`;

export const BOOKMARKS: TypedDocumentNode<
	{ bookmarks: BookmarkItem[] },
	{ slug: string }
> = gql`
	${BOOKMARK_FIELDS}
	query Bookmarks($slug: String!) {
		bookmarks(slug: $slug) {
			...BookmarkFields
		}
	}
`;

export const BOOKMARK_COLLECTIONS: TypedDocumentNode<
	{ bookmarkCollections: BookmarkCollectionItem[] },
	{ slug: string }
> = gql`
	${COLLECTION_FIELDS}
	query BookmarkCollections($slug: String!) {
		bookmarkCollections(slug: $slug) {
			...BookmarkCollectionFields
		}
	}
`;

export const LINK_PREVIEW: TypedDocumentNode<
	{ linkPreview: LinkPreview },
	{ slug: string; url: string }
> = gql`
	query LinkPreview($slug: String!, $url: String!) {
		linkPreview(slug: $slug, url: $url) {
			url
			title
			description
			image
			site
			kind
		}
	}
`;

export const CREATE_BOOKMARK: TypedDocumentNode<
	{ createBookmark: BookmarkItem },
	{ slug: string; input: BookmarkInput & { collectionIds?: string[] } }
> = gql`
	${BOOKMARK_FIELDS}
	mutation CreateBookmark($slug: String!, $input: NewBookmark!) {
		createBookmark(slug: $slug, input: $input) {
			...BookmarkFields
		}
	}
`;

export const UPDATE_BOOKMARK: TypedDocumentNode<
	{ updateBookmark: BookmarkItem },
	{
		slug: string;
		id: string;
		patch: Partial<BookmarkInput> & { collectionIds?: string[] };
	}
> = gql`
	${BOOKMARK_FIELDS}
	mutation UpdateBookmark($slug: String!, $id: ID!, $patch: BookmarkPatch!) {
		updateBookmark(slug: $slug, id: $id, patch: $patch) {
			...BookmarkFields
		}
	}
`;

export const MOVE_BOOKMARK: TypedDocumentNode<
	{ moveBookmark: BookmarkItem },
	{ slug: string; id: string; collectionIds: string[] }
> = gql`
	${BOOKMARK_FIELDS}
	mutation MoveBookmark($slug: String!, $id: ID!, $collectionIds: [ID!]!) {
		moveBookmark(slug: $slug, id: $id, collectionIds: $collectionIds) {
			...BookmarkFields
		}
	}
`;

export const ARCHIVE_BOOKMARK: TypedDocumentNode<
	{ archiveBookmark: BookmarkItem },
	{ slug: string; id: string; archived: boolean }
> = gql`
	${BOOKMARK_FIELDS}
	mutation ArchiveBookmark($slug: String!, $id: ID!, $archived: Boolean!) {
		archiveBookmark(slug: $slug, id: $id, archived: $archived) {
			...BookmarkFields
		}
	}
`;

export const DELETE_BOOKMARK: TypedDocumentNode<
	{ deleteBookmark: boolean },
	{ slug: string; id: string }
> = gql`
	mutation DeleteBookmark($slug: String!, $id: ID!) {
		deleteBookmark(slug: $slug, id: $id)
	}
`;

export const TOGGLE_BOOKMARK_FAVORITE: TypedDocumentNode<
	{ toggleBookmarkFavorite: boolean },
	{ slug: string; id: string }
> = gql`
	mutation ToggleBookmarkFavorite($slug: String!, $id: ID!) {
		toggleBookmarkFavorite(slug: $slug, id: $id)
	}
`;

type CollectionInput = {
	name?: string;
	icon?: string | null;
	projectId?: string | null;
	isPrivate?: boolean;
};

export const CREATE_BOOKMARK_COLLECTION: TypedDocumentNode<
	{ createBookmarkCollection: BookmarkCollectionItem },
	{ slug: string; input: CollectionInput & { name: string } }
> = gql`
	${COLLECTION_FIELDS}
	mutation CreateBookmarkCollection(
		$slug: String!
		$input: NewBookmarkCollection!
	) {
		createBookmarkCollection(slug: $slug, input: $input) {
			...BookmarkCollectionFields
		}
	}
`;

export const UPDATE_BOOKMARK_COLLECTION: TypedDocumentNode<
	{ updateBookmarkCollection: BookmarkCollectionItem },
	{ slug: string; id: string; patch: CollectionInput }
> = gql`
	${COLLECTION_FIELDS}
	mutation UpdateBookmarkCollection(
		$slug: String!
		$id: ID!
		$patch: BookmarkCollectionPatch!
	) {
		updateBookmarkCollection(slug: $slug, id: $id, patch: $patch) {
			...BookmarkCollectionFields
		}
	}
`;

export const DELETE_BOOKMARK_COLLECTION: TypedDocumentNode<
	{ deleteBookmarkCollection: boolean },
	{ slug: string; id: string }
> = gql`
	mutation DeleteBookmarkCollection($slug: String!, $id: ID!) {
		deleteBookmarkCollection(slug: $slug, id: $id)
	}
`;
