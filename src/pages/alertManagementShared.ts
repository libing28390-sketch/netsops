import { useEffect } from 'react';
import type { AlertRecord, AlertRuleScopeMatchMode, AlertRuleScopeType, AlertRuleSettings } from '../types';

export type AlertSection = 'alerts' | 'alert-rules' | 'maintenance';

export interface AlertPageCommonProps {
  language: string;
  currentUsername: string;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  activeAlertSection: AlertSection;
  onNavigateAlertSection: (section: AlertSection) => void;
}

export interface MaintenanceFormState {
  name: string;
  target_ip: string;
  title_pattern: string;
  message_pattern: string;
  starts_at: string;
  ends_at: string;
  reason: string;
  notify_user_ids: string[];
}

export const alertHeroClass = 'overflow-hidden rounded-[28px] border border-[#07233d]/10 bg-[linear-gradient(135deg,#f4fbff_0%,#ffffff_58%,#eef6ec_100%)] shadow-[0_18px_40px_rgba(11,35,64,0.08)]';
export const alertPanelClass = 'rounded-[28px] border border-black/5 bg-white shadow-[0_16px_36px_rgba(11,35,64,0.06)]';
export const alertPanelHeaderClass = 'border-b border-black/5 px-5 py-5 lg:px-6';
export const alertSubtleCardClass = 'rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur';
export const alertPrimaryButtonClass = 'inline-flex items-center gap-2 rounded-xl bg-[#00172d] px-4 py-2 text-sm font-medium text-white hover:bg-[#0b2340] disabled:opacity-50';
export const alertSecondaryButtonClass = 'inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-medium text-black/70 hover:bg-black/[0.02] disabled:opacity-50';
export const alertAccentButtonClass = 'inline-flex items-center gap-2 rounded-xl border border-[#00bceb]/20 bg-[#ebfbff] px-4 py-2 text-sm font-medium text-[#0b6b83] hover:bg-[#dff7fd] disabled:opacity-50';
export const alertInputClass = 'w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-[#0b2340] outline-none placeholder:text-black/30';
export const alertStatTileClass = 'rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur';
export const alertMetricPillClass = 'rounded-full bg-[#00bceb]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#0b6b83]';

export const getAlertSectionTabs = (language: string): Array<{ id: AlertSection; groupLabel: string; label: string; description: string }> => ([
  {
    id: 'alerts',
    groupLabel: language === 'zh' ? '告警中心' : 'Alert Center',
    label: language === 'zh' ? '告警信息' : 'Alert Desk',
    description: language === 'zh' ? '筛选、分派和处置活跃告警' : 'Triage, assign, and document active alerts',
  },
  {
    id: 'alert-rules',
    groupLabel: language === 'zh' ? '告警中心' : 'Alert Center',
    label: language === 'zh' ? '告警规则' : 'Alert Rules',
    description: language === 'zh' ? '管理规则作用范围与通知节奏' : 'Control rule scope and notification cadence',
  },
  {
    id: 'maintenance',
    groupLabel: language === 'zh' ? '告警中心' : 'Alert Center',
    label: language === 'zh' ? '维护期' : 'Maintenance',
    description: language === 'zh' ? '创建静默窗口并复核覆盖范围' : 'Create suppression windows and review coverage',
  },
]);

export const useAlertOverlayDismiss = (open: boolean, onClose: () => void) => {
  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);
};

