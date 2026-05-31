import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, Send, HelpCircle, AlertTriangle, Bug, Lightbulb } from 'lucide-react';
import toast from 'react-hot-toast';
import { portalTickets } from '../../api/portal';

const ticketTypes = [
  { value: 'QUESTION', label: 'Question', icon: HelpCircle, description: 'General questions or help requests' },
  { value: 'INCIDENT', label: 'Incident', icon: AlertTriangle, description: 'Something is broken or not working' },
  { value: 'PROBLEM', label: 'Problem', icon: Bug, description: 'Recurring or underlying issues' },
  { value: 'FEATURE_REQUEST', label: 'Feature Request', icon: Lightbulb, description: 'Suggest new features or improvements' },
];

export default function PortalNewTicketPage() {
  const navigate = useNavigate();
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('QUESTION');

  const createMutation = useMutation({
    mutationFn: (data) => portalTickets.createTicket(data),
    onSuccess: (data) => {
      toast.success('Ticket submitted successfully!');
      navigate(`/portal/tickets/${data.id}`);
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to submit ticket'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!subject.trim()) {
      toast.error('Subject is required');
      return;
    }

    if (!description.trim()) {
      toast.error('Description is required');
      return;
    }

    createMutation.mutate({ subject: subject.trim(), description: description.trim(), type });
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Link to="/portal/tickets" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ArrowLeft size={16} />
        Back to tickets
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Submit a Support Ticket</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
        {/* Type selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            What type of request is this?
          </label>
          <div className="grid grid-cols-2 gap-3">
            {ticketTypes.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value)}
                  className={`p-4 rounded-lg border-2 text-left transition-colors ${
                    type === t.value
                      ? 'border-[#1B2A4A] bg-[#1B2A4A]/5'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon size={18} className={type === t.value ? 'text-[#1B2A4A]' : 'text-gray-400'} />
                    <span className={`font-medium ${type === t.value ? 'text-[#1B2A4A]' : 'text-gray-900'}`}>
                      {t.label}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">{t.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Subject */}
        <div>
          <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-1">
            Subject <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Brief summary of your issue"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#1B2A4A] focus:border-[#1B2A4A]"
            required
          />
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
            Description <span className="text-red-500">*</span>
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Please describe your issue in detail. Include any relevant information such as error messages, steps to reproduce, or what you were trying to accomplish."
            rows={8}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#1B2A4A] focus:border-[#1B2A4A] resize-none"
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            The more details you provide, the faster we can help you.
          </p>
        </div>

        {/* Tips */}
        <div className="bg-blue-50 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-2">Tips for faster resolution:</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>- Include any error messages you see</li>
            <li>- Describe what you were trying to do</li>
            <li>- Mention any recent changes that might be related</li>
            <li>- Include screenshots if possible (you can add them after submitting)</li>
          </ul>
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <Link
            to="/portal/tickets"
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors text-sm font-medium"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#1B2A4A] text-white rounded-lg hover:bg-[#152238] transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={16} />
            {createMutation.isPending ? 'Submitting...' : 'Submit Ticket'}
          </button>
        </div>
      </form>
    </div>
  );
}
