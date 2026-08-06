-- ============================================================
-- DM channel deduplication script
-- Run ONCE against your production database.
-- Safe: uses a transaction; rolls back on any error.
-- ============================================================

BEGIN;

-- 1. Normalise all DM channel types to "direct" and lowercase members
--    (catches channels created by the old POST /channels with type="dm")
UPDATE chat_channels
SET
  type    = 'direct',
  members = (
    SELECT json_agg(lower(elem::text) ORDER BY lower(elem::text))::text
    FROM   json_array_elements_text(members::json) AS elem
  )
WHERE type = 'dm' AND members IS NOT NULL;

-- 2. Delete completely broken DM rows that have no members at all
DELETE FROM chat_channels
WHERE (type = 'dm' OR type = 'direct') AND (members IS NULL OR members = '[]');

-- 3. For every duplicate DM pair, keep the oldest channel and
--    move all messages from the duplicates into it.

DO $$
DECLARE
  pair        RECORD;
  keeper_id   INT;
  dup         RECORD;
BEGIN
  -- Find all distinct member-pair combinations that have more than one channel
  FOR pair IN
    SELECT members, min(id) AS keep_id, array_agg(id ORDER BY id) AS all_ids
    FROM   chat_channels
    WHERE  type = 'direct' AND members IS NOT NULL
    GROUP  BY members
    HAVING count(*) > 1
  LOOP
    keeper_id := pair.keep_id;
    RAISE NOTICE 'Keeping channel id=% for members=%', keeper_id, pair.members;

    -- Move messages from every duplicate into the keeper
    FOR dup IN
      SELECT id FROM chat_channels
      WHERE  members = pair.members AND type = 'direct' AND id <> keeper_id
    LOOP
      RAISE NOTICE '  Moving messages from channel id=% → %', dup.id, keeper_id;
      UPDATE chat_messages SET channel_id = keeper_id WHERE channel_id = dup.id;
      DELETE FROM chat_channels WHERE id = dup.id;
    END LOOP;
  END LOOP;
END $$;

-- 4. Verify results
SELECT id, name, type, members,
       (SELECT count(*) FROM chat_messages WHERE channel_id = chat_channels.id) AS msg_count
FROM   chat_channels
WHERE  type = 'direct'
ORDER  BY id;

COMMIT;
