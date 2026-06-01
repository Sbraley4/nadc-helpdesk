import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, List, Grid3X3, Clock, User, X, Plus } from 'lucide-react';
import { calendar, agents, tickets as ticketsApi } from '../api';
import { Spinner, Badge, Avatar, Button, Input, Textarea, Select, Modal, ContactTypeahead, CompanyTypeahead } from '../components/shared';
import toast from 'react-hot-toast';

const priorityColors = {
  LOW: 'bg-gray-100 text-gray-700 border-gray-300',
  MEDIUM: 'bg-blue-100 text-blue-700 border-blue-300',
  HIGH: 'bg-orange-100 text-orange-700 border-orange-300',
  URGENT: 'bg-red-100 text-red-700 border-red-300',
};

// Status colors for calendar backgrounds (lighter versions)
const statusColors = {
  OPEN: 'bg-yellow-100',
  PENDING: 'bg-gray-100',
  INVOICED: 'bg-green-100',
  POSTED: 'bg-pink-100',
  CLOSED: 'bg-gray-200',
};

// Status dot colors (solid)
const statusDotColors = {
  OPEN: 'bg-yellow-500',
  PENDING: 'bg-gray-500',
  INVOICED: 'bg-green-500',
  POSTED: 'bg-pink-500',
  CLOSED: 'bg-gray-700',
};

// Status text colors
const statusTextColors = {
  OPEN: 'text-yellow-800',
  PENDING: 'text-gray-700',
  INVOICED: 'text-green-800',
  POSTED: 'text-pink-800',
  CLOSED: 'text-gray-600',
};

