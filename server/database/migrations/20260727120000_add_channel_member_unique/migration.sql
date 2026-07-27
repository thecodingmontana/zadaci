DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'app_channel_members_channel_member_unique'
  ) THEN
    DELETE FROM app_channel_members a
    USING app_channel_members b
    WHERE a.id > b.id
      AND a.channel_id = b.channel_id
      AND a.member_id = b.member_id;

    ALTER TABLE app_channel_members
    ADD CONSTRAINT app_channel_members_channel_member_unique
    UNIQUE (channel_id, member_id);
  END IF;
END $$;
