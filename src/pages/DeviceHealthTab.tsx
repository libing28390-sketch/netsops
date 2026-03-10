import React from 'react';
import { Activity, AlertTriangle, Filter, ShieldCheck, Server } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Device, DeviceHealthHistoryResponse, DeviceHealthOverview } from '../types';
import { sectionHeaderRowClass, severityBadgeClass } from '../components/shared';

interface DeviceHealthTabProps {
  devices: Device[];
  overview: DeviceHealthOverview | null;
  language: string;
  onShowDetails: (device: Device) => void;
  onOpenMonitoring: () => void;
}

const statusToneMap: Record<string, string> = {
  healthy: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-700',
  critical: 'bg-red-100 text-red-700',
  unknown: 'bg-slate-100 text-slate-600',
};

const DeviceHealthTab: React.FC<DeviceHealthTabProps> = ({
  devices,
  overview,
  language,
  onShowDetails,
  onOpenMonitoring,
}) => {
  const isZh = language === 'zh';
  const [rangeHours, setRangeHours] = React.useState(24);
  const [history, setHistory] = React.useState<DeviceHealthHistoryResponse | null>(null);
  const [historyLoading, setHistoryLoading] = React.useState(false);
  const [siteFilter, setSiteFilter] = React.useState('all');
  const [roleFilter, setRoleFilter] = React.useState('all');
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [alertFilter, setAlertFilter] = React.useState('all');
  const [searchTerm, setSearchTerm] = React.useState('');

  React.useEffect(() => {
    let cancelled = false;
    const loadHistory = async () => {
      setHistoryLoading(true);
      try {
        const resp = await fetch(`/api/device-health/history?range_hours=${rangeHours}`);
        if (!resp.ok) return;
        const data = await resp.json() as DeviceHealthHistoryResponse;
        if (!cancelled) setHistory(data);
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    };

    loadHistory();
    const timer = window.setInterval(loadHistory, 60000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [rangeHours]);

  const summary = overview || {
    total_devices: devices.length,
    average_score: devices.length > 0 ? Number((devices.reduce((sum, item) => sum + Number(item.health_score || 0), 0) / devices.length).toFixed(1)) : 0,
    healthy: devices.filter((item) => item.health_status === 'healthy').length,
    warning: devices.filter((item) => item.health_status === 'warning').length,
    critical: devices.filter((item) => item.health_status === 'critical').length,
    unknown: devices.filter((item) => !item.health_status || item.health_status === 'unknown').length,
    top_risky_devices: [],
  };

  const riskyDevices = (overview?.top_risky_devices?.length ? overview.top_risky_devices : [...devices]
    .sort((a, b) => {
      const rank = (value?: string) => value === 'critical' ? 0 : value === 'warning' ? 1 : value === 'unknown' ? 2 : 3;
      return rank(a.health_status) - rank(b.health_status) || Number(a.health_score || 0) - Number(b.health_score || 0) || Number(b.open_alert_count || 0) - Number(a.open_alert_count || 0);
    })
    .slice(0, 8));

  const siteOptions = React.useMemo<string[]>(
    () => Array.from(new Set<string>(devices.map((item) => String(item.site || '').trim()).filter((value): value is string => Boolean(value)))).sort((a, b) => a.localeCompare(b)),
    [devices],
  );
  const roleOptions = React.useMemo<string[]>(
    () => Array.from(new Set<string>(devices.map((item) => String(item.role || '').trim()).filter((value): value is string => Boolean(value)))).sort((a, b) => a.localeCompare(b)),
    [devices],
  );
  const filteredDevices = React.useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    return devices.filter((device) => {
      if (siteFilter !== 'all' && (device.site || '') !== siteFilter) return false;
      if (roleFilter !== 'all' && (device.role || '') !== roleFilter) return false;
      if (statusFilter !== 'all' && (device.health_status || 'unknown') !== statusFilter) return false;
      if (alertFilter === 'open' && Number(device.open_alert_count || 0) <= 0) return false;
      if (alertFilter === 'critical' && Number(device.critical_open_alerts || 0) <= 0) return false;
      if (alertFilter === 'interface' && (Number(device.interface_down_count || 0) + Number(device.interface_flap_count || 0) + Number(device.interface_error_count || 0)) <= 0) return false;
      if (!keyword) return true;
      const haystack = [device.hostname, device.ip_address, device.platform, device.site, device.role, device.health_summary]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(keyword);
    });
  }, [alertFilter, devices, roleFilter, searchTerm, siteFilter, statusFilter]);
  const filteredSummary = React.useMemo(() => ({
    total: filteredDevices.length,
    healthy: filteredDevices.filter((item) => item.health_status === 'healthy').length,
    warning: filteredDevices.filter((item) => item.health_status === 'warning').length,
    critical: filteredDevices.filter((item) => item.health_status === 'critical').length,
    unknown: filteredDevices.filter((item) => item.health_status === 'unknown' || !item.health_status).length,
  }), [filteredDevices]);
  const filteredRiskyDevices = React.useMemo(
    () => [...filteredDevices].sort((a, b) => {
      const rank = (value?: string) => value === 'critical' ? 0 : value === 'warning' ? 1 : value === 'unknown' ? 2 : 3;
      return rank(a.health_status) - rank(b.health_status) || Number(a.health_score || 0) - Number(b.health_score || 0) || Number(b.open_alert_count || 0) - Number(a.open_alert_count || 0);
    }).slice(0, 8),
    [filteredDevices],
  );
  const fleetRows = React.useMemo(
    () => [...filteredDevices].sort((a, b) => Number(a.health_score || 0) - Number(b.health_score || 0) || String(a.hostname || '').localeCompare(String(b.hostname || ''))),
    [filteredDevices],
  );
  const historySeries = history?.series || [];
  const hasActiveFilters = siteFilter !== 'all' || roleFilter !== 'all' || statusFilter !== 'all' || alertFilter !== 'all' || searchTerm.trim().length > 0;
  const displayedRiskyDevices = hasActiveFilters ? filteredRiskyDevices : riskyDevices;

  return (
    <div className="space-y-6">
      <div className={sectionHeaderRowClass}>
        <div>
          <h2 className="text-2xl font-medium tracking-tight">{isZh ? '健康检测中心' : 'Health Detection Center'}</h2>
          <p className="text-sm text-black/40">{isZh ? '把可达性、资源、硬件、接口异常和开放告警整合到统一健康模型，便于快速排障。' : 'Unify reachability, resource, hardware, interface anomalies, and open alerts into one health model for fast triage.'}</p>
        </div>
        <button
          type="button"
          onClick={onOpenMonitoring}
          className="px-4 py-2 rounded-xl border border-black/10 text-sm font-medium hover:bg-black/5 transition-all"
          title={isZh ? '打开监控中心' : 'Open Monitoring Center'}
        >
          {isZh ? '打开监控中心' : 'Open Monitoring'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
        {[
          { label: isZh ? '设备总数' : 'Total Devices', value: summary.total_devices, icon: Server, tone: 'text-slate-700 bg-slate-100' },
          { label: isZh ? '平均健康分' : 'Average Score', value: summary.average_score, icon: Activity, tone: 'text-cyan-700 bg-cyan-100' },
          { label: isZh ? '健康' : 'Healthy', value: summary.healthy, icon: ShieldCheck, tone: 'text-emerald-700 bg-emerald-100' },
          { label: isZh ? '告警' : 'Warning', value: summary.warning, icon: AlertTriangle, tone: 'text-amber-700 bg-amber-100' },
          { label: isZh ? '严重' : 'Critical', value: summary.critical, icon: AlertTriangle, tone: 'text-red-700 bg-red-100' },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-2xl border border-black/5 shadow-sm p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-black/35">{card.label}</p>
              <span className={`inline-flex rounded-full p-2 ${card.tone}`}><card.icon size={14} /></span>
            </div>
            <p className="mt-2 text-3xl font-semibold text-[#00172D]">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-black/5 bg-white shadow-sm p-5 space-y-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-black/[0.04] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-black/45">
              <Filter size={12} />
              {isZh ? '筛选工作台' : 'Filter Workbench'}
            </div>
            <h3 className="mt-3 text-lg font-semibold text-[#0b2340]">{isZh ? '按站点、角色和风险聚焦设备' : 'Focus devices by site, role, and risk'}</h3>
            <p className="text-xs text-black/45">{isZh ? '筛选同时作用于高风险列表和健康清单，适合值班时快速收敛排障范围。' : 'Filters apply to both the priority list and the fleet inventory to narrow triage scope during operations.'}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-black/45">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">{isZh ? '命中设备' : 'Matched'} {filteredSummary.total}</span>
            <span className="rounded-full bg-red-100 px-2.5 py-1 font-semibold text-red-700">{isZh ? '严重' : 'Critical'} {filteredSummary.critical}</span>
            <span className="rounded-full bg-amber-100 px-2.5 py-1 font-semibold text-amber-700">{isZh ? '告警' : 'Warning'} {filteredSummary.warning}</span>
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-semibold text-emerald-700">{isZh ? '健康' : 'Healthy'} {filteredSummary.healthy}</span>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[1.2fr_repeat(4,minmax(0,0.9fr))] gap-3">
          <label className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-black/35">{isZh ? '搜索' : 'Search'}</span>
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={isZh ? '设备名 / IP / 平台 / 摘要' : 'Hostname / IP / platform / summary'}
              className="w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm outline-none transition-all focus:border-black/25 focus:ring-2 focus:ring-black/5"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-black/35">{isZh ? '站点' : 'Site'}</span>
            <select value={siteFilter} onChange={(event) => setSiteFilter(event.target.value)} className="w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm outline-none transition-all focus:border-black/25 focus:ring-2 focus:ring-black/5">
              <option value="all">{isZh ? '全部站点' : 'All sites'}</option>
              {siteOptions.map((site) => <option key={site} value={site}>{site}</option>)}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-black/35">{isZh ? '角色' : 'Role'}</span>
            <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} className="w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm outline-none transition-all focus:border-black/25 focus:ring-2 focus:ring-black/5">
              <option value="all">{isZh ? '全部角色' : 'All roles'}</option>
              {roleOptions.map((role) => <option key={role} value={role}>{role}</option>)}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-black/35">{isZh ? '健康状态' : 'Health status'}</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm outline-none transition-all focus:border-black/25 focus:ring-2 focus:ring-black/5">
              <option value="all">{isZh ? '全部状态' : 'All states'}</option>
              <option value="critical">{isZh ? '严重' : 'Critical'}</option>
              <option value="warning">{isZh ? '告警' : 'Warning'}</option>
              <option value="healthy">{isZh ? '健康' : 'Healthy'}</option>
              <option value="unknown">{isZh ? '未知' : 'Unknown'}</option>
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-black/35">{isZh ? '风险维度' : 'Risk focus'}</span>
            <select value={alertFilter} onChange={(event) => setAlertFilter(event.target.value)} className="w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm outline-none transition-all focus:border-black/25 focus:ring-2 focus:ring-black/5">
              <option value="all">{isZh ? '全部风险' : 'All risk types'}</option>
              <option value="open">{isZh ? '有开放告警' : 'Open alerts'}</option>
              <option value="critical">{isZh ? '有严重告警' : 'Critical alerts'}</option>
              <option value="interface">{isZh ? '接口风险' : 'Interface risk'}</option>
            </select>
          </label>
        </div>
        {hasActiveFilters && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-black/10 bg-black/[0.015] px-4 py-3 text-xs text-black/50">
            <span>{isZh ? '当前列表已按筛选条件收敛。' : 'The current lists are narrowed by the active filters.'}</span>
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setSiteFilter('all');
                setRoleFilter('all');
                setStatusFilter('all');
                setAlertFilter('all');
              }}
              className="rounded-lg border border-black/10 px-3 py-1.5 text-[11px] font-semibold text-black/60 transition-all hover:bg-black/[0.03]"
            >
              {isZh ? '清空筛选' : 'Clear filters'}
            </button>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-black/5 bg-white shadow-sm p-5 space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#0089ac]">{isZh ? '健康趋势' : 'Health Trend'}</p>
            <h3 className="mt-1 text-lg font-semibold text-[#0b2340]">{isZh ? '全网健康分演进' : 'Fleet Health Evolution'}</h3>
            <p className="text-xs text-black/45">{isZh ? '按采样点回看全网平均健康分和各健康等级设备数量。' : 'Review average fleet health score and health-state counts across sampling points.'}</p>
          </div>
          <div className="flex items-center gap-2">
            {[1, 24, 168].map((hours) => (
              <button
                key={hours}
                type="button"
                onClick={() => setRangeHours(hours)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-[0.14em] transition-all ${rangeHours === hours ? 'bg-black text-white' : 'border border-black/10 text-black/60 hover:bg-black/[0.03]'}`}
              >
                {hours === 1 ? (isZh ? '1 小时' : '1h') : hours === 24 ? (isZh ? '24 小时' : '24h') : (isZh ? '7 天' : '7d')}
              </button>
            ))}
            <span className="text-[11px] text-black/40">{historyLoading ? (isZh ? '加载中...' : 'Loading...') : `${history?.sample_count || 0} ${isZh ? '个样本' : 'samples'}`}</span>
          </div>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_0.85fr] gap-4">
          <div className="rounded-xl border border-black/8 bg-[linear-gradient(180deg,rgba(2,6,23,0.01),rgba(2,6,23,0.04))] p-4 h-[320px]">
            {historySeries.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={historySeries} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="#dbe4ee" />
                  <XAxis dataKey="ts" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#60748a' }} tickFormatter={(value) => new Date(String(value)).toLocaleString(isZh ? 'zh-CN' : 'en-US', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })} minTickGap={28} />
                  <YAxis yAxisId="score" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#60748a' }} domain={[0, 100]} width={36} />
                  <YAxis yAxisId="count" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#60748a' }} width={32} />
                  <Tooltip
                    contentStyle={{ borderRadius: 14, borderColor: '#d9e3ef', boxShadow: '0 18px 38px rgba(15,23,42,0.12)', padding: '14px 16px', background: 'rgba(255,255,255,0.96)' }}
                    labelFormatter={(value) => new Date(String(value)).toLocaleString(isZh ? 'zh-CN' : 'en-US', { hour12: false })}
                  />
                  <Area yAxisId="score" type="monotone" dataKey="average_score" name={isZh ? '平均健康分' : 'Average score'} stroke="#2563eb" fill="#2563eb1f" strokeWidth={2.1} isAnimationActive={false} />
                  <Area yAxisId="count" type="monotone" dataKey="critical" name={isZh ? '严重设备' : 'Critical devices'} stroke="#dc2626" fill="#dc262618" strokeWidth={1.8} isAnimationActive={false} />
                  <Area yAxisId="count" type="monotone" dataKey="warning" name={isZh ? '告警设备' : 'Warning devices'} stroke="#d97706" fill="#d9770612" strokeWidth={1.8} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-black/35">{isZh ? '当前还没有健康趋势样本。' : 'No health trend samples are available yet.'}</div>
            )}
          </div>
          <div className="space-y-3">
            {(historySeries.length > 0 ? [...historySeries].slice(-6).reverse() : []).map((point) => (
              <div key={point.ts} className="rounded-xl border border-black/8 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-black/35">{new Date(point.ts).toLocaleString(isZh ? 'zh-CN' : 'en-US', { hour12: false })}</p>
                    <p className="mt-1 text-lg font-semibold text-[#00172D]">{isZh ? '平均分' : 'Avg'} {point.average_score}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">{isZh ? `${point.total_devices} 台设备` : `${point.total_devices} devices`}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-bold uppercase">
                  <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-700">{isZh ? '健康' : 'Healthy'} {point.healthy}</span>
                  <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-700">{isZh ? '告警' : 'Warning'} {point.warning}</span>
                  <span className="rounded-full bg-red-100 px-2 py-1 text-red-700">{isZh ? '严重' : 'Critical'} {point.critical}</span>
                </div>
              </div>
            ))}
            {historySeries.length === 0 && (
              <div className="rounded-xl border border-dashed border-black/10 bg-black/[0.01] p-6 text-center text-sm text-black/40">
                {isZh ? '趋势样本将在健康采样器运行后自动出现。' : 'Trend samples will appear automatically after the health sampler runs.'}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_1.15fr] gap-4">
        <div className="rounded-2xl border border-black/5 bg-white shadow-sm p-5 space-y-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-red-600">{isZh ? '优先排障' : 'Priority Triage'}</p>
            <h3 className="mt-1 text-lg font-semibold text-[#0b2340]">{isZh ? '高风险设备' : 'High-Risk Devices'}</h3>
            <p className="text-xs text-black/45">{isZh ? '按健康等级、健康分和开放告警数排序，优先处理最需要关注的设备。' : 'Sorted by health level, score, and active alerts so the riskiest devices surface first.'}</p>
          </div>
          <div className="space-y-2">
            {displayedRiskyDevices.length > 0 ? displayedRiskyDevices.map((device) => (
              <button
                key={device.id}
                type="button"
                onClick={() => onShowDetails(device)}
                className="w-full rounded-xl border border-black/10 p-3 text-left transition-all hover:border-red-200 hover:bg-red-50/20"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#0b2340] truncate">{device.hostname || device.ip_address}</p>
                    <p className="mt-1 text-[11px] text-black/45 truncate">{[device.site, device.role, device.platform].filter(Boolean).join(' • ')}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold uppercase ${statusToneMap[device.health_status || 'unknown'] || statusToneMap.unknown}`}>
                      {device.health_status || 'unknown'}
                    </span>
                    <p className="mt-1 text-sm font-semibold text-[#00172D]">{isZh ? '评分' : 'Score'} {Number(device.health_score || 0)}</p>
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-black/55 line-clamp-2">{device.health_summary || (isZh ? '暂无健康摘要' : 'No health summary')}</p>
                <div className="mt-2 flex items-center gap-3 text-[11px] text-black/40">
                  <span>{isZh ? '开放告警' : 'Open alerts'} {Number(device.open_alert_count || 0)}</span>
                  <span>{isZh ? 'Down 接口' : 'Down links'} {Number(device.interface_down_count || 0)}</span>
                </div>
              </button>
            )) : (
              <div className="rounded-xl border border-dashed border-black/10 bg-black/[0.01] p-6 text-center text-sm text-black/40">
                {hasActiveFilters
                  ? (isZh ? '没有设备匹配当前筛选条件。' : 'No devices match the active filters.')
                  : (isZh ? '当前没有风险设备。' : 'No risky devices right now.')}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-black/5 bg-white shadow-sm p-5 space-y-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#0089ac]">{isZh ? '全网视图' : 'Fleet View'}</p>
            <h3 className="mt-1 text-lg font-semibold text-[#0b2340]">{isZh ? '设备健康清单' : 'Device Health Inventory'}</h3>
            <p className="text-xs text-black/45">{isZh ? '这里是健康检测的单独入口，适合按健康度进行设备排班和巡检。' : 'A dedicated health entry point for operator triage, scheduling, and health-based review.'}</p>
          </div>
          <div className="overflow-hidden rounded-xl border border-black/10">
            <div className="max-h-[620px] overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-black/[0.02] border-b border-black/5">
                  <tr>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-black/35">{isZh ? '设备' : 'Device'}</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-black/35">{isZh ? '健康状态' : 'Health'}</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-black/35">{isZh ? '评分' : 'Score'}</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-black/35">{isZh ? '开放告警' : 'Open Alerts'}</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-black/35">{isZh ? '摘要' : 'Summary'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {fleetRows.map((device) => (
                    <tr key={device.id} className="hover:bg-black/[0.01] cursor-pointer" onClick={() => onShowDetails(device)}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-[#0b2340]">{device.hostname || '-'}</div>
                        <div className="text-[11px] font-mono text-black/40">{device.ip_address || '-'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold uppercase ${statusToneMap[device.health_status || 'unknown'] || statusToneMap.unknown}`}>
                          {device.health_status || 'unknown'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-[#00172D]">{Number(device.health_score || 0)}</td>
                      <td className="px-4 py-3">
                        <span className={severityBadgeClass(Number(device.open_alert_count || 0) > 0 ? (Number(device.critical_open_alerts || 0) > 0 ? 'critical' : 'warning') : 'minor')}>
                          {Number(device.open_alert_count || 0)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[12px] text-black/55 max-w-[320px] truncate" title={device.health_summary || ''}>{device.health_summary || '-'}</td>
                    </tr>
                  ))}
                  {fleetRows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-sm text-black/40">
                        {isZh ? '当前没有可展示的健康检测结果。' : 'No device health results are available yet.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeviceHealthTab;