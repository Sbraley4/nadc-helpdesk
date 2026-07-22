const variants = {
  // Status badges
  open: 'bg-blue-100 text-blue-800',
  pending: 'bg-gray-200 text-gray-700',
  working: 'bg-teal-100 text-teal-700',
  invoiced: 'bg-green-100 text-green-800',
  posted: 'bg-pink-100 text-pink-800',
  closed: 'bg-gray-100 text-gray-600',

  // Priority badges
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',

  // Generic badges
  default: 'bg-gray-100 text-gray-700',
  primary: 'bg-primary/10 text-primary',
  success: 'bg-green-100 text-green-700',
  warning: 'bg-yellow-100 text-yellow-700',
  danger: 'bg-red-100 text-red-700',
  info: 'bg-blue-100 text-blue-700',
};

const sizes = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
  lg: 'px-3 py-1.5 text-sm',
};

export default function Badge({
  children,
  variant = 'default',
  size = 'sm',
  className = '',
}) {
  return (
    <span
      className={`inline-flex items-center font-medium rounded-full ${variants[variant] || variants.default} ${sizes[size]} ${className}`}
    >
      {children}
    </span>
  );
}
