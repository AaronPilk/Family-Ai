-- forward
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists "vector";
create extension if not exists "pg_trgm";
create extension if not exists "citext";
-- pg_cron is enabled in Supabase via the dashboard or `supabase/config.toml` and
-- becomes available in the `cron` schema. Do not enable here.

-- rollback
-- drop extension if exists "pg_trgm";
-- drop extension if exists "vector";
-- drop extension if exists "pgcrypto";
-- drop extension if exists "uuid-ossp";
