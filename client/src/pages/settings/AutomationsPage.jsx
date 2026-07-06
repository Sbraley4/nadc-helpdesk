import { useState, useEffect } from 'react';
import {
  Zap,
  Plus,
  Edit2,
  Trash2,
  Play,
  ToggleLeft,
  ToggleRight,
  X,
  ChevronDown,
  AlertCircle,
  CheckCircle,
  ArrowRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { automations, agents, tags as tagsApi } from '../../api';
import { Button, Spinner, Modal, Input, Select, Badge, ConfirmDialog } from '../../components/shared';

const TRIGGERS = [
  { value: 'TICKET_CREATED', label: 'Ticket Created' },
  { value: 'TICKET_UPDATED', label: 'Ticket Updated' },
  { value: 'REPLY_RECEIVED', label: 'Reply Received' },
  { value: 'TIME_BASED', label: 'Time-Based (Scheduled)' },
];

const CONDITION_FIELDS = [
  { value: 'status', label: 'Status', type: 'select', options: ['OPEN', 'PENDING', 'INVOICED', 'POSTED'] },
  { value: 'priority', label: 'Priority', type: 'select', options: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] },
  { value: 'type', label: 'Type', type: 'select', options: ['QUESTION', 'INCIDENT', 'PROBLEM', 'TASK'] },
  { value: 'assigneeId', label: 'Assignee', type: 'agent' },
  { value: 'groupId', label: 'Group', type: 'group' },
  { value: 'tag', label: 'Tag', type: 'tag' },
  { value: 'subject', label: 'Subject', type: 'text' },
  { value: 'requesterEmail', label: 'Requester Email', type: 'text' },
  { value: 'ticketAgeDays', label: 'Ticket Age (Days)', type: 'number' },
];

const OPERATORS = [
  { value: 'is', label: 'is' },
  { value: 'is_not', label: 'is not' },
  { value: 'contains', label: 'contains' },
  { value: 'not_contains', label: 'does not contain' },
  { value: 'greater_than', label: 'greater than' },
  { value: 'less_than', label: 'less than' },
];

const ACTION_TYPES = [
  { value: 'set_status', label: 'Set Status', valueType: 'select', options: ['OPEN', 'PENDING', 'INVOICED', 'POSTED'] },
  { value: 'set_priority', label: 'Set Priority', valueType: 'select', options: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] },
  { value: 'assign_agent', label: 'Assign to Agent', valueType: 'agent' },
  { value: 'assign_group', label: 'Assign to Group', valueType: 'group' },
  { value: 'add_tag', label: 'Add Tag', valueType: 'tag' },
  { value: 'remove_tag', label: 'Remove Tag', valueType: 'tag' },
  { value: 'send_email', label: 'Send Email', valueType: 'email' },
  { value: 'add_note', label: 'Add Internal Note', valueType: 'textarea' },
];

