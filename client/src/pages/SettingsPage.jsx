import { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Star,
  Mail,
  Clock,
  Save,
  ExternalLink,
  Info,
  Check,
  Send,
  Inbox,
  AlertCircle,
  RotateCcw,
  Eye,
  FileText,
} from 'lucide-react';
import { settings, businessHours as businessHoursApi } from '../api';
import client from '../api/client';
import { Button, Spinner, Input, Textarea, Modal } from '../components/shared';

const DAYS_OF_WEEK = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
];

const EMAIL_TEMPLATES = [
  { id: 'ticket-created', label: 'Ticket Created', description: 'Sent when a new ticket is created' },
  { id: 'ticket-reply', label: 'Ticket Reply', description: 'Sent when an agent replies to a ticket' },
  { id: 'ticket-resolved', label: 'Ticket Resolved', description: 'Sent when a ticket is resolved' },
  { id: 'satisfaction-survey', label: 'Satisfaction Survey', description: 'Sent to collect customer feedback' },
];

const settingGroups = [
  {
    id: 'general',
    title: 'General Settings',
    icon: SettingsIcon,
    description: 'General application settings',
    settings: [
      {
        key: 'company_name',
        label: 'Company Name',
        type: 'text',
        placeholder: 'Your Company Name',
        description: 'Your company name for branding',
      },
      {
        key: 'default_priority',
        label: 'Default Ticket Priority',
        type: 'select',
        options: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
        description: 'Default priority for new tickets',
      },
      {
        key: 'default_type',
        label: 'Default Ticket Type',
        type: 'select',
        options: ['QUESTION', 'INCIDENT', 'PROBLEM', 'TASK'],
        description: 'Default type for new tickets',
      },
      {
        key: 'auto_close_days',
        label: 'Auto-Close Days',
        type: 'number',
        placeholder: '7',
        description: 'Days of inactivity before resolved tickets auto-close (0 to disable)',
      },
    ],
  },
  {
    id: 'business_hours',
    title: 'Business Hours',
    icon: Clock,
    description: 'Configure your support hours for SLA calculations',
    isCustom: true,
  },
  {
    id: 'email_smtp',
    title: 'Outbound Email (SMTP)',
    icon: Send,
    description: 'Configure SMTP for sending emails to customers',
    settings: [
      {
        key: 'smtp_host',
        label: 'SMTP Host',
        type: 'text',
        placeholder: 'smtp.example.com',
        description: 'SMTP server hostname',
      },
      {
        key: 'smtp_port',
        label: 'SMTP Port',
        type: 'number',
        placeholder: '587',
        description: 'SMTP server port (usually 587 for TLS, 465 for SSL)',
      },
      {
        key: 'smtp_secure',
        label: 'Use SSL/TLS',
        type: 'toggle',
        description: 'Enable secure connection (required for port 465)',
      },
      {
        key: 'smtp_user',
        label: 'Username',
        type: 'text',
        placeholder: 'your@email.com',
        description: 'SMTP authentication username',
      },
      {
        key: 'smtp_pass',
        label: 'Password',
        type: 'password',
        placeholder: '••••••••',
        description: 'SMTP authentication password',
      },
      {
        key: 'smtp_from',
        label: 'From Address',
        type: 'text',
        placeholder: 'helpdesk@yourcompany.com',
        description: 'Email address to send emails from',
      },
    ],
  },
  {
    id: 'email_imap',
    title: 'Inbound Email (IMAP)',
    icon: Inbox,
    description: 'Configure IMAP to receive emails and convert them to tickets',
    settings: [
      {
        key: 'imap_enabled',
        label: 'Enable IMAP Email-to-Ticket',
        type: 'toggle',
        description: 'Automatically create tickets from incoming emails',
      },
      {
        key: 'imap_host',
        label: 'IMAP Host',
        type: 'text',
        placeholder: 'imap.example.com',
        description: 'IMAP server hostname',
      },
      {
        key: 'imap_port',
        label: 'IMAP Port',
        type: 'number',
        placeholder: '993',
        description: 'IMAP server port (usually 993 for SSL)',
      },
      {
        key: 'imap_user',
        label: 'Username',
        type: 'text',
        placeholder: 'support@yourcompany.com',
        description: 'IMAP authentication username',
      },
      {
        key: 'imap_pass',
        label: 'Password',
        type: 'password',
        placeholder: '••••••••',
        description: 'IMAP authentication password',
      },
    ],
  },
  {
    id: 'email_templates',
    title: 'Email Templates',
    icon: FileText,
    description: 'Preview email templates used for notifications',
    isCustom: true,
  },
  {
    id: 'google_reviews',
    title: 'Google Reviews',
    icon: Star,
    description: 'Configure Google review integration to boost your online reputation',
    settings: [
      {
        key: 'google_review_enabled',
        label: 'Enable Google Review Requests',
        type: 'toggle',
        description: 'Automatically prompt satisfied customers to leave a Google review',
      },
      {
        key: 'google_review_url',
        label: 'Google Review URL',
        type: 'text',
        placeholder: 'https://g.page/r/YOUR_PLACE_ID/review',
        description: 'Direct link to your Google review page',
      },
      {
        key: 'review_send_delay_hours',
        label: 'Delay (Hours)',
        type: 'number',
        placeholder: '24',
        description: 'Hours to wait after ticket closure before sending review request',
      },
      {
        key: 'review_cooldown_days',
        label: 'Cooldown (Days)',
        type: 'number',
        placeholder: '30',
        description: 'Minimum days between review requests to the same contact',
      },
    ],
  },
  {
    id: 'satisfaction',
    title: 'Satisfaction Surveys',
    icon: Mail,
    description: 'Configure customer satisfaction survey settings',
    settings: [
      {
        key: 'satisfaction_enabled',
        label: 'Enable Satisfaction Surveys',
        type: 'toggle',
        description: 'Send satisfaction surveys after ticket resolution',
      },
    ],
  },
];

