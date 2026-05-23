import { Link } from 'react-router-dom';
import { Home, ArrowLeft } from 'lucide-react';
import { Button } from '../components/shared';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center">
        <h1 className="text-9xl font-bold text-gray-200">404</h1>
        <h2 className="text-2xl font-semibold text-gray-900 mt-4">Page not found</h2>
        <p className="text-gray-500 mt-2 max-w-md mx-auto">
          Sorry, we couldn't find the page you're looking for. It might have been moved or deleted.
        </p>
        <div className="flex items-center justify-center gap-4 mt-8">
          <Button variant="secondary" leftIcon={<ArrowLeft size={18} />} onClick={() => window.history.back()}>
            Go Back
          </Button>
          <Link to="/">
            <Button leftIcon={<Home size={18} />}>Back to Home</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
