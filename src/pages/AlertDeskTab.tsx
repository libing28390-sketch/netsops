import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, Eye, RefreshCw, Search, Wrench, X } from 'lucide-react';
import type { AlertDetailResponse, AlertListResponse, AlertRecord } from '../types';
import Pagination from '../components/Pagination';
import { alertWorkflowBadgeClass, severityBadgeClass } from '../components/shared';
import {
  alertAccentButtonClass,
  alertInputClass,
  alertPanelClass,
  alertPrimaryButtonClass,
  alertSecondaryButtonClass,
  alertTableActionButtonClass,
  AlertPageCommonProps,
  formatDuration,
  formatTs,
  severityLabel,
  useAlertOverlayDismiss,
  workflowLabel,
} from './alertManagementShared';

interface AlertDeskTabProps extends AlertPageCommonProps {
  onOpenMaintenanceForAlert?: (alert: AlertRecord | null) => void;
}

const AlertDeskTab: React.FC<AlertDeskTabProps> = ({ language, currentUsername, showToast, onOpenMaintenanceForAlert }) => {
  const [rows, setRows] = useState<AlertRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [statusFilter, setStatusFilter] = useState('open');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<AlertDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailNote, setDetailNote] = useState('');
  const [assignValue, setAssignValue] = useState('');
  const [actionLoading, setActionLoading] = useState<'ack' | 'assign' | 'note' | null>(null);

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
        status: statusFilter,
        severity: severityFilter,
        site: 'all',
        assignee: 'all',
        search,
      });
      const resp = await fetch(`/api/alerts?${params.toString()}`);
      if (!resp.ok) throw new Error('Failed to load alerts');
      const data: AlertListResponse = await resp.json();
      setRows(data.items || []);
      setTotal(data.total || 0);
      if (selectedAlertId && !data.items.some((item) => item.id === selectedAlertId)) {
        setSelectedAlertId(null);
        setSelectedDetail(null);
      }
    } catch (error) {
      console.error(error);
      showToast(language === 'zh' ? '加载告警列表失败' : 'Failed to load alerts', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (alertId: string) => {
    setDetailLoading(true);
    try {
      const resp = await fetch(`/api/alerts/${alertId}`);
      if (!resp.ok) throw new Error('Failed to load alert detail');
      const data: AlertDetailResponse = await resp.json();
      setSelectedDetail(data);
      setDetailNote(data.item.note || '');
      setAssignValue(data.item.assignee || currentUsername || '');
    } catch (error) {
      console.error(error);
      showToast(language === 'zh' ? '加载告警详情失败' : 'Failed to load alert detail', 'error');
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    void loadAlerts();
  }, [page, pageSize, search, severityFilter, statusFilter]);

  useEffect(() => {
    if (!selectedAlertId) return;
    void loadDetail(selectedAlertId);
  }, [selectedAlertId]);

  const closeDetail = () => {
    setSelectedAlertId(null);
    setSelectedDetail(null);
  };

  useAlertOverlayDismiss(Boolean(selectedAlertId), closeDetail);

  const refreshAll = async () => {
    await loadAlerts();
    if (selectedAlertId) {
      await loadDetail(selectedAlertId);
    }
  };

  const handleAck = async (nextStatus: 'acknowledged' | 'investigating') => {
    if (!selectedDetail?.item) return;
    setActionLoading('ack');
    try {
      const resp = await fetch(`/api/alerts/${selectedDetail.item.id}/ack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actor_username: currentUsername, status: nextStatus }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.detail || 'Failed to acknowledge alert');
      showToast(language === 'zh' ? '告警状态已更新' : 'Alert status updated', 'success');
      await refreshAll();
    } catch (error: any) {
      showToast(error?.message || (language === 'zh' ? '更新告警状态失败' : 'Failed to update alert status'), 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleAssign = async () => {
    if (!selectedDetail?.item || !assignValue.trim()) return;
    setActionLoading('assign');
    try {
      const resp = await fetch(`/api/alerts/${selectedDetail.item.id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actor_username: currentUsername, assignee: assignValue.trim() }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.detail || 'Failed to assign alert');
      showToast(language === 'zh' ? '告警已分派' : 'Alert assigned', 'success');
      await refreshAll();
    } catch (error: any) {
      showToast(error?.message || (language === 'zh' ? '分派告警失败' : 'Failed to assign alert'), 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSaveNote = async () => {
    if (!selectedDetail?.item) return;
    setActionLoading('note');
    try {
      const resp = await fetch(`/api/alerts/${selectedDetail.item.id}/note`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actor_username: currentUsername, note: detailNote }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.detail || 'Failed to update note');
      showToast(language === 'zh' ? '处置备注已保存' : 'Alert note saved', 'success');
      await refreshAll();
    } catch (error: any) {
      showToast(error?.message || (language === 'zh' ? '保存备注失败' : 'Failed to save note'), 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const selectedItem = selectedDetail?.item || null;

  return (
    <div className="space-y-4">
      <div className={alertPanelClass}>
        <div className="flex flex-col gap-4 border-b border-black/5 px-5 py-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/35">
              {language === 'zh' ? '告警中心 / 告警信息' : 'Alert Center / Alert Desk'}
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-[#0b2340]">
              {language === 'zh' ? '当前告警' : 'Current Alerts'}
            </h2>
            <p className="mt-2 text-sm text-black/50">
              {language === 'zh' ? '只保留筛选、列表、分页和必要操作。' : 'A simple page with filters, list, pagination, and essential actions.'}
            </p>
          </div>
          <button onClick={() => void loadAlerts()} className={alertSecondaryButtonClass}>
            <RefreshCw size={14} />
            {language === 'zh' ? '刷新列表' : 'Refresh'}
          </button>
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
              placeholder={language === 'zh' ? '搜索标题、设备、接口、IP' : 'Search title, device, interface, IP'}
              className={`${alertInputClass} rounded-xl py-3 pl-9 pr-3`}
            />
          </label>

          <select
            title={language === 'zh' ? '按状态筛选告警' : 'Filter alerts by status'}
            value={statusFilter}
            onChange={(e) => {
              setPage(1);
              setStatusFilter(e.target.value);
            }}
            className="rounded-xl border border-black/10 bg-white px-3 py-3 text-sm text-[#0b2340] outline-none"
          >
            <option value="open">{language === 'zh' ? '待处理' : 'Open'}</option>
            <option value="acknowledged">{language === 'zh' ? '已确认' : 'Acknowledged'}</option>
            <option value="investigating">{language === 'zh' ? '处理中' : 'Investigating'}</option>
            <option value="suppressed">{language === 'zh' ? '维护抑制' : 'Suppressed'}</option>
            <option value="resolved">{language === 'zh' ? '已恢复' : 'Resolved'}</option>
            <option value="all">{language === 'zh' ? '全部状态' : 'All Status'}</option>
          </select>

          <select
            title={language === 'zh' ? '按级别筛选告警' : 'Filter alerts by severity'}
            value={severityFilter}
            onChange={(e) => {
              setPage(1);
              setSeverityFilter(e.target.value);
            }}
            className="rounded-xl border border-black/10 bg-white px-3 py-3 text-sm text-[#0b2340] outline-none"
          >
            <option value="all">{language === 'zh' ? '全部级别' : 'All Severity'}</option>
            <option value="critical">{severityLabel('critical', language)}</option>
            <option value="major">{severityLabel('major', language)}</option>
            <option value="warning">{severityLabel('warning', language)}</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left">
            <thead>
              <tr className="border-y border-black/5 bg-[#f8fafc] text-[11px] font-bold uppercase tracking-[0.16em] text-black/40">
                <th className="px-5 py-3">{language === 'zh' ? '告警标题' : 'Alert'}</th>
                <th className="px-5 py-3">{language === 'zh' ? '对象' : 'Object'}</th>
                <th className="px-5 py-3">{language === 'zh' ? '级别' : 'Severity'}</th>
                <th className="px-5 py-3">{language === 'zh' ? '状态' : 'Status'}</th>
                <th className="px-5 py-3">{language === 'zh' ? '责任人' : 'Assignee'}</th>
                <th className="px-5 py-3">{language === 'zh' ? '时间' : 'Time'}</th>
                <th className="px-5 py-3">{language === 'zh' ? '操作' : 'Action'}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-sm text-black/40">
                    {language === 'zh' ? '正在加载告警...' : 'Loading alerts...'}
                  </td>
                </tr>
              ) : rows.length > 0 ? (
                rows.map((row) => (
                  <tr key={row.id} className="border-b border-black/5 hover:bg-black/[0.02]">
                    <td className="px-5 py-4 align-top">
                      <button
                        onClick={() => setSelectedAlertId(row.id)}
                        className="text-left"
                        title={language === 'zh' ? `查看告警 ${row.title}` : `View alert ${row.title}`}
                      >
                        <p className="text-sm font-semibold text-[#0b2340]">{row.title}</p>
                        <p className="mt-1 line-clamp-1 text-xs text-black/45">{row.message}</p>
                      </button>
                    </td>
                    <td className="px-5 py-4 align-top text-sm text-black/60">
                      <div>{row.hostname || row.ip_address || '--'}</div>
                      <div className="mt-1 text-xs text-black/40">{row.interface_name || row.site || '--'}</div>
                    </td>
                    <td className="px-5 py-4 align-top">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${severityBadgeClass(row.severity)}`}>
                        {severityLabel(row.severity, language)}
                      </span>
                    </td>
                    <td className="px-5 py-4 align-top">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${alertWorkflowBadgeClass(row.workflow_status)}`}>
                        {workflowLabel(row.workflow_status, language)}
                      </span>
                    </td>
                    <td className="px-5 py-4 align-top text-sm text-black/60">
                      {row.assignee || (language === 'zh' ? '未分派' : 'Unassigned')}
                    </td>
                    <td className="px-5 py-4 align-top text-sm text-black/60">
                      <div>{formatTs(row.created_at)}</div>
                      <div className="mt-1 text-xs text-black/40">{formatDuration(row.duration_seconds, language)}</div>
                    </td>
                    <td className="px-5 py-4 align-top">
                      <button
                        onClick={() => setSelectedAlertId(row.id)}
                        className={alertTableActionButtonClass}
                        title={language === 'zh' ? `查看告警 ${row.title}` : `View alert ${row.title}`}
                      >
                        <Eye size={14} />
                        {language === 'zh' ? '查看' : 'View'}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-sm text-black/40">
                    {language === 'zh' ? '当前筛选条件下没有告警。' : 'No alerts found for the current filter.'}
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
        {selectedAlertId ? (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                closeDetail();
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
                    {language === 'zh' ? '告警详情' : 'Alert Detail'}
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-[#0b2340]">
                    {selectedItem?.title || (language === 'zh' ? '加载中...' : 'Loading...')}
                  </h3>
                </div>
                <button title={language === 'zh' ? '关闭详情' : 'Close detail'} onClick={closeDetail} className="rounded-xl border border-black/10 p-2 text-black/55 hover:bg-black/[0.03]">
                  <X size={16} />
                </button>
              </div>

              {detailLoading || !selectedItem ? (
                <div className="px-6 py-16 text-center text-sm text-black/40">
                  {language === 'zh' ? '正在加载告警详情...' : 'Loading alert details...'}
                </div>
              ) : (
                <div className="space-y-5 px-6 py-6">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="rounded-2xl bg-[#f7f8fb] p-4 text-sm text-black/65">
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/35">{language === 'zh' ? '基本信息' : 'Basic Info'}</p>
                      <div className="mt-3 space-y-2">
                        <p><span className="text-black/35">IP:</span> {selectedItem.ip_address || '--'}</p>
                        <p><span className="text-black/35">Hostname:</span> {selectedItem.hostname || '--'}</p>
                        <p><span className="text-black/35">Site:</span> {selectedItem.site || '--'}</p>
                        <p><span className="text-black/35">Interface:</span> {selectedItem.interface_name || '--'}</p>
                      </div>
                    </div>

                    <div className="rounded-2xl bg-[#f7f8fb] p-4 text-sm text-black/65">
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/35">{language === 'zh' ? '当前状态' : 'Current State'}</p>
                      <div className="mt-3 space-y-2">
                        <p><span className="text-black/35">{language === 'zh' ? '级别' : 'Severity'}:</span> {severityLabel(selectedItem.severity, language)}</p>
                        <p><span className="text-black/35">{language === 'zh' ? '状态' : 'Status'}:</span> {workflowLabel(selectedItem.workflow_status, language)}</p>
                        <p><span className="text-black/35">{language === 'zh' ? '创建时间' : 'Created'}:</span> {formatTs(selectedItem.created_at)}</p>
                        <p><span className="text-black/35">{language === 'zh' ? '持续时间' : 'Duration'}:</span> {formatDuration(selectedItem.duration_seconds, language)}</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/35">{language === 'zh' ? '告警内容' : 'Alert Message'}</p>
                    <div className="mt-2 rounded-2xl border border-black/8 bg-white p-4 text-sm leading-6 text-black/70">
                      {selectedItem.message}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_160px]">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/35">{language === 'zh' ? '责任人' : 'Assignee'}</p>
                      <div className="mt-2 flex gap-2">
                        <input
                          value={assignValue}
                          onChange={(e) => setAssignValue(e.target.value)}
                          placeholder={language === 'zh' ? '输入责任人用户名' : 'Enter assignee username'}
                          className={`${alertInputClass} rounded-xl px-3 py-2`}
                        />
                        <button disabled={actionLoading === 'assign' || !assignValue.trim()} onClick={() => void handleAssign()} className={alertAccentButtonClass}>
                          {language === 'zh' ? '分派' : 'Assign'}
                        </button>
                      </div>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/35">{language === 'zh' ? '快捷操作' : 'Actions'}</p>
                      <div className="mt-2 flex flex-col gap-2">
                        {!selectedItem.resolved_at && selectedItem.workflow_status !== 'suppressed' ? (
                          <button disabled={actionLoading === 'ack'} onClick={() => void handleAck('acknowledged')} className={alertPrimaryButtonClass}>
                            <CheckCircle2 size={14} />
                            {language === 'zh' ? '确认' : 'Acknowledge'}
                          </button>
                        ) : null}
                        <button onClick={() => onOpenMaintenanceForAlert?.(selectedItem)} className={alertSecondaryButtonClass}>
                          <Wrench size={14} />
                          {language === 'zh' ? '转维护期' : 'Maintenance'}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/35">{language === 'zh' ? '处置备注' : 'Response Note'}</p>
                    <textarea
                      value={detailNote}
                      onChange={(e) => setDetailNote(e.target.value)}
                      rows={4}
                      className={`${alertInputClass} mt-2 min-h-[112px] resize-y`}
                      placeholder={language === 'zh' ? '记录处理动作和结论。' : 'Capture actions and conclusion.'}
                    />
                    <div className="mt-3 flex justify-end">
                      <button disabled={actionLoading === 'note'} onClick={() => void handleSaveNote()} className={alertAccentButtonClass}>
                        {language === 'zh' ? '保存备注' : 'Save Note'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};

export default AlertDeskTab;
