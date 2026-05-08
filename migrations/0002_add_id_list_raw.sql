-- Add id_list_raw column to store raw user input with comments
ALTER TABLE webhook_configs ADD COLUMN id_list_raw TEXT;

-- Populate id_list_raw from existing id_list data (convert JSON keys back to newline-separated string)
UPDATE webhook_configs
SET id_list_raw = (
  SELECT GROUP_CONCAT(key, char(10))
  FROM json_each(webhook_configs.id_list)
)
WHERE id_list IS NOT NULL AND id_list != '{}' AND id_list_raw IS NULL;

-- Set any remaining NULL values to empty string
UPDATE webhook_configs SET id_list_raw = '' WHERE id_list_raw IS NULL;
