ALTER TABLE "app_channel_members" DROP CONSTRAINT "app_channel_members_channel_id_app_channel_id_fkey";--> statement-breakpoint
ALTER TABLE "app_message" DROP CONSTRAINT "app_message_channel_id_app_channel_id_fkey";--> statement-breakpoint
ALTER TABLE "app_message_receipt" DROP CONSTRAINT "app_message_receipt_message_id_app_message_id_fkey";--> statement-breakpoint
ALTER TABLE "app_message_reference" DROP CONSTRAINT "app_message_reference_message_id_app_message_id_fkey";--> statement-breakpoint
ALTER TABLE "app_direct_message" DROP CONSTRAINT "app_direct_message_conversation_id_app_conversation_id_fkey";--> statement-breakpoint
ALTER TABLE "app_direct_message_receipt" DROP CONSTRAINT "app_direct_message_receipt_Hg5ChsgZATC8_fkey";--> statement-breakpoint
DROP TABLE "app_channel";--> statement-breakpoint
DROP TABLE "app_channel_members";--> statement-breakpoint
DROP TABLE "app_message";--> statement-breakpoint
DROP TABLE "app_message_receipt";--> statement-breakpoint
DROP TABLE "app_message_reference";--> statement-breakpoint
DROP TABLE "app_conversation";--> statement-breakpoint
DROP TABLE "app_direct_message";--> statement-breakpoint
DROP TABLE "app_direct_message_receipt";--> statement-breakpoint
DROP TABLE "app_feedback";--> statement-breakpoint
DROP TYPE "channel_type";