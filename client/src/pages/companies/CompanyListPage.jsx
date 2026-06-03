import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Users, Ticket, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { companies } from '../../api';
import { Button, SearchInput, Pagination, EmptyState, CenteredSpinner, Avatar, Modal, Input, PhoneInput } from '../../components/shared';

export default function CompanyListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', domain: '', phone: '', address: '' });
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Companies</h1>
          <p className="text-sm text-gray-500 mt-1">{pagination.total} total companies</p>
        </div>
        <Button leftIcon={<Plus size={18} />} onClick={() => setShowCreateModal(true)}>
          Add Company
        </Button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <SearchInput
          value={filters.search}
          onChange={(value) => updateFilters({ search: value, page: 1 })}
          placeholder="Search companies..."
          className="w-64"
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
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Domain</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Account Manager</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contacts</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tickets</th>
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
                  </tr>
                ))}
              </tbody>
            </table>
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
    </div>
  );
}
