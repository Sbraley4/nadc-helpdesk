import { useState, useEffect, useCallback, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import Spinner from './Spinner';

// Configure PDF.js worker using LEGACY build for iOS Safari/WebKit compatibility
// The legacy build is transpiled to older ES spec which works better with WebKit's
// Web Worker implementation that has known issues with ES module workers
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

// Import react-pdf styles for proper text layer rendering
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// PDF.js options for broader compatibility (passed to Document component)
// isEvalSupported: false avoids eval() which can cause issues in strict CSP or some mobile browsers
const PDF_OPTIONS = {
  isEvalSupported: false,
};

/**
 * PdfViewer component - renders a PDF using react-pdf with fit-to-width behavior
 * Designed to be dynamically imported to avoid bundling PDF.js in the main chunk
 */
export default function PdfViewer({ file, filename }) {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [containerWidth, setContainerWidth] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(true);
  const [pdfError, setPdfError] = useState(null);
  const [debugInfo, setDebugInfo] = useState(null); // For capturing detailed error info
  const containerRef = useRef(null);

  // Set up global error handlers to catch worker errors that might not propagate to callbacks
  useEffect(() => {
    const handleError = (event) => {
      // Only capture if we're in loading state and error is PDF-related
      if (pdfLoading && event.message && (
        event.message.includes('pdf') ||
        event.message.includes('PDF') ||
        event.message.includes('worker') ||
        event.message.includes('Worker')
      )) {
        console.error('[PdfViewer] Global error caught:', event.message, event.filename, event.lineno);
        setDebugInfo(prev => prev ? `${prev}\nGlobal: ${event.message}` : `Global error: ${event.message}`);
      }
    };

    const handleUnhandledRejection = (event) => {
      if (pdfLoading) {
        const reason = event.reason?.message || String(event.reason);
        if (reason.includes('pdf') || reason.includes('PDF') || reason.includes('worker') || reason.includes('Worker')) {
          console.error('[PdfViewer] Unhandled rejection:', reason);
          setDebugInfo(prev => prev ? `${prev}\nRejection: ${reason}` : `Unhandled: ${reason}`);
        }
      }
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [pdfLoading]);

  // Measure container width for fit-to-width rendering
  const updateWidth = useCallback(() => {
    if (containerRef.current) {
      // Account for padding (16px on each side)
      const width = containerRef.current.clientWidth - 32;
      setContainerWidth(width > 0 ? width : null);
    }
  }, []);

  // Initial measurement and resize listener
  useEffect(() => {
    updateWidth();

    const handleResize = () => {
      updateWidth();
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [updateWidth]);

  // Handle successful document load
  const onDocumentLoadSuccess = useCallback(({ numPages: totalPages }) => {
    setNumPages(totalPages);
    setPageNumber(1);
    setPdfLoading(false);
    setPdfError(null);
  }, []);

  // Handle document load error - capture actual error message for debugging
  const onDocumentLoadError = useCallback((error) => {
    const errorMsg = error?.message || String(error);
    console.error('[PdfViewer] Document load error:', errorMsg, error);
    setPdfError(`Failed to load PDF: ${errorMsg}`);
    setDebugInfo(prev => prev ? `${prev}\nDoc: ${errorMsg}` : `Document error: ${errorMsg}`);
    setPdfLoading(false);
  }, []);

  // Handle page load error
  const onPageLoadError = useCallback((error) => {
    const errorMsg = error?.message || String(error);
    console.error('[PdfViewer] Page load error:', errorMsg, error);
    setPdfError(`Failed to load page: ${errorMsg}`);
    setDebugInfo(prev => prev ? `${prev}\nPage: ${errorMsg}` : `Page error: ${errorMsg}`);
  }, []);

  // Handle page render error - this is often where iOS issues manifest
  const onPageRenderError = useCallback((error) => {
    const errorMsg = error?.message || String(error);
    console.error('[PdfViewer] Page render error:', errorMsg, error);
    setPdfError(`Failed to render page: ${errorMsg}`);
    setDebugInfo(prev => prev ? `${prev}\nRender: ${errorMsg}` : `Render error: ${errorMsg}`);
  }, []);

  // Page navigation
  const goToPrevPage = useCallback(() => {
    setPageNumber((prev) => Math.max(prev - 1, 1));
  }, []);

  const goToNextPage = useCallback(() => {
    setPageNumber((prev) => Math.min(prev + 1, numPages || 1));
  }, [numPages]);

  // Error state - show detailed error info for debugging iOS issues
  if (pdfError) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-100 rounded-t-lg">
        <div className="text-center p-6 max-w-md">
          <AlertCircle className="mx-auto text-red-500 mb-3" size={48} />
          <p className="text-red-600 font-medium break-words">{pdfError}</p>
          <p className="text-gray-500 text-sm mt-1">The PDF could not be displayed</p>
          {/* Debug info for troubleshooting - shows raw error messages */}
          {debugInfo && (
            <details className="mt-4 text-left">
              <summary className="text-xs text-gray-400 cursor-pointer">Debug details</summary>
              <pre className="mt-2 text-xs bg-gray-200 p-2 rounded overflow-auto max-h-32 whitespace-pre-wrap break-all">
                {debugInfo}
              </pre>
            </details>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-gray-100 rounded-t-lg overflow-hidden">
      {/* PDF Document container */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto p-4 flex justify-center"
      >
        <Document
          file={file}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          options={PDF_OPTIONS}
          loading={
            <div className="flex items-center justify-center py-12">
              <Spinner size="lg" />
            </div>
          }
        >
          {containerWidth && (
            <Page
              pageNumber={pageNumber}
              width={containerWidth}
              loading={
                <div className="flex items-center justify-center py-12">
                  <Spinner size="md" />
                </div>
              }
              renderTextLayer={true}
              renderAnnotationLayer={true}
              onLoadError={onPageLoadError}
              onRenderError={onPageRenderError}
            />
          )}
        </Document>
      </div>

      {/* Page navigation - only show for multi-page PDFs */}
      {numPages && numPages > 1 && (
        <div className="flex items-center justify-center gap-4 py-3 px-4 bg-gray-200 border-t border-gray-300">
          <button
            onClick={goToPrevPage}
            disabled={pageNumber <= 1}
            className="p-2 rounded-full hover:bg-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center touch-manipulation"
            aria-label="Previous page"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="text-sm text-gray-700 min-w-[80px] text-center">
            {pageNumber} of {numPages}
          </span>
          <button
            onClick={goToNextPage}
            disabled={pageNumber >= numPages}
            className="p-2 rounded-full hover:bg-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center touch-manipulation"
            aria-label="Next page"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      )}

      {/* Filename footer */}
      <p className="bg-black/50 text-white text-center py-2 px-4 text-sm truncate rounded-b-lg">
        {filename}
      </p>
    </div>
  );
}
