import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ArrowLeft, Send, Paperclip, Clock, User, Building2, MoreVertical } from 'lucide-react';
import toast from 'react-hot-toast';
import { tickets, replies, agents } from '../../api';
import { Badge, Button, Select, Avatar, CenteredSpinner, EmptyState, Textarea } from '../../components/shared';
import useAuthStore from '../../store/authStore';
import { useTicketSocket } from '../../hooks/useSocket';

const statusConfig = {
  OPEN: { label: 'Open', variant: 'open' },
  PENDING: { label: 'Pending', variant: 'pending' },
  RESOLVED: { label: 'Resolved', variant: 'resolved' },
  CLOSED: { label: 'Closed', variant: 'closed' },
};

const priorityConfig = {
  LOW: { label: 'Low', variant: 'low' },
  MEDIUM: { label: 'Medium', variant: 'medium' },
  HIGH: { label: 'High', variant: 'high' },
  URGENT: { label: 'Urgent', variant: 'urgent' },
};

const statusOptions = [
  { value: 'OPEN', label: 'Open' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'CLOSED', label: 'Closed' },
];

const priorityOptions = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
];
export default function TicketDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [replyContent, setReplyContent] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);

  // Connect to ticket socket room
  const socket = useTicketSocket(id);

  // Handle incoming typing events
  useEffect(() => {
    if (!socket) return;

    const handleTyping = ({ ticketId, user: typingUser, isTyping }) => {
      if (ticketId !== id) return;

      setTypingUsers((prev) => {
        if (isTyping) {
          // Add user if not already in list
          if (!prev.find((u) => u.id === typingUser.id)) {
            return [...prev, typingUser];
          }
          return prev;
        } else {
          // Remove user
          return prev.filter((u) => u.id !== typingUser.id);
        }
      });
    };

    socket.on('ticket:typing', handleTyping);

    // Handle real-time reply updates
    const handleNewReply = ({ ticketId, reply }) => {
      if (ticketId !== id) return;
      // Invalidate replies query to refetch
      queryClient.invalidateQueries(['replies', id]);
    };

    // Handle ticket updates (status, priority, etc.)
    const handleTicketUpdate = ({ ticketId, changes }) => {
      if (ticketId !== id) return;
      // Invalidate ticket query to refetch
      queryClient.invalidateQueries(['ticket', id]);
    };

    socket.on('ticket:reply', handleNewReply);
    socket.on('ticket:updated', handleTicketUpdate);

    return () => {
      socket.off('ticket:typing', handleTyping);
      socket.off('ticket:reply', handleNewReply);
      socket.off('ticket:updated', handleTicketUpdate);
    };
  }, [socket, id, queryClient]);

  // Send typing indicator
  const sendTypingStatus = useCallback(
    (isTyping) => {
      if (!socket || !user) return;
      socket.emit('ticket:typing', {
        ticketId: id,
        user: { id: user.id, name: user.name },
        isTyping,
      });
    },
    [socket, id, user]
  );

  // Handle reply content change with typing indicator
  const handleReplyChange = (e) => {
    setReplyContent(e.target.value);

    // Send typing started if not already typing
    if (!isTypingRef.current && e.target.value.length > 0) {
      isTypingRef.current = true;
      sendTypingStatus(true);
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set timeout to clear typing status
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      sendTypingStatus(false);
    }, 3000);
  };

  // Clean up typing status on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (isTypingRef.current) {
        sendTypingStatus(false);
      }
    };
  }, [sendTypingStatus]);

  // Fetch ticket
  const { data: ticketData, isLoading, error } = useQuery({
    queryKey: ['ticket', id],
    queryFn: () => tickets.getTicket(id),
  });

  // Fetch replies
  const { data: repliesData } = useQuery({
    queryKey: ['replies', id],
    queryFn: () => replies.getReplies(id),
    enabled: !!id,
  });

  // Fetch agents for assignment
  const { data: agentsData } = useQuery({
    queryKey: ['agents'],
    queryFn: agents.getAgents,
  });

  // Update ticket mutation
  const updateMutation = useMutation({
    mutationFn: (data) => tickets.updateTicket(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['ticket', id]);
      toast.success('Ticket updated');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to update ticket');
    },
  });

  // Create reply mutation
  const replyMutation = useMutation({
    mutationFn: (data) => replies.createReply(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['replies', id]);
      setReplyContent('');
      toast.success(isInternalNote ? 'Note added' : 'Reply sent');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to send reply');
    },
  });
  const handleSendReply = () => {
    if (!replyContent.trim()) return;
    replyMutation.mutate({
      content: replyContent,
      isInternal: isInternalNote,
    });
  };

  const agentOptions = [
    { value: '', label: 'Unassigned' },
    ...(agentsData?.agents || []).map((agent) => ({
      value: agent.id,
      label: agent.name,
    })),
  ];

  if (isLoading) return <CenteredSpinner />;

  if (error || !ticketData?.ticket) {
    return (
      <EmptyState
        title="Ticket not found"
        description="The ticket you are looking for does not exist."
        action={<Button onClick={() => navigate('/tickets')}>Back to Tickets</Button>}
      />
    );
  }

  const ticket = ticketData.ticket;
  const replyList = repliesData?.replies || [];
  return (
    <div className="flex gap-6">
      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => navigate('/tickets')} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900">{ticket.subject}</h1>
              <span className="text-gray-500">#{ticket.id}</span>
            </div>
          </div>
        </div>

        {/* Conversation */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {/* Original ticket description */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-start gap-3">
              <Avatar name={ticket.contact?.name} size="md" />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-gray-900">{ticket.contact?.name}</span>
                  <span className="text-sm text-gray-500">{format(new Date(ticket.createdAt), 'MMM d, yyyy h:mm a')}</span>
                </div>
                <div className="prose prose-sm max-w-none text-gray-700" dangerouslySetInnerHTML={{ __html: ticket.description }} />
              </div>
            </div>
          </div>
          {/* Replies */}
          {replyList.map((reply) => (
            <div key={reply.id} className={"p-6 border-b border-gray-200 " + (reply.isInternal ? 'bg-yellow-50' : '')}>
              <div className="flex items-start gap-3">
                <Avatar name={reply.author?.name} size="md" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-gray-900">{reply.author?.name}</span>
                    {reply.isInternal && <Badge variant="warning" size="sm">Internal Note</Badge>}
                    <span className="text-sm text-gray-500">{format(new Date(reply.createdAt), 'MMM d, yyyy h:mm a')}</span>
                  </div>
                  <div className="prose prose-sm max-w-none text-gray-700" dangerouslySetInnerHTML={{ __html: reply.content }} />
                </div>
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {typingUsers.length > 0 && (
            <div className="px-6 py-2 bg-gray-50 border-b border-gray-200 text-sm text-gray-600">
              <span className="inline-flex items-center gap-2">
                <span className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
                {typingUsers.length === 1
                  ? `${typingUsers[0].name} is typing...`
                  : `${typingUsers.map((u) => u.name).join(', ')} are typing...`}
              </span>
            </div>
          )}

          {/* Reply form */}
          <div className="p-6">
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => setIsInternalNote(false)}
                className={"px-3 py-1.5 text-sm font-medium rounded-lg transition-colors " + (!isInternalNote ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}
              >
                Reply
              </button>
              <button
                type="button"
                onClick={() => setIsInternalNote(true)}
                className={"px-3 py-1.5 text-sm font-medium rounded-lg transition-colors " + (isInternalNote ? 'bg-yellow-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}
              >
                Internal Note
              </button>
            </div>
            <Textarea
              value={replyContent}
              onChange={handleReplyChange}
              placeholder={isInternalNote ? 'Add an internal note...' : 'Type your reply...'}
              rows={4}
            />
            <div className="flex justify-end mt-3">
              <Button
                onClick={handleSendReply}
                isLoading={replyMutation.isPending}
                disabled={!replyContent.trim()}
                leftIcon={<Send size={16} />}
              >
                {isInternalNote ? 'Add Note' : 'Send Reply'}
              </Button>
            </div>
          </div>
        </div>
      </div>
      {/* Sidebar */}
      <div className="w-80 flex-shrink-0">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 space-y-4">
          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <Select
              options={statusOptions}
              value={ticket.status}
              onChange={(e) => updateMutation.mutate({ status: e.target.value })}
            />
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
            <Select
              options={priorityOptions}
              value={ticket.priority}
              onChange={(e) => updateMutation.mutate({ priority: e.target.value })}
            />
          </div>

          {/* Assignee */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Assigned To</label>
            <Select
              options={agentOptions}
              value={ticket.assigneeId || ''}
              onChange={(e) => updateMutation.mutate({ assigneeId: e.target.value || null })}
            />
          </div>

          <hr className="border-gray-200" />

          {/* Contact info */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Contact</h3>
            <div className="flex items-center gap-2">
              <Avatar name={ticket.contact?.name} size="sm" />
              <div>
                <Link to={'/contacts/' + ticket.contact?.id} className="text-sm font-medium text-gray-900 hover:text-primary">
                  {ticket.contact?.name}
                </Link>
                <p className="text-xs text-gray-500">{ticket.contact?.email}</p>
              </div>
            </div>
          </div>

          {/* Company info */}
          {ticket.contact?.company && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Company</h3>
              <div className="flex items-center gap-2">
                <Building2 size={16} className="text-gray-400" />
                <Link to={'/companies/' + ticket.contact.company.id} className="text-sm text-gray-900 hover:text-primary">
                  {ticket.contact.company.name}
                </Link>
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div className="text-xs text-gray-500 space-y-1">
            <p>Created: {format(new Date(ticket.createdAt), 'MMM d, yyyy h:mm a')}</p>
            <p>Updated: {format(new Date(ticket.updatedAt), 'MMM d, yyyy h:mm a')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
