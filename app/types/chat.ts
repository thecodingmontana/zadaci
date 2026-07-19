export interface ChannelMember {
  id: string;
  name: string;
  avatar: string;
  email: string;
  role?: "admin" | "member";
  online?: boolean;
}

export interface MessageAttachment {
  id: string;
  type: "sheet" | "doc" | "meeting";
  title: string;
  meta: string;
  icon: string;
  action?: "join" | "preview";
}

export interface MessageReaction {
  emoji: string;
  member_ids: string[];
}

export type MessageStatus = "sent" | "delivered" | "seen";

export interface ChatMessage {
  id: string;
  channelId: string;
  authorId: string;
  content: string;
  createdAt: string;
  editedAt: string | null;
  reactions: MessageReaction[];
  parentMessageId: string | null;
  threadReplyCount: number;
  threadParticipantIds: string[];
  threadLastReplyAt: string | null;
  deletedAt: string | null;
  attachment?: MessageAttachment;
}

export interface SystemEvent {
  id: string;
  type: "huddle-ended";
  createdAt: string;
  duration: string;
  participantIds: string[];
}

export interface Thread {
  id: string;
  parentMessageId: string;
  parentMessage: ChatMessage;
  replies: ChatMessage[];
}
