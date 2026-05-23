import { useState } from 'react';
import { Plus, X, FileText, Clock, Wrench, Paperclip } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

const ticketDetailActions = [
  { icon: FileText, label: 'Add Note', action: 'note', color: 'bg-blue-500' },
  { icon: Clock, label: 'Log Time', action: 'time', color: 'bg-green-500' },
  { icon: Wrench, label: 'Add Material', action: 'material', color: 'bg-orange-500' },
  { icon: Paperclip, label: 'Attach File', action: 'attachment', color: 'bg-purple-500' },
];

export default function FAB({ onAction }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Check if we're on a ticket detail page
  const isTicketDetail = /^\/tickets\/[^/]+$/.test(location.pathname) &&
    !location.pathname.endsWith('/new');

  const handleMainClick = () => {
    if (isTicketDetail) {
      setIsExpanded(!isExpanded);
    } else {
      navigate('/tickets/new');
    }
  };

  const handleActionClick = (action) => {
    setIsExpanded(false);
    if (onAction) {
      onAction(action);
    }
  };

  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 z-40 flex flex-col items-end gap-3">
      {/* Action buttons - only show on ticket detail when expanded */}
      {isTicketDetail && isExpanded && (
        <div className="flex flex-col gap-2 animate-fadeIn">
          {ticketDetailActions.map((item, index) => (
            <button
              key={item.action}
              onClick={() => handleActionClick(item.action)}
              className={`flex items-center gap-2 pl-3 pr-4 py-2 rounded-full shadow-lg text-white ${item.color} hover:opacity-90 transition-all`}
              style={{
                animationDelay: `${index * 50}ms`,
                animation: 'slideUp 0.2s ease-out forwards',
              }}
            >
              <item.icon size={18} />
              <span className="text-sm font-medium whitespace-nowrap">{item.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Main FAB button */}
      <button
        onClick={handleMainClick}
        className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white transition-all duration-200 ${
          isExpanded ? 'bg-gray-600 rotate-45' : 'bg-primary hover:bg-primary/90'
        }`}
        aria-label={isExpanded ? 'Close menu' : isTicketDetail ? 'Open quick actions' : 'Create new ticket'}
      >
        {isExpanded ? <X size={24} /> : <Plus size={24} />}
      </button>

      {/* Backdrop when expanded */}
      {isExpanded && (
        <div
          className="fixed inset-0 -z-10"
          onClick={() => setIsExpanded(false)}
        />
      )}
    </div>
  );
}
