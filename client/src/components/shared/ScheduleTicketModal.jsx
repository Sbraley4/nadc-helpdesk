import { useState, useEffect, useMemo } from 'react';
import { Calendar, Clock, User, CalendarRange, Repeat } from 'lucide-react';
import { addMonths, addYears, differenceInMonths, differenceInYears } from 'date-fns';
import Modal from './Modal';
import Button from './Button';
import Select from './Select';
import Spinner from './Spinner';
import { tickets as ticketsApi, agents as agentsApi } from '../../api';
import toast from 'react-hot-toast';

// Maximum number of recurring occurrences
const MAX_RECURRENCE_COUNT = 60;

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

  // Recurring state
  const [repeatFrequency, setRepeatFrequency] = useState(''); // '' | 'MONTHLY' | 'YEARLY'
  const [repeatUntil, setRepeatUntil] = useState('');

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
      // Reset recurring state
      setRepeatFrequency('');
      setRepeatUntil('');

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

  // Handle repeat frequency change - set default repeatUntil
  const handleRepeatFrequencyChange = (newFrequency) => {
    setRepeatFrequency(newFrequency);
    if (newFrequency && startDate) {
      const start = new Date(startDate);
      let defaultUntil;
      if (newFrequency === 'MONTHLY') {
        defaultUntil = addYears(start, 1); // 1 year out for monthly
      } else if (newFrequency === 'YEARLY') {
        defaultUntil = addYears(start, 5); // 5 years out for yearly
      }
      if (defaultUntil) {
        setRepeatUntil(formatLocalDate(defaultUntil));
      }
    } else {
      setRepeatUntil('');
    }
  };

  // Calculate estimated occurrence count
  const estimatedOccurrences = useMemo(() => {
    if (!repeatFrequency || !startDate || !repeatUntil) return 0;
    const start = new Date(startDate);
    const until = new Date(repeatUntil);
    if (until < start) return 0;

    if (repeatFrequency === 'MONTHLY') {
      return Math.min(differenceInMonths(until, start) + 1, MAX_RECURRENCE_COUNT);
    } else if (repeatFrequency === 'YEARLY') {
      return Math.min(differenceInYears(until, start) + 1, MAX_RECURRENCE_COUNT);
    }
    return 0;
  }, [repeatFrequency, startDate, repeatUntil]);

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

    // Validate recurring settings
    if (repeatFrequency && !repeatUntil) {
      toast.error('Please select an end date for the recurring schedule');
      return;
    }

    if (repeatFrequency && estimatedOccurrences >= MAX_RECURRENCE_COUNT) {
      toast.error(`Would create ${estimatedOccurrences} entries, which exceeds the maximum of ${MAX_RECURRENCE_COUNT}. Please choose a shorter date range.`);
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
        // Update existing schedule (no recurring support for updates)
        await ticketsApi.updateSchedule(ticket.id, scheduleId, {
          scheduledStart: scheduledStart.toISOString(),
          scheduledEnd: scheduledEnd ? scheduledEnd.toISOString() : null,
          isAllDay,
        });
        toast.success('Schedule updated successfully');
      } else {
        // Create new schedule entry (with optional recurring)
        const scheduleData = {
          scheduledStart: scheduledStart.toISOString(),
          scheduledEnd: scheduledEnd ? scheduledEnd.toISOString() : null,
          isAllDay,
        };

        if (repeatFrequency) {
          scheduleData.repeatFrequency = repeatFrequency;
          scheduleData.repeatUntil = new Date(`${repeatUntil}T23:59:59`).toISOString();
        }

        const result = await ticketsApi.createSchedule(ticket.id, scheduleData);
        if (result.createdCount && result.createdCount > 1) {
          toast.success(`Created ${result.createdCount} calendar entries`);
        } else {
          toast.success('Ticket added to calendar');
        }
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

        {/* Recurring Schedule (only for new schedules, not reschedule) */}
        {mode !== 'reschedule' && (
          <div className="space-y-3 pt-3 border-t border-gray-200">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Repeat size={14} className="inline mr-1.5 mb-0.5" />
                Repeats
              </label>
              <Select
                value={repeatFrequency}
                onChange={(e) => handleRepeatFrequencyChange(e.target.value)}
                options={[
                  { value: '', label: 'Does not repeat' },
                  { value: 'MONTHLY', label: 'Monthly' },
                  { value: 'YEARLY', label: 'Yearly' },
                ]}
              />
            </div>

            {repeatFrequency && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Calendar size={14} className="inline mr-1.5 mb-0.5" />
                    Repeat Until
                  </label>
                  <input
                    type="date"
                    value={repeatUntil}
                    min={startDate}
                    onChange={(e) => setRepeatUntil(e.target.value)}
                    className="w-full px-3 py-2.5 text-base border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
                  />
                </div>

                {/* Occurrence count indicator */}
                {estimatedOccurrences > 0 && (
                  <div className={`text-sm px-3 py-2 rounded-lg ${
                    estimatedOccurrences >= MAX_RECURRENCE_COUNT
                      ? 'bg-red-50 text-red-700 border border-red-200'
                      : 'bg-blue-50 text-blue-700 border border-blue-200'
                  }`}>
                    {estimatedOccurrences >= MAX_RECURRENCE_COUNT ? (
                      <>
                        <strong>Warning:</strong> This would create {estimatedOccurrences} entries, exceeding the maximum of {MAX_RECURRENCE_COUNT}. Please choose a shorter date range.
                      </>
                    ) : (
                      <>Will create <strong>{estimatedOccurrences}</strong> calendar {estimatedOccurrences === 1 ? 'entry' : 'entries'}</>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

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
