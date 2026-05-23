import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ThumbsUp,
  ThumbsDown,
  Meh,
  Star,
  TrendingUp,
  TrendingDown,
  Calendar,
  User,
  MessageSquare,
  ExternalLink,
} from 'lucide-react';
import { satisfaction, agents } from '../api';
import { Spinner, Badge, Avatar, Select, Pagination } from '../components/shared';

const ratingIcons = {
  POSITIVE: { icon: ThumbsUp, color: 'text-green-500', bg: 'bg-green-100' },
  NEUTRAL: { icon: Meh, color: 'text-yellow-500', bg: 'bg-yellow-100' },
  NEGATIVE: { icon: ThumbsDown, color: 'text-red-500', bg: 'bg-red-100' },
};

export default function SatisfactionPage() {
  const navigate = useNavigate();
  const [ratings, setRatings] = useState([]);
  const [agentsList, setAgentsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState('');
  const [dateRange, setDateRange] = useState('30'); // days
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
      setTotalPages(ratingsData.pagination?.totalPages || 1);
      setAgentsList(agentsData.agents || []);
    } catch (error) {
      console.error('Failed to fetch satisfaction data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate statistics
  const stats = useMemo(() => {
    const total = ratings.length;
    const positive = ratings.filter((r) => r.rating === 'POSITIVE').length;
    const neutral = ratings.filter((r) => r.rating === 'NEUTRAL').length;
    const negative = ratings.filter((r) => r.rating === 'NEGATIVE').length;
    const withComments = ratings.filter((r) => r.comment).length;
    const redirectedToGoogle = ratings.filter((r) => r.redirectedToGoogle).length;

    const satisfactionScore = total > 0 ? Math.round((positive / total) * 100) : 0;

    return {
      total,
      positive,
      neutral,
      negative,
      withComments,
      redirectedToGoogle,
      satisfactionScore,
    };
  }, [ratings]);

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

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
          <p className="text-sm text-gray-500 mt-1">Track customer feedback and ratings</p>
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
        {/* Overall Score */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Satisfaction Score</p>
              <p className="text-3xl font-bold text-gray-900">{stats.satisfactionScore}%</p>
            </div>
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center ${
                stats.satisfactionScore >= 80
                  ? 'bg-green-100'
                  : stats.satisfactionScore >= 60
                  ? 'bg-yellow-100'
                  : 'bg-red-100'
              }`}
            >
              {stats.satisfactionScore >= 80 ? (
                <TrendingUp className="text-green-500" size={24} />
              ) : stats.satisfactionScore >= 60 ? (
                <Meh className="text-yellow-500" size={24} />
              ) : (
                <TrendingDown className="text-red-500" size={24} />
              )}
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">Based on {stats.total} responses</p>
        </div>

        {/* Rating Breakdown */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500 mb-3">Rating Breakdown</p>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <ThumbsUp size={16} className="text-green-500" />
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full"
                  style={{ width: stats.total > 0 ? `${(stats.positive / stats.total) * 100}%` : '0%' }}
                />
              </div>
              <span className="text-sm font-medium w-8 text-right">{stats.positive}</span>
            </div>
            <div className="flex items-center gap-2">
              <Meh size={16} className="text-yellow-500" />
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-yellow-500 rounded-full"
                  style={{ width: stats.total > 0 ? `${(stats.neutral / stats.total) * 100}%` : '0%' }}
                />
              </div>
              <span className="text-sm font-medium w-8 text-right">{stats.neutral}</span>
            </div>
            <div className="flex items-center gap-2">
              <ThumbsDown size={16} className="text-red-500" />
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-500 rounded-full"
                  style={{ width: stats.total > 0 ? `${(stats.negative / stats.total) * 100}%` : '0%' }}
                />
              </div>
              <span className="text-sm font-medium w-8 text-right">{stats.negative}</span>
            </div>
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
            {stats.total > 0 ? Math.round((stats.withComments / stats.total) * 100) : 0}% response rate
          </p>
        </div>

        {/* Google Reviews */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Google Redirects</p>
              <p className="text-3xl font-bold text-gray-900">{stats.redirectedToGoogle}</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
              <Star className="text-purple-500" size={24} />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">Positive ratings sent to Google</p>
        </div>
      </div>

      {/* Ratings List */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-medium text-gray-900">Recent Feedback</h3>
        </div>

        {ratings.length === 0 ? (
          <div className="text-center py-12">
            <ThumbsUp size={48} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No ratings yet</h3>
            <p className="text-gray-500 mt-1">Customer feedback will appear here</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {ratings.map((rating) => {
              const RatingIcon = ratingIcons[rating.rating]?.icon || Meh;
              const iconColor = ratingIcons[rating.rating]?.color || 'text-gray-500';
              const iconBg = ratingIcons[rating.rating]?.bg || 'bg-gray-100';

              return (
                <div key={rating.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-full ${iconBg} flex items-center justify-center flex-shrink-0`}>
                      <RatingIcon size={20} className={iconColor} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => navigate(`/tickets/${rating.ticketId}`)}
                          className="font-medium text-primary hover:underline"
                        >
                          Ticket #{rating.ticketId}
                        </button>
                        <Badge
                          variant={
                            rating.rating === 'POSITIVE'
                              ? 'success'
                              : rating.rating === 'NEGATIVE'
                              ? 'danger'
                              : 'warning'
                          }
                        >
                          {rating.rating}
                        </Badge>
                        {rating.redirectedToGoogle && (
                          <Badge variant="secondary">
                            <ExternalLink size={10} className="mr-1" />
                            Google
                          </Badge>
                        )}
                      </div>

                      {rating.comment && (
                        <p className="text-gray-700 mt-2">{rating.comment}</p>
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
                          {formatDate(rating.createdAt)}
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
