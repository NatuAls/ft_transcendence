-- Extensions required by the domain model. Runs once, before Prisma's
-- migrations, when the postgres container first creates its data volume.
CREATE EXTENSION IF NOT EXISTS citext;      -- case-insensitive email / username
CREATE EXTENSION IF NOT EXISTS pg_trgm;     -- trigram search for user autocomplete
CREATE EXTENSION IF NOT EXISTS unaccent;    -- accent-insensitive full-text search (es)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Spanish + English full-text configuration that ignores accents.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname = 'helpdesk_es') THEN
    CREATE TEXT SEARCH CONFIGURATION helpdesk_es ( COPY = spanish );
    ALTER TEXT SEARCH CONFIGURATION helpdesk_es
      ALTER MAPPING FOR hword, hword_part, word WITH unaccent, spanish_stem;
  END IF;
END
$$;
