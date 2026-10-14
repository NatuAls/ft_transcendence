-- =============================================================================
--  Erasure of closed accounts.
--
--  Deleting your own account erases your personal data at once. An account an
--  administrator closes keeps it for ACCOUNT_ERASURE_GRACE_DAYS (30), so a
--  mistake can be undone, and then loses it to the hourly maintenance job.
--  `erasedAt` tells the two apart: closed and waiting, or already erased.
-- =============================================================================

-- AlterTable
ALTER TABLE "users" ADD COLUMN "erasedAt" TIMESTAMP(3);

-- The accounts their owners deleted before this column existed were already
-- anonymised by that same erasure: mark them, so nothing waits for them.
UPDATE "users"
SET "erasedAt" = "deletedAt"
WHERE "deletedAt" IS NOT NULL
  AND "email" LIKE 'deleted\_%@deleted.local';
