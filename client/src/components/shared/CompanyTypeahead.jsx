import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Building2, Search } from 'lucide-react';
import { companies } from '../../api';

export default function CompanyTypeahead({
  value,
  onChange,
  label,
  required,
  error,
  placeholder = 'Search companies...',
  disabled,
  className = '',
}) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Search companies API
  const { data: searchResults, isLoading } = useQuery({
    queryKey: ['companies-search', search],
    queryFn: () => companies.getCompanies({ search, limit: 10 }),
    enabled: search.length >= 2 && isOpen,
  });

  // Fetch selected company details when value changes
  const { data: companyData } = useQuery({
    queryKey: ['company', value],
    queryFn: () => companies.getCompany(value),
    enabled: !!value && !selectedCompany,
  });

  // Set selected company from fetched data
  useEffect(() => {
    if (companyData) {
      const company = companyData.company || companyData;
      setSelectedCompany(company);
    }
  }, [companyData]);

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

  const handleSelect = (company) => {
    setSelectedCompany(company);
    onChange(company.id);
    setSearch('');
    setIsOpen(false);
  };

  const handleClear = () => {
    setSelectedCompany(null);
    onChange('');
    setSearch('');
  };

  const companyList = searchResults?.companies || [];

  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      {selectedCompany ? (
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <Building2 size={16} className="text-blue-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">{selectedCompany.name}</p>
              {selectedCompany.domain && (
                <p className="text-sm text-gray-500">{selectedCompany.domain}</p>
              )}
              {selectedCompany._count?.contacts > 0 && (
                <p className="text-xs text-gray-400">
                  {selectedCompany._count.contacts} contact{selectedCompany._count.contacts !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded"
            >
              <X size={18} />
            </button>
          )}
        </div>
      ) : (
        <div className="relative">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
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
              className={`w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary ${
                error ? 'border-red-300' : 'border-gray-300'
              } ${disabled ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}
            />
          </div>

          {isOpen && search.length >= 2 && (
            <div
              ref={dropdownRef}
              className="absolute z-50 w-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 max-h-60 overflow-auto"
            >
              {isLoading ? (
                <div className="p-3 text-center text-sm text-gray-500">Searching...</div>
              ) : companyList.length > 0 ? (
                companyList.map((company) => (
                  <button
                    key={company.id}
                    type="button"
                    onClick={() => handleSelect(company)}
                    className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-3"
                  >
                    <div className="w-8 h-8 bg-blue-50 rounded-full flex items-center justify-center flex-shrink-0">
                      <Building2 size={14} className="text-blue-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 truncate">{company.name}</p>
                      {company.domain && (
                        <p className="text-sm text-gray-500 truncate">{company.domain}</p>
                      )}
                    </div>
                  </button>
                ))
              ) : (
                <div className="p-3 text-center text-sm text-gray-500">
                  No companies found for "{search}"
                </div>
              )}
            </div>
          )}

          {isOpen && search.length > 0 && search.length < 2 && (
            <div className="absolute z-50 w-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 p-3 text-center text-sm text-gray-500">
              Type at least 2 characters to search
            </div>
          )}
        </div>
      )}

      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
