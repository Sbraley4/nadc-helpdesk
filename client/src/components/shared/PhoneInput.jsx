import { forwardRef, useCallback } from 'react';

/**
 * Format a phone number string to US format: (XXX) XXX-XXXX
 * @param {string} value - Raw or partially formatted phone number
 * @returns {string} Formatted phone number
 */
export function formatPhoneNumber(value) {
  // Remove all non-digit characters
  const digits = value.replace(/\D/g, '');

  // Limit to 10 digits
  const limited = digits.slice(0, 10);

  // Format based on length
  if (limited.length === 0) {
    return '';
  } else if (limited.length <= 3) {
    return `(${limited}`;
  } else if (limited.length <= 6) {
    return `(${limited.slice(0, 3)}) ${limited.slice(3)}`;
  } else {
    return `(${limited.slice(0, 3)}) ${limited.slice(3, 6)}-${limited.slice(6)}`;
  }
}

/**
 * Extract raw digits from a formatted phone number
 * @param {string} value - Formatted phone number
 * @returns {string} Raw digits only
 */
export function unformatPhoneNumber(value) {
  return value.replace(/\D/g, '');
}

const PhoneInput = forwardRef(
  (
    {
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      className = '',
      size = 'default',
      value = '',
      onChange,
      ...props
    },
    ref
  ) => {
    const sizeClasses = size === 'lg'
      ? 'px-4 py-3 text-base min-h-[48px]'
      : 'px-3 py-2.5 text-base md:text-sm min-h-[44px]';

    const handleChange = useCallback((e) => {
      const inputValue = e.target.value;
      const formatted = formatPhoneNumber(inputValue);

      // Create a synthetic event with the formatted value
      const syntheticEvent = {
        ...e,
        target: {
          ...e.target,
          value: formatted,
        },
      };

      if (onChange) {
        onChange(syntheticEvent);
      }
    }, [onChange]);

    // Format the initial/current value
    const displayValue = formatPhoneNumber(value);

    return (
      <div className={className}>
        {label && (
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            {label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            className={`w-full ${sizeClasses} border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary touch-manipulation ${
              error
                ? 'border-red-300 focus:ring-red-100 focus:border-red-500'
                : 'border-gray-300'
            } ${leftIcon ? 'pl-10' : ''} ${rightIcon ? 'pr-10' : ''} ${
              props.disabled ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''
            }`}
            value={displayValue}
            onChange={handleChange}
            placeholder="(555) 123-4567"
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              {rightIcon}
            </div>
          )}
        </div>
        {error && <p className="mt-1.5 text-sm text-red-600">{error}</p>}
        {helperText && !error && (
          <p className="mt-1.5 text-sm text-gray-500">{helperText}</p>
        )}
      </div>
    );
  }
);

PhoneInput.displayName = 'PhoneInput';

export default PhoneInput;
