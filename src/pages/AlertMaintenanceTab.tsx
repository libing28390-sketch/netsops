import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Copy, Eye, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import type { AlertMaintenanceListResponse, AlertMaintenanceWindow, Device, User } from '../types';
import Pagination from '../components/Pagination';
import {
  alertAccentButtonClass,
  alertDangerButtonClass,
  alertInputClass,
  alertPanelClass,
  alertPrimaryButtonClass,
  alertSecondaryButtonClass,
  alertTableActionAccentButtonClass,
  alertTableActionBarClass,
  alertTableActionButtonClass,
  alertTableActionDangerButtonClass,
  AlertPageCommonProps,
  buildDefaultMaintenanceForm,
  formatTs,
  maintenanceBadgeClass,
  maintenanceStatusLabel,
  MaintenanceFormState,
  useAlertOverlayDismiss,
} from './alertManagementShared';

type RuntimeFilter = 'all' | AlertMaintenanceWindow['runtime_status'];

const AlertMaintenanceTab: React.FC<AlertPageCommonProps> = ({ language, currentUsername, showToast }) => {
  const location = useLocation();
  const [devices, setDevices] = useState<Device[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [windows, setWindows] = useState<AlertMaintenanceWindow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<RuntimeFilter>('all');
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [maintenanceSubmitting, setMaintenanceSubmitting] = useState(false);
  const [maintenanceForm, setMaintenanceForm] = useState<MaintenanceFormState>(buildDefaultMaintenanceForm(null));
  const [maintenanceCancelingId, setMaintenanceCancelingId] = useState<string | null>(null);
  const [selectedWindowId, setSelectedWindowId] = useState<string | null>(null);

  const selectedWindow = useMemo(
    () => windows.find((item) => item.id === selectedWindowId) || null,
    [selectedWindowId, windows],
  );

  const deviceOptions = useMemo(
    () => devices.filter((device) => Boolean(device.ip_address)).sort((left, right) => left.hostname.localeCompare(right.hostname)),
    [devices],
  );

  const assetByIp = useMemo(
    () => new Map(deviceOptions.map((device) => [device.ip_address, device])),
    [deviceOptions],
  );

  const selectedAsset = maintenanceForm.target_ip ? assetByIp.get(maintenanceForm.target_ip) || null : null;

  const selectedWindowAsset = selectedWindow?.target_ip ? assetByIp.get(selectedWindow.target_ip) || null : null;

  const loadUsers = async () => {
    try {
      const resp = await fetch('/api/users');
      if (!resp.ok) throw new Error('Failed to load users');
      setUsers(await resp.json());
    } catch (error) {
      console.error(error);
    }
  };

  const loadDevices = async () => {
    try {
      const params = new URLSearchParams({
        mode: 'light',
        page: '1',
        page_size: '200',
        sort_key: 'hostname',
        sort_direction: 'asc',
      });
      const resp = await fetch(`/api/devices?${params.toString()}`);
      if (!resp.ok) throw new Error('Failed to load devices');
      const data = await resp.json();
      setDevices(Array.isArray(data) ? data : (Array.isArray(data.items) ? data.items : []));
    } catch (error) {
      console.error(error);
      showToast(language === 'zh' ? '加载资产列表失败' : 'Failed to load devices', 'error');
    }
  };

  const loadMaintenanceWindows = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
        status: statusFilter,
        search: searchQuery,
      });
      const resp = await fetch(`/api/alerts/maintenance-windows?${params.toString()}`);
      if (!resp.ok) throw new Error('Failed to load maintenance windows');
      const data: AlertMaintenanceListResponse = await resp.json();
      setWindows(data.items || []);
      setTotal(data.total || 0);
      if (selectedWindowId && !data.items.some((item) => item.id === selectedWindowId)) {
        setSelectedWindowId(null);
      }
    } catch (error) {
      console.error(error);
      showToast(language === 'zh' ? '加载维护窗失败' : 'Failed to load maintenance windows', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDevices();
    void loadUsers();
  }, []);

  useEffect(() => {
    void loadMaintenanceWindows();
  }, [page, pageSize, searchQuery, statusFilter]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('open') !== '1') return;
    const next = buildDefaultMaintenanceForm(null);
    next.name = params.get('name') || next.name;
    next.target_ip = params.get('target_ip') || next.target_ip;
    next.title_pattern = params.get('title_pattern') || next.title_pattern;
    next.message_pattern = params.get('message_pattern') || next.message_pattern;
    setMaintenanceForm(next);
    setShowMaintenanceModal(true);
  }, [location.search]);

  const updateMaintenanceField = <K extends keyof MaintenanceFormState>(key: K, value: MaintenanceFormState[K]) => {
    setMaintenanceForm((prev) => ({ ...prev, [key]: value }));
  };

  const closeMaintenanceModal = () => setShowMaintenanceModal(false);
  const closeSelectedWindow = () => setSelectedWindowId(null);

  useAlertOverlayDismiss(showMaintenanceModal, closeMaintenanceModal);
  useAlertOverlayDismiss(Boolean(selectedWindow), closeSelectedWindow);

  const handleCreateMaintenance = async () => {
    if (!maintenanceForm.target_ip.trim()) {
      showToast(language === 'zh' ? '请先填写维护对象 IP' : 'Target IP is required', 'error');
      return;
    }
    setMaintenanceSubmitting(true);
    try {
      const toIso = (value: string) => {
        const dt = new Date(value);
        if (Number.isNaN(dt.getTime())) return value;
        return dt.toISOString();
      };
      const resp = await fetch('/api/alerts/maintenance-windows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...maintenanceForm,
          starts_at: toIso(maintenanceForm.starts_at),
          ends_at: toIso(maintenanceForm.ends_at),
          created_by: currentUsername,
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.detail || 'Failed to create maintenance window');
      showToast(language === 'zh' ? '维护窗已创建' : 'Maintenance window created', 'success');
      closeMaintenanceModal();
      setPage(1);
      await loadMaintenanceWindows();
      setSelectedWindowId(data.id || null);
    } catch (error: any) {
      showToast(error?.message || (language === 'zh' ? '创建维护窗失败' : 'Failed to create maintenance window'), 'error');
    } finally {
      setMaintenanceSubmitting(false);
    }
  };

  const handleCancelWindow = async (windowId: string) => {
    setMaintenanceCancelingId(windowId);
    try {
      const resp = await fetch(`/api/alerts/maintenance-windows/${windowId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actor_username: currentUsername }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.detail || 'Failed to cancel maintenance window');
      showToast(language === 'zh' ? '维护窗已取消' : 'Maintenance window cancelled', 'success');
      await loadMaintenanceWindows();
    } catch (error: any) {
      showToast(error?.message || (language === 'zh' ? '取消维护窗失败' : 'Failed to cancel maintenance window'), 'error');
    } finally {
      setMaintenanceCancelingId(null);
    }
  };

  const handleDeleteWindow = async (windowId: string) => {
    setMaintenanceCancelingId(windowId);
    try {
      const resp = await fetch(`/api/alerts/maintenance-windows/${windowId}?actor_username=${encodeURIComponent(currentUsername)}`, {
        method: 'DELETE',
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.detail || 'Failed to delete maintenance window');
      showToast(language === 'zh' ? '维护窗已删除' : 'Maintenance window deleted', 'success');
      setSelectedWindowId((prev) => (prev === windowId ? null : prev));
      await loadMaintenanceWindows();
    } catch (error: any) {
      showToast(error?.message || (language === 'zh' ? '删除维护窗失败' : 'Failed to delete maintenance window'), 'error');
    } finally {
      setMaintenanceCancelingId(null);
    }
  };

  const handleCopyWindow = (window: AlertMaintenanceWindow) => {
    const next = buildDefaultMaintenanceForm(null);
    next.name = language === 'zh' ? `${window.name} 副本` : `${window.name} Copy`;
    next.target_ip = window.target_ip || '';
    next.title_pattern = window.title_pattern || '';
    next.message_pattern = window.message_pattern || '';
    next.reason = window.reason || '';

    setMaintenanceForm(next);
    setSelectedWindowId(null);
    setShowMaintenanceModal(true);
    showToast(language === 'zh' ? '已打开复制维护期窗口' : 'Opened duplicated maintenance window', 'success');
  };

  const openCreate = () => {
    setMaintenanceForm(buildDefaultMaintenanceForm(null));
    setShowMaintenanceModal(true);
  };

  return (
    <div className="space-y-4">
      <div className={alertPanelClass}>
        <div className="flex flex-col gap-4 border-b border-black/5 px-5 py-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/35">
              {language === 'zh' ? '告警中心 / 维护期' : 'Alert Center / Maintenance'}
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-[#0b2340]">
              {language === 'zh' ? '当前维护期' : 'Current Maintenance Windows'}
            </h2>
            <p className="mt-2 text-sm text-black/50">
              {language === 'zh' ? '只保留维护窗列表、分页和必要操作。' : 'A compact page with the maintenance window list, pagination, and essential actions.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => void loadMaintenanceWindows()} className={alertSecondaryButtonClass}>
              <RefreshCw size={14} />
              {language === 'zh' ? '刷新' : 'Refresh'}
            </button>
            <button onClick={openCreate} className={alertPrimaryButtonClass}>
              <Plus size={14} />
              {language === 'zh' ? '新建维护期' : 'New Window'}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center">
          <label className="relative min-w-[240px] flex-1">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-black/30" />
            <input
              value={searchQuery}
              onChange={(e) => {
                setPage(1);
                setSearchQuery(e.target.value);
              }}
              placeholder={language === 'zh' ? '搜索名称、IP、原因、创建人' : 'Search name, IP, reason, creator'}
              className={`${alertInputClass} rounded-xl py-3 pl-9 pr-3`}
            />
          </label>
          <select
            title={language === 'zh' ? '按状态筛选维护窗' : 'Filter maintenance windows by status'}
            value={statusFilter}
            onChange={(e) => {
              setPage(1);
              setStatusFilter(e.target.value as RuntimeFilter);
            }}
            className="rounded-xl border border-black/10 bg-white px-3 py-3 text-sm text-[#0b2340] outline-none"
          >
            <option value="all">{language === 'zh' ? '全部状态' : 'All Status'}</option>
            <option value="active">{language === 'zh' ? '生效中' : 'Active'}</option>
            <option value="scheduled">{language === 'zh' ? '待生效' : 'Scheduled'}</option>
            <option value="expired">{language === 'zh' ? '已过期' : 'Expired'}</option>
            <option value="cancelled">{language === 'zh' ? '已取消' : 'Cancelled'}</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left">
            <thead>
              <tr className="border-y border-black/5 bg-[#f8fafc] text-[11px] font-bold uppercase tracking-[0.16em] text-black/40">
                <th className="px-5 py-3">{language === 'zh' ? '维护名称' : 'Name'}</th>
                <th className="px-5 py-3">IP</th>
                <th className="px-5 py-3">{language === 'zh' ? '开始时间' : 'Start Time'}</th>
                <th className="px-5 py-3">{language === 'zh' ? '结束时间' : 'End Time'}</th>
                <th className="px-5 py-3">{language === 'zh' ? '状态' : 'Status'}</th>
                <th className="px-5 py-3">{language === 'zh' ? '创建人' : 'Created By'}</th>
                <th className="px-5 py-3">{language === 'zh' ? '操作' : 'Action'}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-sm text-black/40">
                    {language === 'zh' ? '正在加载维护窗...' : 'Loading maintenance windows...'}
                  </td>
                </tr>
              ) : windows.length > 0 ? (
                windows.map((window) => (
                  <tr key={window.id} className="border-b border-black/5 hover:bg-black/[0.02]">
                    <td className="px-5 py-4 align-top">
                      <button title={language === 'zh' ? `查看维护窗 ${window.name}` : `View maintenance window ${window.name}`} onClick={() => setSelectedWindowId(window.id)} className="text-left">
                        <p className="text-sm font-semibold text-[#0b2340]">{window.name}</p>
                        <p className="mt-1 line-clamp-1 text-xs text-black/45">{window.reason || (language === 'zh' ? '未填写原因' : 'No reason')}</p>
                      </button>
                    </td>
                    <td className="px-5 py-4 align-top text-sm text-black/60">
                      <div className="font-mono">{window.target_ip}</div>
                      <div className="mt-1 text-xs text-black/40">{assetByIp.get(window.target_ip)?.hostname || '--'}</div>
                    </td>
                    <td className="px-5 py-4 align-top text-sm text-black/60">{formatTs(window.starts_at)}</td>
                    <td className="px-5 py-4 align-top text-sm text-black/60">{formatTs(window.ends_at)}</td>
                    <td className="px-5 py-4 align-top">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${maintenanceBadgeClass(window.runtime_status)}`}>
                        {maintenanceStatusLabel(window.runtime_status, language)}
                      </span>
                    </td>
                    <td className="px-5 py-4 align-top text-sm text-black/60">{window.created_by}</td>
                    <td className="px-5 py-4 align-top">
                      <div className={alertTableActionBarClass}>
                        <button title={language === 'zh' ? `查看维护窗 ${window.name}` : `View maintenance window ${window.name}`} onClick={() => setSelectedWindowId(window.id)} className={alertTableActionButtonClass}>
                          <Eye size={14} />
                          {language === 'zh' ? '查看' : 'View'}
                        </button>
                        <button title={language === 'zh' ? `复制维护窗 ${window.name}` : `Copy maintenance window ${window.name}`} onClick={() => void handleCopyWindow(window)} className={alertTableActionAccentButtonClass}>
                          <Copy size={14} />
                          {language === 'zh' ? '复制' : 'Copy'}
                        </button>
                        <button
                          title={language === 'zh' ? `删除维护窗 ${window.name}` : `Delete maintenance window ${window.name}`}
                          onClick={() => void handleDeleteWindow(window.id)}
                          disabled={maintenanceCancelingId === window.id}
                          className={alertTableActionDangerButtonClass}
                        >
                          <Trash2 size={14} />
                          {language === 'zh' ? '删除' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-sm text-black/40">
                    {language === 'zh' ? '当前没有维护窗。' : 'No maintenance windows found.'}
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
        {showMaintenanceModal ? (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                closeMaintenanceModal();
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
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/35">{language === 'zh' ? '新建维护期' : 'New Maintenance Window'}</p>
                  <h3 className="mt-2 text-xl font-semibold text-[#0b2340]">{language === 'zh' ? '填写基础信息后直接创建' : 'Create a window with the basic fields only'}</h3>
                </div>
                <button title={language === 'zh' ? '关闭弹层' : 'Close modal'} onClick={closeMaintenanceModal} className="rounded-xl border border-black/10 p-2 text-black/55 hover:bg-black/[0.03]">
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-5 px-6 py-6">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="text-sm text-black/65">
                    <span>{language === 'zh' ? '维护名称' : 'Window Name'}</span>
                    <input value={maintenanceForm.name} onChange={(e) => updateMaintenanceField('name', e.target.value)} className={`${alertInputClass} mt-2 rounded-xl px-3 py-2`} />
                  </label>
                  <label className="text-sm text-black/65">
                    <span>{language === 'zh' ? '资产对象' : 'Asset Target'}</span>
                    <select
                      value={maintenanceForm.target_ip}
                      onChange={(e) => updateMaintenanceField('target_ip', e.target.value)}
                      className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-[#0b2340] outline-none"
                    >
                      <option value="">{language === 'zh' ? '请选择资产 IP' : 'Select asset IP'}</option>
                      {maintenanceForm.target_ip && !selectedAsset ? (
                        <option value={maintenanceForm.target_ip}>{maintenanceForm.target_ip}</option>
                      ) : null}
                      {deviceOptions.map((device) => (
                        <option key={device.id} value={device.ip_address}>
                          {`${device.hostname} / ${device.ip_address}`}
                        </option>
                      ))}
                    </select>
                    <p className="mt-2 text-xs text-black/40">
                      {selectedAsset
                        ? (language === 'zh'
                          ? `来自资产信息：${selectedAsset.hostname} / ${selectedAsset.site || '未分组'}`
                          : `From inventory: ${selectedAsset.hostname} / ${selectedAsset.site || 'Unassigned'}`)
                        : (language === 'zh' ? '维护对象 IP 从资产信息中选择。' : 'Target IP is selected from inventory.')}
                    </p>
                  </label>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="text-sm text-black/65">
                    <span>{language === 'zh' ? '开始时间' : 'Start Time'}</span>
                    <input type="datetime-local" value={maintenanceForm.starts_at} onChange={(e) => updateMaintenanceField('starts_at', e.target.value)} className={`${alertInputClass} mt-2 rounded-xl px-3 py-2`} />
                  </label>
                  <label className="text-sm text-black/65">
                    <span>{language === 'zh' ? '结束时间' : 'End Time'}</span>
                    <input type="datetime-local" value={maintenanceForm.ends_at} onChange={(e) => updateMaintenanceField('ends_at', e.target.value)} className={`${alertInputClass} mt-2 rounded-xl px-3 py-2`} />
                  </label>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="text-sm text-black/65">
                    <span>{language === 'zh' ? '标题匹配' : 'Title Match'}</span>
                    <input value={maintenanceForm.title_pattern} onChange={(e) => updateMaintenanceField('title_pattern', e.target.value)} className={`${alertInputClass} mt-2 rounded-xl px-3 py-2`} />
                  </label>
                  <label className="text-sm text-black/65">
                    <span>{language === 'zh' ? '消息匹配' : 'Message Match'}</span>
                    <input value={maintenanceForm.message_pattern} onChange={(e) => updateMaintenanceField('message_pattern', e.target.value)} className={`${alertInputClass} mt-2 rounded-xl px-3 py-2`} />
                  </label>
                </div>

                <label className="block text-sm text-black/65">
                  <span>{language === 'zh' ? '维护原因' : 'Reason'}</span>
                  <textarea value={maintenanceForm.reason} onChange={(e) => updateMaintenanceField('reason', e.target.value)} rows={4} className={`${alertInputClass} mt-2 min-h-[112px] resize-y`} />
                </label>

                <div>
                  <p className="text-sm text-black/65">{language === 'zh' ? '通知联系人' : 'Notify Contacts'}</p>
                  <div className="mt-2 grid max-h-[220px] grid-cols-1 gap-2 overflow-auto rounded-2xl border border-black/10 p-3 md:grid-cols-2">
                    {users.map((user) => {
                      const checked = maintenanceForm.notify_user_ids.includes(String(user.id));
                      return (
                        <label key={String(user.id)} className="flex items-center gap-3 rounded-xl border border-black/6 px-3 py-2 text-sm text-black/65 hover:bg-black/[0.02]">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => updateMaintenanceField(
                              'notify_user_ids',
                              e.target.checked
                                ? [...maintenanceForm.notify_user_ids, String(user.id)]
                                : maintenanceForm.notify_user_ids.filter((id) => id !== String(user.id)),
                            )}
                          />
                          <span>{user.username}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-black/5 px-6 py-4">
                <button onClick={closeMaintenanceModal} className={alertSecondaryButtonClass}>
                  {language === 'zh' ? '取消' : 'Cancel'}
                </button>
                <button disabled={maintenanceSubmitting} onClick={() => void handleCreateMaintenance()} className={alertPrimaryButtonClass}>
                  {maintenanceSubmitting ? (language === 'zh' ? '创建中...' : 'Creating...') : (language === 'zh' ? '创建维护期' : 'Create Window')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {selectedWindow ? (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                closeSelectedWindow();
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
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/35">{language === 'zh' ? '维护期详情' : 'Maintenance Detail'}</p>
                  <h3 className="mt-2 text-xl font-semibold text-[#0b2340]">{selectedWindow.name}</h3>
                  <div className="mt-3">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${maintenanceBadgeClass(selectedWindow.runtime_status)}`}>
                      {maintenanceStatusLabel(selectedWindow.runtime_status, language)}
                    </span>
                  </div>
                </div>
                <button title={language === 'zh' ? '关闭详情' : 'Close detail'} onClick={closeSelectedWindow} className="rounded-xl border border-black/10 p-2 text-black/55 hover:bg-black/[0.03]">
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-5 px-6 py-6">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded-2xl bg-[#f7f8fb] p-4 text-sm text-black/65">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/35">{language === 'zh' ? '时间信息' : 'Schedule'}</p>
                    <div className="mt-3 space-y-2">
                      <p><span className="text-black/35">IP:</span> {selectedWindow.target_ip}</p>
                      {selectedWindowAsset ? <p><span className="text-black/35">{language === 'zh' ? '资产' : 'Asset'}:</span> {selectedWindowAsset.hostname}</p> : null}
                      <p><span className="text-black/35">{language === 'zh' ? '开始' : 'Start'}:</span> {formatTs(selectedWindow.starts_at)}</p>
                      <p><span className="text-black/35">{language === 'zh' ? '结束' : 'End'}:</span> {formatTs(selectedWindow.ends_at)}</p>
                      <p><span className="text-black/35">{language === 'zh' ? '创建人' : 'Created By'}:</span> {selectedWindow.created_by}</p>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-[#f7f8fb] p-4 text-sm text-black/65">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/35">{language === 'zh' ? '匹配条件' : 'Matching Rules'}</p>
                    <div className="mt-3 space-y-2">
                      <p><span className="text-black/35">{language === 'zh' ? '标题匹配' : 'Title Match'}:</span> {selectedWindow.title_pattern || '--'}</p>
                      <p><span className="text-black/35">{language === 'zh' ? '消息匹配' : 'Message Match'}:</span> {selectedWindow.message_pattern || '--'}</p>
                      <p><span className="text-black/35">{language === 'zh' ? '最近命中' : 'Recent Matches'}:</span> {selectedWindow.last_match_count || 0}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/35">{language === 'zh' ? '维护原因' : 'Reason'}</p>
                  <div className="mt-2 rounded-2xl border border-black/8 bg-white p-4 text-sm leading-6 text-black/70">
                    {selectedWindow.reason || (language === 'zh' ? '未填写维护原因。' : 'No maintenance reason provided.')}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-black/5 px-6 py-4">
                <button onClick={() => void handleCopyWindow(selectedWindow)} className={alertAccentButtonClass}>
                  <Copy size={14} />
                  {language === 'zh' ? '复制信息' : 'Copy'}
                </button>
                {selectedWindow.runtime_status !== 'expired' && selectedWindow.runtime_status !== 'cancelled' ? (
                  <button onClick={() => void handleCancelWindow(selectedWindow.id)} disabled={maintenanceCancelingId === selectedWindow.id} className={alertSecondaryButtonClass}>
                    {language === 'zh' ? '取消维护期' : 'Cancel'}
                  </button>
                ) : null}
                <button onClick={() => void handleDeleteWindow(selectedWindow.id)} disabled={maintenanceCancelingId === selectedWindow.id} className={alertDangerButtonClass}>
                  <Trash2 size={14} />
                  {language === 'zh' ? '删除' : 'Delete'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};

export default AlertMaintenanceTab;
