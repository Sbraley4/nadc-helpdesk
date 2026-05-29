import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Copy, FileText, CheckSquare, RotateCcw, X } from 'lucide-react';
import { templates, agents, tags as tagsApi } from '../api';
import { Button, Spinner, Modal, Input, Textarea, Select, Badge, ConfirmDialog } from '../components/shared';

const priorityOptions = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
];

const frequencyOptions = [
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'BIWEEKLY', label: 'Bi-weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'YEARLY', label: 'Yearly' },
];

export default function TemplatesPage() {
  const [templatesList, setTemplatesList] = useState([]);
  const [agentsList, setAgentsList] = useState([]);
  const [tagsList, setTagsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: '',
    description: '',
    subject: '',
    body: '',
    priority: 'MEDIUM',
    assigneeId: '',
    tagIds: [],
    checklistItems: [],
    isRecurring: false,
    recurringFrequency: 'WEEKLY',
    recurringDayOfWeek: 1,
    recurringDayOfMonth: 1,
  });

  const [newChecklistItem, setNewChecklistItem] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [templatesData, agentsData, tagsData] = await Promise.all([
        templates.getTemplates(),
        agents.getAgents(),
        tagsApi.getTags(),
      ]);
      setTemplatesList(templatesData.templates || []);
      setAgentsList(agentsData.agents || []);
      setTagsList(tagsData.tags || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({
      name: '',
      description: '',
      subject: '',
      body: '',
      priority: 'MEDIUM',
      assigneeId: '',
      tagIds: [],
      checklistItems: [],
      isRecurring: false,
      recurringFrequency: 'WEEKLY',
      recurringDayOfWeek: 1,
      recurringDayOfMonth: 1,
    });
    setNewChecklistItem('');
  };

  const openCreateModal = () => {
    resetForm();
    setEditingTemplate(null);
    setShowModal(true);
  };

  const openEditModal = (template) => {
    setEditingTemplate(template);
    setForm({
      name: template.name,
      description: template.description || '',
      subject: template.subject,
      body: template.description || '', // Use description as body content
      priority: template.priority,
      assigneeId: template.assigneeId || '',
      tagIds: template.tags?.map((t) => t.id) || [],
      checklistItems: template.checklistItems?.map((item) => item.label || item.text || item) || [],
      isRecurring: !!template.recurringSchedule,
      recurringFrequency: template.recurringSchedule?.frequency || 'WEEKLY',
      recurringDayOfWeek: template.recurringSchedule?.dayOfWeek || 1,
      recurringDayOfMonth: template.recurringSchedule?.dayOfMonth || 1,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const payload = {
        name: form.name,
        subject: form.subject,
        description: form.body || form.description || '', // Map body to description
        priority: form.priority,
        assigneeId: form.assigneeId || null,
        tags: form.tagIds, // Backend expects 'tags' as array
        checklistItems: form.checklistItems.map((item) => ({ label: item })), // Convert strings to {label} objects
        recurring: form.isRecurring ? {
          frequency: form.recurringFrequency,
          dayOfWeek: form.recurringDayOfWeek,
          dayOfMonth: form.recurringDayOfMonth,
        } : null,
      };

      if (editingTemplate) {
        await templates.updateTemplate(editingTemplate.id, payload);
      } else {
        await templates.createTemplate(payload);
      }

      setShowModal(false);
      fetchData();
    } catch (error) {
      console.error('Failed to save template:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;

    try {
      await templates.deleteTemplate(deleteConfirm.id);
      setDeleteConfirm(null);
      fetchData();
    } catch (error) {
      console.error('Failed to delete template:', error);
    }
  };

  const handleCreateTicket = (templateId) => {
    // Navigate to new ticket page with template ID as query param
    // User will select a contact on the new ticket page
    window.location.href = `/tickets/new?templateId=${templateId}`;
  };

  const addChecklistItem = () => {
    if (newChecklistItem.trim()) {
      setForm((prev) => ({
        ...prev,
        checklistItems: [...prev.checklistItems, newChecklistItem.trim()],
      }));
      setNewChecklistItem('');
    }
  };

  const removeChecklistItem = (index) => {
    setForm((prev) => ({
      ...prev,
      checklistItems: prev.checklistItems.filter((_, i) => i !== index),
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Ticket Templates</h2>
          <p className="text-sm text-gray-500 mt-1">
            Create reusable templates for common ticket types
          </p>
        </div>
        <Button onClick={openCreateModal}>
          <Plus size={18} className="mr-1" />
          New Template
        </Button>
      </div>

      {/* Templates Grid */}
      {templatesList.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <FileText size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No templates yet</h3>
          <p className="text-gray-500 mt-1">Create your first template to streamline ticket creation</p>
          <Button className="mt-4" onClick={openCreateModal}>
            <Plus size={18} className="mr-1" />
            Create Template
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templatesList.map((template) => (
            <div
              key={template.id}
              className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900 truncate">{template.name}</h3>
                  {template.description && (
                    <p className="text-sm text-gray-500 line-clamp-2 mt-1">{template.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 ml-2">
                  <button
                    onClick={() => openEditModal(template)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(template)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="text-sm text-gray-600 mb-3">
                <div className="truncate">
                  <span className="font-medium">Subject:</span> {template.subject}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-3">
                <Badge variant={template.priority.toLowerCase()}>{template.priority}</Badge>
                {template.checklistItems?.length > 0 && (
                  <Badge variant="secondary">
                    <CheckSquare size={12} className="mr-1" />
                    {template.checklistItems.length} items
                  </Badge>
                )}
                {template.recurringSchedule && (
                  <Badge variant="secondary">
                    <RotateCcw size={12} className="mr-1" />
                    {template.recurringSchedule.frequency}
                  </Badge>
                )}
              </div>

              {template.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {template.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag.id}
                      className="inline-flex items-center px-2 py-0.5 rounded text-xs"
                      style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                    >
                      {tag.name}
                    </span>
                  ))}
                  {template.tags.length > 3 && (
                    <span className="text-xs text-gray-500">+{template.tags.length - 3} more</span>
                  )}
                </div>
              )}

              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => handleCreateTicket(template.id)}
              >
                <Copy size={14} className="mr-1" />
                Create Ticket
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingTemplate ? 'Edit Template' : 'Create Template'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Template Name"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="e.g., New Computer Setup"
            required
          />

          <Textarea
            label="Description"
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="Brief description of when to use this template"
            rows={2}
          />

          <Input
            label="Ticket Subject"
            value={form.subject}
            onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))}
            placeholder="Subject line for tickets created from this template"
            required
          />

          <Textarea
            label="Ticket Body"
            value={form.body}
            onChange={(e) => setForm((prev) => ({ ...prev, body: e.target.value }))}
            placeholder="Default content for the ticket description"
            rows={4}
          />

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Priority"
              value={form.priority}
              onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value }))}
              options={priorityOptions}
            />

            <Select
              label="Default Assignee"
              value={form.assigneeId}
              onChange={(e) => setForm((prev) => ({ ...prev, assigneeId: e.target.value }))}
              options={[
                { value: '', label: 'Unassigned' },
                ...agentsList.map((a) => ({ value: a.id, label: a.name })),
              ]}
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
            <div className="flex flex-wrap gap-2 p-2 border border-gray-300 rounded-lg min-h-[42px]">
              {tagsList.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => {
                    setForm((prev) => ({
                      ...prev,
                      tagIds: prev.tagIds.includes(tag.id)
                        ? prev.tagIds.filter((id) => id !== tag.id)
                        : [...prev.tagIds, tag.id],
                    }));
                  }}
                  className={`inline-flex items-center px-2 py-1 rounded text-xs transition-all ${
                    form.tagIds.includes(tag.id)
                      ? 'ring-2 ring-offset-1'
                      : 'opacity-60 hover:opacity-100'
                  }`}
                  style={{
                    backgroundColor: `${tag.color}20`,
                    color: tag.color,
                    ringColor: tag.color,
                  }}
                >
                  {tag.name}
                </button>
              ))}
            </div>
          </div>

          {/* Checklist Items */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Checklist Items</label>
            <div className="space-y-2 mb-2">
              {form.checklistItems.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg"
                >
                  <CheckSquare size={16} className="text-gray-400" />
                  <span className="flex-1 text-sm">{item}</span>
                  <button
                    type="button"
                    onClick={() => removeChecklistItem(idx)}
                    className="p-1 text-gray-400 hover:text-red-500"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newChecklistItem}
                onChange={(e) => setNewChecklistItem(e.target.value)}
                placeholder="Add checklist item"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addChecklistItem();
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={addChecklistItem}>
                Add
              </Button>
            </div>
          </div>

          {/* Recurring Schedule */}
          <div className="border-t pt-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isRecurring}
                onChange={(e) => setForm((prev) => ({ ...prev, isRecurring: e.target.checked }))}
                className="rounded border-gray-300 text-primary focus:ring-primary"
              />
              <span className="text-sm font-medium text-gray-700">
                <RotateCcw size={14} className="inline mr-1" />
                Create as recurring ticket
              </span>
            </label>

            {form.isRecurring && (
              <div className="mt-3 grid grid-cols-2 gap-4 pl-6">
                <Select
                  label="Frequency"
                  value={form.recurringFrequency}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, recurringFrequency: e.target.value }))
                  }
                  options={frequencyOptions}
                />

                {['WEEKLY', 'BIWEEKLY'].includes(form.recurringFrequency) && (
                  <Select
                    label="Day of Week"
                    value={form.recurringDayOfWeek}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, recurringDayOfWeek: parseInt(e.target.value) }))
                    }
                    options={[
                      { value: 0, label: 'Sunday' },
                      { value: 1, label: 'Monday' },
                      { value: 2, label: 'Tuesday' },
                      { value: 3, label: 'Wednesday' },
                      { value: 4, label: 'Thursday' },
                      { value: 5, label: 'Friday' },
                      { value: 6, label: 'Saturday' },
                    ]}
                  />
                )}

                {['MONTHLY', 'QUARTERLY', 'YEARLY'].includes(form.recurringFrequency) && (
                  <Input
                    type="number"
                    label="Day of Month"
                    value={form.recurringDayOfMonth}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, recurringDayOfMonth: parseInt(e.target.value) }))
                    }
                    min={1}
                    max={31}
                  />
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Spinner size="sm" /> : editingTemplate ? 'Save Changes' : 'Create Template'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDelete}
        title="Delete Template"
        message={`Are you sure you want to delete "${deleteConfirm?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}
