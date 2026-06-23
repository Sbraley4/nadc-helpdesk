/**
 * Inventory AI Service
 *
 * Parses internal notes for inventory usage and creates deduction suggestions.
 * Looks for a "Used" section with dash/bullet items and fuzzy-matches to inventory.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Parse a line item from the "Used" section
 * Handles formats like:
 * - "-1 single face plate" → quantity: 1, itemName: "single face plate"
 * - "-300ft CAT 6 blue cable" → quantity: 300, unit: "ft", itemName: "CAT 6 blue cable"
 * - "-2 D-rings" → quantity: 2, itemName: "D-ring"
 *
 * @param {string} line - The line to parse
 * @returns {{ quantity: number, unit: string|null, itemName: string } | null}
 */
function parseUsedLine(line) {
  // Trim and remove leading dash/bullet
  const trimmed = line.trim().replace(/^[-•*]\s*/, '');

  if (!trimmed) return null;

  // Pattern: quantity (optional unit) item name
  // Examples: "1 single face plate", "300ft CAT 6 blue cable", "2 D-rings"
  const patterns = [
    // Pattern 1: quantity + unit attached (e.g., "300ft")
    /^(\d+(?:\.\d+)?)\s*(ft|feet|m|meters?|in|inches?|rolls?|boxes?|packs?|bags?|units?|pcs?|pieces?)\s+(.+)$/i,
    // Pattern 2: quantity + item name (e.g., "1 single face plate")
    /^(\d+(?:\.\d+)?)\s+(.+)$/,
    // Pattern 3: just item name with implied quantity of 1
    /^(.+)$/,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match) {
      if (match.length === 4) {
        // Has quantity, unit, and item name
        return {
          quantity: parseFloat(match[1]) || 1,
          unit: match[2].toLowerCase(),
          itemName: match[3].trim(),
        };
      } else if (match.length === 3) {
        // Has quantity and item name (no unit)
        return {
          quantity: parseFloat(match[1]) || 1,
          unit: null,
          itemName: match[2].trim(),
        };
      } else if (match.length === 2) {
        // Just item name
        return {
          quantity: 1,
          unit: null,
          itemName: match[1].trim(),
        };
      }
    }
  }

  return null;
}

/**
 * Extract "Used" section from note body and parse items
 *
 * @param {string} noteBody - The full note body
 * @returns {Array<{ quantity: number, unit: string|null, itemName: string }>}
 */
function parseUsedSection(noteBody) {
  const items = [];

  // Look for "Used" header (case-insensitive)
  // Match patterns like "Used:", "Used", "Materials Used:", etc.
  const usedPattern = /(?:materials?\s+)?used:?\s*\n([\s\S]*?)(?:\n\n|$)/i;
  const match = noteBody.match(usedPattern);

  if (!match) {
    // Try a simpler approach: look for lines starting with dash after "Used"
    const simplePattern = /used:?\s*\n((?:[-•*].+\n?)+)/i;
    const simpleMatch = noteBody.match(simplePattern);

    if (simpleMatch) {
      const lines = simpleMatch[1].split('\n');
      for (const line of lines) {
        if (line.trim().match(/^[-•*]/)) {
          const parsed = parseUsedLine(line);
          if (parsed) {
            items.push(parsed);
          }
        }
      }
    }
    return items;
  }

  // Parse each line in the "Used" section
  const usedSection = match[1];
  const lines = usedSection.split('\n');

  for (const line of lines) {
    // Only process lines that start with dash/bullet
    if (line.trim().match(/^[-•*]/)) {
      const parsed = parseUsedLine(line);
      if (parsed) {
        items.push(parsed);
      }
    }
  }

  return items;
}

/**
 * Calculate similarity between two strings (simple Jaccard-like similarity)
 *
 * @param {string} str1
 * @param {string} str2
 * @returns {number} - Similarity score between 0 and 1
 */
function calculateSimilarity(str1, str2) {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  // Exact match
  if (s1 === s2) return 1;

  // One contains the other
  if (s1.includes(s2) || s2.includes(s1)) return 0.8;

  // Split into words and calculate overlap
  const words1 = new Set(s1.split(/\s+/).filter(w => w.length > 1));
  const words2 = new Set(s2.split(/\s+/).filter(w => w.length > 1));

  if (words1.size === 0 || words2.size === 0) return 0;

  let intersection = 0;
  for (const word of words1) {
    if (words2.has(word)) {
      intersection++;
    }
  }

  const union = words1.size + words2.size - intersection;
  return intersection / union;
}

/**
 * Find the best matching inventory item for a given item name
 *
 * @param {string} itemName - The item name from the note
 * @param {Array} inventoryItems - List of inventory items to match against
 * @returns {{ item: object|null, score: number }}
 */
function findBestMatch(itemName, inventoryItems) {
  let bestMatch = null;
  let bestScore = 0;
  const MATCH_THRESHOLD = 0.3; // Minimum similarity score to consider a match

  for (const item of inventoryItems) {
    const score = calculateSimilarity(itemName, item.name);

    if (score > bestScore && score >= MATCH_THRESHOLD) {
      bestScore = score;
      bestMatch = item;
    }
  }

  return { item: bestMatch, score: bestScore };
}

/**
 * Process an internal note for inventory usage
 *
 * @param {string} noteBody - The note body text
 * @param {string} ticketId - The ticket ID
 * @param {string|null} replyId - The reply ID (optional)
 * @returns {Promise<Array>} - Array of created InventoryDeduction records
 */
async function processNoteForInventory(noteBody, ticketId, replyId = null) {
  try {
    // Parse the "Used" section
    const parsedItems = parseUsedSection(noteBody);

    if (parsedItems.length === 0) {
      console.log('[InventoryAI] No items found in Used section');
      return [];
    }

    console.log(`[InventoryAI] Found ${parsedItems.length} items in Used section`);

    // Fetch all inventory items for matching
    const inventoryItems = await prisma.inventoryItem.findMany({
      select: { id: true, name: true, category: true },
    });

    const deductions = [];

    for (const parsedItem of parsedItems) {
      // Find best matching inventory item
      const { item: matchedItem, score } = findBestMatch(parsedItem.itemName, inventoryItems);

      // Create deduction record
      const deduction = await prisma.inventoryDeduction.create({
        data: {
          ticketId,
          replyId,
          itemName: parsedItem.itemName,
          quantity: Math.round(parsedItem.quantity), // Round to int
          inventoryItemId: matchedItem?.id || null,
          status: 'PENDING',
        },
        include: {
          inventoryItem: true,
          ticket: {
            select: {
              ticketNumber: true,
              subject: true,
            },
          },
        },
      });

      console.log(`[InventoryAI] Created deduction: "${parsedItem.itemName}" qty=${parsedItem.quantity}${matchedItem ? ` -> matched to "${matchedItem.name}" (score=${score.toFixed(2)})` : ' (no match)'}`);

      deductions.push(deduction);
    }

    return deductions;
  } catch (error) {
    console.error('[InventoryAI] Error processing note:', error);
    throw error;
  }
}

/**
 * Check if note body contains a "Used" section
 *
 * @param {string} noteBody - The note body to check
 * @returns {boolean}
 */
function hasUsedSection(noteBody) {
  if (!noteBody) return false;
  return /\bused\b/i.test(noteBody);
}

module.exports = {
  processNoteForInventory,
  hasUsedSection,
  parseUsedSection,
  parseUsedLine,
  findBestMatch,
  calculateSimilarity,
};
