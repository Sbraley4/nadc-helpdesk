import { useState, useEffect } from 'react';
import {
  Plus,
  Package,
  Edit2,
  Trash2,
  AlertTriangle,
  Search,
} from 'lucide-react';
import { inventory } from '../../api';
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
} from '../../components/shared';

export default function InventoryPage() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: '',
    category: '',
    quantity: 0,
    threshold: 0,
    notes: '',
  });

  useEffect(() => {
    fetchItems();
  }, [search, categoryFilter, page]);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const data = await inventory.getItems({
        search: search || undefined,
        category: categoryFilter || undefined,
        page,
        limit: 50,
      });
      setItems(data.items || []);
      setCategories(data.categories || []);
      setTotalPages(data.totalPages || 1);
    } catch (error) {
      console.error('Failed to fetch inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({
      name: '',
      category: '',
      quantity: 0,
      threshold: 0,
      notes: '',
    });
  };

  const openCreateModal = () => {
    resetForm();
    setEditingItem(null);
    setShowModal(true);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setForm({
      name: item.name,
      category: item.category || '',
      quantity: item.quantity,
      threshold: item.threshold,
      notes: item.notes || '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const payload = {
        name: form.name,
        category: form.category || null,
        quantity: parseInt(form.quantity, 10) || 0,
        threshold: parseInt(form.threshold, 10) || 0,
        notes: form.notes || null,
      };

      if (editingItem) {
        await inventory.updateItem(editingItem.id, payload);
      } else {
        await inventory.createItem(payload);
      }

      setShowModal(false);
      fetchItems();
    } catch (error) {
      console.error('Failed to save item:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;

    try {
      await inventory.deleteItem(deleteConfirm.id);
      setDeleteConfirm(null);
      fetchItems();
    } catch (error) {
      console.error('Failed to delete item:', error);
    }
  };

  const toggleLowStock = async (item) => {
    try {
      await inventory.updateItem(item.id, { isLow: !item.isLow });
      fetchItems();
    } catch (error) {
      console.error('Failed to toggle low stock:', error);
    }
  };

  const getLowStockBadge = (item) => {
    // Show low stock if isLow is manually set OR quantity <= threshold
    const autoLow = item.quantity <= item.threshold;

    if (item.isLow || autoLow) {
      return (
        <Badge variant="warning" className="flex items-center gap-1">
          <AlertTriangle size={12} />
          Low Stock
        </Badge>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Inventory</h2>
          <p className="text-sm text-gray-500 mt-1">Track and manage your inventory items</p>
        </div>
        <Button onClick={openCreateModal}>
          <Plus size={18} className="mr-1" />
          Add Item
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by name, category, or notes..."
          />
        </div>
        <Select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          options={[
            { value: '', label: 'All Categories' },
            ...categories.map((c) => ({ value: c, label: c })),
          ]}
          className="w-full md:w-48"
        />
      </div>

      {/* Inventory List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <Package size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No inventory items found</h3>
          <p className="text-gray-500 mt-1">
            {search || categoryFilter ? 'Try adjusting your filters' : 'Add your first item to get started'}
          </p>
          {!search && !categoryFilter && (
            <Button className="mt-4" onClick={openCreateModal}>
              <Plus size={18} className="mr-1" />
              Add Item
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
                      Item
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden md:table-cell">
                      Category
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Quantity
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase hidden md:table-cell">
                      Threshold
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden lg:table-cell">
                      Notes
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                            <Package size={20} />
                          </div>
                          <span className="font-medium text-gray-900">{item.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 hidden md:table-cell">
                        {item.category || <span className="text-gray-400">-</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-medium ${item.quantity <= item.threshold ? 'text-yellow-600' : 'text-gray-900'}`}>
                          {item.quantity}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-gray-600 hidden md:table-cell">
                        {item.threshold}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleLowStock(item)}
                          className="inline-flex"
                          title="Click to toggle low stock status"
                        >
                          {getLowStockBadge(item) || (
                            <Badge variant="success">In Stock</Badge>
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 hidden lg:table-cell max-w-xs truncate">
                        {item.notes || <span className="text-gray-400">-</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditModal(item)}
                            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                            title="Edit"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(item)}
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
        title={editingItem ? 'Edit Item' : 'Add Item'}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Item Name"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="e.g., Ethernet Cable (Cat6)"
            required
          />

          <Input
            label="Category"
            value={form.category}
            onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
            placeholder="e.g., Cables, Hardware, Accessories"
            list="category-suggestions"
          />
          <datalist id="category-suggestions">
            {categories.map((cat) => (
              <option key={cat} value={cat} />
            ))}
          </datalist>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Quantity"
              type="number"
              min="0"
              value={form.quantity}
              onChange={(e) => setForm((prev) => ({ ...prev, quantity: e.target.value }))}
            />
            <Input
              label="Low Stock Threshold"
              type="number"
              min="0"
              value={form.threshold}
              onChange={(e) => setForm((prev) => ({ ...prev, threshold: e.target.value }))}
              helperText="Alert when quantity reaches this level"
            />
          </div>

          <Textarea
            label="Notes"
            value={form.notes}
            onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
            placeholder="Additional notes about this item"
            rows={3}
          />

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Spinner size="sm" /> : editingItem ? 'Save Changes' : 'Add Item'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDelete}
        title="Delete Item"
        message={`Are you sure you want to delete "${deleteConfirm?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}
