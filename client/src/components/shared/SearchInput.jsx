import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, X, Clock } from 'lucide-react';

const MAX_RECENT_SEARCHES = 5;

export default function SearchInput({
  value = '',
  onChange,
  placeholder = 'Search...',
  debounceMs = 300,
  className = '',
  enableRecentSearches = false,
  storageKey = 'nadc-recent-searches',
}) {
  const [localValue, setLocalValue] = useState(value);
  const [showDropdown, setShowDropdown] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Load recent searches from localStorage
  useEffect(() => {
    if (enableRecentSearches) {
      try {
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          setRecentSearches(JSON.parse(stored));
        }
      } catch (e) {
        console.error('Failed to load recent searches:', e);
      }
    }
  }, [enableRecentSearches, storageKey]);

  // Sync external value changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Debounced onChange and save to recent searches
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localValue !== value) {
        onChange(localValue);

        // Save to recent searches when a non-empty search is performed
        if (enableRecentSearches && localValue.trim()) {
          saveRecentSearch(localValue.trim());
        }
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [localValue, debounceMs, onChange, value, enableRecentSearches]);

  // Handle clicks outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const saveRecentSearch = useCallback((searchTerm) => {
    setRecentSearches((prev) => {
      // Remove duplicate if exists
      const filtered = prev.filter((s) => s.toLowerCase() !== searchTerm.toLowerCase());
      // Add new search at the beginning
      const updated = [searchTerm, ...filtered].slice(0, MAX_RECENT_SEARCHES);

      try {
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to save recent searches:', e);
      }

      return updated;
    });
  }, [storageKey]);

  const handleClear = useCallback(() => {
    setLocalValue('');
    onChange('');
  }, [onChange]);

  const handleFocus = useCallback(() => {
    if (enableRecentSearches && !localValue && recentSearches.length > 0) {
      setShowDropdown(true);
    }
  }, [enableRecentSearches, localValue, recentSearches.length]);

  const handleInputChange = useCallback((e) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    // Hide dropdown when typing
    if (newValue) {
      setShowDropdown(false);
    } else if (enableRecentSearches && recentSearches.length > 0) {
      setShowDropdown(true);
    }
  }, [enableRecentSearches, recentSearches.length]);

  const handleRecentSearchClick = useCallback((searchTerm) => {
    setLocalValue(searchTerm);
    onChange(searchTerm);
    setShowDropdown(false);
    inputRef.current?.blur();
  }, [onChange]);

  const handleRemoveRecentSearch = useCallback((e, searchTerm) => {
    e.stopPropagation();
    setRecentSearches((prev) => {
      const updated = prev.filter((s) => s !== searchTerm);
      try {
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch (err) {
        console.error('Failed to update recent searches:', err);
      }
      if (updated.length === 0) {
        setShowDropdown(false);
      }
      return updated;
    });
  }, [storageKey]);

  const handleClearAllRecentSearches = useCallback(() => {
    setRecentSearches([]);
    setShowDropdown(false);
    try {
      localStorage.removeItem(storageKey);
    } catch (e) {
      console.error('Failed to clear recent searches:', e);
    }
  }, [storageKey]);

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <Search
        size={18}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
      />
      <input
        ref={inputRef}
        type="text"
        value={localValue}
        onChange={handleInputChange}
        onFocus={handleFocus}
        placeholder={placeholder}
        className="w-full pl-10 pr-10 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
      />
      {localValue && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          <X size={16} />
        </button>
      )}

      {/* Recent Searches Dropdown */}
      {showDropdown && recentSearches.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 z-50 overflow-hidden">
          <div className="px-3 py-2 text-xs font-medium text-gray-500 border-b border-gray-100">
            Recent Searches
          </div>
          <ul className="py-1">
            {recentSearches.map((search, index) => (
              <li key={index}>
                <button
                  type="button"
                  onClick={() => handleRecentSearchClick(search)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Clock size={14} className="text-gray-400 flex-shrink-0" />
                  <span className="flex-1 text-left truncate">{search}</span>
                  <button
                    type="button"
                    onClick={(e) => handleRemoveRecentSearch(e, search)}
                    className="p-1 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100 transition-colors"
                    aria-label={`Remove "${search}" from recent searches`}
                  >
                    <X size={14} />
                  </button>
                </button>
              </li>
            ))}
          </ul>
          <div className="border-t border-gray-100">
            <button
              type="button"
              onClick={handleClearAllRecentSearches}
              className="w-full px-3 py-2 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Clear all
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
