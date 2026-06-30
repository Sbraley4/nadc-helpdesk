import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, X } from 'lucide-react';

export default function MultiSelectAgents({
  label,
  agents = [],
  selectedIds = [],
  onChange,
  placeholder = 'Select agents...',
  error,
  className = '',
  disabled = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleAgent = (agentId) => {
    if (disabled) return;
    if (selectedIds.includes(agentId)) {
      onChange(selectedIds.filter((id) => id !== agentId));
    } else {
      onChange([...selectedIds, agentId]);
    }
  };

  const removeAgent = (e, agentId) => {
    e.stopPropagation();
    if (disabled) return;
    onChange(selectedIds.filter((id) => id !== agentId));
  };

  const selectedAgents = agents.filter((a) => selectedIds.includes(a.id));

  return (
    <div className={className} ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        <div
          onClick={() => !disabled && setIsOpen(!isOpen)}
          className={`w-full min-h-[44px] px-3 py-2 pr-10 border rounded-lg cursor-pointer bg-white touch-manipulation flex flex-wrap gap-1.5 items-center ${
            error
              ? 'border-red-300 focus:ring-red-100 focus:border-red-500'
              : 'border-gray-300'
          } ${disabled ? 'bg-gray-50 cursor-not-allowed' : ''} ${
            isOpen ? 'ring-2 ring-primary/20 border-primary' : ''
          }`}
        >
          {selectedAgents.length === 0 ? (
            <span className="text-gray-400 text-sm">{placeholder}</span>
          ) : (
            selectedAgents.map((agent) => (
              <span
                key={agent.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white"
                style={{ backgroundColor: agent.color || '#6b7280' }}
              >
                {agent.name}
                {!disabled && (
                  <button
                    type="button"
                    onClick={(e) => removeAgent(e, agent.id)}
                    className="hover:bg-white/20 rounded-full p-0.5"
                  >
                    <X size={12} />
                  </button>
                )}
              </span>
            ))
          )}
        </div>
        <ChevronDown
          size={18}
          className={`absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />

        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {agents.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500">No agents available</div>
            ) : (
              agents.map((agent) => {
                const isSelected = selectedIds.includes(agent.id);
                return (
                  <div
                    key={agent.id}
                    onClick={() => toggleAgent(agent.id)}
                    className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50 min-h-[44px] touch-manipulation ${
                      isSelected ? 'bg-primary/5' : ''
                    }`}
                  >
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: agent.color || '#6b7280' }}
                    />
                    <span className="flex-1 text-sm text-gray-900">{agent.name}</span>
                    {isSelected && (
                      <Check size={16} className="text-primary flex-shrink-0" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
      {error && <p className="mt-1.5 text-sm text-red-600">{error}</p>}
    </div>
  );
}
