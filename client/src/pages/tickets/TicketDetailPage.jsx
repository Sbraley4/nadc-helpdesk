import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ArrowLeft, Send, Paperclip, Clock, User, Building2, MoreVertical, BookOpen, Search, X, FileText, Bell, Pencil, Trash2, Forward, MessageSquare, CheckSquare, Square, Plus, ChevronDown, ChevronUp, Zap, Settings2, Calendar, Package, CheckCircle, XCircle, Car, Calculator } from 'lucide-react';
import toast from 'react-hot-toast';
import { tickets, replies, agents, kb, templates, checklist, timeEntries, inventory } from '../../api';
import { Badge, Button, Select, Avatar, CenteredSpinner, EmptyState, Textarea, Input, MultiSelectAgents, ScheduleTicketModal, FileUpload } from '../../components/shared';
import useAuthStore from '../../store/authStore';
import { useTicketSocket } from '../../hooks/useSocket';

const statusConfig = {
  OPEN: { label: 'Open', variant: 'open' },
  PENDING: { label: 'Pending', variant: 'pending' },
  RESOLVED: { label: 'Resolved', variant: 'resolved' },
  INVOICED: { label: 'Invoiced', variant: 'invoiced' },
  POSTED: { label: 'Posted', variant: 'posted' },
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
  { value: 'INVOICED', label: 'Invoiced' },
  { value: 'POSTED', label: 'Posted' },
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
  const [isInternalNote, setIsInternalNote] = useState(true);
  const [typingUsers, setTypingUsers] = useState([]);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);
  const [showKBModal, setShowKBModal] = useState(false);
  const [kbSearchQuery, setKbSearchQuery] = useState('');
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateSearchQuery, setTemplateSearchQuery] = useState('');
  const [notifyAgents, setNotifyAgents] = useState([]);
  const [editingReplyId, setEditingReplyId] = useState(null);
  const [editingReplyContent, setEditingReplyContent] = useState('');
  const [forwardingReply, setForwardingReply] = useState(null);
  const [forwardAgentId, setForwardAgentId] = useState('');
  const [threadReplyId, setThreadReplyId] = useState(null);
  const [threadContent, setThreadContent] = useState('');
  const [replyFiles, setReplyFiles] = useState([]);

  // Checklist state
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [showChecklist, setShowChecklist] = useState(true);

  // Time logging in notes state
  const [showTimeLog, setShowTimeLog] = useState(false);
  const [timeLogDate, setTimeLogDate] = useState(new Date().toISOString().split('T')[0]);
  const [timeLogStartTime, setTimeLogStartTime] = useState('');
  const [timeLogFinishTime, setTimeLogFinishTime] = useState('');
  const [timeLogBtoType, setTimeLogBtoType] = useState('BTO'); // 'BTO' or 'ETA'
  const [timeLogBtoTime, setTimeLogBtoTime] = useState('');
  const [timeLogBtoLocation, setTimeLogBtoLocation] = useState('');
  const [timeLogDescription, setTimeLogDescription] = useState('');

  // Smart note parser state
  const [parsedData, setParsedData] = useState(null);
  const [showParsePreview, setShowParsePreview] = useState(false);

  // Note expansion state
  const [expandedNotes, setExpandedNotes] = useState({});

  // Mobile sidebar state
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

  // Ticket action menu state
  const [showTicketMenu, setShowTicketMenu] = useState(false);
  const [showEditTicketModal, setShowEditTicketModal] = useState(false);
  const [editSubject, setEditSubject] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [forwardToAgentId, setForwardToAgentId] = useState('');
  const [forwardNote, setForwardNote] = useState('');
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleModalMode, setScheduleModalMode] = useState('add'); // 'add' or 'reschedule'
  const [rescheduleId, setRescheduleId] = useState(null);

  // Schedule entries state
  const [scheduleEntries, setScheduleEntries] = useState([]);
  const [loadingSchedules, setLoadingSchedules] = useState(false);

  // Inventory deductions state
  const [ticketDeductions, setTicketDeductions] = useState([]);
  const [loadingDeductions, setLoadingDeductions] = useState(false);
  const [processingDeduction, setProcessingDeduction] = useState(null);
  const [showInventory, setShowInventory] = useState(true);

  // Mileage state
  const [localMileage, setLocalMileage] = useState('');
  const [localMileageNotes, setLocalMileageNotes] = useState('');
  const [localDestinationAddress, setLocalDestinationAddress] = useState('');
  const [isCalculatingMileage, setIsCalculatingMileage] = useState(false);
  const [showMileage, setShowMileage] = useState(true);

  // Helper function to format note body with preserved line breaks
  const formatNoteBody = (body, isExpanded = true) => {
    if (!body) return '';
    // Convert newlines to <br> tags to preserve formatting
    const formattedBody = body
      .replace(/\n/g, '<br>')
      .replace(/  /g, '&nbsp;&nbsp;'); // Preserve double spaces

    // If not expanded, truncate to first 150 chars or first 2 lines
    if (!isExpanded) {
      const lines = body.split('\n');
      const previewLines = lines.slice(0, 2);
      let preview = previewLines.join('\n');
      if (lines.length > 2 || preview.length > 150) {
        preview = preview.substring(0, 150) + '...';
      }
      return preview.replace(/\n/g, '<br>').replace(/  /g, '&nbsp;&nbsp;');
    }
    return formattedBody;
  };

  // Toggle note expansion
  const toggleNoteExpanded = (replyId) => {
    setExpandedNotes(prev => ({
      ...prev,
      [replyId]: !prev[replyId],
    }));
  };

  // Check if a note needs expansion (more than 2 lines or > 150 chars)
  const needsExpansion = (body) => {
    if (!body) return false;
    const lines = body.split('\n');
    return lines.length > 2 || body.length > 150;
  };

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
    queryFn: () => agents.getAgents(),
  });

  // Search KB articles
  const { data: kbSearchResults } = useQuery({
    queryKey: ['kb-search', kbSearchQuery],
    queryFn: () => kb.searchArticles(kbSearchQuery, 10),
    enabled: kbSearchQuery.length >= 2 && showKBModal,
  });

  // Fetch templates for template modal
  const { data: templatesData } = useQuery({
    queryKey: ['templates'],
    queryFn: () => templates.getTemplates(),
    enabled: showTemplateModal,
  });

  // Fetch checklist items
  const { data: checklistData } = useQuery({
    queryKey: ['checklist', id],
    queryFn: () => checklist.getChecklist(id),
    enabled: !!id,
  });

  // Fetch ticket schedule entries
  const { data: schedulesData, refetch: refetchSchedules } = useQuery({
    queryKey: ['ticket-schedules', id],
    queryFn: () => tickets.getSchedules(id),
    enabled: !!id,
  });

  // Fetch ticket inventory deductions
  const { data: deductionsData, refetch: refetchDeductions } = useQuery({
    queryKey: ['ticket-deductions', id],
    queryFn: () => inventory.getTicketDeductions(id),
    enabled: !!id,
  });

  const checklistItems = checklistData?.items || [];
  const schedulesList = schedulesData?.schedules || [];
  const deductionsList = deductionsData?.deductions || [];

  // Handle approve deduction
  const handleApproveDeduction = async (deductionId) => {
    setProcessingDeduction(deductionId);
    try {
      await inventory.approveDeduction(deductionId);
      toast.success('Deduction approved');
      refetchDeductions();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to approve');
    } finally {
      setProcessingDeduction(null);
    }
  };

  // Handle reject deduction
  const handleRejectDeduction = async (deductionId) => {
    setProcessingDeduction(deductionId);
    try {
      await inventory.rejectDeduction(deductionId);
      toast.success('Deduction rejected');
      refetchDeductions();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to reject');
    } finally {
      setProcessingDeduction(null);
    }
  };

  // Initialize mileage state when ticket loads
  useEffect(() => {
    if (ticketData) {
      setLocalMileage(ticketData.mileage?.toString() || '');
      setLocalMileageNotes(ticketData.mileageNotes || '');
      // Pre-populate destination address from company address if available
      if (ticketData.company?.address && !localDestinationAddress) {
        setLocalDestinationAddress(ticketData.company.address);
      }
    }
  }, [ticketData?.id, ticketData?.mileage, ticketData?.mileageNotes, ticketData?.company?.address]);

  // Handle calculate mileage
  const handleCalculateMileage = async () => {
    if (!localDestinationAddress.trim()) {
      toast.error('Please enter a destination address');
      return;
    }
    setIsCalculatingMileage(true);
    try {
      const result = await tickets.calculateMileage(id, localDestinationAddress.trim());
      setLocalMileage(result.mileage?.toString() || '');
      queryClient.invalidateQueries(['ticket', id]);
      toast.success(`Mileage calculated: ${result.mileage} miles`);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to calculate mileage');
    } finally {
      setIsCalculatingMileage(false);
    }
  };

  // Handle save mileage
  const handleSaveMileage = () => {
    const mileageValue = localMileage ? parseFloat(localMileage) : null;
    updateMutation.mutate({
      mileage: mileageValue,
      mileageNotes: localMileageNotes || null,
    });
  };

  // Delete schedule mutation
  const deleteScheduleMutation = useMutation({
    mutationFn: (scheduleId) => tickets.deleteSchedule(id, scheduleId),
    onSuccess: () => {
      queryClient.invalidateQueries(['ticket-schedules', id]);
      toast.success('Schedule entry removed');
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to remove schedule');
    },
  });

  // Filter templates by search query
  const filteredTemplates = (templatesData?.templates || []).filter(
    (t) =>
      templateSearchQuery.length < 2 ||
      t.name.toLowerCase().includes(templateSearchQuery.toLowerCase()) ||
      t.description?.toLowerCase().includes(templateSearchQuery.toLowerCase())
  );

  // Insert template content into reply
  const handleInsertTemplate = (template) => {
    const templateContent = template.description || template.subject || '';
    setReplyContent((prev) => prev + (prev ? '\n\n' : '') + templateContent);
    setShowTemplateModal(false);
    setTemplateSearchQuery('');
    toast.success('Template inserted');
  };

  // Insert KB article content into reply
  const handleInsertKBArticle = async (article) => {
    try {
      const articleData = await kb.getArticle(article.slug);
      const articleContent = `\n\n--- From Knowledge Base: ${articleData.title} ---\n\n${articleData.body}\n`;
      setReplyContent((prev) => prev + articleContent);
      setShowKBModal(false);
      setKbSearchQuery('');
      toast.success('Article inserted');
    } catch (err) {
      toast.error('Failed to load article');
    }
  };

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

  // Edit reply mutation
  const editReplyMutation = useMutation({
    mutationFn: ({ replyId, body }) => replies.updateReply(id, replyId, { body }),
    onSuccess: () => {
      queryClient.invalidateQueries(['replies', id]);
      setEditingReplyId(null);
      setEditingReplyContent('');
      toast.success('Note updated');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to update note');
    },
  });

  // Delete reply mutation
  const deleteReplyMutation = useMutation({
    mutationFn: (replyId) => replies.deleteReply(id, replyId),
    onSuccess: () => {
      queryClient.invalidateQueries(['replies', id]);
      toast.success('Note deleted');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to delete note');
    },
  });

  // Checklist mutations
  const addChecklistMutation = useMutation({
    mutationFn: (data) => checklist.addItem(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['checklist', id]);
      setNewChecklistItem('');
      toast.success('Checklist item added');
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to add item');
    },
  });

  const updateChecklistMutation = useMutation({
    mutationFn: ({ itemId, data }) => checklist.updateItem(id, itemId, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['checklist', id]);
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to update item');
    },
  });

  const deleteChecklistMutation = useMutation({
    mutationFn: (itemId) => checklist.deleteItem(id, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries(['checklist', id]);
      toast.success('Item deleted');
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to delete item');
    },
  });

  // Time entry mutation
  const createTimeEntryMutation = useMutation({
    mutationFn: (data) => timeEntries.createTimeEntry(id, data),
    onSuccess: () => {
      toast.success('Time logged');
      setTimeLogStartTime('');
      setTimeLogFinishTime('');
      setTimeLogDescription('');
      setShowTimeLog(false);
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to log time');
    },
  });
  // Helper function to format time for display (e.g., "9:00am")
  const formatTimeDisplay = (time24) => {
    if (!time24) return '';
    const [hours, minutes] = time24.split(':').map(Number);
    const period = hours >= 12 ? 'pm' : 'am';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')}${period}`;
  };

  // Helper function to calculate duration in hours and minutes from start/finish times
  const calculateDuration = (startTime, finishTime) => {
    if (!startTime || !finishTime) return { hours: 0, minutes: 0 };
    const [startHours, startMinutes] = startTime.split(':').map(Number);
    const [finishHours, finishMinutes] = finishTime.split(':').map(Number);
    let totalMinutes = (finishHours * 60 + finishMinutes) - (startHours * 60 + startMinutes);
    if (totalMinutes < 0) totalMinutes += 24 * 60; // Handle overnight
    return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 };
  };

  // Format the time log description with start/finish/BTO format
  const formatTimeLogDescription = () => {
    let desc = '';
    if (timeLogStartTime && timeLogFinishTime) {
      desc = `${formatTimeDisplay(timeLogStartTime)} - ${formatTimeDisplay(timeLogFinishTime)}`;
      if (timeLogBtoTime) {
        if (timeLogBtoType === 'BTO') {
          desc += ` | BTO ${formatTimeDisplay(timeLogBtoTime)}`;
        } else {
          desc += ` | ETA to ${timeLogBtoLocation || '[Location]'} - ${formatTimeDisplay(timeLogBtoTime)}`;
        }
      }
    }
    return desc;
  };

  const handleSendReply = async () => {
    if (!replyContent.trim()) return;

    // Build the note body with time log info if present
    let noteBody = replyContent;

    // If time logging fields are filled, create time entry and append to note
    if (isInternalNote && showTimeLog && timeLogStartTime && timeLogFinishTime) {
      const { hours, minutes } = calculateDuration(timeLogStartTime, timeLogFinishTime);
      if (hours > 0 || minutes > 0) {
        try {
          const formattedDesc = formatTimeLogDescription();
          await timeEntries.createTimeEntry(id, {
            date: timeLogDate,
            hours,
            minutes,
            description: formattedDesc || timeLogDescription || replyContent.substring(0, 200),
          });
          toast.success('Time logged');

          // Append time log info to the note body
          const dateFormatted = new Date(timeLogDate).toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
          });
          let timeLogSummary = `\n\n--- Time Logged ---\nDate: ${dateFormatted}\nTime: ${formattedDesc}`;
          timeLogSummary += `\nDuration: ${hours}h ${minutes}m`;
          noteBody += timeLogSummary;
        } catch (err) {
          toast.error('Failed to log time');
        }
      }
    }

    const formData = new FormData();
    formData.append('body', noteBody);
    formData.append('isInternal', isInternalNote);
    if (isInternalNote && notifyAgents.length > 0) {
      formData.append('notifyAgentIds', JSON.stringify(notifyAgents));
    }
    // Append files to FormData
    replyFiles.forEach((file) => {
      formData.append('files', file);
    });
    replyMutation.mutate(formData);
    setNotifyAgents([]);
    setReplyFiles([]);
    setTimeLogStartTime('');
    setTimeLogFinishTime('');
    setTimeLogBtoType('BTO');
    setTimeLogBtoTime('');
    setTimeLogBtoLocation('');
    setTimeLogDescription('');
    setShowTimeLog(false);
  };

  // Smart note parser - parses time patterns and material entries
  const parseNote = () => {
    const text = replyContent;
    const result = { time: null, materials: [] };

    // Parse time patterns: "9:00am-3:00pm", "9am-3pm", "9:00-15:00"
    const timePatterns = [
      /(\d{1,2}):?(\d{2})?\s*(am|pm)?\s*[-–]\s*(\d{1,2}):?(\d{2})?\s*(am|pm)?/gi,
    ];

    for (const pattern of timePatterns) {
      const match = text.match(pattern);
      if (match) {
        const timeStr = match[0];
        // Parse start and end times
        const parts = timeStr.split(/[-–]/);
        if (parts.length === 2) {
          const parseTime = (str) => {
            const m = str.trim().match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/i);
            if (m) {
              let hours = parseInt(m[1]);
              const mins = parseInt(m[2]) || 0;
              const period = (m[3] || '').toLowerCase();
              if (period === 'pm' && hours < 12) hours += 12;
              if (period === 'am' && hours === 12) hours = 0;
              return hours + mins / 60;
            }
            return null;
          };
          const startHours = parseTime(parts[0]);
          const endHours = parseTime(parts[1]);
          if (startHours !== null && endHours !== null) {
            let duration = endHours - startHours;
            if (duration < 0) duration += 24; // Handle overnight
            result.time = {
              hours: Math.floor(duration),
              minutes: Math.round((duration % 1) * 60),
              source: timeStr,
            };
          }
        }
        break;
      }
    }

    // Parse material patterns: lines starting with "-" that contain quantities
    const lines = text.split('\n');
    const materialPattern = /^-\s*(\d+(?:\.\d+)?)\s*(.+)/;
    for (const line of lines) {
      const match = line.match(materialPattern);
      if (match) {
        result.materials.push({
          quantity: parseFloat(match[1]),
          description: match[2].trim(),
        });
      }
    }

    if (result.time || result.materials.length > 0) {
      setParsedData(result);
      setShowParsePreview(true);
    } else {
      toast('No time or materials found in note', { icon: 'ℹ️' });
    }
  };

  // Confirm parsed data
  const confirmParsedData = async () => {
    try {
      // Create time entry if parsed
      if (parsedData.time) {
        await timeEntries.createTimeEntry(id, {
          date: new Date().toISOString().split('T')[0],
          hours: parsedData.time.hours,
          minutes: parsedData.time.minutes,
          description: `Parsed from note: ${parsedData.time.source}`,
        });
      }

      // Note: Materials would need a separate API - for now just log them
      if (parsedData.materials.length > 0) {
        toast.success(`Found ${parsedData.materials.length} materials (material logging requires manual entry)`);
      }

      toast.success(`Time logged: ${parsedData.time?.hours || 0}h ${parsedData.time?.minutes || 0}m`);
      setShowParsePreview(false);
      setParsedData(null);
    } catch (err) {
      toast.error('Failed to log parsed data');
    }
  };

  // Delete ticket mutation
  const deleteMutation = useMutation({
    mutationFn: () => tickets.deleteTicket(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['tickets']);
      toast.success('Ticket deleted');
      navigate('/tickets');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to delete ticket');
    },
  });

  // Handle delete ticket
  const handleDeleteTicket = () => {
    if (confirm('Are you sure you want to delete this ticket? This action cannot be undone.')) {
      deleteMutation.mutate();
    }
  };

  // Handle edit ticket
  const handleOpenEditModal = () => {
    setEditSubject(ticket?.subject || '');
    setEditDescription(ticket?.description?.replace(/<[^>]*>/g, '') || '');
    setShowEditTicketModal(true);
    setShowTicketMenu(false);
  };

  const handleSaveTicketEdit = () => {
    updateMutation.mutate({
      subject: editSubject,
      description: editDescription,
    }, {
      onSuccess: () => {
        setShowEditTicketModal(false);
        toast.success('Ticket updated');
      }
    });
  };

  // Handle forward ticket
  const handleForwardTicket = () => {
    if (!forwardToAgentId) return;

    // Update assignee and add a note about forwarding
    updateMutation.mutate({ assigneeId: forwardToAgentId }, {
      onSuccess: () => {
        // Add an internal note about the forward
        if (forwardNote.trim()) {
          const formData = new FormData();
          formData.append('body', `Ticket forwarded to ${agentsData?.agents?.find(a => a.id === forwardToAgentId)?.name || 'agent'}: ${forwardNote}`);
          formData.append('isInternal', true);
          replyMutation.mutate(formData);
        }
        setShowForwardModal(false);
        setForwardToAgentId('');
        setForwardNote('');
        toast.success('Ticket forwarded');
      }
    });
  };

  // Handle start thread (scroll to reply area and set internal note mode)
  const handleStartThread = () => {
    setIsInternalNote(true);
    setShowTicketMenu(false);
    // Scroll to reply area
    document.querySelector('textarea')?.focus();
  };

  const agentOptions = [
    { value: '', label: 'Unassigned' },
    ...(agentsData?.agents || []).map((agent) => ({
      value: agent.id,
      label: agent.name,
    })),
  ];

  if (isLoading) return <CenteredSpinner />;

  if (error || !ticketData?.id) {
    return (
      <EmptyState
        title="Ticket not found"
        description="The ticket you are looking for does not exist."
        action={<Button onClick={() => navigate('/tickets')}>Back to Tickets</Button>}
      />
    );
  }

  const ticket = ticketData;
  const replyList = repliesData?.replies || [];
  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center gap-2 md:gap-4 mb-4 md:mb-6">
          <button onClick={() => navigate('/tickets')} className="p-2 hover:bg-gray-100 rounded-lg transition-colors touch-manipulation min-w-[40px] min-h-[40px] flex items-center justify-center">
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-2">
              <h1 className="text-lg md:text-xl font-bold text-gray-900 truncate">{ticket.subject}</h1>
              <span className="text-sm text-gray-500">#{ticket.ticketNumber}</span>
            </div>
          </div>
          {/* Ticket action buttons */}
          <div className="relative">
            <button
              onClick={() => setShowTicketMenu(!showTicketMenu)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors touch-manipulation min-w-[40px] min-h-[40px] flex items-center justify-center"
              title="Ticket Actions"
            >
              <MoreVertical size={20} />
            </button>
            {showTicketMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowTicketMenu(false)} />
                <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50 py-1">
                  <button
                    onClick={handleOpenEditModal}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <Pencil size={16} />
                    Edit Ticket
                  </button>
                  <button
                    onClick={() => {
                      setScheduleModalMode('add');
                      setRescheduleId(null);
                      setShowScheduleModal(true);
                      setShowTicketMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <Calendar size={16} />
                    Add to Calendar
                  </button>
                  <button
                    onClick={handleStartThread}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <MessageSquare size={16} />
                    Start a Thread
                  </button>
                  <button
                    onClick={() => { setShowForwardModal(true); setShowTicketMenu(false); }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <Forward size={16} />
                    Forward Ticket
                  </button>
                  <hr className="my-1" />
                  <button
                    onClick={() => { handleDeleteTicket(); setShowTicketMenu(false); }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <Trash2 size={16} />
                    Delete Ticket
                  </button>
                </div>
              </>
            )}
          </div>
          {/* Mobile sidebar toggle */}
          <button
            onClick={() => setShowMobileSidebar(true)}
            className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors touch-manipulation min-w-[40px] min-h-[40px] flex items-center justify-center"
            title="Ticket Details"
          >
            <Settings2 size={20} />
          </button>
        </div>

        {/* Conversation */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {/* Original ticket description */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-start gap-3">
              <Avatar name={ticket.requester?.name} size="md" />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-gray-900">{ticket.requester?.name}</span>
                  <span className="text-sm text-gray-500">{format(new Date(ticket.createdAt), 'MMM d, yyyy h:mm a')}</span>
                </div>
                <div className="prose prose-sm max-w-none text-gray-700" dangerouslySetInnerHTML={{ __html: ticket.description }} />
                {/* Ticket-level attachments */}
                {ticket.attachments?.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-xs font-medium text-gray-500 mb-2">Attachments:</p>
                    <div className="flex flex-wrap gap-2">
                      {ticket.attachments.map((att) => (
                        <a
                          key={att.id}
                          href={`/api/attachments/${att.id}/download`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-lg text-sm text-gray-700 hover:bg-gray-200 transition-colors"
                        >
                          <Paperclip size={14} />
                          <span className="truncate max-w-[200px]">{att.filename}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          {/* Replies */}
          {replyList.map((reply) => (
            <div key={reply.id} className={"p-6 border-b border-gray-200 group relative " + (reply.isInternal ? 'bg-yellow-50' : '')}>
              <div className="flex items-start gap-3">
                <Avatar name={reply.author?.name} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900">{reply.author?.name}</span>
                      {reply.isInternal && <Badge variant="warning" size="sm">Internal Note</Badge>}
                    </div>
                    <span className="text-xs sm:text-sm text-gray-500">{format(new Date(reply.createdAt), 'MMM d, yyyy h:mm a')}</span>
                  </div>
                  {editingReplyId === reply.id ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editingReplyContent}
                        onChange={(e) => setEditingReplyContent(e.target.value)}
                        rows={4}
                        autoGrow
                      />
                      <div className="flex flex-col-reverse sm:flex-row gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { setEditingReplyId(null); setEditingReplyContent(''); }}
                          className="w-full sm:w-auto"
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => editReplyMutation.mutate({ replyId: reply.id, body: editingReplyContent })}
                          isLoading={editReplyMutation.isPending}
                          className="w-full sm:w-auto"
                        >
                          Save
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div
                        className="prose prose-sm max-w-none text-gray-700"
                        style={{ whiteSpace: 'pre-wrap' }}
                        dangerouslySetInnerHTML={{
                          __html: formatNoteBody(reply.body, expandedNotes[reply.id] !== false || !needsExpansion(reply.body))
                        }}
                      />
                      {needsExpansion(reply.body) && (
                        <button
                          onClick={() => toggleNoteExpanded(reply.id)}
                          className="mt-2 text-sm text-primary hover:text-primary/80 font-medium flex items-center gap-1"
                        >
                          {expandedNotes[reply.id] === false ? (
                            <>
                              <ChevronDown size={14} />
                              Show more
                            </>
                          ) : (
                            <>
                              <ChevronUp size={14} />
                              Show less
                            </>
                          )}
                        </button>
                      )}
                      {/* Attachments */}
                      {reply.attachments?.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <p className="text-xs font-medium text-gray-500 mb-2">Attachments:</p>
                          <div className="flex flex-wrap gap-2">
                            {reply.attachments.map((att) => (
                              <a
                                key={att.id}
                                href={`/api/attachments/${att.id}/download`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-lg text-sm text-gray-700 hover:bg-gray-200 transition-colors"
                              >
                                <Paperclip size={14} />
                                <span className="truncate max-w-[200px]">{att.filename}</span>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Thread reply input */}
                  {threadReplyId === reply.id && (
                    <div className="mt-3 pl-4 border-l-2 border-yellow-300">
                      <Textarea
                        value={threadContent}
                        onChange={(e) => setThreadContent(e.target.value)}
                        placeholder="Reply to this note..."
                        rows={3}
                        autoGrow
                      />
                      <div className="flex flex-col-reverse sm:flex-row gap-2 mt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { setThreadReplyId(null); setThreadContent(''); }}
                          className="w-full sm:w-auto"
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            const formData = new FormData();
                            formData.append('body', `@${reply.author?.name}: ${threadContent}`);
                            formData.append('isInternal', true);
                            replyMutation.mutate(formData);
                            setThreadReplyId(null);
                            setThreadContent('');
                          }}
                          disabled={!threadContent.trim()}
                          className="w-full sm:w-auto"
                        >
                          Reply
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Mobile action buttons - inline below content, always visible */}
                  {reply.isInternal && !editingReplyId && (
                    <div className="sm:hidden flex flex-wrap gap-2 mt-3 pt-3 border-t border-yellow-200">
                      <button
                        onClick={() => { setEditingReplyId(reply.id); setEditingReplyContent(reply.body); }}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs text-gray-600 bg-white rounded-lg border border-gray-200 active:bg-gray-100 touch-manipulation min-h-[36px]"
                      >
                        <Pencil size={14} />
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('Are you sure you want to delete this note?')) {
                            deleteReplyMutation.mutate(reply.id);
                          }
                        }}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs text-red-600 bg-white rounded-lg border border-gray-200 active:bg-red-50 touch-manipulation min-h-[36px]"
                      >
                        <Trash2 size={14} />
                        Delete
                      </button>
                      <button
                        onClick={() => setForwardingReply(reply)}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs text-gray-600 bg-white rounded-lg border border-gray-200 active:bg-gray-100 touch-manipulation min-h-[36px]"
                      >
                        <Forward size={14} />
                        Forward
                      </button>
                      <button
                        onClick={() => setThreadReplyId(reply.id)}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs text-gray-600 bg-white rounded-lg border border-gray-200 active:bg-gray-100 touch-manipulation min-h-[36px]"
                      >
                        <MessageSquare size={14} />
                        Reply
                      </button>
                    </div>
                  )}
                </div>

                {/* Desktop action buttons - absolute positioned, hover visible */}
                {reply.isInternal && !editingReplyId && (
                  <div className="hidden sm:flex absolute top-4 right-4 gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => { setEditingReplyId(reply.id); setEditingReplyContent(reply.body); }}
                      className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-white rounded"
                      title="Edit"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Are you sure you want to delete this note?')) {
                          deleteReplyMutation.mutate(reply.id);
                        }
                      }}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-white rounded"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                    <button
                      onClick={() => setForwardingReply(reply)}
                      className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-white rounded"
                      title="Forward to Agent"
                    >
                      <Forward size={14} />
                    </button>
                    <button
                      onClick={() => setThreadReplyId(reply.id)}
                      className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-white rounded"
                      title="Reply to this note"
                    >
                      <MessageSquare size={14} />
                    </button>
                  </div>
                )}
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
          <div className="p-4 md:p-6">
            <div className="flex flex-wrap gap-2 mb-3">
              <button
                type="button"
                onClick={() => setIsInternalNote(false)}
                className={"px-3 py-2 text-sm font-medium rounded-lg transition-colors min-h-[40px] touch-manipulation " + (!isInternalNote ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}
              >
                Reply
              </button>
              <button
                type="button"
                onClick={() => setIsInternalNote(true)}
                className={"px-3 py-2 text-sm font-medium rounded-lg transition-colors min-h-[40px] touch-manipulation " + (isInternalNote ? 'bg-yellow-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}
              >
                Internal Note
              </button>
              <div className="hidden md:block flex-1" />
              <div className="flex gap-2 w-full md:w-auto mt-2 md:mt-0">
                <button
                  type="button"
                  onClick={() => setShowKBModal(true)}
                  className="flex-1 md:flex-none px-3 py-2 text-sm font-medium rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors flex items-center justify-center gap-1.5 min-h-[40px] touch-manipulation"
                  title="Insert KB Article"
                >
                  <BookOpen size={14} />
                  <span className="hidden sm:inline">Insert</span> KB
                </button>
                <button
                  type="button"
                  onClick={() => setShowTemplateModal(true)}
                  className="flex-1 md:flex-none px-3 py-2 text-sm font-medium rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors flex items-center justify-center gap-1.5 min-h-[40px] touch-manipulation"
                  title="Use Template"
                >
                  <FileText size={14} />
                  Template
                </button>
              </div>
            </div>

            {/* Notify Teammates Section - MOVED TO TOP */}
            {isInternalNote && (
              <div className="mb-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <Bell size={14} />
                  Notify teammates:
                </label>
                <div className="flex flex-wrap gap-2">
                  {(agentsData?.agents || []).map((agent) => (
                    <button
                      key={agent.id}
                      type="button"
                      onClick={() => {
                        setNotifyAgents((prev) =>
                          prev.includes(agent.id)
                            ? prev.filter((aid) => aid !== agent.id)
                            : [...prev, agent.id]
                        );
                      }}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                        notifyAgents.includes(agent.id)
                          ? 'bg-primary text-white'
                          : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <Avatar name={agent.name} size="xs" />
                      {agent.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Textarea
              value={replyContent}
              onChange={handleReplyChange}
              placeholder={isInternalNote ? 'Add an internal note...' : 'Type your reply...'}
              rows={6}
              minHeight={200}
              autoGrow
            />

            {/* File attachments */}
            <div className="mt-3">
              <FileUpload
                files={replyFiles}
                onChange={setReplyFiles}
                disabled={replyMutation.isPending}
              />
            </div>

            {/* Time Logging Section (collapsed by default) */}
            {isInternalNote && (
              <div className="mt-3 border border-gray-200 rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowTimeLog(!showTimeLog)}
                  className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <span className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <Clock size={14} />
                    Log Time
                  </span>
                  {showTimeLog ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                {showTimeLog && (
                  <div className="p-3 space-y-3 bg-white">
                    {/* Date */}
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Date</label>
                      <input
                        type="date"
                        value={timeLogDate}
                        onChange={(e) => setTimeLogDate(e.target.value)}
                        className="w-full px-3 py-2.5 text-base border border-gray-300 rounded-lg focus:ring-primary focus:border-primary min-h-[44px]"
                      />
                    </div>

                    {/* Start and Finish Time */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Start Time</label>
                        <input
                          type="time"
                          value={timeLogStartTime}
                          onChange={(e) => setTimeLogStartTime(e.target.value)}
                          className="w-full px-3 py-2.5 text-base border border-gray-300 rounded-lg focus:ring-primary focus:border-primary min-h-[44px]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Finish Time</label>
                        <input
                          type="time"
                          value={timeLogFinishTime}
                          onChange={(e) => setTimeLogFinishTime(e.target.value)}
                          className="w-full px-3 py-2.5 text-base border border-gray-300 rounded-lg focus:ring-primary focus:border-primary min-h-[44px]"
                        />
                      </div>
                    </div>

                    {/* BTO / ETA Section */}
                    <div className="border-t pt-3">
                      <div className="flex items-center gap-3 mb-2">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="btoType"
                            value="BTO"
                            checked={timeLogBtoType === 'BTO'}
                            onChange={(e) => setTimeLogBtoType(e.target.value)}
                            className="text-primary focus:ring-primary"
                          />
                          <span className="text-xs font-medium text-gray-700">BTO (Back to Office)</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="btoType"
                            value="ETA"
                            checked={timeLogBtoType === 'ETA'}
                            onChange={(e) => setTimeLogBtoType(e.target.value)}
                            className="text-primary focus:ring-primary"
                          />
                          <span className="text-xs font-medium text-gray-700">ETA (to location)</span>
                        </label>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {timeLogBtoType === 'ETA' && (
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Location</label>
                            <input
                              type="text"
                              value={timeLogBtoLocation}
                              onChange={(e) => setTimeLogBtoLocation(e.target.value)}
                              placeholder="e.g., Client Name"
                              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-primary focus:border-primary"
                            />
                          </div>
                        )}
                        <div className={timeLogBtoType === 'BTO' ? 'col-span-2' : ''}>
                          <label className="block text-xs text-gray-500 mb-1">
                            {timeLogBtoType === 'BTO' ? 'BTO Time' : 'ETA Time'}
                          </label>
                          <input
                            type="time"
                            value={timeLogBtoTime}
                            onChange={(e) => setTimeLogBtoTime(e.target.value)}
                            className="w-full px-3 py-2.5 text-base border border-gray-300 rounded-lg focus:ring-primary focus:border-primary min-h-[44px]"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Preview */}
                    {timeLogStartTime && timeLogFinishTime && (
                      <div className="bg-gray-50 rounded p-2 text-xs text-gray-600">
                        <span className="font-medium">Preview:</span> {formatTimeLogDescription() || 'Enter start and finish times'}
                        {timeLogStartTime && timeLogFinishTime && (
                          <span className="ml-2 text-gray-500">
                            ({calculateDuration(timeLogStartTime, timeLogFinishTime).hours}h {calculateDuration(timeLogStartTime, timeLogFinishTime).minutes}m)
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Parse Preview Modal */}
            {showParsePreview && parsedData && (
              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="text-sm font-medium text-blue-800 mb-2">Found:</h4>
                {parsedData.time && (
                  <p className="text-sm text-blue-700">
                    ⏱️ {parsedData.time.hours} hours, {parsedData.time.minutes} minutes
                  </p>
                )}
                {parsedData.materials.length > 0 && (
                  <p className="text-sm text-blue-700">
                    📦 {parsedData.materials.length} material{parsedData.materials.length > 1 ? 's' : ''}
                  </p>
                )}
                <div className="flex flex-col-reverse sm:flex-row gap-2 mt-2">
                  <Button size="sm" variant="outline" onClick={() => { setShowParsePreview(false); setParsedData(null); }} className="w-full sm:w-auto">
                    Cancel
                  </Button>
                  <Button size="sm" onClick={confirmParsedData} className="w-full sm:w-auto">
                    Confirm & Log
                  </Button>
                </div>
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row justify-between gap-3 mt-3">
              {isInternalNote && (
                <Button
                  variant="outline"
                  onClick={parseNote}
                  disabled={!replyContent.trim()}
                  leftIcon={<Zap size={16} />}
                  className="w-full sm:w-auto"
                >
                  Parse & Log
                </Button>
              )}
              <div className={`${!isInternalNote ? 'w-full sm:ml-auto sm:w-auto' : 'w-full sm:w-auto'}`}>
                <Button
                  onClick={handleSendReply}
                  isLoading={replyMutation.isPending}
                  disabled={!replyContent.trim()}
                  leftIcon={<Send size={16} />}
                  className="w-full"
                >
                  {isInternalNote ? 'Add Note' : 'Send Reply'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KB Article Modal */}
      {showKBModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-lg mx-4">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold">Insert Knowledge Base Article</h3>
              <button onClick={() => { setShowKBModal(false); setKbSearchQuery(''); }} className="p-1 hover:bg-gray-100 rounded">
                <X size={20} />
              </button>
            </div>
            <div className="p-4">
              <div className="relative mb-4">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search articles..."
                  value={kbSearchQuery}
                  onChange={(e) => setKbSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
                  autoFocus
                />
              </div>
              <div className="max-h-64 overflow-y-auto">
                {kbSearchQuery.length < 2 ? (
                  <p className="text-sm text-gray-500 text-center py-8">Type at least 2 characters to search</p>
                ) : kbSearchResults?.results?.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-8">No articles found</p>
                ) : (
                  <div className="space-y-2">
                    {kbSearchResults?.results?.map((article) => (
                      <button
                        key={article.id}
                        onClick={() => handleInsertKBArticle(article)}
                        className="w-full p-3 text-left rounded-lg border border-gray-200 hover:border-primary hover:bg-gray-50 transition-colors"
                      >
                        <p className="font-medium text-gray-900">{article.title}</p>
                        <p className="text-xs text-gray-500 mt-1">{article.category?.name}</p>
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">{article.excerpt}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Template Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-lg mx-4">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold">Use Template</h3>
              <button onClick={() => { setShowTemplateModal(false); setTemplateSearchQuery(''); }} className="p-1 hover:bg-gray-100 rounded">
                <X size={20} />
              </button>
            </div>
            <div className="p-4">
              <div className="relative mb-4">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search templates..."
                  value={templateSearchQuery}
                  onChange={(e) => setTemplateSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
                  autoFocus
                />
              </div>
              <div className="max-h-64 overflow-y-auto">
                {filteredTemplates.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-8">No templates found</p>
                ) : (
                  <div className="space-y-2">
                    {filteredTemplates.map((template) => (
                      <button
                        key={template.id}
                        onClick={() => handleInsertTemplate(template)}
                        className="w-full p-3 text-left rounded-lg border border-gray-200 hover:border-primary hover:bg-gray-50 transition-colors"
                      >
                        <p className="font-medium text-gray-900">{template.name}</p>
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">{template.description || template.subject}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Forward Note Modal */}
      {forwardingReply && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold">Forward Note to Agent</h3>
              <button onClick={() => { setForwardingReply(null); setForwardAgentId(''); }} className="p-1 hover:bg-gray-100 rounded">
                <X size={20} />
              </button>
            </div>
            <div className="p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Agent</label>
              <Select
                options={agentOptions.filter(a => a.value)}
                value={forwardAgentId}
                onChange={(e) => setForwardAgentId(e.target.value)}
              />
              <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
                <p className="font-medium mb-1">Note preview:</p>
                <p className="line-clamp-3">{forwardingReply.body?.replace(/<[^>]*>/g, '')}</p>
              </div>
              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => { setForwardingReply(null); setForwardAgentId(''); }} className="w-full sm:w-auto">
                  Cancel
                </Button>
                <Button
                  disabled={!forwardAgentId}
                  onClick={() => {
                    const selectedAgent = agentsData?.agents?.find(a => a.id === forwardAgentId);
                    const formData = new FormData();
                    formData.append('body', `@${selectedAgent?.name} - Forwarded note from ${forwardingReply.author?.name}:\n\n${forwardingReply.body}`);
                    formData.append('isInternal', true);
                    replyMutation.mutate(formData);
                    setForwardingReply(null);
                    setForwardAgentId('');
                  }}
                  className="w-full sm:w-auto"
                >
                  Forward
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Edit Ticket Modal */}
      {showEditTicketModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-lg mx-4">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold">Edit Ticket</h3>
              <button onClick={() => setShowEditTicketModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X size={20} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                <Input
                  value={editSubject}
                  onChange={(e) => setEditSubject(e.target.value)}
                  placeholder="Ticket subject"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <Textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Ticket description"
                  rows={6}
                />
              </div>
              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowEditTicketModal(false)} className="w-full sm:w-auto">
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveTicketEdit}
                  isLoading={updateMutation.isPending}
                  disabled={!editSubject.trim()}
                  className="w-full sm:w-auto"
                >
                  Save Changes
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Forward Ticket Modal */}
      {showForwardModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold">Forward Ticket</h3>
              <button onClick={() => { setShowForwardModal(false); setForwardToAgentId(''); setForwardNote(''); }} className="p-1 hover:bg-gray-100 rounded">
                <X size={20} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Forward to Agent</label>
                <Select
                  options={agentOptions.filter(a => a.value)}
                  value={forwardToAgentId}
                  onChange={(e) => setForwardToAgentId(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Note (optional)</label>
                <Textarea
                  value={forwardNote}
                  onChange={(e) => setForwardNote(e.target.value)}
                  placeholder="Add a note about why you're forwarding this ticket..."
                  rows={3}
                />
              </div>
              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => { setShowForwardModal(false); setForwardToAgentId(''); setForwardNote(''); }} className="w-full sm:w-auto">
                  Cancel
                </Button>
                <Button
                  onClick={handleForwardTicket}
                  disabled={!forwardToAgentId}
                  isLoading={updateMutation.isPending}
                  className="w-full sm:w-auto"
                >
                  Forward
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Ticket Modal */}
      <ScheduleTicketModal
        isOpen={showScheduleModal}
        onClose={() => {
          setShowScheduleModal(false);
          setScheduleModalMode('add');
          setRescheduleId(null);
        }}
        ticket={ticket}
        mode={scheduleModalMode}
        scheduleId={rescheduleId}
        onScheduled={() => {
          queryClient.invalidateQueries(['ticket', id]);
          queryClient.invalidateQueries(['ticket-schedules', id]);
        }}
      />

      {/* Mobile Sidebar Overlay */}
      {showMobileSidebar && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40 animate-fadeIn"
          onClick={() => setShowMobileSidebar(false)}
        />
      )}

      {/* Sidebar - Desktop: static, Mobile: slide-in panel */}
      <div className={`
        lg:w-80 lg:flex-shrink-0 lg:relative lg:block
        ${showMobileSidebar
          ? 'fixed inset-y-0 right-0 w-[85%] max-w-sm z-50 bg-gray-50 overflow-y-auto animate-slideInLeft'
          : 'hidden lg:block'
        }
      `}>
        {/* Mobile header for sidebar */}
        <div className="lg:hidden sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between z-10">
          <h2 className="font-semibold text-gray-900">Ticket Details</h2>
          <button
            onClick={() => setShowMobileSidebar(false)}
            className="p-2 hover:bg-gray-100 rounded-lg touch-manipulation"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 lg:p-0 space-y-4">
          {/* Status & Priority Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Status & Priority</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Status</label>
                <Select
                  options={statusOptions}
                  value={ticket.status}
                  onChange={(e) => updateMutation.mutate({ status: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Priority</label>
                <Select
                  options={priorityOptions}
                  value={ticket.priority}
                  onChange={(e) => updateMutation.mutate({ priority: e.target.value })}
                />
              </div>
            </div>
            {/* Current status/priority badges for quick reference */}
            <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
              <Badge variant={statusConfig[ticket.status]?.variant}>
                {statusConfig[ticket.status]?.label}
              </Badge>
              <Badge variant={priorityConfig[ticket.priority]?.variant}>
                {priorityConfig[ticket.priority]?.label}
              </Badge>
            </div>
          </div>

          {/* Assignment Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Assignment</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Primary Assignee</label>
                <Select
                  options={agentOptions}
                  value={ticket.assigneeId || ''}
                  onChange={(e) => updateMutation.mutate({ assigneeId: e.target.value || null })}
                />
              </div>
              <div>
                <MultiSelectAgents
                  label="Additional Assignees"
                  agents={agentsData?.agents || []}
                  selectedIds={ticket.additionalAssignees?.map(a => a.id) || []}
                  onChange={(ids) => updateMutation.mutate({ additionalAssigneeIds: ids })}
                  placeholder="Add more agents..."
                />
              </div>
              {/* Show assigned agents with avatars */}
              {(ticket.assignee || ticket.additionalAssignees?.length > 0) && (
                <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                  {ticket.assignee && (
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 rounded-full">
                      <Avatar name={ticket.assignee.name} size="xs" />
                      <span className="text-xs font-medium text-gray-700">{ticket.assignee.name}</span>
                    </div>
                  )}
                  {ticket.additionalAssignees?.map(agent => (
                    <div key={agent.id} className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 rounded-full">
                      <Avatar name={agent.name} size="xs" />
                      <span className="text-xs text-gray-600">{agent.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Contact & Company Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Contact Information</h3>
            <div className="space-y-3">
              {/* Contact */}
              <div className="flex items-center gap-3">
                <Avatar name={ticket.requester?.name} size="md" />
                <div className="min-w-0 flex-1">
                  <Link to={'/contacts/' + ticket.requester?.id} className="text-sm font-medium text-gray-900 hover:text-primary block truncate">
                    {ticket.requester?.name}
                  </Link>
                  <p className="text-xs text-gray-500 truncate">{ticket.requester?.email}</p>
                  {ticket.requester?.phone && (
                    <p className="text-xs text-gray-500">{ticket.requester.phone}</p>
                  )}
                </div>
              </div>
              {/* Company */}
              {ticket.company && (
                <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                    <Building2 size={20} className="text-gray-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link to={'/companies/' + ticket.company.id} className="text-sm font-medium text-gray-900 hover:text-primary block truncate">
                      {ticket.company.name}
                    </Link>
                    {ticket.company.domain && (
                      <p className="text-xs text-gray-500">{ticket.company.domain}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Schedule Section - Shows all schedule entries */}
          <div className="bg-primary/5 rounded-lg border border-primary/20 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-1.5">
                <Calendar size={12} />
                Calendar Schedules
              </h3>
              <button
                onClick={() => {
                  setScheduleModalMode('add');
                  setRescheduleId(null);
                  setShowScheduleModal(true);
                }}
                className="text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1"
              >
                <Plus size={12} />
                Add
              </button>
            </div>
            {schedulesList.length === 0 ? (
              <p className="text-sm text-gray-500 italic">No scheduled times</p>
            ) : (
              <div className="space-y-2">
                {schedulesList.map((schedule) => {
                  const startDate = new Date(schedule.scheduledStart);
                  const endDate = schedule.scheduledEnd ? new Date(schedule.scheduledEnd) : null;
                  const isMultiDay = endDate && startDate.toDateString() !== endDate.toDateString();

                  return (
                    <div
                      key={schedule.id}
                      className="flex items-start justify-between bg-white rounded-lg px-3 py-2 border border-primary/10"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900">
                          {format(startDate, 'EEE, MMM d, yyyy')}
                          {isMultiDay && endDate && (
                            <span> - {format(endDate, 'EEE, MMM d')}</span>
                          )}
                        </p>
                        {!schedule.isAllDay && (
                          <p className="text-xs text-gray-600">
                            {format(startDate, 'h:mm a')}
                            {endDate && !isMultiDay && (
                              <span> - {format(endDate, 'h:mm a')}</span>
                            )}
                          </p>
                        )}
                        {schedule.isAllDay && (
                          <p className="text-xs text-gray-500 italic">All day</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        <button
                          onClick={() => {
                            setScheduleModalMode('reschedule');
                            setRescheduleId(schedule.id);
                            setShowScheduleModal(true);
                          }}
                          className="p-1 text-gray-400 hover:text-primary rounded"
                          title="Reschedule"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={() => deleteScheduleMutation.mutate(schedule.id)}
                          className="p-1 text-gray-400 hover:text-red-500 rounded"
                          title="Remove"
                          disabled={deleteScheduleMutation.isLoading}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Mileage Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <button
              onClick={() => setShowMileage(!showMileage)}
              className="w-full flex items-center justify-between"
            >
              <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Car size={16} />
                Mileage
              </h3>
              {showMileage ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {showMileage && (
              <div className="mt-3 space-y-3">
                <p className="text-xs text-gray-500">Round trip from office</p>

                {/* Destination Address */}
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Destination Address</label>
                  <input
                    type="text"
                    value={localDestinationAddress}
                    onChange={(e) => setLocalDestinationAddress(e.target.value)}
                    placeholder="Enter destination address..."
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
                  />
                </div>

                {/* Mileage input with calculate button */}
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">Miles</label>
                    <input
                      type="number"
                      step="0.1"
                      value={localMileage}
                      onChange={(e) => setLocalMileage(e.target.value)}
                      placeholder="0.0"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
                    />
                  </div>
                  <div className="pt-5">
                    <button
                      onClick={handleCalculateMileage}
                      disabled={isCalculatingMileage || !localDestinationAddress.trim()}
                      className="p-2 text-primary hover:bg-primary/10 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                      title={localDestinationAddress.trim() ? 'Calculate mileage' : 'Enter a destination address first'}
                    >
                      {isCalculatingMileage ? (
                        <span className="animate-spin inline-block w-4 h-4 border-2 border-primary border-t-transparent rounded-full" />
                      ) : (
                        <Calculator size={18} />
                      )}
                    </button>
                  </div>
                </div>

                {/* Auto-calculated badge */}
                {ticket.mileageAuto && (
                  <p className="text-xs text-gray-400">
                    Auto-calculated: {ticket.mileageAuto} mi
                  </p>
                )}

                {/* Notes field */}
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Trip Notes</label>
                  <textarea
                    value={localMileageNotes}
                    onChange={(e) => setLocalMileageNotes(e.target.value)}
                    placeholder="Optional notes about this trip..."
                    rows={2}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-primary focus:border-primary resize-none"
                  />
                </div>

                {/* Save button */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSaveMileage}
                  disabled={updateMutation.isPending}
                  className="w-full"
                >
                  Save Mileage
                </Button>
              </div>
            )}
          </div>

          {/* Metadata Section */}
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-gray-400">Created</p>
                <p className="text-gray-600 font-medium">{format(new Date(ticket.createdAt), 'MMM d, yyyy')}</p>
                <p className="text-gray-500">{format(new Date(ticket.createdAt), 'h:mm a')}</p>
              </div>
              <div>
                <p className="text-gray-400">Updated</p>
                <p className="text-gray-600 font-medium">{format(new Date(ticket.updatedAt), 'MMM d, yyyy')}</p>
                <p className="text-gray-500">{format(new Date(ticket.updatedAt), 'h:mm a')}</p>
              </div>
            </div>
          </div>

        {/* Inventory Deductions Section */}
        {deductionsList.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <button
              onClick={() => setShowInventory(!showInventory)}
              className="w-full flex items-center justify-between"
            >
              <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Package size={16} />
                Inventory
                <span className="text-xs text-gray-500">
                  ({deductionsList.filter(d => d.status === 'PENDING').length} pending)
                </span>
              </h3>
              {showInventory ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {showInventory && (
              <div className="mt-3 space-y-2">
                {deductionsList.map((deduction) => (
                  <div
                    key={deduction.id}
                    className={`p-2 rounded-lg border ${
                      deduction.status === 'PENDING'
                        ? 'bg-yellow-50 border-yellow-200'
                        : deduction.status === 'APPROVED'
                        ? 'bg-green-50 border-green-200'
                        : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          {deduction.quantity}x {deduction.itemName}
                        </p>
                        {deduction.inventoryItem && (
                          <p className="text-xs text-gray-500">
                            → {deduction.inventoryItem.name}
                          </p>
                        )}
                      </div>
                      {deduction.status === 'PENDING' ? (
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleRejectDeduction(deduction.id)}
                            disabled={processingDeduction === deduction.id}
                            className="p-1 text-red-500 hover:bg-red-100 rounded"
                            title="Reject"
                          >
                            <XCircle size={16} />
                          </button>
                          <button
                            onClick={() => handleApproveDeduction(deduction.id)}
                            disabled={processingDeduction === deduction.id || !deduction.inventoryItem}
                            className="p-1 text-green-500 hover:bg-green-100 rounded disabled:opacity-50"
                            title={deduction.inventoryItem ? 'Approve' : 'No match - cannot approve'}
                          >
                            <CheckCircle size={16} />
                          </button>
                        </div>
                      ) : (
                        <span className={`text-xs font-medium ${
                          deduction.status === 'APPROVED' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {deduction.status === 'APPROVED' ? (
                            <CheckCircle size={14} className="inline" />
                          ) : (
                            <XCircle size={14} className="inline" />
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Checklist Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <button
            onClick={() => setShowChecklist(!showChecklist)}
            className="w-full flex items-center justify-between"
          >
            <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <CheckSquare size={16} />
              Checklist
              {checklistItems.length > 0 && (
                <span className="text-xs text-gray-500">
                  ({checklistItems.filter(i => i.completed).length}/{checklistItems.length})
                </span>
              )}
            </h3>
            {showChecklist ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {showChecklist && (
            <div className="mt-3 space-y-2">
              {/* Progress bar */}
              {checklistItems.length > 0 && (
                <div className="mb-3">
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 transition-all"
                      style={{
                        width: `${(checklistItems.filter(i => i.completed).length / checklistItems.length) * 100}%`
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Checklist items */}
              {checklistItems.map((item) => (
                <div key={item.id} className="flex items-start gap-2 group">
                  <button
                    onClick={() => updateChecklistMutation.mutate({
                      itemId: item.id,
                      data: { completed: !item.completed }
                    })}
                    className="mt-0.5 text-gray-400 hover:text-primary"
                  >
                    {item.completed ? (
                      <CheckSquare size={16} className="text-green-500" />
                    ) : (
                      <Square size={16} />
                    )}
                  </button>
                  <span className={`flex-1 text-sm ${item.completed ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                    {item.text}
                  </span>
                  <button
                    onClick={() => deleteChecklistMutation.mutate(item.id)}
                    className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}

              {/* Add new item */}
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="text"
                  value={newChecklistItem}
                  onChange={(e) => setNewChecklistItem(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newChecklistItem.trim()) {
                      addChecklistMutation.mutate({ label: newChecklistItem.trim() });
                    }
                  }}
                  placeholder="Add item..."
                  className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-primary focus:border-primary"
                />
                <button
                  onClick={() => {
                    if (newChecklistItem.trim()) {
                      addChecklistMutation.mutate({ label: newChecklistItem.trim() });
                    }
                  }}
                  disabled={!newChecklistItem.trim()}
                  className="p-1 text-primary hover:bg-primary/10 rounded disabled:opacity-50"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    </div>
  );
}
