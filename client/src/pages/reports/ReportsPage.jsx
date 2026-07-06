import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Download, FileText, Users, Clock, AlertTriangle, Package } from 'lucide-react';
import { reports, agents as agentsApi, companies as companiesApi } from '../../api';
import { Button, Spinner, Badge } from '../../components/shared';

const REPORT_TYPES = [
  { id: 'ticket-volume', label: 'Ticket Volume', icon: FileText },
  { id: 'agent-performance', label: 'Agent Performance', icon: Users },
  { id: 'sla-compliance', label: 'SLA Compliance', icon: AlertTriangle },
  { id: 'time-materials', label: 'Time & Materials', icon: Package },
];

const DATE_RANGES = [
  { id: 'last7', label: 'Last 7 days', getValue: () => ({ start: subDays(new Date(), 7), end: new Date() }) },
  { id: 'last30', label: 'Last 30 days', getValue: () => ({ start: subDays(new Date(), 30), end: new Date() }) },
  { id: 'last90', label: 'Last 90 days', getValue: () => ({ start: subDays(new Date(), 90), end: new Date() }) },
  { id: 'thisMonth', label: 'This month', getValue: () => ({ start: startOfMonth(new Date()), end: new Date() }) },
  { id: 'lastMonth', label: 'Last month', getValue: () => ({ start: startOfMonth(subMonths(new Date(), 1)), end: endOfMonth(subMonths(new Date(), 1)) }) },
];

