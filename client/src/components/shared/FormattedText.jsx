import { formatUserText, formatUserTextWithTruncation } from '../../utils/formatText';

/**
 * FormattedText - Safely render user-generated text with proper formatting.
 *
 * This component consolidates the text formatting logic previously duplicated
 * across TicketDetailPage (formatDescription, formatNoteBody) and
 * PortalTicketDetailPage (formatContent).
 *
 * Features:
 * - HTML-escapes dangerous characters (XSS prevention)
 * - Normalizes CRLF/CR line endings to LF (prevents double-spacing)
 * - Preserves double spaces (browsers normally collapse them)
 * - Renders with white-space: pre-wrap for proper line breaks
 * - Optional truncation for collapsed/preview views
 *
 * @example
 * // Basic usage
 * <FormattedText text={ticket.description} />
 *
 * @example
 * // With custom styling
 * <FormattedText
 *   text={reply.body}
 *   className="prose prose-sm max-w-none text-gray-700"
 * />
 *
 * @example
 * // With truncation (for collapsed views)
 * <FormattedText
 *   text={reply.body}
 *   truncate={!isExpanded}
 *   maxLines={2}
 *   maxChars={150}
 * />
 *
 * @example
 * // With Tailwind's truncate class (single-line ellipsis)
 * <FormattedText
 *   text={entry.notes}
 *   className="truncate"
 *   preWrap={false}
 * />
 */
export default function FormattedText({
  text,
  className = '',
  style = {},
  truncate = false,
  maxLines = 2,
  maxChars = 150,
  preWrap = true,
  as: Component = 'div',
  ...rest
}) {
  if (!text) {
    return null;
  }

  // Get formatted HTML (with optional truncation)
  let html;
  if (truncate) {
    const result = formatUserTextWithTruncation(text, { truncate, maxLines, maxChars });
    html = result.html;
  } else {
    html = formatUserText(text);
  }

  // Only apply white-space: pre-wrap when preWrap is true.
  // When false, let className control white-space (e.g., Tailwind's `truncate` uses nowrap).
  const mergedStyle = preWrap
    ? { whiteSpace: 'pre-wrap', ...style }
    : style;

  return (
    <Component
      className={className}
      style={mergedStyle}
      dangerouslySetInnerHTML={{ __html: html }}
      {...rest}
    />
  );
}

/**
 * Re-export utility functions for cases where callers need direct access
 * to the formatting logic (e.g., for string manipulation before rendering).
 */
export { formatUserText, formatUserTextWithTruncation, needsTruncation } from '../../utils/formatText';
