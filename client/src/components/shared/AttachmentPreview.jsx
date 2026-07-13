import { useState, useEffect, useCallback } from 'react';
import { Download, X, AlertCircle, FileText, Image as ImageIcon, Eye, FileIcon as FilePdfIcon } from 'lucide-react';
import client from '../../api/client';
import Spinner from './Spinner';

/**
 * Determines if a file is an image based on mimetype or filename extension
 */
function isImageFile(attachment) {
  // Check mimetype first
  if (attachment.mimeType?.startsWith('image/')) {
    return true;
  }
  // Fallback to extension check
  const ext = attachment.filename?.toLowerCase().split('.').pop();
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext);
}

/**
 * Determines if a file is a PDF based on mimetype or filename extension
 */
function isPdfFile(attachment) {
  if (attachment.mimeType === 'application/pdf') {
    return true;
  }
  const ext = attachment.filename?.toLowerCase().split('.').pop();
  return ext === 'pdf';
}

/**
 * Get file icon based on type
 */
function getFileIcon(attachment) {
  if (isImageFile(attachment)) {
    return ImageIcon;
  }
  if (isPdfFile(attachment)) {
    return FilePdfIcon;
  }
  return FileText;
}

/**
 * AttachmentPreview component - fetches attachments via authenticated axios client
 * and displays them appropriately (inline preview for images, download link for others)
 */
