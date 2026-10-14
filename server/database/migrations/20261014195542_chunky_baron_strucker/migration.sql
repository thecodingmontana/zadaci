DROP POLICY "allow_anon_select_message_reference" ON "app_message_reference";--> statement-breakpoint
DROP POLICY "allow_anon_select_comment" ON "app_comment";--> statement-breakpoint
DROP POLICY "allow_anon_select_conversation" ON "app_conversation";--> statement-breakpoint
DROP POLICY "allow_anon_select_dm_receipt" ON "app_direct_message_receipt";--> statement-breakpoint
DROP POLICY "allow_anon_select_note" ON "app_note";--> statement-breakpoint
DROP POLICY "allow_anon_select_user" ON "app_user";--> statement-breakpoint
ALTER TABLE "app_oauth_account" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "app_passkeys" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "app_password_reset_session" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "app_session" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "app_totp_credential" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "app_unique_code_request" ENABLE ROW LEVEL SECURITY;