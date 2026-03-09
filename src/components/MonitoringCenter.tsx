import React from 'react';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Brush, ReferenceArea } from 'recharts';
import type { HostResourceSnapshot, HostResourceHistoryPayload } from '../types';

type MonitorDevice = {
  id?: string;
  device_id?: string;
  hostname?: string;
  ip_address?: string;
  platform?: string;
  role?: string;
  site?: string;
};

interface MonitoringCenterProps {
  language: 'zh' | 'en';
  monitorSearch: string;
  setMonitorSearch: (value: string) => void;
  monitorSearchResults: any[];
  monitorSearching: boolean;
  monitorSelectedDevice: MonitorDevice | null;
  setMonitorSelectedDevice: (value: any) => void;
  monitorOverview: any | null;
  monitorRealtime: any | null;
  monitorTrend: any | null;
  monitorTrendInterface: string;
  setMonitorTrendInterface: (value: string) => void;
  monitorTrendResolution: '1m' | '5m';
  setMonitorTrendResolution: (value: '1m' | '5m') => void;
  monitorTrendStartInput: string;
  setMonitorTrendStartInput: (value: string) => void;
  monitorTrendEndInput: string;
  setMonitorTrendEndInput: (value: string) => void;
  monitorTrendRange: { start_time?: string; end_time?: string };
  setMonitorTrendRange: (value: { start_time?: string; end_time?: string }) => void;
  monitorTrendZoom: { startIndex: number; endIndex: number } | null;
  setMonitorTrendZoom: (value: { startIndex: number; endIndex: number } | null) => void;
  monitorTrendDragStart: number | null;
  setMonitorTrendDragStart: (value: number | null) => void;
  monitorTrendDragEnd: number | null;
  setMonitorTrendDragEnd: (value: number | null) => void;
  monitorTrendMetrics: string[];
  setMonitorTrendMetrics: React.Dispatch<React.SetStateAction<string[]>>;
  monitorTrendUiMode: 'pro' | 'compact';
  setMonitorTrendUiMode: (value: 'pro' | 'compact') => void;
  monitorAlerts: any[];
  monitorAlertTotal: number;
  monitorAlertsPage: number;
  setMonitorAlertsPage: (value: number) => void;
  monitorAlertsPageSize: number;
  monitorAlertsSeverity: string;
  setMonitorAlertsSeverity: (value: string) => void;
  monitorLoading: boolean;
  monitorPageVisible: boolean;
  monitorDashboardSiteFilter: string;
  setMonitorDashboardSiteFilter: (value: string) => void;
  monitorDashboardAlertFilter: 'all' | 'critical' | 'major';
  setMonitorDashboardAlertFilter: (value: 'all' | 'critical' | 'major') => void;
  hostResources: HostResourceSnapshot | null;
  fetchMonitoringOverview: () => void | Promise<void>;
  fetchMonitoringAlerts: () => void | Promise<void>;
  fetchMonitoringRealtime: (deviceId: string) => Promise<any>;
  fetchHostResources: () => void | Promise<void>;
  setMonitorRealtime: (value: any) => void;
  showToast: (message: string, type?: string) => void;
}

const sectionHeaderRowClass = 'flex justify-between items-end';

const buildPaginationItems = (currentPage: number, totalPages: number) => {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);

  const items: Array<number | string> = [1];
  const windowStart = Math.max(2, currentPage - 1);
  const windowEnd = Math.min(totalPages - 1, currentPage + 1);

  if (windowStart > 2) items.push('left-ellipsis');
  for (let page = windowStart; page <= windowEnd; page += 1) items.push(page);
  if (windowEnd < totalPages - 1) items.push('right-ellipsis');

  items.push(totalPages);
  return items;
};

