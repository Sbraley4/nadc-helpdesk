import { Link } from 'react-router-dom';
import { Construction } from 'lucide-react';

/**
 * Temporary placeholder page while the client portal is disabled.
 * Remove this file and restore App.jsx portal routes when ready to re-enable.
 */
export default function PortalComingSoonPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="bg-white rounded-xl shadow-lg p-8">
          {/* Header */}
          <div className="bg-[#1B2A4A] text-white py-4 px-6 rounded-lg mb-6 -mt-12 mx-4 shadow-md">
            <h1 className="text-xl font-bold">NADC Support Portal</h1>
          </div>

          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="bg-amber-100 p-4 rounded-full">
              <Construction className="w-12 h-12 text-amber-600" />
            </div>
          </div>

          {/* Message */}
          <h2 className="text-2xl font-semibold text-gray-900 mb-3">
            Coming Soon
          </h2>
          <p className="text-gray-600 mb-6">
            The customer portal is currently under maintenance and will be available soon.
            In the meantime, please contact our support team directly for assistance.
          </p>

          {/* Contact info */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-600">
              Need help? Email us at{' '}
              <a
                href="mailto:support@nadc.com"
                className="text-[#1B2A4A] font-medium hover:underline"
              >
                support@nadc.com
              </a>
            </p>
          </div>

          {/* Staff login link */}
          <p className="text-sm text-gray-500">
            Staff member?{' '}
            <Link to="/login" className="text-[#1B2A4A] font-medium hover:underline">
              Log in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
