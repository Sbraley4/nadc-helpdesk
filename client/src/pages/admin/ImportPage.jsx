import { useState } from 'react';
import { Upload, FileSpreadsheet, Building2, Users, Ticket, ChevronRight, AlertCircle, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Spinner } from '../../components/shared';
import api from '../../api/client';

const IMPORT_TYPES = [
  {
    id: 'companies',
    label: 'Companies',
    icon: Building2,
    description: 'Import company/organization data',
    order: 1,
  },
  {
    id: 'contacts',
    label: 'Contacts',
    icon: Users,
    description: 'Import contact/customer data',
    order: 2,
  },
  {
    id: 'tickets',
    label: 'Tickets',
    icon: Ticket,
    description: 'Import ticket/support request data',
    order: 3,
  },
];

export default function ImportPage() {
  const [step, setStep] = useState('select'); // select, preview, importing, results
  const [selectedType, setSelectedType] = useState(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);

  const handleFileSelect = async (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv')) {
      toast.error('Please select a CSV file');
      return;
    }

    setFile(selectedFile);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('type', selectedType);

      const response = await api.post('/api/import/preview', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setPreview(response.data);
      setStep('preview');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to parse CSV file');
      setFile(null);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!file || !selectedType) return;

    setStep('importing');
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await api.post(`/api/import/${selectedType}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setResults(response.data);
      setStep('results');
      toast.success(`Import completed: ${response.data.imported} records imported`);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Import failed');
      setStep('preview');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setStep('select');
    setSelectedType(null);
    setFile(null);
    setPreview(null);
    setResults(null);
  };

  const renderSelectType = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Select Data Type to Import</h2>
        <p className="text-sm text-gray-600">
          Import your Freshdesk data in the correct order: Companies first, then Contacts, then Tickets
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {IMPORT_TYPES.map((type) => {
          const Icon = type.icon;
          return (
            <button
              key={type.id}
              onClick={() => { setSelectedType(type.id); setStep('upload'); }}
              className="p-6 bg-white rounded-lg border-2 border-gray-200 hover:border-primary hover:bg-primary/5 transition-all text-left group"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 bg-gray-100 rounded-lg group-hover:bg-primary/10 transition-colors">
                  <Icon size={24} className="text-gray-600 group-hover:text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center text-xs font-bold text-gray-600">
                      {type.order}
                    </span>
                    <h3 className="font-semibold text-gray-900">{type.label}</h3>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">{type.description}</p>
                </div>
                <ChevronRight size={20} className="text-gray-400 group-hover:text-primary" />
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-8 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
        <div className="flex gap-3">
          <AlertCircle size={20} className="text-yellow-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-yellow-800">Important: Import Order</p>
            <p className="text-yellow-700 mt-1">
              For best results, import data in this order:
            </p>
            <ol className="list-decimal list-inside text-yellow-700 mt-2 space-y-1">
              <li>Companies (so contacts can be linked)</li>
              <li>Contacts (so tickets can be linked)</li>
              <li>Tickets (will link to existing contacts and companies)</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );

  const renderUpload = () => {
    const typeInfo = IMPORT_TYPES.find(t => t.id === selectedType);
    const Icon = typeInfo?.icon || FileSpreadsheet;

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={handleReset}
            className="text-sm text-primary hover:underline"
          >
            &larr; Back
          </button>
        </div>

        <div className="text-center mb-8">
          <div className="inline-flex p-3 bg-primary/10 rounded-lg mb-4">
            <Icon size={32} className="text-primary" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            Import {typeInfo?.label}
          </h2>
          <p className="text-sm text-gray-600">
            Upload your Freshdesk {typeInfo?.label.toLowerCase()} CSV export file
          </p>
        </div>

        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-primary transition-colors">
          <input
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className="hidden"
            id="csv-upload"
            disabled={loading}
          />
          <label htmlFor="csv-upload" className="cursor-pointer">
            {loading ? (
              <div className="flex flex-col items-center">
                <Loader2 size={48} className="text-primary animate-spin mb-4" />
                <p className="text-sm text-gray-600">Parsing CSV file...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <Upload size={48} className="text-gray-400 mb-4" />
                <p className="text-sm font-medium text-gray-700 mb-1">
                  Click to upload or drag and drop
                </p>
                <p className="text-xs text-gray-500">CSV files only (max 50MB)</p>
              </div>
            )}
          </label>
        </div>

        <div className="p-4 bg-gray-50 rounded-lg">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Expected CSV Columns:</h3>
          {selectedType === 'companies' && (
            <p className="text-xs text-gray-500">Name, Domain, Notes/Description</p>
          )}
          {selectedType === 'contacts' && (
            <p className="text-xs text-gray-500">Name, Email, Phone, Company</p>
          )}
          {selectedType === 'tickets' && (
            <p className="text-xs text-gray-500">Subject, Description, Requester Email, Status, Priority, Agent, Created At, Company</p>
          )}
        </div>
      </div>
    );
  };

  const renderPreview = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => { setStep('upload'); setFile(null); setPreview(null); }}
          className="text-sm text-primary hover:underline"
        >
          &larr; Back
        </button>
        <div className="text-sm text-gray-600">
          <span className="font-medium">{preview?.totalRows}</span> rows found
        </div>
      </div>

      <div className="text-center mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Preview Import</h2>
        <p className="text-sm text-gray-600">
          Review the first 10 rows before importing
        </p>
      </div>

      {/* Data Preview Table */}
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Row</th>
              {preview?.columns?.slice(0, 6).map((col, i) => (
                <th key={i} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider truncate max-w-[150px]">
                  {col}
                </th>
              ))}
              {preview?.columns?.length > 6 && (
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">
                  +{preview.columns.length - 6} more
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {preview?.preview?.map((row, idx) => (
              <tr key={idx} className="hover:bg-gray-50">
                <td className="px-3 py-2 text-gray-500">{idx + 1}</td>
                {preview.columns.slice(0, 6).map((col, i) => (
                  <td key={i} className="px-3 py-2 text-gray-900 truncate max-w-[150px]" title={row[col]}>
                    {row[col] || '—'}
                  </td>
                ))}
                {preview.columns.length > 6 && (
                  <td className="px-3 py-2 text-gray-500">...</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Button variant="outline" onClick={() => { setStep('upload'); setFile(null); setPreview(null); }}>
          Cancel
        </Button>
        <Button onClick={handleImport} disabled={loading}>
          Import {preview?.totalRows} Records
        </Button>
      </div>
    </div>
  );

  const renderImporting = () => (
    <div className="text-center py-12">
      <Loader2 size={64} className="text-primary animate-spin mx-auto mb-6" />
      <h2 className="text-lg font-semibold text-gray-900 mb-2">Importing Data...</h2>
      <p className="text-sm text-gray-600">
        This may take a few minutes for large files. Please don't close this page.
      </p>
    </div>
  );

  const renderResults = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <div className="inline-flex p-4 bg-green-100 rounded-full mb-4">
          <CheckCircle size={48} className="text-green-600" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Import Complete</h2>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 bg-green-50 rounded-lg text-center border border-green-200">
          <p className="text-3xl font-bold text-green-600">{results?.imported || 0}</p>
          <p className="text-sm text-green-700">Imported</p>
        </div>
        <div className="p-4 bg-yellow-50 rounded-lg text-center border border-yellow-200">
          <p className="text-3xl font-bold text-yellow-600">{results?.skipped || 0}</p>
          <p className="text-sm text-yellow-700">Skipped (duplicates)</p>
        </div>
        <div className="p-4 bg-gray-50 rounded-lg text-center border border-gray-200">
          <p className="text-3xl font-bold text-gray-600">{results?.total || 0}</p>
          <p className="text-sm text-gray-700">Total Rows</p>
        </div>
      </div>

      {results?.errors?.length > 0 && (
        <div className="p-4 bg-red-50 rounded-lg border border-red-200">
          <h3 className="text-sm font-medium text-red-800 mb-2 flex items-center gap-2">
            <XCircle size={16} />
            Errors ({results.errors.length})
          </h3>
          <ul className="text-xs text-red-700 space-y-1 max-h-40 overflow-y-auto">
            {results.errors.slice(0, 20).map((error, i) => (
              <li key={i}>{error}</li>
            ))}
            {results.errors.length > 20 && (
              <li className="font-medium">...and {results.errors.length - 20} more errors</li>
            )}
          </ul>
        </div>
      )}

      <div className="flex justify-center gap-3 pt-4">
        <Button onClick={handleReset}>
          Import More Data
        </Button>
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Freshdesk Import</h1>
        <p className="text-sm text-gray-600 mt-1">
          Import your data from Freshdesk CSV exports
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        {step === 'select' && renderSelectType()}
        {step === 'upload' && renderUpload()}
        {step === 'preview' && renderPreview()}
        {step === 'importing' && renderImporting()}
        {step === 'results' && renderResults()}
      </div>
    </div>
  );
}