export default function SettingsPage() {
  const [settingsData, setSettingsData] = useState({});
  const [businessHours, setBusinessHours] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');
  const [activeGroup, setActiveGroup] = useState('general');
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [testingImap, setTestingImap] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [resetting, setResetting] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [templateHtml, setTemplateHtml] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [settingsRes, hoursRes] = await Promise.all([
        settings.getSettingsFull(),
        businessHoursApi.getBusinessHours().catch(() => ({ hours: {} })),
      ]);

      const settingsObj = {};
      (settingsRes.settings || []).forEach((s) => {
        settingsObj[s.key] = s.value;
      });
      setSettingsData(settingsObj);
      setBusinessHours(hoursRes.hours || getDefaultBusinessHours());
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDefaultBusinessHours = () => ({
    monday: { enabled: true, start: '09:00', end: '17:00' },
    tuesday: { enabled: true, start: '09:00', end: '17:00' },
    wednesday: { enabled: true, start: '09:00', end: '17:00' },
    thursday: { enabled: true, start: '09:00', end: '17:00' },
    friday: { enabled: true, start: '09:00', end: '17:00' },
    saturday: { enabled: false, start: '09:00', end: '17:00' },
    sunday: { enabled: false, start: '09:00', end: '17:00' },
  });

  const handleChange = (key, value) => {
    setSettingsData((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleBusinessHoursChange = (day, field, value) => {
    setBusinessHours((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value,
      },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setSavedMessage('');

    try {
      await Promise.all([
        settings.updateSettings(settingsData),
        businessHoursApi.updateBusinessHours(businessHours),
      ]);
      setSavedMessage('Settings saved successfully');
      setTimeout(() => setSavedMessage(''), 3000);
    } catch (error) {
      console.error('Failed to save settings:', error);
      setSavedMessage('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Are you sure you want to reset all settings to defaults? This cannot be undone.')) {
      return;
    }

    setResetting(true);
    try {
      const response = await client.post('/api/settings/reset');
      setSettingsData(response.data);
      setBusinessHours(getDefaultBusinessHours());
      setSavedMessage('Settings reset to defaults');
      setTimeout(() => setSavedMessage(''), 3000);
    } catch (error) {
      console.error('Failed to reset settings:', error);
      setSavedMessage('Failed to reset settings');
    } finally {
      setResetting(false);
    }
  };

  const handlePreviewTemplate = async (templateId) => {
    setPreviewTemplate(templateId);
    setLoadingPreview(true);
    setTemplateHtml('');

    try {
      const response = await client.get('/api/settings/email-preview', {
        params: { template: templateId },
      });
      setTemplateHtml(response.data.html);
    } catch (error) {
      setTemplateHtml('<div style="color: red; padding: 20px;">Template not found or error loading preview.</div>');
    } finally {
      setLoadingPreview(false);
    }
  };

  const renderSettingInput = (setting) => {
    const value = settingsData[setting.key] || '';

    switch (setting.type) {
      case 'toggle':
        return (
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={value === 'true' || value === true}
              onChange={(e) => handleChange(setting.key, e.target.checked.toString())}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
          </label>
        );

      case 'textarea':
        return (
          <Textarea
            value={value}
            onChange={(e) => handleChange(setting.key, e.target.value)}
            placeholder={setting.placeholder}
            rows={4}
          />
        );

      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => handleChange(setting.key, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            <option value="">Select...</option>
            {setting.options?.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        );

      case 'number':
        return (
          <Input
            type="number"
            value={value}
            onChange={(e) => handleChange(setting.key, e.target.value)}
            placeholder={setting.placeholder}
            min={0}
          />
        );

      case 'password':
        return (
          <Input
            type="password"
            value={value}
            onChange={(e) => handleChange(setting.key, e.target.value)}
            placeholder={setting.placeholder}
            autoComplete="new-password"
          />
        );

      default:
        return (
          <Input
            value={value}
            onChange={(e) => handleChange(setting.key, e.target.value)}
            placeholder={setting.placeholder}
          />
        );
    }
  };

  const renderBusinessHoursSection = () => (
    <div className="space-y-4">
      {DAYS_OF_WEEK.map(({ key, label }) => {
        const day = businessHours[key] || { enabled: false, start: '09:00', end: '17:00' };
        return (
          <div key={key} className="flex items-center gap-4">
            <div className="w-28">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={day.enabled}
                  onChange={(e) => handleBusinessHoursChange(key, 'enabled', e.target.checked)}
                  className="rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span className="text-sm font-medium text-gray-700">{label}</span>
              </label>
            </div>
            {day.enabled && (
              <>
                <Input
                  type="time"
                  value={day.start}
                  onChange={(e) => handleBusinessHoursChange(key, 'start', e.target.value)}
                  className="w-32"
                />
                <span className="text-gray-500">to</span>
                <Input
                  type="time"
                  value={day.end}
                  onChange={(e) => handleBusinessHoursChange(key, 'end', e.target.value)}
                  className="w-32"
                />
              </>
            )}
            {!day.enabled && (
              <span className="text-sm text-gray-400">Closed</span>
            )}
          </div>
        );
      })}
      <p className="text-xs text-gray-500 flex items-start gap-1 mt-4">
        <Info size={12} className="mt-0.5 flex-shrink-0" />
        Business hours are used for SLA calculations. Ticket response times are only counted during business hours.
      </p>
    </div>
  );

  const renderEmailTemplatesSection = () => (
    <div className="space-y-3">
      {EMAIL_TEMPLATES.map((template) => (
        <div
          key={template.id}
          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
        >
          <div>
            <div className="font-medium text-gray-900 text-sm">{template.label}</div>
            <div className="text-xs text-gray-500">{template.description}</div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePreviewTemplate(template.id)}
          >
            <Eye size={14} className="mr-1" />
            Preview
          </Button>
        </div>
      ))}
      <p className="text-xs text-gray-500 flex items-start gap-1 mt-4">
        <Info size={12} className="mt-0.5 flex-shrink-0" />
        Email templates are stored on the server. Contact your administrator to customize them.
      </p>
    </div>
  );

  const handleTestSmtp = async () => {
    setTestingSmtp(true);
    setTestResult(null);
    try {
      const response = await client.post('/api/settings/test-email');
      setTestResult({
        type: 'success',
        message: response.data.message || 'Test email sent successfully!',
      });
    } catch (error) {
      setTestResult({
        type: 'error',
        message: error.response?.data?.error || 'Failed to send test email',
      });
    } finally {
      setTestingSmtp(false);
    }
  };

  const handleTestImap = async () => {
    setTestingImap(true);
    setTestResult(null);
    try {
      const response = await client.post('/api/settings/test-imap');
      setTestResult({
        type: 'success',
        message: response.data.message || 'IMAP connection successful!',
      });
    } catch (error) {
      setTestResult({
        type: 'error',
        message: error.response?.data?.error || 'Failed to connect to IMAP',
      });
    } finally {
      setTestingImap(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Settings</h2>
          <p className="text-sm text-gray-500 mt-1">Configure your helpdesk preferences</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleReset} disabled={resetting}>
            {resetting ? <Spinner size="sm" /> : <RotateCcw size={16} className="mr-1" />}
            Reset Defaults
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Spinner size="sm" />
            ) : savedMessage ? (
              <>
                <Check size={18} className="mr-1" />
                Saved
              </>
            ) : (
              <>
                <Save size={18} className="mr-1" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>

      {savedMessage && (
        <div
          className={`p-3 rounded-lg text-sm ${
            savedMessage.includes('success') || savedMessage.includes('reset')
              ? 'bg-green-100 text-green-800'
              : 'bg-red-100 text-red-800'
          }`}
        >
          {savedMessage}
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar Navigation */}
        <nav className="md:w-56 flex-shrink-0">
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {settingGroups.map((group) => {
              const Icon = group.icon;
              return (
                <button
                  key={group.id}
                  onClick={() => setActiveGroup(group.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                    activeGroup === group.id
                      ? 'bg-primary/10 text-primary border-l-2 border-primary'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Icon size={18} />
                  <span className="text-sm font-medium">{group.title}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* Settings Content */}
        <div className="flex-1">
          {settingGroups.map((group) => {
            if (group.id !== activeGroup) return null;
            const Icon = group.icon;

            return (
              <div key={group.id} className="bg-white rounded-lg border border-gray-200">
                <div className="p-4 border-b border-gray-200">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Icon size={20} className="text-primary" />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">{group.title}</h3>
                      <p className="text-sm text-gray-500">{group.description}</p>
                    </div>
                  </div>
                </div>

                <div className="p-4 space-y-6">
                  {/* Custom sections */}
                  {group.id === 'business_hours' && renderBusinessHoursSection()}
                  {group.id === 'email_templates' && renderEmailTemplatesSection()}

                  {/* Standard settings */}
                  {group.settings?.map((setting) => (
                    <div key={setting.key}>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-gray-700">
                          {setting.label}
                        </label>
                        {setting.type === 'toggle' && renderSettingInput(setting)}
                      </div>
                      {setting.description && (
                        <p className="text-xs text-gray-500 mb-2 flex items-start gap-1">
                          <Info size={12} className="mt-0.5 flex-shrink-0" />
                          {setting.description}
                        </p>
                      )}
                      {setting.type !== 'toggle' && renderSettingInput(setting)}
                    </div>
                  ))}
                </div>

                {/* SMTP Test Button */}
                {group.id === 'email_smtp' && (
                  <div className="p-4 border-t border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">Test SMTP Connection</h4>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Send a test email to verify your SMTP settings
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        onClick={handleTestSmtp}
                        disabled={testingSmtp}
                      >
                        {testingSmtp ? <Spinner size="sm" /> : <Send size={16} className="mr-1" />}
                        {testingSmtp ? 'Testing...' : 'Send Test Email'}
                      </Button>
                    </div>
                    {testResult && activeGroup === 'email_smtp' && (
                      <div
                        className={`mt-3 p-3 rounded-lg text-sm flex items-start gap-2 ${
                          testResult.type === 'success'
                            ? 'bg-green-50 text-green-800'
                            : 'bg-red-50 text-red-800'
                        }`}
                      >
                        {testResult.type === 'success' ? (
                          <Check size={16} className="flex-shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                        )}
                        {testResult.message}
                      </div>
                    )}
                  </div>
                )}

                {/* IMAP Test Button */}
                {group.id === 'email_imap' && (
                  <div className="p-4 border-t border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">Test IMAP Connection</h4>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Verify your IMAP settings and connection
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        onClick={handleTestImap}
                        disabled={testingImap}
                      >
                        {testingImap ? <Spinner size="sm" /> : <Inbox size={16} className="mr-1" />}
                        {testingImap ? 'Testing...' : 'Test Connection'}
                      </Button>
                    </div>
                    {testResult && activeGroup === 'email_imap' && (
                      <div
                        className={`mt-3 p-3 rounded-lg text-sm flex items-start gap-2 ${
                          testResult.type === 'success'
                            ? 'bg-green-50 text-green-800'
                            : 'bg-red-50 text-red-800'
                        }`}
                      >
                        {testResult.type === 'success' ? (
                          <Check size={16} className="flex-shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                        )}
                        {testResult.message}
                      </div>
                    )}
                  </div>
                )}

                {/* Google Review Setup Instructions */}
                {group.id === 'google_reviews' && (
                  <div className="p-4 bg-blue-50 border-t border-blue-100">
                    <h4 className="text-sm font-medium text-blue-900 mb-2">
                      How to get your Google Review URL
                    </h4>
                    <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                      <li>Go to your Google Business Profile</li>
                      <li>Click "Share review form" or "Get more reviews"</li>
                      <li>Copy the link provided</li>
                      <li>Paste it in the Google Review URL field above</li>
                    </ol>
                    <a
                      href="https://business.google.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-3 text-sm text-blue-600 hover:underline"
                    >
                      Open Google Business
                      <ExternalLink size={14} />
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Email Template Preview Modal */}
      <Modal
        isOpen={!!previewTemplate}
        onClose={() => setPreviewTemplate(null)}
        title={`Email Template Preview: ${EMAIL_TEMPLATES.find(t => t.id === previewTemplate)?.label || ''}`}
        size="lg"
      >
        {loadingPreview ? (
          <div className="flex items-center justify-center py-10">
            <Spinner size="lg" />
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <div
              className="p-4 bg-white"
              dangerouslySetInnerHTML={{ __html: templateHtml }}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
