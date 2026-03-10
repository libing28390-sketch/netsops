import React from 'react';
import { Upload, Download, Plus, Search, Filter, Activity } from 'lucide-react';
import type { Device, DeviceConnectionCheckSummary } from '../types';
import { sectionHeaderRowClass, sectionToolbarClass, secondaryActionBtnClass } from '../components/shared';
import Sparkline from '../components/Sparkline';
import Pagination from '../components/Pagination';

const clampPercent = (value?: number) => {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, numeric));
};

const healthToneMap: Record<string, string> = {
  healthy: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-700',
  critical: 'bg-red-100 text-red-700',
  unknown: 'bg-slate-100 text-slate-600',
};

const healthLabelMap: Record<string, { zh: string; en: string }> = {
  healthy: { zh: '健康', en: 'Healthy' },
  warning: { zh: '告警', en: 'Warning' },
  critical: { zh: '严重', en: 'Critical' },
  unknown: { zh: '未知', en: 'Unknown' },
};

const formatCheckTime = (value: string, language: string) => {
  try {
    return new Date(value).toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return value;
  }
};

interface InventoryDevicesTabProps {
  inventoryRows: Device[];
  inventoryTotal: number;
  inventoryPage: number;
  setInventoryPage: (v: number) => void;
  inventoryPageSize: number;
  setInventoryPageSize: (v: number) => void;
  inventorySearch: string;
  setInventorySearch: (v: string) => void;
  inventoryPlatformFilter: string;
  setInventoryPlatformFilter: (v: string) => void;
  inventoryStatusFilter: string;
  setInventoryStatusFilter: (v: string) => void;
  inventorySortConfig: { key: string; direction: 'asc' | 'desc' } | null;
  inventoryLoading: boolean;
  selectedDeviceIds: string[];
  setSelectedDeviceIds: React.Dispatch<React.SetStateAction<string[]>>;
  handleSort: (key: string) => void;
  handleImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleExport: () => void;
  handleDeleteDevice: (id: string) => void;
  handleDeleteSelected: () => void;
  handleShowDetails: (device: Device) => void;
  handleTestConnection: (device: Device, mode?: 'quick' | 'deep') => void;
  deviceConnectionChecks: Record<string, DeviceConnectionCheckSummary>;
  connectionTestingDeviceId: string | null;
  setShowAddModal: (v: boolean) => void;
  setShowEditModal: (v: boolean) => void;
  setEditingDevice: (d: Device) => void;
  setEditForm: (d: Device) => void;
  setSelectedDevice: (d: Device) => void;
  setActiveTab: (tab: string) => void;
  language: string;
  t: (key: string) => string;
}

