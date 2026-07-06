import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ArrowLeft, Mail, Phone, Building2, Ticket, ExternalLink, Key, UserCheck, UserX, Send } from 'lucide-react';
import { contacts } from '../../api';
import { Badge, Button, Avatar, CenteredSpinner, EmptyState } from '../../components/shared';
import toast from 'react-hot-toast';

const statusConfig = {
  OPEN: { label: 'Open', variant: 'open' },
  PENDING: { label: 'Pending', variant: 'pending' },
  RESOLVED: { label: 'Resolved', variant: 'resolved' },
  INVOICED: { label: 'Invoiced', variant: 'invoiced' },
  POSTED: { label: 'Posted', variant: 'posted' },
};

export default function ContactDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [sendWelcomeEmail, setSendWelcomeEmail] = useState(true);

  const { data, isLoading, error } = useQuery({
    queryKey: ['contact', id],
    queryFn: () => contacts.getContact(id),
  });

  const { data: portalData } = useQuery({
    queryKey: ['contact-portal-status', id],
    queryFn: () => contacts.getPortalStatus(id),
    enabled: !!id,
  });

  const setPasswordMutation = useMutation({
    mutationFn: (data) => contacts.setPortalPassword(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['contact-portal-status', id]);
      toast.success(sendWelcomeEmail ? 'Portal access activated and welcome email sent' : 'Portal access activated');
      setShowPasswordForm(false);
      setNewPassword('');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to set password'),
  });

  const revokeAccessMutation = useMutation({
    mutationFn: () => contacts.revokePortalAccess(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['contact-portal-status', id]);
      toast.success('Portal access revoked');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to revoke access'),
  });

  const handleSetPassword = (e) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setPasswordMutation.mutate({ contactId: id, password: newPassword, sendWelcomeEmail });
  };

  const generatePassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%';
    let pass = '';
    for (let i = 0; i < 12; i++) pass += chars[Math.floor(Math.random() * chars.length)];
    setNewPassword(pass);
  };

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
      <div className="flex items-center gap-3 md:gap-4 mb-4 md:mb-6">
        <button onClick={() => navigate('/contacts')} className="p-2 hover:bg-gray-100 rounded-lg transition-colors touch-manipulation min-w-[40px] min-h-[40px] flex items-center justify-center">
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-3 md:gap-4 min-w-0">
          <Avatar name={contact.name} size="lg" className="flex-shrink-0" />
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 truncate">{contact.name}</h1>
            {contact.company && (
              <Link to={'/companies/' + contact.company.id} className="text-sm text-gray-500 hover:text-primary truncate block">
                {contact.company.name}
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Contact info */}
        <div className="lg:col-span-1 space-y-4 md:space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6">
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

          {/* Portal Access Section - DISABLED */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Portal Access</h2>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm text-amber-800 font-medium">Portal Temporarily Unavailable</p>
              <p className="text-xs text-amber-700 mt-1">
                The customer portal is currently disabled. Portal access management will be available when the portal is re-enabled.
              </p>
            </div>
            {/* PORTAL DISABLED: Original portal access controls preserved below for re-enabling
            {portalData?.hasPortalAccess ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-green-600">
                  <UserCheck size={18} />
                  <span className="text-sm font-medium">Portal access active</span>
                </div>
                {portalData.lastLoginAt && (
                  <p className="text-xs text-gray-500">
                    Last login: {format(new Date(portalData.lastLoginAt), 'MMM d, yyyy h:mm a')}
                  </p>
                )}
                <div className="pt-2 border-t border-gray-200 space-y-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPasswordForm(!showPasswordForm)}
                    className="w-full"
                  >
                    <Key size={14} className="mr-2" />
                    Reset Password
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (confirm('Revoke portal access for this contact?')) {
                        revokeAccessMutation.mutate();
                      }
                    }}
                    className="w-full text-red-600 hover:bg-red-50"
                    disabled={revokeAccessMutation.isLoading}
                  >
                    <UserX size={14} className="mr-2" />
                    Revoke Access
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-gray-500">
                  <UserX size={18} />
                  <span className="text-sm">No portal access</span>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setShowPasswordForm(!showPasswordForm)}
                  className="w-full"
                >
                  <Key size={14} className="mr-2" />
                  Activate Portal Access
                </Button>
              </div>
            )}

            {showPasswordForm && (
              <form onSubmit={handleSetPassword} className="mt-4 pt-4 border-t border-gray-200 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {portalData?.hasPortalAccess ? 'New Password' : 'Initial Password'}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-primary focus:border-primary"
                      placeholder="Min 8 characters"
                      required
                      minLength={8}
                    />
                    <Button type="button" variant="outline" size="sm" onClick={generatePassword}>
                      Generate
                    </Button>
                  </div>
                </div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={sendWelcomeEmail}
                    onChange={(e) => setSendWelcomeEmail(e.target.checked)}
                    className="rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-gray-700">Send welcome email with credentials</span>
                </label>
                <div className="flex gap-2">
                  <Button type="submit" variant="primary" size="sm" disabled={setPasswordMutation.isLoading}>
                    <Send size={14} className="mr-1" />
                    {portalData?.hasPortalAccess ? 'Update Password' : 'Activate'}
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setShowPasswordForm(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            )}
            */}
          </div>
        </div>
        {/* Recent tickets */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6">
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
