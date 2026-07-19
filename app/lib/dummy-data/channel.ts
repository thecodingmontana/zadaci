// ~/lib/dummy-data/channel.ts
import type { ChannelMember, ChatMessage, SystemEvent, Thread } from "~/types/chat";

export const dummyMembers: ChannelMember[] = [
  {
    id: "m1",
    name: "Emily R.",
    avatar: "https://i.pravatar.cc/150?u=emily",
    email: "emily.r@gmail.com",
    role: "admin",
    online: true,
  },
  {
    id: "m2",
    name: "Bima A.",
    avatar: "https://i.pravatar.cc/150?u=bima",
    email: "bimaanggoro@gmail.com",
    online: true,
  },
  {
    id: "m3",
    name: "Anita P.",
    avatar: "https://i.pravatar.cc/150?u=anita",
    email: "anitaputeri@gmail.com",
    online: false,
  },
  {
    id: "m4",
    name: "Antonius D.",
    avatar: "https://i.pravatar.cc/150?u=antonius",
    email: "antonius.d@gmail.com",
    online: true,
  },
  {
    id: "m5",
    name: "Rizky",
    avatar: "https://i.pravatar.cc/150?u=rizky",
    email: "rizky@gmail.com",
    online: false,
  },
  {
    id: "m6",
    name: "Sari",
    avatar: "https://i.pravatar.cc/150?u=sari",
    email: "sari@gmail.com",
    online: false,
  },
  {
    id: "me",
    name: "You",
    avatar: "https://i.pravatar.cc/150?u=you",
    email: "you@gmail.com",
    online: true,
  },
];

export const currentUserId = "me";

export const dummySystemEvents: SystemEvent[] = [
  {
    id: "sys1",
    type: "huddle-ended",
    createdAt: "2026-07-19T09:02:00",
    duration: "23m 14s",
    participantIds: ["m5", "m3", "m2", "m6"],
  },
];

export const dummyThreads: Thread[] = [
  {
    id: "th1",
    parentMessageId: "msg2",
    parentMessage: {
      id: "msg2",
      authorId: "m2",
      content:
        'Here\'s the latest performance dashboard for the "Spring Campaign". Please review and share your feedback 🙏',
      createdAt: "2026-07-19T09:10:00",
      attachment: {
        id: "att1",
        type: "sheet",
        title: "Spring Campaign – Performance Dashboard",
        meta: "Google Sheets · Updated just now",
        icon: "lucide:table",
      },
      reactions: [{ emoji: "🔥", count: 4 }],
      thread: { count: 3, participantIds: ["m3", "m4", "m5"] },
    },
    replies: [
      {
        id: "r1",
        authorId: "m3",
        content: "CTR on the carousel set is way above benchmark, nice work.",
        createdAt: "2026-07-19T09:12:00",
      },
      {
        id: "r2",
        authorId: "m4",
        content: "Agreed — can we push more budget there this week?",
        createdAt: "2026-07-19T09:14:00",
      },
      {
        id: "r3",
        authorId: "m2",
        content: "Yep, reallocating from the static set now.",
        createdAt: "2026-07-19T09:16:00",
        status: "read",
      },
    ],
  },
];

export const dummyMessages: ChatMessage[] = [
  {
    id: "msg1",
    authorId: "m1",
    content:
      "Good morning team! 👋 Just a quick reminder to prepare the campaign updates for tomorrow's review. Let's make it impactful and data-driven! 💪",
    createdAt: "2026-07-18T09:15:00",
    attachment: {
      id: "att0",
      type: "meeting",
      title: "Weekly Marketing Sync",
      meta: "May 24 · 10:00 AM – 11:00 AM",
      icon: "lucide:video",
      action: "join",
    },
    reactions: [{ emoji: "👍", count: 6 }],
  },
  {
    id: "msg2",
    authorId: "m2",
    content:
      'Here\'s the latest performance dashboard for the "Spring Campaign". Please review and share your feedback 🙏',
    createdAt: "2026-07-19T09:10:00",
    attachment: {
      id: "att1",
      type: "sheet",
      title: "Spring Campaign – Performance Dashboard",
      meta: "Google Sheets · Updated just now",
      icon: "lucide:table",
    },
    reactions: [{ emoji: "🔥", count: 4 }],
    thread: { count: 3, participantIds: ["m3", "m4", "m5"] },
  },
  {
    id: "msg3",
    authorId: "m3",
    content:
      "I've outlined the key messaging and variations for our Instagram ad sets. Let me know what you think!",
    createdAt: "2026-07-19T09:18:00",
    attachment: {
      id: "att2",
      type: "doc",
      title: "IG Ad Copy – Variations v1",
      meta: "Google Docs · Updated 5m ago",
      icon: "lucide:file-text",
    },
    reactions: [
      { emoji: "❤️", count: 3 },
      { emoji: "⚡", count: 2 },
    ],
  },
  {
    id: "msg4",
    authorId: "m4",
    content: "Thanks all! I'll consolidate the feedback and update the timeline by EOD.",
    createdAt: "2026-07-19T09:28:00",
    reactions: [{ emoji: "💜", count: 2 }],
  },
  {
    id: "msg5",
    authorId: "me",
    content: "Sounds good — I'll get the revised copy over to you by 3pm.",
    createdAt: "2026-07-19T09:31:00",
    status: "read",
  },
  {
    id: "msg6",
    authorId: "me",
    content: "Also looping in design for the carousel assets.",
    createdAt: "2026-07-19T09:31:30",
    status: "delivered",
  },
  {
    id: "msg7",
    authorId: "me",
    content: "One sec, sending the file now.",
    createdAt: "2026-07-19T09:32:00",
    status: "sent",
  },
];
