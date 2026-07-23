import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ArrowLeft, Send, User, Clock, CheckCircle, AlertCircle, CheckSquare, DollarSign, Mail } from 'lucide-react';
import { AttachmentList } from '../../components/shared/AttachmentPreview';
import FormattedText from '../../components/shared/FormattedText';
import toast from 'react-hot-toast';
import { portalTickets } from '../../api/portal';
import usePortalAuthStore from '../../store/portalAuthStore';

const statusConfig = {
  OPEN: { label: 'Open', color: 'bg-blue-100 text-blue-800', icon: AlertCircle },
  PENDING: { label: 'Pending', color: 'bg-gray-200 text-gray-700', icon: Clock },
  INVOICED: { label: 'Invoiced', color: 'bg-green-100 text-green-800', icon: DollarSign },
  POSTED: { label: 'Posted', color: 'bg-pink-100 text-pink-800', icon: Mail },
};

export default function PortalTicketDetailPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { contact } = usePortalAuthStore();
  const [replyContent, setReplyContent] = useState('');

  const { data: ticket, isLoading, error } = useQuery({
    queryKey: ['portal-ticket', id],
    queryFn: () => portalTickets.getTicket(id),
  });

  const replyMutation = useMutation({
    mutationFn: (body) => portalTickets.addReply(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries(['portal-ticket', id]);
      setReplyContent('');
      toast.success('Reply sent');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to send reply'),
  });

  const handleSendReply = (e) => {
    e.preventDefault();
    if (!replyContent.trim() || replyContent.trim().length < 10) {
      toast.error('Reply must be at least 10 characters');
      return;
    }
    replyMutation.mutate(replyContent.trim());
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1B2A4A]" />
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Ticket not found</h3>
        <Link to="/portal/tickets" className="text-[#1B2A4A] hover:underline">
          Back to tickets
        </Link>
      </div>
    );
  }

  const status = statusConfig[ticket.status];
  const StatusIcon = status?.icon || AlertCircle;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link to="/portal/tickets" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft size={16} />
          Back to tickets
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm text-gray-500">#{ticket.ticketNumber}</span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${status?.color}`}>
                <StatusIcon size={12} />
                {status?.label}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{ticket.subject}</h1>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Original ticket */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#1B2A4A] flex items-center justify-center text-white font-medium">
                  {contact?.name?.charAt(0) || 'U'}
                </div>
                <div>
                  <p className="font-medium text-gray-900">{contact?.name || 'You'}</p>
                  <p className="text-sm text-gray-500">{format(new Date(ticket.createdAt), 'MMM d, yyyy h:mm a')}</p>
                </div>
              </div>
            </div>
            <div className="p-4">
              <FormattedText
                text={ticket.description}
                className="prose prose-sm max-w-none text-gray-700"
              />
            </div>
          </div>

          {/* Replies */}
          {ticket.replies?.map((reply) => (
            <div key={reply.id} className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className={`p-4 border-b border-gray-200 ${reply.isFromContact ? 'bg-blue-50' : 'bg-gray-50'}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-medium ${
                    reply.isFromContact ? 'bg-blue-600' : 'bg-[#1B2A4A]'
                  }`}>
                    {reply.authorName?.charAt(0) || 'S'}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {reply.authorName}
                      {reply.isFromContact && <span className="text-xs text-blue-600 ml-2">(You)</span>}
                    </p>
                    <p className="text-sm text-gray-500">{format(new Date(reply.createdAt), 'MMM d, yyyy h:mm a')}</p>
                  </div>
                </div>
              </div>
              <div className="p-4">
                <FormattedText
                  text={reply.body}
                  className="prose prose-sm max-w-none text-gray-700"
                />
                <AttachmentList attachments={reply.attachments} />
              </div>
            </div>
          ))}

          {/* Reply form */}
          {ticket.status !== 'INVOICED' && ticket.status !== 'POSTED' && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <h3 className="font-medium text-gray-900 mb-3">Add a Reply</h3>
              <form onSubmit={handleSendReply}>
                <textarea
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder="Type your reply here... (minimum 10 characters)"
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#1B2A4A] focus:border-[#1B2A4A] resize-none"
                />
                <div className="flex justify-end mt-3">
                  <button
                    type="submit"
                    disabled={replyMutation.isPending || replyContent.trim().length < 10}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#1B2A4A] text-white rounded-lg hover:bg-[#152238] transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send size={16} />
                    {replyMutation.isPending ? 'Sending...' : 'Send Reply'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Ticket details */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h3 className="font-medium text-gray-900 mb-4">Ticket Details</h3>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm text-gray-500">Status</dt>
                <dd className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${status?.color}`}>
                  <StatusIcon size={12} />
                  {status?.label}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Priority</dt>
                <dd className="text-sm font-medium text-gray-900 mt-1">{ticket.priority}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Type</dt>
                <dd className="text-sm font-medium text-gray-900 mt-1">{ticket.type?.replace('_', ' ')}</dd>
              </div>
              {ticket.assigneeName && (
                <div>
                  <dt className="text-sm text-gray-500">Assigned To</dt>
                  <dd className="text-sm font-medium text-gray-900 mt-1">{ticket.assigneeName}</dd>
                </div>
              )}
              <div>
                <dt className="text-sm text-gray-500">Created</dt>
                <dd className="text-sm text-gray-900 mt-1">{format(new Date(ticket.createdAt), 'MMM d, yyyy h:mm a')}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Last Updated</dt>
                <dd className="text-sm text-gray-900 mt-1">{format(new Date(ticket.updatedAt), 'MMM d, yyyy h:mm a')}</dd>
              </div>
              {ticket.resolvedAt && (
                <div>
                  <dt className="text-sm text-gray-500">Resolved</dt>
                  <dd className="text-sm text-gray-900 mt-1">{format(new Date(ticket.resolvedAt), 'MMM d, yyyy h:mm a')}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Checklist progress */}
          {ticket.checklistItems?.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
                <CheckSquare size={18} />
                Progress ({ticket.checklistProgress}%)
              </h3>
              <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
                <div
                  className="bg-green-500 h-2 rounded-full transition-all"
                  style={{ width: `${ticket.checklistProgress}%` }}
                />
              </div>
              <ul className="space-y-2">
                {ticket.checklistItems.map((item) => (
                  <li key={item.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={item.isChecked}
                      readOnly
                      className="rounded border-gray-300 text-green-600"
                    />
                    <span className={item.isChecked ? 'text-gray-500 line-through' : 'text-gray-900'}>
                      {item.label}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Resolution summary */}
          {ticket.resolutionSummary && (
            <div className="bg-green-50 rounded-lg border border-green-200 p-4">
              <h3 className="font-medium text-green-900 mb-2">Resolution Summary</h3>
              <FormattedText text={ticket.resolutionSummary} as="p" className="text-sm text-green-800" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
