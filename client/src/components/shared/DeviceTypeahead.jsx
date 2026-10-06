import { useState, useRef, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Monitor, Search, Plus } from 'lucide-react';
import { devices } from '../../api';

const deviceTypeLabels = {
  DESKTOP: 'Desktop',
  LAPTOP: 'Laptop',
  SERVER: 'Server',
  PRINTER: 'Printer',
  ROUTER: 'Router',
  SWITCH: 'Switch',
  FIREWALL: 'Firewall',
  PHONE: 'Phone',
  TABLET: 'Tablet',
  ACCESS_POINT: 'Access Point',
  OTHER: 'Other',
};

export default function DeviceTypeahead({
  companyId,
  excludeIds = [],
  onSelect,
  onCreateNew,
  disabled,
  placeholder = 'Search devices...',
}) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Search devices API
  const { data: searchResults, isLoading } = useQuery({
    queryKey: ['devices-search', companyId, debouncedSearch],
    queryFn: () => devices.getDevices({ companyId, search: debouncedSearch, limit: 15 }),
    enabled: debouncedSearch.length >= 2 && isOpen && !!companyId,
  });

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        inputRef.current &&
        !inputRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter results: active devices not in excludeIds
  const deviceList = useMemo(() => {
    const all = searchResults?.devices || [];
    return all.filter(
      (device) => device.isActive !== false && !excludeIds.includes(device.id)
    );
  }, [searchResults, excludeIds]);

  const handleSelect = (device) => {
    onSelect(device);
    setSearch('');
    setIsOpen(false);
  };

  return (
    <div>
      {/* Always visible "+ New Device" link */}
      {onCreateNew && !disabled && (
        <div className="mb-2">
          <button
            type="button"
            onClick={onCreateNew}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
          >
            <Plus size={16} />
            New Device
          </button>
        </div>
      )}
      <div className="relative">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            placeholder={placeholder}
            disabled={disabled}
            className={`w-full pl-9 pr-3 py-2.5 text-base md:text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary min-h-[44px] touch-manipulation border-gray-300 ${
              disabled ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''
            }`}
          />
        </div>

        {isOpen && search.length >= 2 && (
          <div
            ref={dropdownRef}
            className="absolute z-50 w-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 max-h-60 overflow-auto overscroll-contain"
          >
            {isLoading ? (
              <div className="p-4 text-center text-sm text-gray-500">Searching...</div>
            ) : deviceList.length > 0 ? (
              <>
                {deviceList.map((device) => (
                  <button
                    key={device.id}
                    type="button"
                    onClick={() => handleSelect(device)}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 active:bg-gray-100 flex items-center gap-3 touch-manipulation min-h-[56px]"
                  >
                    <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <Monitor size={14} className="text-gray-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 truncate">{device.name}</p>
                      <p className="text-sm text-gray-500 truncate">
                        {deviceTypeLabels[device.type] || device.type}
                        {device.make && device.model && ` - ${device.make} ${device.model}`}
                        {device.make && !device.model && ` - ${device.make}`}
                        {!device.make && device.model && ` - ${device.model}`}
                      </p>
                      {device.serialNumber && (
                        <p className="text-xs text-gray-400 truncate">S/N: {device.serialNumber}</p>
                      )}
                    </div>
                  </button>
                ))}
                {onCreateNew && (
                  <button
                    type="button"
                    onClick={() => { setIsOpen(false); onCreateNew(); }}
                    className="w-full text-left px-4 py-3 hover:bg-primary/5 active:bg-primary/10 flex items-center gap-3 touch-manipulation min-h-[56px] border-t border-gray-100"
                  >
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                      <Plus size={14} className="text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-primary">+ New Device</p>
                      <p className="text-sm text-gray-500">Create a new device</p>
                    </div>
                  </button>
                )}
              </>
            ) : (
              <div className="p-4 text-center">
                <p className="text-sm text-gray-500 mb-3">No devices found for "{search}"</p>
                {onCreateNew && (
                  <button
                    type="button"
                    onClick={() => { setIsOpen(false); onCreateNew(); }}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary bg-primary/10 rounded-lg hover:bg-primary/20 transition-colors"
                  >
                    <Plus size={16} />
                    New Device
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {isOpen && search.length > 0 && search.length < 2 && (
          <div className="absolute z-50 w-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 p-4 text-center text-sm text-gray-500">
            Type at least 2 characters to search
          </div>
        )}
      </div>
    </div>
  );
}
