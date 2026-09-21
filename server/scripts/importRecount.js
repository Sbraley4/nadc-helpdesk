/**
 * Inventory Recount Import Script
 *
 * Replaces all InventoryItem rows with data from a CSV file.
 * Existing InventoryDeduction rows with inventoryItemId will have that field
 * set to null automatically via the SetNull relation behavior.
 *
 * Usage: node scripts/importRecount.js <path-to-csv> [--commit]
 *
 * CSV format (header row required):
 *   name,quantity,unit,category
 *
 * Modes:
 *   (default)   Dry run - shows what would happen without making changes
 *   --commit    Actually performs the delete/insert in a transaction
 */

const { PrismaClient } = require('@prisma/client');
const csv = require('csv-parse/sync');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

/**
 * Parse and validate the CSV file
 * @param {string} filePath - Path to CSV file
 * @returns {{ rows: Array, errors: Array }}
 */
function parseAndValidateCSV(filePath) {
  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    console.error(`ERROR: File not found: ${absolutePath}`);
    process.exit(1);
  }

  const csvContent = fs.readFileSync(absolutePath, 'utf-8');

  let records;
  try {
    records = csv.parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
  } catch (err) {
    console.error(`ERROR: Failed to parse CSV: ${err.message}`);
    process.exit(1);
  }

  if (records.length === 0) {
    console.error('ERROR: CSV file is empty (no data rows)');
    process.exit(1);
  }

  // Check required columns exist
  const firstRow = records[0];
  const requiredColumns = ['name', 'quantity', 'category'];
  const missingColumns = requiredColumns.filter((col) => !(col in firstRow));
  if (missingColumns.length > 0) {
    console.error(`ERROR: Missing required CSV columns: ${missingColumns.join(', ')}`);
    console.error('Expected columns: name, quantity, unit, category');
    process.exit(1);
  }

  const errors = [];
  const rows = [];

  records.forEach((record, index) => {
    const lineNum = index + 2; // +2 for 1-based indexing and header row
    const rowErrors = [];

    // Validate name (required, non-empty)
    const name = (record.name || '').trim();
    if (!name) {
      rowErrors.push('name is empty');
    }

    // Validate quantity (required, non-negative integer)
    const quantityStr = (record.quantity || '').trim();
    const quantity = parseInt(quantityStr, 10);
    if (quantityStr === '' || isNaN(quantity)) {
      rowErrors.push(`quantity "${record.quantity}" is not a valid integer`);
    } else if (quantity < 0) {
      rowErrors.push(`quantity ${quantity} is negative`);
    }

    // Validate category (required, non-empty)
    const category = (record.category || '').trim();
    if (!category) {
      rowErrors.push('category is empty');
    }

    // Unit is optional, just trim it
    const unit = (record.unit || '').trim() || null;

    if (rowErrors.length > 0) {
      errors.push({ line: lineNum, name: record.name, errors: rowErrors });
    } else {
      rows.push({
        name,
        quantity,
        unit,
        category,
      });
    }
  });

  return { rows, errors };
}

/**
 * Print a formatted table
 */
function printTable(headers, rows) {
  // Calculate column widths
  const widths = headers.map((h, i) => {
    const maxDataWidth = rows.reduce((max, row) => {
      const val = String(row[i] ?? '');
      return Math.max(max, val.length);
    }, 0);
    return Math.max(h.length, maxDataWidth);
  });

  // Print header
  const headerLine = headers.map((h, i) => h.padEnd(widths[i])).join(' | ');
  const separator = widths.map((w) => '-'.repeat(w)).join('-+-');
  console.log(headerLine);
  console.log(separator);

  // Print rows
  rows.forEach((row) => {
    const line = row.map((val, i) => String(val ?? '').padEnd(widths[i])).join(' | ');
    console.log(line);
  });
}

