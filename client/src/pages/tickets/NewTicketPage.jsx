import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Calendar, CalendarRange, X, Plus, FileText, Copy } from 'lucide-react';
import toast from 'react-hot-toast';
import { tickets, agents, templates, contacts, companies, attachments } from '../../api';
import { Button, Input, Select, Textarea, ContactTypeahead, MultiSelectAgents, PhoneInput, FileUpload, TemplateSelectModal, DuplicateTicketModal } from '../../components/shared';

const ticketSchema = z.object({
  subject: z.string().min(1, 'Subject is required').max(255),
  description: z.string().optional().default(''),
  contactId: z.string().min(1, 'Contact is required'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
  assigneeId: z.string().optional(),
});

const priorityOptions = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
];

export default function NewTicketPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [startDate, setStartDate] = useState(searchParams.get('dueDate') || '');
  const [endDate, setEndDate] = useState(searchParams.get('dueDate') || '');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [additionalAssigneeIds, setAdditionalAssigneeIds] = useState([]);
  const [ticketFiles, setTicketFiles] = useState([]);
  const templateId = searchParams.get('templateId');

  // Template and Duplicate modal state
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);

  // Helper to format date as YYYY-MM-DD in local timezone (avoids UTC conversion issues)
  const formatLocalDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  // Helper to get Monday and Friday of a week containing the start date
  const getWeekBounds = (dateStr) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const day = date.getDay();
    const monday = new Date(date);
    monday.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4); // +4 days from Monday = Friday
    return { monday, friday };
  };

  // "All Week" button handler
  const handleAllWeek = () => {
    const { monday, friday } = getWeekBounds(startDate || formatLocalDate(new Date()));
    setStartDate(formatLocalDate(monday));
    setEndDate(formatLocalDate(friday));
    setStartTime('08:00');
    setEndTime('17:00');
  };

  // New client modal state
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [newClientFirstName, setNewClientFirstName] = useState('');
  const [newClientLastName, setNewClientLastName] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientCompanyId, setNewClientCompanyId] = useState('');

  // Inline company creation state
  const [showInlineCompanyForm, setShowInlineCompanyForm] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyDomain, setNewCompanyDomain] = useState('');
  const [newCompanyAddress, setNewCompanyAddress] = useState('');

  const { register, handleSubmit, control, setValue, watch, formState: { errors } } = useForm({
    resolver: zodResolver(ticketSchema),
    defaultValues: {
      subject: '',
      description: '',
      contactId: '',
      priority: 'MEDIUM',
      assigneeId: '',
    },
  });

  // Fetch template if templateId is provided
  const { data: templateData } = useQuery({
    queryKey: ['template', templateId],
    queryFn: () => templates.getTemplate(templateId),
    enabled: !!templateId,
  });

  // Populate form from template when loaded
  useEffect(() => {
    if (templateData) {
      setValue('subject', templateData.subject || '');
      setValue('description', templateData.description || '');
      setValue('priority', templateData.priority || 'MEDIUM');
      if (templateData.assigneeId) {
        setValue('assigneeId', templateData.assigneeId);
      }
    }
  }, [templateData, setValue]);

  // Populate form from duplicated ticket passed via navigation state
  useEffect(() => {
    const duplicateTicket = location.state?.duplicateTicket;
    if (duplicateTicket) {
      setValue('subject', duplicateTicket.subject || '');
      setValue('description', duplicateTicket.description || '');
      setValue('priority', duplicateTicket.priority || 'MEDIUM');
      if (duplicateTicket.assigneeId) {
        setValue('assigneeId', duplicateTicket.assigneeId);
      }
      if (duplicateTicket.requesterId) {
        setValue('contactId', duplicateTicket.requesterId);
      } else if (duplicateTicket.requester?.id) {
        setValue('contactId', duplicateTicket.requester.id);
      }
      if (duplicateTicket.additionalAssignees && duplicateTicket.additionalAssignees.length > 0) {
        setAdditionalAssigneeIds(duplicateTicket.additionalAssignees.map(a => a.id));
      }
      toast.success(`Ticket #${duplicateTicket.ticketNumber} duplicated`);
    }
  }, [location.state, setValue]);

  // Handle template selection from modal
  const handleSelectTemplate = (template) => {
    setValue('subject', template.subject || '');
    setValue('description', template.description || '');
    setValue('priority', template.priority || 'MEDIUM');
    if (template.assigneeId) {
      setValue('assigneeId', template.assigneeId);
    }
    toast.success(`Template "${template.name}" applied`);
  };

  // Handle duplicate ticket selection from modal
  const handleSelectDuplicateTicket = (ticket) => {
    setValue('subject', ticket.subject || '');
    setValue('description', ticket.description || '');
    setValue('priority', ticket.priority || 'MEDIUM');
    if (ticket.assigneeId) {
      setValue('assigneeId', ticket.assigneeId);
    }
    // Set company via contact if available
    if (ticket.requesterId) {
      setValue('contactId', ticket.requesterId);
    } else if (ticket.requester?.id) {
      setValue('contactId', ticket.requester.id);
    }
    // Set additional assignees if any
    if (ticket.additionalAssignees && ticket.additionalAssignees.length > 0) {
      setAdditionalAssigneeIds(ticket.additionalAssignees.map(a => a.id));
    }
    toast.success(`Ticket #${ticket.ticketNumber} duplicated`);
  };

  const contactId = watch('contactId');

  // Get agents for assignment
  const { data: agentsData } = useQuery({
    queryKey: ['agents'],
    queryFn: () => agents.getAgents(),
  });

  // Get companies for new client modal
  const { data: companiesData } = useQuery({
    queryKey: ['companies'],
    queryFn: () => companies.getCompanies({ limit: 500 }),
  });

  // Create contact mutation
  const createContactMutation = useMutation({
    mutationFn: contacts.createContact,
    onSuccess: (data) => {
      console.log('[CreateContact] Success:', data);
      queryClient.invalidateQueries(['contacts']);
      queryClient.invalidateQueries(['contacts-search']);
      // Auto-populate the contact selector with the new contact
      const newContact = data.contact || data;
      setValue('contactId', newContact.id);
      setShowNewClientModal(false);
      setNewClientFirstName('');
      setNewClientLastName('');
      setNewClientEmail('');
      setNewClientPhone('');
      setNewClientCompanyId('');
      setShowInlineCompanyForm(false);
      setNewCompanyName('');
      setNewCompanyDomain('');
      setNewCompanyAddress('');
      toast.success('Client created successfully');
    },
    onError: (error) => {
      console.error('[CreateContact] Error:', error.response?.data || error);
      // Server returns { error: '...' }, not { message: '...' }
      const errorMessage = error.response?.data?.error || error.response?.data?.message || 'Failed to create client';
      toast.error(errorMessage);
    },
  });

  // Create company mutation (inline from new client modal)
  const createCompanyMutation = useMutation({
    mutationFn: companies.createCompany,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      const newCompanyId = data.company?.id || data.id;
      setNewClientCompanyId(newCompanyId);
      setShowInlineCompanyForm(false);
      setNewCompanyName('');
      setNewCompanyDomain('');
      setNewCompanyAddress('');
      toast.success('Company created and selected');
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to create company');
    },
  });

  const handleCreateCompanyInline = () => {
    if (!newCompanyName.trim()) {
      toast.error('Company name is required');
      return;
    }
    createCompanyMutation.mutate({
      name: newCompanyName.trim(),
      domain: newCompanyDomain.trim() || undefined,
      address: newCompanyAddress.trim() || undefined,
    });
  };

  const handleCreateNewClient = () => {
    console.log('[CreateContact] handleCreateNewClient called');
    console.log('[CreateContact] Form values:', {
      firstName: newClientFirstName,
      lastName: newClientLastName,
      email: newClientEmail,
      phone: newClientPhone,
      companyId: newClientCompanyId
    });

    if (!newClientFirstName.trim() || !newClientLastName.trim() || !newClientEmail.trim()) {
      toast.error('First name, last name, and email are required');
      return;
    }

    const contactData = {
      name: `${newClientFirstName.trim()} ${newClientLastName.trim()}`,
      email: newClientEmail.trim(),
      phone: newClientPhone.trim() || undefined,
      companyId: newClientCompanyId || undefined,
    };
    console.log('[CreateContact] Sending data:', contactData);
    createContactMutation.mutate(contactData);
  };

  const createMutation = useMutation({
    mutationFn: async ({ ticketData, files }) => {
      // Create the ticket first - this is the critical operation
      const createdTicket = await tickets.createTicket(ticketData);
      console.log('[NewTicket DEBUG] Ticket created, response:', createdTicket);

      // Track post-creation errors separately (ticket exists, but extras failed)
      const postCreationErrors = [];

      // If dates are set, create a TicketSchedule entry
      if (ticketData._scheduleData) {
        console.log('[NewTicket DEBUG] About to call createSchedule with:', {
          ticketId: createdTicket.id,
          scheduleData: ticketData._scheduleData,
        });
        try {
          const scheduleResult = await tickets.createSchedule(createdTicket.id, ticketData._scheduleData);
          console.log('[NewTicket DEBUG] createSchedule succeeded:', scheduleResult);
        } catch (scheduleError) {
          console.error('[NewTicket DEBUG] createSchedule FAILED:', scheduleError);
          postCreationErrors.push('schedule');
        }
      }

      // Upload attachments if any
      if (files && files.length > 0) {
        try {
          const formData = new FormData();
          files.forEach((file) => {
            formData.append('files', file);
          });
          await attachments.uploadAttachment(createdTicket.id, formData);
        } catch (attachmentError) {
          console.error('[NewTicket DEBUG] attachment upload FAILED:', attachmentError);
          postCreationErrors.push('attachments');
        }
      }

      // Return ticket with any post-creation error info
      return { ...createdTicket, _postCreationErrors: postCreationErrors };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['tickets']);

      // Show appropriate message based on whether post-creation operations succeeded
      if (data._postCreationErrors && data._postCreationErrors.length > 0) {
        const failedOps = data._postCreationErrors.join(' and ');
        toast.success(`Ticket created, but ${failedOps} failed to save. Please update manually.`);
      } else {
        toast.success('Ticket created successfully');
      }
      navigate('/tickets/' + data.id);
    },
    onError: (error) => {
      // This only triggers if ticket creation itself failed (not post-creation ops)
      toast.error(error.response?.data?.message || 'Failed to create ticket');
    },
  });

  const onSubmit = (data) => {
    // DEBUG: Log schedule field values at submission time
    console.log('[NewTicket DEBUG] onSubmit called with schedule fields:', {
      startDate,
      startTime,
      endDate,
      endTime,
    });

    // Build schedule data if start date is set
    let scheduleData = undefined;
    if (startDate) {
      const scheduledStart = new Date(`${startDate}T${startTime}:00`).toISOString();
      const scheduledEnd = endDate && endTime
        ? new Date(`${endDate}T${endTime}:00`).toISOString()
        : null;
      scheduleData = { scheduledStart, scheduledEnd, isAllDay: false };
    }

    // DEBUG: Log the built scheduleData
    console.log('[NewTicket DEBUG] Built scheduleData:', scheduleData);

    createMutation.mutate({
      ticketData: {
        subject: data.subject,
        description: data.description || '',
        requesterId: data.contactId, // Backend expects requesterId, not contactId
        priority: data.priority,
        assigneeId: data.assigneeId || undefined,
        additionalAssigneeIds: additionalAssigneeIds.length > 0 ? additionalAssigneeIds : undefined,
        _scheduleData: scheduleData, // Internal field, not sent to ticket API
      },
      files: ticketFiles,
    });
  };

  const agentOptions = [
    { value: '', label: 'Unassigned' },
    ...(agentsData?.agents || []).map((agent) => ({
      value: agent.id,
      label: agent.name,
    })),
  ];

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 md:gap-4 mb-4 md:mb-6">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">New Ticket</h1>
      </div>

      {/* Templates and Duplicate buttons */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Button
          type="button"
          variant="secondary"
          onClick={() => setShowTemplateModal(true)}
          className="flex items-center gap-2"
        >
          <FileText size={16} />
          Templates
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setShowDuplicateModal(true)}
          className="flex items-center gap-2"
        >
          <Copy size={16} />
          Duplicate
        </Button>
      </div>

      {templateData && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
          Using template: <strong>{templateData.name}</strong>. Select a contact to create the ticket.
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6">
        <div className="space-y-4 md:space-y-6">
          {/* Contact selection using typeahead */}
          <ContactTypeahead
            label="Contact"
            required
            value={contactId}
            onChange={(id) => setValue('contactId', id)}
            error={errors.contactId?.message}
            onCreateNew={() => setShowNewClientModal(true)}
          />

          <Input label="Subject" required {...register('subject')} error={errors.subject?.message} />
          <Textarea label="Description" rows={4} {...register('description')} error={errors.description?.message} />

          {/* File attachments */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Attachments</label>
            <FileUpload
              files={ticketFiles}
              onChange={setTicketFiles}
              disabled={createMutation.isPending}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Controller
              name="priority"
              control={control}
              render={({ field }) => (
                <Select label="Priority" options={priorityOptions} {...field} error={errors.priority?.message} />
              )}
            />

            <Controller
              name="assigneeId"
              control={control}
              render={({ field }) => (
                <Select label="Assign To" options={agentOptions} {...field} />
              )}
            />
          </div>

          {/* Additional Assignees */}
          <MultiSelectAgents
            label="Additional Assignees"
            agents={agentsData?.agents || []}
            selectedIds={additionalAssigneeIds}
            onChange={setAdditionalAssigneeIds}
            placeholder="Add more agents..."
          />

          {/* Schedule on Calendar */}
          <div className="p-3 md:p-4 bg-gray-50 rounded-lg border border-gray-200">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
              <Calendar size={16} />
              Schedule on Calendar
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    // Update end date if it's before start date
                    if (!endDate || e.target.value > endDate) {
                      setEndDate(e.target.value);
                    }
                  }}
                  className="w-full px-3 py-2.5 text-base md:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary min-h-[44px]"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Start Time</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => {
                    setStartTime(e.target.value);
                    // Auto-update end time to 1 hour later
                    const [h, m] = e.target.value.split(':').map(Number);
                    const endH = Math.min(h + 1, 23);
                    setEndTime(`${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
                  }}
                  className="w-full px-3 py-2.5 text-base md:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary min-h-[44px]"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2.5 text-base md:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary min-h-[44px]"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">End Time</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-3 py-2.5 text-base md:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary min-h-[44px]"
                />
              </div>
            </div>
            {/* All Week Button */}
            <div className="flex justify-end mt-3">
              <Button
                type="button"
                variant="secondary"
                onClick={handleAllWeek}
                className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
              >
                <CalendarRange size={16} className="mr-2" />
                All Week (Mon-Fri)
              </Button>
            </div>
            {startDate && (
              <p className="text-xs text-gray-500 mt-2">
                This ticket will appear on the calendar for {(() => {
                  // Parse date as local time to avoid timezone offset issues
                  const [year, month, day] = startDate.split('-').map(Number);
                  return new Date(year, month - 1, day).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                })()}
                {endDate && endDate !== startDate && (
                  <> through {(() => {
                    const [year, month, day] = endDate.split('-').map(Number);
                    return new Date(year, month - 1, day).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                  })()}</>
                )}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 mt-6 md:mt-8 pt-4 md:pt-6 border-t border-gray-200">
          <Button type="button" variant="secondary" onClick={() => navigate(-1)} className="w-full sm:w-auto">Cancel</Button>
          <Button type="submit" isLoading={createMutation.isPending} className="w-full sm:w-auto">Create Ticket</Button>
        </div>
      </form>

      {/* New Client Modal */}
      {showNewClientModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold">New Client</h3>
              <button
                onClick={() => {
                  setShowNewClientModal(false);
                  setNewClientFirstName('');
                  setNewClientLastName('');
                  setNewClientEmail('');
                  setNewClientPhone('');
                  setNewClientCompanyId('');
                  setShowInlineCompanyForm(false);
                  setNewCompanyName('');
                  setNewCompanyDomain('');
                  setNewCompanyAddress('');
                }}
                className="p-2 hover:bg-gray-100 rounded-lg touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name <span className="text-red-500">*</span></label>
                  <Input
                    value={newClientFirstName}
                    onChange={(e) => setNewClientFirstName(e.target.value)}
                    placeholder="First name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name <span className="text-red-500">*</span></label>
                  <Input
                    value={newClientLastName}
                    onChange={(e) => setNewClientLastName(e.target.value)}
                    placeholder="Last name"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
                <Input
                  type="email"
                  value={newClientEmail}
                  onChange={(e) => setNewClientEmail(e.target.value)}
                  placeholder="client@example.com"
                />
              </div>
              <div>
                <PhoneInput
                  label="Phone"
                  value={newClientPhone}
                  onChange={(e) => setNewClientPhone(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
                {!showInlineCompanyForm ? (
                  <>
                    <Select
                      value={newClientCompanyId}
                      onChange={(e) => setNewClientCompanyId(e.target.value)}
                      options={[
                        { value: '', label: 'No company' },
                        ...(companiesData?.companies || []).map((c) => ({
                          value: c.id,
                          label: c.name,
                        })),
                      ]}
                    />
                    <button
                      type="button"
                      onClick={() => setShowInlineCompanyForm(true)}
                      className="mt-2 text-sm text-primary hover:underline flex items-center gap-1"
                    >
                      <Plus size={14} />
                      Create new company
                    </button>
                  </>
                ) : (
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
                    <Input
                      label="Company Name"
                      required
                      value={newCompanyName}
                      onChange={(e) => setNewCompanyName(e.target.value)}
                      placeholder="Enter company name"
                    />
                    <Input
                      label="Domain"
                      value={newCompanyDomain}
                      onChange={(e) => setNewCompanyDomain(e.target.value)}
                      placeholder="e.g., example.com"
                    />
                    <Input
                      label="Address"
                      value={newCompanyAddress}
                      onChange={(e) => setNewCompanyAddress(e.target.value)}
                      placeholder="Enter address"
                    />
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleCreateCompanyInline}
                        isLoading={createCompanyMutation.isPending}
                      >
                        Create Company
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setShowInlineCompanyForm(false);
                          setNewCompanyName('');
                          setNewCompanyDomain('');
                          setNewCompanyAddress('');
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowNewClientModal(false);
                    setNewClientFirstName('');
                    setNewClientLastName('');
                    setNewClientEmail('');
                    setNewClientPhone('');
                    setNewClientCompanyId('');
                    setShowInlineCompanyForm(false);
                    setNewCompanyName('');
                    setNewCompanyDomain('');
                    setNewCompanyAddress('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateNewClient}
                  isLoading={createContactMutation.isPending}
                  disabled={!newClientFirstName.trim() || !newClientLastName.trim() || !newClientEmail.trim()}
                >
                  Create Client
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Template Select Modal */}
      <TemplateSelectModal
        isOpen={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
        onSelectTemplate={handleSelectTemplate}
      />

      {/* Duplicate Ticket Modal */}
      <DuplicateTicketModal
        isOpen={showDuplicateModal}
        onClose={() => setShowDuplicateModal(false)}
        onSelectTicket={handleSelectDuplicateTicket}
      />
    </div>
  );
}
