import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Plus,
  Search,
  Monitor,
  Laptop,
  Printer,
  Server,
  Smartphone,
  Router,
  HardDrive,
  Edit2,
  Trash2,
  ArrowLeft,
  Building2,
  User,
  Ticket,
  Calendar,
} from 'lucide-react';
import { devices, companies, contacts } from '../api';
import {
  Button,
  Spinner,
  Modal,
  Input,
  Textarea,
  Select,
  SearchInput,
  Badge,
  ConfirmDialog,
  Pagination,
} from '../components/shared';

const deviceTypeIcons = {
  DESKTOP: Monitor,
  LAPTOP: Laptop,
  SERVER: Server,
  PRINTER: Printer,
  ROUTER: Router,
  SWITCH: Router,
  FIREWALL: Router,
  PHONE: Smartphone,
  TABLET: Smartphone,
  OTHER: HardDrive,
};

const deviceTypeOptions = [
  { value: 'DESKTOP', label: 'Desktop' },
  { value: 'LAPTOP', label: 'Laptop' },
  { value: 'SERVER', label: 'Server' },
  { value: 'PRINTER', label: 'Printer' },
  { value: 'ROUTER', label: 'Router' },
  { value: 'SWITCH', label: 'Switch' },
  { value: 'FIREWALL', label: 'Firewall' },
  { value: 'PHONE', label: 'Phone' },
  { value: 'TABLET', label: 'Tablet' },
  { value: 'OTHER', label: 'Other' },
];

