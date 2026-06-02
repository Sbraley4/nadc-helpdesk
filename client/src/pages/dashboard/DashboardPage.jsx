import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
  Ticket, Clock, CheckCircle, ThumbsUp, AlertTriangle,
  PlusCircle, Package, Building2, Activity
} from 'lucide-react';
import { dashboard } from '../../api';
import { Avatar, Badge } from '../../components/shared';

const COLORS = {
  primary: '#1B2A4A',
  success: '#15803D',
  open: '#3B82F6',
  pending: '#F59E0B',
  resolved: '#10B981',
  closed: '#6B7280',
};

function StatCard({ icon: Icon, label, value, subtext, color = 'blue', onClick }) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
  };

  return (
    <div
      className={`bg-white rounded-lg shadow p-3 md:p-4 touch-manipulation ${onClick ? 'cursor-pointer hover:shadow-md active:bg-gray-50 transition-all' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs md:text-sm text-gray-500 truncate">{label}</p>
          <p className="text-xl md:text-2xl font-bold mt-0.5 md:mt-1">{value}</p>
          {subtext && <p className="text-xs text-gray-400 mt-0.5 md:mt-1 truncate">{subtext}</p>}
        </div>
        <div className={`p-2 rounded-lg flex-shrink-0 ${colorClasses[color]}`}>
          <Icon className="w-4 h-4 md:w-5 md:h-5" />
        </div>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-lg shadow p-4 animate-pulse">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="h-4 bg-gray-200 rounded w-20 mb-2" />
          <div className="h-8 bg-gray-200 rounded w-16" />
        </div>
        <div className="w-10 h-10 bg-gray-200 rounded-lg" />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [trendPeriod, setTrendPeriod] = useState('30d');

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => dashboard.getStats(),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const { data: trends } = useQuery({
    queryKey: ['dashboard-trends', trendPeriod],
    queryFn: () => dashboard.getTrends(trendPeriod),
    staleTime: 5 * 60 * 1000,
  });

  if (statsLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="p-4 md:p-6">
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <h2 className="text-xl font-semibold mb-2">Welcome to NADC Helpdesk!</h2>
          <p className="text-gray-500 mb-4">Create your first ticket to get started.</p>
          <Link to="/tickets/new" className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg">
            <PlusCircle className="w-4 h-4" /> New Ticket
          </Link>
        </div>
      </div>
    );
  }

  const statusData = stats.ticketsByStatus || [];
  const priorityData = stats.ticketsByPriority || [];

  return (
    <div className="p-4 md:p-6 space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard icon={Ticket} label="Open Tickets" value={stats.ticketCounts?.open || 0}
          subtext={stats.ticketCounts?.overdue > 0 ? `${stats.ticketCounts.overdue} overdue` : null} color="blue"
          onClick={() => navigate('/tickets?status=OPEN')} />
        <StatCard icon={Clock} label="Avg Response Time" value={stats.avgResponseTime?.formatted || '—'}
          subtext="last 30 days" color="green" />
        <StatCard icon={CheckCircle} label="Avg Resolution Time" value={stats.avgResolutionTime?.formatted || '—'}
          subtext="last 30 days" color="purple" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Created vs Resolved</h3>
            <div className="flex gap-1">
              {['7d', '30d', '90d'].map((p) => (
                <button key={p} onClick={() => setTrendPeriod(p)}
                  className={`px-2 py-1 text-xs rounded ${trendPeriod === p ? 'bg-primary text-white' : 'bg-gray-100'}`}>
                  {p}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={trends?.createdVsResolved || stats.createdVsResolved || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="created" stroke={COLORS.primary} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="resolved" stroke={COLORS.success} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-semibold mb-4">Tickets by Status</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={statusData} dataKey="count" nameKey="status" cx="50%" cy="50%" innerRadius={50} outerRadius={70}>
                {statusData.map((entry, i) => (
                  <Cell key={i} fill={COLORS[entry.status.toLowerCase()] || COLORS.closed} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="text-center text-2xl font-bold">{stats.ticketCounts?.total || 0}</div>
          <div className="text-center text-xs text-gray-500">Total Tickets</div>
        </div>
      </div>

      {/* Priority + Agent Workload */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-semibold mb-4">Tickets by Priority</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={priorityData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="priority" tick={{ fontSize: 10 }} width={60} />
              <Tooltip />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {priorityData.map((entry, i) => {
                  const colors = { LOW: '#6B7280', MEDIUM: '#3B82F6', HIGH: '#F59E0B', URGENT: '#EF4444' };
                  return <Cell key={i} fill={colors[entry.priority]} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="lg:col-span-2 bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 border-b"><h3 className="font-semibold">Agent Workload</h3></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-3">Agent</th>
                  <th className="text-center p-3">Open</th>
                  <th className="text-center p-3">Pending</th>
                  <th className="text-center p-3 hidden md:table-cell">Resolved</th>
                </tr>
              </thead>
              <tbody>
                {(stats.agentWorkload || []).map((agent) => (
                  <tr
                    key={agent.agentId}
                    className="border-t hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate(`/tickets?assigneeId=${agent.agentId}`)}
                  >
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <Avatar name={agent.agentName} size="sm" />
                        <span className="font-medium text-primary hover:underline">{agent.agentName}</span>
                      </div>
                    </td>
                    <td className="text-center p-3"><Badge variant="info">{agent.open}</Badge></td>
                    <td className="text-center p-3"><Badge variant="warning">{agent.pending}</Badge></td>
                    <td className="text-center p-3 hidden md:table-cell">{agent.resolvedThisMonth}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Recent Activity + Bottom Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-lg shadow">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="font-semibold">Recent Activity</h3>
            <Activity className="w-4 h-4 text-gray-400" />
          </div>
          <div className="divide-y max-h-80 overflow-y-auto">
            {(stats.recentActivity || []).map((activity) => (
              <div
                key={activity.id}
                className="p-4 flex items-start gap-3 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => navigate(`/tickets/${activity.ticketId}`)}
              >
                <Avatar name={activity.user?.name || 'System'} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg font-bold text-primary">#{activity.ticketNumber}</span>
                    <span className="text-sm text-gray-700 truncate">{activity.ticketSubject}</span>
                  </div>
                  <p className="text-sm text-gray-600">{activity.description}</p>
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap">{new Date(activity.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <StatCard icon={Clock} label="Time Logged (Month)" value={stats.timeTrackedThisMonth?.formatted || '0h'}
            subtext="across all tickets" color="blue" />
          <StatCard icon={Package} label="Materials (Month)" value={stats.materialsThisMonth?.formatted || '$0.00'}
            subtext="parts and expenses" color="purple" />
          <Link to="/tickets?slaBreached=true">
            <StatCard icon={AlertTriangle} label="SLA Breached" value={stats.ticketCounts?.slaBreached || 0}
              color={stats.ticketCounts?.slaBreached > 0 ? 'red' : 'green'} />
          </Link>
        </div>
      </div>
    </div>
  );
}
