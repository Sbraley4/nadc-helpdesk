import { forwardRef } from 'react';

const Textarea = forwardRef(
  ({ label, error, helperText, className = '', rows = 4, ...props }, ref) => {
    return (
      <div className={className}>
        {label && (
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        <textarea
          ref={ref}
          rows={rows}
          className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none ${
            error
              ? 'border-red-300 focus:ring-red-100 focus:border-red-500'
              : 'border-gray-300'
          } ${props.disabled ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}
          {...props}
        />
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
        {helperText && !error && (
          <p className="mt-1 text-sm text-gray-500">{helperText}</p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

export default Textarea;
