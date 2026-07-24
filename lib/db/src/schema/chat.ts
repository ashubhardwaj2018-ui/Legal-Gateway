import { pgTable, text, serial, timestamp, integer, boolean, index } from "drizzle-orm/pg-core";

export const chatChannelsTable = pgTable("chat_channels", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  type: text("type").notNull().default("public"),
  description: text("description"),
  members: text("members"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const chatMessagesTable = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  channelId: integer("channel_id").notNull(),
  senderName: text("sender_name").notNull(),
  senderColor: text("sender_color").notNull().default("#0f2044"),
  content: text("content").notNull(),
  msgType: text("msg_type").notNull().default("text"),
  fileName: text("file_name"),
  fileUrl: text("file_url"),
  reactions: text("reactions").default("{}"),
  replyToId: integer("reply_to_id"),
  replyPreview: text("reply_preview"),
  isEdited: boolean("is_edited").default(false),
  isDeleted: boolean("is_deleted").default(false),
  isPinned: boolean("is_pinned").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  channelIdx: index("chat_messages_channel_idx").on(t.channelId),
  createdIdx: index("chat_messages_created_idx").on(t.createdAt),
}));

export const chatTypingTable = pgTable("chat_typing", {
  id: serial("id").primaryKey(),
  channelId: integer("channel_id").notNull(),
  memberName: text("member_name").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const messageReadsTable = pgTable("message_reads", {
  id: serial("id").primaryKey(),
  messageId: integer("message_id").notNull(),
  channelId: integer("channel_id").notNull(),
  readerName: text("reader_name").notNull(),
  readAt: timestamp("read_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  channelIdx: index("message_reads_channel_idx").on(t.channelId),
  msgIdx: index("message_reads_msg_idx").on(t.messageId),
}));

export const userPresenceTable = pgTable("user_presence", {
  id: serial("id").primaryKey(),
  userName: text("user_name").notNull().unique(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ChatChannel = typeof chatChannelsTable.$inferSelect;
export type ChatMessage = typeof chatMessagesTable.$inferSelect;
export type MessageRead = typeof messageReadsTable.$inferSelect;
export type UserPresence = typeof userPresenceTable.$inferSelect;
