import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, Bell, ChevronDown, LogOut, User, Circle, Menu, Ticket, Users, Building, FileText, X, Key } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import useNotificationStore from '../../store/notificationStore';
import { agents, search } from '../../api';
import Avatar from '../shared/Avatar';
import NotificationPanel from './NotificationPanel';
import { Spinner, ChangePasswordModal } from '../shared';

const availabilityOptions = [
  { value: 'ONLINE', label: 'Online', color: 'text-green-500' },
  { value: 'BUSY', label: 'Busy', color: 'text-yellow-500' },
  { value: 'AWAY', label: 'Away', color: 'text-orange-500' },
  { value: 'OFFLINE', label: 'Offline', color: 'text-gray-400' },
];

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export default function Topbar({ title, onMenuClick, isMobile }) {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { unreadCount, fetchUnreadCount, initSocketListeners, cleanupSocketListeners } = useNotificationStore();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [availabilityMenuOpen, setAvailabilityMenuOpen] = useState(false);
  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const dropdownRef = useRef(null);
  const notificationRef = useRef(null);
  const searchRef = useRef(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Fetch unread count on mount and set up socket listeners
  useEffect(() => {
    fetchUnreadCount();
    initSocketListeners();
    return () => cleanupSocketListeners();
  }, [fetchUnreadCount, initSocketListeners, cleanupSocketListeners]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
        setAvailabilityMenuOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const performSearch = useCallback(
    debounce(async (query) => {
      if (!query || query.length < 2) {
        setSearchResults(null);
        setSearchLoading(false);
        return;
      }

      setSearchLoading(true);
      try {
        const results = await search.globalSearch(query);
        setSearchResults(results);
      } catch (error) {
        console.error('Search failed:', error);
        setSearchResults({ tickets: [], contacts: [], companies: [], articles: [] });
      } finally {
        setSearchLoading(false);
      }
    }, 300),
    []
  );

  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    setSearchOpen(true);
    if (query.length >= 2) {
      setSearchLoading(true);
      performSearch(query);
    } else {
      setSearchResults(null);
      setSearchLoading(false);
    }
  };

  const handleResultClick = (type, item) => {
    setSearchOpen(false);
    setSearchQuery('');
    setSearchResults(null);

    switch (type) {
      case 'ticket':
        navigate(`/tickets/${item.id}`);
        break;
      case 'contact':
        navigate(`/contacts/${item.id}`);
        break;
      case 'company':
        navigate(`/companies/${item.id}`);
        break;
      case 'article':
        navigate(`/kb/articles/${item.id}`);
        break;
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults(null);
    setSearchOpen(false);
  };

  const handleAvailabilityChange = async (availability) => {
    try {
      await agents.updateAvailability(user.id, availability);
      // Update local user state
      useAuthStore.setState((state) => ({
        user: { ...state.user, availability },
      }));
      setAvailabilityMenuOpen(false);
      setDropdownOpen(false);
    } catch (error) {
      console.error('Failed to update availability:', error);
    }
  };

  const hasResults = searchResults && (
    searchResults.tickets?.length > 0 ||
    searchResults.contacts?.length > 0 ||
    searchResults.companies?.length > 0 ||
    searchResults.articles?.length > 0
  );

  const totalResults = searchResults ? (
    (searchResults.tickets?.length || 0) +
    (searchResults.contacts?.length || 0) +
    (searchResults.companies?.length || 0) +
    (searchResults.articles?.length || 0)
  ) : 0;

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 md:px-6">
      {/* Left side - menu button (mobile) + title */}
      <div className="flex items-center gap-3">
        {isMobile && onMenuClick && (
          <button
            onClick={onMenuClick}
            className="p-2 -ml-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <Menu size={20} />
          </button>
        )}
        <h1 className="text-lg md:text-xl font-semibold text-gray-900 truncate">{title}</h1>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4">
        {/* Global search */}
        <div className="relative hidden md:block" ref={searchRef}>
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="Search tickets, contacts, companies..."
            value={searchQuery}
            onChange={handleSearchChange}
            onFocus={() => searchQuery.length >= 2 && setSearchOpen(true)}
            className="w-80 pl-10 pr-8 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
          {searchQuery && (
            <button
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={16} />
            </button>
          )}

          {/* Search Results Dropdown */}
          {searchOpen && searchQuery.length >= 2 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 max-h-96 overflow-y-auto z-50">
              {searchLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Spinner size="sm" />
                  <span className="ml-2 text-sm text-gray-500">Searching...</span>
                </div>
              ) : hasResults ? (
                <div className="divide-y divide-gray-100">
                  {/* Tickets */}
                  {searchResults.tickets?.length > 0 && (
                    <div className="p-2">
                      <div className="px-2 py-1 text-xs font-medium text-gray-500 uppercase">
                        Tickets ({searchResults.tickets.length})
                      </div>
                      {searchResults.tickets.map((ticket) => (
                        <button
                          key={ticket.id}
                          onClick={() => handleResultClick('ticket', ticket)}
                          className="w-full flex items-center gap-3 px-2 py-2 text-left hover:bg-gray-50 rounded-lg"
                        >
                          <Ticket size={16} className="text-primary flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-gray-900 truncate">
                              #{ticket.ticketNumber} - {ticket.subject}
                            </div>
                            <div className="text-xs text-gray-500">
                              {ticket.status} • {ticket.requester?.name || 'Unknown'}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Contacts */}
                  {searchResults.contacts?.length > 0 && (
                    <div className="p-2">
                      <div className="px-2 py-1 text-xs font-medium text-gray-500 uppercase">
                        Contacts ({searchResults.contacts.length})
                      </div>
                      {searchResults.contacts.map((contact) => (
                        <button
                          key={contact.id}
                          onClick={() => handleResultClick('contact', contact)}
                          className="w-full flex items-center gap-3 px-2 py-2 text-left hover:bg-gray-50 rounded-lg"
                        >
                          <Users size={16} className="text-blue-500 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-gray-900 truncate">
                              {contact.name}
                            </div>
                            <div className="text-xs text-gray-500 truncate">
                              {contact.email}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Companies */}
                  {searchResults.companies?.length > 0 && (
                    <div className="p-2">
                      <div className="px-2 py-1 text-xs font-medium text-gray-500 uppercase">
                        Companies ({searchResults.companies.length})
                      </div>
                      {searchResults.companies.map((company) => (
                        <button
                          key={company.id}
                          onClick={() => handleResultClick('company', company)}
                          className="w-full flex items-center gap-3 px-2 py-2 text-left hover:bg-gray-50 rounded-lg"
                        >
                          <Building size={16} className="text-purple-500 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-gray-900 truncate">
                              {company.name}
                            </div>
                            {company.domain && (
                              <div className="text-xs text-gray-500 truncate">
                                {company.domain}
                              </div>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* KB Articles */}
                  {searchResults.articles?.length > 0 && (
                    <div className="p-2">
                      <div className="px-2 py-1 text-xs font-medium text-gray-500 uppercase">
                        Knowledge Base ({searchResults.articles.length})
                      </div>
                      {searchResults.articles.map((article) => (
                        <button
                          key={article.id}
                          onClick={() => handleResultClick('article', article)}
                          className="w-full flex items-center gap-3 px-2 py-2 text-left hover:bg-gray-50 rounded-lg"
                        >
                          <FileText size={16} className="text-green-500 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-gray-900 truncate">
                              {article.title}
                            </div>
                            {article.category && (
                              <div className="text-xs text-gray-500 truncate">
                                {article.category.name}
                              </div>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Footer */}
                  <div className="px-4 py-2 bg-gray-50 text-xs text-gray-500">
                    {totalResults} result{totalResults !== 1 ? 's' : ''} found
                  </div>
                </div>
              ) : searchResults ? (
                <div className="py-8 text-center text-sm text-gray-500">
                  No results found for "{searchQuery}"
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Notifications */}
        <div className="relative" ref={notificationRef}>
          <button
            onClick={() => setNotificationPanelOpen(!notificationPanelOpen)}
            className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center touch-manipulation"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-accent text-white text-xs font-medium rounded-full px-1">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
          <NotificationPanel
            isOpen={notificationPanelOpen}
            onClose={() => setNotificationPanelOpen(false)}
          />
        </div>

        {/* User dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <Avatar name={user?.name} size="sm" />
            <span className="text-sm font-medium text-gray-700 hidden md:block">
              {user?.name}
            </span>
            <ChevronDown size={16} className="text-gray-500" />
          </button>

          {/* Dropdown menu */}
          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
              <div className="px-4 py-2 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                <p className="text-xs text-gray-500">{user?.email}</p>
              </div>

              {/* Availability submenu */}
              <div className="relative">
                <button
                  onClick={() => setAvailabilityMenuOpen(!availabilityMenuOpen)}
                  className="w-full flex items-center justify-between px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <span className="flex items-center gap-2">
                    <Circle
                      size={10}
                      className={`fill-current ${
                        availabilityOptions.find((o) => o.value === user?.availability)
                          ?.color || 'text-gray-400'
                      }`}
                    />
                    Change availability
                  </span>
                  <ChevronDown
                    size={14}
                    className={`transition-transform ${
                      availabilityMenuOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {availabilityMenuOpen && (
                  <div className="border-t border-gray-100 py-1">
                    {availabilityOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => handleAvailabilityChange(option.value)}
                        className={`w-full flex items-center gap-2 px-6 py-2 text-sm hover:bg-gray-50 ${
                          user?.availability === option.value
                            ? 'bg-gray-50 font-medium'
                            : ''
                        }`}
                      >
                        <Circle size={10} className={`fill-current ${option.color}`} />
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-gray-100 mt-1 pt-1">
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    setShowChangePasswordModal(true);
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Key size={16} />
                  Change Password
                </button>
                <button
                  onClick={logout}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <LogOut size={16} />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={showChangePasswordModal}
        onClose={() => setShowChangePasswordModal(false)}
      />
    </header>
  );
}
