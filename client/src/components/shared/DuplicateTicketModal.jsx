import { useState, useEffect, useCallback } from 'react';
import { Search, Copy, X } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';
import Input from './Input';
import Spinner from './Spinner';
import { tickets as ticketsApi } from '../../api';

export default function DuplicateTicketModal({
  isOpen,
  onClose,
  onSelectTicket,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setResults([]);
      setHasSearched(false);
    }
  }, [isOpen]);

  // Debounced search
  useEffect(() => {
    if (searchQuery.length < 2) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      setHasSearched(true);
      try {
        const data = await ticketsApi.getTickets({
          search: searchQuery,
          limit: 20,
        });
        setResults(data.tickets || []);
      } catch (error) {
        console.error('Failed to search tickets:', error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSelectTicket = async (ticket) => {
    // Fetch full ticket details to get all fields
    try {
      const fullTicket = await ticketsApi.getTicket(ticket.id);
      onSelectTicket(fullTicket);
      onClose();
    } catch (error) {
      console.error('Failed to fetch ticket details:', error);
      // Fall back to partial ticket data
      onSelectTicket(ticket);
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Duplicate Existing Ticket"
      size="lg"
    >
      <div className="min-h-[300px]">
        {/* Search Input */}
        <div className="mb-4">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by ticket number or subject (min 2 characters)"
              className="w-full pl-10 pr-4 py-2.5 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Search by ticket number (e.g., "1234") or keywords in the subject
          </p>
        </div>

        {/* Results */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner size="md" />
            </div>
          ) : searchQuery.length < 2 ? (
            <div className="text-center py-12 text-gray-500">
              <Search size={32} className="mx-auto mb-2 opacity-50" />
              <p>Enter at least 2 characters to search</p>
            </div>
          ) : results.length === 0 && hasSearched ? (
            <div className="text-center py-12 text-gray-500">
              <Copy size={32} className="mx-auto mb-2 opacity-50" />
              <p>No tickets found matching "{searchQuery}"</p>
            </div>
          ) : (
            <div className="max-h-[300px] overflow-y-auto divide-y divide-gray-100">
              {results.map((ticket) => (
                <button
                  key={ticket.id}
                  onClick={() => handleSelectTicket(ticket)}
                  className="w-full text-left p-3 hover:bg-gray-50 transition-colors flex items-start gap-3"
                >
                  <div className="flex-shrink-0 bg-primary/10 text-primary font-medium text-sm px-2 py-1 rounded">
                    #{ticket.ticketNumber}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {ticket.subject}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {ticket.company?.name || ticket.requester?.company?.name || 'No company'}
                      {ticket.requester && ` - ${ticket.requester.name}`}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4 mt-4 border-t">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}