export default function ReportsPage() {
  const [reportType, setReportType] = useState('ticket-volume');
  const [dateRange, setDateRange] = useState('last30');
  const [groupBy, setGroupBy] = useState('day');
  const [exporting, setExporting] = useState(false);

  const range = DATE_RANGES.find((r) => r.id === dateRange)?.getValue() || DATE_RANGES[1].getValue();
  const startDate = format(range.start, 'yyyy-MM-dd');
  const endDate = format(range.end, 'yyyy-MM-dd');

  const { data, isLoading } = useQuery({
    queryKey: ['report', reportType, startDate, endDate, groupBy],
    queryFn: () => {
      const params = { startDate, endDate };
      switch (reportType) {
        case 'ticket-volume': return reports.getTicketVolume({ ...params, groupBy });
        case 'agent-performance': return reports.getAgentPerformance(params);
        case 'sla-compliance': return reports.getSlaCompliance(params);
        case 'time-materials': return reports.getTimeMaterials(params);
        default: return null;
      }
    },
    staleTime: 60000,
  });

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await reports.exportCsv({ type: reportType, startDate, endDate, format: 'csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${reportType}-${startDate}-to-${endDate}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    }
    setExporting(false);
  };

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-56 bg-white border-r p-4 space-y-6 hidden md:block">
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Report Type</h3>
          <div className="space-y-1">
            {REPORT_TYPES.map((type) => (
              <button key={type.id} onClick={() => setReportType(type.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded text-sm ${reportType === type.id ? 'bg-primary text-white' : 'hover:bg-gray-100'}`}>
                <type.icon className="w-4 h-4" /> {type.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Date Range</h3>
          <select value={dateRange} onChange={(e) => setDateRange(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm">
            {DATE_RANGES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        </div>

        {reportType === 'ticket-volume' && (
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Group By</h3>
            <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm">
              <option value="day">Day</option>
              <option value="week">Week</option>
              <option value="month">Month</option>
            </select>
          </div>
        )}

        <Button onClick={handleExport} disabled={exporting || isLoading} className="w-full">
          <Download className="w-4 h-4 mr-2" /> {exporting ? 'Exporting...' : 'Export CSV'}
        </Button>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 md:p-6 overflow-auto">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">{REPORT_TYPES.find((t) => t.id === reportType)?.label} Report</h1>
          <span className="text-sm text-gray-500">{startDate} to {endDate}</span>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : reportType === 'ticket-volume' ? (
          <TicketVolumeReport data={data} />
        ) : reportType === 'agent-performance' ? (
          <AgentPerformanceReport data={data} />
        ) : reportType === 'sla-compliance' ? (
          <SlaComplianceReport data={data} />
        ) : reportType === 'time-materials' ? (
          <TimeMaterialsReport data={data} />
        ) : null}
      </div>
    </div>
  );
}

function TicketVolumeReport({ data }) {
  if (!data) return null;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <div className="text-3xl font-bold text-blue-600">{data.totals?.created || 0}</div>
          <div className="text-sm text-gray-500">Created</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <div className="text-3xl font-bold text-green-600">{data.totals?.resolved || 0}</div>
          <div className="text-sm text-gray-500">Resolved</div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="font-semibold mb-4">Ticket Volume Over Time</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data.data || []}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="created" stroke="#3B82F6" strokeWidth={2} />
            <Line type="monotone" dataKey="resolved" stroke="#10B981" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function AgentPerformanceReport({ data }) {
  if (!data) return null;
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="text-left p-3">Agent</th>
            <th className="text-center p-3">Assigned</th>
            <th className="text-center p-3">Invoiced</th>
            <th className="text-center p-3">Avg First Response</th>
            <th className="text-center p-3">Avg Resolution</th>
            <th className="text-center p-3">SLA %</th>
            <th className="text-center p-3">Hours</th>
          </tr>
        </thead>
        <tbody>
          {(data.agents || []).map((agent) => (
            <tr key={agent.agentId} className="border-t">
              <td className="p-3 font-medium">{agent.agentName}</td>
              <td className="text-center p-3">{agent.ticketsAssigned}</td>
              <td className="text-center p-3">{agent.ticketsInvoiced}</td>
              <td className="text-center p-3">{agent.avgFirstResponseHours ? `${agent.avgFirstResponseHours}h` : '—'}</td>
              <td className="text-center p-3">{agent.avgResolutionHours ? `${agent.avgResolutionHours}h` : '—'}</td>
              <td className="text-center p-3">
                <Badge variant={agent.slaCompliancePercent >= 90 ? 'success' : agent.slaCompliancePercent >= 60 ? 'warning' : 'error'}>
                  {agent.slaCompliancePercent}%
                </Badge>
              </td>
              <td className="text-center p-3">{agent.totalHoursLogged}h</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SlaComplianceReport({ data }) {
  if (!data) return null;
  const pieData = [
    { name: 'Compliant', value: data.overall?.compliant || 0, color: '#10B981' },
    { name: 'Breached', value: data.overall?.breached || 0, color: '#EF4444' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <div className={`text-5xl font-bold ${data.overall?.compliancePercent >= 90 ? 'text-green-600' : data.overall?.compliancePercent >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
            {data.overall?.compliancePercent || 0}%
          </div>
          <div className="text-gray-500 mt-2">Overall SLA Compliance</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <ResponsiveContainer width="100%" height={150}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={60}>
                {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="font-semibold mb-4">Compliance by Priority</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data.byPriority || []}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="priority" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="compliancePercent" fill="#3B82F6" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {data.breachedTickets?.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 border-b"><h3 className="font-semibold">Breached Tickets</h3></div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3">#</th>
                <th className="text-left p-3">Subject</th>
                <th className="text-center p-3">Priority</th>
                <th className="text-left p-3">Assignee</th>
              </tr>
            </thead>
            <tbody>
              {data.breachedTickets.map((t) => (
                <tr key={t.ticketId} className="border-t">
                  <td className="p-3">{t.ticketNumber}</td>
                  <td className="p-3">{t.subject}</td>
                  <td className="text-center p-3"><Badge variant={t.priority === 'URGENT' ? 'error' : 'warning'}>{t.priority}</Badge></td>
                  <td className="p-3">{t.assigneeName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TimeMaterialsReport({ data }) {
  if (!data) return null;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <div className="text-3xl font-bold text-blue-600">{data.timeEntries?.formatted || '0h'}</div>
          <div className="text-gray-500">Total Time</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <div className="text-3xl font-bold text-green-600">${data.materials?.totalCost?.toFixed(2) || '0.00'}</div>
          <div className="text-gray-500">Total Materials</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-semibold mb-4">Time by Agent</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.timeEntries?.byAgent || []} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis type="category" dataKey="agentName" width={100} />
              <Tooltip />
              <Bar dataKey="hours" fill="#3B82F6" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-semibold mb-4">Materials by Company</h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {(data.materials?.byCompany || []).map((c, i) => (
              <div key={i} className="flex justify-between p-2 bg-gray-50 rounded">
                <span>{c.companyName}</span>
                <span className="font-medium">${c.totalCost.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