export default function CalendarPage() {
  const navigate = useNavigate();
  const [view, setView] = useState('month'); // month, week, day
  const [currentDate, setCurrentDate] = useState(new Date());
  const [tickets, setTickets] = useState([]);
  const [agentsList, setAgentsList] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState('');
  const [loading, setLoading] = useState(true);

  // New ticket modal state
  const [showNewTicketModal, setShowNewTicketModal] = useState(false);
  const [newTicketDate, setNewTicketDate] = useState(null);
  const [newTicketTime, setNewTicketTime] = useState('09:00');
  const [saving, setSaving] = useState(false);
  const [newTicketForm, setNewTicketForm] = useState({
    subject: '',
    description: '',
    priority: 'MEDIUM',
    contactId: '',
    companyId: '',
    assigneeId: '',
  });

  // Get date range based on current view
  const dateRange = useMemo(() => {
    const start = new Date(currentDate);
    const end = new Date(currentDate);

    if (view === 'month') {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(end.getMonth() + 1);
      end.setDate(0);
      end.setHours(23, 59, 59, 999);
    } else if (view === 'week') {
      const day = start.getDay();
      start.setDate(start.getDate() - day);
      start.setHours(0, 0, 0, 0);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    }

    return { start, end };
  }, [currentDate, view]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [ticketsData, agentsData] = await Promise.all([
          calendar.getCalendarTickets({
            start: dateRange.start.toISOString(),
            end: dateRange.end.toISOString(),
            agentId: selectedAgent || undefined,
          }),
          agents.getAgents(),
        ]);
        setTickets(ticketsData.tickets || []);
        setAgentsList(agentsData.agents || []);
      } catch (error) {
        console.error('Failed to fetch calendar data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [dateRange.start, dateRange.end, selectedAgent]);

  const navigate_date = (direction) => {
    const newDate = new Date(currentDate);
    if (view === 'month') {
      newDate.setMonth(newDate.getMonth() + direction);
    } else if (view === 'week') {
      newDate.setDate(newDate.getDate() + direction * 7);
    } else {
      newDate.setDate(newDate.getDate() + direction);
    }
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const formatDateHeader = () => {
    const options = { month: 'long', year: 'numeric' };
    if (view === 'day') {
      return currentDate.toLocaleDateString('en-US', { ...options, day: 'numeric', weekday: 'long' });
    }
    return currentDate.toLocaleDateString('en-US', options);
  };

  // Group tickets by date
  const ticketsByDate = useMemo(() => {
    const grouped = {};
    tickets.forEach((ticket) => {
      const dateKey = ticket.scheduledDate
        ? new Date(ticket.scheduledDate).toDateString()
        : ticket.dueDate
        ? new Date(ticket.dueDate).toDateString()
        : null;
      if (dateKey) {
        if (!grouped[dateKey]) grouped[dateKey] = [];
        grouped[dateKey].push(ticket);
      }
    });
    return grouped;
  }, [tickets]);

  // Generate calendar days for month view
  const calendarDays = useMemo(() => {
    if (view !== 'month') return [];

    const days = [];
    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const startPadding = firstDay.getDay();

    // Previous month padding
    for (let i = startPadding - 1; i >= 0; i--) {
      const date = new Date(firstDay);
      date.setDate(date.getDate() - i - 1);
      days.push({ date, isCurrentMonth: false });
    }

    // Current month
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), d);
      days.push({ date, isCurrentMonth: true });
    }

    // Next month padding
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const date = new Date(lastDay);
      date.setDate(date.getDate() + i);
      days.push({ date, isCurrentMonth: false });
    }

    return days;
  }, [currentDate, view]);

  // Generate week days
  const weekDays = useMemo(() => {
    if (view !== 'week') return [];

    const days = [];
    const start = new Date(currentDate);
    const day = start.getDay();
    start.setDate(start.getDate() - day);

    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setDate(date.getDate() + i);
      days.push(date);
    }

    return days;
  }, [currentDate, view]);

  const isToday = (date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const renderTicketPill = (ticket) => {
    // Agent color for left border (default to gray if no assignee)
    const agentColor = ticket.assignee?.color || '#9CA3AF';
    // Status color for background
    const statusBg = statusColors[ticket.status] || 'bg-gray-100';
    const statusText = statusTextColors[ticket.status] || 'text-gray-700';
    const statusDot = statusDotColors[ticket.status] || 'bg-gray-500';

    return (
      <button
        key={ticket.id}
        onClick={(e) => { e.stopPropagation(); navigate(`/tickets/${ticket.id}`); }}
        className={`w-full text-left text-xs p-1 rounded border-l-4 truncate mb-0.5 hover:opacity-80 transition-opacity ${statusBg} ${statusText}`}
        style={{ borderLeftColor: agentColor }}
        title={`${ticket.subject}${ticket.assignee ? ` - ${ticket.assignee.name}` : ''}`}
      >
        <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${statusDot}`} />
        <span className="font-bold">#{ticket.ticketNumber}</span> {ticket.subject}
      </button>
    );
  };

  // Navigate to day view when clicking a day in month view
  const handleDayClick = (date) => {
    setCurrentDate(date);
    setView('day');
  };

  // Open new ticket modal when clicking a time slot in day/week view
  const handleTimeSlotClick = (date, hour) => {
    const time = `${hour.toString().padStart(2, '0')}:00`;
    setNewTicketDate(date);
    setNewTicketTime(time);
    setNewTicketForm({
      subject: '',
      description: '',
      priority: 'MEDIUM',
      contactId: '',
      companyId: '',
      assigneeId: '',
    });
    setShowNewTicketModal(true);
  };

  // Create ticket from modal
  const handleCreateTicket = async (e) => {
    e.preventDefault();
    if (!newTicketForm.subject || !newTicketForm.contactId) {
      toast.error('Subject and contact are required');
      return;
    }
    setSaving(true);
    try {
      // Combine date and time for dueDate
      const dueDateTime = new Date(newTicketDate);
      const [hours, minutes] = newTicketTime.split(':');
      dueDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

      const ticketData = {
        subject: newTicketForm.subject,
        description: newTicketForm.description,
        priority: newTicketForm.priority,
        requesterId: newTicketForm.contactId,
        companyId: newTicketForm.companyId || null,
        assigneeId: newTicketForm.assigneeId || null,
        dueDate: dueDateTime.toISOString(),
      };

      const result = await ticketsApi.createTicket(ticketData);
      toast.success('Ticket created successfully');
      setShowNewTicketModal(false);
      // Refresh calendar data
      const ticketsData = await calendar.getCalendarTickets({
        start: dateRange.start.toISOString(),
        end: dateRange.end.toISOString(),
        agentId: selectedAgent || undefined,
      });
      setTickets(ticketsData.tickets || []);
      // Navigate to the new ticket
      navigate(`/tickets/${result.id}`);
    } catch (error) {
      console.error('Failed to create ticket:', error);
      toast.error(error.response?.data?.error || 'Failed to create ticket');
    } finally {
      setSaving(false);
    }
  };

  const renderMonthView = () => (
    <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden">
      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
        <div key={day} className="bg-gray-50 p-2 text-center text-xs font-medium text-gray-500">
          {day}
        </div>
      ))}
      {calendarDays.map(({ date, isCurrentMonth }, idx) => {
        const dayTickets = ticketsByDate[date.toDateString()] || [];
        return (
          <div
            key={idx}
            onClick={() => handleDayClick(date)}
            className={`bg-white p-1 min-h-[80px] md:min-h-[100px] cursor-pointer hover:bg-gray-50 transition-colors ${
              !isCurrentMonth ? 'opacity-50' : ''
            }`}
            title="Click to view day schedule"
          >
            <div
              className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                isToday(date)
                  ? 'bg-primary text-white'
                  : 'text-gray-700'
              }`}
            >
              {date.getDate()}
            </div>
            <div className="space-y-0.5 overflow-hidden max-h-[60px] md:max-h-[80px]">
              {dayTickets.slice(0, 3).map(renderTicketPill)}
              {dayTickets.length > 3 && (
                <div className="text-xs text-gray-500 pl-1">
                  +{dayTickets.length - 3} more
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderWeekView = () => (
    <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
      <div className="grid grid-cols-7 gap-1 md:gap-2 min-w-[640px] md:min-w-0">
        {weekDays.map((date, idx) => {
          const dayTickets = ticketsByDate[date.toDateString()] || [];
          return (
            <div key={idx} className="min-h-[200px] md:min-h-[300px]">
              <div
                className={`text-center p-1.5 md:p-2 rounded-t-lg ${
                  isToday(date) ? 'bg-primary text-white' : 'bg-gray-100'
                }`}
              >
                <div className="text-xs">{date.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                <div className="text-base md:text-lg font-semibold">{date.getDate()}</div>
              </div>
              <div className="bg-white border border-t-0 border-gray-200 rounded-b-lg p-1.5 md:p-2 space-y-1 min-h-[160px] md:min-h-[250px]">
                {dayTickets.map(renderTicketPill)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderDayView = () => {
    const dayTickets = ticketsByDate[currentDate.toDateString()] || [];
    const hours = Array.from({ length: 12 }, (_, i) => i + 8); // 8 AM to 7 PM

    return (
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="grid grid-cols-[80px_1fr] divide-x divide-gray-200">
          <div className="divide-y divide-gray-100">
            {hours.map((hour) => (
              <div key={hour} className="h-16 p-2 text-xs text-gray-500">
                {hour > 12 ? `${hour - 12} PM` : hour === 12 ? '12 PM' : `${hour} AM`}
              </div>
            ))}
          </div>
          <div className="relative">
            {/* Clickable time slots */}
            <div className="absolute inset-0 divide-y divide-gray-100">
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="h-16 cursor-pointer hover:bg-primary/5 transition-colors group"
                  onClick={() => handleTimeSlotClick(currentDate, hour)}
                  title={`Click to create ticket at ${hour > 12 ? `${hour - 12} PM` : hour === 12 ? '12 PM' : `${hour} AM`}`}
                >
                  <div className="opacity-0 group-hover:opacity-100 flex items-center justify-center h-full text-primary text-xs">
                    <Plus size={14} className="mr-1" /> New Ticket
                  </div>
                </div>
              ))}
            </div>
            {/* Tickets */}
            <div className="relative p-2 space-y-2 pointer-events-none">
              {dayTickets.map((ticket) => {
                const agentColor = ticket.assignee?.color || '#9CA3AF';
                const statusBg = statusColors[ticket.status] || 'bg-gray-100';
                const statusText = statusTextColors[ticket.status] || 'text-gray-700';
                const statusDot = statusDotColors[ticket.status] || 'bg-gray-500';

                return (
                  <button
                    key={ticket.id}
                    onClick={(e) => { e.stopPropagation(); navigate(`/tickets/${ticket.id}`); }}
                    className={`w-full text-left p-2 rounded border-l-4 pointer-events-auto ${statusBg} ${statusText} hover:opacity-80 transition-opacity`}
                    style={{ borderLeftColor: agentColor }}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${statusDot}`} />
                      <span className="font-bold text-sm">#{ticket.ticketNumber}</span>
                    </div>
                    <div className="text-sm truncate">{ticket.subject}</div>
                    {ticket.assignee && (
                      <div className="flex items-center gap-1 mt-1 text-xs opacity-75">
                        <User size={12} />
                        <span
                          className="w-2 h-2 rounded-full mr-1"
                          style={{ backgroundColor: agentColor }}
                        />
                        {ticket.assignee.name}
                      </div>
                    )}
                  </button>
                );
              })}
              {dayTickets.length === 0 && (
                <div className="text-center py-8 text-gray-500 pointer-events-auto">
                  Click a time slot to create a new ticket
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header Controls */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
        {/* Navigation */}
        <div className="flex items-center justify-between md:justify-start gap-2">
          <div className="flex items-center gap-1">
            <button
              onClick={() => navigate_date(-1)}
              className="p-2.5 hover:bg-gray-100 rounded-lg transition-colors touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={goToToday}
              className="px-3 py-2 text-sm font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors touch-manipulation min-h-[44px]"
            >
              Today
            </button>
            <button
              onClick={() => navigate_date(1)}
              className="p-2.5 hover:bg-gray-100 rounded-lg transition-colors touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              <ChevronRight size={20} />
            </button>
          </div>
          <h2 className="text-base md:text-lg font-semibold text-gray-900 md:ml-2 truncate">
            {formatDateHeader()}
          </h2>
        </div>

        {/* Filters and View Toggle */}
        <div className="flex items-center gap-2 md:gap-3">
          {/* Agent Filter */}
          <select
            value={selectedAgent}
            onChange={(e) => setSelectedAgent(e.target.value)}
            className="flex-1 md:flex-none text-sm border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-[44px] bg-white"
          >
            <option value="">All Technicians</option>
            {agentsList.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>

          {/* Agent Color Legend */}
          <div className="hidden md:flex items-center gap-3 text-xs">
            {agentsList.filter(a => a.color).map((agent) => (
              <div key={agent.id} className="flex items-center gap-1">
                <span
                  className="w-3 h-3 rounded-sm border border-gray-300"
                  style={{ backgroundColor: agent.color }}
                />
                <span className="text-gray-600">{agent.name.split(' ')[0]}</span>
              </div>
            ))}
          </div>

          {/* View Toggle */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setView('month')}
              className={`p-2 md:px-3 md:py-1.5 text-sm rounded-md transition-colors touch-manipulation min-w-[40px] min-h-[36px] flex items-center justify-center ${
                view === 'month' ? 'bg-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Grid3X3 size={16} className="md:hidden" />
              <span className="hidden md:inline">Month</span>
            </button>
            <button
              onClick={() => setView('week')}
              className={`p-2 md:px-3 md:py-1.5 text-sm rounded-md transition-colors touch-manipulation min-w-[40px] min-h-[36px] flex items-center justify-center ${
                view === 'week' ? 'bg-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <CalendarIcon size={16} className="md:hidden" />
              <span className="hidden md:inline">Week</span>
            </button>
            <button
              onClick={() => setView('day')}
              className={`p-2 md:px-3 md:py-1.5 text-sm rounded-md transition-colors touch-manipulation min-w-[40px] min-h-[36px] flex items-center justify-center ${
                view === 'day' ? 'bg-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <List size={16} className="md:hidden" />
              <span className="hidden md:inline">Day</span>
            </button>
          </div>
        </div>
      </div>

      {/* Calendar Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : (
        <div className="overflow-x-auto">
          {view === 'month' && renderMonthView()}
          {view === 'week' && renderWeekView()}
          {view === 'day' && renderDayView()}
        </div>
      )}

      {/* New Ticket Modal */}
      <Modal
        isOpen={showNewTicketModal}
        onClose={() => setShowNewTicketModal(false)}
        title="Create New Ticket"
        size="lg"
      >
        <form onSubmit={handleCreateTicket} className="space-y-4">
          {/* Date and Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date"
                value={newTicketDate ? `${newTicketDate.getFullYear()}-${String(newTicketDate.getMonth() + 1).padStart(2, '0')}-${String(newTicketDate.getDate()).padStart(2, '0')}` : ''}
                onChange={(e) => {
                  // Parse date as local time to avoid timezone offset issues
                  const [year, month, day] = e.target.value.split('-').map(Number);
                  setNewTicketDate(new Date(year, month - 1, day));
                }}
                className="w-full px-3 py-2.5 text-base md:text-sm border border-gray-300 rounded-lg focus:ring-primary focus:border-primary min-h-[44px]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
              <input
                type="time"
                value={newTicketTime}
                onChange={(e) => setNewTicketTime(e.target.value)}
                className="w-full px-3 py-2.5 text-base md:text-sm border border-gray-300 rounded-lg focus:ring-primary focus:border-primary min-h-[44px]"
              />
            </div>
          </div>

          {/* Subject */}
          <Input
            label={<>Subject <span className="text-red-500">*</span></>}
            value={newTicketForm.subject}
            onChange={(e) => setNewTicketForm(prev => ({ ...prev, subject: e.target.value }))}
            placeholder="Brief description of the issue"
            required
          />

          {/* Contact and Company */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
            <ContactTypeahead
              label="Contact"
              required
              value={newTicketForm.contactId}
              onChange={(id) => setNewTicketForm(prev => ({ ...prev, contactId: id }))}
            />
            <CompanyTypeahead
              label="Company"
              value={newTicketForm.companyId}
              onChange={(id) => setNewTicketForm(prev => ({ ...prev, companyId: id }))}
            />
          </div>

          {/* Priority and Assignee */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
            <Select
              label="Priority"
              value={newTicketForm.priority}
              onChange={(e) => setNewTicketForm(prev => ({ ...prev, priority: e.target.value }))}
              options={[
                { value: 'LOW', label: 'Low' },
                { value: 'MEDIUM', label: 'Medium' },
                { value: 'HIGH', label: 'High' },
                { value: 'URGENT', label: 'Urgent' },
              ]}
            />
            <Select
              label="Assignee"
              value={newTicketForm.assigneeId}
              onChange={(e) => setNewTicketForm(prev => ({ ...prev, assigneeId: e.target.value }))}
              options={[
                { value: '', label: 'Unassigned' },
                ...agentsList.map(a => ({ value: a.id, label: a.name })),
              ]}
            />
          </div>

          {/* Description */}
          <Textarea
            label="Description"
            value={newTicketForm.description}
            onChange={(e) => setNewTicketForm(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Detailed description of the issue"
            rows={3}
          />

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => setShowNewTicketModal(false)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="w-full sm:w-auto">
              {saving ? <Spinner size="sm" /> : 'Create Ticket'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
