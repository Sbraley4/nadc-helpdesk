import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Star,
  TrendingUp,
  TrendingDown,
  Calendar,
  User,
  MessageSquare,
} from 'lucide-react';
import { satisfaction, agents } from '../api';
import { Spinner, Avatar, Select, Pagination } from '../components/shared';

// Star rating display component
function StarRating({ rating, size = 16 }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={size}
          className={
            star <= rating
              ? 'text-yellow-400 fill-yellow-400'
              : 'text-gray-300'
          }
        />
      ))}
    </div>
  );
}

// Rating color helper
function getRatingColor(rating) {
  if (rating >= 4) return { bg: 'bg-green-100', text: 'text-green-600' };
  if (rating >= 3) return { bg: 'bg-yellow-100', text: 'text-yellow-600' };
  return { bg: 'bg-red-100', text: 'text-red-600' };
}

export default function SatisfactionPage() {
  const navigate = useNavigate();
  const [ratings, setRatings] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    averageRating: 0,
    distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    withComments: 0,
  });
  const [agentsList, setAgentsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState('');
  const [dateRange, setDateRange] = useState('30');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchData();
  }, [selectedAgent, dateRange, page]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(dateRange));

      const [ratingsData, agentsData] = await Promise.all([
        satisfaction.getRatings({
          agentId: selectedAgent || undefined,
          startDate: startDate.toISOString(),
          page,
          limit: 20,
        }),
        agents.getAgents(),
      ]);

      setRatings(ratingsData.ratings || []);
      setStats({
        total: ratingsData.total || 0,
        averageRating: ratingsData.averageRating || 0,
        distribution: ratingsData.distribution || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        withComments: ratingsData.withComments || 0,
      });
      setTotalPages(ratingsData.pagination?.totalPages || 1);
      setAgentsList(agentsData.agents || []);
    } catch (error) {
      console.error('Failed to fetch satisfaction data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Calculate satisfaction percentage (4-5 stars = satisfied)
  const satisfiedCount = stats.distribution[4] + stats.distribution[5];
  const satisfactionPercent = stats.total > 0 ? Math.round((satisfiedCount / stats.total) * 100) : 0;

  if (loading && ratings.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Customer Satisfaction</h2>
          <p className="text-sm text-gray-500 mt-1">Track customer feedback and star ratings</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Select
            value={selectedAgent}
            onChange={(e) => setSelectedAgent(e.target.value)}
            options={[
              { value: '', label: 'All Agents' },
              ...agentsList.map((a) => ({ value: a.id, label: a.name })),
            ]}
            className="w-full sm:w-40"
          />

          <Select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            options={[
              { value: '7', label: 'Last 7 days' },
              { value: '30', label: 'Last 30 days' },
              { value: '90', label: 'Last 90 days' },
              { value: '365', label: 'Last year' },
            ]}
            className="w-full sm:w-40"
          />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Average Rating */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Average Rating</p>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-3xl font-bold text-gray-900">{stats.averageRating}</p>
                <span className="text-gray-400">/5</span>
              </div>
            </div>
            <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center">
              <Star className="text-yellow-500 fill-yellow-500" size={24} />
            </div>
          </div>
          <div className="mt-2">
            <StarRating rating={Math.round(stats.averageRating)} size={14} />
          </div>
        </div>

        {/* Satisfaction Rate */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Satisfaction Rate</p>
              <p className="text-3xl font-bold text-gray-900">{satisfactionPercent}%</p>
            </div>
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center ${
                satisfactionPercent >= 80
                  ? 'bg-green-100'
                  : satisfactionPercent >= 60
                  ? 'bg-yellow-100'
                  : 'bg-red-100'
              }`}
            >
              {satisfactionPercent >= 60 ? (
                <TrendingUp
                  className={satisfactionPercent >= 80 ? 'text-green-500' : 'text-yellow-500'}
                  size={24}
                />
              ) : (
                <TrendingDown className="text-red-500" size={24} />
              )}
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">4-5 star ratings ({satisfiedCount} of {stats.total})</p>
        </div>

        {/* Rating Distribution */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500 mb-3">Rating Distribution</p>
          <div className="space-y-1.5">
            {[5, 4, 3, 2, 1].map((starNum) => (
              <div key={starNum} className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-3">{starNum}</span>
                <Star size={12} className="text-yellow-400 fill-yellow-400" />
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-yellow-400 rounded-full"
                    style={{
                      width: stats.total > 0
                        ? `${(stats.distribution[starNum] / stats.total) * 100}%`
                        : '0%',
                    }}
                  />
                </div>
                <span className="text-xs font-medium w-6 text-right text-gray-600">
                  {stats.distribution[starNum]}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Comments */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">With Comments</p>
              <p className="text-3xl font-bold text-gray-900">{stats.withComments}</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
              <MessageSquare className="text-blue-500" size={24} />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {stats.total > 0 ? Math.round((stats.withComments / stats.total) * 100) : 0}% comment rate
          </p>
        </div>
      </div>

      {/* Ratings List */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-medium text-gray-900">Recent Feedback</h3>
        </div>

        {ratings.length === 0 ? (
          <div className="text-center py-12">
            <Star size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No ratings yet</h3>
            <p className="text-gray-500 mt-1">Customer feedback will appear here</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {ratings.map((rating) => {
              const colors = getRatingColor(rating.rating);

              return (
                <div key={rating.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-start gap-4">
                    <div
                      className={`w-10 h-10 rounded-full ${colors.bg} flex items-center justify-center flex-shrink-0`}
                    >
                      <span className={`text-lg font-bold ${colors.text}`}>{rating.rating}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <button
                          onClick={() => navigate(`/tickets/${rating.ticketId}`)}
                          className="font-medium text-primary hover:underline"
                        >
                          Ticket #{rating.ticketNumber || rating.ticketId}
                        </button>
                        <StarRating rating={rating.rating} size={14} />
                      </div>

                      {rating.ticketSubject && (
                        <p className="text-sm text-gray-600 mt-1">{rating.ticketSubject}</p>
                      )}

                      {rating.comment && (
                        <p className="text-gray-700 mt-2 bg-gray-50 p-3 rounded-lg italic">
                          "{rating.comment}"
                        </p>
                      )}

                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                        {rating.contact && (
                          <div className="flex items-center gap-1">
                            <User size={14} />
                            {rating.contact.name}
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <Calendar size={14} />
                          {formatDate(rating.ratedAt)}
                        </div>
                        {rating.agent && (
                          <div className="flex items-center gap-1">
                            <Avatar name={rating.agent.name} size="xs" />
                            {rating.agent.name}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="p-4 border-t border-gray-200">
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        )}
      </div>
    </div>
  );
}
