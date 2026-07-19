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
  count: number;
  reacted?: boolean;
}

export type MessageStatus = "sent" | "delivered" | "read";

export interface ChatMessage {
  id: string;
  authorId: string;
  content: string;
  createdAt: string;
  status?: MessageStatus;
  attachment?: MessageAttachment;
  reactions?: MessageReaction[];
  thread?: { count: number; participantIds: string[] };
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
