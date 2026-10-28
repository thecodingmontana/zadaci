import { gql, type TypedDocumentNode } from "@apollo/client";

// Team chat (graphql/chat.server.ts).

export type ChatPerson = { id: string; name: string; image: string | null };
export type ChatChannel = {
	id: string;
	kind: "channel" | "dm";
	name: string | null;
	topic: string | null;
	private: boolean;
	people: ChatPerson[];
	unread: number;
	lastMessageAt: string | null;
};
export type ChatMessage = {
	id: string;
	channelId: string;
	author: ChatPerson | null;
	body: string;
	reactions: { emoji: string; count: number; mine: boolean; names: string[] }[];
	editedAt: string | null;
	mine: boolean;
	createdAt: string;
};

const CHANNEL = gql`
	fragment ChatChannelFields on ChatChannel {
		id
		kind
		name
		topic
		private
		people {
			id
			name
			image
		}
		unread
		lastMessageAt
	}
`;
const MESSAGE = gql`
	fragment ChatMessageFields on ChatMessage {
		id
		channelId
		author {
			id
			name
			image
		}
		body
		reactions {
			emoji
			count
			mine
			names
		}
		editedAt
		mine
		createdAt
	}
`;

export const CHAT_CHANNELS: TypedDocumentNode<
	{ workspace: { id: string; chatChannels: ChatChannel[] } | null },
	{ slug: string }
> = gql`
	query ChatChannels($slug: String!) {
		workspace(slug: $slug) {
			id
			chatChannels {
				...ChatChannelFields
			}
		}
	}
	${CHANNEL}
`;

export const CHAT_MESSAGES: TypedDocumentNode<
	{ chatMessages: ChatMessage[] },
	{ slug: string; channelId: string; before?: string }
> = gql`
	query ChatMessages($slug: String!, $channelId: ID!, $before: String) {
		chatMessages(slug: $slug, channelId: $channelId, before: $before) {
			...ChatMessageFields
		}
	}
	${MESSAGE}
`;

export const CREATE_CHAT_CHANNEL: TypedDocumentNode<
	{ createChatChannel: ChatChannel },
	{ slug: string; name: string; private?: boolean; memberIds?: string[] }
> = gql`
	mutation CreateChatChannel(
		$slug: String!
		$name: String!
		$private: Boolean
		$memberIds: [ID!]
	) {
		createChatChannel(
			slug: $slug
			name: $name
			private: $private
			memberIds: $memberIds
		) {
			...ChatChannelFields
		}
	}
	${CHANNEL}
`;

export const OPEN_CHAT_DM: TypedDocumentNode<
	{ openChatDm: ChatChannel },
	{ slug: string; memberIds: string[] }
> = gql`
	mutation OpenChatDm($slug: String!, $memberIds: [ID!]!) {
		openChatDm(slug: $slug, memberIds: $memberIds) {
			...ChatChannelFields
		}
	}
	${CHANNEL}
`;

export const SEND_CHAT_MESSAGE: TypedDocumentNode<
	{ sendChatMessage: ChatMessage },
	{ slug: string; channelId: string; body: string }
> = gql`
	mutation SendChatMessage($slug: String!, $channelId: ID!, $body: String!) {
		sendChatMessage(slug: $slug, channelId: $channelId, body: $body) {
			...ChatMessageFields
		}
	}
	${MESSAGE}
`;

export const EDIT_CHAT_MESSAGE: TypedDocumentNode<
	{ editChatMessage: ChatMessage },
	{ slug: string; id: string; body: string }
> = gql`
	mutation EditChatMessage($slug: String!, $id: ID!, $body: String!) {
		editChatMessage(slug: $slug, id: $id, body: $body) {
			...ChatMessageFields
		}
	}
	${MESSAGE}
`;

export const DELETE_CHAT_MESSAGE: TypedDocumentNode<
	{ deleteChatMessage: boolean },
	{ slug: string; id: string }
> = gql`
	mutation DeleteChatMessage($slug: String!, $id: ID!) {
		deleteChatMessage(slug: $slug, id: $id)
	}
`;

export const REACT_TO_CHAT_MESSAGE: TypedDocumentNode<
	{ reactToChatMessage: ChatMessage },
	{ slug: string; id: string; emoji: string }
> = gql`
	mutation ReactToChatMessage($slug: String!, $id: ID!, $emoji: String!) {
		reactToChatMessage(slug: $slug, id: $id, emoji: $emoji) {
			...ChatMessageFields
		}
	}
	${MESSAGE}
`;

export const MARK_CHAT_READ: TypedDocumentNode<
	{ markChatRead: boolean },
	{ slug: string; channelId: string }
> = gql`
	mutation MarkChatRead($slug: String!, $channelId: ID!) {
		markChatRead(slug: $slug, channelId: $channelId)
	}
`;
