import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, List, Grid3X3, Clock, User, X, Plus, Ticket, CalendarDays, Pencil, Trash2 } from 'lucide-react';
import { calendar, calendarEvents, agents, tickets as ticketsApi } from '../api';
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

// Default agent colors
const defaultAgentColors = {
  unassigned: '#9CA3AF',
};

export default function CalendarPage() {
  const navigate = useNavigate();
  const [view, setView] = useState('month'); // month, week, day
  const [currentDate, setCurrentDate] = useState(new Date());
  const [tickets, setTickets] = useState([]);
  const [events, setEvents] = useState([]);
  const [agentsList, setAgentsList] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState('');
  const [loading, setLoading] = useState(true);

  // Choice popup state (when clicking a time slot)
  const [showChoicePopup, setShowChoicePopup] = useState(false);
  const [choicePopupPosition, setChoicePopupPosition] = useState({ x: 0, y: 0 });
  const [selectedSlotDate, setSelectedSlotDate] = useState(null);
  const [selectedSlotTime, setSelectedSlotTime] = useState('09:00');

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

  // Calendar event modal state
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    startTime: '',
    endTime: '',
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

  const fetchCalendarData = async () => {
    setLoading(true);
    try {
      const [ticketsData, eventsData, agentsData] = await Promise.all([
        calendar.getCalendarTickets({
          start: dateRange.start.toISOString(),
          end: dateRange.end.toISOString(),
          agentId: selectedAgent || undefined,
        }),
        calendarEvents.getEvents({
          startDate: dateRange.start.toISOString(),
          endDate: dateRange.end.toISOString(),
          assigneeId: selectedAgent || undefined,
        }),
        agents.getAgents(),
      ]);
      setTickets(ticketsData.tickets || []);
      setEvents(eventsData || []);
      setAgentsList(agentsData.agents || []);
    } catch (error) {
      console.error('Failed to fetch calendar data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendarData();
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

  // Group events by date
  const eventsByDate = useMemo(() => {
    const grouped = {};
    events.forEach((event) => {
      const dateKey = new Date(event.startTime).toDateString();
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(event);
    });
    return grouped;
  }, [events]);

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
        key={`ticket-${ticket.id}`}
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

  const renderEventPill = (event) => {
    // Use agent color or custom event color, fallback to purple for events
    const eventColor = event.color || event.assignee?.color || '#8B5CF6';

    return (
      <button
        key={`event-${event.id}`}
        onClick={(e) => { e.stopPropagation(); handleEventClick(event); }}
        className="w-full text-left text-xs p-1 rounded border-l-4 truncate mb-0.5 hover:opacity-80 transition-opacity bg-purple-50 text-purple-800"
        style={{ borderLeftColor: eventColor }}
        title={`${event.title}${event.assignee ? ` - ${event.assignee.name}` : ''}`}
      >
        <CalendarDays size={10} className="inline mr-1" />
        {event.title}
      </button>
    );
  };

  // Navigate to day view when clicking a day in month view
  const handleDayClick = (date) => {
    setCurrentDate(date);
    setView('day');
  };

  // Show choice popup when clicking a time slot in day/week view
  const handleTimeSlotClick = (e, date, hour) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const time = `${hour.toString().padStart(2, '0')}:00`;

    setSelectedSlotDate(date);
    setSelectedSlotTime(time);
    setChoicePopupPosition({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    });
    setShowChoicePopup(true);
  };

  // Handle choosing "New Ticket" from popup
  const handleChooseNewTicket = () => {
    setShowChoicePopup(false);
    setNewTicketDate(selectedSlotDate);
    setNewTicketTime(selectedSlotTime);
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

  // Handle choosing "Calendar Event" from popup
  const handleChooseNewEvent = () => {
    setShowChoicePopup(false);
    setEditingEvent(null);

    // Create datetime string for the selected slot
    const startDateTime = new Date(selectedSlotDate);
    const [hours, minutes] = selectedSlotTime.split(':');
    startDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

    // Default end time is 1 hour later
    const endDateTime = new Date(startDateTime);
    endDateTime.setHours(endDateTime.getHours() + 1);

    setEventForm({
      title: '',
      description: '',
      startTime: formatDateTimeLocal(startDateTime),
      endTime: formatDateTimeLocal(endDateTime),
      assigneeId: '',
    });
    setShowEventModal(true);
  };

  // Handle clicking on an existing event
  const handleEventClick = (event) => {
    setEditingEvent(event);
    setEventForm({
      title: event.title,
      description: event.description || '',
      startTime: formatDateTimeLocal(new Date(event.startTime)),
      endTime: event.endTime ? formatDateTimeLocal(new Date(event.endTime)) : '',
      assigneeId: event.assigneeId || '',
    });
    setShowEventModal(true);
  };

  // Format date for datetime-local input
  const formatDateTimeLocal = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const mins = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${mins}`;
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
      await fetchCalendarData();
      // Navigate to the new ticket
      navigate(`/tickets/${result.id}`);
    } catch (error) {
      console.error('Failed to create ticket:', error);
      toast.error(error.response?.data?.error || 'Failed to create ticket');
    } finally {
      setSaving(false);
    }
  };

  // Save calendar event (create or update)
  const handleSaveEvent = async (e) => {
    e.preventDefault();
    if (!eventForm.title || !eventForm.startTime) {
      toast.error('Title and start time are required');
      return;
    }
    setSaving(true);
    try {
      const eventData = {
        title: eventForm.title,
        description: eventForm.description || null,
        startTime: new Date(eventForm.startTime).toISOString(),
        endTime: eventForm.endTime ? new Date(eventForm.endTime).toISOString() : null,
        assigneeId: eventForm.assigneeId || null,
        // If an agent is assigned, use their color; otherwise null
        color: null,
      };

      if (editingEvent) {
        await calendarEvents.updateEvent(editingEvent.id, eventData);
        toast.success('Event updated successfully');
      } else {
        await calendarEvents.createEvent(eventData);
        toast.success('Event created successfully');
      }

      setShowEventModal(false);
      await fetchCalendarData();
    } catch (error) {
      console.error('Failed to save event:', error);
      toast.error(error.response?.data?.error || 'Failed to save event');
    } finally {
      setSaving(false);
    }
  };

  // Delete calendar event
  const handleDeleteEvent = async () => {
    if (!editingEvent) return;
    if (!window.confirm('Are you sure you want to delete this event?')) return;

    setSaving(true);
    try {
      await calendarEvents.deleteEvent(editingEvent.id);
      toast.success('Event deleted successfully');
      setShowEventModal(false);
      await fetchCalendarData();
    } catch (error) {
      console.error('Failed to delete event:', error);
      toast.error(error.response?.data?.error || 'Failed to delete event');
    } finally {
      setSaving(false);
    }
  };

  // Close choice popup when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setShowChoicePopup(false);
    if (showChoicePopup) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showChoicePopup]);

  const renderMonthView = () => (
    <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden">
      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
        <div key={day} className="bg-gray-50 p-2 text-center text-xs font-medium text-gray-500">
          {day}
        </div>
      ))}
      {calendarDays.map(({ date, isCurrentMonth }, idx) => {
        const dayTickets = ticketsByDate[date.toDateString()] || [];
        const dayEvents = eventsByDate[date.toDateString()] || [];
        const allItems = [...dayEvents, ...dayTickets];
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
              {dayEvents.slice(0, 1).map(renderEventPill)}
              {dayTickets.slice(0, 2).map(renderTicketPill)}
              {allItems.length > 3 && (
                <div className="text-xs text-gray-500 pl-1">
                  +{allItems.length - 3} more
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
          const dayEvents = eventsByDate[date.toDateString()] || [];
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
                {dayEvents.map(renderEventPill)}
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
    const dayEvents = eventsByDate[currentDate.toDateString()] || [];
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
                  onClick={(e) => handleTimeSlotClick(e, currentDate, hour)}
                  title={`Click to add at ${hour > 12 ? `${hour - 12} PM` : hour === 12 ? '12 PM' : `${hour} AM`}`}
                >
                  <div className="opacity-0 group-hover:opacity-100 flex items-center justify-center h-full text-primary text-xs">
                    <Plus size={14} className="mr-1" /> Add
                  </div>
                </div>
              ))}
            </div>
            {/* Events and Tickets */}
            <div className="relative p-2 space-y-2 pointer-events-none">
              {/* Calendar Events */}
              {dayEvents.map((event) => {
                const eventColor = event.color || event.assignee?.color || '#8B5CF6';
                return (
                  <button
                    key={`event-${event.id}`}
                    onClick={(e) => { e.stopPropagation(); handleEventClick(event); }}
                    className="w-full text-left p-2 rounded border-l-4 pointer-events-auto bg-purple-50 text-purple-800 hover:opacity-80 transition-opacity"
                    style={{ borderLeftColor: eventColor }}
                  >
                    <div className="flex items-center gap-2">
                      <CalendarDays size={14} className="text-purple-600" />
                      <span className="font-medium text-sm">{event.title}</span>
                    </div>
                    {event.description && (
                      <div className="text-xs text-purple-600 truncate mt-1">{event.description}</div>
                    )}
                    {event.assignee && (
                      <div className="flex items-center gap-1 mt-1 text-xs opacity-75">
                        <User size={12} />
                        <span
                          className="w-2 h-2 rounded-full mr-1"
                          style={{ backgroundColor: event.assignee.color || '#9CA3AF' }}
                        />
                        {event.assignee.name}
                      </div>
                    )}
                    <div className="text-xs text-purple-500 mt-1">
                      {new Date(event.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      {event.endTime && ` - ${new Date(event.endTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`}
                    </div>
                  </button>
                );
              })}
              {/* Tickets */}
              {dayTickets.map((ticket) => {
                const agentColor = ticket.assignee?.color || '#9CA3AF';
                const statusBg = statusColors[ticket.status] || 'bg-gray-100';
                const statusText = statusTextColors[ticket.status] || 'text-gray-700';
                const statusDot = statusDotColors[ticket.status] || 'bg-gray-500';

                return (
                  <button
                    key={`ticket-${ticket.id}`}
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
              {dayTickets.length === 0 && dayEvents.length === 0 && (
                <div className="text-center py-8 text-gray-500 pointer-events-auto">
                  Click a time slot to add a ticket or event
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

      {/* Choice Popup (New Ticket vs Calendar Event) */}
      {showChoicePopup && (
        <div
          className="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-2"
          style={{
            left: choicePopupPosition.x,
            top: choicePopupPosition.y,
            transform: 'translate(-50%, -50%)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex gap-2">
            <button
              onClick={handleChooseNewTicket}
              className="flex items-center gap-2 px-4 py-3 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
            >
              <Ticket size={18} />
              <span className="font-medium">New Ticket</span>
            </button>
            <button
              onClick={handleChooseNewEvent}
              className="flex items-center gap-2 px-4 py-3 rounded-lg bg-purple-100 hover:bg-purple-200 text-purple-700 transition-colors"
            >
              <CalendarDays size={18} />
              <span className="font-medium">Calendar Event</span>
            </button>
          </div>
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

      {/* Calendar Event Modal */}
      <Modal
        isOpen={showEventModal}
        onClose={() => setShowEventModal(false)}
        title={editingEvent ? 'Edit Calendar Event' : 'New Calendar Event'}
        size="md"
      >
        <form onSubmit={handleSaveEvent} className="space-y-4">
          {/* Title */}
          <Input
            label={<>Title <span className="text-red-500">*</span></>}
            value={eventForm.title}
            onChange={(e) => setEventForm(prev => ({ ...prev, title: e.target.value }))}
            placeholder="Event title"
            required
          />

          {/* Start and End Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Time <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={eventForm.startTime}
                onChange={(e) => setEventForm(prev => ({ ...prev, startTime: e.target.value }))}
                className="w-full px-3 py-2.5 text-base md:text-sm border border-gray-300 rounded-lg focus:ring-primary focus:border-primary min-h-[44px]"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
              <input
                type="datetime-local"
                value={eventForm.endTime}
                onChange={(e) => setEventForm(prev => ({ ...prev, endTime: e.target.value }))}
                className="w-full px-3 py-2.5 text-base md:text-sm border border-gray-300 rounded-lg focus:ring-primary focus:border-primary min-h-[44px]"
              />
            </div>
          </div>

          {/* Assignee */}
          <Select
            label="Assign to Agent"
            value={eventForm.assigneeId}
            onChange={(e) => setEventForm(prev => ({ ...prev, assigneeId: e.target.value }))}
            options={[
              { value: '', label: 'Unassigned' },
              ...agentsList.map(a => ({ value: a.id, label: a.name })),
            ]}
          />

          {/* Description */}
          <Textarea
            label="Description"
            value={eventForm.description}
            onChange={(e) => setEventForm(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Optional notes or details"
            rows={3}
          />

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row justify-between gap-3 pt-4 border-t">
            <div>
              {editingEvent && (
                <Button
                  type="button"
                  variant="danger"
                  onClick={handleDeleteEvent}
                  disabled={saving}
                  className="w-full sm:w-auto"
                >
                  <Trash2 size={16} className="mr-1" />
                  Delete
                </Button>
              )}
            </div>
            <div className="flex flex-col-reverse sm:flex-row gap-3">
              <Button type="button" variant="outline" onClick={() => setShowEventModal(false)} className="w-full sm:w-auto">
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="w-full sm:w-auto">
                {saving ? <Spinner size="sm" /> : editingEvent ? 'Update Event' : 'Create Event'}
              </Button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