async function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  const commitMode = args.includes('--commit');
  const csvPath = args.find((arg) => !arg.startsWith('--'));

  if (!csvPath) {
    console.log('Usage: node scripts/importRecount.js <path-to-csv> [--commit]');
    console.log('');
    console.log('Options:');
    console.log('  --commit    Actually perform the import (default is dry run)');
    console.log('');
    console.log('CSV format (with header row):');
    console.log('  name,quantity,unit,category');
    process.exit(1);
  }

  console.log('='.repeat(60));
  console.log('INVENTORY RECOUNT IMPORT');
  console.log(commitMode ? 'MODE: --commit (WILL MAKE CHANGES)' : 'MODE: Dry run (no changes)');
  console.log('='.repeat(60));
  console.log('');

  // Parse and validate CSV
  console.log(`Reading CSV: ${csvPath}`);
  const { rows, errors } = parseAndValidateCSV(csvPath);

  if (errors.length > 0) {
    console.log('');
    console.error('VALIDATION ERRORS:');
    errors.forEach((e) => {
      console.error(`  Line ${e.line} (${e.name || 'unnamed'}): ${e.errors.join('; ')}`);
    });
    console.log('');
    console.error(`Aborting: ${errors.length} row(s) failed validation.`);
    process.exit(1);
  }

  console.log(`Parsed ${rows.length} valid rows from CSV.`);
  console.log('');

  // Fetch current inventory
  console.log('CURRENT INVENTORY:');
  console.log('-'.repeat(40));

  const currentItems = await prisma.inventoryItem.findMany({
    select: { id: true, name: true, quantity: true, category: true },
    orderBy: { name: 'asc' },
  });

  console.log(`Total items: ${currentItems.length}`);
  if (currentItems.length > 0) {
    console.log('');
    printTable(
      ['Name', 'Qty', 'Category'],
      currentItems.map((i) => [i.name, i.quantity, i.category || '(none)'])
    );
  }
  console.log('');

  // Show what will happen
  console.log('PLANNED CHANGES:');
  console.log('-'.repeat(40));
  console.log(`Items to DELETE: ${currentItems.length}`);
  console.log(`Items to INSERT: ${rows.length}`);
  console.log('');

  console.log('NEW INVENTORY (preview):');
  printTable(
    ['Name', 'Qty', 'Category'],
    rows.map((r) => [r.name, r.quantity, r.category])
  );
  console.log('');

  // Dry run stops here
  if (!commitMode) {
    console.log('='.repeat(60));
    console.log('DRY RUN COMPLETE - No changes made.');
    console.log('Run with --commit to apply these changes.');
    console.log('='.repeat(60));
    await prisma.$disconnect();
    process.exit(0);
  }

  // Commit mode - perform the transaction
  console.log('EXECUTING TRANSACTION...');
  console.log('');

  try {
    await prisma.$transaction(async (tx) => {
      // Step 1: Delete all existing InventoryItem rows
      const deleteResult = await tx.inventoryItem.deleteMany({});
      console.log(`Deleted ${deleteResult.count} existing InventoryItem rows.`);

      // Step 2: Insert new items
      const insertData = rows.map((row) => ({
        name: row.name,
        quantity: row.quantity,
        threshold: 0,
        category: row.category,
        isLow: row.quantity <= 0, // threshold is 0, so isLow = (quantity <= 0)
        notes: null,
      }));

      const insertResult = await tx.inventoryItem.createMany({
        data: insertData,
      });
      console.log(`Inserted ${insertResult.count} new InventoryItem rows.`);
    });

    console.log('');
    console.log('Transaction committed successfully.');
    console.log('');

    // Verify final state
    const finalCount = await prisma.inventoryItem.count();
    console.log('='.repeat(60));
    console.log('IMPORT COMPLETE');
    console.log(`Final InventoryItem count: ${finalCount}`);
    console.log('='.repeat(60));
  } catch (err) {
    console.error('');
    console.error('TRANSACTION FAILED - All changes rolled back.');
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
