const sizes = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
  xl: 'w-12 h-12',
};

export default function Spinner({ size = 'md', className = '' }) {
  return (
    <div
      className={`${sizes[size]} animate-spin rounded-full border-2 border-gray-300 border-t-primary ${className}`}
      role="status"
      aria-label="Loading"
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
}

export function FullPageSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Spinner size="xl" />
    </div>
  );
}

export function CenteredSpinner({ size = 'lg' }) {
  return (
    <div className="flex items-center justify-center py-12">
      <Spinner size={size} />
    </div>
  );
}
