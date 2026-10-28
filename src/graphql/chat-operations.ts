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
	general: boolean;
	creator: ChatPerson | null;
	createdAt: string;
	link: { kind: "project" | "task"; id: string; title: string } | null;
	teamId: string | null;
	favorite: boolean;
};
export type ChatAttachment = {
	url: string;
	name: string;
	size: number;
	type: string;
	seconds: number | null;
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
	parentId: string | null;
	replyCount: number;
	lastReplyAt: string | null;
	pinned: boolean;
	attachments: ChatAttachment[];
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
		general
		creator {
			id
			name
			image
		}
		createdAt
		link {
			kind
			id
			title
		}
		teamId
		favorite
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
		parentId
		replyCount
		lastReplyAt
		pinned
		attachments {
			url
			name
			size
			type
			seconds
		}
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
	{ slug: string; channelId: string; before?: string; parentId?: string }
> = gql`
	query ChatMessages(
		$slug: String!
		$channelId: ID!
		$before: String
		$parentId: ID
	) {
		chatMessages(
			slug: $slug
			channelId: $channelId
			before: $before
			parentId: $parentId
		) {
			...ChatMessageFields
		}
	}
	${MESSAGE}
`;

export const CREATE_CHAT_CHANNEL: TypedDocumentNode<
	{ createChatChannel: ChatChannel },
	{
		slug: string;
		name: string;
		topic?: string;
		private?: boolean;
		memberIds?: string[];
		projectId?: string;
		taskId?: string;
	}
> = gql`
	mutation CreateChatChannel(
		$slug: String!
		$name: String!
		$topic: String
		$private: Boolean
		$memberIds: [ID!]
		$projectId: ID
		$taskId: ID
	) {
		createChatChannel(
			slug: $slug
			name: $name
			topic: $topic
			private: $private
			memberIds: $memberIds
			projectId: $projectId
			taskId: $taskId
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
	{
		slug: string;
		channelId: string;
		body: string;
		parentId?: string;
		attachments?: Omit<ChatAttachment, "seconds">[] & { seconds?: number }[];
	}
> = gql`
	mutation SendChatMessage(
		$slug: String!
		$channelId: ID!
		$body: String!
		$parentId: ID
		$attachments: [ChatAttachmentInput!]
	) {
		sendChatMessage(
			slug: $slug
			channelId: $channelId
			body: $body
			parentId: $parentId
			attachments: $attachments
		) {
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

export const CHAT_PINS: TypedDocumentNode<
	{ chatPins: ChatMessage[] },
	{ slug: string; channelId: string }
> = gql`
	query ChatPins($slug: String!, $channelId: ID!) {
		chatPins(slug: $slug, channelId: $channelId) {
			...ChatMessageFields
		}
	}
	${MESSAGE}
`;

export const PIN_CHAT_MESSAGE: TypedDocumentNode<
	{ pinChatMessage: ChatMessage },
	{ slug: string; id: string; pinned: boolean }
> = gql`
	mutation PinChatMessage($slug: String!, $id: ID!, $pinned: Boolean!) {
		pinChatMessage(slug: $slug, id: $id, pinned: $pinned) {
			...ChatMessageFields
		}
	}
	${MESSAGE}
`;

export const FAVORITE_CHAT_CHANNEL: TypedDocumentNode<
	{ favoriteChatChannel: boolean },
	{ slug: string; channelId: string; favorite: boolean }
> = gql`
	mutation FavoriteChatChannel(
		$slug: String!
		$channelId: ID!
		$favorite: Boolean!
	) {
		favoriteChatChannel(slug: $slug, channelId: $channelId, favorite: $favorite)
	}
`;

/** What a channel can be about: the projects and tasks you can see (names only). */
export const CHAT_LINK_OPTIONS: TypedDocumentNode<
	{
		workspace: {
			id: string;
			projects: { id: string; title: string }[];
			tasks: { id: string; name: string; projectId: string }[];
		} | null;
	},
	{ slug: string }
> = gql`
	query ChatLinkOptions($slug: String!) {
		workspace(slug: $slug) {
			id
			projects {
				id
				title
			}
			tasks {
				id
				name
				projectId
			}
		}
	}
`;

export const CHAT_UPLOAD: TypedDocumentNode<
	{
		chatUpload: {
			url: string;
			apiKey: string;
			timestamp: number;
			signature: string;
			publicId: string;
			folder: string;
		};
	},
	{ slug: string; channelId: string; file?: boolean }
> = gql`
	mutation ChatUpload($slug: String!, $channelId: ID!, $file: Boolean) {
		chatUpload(slug: $slug, channelId: $channelId, file: $file) {
			url
			apiKey
			timestamp
			signature
			publicId
			folder
		}
	}
`;
