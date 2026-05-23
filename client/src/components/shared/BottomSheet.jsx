import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import Modal from './Modal';

export default function BottomSheet({ isOpen, onClose, title, children }) {
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768);
  const sheetRef = useRef(null);
  const startY = useRef(0);
  const currentY = useRef(0);

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (isOpen && !isDesktop) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, isDesktop]);

  // Handle touch drag to dismiss
  const handleTouchStart = (e) => {
    startY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e) => {
    currentY.current = e.touches[0].clientY;
    const deltaY = currentY.current - startY.current;

    if (deltaY > 0 && sheetRef.current) {
      sheetRef.current.style.transform = `translateY(${deltaY}px)`;
    }
  };

  const handleTouchEnd = () => {
    const deltaY = currentY.current - startY.current;

    if (deltaY > 100) {
      // Dismiss if dragged down more than 100px
      onClose();
    }

    if (sheetRef.current) {
      sheetRef.current.style.transform = '';
    }
  };

  // On desktop, render as a Modal instead
  if (isDesktop) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title={title}>
        {children}
      </Modal>
    );
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 animate-fadeIn"
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl animate-slideUp safe-bottom"
        style={{ maxHeight: '90vh' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag handle */}
        <div className="pt-3 pb-2">
          <div className="drag-handle" />
        </div>

        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-4 pb-3 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            <button
              onClick={onClose}
              className="p-2 -mr-2 text-gray-500 hover:text-gray-700 rounded-full hover:bg-gray-100"
            >
              <X size={20} />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="px-4 py-4 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 80px)' }}>
          {children}
        </div>
      </div>
    </div>
  );
}
