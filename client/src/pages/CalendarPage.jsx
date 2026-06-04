import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, List, Grid3X3, Clock, User, X, Plus, Ticket, CalendarDays, Pencil, Trash2 } from 'lucide-react';
import { calendar, calendarEvents, agents, tickets as ticketsApi, contacts, companies } from '../api';
import { Spinner, Badge, Avatar, Button, Input, Textarea, Select, Modal, ContactTypeahead, CompanyTypeahead, MultiSelectAgents, PhoneInput } from '../components/shared';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  RESOLVED: 'bg-slate-100',
  INVOICED: 'bg-green-100',
  POSTED: 'bg-pink-100',
  CLOSED: 'bg-gray-200',
};

// Status dot colors (solid)
const statusDotColors = {
  OPEN: 'bg-yellow-500',
  PENDING: 'bg-gray-500',
  RESOLVED: 'bg-slate-500',
  INVOICED: 'bg-green-500',
  POSTED: 'bg-pink-500',
  CLOSED: 'bg-gray-700',
};

// Status text colors
const statusTextColors = {
  OPEN: 'text-yellow-800',
  PENDING: 'text-gray-700',
  RESOLVED: 'text-slate-700',
  INVOICED: 'text-green-800',
  POSTED: 'text-pink-800',
  CLOSED: 'text-gray-600',
};

// Status stripe colors (hex for inline styles)
const statusStripeColors = {
  OPEN: '#EAB308',     // yellow-500
  PENDING: '#6B7280',  // gray-500
  RESOLVED: '#64748B', // slate-500
  INVOICED: '#22C55E', // green-500
  POSTED: '#EC4899',   // pink-500
  CLOSED: '#374151',   // gray-700
};

// Agent color mapping by name (hardcoded as fallback)
const AGENT_COLORS = {
  'Peter Braley': '#2563EB',  // Blue
  'Sam Braley': '#DC2626',    // Red
  'Chris Lowrance': '#CA8A04', // Yellow/Amber
};
const UNASSIGNED_COLOR = '#6B7280'; // Grey

// Helper to get agent color by name or from agent object
const getAgentColor = (agent) => {
  if (!agent) return UNASSIGNED_COLOR;
  // First try the database color, then fallback to hardcoded by name
  return agent.color || AGENT_COLORS[agent.name] || UNASSIGNED_COLOR;
};

// Helper to get all agent colors for a ticket (primary + additional)
const getAllAgentColors = (ticket) => {
  const colors = [];
  if (ticket.assignee) {
    colors.push(getAgentColor(ticket.assignee));
  }
  if (ticket.additionalAssignees && ticket.additionalAssignees.length > 0) {
    ticket.additionalAssignees.forEach(assignee => {
      colors.push(getAgentColor(assignee));
    });
  }
  // If no assignees, use unassigned color
  if (colors.length === 0) {
    colors.push(UNASSIGNED_COLOR);
  }
  return colors;
};

// Helper to convert hex color to muted/pastel version
const muteColor = (hex, opacity = 0.7) => {
  // Convert hex to RGB, then return as rgba with reduced opacity
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  // Blend with white to create pastel effect, then apply opacity
  const blend = 0.3; // 30% white blend for softer colors
  const pr = Math.round(r + (255 - r) * blend);
  const pg = Math.round(g + (255 - g) * blend);
  const pb = Math.round(b + (255 - b) * blend);
  return `rgba(${pr}, ${pg}, ${pb}, ${opacity})`;
};

// Generate CSS background for agent colors (solid or diagonal stripes)
const getAgentBackground = (colors) => {
  if (colors.length === 1) {
    return { backgroundColor: colors[0] };
  }

  // Multiple colors: create wide diagonal stripe pattern (3-4 stripes visible)
  const stripeWidth = 45; // much wider stripes for cleaner look
  const gradientStops = [];
  const totalWidth = colors.length * stripeWidth;

  colors.forEach((color, index) => {
    const mutedColor = muteColor(color, 0.85);
    const startPercent = (index * stripeWidth / totalWidth) * 100;
    const endPercent = ((index + 1) * stripeWidth / totalWidth) * 100;
    gradientStops.push(`${mutedColor} ${startPercent}%`);
    gradientStops.push(`${mutedColor} ${endPercent}%`);
  });

  return {
    backgroundImage: `repeating-linear-gradient(
      135deg,
      ${gradientStops.join(', ')}
    )`,
    backgroundSize: `${totalWidth}px ${totalWidth}px`,
  };
};

