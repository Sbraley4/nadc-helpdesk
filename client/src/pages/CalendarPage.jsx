import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, List, Grid3X3, Clock, User } from 'lucide-react';
import { calendar, agents } from '../api';
import { Spinner, Badge, Avatar } from '../components/shared';

const priorityColors = {
  LOW: 'bg-gray-100 text-gray-700 border-gray-300',
  MEDIUM: 'bg-blue-100 text-blue-700 border-blue-300',
  HIGH: 'bg-orange-100 text-orange-700 border-orange-300',
  URGENT: 'bg-red-100 text-red-700 border-red-300',
};

const statusColors = {
  OPEN: 'bg-yellow-500',
  IN_PROGRESS: 'bg-blue-500',
  PENDING: 'bg-purple-500',
  RESOLVED: 'bg-green-500',
  CLOSED: 'bg-gray-500',
};

export default function CalendarPage() {
  const navigate = useNavigate();
  const [view, setView] = useState('month'); // month, week, day
  const [currentDate, setCurrentDate] = useState(new Date());
  const [tickets, setTickets] = useState([]);
  const [agentsList, setAgentsList] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState('');
  const [loading, setLoading] = useState(true);

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

  const renderTicketPill = (ticket) => (
    <button
      key={ticket.id}
      onClick={() => navigate(`/tickets/${ticket.id}`)}
      className={`w-full text-left text-xs p-1 rounded border truncate mb-0.5 hover:opacity-80 transition-opacity ${
        priorityColors[ticket.priority]
      }`}
    >
      <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${statusColors[ticket.status]}`} />
      #{ticket.id} {ticket.subject}
    </button>
  );

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
            className={`bg-white p-1 min-h-[80px] md:min-h-[100px] ${
              !isCurrentMonth ? 'opacity-50' : ''
            }`}
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
    <div className="grid grid-cols-7 gap-2">
      {weekDays.map((date, idx) => {
        const dayTickets = ticketsByDate[date.toDateString()] || [];
        return (
          <div key={idx} className="min-h-[300px]">
            <div
              className={`text-center p-2 rounded-t-lg ${
                isToday(date) ? 'bg-primary text-white' : 'bg-gray-100'
              }`}
            >
              <div className="text-xs">{date.toLocaleDateString('en-US', { weekday: 'short' })}</div>
              <div className="text-lg font-semibold">{date.getDate()}</div>
            </div>
            <div className="bg-white border border-t-0 border-gray-200 rounded-b-lg p-2 space-y-1 min-h-[250px]">
              {dayTickets.map(renderTicketPill)}
            </div>
          </div>
        );
      })}
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
            {/* Grid lines */}
            <div className="absolute inset-0 divide-y divide-gray-100">
              {hours.map((hour) => (
                <div key={hour} className="h-16" />
              ))}
            </div>
            {/* Tickets */}
            <div className="relative p-2 space-y-2">
              {dayTickets.map((ticket) => (
                <button
                  key={ticket.id}
                  onClick={() => navigate(`/tickets/${ticket.id}`)}
                  className={`w-full text-left p-2 rounded border ${priorityColors[ticket.priority]} hover:opacity-80 transition-opacity`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${statusColors[ticket.status]}`} />
                    <span className="font-medium text-sm">#{ticket.id}</span>
                  </div>
                  <div className="text-sm truncate">{ticket.subject}</div>
                  {ticket.assignee && (
                    <div className="flex items-center gap-1 mt-1 text-xs opacity-75">
                      <User size={12} />
                      {ticket.assignee.name}
                    </div>
                  )}
                </button>
              ))}
              {dayTickets.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No tickets scheduled for this day
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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate_date(-1)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={goToToday}
            className="px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => navigate_date(1)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronRight size={20} />
          </button>
          <h2 className="text-lg font-semibold text-gray-900 ml-2">
            {formatDateHeader()}
          </h2>
        </div>

        <div className="flex items-center gap-3">
          {/* Agent Filter */}
          <select
            value={selectedAgent}
            onChange={(e) => setSelectedAgent(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">All Technicians</option>
            {agentsList.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>

          {/* View Toggle */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setView('month')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                view === 'month' ? 'bg-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Grid3X3 size={16} className="md:hidden" />
              <span className="hidden md:inline">Month</span>
            </button>
            <button
              onClick={() => setView('week')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                view === 'week' ? 'bg-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <CalendarIcon size={16} className="md:hidden" />
              <span className="hidden md:inline">Week</span>
            </button>
            <button
              onClick={() => setView('day')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
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
    </div>
  );
}
