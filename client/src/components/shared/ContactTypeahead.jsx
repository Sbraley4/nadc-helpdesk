import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, User, Building2, Search, Plus } from 'lucide-react';
import { contacts } from '../../api';

export default function ContactTypeahead({
  value,
  onChange,
  label,
  required,
  error,
  placeholder = 'Search contacts...',
  disabled,
  className = '',
  onCreateNew,
}) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState(null);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Search contacts API
  const { data: searchResults, isLoading } = useQuery({
    queryKey: ['contacts-search', search],
    queryFn: () => contacts.searchContacts(search),
    enabled: search.length >= 2 && isOpen,
  });

  // Fetch selected contact details when value changes
  const { data: contactData } = useQuery({
    queryKey: ['contact', value],
    queryFn: () => contacts.getContact(value),
    enabled: !!value && !selectedContact,
  });

  // Set selected contact from fetched data
  useEffect(() => {
    if (contactData) {
      const contact = contactData.contact || contactData;
      setSelectedContact(contact);
    }
  }, [contactData]);

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

  const handleSelect = (contact) => {
    setSelectedContact(contact);
    onChange(contact.id);
    setSearch('');
    setIsOpen(false);
  };

  const handleClear = () => {
    setSelectedContact(null);
    onChange('');
    setSearch('');
  };

  const contactList = searchResults?.contacts || [];

  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      {selectedContact ? (
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 min-h-[52px]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
              <User size={16} className="text-primary" />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-gray-900 truncate">{selectedContact.name}</p>
              <p className="text-sm text-gray-500 truncate">{selectedContact.email}</p>
              {selectedContact.company && (
                <p className="text-xs text-gray-400 flex items-center gap-1 truncate">
                  <Building2 size={10} className="flex-shrink-0" />
                  {selectedContact.company.name}
                </p>
              )}
            </div>
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded touch-manipulation min-w-[40px] min-h-[40px] flex items-center justify-center flex-shrink-0"
            >
              <X size={18} />
            </button>
          )}
        </div>
      ) : (
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
              className={`w-full pl-9 pr-3 py-2.5 text-base md:text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary min-h-[44px] touch-manipulation ${
                error ? 'border-red-300' : 'border-gray-300'
              } ${disabled ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}
            />
          </div>

          {isOpen && search.length >= 2 && (
            <div
              ref={dropdownRef}
              className="absolute z-50 w-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 max-h-60 overflow-auto overscroll-contain"
            >
              {isLoading ? (
                <div className="p-4 text-center text-sm text-gray-500">Searching...</div>
              ) : contactList.length > 0 ? (
                <>
                  {contactList.map((contact) => (
                    <button
                      key={contact.id}
                      type="button"
                      onClick={() => handleSelect(contact)}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 active:bg-gray-100 flex items-center gap-3 touch-manipulation min-h-[56px]"
                    >
                      <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <User size={14} className="text-gray-500" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 truncate">{contact.name}</p>
                        <p className="text-sm text-gray-500 truncate">{contact.email}</p>
                        {contact.company && (
                          <p className="text-xs text-gray-400 truncate">{contact.company.name}</p>
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
                        <p className="font-medium text-primary">+ New Client</p>
                        <p className="text-sm text-gray-500">Create a new contact</p>
                      </div>
                    </button>
                  )}
                </>
              ) : (
                <div className="p-4 text-center">
                  <p className="text-sm text-gray-500 mb-3">No contacts found for "{search}"</p>
                  {onCreateNew && (
                    <button
                      type="button"
                      onClick={() => { setIsOpen(false); onCreateNew(); }}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary bg-primary/10 rounded-lg hover:bg-primary/20 transition-colors"
                    >
                      <Plus size={16} />
                      New Client
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
      )}

      {error && <p className="mt-1.5 text-sm text-red-600">{error}</p>}
    </div>
  );
}
