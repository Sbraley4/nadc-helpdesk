/**
 * Safely format user-generated text for HTML rendering.
 *
 * This function:
 * 1. HTML-escapes dangerous characters to prevent XSS
 * 2. Normalizes line endings (CRLF/CR -> LF) to prevent double-spacing
 * 3. Preserves double spaces (browsers collapse multiple spaces)
 *
 * The output is safe to use with dangerouslySetInnerHTML when combined
 * with CSS white-space: pre-wrap for proper line break rendering.
 *
 * @param {string} text - Raw user input text
 * @returns {string} HTML-safe string ready for dangerouslySetInnerHTML
 */
export function formatUserText(text) {
  if (!text) return '';

  // HTML-escape first to prevent XSS (must happen before any & substitutions)
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  // Normalize line endings (CRLF -> LF) to prevent extra spacing
  const normalized = escaped.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Preserve double spaces (browsers collapse multiple spaces)
  return normalized.replace(/  /g, '&nbsp;&nbsp;');
}

/**
 * Format user text with optional truncation for preview/collapsed views.
 *
 * @param {string} text - Raw user input text
 * @param {Object} options - Truncation options
 * @param {boolean} options.truncate - Whether to truncate the text
 * @param {number} options.maxLines - Maximum lines to show when truncated (default: 2)
 * @param {number} options.maxChars - Maximum characters to show when truncated (default: 150)
 * @returns {{ html: string, isTruncated: boolean }} Formatted HTML and truncation status
 */
export function formatUserTextWithTruncation(text, options = {}) {
  const { truncate = false, maxLines = 2, maxChars = 150 } = options;

  if (!text) return { html: '', isTruncated: false };

  // HTML-escape first to prevent XSS
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  // Normalize line endings (CRLF -> LF)
  const normalized = escaped.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Preserve double spaces
  const formatted = normalized.replace(/  /g, '&nbsp;&nbsp;');

  if (!truncate) {
    return { html: formatted, isTruncated: false };
  }

  // Truncate to first maxLines lines
  const lines = normalized.split('\n');
  const previewLines = lines.slice(0, maxLines);
  let preview = previewLines.join('\n');

  // If more than maxLines OR preview exceeds maxChars, hard truncate and add ellipsis
  // (matches original formatNoteBody behavior exactly - no word-boundary awareness)
  if (lines.length > maxLines || preview.length > maxChars) {
    preview = preview.substring(0, maxChars) + '...';
  }

  // Preserve double spaces in truncated preview
  const truncatedHtml = preview.replace(/  /g, '&nbsp;&nbsp;');

  return { html: truncatedHtml, isTruncated: lines.length > maxLines || normalized.length > maxChars };
}

/**
 * Check if text would need truncation without actually truncating.
 * Useful for conditionally showing "Show more" buttons.
 *
 * @param {string} text - Raw user input text
 * @param {number} maxLines - Maximum lines threshold (default: 2)
 * @param {number} maxChars - Maximum characters threshold (default: 150)
 * @returns {boolean} Whether the text exceeds truncation thresholds
 */
export function needsTruncation(text, maxLines = 2, maxChars = 150) {
  if (!text) return false;

  // Normalize line endings for consistent counting
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');

  return lines.length > maxLines || normalized.length > maxChars;
}