export default function AutomationsPage() {
  const [automationsList, setAutomationsList] = useState([]);
  const [agentsList, setAgentsList] = useState([]);
  const [tagsList, setTagsList] = useState([]);
  const [groupsList, setGroupsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [testModal, setTestModal] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [testTicketId, setTestTicketId] = useState('');
  const [testing, setTesting] = useState(false);

  const [form, setForm] = useState({
    name: '',
    trigger: 'TICKET_CREATED',
    conditions: [{ field: 'status', operator: 'is', value: '' }],
    actions: [{ type: 'set_status', value: '' }],
    runOrder: 0,
    isActive: true,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [automationsData, agentsData, tagsData] = await Promise.all([
        automations.getAutomations(),
        agents.getAgents(),
        tagsApi.getTags(),
      ]);
      setAutomationsList(automationsData.automations || []);
      setAgentsList(agentsData.agents || []);
      setTagsList(tagsData.tags || []);

      // Get groups from agents API
      try {
        const groupsData = await agents.getGroups();
        setGroupsList(groupsData.groups || []);
      } catch {
        setGroupsList([]);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
      if (error.response?.status === 403) {
        toast.error('You do not have permission to access automations');
      } else {
        toast.error('Failed to load automations');
      }
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({
      name: '',
      trigger: 'TICKET_CREATED',
      conditions: [{ field: 'status', operator: 'is', value: '' }],
      actions: [{ type: 'set_status', value: '' }],
      runOrder: 0,
      isActive: true,
    });
  };

  const openCreateModal = () => {
    resetForm();
    setEditingAutomation(null);
    setShowModal(true);
  };

  const openEditModal = (automation) => {
    setEditingAutomation(automation);
    setForm({
      name: automation.name,
      trigger: automation.trigger,
      conditions: automation.conditions || [{ field: 'status', operator: 'is', value: '' }],
      actions: automation.actions || [{ type: 'set_status', value: '' }],
      runOrder: automation.runOrder || 0,
      isActive: automation.isActive,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate required fields
    if (!form.name.trim()) {
      toast.error('Automation name is required');
      return;
    }

    // Filter conditions and actions with values
    const validConditions = form.conditions.filter(c => c.value);
    const validActions = form.actions.filter(a => a.value);

    if (validConditions.length === 0) {
      toast.error('At least one condition with a value is required');
      return;
    }

    if (validActions.length === 0) {
      toast.error('At least one action with a value is required');
      return;
    }

    setSaving(true);

    try {
      const payload = {
        name: form.name.trim(),
        trigger: form.trigger,
        conditions: validConditions,
        actions: validActions,
        runOrder: parseInt(form.runOrder) || 0,
        isActive: form.isActive,
      };

      if (editingAutomation) {
        await automations.updateAutomation(editingAutomation.id, payload);
        toast.success('Automation updated successfully');
      } else {
        await automations.createAutomation(payload);
        toast.success('Automation created successfully');
      }

      setShowModal(false);
      fetchData();
    } catch (error) {
      console.error('Failed to save automation:', error);
      toast.error(error.response?.data?.error || 'Failed to save automation');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (automation) => {
    try {
      await automations.toggleAutomation(automation.id);
      setAutomationsList(prev =>
        prev.map(a => a.id === automation.id ? { ...a, isActive: !a.isActive } : a)
      );
      toast.success(`Automation ${automation.isActive ? 'disabled' : 'enabled'}`);
    } catch (error) {
      console.error('Failed to toggle automation:', error);
      toast.error('Failed to toggle automation');
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;

    try {
      await automations.deleteAutomation(deleteConfirm.id);
      setDeleteConfirm(null);
      fetchData();
      toast.success('Automation deleted');
    } catch (error) {
      console.error('Failed to delete automation:', error);
      toast.error('Failed to delete automation');
    }
  };

  const handleTest = async () => {
    if (!testTicketId.trim()) return;
    setTesting(true);
    setTestResult(null);

    try {
      const result = await automations.testAutomation(testModal.id, testTicketId.trim());
      setTestResult(result);
    } catch (error) {
      setTestResult({ error: error.response?.data?.error || 'Test failed' });
    } finally {
      setTesting(false);
    }
  };

  // Condition handlers
  const addCondition = () => {
    setForm(prev => ({
      ...prev,
      conditions: [...prev.conditions, { field: 'status', operator: 'is', value: '' }],
    }));
  };

  const updateCondition = (index, field, value) => {
    setForm(prev => ({
      ...prev,
      conditions: prev.conditions.map((c, i) =>
        i === index ? { ...c, [field]: value } : c
      ),
    }));
  };

  const removeCondition = (index) => {
    setForm(prev => ({
      ...prev,
      conditions: prev.conditions.filter((_, i) => i !== index),
    }));
  };

  // Action handlers
  const addAction = () => {
    setForm(prev => ({
      ...prev,
      actions: [...prev.actions, { type: 'set_status', value: '' }],
    }));
  };

  const updateAction = (index, field, value) => {
    setForm(prev => ({
      ...prev,
      actions: prev.actions.map((a, i) =>
        i === index ? { ...a, [field]: value } : a
      ),
    }));
  };

  const removeAction = (index) => {
    setForm(prev => ({
      ...prev,
      actions: prev.actions.filter((_, i) => i !== index),
    }));
  };

  const renderConditionValueInput = (condition, index) => {
    const fieldDef = CONDITION_FIELDS.find(f => f.value === condition.field);
    if (!fieldDef) return null;

    switch (fieldDef.type) {
      case 'select':
        return (
          <select
            value={condition.value}
            onChange={(e) => updateCondition(index, 'value', e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">Select...</option>
            {fieldDef.options.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        );
      case 'agent':
        return (
          <select
            value={condition.value}
            onChange={(e) => updateCondition(index, 'value', e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">Select...</option>
            <option value="unassigned">Unassigned</option>
            {agentsList.map(agent => (
              <option key={agent.id} value={agent.id}>{agent.name}</option>
            ))}
          </select>
        );
      case 'group':
        return (
          <select
            value={condition.value}
            onChange={(e) => updateCondition(index, 'value', e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">Select...</option>
            {groupsList.map(group => (
              <option key={group.id} value={group.id}>{group.name}</option>
            ))}
          </select>
        );
      case 'tag':
        return (
          <select
            value={condition.value}
            onChange={(e) => updateCondition(index, 'value', e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">Select...</option>
            {tagsList.map(tag => (
              <option key={tag.id} value={tag.name}>{tag.name}</option>
            ))}
          </select>
        );
      case 'number':
        return (
          <Input
            type="number"
            value={condition.value}
            onChange={(e) => updateCondition(index, 'value', e.target.value)}
            placeholder="Enter number"
            className="flex-1"
          />
        );
      default:
        return (
          <Input
            value={condition.value}
            onChange={(e) => updateCondition(index, 'value', e.target.value)}
            placeholder="Enter value"
            className="flex-1"
          />
        );
    }
  };

  const renderActionValueInput = (action, index) => {
    const actionDef = ACTION_TYPES.find(a => a.value === action.type);
    if (!actionDef) return null;

    switch (actionDef.valueType) {
      case 'select':
        return (
          <select
            value={action.value}
            onChange={(e) => updateAction(index, 'value', e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">Select...</option>
            {actionDef.options.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        );
      case 'agent':
        return (
          <select
            value={action.value}
            onChange={(e) => updateAction(index, 'value', e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">Select agent...</option>
            {agentsList.map(agent => (
              <option key={agent.id} value={agent.id}>{agent.name}</option>
            ))}
          </select>
        );
      case 'group':
        return (
          <select
            value={action.value}
            onChange={(e) => updateAction(index, 'value', e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">Select group...</option>
            {groupsList.map(group => (
              <option key={group.id} value={group.id}>{group.name}</option>
            ))}
          </select>
        );
      case 'tag':
        return (
          <Input
            value={action.value}
            onChange={(e) => updateAction(index, 'value', e.target.value)}
            placeholder="Enter tag name"
            className="flex-1"
          />
        );
      case 'email':
        return (
          <select
            value={action.value}
            onChange={(e) => updateAction(index, 'value', e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">Select recipient...</option>
            <option value="requester">Requester</option>
            <option value="assignee">Assignee</option>
          </select>
        );
      case 'textarea':
        return (
          <textarea
            value={action.value}
            onChange={(e) => updateAction(index, 'value', e.target.value)}
            placeholder="Enter note text (supports {{ticket_number}}, {{requester_name}}, {{assignee_name}})"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-[60px]"
            rows={2}
          />
        );
      default:
        return (
          <Input
            value={action.value}
            onChange={(e) => updateAction(index, 'value', e.target.value)}
            placeholder="Enter value"
            className="flex-1"
          />
        );
    }
  };

  const getTriggerLabel = (trigger) => {
    const t = TRIGGERS.find(tr => tr.value === trigger);
    return t ? t.label : trigger;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg md:text-xl font-semibold text-gray-900">Automation Rules</h2>
          <p className="text-sm text-gray-500 mt-0.5 md:mt-1">
            Automate ticket handling with conditional rules
          </p>
        </div>
        <Button onClick={openCreateModal} className="w-full sm:w-auto">
          <Plus size={18} className="mr-1" />
          New Automation
        </Button>
      </div>

      {/* Automations List */}
      {automationsList.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <Zap size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No automations yet</h3>
          <p className="text-gray-500 mt-1">Create your first automation rule to streamline ticket handling</p>
          <Button className="mt-4" onClick={openCreateModal}>
            <Plus size={18} className="mr-1" />
            Create Automation
          </Button>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Name</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Trigger</th>
                <th className="text-center px-4 py-3 text-sm font-medium text-gray-700">Conditions</th>
                <th className="text-center px-4 py-3 text-sm font-medium text-gray-700">Actions</th>
                <th className="text-center px-4 py-3 text-sm font-medium text-gray-700">Order</th>
                <th className="text-center px-4 py-3 text-sm font-medium text-gray-700">Active</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {automationsList.map((automation) => (
                <tr key={automation.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{automation.name}</div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary">{getTriggerLabel(automation.trigger)}</Badge>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-sm text-gray-600">
                      {automation.conditions?.length || 0}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-sm text-gray-600">
                      {automation.actions?.length || 0}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-sm text-gray-600">
                      {automation.runOrder || 0}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleToggle(automation)}
                      className={`transition-colors ${
                        automation.isActive ? 'text-green-500' : 'text-gray-400'
                      }`}
                    >
                      {automation.isActive ? (
                        <ToggleRight size={24} />
                      ) : (
                        <ToggleLeft size={24} />
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => {
                          setTestModal(automation);
                          setTestTicketId('');
                          setTestResult(null);
                        }}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                        title="Test automation"
                      >
                        <Play size={16} />
                      </button>
                      <button
                        onClick={() => openEditModal(automation)}
                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                        title="Edit"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(automation)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingAutomation ? 'Edit Automation' : 'Create Automation'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
            <Input
              label="Automation Name"
              value={form.name}
              onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Auto-assign urgent tickets"
              required
            />
            <Select
              label="Trigger"
              value={form.trigger}
              onChange={(e) => setForm(prev => ({ ...prev, trigger: e.target.value }))}
              options={TRIGGERS}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
            <Input
              type="number"
              label="Run Order"
              value={form.runOrder}
              onChange={(e) => setForm(prev => ({ ...prev, runOrder: e.target.value }))}
              placeholder="0"
              min={0}
            />
            <div className="flex items-center sm:pt-6">
              <label className="flex items-center gap-2 cursor-pointer min-h-[44px]">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm(prev => ({ ...prev, isActive: e.target.checked }))}
                  className="rounded border-gray-300 text-primary focus:ring-primary w-5 h-5"
                />
                <span className="text-sm font-medium text-gray-700">Active</span>
              </label>
            </div>
          </div>

          {/* Conditions Section */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-gray-900">
                Conditions <span className="text-gray-500 font-normal">(all must match)</span>
              </h4>
              <Button type="button" variant="outline" size="sm" onClick={addCondition}>
                <Plus size={14} className="mr-1" />
                Add Condition
              </Button>
            </div>

            <div className="space-y-3">
              {form.conditions.map((condition, index) => (
                <div key={index} className="flex flex-col sm:flex-row sm:items-start gap-2 p-3 bg-gray-50 rounded-lg">
                  <div className="flex gap-2 w-full sm:w-auto">
                    <select
                      value={condition.field}
                      onChange={(e) => updateCondition(index, 'field', e.target.value)}
                      className="flex-1 sm:flex-none sm:w-36 px-3 py-2.5 text-base md:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-[44px]"
                    >
                      {CONDITION_FIELDS.map(field => (
                        <option key={field.value} value={field.value}>{field.label}</option>
                      ))}
                    </select>

                    <select
                      value={condition.operator}
                      onChange={(e) => updateCondition(index, 'operator', e.target.value)}
                      className="flex-1 sm:flex-none sm:w-32 px-3 py-2.5 text-base md:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-[44px]"
                    >
                      {OPERATORS.map(op => (
                        <option key={op.value} value={op.value}>{op.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex gap-2 flex-1">
                    {renderConditionValueInput(condition, index)}

                    {form.conditions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeCondition(index)}
                        className="p-2 text-gray-400 hover:text-red-500 touch-manipulation min-w-[40px] min-h-[40px] flex items-center justify-center"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions Section */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-gray-900">Actions</h4>
              <Button type="button" variant="outline" size="sm" onClick={addAction}>
                <Plus size={14} className="mr-1" />
                Add Action
              </Button>
            </div>

            <div className="space-y-3">
              {form.actions.map((action, index) => (
                <div key={index} className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg">
                  <select
                    value={action.type}
                    onChange={(e) => updateAction(index, 'type', e.target.value)}
                    className="w-44 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    {ACTION_TYPES.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>

                  <ArrowRight size={16} className="mt-3 text-gray-400 flex-shrink-0" />

                  {renderActionValueInput(action, index)}

                  {form.actions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeAction(index)}
                      className="p-2 text-gray-400 hover:text-red-500"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Spinner size="sm" /> : editingAutomation ? 'Save Changes' : 'Create Automation'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Test Modal */}
      <Modal
        isOpen={!!testModal}
        onClose={() => setTestModal(null)}
        title={`Test Automation: ${testModal?.name}`}
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Enter a ticket ID to test this automation against. The test will evaluate conditions
            without executing actions.
          </p>

          <Input
            label="Ticket ID"
            value={testTicketId}
            onChange={(e) => setTestTicketId(e.target.value)}
            placeholder="Enter ticket ID (UUID)"
          />

          <Button onClick={handleTest} disabled={testing || !testTicketId.trim()}>
            {testing ? <Spinner size="sm" /> : <Play size={16} className="mr-1" />}
            Run Test
          </Button>

          {testResult && (
            <div className="mt-4 space-y-3">
              {testResult.error ? (
                <div className="p-3 bg-red-50 text-red-800 rounded-lg flex items-start gap-2">
                  <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                  {testResult.error}
                </div>
              ) : (
                <>
                  <div className={`p-3 rounded-lg flex items-start gap-2 ${
                    testResult.wouldFire ? 'bg-green-50 text-green-800' : 'bg-yellow-50 text-yellow-800'
                  }`}>
                    {testResult.wouldFire ? (
                      <CheckCircle size={16} className="mt-0.5 flex-shrink-0" />
                    ) : (
                      <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                    )}
                    <span>
                      {testResult.wouldFire
                        ? 'This automation WOULD fire for this ticket'
                        : 'This automation would NOT fire for this ticket'}
                    </span>
                  </div>

                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700 border-b">
                      Condition Results
                    </div>
                    <div className="divide-y">
                      {testResult.conditionsResult?.map((cr, i) => (
                        <div key={i} className="px-3 py-2 flex items-center justify-between text-sm">
                          <span className="text-gray-700">{cr.condition}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500">Actual: {cr.actualValue}</span>
                            {cr.passed ? (
                              <CheckCircle size={16} className="text-green-500" />
                            ) : (
                              <X size={16} className="text-red-500" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {testResult.wouldFire && testResult.actions?.length > 0 && (
                    <div className="border rounded-lg overflow-hidden">
                      <div className="bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700 border-b">
                        Actions That Would Execute
                      </div>
                      <div className="divide-y">
                        {testResult.actions.map((action, i) => (
                          <div key={i} className="px-3 py-2 text-sm text-gray-700">
                            {action}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDelete}
        title="Delete Automation"
        message={`Are you sure you want to delete "${deleteConfirm?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}