const InventoryDevicesTab: React.FC<InventoryDevicesTabProps> = ({
  inventoryRows, inventoryTotal, inventoryPage, setInventoryPage,
  inventoryPageSize, setInventoryPageSize,
  inventorySearch, setInventorySearch,
  inventoryPlatformFilter, setInventoryPlatformFilter,
  inventoryStatusFilter, setInventoryStatusFilter,
  inventorySortConfig, inventoryLoading,
  selectedDeviceIds, setSelectedDeviceIds,
  handleSort, handleImport, handleExport,
  handleDeleteDevice, handleDeleteSelected, handleShowDetails,
  handleTestConnection,
  deviceConnectionChecks, connectionTestingDeviceId,
  setShowAddModal, setShowEditModal, setEditingDevice, setEditForm,
  setSelectedDevice, setActiveTab, language, t,
}) => {
  const checkBadgeMap: Record<DeviceConnectionCheckSummary['status'], { zh: string; en: string; className: string }> = {
    ok: { zh: 'OK', en: 'OK', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    tcp_fail: { zh: 'TCP 失败', en: 'TCP Fail', className: 'bg-red-100 text-red-700 border-red-200' },
    ssh_auth_fail: { zh: 'SSH 认证失败', en: 'SSH Auth Fail', className: 'bg-rose-100 text-rose-700 border-rose-200' },
    ssh_timeout: { zh: 'SSH 超时', en: 'SSH Timeout', className: 'bg-orange-100 text-orange-700 border-orange-200' },
    ssh_transport: { zh: 'SSH 传输失败', en: 'SSH Transport', className: 'bg-slate-100 text-slate-700 border-slate-200' },
    ssh_legacy: { zh: 'SSH 算法旧', en: 'Legacy SSH', className: 'bg-amber-100 text-amber-700 border-amber-200' },
    fail: { zh: '失败', en: 'Fail', className: 'bg-red-100 text-red-700 border-red-200' },
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className={sectionHeaderRowClass}>
          <div>
            <h2 className="text-2xl font-medium tracking-tight">{t('deviceInventory')}</h2>
            <p className="text-sm text-black/40">{t('manageMonitor')}</p>
          </div>
          <div className="flex gap-3">
            <label className="px-4 py-2 border border-black/10 rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-black/5 transition-all cursor-pointer">
              <Upload size={18} />
              {t('import')}
              <input type="file" className="hidden" onChange={handleImport} accept=".xlsx, .xls, .csv" title={language === 'zh' ? '导入设备文件' : 'Import device file'} />
            </label>
            <button onClick={handleExport} className={secondaryActionBtnClass} title={language === 'zh' ? '导出设备清单' : 'Export device inventory'}>
              <Download size={18} />
              {t('export')}
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              title={language === 'zh' ? '新增设备' : 'Add device'}
              className="bg-[#00bceb] text-white px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-[#0096bd] transition-all shadow-lg shadow-[#00bceb]/20"
            >
              <Plus size={18} />
              {t('addDevice')}
            </button>
          </div>
        </div>

        <div className={sectionToolbarClass}>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-black/40" size={16} />
            <input
              type="text"
              placeholder={t('searchPlaceholder')}
              value={inventorySearch}
              onChange={(e) => setInventorySearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-black/[0.02] border border-black/5 rounded-xl text-sm focus:border-black/20 outline-none transition-all"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-black/40" />
            <select value={inventoryPlatformFilter} onChange={(e) => setInventoryPlatformFilter(e.target.value)}
              title={language === 'zh' ? '按平台筛选' : 'Filter by platform'}
              className="bg-black/[0.02] border border-black/5 rounded-xl px-3 py-2 text-sm outline-none text-black/60 focus:border-black/20">
              <option value="all">{t('allPlatforms')}</option>
              <option value="cisco_ios">Cisco IOS</option>
              <option value="cisco_nxos">Cisco NX-OS</option>
              <option value="juniper_junos">Juniper Junos</option>
              <option value="arista_eos">Arista EOS</option>
              <option value="fortinet_fortios">Fortinet FortiOS</option>
              <option value="huawei_vrp">Huawei VRP</option>
              <option value="h3c_comware">H3C Comware</option>
              <option value="ruijie_rgos">Ruijie RGOS</option>
            </select>
            <select value={inventoryStatusFilter} onChange={(e) => setInventoryStatusFilter(e.target.value)}
              title={language === 'zh' ? '按状态筛选' : 'Filter by status'}
              className="bg-black/[0.02] border border-black/5 rounded-xl px-3 py-2 text-sm outline-none text-black/60 focus:border-black/20">
              <option value="all">All Status</option>
              <option value="online">Online</option>
              <option value="offline">Offline</option>
              <option value="pending">Pending</option>
            </select>
            <select value={inventoryPageSize} onChange={(e) => setInventoryPageSize(Number(e.target.value))}
              title={language === 'zh' ? '每页数量' : 'Items per page'}
              className="bg-black/[0.02] border border-black/5 rounded-xl px-3 py-2 text-sm outline-none text-black/60 focus:border-black/20">
              <option value={10}>10 / page</option>
              <option value={20}>20 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
        {selectedDeviceIds.length > 0 && (
          <div className="bg-emerald-50 px-6 py-3 border-b border-emerald-100 flex items-center justify-between">
            <span className="text-sm font-medium text-emerald-800">{selectedDeviceIds.length} device(s) selected</span>
            <button onClick={handleDeleteSelected}
              title={language === 'zh' ? '删除已选设备' : 'Delete selected devices'}
              className="text-xs font-bold uppercase text-red-600 hover:text-red-700 bg-red-100 px-3 py-1.5 rounded-lg transition-colors">
              DELETE SELECTED
            </button>
          </div>
        )}
        <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-black/[0.02] border-b border-black/5">
              <th className="px-6 py-4 w-10">
                <input
                  type="checkbox"
                  title={language === 'zh' ? '选择当前页全部设备' : 'Select all devices on this page'}
                  className="rounded border-black/20 text-[#00bceb] focus:ring-[#00bceb]"
                  checked={inventoryRows.length > 0 && inventoryRows.every(d => selectedDeviceIds.includes(d.id))}
                  onChange={(e) => {
                    if (e.target.checked) {
                      const currentPageIds = inventoryRows.map(d => d.id);
                      setSelectedDeviceIds(prev => Array.from(new Set([...prev, ...currentPageIds])));
                    } else {
                      const currentPageIds = new Set(inventoryRows.map(d => d.id));
                      setSelectedDeviceIds(prev => prev.filter(id => !currentPageIds.has(id)));
                    }
                  }}
                />
              </th>
              {[
                { key: 'hostname', label: 'DEVICE INFO' },
                { key: 'model', label: 'HARDWARE / SN' },
                { key: 'platform', label: 'SOFTWARE' },
                { key: 'site', label: 'SITE / ROLE' },
                { key: 'connection_method', label: 'METHOD' },
                { key: 'status', label: 'STATUS' },
              ].map(col => (
                <th key={col.key}
                  className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-black/40 cursor-pointer hover:text-black transition-colors"
                  onClick={() => handleSort(col.key)}>
                  {col.label} {inventorySortConfig?.key === col.key && (inventorySortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
              ))}
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-black/40">HEALTH / TREND</th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-black/40">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {inventoryRows.map(device => (
              <tr key={device.id} className={`border-b border-black/5 hover:bg-black/[0.01] transition-colors ${selectedDeviceIds.includes(device.id) ? 'bg-emerald-50/30' : ''}`}>
                <td className="px-6 py-4">
                  <input
                    type="checkbox"
                    title={language === 'zh' ? `选择设备 ${device.hostname || device.ip_address}` : `Select device ${device.hostname || device.ip_address}`}
                    className="rounded border-black/20 text-[#00bceb] focus:ring-[#00bceb]"
                    checked={selectedDeviceIds.includes(device.id)}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedDeviceIds(prev => [...prev, device.id]);
                      else setSelectedDeviceIds(prev => prev.filter(id => id !== device.id));
                    }}
                  />
                </td>
                <td className="px-6 py-4">
                  <div className="font-medium">{device.hostname || 'Unknown'}</div>
                  <div className="text-[10px] font-mono text-black/40">{device.ip_address || '0.0.0.0'}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-xs">{device.model || 'N/A'}</div>
                  <div className="text-[10px] font-mono text-black/40">{device.sn || 'N/A'}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-xs">{device.platform || 'unknown'}</div>
                  <div className="text-[10px] text-black/40">Ver: {device.version || 'N/A'}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-xs">{device.site || 'N/A'}</div>
                  <div className="text-[10px] font-bold uppercase text-black/30">{device.role || 'N/A'}</div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-[10px] font-bold uppercase px-2 py-1 bg-black/5 rounded-lg border border-black/5">
                    {device.connection_method || 'ssh'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col gap-2 w-32">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase ${healthToneMap[device.health_status || 'unknown'] || healthToneMap.unknown}`}>
                        {healthLabelMap[device.health_status || 'unknown']?.[language === 'zh' ? 'zh' : 'en'] || healthLabelMap.unknown[language === 'zh' ? 'zh' : 'en']}
                      </span>
                      <span className="text-[9px] font-bold text-black/45 uppercase">
                        {language === 'zh' ? '评分' : 'Score'} {Math.max(0, Math.min(100, Number(device.health_score || 0)))}
                      </span>
                    </div>
                    <p className="text-[10px] leading-4 text-black/45 line-clamp-2" title={device.health_summary || ''}>
                      {device.health_summary || (language === 'zh' ? '暂无健康摘要' : 'No health summary')}
                    </p>
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-bold text-black/40 uppercase">CPU {clampPercent(device.cpu_usage)}%</span>
                        <progress
                          className="util-progress util-progress-in mt-0.5 w-12"
                          max={100}
                          value={clampPercent(device.cpu_usage)}
                          title={language === 'zh' ? `CPU 使用率 ${clampPercent(device.cpu_usage)}%` : `CPU usage ${clampPercent(device.cpu_usage)}%`}
                        />
                      </div>
                      <Sparkline data={device.cpu_history || [20, 30, 25, 40, 35, 45, 40]} color="#00bceb" />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-bold text-black/40 uppercase">MEM {clampPercent(device.memory_usage)}%</span>
                        <progress
                          className="util-progress util-progress-memory mt-0.5 w-12"
                          max={100}
                          value={clampPercent(device.memory_usage)}
                          title={language === 'zh' ? `内存使用率 ${clampPercent(device.memory_usage)}%` : `Memory usage ${clampPercent(device.memory_usage)}%`}
                        />
                      </div>
                      <Sparkline data={device.memory_history || [60, 62, 65, 63, 68, 70, 65]} color="#10b981" />
                    </div>
                    <div className="flex items-center gap-2 text-[9px] font-bold uppercase text-black/35">
                      <span>{language === 'zh' ? '告警' : 'Alerts'} {Number(device.open_alert_count || 0)}</span>
                      <span>{language === 'zh' ? 'Down' : 'Down'} {Number(device.interface_down_count || 0)}</span>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2 w-2">
                        {device.status === 'online' && (
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        )}
                        <span className={`relative inline-flex rounded-full h-2 w-2 ${
                          device.status === 'online' ? 'bg-emerald-500' :
                          device.status === 'pending' ? 'bg-amber-500' : 'bg-red-500'
                        }`}></span>
                      </span>
                      <span className={`text-[10px] font-bold uppercase ${
                        device.status === 'online' ? 'text-emerald-600' :
                        device.status === 'pending' ? 'text-amber-600' : 'text-red-600'
                      }`}>{device.status}</span>
                    </div>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase w-fit ${
                      device.compliance === 'compliant' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                    }`}>{device.compliance}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <button onClick={() => { setSelectedDevice(device); setActiveTab('automation'); }}
                      title={language === 'zh' ? '前往自动化配置' : 'Open automation config'}
                      className="text-[10px] font-bold uppercase text-[#00bceb] hover:text-[#0096bd]">CONFIG</button>
                    <div className="flex flex-col gap-1">
                      <button onClick={() => handleTestConnection(device, 'quick')}
                        title={language === 'zh' ? '快速连通性检测' : 'Run reachability check'}
                        className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-violet-700 hover:text-violet-800">
                        <Activity size={12} className={connectionTestingDeviceId === device.id ? 'animate-pulse' : ''} />
                        {language === 'zh' ? 'CHECK' : 'CHECK'}
                      </button>
                      {connectionTestingDeviceId === device.id ? (
                        <span className="w-fit rounded-full border border-blue-200 bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-blue-700">
                          {language === 'zh' ? '检测中' : 'Running'}
                        </span>
                      ) : deviceConnectionChecks[device.id] ? (() => {
                        const summary = deviceConnectionChecks[device.id];
                        const badge = checkBadgeMap[summary.status] || checkBadgeMap.fail;
                        return (
                          <div className="flex flex-col gap-0.5">
                            <span
                              title={`${summary.mode === 'deep' ? (language === 'zh' ? 'SSH 登录校验' : 'SSH login check') : (language === 'zh' ? '快速连通性检测' : 'Reachability check')} · ${new Date(summary.checked_at).toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US', { hour12: false })}`}
                              className={`w-fit rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase ${badge.className}`}
                            >
                              {language === 'zh' ? badge.zh : badge.en}
                            </span>
                            <span className="text-[9px] font-medium text-black/35">
                              {formatCheckTime(summary.checked_at, language)}
                            </span>
                          </div>
                        );
                      })() : null}
                    </div>
                    <button onClick={() => handleShowDetails(device)}
                      title={language === 'zh' ? '查看设备详情' : 'View device details'}
                      className="text-[10px] font-bold uppercase text-black/40 hover:text-black">DETAILS</button>
                    <button onClick={() => { setEditingDevice(device); setEditForm({ ...device, password: '' } as Device); setShowEditModal(true); }}
                      title={language === 'zh' ? '编辑设备' : 'Edit device'}
                      className="text-[10px] font-bold uppercase text-blue-600 hover:text-blue-700">EDIT</button>
                    <button onClick={() => handleDeleteDevice(device.id)}
                      title={language === 'zh' ? '删除设备' : 'Delete device'}
                      className="text-[10px] font-bold uppercase text-red-600 hover:text-red-700">DELETE</button>
                  </div>
                </td>
              </tr>
            ))}
            {!inventoryLoading && inventoryRows.length === 0 && (
              <tr><td colSpan={9} className="px-6 py-8 text-center text-sm text-black/40">No devices found for current filters.</td></tr>
            )}
            {inventoryLoading && inventoryRows.length === 0 && (
              <tr><td colSpan={9} className="px-6 py-8 text-center text-sm text-black/40">Loading devices...</td></tr>
            )}
          </tbody>
        </table>
        </div>
        <Pagination
          currentPage={inventoryPage}
          totalItems={inventoryTotal}
          itemsPerPage={inventoryPageSize}
          onItemsPerPageChange={setInventoryPageSize}
          onPageChange={setInventoryPage}
          language={language}
        />
      </div>
    </div>
  );
};

export default InventoryDevicesTab;
