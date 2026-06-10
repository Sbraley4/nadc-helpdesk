import { useState, useEffect } from 'react';
import { Calendar, Clock, User } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';
import Select from './Select';
import Spinner from './Spinner';
import { tickets as ticketsApi, agents as agentsApi } from '../../api';
import toast from 'react-hot-toast';

export default function ScheduleTicketModal({
  isOpen,
  onClose,
  ticket,
  onScheduled,
}) {
  const [saving, setSaving] = useState(false);
  const [agents, setAgents] = useState([]);
  const [loadingAgents, setLoadingAgents] = useState(true);

  // Form state
  const [scheduleDate, setScheduleDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [assigneeId, setAssigneeId] = useState('');

  // Load agents on mount
  useEffect(() => {
    const loadAgents = async () => {
      try {
        const data = await agentsApi.getAgents();
        setAgents((data.agents || data).filter(a => a.role !== 'VIEWER'));
      } catch (error) {
        console.error('Failed to load agents:', error);
      } finally {
        setLoadingAgents(false);
      }
    };
    loadAgents();
  }, []);

  // Initialize form when ticket changes or modal opens
  useEffect(() => {
    if (isOpen && ticket) {
      // Set date from existing dueDate
      if (ticket.dueDate) {
        const date = new Date(ticket.dueDate);
        setScheduleDate(date.toISOString().split('T')[0]);
        const hours = date.getHours().toString().padStart(2, '0');
        const mins = date.getMinutes().toString().padStart(2, '0');
        setStartTime(`${hours}:${mins}`);
      } else {
        // Default to tomorrow at 9am
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        setScheduleDate(tomorrow.toISOString().split('T')[0]);
        setStartTime('09:00');
      }

      // Set end time from existing scheduledEnd
      if (ticket.scheduledEnd) {
        const endDate = new Date(ticket.scheduledEnd);
        const hours = endDate.getHours().toString().padStart(2, '0');
        const mins = endDate.getMinutes().toString().padStart(2, '0');
        setEndTime(`${hours}:${mins}`);
      } else if (ticket.dueDate) {
        // Default to 1 hour after start
        const date = new Date(ticket.dueDate);
        date.setHours(date.getHours() + 1);
        const hours = date.getHours().toString().padStart(2, '0');
        const mins = date.getMinutes().toString().padStart(2, '0');
        setEndTime(`${hours}:${mins}`);
      } else {
        setEndTime('10:00');
      }

      // Set assignee
      setAssigneeId(ticket.assigneeId || ticket.assignee?.id || '');
    }
  }, [isOpen, ticket]);

  // Auto-update end time when start time changes
  const handleStartTimeChange = (newStartTime) => {
    setStartTime(newStartTime);
    // Set end time to 1 hour later
    const [hours, mins] = newStartTime.split(':').map(Number);
    const endHours = Math.min(hours + 1, 23);
    setEndTime(`${endHours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`);
  };

  const handleSave = async () => {
    if (!scheduleDate || !startTime) {
      toast.error('Please select a date and time');
      return;
    }

    setSaving(true);
    try {
      // Combine date and time for dueDate
      const dueDateTime = new Date(`${scheduleDate}T${startTime}`);

      // Combine date and end time for scheduledEnd
      const scheduledEndDateTime = endTime ? new Date(`${scheduleDate}T${endTime}`) : null;

      const updateData = {
        dueDate: dueDateTime.toISOString(),
        scheduledEnd: scheduledEndDateTime ? scheduledEndDateTime.toISOString() : null,
      };

      // Only include assigneeId if it changed
      if (assigneeId !== (ticket.assigneeId || ticket.assignee?.id || '')) {
        updateData.assigneeId = assigneeId || null;
      }

      await ticketsApi.updateTicket(ticket.id, updateData);
      toast.success('Ticket scheduled successfully');
      onScheduled?.();
      onClose();
    } catch (error) {
      console.error('Failed to schedule ticket:', error);
      toast.error(error.response?.data?.error || 'Failed to schedule ticket');
    } finally {
      setSaving(false);
    }
  };

  const isReschedule = !!ticket?.dueDate;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isReschedule ? 'Reschedule Ticket' : 'Schedule Ticket'}
      size="md"
    >
      <div className="space-y-4">
        {/* Ticket info */}
        {ticket && (
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
            <div className="text-sm text-gray-500">Scheduling</div>
            <div className="font-medium text-gray-900 truncate">
              #{ticket.ticketNumber} - {ticket.subject}
            </div>
          </div>
        )}

        {/* Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <Calendar size={14} className="inline mr-1.5 mb-0.5" />
            Date
          </label>
          <input
            type="date"
            value={scheduleDate}
            onChange={(e) => setScheduleDate(e.target.value)}
            className="w-full px-3 py-2.5 text-base border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
          />
        </div>

        {/* Start and End Time */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Clock size={14} className="inline mr-1.5 mb-0.5" />
              Start Time
            </label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => handleStartTimeChange(e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Clock size={14} className="inline mr-1.5 mb-0.5" />
              End Time
            </label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
            />
          </div>
        </div>

        {/* Agent Assignment */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <User size={14} className="inline mr-1.5 mb-0.5" />
            Assign To
          </label>
          {loadingAgents ? (
            <div className="flex items-center gap-2 text-gray-500 py-2">
              <Spinner size="sm" /> Loading agents...
            </div>
          ) : (
            <Select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              options={[
                { value: '', label: 'Unassigned' },
                ...agents.map(a => ({ value: a.id, label: a.name })),
              ]}
            />
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !scheduleDate}>
            {saving ? <Spinner size="sm" /> : (isReschedule ? 'Reschedule' : 'Schedule')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