export const formatTs = (value?: string | null) => {
  if (!value) return '--';
  const normalized = value.includes('T') || value.endsWith('Z') ? value : value.replace(' ', 'T');
  const dt = new Date(normalized);
  if (Number.isNaN(dt.getTime())) return value;

  const year = dt.getFullYear();
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  const hours = String(dt.getHours()).padStart(2, '0');
  const minutes = String(dt.getMinutes()).padStart(2, '0');
  const seconds = String(dt.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

export const formatDuration = (seconds?: number | null, language = 'en') => {
  if (seconds == null || !Number.isFinite(seconds)) return '--';
  const total = Math.max(0, Math.round(seconds));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (days > 0) return language === 'zh' ? `${days}天 ${hours}小时` : `${days}d ${hours}h`;
  if (hours > 0) return language === 'zh' ? `${hours}小时 ${minutes}分钟` : `${hours}h ${minutes}m`;
  return language === 'zh' ? `${minutes}分钟` : `${minutes}m`;
};

export const workflowLabel = (status: string, language: string) => {
  switch (status) {
    case 'acknowledged': return language === 'zh' ? '已确认' : 'Acknowledged';
    case 'investigating': return language === 'zh' ? '处理中' : 'Investigating';
    case 'suppressed': return language === 'zh' ? '维护抑制' : 'Suppressed';
    case 'resolved': return language === 'zh' ? '已恢复' : 'Resolved';
    default: return language === 'zh' ? '待处理' : 'Open';
  }
};

export const severityLabel = (severity: string, language: string) => {
  switch (severity) {
    case 'critical': return language === 'zh' ? '严重' : 'Critical';
    case 'major': return language === 'zh' ? '主要' : 'Major';
    case 'warning': return language === 'zh' ? '预警' : 'Warning';
    case 'high': return language === 'zh' ? '高危' : 'High';
    case 'medium': return language === 'zh' ? '中等' : 'Medium';
    case 'info': return language === 'zh' ? '信息' : 'Info';
    default: return language === 'zh' ? '低' : 'Low';
  }
};

export const maintenanceStatusLabel = (status: string, language: string) => {
  switch (status) {
    case 'active': return language === 'zh' ? '生效中' : 'Active';
    case 'scheduled': return language === 'zh' ? '待生效' : 'Scheduled';
    case 'expired': return language === 'zh' ? '已结束' : 'Expired';
    case 'cancelled': return language === 'zh' ? '已取消' : 'Cancelled';
    default: return status;
  }
};

export const maintenanceBadgeClass = (status: string) => {
  switch (status) {
    case 'active': return 'bg-red-100 text-red-700';
    case 'scheduled': return 'bg-blue-100 text-blue-700';
    case 'expired': return 'bg-slate-100 text-slate-700';
    case 'cancelled': return 'bg-zinc-100 text-zinc-600';
    default: return 'bg-slate-100 text-slate-700';
  }
};

export const buildDefaultMaintenanceForm = (selectedItem?: AlertRecord | null): MaintenanceFormState => {
  const now = new Date();
  const start = new Date(now.getTime() + 5 * 60 * 1000);
  const end = new Date(now.getTime() + 65 * 60 * 1000);
  const toLocalInput = (value: Date) => {
    const offset = value.getTimezoneOffset();
    const local = new Date(value.getTime() - offset * 60 * 1000);
    return local.toISOString().slice(0, 16);
  };

  return {
    name: selectedItem ? `${selectedItem.hostname || selectedItem.ip_address || 'Alert'} Maintenance` : '',
    target_ip: selectedItem?.ip_address || '',
    title_pattern: selectedItem?.title || '',
    message_pattern: selectedItem?.interface_name || '',
    starts_at: toLocalInput(start),
    ends_at: toLocalInput(end),
    reason: '',
    notify_user_ids: [],
  };
};

export const buildEmptyRule = (username: string): AlertRuleSettings => ({
  name: '',
  metric_type: 'cpu',
  scope_type: 'global',
  scope_match_mode: 'exact',
  scope_value: '',
  severity: 'major',
  threshold: 90,
  enabled: true,
  aggregation_mode: 'dedupe_key',
  notification_repeat_window_seconds: 120,
  notify_on_active: true,
  notify_on_recovery: true,
  notify_on_reopen_after_maintenance: true,
  created_by: username,
  updated_by: username,
});

export const metricTypeLabel = (metricType: AlertRuleSettings['metric_type'], language: string) => {
  switch (metricType) {
    case 'cpu': return language === 'zh' ? 'CPU 利用率' : 'CPU Usage';
    case 'memory': return language === 'zh' ? '内存利用率' : 'Memory Usage';
    case 'interface_util': return language === 'zh' ? '接口利用率' : 'Interface Utilization';
    case 'interface_down': return language === 'zh' ? '接口 DOWN' : 'Interface Down';
    default: return metricType;
  }
};

export const scopeTypeLabel = (scopeType: AlertRuleScopeType, language: string) => {
  switch (scopeType) {
    case 'site': return language === 'zh' ? '站点' : 'Site';
    case 'device': return language === 'zh' ? '设备' : 'Device';
    case 'interface': return language === 'zh' ? '接口' : 'Interface';
    default: return language === 'zh' ? '全局' : 'Global';
  }
};

export const scopeMatchModeLabel = (matchMode: AlertRuleScopeMatchMode, language: string) => {
  switch (matchMode) {
    case 'contains': return language === 'zh' ? '包含' : 'Contains';
    case 'prefix': return language === 'zh' ? '前缀' : 'Prefix';
    case 'glob': return language === 'zh' ? '通配' : 'Wildcard';
    default: return language === 'zh' ? '精确' : 'Exact';
  }
};