export default function CalendarPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [view, setView] = useState('month'); // month, week, day
  const [currentDate, setCurrentDate] = useState(new Date());
  const [tickets, setTickets] = useState([]);
  const [events, setEvents] = useState([]);
  const [agentsList, setAgentsList] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState('');
  const [loading, setLoading] = useState(true);

  // New client modal state
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [newClientForm, setNewClientForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    companyId: '',
  });

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
    additionalAssigneeIds: [],
  });

  // Calendar event modal state
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    startTime: '',
    endTime: '',
    assigneeIds: [],
  });

  // Get companies for new client modal
  const { data: companiesData } = useQuery({
    queryKey: ['companies'],
    queryFn: () => companies.getCompanies({ limit: 500 }),
  });

  // Create contact mutation
  const createContactMutation = useMutation({
    mutationFn: contacts.createContact,
    onSuccess: (data) => {
      queryClient.invalidateQueries(['contacts']);
      queryClient.invalidateQueries(['contacts-search']);
      // Auto-populate the contact selector with the new contact
      const newContact = data.contact || data;
      setNewTicketForm(prev => ({ ...prev, contactId: newContact.id }));
      setShowNewClientModal(false);
      setNewClientForm({ firstName: '', lastName: '', email: '', phone: '', companyId: '' });
      toast.success('Client created successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to create client');
    },
  });

  const handleCreateNewClient = () => {
    if (!newClientForm.firstName.trim() || !newClientForm.lastName.trim() || !newClientForm.email.trim()) {
      toast.error('First name, last name, and email are required');
      return;
    }
    createContactMutation.mutate({
      name: `${newClientForm.firstName.trim()} ${newClientForm.lastName.trim()}`,
      email: newClientForm.email.trim(),
      phone: newClientForm.phone.trim() || undefined,
      companyId: newClientForm.companyId || undefined,
    });
  };

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
          assigneeId: selectedAgent || undefined,
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
    // Get all agent colors and generate background
    const agentColors = getAllAgentColors(ticket);
    const agentBgStyle = getAgentBackground(agentColors);
    const statusStripe = statusStripeColors[ticket.status] || '#6B7280';

    // Build assignee names for tooltip
    const assigneeNames = [
      ticket.assignee?.name,
      ...(ticket.additionalAssignees || []).map(a => a.name)
    ].filter(Boolean).join(', ');

    return (
      <button
        key={`ticket-${ticket.id}`}
        onClick={(e) => { e.stopPropagation(); navigate(`/tickets/${ticket.id}`); }}
        className="w-full text-left text-xs rounded overflow-hidden mb-0.5 hover:opacity-90 transition-opacity"
        style={agentBgStyle}
        title={`${ticket.subject}${assigneeNames ? ` - ${assigneeNames}` : ''}`}
      >
        {/* Status stripe at top */}
        <div className="h-1" style={{ backgroundColor: statusStripe }} />
        {/* Content with white text */}
        <div className="p-1 text-white" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
          <span className="font-bold">#{ticket.ticketNumber}</span> {ticket.subject}
        </div>
      </button>
    );
  };

  const renderEventPill = (event) => {
    // Use first agent's color via helper, fallback to unassigned color
    const firstAssignee = event.assignees?.[0];
    const eventColor = event.color || getAgentColor(firstAssignee);
    const assigneeNames = event.assignees?.map(a => a.name).join(', ') || '';

    // Generate light background color from agent color
    const bgStyle = {
      borderLeftColor: eventColor,
      backgroundColor: `${eventColor}15`, // 15 = ~8% opacity in hex
    };

    return (
      <button
        key={`event-${event.id}`}
        onClick={(e) => { e.stopPropagation(); handleEventClick(event); }}
        className="w-full text-left text-xs p-1 rounded border-l-4 truncate mb-0.5 hover:opacity-80 transition-opacity"
        style={bgStyle}
        title={`${event.title}${assigneeNames ? ` - ${assigneeNames}` : ''}`}
      >
        <CalendarDays size={10} className="inline mr-1" style={{ color: eventColor }} />
        <span style={{ color: eventColor }}>{event.title}</span>
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
      additionalAssigneeIds: [],
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
      assigneeIds: [],
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
      assigneeIds: event.assignees?.map(a => a.id) || [],
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
        additionalAssigneeIds: newTicketForm.additionalAssigneeIds.length > 0 ? newTicketForm.additionalAssigneeIds : undefined,
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
        assigneeIds: eventForm.assigneeIds,
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

  // Ref to track if popup was just opened (to prevent immediate close from same click)
  const popupJustOpenedRef = useRef(false);

  // Close choice popup when clicking outside
  useEffect(() => {
    if (!showChoicePopup) {
      popupJustOpenedRef.current = false;
      return;
    }

    // Mark that popup was just opened
    popupJustOpenedRef.current = true;

    const handleClickOutside = (e) => {
      // Ignore the first click that opened the popup
      if (popupJustOpenedRef.current) {
        popupJustOpenedRef.current = false;
        return;
      }
      // Don't close if clicking inside the popup
      const popup = document.querySelector('[data-choice-popup]');
      if (popup && popup.contains(e.target)) return;
      setShowChoicePopup(false);
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
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
    const START_HOUR = 8; // Grid starts at 8 AM
    const HOUR_HEIGHT = 64; // 64px per hour (h-16 = 4rem = 64px)

    // Calculate position and height for a timed item
    const getTimePosition = (startTime, endTime) => {
      const start = new Date(startTime);
      const startHour = start.getHours() + start.getMinutes() / 60;
      const top = (startHour - START_HOUR) * HOUR_HEIGHT;

      let height = HOUR_HEIGHT; // Default 1 hour
      if (endTime) {
        const end = new Date(endTime);
        const endHour = end.getHours() + end.getMinutes() / 60;
        const duration = endHour - startHour;
        height = Math.max(duration * HOUR_HEIGHT, 32); // Minimum 32px
      }

      return { top: Math.max(0, top), height };
    };

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
          <div className="relative" style={{ height: hours.length * HOUR_HEIGHT }}>
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
            {/* Calendar Events - positioned by time */}
            {dayEvents.map((event) => {
              const firstAssignee = event.assignees?.[0];
              const eventColor = event.color || getAgentColor(firstAssignee);
              const { top, height } = getTimePosition(event.startTime, event.endTime);

              return (
                <button
                  key={`event-${event.id}`}
                  onClick={(e) => { e.stopPropagation(); handleEventClick(event); }}
                  className="absolute left-1 right-1 text-left p-2 rounded border-l-4 overflow-hidden hover:opacity-80 transition-opacity z-10"
                  style={{
                    top: `${top}px`,
                    height: `${height}px`,
                    borderLeftColor: eventColor,
                    backgroundColor: `${eventColor}20`,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <CalendarDays size={14} style={{ color: eventColor }} />
                    <span className="font-medium text-sm" style={{ color: eventColor }}>{event.title}</span>
                  </div>
                  {height > 50 && event.description && (
                    <div className="text-xs truncate mt-1" style={{ color: eventColor, opacity: 0.8 }}>{event.description}</div>
                  )}
                  {height > 70 && event.assignees?.length > 0 && (
                    <div className="flex items-center gap-1 mt-1 text-xs flex-wrap" style={{ color: eventColor, opacity: 0.75 }}>
                      <User size={12} />
                      {event.assignees.map((assignee, idx) => (
                        <span key={assignee.id} className="flex items-center">
                          <span
                            className="w-2 h-2 rounded-full mr-1"
                            style={{ backgroundColor: getAgentColor(assignee) }}
                          />
                          {assignee.name}{idx < event.assignees.length - 1 ? ',' : ''}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="text-xs mt-1" style={{ color: eventColor, opacity: 0.7 }}>
                    {new Date(event.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    {event.endTime && ` - ${new Date(event.endTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`}
                  </div>
                </button>
              );
            })}
            {/* Tickets - positioned by time */}
            {dayTickets.map((ticket) => {
              // Get all agent colors and generate background
              const agentColors = getAllAgentColors(ticket);
              const agentBgStyle = getAgentBackground(agentColors);
              const statusStripe = statusStripeColors[ticket.status] || '#6B7280';

              // Build assignee names for display
              const allAssignees = [
                ticket.assignee,
                ...(ticket.additionalAssignees || [])
              ].filter(Boolean);

              // Use dueDate or scheduledDate for positioning
              const ticketTime = ticket.scheduledDate || ticket.dueDate;
              const { top, height } = getTimePosition(ticketTime, null);

              return (
                <button
                  key={`ticket-${ticket.id}`}
                  onClick={(e) => { e.stopPropagation(); navigate(`/tickets/${ticket.id}`); }}
                  className="absolute left-1 right-1 text-left rounded overflow-hidden hover:opacity-90 transition-opacity z-10"
                  style={{ top: `${top}px`, height: `${height}px`, ...agentBgStyle }}
                >
                  {/* Status stripe at top */}
                  <div className="h-1.5" style={{ backgroundColor: statusStripe }} />
                  {/* Content with white text */}
                  <div className="p-2 text-white" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>
                    <div className="flex items-center gap-2">
                      <Ticket size={14} />
                      <span className="font-bold text-sm">#{ticket.ticketNumber}</span>
                    </div>
                    <div className="text-sm truncate mt-0.5">{ticket.subject}</div>
                    {allAssignees.length > 0 && (
                      <div className="flex items-center gap-1 mt-1 text-xs opacity-90">
                        <User size={12} />
                        <span className="truncate">
                          {allAssignees.map(a => a.name).join(', ')}
                        </span>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
            {dayTickets.length === 0 && dayEvents.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-gray-500 pointer-events-none">
                Click a time slot to add a ticket or event
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 w-full max-w-full overflow-hidden">
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
          {/* Agent Filter - Custom dropdown with colors */}
          <div className="relative flex-1 md:flex-none">
            <select
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded-lg pl-3 pr-8 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-[44px] bg-white appearance-none"
            >
              <option value="">All Technicians</option>
              {agentsList.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
            {/* Color indicator for selected agent */}
            {selectedAgent && (
              <span
                className="absolute left-2 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full pointer-events-none"
                style={{ backgroundColor: getAgentColor(agentsList.find(a => a.id === selectedAgent)) }}
              />
            )}
            <ChevronRight size={16} className="absolute right-2 top-1/2 -translate-y-1/2 rotate-90 text-gray-400 pointer-events-none" />
          </div>

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
          data-choice-popup
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
              onCreateNew={() => setShowNewClientModal(true)}
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
              label="Assign To"
              value={newTicketForm.assigneeId}
              onChange={(e) => setNewTicketForm(prev => ({ ...prev, assigneeId: e.target.value }))}
              options={[
                { value: '', label: 'Unassigned' },
                ...agentsList.map(a => ({ value: a.id, label: a.name })),
              ]}
            />
          </div>

          {/* Additional Assignees */}
          <MultiSelectAgents
            label="Additional Assignees"
            agents={agentsList}
            selectedIds={newTicketForm.additionalAssigneeIds}
            onChange={(ids) => setNewTicketForm(prev => ({ ...prev, additionalAssigneeIds: ids }))}
            placeholder="Add more agents..."
          />

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

          {/* Assignees */}
          <MultiSelectAgents
            label="Assign to Agents"
            agents={agentsList}
            selectedIds={eventForm.assigneeIds}
            onChange={(ids) => setEventForm(prev => ({ ...prev, assigneeIds: ids }))}
            placeholder="Select agents..."
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

      {/* New Client Modal */}
      {showNewClientModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold">New Client</h3>
              <button
                onClick={() => {
                  setShowNewClientModal(false);
                  setNewClientForm({ firstName: '', lastName: '', email: '', phone: '', companyId: '' });
                }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name <span className="text-red-500">*</span></label>
                  <Input
                    value={newClientForm.firstName}
                    onChange={(e) => setNewClientForm(prev => ({ ...prev, firstName: e.target.value }))}
                    placeholder="First name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name <span className="text-red-500">*</span></label>
                  <Input
                    value={newClientForm.lastName}
                    onChange={(e) => setNewClientForm(prev => ({ ...prev, lastName: e.target.value }))}
                    placeholder="Last name"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
                <Input
                  type="email"
                  value={newClientForm.email}
                  onChange={(e) => setNewClientForm(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="client@example.com"
                />
              </div>
              <div>
                <PhoneInput
                  label="Phone"
                  value={newClientForm.phone}
                  onChange={(e) => setNewClientForm(prev => ({ ...prev, phone: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
                <Select
                  value={newClientForm.companyId}
                  onChange={(e) => setNewClientForm(prev => ({ ...prev, companyId: e.target.value }))}
                  options={[
                    { value: '', label: 'No company' },
                    ...(companiesData?.companies || []).map((c) => ({
                      value: c.id,
                      label: c.name,
                    })),
                  ]}
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowNewClientModal(false);
                    setNewClientForm({ firstName: '', lastName: '', email: '', phone: '', companyId: '' });
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateNewClient}
                  isLoading={createContactMutation.isPending}
                  disabled={!newClientForm.firstName.trim() || !newClientForm.lastName.trim() || !newClientForm.email.trim()}
                >
                  Create Client
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
