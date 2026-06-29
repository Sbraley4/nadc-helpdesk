import { useState, useEffect } from 'react';
import { FileText, X } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';
import Spinner from './Spinner';
import Badge from './Badge';
import { templates as templatesApi } from '../../api';

export default function TemplateSelectModal({
  isOpen,
  onClose,
  onSelectTemplate,
}) {
  const [templatesList, setTemplatesList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
    }
  }, [isOpen]);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const data = await templatesApi.getTemplates();
      setTemplatesList(data.templates || []);
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUseTemplate = (template) => {
    onSelectTemplate(template);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Select Template"
      size="lg"
    >
      <div className="min-h-[200px]">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : templatesList.length === 0 ? (
          <div className="text-center py-12">
            <FileText size={48} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No templates available</h3>
            <p className="text-gray-500 mt-1">Create templates in Settings to use them here</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
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
                </div>

                <div className="text-sm text-gray-600 mb-3">
                  <div className="truncate">
                    <span className="font-medium">Subject:</span> {template.subject}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mb-3">
                  <Badge variant={template.priority?.toLowerCase() || 'medium'}>{template.priority || 'MEDIUM'}</Badge>
                  {template.assignee && (
                    <Badge variant="secondary">{template.assignee.name}</Badge>
                  )}
                </div>

                <Button
                  variant="primary"
                  size="sm"
                  className="w-full"
                  onClick={() => handleUseTemplate(template)}
                >
                  Use Template
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4 mt-4 border-t">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}
