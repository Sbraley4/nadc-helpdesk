import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ArrowLeft, Globe, Users, Ticket } from 'lucide-react';
import { companies } from '../../api';
import { Badge, Button, Avatar, CenteredSpinner, EmptyState } from '../../components/shared';

const statusConfig = {
  OPEN: { label: 'Open', variant: 'open' },
  PENDING: { label: 'Pending', variant: 'pending' },
  RESOLVED: { label: 'Resolved', variant: 'resolved' },
  INVOICED: { label: 'Invoiced', variant: 'invoiced' },
  POSTED: { label: 'Posted', variant: 'posted' },
};

export default function CompanyDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ['company', id],
    queryFn: () => companies.getCompany(id),
  });

  if (isLoading) return <CenteredSpinner />;

  if (error || !data?.company) {
    return (
      <EmptyState
        title="Company not found"
        description="The company you are looking for does not exist."
        action={<Button onClick={() => navigate('/companies')}>Back to Companies</Button>}
      />
    );
  }

  const company = data.company;
  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/companies')} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{company.name}</h1>
          {company.domain && (
            <a href={'https://' + company.domain} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline flex items-center gap-1">
              <Globe size={14} />
              {company.domain}
            </a>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Company info */}
        <div className="col-span-1 space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Company Details</h2>
            <div className="space-y-4">
              {company.assignedAgent && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Account Manager</p>
                  <div className="flex items-center gap-2">
                    <Avatar name={company.assignedAgent.name} size="sm" />
                    <span className="text-sm font-medium text-gray-900">{company.assignedAgent.name}</span>
                  </div>
                </div>
              )}
              {company.notes && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Notes</p>
                  <p className="text-sm text-gray-700">{company.notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Contacts list */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Contacts</h2>
              <span className="text-sm text-gray-500">{company.contacts?.length || 0}</span>
            </div>
            {company.contacts?.length > 0 ? (
              <div className="space-y-3">
                {company.contacts.map((contact) => (
                  <Link key={contact.id} to={'/contacts/' + contact.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                    <Avatar name={contact.name} size="sm" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{contact.name}</p>
                      <p className="text-xs text-gray-500">{contact.email}</p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">No contacts</p>
            )}
          </div>
        </div>
        {/* Recent tickets */}
        <div className="col-span-2">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Recent Tickets</h2>
              <Link to={'/tickets?companyId=' + company.id}>
                <Button variant="ghost" size="sm">View All</Button>
              </Link>
            </div>
            {company.tickets?.length > 0 ? (
              <div className="space-y-3">
                {company.tickets.map((ticket) => (
                  <Link
                    key={ticket.id}
                    to={'/tickets/' + ticket.id}
                    className="block p-3 rounded-lg border border-gray-200 hover:border-primary/30 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-primary">#{ticket.ticketNumber}</span>
                        <span className="text-sm font-medium text-gray-900">{ticket.subject}</span>
                        <Badge variant={statusConfig[ticket.status]?.variant} size="sm">
                          {statusConfig[ticket.status]?.label}
                        </Badge>
                      </div>
                      <span className="text-xs text-gray-500">
                        {format(new Date(ticket.updatedAt), 'MMM d, yyyy')}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      {ticket.requester?.name}
                    </p>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-8">No tickets yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
