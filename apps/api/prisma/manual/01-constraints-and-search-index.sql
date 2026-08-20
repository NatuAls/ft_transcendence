-- =============================================================================
--  Two things Prisma's schema language cannot express, written by hand.
--
--  Applied as its own Prisma migration, right after the generated init
--  migration (see apps/database/conf/README or the port plan for the exact
--  steps). Do not run it by hand against a live database.
-- =============================================================================

-- 1. An attachment hangs from a ticket OR from a comment, never from both and
--    never from neither. Prisma has no CHECK constraints, and "the service
--    always sets exactly one" is an assumption, not a guarantee. The database
--    is the only place where this can actually be enforced.
ALTER TABLE attachments
  ADD CONSTRAINT attachment_single_parent
  CHECK ((("ticketId" IS NOT NULL)::int + ("commentId" IS NOT NULL)::int) = 1);

-- 2. Full-text search index for ticket search.
--
--    Careful with unaccent(): the single-argument form is STABLE, not
--    IMMUTABLE, because it depends on which dictionary the current search_path
--    resolves. PostgreSQL refuses to build an index on a non-immutable
--    expression:
--        ERROR: functions in index expression must be marked IMMUTABLE
--    The two-argument form unaccent(regdictionary, text) IS immutable, so we
--    pin the dictionary in a tiny wrapper and index that.
CREATE OR REPLACE FUNCTION helpdesk_unaccent(text)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE PARALLEL SAFE STRICT
AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$;

--    The index expression must match the one in search.service.ts character
--    for character, otherwise the planner cannot use it and you get a Seq Scan.
CREATE INDEX tickets_search_idx ON tickets USING GIN (
  to_tsvector(
    'helpdesk_es',
    helpdesk_unaccent(
      coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || reference
    )
  )
);
