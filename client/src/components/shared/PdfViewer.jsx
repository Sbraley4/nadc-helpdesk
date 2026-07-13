import { useState, useEffect, useCallback, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import Spinner from './Spinner';

// Configure PDF.js worker - must match the installed pdfjs-dist version (5.4.296)
// Worker file location: node_modules/pdfjs-dist/build/pdf.worker.min.mjs
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

// Import react-pdf styles for proper text layer rendering
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

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
  const containerRef = useRef(null);

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

  // Handle document load error
  const onDocumentLoadError = useCallback((error) => {
    console.error('Failed to load PDF:', error);
    setPdfError('Failed to parse PDF file');
    setPdfLoading(false);
  }, []);

  // Page navigation
  const goToPrevPage = useCallback(() => {
    setPageNumber((prev) => Math.max(prev - 1, 1));
  }, []);

  const goToNextPage = useCallback(() => {
    setPageNumber((prev) => Math.min(prev + 1, numPages || 1));
  }, [numPages]);

  // Error state
  if (pdfError) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-100 rounded-t-lg">
        <div className="text-center p-6">
          <AlertCircle className="mx-auto text-red-500 mb-3" size={48} />
          <p className="text-red-600 font-medium">{pdfError}</p>
          <p className="text-gray-500 text-sm mt-1">The PDF could not be displayed</p>
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
