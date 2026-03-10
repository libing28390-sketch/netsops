import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Edit3, Plus, RefreshCw, Save, Trash2, X, Search } from 'lucide-react';
import type { AlertRuleListResponse, AlertRuleSettings } from '../types';
import Pagination from '../components/Pagination';
import { severityBadgeClass } from '../components/shared';
import {
  ALERT_SEVERITY_OPTIONS,
  alertDangerButtonClass,
  alertInputClass,
  alertPanelClass,
  alertPrimaryButtonClass,
  alertSecondaryButtonClass,
  alertTableActionButtonClass,
  AlertPageCommonProps,
  buildEmptyRule,
  formatTs,
  metricTypeLabel,
  scopeMatchModeLabel,
  scopeTypeLabel,
  severityLabel,
  useAlertOverlayDismiss,
} from './alertManagementShared';

const AlertRulesTab: React.FC<AlertPageCommonProps> = ({ language, currentUsername, showToast }) => {
  const [alertRules, setAlertRules] = useState<AlertRuleSettings[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [enabledFilter, setEnabledFilter] = useState('all');
  const [ruleDraft, setRuleDraft] = useState<AlertRuleSettings | null>(null);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadAlertRules = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
        search,
        enabled: enabledFilter,
      });
      const resp = await fetch(`/api/alerts/rules?${params.toString()}`);
      if (!resp.ok) throw new Error('Failed to load alert rules');
      const data: AlertRuleListResponse = await resp.json();
      setAlertRules(data.items || []);
      setTotal(data.total || 0);
      if (editingRuleId && !data.items.some((item) => item.id === editingRuleId)) {
        setEditingRuleId(null);
        setRuleDraft(null);
      }
    } catch (error) {
      console.error(error);
      showToast(language === 'zh' ? '加载告警规则失败' : 'Failed to load alert rules', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAlertRules();
  }, [page, pageSize, search, enabledFilter]);

  const openCreate = () => {
    setEditingRuleId(null);
    setRuleDraft(buildEmptyRule(currentUsername));
  };

  const openEdit = (rule: AlertRuleSettings) => {
    setEditingRuleId(rule.id || null);
    setRuleDraft({ ...rule });
  };

  const closeEditor = () => {
    setEditingRuleId(null);
    setRuleDraft(null);
  };

  useAlertOverlayDismiss(Boolean(ruleDraft), closeEditor);

  const originalRule = useMemo(
    () => alertRules.find((item) => item.id === editingRuleId) || null,
    [alertRules, editingRuleId],
  );

  const isDirty = useMemo(() => {
    if (!ruleDraft) return false;
    if (!editingRuleId) {
      return JSON.stringify(ruleDraft) !== JSON.stringify(buildEmptyRule(currentUsername));
    }
    return JSON.stringify(ruleDraft) !== JSON.stringify(originalRule);
  }, [currentUsername, editingRuleId, originalRule, ruleDraft]);

  const updateRuleField = <K extends keyof AlertRuleSettings>(key: K, value: AlertRuleSettings[K]) => {
    setRuleDraft((prev) => {
      if (!prev) return prev;
      const next = { ...prev, [key]: value } as AlertRuleSettings;
      if (key === 'metric_type') {
        next.threshold = value === 'interface_down' ? null : (prev.threshold ?? 90);
      }
      if (key === 'scope_type' && value === 'global') {
        next.scope_value = '';
        next.scope_match_mode = 'exact';
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!ruleDraft) return;
    setSaving(true);
    try {
      const isCreate = !editingRuleId;
      const resp = await fetch(isCreate ? '/api/alerts/rules' : `/api/alerts/rules/${editingRuleId}`, {
        method: isCreate ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...ruleDraft,
          created_by: ruleDraft.created_by || currentUsername,
          updated_by: currentUsername,
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.detail || 'Failed to save alert rule');
      showToast(language === 'zh' ? '告警规则已保存' : 'Alert rule saved', 'success');
      closeEditor();
      setPage(1);
      await loadAlertRules();
    } catch (error: any) {
      showToast(error?.message || (language === 'zh' ? '保存告警规则失败' : 'Failed to save alert rule'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingRuleId) return;
    setSaving(true);
    try {
      const resp = await fetch(`/api/alerts/rules/${editingRuleId}?actor_username=${encodeURIComponent(currentUsername)}`, {
        method: 'DELETE',
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.detail || 'Failed to delete alert rule');
      showToast(language === 'zh' ? '告警规则已删除' : 'Alert rule deleted', 'success');
      closeEditor();
      await loadAlertRules();
    } catch (error: any) {
      showToast(error?.message || (language === 'zh' ? '删除告警规则失败' : 'Failed to delete alert rule'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (!ruleDraft) return;
    if (!editingRuleId) {
      setRuleDraft(buildEmptyRule(currentUsername));
      return;
    }
    if (originalRule) {
      setRuleDraft({ ...originalRule });
    }
  };

  return (
    <div className="space-y-4">
      <div className={alertPanelClass}>
        <div className="flex flex-col gap-4 border-b border-black/5 px-5 py-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/35">
              {language === 'zh' ? '告警中心 / 告警规则' : 'Alert Center / Alert Rules'}
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-[#0b2340]">
              {language === 'zh' ? '当前规则' : 'Current Rules'}
            </h2>
            <p className="mt-2 text-sm text-black/50">
              {language === 'zh' ? '只保留列表、筛选、分页和规则编辑。' : 'A plain management page with list, filters, pagination, and rule editing.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => void loadAlertRules()} className={alertSecondaryButtonClass}>
              <RefreshCw size={14} />
              {language === 'zh' ? '刷新' : 'Refresh'}
            </button>
            <button onClick={openCreate} className={alertPrimaryButtonClass}>
              <Plus size={14} />
              {language === 'zh' ? '新增规则' : 'New Rule'}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center">
          <label className="relative min-w-[240px] flex-1">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-black/30" />
            <input
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
              placeholder={language === 'zh' ? '搜索规则名称、类型、范围' : 'Search rule name, metric, scope'}
              className={`${alertInputClass} rounded-xl py-3 pl-9 pr-3`}
            />
          </label>
          <select
            title={language === 'zh' ? '按启用状态筛选规则' : 'Filter rules by enabled state'}
            value={enabledFilter}
            onChange={(e) => {
              setPage(1);
              setEnabledFilter(e.target.value);
            }}
            className="rounded-xl border border-black/10 bg-white px-3 py-3 text-sm text-[#0b2340] outline-none"
          >
            <option value="all">{language === 'zh' ? '全部状态' : 'All Status'}</option>
            <option value="enabled">{language === 'zh' ? '已启用' : 'Enabled'}</option>
            <option value="disabled">{language === 'zh' ? '已停用' : 'Disabled'}</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left">
            <thead>
              <tr className="border-y border-black/5 bg-[#f8fafc] text-[11px] font-bold uppercase tracking-[0.16em] text-black/40">
                <th className="px-5 py-3">{language === 'zh' ? '规则名称' : 'Rule'}</th>
                <th className="px-5 py-3">{language === 'zh' ? '监控类型' : 'Metric'}</th>
                <th className="px-5 py-3">{language === 'zh' ? '范围' : 'Scope'}</th>
                <th className="px-5 py-3">{language === 'zh' ? '阈值' : 'Threshold'}</th>
                <th className="px-5 py-3">{language === 'zh' ? '级别' : 'Severity'}</th>
                <th className="px-5 py-3">{language === 'zh' ? '状态' : 'Status'}</th>
                <th className="px-5 py-3">{language === 'zh' ? '更新时间' : 'Updated'} </th>
                <th className="px-5 py-3">{language === 'zh' ? '操作' : 'Action'}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-sm text-black/40">
                    {language === 'zh' ? '正在加载规则...' : 'Loading rules...'}
                  </td>
                </tr>
              ) : alertRules.length > 0 ? (
                alertRules.map((rule) => (
                  <tr key={rule.id} className="border-b border-black/5 hover:bg-black/[0.02]">
                    <td className="px-5 py-4 align-top">
                      <div>
                        <p className="text-sm font-semibold text-[#0b2340]">{rule.name}</p>
                        <p className="mt-1 text-xs text-black/40">{rule.id}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4 align-top text-sm text-black/60">{metricTypeLabel(rule.metric_type, language)}</td>
                    <td className="px-5 py-4 align-top text-sm text-black/60">
                      {scopeTypeLabel(rule.scope_type, language)}
                      {rule.scope_value ? ` / ${rule.scope_value}` : ''}
                    </td>
                    <td className="px-5 py-4 align-top text-sm text-black/60">
                      {rule.threshold != null ? `${rule.threshold}%` : (language === 'zh' ? '状态型' : 'State')}
                    </td>
                    <td className="px-5 py-4 align-top">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${severityBadgeClass(rule.severity)}`}>
                        {severityLabel(rule.severity, language)}
                      </span>
                    </td>
                    <td className="px-5 py-4 align-top text-sm text-black/60">
                      {rule.enabled ? (language === 'zh' ? '启用' : 'Enabled') : (language === 'zh' ? '停用' : 'Disabled')}
                    </td>
                    <td className="px-5 py-4 align-top text-sm text-black/60">{formatTs(rule.updated_at || rule.created_at)}</td>
                    <td className="px-5 py-4 align-top">
                      <button
                        title={language === 'zh' ? `编辑规则 ${rule.name}` : `Edit rule ${rule.name}`}
                        onClick={() => openEdit(rule)}
                        className={alertTableActionButtonClass}
                      >
                        <Edit3 size={14} />
                        {language === 'zh' ? '编辑' : 'Edit'}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-sm text-black/40">
                    {language === 'zh' ? '当前没有规则。' : 'No rules found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={page}
          totalItems={total}
          itemsPerPage={pageSize}
          onItemsPerPageChange={(value) => {
            setPage(1);
            setPageSize(value);
          }}
          onPageChange={setPage}
          language={language}
        />
      </div>

      <AnimatePresence>
        {ruleDraft ? (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                closeEditor();
              }
            }}
          >
            <motion.div
              className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-3xl bg-white shadow-2xl"
              initial={{ y: 18, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 18, opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              <div className="flex items-start justify-between gap-4 border-b border-black/5 px-6 py-5">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/35">
                    {editingRuleId
                      ? (language === 'zh' ? '编辑规则' : 'Edit Rule')
                      : (language === 'zh' ? '新增规则' : 'New Rule')}
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-[#0b2340]">
                    {ruleDraft.name || (language === 'zh' ? '未命名规则' : 'Untitled Rule')}
                  </h3>
                </div>
                <button title={language === 'zh' ? '关闭编辑器' : 'Close editor'} onClick={closeEditor} className="rounded-xl border border-black/10 p-2 text-black/55 hover:bg-black/[0.03]">
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-5 px-6 py-6">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="text-sm text-black/65">
                    <span>{language === 'zh' ? '规则名称' : 'Rule Name'}</span>
                    <input value={ruleDraft.name} onChange={(e) => updateRuleField('name', e.target.value)} className={`${alertInputClass} mt-2 rounded-xl px-3 py-2`} />
                  </label>
                  <label className="text-sm text-black/65">
                    <span>{language === 'zh' ? '监控类型' : 'Metric Type'}</span>
                    <select value={ruleDraft.metric_type} onChange={(e) => updateRuleField('metric_type', e.target.value as AlertRuleSettings['metric_type'])} className="mt-2 w-full rounded-xl border border-black/10 px-3 py-2 text-[#0b2340] outline-none">
                      <option value="cpu">{metricTypeLabel('cpu', language)}</option>
                      <option value="memory">{metricTypeLabel('memory', language)}</option>
                      <option value="interface_util">{metricTypeLabel('interface_util', language)}</option>
                      <option value="interface_down">{metricTypeLabel('interface_down', language)}</option>
                    </select>
                  </label>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <label className="text-sm text-black/65">
                    <span>{language === 'zh' ? '作用范围' : 'Scope'}</span>
                    <select value={ruleDraft.scope_type} onChange={(e) => updateRuleField('scope_type', e.target.value as AlertRuleSettings['scope_type'])} className="mt-2 w-full rounded-xl border border-black/10 px-3 py-2 text-[#0b2340] outline-none">
                      <option value="global">{scopeTypeLabel('global', language)}</option>
                      <option value="site">{scopeTypeLabel('site', language)}</option>
                      <option value="device">{scopeTypeLabel('device', language)}</option>
                      <option value="interface">{scopeTypeLabel('interface', language)}</option>
                    </select>
                  </label>
                  <label className="text-sm text-black/65">
                    <span>{language === 'zh' ? '匹配方式' : 'Match Mode'}</span>
                    <select value={ruleDraft.scope_match_mode} onChange={(e) => updateRuleField('scope_match_mode', e.target.value as AlertRuleSettings['scope_match_mode'])} disabled={ruleDraft.scope_type === 'global'} className="mt-2 w-full rounded-xl border border-black/10 px-3 py-2 text-[#0b2340] outline-none disabled:bg-black/[0.03]">
                      <option value="exact">{scopeMatchModeLabel('exact', language)}</option>
                      <option value="contains">{scopeMatchModeLabel('contains', language)}</option>
                      <option value="prefix">{scopeMatchModeLabel('prefix', language)}</option>
                      <option value="glob">{scopeMatchModeLabel('glob', language)}</option>
                    </select>
                  </label>
                  <label className="text-sm text-black/65">
                    <span>{language === 'zh' ? '范围值' : 'Scope Value'}</span>
                    <input value={ruleDraft.scope_value} onChange={(e) => updateRuleField('scope_value', e.target.value)} disabled={ruleDraft.scope_type === 'global'} className={`${alertInputClass} mt-2 rounded-xl px-3 py-2 disabled:bg-black/[0.03]`} />
                  </label>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <label className="text-sm text-black/65">
                    <span>{language === 'zh' ? '告警级别' : 'Severity'}</span>
                    <select value={ruleDraft.severity} onChange={(e) => updateRuleField('severity', e.target.value as AlertRuleSettings['severity'])} className="mt-2 w-full rounded-xl border border-black/10 px-3 py-2 text-[#0b2340] outline-none">
                      {ALERT_SEVERITY_OPTIONS.map((severity) => (
                        <option key={severity} value={severity}>{severityLabel(severity, language)}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm text-black/65">
                    <span>{language === 'zh' ? '阈值 (%)' : 'Threshold (%)'}</span>
                    <input type="number" min="0" max="100" value={ruleDraft.threshold ?? ''} onChange={(e) => updateRuleField('threshold', e.target.value === '' ? null : Number(e.target.value))} disabled={ruleDraft.metric_type === 'interface_down'} className={`${alertInputClass} mt-2 rounded-xl px-3 py-2 disabled:bg-black/[0.03]`} />
                  </label>
                  <label className="text-sm text-black/65">
                    <span>{language === 'zh' ? '重复通知窗口(秒)' : 'Quiet Window (sec)'}</span>
                    <input type="number" min="0" max="86400" value={ruleDraft.notification_repeat_window_seconds} onChange={(e) => updateRuleField('notification_repeat_window_seconds', Number(e.target.value))} className={`${alertInputClass} mt-2 rounded-xl px-3 py-2`} />
                  </label>
                </div>

                <label className="flex items-center gap-3 rounded-2xl bg-[#f7f8fb] px-4 py-3 text-sm text-black/65">
                  <input type="checkbox" checked={ruleDraft.enabled} onChange={(e) => updateRuleField('enabled', e.target.checked)} />
                  <span>{language === 'zh' ? '启用此规则' : 'Enable this rule'}</span>
                </label>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/5 px-6 py-4">
                <div className="text-sm text-black/45">
                  {isDirty
                    ? (language === 'zh' ? '你有未保存的改动。' : 'You have unsaved changes.')
                    : (language === 'zh' ? '当前没有未保存改动。' : 'No unsaved changes.')}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button disabled={!isDirty} onClick={handleReset} className={alertSecondaryButtonClass}>
                    {language === 'zh' ? '重置' : 'Reset'}
                  </button>
                  {editingRuleId ? (
                    <button onClick={() => void handleDelete()} className={alertDangerButtonClass}>
                      <Trash2 size={14} />
                      {language === 'zh' ? '删除' : 'Delete'}
                    </button>
                  ) : null}
                  <button disabled={saving || !isDirty} onClick={() => void handleSave()} className={alertPrimaryButtonClass}>
                    <Save size={14} />
                    {saving ? (language === 'zh' ? '保存中...' : 'Saving...') : (language === 'zh' ? '保存' : 'Save')}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};

export default AlertRulesTab;
