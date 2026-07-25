-- One-time cleanup for the temporary Marketplace QA listing and its private chat.
-- Narrow scope only: exact listing id and exact listing chat room.

WITH constants AS (
  SELECT
    'd752d4f5-d70c-455d-8ed4-2ae05d770049'::uuid AS listing_id,
    'listing:d752d4f5-d70c-455d-8ed4-2ae05d770049:buyer:47cc62e4-152f-4769-bbc5-815f4fbe26a9:host:28eeb513-a1fc-4ed9-8bb6-f5cfc6ff91b6'::text AS room_id
),
listing_files AS (
  SELECT l.image_url AS name
  FROM public.listings l
  JOIN constants c ON c.listing_id = l.id
  WHERE l.title ILIKE 'QA private chat test listing%'
    AND l.image_url IS NOT NULL
    AND l.image_url !~* '^https?://'

  UNION

  SELECT unnest(l.image_urls) AS name
  FROM public.listings l
  JOIN constants c ON c.listing_id = l.id
  WHERE l.title ILIKE 'QA private chat test listing%'
    AND l.image_urls IS NOT NULL
),
chat_files AS (
  SELECT
    CASE
      WHEN m.content ~ '^\s*\{' THEN m.content::jsonb->>'attachmentUrl'
      ELSE NULL
    END AS name
  FROM public.messages m
  JOIN constants c ON c.room_id = m.room_id
),
storage_files_to_remove AS (
  SELECT name FROM listing_files WHERE name IS NOT NULL
  UNION
  SELECT name FROM chat_files WHERE name LIKE 'chat-attachments/%'
),
deleted_notifications AS (
  DELETE FROM public.ops_notification_inbox n
  USING constants c
  WHERE n.metadata->>'listingId' = c.listing_id::text
    OR n.metadata->>'roomId' = c.room_id
  RETURNING n.id
),
deleted_reports AS (
  DELETE FROM public.marketplace_listing_reports r
  USING constants c
  WHERE r.listing_id = c.listing_id
  RETURNING r.id
),
deleted_messages AS (
  DELETE FROM public.messages m
  USING constants c
  WHERE m.room_id = c.room_id
  RETURNING m.id
),
deleted_listing AS (
  DELETE FROM public.listings l
  USING constants c
  WHERE l.id = c.listing_id
    AND l.title ILIKE 'QA private chat test listing%'
  RETURNING l.id
)
SELECT
  (SELECT count(*) FROM storage_files_to_remove) AS storage_objects_to_remove_via_api,
  (SELECT count(*) FROM deleted_notifications) AS notifications_deleted,
  (SELECT count(*) FROM deleted_reports) AS reports_deleted,
  (SELECT count(*) FROM deleted_messages) AS messages_deleted,
  (SELECT count(*) FROM deleted_listing) AS listings_deleted,
  (SELECT count(*) FROM public.listings l JOIN constants c ON c.listing_id = l.id) AS listings_remaining,
  (SELECT count(*) FROM public.messages m JOIN constants c ON c.room_id = m.room_id) AS messages_remaining,
  (SELECT count(*) FROM public.marketplace_listing_reports r JOIN constants c ON c.listing_id = r.listing_id) AS reports_remaining,
  (
    SELECT count(*)
    FROM public.ops_notification_inbox n
    JOIN constants c ON n.metadata->>'listingId' = c.listing_id::text OR n.metadata->>'roomId' = c.room_id
  ) AS notifications_remaining;
