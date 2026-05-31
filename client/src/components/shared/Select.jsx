import { forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';

const Select = forwardRef(
  (
    {
      label,
      options = [],
      placeholder = 'Select...',
      error,
      className = '',
      size = 'default', // 'default' | 'lg'
      ...props
    },
    ref
  ) => {
    const sizeClasses = size === 'lg'
      ? 'px-4 py-3 text-base min-h-[48px]'
      : 'px-3 py-2.5 text-base md:text-sm min-h-[44px]';

    return (
      <div className={className}>
        {label && (
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            className={`w-full appearance-none ${sizeClasses} pr-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white touch-manipulation ${
              error
                ? 'border-red-300 focus:ring-red-100 focus:border-red-500'
                : 'border-gray-300'
            } ${props.disabled ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown
            size={18}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
        </div>
        {error && <p className="mt-1.5 text-sm text-red-600">{error}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';

export default Select;
