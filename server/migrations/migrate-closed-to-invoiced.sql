-- =============================================================================
-- MIGRATION: Convert CLOSED status to INVOICED
-- =============================================================================
-- This script:
--   a) Updates all tickets with status = 'CLOSED' to status = 'INVOICED'
--   b) For rows where closedAt IS NULL, sets closedAt = updatedAt (or NOW() if updatedAt is also NULL)
--   c) Updates automation rules that reference 'CLOSED' to reference 'INVOICED' instead
--
-- IMPORTANT: Run within a transaction. Review output before committing.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- STEP 1: Preview affected tickets (SELECT only - no changes)
-- -----------------------------------------------------------------------------
-- Run this first to see what will be changed:
/*
SELECT
    "ticketNumber",
    "subject",
    "status",
    "closedAt",
    "updatedAt"
FROM "Ticket"
WHERE status = 'CLOSED'
ORDER BY "ticketNumber" DESC
LIMIT 20;
*/

-- -----------------------------------------------------------------------------
-- STEP 2a: Update tickets with status = 'CLOSED' to 'INVOICED'
--          AND set closedAt for rows where it's NULL
-- -----------------------------------------------------------------------------

-- First, handle CLOSED tickets that have NULL closedAt - set closedAt before status change
UPDATE "Ticket"
SET
    "closedAt" = COALESCE("updatedAt", NOW())
WHERE
    status = 'CLOSED'
    AND "closedAt" IS NULL;

-- Now change all CLOSED tickets to INVOICED
UPDATE "Ticket"
SET
    status = 'INVOICED'
WHERE
    status = 'CLOSED';

-- -----------------------------------------------------------------------------
-- STEP 2b: Report how many tickets were updated
-- -----------------------------------------------------------------------------
-- After running the above, you can verify with:
/*
SELECT COUNT(*) as updated_count FROM "Ticket" WHERE status = 'INVOICED';
*/

-- -----------------------------------------------------------------------------
-- STEP 3: Update AutomationRule conditions and actions
-- -----------------------------------------------------------------------------
-- The conditions and actions columns are JSONB. We need to replace 'CLOSED' with 'INVOICED'
-- in both the conditions array and actions array.

-- Update conditions that reference CLOSED
UPDATE "AutomationRule"
SET
    conditions = REPLACE(conditions::text, '"CLOSED"', '"INVOICED"')::jsonb
WHERE
    conditions::text LIKE '%"CLOSED"%';

-- Update actions that reference CLOSED
UPDATE "AutomationRule"
SET
    actions = REPLACE(actions::text, '"CLOSED"', '"INVOICED"')::jsonb
WHERE
    actions::text LIKE '%"CLOSED"%';

-- -----------------------------------------------------------------------------
-- STEP 4: Verify automation rules were updated correctly
-- -----------------------------------------------------------------------------
-- Run this to confirm no rules still reference CLOSED:
/*
SELECT id, name, conditions, actions
FROM "AutomationRule"
WHERE
    conditions::text LIKE '%CLOSED%'
    OR actions::text LIKE '%CLOSED%';
*/

-- -----------------------------------------------------------------------------
-- COMMIT or ROLLBACK
-- -----------------------------------------------------------------------------
-- If everything looks correct:
-- COMMIT;
--
-- If something went wrong:
-- ROLLBACK;

-- For safety, we'll leave this as ROLLBACK by default.
-- Change to COMMIT after review.
ROLLBACK;
