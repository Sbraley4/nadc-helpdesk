import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Calendar, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { tickets, agents, templates, contacts, companies } from '../../api';
import { Button, Input, Select, Textarea, ContactTypeahead, MultiSelectAgents } from '../../components/shared';

const ticketSchema = z.object({
  subject: z.string().min(1, 'Subject is required').max(255),
  description: z.string().min(1, 'Description is required'),
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
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [dueDate, setDueDate] = useState(searchParams.get('dueDate') || '');
  const [dueTime, setDueTime] = useState('09:00');
  const [additionalAssigneeIds, setAdditionalAssigneeIds] = useState([]);
  const templateId = searchParams.get('templateId');

  // New client modal state
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [newClientFirstName, setNewClientFirstName] = useState('');
  const [newClientLastName, setNewClientLastName] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientCompanyId, setNewClientCompanyId] = useState('');

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
      toast.success('Client created successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to create client');
    },
  });

  const handleCreateNewClient = () => {
    if (!newClientFirstName.trim() || !newClientLastName.trim() || !newClientEmail.trim()) {
      toast.error('First name, last name, and email are required');
      return;
    }
    createContactMutation.mutate({
      name: `${newClientFirstName.trim()} ${newClientLastName.trim()}`,
      email: newClientEmail.trim(),
      phone: newClientPhone.trim() || undefined,
      companyId: newClientCompanyId || undefined,
    });
  };

  const createMutation = useMutation({
    mutationFn: tickets.createTicket,
    onSuccess: (data) => {
      queryClient.invalidateQueries(['tickets']);
      toast.success('Ticket created successfully');
      navigate('/tickets/' + data.id);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to create ticket');
    },
  });

  const onSubmit = (data) => {
    // Combine date and time if both are set
    let dueDateValue = undefined;
    if (dueDate) {
      const dateTime = dueTime ? `${dueDate}T${dueTime}:00` : `${dueDate}T09:00:00`;
      dueDateValue = new Date(dateTime).toISOString();
    }

    createMutation.mutate({
      subject: data.subject,
      description: data.description,
      requesterId: data.contactId, // Backend expects requesterId, not contactId
      priority: data.priority,
      assigneeId: data.assigneeId || undefined,
      additionalAssigneeIds: additionalAssigneeIds.length > 0 ? additionalAssigneeIds : undefined,
      dueDate: dueDateValue,
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
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors touch-manipulation min-w-[40px] min-h-[40px] flex items-center justify-center">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">New Ticket</h1>
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
          <Textarea label="Description" required rows={4} {...register('description')} error={errors.description?.message} />

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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Due Date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-2.5 text-base md:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary min-h-[44px]"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Time</label>
                <input
                  type="time"
                  value={dueTime}
                  onChange={(e) => setDueTime(e.target.value)}
                  className="w-full px-3 py-2.5 text-base md:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary min-h-[44px]"
                />
              </div>
            </div>
            {dueDate && (
              <p className="text-xs text-gray-500 mt-2">
                This ticket will appear on the calendar for {(() => {
                  // Parse date as local time to avoid timezone offset issues
                  const [year, month, day] = dueDate.split('-').map(Number);
                  return new Date(year, month - 1, day).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                })()}
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
                }}
                className="p-1 hover:bg-gray-100 rounded"
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <Input
                  type="tel"
                  value={newClientPhone}
                  onChange={(e) => setNewClientPhone(e.target.value)}
                  placeholder="(555) 123-4567"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
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
    </div>
  );
}
