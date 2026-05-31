import { forwardRef, useEffect, useRef, useCallback } from 'react';

const Textarea = forwardRef(
  ({ label, error, helperText, className = '', rows = 4, minHeight, autoGrow, onChange, ...props }, ref) => {
    const internalRef = useRef(null);
    const textareaRef = ref || internalRef;

    const adjustHeight = useCallback(() => {
      const textarea = typeof textareaRef === 'function' ? null : textareaRef?.current;
      if (textarea && autoGrow) {
        textarea.style.height = 'auto';
        const newHeight = Math.max(textarea.scrollHeight, minHeight || 0);
        textarea.style.height = newHeight + 'px';
      }
    }, [autoGrow, minHeight, textareaRef]);

    useEffect(() => {
      adjustHeight();
    }, [props.value, adjustHeight]);

    const handleChange = (e) => {
      if (onChange) onChange(e);
      if (autoGrow) adjustHeight();
    };

    return (
      <div className={className}>
        {label && (
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            {label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        <textarea
          ref={textareaRef}
          rows={rows}
          style={minHeight ? { minHeight: minHeight + 'px' } : undefined}
          className={`w-full px-3 py-2.5 text-base md:text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary touch-manipulation ${autoGrow ? 'resize-none overflow-hidden' : 'resize-none'} ${
            error
              ? 'border-red-300 focus:ring-red-100 focus:border-red-500'
              : 'border-gray-300'
          } ${props.disabled ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}
          onChange={handleChange}
          {...props}
        />
        {error && <p className="mt-1.5 text-sm text-red-600">{error}</p>}
        {helperText && !error && (
          <p className="mt-1.5 text-sm text-gray-500">{helperText}</p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

export default Textarea;
