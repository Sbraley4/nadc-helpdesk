import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Users, Ticket, AlertCircle, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { companies } from '../../api';
import { Button, SearchInput, Pagination, EmptyState, CenteredSpinner, Avatar, Modal, Input, PhoneInput } from '../../components/shared';

export default function CompanyListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', domain: '', phone: '', address: '' });
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', domain: '', phone: '', address: '' });
  const [deletingCompany, setDeletingCompany] = useState(null);
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
    queryKey: ['companies', filters],
    queryFn: () => companies.getCompanies({
      page: filters.page,
      limit: 20,
      search: filters.search || undefined,
    }),
  });

  const createMutation = useMutation({
    mutationFn: companies.createCompany,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      toast.success('Company created successfully');
      setShowCreateModal(false);
      setCreateForm({ name: '', domain: '', phone: '', address: '' });
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to create company');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => companies.updateCompany(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      toast.success('Company updated successfully');
      setShowEditModal(false);
      setEditingCompany(null);
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to update company');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: companies.deleteCompany,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      toast.success('Company deleted successfully');
      setDeletingCompany(null);
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to delete company');
    },
  });

  const handleEditClick = (company) => {
    setEditingCompany(company);
    setEditForm({
      name: company.name || '',
      domain: company.domain || '',
      phone: company.phone || '',
      address: company.address || '',
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();
    if (!editForm.name) {
      toast.error('Company name is required');
      return;
    }
    updateMutation.mutate({
      id: editingCompany.id,
      data: {
        name: editForm.name,
        domain: editForm.domain || undefined,
        phone: editForm.phone || undefined,
        address: editForm.address || undefined,
      },
    });
  };

  const handleDeleteClick = (company) => {
    setDeletingCompany(company);
  };

  const handleDeleteConfirm = () => {
    if (deletingCompany) {
      deleteMutation.mutate(deletingCompany.id);
    }
  };

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    if (!createForm.name) {
      toast.error('Company name is required');
      return;
    }
    createMutation.mutate({
      name: createForm.name,
      domain: createForm.domain || undefined,
      phone: createForm.phone || undefined,
      address: createForm.address || undefined,
    });
  };

  const companyList = data?.companies || [];
  const pagination = data?.pagination || { total: 0, pages: 1 };

  if (error) {
    return (
      <div className="p-6">
        <EmptyState icon={AlertCircle} title="Error loading companies" description={error.message} />
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 md:mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Companies</h1>
          <p className="text-sm text-gray-500 mt-0.5">{pagination.total} total companies</p>
        </div>
        <Button leftIcon={<Plus size={18} />} onClick={() => setShowCreateModal(true)} className="w-full sm:w-auto">
          Add Company
        </Button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 md:p-4 mb-4 md:mb-6">
        <SearchInput
          value={filters.search}
          onChange={(value) => updateFilters({ search: value, page: 1 })}
          placeholder="Search companies..."
          className="w-full md:w-64"
        />
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? <CenteredSpinner /> : companyList.length === 0 ? (
          <EmptyState
            title="No companies found"
            description={filters.search ? 'Try adjusting your search' : 'Add your first company to get started'}
          />
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Domain</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Account Manager</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contacts</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tickets</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {companyList.map((company) => (
                    <tr key={company.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <Link to={'/companies/' + company.id} className="text-sm font-medium text-gray-900 hover:text-primary">
                          {company.name}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">{company.domain || '-'}</td>
                      <td className="px-6 py-4">
                        {company.assignedAgent ? (
                          <div className="flex items-center gap-2">
                            <Avatar name={company.assignedAgent.name} size="xs" />
                            <span className="text-sm text-gray-900">{company.assignedAgent.name}</span>
                          </div>
                        ) : <span className="text-sm text-gray-400">-</span>}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1 text-sm text-gray-500">
                          <Users size={16} />
                          {company._count?.contacts || 0}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1 text-sm text-gray-500">
                          <Ticket size={16} />
                          {company._count?.tickets || 0}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEditClick(company)}
                            className="p-1.5 text-gray-400 hover:text-primary hover:bg-gray-100 rounded transition-colors"
                            title="Edit company"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(company)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Delete company"
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

            {/* Mobile Card View */}
            <div className="block md:hidden">
              {companyList.map((company) => (
                <div key={company.id} className="p-4 border-b border-gray-100 last:border-b-0">
                  <Link to={'/companies/' + company.id} className="block mb-3">
                    <p className="text-base font-medium text-gray-900">{company.name}</p>
                    {company.domain && <p className="text-sm text-gray-500 mt-0.5">{company.domain}</p>}
                  </Link>

                  {/* Company Details */}
                  <div className="space-y-2 mb-3">
                    {company.assignedAgent && (
                      <div className="flex items-center gap-2">
                        <Avatar name={company.assignedAgent.name} size="xs" />
                        <span className="text-sm text-gray-600">{company.assignedAgent.name}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Users size={14} className="text-gray-400" />
                        {company._count?.contacts || 0} contacts
                      </span>
                      <span className="flex items-center gap-1">
                        <Ticket size={14} className="text-gray-400" />
                        {company._count?.tickets || 0} tickets
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEditClick(company)}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-primary hover:bg-gray-100 rounded-lg border border-gray-200 min-h-[44px] touch-manipulation"
                    >
                      <Pencil size={16} />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => handleDeleteClick(company)}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg border border-gray-200 min-h-[44px] touch-manipulation"
                    >
                      <Trash2 size={16} />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <Pagination currentPage={filters.page} totalPages={pagination.pages} totalItems={pagination.total} itemsPerPage={20} onPageChange={(page) => updateFilters({ page })} />
          </>
        )}
      </div>

      {/* Create Company Modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Add Company">
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <Input
            label="Company Name"
            required
            value={createForm.name}
            onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
            placeholder="Enter company name"
          />
          <Input
            label="Domain"
            value={createForm.domain}
            onChange={(e) => setCreateForm({ ...createForm, domain: e.target.value })}
            placeholder="e.g., acmecorp.com"
          />
          <PhoneInput
            label="Phone"
            value={createForm.phone}
            onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
          />
          <Input
            label="Address"
            value={createForm.address}
            onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })}
            placeholder="Enter address"
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={createMutation.isPending}>
              Create Company
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Company Modal */}
      <Modal isOpen={showEditModal} onClose={() => { setShowEditModal(false); setEditingCompany(null); }} title="Edit Company">
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <Input
            label="Company Name"
            required
            value={editForm.name}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            placeholder="Enter company name"
          />
          <Input
            label="Domain"
            value={editForm.domain}
            onChange={(e) => setEditForm({ ...editForm, domain: e.target.value })}
            placeholder="e.g., acmecorp.com"
          />
          <PhoneInput
            label="Phone"
            value={editForm.phone}
            onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
          />
          <Input
            label="Address"
            value={editForm.address}
            onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
            placeholder="Enter address"
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => { setShowEditModal(false); setEditingCompany(null); }}>
              Cancel
            </Button>
            <Button type="submit" isLoading={updateMutation.isPending}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={!!deletingCompany} onClose={() => setDeletingCompany(null)} title="Delete Company">
        <div className="space-y-4">
          <p className="text-gray-600">
            Are you sure you want to delete <span className="font-semibold text-gray-900">{deletingCompany?.name}</span>?
            This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setDeletingCompany(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleDeleteConfirm}
              isLoading={deleteMutation.isPending}
            >
              Delete Company
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
