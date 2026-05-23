import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ArrowLeft, Mail, Phone, Building2, Ticket, ExternalLink } from 'lucide-react';
import { contacts } from '../../api';
import { Badge, Button, Avatar, CenteredSpinner, EmptyState } from '../../components/shared';

const statusConfig = {
  OPEN: { label: 'Open', variant: 'open' },
  PENDING: { label: 'Pending', variant: 'pending' },
  RESOLVED: { label: 'Resolved', variant: 'resolved' },
  CLOSED: { label: 'Closed', variant: 'closed' },
};

export default function ContactDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ['contact', id],
    queryFn: () => contacts.getContact(id),
  });

  if (isLoading) return <CenteredSpinner />;

  if (error || !data?.contact) {
    return (
      <EmptyState
        title="Contact not found"
        description="The contact you are looking for does not exist."
        action={<Button onClick={() => navigate('/contacts')}>Back to Contacts</Button>}
      />
    );
  }

  const contact = data.contact;
  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/contacts')} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-4">
          <Avatar name={contact.name} size="lg" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{contact.name}</h1>
            {contact.company && (
              <Link to={'/companies/' + contact.company.id} className="text-sm text-gray-500 hover:text-primary">
                {contact.company.name}
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Contact info */}
        <div className="col-span-1">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h2>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Mail size={18} className="text-gray-400" />
                <a href={'mailto:' + contact.email} className="text-sm text-primary hover:underline">{contact.email}</a>
              </div>
              {contact.phone && (
                <div className="flex items-center gap-3">
                  <Phone size={18} className="text-gray-400" />
                  <span className="text-sm text-gray-700">{contact.phone}</span>
                </div>
              )}
              {contact.company && (
                <div className="flex items-center gap-3">
                  <Building2 size={18} className="text-gray-400" />
                  <Link to={'/companies/' + contact.company.id} className="text-sm text-primary hover:underline">
                    {contact.company.name}
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
        {/* Recent tickets */}
        <div className="col-span-2">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Recent Tickets</h2>
              <Link to={'/tickets?contactId=' + contact.id}>
                <Button variant="ghost" size="sm">View All</Button>
              </Link>
            </div>
            {contact.tickets?.length > 0 ? (
              <div className="space-y-3">
                {contact.tickets.map((ticket) => (
                  <Link
                    key={ticket.id}
                    to={'/tickets/' + ticket.id}
                    className="block p-3 rounded-lg border border-gray-200 hover:border-primary/30 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">{ticket.subject}</span>
                        <Badge variant={statusConfig[ticket.status]?.variant} size="sm">
                          {statusConfig[ticket.status]?.label}
                        </Badge>
                      </div>
                      <span className="text-xs text-gray-500">
                        {format(new Date(ticket.updatedAt), 'MMM d, yyyy')}
                      </span>
                    </div>
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
