import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, User, Circle, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { calendar, agents, tickets as ticketsApi } from '../api';
import { Spinner, Badge, Avatar } from '../components/shared';
import { getSocket } from '../hooks/useSocket';

const priorityColors = {
  LOW: 'border-l-gray-400',
  MEDIUM: 'border-l-blue-400',
  HIGH: 'border-l-orange-400',
  URGENT: 'border-l-red-400',
};

const statusColors = {
  OPEN: 'bg-yellow-500',
  PENDING: 'bg-gray-500',
  INVOICED: 'bg-green-500',
  POSTED: 'bg-pink-500',
};

const availabilityColors = {
  ONLINE: 'bg-green-500',
  BUSY: 'bg-yellow-500',
  AWAY: 'bg-orange-500',
  OFFLINE: 'bg-gray-400',
};

export default function WorkloadPage() {
  const navigate = useNavigate();
  const [workloadData, setWorkloadData] = useState([]);
  const [agentsList, setAgentsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('week'); // today, week, month
  const [expandedAgents, setExpandedAgents] = useState({});
  const [draggingTicket, setDraggingTicket] = useState(null);
  const [dragOverAgent, setDragOverAgent] = useState(null);

  // Calculate date range
  const { start, end } = useMemo(() => {
    const now = new Date();
    const s = new Date(now);
    const e = new Date(now);

    if (dateRange === 'today') {
      s.setHours(0, 0, 0, 0);
      e.setHours(23, 59, 59, 999);
    } else if (dateRange === 'week') {
      s.setDate(s.getDate() - s.getDay());
      s.setHours(0, 0, 0, 0);
      e.setDate(s.getDate() + 6);
      e.setHours(23, 59, 59, 999);
    } else {
      s.setDate(1);
      s.setHours(0, 0, 0, 0);
      e.setMonth(e.getMonth() + 1);
      e.setDate(0);
      e.setHours(23, 59, 59, 999);
    }

    return { start: s, end: e };
  }, [dateRange]);

  // Memoize fetchData to avoid re-creating on each render
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [workload, agentsData] = await Promise.all([
        calendar.getWorkloadSummary({
          start: start.toISOString(),
          end: end.toISOString(),
        }),
        agents.getAgents(),
      ]);

      setWorkloadData(workload.workload || []);
      setAgentsList(agentsData.agents || []);

      // Initialize all agents as expanded (including unassigned)
      const expanded = { unassigned: true };
      (agentsData.agents || []).forEach((agent) => {
        expanded[agent.id] = true;
      });
      setExpandedAgents(expanded);
    } catch (error) {
      console.error('Failed to fetch workload data:', error);
    } finally {
      setLoading(false);
    }
  }, [start, end]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Socket listener for real-time workload updates
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    // Refresh data when workload changes
    const handleWorkloadMoved = () => {
      fetchData();
    };

    // Also refresh on ticket updates (assignment changes)
    const handleTicketNew = () => {
      fetchData();
    };

    socket.on('workload:moved', handleWorkloadMoved);
    socket.on('ticket:new', handleTicketNew);

    return () => {
      socket.off('workload:moved', handleWorkloadMoved);
      socket.off('ticket:new', handleTicketNew);
    };
  }, [fetchData]);

  const toggleAgentExpanded = (agentId) => {
    setExpandedAgents((prev) => ({
      ...prev,
      [agentId]: !prev[agentId],
    }));
  };

  // Drag and drop handlers
  const handleDragStart = (e, ticket, fromAgentId) => {
    setDraggingTicket({ ticket, fromAgentId });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, agentId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverAgent(agentId);
  };

  const handleDragLeave = () => {
    setDragOverAgent(null);
  };

  const handleDrop = async (e, toAgentId) => {
    e.preventDefault();
    setDragOverAgent(null);

    if (!draggingTicket || draggingTicket.fromAgentId === toAgentId) {
      setDraggingTicket(null);
      return;
    }

    try {
      await ticketsApi.updateTicket(draggingTicket.ticket.id, {
        assigneeId: toAgentId,
      });
      fetchData();
    } catch (error) {
      console.error('Failed to reassign ticket:', error);
    }

    setDraggingTicket(null);
  };

  // Group workload data by agent
  const agentWorkloads = useMemo(() => {
    const map = new Map();

    // Initialize with all agents
    agentsList.forEach((agent) => {
      map.set(agent.id, {
        agent,
        tickets: [],
        totalHours: 0,
        ticketCount: 0,
      });
    });

    // Add workload data
    workloadData.forEach((item) => {
      if (map.has(item.agentId)) {
        const existing = map.get(item.agentId);
        existing.tickets = item.tickets || [];
        existing.totalHours = item.totalHours || 0;
        existing.ticketCount = item.ticketCount || 0;
      }
    });

    // Always add unassigned tickets column
    const unassignedWorkload = workloadData.find((w) => !w.agentId);
    map.set('unassigned', {
      agent: { id: 'unassigned', name: 'Unassigned', availability: null },
      tickets: unassignedWorkload?.tickets || [],
      totalHours: 0,
      ticketCount: unassignedWorkload?.ticketCount || 0,
    });

    return Array.from(map.values());
  }, [agentsList, workloadData]);

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
        <div>
          <h2 className="text-lg md:text-xl font-semibold text-gray-900">Workload Board</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {formatDate(start)} - {formatDate(end)}
          </p>
        </div>

        <div className="flex bg-gray-100 rounded-lg p-1 self-start md:self-auto">
          <button
            onClick={() => setDateRange('today')}
            className={`px-3 py-2 text-sm rounded-md transition-colors touch-manipulation min-h-[40px] ${
              dateRange === 'today' ? 'bg-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Today
          </button>
          <button
            onClick={() => setDateRange('week')}
            className={`px-3 py-2 text-sm rounded-md transition-colors touch-manipulation min-h-[40px] ${
              dateRange === 'week' ? 'bg-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Week
          </button>
          <button
            onClick={() => setDateRange('month')}
            className={`px-3 py-2 text-sm rounded-md transition-colors touch-manipulation min-h-[40px] ${
              dateRange === 'month' ? 'bg-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Month
          </button>
        </div>
      </div>

      {/* Workload Columns */}
      <div className="flex gap-3 md:gap-4 overflow-x-auto pb-4 -mx-4 px-4 md:mx-0 md:px-0 scroll-snap-x">
        {agentWorkloads.map(({ agent, tickets, totalHours, ticketCount }) => (
          <div
            key={agent.id}
            className={`flex-shrink-0 w-64 md:w-72 bg-gray-50 rounded-lg transition-colors scroll-snap-start ${
              dragOverAgent === agent.id ? 'ring-2 ring-primary bg-primary/5' : ''
            }`}
            onDragOver={(e) => handleDragOver(e, agent.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, agent.id)}
          >
            {/* Column Header */}
            <div
              className="p-3 border-b border-gray-200 cursor-pointer"
              onClick={() => toggleAgentExpanded(agent.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {agent.id === 'unassigned' ? (
                    <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                      <User size={16} className="text-gray-500" />
                    </div>
                  ) : (
                    <div className="relative">
                      <Avatar name={agent.name} size="sm" />
                      {agent.availability && (
                        <span
                          className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-gray-50 ${
                            availabilityColors[agent.availability]
                          }`}
                        />
                      )}
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{agent.name}</p>
                    <p className="text-xs text-gray-500">
                      {ticketCount} ticket{ticketCount !== 1 ? 's' : ''}
                      {totalHours > 0 && ` | ${totalHours.toFixed(1)}h`}
                    </p>
                  </div>
                </div>
                {expandedAgents[agent.id] ? (
                  <ChevronUp size={16} className="text-gray-400" />
                ) : (
                  <ChevronDown size={16} className="text-gray-400" />
                )}
              </div>

              {/* Workload Indicator */}
              {agent.id !== 'unassigned' && ticketCount > 0 && (
                <div className="mt-2">
                  <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        ticketCount > 10
                          ? 'bg-red-500'
                          : ticketCount > 5
                          ? 'bg-yellow-500'
                          : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min((ticketCount / 15) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Tickets */}
            {expandedAgents[agent.id] && (
              <div className="p-2 space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto">
                {tickets.length === 0 ? (
                  <div className="text-center py-6 text-gray-400 text-sm">No tickets</div>
                ) : (
                  tickets.map((ticket) => (
                    <div
                      key={ticket.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, ticket, agent.id)}
                      onClick={() => navigate(`/tickets/${ticket.id}`)}
                      className={`bg-white rounded-lg border border-gray-200 p-3 cursor-pointer hover:shadow-md transition-shadow border-l-4 ${
                        priorityColors[ticket.priority]
                      } ${draggingTicket?.ticket.id === ticket.id ? 'opacity-50' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="text-xs font-bold text-primary">#{ticket.ticketNumber}</span>
                        <span
                          className={`w-2 h-2 rounded-full ${statusColors[ticket.status]}`}
                          title={ticket.status}
                        />
                      </div>

                      <p className="text-sm font-medium text-gray-900 line-clamp-2 mb-2">
                        {ticket.subject}
                      </p>

                      <div className="flex items-center justify-between text-xs text-gray-500">
                        {ticket.dueDate && (
                          <div className="flex items-center gap-1">
                            <Calendar size={12} />
                            {formatDate(ticket.dueDate)}
                            {new Date(ticket.dueDate) < new Date() && (
                              <AlertTriangle size={12} className="text-red-500" />
                            )}
                          </div>
                        )}
                        {ticket.estimatedHours && (
                          <div className="flex items-center gap-1">
                            <Clock size={12} />
                            {ticket.estimatedHours}h
                          </div>
                        )}
                      </div>

                      {ticket.contact && (
                        <div className="mt-2 pt-2 border-t border-gray-100">
                          <p className="text-xs text-gray-500 truncate">{ticket.contact.name}</p>
                          {ticket.contact.email && (
                            <p className="text-xs text-gray-400 truncate">{ticket.contact.email}</p>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 bg-white rounded-lg border border-gray-200 p-3">
        <span className="font-medium">Priority:</span>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 border-l-4 border-gray-400" />
          Low
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 border-l-4 border-blue-400" />
          Medium
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 border-l-4 border-orange-400" />
          High
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 border-l-4 border-red-400" />
          Urgent
        </div>
        <span className="ml-4 font-medium">Status:</span>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-yellow-500" />
          Open
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-blue-500" />
          In Progress
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-purple-500" />
          Pending
        </div>
      </div>
    </div>
  );
}
