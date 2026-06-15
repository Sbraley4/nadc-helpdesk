import { useState, useEffect } from 'react';
import { Calendar, Clock, User, CalendarRange } from 'lucide-react';
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
  mode = 'add', // 'add' creates new schedule, 'reschedule' updates existing
  scheduleId = null, // Required when mode='reschedule'
  prefilledDate = null, // Pre-fill date from calendar click
  prefilledTime = null, // Pre-fill time from calendar click
}) {
  // Helper to format date as YYYY-MM-DD in local timezone (avoids UTC conversion issues)
  const formatLocalDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const [saving, setSaving] = useState(false);
  const [agents, setAgents] = useState([]);
  const [loadingAgents, setLoadingAgents] = useState(true);

  // Form state
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [isAllDay, setIsAllDay] = useState(false);
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

  // Initialize form when modal opens
  useEffect(() => {
    if (isOpen && ticket) {
      // Use pre-filled date/time if provided (from calendar click)
      if (prefilledDate) {
        const date = new Date(prefilledDate);
        setStartDate(formatLocalDate(date));
        setEndDate(formatLocalDate(date));
        if (prefilledTime) {
          setStartTime(prefilledTime);
          // Default end time to 1 hour later
          const [hours, mins] = prefilledTime.split(':').map(Number);
          const endHours = Math.min(hours + 1, 23);
          setEndTime(`${endHours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`);
        }
        setIsAllDay(false);
      } else if (ticket.dueDate) {
        // Use existing dueDate for reschedule mode
        const date = new Date(ticket.dueDate);
        setStartDate(formatLocalDate(date));
        const hours = date.getHours().toString().padStart(2, '0');
        const mins = date.getMinutes().toString().padStart(2, '0');
        setStartTime(`${hours}:${mins}`);

        // Set end date/time from scheduledEnd
        if (ticket.scheduledEnd) {
          const endDateTime = new Date(ticket.scheduledEnd);
          setEndDate(formatLocalDate(endDateTime));
          const endHours = endDateTime.getHours().toString().padStart(2, '0');
          const endMins = endDateTime.getMinutes().toString().padStart(2, '0');
          setEndTime(`${endHours}:${endMins}`);
        } else {
          setEndDate(formatLocalDate(date));
          const endHours = Math.min(date.getHours() + 1, 23);
          setEndTime(`${endHours.toString().padStart(2, '0')}:${mins}`);
        }
        setIsAllDay(false);
      } else {
        // Default to tomorrow at 9am
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        setStartDate(formatLocalDate(tomorrow));
        setEndDate(formatLocalDate(tomorrow));
        setStartTime('09:00');
        setEndTime('10:00');
        setIsAllDay(false);
      }

      // Set assignee
      setAssigneeId(ticket.assigneeId || ticket.assignee?.id || '');
    }
  }, [isOpen, ticket, prefilledDate, prefilledTime]);

  // Auto-update end time when start time changes (only if same day)
  const handleStartTimeChange = (newStartTime) => {
    setStartTime(newStartTime);
    if (startDate === endDate) {
      // Set end time to 1 hour later
      const [hours, mins] = newStartTime.split(':').map(Number);
      const endHours = Math.min(hours + 1, 23);
      setEndTime(`${endHours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`);
    }
  };

  // Helper to get Monday and Friday of a week containing the start date
  const getWeekBounds = (dateStr) => {
    // Parse dateStr as local date to avoid UTC timezone issues
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
    setIsAllDay(true);
  };

  const handleSave = async () => {
    if (!startDate || !startTime) {
      toast.error('Please select a date and time');
      return;
    }

    setSaving(true);
    try {
      // Combine date and time for scheduledStart
      const scheduledStart = new Date(`${startDate}T${startTime}`);

      // Combine end date and time for scheduledEnd
      let scheduledEnd = null;
      if (endDate && endTime) {
        scheduledEnd = new Date(`${endDate}T${endTime}`);
      }

      // Create or update the schedule entry
      if (mode === 'reschedule' && scheduleId) {
        // Update existing schedule
        await ticketsApi.updateSchedule(ticket.id, scheduleId, {
          scheduledStart: scheduledStart.toISOString(),
          scheduledEnd: scheduledEnd ? scheduledEnd.toISOString() : null,
          isAllDay,
        });
        toast.success('Schedule updated successfully');
      } else {
        // Create new schedule entry
        await ticketsApi.createSchedule(ticket.id, {
          scheduledStart: scheduledStart.toISOString(),
          scheduledEnd: scheduledEnd ? scheduledEnd.toISOString() : null,
          isAllDay,
        });
        toast.success('Ticket added to calendar');
      }

      // Update assignee if changed
      const currentAssigneeId = ticket.assigneeId || ticket.assignee?.id || '';
      if (assigneeId !== currentAssigneeId) {
        await ticketsApi.updateTicket(ticket.id, { assigneeId: assigneeId || null });
      }

      onScheduled?.();
      onClose();
    } catch (error) {
      console.error('Failed to schedule ticket:', error);
      toast.error(error.response?.data?.error || 'Failed to schedule ticket');
    } finally {
      setSaving(false);
    }
  };

  const isReschedule = mode === 'reschedule';
  const isMultiDay = startDate !== endDate;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isReschedule ? 'Reschedule Ticket' : 'Add to Calendar'}
      size="md"
    >
      <div className="space-y-4">
        {/* Ticket info */}
        {ticket && (
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
            <div className="text-sm text-gray-500">
              {isReschedule ? 'Rescheduling' : 'Scheduling'}
            </div>
            <div className="font-medium text-gray-900 truncate">
              #{ticket.ticketNumber} - {ticket.subject}
            </div>
          </div>
        )}

        {/* Start Date and End Date */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Calendar size={14} className="inline mr-1.5 mb-0.5" />
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                // Update end date if it's before start date
                if (e.target.value > endDate) {
                  setEndDate(e.target.value);
                }
              }}
              className="w-full px-3 py-2.5 text-base border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Calendar size={14} className="inline mr-1.5 mb-0.5" />
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              min={startDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
            />
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center justify-between">
          {/* All Day Toggle */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isAllDay"
              checked={isAllDay}
              onChange={(e) => setIsAllDay(e.target.checked)}
              className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
            />
            <label htmlFor="isAllDay" className="text-sm text-gray-700">
              All day event {isMultiDay && '(spans multiple days)'}
            </label>
          </div>

          {/* All Week Button - Prominent styling */}
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

        {/* Start and End Time (hidden if all day) */}
        {!isAllDay && (
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
        )}

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
          <Button onClick={handleSave} disabled={saving || !startDate}>
            {saving ? <Spinner size="sm" /> : (isReschedule ? 'Update Schedule' : 'Add to Calendar')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
