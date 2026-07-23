import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, CalendarRange, List, Grid3X3, Clock, User, X, Plus, Ticket, CalendarDays, Pencil, Trash2, ListTodo, Search, Eye, RotateCcw, FileText, Copy, Mail, Phone, MapPin, Repeat } from 'lucide-react';
import { addMonths, addYears, differenceInMonths, differenceInYears } from 'date-fns';
import { calendar, calendarEvents, agents, tickets as ticketsApi, contacts, companies } from '../api';
import { Spinner, Badge, Avatar, Button, Input, Textarea, Select, Modal, ContactTypeahead, CompanyTypeahead, MultiSelectAgents, PhoneInput, ScheduleTicketModal, TicketSearchModal, TemplateSelectModal, DuplicateTicketModal } from '../components/shared';
import FormattedText from '../components/shared/FormattedText';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

// Status stripe colors (hex for inline styles)
// OPEN is null - no status stripe, show only agent color(s)
const statusStripeColors = {
  OPEN: null,          // No status stripe for OPEN tickets
  PENDING: '#6B7280',  // gray-500
  WORKING: '#5EEAD4',  // teal-300
  INVOICED: '#22C55E', // green-500
  POSTED: '#EC4899',   // pink-500
};

// Agent color mapping by name (hardcoded as fallback)
const AGENT_COLORS = {
  'Peter Braley': '#2563EB',  // Blue
  'Sam Braley': '#DC2626',    // Red
  'Chris Lowrance': '#F59E0B', // Amber
  'Tech 1': '#000000',        // Black
  'Tech 2': '#8B5CF6',        // Purple/Violet
};
const UNASSIGNED_COLOR = '#6B7280'; // Grey
const MAX_RECURRENCE_COUNT = 60; // Maximum number of recurring occurrences

// Helper to get agent color by name or from agent object
const getAgentColor = (agent) => {
  if (!agent) return UNASSIGNED_COLOR;
  return agent.color || AGENT_COLORS[agent.name] || UNASSIGNED_COLOR;
};

// Helper to get primary agent color for a ticket
const getPrimaryAgentColor = (ticket) => {
  if (ticket.assignee) {
    return getAgentColor(ticket.assignee);
  }
  if (ticket.additionalAssignees && ticket.additionalAssignees.length > 0) {
    return getAgentColor(ticket.additionalAssignees[0]);
  }
  return UNASSIGNED_COLOR;
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
  if (colors.length === 0) {
    colors.push(UNASSIGNED_COLOR);
  }
  return colors;
};

// Helper to build diagonal stripe gradient for agents + status (Teamup-style)
// Single agent with status: agent color, status color, repeat
// Multi-agent with status: agent1, status, agent2, status, repeat
// No status (OPEN): solid agent color or agent1, agent2, repeat (no status interleaved)
const buildTicketStripeGradient = (agentColors, statusColor) => {
  if (!agentColors || agentColors.length === 0) return null;

  const stripeWidth = 10; // pixels per stripe

  // If no status color (e.g., OPEN tickets), show only agent colors
  if (!statusColor) {
    // Single agent: solid background (no gradient needed)
    if (agentColors.length === 1) {
      return null; // Will use backgroundColor instead
    }
    // Multi-agent: alternate between agent colors only
    const stops = [];
    let position = 0;
    agentColors.forEach((agentColor) => {
      stops.push(`${agentColor} ${position}px`);
      position += stripeWidth;
      stops.push(`${agentColor} ${position}px`);
    });
    return `repeating-linear-gradient(45deg, ${stops.join(', ')})`;
  }

  // With status color: interleave agent colors with status color
  // Pattern: agent1, status, agent2, status, agent3, status, ...
  const stops = [];
  let position = 0;
  agentColors.forEach((agentColor) => {
    // Agent color stripe
    stops.push(`${agentColor} ${position}px`);
    position += stripeWidth;
    stops.push(`${agentColor} ${position}px`);
    // Status color stripe
    stops.push(`${statusColor} ${position}px`);
    position += stripeWidth;
    stops.push(`${statusColor} ${position}px`);
  });

  return `repeating-linear-gradient(45deg, ${stops.join(', ')})`;
};

