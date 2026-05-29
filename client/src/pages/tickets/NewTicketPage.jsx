import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Upload, X, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';
import { tickets, contacts, agents, templates } from '../../api';
import { Button, Input, Select, Textarea, CenteredSpinner } from '../../components/shared';

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
  const [contactSearch, setContactSearch] = useState('');
  const [showContactDropdown, setShowContactDropdown] = useState(false);
  const [dueDate, setDueDate] = useState(searchParams.get('dueDate') || '');
  const [dueTime, setDueTime] = useState('09:00');
  const templateId = searchParams.get('templateId');

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

  const selectedContactId = watch('contactId');
  // Search contacts
  const { data: contactResults } = useQuery({
    queryKey: ['contacts-search', contactSearch],
    queryFn: () => contacts.searchContacts(contactSearch),
    enabled: contactSearch.length >= 2,
  });

  // Get agents for assignment
  const { data: agentsData } = useQuery({
    queryKey: ['agents'],
    queryFn: agents.getAgents,
  });

  // Get selected contact details
  const { data: selectedContact } = useQuery({
    queryKey: ['contact', selectedContactId],
    queryFn: () => contacts.getContact(selectedContactId),
    enabled: !!selectedContactId,
  });

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
      dueDate: dueDateValue,
    });
  };

  // Extract contact from response (API returns {contact: ...})
  const contact = selectedContact?.contact || selectedContact;

  const agentOptions = [
    { value: '', label: 'Unassigned' },
    ...(agentsData?.agents || []).map((agent) => ({
      value: agent.id,
      label: agent.name,
    })),
  ];
  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">New Ticket</h1>
      </div>

      {templateData && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
          Using template: <strong>{templateData.name}</strong>. Select a contact to create the ticket.
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="space-y-6">
          {/* Contact selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contact <span className="text-red-500">*</span>
            </label>
            {contact?.id ? (
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div>
                  <p className="font-medium text-gray-900">{contact.name}</p>
                  <p className="text-sm text-gray-500">{contact.email}</p>
                  {contact.company && (
                    <p className="text-sm text-gray-500">{contact.company.name}</p>
                  )}
                </div>
                <button type="button" onClick={() => setValue('contactId', '')} className="text-gray-400 hover:text-gray-600">
                  <X size={18} />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Input
                  placeholder="Search contacts..."
                  value={contactSearch}
                  onChange={(e) => {
                    setContactSearch(e.target.value);
                    setShowContactDropdown(true);
                  }}
                  onFocus={() => setShowContactDropdown(true)}
                />
                {showContactDropdown && contactResults?.contacts?.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 max-h-60 overflow-auto">
                    {contactResults.contacts.map((contact) => (
                      <button
                        key={contact.id}
                        type="button"
                        onClick={() => {
                          setValue('contactId', contact.id);
                          setContactSearch('');
                          setShowContactDropdown(false);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-gray-50"
                      >
                        <p className="font-medium text-gray-900">{contact.name}</p>
                        <p className="text-sm text-gray-500">{contact.email}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {errors.contactId && <p className="mt-1 text-sm text-red-600">{errors.contactId.message}</p>}
          </div>

          <Input label="Subject" required {...register('subject')} error={errors.subject?.message} />
          <Textarea label="Description" required rows={6} {...register('description')} error={errors.description?.message} />

          <div className="grid grid-cols-2 gap-4">
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

          {/* Schedule on Calendar */}
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
              <Calendar size={16} />
              Schedule on Calendar
            </label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Due Date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Time</label>
                <input
                  type="time"
                  value={dueTime}
                  onChange={(e) => setDueTime(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
            </div>
            {dueDate && (
              <p className="text-xs text-gray-500 mt-2">
                This ticket will appear on the calendar for {new Date(dueDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-gray-200">
          <Button type="button" variant="secondary" onClick={() => navigate(-1)}>Cancel</Button>
          <Button type="submit" isLoading={createMutation.isPending}>Create Ticket</Button>
        </div>
      </form>
    </div>
  );
}
