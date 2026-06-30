import { forwardRef, useEffect, useRef, useState, useCallback } from 'react';
import { Check } from 'lucide-react';
import Avatar from './Avatar';

/**
 * MentionTextarea - A textarea with @-mention autocomplete for agents
 *
 * Props:
 * - agents: Array of agent objects with {id, name, color}
 * - onMention: Callback when an agent is mentioned (receives agentId)
 * - All other props are passed to the underlying textarea
 */
const MentionTextarea = forwardRef(
  ({
    label,
    error,
    helperText,
    className = '',
    rows = 4,
    minHeight,
    mobileMinHeight,
    autoGrow,
    onChange,
    value = '',
    agents = [],
    onMention,
    selectedMentions = [], // Array of already-mentioned agent IDs for highlighting
    ...props
  }, ref) => {
    const internalRef = useRef(null);
    const textareaRef = ref || internalRef;
    const containerRef = useRef(null);
    const dropdownRef = useRef(null);

    const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
    const [showDropdown, setShowDropdown] = useState(false);
    const [mentionQuery, setMentionQuery] = useState('');
    const [mentionStartIndex, setMentionStartIndex] = useState(null);
    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, above: false });
    const [highlightedIndex, setHighlightedIndex] = useState(0);

    // Track mobile state for responsive minHeight
    useEffect(() => {
      const handleResize = () => {
        setIsMobile(window.innerWidth < 768);
      };
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Determine effective minHeight based on screen size
    const effectiveMinHeight = isMobile && mobileMinHeight ? mobileMinHeight : minHeight;

    const adjustHeight = useCallback(() => {
      const textarea = typeof textareaRef === 'function' ? null : textareaRef?.current;
      if (textarea && autoGrow) {
        textarea.style.height = 'auto';
        const newHeight = Math.max(textarea.scrollHeight, effectiveMinHeight || 0);
        textarea.style.height = newHeight + 'px';
      }
    }, [autoGrow, effectiveMinHeight, textareaRef]);

    useEffect(() => {
      adjustHeight();
    }, [value, adjustHeight]);

    // Close dropdown when clicking outside
    useEffect(() => {
      const handleClickOutside = (event) => {
        if (containerRef.current && !containerRef.current.contains(event.target)) {
          setShowDropdown(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Filter agents based on mention query
    const filteredAgents = agents.filter(agent =>
      agent.name.toLowerCase().includes(mentionQuery.toLowerCase())
    );

    // Reset highlighted index when filtered list changes
    useEffect(() => {
      setHighlightedIndex(0);
    }, [mentionQuery]);

    // Calculate dropdown position
    const updateDropdownPosition = useCallback(() => {
      const textarea = typeof textareaRef === 'function' ? null : textareaRef?.current;
      if (!textarea || !containerRef.current) return;

      // Get cursor position in the textarea
      const textBeforeCursor = value.substring(0, textarea.selectionStart);
      const lines = textBeforeCursor.split('\n');
      const currentLineIndex = lines.length - 1;
      const lineHeight = parseInt(window.getComputedStyle(textarea).lineHeight) || 20;

      // Calculate position relative to container
      const textareaRect = textarea.getBoundingClientRect();
      const containerRect = containerRef.current.getBoundingClientRect();

      // Position below cursor line
      let top = (currentLineIndex + 1) * lineHeight + 8;
      let above = false;

      // Check if dropdown would go below viewport (especially important for mobile keyboard)
      const viewportHeight = window.innerHeight;
      const dropdownHeight = Math.min(filteredAgents.length * 44, 220); // max 5 items * 44px
      const absoluteTop = textareaRect.top + top;

      // On mobile, assume keyboard takes ~40% of viewport
      const keyboardOffset = isMobile ? viewportHeight * 0.4 : 0;
      const availableBelow = viewportHeight - keyboardOffset - absoluteTop;

      if (availableBelow < dropdownHeight && top > dropdownHeight) {
        // Position above if not enough space below
        top = (currentLineIndex) * lineHeight - dropdownHeight - 8;
        above = true;
      }

      setDropdownPosition({
        top,
        left: 8,
        above
      });
    }, [value, textareaRef, filteredAgents.length, isMobile]);

    useEffect(() => {
      if (showDropdown) {
        updateDropdownPosition();
      }
    }, [showDropdown, updateDropdownPosition, mentionQuery]);

    // Handle text changes and detect @ mentions
    const handleChange = (e) => {
      const newValue = e.target.value;
      const cursorPos = e.target.selectionStart;

      // Find if we're in a mention context (typing after @)
      const textBeforeCursor = newValue.substring(0, cursorPos);
      const lastAtIndex = textBeforeCursor.lastIndexOf('@');

      if (lastAtIndex !== -1) {
        // Check if @ is at start or preceded by whitespace
        const charBeforeAt = lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : ' ';
        const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);

        // Only trigger if @ is at word boundary and no space after @
        if (/\s/.test(charBeforeAt) || lastAtIndex === 0) {
          // Check if there's a space in the query (mention complete)
          if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
            setShowDropdown(true);
            setMentionQuery(textAfterAt);
            setMentionStartIndex(lastAtIndex);
          } else {
            setShowDropdown(false);
          }
        } else {
          setShowDropdown(false);
        }
      } else {
        setShowDropdown(false);
      }

      if (onChange) onChange(e);
      if (autoGrow) adjustHeight();
    };

    // Handle keyboard navigation in dropdown
    const handleKeyDown = (e) => {
      if (!showDropdown || filteredAgents.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex(prev =>
            prev < filteredAgents.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex(prev =>
            prev > 0 ? prev - 1 : filteredAgents.length - 1
          );
          break;
        case 'Enter':
        case 'Tab':
          if (showDropdown && filteredAgents[highlightedIndex]) {
            e.preventDefault();
            selectAgent(filteredAgents[highlightedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setShowDropdown(false);
          break;
      }
    };

    // Select an agent from the dropdown
    const selectAgent = (agent) => {
      const textarea = typeof textareaRef === 'function' ? null : textareaRef?.current;
      if (!textarea || mentionStartIndex === null) return;

      // Replace @query with @AgentName
      const beforeMention = value.substring(0, mentionStartIndex);
      const afterCursor = value.substring(textarea.selectionStart);
      const newValue = `${beforeMention}@${agent.name} ${afterCursor}`;

      // Create synthetic event for onChange
      const syntheticEvent = {
        target: {
          value: newValue,
          selectionStart: mentionStartIndex + agent.name.length + 2, // +2 for @ and space
        },
      };

      if (onChange) {
        onChange(syntheticEvent);
      }

      // Notify parent about the mention
      if (onMention) {
        onMention(agent.id);
      }

      // Close dropdown and reset state
      setShowDropdown(false);
      setMentionQuery('');
      setMentionStartIndex(null);

      // Focus textarea and set cursor position after the mention
      setTimeout(() => {
        if (textarea) {
          textarea.focus();
          const newCursorPos = mentionStartIndex + agent.name.length + 2;
          textarea.setSelectionRange(newCursorPos, newCursorPos);
        }
      }, 0);
    };

    return (
      <div className={className} ref={containerRef} style={{ position: 'relative' }}>
        {label && (
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            {label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        <textarea
          ref={textareaRef}
          rows={rows}
          value={value}
          style={effectiveMinHeight ? { minHeight: effectiveMinHeight + 'px' } : undefined}
          className={`w-full px-3 py-2.5 text-base md:text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary touch-manipulation ${autoGrow ? 'resize-none overflow-hidden' : 'resize-none'} ${
            error
              ? 'border-red-300 focus:ring-red-100 focus:border-red-500'
              : 'border-gray-300'
          } ${props.disabled ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          {...props}
        />

        {/* @-mention dropdown */}
        {showDropdown && filteredAgents.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute z-50 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden"
            style={{
              top: dropdownPosition.top,
              left: dropdownPosition.left,
              right: 8,
              maxHeight: '220px',
              overflowY: 'auto',
            }}
          >
            {filteredAgents.map((agent, index) => {
              const isSelected = selectedMentions.includes(agent.id);
              const isHighlighted = index === highlightedIndex;

              return (
                <div
                  key={agent.id}
                  onClick={() => selectAgent(agent)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={`flex items-center gap-3 px-3 py-2 cursor-pointer min-h-[44px] touch-manipulation transition-colors ${
                    isHighlighted ? 'bg-gray-100' : ''
                  } ${isSelected ? 'bg-primary/5' : ''}`}
                >
                  <Avatar name={agent.name} size="sm" />
                  <span className="flex-1 text-sm text-gray-900">{agent.name}</span>
                  {isSelected && (
                    <Check size={16} className="text-primary flex-shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* No results message */}
        {showDropdown && filteredAgents.length === 0 && mentionQuery && (
          <div
            className="absolute z-50 bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2"
            style={{
              top: dropdownPosition.top,
              left: dropdownPosition.left,
              right: 8,
            }}
          >
            <span className="text-sm text-gray-500">No agents found</span>
          </div>
        )}

        {error && <p className="mt-1.5 text-sm text-red-600">{error}</p>}
        {helperText && !error && (
          <p className="mt-1.5 text-sm text-gray-500">{helperText}</p>
        )}
      </div>
    );
  }
);

MentionTextarea.displayName = 'MentionTextarea';

export default MentionTextarea;
