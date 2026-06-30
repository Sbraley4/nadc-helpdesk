import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Plus, AlertCircle, Clock, CheckCircle, XCircle, ChevronDown, Filter, X, DollarSign, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import { tickets, agents } from '../../api';
import { Badge, Button, SearchInput, Select, Pagination, EmptyState, CenteredSpinner, Avatar } from '../../components/shared';

const statusConfig = {
  OPEN: { label: 'Open', variant: 'open', icon: AlertCircle },
  PENDING: { label: 'Pending', variant: 'pending', icon: Clock },
  RESOLVED: { label: 'Resolved', variant: 'resolved', icon: CheckCircle },
  INVOICED: { label: 'Invoiced', variant: 'invoiced', icon: DollarSign },
  POSTED: { label: 'Posted', variant: 'posted', icon: Send },
  CLOSED: { label: 'Closed', variant: 'closed', icon: XCircle },
};

const priorityConfig = {
  LOW: { label: 'Low', variant: 'low' },
  MEDIUM: { label: 'Medium', variant: 'medium' },
  HIGH: { label: 'High', variant: 'high' },
  URGENT: { label: 'Urgent', variant: 'urgent' },
};

const statusOptions = [
  { value: '', label: 'All Statuses' },
  { value: 'OPEN', label: 'Open' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'INVOICED', label: 'Invoiced' },
  { value: 'POSTED', label: 'Posted' },
  { value: 'CLOSED', label: 'Closed' },
];

