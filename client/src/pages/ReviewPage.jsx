import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Star, ExternalLink, CheckCircle, AlertCircle } from 'lucide-react';

// Google Business Review URL placeholder
const GOOGLE_BUSINESS_REVIEW_URL = 'PLACEHOLDER_GOOGLE_REVIEW_URL';

export default function ReviewPage() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [reviewData, setReviewData] = useState(null);
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState('');
  const [googleReviewUrl, setGoogleReviewUrl] = useState(GOOGLE_BUSINESS_REVIEW_URL);

  useEffect(() => {
    fetchReviewDetails();
  }, [token]);

  const fetchReviewDetails = async () => {
    try {
      const response = await fetch(`/api/satisfaction/review/${token}`);
      const data = await response.json();

      if (!response.ok) {
        if (data.error === 'already_rated') {
          setError('already_rated');
        } else {
          setError(data.error || 'Unable to load review request');
        }
        setLoading(false);
        return;
      }

      setReviewData(data);
      if (data.googleReviewUrl) {
        setGoogleReviewUrl(data.googleReviewUrl);
      }
      setLoading(false);
    } catch (err) {
      console.error('Error fetching review details:', err);
      setError('Unable to load review request');
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (rating === 0) {
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(`/api/satisfaction/review/${token}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rating,
          comment: comment.trim() || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error === 'already_rated') {
          setError('already_rated');
        } else {
          setError(data.error || 'Failed to submit review');
        }
        setSubmitting(false);
        return;
      }

      if (data.googleReviewUrl) {
        setGoogleReviewUrl(data.googleReviewUrl);
      }
      setSubmitted(true);
    } catch (err) {
      console.error('Error submitting review:', err);
      setError('Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-sm p-8 max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1B2A4A] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Already rated state
  if (error === 'already_rated') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-sm p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">
            Already Submitted
          </h1>
          <p className="text-gray-600">
            You have already submitted feedback for this ticket. Thank you!
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-sm p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">
            Oops!
          </h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  // Success state
  if (submitted) {
    const isGoogleUrlValid = googleReviewUrl && googleReviewUrl !== GOOGLE_BUSINESS_REVIEW_URL;

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-sm p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">
            Thank You!
          </h1>
          <p className="text-gray-600 mb-6">
            We appreciate you taking the time to share your feedback. It helps us improve our service!
          </p>

          {isGoogleUrlValid && (
            <div className="border-t border-gray-200 pt-6 mt-6">
              <p className="text-gray-700 mb-4">
                If you had a great experience, we'd love for you to share it on Google too!
              </p>
              <a
                href={googleReviewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#1B2A4A] text-white font-semibold rounded-lg hover:bg-[#2d3f5e] transition-colors"
              >
                <Star className="w-5 h-5" />
                Leave a Google Review
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Review form
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-sm p-8 max-w-lg w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">
            How did we do?
          </h1>
          <p className="text-gray-600">
            Hi {reviewData?.contactName || 'there'}! We'd love to hear your feedback about your recent support experience.
          </p>
          {reviewData?.ticketSubject && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Regarding:</p>
              <p className="font-medium text-gray-900">
                Ticket #{reviewData.ticketNumber}: {reviewData.ticketSubject}
              </p>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          {/* Star Rating */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3 text-center">
              Rate your experience
            </label>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  className="p-1 focus:outline-none focus:ring-2 focus:ring-yellow-400 rounded transition-transform hover:scale-110"
                  aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
                >
                  <Star
                    className={`w-10 h-10 transition-colors ${
                      star <= (hoveredRating || rating)
                        ? 'text-yellow-400 fill-yellow-400'
                        : 'text-gray-300'
                    }`}
                  />
                </button>
              ))}
            </div>
            {rating > 0 && (
              <p className="text-center mt-2 text-sm text-gray-600">
                {rating === 1 && 'Poor'}
                {rating === 2 && 'Fair'}
                {rating === 3 && 'Good'}
                {rating === 4 && 'Very Good'}
                {rating === 5 && 'Excellent'}
              </p>
            )}
          </div>

          {/* Comment */}
          <div className="mb-6">
            <label htmlFor="comment" className="block text-sm font-medium text-gray-700 mb-2">
              Tell us more (optional)
            </label>
            <textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Share your thoughts about your experience..."
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1B2A4A] focus:border-[#1B2A4A] resize-none"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={rating === 0 || submitting}
            className={`w-full py-3 px-4 rounded-lg font-semibold transition-colors ${
              rating === 0
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                : 'bg-[#1B2A4A] text-white hover:bg-[#2d3f5e]'
            }`}
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Submitting...
              </span>
            ) : (
              'Submit Feedback'
            )}
          </button>

          {rating === 0 && (
            <p className="text-center mt-3 text-sm text-gray-500">
              Please select a star rating to continue
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