export default function AttachmentPreview({ attachment }) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // PDF preview loading state
  const [previewing, setPreviewing] = useState(false);

  const isImage = isImageFile(attachment);
  const isPdf = isPdfFile(attachment);

  // Fetch the attachment blob on mount - ONLY for images (thumbnails need eager loading)
  useEffect(() => {
    if (!isImage) {
      // Non-images don't fetch on mount - they fetch lazily on download click
      return;
    }

    let cancelled = false;
    let objectUrl = null;

    const fetchAttachment = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await client.get(`/api/attachments/${attachment.id}/download`, {
          responseType: 'blob',
        });

        if (cancelled) return;

        objectUrl = URL.createObjectURL(response.data);
        setBlobUrl(objectUrl);
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to fetch attachment:', err);
        setError(err.response?.data?.error || 'Failed to load attachment');
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchAttachment();

    // Cleanup: revoke object URL when unmounting or when attachment changes
    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [attachment.id, isImage]);

  // Handle image load error - show error state instead of broken image
  const handleImageError = useCallback(() => {
    setError('Failed to display image');
  }, []);

  // Handle file download - for images uses existing blob, for non-images fetches first
  const handleDownload = useCallback(async () => {
    // If we already have the blob (images), use it directly
    if (blobUrl) {
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = attachment.filename || 'download';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }

    // For non-images: fetch the blob on demand
    try {
      setDownloading(true);
      setError(null);

      const response = await client.get(`/api/attachments/${attachment.id}/download`, {
        responseType: 'blob',
      });

      const objectUrl = URL.createObjectURL(response.data);

      // Trigger download
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = attachment.filename || 'download';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // Clean up immediately after download triggers
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      console.error('Failed to download attachment:', err);
      setError(err.response?.data?.error || 'Failed to download');
    } finally {
      setDownloading(false);
    }
  }, [blobUrl, attachment.id, attachment.filename]);

  // Open lightbox for images
  const openLightbox = useCallback(() => {
    if (isImage && blobUrl) {
      setLightboxOpen(true);
    }
  }, [isImage, blobUrl]);

  // Close lightbox
  const closeLightbox = useCallback(() => {
    setLightboxOpen(false);
  }, []);

  // PDF preview handler - get signed URL and navigate to it in current tab
  const handlePdfPreview = useCallback(async () => {
    try {
      setPreviewing(true);
      setError(null);

      // Request a short-lived signed preview URL
      const response = await client.get(`/api/attachments/${attachment.id}/preview-url`);

      // Navigate to the signed URL in the current tab
      // User will use browser back button to return
      window.location.href = response.data.url;
    } catch (err) {
      console.error('Failed to get preview URL:', err);
      setError(err.response?.data?.error || 'Failed to preview PDF');
      setPreviewing(false);
    }
    // Note: setPreviewing(false) not called on success because we're navigating away
  }, [attachment.id]);

  // Handle escape key for lightbox (image only)
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && lightboxOpen) {
        closeLightbox();
      }
    };

    if (lightboxOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [lightboxOpen, closeLightbox]);

  // Loading state
  if (loading) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg text-sm text-gray-500 min-h-[44px]">
        <Spinner size="sm" />
        <span className="truncate max-w-[180px]">{attachment.filename}</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-2 bg-red-50 rounded-lg text-sm text-red-600 min-h-[44px]">
        <AlertCircle size={16} />
        <span className="truncate max-w-[180px]" title={error}>
          {attachment.filename}
        </span>
      </div>
    );
  }

  // Image attachment with thumbnail
  if (isImage && blobUrl) {
    return (
      <>
        <button
          onClick={openLightbox}
          className="group relative inline-flex items-center gap-2 bg-gray-100 rounded-lg overflow-hidden hover:bg-gray-200 transition-colors min-h-[44px] min-w-[44px] touch-manipulation focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          title={`View ${attachment.filename}`}
        >
          <img
            src={blobUrl}
            alt={attachment.filename}
            className="h-16 w-auto max-w-[120px] object-cover rounded-lg"
            onError={handleImageError}
          />
          <span className="sr-only">View {attachment.filename}</span>
        </button>

        {/* Lightbox modal */}
        {lightboxOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/90 animate-fadeIn"
              onClick={closeLightbox}
            />

            {/* Close button */}
            <button
              onClick={closeLightbox}
              className="absolute top-4 right-4 z-10 p-3 bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center touch-manipulation"
              aria-label="Close"
            >
              <X size={24} />
            </button>

            {/* Download button */}
            <button
              onClick={handleDownload}
              className="absolute top-4 right-20 z-10 p-3 bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center touch-manipulation"
              aria-label="Download"
            >
              <Download size={24} />
            </button>

            {/* Full-size image */}
            <div className="relative z-10 max-w-[90vw] max-h-[90vh] animate-fadeIn">
              <img
                src={blobUrl}
                alt={attachment.filename}
                className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                onError={handleImageError}
              />
              <p className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-center py-2 px-4 text-sm truncate rounded-b-lg">
                {attachment.filename}
              </p>
            </div>
          </div>
        )}
      </>
    );
  }

  // PDF attachment with preview and download buttons
  if (isPdf) {
    return (
      <div className="inline-flex items-center gap-1 bg-gray-100 rounded-lg text-sm text-gray-700 min-h-[44px]">
        {/* Preview button - navigates to native PDF viewer */}
        <button
          onClick={handlePdfPreview}
          disabled={previewing}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 hover:bg-gray-200 rounded-l-lg transition-colors min-h-[44px] touch-manipulation focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-60 disabled:cursor-wait"
          title={previewing ? 'Loading...' : `Preview ${attachment.filename}`}
        >
          {previewing ? (
            <Spinner size="sm" />
          ) : (
            <Eye size={14} />
          )}
          <span className="truncate max-w-[150px]">{attachment.filename}</span>
        </button>

        {/* Download button */}
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="inline-flex items-center justify-center px-2 py-1.5 hover:bg-gray-200 rounded-r-lg transition-colors min-h-[44px] min-w-[44px] touch-manipulation focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-60 disabled:cursor-wait border-l border-gray-200"
          title={downloading ? 'Downloading...' : 'Download'}
        >
          {downloading ? (
            <Spinner size="sm" />
          ) : (
            <Download size={14} className="text-gray-500" />
          )}
        </button>
      </div>
    );
  }

  // Non-image, non-PDF attachment with download button
  const FileIcon = getFileIcon(attachment);
  return (
    <button
      onClick={handleDownload}
      disabled={downloading}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-lg text-sm text-gray-700 hover:bg-gray-200 transition-colors min-h-[44px] touch-manipulation focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-60 disabled:cursor-wait"
      title={downloading ? 'Downloading...' : `Download ${attachment.filename}`}
    >
      {downloading ? (
        <Spinner size="sm" />
      ) : (
        <FileIcon size={14} />
      )}
      <span className="truncate max-w-[200px]">{attachment.filename}</span>
      {!downloading && <Download size={14} className="text-gray-400 ml-1" />}
    </button>
  );
}

/**
 * AttachmentList component - renders a list of attachments with proper layout
 */
export function AttachmentList({ attachments, label = 'Attachments:' }) {
  if (!attachments?.length) return null;

  return (
    <div className="mt-3 pt-3 border-t border-gray-200">
      <p className="text-xs font-medium text-gray-500 mb-2">{label}</p>
      <div className="flex flex-wrap gap-2">
        {attachments.map((att) => (
          <AttachmentPreview key={att.id} attachment={att} />
        ))}
      </div>
    </div>
  );
}
