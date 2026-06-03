import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Building2, Ticket, AlertCircle } from 'lucide-react';
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
    enabled: showCreateModal,
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
    </div>
  );
}