const MonitoringPagination: React.FC<{
  language: 'zh' | 'en';
  currentPage: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  itemsPerPage?: number;
}> = ({ language, currentPage, totalItems, onPageChange, itemsPerPage = 10 }) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  if (totalItems === 0) return null;

  const startItem = Math.min((currentPage - 1) * itemsPerPage + 1, totalItems);
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);
  const progressPct = Math.max(0, Math.min(100, Math.round((endItem / totalItems) * 100)));
  const pageItems = buildPaginationItems(currentPage, totalPages);

  return (
    <div className="flex flex-col gap-3 px-6 py-4 bg-[linear-gradient(180deg,rgba(0,0,0,0.015),rgba(0,0,0,0.025))] border-t border-black/5 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-3">
          <progress
            value={progressPct}
            max={100}
            className="h-1.5 w-24 overflow-hidden rounded-full [appearance:none] [&::-moz-progress-bar]:bg-[#00bceb] [&::-webkit-progress-bar]:bg-black/6 [&::-webkit-progress-value]:bg-[#00bceb]"
          />
          <p className="text-[10px] font-bold uppercase text-black/40 tracking-widest">
            {language === 'zh' ? `第 ${startItem}-${endItem} 条 / 共 ${totalItems} 条` : `${startItem}-${endItem} / ${totalItems}`}
          </p>
        </div>
        <p className="mt-1 text-[11px] text-black/35">
          {language === 'zh' ? `第 ${currentPage} 页，共 ${totalPages} 页` : `Page ${currentPage} of ${totalPages}`}
        </p>
      </div>

      {totalPages > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={currentPage === 1}
            onClick={() => onPageChange(currentPage - 1)}
            title={language === 'zh' ? '上一页' : 'Previous page'}
            aria-label={language === 'zh' ? '上一页' : 'Previous page'}
            className="inline-flex h-9 items-center gap-1 rounded-xl border border-black/8 bg-white px-3 text-[11px] font-semibold text-black/55 shadow-sm transition-all hover:-translate-x-0.5 hover:border-black/15 hover:text-black disabled:opacity-25 disabled:hover:translate-x-0"
          >
            <ChevronLeft size={16} />
            <span>{language === 'zh' ? '上一页' : 'Prev'}</span>
          </button>
          <div className="flex items-center gap-1.5">
            {pageItems.map((item, index) => {
              if (typeof item !== 'number') {
                return <span key={`${item}-${index}`} className="px-1 text-sm font-semibold text-black/25">···</span>;
              }

              const isActive = currentPage === item;
              return (
                <button
                  key={item}
                  type="button"
                  title={language === 'zh' ? `第 ${item} 页` : `Page ${item}`}
                  aria-label={language === 'zh' ? `第 ${item} 页` : `Page ${item}`}
                  onClick={() => onPageChange(item)}
                  className={`h-9 min-w-9 rounded-xl px-3 text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-[#00172d] text-white shadow-lg shadow-[#00172d]/18 scale-[1.03]'
                      : 'border border-transparent text-black/45 hover:border-black/8 hover:bg-white hover:text-black'
                  }`}
                >
                  {item}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            disabled={currentPage === totalPages}
            onClick={() => onPageChange(currentPage + 1)}
            title={language === 'zh' ? '下一页' : 'Next page'}
            aria-label={language === 'zh' ? '下一页' : 'Next page'}
            className="inline-flex h-9 items-center gap-1 rounded-xl border border-black/8 bg-white px-3 text-[11px] font-semibold text-black/55 shadow-sm transition-all hover:translate-x-0.5 hover:border-black/15 hover:text-black disabled:opacity-25 disabled:hover:translate-x-0"
          >
            <span>{language === 'zh' ? '下一页' : 'Next'}</span>
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
};

const MonitoringCenter: React.FC<MonitoringCenterProps> = (props) => {
  const [refreshing, setRefreshing] = React.useState(false);
  const [hostResourceRange, setHostResourceRange] = React.useState<1 | 24 | 168>(24);
  const [hostResourceHistory, setHostResourceHistory] = React.useState<HostResourceHistoryPayload | null>(null);
  const [hostResourceHistoryLoading, setHostResourceHistoryLoading] = React.useState(false);
  const {
    language,
    monitorSearch,
    setMonitorSearch,
    monitorSearchResults,
    monitorSearching,
    monitorSelectedDevice,
    setMonitorSelectedDevice,
    monitorOverview,
    monitorRealtime,
    monitorTrend,
    monitorTrendInterface,
    setMonitorTrendInterface,
    monitorTrendResolution,
    setMonitorTrendResolution,
    monitorTrendStartInput,
    setMonitorTrendStartInput,
    monitorTrendEndInput,
    setMonitorTrendEndInput,
    monitorTrendRange,
    setMonitorTrendRange,
    monitorTrendZoom,
    setMonitorTrendZoom,
    monitorTrendDragStart,
    setMonitorTrendDragStart,
    monitorTrendDragEnd,
    setMonitorTrendDragEnd,
    monitorTrendMetrics,
    setMonitorTrendMetrics,
    monitorTrendUiMode,
    setMonitorTrendUiMode,
    monitorAlerts,
    monitorAlertTotal,
    monitorAlertsPage,
    setMonitorAlertsPage,
    monitorAlertsPageSize,
    monitorAlertsSeverity,
    setMonitorAlertsSeverity,
    monitorLoading,
    monitorPageVisible,
    monitorDashboardSiteFilter,
    setMonitorDashboardSiteFilter,
    monitorDashboardAlertFilter,
    setMonitorDashboardAlertFilter,
    hostResources,
    fetchMonitoringOverview,
    fetchMonitoringAlerts,
    fetchMonitoringRealtime,
    fetchHostResources,
    setMonitorRealtime,
    showToast,
  } = props;

  const fetchHostResourceHistory = React.useCallback(async (rangeHours = hostResourceRange) => {
    setHostResourceHistoryLoading(true);
    try {
      const resp = await fetch(`/api/health/resources/history?range_hours=${rangeHours}`);
      if (!resp.ok) throw new Error('Failed to fetch host resource history');
      const payload = await resp.json() as HostResourceHistoryPayload;
      setHostResourceHistory(payload);
    } catch {
      showToast(language === 'zh' ? '无法加载宿主机资源趋势' : 'Unable to load host resource trend', 'error');
    } finally {
      setHostResourceHistoryLoading(false);
    }
  }, [hostResourceRange, language, showToast]);

  const fmtRate = (bps?: number) => {
    if (bps == null || !Number.isFinite(bps) || bps < 0) return '-';
    if (bps >= 1_000_000_000) return `${(bps / 1_000_000_000).toFixed(2)} Gbps`;
    if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(2)} Mbps`;
    if (bps >= 1_000) return `${(bps / 1_000).toFixed(1)} Kbps`;
    return `${bps.toFixed(0)} bps`;
  };

  const fmtThroughput = (bps?: number) => {
    if (bps == null || !Number.isFinite(bps) || bps < 0) return '-';
    const bytes = bps / 8;
    if (bytes >= 1024 ** 4) return `${(bytes / (1024 ** 4)).toFixed(2)} TB/s`;
    if (bytes >= 1024 ** 3) return `${(bytes / (1024 ** 3)).toFixed(2)} GB/s`;
    if (bytes >= 1024 ** 2) return `${(bytes / (1024 ** 2)).toFixed(2)} MB/s`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB/s`;
    return `${bytes.toFixed(0)} B/s`;
  };

  const formatThroughputParts = (bps?: number) => {
    if (bps == null || !Number.isFinite(bps) || bps < 0) {
      return { value: '-', unit: '' };
    }
    const bytes = bps / 8;
    if (bytes >= 1024 ** 4) return { value: (bytes / (1024 ** 4)).toFixed(2), unit: 'TB/s' };
    if (bytes >= 1024 ** 3) return { value: (bytes / (1024 ** 3)).toFixed(bytes >= 10 * 1024 ** 3 ? 1 : 2), unit: 'GB/s' };
    if (bytes >= 1024 ** 2) return { value: (bytes / (1024 ** 2)).toFixed(bytes >= 100 * 1024 ** 2 ? 0 : bytes >= 10 * 1024 ** 2 ? 1 : 2), unit: 'MB/s' };
    if (bytes >= 1024) return { value: (bytes / 1024).toFixed(bytes >= 100 * 1024 ? 0 : bytes >= 10 * 1024 ? 1 : 2), unit: 'KB/s' };
    return { value: bytes.toFixed(0), unit: 'B/s' };
  };

  const formatPromThroughputParts = (bps?: number) => {
    if (bps == null || !Number.isFinite(bps) || bps < 0) {
      return { value: '-', unit: '' };
    }
    let value = bps / 8;
    const units = ['B/s', 'KiB/s', 'MiB/s', 'GiB/s', 'TiB/s'];
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex += 1;
    }
    if (unitIndex === 0) {
      return { value: value.toFixed(0), unit: units[unitIndex] };
    }
    if (value >= 100) {
      return { value: value.toFixed(0), unit: units[unitIndex] };
    }
    if (value >= 10) {
      return { value: value.toFixed(1), unit: units[unitIndex] };
    }
    return { value: value.toFixed(2), unit: units[unitIndex] };
  };

  const fmtThroughputProm = (bps?: number) => {
    const parts = formatPromThroughputParts(bps);
    return parts.unit ? `${parts.value} ${parts.unit}` : parts.value;
  };

  const fmtPercent = (value?: number | null) => {
    if (value == null || !Number.isFinite(value)) return '--';
    return `${Math.round(value)}%`;
  };

  const fmtThroughputAxis = (bps?: number) => {
    const parts = formatPromThroughputParts(bps);
    return parts.unit ? `${parts.value} ${parts.unit}` : parts.value;
  };

  const formatTs = (value?: string, withSeconds = false) => {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleTimeString(language === 'zh' ? 'zh-CN' : 'en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: withSeconds ? '2-digit' : undefined,
    });
  };

  const formatPromTimestamp = (value?: string) => {
    if (!value) return '--';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };

  const formatPromAxisTimestamp = (value?: string, rangeMs?: number) => {
    if (!value) return '--';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    const pad = (n: number) => String(n).padStart(2, '0');
    const safeRange = Number(rangeMs || 0);
    if (safeRange <= 6 * 60 * 60 * 1000) {
      return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }
    if (safeRange <= 7 * 24 * 60 * 60 * 1000) {
      return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  const formatFreshness = (value?: string) => {
    if (!value) return language === 'zh' ? '等待数据' : 'Awaiting data';
    const ts = new Date(value).getTime();
    if (Number.isNaN(ts)) return String(value);
    const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
    if (language === 'zh') {
      if (diffSec < 5) return '刚刚更新';
      if (diffSec < 60) return `${diffSec} 秒前更新`;
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin} 分钟前更新`;
      const diffHr = Math.floor(diffMin / 60);
      return `${diffHr} 小时前更新`;
    }
    if (diffSec < 5) return 'Updated just now';
    if (diffSec < 60) return `Updated ${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `Updated ${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    return `Updated ${diffHr}h ago`;
  };

  const severityLabel = (sev: string) => {
    if (language !== 'zh') return sev;
    const s = String(sev || '').toLowerCase();
    if (s === 'critical') return '严重';
    if (s === 'major') return '主要';
    if (s === 'minor' || s === 'medium' || s === 'low') return '次要';
    return sev;
  };

  const toNumOrNull = (value: any): number | null => {
    if (value == null || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };

  const trendData = (monitorTrend?.series || []).map((p: any) => ({
    ts: p.ts_minute,
    time: formatTs(p.ts_minute, false),
    in_bps: toNumOrNull(p.total_in_bps),
    out_bps: toNumOrNull(p.total_out_bps),
    in_pkts: toNumOrNull(p.total_in_pkts),
    out_pkts: toNumOrNull(p.total_out_pkts),
    errors: toNumOrNull(p.total_errors),
    drops: toNumOrNull(p.total_drops),
  }));

  const realtimeData = (monitorRealtime?.series || []).map((p: any) => ({
    ts: p.ts,
    time: formatTs(p.ts, true),
    in_bps: toNumOrNull(p.in_bps),
    out_bps: toNumOrNull(p.out_bps),
    in_pkts: toNumOrNull(p.in_pkts),
    out_pkts: toNumOrNull(p.out_pkts),
    errors: toNumOrNull(p.errors),
    drops: toNumOrNull(p.drops),
  }));

  const trendMetricDefs = [
    { key: 'in_bps', label: language === 'zh' ? '入流量' : 'IN Throughput', short: 'IN', color: '#2563eb', unit: 'throughput' },
    { key: 'out_bps', label: language === 'zh' ? '出流量' : 'OUT Throughput', short: 'OUT', color: '#ea580c', unit: 'throughput' },
    { key: 'in_pkts', label: language === 'zh' ? '入包' : 'IN Packets', short: language === 'zh' ? '入包' : 'IN Pkts', color: '#7c3aed', unit: 'count' },
    { key: 'out_pkts', label: language === 'zh' ? '出包' : 'OUT Packets', short: language === 'zh' ? '出包' : 'OUT Pkts', color: '#0891b2', unit: 'count' },
    { key: 'errors', label: language === 'zh' ? '错误' : 'Errors', short: language === 'zh' ? '错误' : 'Errors', color: '#dc2626', unit: 'count' },
    { key: 'drops', label: language === 'zh' ? '丢包' : 'Drops', short: language === 'zh' ? '丢包' : 'Drops', color: '#16a34a', unit: 'count' },
  ] as const;
  const trendMetricMap = Object.fromEntries(trendMetricDefs.map((d) => [d.key, d]));
  const selectedMetricDefs = trendMetricDefs.filter((d) => monitorTrendMetrics.includes(d.key));
  const hasThroughputMetric = selectedMetricDefs.some((d) => d.unit === 'throughput');
  const hasCountMetric = selectedMetricDefs.some((d) => d.unit === 'count');
  const hasTrendResponse = !!monitorTrend;
  const chartData = trendData.length > 0 ? trendData : (hasTrendResponse ? [] : realtimeData);
  const fullEndIndex = Math.max(0, chartData.length - 1);
  const rawZoomRange = monitorTrendZoom ?? { startIndex: 0, endIndex: fullEndIndex };
  const zoomRange = {
    startIndex: Math.max(0, Math.min(rawZoomRange.startIndex, fullEndIndex)),
    endIndex: Math.max(0, Math.min(rawZoomRange.endIndex, fullEndIndex)),
  };
  if (zoomRange.endIndex < zoomRange.startIndex) zoomRange.endIndex = zoomRange.startIndex;
  const zoomActive = monitorTrendZoom !== null && (zoomRange.startIndex > 0 || zoomRange.endIndex < fullEndIndex);
  const visibleChartData = chartData.slice(zoomRange.startIndex, zoomRange.endIndex + 1);
  const displayedChartData = zoomActive ? visibleChartData : chartData;
  const displayedRangeMs = (() => {
    if (displayedChartData.length < 2) return 0;
    const startTs = new Date(displayedChartData[0]?.ts || '').getTime();
    const endTs = new Date(displayedChartData[displayedChartData.length - 1]?.ts || '').getTime();
    if (Number.isNaN(startTs) || Number.isNaN(endTs)) return 0;
    return Math.max(0, endTs - startTs);
  })();
  const isCompactTrend = monitorTrendUiMode === 'compact';
  const axisTickCount = (() => {
    const points = displayedChartData.length;
    if (points <= 2) return points;
    const maxTicksByMode = isCompactTrend ? 5 : 8;
    const maxTicksByPoints = Math.max(3, Math.min(maxTicksByMode, Math.floor(points / 2)));
    if (displayedRangeMs <= 15 * 60 * 1000) return Math.min(maxTicksByPoints, 4);
    if (displayedRangeMs <= 60 * 60 * 1000) return Math.min(maxTicksByPoints, 5);
    if (displayedRangeMs <= 6 * 60 * 60 * 1000) return Math.min(maxTicksByPoints, 6);
    if (displayedRangeMs <= 24 * 60 * 60 * 1000) return Math.min(maxTicksByPoints, 7);
    if (displayedRangeMs <= 7 * 24 * 60 * 60 * 1000) return Math.min(maxTicksByPoints, 8);
    return Math.min(maxTicksByPoints, 6);
  })();
  const dragPreviewActive = monitorTrendDragStart != null && monitorTrendDragEnd != null;
  const dragStartIndex = dragPreviewActive ? Math.max(0, Math.min(monitorTrendDragStart as number, monitorTrendDragEnd as number)) : null;
  const dragEndIndex = dragPreviewActive ? Math.min(fullEndIndex, Math.max(monitorTrendDragStart as number, monitorTrendDragEnd as number)) : null;
  const dragBaseIndex = zoomActive ? zoomRange.startIndex : 0;
  const showChart = monitorSelectedDevice && displayedChartData.length > 0 && selectedMetricDefs.length > 0;
  const overviewFreshness = formatFreshness(monitorOverview?.updated_at);
  const realtimeFreshness = formatFreshness(monitorRealtime?.updated_at);
  const fmtMetricValue = (metric: { unit: string }, raw?: number | null) => {
    if (raw == null || !Number.isFinite(raw)) return language === 'zh' ? '无样本' : 'No sample';
    return metric.unit === 'throughput' ? fmtThroughput(raw) : Number(raw).toLocaleString();
  };
  const latestPoint = displayedChartData.length > 0 ? displayedChartData[displayedChartData.length - 1] : null;
  const windowStartPoint = displayedChartData.length > 0 ? displayedChartData[0] : null;
  const [watchlistScope, setWatchlistScope] = React.useState<'focus' | 'all'>('focus');
  const defaultHotInterfaces = Array.isArray(monitorOverview?.top_hot_interfaces) ? monitorOverview.top_hot_interfaces : [];
  const defaultOpenAlerts = Array.isArray(monitorOverview?.recent_open_alerts) ? monitorOverview.recent_open_alerts : [];
  const dashboardSiteOptions = Array.from(new Set([
    ...defaultHotInterfaces.map((item: any) => String(item.site || '').trim()).filter(Boolean),
    ...defaultOpenAlerts.map((item: any) => String(item.site || '').trim()).filter(Boolean),
  ])).sort((a, b) => a.localeCompare(b));
  const filteredHotInterfaces = defaultHotInterfaces.filter((item: any) => monitorDashboardSiteFilter === 'all' || String(item.site || '').trim() === monitorDashboardSiteFilter);
  const watchlistLimit = 6;
  const uniqueWatchlistItems = (() => {
    const seenDevices = new Set<string>();
    const items: any[] = [];
    for (const item of filteredHotInterfaces) {
      const deviceKey = String(item.device_id || item.id || item.hostname || '');
      if (!deviceKey || seenDevices.has(deviceKey)) continue;
      seenDevices.add(deviceKey);
      items.push(item);
    }
    return items;
  })();
  const anomalousWatchlistItems = uniqueWatchlistItems.filter((item: any) => {
    const statusLower = String(item.status || '').toLowerCase();
    return statusLower === 'down' || Number(item.errors || 0) > 0 || Number(item.drops || 0) > 0 || Number(item.utilization_pct || 0) >= 85;
  });
  const watchlistItems = watchlistScope === 'all'
    ? uniqueWatchlistItems
    : (anomalousWatchlistItems.length > 0 ? anomalousWatchlistItems.slice(0, watchlistLimit) : uniqueWatchlistItems.slice(0, watchlistLimit));
  const hiddenWatchlistCount = Math.max(0, (watchlistScope === 'all' ? uniqueWatchlistItems.length : (anomalousWatchlistItems.length > 0 ? anomalousWatchlistItems.length : uniqueWatchlistItems.length)) - watchlistItems.length);
  const displaySearchResults = (() => {
    if (monitorSearchResults.length > 0) return monitorSearchResults;
    if (monitorSelectedDevice?.id) return [monitorSelectedDevice];
    return [] as any[];
  })();
  const showDefaultWatchlist = monitorSearch.trim().length === 0 && !monitorSelectedDevice?.id;
  const filteredOpenAlerts = defaultOpenAlerts.filter((item: any) => {
    const siteMatch = monitorDashboardSiteFilter === 'all' || String(item.site || '').trim() === monitorDashboardSiteFilter;
    const severityMatch = monitorDashboardAlertFilter === 'all' || String(item.severity || '').toLowerCase() === monitorDashboardAlertFilter;
    return siteMatch && severityMatch;
  });

  const toggleTrendMetric = (metricKey: string) => {
    setMonitorTrendMetrics((prev) => prev.includes(metricKey) ? prev.filter((k) => k !== metricKey) : [...prev, metricKey]);
  };

  const selectAllTrendMetrics = () => {
    setMonitorTrendMetrics(trendMetricDefs.map((m) => m.key));
  };

  const clearAllTrendMetrics = () => {
    setMonitorTrendMetrics([]);
  };

  const openMonitorDevice = (device: any) => {
    if (!device?.id && !device?.device_id) return;
    const nextDevice = {
      id: device.id || device.device_id,
      hostname: device.hostname || '-',
      ip_address: device.ip_address || '-',
      platform: device.platform || '-',
      role: device.role || '',
      site: device.site || '',
    };
    setMonitorSearch(nextDevice.hostname === '-' ? nextDevice.ip_address : nextDevice.hostname);
    setMonitorSelectedDevice(nextDevice);
  };

  const toUtcIso = (localVal: string) => {
    if (!localVal) return '';
    const dt = new Date(localVal);
    if (Number.isNaN(dt.getTime())) return '';
    return dt.toISOString();
  };

  const toLocalInputValue = (d: Date) => {
    const pad = (v: number) => String(v).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const applyQuickRange = (hours: number) => {
    const end = new Date();
    const start = new Date(end.getTime() - hours * 60 * 60 * 1000);
    setMonitorTrendStartInput(toLocalInputValue(start));
    setMonitorTrendEndInput(toLocalInputValue(end));
    setMonitorTrendZoom(null);
    setMonitorTrendDragStart(null);
    setMonitorTrendDragEnd(null);
    setMonitorTrendRange({ start_time: start.toISOString(), end_time: end.toISOString() });
  };

  const interfaceOptions = (monitorRealtime?.latest_interfaces || []).map((it: any) => String(it.interface_name || '')).filter(Boolean);
  const latestInSummary = formatPromThroughputParts((latestPoint as any)?.in_bps);
  const latestOutSummary = formatPromThroughputParts((latestPoint as any)?.out_bps);
  const promExpressionLabel = monitorTrendInterface
    ? `rate(interface_bytes_total{if="${monitorTrendInterface}"}[5m])`
    : 'sum(rate(interface_bytes_total[5m]))';
  const hostResourceTone = hostResources?.status === 'critical'
    ? 'bg-red-50 text-red-700 border-red-200'
    : hostResources?.status === 'degraded'
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : 'bg-emerald-50 text-emerald-700 border-emerald-200';
  const hostStatusLabel = hostResources?.status === 'critical'
    ? (language === 'zh' ? '严重' : 'Critical')
    : hostResources?.status === 'degraded'
      ? (language === 'zh' ? '告警' : 'Degraded')
      : (language === 'zh' ? '健康' : 'Healthy');
  const hostTrendData = (hostResourceHistory?.series || []).map((point) => ({
    ts: point.ts,
    time: formatTs(point.ts, hostResourceRange === 1),
    cpu_percent: point.cpu_percent,
    memory_percent: point.memory_percent,
    disk_percent: point.disk_percent,
  }));

  React.useEffect(() => {
    fetchHostResourceHistory(hostResourceRange);
  }, [fetchHostResourceHistory, hostResourceRange]);

  React.useEffect(() => {
    if (!monitorPageVisible) return;
    const timer = window.setInterval(() => {
      fetchHostResourceHistory(hostResourceRange);
    }, 60000);
    return () => window.clearInterval(timer);
  }, [fetchHostResourceHistory, hostResourceRange, monitorPageVisible]);

  return (
    <div className="monitoring-center space-y-6">
      <div className={sectionHeaderRowClass}>
        <div>
          <h2 className="monitoring-heading text-2xl font-medium tracking-tight">{language === 'zh' ? '监控中心' : 'Monitoring Center'}</h2>
          <p className="text-sm text-black/40">{language === 'zh' ? '仅按在线设备搜索并按需加载，避免全量查询。' : 'Search online devices and load on-demand only, avoiding full dataset rendering.'}</p>
          <p className="mt-1 text-[11px] text-black/35">
            {language === 'zh' ? '总览刷新' : 'Overview refresh'} {formatTs(monitorOverview?.updated_at, true)}
            <span className="ml-2">{overviewFreshness}</span>
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <button
            type="button"
            disabled={refreshing}
            onClick={() => {
              setRefreshing(true);
              fetchMonitoringOverview();
              fetchMonitoringAlerts();
              fetchHostResources();
              fetchHostResourceHistory(hostResourceRange);
              if (monitorSelectedDevice?.id) {
                fetchMonitoringRealtime(monitorSelectedDevice.id).then(setMonitorRealtime).catch(() => undefined);
              }
              setTimeout(() => setRefreshing(false), 1200);
            }}
            className={`px-3 py-1 text-[10px] font-bold uppercase rounded-full border transition-all ${
              refreshing
                ? 'border-[#00bceb]/40 bg-[#00bceb]/10 text-[#0089ac] cursor-not-allowed'
                : 'border-black/10 bg-white text-black/60 hover:bg-black/[0.03]'
            }`}
          >
            {refreshing ? (language === 'zh' ? '刷新中…' : 'Refreshing…') : (language === 'zh' ? '立即刷新' : 'Refresh Now')}
          </button>
          <span className="px-3 py-1 text-[10px] font-bold uppercase bg-[#00bceb]/10 text-[#0089ac] rounded-full">Search-First</span>
          <span className="px-3 py-1 text-[10px] font-bold uppercase bg-emerald-100 text-emerald-700 rounded-full">Online-Only</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {[
          { label: language === 'zh' ? '在线设备' : 'Online Devices', value: monitorOverview?.online_devices ?? '-' },
          { label: language === 'zh' ? '接口 UP' : 'Interfaces UP', value: monitorOverview?.interfaces_up ?? '-' },
          { label: language === 'zh' ? '接口 DOWN' : 'Interfaces DOWN', value: monitorOverview?.interfaces_down ?? '-' },
          { label: language === 'zh' ? '高利用率接口' : 'High Util Interfaces', value: monitorOverview?.high_util_interfaces ?? '-' },
          { label: language === 'zh' ? '当前未恢复告警' : 'Open Alerts', value: monitorOverview?.open_alerts ?? '-' },
          { label: language === 'zh' ? '24小时告警' : 'Alerts 24h', value: monitorOverview?.alerts_24h ?? '-' },
        ].map((c, i) => (
          <div key={i} className="bg-white rounded-2xl border border-black/5 shadow-sm p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-black/35">{c.label}</p>
            <p className="mt-1 text-2xl font-semibold text-[#00172D]">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_1fr] gap-4">
        <div className="rounded-2xl border border-black/5 bg-white shadow-sm p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#0089ac]">{language === 'zh' ? '平台宿主机' : 'Platform Host'}</p>
              <h3 className="monitoring-heading mt-1 text-lg font-semibold text-[#0b2340]">{language === 'zh' ? '服务器资源概览' : 'Server Resource Overview'}</h3>
              <p className="text-xs text-black/45">{language === 'zh' ? '面向部署此运维平台的宿主机，便于快速判断是否为平台资源瓶颈。' : 'Telemetry for the host running this platform, so you can quickly spot platform-side bottlenecks.'}</p>
            </div>
            <span className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${hostResourceTone}`}>{hostStatusLabel}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-black/10 bg-white overflow-hidden">
              <button
                type="button"
                onClick={() => setHostResourceRange(1)}
                className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] transition-all ${hostResourceRange === 1 ? 'bg-black text-white' : 'text-black/55 hover:bg-black/[0.03]'}`}
              >
                {language === 'zh' ? '最近 1 小时' : 'Last 1h'}
              </button>
              <button
                type="button"
                onClick={() => setHostResourceRange(24)}
                className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] transition-all ${hostResourceRange === 24 ? 'bg-black text-white' : 'text-black/55 hover:bg-black/[0.03]'}`}
              >
                {language === 'zh' ? '最近 24 小时' : 'Last 24h'}
              </button>
              <button
                type="button"
                onClick={() => setHostResourceRange(168)}
                className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] transition-all ${hostResourceRange === 168 ? 'bg-black text-white' : 'text-black/55 hover:bg-black/[0.03]'}`}
              >
                {language === 'zh' ? '最近 7 天' : 'Last 7d'}
              </button>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">
              {language === 'zh'
                ? `当前告警 ${hostResources?.active_alert_count || 0}`
                : `Active alerts ${hostResources?.active_alert_count || 0}`}
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: language === 'zh' ? 'CPU' : 'CPU', value: fmtPercent(hostResources?.cpu_percent), sub: language === 'zh' ? '主机使用率' : 'Host usage' },
              { label: language === 'zh' ? '内存' : 'Memory', value: fmtPercent(hostResources?.memory_percent), sub: hostResources?.memory_total_gb != null && hostResources?.memory_used_gb != null ? `${hostResources.memory_used_gb.toFixed(1)} / ${hostResources.memory_total_gb.toFixed(1)} GB` : '--' },
              { label: language === 'zh' ? '磁盘' : 'Disk', value: fmtPercent(hostResources?.disk_percent), sub: hostResources ? `${hostResources.disk_free_gb.toFixed(1)} GB ${language === 'zh' ? '可用' : 'free'}` : '--' },
              { label: language === 'zh' ? '进程内存' : 'Process RSS', value: hostResources?.process_memory_mb != null ? `${Math.round(hostResources.process_memory_mb)} MB` : '--', sub: hostResources?.process_cpu_percent != null ? `${language === 'zh' ? '进程 CPU' : 'Process CPU'} ${fmtPercent(hostResources.process_cpu_percent)}` : '--' },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-black/8 bg-[linear-gradient(180deg,rgba(0,0,0,0.01),rgba(0,0,0,0.03))] p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-black/35">{item.label}</p>
                <p className="mt-2 text-2xl font-semibold text-[#00172D]">{item.value}</p>
                <p className="mt-1 text-[11px] text-black/45">{item.sub}</p>
              </div>
            ))}
          </div>
            <div className="rounded-xl border border-black/8 bg-[linear-gradient(180deg,rgba(2,6,23,0.01),rgba(2,6,23,0.04))] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-black/35">{language === 'zh' ? '资源趋势' : 'Resource Trend'}</p>
                  <p className="mt-1 text-xs text-black/45">{language === 'zh' ? '展示宿主机 CPU、内存、磁盘占用曲线，长时间范围自动降采样。' : 'CPU, memory and disk usage for the platform host with automatic downsampling on longer ranges.'}</p>
                </div>
                <span className="text-[11px] text-black/40">{hostResourceHistoryLoading ? (language === 'zh' ? '加载中...' : 'Loading...') : `${hostResourceHistory?.sample_count || hostTrendData.length} ${language === 'zh' ? '个点' : 'points'} · ${hostResourceHistory?.resolution_hint || '1m'}`}</span>
              </div>
              <div className="mt-4 h-[220px]">
                {hostTrendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={hostTrendData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="#dbe4ee" />
                      <XAxis dataKey="ts" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#60748a' }} tickFormatter={(value) => hostResourceRange === 168 ? formatPromAxisTimestamp(String(value), 8 * 24 * 60 * 60 * 1000) : formatTs(String(value), hostResourceRange === 1)} minTickGap={28} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#60748a' }} domain={[0, 100]} tickFormatter={(value) => `${value}%`} width={42} />
                      <Tooltip
                        contentStyle={{ borderRadius: 14, borderColor: '#d9e3ef', boxShadow: '0 18px 38px rgba(15,23,42,0.12)', padding: '14px 16px', background: 'rgba(255,255,255,0.96)' }}
                        labelFormatter={(value) => formatPromTimestamp(String(value))}
                        formatter={(value: any, name: any) => [`${Math.round(Number(value || 0))}%`, String(name)]}
                      />
                      <Area type="monotone" dataKey="cpu_percent" name={language === 'zh' ? 'CPU' : 'CPU'} stroke="#2563eb" fill="#2563eb1f" strokeWidth={2.1} isAnimationActive={false} connectNulls />
                      <Area type="monotone" dataKey="memory_percent" name={language === 'zh' ? '内存' : 'Memory'} stroke="#ea580c" fill="#ea580c18" strokeWidth={2.1} isAnimationActive={false} connectNulls />
                      <Area type="monotone" dataKey="disk_percent" name={language === 'zh' ? '磁盘' : 'Disk'} stroke="#16a34a" fill="#16a34a18" strokeWidth={2.1} isAnimationActive={false} connectNulls />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-sm text-black/35">{language === 'zh' ? '暂无宿主机资源趋势数据。' : 'No host resource trend data yet.'}</div>
                )}
              </div>
            </div>
        </div>

        <div className="rounded-2xl border border-black/5 bg-white shadow-sm p-5 space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#0089ac]">{language === 'zh' ? '服务状态' : 'Service Status'}</p>
          <div className="space-y-2 text-sm text-black/60">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-black/8 px-3 py-2">
              <span>{language === 'zh' ? '数据库' : 'Database'}</span>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${hostResources?.database_ok ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{hostResources?.database_ok ? (language === 'zh' ? '已连接' : 'Connected') : (language === 'zh' ? '异常' : 'Error')}</span>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-black/8 px-3 py-2">
              <span>{language === 'zh' ? '系统负载' : 'Load Avg'}</span>
              <span className="font-semibold text-[#00172D]">{hostResources?.load_1m != null ? hostResources.load_1m.toFixed(2) : '--'}</span>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-black/8 px-3 py-2">
              <span>{language === 'zh' ? '运行时长' : 'Uptime'}</span>
              <span className="font-semibold text-[#00172D]">{hostResources?.uptime_hours != null ? `${hostResources.uptime_hours.toFixed(1)}h` : '--'}</span>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-black/8 px-3 py-2">
              <span>{language === 'zh' ? '宿主机' : 'Hostname'}</span>
              <span className="font-semibold text-[#00172D] truncate max-w-[180px] text-right">{hostResources?.hostname || '--'}</span>
            </div>
          </div>
          <div className="rounded-xl border border-dashed border-black/10 bg-black/[0.01] p-4 text-xs text-black/45">
            {hostResources?.metrics_available
              ? `${language === 'zh' ? '最近刷新' : 'Last refresh'}: ${formatTs(hostResources.updated_at, true)}`
              : (language === 'zh' ? '当前未安装资源采集依赖，接口可访问但指标不可用。' : 'Resource collector dependency is missing, so the endpoint is reachable but metrics are unavailable.')}
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-red-600">{language === 'zh' ? '资源告警' : 'Resource Alerts'}</p>
              <span className="text-[11px] text-black/40">{language === 'zh' ? '按阈值自动生成' : 'Threshold-driven'}</span>
            </div>
            {(hostResourceHistory?.alerts || []).length > 0 ? (hostResourceHistory?.alerts || []).slice(0, 6).map((alert, index) => {
              const severityTone = alert.severity === 'critical' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700';
              return (
                <div key={alert.id || `${alert.metric_key}-${index}`} className="rounded-xl border border-black/8 px-3 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${severityTone}`}>{alert.severity === 'critical' ? (language === 'zh' ? '严重' : 'Critical') : (language === 'zh' ? '告警' : 'Major')}</span>
                    <span className="text-[11px] text-black/40">{alert.created_at ? formatTs(alert.created_at, true) : '--'}</span>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-[#0b2340]">{alert.title}</p>
                  <p className="mt-1 text-[11px] text-black/55">{alert.message}</p>
                </div>
              );
            }) : (
              <div className="rounded-xl border border-dashed border-black/10 bg-black/[0.01] p-4 text-sm text-black/35">{language === 'zh' ? '当前没有宿主机资源告警。' : 'No active host resource alerts right now.'}</div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-5 space-y-4">
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-black/40" size={16} />
            <input type="text" value={monitorSearch} onChange={(e) => setMonitorSearch(e.target.value)} placeholder={language === 'zh' ? '搜索在线设备（主机名/IP，支持模糊匹配）' : 'Search online devices (hostname/IP, fuzzy match)'} className="w-full pl-9 pr-3 py-2 bg-black/[0.02] border border-black/5 rounded-xl text-sm focus:border-black/20 outline-none" />
          </div>
          <div className="text-xs text-black/40">{monitorSearching ? (language === 'zh' ? '搜索中...' : 'Searching...') : `${monitorSearchResults.length} ${language === 'zh' ? '个结果' : 'results'}`}</div>
        </div>

        {showDefaultWatchlist ? (
          <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_1fr] gap-4">
            <div className="rounded-xl border border-black/10 bg-gradient-to-br from-slate-50 via-white to-cyan-50/60 p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#0089ac]">{language === 'zh' ? '默认视图' : 'Default Watchlist'}</p>
                  <h3 className="monitoring-heading mt-1 text-lg font-semibold text-[#0b2340]">{language === 'zh' ? '设备观察列表' : 'Watchlist Devices'}</h3>
                  <p className="text-xs text-black/45">{language === 'zh' ? '每台设备只展示 1 个最需要关注的代表接口，避免设备多时列表失控。' : 'Show only one representative interface per device so the watchlist stays readable at scale.'}</p>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-cyan-50 text-cyan-700 text-[10px] font-bold uppercase">{overviewFreshness}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select value={monitorDashboardSiteFilter} onChange={(e) => setMonitorDashboardSiteFilter(e.target.value)} className="bg-white border border-black/10 rounded-lg px-2.5 py-1.5 text-xs outline-none" title={language === 'zh' ? '按站点筛选' : 'Filter by site'}>
                  <option value="all">{language === 'zh' ? '全部站点' : 'All Sites'}</option>
                  {dashboardSiteOptions.map((site) => <option key={site} value={site}>{site}</option>)}
                </select>
                <div className="inline-flex rounded-lg border border-black/10 bg-white overflow-hidden">
                  <button type="button" onClick={() => setWatchlistScope('focus')} className={`px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] transition-all ${watchlistScope === 'focus' ? 'bg-black text-white' : 'text-black/55 hover:bg-black/[0.03]'}`}>
                    {language === 'zh' ? '仅看异常设备' : 'Focus Anomalies'}
                  </button>
                  <button type="button" onClick={() => setWatchlistScope('all')} className={`px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] transition-all ${watchlistScope === 'all' ? 'bg-black text-white' : 'text-black/55 hover:bg-black/[0.03]'}`}>
                    {language === 'zh' ? '查看全部设备' : 'Show All Devices'}
                  </button>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">{language === 'zh' ? `展示 ${watchlistItems.length} 台设备` : `${watchlistItems.length} devices shown`}</span>
                {hiddenWatchlistCount > 0 && <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-black/45 border border-black/10">{language === 'zh' ? `其余 ${hiddenWatchlistCount} 个接口已折叠` : `${hiddenWatchlistCount} more interfaces collapsed`}</span>}
                <span className="text-[11px] text-black/40">{monitorPageVisible ? (language === 'zh' ? '可见页面: 5 秒刷新' : 'Visible page: 5s refresh') : (language === 'zh' ? '后台页面: 已暂停自动刷新' : 'Background page: auto refresh paused')}</span>
              </div>
              <div className={`space-y-2 ${watchlistScope === 'all' ? 'max-h-[520px] overflow-auto pr-1' : ''}`}>
                {watchlistItems.length > 0 ? watchlistItems.map((item: any) => {
                  const statusLower = String(item.status || '').toLowerCase();
                  const severityClass = statusLower === 'down'
                    ? 'border-red-200 bg-red-50/70'
                    : Number(item.errors || 0) + Number(item.drops || 0) > 0
                      ? 'border-amber-200 bg-amber-50/80'
                      : Number(item.utilization_pct || 0) >= 85
                        ? 'border-cyan-200 bg-cyan-50/80'
                        : 'border-black/10 bg-white';
                  return (
                    <button key={`${item.device_id}-${item.interface_name}`} type="button" onClick={() => openMonitorDevice(item)} className={`w-full rounded-xl border p-3 text-left transition-all hover:border-cyan-300 hover:bg-cyan-50/40 ${severityClass}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="monitoring-heading text-sm font-semibold text-[#0b2340] truncate">{item.hostname}</p>
                          <p className="monitoring-data text-[11px] text-black/55 truncate">{item.interface_name}</p>
                          <p className="mt-1 text-[11px] text-black/40 truncate">{[item.site, item.platform].filter(Boolean).join(' • ') || item.ip_address}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="monitoring-data text-sm font-semibold text-[#00172D]">{fmtThroughput(Number(item.throughput_bps || 0))}</p>
                          <p className="text-[11px] text-black/40">{Number(item.utilization_pct || 0).toFixed(1)}% · {item.speed_mbps ? `${Number(item.speed_mbps).toLocaleString()} Mbps` : '-'}</p>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-3 text-[11px] text-black/50">
                        <span className="monitoring-data">{statusLower === 'down' ? (language === 'zh' ? '链路中断' : 'LINK DOWN') : statusLower === 'up' ? (language === 'zh' ? '链路正常' : 'LINK UP') : String(item.status || '').toUpperCase()}</span>
                        <span>{language === 'zh' ? '错误' : 'Errors'} {Number(item.errors || 0).toLocaleString()}</span>
                        <span>{language === 'zh' ? '丢弃' : 'Drops'} {Number(item.drops || 0).toLocaleString()}</span>
                      </div>
                    </button>
                  );
                }) : <div className="rounded-xl border border-dashed border-black/10 bg-white/80 p-6 text-center text-sm text-black/40">{language === 'zh' ? '当前筛选条件下没有接口热点。' : 'No hot interfaces for the current filter.'}</div>}
              </div>
            </div>

            <div className="rounded-xl border border-black/10 bg-white p-5 space-y-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-red-600">{language === 'zh' ? '优先处理' : 'Priority Queue'}</p>
                <h3 className="mt-1 text-lg font-semibold text-[#0b2340]">{language === 'zh' ? '未恢复告警' : 'Open Alerts'}</h3>
                <p className="text-xs text-black/45">{language === 'zh' ? '保留在页面顶部，避免必须先搜索设备才能看到当前故障。' : 'Keep active faults visible without forcing a device search first.'}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select value={monitorDashboardAlertFilter} onChange={(e) => setMonitorDashboardAlertFilter(e.target.value as 'all' | 'critical' | 'major')} className="bg-white border border-black/10 rounded-lg px-2.5 py-1.5 text-xs outline-none" title={language === 'zh' ? '按级别筛选' : 'Filter by severity'}>
                  <option value="all">{language === 'zh' ? '全部级别' : 'All Severities'}</option>
                  <option value="critical">{language === 'zh' ? '仅严重' : 'Critical Only'}</option>
                  <option value="major">{language === 'zh' ? '仅主要' : 'Major Only'}</option>
                </select>
              </div>
              <div className="space-y-2">
                {filteredOpenAlerts.length > 0 ? filteredOpenAlerts.map((alert: any) => {
                  const severityTone = String(alert.severity || '').toLowerCase() === 'critical' ? 'bg-red-100 text-red-700' : String(alert.severity || '').toLowerCase() === 'major' ? 'bg-orange-100 text-orange-700' : 'bg-black/5 text-black/55';
                  return (
                    <button key={alert.id} type="button" onClick={() => openMonitorDevice(alert)} className="w-full rounded-xl border border-black/10 p-3 text-left transition-all hover:border-red-200 hover:bg-red-50/30">
                      <div className="flex items-center justify-between gap-3">
                        <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${severityTone}`}>{severityLabel(alert.severity)}</span>
                        <span className="text-[11px] text-black/40">{formatTs(alert.created_at, true)}</span>
                      </div>
                      <p className="mt-2 text-sm font-semibold text-[#0b2340] line-clamp-1">{alert.title}</p>
                      <p className="mt-1 text-[11px] text-black/55 line-clamp-2">{alert.message}</p>
                      <p className="mt-2 text-[11px] text-black/40 truncate">{[alert.hostname, alert.interface_name, alert.site].filter(Boolean).join(' • ')}</p>
                    </button>
                  );
                }) : <div className="rounded-xl border border-dashed border-black/10 bg-black/[0.01] p-6 text-center text-sm text-black/40">{language === 'zh' ? '当前筛选条件下没有未恢复告警。' : 'There are no open alerts for the current filter.'}</div>}
              </div>
              <div className="rounded-xl border border-dashed border-black/10 bg-black/[0.01] p-4 text-xs text-black/45">
                {language === 'zh' ? '这里展示的是默认观察列表，不是全网所有接口清单。输入主机名或 IP 可继续精确下钻；也可以直接点击左侧设备代表接口或未恢复告警跳转。' : 'This is a compact watchlist, not a full interface inventory. Search by hostname/IP for exact drill-down, or jump from the representative interface and open alerts.'}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="xl:col-span-1 rounded-xl border border-black/10 p-2 max-h-[320px] overflow-auto space-y-1">
              {displaySearchResults.map((d: any) => (
                <button key={d.id} onClick={() => setMonitorSelectedDevice(d)} className={`w-full text-left p-3 rounded-lg border transition-all ${monitorSelectedDevice?.id === d.id ? 'bg-black text-white border-black' : 'border-transparent hover:border-black/10 hover:bg-black/[0.02]'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold truncate">{d.hostname}</p>
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  </div>
                  <p className={`text-[11px] mt-1 font-mono ${monitorSelectedDevice?.id === d.id ? 'text-white/70' : 'text-black/45'}`}>{d.ip_address}</p>
                  <p className={`text-[10px] mt-0.5 ${monitorSelectedDevice?.id === d.id ? 'text-white/65' : 'text-black/35'}`}>{d.platform}</p>
                </button>
              ))}
              {!monitorSearching && displaySearchResults.length === 0 && <p className="p-4 text-xs text-black/35 text-center">{language === 'zh' ? '未找到在线设备' : 'No online device matched'}</p>}
            </div>

            <div className="xl:col-span-2 rounded-xl border border-black/10 overflow-hidden">
              {!monitorSelectedDevice ? <div className="p-8 text-center text-sm text-black/40">{language === 'zh' ? '从左侧选择设备后加载实时数据。' : 'Select a device from the left to load real-time data.'}</div> : monitorLoading && !monitorRealtime ? <div className="p-8 text-center text-sm text-black/40">{language === 'zh' ? '加载实时数据中...' : 'Loading realtime data...'}</div> : (
                <>
                  <div className="px-4 py-3 bg-black/[0.02] border-b border-black/10 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">{monitorSelectedDevice.hostname}</p>
                      <p className="text-[11px] text-black/40 font-mono">{monitorSelectedDevice.ip_address}</p>
                      <p className="mt-1 text-[11px] text-black/35">{realtimeFreshness}</p>
                      <div className="mt-1 flex flex-wrap gap-3 text-[10px] text-black/45 font-mono">
                        <span>IN {fmtRate(Number(monitorRealtime?.summary?.in_bps || 0))}</span>
                        <span>OUT {fmtRate(Number(monitorRealtime?.summary?.out_bps || 0))}</span>
                        <span>IN_PKT {Number(monitorRealtime?.summary?.in_pkts || 0).toLocaleString()}</span>
                        <span>OUT_PKT {Number(monitorRealtime?.summary?.out_pkts || 0).toLocaleString()}</span>
                        <span>ERR {Number(monitorRealtime?.summary?.errors || 0).toLocaleString()}</span>
                        <span>DROP {Number(monitorRealtime?.summary?.drops || 0).toLocaleString()}</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold uppercase px-2 py-1 rounded-lg bg-emerald-100 text-emerald-700">ONLINE</span>
                  </div>
                  <div className="max-h-[260px] overflow-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-black/[0.02] sticky top-0"><tr><th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-black/40">Interface</th><th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-black/40">Status</th><th className="px-3 py-2 text-right text-[10px] uppercase tracking-wider text-black/40">IN Rate</th><th className="px-3 py-2 text-right text-[10px] uppercase tracking-wider text-black/40">OUT Rate</th><th className="px-3 py-2 text-right text-[10px] uppercase tracking-wider text-black/40">IN Pkt</th><th className="px-3 py-2 text-right text-[10px] uppercase tracking-wider text-black/40">OUT Pkt</th><th className="px-3 py-2 text-right text-[10px] uppercase tracking-wider text-black/40">BW%</th><th className="px-3 py-2 text-right text-[10px] uppercase tracking-wider text-black/40">Err</th><th className="px-3 py-2 text-right text-[10px] uppercase tracking-wider text-black/40">Drop</th></tr></thead>
                      <tbody className="divide-y divide-black/5">
                        {(monitorRealtime?.latest_interfaces || []).slice(0, 100).map((it: any, idx: number) => {
                          const bw = Math.max(Number(it.bw_in_pct || 0), Number(it.bw_out_pct || 0));
                          return <tr key={`${it.interface_name}-${idx}`} className="hover:bg-black/[0.01]"><td className="px-3 py-2 font-mono">{it.interface_name}</td><td className="px-3 py-2"><span className={`text-[10px] font-bold uppercase ${String(it.status).toLowerCase() === 'up' ? 'text-emerald-600' : 'text-red-500'}`}>{it.status}</span></td><td className="px-3 py-2 text-right font-mono text-blue-600">{fmtRate(it.in_bps)}</td><td className="px-3 py-2 text-right font-mono text-orange-600">{fmtRate(it.out_bps)}</td><td className="px-3 py-2 text-right font-mono">{Number(it.in_pkts || 0).toLocaleString()}</td><td className="px-3 py-2 text-right font-mono">{Number(it.out_pkts || 0).toLocaleString()}</td><td className="px-3 py-2 text-right font-mono">{bw.toFixed(1)}%</td><td className="px-3 py-2 text-right font-mono">{Number(it.in_errors || 0) + Number(it.out_errors || 0)}</td><td className="px-3 py-2 text-right font-mono">{Number(it.in_discards || 0) + Number(it.out_discards || 0)}</td></tr>;
                        })}
                        {(!monitorRealtime?.latest_interfaces || monitorRealtime.latest_interfaces.length === 0) && <tr><td colSpan={9} className="px-3 py-6 text-center text-sm text-black/35">{language === 'zh' ? '暂无实时接口样本' : 'No realtime interface samples yet'}</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <div className={`prom-panel bg-white rounded-2xl border shadow-sm ${isCompactTrend ? 'border-black/8 p-4' : 'border-black/5 p-5'}`}>
        <div className="flex flex-col gap-4">
          <div className="prom-panel-header flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
            <div>
              <h3 className="prom-title monitoring-heading text-lg font-semibold tracking-tight text-[#0b2340]">{language === 'zh' ? '趋势分析' : 'Trend Analysis'}</h3>
              {!isCompactTrend && <p className="prom-subtitle text-xs text-black/45">{language === 'zh' ? 'Prometheus 风格图表：支持图面拖拽缩放与时间窗回放。' : 'Prometheus-style graph with direct drag-zoom and time-window replay.'}</p>}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-wider">
              <div className="inline-flex rounded-lg border border-black/10 bg-white overflow-hidden prom-segmented">
                <button type="button" onClick={() => setMonitorTrendUiMode('pro')} className={`px-2 py-1 text-[10px] font-bold transition-all ${monitorTrendUiMode === 'pro' ? 'bg-black text-white' : 'text-black/60 hover:bg-black/[0.03]'}`}>{language === 'zh' ? '专业' : 'Pro'}</button>
                <button type="button" onClick={() => setMonitorTrendUiMode('compact')} className={`px-2 py-1 text-[10px] font-bold transition-all ${monitorTrendUiMode === 'compact' ? 'bg-black text-white' : 'text-black/60 hover:bg-black/[0.03]'}`}>{language === 'zh' ? '紧凑' : 'Compact'}</button>
              </div>
              <span className="prom-chip px-2.5 py-1 rounded-lg">{language === 'zh' ? '窗口' : 'Window'}: {monitorTrendRange.start_time ? (language === 'zh' ? '自定义' : 'Custom') : '24h'}</span>
              <span className="prom-chip px-2.5 py-1 rounded-lg">{(monitorTrend?.resolution || monitorTrendResolution).toUpperCase()}</span>
              <span className="prom-chip px-2.5 py-1 rounded-lg">{language === 'zh' ? '指标' : 'Metrics'}: {selectedMetricDefs.length}</span>
            </div>
          </div>
          <div className="prom-expression monitoring-data text-[12px] px-3 py-2 rounded-lg border border-black/10 bg-[#f8fafc] text-[#334155] overflow-auto">
            {promExpressionLabel}
          </div>
          <div className={`prom-toolbar rounded-xl border border-black/10 ${isCompactTrend ? 'p-2.5 space-y-2' : 'p-3 space-y-3'}`}>
            <div className="flex flex-wrap items-center gap-2">
              {[{ h: 0.25, labelZh: '15分钟', labelEn: '15m' }, { h: 1, labelZh: '1小时', labelEn: '1h' }, { h: 6, labelZh: '6小时', labelEn: '6h' }, { h: 24, labelZh: '24小时', labelEn: '24h' }].map((preset) => <button key={preset.labelEn} type="button" onClick={() => applyQuickRange(preset.h)} className="prom-btn px-2.5 py-1.5 text-xs rounded-lg">{language === 'zh' ? preset.labelZh : preset.labelEn}</button>)}
              <div className="h-5 w-px bg-black/10 mx-1" />
              <select value={monitorTrendInterface} onChange={(e) => setMonitorTrendInterface(e.target.value)} disabled={!monitorSelectedDevice} className="prom-select rounded-lg px-2.5 py-1.5 text-xs outline-none disabled:opacity-50" title={language === 'zh' ? '接口维度' : 'Interface dimension'}><option value="">{language === 'zh' ? '整机总量' : 'Device Aggregate'}</option>{interfaceOptions.map((name: string) => <option key={name} value={name}>{name}</option>)}</select>
              <select value={monitorTrendResolution} onChange={(e) => setMonitorTrendResolution(e.target.value as '1m' | '5m')} disabled={!monitorSelectedDevice} className="prom-select rounded-lg px-2.5 py-1.5 text-xs outline-none disabled:opacity-50" title={language === 'zh' ? '趋势分辨率' : 'Trend resolution'}><option value="1m">{language === 'zh' ? '1分钟' : '1 Minute'}</option><option value="5m">{language === 'zh' ? '5分钟' : '5 Minutes'}</option></select>
              <button type="button" onClick={() => { setMonitorTrendZoom(null); setMonitorTrendDragStart(null); setMonitorTrendDragEnd(null); }} disabled={!zoomActive || chartData.length === 0} className="prom-btn px-2.5 py-1.5 text-xs rounded-lg disabled:opacity-40">{language === 'zh' ? '重置缩放' : 'Reset Zoom'}</button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_auto_auto] gap-2">
              <input type="datetime-local" value={monitorTrendStartInput} onChange={(e) => setMonitorTrendStartInput(e.target.value)} className="prom-input rounded-lg px-2.5 py-1.5 text-xs outline-none" title={language === 'zh' ? '开始时间' : 'Start time'} />
              <input type="datetime-local" value={monitorTrendEndInput} onChange={(e) => setMonitorTrendEndInput(e.target.value)} className="prom-input rounded-lg px-2.5 py-1.5 text-xs outline-none" title={language === 'zh' ? '结束时间' : 'End time'} />
              <button type="button" onClick={() => { if (!monitorTrendStartInput || !monitorTrendEndInput) { showToast(language === 'zh' ? '请先选择开始和结束时间' : 'Please choose both start and end time', 'error'); return; } const startIso = toUtcIso(monitorTrendStartInput); const endIso = toUtcIso(monitorTrendEndInput); if (!startIso || !endIso || new Date(startIso).getTime() >= new Date(endIso).getTime()) { showToast(language === 'zh' ? '时间范围无效' : 'Invalid time range', 'error'); return; } setMonitorTrendZoom(null); setMonitorTrendDragStart(null); setMonitorTrendDragEnd(null); setMonitorTrendRange({ start_time: startIso, end_time: endIso }); }} className="prom-btn prom-btn-primary px-3 py-1.5 text-xs rounded-lg">{language === 'zh' ? '查询范围' : 'Apply Range'}</button>
              <button type="button" onClick={() => { setMonitorTrendStartInput(''); setMonitorTrendEndInput(''); setMonitorTrendZoom(null); setMonitorTrendDragStart(null); setMonitorTrendDragEnd(null); setMonitorTrendRange({}); }} className="prom-btn px-3 py-1.5 text-xs rounded-lg">{language === 'zh' ? '最近24小时' : 'Last 24h'}</button>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="prom-series-row">
              {trendMetricDefs.map((m) => {
                const active = monitorTrendMetrics.includes(m.key);
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => toggleTrendMetric(m.key)}
                    className={`prom-series-toggle ${active ? 'is-active' : ''}`}
                    title={m.label}
                  >
                    <span className={`prom-series-check ${active ? 'is-checked' : ''}`}>{active ? '✓' : ''}</span>
                    <span className={`monitoring-dot monitoring-dot-${m.key}`} />
                    <span className="prom-series-text">{m.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="inline-flex items-center gap-1.5">
              <button
                type="button"
                onClick={selectAllTrendMetrics}
                className="px-2 py-1 rounded-lg border border-black/10 text-[10px] font-semibold text-black/55 hover:bg-black/[0.03]"
              >
                {language === 'zh' ? '全选' : 'Select All'}
              </button>
              <button
                type="button"
                onClick={clearAllTrendMetrics}
                className="px-2 py-1 rounded-lg border border-black/10 text-[10px] font-semibold text-black/55 hover:bg-black/[0.03]"
              >
                {language === 'zh' ? '全取消' : 'Clear All'}
              </button>
            </div>
          </div>
          {!isCompactTrend && latestPoint && selectedMetricDefs.length > 0 && <div className="flex flex-wrap gap-2 text-[11px]">{selectedMetricDefs.map((m) => <span key={`latest-${m.key}`} className="px-2.5 py-1.5 rounded-lg border border-black/10 bg-white text-black/70 flex items-center gap-2"><span className={`monitoring-dot monitoring-dot-${m.key}`} /><span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/45">{m.short}</span><span className="monitoring-data text-[13px] font-semibold text-[#12263f]">{fmtMetricValue(m, (latestPoint as any)[m.key])}</span></span>)}</div>}
          {latestPoint && selectedMetricDefs.length > 0 && <div className="prom-readout-line monitoring-data">
            <span className="prom-readout-label">now()</span>
            <span className="prom-readout-divider" />
            <span className="prom-readout-item prom-readout-item-in"><span className="prom-readout-name">IN</span><span className="prom-readout-number">{latestInSummary.value}</span><span className="prom-readout-unit">{latestInSummary.unit}</span></span>
            <span className="prom-readout-divider" />
            <span className="prom-readout-item prom-readout-item-out"><span className="prom-readout-name">OUT</span><span className="prom-readout-number">{latestOutSummary.value}</span><span className="prom-readout-unit">{latestOutSummary.unit}</span></span>
            {isCompactTrend && <><span className="prom-readout-divider" /><span className="prom-readout-label">{formatPromTimestamp(latestPoint.ts)}</span></>}
          </div>}
          {selectedMetricDefs.length > 0 && <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
            <span>{language === 'zh' ? '范围' : 'Range'}:</span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold tracking-[0.02em] text-slate-600">{`${formatPromTimestamp(windowStartPoint?.ts)} -> ${formatPromTimestamp(latestPoint?.ts)}`}</span>
            <span>{isCompactTrend ? (language === 'zh' ? `${displayedChartData.length} 点` : `${displayedChartData.length} pts`) : (language === 'zh' ? `共 ${displayedChartData.length} 个点，可直接在图面按住拖拽缩放。` : `${displayedChartData.length} points in view. Drag directly inside the chart to zoom.`)}</span>
          </div>}
          <div className={`${isCompactTrend ? 'h-[250px]' : 'h-[300px]'} rounded-xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-2 monitoring-chart-frame`}>
            {showChart ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={displayedChartData} margin={{ top: 12, right: 16, left: 8, bottom: !zoomActive && chartData.length > 12 ? 18 : 0 }} onMouseDown={(state: any) => { const localIndex = Number(state?.activeTooltipIndex); if (!Number.isInteger(localIndex)) return; const globalIndex = dragBaseIndex + localIndex; setMonitorTrendDragStart(globalIndex); setMonitorTrendDragEnd(globalIndex); }} onMouseMove={(state: any) => { if (monitorTrendDragStart == null) return; const localIndex = Number(state?.activeTooltipIndex); if (!Number.isInteger(localIndex)) return; const globalIndex = dragBaseIndex + localIndex; setMonitorTrendDragEnd(globalIndex); }} onMouseUp={() => { if (monitorTrendDragStart == null || monitorTrendDragEnd == null) return; const startIndex = Math.max(0, Math.min(monitorTrendDragStart, monitorTrendDragEnd)); const endIndex = Math.min(fullEndIndex, Math.max(monitorTrendDragStart, monitorTrendDragEnd)); if (endIndex - startIndex >= 2) { setMonitorTrendZoom({ startIndex, endIndex }); } setMonitorTrendDragStart(null); setMonitorTrendDragEnd(null); }} onMouseLeave={() => { if (monitorTrendDragStart == null || monitorTrendDragEnd == null) return; setMonitorTrendDragStart(null); setMonitorTrendDragEnd(null); }}><CartesianGrid strokeDasharray="2 4" vertical={false} stroke="#dbe4ee" /><XAxis dataKey="ts" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#60748a' }} minTickGap={isCompactTrend ? 44 : 30} tickCount={axisTickCount} interval="preserveStartEnd" tickFormatter={(v) => formatPromAxisTimestamp(String(v), displayedRangeMs)} /><YAxis hide={!hasThroughputMetric} yAxisId="throughput" width={84} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#60748a' }} tickFormatter={(v) => fmtThroughputAxis(Number(v))} /><YAxis hide={!hasCountMetric} yAxisId="count" width={72} orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#60748a' }} tickFormatter={(v) => Number(v || 0).toLocaleString()} /><Tooltip contentStyle={{ borderRadius: 14, borderColor: '#d9e3ef', boxShadow: '0 18px 38px rgba(15,23,42,0.12)', padding: '14px 16px', background: 'rgba(255,255,255,0.96)' }} labelStyle={{ color: '#10233a', fontWeight: 700, fontSize: 13, letterSpacing: '-0.01em' }} itemStyle={{ fontSize: 12, fontWeight: 600, paddingTop: 2, paddingBottom: 2 }} labelFormatter={(_, payload: any) => { const row = payload?.[0]?.payload; if (row?.ts) return formatPromTimestamp(row.ts); return _; }} formatter={(v: any, _n: any, entry: any) => { const metricKey = String(entry?.dataKey || ''); const def = trendMetricMap[metricKey as keyof typeof trendMetricMap]; if (v == null || !Number.isFinite(Number(v))) return [language === 'zh' ? '无样本' : 'No sample', def?.short || metricKey || String(_n)]; if (def?.unit === 'throughput') return [fmtThroughputProm(Number(v)), def.short]; return [Number(v).toLocaleString(), def?.short || metricKey || String(_n)]; }} />{selectedMetricDefs.map((m) => <Area key={m.key} type="monotone" dataKey={m.key} yAxisId={m.unit === 'throughput' ? 'throughput' : 'count'} stroke={m.color} fill={`${m.color}1f`} strokeWidth={2.2} name={m.short} isAnimationActive={false} connectNulls={false} />)} {!zoomActive && chartData.length > 12 && <Brush dataKey="ts" height={26} travellerWidth={10} startIndex={0} endIndex={fullEndIndex} stroke="#94a3b8" fill="#eef2f6" tickFormatter={(v: any) => formatPromAxisTimestamp(String(v), displayedRangeMs)} onChange={(next: any) => { const startIndex = Number(next?.startIndex); const endIndex = Number(next?.endIndex); if (!Number.isInteger(startIndex) || !Number.isInteger(endIndex)) return; if (startIndex <= 0 && endIndex >= fullEndIndex) { setMonitorTrendZoom(null); return; } setMonitorTrendZoom({ startIndex, endIndex }); }} />}</AreaChart></ResponsiveContainer> : monitorSelectedDevice && selectedMetricDefs.length === 0 ? <div className="h-full" /> : monitorSelectedDevice && hasTrendResponse && chartData.length === 0 ? <div className="h-full flex items-center justify-center text-sm text-black/35">{language === 'zh' ? '该时间范围暂无趋势数据。' : 'No trend data in the selected time range.'}</div> : <div className="h-full flex items-center justify-center text-sm text-black/35">{language === 'zh' ? '选择设备后查看趋势。' : 'Select a device to view trend.'}</div>}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-black/5 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold">{language === 'zh' ? '告警时间线' : 'Alert Timeline'}</h3>
            <p className="text-xs text-black/40">{language === 'zh' ? '包含触发与恢复，支持分页。' : 'Includes trigger and recover lifecycle with pagination.'}</p>
          </div>
          <div className="flex items-center gap-2">
            <select title={language === 'zh' ? '按告警级别筛选' : 'Filter alerts by severity'} value={monitorAlertsSeverity} onChange={(e) => setMonitorAlertsSeverity(e.target.value)} className="bg-black/[0.02] border border-black/10 rounded-lg px-2.5 py-1.5 text-xs outline-none"><option value="all">{language === 'zh' ? '全部' : 'All'}</option><option value="critical">{language === 'zh' ? '严重' : 'Critical'}</option><option value="major">{language === 'zh' ? '主要' : 'Major'}</option><option value="minor">{language === 'zh' ? '次要' : 'Minor'}</option></select>
          </div>
        </div>
        <div className="overflow-auto"><table className="w-full text-xs"><thead className="bg-black/[0.02]"><tr><th className="px-4 py-2 text-left text-[10px] uppercase tracking-wider text-black/40">{language === 'zh' ? '时间' : 'Time'}</th><th className="px-4 py-2 text-left text-[10px] uppercase tracking-wider text-black/40">{language === 'zh' ? '级别' : 'Severity'}</th><th className="px-4 py-2 text-left text-[10px] uppercase tracking-wider text-black/40">{language === 'zh' ? '标题' : 'Title'}</th><th className="px-4 py-2 text-left text-[10px] uppercase tracking-wider text-black/40">{language === 'zh' ? '内容' : 'Message'}</th><th className="px-4 py-2 text-left text-[10px] uppercase tracking-wider text-black/40">{language === 'zh' ? '恢复时间' : 'Recovered'}</th></tr></thead><tbody className="divide-y divide-black/5">{monitorAlerts.map((a: any) => <tr key={a.id} className="hover:bg-black/[0.01]"><td className="px-4 py-2 text-black/50">{a.created_at ? formatTs(a.created_at, true) : '-'}</td><td className="px-4 py-2"><span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${String(a.severity).toLowerCase() === 'critical' ? 'bg-red-100 text-red-700' : String(a.severity).toLowerCase() === 'major' ? 'bg-orange-100 text-orange-700' : 'bg-black/5 text-black/55'}`}>{severityLabel(a.severity)}</span></td><td className="px-4 py-2 font-semibold text-black/75">{a.title}</td><td className="px-4 py-2 text-black/55">{a.message}</td><td className="px-4 py-2 text-black/55">{a.resolved_at ? formatTs(a.resolved_at, true) : '-'}</td></tr>)}{monitorAlerts.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-black/35">{language === 'zh' ? '当前无告警记录。' : 'No alert records found.'}</td></tr>}</tbody></table></div>
        <MonitoringPagination language={language} currentPage={monitorAlertsPage} totalItems={monitorAlertTotal} itemsPerPage={monitorAlertsPageSize} onPageChange={setMonitorAlertsPage} />
      </div>
    </div>
  );
};

export default MonitoringCenter;