const priorityOptions = [
  { value: '', label: 'All Priorities' },
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
];
export default function TicketListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showFilters, setShowFilters] = useState(false);

  const filters = {
    page: parseInt(searchParams.get('page') || '1'),
    search: searchParams.get('search') || '',
    status: searchParams.get('status') || '',
    priority: searchParams.get('priority') || '',
    assigneeId: searchParams.get('assigneeId') || '',
  };

  const updateFilters = (newFilters) => {
    const params = new URLSearchParams();
    const merged = { ...filters, ...newFilters };
    Object.entries(merged).forEach(([key, value]) => {
      if (value && !(key === 'page' && value === 1)) {
        params.set(key, String(value));
      }
    });
    setSearchParams(params);
  };

  // Fetch agents for assignee filter
  const { data: agentsData } = useQuery({
    queryKey: ['agents'],
    queryFn: () => agents.getAgents(),
  });

  const assigneeOptions = [
    { value: '', label: 'All Agents' },
    { value: 'unassigned', label: 'Unassigned' },
    ...(agentsData?.agents || []).map((agent) => ({
      value: agent.id,
      label: agent.name,
    })),
  ];

  const { data, isLoading, error } = useQuery({
    queryKey: ['tickets', filters],
    queryFn: () => tickets.getTickets({
      page: filters.page,
      limit: 25,
      search: filters.search || undefined,
      status: filters.status || undefined,
      priority: filters.priority || undefined,
      assigneeId: filters.assigneeId || undefined,
    }),
  });

  // Mutation for quick status change
  const updateStatusMutation = useMutation({
    mutationFn: ({ ticketId, status }) => tickets.updateTicket(ticketId, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries(['tickets']);
      toast.success('Status updated');
    },
    onError: () => {
      toast.error('Failed to update status');
    },
  });

  const ticketList = data?.tickets || [];
  const pagination = data?.pagination || { total: 0, pages: 1 };

  if (error) {
    return (
      <div className="p-6">
        <EmptyState icon={AlertCircle} title="Error loading tickets" description={error.message} />
      </div>
    );
  }

  const activeFilterCount = [filters.status, filters.priority, filters.assigneeId].filter(Boolean).length;

  return (
    <div>
      {/* Header - responsive */}
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Tickets</h1>
          <p className="text-sm text-gray-500 mt-0.5">{pagination.total} total</p>
        </div>
        <Link to="/tickets/new" className="hidden md:block">
          <Button leftIcon={<Plus size={18} />}>New Ticket</Button>
        </Link>
      </div>

      {/* Search and Filter Bar - Mobile Optimized */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 md:p-4 mb-4 md:mb-6">
        <div className="flex gap-2 md:gap-4 items-center">
          <SearchInput
            value={filters.search}
            onChange={(value) => updateFilters({ search: value, page: 1 })}
            placeholder="Search..."
            className="flex-1 md:flex-none md:w-64"
            enableRecentSearches
          />
          {/* Mobile filter toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="md:hidden flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg min-h-[44px] touch-manipulation"
          >
            <Filter size={16} />
            {activeFilterCount > 0 && (
              <span className="bg-primary text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
          {/* Desktop filters */}
          <div className="hidden md:flex md:flex-wrap gap-4 items-center">
            <Select options={statusOptions} value={filters.status} onChange={(e) => updateFilters({ status: e.target.value, page: 1 })} className="w-40" />
            <Select options={priorityOptions} value={filters.priority} onChange={(e) => updateFilters({ priority: e.target.value, page: 1 })} className="w-40" />
            <Select options={assigneeOptions} value={filters.assigneeId} onChange={(e) => updateFilters({ assigneeId: e.target.value, page: 1 })} className="w-44" />
            {(filters.search || filters.status || filters.priority || filters.assigneeId) && (
              <Button variant="ghost" size="sm" onClick={() => updateFilters({ search: '', status: '', priority: '', assigneeId: '', page: 1 })}>Clear filters</Button>
            )}
          </div>
        </div>

        {/* Mobile filters panel */}
        {showFilters && (
          <div className="md:hidden mt-3 pt-3 border-t border-gray-200 space-y-3">
            <Select
              label="Status"
              options={statusOptions}
              value={filters.status}
              onChange={(e) => updateFilters({ status: e.target.value, page: 1 })}
              className="w-full"
            />
            <Select
              label="Priority"
              options={priorityOptions}
              value={filters.priority}
              onChange={(e) => updateFilters({ priority: e.target.value, page: 1 })}
              className="w-full"
            />
            <Select
              label="Assignee"
              options={assigneeOptions}
              value={filters.assigneeId}
              onChange={(e) => updateFilters({ assigneeId: e.target.value, page: 1 })}
              className="w-full"
            />
            {(filters.status || filters.priority || filters.assigneeId) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { updateFilters({ status: '', priority: '', assigneeId: '', page: 1 }); setShowFilters(false); }}
                className="w-full"
              >
                Clear all filters
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? <CenteredSpinner /> : ticketList.length === 0 ? (
          <EmptyState
            title="No tickets found"
            description={filters.search || filters.status || filters.priority ? 'Try adjusting your filters' : 'Create your first ticket to get started'}
            action={<Link to="/tickets/new"><Button leftIcon={<Plus size={18} />}>Create Ticket</Button></Link>}
          />
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ticket</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assigned To</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Updated</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {ticketList.map((ticket) => (
                    <TicketRow
                      key={ticket.id}
                      ticket={ticket}
                      onStatusChange={(ticketId, status) => updateStatusMutation.mutate({ ticketId, status })}
                      onNavigate={navigate}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden flex flex-col gap-3 p-3 bg-gray-50">
              {ticketList.map((ticket) => (
                <MobileTicketCard
                  key={ticket.id}
                  ticket={ticket}
                  onStatusChange={(ticketId, status) => updateStatusMutation.mutate({ ticketId, status })}
                  onClick={() => navigate(`/tickets/${ticket.id}`)}
                />
              ))}
            </div>

            <Pagination currentPage={filters.page} totalPages={pagination.pages} totalItems={pagination.total} itemsPerPage={25} onPageChange={(page) => updateFilters({ page })} />
          </>
        )}
      </div>
    </div>
  );
}
function TicketRow({ ticket, onStatusChange, onNavigate }) {
  const ticketUrl = '/tickets/' + ticket.id;
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);

  const handleStatusClick = (e) => {
    e.stopPropagation();
    setShowStatusDropdown(!showStatusDropdown);
  };

  const handleStatusChange = (newStatus) => {
    if (newStatus !== ticket.status) {
      onStatusChange(ticket.id, newStatus);
    }
    setShowStatusDropdown(false);
  };

  return (
    <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => onNavigate(ticketUrl)}>
      <td className="px-6 py-4">
        <Link to={ticketUrl} className="block" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-primary">#{ticket.ticketNumber}</span>
            <p className="text-sm font-medium text-gray-900 hover:text-primary">{ticket.subject}</p>
          </div>
        </Link>
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
          <Avatar name={ticket.requester?.name} size="xs" />
          <div>
            <p className="text-sm text-gray-900">{ticket.requester?.name || 'Unknown'}</p>
            <p className="text-xs text-gray-500">{ticket.company?.name}</p>
          </div>
        </div>
      </td>
      <td className="px-6 py-4 relative">
        <button
          onClick={handleStatusClick}
          className="flex items-center gap-1 hover:opacity-80 transition-opacity"
        >
          <Badge variant={statusConfig[ticket.status]?.variant}>
            {statusConfig[ticket.status]?.label}
          </Badge>
          <ChevronDown size={14} className="text-gray-400" />
        </button>
        {showStatusDropdown && (
          <>
            <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setShowStatusDropdown(false); }} />
            <div className="absolute z-20 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[120px]">
              {['OPEN', 'PENDING', 'INVOICED', 'POSTED', 'CLOSED'].map((status) => (
                <button
                  key={status}
                  onClick={(e) => { e.stopPropagation(); handleStatusChange(status); }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${
                    ticket.status === status ? 'bg-gray-50 font-medium' : ''
                  }`}
                >
                  <Badge variant={statusConfig[status]?.variant} size="sm">
                    {statusConfig[status]?.label}
                  </Badge>
                </button>
              ))}
            </div>
          </>
        )}
      </td>
      <td className="px-6 py-4"><Badge variant={priorityConfig[ticket.priority]?.variant}>{priorityConfig[ticket.priority]?.label}</Badge></td>
      <td className="px-6 py-4">
        {ticket.assignee ? (
          <div className="flex items-center gap-2">
            <Avatar name={ticket.assignee.name} size="xs" />
            <span className="text-sm text-gray-900">{ticket.assignee.name}</span>
          </div>
        ) : <span className="text-sm text-gray-400">Unassigned</span>}
      </td>
      <td className="px-6 py-4 text-sm text-gray-500">{format(new Date(ticket.updatedAt), 'MMM d, h:mm a')}</td>
    </tr>
  );
}

// Mobile-optimized ticket card component
function MobileTicketCard({ ticket, onStatusChange, onClick }) {
  const [showStatusMenu, setShowStatusMenu] = useState(false);

  return (
    <div
      className="p-4 bg-white rounded-lg shadow-sm border border-gray-200 active:bg-gray-50 touch-manipulation cursor-pointer"
      onClick={onClick}
    >
      {/* Top row: ticket number, status, priority */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-primary">#{ticket.ticketNumber}</span>
          <Badge variant={priorityConfig[ticket.priority]?.variant} size="sm">
            {priorityConfig[ticket.priority]?.label}
          </Badge>
        </div>
        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setShowStatusMenu(!showStatusMenu); }}
            className="flex items-center gap-1 touch-manipulation min-h-[44px] px-1"
          >
            <Badge variant={statusConfig[ticket.status]?.variant}>
              {statusConfig[ticket.status]?.label}
            </Badge>
            <ChevronDown size={14} className="text-gray-400" />
          </button>
          {showStatusMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={(e) => { e.stopPropagation(); setShowStatusMenu(false); }}
              />
              <div className="absolute right-0 z-20 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[120px]">
                {['OPEN', 'PENDING', 'INVOICED', 'POSTED', 'CLOSED'].map((status) => (
                  <button
                    key={status}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (status !== ticket.status) onStatusChange(ticket.id, status);
                      setShowStatusMenu(false);
                    }}
                    className={`w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2 min-h-[44px] ${
                      ticket.status === status ? 'bg-gray-50 font-medium' : ''
                    }`}
                  >
                    <Badge variant={statusConfig[status]?.variant} size="sm">
                      {statusConfig[status]?.label}
                    </Badge>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Subject */}
      <p className="text-sm font-medium text-gray-900 mb-2 line-clamp-2">{ticket.subject}</p>

      {/* Bottom row: contact, assignee, date */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Avatar name={ticket.requester?.name} size="xs" />
          <span className="truncate">{ticket.requester?.name || 'Unknown'}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {ticket.assignee ? (
            <div className="flex items-center gap-1">
              <Avatar name={ticket.assignee.name} size="xs" />
              <span className="hidden sm:inline">{ticket.assignee.name.split(' ')[0]}</span>
            </div>
          ) : (
            <span className="text-gray-400">Unassigned</span>
          )}
          <span className="text-gray-300">•</span>
          <span>{format(new Date(ticket.updatedAt), 'MMM d')}</span>
        </div>
      </div>
    </div>
  );
}