// Helper to format date as YYYY-MM-DD in local timezone
const formatLocalDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// Helper to get Monday and Friday of a week containing the given date
const getWeekBoundsFromDate = (date) => {
  const day = date.getDay();
  const monday = new Date(date);
  monday.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  return { monday, friday };
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

// Reschedule Modal Component
function RescheduleModal({ isOpen, onClose, ticket, onRescheduled }) {
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('10:00');
  const [saving, setSaving] = useState(false);

  // Initialize form when ticket changes
  useEffect(() => {
    if (ticket && isOpen) {
      if (ticket.scheduledStart) {
        const start = new Date(ticket.scheduledStart);
        setStartDate(formatLocalDate(start));
        setStartTime(`${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`);
      } else {
        const now = new Date();
        setStartDate(formatLocalDate(now));
        setStartTime('09:00');
      }
      if (ticket.scheduledEnd) {
        const end = new Date(ticket.scheduledEnd);
        setEndDate(formatLocalDate(end));
        setEndTime(`${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`);
      } else {
        const now = new Date();
        setEndDate(formatLocalDate(now));
        setEndTime('10:00');
      }
    }
  }, [ticket, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!ticket?.scheduleId) return;

    setSaving(true);
    try {
      const [startY, startM, startD] = startDate.split('-').map(Number);
      const [startH, startMin] = startTime.split(':').map(Number);
      const scheduledStart = new Date(startY, startM - 1, startD, startH, startMin);

      let scheduledEnd = null;
      if (endDate && endTime) {
        const [endY, endM, endD] = endDate.split('-').map(Number);
        const [endH, endMin] = endTime.split(':').map(Number);
        scheduledEnd = new Date(endY, endM - 1, endD, endH, endMin);
      }

      await ticketsApi.updateSchedule(ticket.ticketId, ticket.scheduleId, {
        scheduledStart: scheduledStart.toISOString(),
        scheduledEnd: scheduledEnd ? scheduledEnd.toISOString() : null,
      });

      toast.success('Schedule updated');
      onRescheduled();
    } catch (error) {
      console.error('Failed to reschedule:', error);
      toast.error('Failed to reschedule ticket');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !ticket) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Reschedule #${ticket.ticketNumber}`} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="text-sm text-gray-600 mb-4 truncate">
          {ticket.subject}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                if (!endDate || e.target.value > endDate) {
                  setEndDate(e.target.value);
                }
              }}
              className="w-full px-3 py-2.5 text-base md:text-sm border border-gray-300 rounded-lg focus:ring-primary focus:border-primary min-h-[44px]"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full px-3 py-2.5 text-base md:text-sm border border-gray-300 rounded-lg focus:ring-primary focus:border-primary min-h-[44px]"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              min={startDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2.5 text-base md:text-sm border border-gray-300 rounded-lg focus:ring-primary focus:border-primary min-h-[44px]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full px-3 py-2.5 text-base md:text-sm border border-gray-300 rounded-lg focus:ring-primary focus:border-primary min-h-[44px]"
            />
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onClose} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button type="submit" disabled={saving} className="w-full sm:w-auto">
            {saving ? <Spinner size="sm" /> : 'Update Schedule'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function CalendarPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const calendarRef = useRef(null);
  const dragStartInfoRef = useRef(null); // Track drag start position for tap vs drag detection
  const [view, setView] = useState(() => (window.innerWidth < 768 ? 'day' : 'week'));
  const [currentDate, setCurrentDate] = useState(new Date());
  const [focusedDate, setFocusedDate] = useState(new Date()); // User's intended day, preserved across view switches
  const [tickets, setTickets] = useState([]);
  const [events, setEvents] = useState([]);
  const [agentsList, setAgentsList] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState('');
  const [loading, setLoading] = useState(true);

  // Unscheduled tickets sidebar state
  const [showUnscheduledSidebar, setShowUnscheduledSidebar] = useState(false);
  const [unscheduledTickets, setUnscheduledTickets] = useState([]);
  const [loadingUnscheduled, setLoadingUnscheduled] = useState(false);
  const [scheduleTicket, setScheduleTicket] = useState(null);

  // New client modal state
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [newClientForm, setNewClientForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    companyId: '',
  });

  // Context menu state (for both empty slot clicks and event clicks)
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    date: null,
    time: '09:00',
    targetItem: null,
    // For event context menu
    menuType: 'slot', // 'slot' for empty slot, 'ticket' for ticket click, 'event' for calendar event click
    clickedTicket: null, // { ticketId, scheduleId, ticketNumber, subject }
    clickedEvent: null, // { eventId, title, ... }
  });

  // Reschedule modal state
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleTicket, setRescheduleTicket] = useState(null); // { ticketId, scheduleId, ticketNumber, subject, currentStart, currentEnd }

  // Tooltip state for calendar event preview
  const [tooltip, setTooltip] = useState({
    visible: false,
    x: 0,
    y: 0,
    eventData: null, // { type, ticketNumber, subject, company, status, statusColor, assignee, additionalAssignees }
  });
  const tooltipTimeoutRef = useRef(null);
  const longPressTimeoutRef = useRef(null);
  const isLongPressRef = useRef(false);

  // New ticket modal state
  const [showNewTicketModal, setShowNewTicketModal] = useState(false);
  const [newTicketDate, setNewTicketDate] = useState(null);
  const [newTicketTime, setNewTicketTime] = useState('09:00');
  const [newTicketEndTime, setNewTicketEndTime] = useState('10:00');
  const [newTicketEndDate, setNewTicketEndDate] = useState(null);
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
    repeatFrequency: '', // '' | 'MONTHLY' | 'YEARLY'
    repeatUntil: '',
  });

  // Ticket search modal state
  const [showTicketSearchModal, setShowTicketSearchModal] = useState(false);
  const [ticketSearchDate, setTicketSearchDate] = useState(null);
  const [ticketSearchTime, setTicketSearchTime] = useState('09:00');

  // Template and Duplicate modal state for new ticket modal
  const [showTemplateModalForNewTicket, setShowTemplateModalForNewTicket] = useState(false);
  const [showDuplicateModalForNewTicket, setShowDuplicateModalForNewTicket] = useState(false);

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

  // Handle template selection for new ticket modal
  const handleSelectTemplateForNewTicket = (template) => {
    setNewTicketForm(prev => ({
      ...prev,
      subject: template.subject || '',
      description: template.description || '',
      priority: template.priority || 'MEDIUM',
      assigneeId: template.assigneeId || '',
    }));
    toast.success(`Template "${template.name}" applied`);
  };

  // Handle duplicate ticket selection for new ticket modal
  const handleSelectDuplicateForNewTicket = (ticket) => {
    setNewTicketForm(prev => ({
      ...prev,
      subject: ticket.subject || '',
      description: ticket.description || '',
      priority: ticket.priority || 'MEDIUM',
      assigneeId: ticket.assigneeId || '',
      contactId: ticket.requesterId || ticket.requester?.id || '',
      companyId: ticket.companyId || ticket.company?.id || ticket.requester?.companyId || '',
      additionalAssigneeIds: ticket.additionalAssignees?.map(a => a.id) || [],
    }));
    toast.success(`Ticket #${ticket.ticketNumber} duplicated`);
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
  }, [dateRange.start.toISOString(), dateRange.end.toISOString(), selectedAgent]);

  // Fetch unscheduled tickets when sidebar opens
  const fetchUnscheduledTickets = async () => {
    setLoadingUnscheduled(true);
    try {
      const data = await ticketsApi.getTickets({ limit: 100 });
      const unscheduled = (data.tickets || []).filter(t => !t.dueDate);
      setUnscheduledTickets(unscheduled);
    } catch (error) {
      console.error('Failed to fetch unscheduled tickets:', error);
      toast.error('Failed to load unscheduled tickets');
    } finally {
      setLoadingUnscheduled(false);
    }
  };

  useEffect(() => {
    if (showUnscheduledSidebar) {
      fetchUnscheduledTickets();
    }
  }, [showUnscheduledSidebar]);

  // Convert tickets and events to FullCalendar format
  const calendarEvents_FC = useMemo(() => {
    const fcEvents = [];
    const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;

    // Map tickets to FullCalendar events
    tickets.forEach((ticket) => {
      const startTime = ticket.scheduledStart || ticket.dueDate;
      if (!startTime) return;

      const agentColors = getAllAgentColors(ticket);
      const primaryColor = agentColors[0];
      const statusColor = statusStripeColors[ticket.status]; // null for OPEN (no status stripe)
      const companyName = ticket.company?.name || ticket.requester?.company?.name || '';

      // Calculate duration and auto-promote to all-day if > 8 hours
      // Track if this is a "true" all-day event from DB vs auto-promoted
      const dbIsAllDay = ticket.isAllDay || false;
      let isAllDay = dbIsAllDay;
      let promotedToAllDay = false;
      if (!isAllDay && ticket.scheduledEnd) {
        const start = new Date(startTime);
        const end = new Date(ticket.scheduledEnd);
        const durationMs = end.getTime() - start.getTime();
        if (durationMs > EIGHT_HOURS_MS) {
          isAllDay = true;
          promotedToAllDay = true; // Auto-promoted, not truly all-day in DB
        }
      }

      // For all-day events, FullCalendar expects date-only strings (YYYY-MM-DD)
      // and treats end date as exclusive, so we add 1 day
      let fcStart = startTime;
      let fcEnd = ticket.scheduledEnd || undefined;
      if (isAllDay) {
        // Convert to date-only format for all-day events
        fcStart = new Date(startTime).toISOString().split('T')[0];
        if (ticket.scheduledEnd) {
          const endDate = new Date(ticket.scheduledEnd);
          endDate.setDate(endDate.getDate() + 1);
          fcEnd = endDate.toISOString().split('T')[0];
        }
      }

      fcEvents.push({
        id: `ticket-${ticket.id}`,
        title: `#${ticket.ticketNumber} ${ticket.subject}`,
        start: fcStart,
        end: fcEnd,
        allDay: isAllDay,
        backgroundColor: primaryColor,
        borderColor: 'transparent',
        textColor: '#ffffff',
        extendedProps: {
          type: 'ticket',
          ticketId: ticket.id,
          scheduleId: ticket.scheduleId,
          ticketNumber: ticket.ticketNumber,
          subject: ticket.subject,
          status: ticket.status,
          priority: ticket.priority,
          assignee: ticket.assignee,
          additionalAssignees: ticket.additionalAssignees,
          requester: ticket.requester,
          company: companyName,
          statusColor: statusColor,
          scheduledStart: startTime,
          scheduledEnd: ticket.scheduledEnd,
          agentColors: agentColors,
          promotedToAllDay: promotedToAllDay, // true if auto-promoted due to duration > 8h
        },
      });
    });

    // Map calendar events to FullCalendar events
    events.forEach((event) => {
      const firstAssignee = event.assignees?.[0];
      const eventColor = event.color || getAgentColor(firstAssignee);

      // Check if event should be all-day (from DB or duration > 8 hours)
      // Track if this is a "true" all-day event from DB vs auto-promoted
      const dbIsAllDay = event.isAllDay || false;
      let isAllDay = dbIsAllDay;
      let promotedToAllDay = false;
      if (!isAllDay && event.endTime) {
        const start = new Date(event.startTime);
        const end = new Date(event.endTime);
        const durationMs = end.getTime() - start.getTime();
        if (durationMs > EIGHT_HOURS_MS) {
          isAllDay = true;
          promotedToAllDay = true; // Auto-promoted, not truly all-day in DB
        }
      }

      // For all-day events, FullCalendar expects date-only strings (YYYY-MM-DD)
      // and treats end date as exclusive, so we add 1 day
      let fcStart = event.startTime;
      let fcEnd = event.endTime || undefined;
      if (isAllDay) {
        // Convert to date-only format for all-day events
        fcStart = new Date(event.startTime).toISOString().split('T')[0];
        if (event.endTime) {
          const endDate = new Date(event.endTime);
          endDate.setDate(endDate.getDate() + 1);
          fcEnd = endDate.toISOString().split('T')[0];
        }
      }

      fcEvents.push({
        id: `event-${event.id}`,
        title: event.title,
        start: fcStart,
        end: fcEnd,
        allDay: isAllDay,
        backgroundColor: `${eventColor}30`,
        borderColor: eventColor,
        textColor: eventColor,
        extendedProps: {
          type: 'event',
          eventId: event.id,
          description: event.description,
          assignees: event.assignees,
          promotedToAllDay: promotedToAllDay, // true if auto-promoted due to duration > 8h
        },
      });
    });

    return fcEvents;
  }, [tickets, events]);

  // FullCalendar view mapping
  const fcViewMap = {
    month: 'dayGridMonth',
    week: 'timeGridWeek',
    day: 'timeGridDay',
  };

  const navigate_date = (direction) => {
    // Let FullCalendar handle navigation; datesSet callback will update currentDate
    if (calendarRef.current) {
      const api = calendarRef.current.getApi();
      if (direction > 0) {
        api.next();
      } else {
        api.prev();
      }
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    if (calendarRef.current) {
      calendarRef.current.getApi().today();
    }
  };

  const handleViewChange = (newView) => {
    setView(newView);
    if (calendarRef.current) {
      // Use focusedDate (user's intended day) not api.getDate() which returns view-boundary dates (Sunday for week)
      calendarRef.current.getApi().changeView(fcViewMap[newView], focusedDate);
    }
  };

  const formatDateHeader = () => {
    const options = { month: 'long', year: 'numeric' };
    if (view === 'day') {
      return currentDate.toLocaleDateString('en-US', { ...options, day: 'numeric', weekday: 'long' });
    }
    return currentDate.toLocaleDateString('en-US', options);
  };

  // Handle clicking on an empty date/time slot (create new)
  const handleDateSelect = (selectInfo) => {
    const startDate = selectInfo.start;
    const endDate = selectInfo.end;

    // For day/week view, use the actual time; for month view, default to 9am
    const isAllDay = selectInfo.allDay;
    const startTime = isAllDay ? '09:00' : `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`;
    const endTime = isAllDay ? '10:00' : `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;

    // Show context menu at mouse position
    setContextMenu({
      visible: true,
      x: selectInfo.jsEvent?.clientX || 200,
      y: selectInfo.jsEvent?.clientY || 200,
      date: startDate,
      time: startTime,
      endTime: endTime,
      endDate: endDate,
      targetItem: null,
      menuType: 'slot',
      clickedTicket: null,
      clickedEvent: null,
    });
  };

  // Handle clicking on an existing event - show context menu
  const handleEventClick = (clickInfo) => {
    const event = clickInfo.event;
    const props = event.extendedProps;
    const jsEvent = clickInfo.jsEvent;

    // Keep menu within viewport
    const menuWidth = 200;
    const menuHeight = 120;
    let x = jsEvent?.clientX || 200;
    let y = jsEvent?.clientY || 200;

    if (x + menuWidth > window.innerWidth) {
      x = window.innerWidth - menuWidth - 10;
    }
    if (y + menuHeight > window.innerHeight) {
      y = window.innerHeight - menuHeight - 10;
    }

    if (props.type === 'ticket') {
      setContextMenu({
        visible: true,
        x,
        y,
        date: null,
        time: null,
        targetItem: null,
        menuType: 'ticket',
        clickedTicket: {
          ticketId: props.ticketId,
          scheduleId: props.scheduleId,
          ticketNumber: props.ticketNumber,
          subject: props.subject,
          scheduledStart: props.scheduledStart,
          scheduledEnd: props.scheduledEnd,
        },
        clickedEvent: null,
      });
    } else if (props.type === 'event') {
      const originalEvent = events.find(e => e.id === props.eventId);
      setContextMenu({
        visible: true,
        x,
        y,
        date: null,
        time: null,
        targetItem: null,
        menuType: 'event',
        clickedTicket: null,
        clickedEvent: originalEvent,
      });
    }
  };

  // Track drag start for tap vs drag detection on mobile
  const handleEventDragStart = (dragInfo) => {
    dragStartInfoRef.current = {
      eventId: dragInfo.event.id,
      start: dragInfo.event.start?.getTime(),
      end: dragInfo.event.end?.getTime(),
      jsEvent: dragInfo.jsEvent,
    };
  };

  // Handle drag-and-drop of events
  const handleEventDrop = async (dropInfo) => {
    const event = dropInfo.event;
    const props = event?.extendedProps || {};
    console.log('handleEventDrop - props:', props);
    const dragStart = dragStartInfoRef.current;

    // Check if event actually moved - if not, treat as a tap (show context menu)
    if (dragStart && dragStart.eventId === event.id) {
      const startMoved = event.start?.getTime() !== dragStart.start;
      const endMoved = event.end?.getTime() !== dragStart.end;

      if (!startMoved && !endMoved) {
        // Event didn't move - this was a tap, not a drag
        // Simulate an eventClick by showing the context menu
        dragStartInfoRef.current = null;
        dropInfo.revert();

        // Build context menu position from the original touch/click
        const jsEvent = dragStart.jsEvent;
        const menuWidth = 200;
        const menuHeight = 120;
        let x = jsEvent?.clientX || jsEvent?.touches?.[0]?.clientX || 200;
        let y = jsEvent?.clientY || jsEvent?.touches?.[0]?.clientY || 200;

        if (x + menuWidth > window.innerWidth) {
          x = window.innerWidth - menuWidth - 10;
        }
        if (y + menuHeight > window.innerHeight) {
          y = window.innerHeight - menuHeight - 10;
        }

        if (props.type === 'ticket') {
          setContextMenu({
            visible: true,
            x,
            y,
            date: null,
            time: null,
            targetItem: null,
            menuType: 'ticket',
            clickedTicket: {
              ticketId: props.ticketId,
              scheduleId: props.scheduleId,
              ticketNumber: props.ticketNumber,
              subject: props.subject,
              scheduledStart: props.scheduledStart,
              scheduledEnd: props.scheduledEnd,
            },
            clickedEvent: null,
          });
        } else if (props.type === 'event') {
          const originalEvent = events.find(e => e.id === props.eventId);
          setContextMenu({
            visible: true,
            x,
            y,
            date: null,
            time: null,
            targetItem: null,
            menuType: 'event',
            clickedTicket: null,
            clickedEvent: originalEvent,
          });
        }
        return;
      }
    }

    dragStartInfoRef.current = null;

    // For truly all-day events (not auto-promoted), FullCalendar uses exclusive end dates
    // (we added +1 day when mapping), so we need to subtract 1 day when saving back.
    // Auto-promoted events (promotedToAllDay=true) store datetimes in DB, so no adjustment needed.
    let endDateToSave = event.end;
    const isTrulyAllDay = event.allDay && !props.promotedToAllDay;
    if (isTrulyAllDay && event.end) {
      const adjustedEnd = new Date(event.end);
      adjustedEnd.setDate(adjustedEnd.getDate() - 1);
      endDateToSave = adjustedEnd;
    }

    if (props.type === 'ticket' && props.scheduleId) {
      try {
        await ticketsApi.updateSchedule(props.ticketId, props.scheduleId, {
          scheduledStart: event.start.toISOString(),
          scheduledEnd: endDateToSave ? endDateToSave.toISOString() : null,
        });
        toast.success('Schedule updated');
        fetchCalendarData();
      } catch (error) {
        console.error('Failed to update schedule:', error);
        toast.error('Failed to update schedule');
        dropInfo.revert();
      }
    } else if (props.type === 'event') {
      try {
        await calendarEvents.updateEvent(props.eventId, {
          startTime: event.start.toISOString(),
          endTime: endDateToSave ? endDateToSave.toISOString() : null,
        });
        toast.success('Event updated');
        fetchCalendarData();
      } catch (error) {
        console.error('Failed to update event:', error);
        toast.error('Failed to update event');
        dropInfo.revert();
      }
    }
  };

  // Handle resizing of events
  const handleEventResize = async (resizeInfo) => {
    try {
      const event = resizeInfo.event;
      const props = event?.extendedProps || {};
      const endDelta = resizeInfo.endDelta;

      let endDateToSave;

      // For auto-promoted all-day events, calculate new end from original scheduledEnd + delta
      // (event.end is unreliable because FullCalendar treats it as a date-only value)
      if (props.promotedToAllDay && props.scheduledEnd && endDelta) {
        const originalEnd = new Date(props.scheduledEnd);
        originalEnd.setDate(originalEnd.getDate() + (endDelta.days || 0));
        endDateToSave = originalEnd;
      }
      // For truly all-day events (from DB), FullCalendar uses exclusive end dates
      // so we subtract 1 day when saving back
      else if (event?.allDay && !props.promotedToAllDay && event?.end) {
        const adjustedEnd = new Date(event.end);
        adjustedEnd.setDate(adjustedEnd.getDate() - 1);
        endDateToSave = adjustedEnd;
      }
      // For timed events, use event.end directly
      else {
        endDateToSave = event?.end;
      }

      if (props.type === 'ticket' && props.scheduleId) {
        await ticketsApi.updateSchedule(props.ticketId, props.scheduleId, {
          scheduledStart: event.start.toISOString(),
          scheduledEnd: endDateToSave.toISOString(),
        });
        toast.success('Schedule updated');
        fetchCalendarData();

      } else if (props.type === 'event') {
        await calendarEvents.updateEvent(props.eventId, {
          startTime: event.start.toISOString(),
          endTime: endDateToSave.toISOString(),
        });
        toast.success('Event updated');
        fetchCalendarData();
      }
    } catch (err) {
      console.error('handleEventResize ERROR:', err);
      toast.error('Failed to resize event');
      resizeInfo.revert();
    }
  };

  // Tooltip position calculation to stay within viewport
  const calculateTooltipPosition = (mouseX, mouseY) => {
    const tooltipWidth = 280;
    const tooltipHeight = 180;
    const padding = 12;

    let x = mouseX + padding;
    let y = mouseY + padding;

    // Keep tooltip within viewport horizontally
    if (x + tooltipWidth > window.innerWidth) {
      x = mouseX - tooltipWidth - padding;
    }
    if (x < padding) {
      x = padding;
    }

    // Keep tooltip within viewport vertically
    if (y + tooltipHeight > window.innerHeight) {
      y = mouseY - tooltipHeight - padding;
    }
    if (y < padding) {
      y = padding;
    }

    return { x, y };
  };

  // Show tooltip for an event
  const showTooltip = (eventProps, mouseX, mouseY) => {
    const { x, y } = calculateTooltipPosition(mouseX, mouseY);
    setTooltip({
      visible: true,
      x,
      y,
      eventData: eventProps,
    });
  };

  // Hide tooltip
  const hideTooltip = () => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
      tooltipTimeoutRef.current = null;
    }
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
    setTooltip(prev => ({ ...prev, visible: false }));
  };

  // Desktop hover handlers
  const handleEventMouseEnter = (eventProps, e) => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
    }
    tooltipTimeoutRef.current = setTimeout(() => {
      showTooltip(eventProps, e.clientX, e.clientY);
    }, 250); // 250ms delay
  };

  const handleEventMouseLeave = () => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
      tooltipTimeoutRef.current = null;
    }
    hideTooltip();
  };

  const handleEventMouseMove = (eventProps, e) => {
    // Update tooltip position if already visible
    if (tooltip.visible) {
      const { x, y } = calculateTooltipPosition(e.clientX, e.clientY);
      setTooltip(prev => ({ ...prev, x, y }));
    }
  };

  // Mobile long-press handlers
  const handleEventTouchStart = (eventProps, e) => {
    isLongPressRef.current = false;
    const touch = e.touches[0];
    longPressTimeoutRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      showTooltip(eventProps, touch.clientX, touch.clientY);
    }, 500); // 500ms hold for long press
  };

  const handleEventTouchEnd = () => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
    // Don't immediately hide - let user see the tooltip
    // It will be hidden when they tap elsewhere
  };

  const handleEventTouchMove = () => {
    // Cancel long press if user moves finger
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
  };

  // Hide tooltip when clicking/tapping outside
  useEffect(() => {
    if (!tooltip.visible) return;

    const handleOutsideClick = () => {
      hideTooltip();
    };

    // Small delay to prevent immediate dismissal
    const timer = setTimeout(() => {
      document.addEventListener('click', handleOutsideClick);
      document.addEventListener('touchstart', handleOutsideClick);
    }, 50);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [tooltip.visible]);

  // Status badge styling consistent with Badge component
  const getStatusBadgeClasses = (status) => {
    const statusLower = status?.toLowerCase();
    const variants = {
      open: 'bg-blue-100 text-blue-800',
      pending: 'bg-gray-200 text-gray-700',
      resolved: 'bg-slate-100 text-slate-700',
      invoiced: 'bg-green-100 text-green-800',
      posted: 'bg-pink-100 text-pink-800',
      closed: 'bg-gray-100 text-gray-600',
    };
    return variants[statusLower] || 'bg-gray-100 text-gray-700';
  };

  // Custom event rendering
  const renderEventContent = (eventInfo) => {
    const props = eventInfo.event.extendedProps;
    // Include event title for calendar events (not in extendedProps)
    const tooltipData = {
      ...props,
      title: eventInfo.event.title,
    };

    // Common tooltip event handlers
    const tooltipHandlers = {
      onMouseEnter: (e) => handleEventMouseEnter(tooltipData, e),
      onMouseLeave: handleEventMouseLeave,
      onMouseMove: (e) => handleEventMouseMove(tooltipData, e),
      onTouchStart: (e) => handleEventTouchStart(tooltipData, e),
      onTouchEnd: handleEventTouchEnd,
      onTouchMove: handleEventTouchMove,
    };

    if (props.type === 'ticket') {
      const agentColors = props.agentColors || [eventInfo.event.backgroundColor];
      const statusColor = props.statusColor; // null for OPEN tickets
      // Use stripes for tickets: alternating agent color(s) and status color (if status has color)
      const stripeGradient = buildTicketStripeGradient(agentColors, statusColor);
      // For single-agent OPEN tickets (no gradient), use solid agent color
      const solidBackground = !stripeGradient && agentColors.length > 0 ? agentColors[0] : null;

      return (
        <div
          className="w-full h-full overflow-hidden p-0.5 rounded"
          style={stripeGradient ? { background: stripeGradient } : solidBackground ? { backgroundColor: solidBackground } : {}}
          {...tooltipHandlers}
        >
          <div className="text-[11px] leading-tight truncate font-medium px-1 text-white drop-shadow-sm">
            #{props.ticketNumber}
          </div>
          <div className="text-[10px] leading-tight truncate px-1 text-white opacity-90 drop-shadow-sm">
            {props.subject}
          </div>
          {props.company && (
            <div className="text-[9px] leading-tight truncate px-1 text-white opacity-75 drop-shadow-sm">
              {props.company}
            </div>
          )}
        </div>
      );
    } else {
      return (
        <div
          className="w-full h-full overflow-hidden p-1"
          {...tooltipHandlers}
        >
          <div className="flex items-center gap-1">
            <CalendarDays size={10} />
            <span className="text-[11px] leading-tight truncate font-medium">
              {eventInfo.event.title}
            </span>
          </div>
        </div>
      );
    }
  };

  // Hide context menu
  const hideContextMenu = () => {
    setContextMenu(prev => ({ ...prev, visible: false, targetItem: null, clickedTicket: null, clickedEvent: null, menuType: 'slot' }));
  };

  // Ticket context menu handlers
  const handleViewTicket = () => {
    if (contextMenu.clickedTicket) {
      navigate(`/tickets/${contextMenu.clickedTicket.ticketId}`);
    }
    hideContextMenu();
  };

  const handleRescheduleTicket = () => {
    if (contextMenu.clickedTicket) {
      setRescheduleTicket(contextMenu.clickedTicket);
      setShowRescheduleModal(true);
    }
    hideContextMenu();
  };

  const handleDeleteSchedule = async () => {
    if (!contextMenu.clickedTicket?.scheduleId) {
      toast.error('No schedule to delete');
      hideContextMenu();
      return;
    }
    if (!window.confirm('Are you sure you want to remove this ticket from the calendar?')) {
      hideContextMenu();
      return;
    }

    try {
      await ticketsApi.deleteSchedule(contextMenu.clickedTicket.ticketId, contextMenu.clickedTicket.scheduleId);
      toast.success('Schedule removed');
      fetchCalendarData();
    } catch (error) {
      console.error('Failed to delete schedule:', error);
      toast.error('Failed to remove schedule');
    }
    hideContextMenu();
  };

  // Calendar event context menu handlers
  const handleEditEvent = () => {
    if (contextMenu.clickedEvent) {
      setEditingEvent(contextMenu.clickedEvent);
      setEventForm({
        title: contextMenu.clickedEvent.title,
        description: contextMenu.clickedEvent.description || '',
        startTime: formatDateTimeLocal(new Date(contextMenu.clickedEvent.startTime)),
        endTime: contextMenu.clickedEvent.endTime ? formatDateTimeLocal(new Date(contextMenu.clickedEvent.endTime)) : '',
        assigneeIds: contextMenu.clickedEvent.assignees?.map(a => a.id) || [],
        repeatFrequency: '', // No recurring when editing existing event
        repeatUntil: '',
      });
      setShowEventModal(true);
    }
    hideContextMenu();
  };

  const handleDeleteEventFromMenu = async () => {
    if (!contextMenu.clickedEvent) {
      hideContextMenu();
      return;
    }
    if (!window.confirm('Are you sure you want to delete this event?')) {
      hideContextMenu();
      return;
    }

    try {
      await calendarEvents.deleteEvent(contextMenu.clickedEvent.id);
      toast.success('Event deleted');
      fetchCalendarData();
    } catch (error) {
      console.error('Failed to delete event:', error);
      toast.error('Failed to delete event');
    }
    hideContextMenu();
  };

  // Context menu handlers
  const handleContextNewTicket = () => {
    hideContextMenu();
    setNewTicketDate(contextMenu.date);
    setNewTicketEndDate(contextMenu.endDate || contextMenu.date);
    setNewTicketTime(contextMenu.time);
    setNewTicketEndTime(contextMenu.endTime || '10:00');
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

  const handleContextNewEvent = () => {
    hideContextMenu();
    setEditingEvent(null);

    const startDateTime = new Date(contextMenu.date);
    const [hours, minutes] = contextMenu.time.split(':');
    startDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

    const endDateTime = contextMenu.endDate ? new Date(contextMenu.endDate) : new Date(startDateTime);
    if (!contextMenu.endDate) {
      endDateTime.setHours(endDateTime.getHours() + 1);
    }

    setEventForm({
      title: '',
      description: '',
      startTime: formatDateTimeLocal(startDateTime),
      endTime: formatDateTimeLocal(endDateTime),
      assigneeIds: [],
      repeatFrequency: '',
      repeatUntil: '',
    });
    setShowEventModal(true);
  };

  const handleContextAddExistingTicket = () => {
    hideContextMenu();
    setTicketSearchDate(contextMenu.date);
    setTicketSearchTime(contextMenu.time);
    setShowTicketSearchModal(true);
  };

  // Close context menu when clicking outside
  useEffect(() => {
    if (!contextMenu.visible) return;

    const handleClickOutside = (e) => {
      const menu = document.querySelector('[data-context-menu]');
      if (menu && !menu.contains(e.target)) {
        hideContextMenu();
      }
    };

    const timer = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 10);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [contextMenu.visible]);

  // "All Week" button handler for new ticket modal
  const handleAllWeekNewTicket = () => {
    const { monday, friday } = getWeekBoundsFromDate(newTicketDate || new Date());
    setNewTicketDate(monday);
    setNewTicketEndDate(friday);
    setNewTicketTime('08:00');
    setNewTicketEndTime('17:00');
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
      const scheduledStart = new Date(newTicketDate);
      const [hours, minutes] = newTicketTime.split(':');
      scheduledStart.setHours(parseInt(hours), parseInt(minutes), 0, 0);

      let scheduledEnd = null;
      if (newTicketEndTime) {
        scheduledEnd = new Date(newTicketEndDate || newTicketDate);
        const [endHours, endMinutes] = newTicketEndTime.split(':');
        scheduledEnd.setHours(parseInt(endHours), parseInt(endMinutes), 0, 0);
      }

      const isMultiDay = newTicketEndDate &&
        formatLocalDate(newTicketDate) !== formatLocalDate(newTicketEndDate);

      const ticketData = {
        subject: newTicketForm.subject,
        description: newTicketForm.description,
        priority: newTicketForm.priority,
        requesterId: newTicketForm.contactId,
        companyId: newTicketForm.companyId || null,
        assigneeId: newTicketForm.assigneeId || null,
        additionalAssigneeIds: newTicketForm.additionalAssigneeIds.length > 0 ? newTicketForm.additionalAssigneeIds : undefined,
      };

      const result = await ticketsApi.createTicket(ticketData);

      if (newTicketDate) {
        await ticketsApi.createSchedule(result.id, {
          scheduledStart: scheduledStart.toISOString(),
          scheduledEnd: scheduledEnd ? scheduledEnd.toISOString() : null,
          isAllDay: isMultiDay,
        });
      }

      toast.success('Ticket created successfully');
      setShowNewTicketModal(false);
      await fetchCalendarData();
      navigate(`/tickets/${result.id}`);
    } catch (error) {
      console.error('Failed to create ticket:', error);
      toast.error(error.response?.data?.error || 'Failed to create ticket');
    } finally {
      setSaving(false);
    }
  };

  // Calculate estimated occurrence count for recurring events
  const estimatedEventOccurrences = useMemo(() => {
    if (!eventForm.repeatFrequency || !eventForm.startTime || !eventForm.repeatUntil) return 0;
    const start = new Date(eventForm.startTime);
    const until = new Date(eventForm.repeatUntil);
    if (until < start) return 0;

    if (eventForm.repeatFrequency === 'MONTHLY') {
      return Math.min(differenceInMonths(until, start) + 1, MAX_RECURRENCE_COUNT);
    } else if (eventForm.repeatFrequency === 'YEARLY') {
      return Math.min(differenceInYears(until, start) + 1, MAX_RECURRENCE_COUNT);
    }
    return 0;
  }, [eventForm.repeatFrequency, eventForm.startTime, eventForm.repeatUntil]);

  // Handle repeat frequency change for events - set default repeatUntil
  const handleEventRepeatFrequencyChange = (newFrequency) => {
    setEventForm(prev => {
      const newForm = { ...prev, repeatFrequency: newFrequency };
      if (newFrequency && prev.startTime) {
        const start = new Date(prev.startTime);
        let defaultUntil;
        if (newFrequency === 'MONTHLY') {
          defaultUntil = addYears(start, 1); // 1 year out for monthly
        } else if (newFrequency === 'YEARLY') {
          defaultUntil = addYears(start, 5); // 5 years out for yearly
        }
        if (defaultUntil) {
          newForm.repeatUntil = defaultUntil.toISOString().split('T')[0];
        }
      } else {
        newForm.repeatUntil = '';
      }
      return newForm;
    });
  };

  // Save calendar event (create or update)
  const handleSaveEvent = async (e) => {
    e.preventDefault();
    if (!eventForm.title || !eventForm.startTime) {
      toast.error('Title and start time are required');
      return;
    }

    // Validate recurring settings
    if (eventForm.repeatFrequency && !eventForm.repeatUntil) {
      toast.error('Please select an end date for the recurring event');
      return;
    }

    if (eventForm.repeatFrequency && estimatedEventOccurrences >= MAX_RECURRENCE_COUNT) {
      toast.error(`Would create ${estimatedEventOccurrences} events, which exceeds the maximum of ${MAX_RECURRENCE_COUNT}. Please choose a shorter date range.`);
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

      // Add recurring fields if creating a new recurring event
      if (!editingEvent && eventForm.repeatFrequency) {
        eventData.repeatFrequency = eventForm.repeatFrequency;
        eventData.repeatUntil = new Date(`${eventForm.repeatUntil}T23:59:59`).toISOString();
      }

      if (editingEvent) {
        await calendarEvents.updateEvent(editingEvent.id, eventData);
        toast.success('Event updated successfully');
      } else {
        const result = await calendarEvents.createEvent(eventData);
        if (result.createdCount && result.createdCount > 1) {
          toast.success(`Created ${result.createdCount} recurring events`);
        } else {
          toast.success('Event created successfully');
        }
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

  return (
    <div className="space-y-4 w-full max-w-full overflow-hidden">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 md:mb-6">
        <div className="flex items-center gap-2 md:gap-4">
          <div className="flex items-center gap-1">
            <button
              onClick={() => navigate_date(-1)}
              className="p-2 hover:bg-gray-100 rounded-lg min-w-[40px] min-h-[40px] flex items-center justify-center touch-manipulation"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={() => navigate_date(1)}
              className="p-2 hover:bg-gray-100 rounded-lg min-w-[40px] min-h-[40px] flex items-center justify-center touch-manipulation"
            >
              <ChevronRight size={20} />
            </button>
          </div>
          <h1 className="text-lg md:text-xl font-bold text-gray-900">{formatDateHeader()}</h1>
          <button
            onClick={goToToday}
            className="px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10 rounded-lg min-h-[36px] touch-manipulation"
          >
            Today
          </button>
        </div>

        {/* View toggle and agent filter */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1">
            {[
              { key: 'month', label: 'Month', icon: Grid3X3 },
              { key: 'week', label: 'Week', icon: CalendarIcon },
              { key: 'day', label: 'Day', icon: List },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => handleViewChange(key)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium min-h-[40px] touch-manipulation whitespace-nowrap ${
                  view === key
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Icon size={16} />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          {/* Agent filter */}
          <div className="w-full sm:w-auto">
            <select
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              className="w-full sm:w-40 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-[40px]"
            >
              <option value="">All Agents</option>
              {agentsList.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Unscheduled tickets toggle */}
      <button
        onClick={() => setShowUnscheduledSidebar(!showUnscheduledSidebar)}
        className="fixed bottom-20 right-4 md:static md:bottom-auto md:right-auto z-20 p-3 bg-white shadow-lg rounded-full md:rounded-lg md:shadow-sm md:border md:border-gray-200 min-w-[48px] min-h-[48px] flex items-center justify-center touch-manipulation"
        title="Unscheduled Tickets"
      >
        <ListTodo size={20} />
        {unscheduledTickets.length > 0 && (
          <span className="absolute -top-1 -right-1 md:static md:ml-2 bg-primary text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {unscheduledTickets.length}
          </span>
        )}
      </button>

      {/* Calendar Content with Sidebar */}
      <div className="flex relative">
        {/* Unscheduled Tickets Sidebar/Bottom Sheet */}
        {showUnscheduledSidebar && (
          <>
            <div
              className="md:hidden fixed inset-0 bg-black/50 z-40"
              onClick={() => setShowUnscheduledSidebar(false)}
            />
            <div className="fixed inset-x-0 bottom-0 md:static md:inset-auto md:w-72 bg-white rounded-t-2xl md:rounded-lg shadow-lg md:shadow-sm md:border md:border-gray-200 z-50 max-h-[70vh] md:max-h-none overflow-hidden flex flex-col safe-bottom">
              <div className="flex items-center justify-between p-4 border-b border-gray-200 md:hidden">
                <h3 className="font-semibold text-gray-900">Unscheduled Tickets</h3>
                <button
                  onClick={() => setShowUnscheduledSidebar(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg touch-manipulation"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="hidden md:flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
                <h3 className="font-semibold text-gray-900">Unscheduled Tickets</h3>
                <button
                  onClick={() => setShowUnscheduledSidebar(false)}
                  className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="overflow-y-auto flex-1">
                {loadingUnscheduled ? (
                  <div className="flex items-center justify-center py-8">
                    <Spinner size="md" />
                  </div>
                ) : unscheduledTickets.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <ListTodo size={32} className="mx-auto mb-2 opacity-50" />
                    <p>No unscheduled tickets</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {unscheduledTickets.map((ticket) => {
                      const agentColor = getAgentColor(ticket.assignee);
                      return (
                        <div key={ticket.id} className="p-3 hover:bg-gray-50 transition-colors">
                          <div className="flex items-start gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0"
                              style={{ backgroundColor: agentColor }}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 text-sm">
                                <span className="font-medium text-gray-900">#{ticket.ticketNumber}</span>
                              </div>
                              <p className="text-sm text-gray-700 truncate mt-0.5">
                                {ticket.subject}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                {ticket.assignee?.name || <span className="italic">Unassigned</span>}
                              </p>
                              <button
                                onClick={() => setScheduleTicket(ticket)}
                                className="mt-2 flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-primary bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors"
                              >
                                <CalendarIcon size={14} />
                                Schedule
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Main Calendar Area */}
        <div className={`flex-1 min-w-0 transition-all duration-300 ${showUnscheduledSidebar ? 'md:ml-0' : ''}`}>
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Spinner size="lg" />
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden fullcalendar-wrapper">
              <FullCalendar
                ref={calendarRef}
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                initialView={fcViewMap[view]}
                initialDate={currentDate}
                events={calendarEvents_FC}
                headerToolbar={false}
                height="auto"
                contentHeight={view === 'month' ? 'auto' : 600}
                slotMinTime="07:00:00"
                slotMaxTime="20:00:00"
                slotDuration="00:30:00"
                snapDuration="00:15:00"
                allDaySlot={true}
                nowIndicator={true}
                selectable={true}
                selectMirror={true}
                editable={true}
                eventDurationEditable={true}
                eventResizableFromStart={true}
                longPressDelay={150}
                eventLongPressDelay={150}
                selectLongPressDelay={150}
                select={handleDateSelect}
                eventClick={handleEventClick}
                eventDragStart={handleEventDragStart}
                eventDrop={handleEventDrop}
                eventResize={handleEventResize}
                eventContent={renderEventContent}
                dayMaxEvents={3}
                moreLinkClick="popover"
                weekends={true}
                firstDay={0}
                eventTimeFormat={{
                  hour: 'numeric',
                  minute: '2-digit',
                  meridiem: 'short',
                }}
                slotLabelFormat={{
                  hour: 'numeric',
                  minute: '2-digit',
                  meridiem: 'short',
                }}
                datesSet={(dateInfo) => {
                  // Use currentStart (true start of the logical view period) not start (grid start which may include trailing days from prior month)
                  setCurrentDate(dateInfo.view.currentStart);
                  // Only update focusedDate in day view where currentStart unambiguously IS the focused day
                  if (dateInfo.view.type === 'timeGridDay') {
                    setFocusedDate(dateInfo.view.currentStart);
                  }
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Calendar Event Tooltip */}
      {tooltip.visible && tooltip.eventData && (
        <div
          className="fixed z-[60] bg-white rounded-lg shadow-xl border border-gray-200 p-3 w-[280px] pointer-events-none"
          style={{
            left: tooltip.x,
            top: tooltip.y,
          }}
        >
          {tooltip.eventData.type === 'ticket' ? (
            <div className="space-y-2">
              {/* Ticket Number & Subject */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-bold text-primary">#{tooltip.eventData.ticketNumber}</span>
                  <span
                    className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusBadgeClasses(tooltip.eventData.status)}`}
                  >
                    {tooltip.eventData.status}
                  </span>
                </div>
                <p className="text-sm text-gray-900 font-medium line-clamp-2">
                  {tooltip.eventData.subject}
                </p>
              </div>

              {/* Requester */}
              {tooltip.eventData.requester && (
                <div className="space-y-1">
                  {tooltip.eventData.requester.name && (
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <User size={14} className="flex-shrink-0" />
                      <span className="truncate font-medium">{tooltip.eventData.requester.name}</span>
                    </div>
                  )}
                  {tooltip.eventData.requester.email && (
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <Mail size={14} className="flex-shrink-0" />
                      <a href={`mailto:${tooltip.eventData.requester.email}`} className="truncate text-primary hover:underline pointer-events-auto">
                        {tooltip.eventData.requester.email}
                      </a>
                    </div>
                  )}
                  {tooltip.eventData.requester.phone && (
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <Phone size={14} className="flex-shrink-0" />
                      <a href={`tel:${tooltip.eventData.requester.phone}`} className="truncate text-primary hover:underline pointer-events-auto">
                        {tooltip.eventData.requester.phone}
                      </a>
                    </div>
                  )}
                  {tooltip.eventData.requester.address && (
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <MapPin size={14} className="flex-shrink-0" />
                      <span className="truncate">{tooltip.eventData.requester.address}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Company/Location */}
              {tooltip.eventData.company && (
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <span className="truncate">{tooltip.eventData.company}</span>
                </div>
              )}

              {/* Assignee(s) */}
              <div className="flex items-start gap-2 text-xs text-gray-600">
                <User size={14} className="flex-shrink-0 mt-0.5" />
                <div className="flex flex-wrap gap-1">
                  {tooltip.eventData.assignee ? (
                    <>
                      <span className="font-medium">{tooltip.eventData.assignee.name}</span>
                      {tooltip.eventData.additionalAssignees?.length > 0 && (
                        <>
                          {tooltip.eventData.additionalAssignees.map((a, i) => (
                            <span key={i} className="font-medium">
                              , {a.name}
                            </span>
                          ))}
                        </>
                      )}
                    </>
                  ) : (
                    <span className="italic text-gray-400">Unassigned</span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Calendar Event */}
              <div className="flex items-center gap-2 mb-1">
                <CalendarDays size={14} className="text-purple-600" />
                <span className="text-sm font-medium text-gray-900">{tooltip.eventData.title || 'Calendar Event'}</span>
              </div>
              {tooltip.eventData.description && (
                <FormattedText text={tooltip.eventData.description} as="p" className="text-xs text-gray-600 line-clamp-3" />
              )}
              {tooltip.eventData.assignees?.length > 0 && (
                <div className="flex items-start gap-2 text-xs text-gray-600">
                  <User size={14} className="flex-shrink-0 mt-0.5" />
                  <span className="font-medium">
                    {tooltip.eventData.assignees.map(a => a.name).join(', ')}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Context Menu */}
      {contextMenu.visible && (
        <div
          data-context-menu
          className="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[200px]"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Empty slot context menu */}
          {contextMenu.menuType === 'slot' && (
            <>
              <button
                onClick={handleContextNewTicket}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 transition-colors text-gray-700"
              >
                <Ticket size={16} className="text-primary flex-shrink-0" />
                <span>New Ticket</span>
              </button>
              <button
                onClick={handleContextAddExistingTicket}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 transition-colors text-gray-700"
              >
                <Search size={16} className="text-green-600 flex-shrink-0" />
                <span>Add Existing Ticket</span>
              </button>
              <button
                onClick={handleContextNewEvent}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 transition-colors text-gray-700"
              >
                <CalendarDays size={16} className="text-purple-600 flex-shrink-0" />
                <span>New Calendar Entry</span>
              </button>
            </>
          )}

          {/* Ticket context menu */}
          {contextMenu.menuType === 'ticket' && contextMenu.clickedTicket && (
            <>
              <div className="px-4 py-2 border-b border-gray-100">
                <div className="text-xs text-gray-500">Ticket #{contextMenu.clickedTicket.ticketNumber}</div>
                <div className="text-sm font-medium text-gray-900 truncate max-w-[200px]">{contextMenu.clickedTicket.subject}</div>
              </div>
              <button
                onClick={handleViewTicket}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 transition-colors text-gray-700"
              >
                <Eye size={16} className="text-primary flex-shrink-0" />
                <span>View Ticket</span>
              </button>
              <button
                onClick={handleRescheduleTicket}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 transition-colors text-gray-700"
              >
                <RotateCcw size={16} className="text-blue-600 flex-shrink-0" />
                <span>Reschedule</span>
              </button>
              <button
                onClick={handleDeleteSchedule}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-red-50 transition-colors text-red-600"
              >
                <Trash2 size={16} className="flex-shrink-0" />
                <span>Delete Schedule</span>
              </button>
            </>
          )}

          {/* Calendar event context menu */}
          {contextMenu.menuType === 'event' && contextMenu.clickedEvent && (
            <>
              <div className="px-4 py-2 border-b border-gray-100">
                <div className="text-xs text-gray-500">Calendar Event</div>
                <div className="text-sm font-medium text-gray-900 truncate max-w-[200px]">{contextMenu.clickedEvent.title}</div>
              </div>
              <button
                onClick={handleEditEvent}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 transition-colors text-gray-700"
              >
                <Pencil size={16} className="text-primary flex-shrink-0" />
                <span>Edit Event</span>
              </button>
              <button
                onClick={handleDeleteEventFromMenu}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-red-50 transition-colors text-red-600"
              >
                <Trash2 size={16} className="flex-shrink-0" />
                <span>Delete Event</span>
              </button>
            </>
          )}
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
          {/* Templates and Duplicate buttons */}
          <div className="flex flex-wrap gap-2 pb-2 border-b border-gray-200">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setShowTemplateModalForNewTicket(true)}
              className="flex items-center gap-2"
            >
              <FileText size={16} />
              Templates
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setShowDuplicateModalForNewTicket(true)}
              className="flex items-center gap-2"
            >
              <Copy size={16} />
              Duplicate
            </Button>
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={newTicketDate ? `${newTicketDate.getFullYear()}-${String(newTicketDate.getMonth() + 1).padStart(2, '0')}-${String(newTicketDate.getDate()).padStart(2, '0')}` : ''}
                onChange={(e) => {
                  const [year, month, day] = e.target.value.split('-').map(Number);
                  const newDate = new Date(year, month - 1, day);
                  setNewTicketDate(newDate);
                  if (!newTicketEndDate || newDate > newTicketEndDate) {
                    setNewTicketEndDate(newDate);
                  }
                }}
                className="w-full px-3 py-2.5 text-base md:text-sm border border-gray-300 rounded-lg focus:ring-primary focus:border-primary min-h-[44px]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
              <input
                type="time"
                value={newTicketTime}
                onChange={(e) => {
                  setNewTicketTime(e.target.value);
                  const [h, m] = e.target.value.split(':').map(Number);
                  const endH = Math.min(h + 1, 23);
                  setNewTicketEndTime(`${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
                }}
                className="w-full px-3 py-2.5 text-base md:text-sm border border-gray-300 rounded-lg focus:ring-primary focus:border-primary min-h-[44px]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={newTicketEndDate ? `${newTicketEndDate.getFullYear()}-${String(newTicketEndDate.getMonth() + 1).padStart(2, '0')}-${String(newTicketEndDate.getDate()).padStart(2, '0')}` : ''}
                min={newTicketDate ? `${newTicketDate.getFullYear()}-${String(newTicketDate.getMonth() + 1).padStart(2, '0')}-${String(newTicketDate.getDate()).padStart(2, '0')}` : ''}
                onChange={(e) => {
                  const [year, month, day] = e.target.value.split('-').map(Number);
                  setNewTicketEndDate(new Date(year, month - 1, day));
                }}
                className="w-full px-3 py-2.5 text-base md:text-sm border border-gray-300 rounded-lg focus:ring-primary focus:border-primary min-h-[44px]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
              <input
                type="time"
                value={newTicketEndTime}
                onChange={(e) => setNewTicketEndTime(e.target.value)}
                className="w-full px-3 py-2.5 text-base md:text-sm border border-gray-300 rounded-lg focus:ring-primary focus:border-primary min-h-[44px]"
              />
            </div>
          </div>
          {/* All Week Button */}
          <div className="flex justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={handleAllWeekNewTicket}
              className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
            >
              <CalendarRange size={16} className="mr-2" />
              All Week (Mon-Fri)
            </Button>
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

          {/* Recurring Event (only for new events, not editing) */}
          {!editingEvent && (
            <div className="space-y-3 pt-3 border-t border-gray-200">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Repeat size={14} className="inline mr-1.5 mb-0.5" />
                  Repeats
                </label>
                <Select
                  value={eventForm.repeatFrequency}
                  onChange={(e) => handleEventRepeatFrequencyChange(e.target.value)}
                  options={[
                    { value: '', label: 'Does not repeat' },
                    { value: 'MONTHLY', label: 'Monthly' },
                    { value: 'YEARLY', label: 'Yearly' },
                  ]}
                />
              </div>

              {eventForm.repeatFrequency && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <CalendarIcon size={14} className="inline mr-1.5 mb-0.5" />
                      Repeat Until
                    </label>
                    <input
                      type="date"
                      value={eventForm.repeatUntil}
                      min={eventForm.startTime ? eventForm.startTime.split('T')[0] : ''}
                      onChange={(e) => setEventForm(prev => ({ ...prev, repeatUntil: e.target.value }))}
                      className="w-full px-3 py-2.5 text-base md:text-sm border border-gray-300 rounded-lg focus:ring-primary focus:border-primary min-h-[44px]"
                    />
                  </div>

                  {/* Occurrence count indicator */}
                  {estimatedEventOccurrences > 0 && (
                    <div className={`text-sm px-3 py-2 rounded-lg ${
                      estimatedEventOccurrences >= MAX_RECURRENCE_COUNT
                        ? 'bg-red-50 text-red-700 border border-red-200'
                        : 'bg-blue-50 text-blue-700 border border-blue-200'
                    }`}>
                      {estimatedEventOccurrences >= MAX_RECURRENCE_COUNT ? (
                        <>
                          <strong>Warning:</strong> This would create {estimatedEventOccurrences} events, exceeding the maximum of {MAX_RECURRENCE_COUNT}. Please choose a shorter date range.
                        </>
                      ) : (
                        <>Will create <strong>{estimatedEventOccurrences}</strong> calendar {estimatedEventOccurrences === 1 ? 'event' : 'events'}</>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

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

      {/* Schedule Ticket Modal (for sidebar scheduling) */}
      <ScheduleTicketModal
        isOpen={!!scheduleTicket}
        onClose={() => setScheduleTicket(null)}
        ticket={scheduleTicket}
        onScheduled={() => {
          fetchUnscheduledTickets();
          fetchCalendarData();
          setScheduleTicket(null);
        }}
      />

      {/* Ticket Search Modal (for adding existing tickets to calendar) */}
      <TicketSearchModal
        isOpen={showTicketSearchModal}
        onClose={() => setShowTicketSearchModal(false)}
        prefilledDate={ticketSearchDate}
        prefilledTime={ticketSearchTime}
        onTicketScheduled={() => {
          fetchCalendarData();
          setShowTicketSearchModal(false);
        }}
      />

      {/* Reschedule Ticket Modal */}
      <RescheduleModal
        isOpen={showRescheduleModal}
        onClose={() => {
          setShowRescheduleModal(false);
          setRescheduleTicket(null);
        }}
        ticket={rescheduleTicket}
        onRescheduled={() => {
          fetchCalendarData();
          setShowRescheduleModal(false);
          setRescheduleTicket(null);
        }}
      />

      {/* Template Select Modal for New Ticket */}
      <TemplateSelectModal
        isOpen={showTemplateModalForNewTicket}
        onClose={() => setShowTemplateModalForNewTicket(false)}
        onSelectTemplate={handleSelectTemplateForNewTicket}
      />

      {/* Duplicate Ticket Modal for New Ticket */}
      <DuplicateTicketModal
        isOpen={showDuplicateModalForNewTicket}
        onClose={() => setShowDuplicateModalForNewTicket(false)}
        onSelectTicket={handleSelectDuplicateForNewTicket}
      />

      {/* Custom styles for FullCalendar */}
      <style>{`
        .fullcalendar-wrapper .fc {
          font-family: inherit;
        }
        .fullcalendar-wrapper .fc-theme-standard td,
        .fullcalendar-wrapper .fc-theme-standard th {
          border-color: #e5e7eb;
        }
        .fullcalendar-wrapper .fc-theme-standard .fc-scrollgrid {
          border-color: #e5e7eb;
        }
        .fullcalendar-wrapper .fc-col-header-cell {
          padding: 12px 4px;
          background-color: #f9fafb;
        }
        .fullcalendar-wrapper .fc-col-header-cell-cushion {
          color: #374151;
          font-weight: 600;
          font-size: 0.875rem;
        }
        .fullcalendar-wrapper .fc-daygrid-day-number {
          color: #374151;
          font-weight: 500;
          padding: 8px;
        }
        .fullcalendar-wrapper .fc-day-today {
          background-color: rgba(59, 130, 246, 0.05) !important;
        }
        .fullcalendar-wrapper .fc-day-today .fc-daygrid-day-number {
          background-color: #3b82f6;
          color: white;
          border-radius: 9999px;
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .fullcalendar-wrapper .fc-timegrid-slot {
          height: 48px;
        }
        .fullcalendar-wrapper .fc-timegrid-slot-label {
          font-size: 0.75rem;
          color: #6b7280;
        }
        .fullcalendar-wrapper .fc-event {
          border-radius: 4px;
          border-width: 0;
          cursor: pointer;
        }
        .fullcalendar-wrapper .fc-event:hover {
          opacity: 0.9;
        }
        .fullcalendar-wrapper .fc-timegrid-event {
          border-radius: 4px;
        }
        .fullcalendar-wrapper .fc-daygrid-event {
          border-radius: 4px;
          padding: 2px 4px;
        }
        .fullcalendar-wrapper .fc-more-link {
          color: #3b82f6;
          font-weight: 500;
        }
        .fullcalendar-wrapper .fc-timegrid-now-indicator-line {
          border-color: #ef4444;
        }
        .fullcalendar-wrapper .fc-timegrid-now-indicator-arrow {
          border-color: #ef4444;
          border-top-color: transparent;
          border-bottom-color: transparent;
        }
        .fullcalendar-wrapper .fc-highlight {
          background-color: rgba(59, 130, 246, 0.1);
        }
        .fullcalendar-wrapper .fc-daygrid-day-events {
          margin-top: 4px;
        }
        .fullcalendar-wrapper .fc-v-event .fc-event-main {
          padding: 0;
        }
      `}</style>
    </div>
  );
}
