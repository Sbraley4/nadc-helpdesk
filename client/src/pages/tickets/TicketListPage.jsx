import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Plus, AlertCircle, Clock, CheckCircle, XCircle } from 'lucide-react';
import { tickets } from '../../api';
import { Badge, Button, SearchInput, Select, Pagination, EmptyState, CenteredSpinner, Avatar } from '../../components/shared';

const statusConfig = {
  OPEN: { label: 'Open', variant: 'open', icon: AlertCircle },
  PENDING: { label: 'Pending', variant: 'pending', icon: Clock },
  RESOLVED: { label: 'Resolved', variant: 'resolved', icon: CheckCircle },
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

  const filters = {
    page: parseInt(searchParams.get('page') || '1'),
    search: searchParams.get('search') || '',
    status: searchParams.get('status') || '',
    priority: searchParams.get('priority') || '',
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

  const { data, isLoading, error } = useQuery({
    queryKey: ['tickets', filters],
    queryFn: () => tickets.getTickets({
      page: filters.page,
      limit: 20,
      search: filters.search || undefined,
      status: filters.status || undefined,
      priority: filters.priority || undefined,
    }),
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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tickets</h1>
          <p className="text-sm text-gray-500 mt-1">{pagination.total} total tickets</p>
        </div>
        <Link to="/tickets/new">
          <Button leftIcon={<Plus size={18} />}>New Ticket</Button>
        </Link>
      </div>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <SearchInput value={filters.search} onChange={(value) => updateFilters({ search: value, page: 1 })} placeholder="Search tickets..." className="w-64" />
          <Select options={statusOptions} value={filters.status} onChange={(e) => updateFilters({ status: e.target.value, page: 1 })} className="w-40" />
          <Select options={priorityOptions} value={filters.priority} onChange={(e) => updateFilters({ priority: e.target.value, page: 1 })} className="w-40" />
          {(filters.search || filters.status || filters.priority) && (
            <Button variant="ghost" size="sm" onClick={() => updateFilters({ search: '', status: '', priority: '', page: 1 })}>Clear filters</Button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? <CenteredSpinner /> : ticketList.length === 0 ? (
          <EmptyState
            title="No tickets found"
            description={filters.search || filters.status || filters.priority ? 'Try adjusting your filters' : 'Create your first ticket to get started'}
            action={<Link to="/tickets/new"><Button leftIcon={<Plus size={18} />}>Create Ticket</Button></Link>}
          />
        ) : (
          <>
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
                {ticketList.map((ticket) => <TicketRow key={ticket.id} ticket={ticket} />)}
              </tbody>
            </table>
            <Pagination currentPage={filters.page} totalPages={pagination.pages} totalItems={pagination.total} itemsPerPage={20} onPageChange={(page) => updateFilters({ page })} />
          </>
        )}
      </div>
    </div>
  );
}
function TicketRow({ ticket }) {
  const ticketUrl = '/tickets/' + ticket.id;
  return (
    <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => (window.location.href = ticketUrl)}>
      <td className="px-6 py-4">
        <Link to={ticketUrl} className="block" onClick={(e) => e.stopPropagation()}>
          <p className="text-sm font-medium text-gray-900 hover:text-primary">{ticket.subject}</p>
          <p className="text-xs text-gray-500 mt-0.5">#{ticket.id}</p>
        </Link>
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
          <Avatar name={ticket.contact?.name} size="xs" />
          <div>
            <p className="text-sm text-gray-900">{ticket.contact?.name || 'Unknown'}</p>
            <p className="text-xs text-gray-500">{ticket.contact?.company?.name}</p>
          </div>
        </div>
      </td>
      <td className="px-6 py-4"><Badge variant={statusConfig[ticket.status]?.variant}>{statusConfig[ticket.status]?.label}</Badge></td>
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
