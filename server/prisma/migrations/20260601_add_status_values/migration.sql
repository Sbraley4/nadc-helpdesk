-- Add new status values to TicketStatus enum
-- This migration adds INVOICED and POSTED, and renames RESOLVED to INVOICED

-- First, add the new enum values
ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'INVOICED';
ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'POSTED';

-- Update existing RESOLVED tickets to INVOICED
-- Note: This needs to be run AFTER the ALTER TYPE commands above have been committed
-- In a separate transaction:
-- UPDATE "Ticket" SET status = 'INVOICED' WHERE status = 'RESOLVED';

-- After all data is migrated, you can optionally remove the old RESOLVED value
-- (this is complex in PostgreSQL and may require creating a new enum type)

-- Add color column to User table for agent colors
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "color" TEXT;

-- Set default agent colors
-- Peter Braley = Blue (#3B82F6)
-- Sam Braley = Red (#EF4444)
-- Chris Lowrance = Yellow (#F59E0B)
UPDATE "User" SET "color" = '#3B82F6' WHERE "name" LIKE '%Peter Braley%';
UPDATE "User" SET "color" = '#EF4444' WHERE "name" LIKE '%Sam Braley%';
UPDATE "User" SET "color" = '#F59E0B' WHERE "name" LIKE '%Chris Lowrance%';
