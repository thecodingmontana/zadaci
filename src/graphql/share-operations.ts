import { gql, type TypedDocumentNode } from "@apollo/client";

// Public, read-only links to pages and project boards (graphql/share.server).

type Vars = { slug: string; kind: "note" | "project"; id: string };
export type ShareLink = { token: string; createdAt: string };
export type PublicShare = {
	kind: "note" | "project";
	title: string;
	icon: string | null;
	workspace: string;
	doc: unknown;
	tasks:
		| {
				key: string;
				name: string;
				status: string;
				priority: string;
				dueDate: string | null;
		  }[]
		| null;
};

export const SHARE_LINK: TypedDocumentNode<
	{ shareLink: ShareLink | null },
	Vars
> = gql`
	query ShareLink($slug: String!, $kind: String!, $id: ID!) {
		shareLink(slug: $slug, kind: $kind, id: $id) {
			token
			createdAt
		}
	}
`;

export const CREATE_SHARE_LINK: TypedDocumentNode<
	{ createShareLink: ShareLink },
	Vars
> = gql`
	mutation CreateShareLink($slug: String!, $kind: String!, $id: ID!) {
		createShareLink(slug: $slug, kind: $kind, id: $id) {
			token
			createdAt
		}
	}
`;

export const REVOKE_SHARE_LINK: TypedDocumentNode<
	{ revokeShareLink: boolean },
	Vars
> = gql`
	mutation RevokeShareLink($slug: String!, $kind: String!, $id: ID!) {
		revokeShareLink(slug: $slug, kind: $kind, id: $id)
	}
`;

export const PUBLIC_SHARE: TypedDocumentNode<
	{ publicShare: PublicShare | null },
	{ token: string }
> = gql`
	query PublicShare($token: String!) {
		publicShare(token: $token) {
			kind
			title
			icon
			workspace
			doc
			tasks {
				key
				name
				status
				priority
				dueDate
			}
		}
	}
`;
