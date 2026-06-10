import { useState, useEffect, useRef } from 'react';
import { Search, Ticket, X, Calendar, User } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';
import Spinner from './Spinner';
import { tickets as ticketsApi } from '../../api';
import toast from 'react-hot-toast';

/**
 * Modal for searching and selecting an existing ticket to add to the calendar.
 * When a ticket is selected, creates a new TicketSchedule entry for it.
 */
export default function TicketSearchModal({
  isOpen,
  onClose,
  prefilledDate,
  prefilledTime,
  onTicketScheduled,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [saving, setSaving] = useState(false);

  // Schedule form state
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');

  const searchInputRef = useRef(null);
  const debounceRef = useRef(null);

  // Focus search input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 100);

      // Initialize dates from pre-filled values
      if (prefilledDate) {
        const date = new Date(prefilledDate);
        const dateStr = date.toISOString().split('T')[0];
        setStartDate(dateStr);
        setEndDate(dateStr);
      }
      if (prefilledTime) {
        setStartTime(prefilledTime);
        // End time is 1 hour later
        const [h, m] = prefilledTime.split(':').map(Number);
        const endH = Math.min(h + 1, 23);
        setEndTime(`${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      }
    } else {
      // Reset state when closing
      setSearchQuery('');
      setSearchResults([]);
      setSelectedTicket(null);
    }
  }, [isOpen, prefilledDate, prefilledTime]);

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        // Search tickets by number or subject
        const data = await ticketsApi.getTickets({
          search: searchQuery,
          limit: 20,
        });
        setSearchResults(data.tickets || []);
      } catch (error) {
        console.error('Search failed:', error);
        toast.error('Failed to search tickets');
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(debounceRef.current);
  }, [searchQuery]);

  const handleSelectTicket = (ticket) => {
    setSelectedTicket(ticket);
  };

  const handleScheduleTicket = async () => {
    if (!selectedTicket || !startDate) {
      toast.error('Please select a ticket and date');
      return;
    }

    setSaving(true);
    try {
      // Create schedule entry
      const scheduledStart = new Date(`${startDate}T${startTime}`);
      const scheduledEnd = new Date(`${endDate}T${endTime}`);

      await ticketsApi.createSchedule(selectedTicket.id, {
        scheduledStart: scheduledStart.toISOString(),
        scheduledEnd: scheduledEnd.toISOString(),
        isAllDay: false,
      });

      toast.success(`Ticket #${selectedTicket.ticketNumber} added to calendar`);
      onTicketScheduled?.();
      onClose();
    } catch (error) {
      console.error('Failed to schedule ticket:', error);
      toast.error(error.response?.data?.error || 'Failed to add ticket to calendar');
    } finally {
      setSaving(false);
    }
  };

  // Get agent color helper
  const getAgentColor = (agent) => {
    if (!agent) return '#6B7280';
    return agent.color || '#6B7280';
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Existing Ticket to Calendar"
      size="lg"
    >
      <div className="space-y-4">
        {/* Search Input */}
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by ticket number or subject..."
            className="w-full pl-10 pr-4 py-2.5 text-base border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
          />
          {searching && (
            <Spinner size="sm" className="absolute right-3 top-1/2 -translate-y-1/2" />
          )}
        </div>

        {/* Search Results or Selected Ticket */}
        {selectedTicket ? (
          <div className="space-y-4">
            {/* Selected Ticket Display */}
            <div className="bg-primary/10 border border-primary/30 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div
                    className="w-3 h-3 rounded-full mt-1.5 flex-shrink-0"
                    style={{ backgroundColor: getAgentColor(selectedTicket.assignee) }}
                  />
                  <div>
                    <div className="font-medium text-gray-900">
                      #{selectedTicket.ticketNumber} - {selectedTicket.subject}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      {selectedTicket.assignee?.name || 'Unassigned'}
                      {selectedTicket.company && ` | ${selectedTicket.company.name}`}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedTicket(null)}
                  className="p-1 hover:bg-gray-200 rounded"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Schedule Form */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Calendar size={14} className="inline mr-1.5 mb-0.5" />
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    if (e.target.value > endDate) {
                      setEndDate(e.target.value);
                    }
                  }}
                  className="w-full px-3 py-2.5 text-base border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Calendar size={14} className="inline mr-1.5 mb-0.5" />
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2.5 text-base border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-3 py-2.5 text-base border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-3 py-2.5 text-base border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handleScheduleTicket} disabled={saving || !startDate}>
                {saving ? <Spinner size="sm" /> : 'Add to Calendar'}
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Results List */}
            <div className="max-h-[400px] overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
              {searchResults.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  {searchQuery ? (
                    searching ? 'Searching...' : 'No tickets found'
                  ) : (
                    <>
                      <Ticket size={32} className="mx-auto mb-2 opacity-50" />
                      <p>Type to search for tickets</p>
                    </>
                  )}
                </div>
              ) : (
                searchResults.map((ticket) => (
                  <button
                    key={ticket.id}
                    onClick={() => handleSelectTicket(ticket)}
                    className="w-full text-left p-3 hover:bg-gray-50 transition-colors flex items-start gap-3"
                  >
                    <div
                      className="w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0"
                      style={{ backgroundColor: getAgentColor(ticket.assignee) }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">
                          #{ticket.ticketNumber}
                        </span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          ticket.status === 'OPEN' ? 'bg-yellow-100 text-yellow-800' :
                          ticket.status === 'PENDING' ? 'bg-gray-100 text-gray-700' :
                          ticket.status === 'RESOLVED' ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {ticket.status}
                        </span>
                      </div>
                      <div className="text-sm text-gray-700 truncate mt-0.5">
                        {ticket.subject}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                        <User size={12} />
                        <span>{ticket.assignee?.name || 'Unassigned'}</span>
                        {ticket.company && (
                          <>
                            <span className="text-gray-300">|</span>
                            <span>{ticket.company.name}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>

            {/* Cancel button when no ticket selected */}
            <div className="flex justify-end pt-4 border-t">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
