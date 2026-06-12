import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Building2, Ticket, AlertCircle, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { contacts, companies } from '../../api';
import { Button, SearchInput, Pagination, EmptyState, CenteredSpinner, Avatar, Modal, Input, Select, PhoneInput } from '../../components/shared';

export default function ContactListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', email: '', phone: '', companyId: '' });
  const [showInlineCompanyForm, setShowInlineCompanyForm] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyDomain, setNewCompanyDomain] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '', companyId: '' });
  const [deletingContact, setDeletingContact] = useState(null);
  const queryClient = useQueryClient();

  const filters = {
    page: parseInt(searchParams.get('page') || '1'),
    search: searchParams.get('search') || '',
  };

  const updateFilters = (newFilters) => {
    const params = new URLSearchParams();
    const merged = { ...filters, ...newFilters };
    Object.entries(merged).forEach(([key, value]) => {
      if (value && !(key === 'page' && value === 1)) {
        params.set(key, String(value));
      }
    });
    setSearchParams(params);
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ['contacts', filters],
    queryFn: () => contacts.getContacts({
      page: filters.page,
      limit: 20,
      search: filters.search || undefined,
    }),
  });

  const { data: companiesData } = useQuery({
    queryKey: ['companies-list'],
    queryFn: () => companies.getCompanies({ limit: 100 }),
    enabled: showCreateModal || showEditModal,
  });

  const createMutation = useMutation({
    mutationFn: contacts.createContact,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success('Contact created successfully');
      setShowCreateModal(false);
      setCreateForm({ name: '', email: '', phone: '', companyId: '' });
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to create contact');
    },
  });

  const createCompanyMutation = useMutation({
    mutationFn: companies.createCompany,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['companies-list'] });
      // Auto-select the newly created company
      setCreateForm({ ...createForm, companyId: data.company?.id || data.id });
      setShowInlineCompanyForm(false);
      setNewCompanyName('');
      setNewCompanyDomain('');
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
    });
  };

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => contacts.updateContact(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success('Contact updated successfully');
      setShowEditModal(false);
      setEditingContact(null);
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to update contact');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: contacts.deleteContact,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success('Contact deleted successfully');
      setDeletingContact(null);
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to delete contact');
    },
  });

  const handleEditClick = (contact) => {
    setEditingContact(contact);
    setEditForm({
      name: contact.name || '',
      email: contact.email || '',
      phone: contact.phone || '',
      companyId: contact.company?.id || '',
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();
    if (!editForm.name || !editForm.email) {
      toast.error('Name and email are required');
      return;
    }
    updateMutation.mutate({
      id: editingContact.id,
      data: {
        name: editForm.name,
        email: editForm.email,
        phone: editForm.phone || undefined,
        companyId: editForm.companyId || undefined,
      },
    });
  };

  const handleDeleteClick = (contact) => {
    setDeletingContact(contact);
  };

  const handleDeleteConfirm = () => {
    if (deletingContact) {
      deleteMutation.mutate(deletingContact.id);
    }
  };

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    if (!createForm.name || !createForm.email) {
      toast.error('Name and email are required');
      return;
    }
    createMutation.mutate({
      name: createForm.name,
      email: createForm.email,
      phone: createForm.phone || undefined,
      companyId: createForm.companyId || undefined,
    });
  };

  const contactList = data?.contacts || [];
  const pagination = data?.pagination || { total: 0, pages: 1 };
  const companyOptions = [
    { value: '', label: 'No company' },
    ...(companiesData?.companies || []).map(c => ({ value: c.id, label: c.name })),
  ];

  if (error) {
    return (
      <div className="p-6">
        <EmptyState icon={AlertCircle} title="Error loading contacts" description={error.message} />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contacts</h1>
          <p className="text-sm text-gray-500 mt-1">{pagination.total} total contacts</p>
        </div>
        <Button leftIcon={<Plus size={18} />} onClick={() => setShowCreateModal(true)}>
          Add Contact
        </Button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <SearchInput
          value={filters.search}
          onChange={(value) => updateFilters({ search: value, page: 1 })}
          placeholder="Search contacts..."
          className="w-64"
        />
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? <CenteredSpinner /> : contactList.length === 0 ? (
          <EmptyState
            title="No contacts found"
            description={filters.search ? 'Try adjusting your search' : 'Add your first contact to get started'}
          />
        ) : (
          <>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tickets</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {contactList.map((contact) => (
                  <tr key={contact.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <Link to={'/contacts/' + contact.id} className="flex items-center gap-3">
                        <Avatar name={contact.name} size="sm" />
                        <div>
                          <p className="text-sm font-medium text-gray-900 hover:text-primary">{contact.name}</p>
                          <p className="text-sm text-gray-500">{contact.email}</p>
                        </div>
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      {contact.company ? (
                        <Link to={'/companies/' + contact.company.id} className="flex items-center gap-2 text-sm text-gray-900 hover:text-primary">
                          <Building2 size={16} className="text-gray-400" />
                          {contact.company.name}
                        </Link>
                      ) : <span className="text-sm text-gray-400">-</span>}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{contact.phone || '-'}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 text-sm text-gray-500">
                        <Ticket size={16} />
                        {contact._count?.tickets || 0}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEditClick(contact)}
                          className="p-1.5 text-gray-400 hover:text-primary hover:bg-gray-100 rounded transition-colors"
                          title="Edit contact"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(contact)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Delete contact"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination currentPage={filters.page} totalPages={pagination.pages} totalItems={pagination.total} itemsPerPage={20} onPageChange={(page) => updateFilters({ page })} />
          </>
        )}
      </div>

      {/* Create Contact Modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Add Contact">
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <Input
            label="Name"
            required
            value={createForm.name}
            onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
            placeholder="Enter contact name"
          />
          <Input
            label="Email"
            type="email"
            required
            value={createForm.email}
            onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
            placeholder="Enter email address"
          />
          <PhoneInput
            label="Phone"
            value={createForm.phone}
            onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
            {!showInlineCompanyForm ? (
              <>
                <Select
                  options={companyOptions}
                  value={createForm.companyId}
                  onChange={(e) => setCreateForm({ ...createForm, companyId: e.target.value })}
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
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={createMutation.isPending}>
              Create Contact
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Contact Modal */}
      <Modal isOpen={showEditModal} onClose={() => { setShowEditModal(false); setEditingContact(null); }} title="Edit Contact">
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <Input
            label="Name"
            required
            value={editForm.name}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            placeholder="Enter contact name"
          />
          <Input
            label="Email"
            type="email"
            required
            value={editForm.email}
            onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
            placeholder="Enter email address"
          />
          <PhoneInput
            label="Phone"
            value={editForm.phone}
            onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
            <Select
              options={companyOptions}
              value={editForm.companyId}
              onChange={(e) => setEditForm({ ...editForm, companyId: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => { setShowEditModal(false); setEditingContact(null); }}>
              Cancel
            </Button>
            <Button type="submit" isLoading={updateMutation.isPending}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={!!deletingContact} onClose={() => setDeletingContact(null)} title="Delete Contact">
        <div className="space-y-4">
          <p className="text-gray-600">
            Are you sure you want to delete <span className="font-semibold text-gray-900">{deletingContact?.name}</span>?
            This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setDeletingContact(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleDeleteConfirm}
              isLoading={deleteMutation.isPending}
            >
              Delete Contact
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
