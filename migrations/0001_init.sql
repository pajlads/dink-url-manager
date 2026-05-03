CREATE TABLE webhook_configs (
  secret_hash TEXT PRIMARY KEY,
  webhook_url TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'allow',
  id_list TEXT
);
