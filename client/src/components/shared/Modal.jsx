import { useEffect } from 'react';
import { X } from 'lucide-react';

const sizes = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-full mx-4',
};

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  showCloseButton = true,
  closeOnBackdrop = true,
  footer,
}) {
  // Handle escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity animate-fadeIn"
        onClick={closeOnBackdrop ? onClose : undefined}
      />

      {/* Modal container - centered on screen with proper scrolling */}
      <div className="min-h-full flex items-center justify-center p-4">
        <div
          className={`relative bg-white shadow-xl w-full ${sizes[size]} transform transition-all rounded-lg max-h-[calc(100vh-2rem)] flex flex-col animate-fadeIn`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Mobile drag handle */}
          <div className="md:hidden w-12 h-1.5 bg-gray-300 rounded-full mx-auto mt-3 mb-1" />

          {/* Header */}
          {(title || showCloseButton) && (
            <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-gray-200 flex-shrink-0">
              {title && (
                <h3 className="text-base md:text-lg font-semibold text-gray-900">{title}</h3>
              )}
              {showCloseButton && (
                <button
                  onClick={onClose}
                  className="p-2 -mr-2 text-gray-400 hover:text-gray-500 transition-colors touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-gray-100"
                >
                  <X size={20} />
                </button>
              )}
            </div>
          )}

          {/* Body - scrollable */}
          <div className="px-4 md:px-6 py-4 overflow-y-auto flex-1 overscroll-contain">{children}</div>

          {/* Footer */}
          {footer && (
            <div className="px-4 md:px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg flex-shrink-0 safe-bottom">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