export default function DevicesPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [devicesList, setDevicesList] = useState([]);
  const [companiesList, setCompaniesList] = useState([]);
  const [contactsList, setContactsList] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editingDevice, setEditingDevice] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: '',
    type: 'DESKTOP',
    serialNumber: '',
    make: '',
    model: '',
    operatingSystem: '',
    ipAddress: '',
    notes: '',
    companyId: '',
  });

  useEffect(() => {
    fetchDevices();
    fetchDropdownData();
  }, [search, typeFilter, page]);

  useEffect(() => {
    if (id) {
      fetchDeviceDetails(id);
    } else {
      setSelectedDevice(null);
    }
  }, [id]);

  const fetchDevices = async () => {
    setLoading(true);
    try {
      const data = await devices.getDevices({
        search,
        type: typeFilter || undefined,
        page,
        limit: 20,
      });
      setDevicesList(data.devices || []);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch (error) {
      console.error('Failed to fetch devices:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDropdownData = async () => {
    try {
      const [companiesData, contactsData] = await Promise.all([
        companies.getCompanies({ limit: 100 }),
        contacts.getContacts({ limit: 100 }),
      ]);
      setCompaniesList(companiesData.companies || []);
      setContactsList(contactsData.contacts || []);
    } catch (error) {
      console.error('Failed to fetch dropdown data:', error);
    }
  };

  const fetchDeviceDetails = async (deviceId) => {
    try {
      const data = await devices.getDevice(deviceId);
      setSelectedDevice(data.device);
    } catch (error) {
      console.error('Failed to fetch device details:', error);
      navigate('/devices');
    }
  };

  const resetForm = () => {
    setForm({
      name: '',
      type: 'DESKTOP',
      serialNumber: '',
      make: '',
      model: '',
      operatingSystem: '',
      ipAddress: '',
      notes: '',
      companyId: '',
    });
  };

  const openCreateModal = () => {
    resetForm();
    setEditingDevice(null);
    setShowModal(true);
  };

  const openEditModal = (device) => {
    setEditingDevice(device);
    setForm({
      name: device.name,
      type: device.type,
      serialNumber: device.serialNumber || '',
      make: device.make || '',
      model: device.model || '',
      operatingSystem: device.operatingSystem || '',
      ipAddress: device.ipAddress || '',
      notes: device.notes || '',
      companyId: device.companyId || '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const payload = {
        name: form.name,
        type: form.type,
        serialNumber: form.serialNumber || null,
        make: form.make || null,
        model: form.model || null,
        operatingSystem: form.operatingSystem || null,
        ipAddress: form.ipAddress || null,
        notes: form.notes || null,
        companyId: form.companyId || null,
      };

      if (editingDevice) {
        await devices.updateDevice(editingDevice.id, payload);
        if (selectedDevice?.id === editingDevice.id) {
          fetchDeviceDetails(editingDevice.id);
        }
      } else {
        await devices.createDevice(payload);
      }

      setShowModal(false);
      fetchDevices();
    } catch (error) {
      console.error('Failed to save device:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;

    try {
      await devices.deleteDevice(deleteConfirm.id);
      setDeleteConfirm(null);
      if (selectedDevice?.id === deleteConfirm.id) {
        navigate('/devices');
      }
      fetchDevices();
    } catch (error) {
      console.error('Failed to delete device:', error);
    }
  };

  const DeviceIcon = ({ type, size = 20 }) => {
    const Icon = deviceTypeIcons[type] || HardDrive;
    return <Icon size={size} />;
  };

  const isWarrantyExpired = (date) => {
    if (!date) return false;
    return new Date(date) < new Date();
  };

  const isWarrantyExpiringSoon = (date) => {
    if (!date) return false;
    const expiry = new Date(date);
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    return expiry > new Date() && expiry <= thirtyDaysFromNow;
  };

  // Detail View
  if (selectedDevice) {
    return (
      <div className="space-y-4 md:space-y-6">
        <div className="flex flex-wrap items-center gap-2 md:gap-4">
          <button
            onClick={() => navigate('/devices')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors touch-manipulation min-w-[40px] min-h-[40px] flex items-center justify-center"
          >
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-lg md:text-xl font-semibold text-gray-900 flex-1 min-w-0 truncate">{selectedDevice.name}</h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => openEditModal(selectedDevice)}>
              <Edit2 size={16} className="mr-1" />
              <span className="hidden sm:inline">Edit</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-red-600 hover:bg-red-50"
              onClick={() => setDeleteConfirm(selectedDevice)}
            >
              <Trash2 size={16} className="sm:mr-1" />
              <span className="hidden sm:inline">Delete</span>
            </Button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Device Info */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                <DeviceIcon type={selectedDevice.type} size={32} />
              </div>
              <div>
                <Badge>{selectedDevice.type}</Badge>
                {selectedDevice.serialNumber && (
                  <p className="text-sm text-gray-500 mt-1">S/N: {selectedDevice.serialNumber}</p>
                )}
              </div>
            </div>

            <dl className="space-y-4">
              {selectedDevice.make && (
                <div>
                  <dt className="text-sm text-gray-500">Make</dt>
                  <dd className="font-medium">{selectedDevice.make}</dd>
                </div>
              )}
              {selectedDevice.model && (
                <div>
                  <dt className="text-sm text-gray-500">Model</dt>
                  <dd className="font-medium">{selectedDevice.model}</dd>
                </div>
              )}
              {selectedDevice.operatingSystem && (
                <div>
                  <dt className="text-sm text-gray-500">Operating System</dt>
                  <dd className="font-medium">{selectedDevice.operatingSystem}</dd>
                </div>
              )}
              {selectedDevice.ipAddress && (
                <div>
                  <dt className="text-sm text-gray-500">IP Address</dt>
                  <dd className="font-medium">{selectedDevice.ipAddress}</dd>
                </div>
              )}
              {selectedDevice.notes && (
                <div>
                  <dt className="text-sm text-gray-500">Notes</dt>
                  <dd className="text-gray-700 whitespace-pre-wrap">{selectedDevice.notes}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Owner Info */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="font-medium text-gray-900 mb-4">Owner Information</h3>

            {selectedDevice.company && (
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg mb-3">
                <Building2 size={20} className="text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Company</p>
                  <p className="font-medium">{selectedDevice.company.name}</p>
                </div>
              </div>
            )}

            {selectedDevice.contact && (
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <User size={20} className="text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Contact</p>
                  <p className="font-medium">{selectedDevice.contact.name}</p>
                  {selectedDevice.contact.email && (
                    <p className="text-sm text-gray-500">{selectedDevice.contact.email}</p>
                  )}
                </div>
              </div>
            )}

            {!selectedDevice.company && !selectedDevice.contact && (
              <p className="text-gray-500 text-sm">No owner assigned</p>
            )}
          </div>

          {/* Related Tickets */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 md:col-span-2">
            <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
              <Ticket size={18} />
              Related Tickets
            </h3>

            {selectedDevice.tickets?.length > 0 ? (
              <div className="space-y-2">
                {selectedDevice.tickets.map((ticketDevice) => (
                  <button
                    key={ticketDevice.ticketId}
                    onClick={() => navigate(`/tickets/${ticketDevice.ticketId}`)}
                    className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-left"
                  >
                    <div>
                      <span className="font-bold text-primary">#{ticketDevice.ticket?.ticketNumber}</span>
                      <span className="ml-2 text-gray-600">{ticketDevice.ticket?.subject}</span>
                    </div>
                    <Badge variant={ticketDevice.ticket?.status?.toLowerCase()}>
                      {ticketDevice.ticket?.status}
                    </Badge>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No tickets linked to this device</p>
            )}
          </div>
        </div>

        <ConfirmDialog
          isOpen={!!deleteConfirm}
          onClose={() => setDeleteConfirm(null)}
          onConfirm={handleDelete}
          title="Delete Device"
          message={`Are you sure you want to delete "${deleteConfirm?.name}"? This action cannot be undone.`}
          confirmText="Delete"
          variant="danger"
        />
      </div>
    );
  }

  // List View
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Devices & Assets</h2>
          <p className="text-sm text-gray-500 mt-1">Manage customer devices and equipment</p>
        </div>
        <Button onClick={openCreateModal}>
          <Plus size={18} className="mr-1" />
          Add Device
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by name, serial number, or manufacturer..."
          />
        </div>
        <Select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          options={[{ value: '', label: 'All Types' }, ...deviceTypeOptions]}
          className="w-full md:w-40"
        />
      </div>

      {/* Devices List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : devicesList.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <Monitor size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No devices found</h3>
          <p className="text-gray-500 mt-1">
            {search || typeFilter ? 'Try adjusting your filters' : 'Add your first device to get started'}
          </p>
          {!search && !typeFilter && (
            <Button className="mt-4" onClick={openCreateModal}>
              <Plus size={18} className="mr-1" />
              Add Device
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Device
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden md:table-cell">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden lg:table-cell">
                      Serial Number
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden md:table-cell">
                      Owner
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden lg:table-cell">
                      Warranty
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {devicesList.map((device) => (
                    <tr
                      key={device.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => navigate(`/devices/${device.id}`)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-gray-500">
                            <DeviceIcon type={device.type} />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{device.name}</p>
                            {device.make && device.model && (
                              <p className="text-sm text-gray-500">
                                {device.make} {device.model}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <Badge>{device.type}</Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 hidden lg:table-cell">
                        {device.serialNumber || '-'}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        {device.company?.name || device.contact?.name || (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {device.warrantyExpiry ? (
                          <div className="flex items-center gap-2">
                            <span className="text-sm">
                              {new Date(device.warrantyExpiry).toLocaleDateString()}
                            </span>
                            {isWarrantyExpired(device.warrantyExpiry) && (
                              <Badge variant="danger" size="sm">Expired</Badge>
                            )}
                            {isWarrantyExpiringSoon(device.warrantyExpiry) && (
                              <Badge variant="warning" size="sm">Soon</Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditModal(device);
                            }}
                            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirm(device);
                            }}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
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
          </div>

          {totalPages > 1 && (
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          )}
        </>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingDevice ? 'Edit Device' : 'Add Device'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Device Name"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="e.g., Front Desk Computer"
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
            <Select
              label="Type"
              value={form.type}
              onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value }))}
              options={deviceTypeOptions}
            />

            <Input
              label="Serial Number"
              value={form.serialNumber}
              onChange={(e) => setForm((prev) => ({ ...prev, serialNumber: e.target.value }))}
              placeholder="S/N"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
            <Input
              label="Make"
              value={form.make}
              onChange={(e) => setForm((prev) => ({ ...prev, make: e.target.value }))}
              placeholder="e.g., Dell, HP"
            />

            <Input
              label="Model"
              value={form.model}
              onChange={(e) => setForm((prev) => ({ ...prev, model: e.target.value }))}
              placeholder="e.g., OptiPlex 7090"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
            <Input
              label="Operating System"
              value={form.operatingSystem}
              onChange={(e) => setForm((prev) => ({ ...prev, operatingSystem: e.target.value }))}
              placeholder="e.g., Windows 11 Pro"
            />

            <Input
              label="IP Address"
              value={form.ipAddress}
              onChange={(e) => setForm((prev) => ({ ...prev, ipAddress: e.target.value }))}
              placeholder="e.g., 192.168.1.100"
            />
          </div>

          <Select
            label={<>Company <span className="text-red-500">*</span></>}
            value={form.companyId}
            onChange={(e) => setForm((prev) => ({ ...prev, companyId: e.target.value }))}
            options={[
              { value: '', label: 'Select a company' },
              ...companiesList.map((c) => ({ value: c.id, label: c.name })),
            ]}
            required
          />

          <Textarea
            label="Notes"
            value={form.notes}
            onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
            placeholder="Additional notes about this device"
            rows={3}
          />

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Spinner size="sm" /> : editingDevice ? 'Save Changes' : 'Add Device'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDelete}
        title="Delete Device"
        message={`Are you sure you want to delete "${deleteConfirm?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}
