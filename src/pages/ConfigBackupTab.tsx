import React from 'react';
import { ChevronLeft, Database, Download, FileText, RotateCcw } from 'lucide-react';
import type { Device } from '../types';

interface SnapshotItem {
  id: string;
  device_id: string;
  hostname: string;
  ip_address?: string;
  vendor?: string;
  trigger?: string;
  timestamp: string;
  size: number;
  content?: string;
}

interface ConfigBackupTabProps {
  t: (key: string) => string;
  language: string;
  devices: Device[];
  configSnapshots: SnapshotItem[];
  configCenterDevice: Device | null;
  configViewSnapshot: SnapshotItem | null;
  configViewContent: string;
  configSnapshotKeyword: string;
  retentionDays: number;
  configSnapshotsLoading: boolean;
  isTakingSnapshot: boolean;
  getVendorFromPlatform: (platform?: string) => string;
  onTakeSnapshotForCurrentDevice: () => Promise<void> | void;
  onBackupAllOnline: () => Promise<void> | void;
  onClearDeviceSelection: () => void;
  onSelectDevice: (device: Device) => void;
  onBackToList: () => void;
  onCopyConfigContent: () => void;
  onFetchLiveConfig: () => Promise<void> | void;
  onConfigSnapshotKeywordChange: (value: string) => void;
  onSearchSnapshots: () => Promise<void> | void;
  onClearSearch: () => Promise<void> | void;
  onRetentionDaysChange: (value: number) => void;
  onRefreshSnapshots: () => Promise<void> | void;
  onOpenSnapshot: (snapshot: SnapshotItem) => Promise<void> | void;
  onOpenDiff: (snapshot: SnapshotItem) => Promise<void> | void;
  onCopySnapshot: (snapshot: SnapshotItem) => Promise<void> | void;
  onDeleteSnapshot: (snapshotId: string) => Promise<void> | void;
}

const ConfigBackupTab: React.FC<ConfigBackupTabProps> = ({
  t,
  language,
  devices,
  configSnapshots,
  configCenterDevice,
  configViewSnapshot,
  configViewContent,
  configSnapshotKeyword,
  retentionDays,
  configSnapshotsLoading,
  isTakingSnapshot,
  getVendorFromPlatform,
  onTakeSnapshotForCurrentDevice,
  onBackupAllOnline,
  onClearDeviceSelection,
  onSelectDevice,
  onBackToList,
  onCopyConfigContent,
  onFetchLiveConfig,
  onConfigSnapshotKeywordChange,
  onSearchSnapshots,
  onClearSearch,
  onRetentionDaysChange,
  onRefreshSnapshots,
  onOpenSnapshot,
  onOpenDiff,
  onCopySnapshot,
  onDeleteSnapshot,
}) => {
  const filteredSnapshots = configSnapshots.filter((snapshot) => !configCenterDevice || snapshot.device_id === configCenterDevice.id);
  const devicesByVendor: Record<string, Device[]> = devices.reduce((accumulator, device) => {
    const vendor = getVendorFromPlatform(device.platform);
    if (!accumulator[vendor]) {
      accumulator[vendor] = [];
    }
    accumulator[vendor].push(device);
    return accumulator;
  }, {} as Record<string, Device[]>);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex justify-between items-end mb-5 flex-shrink-0">
        <div>
          <h2 className="text-2xl font-medium tracking-tight">{t('backupHistory')}</h2>
          <p className="text-sm text-black/40">{t('backupStoragePath')}: <span className="font-mono">backup/YYYY/MM/Vendor/Hostname/</span></p>
        </div>
        <div className="flex gap-2">
          {configCenterDevice && (
            <button
              onClick={() => void onTakeSnapshotForCurrentDevice()}
              disabled={isTakingSnapshot}
              className="flex items-center gap-2 px-4 py-2 bg-[#00bceb] text-white rounded-xl text-sm font-medium hover:bg-[#0096bd] transition-all shadow-lg shadow-[#00bceb]/20 disabled:opacity-50"
            >
              {isTakingSnapshot ? <RotateCcw size={14} className="animate-spin" /> : <Download size={14} />}
              {t('takeSnapshot')}
            </button>
          )}
          <button
            onClick={() => void onBackupAllOnline()}
            disabled={isTakingSnapshot}
            className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-xl text-sm font-medium hover:bg-black/80 transition-all disabled:opacity-50"
          >
            <Database size={14} />
            {t('backupAllOnline')}
          </button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-5 overflow-hidden">
        <div className="md:col-span-3 flex flex-col bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-black/5 bg-black/[0.01]">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-black/40">{t('selectDevice')}</h3>
            <button
              onClick={onClearDeviceSelection}
              className={`mt-2 text-[9px] font-bold uppercase tracking-wider transition-all ${!configCenterDevice ? 'text-[#00bceb]' : 'text-black/30 hover:text-black'}`}
            >
              {t('allSnapshots')}
            </button>
          </div>
          <div className="flex-1 overflow-auto">
            {(Object.entries(devicesByVendor) as [string, Device[]][]).map(([vendor, vendorDevices]) => (
              <div key={vendor}>
                <div className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest text-black/30 bg-black/[0.02] border-b border-black/5 sticky top-0">{vendor}</div>
                <div className="p-2 space-y-1">
                  {vendorDevices.map((device) => {
                    const count = configSnapshots.filter((snapshot) => snapshot.device_id === device.id).length;
                    return (
                      <button
                        key={device.id}
                        onClick={() => onSelectDevice(device)}
                        className={`w-full p-3 rounded-xl text-left transition-all ${configCenterDevice?.id === device.id ? 'bg-black text-white' : 'hover:bg-black/5 text-black/60 hover:text-black'}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`w-1.5 h-1.5 rounded-full ${device.status === 'online' ? 'bg-emerald-500' : 'bg-red-400'}`} />
                            <span className="text-xs font-medium">{device.hostname}</span>
                          </div>
                          {count > 0 && <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${configCenterDevice?.id === device.id ? 'bg-white/20 text-white' : 'bg-black/5 text-black/40'}`}>{count}</span>}
                        </div>
                        <p className={`text-[9px] font-mono mt-0.5 ${configCenterDevice?.id === device.id ? 'text-white/40' : 'text-black/30'}`}>{device.ip_address}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="md:col-span-9 flex flex-col bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
          {configViewSnapshot ? (
            <div className="flex flex-col h-full">
              <div className="p-4 border-b border-black/5 bg-black/[0.01] flex items-center justify-between">
                <div>
                  <button onClick={onBackToList} className="text-[10px] font-bold uppercase text-black/30 hover:text-black flex items-center gap-1 mb-1">
                    <ChevronLeft size={12} /> {t('backToList')}
                  </button>
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-black/40">{t('configViewTab')}</h3>
                  <p className="text-xs text-black/40 mt-0.5">
                    {configViewSnapshot.hostname} · {new Date(configViewSnapshot.timestamp).toLocaleString()} · <span className="capitalize">{configViewSnapshot.trigger}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {configViewContent && <span className="text-[10px] text-black/30 font-mono">{configViewContent.split('\n').length} {t('linesCount')}</span>}
                  <button onClick={onCopyConfigContent} className="flex items-center gap-1.5 px-3 py-1.5 bg-black/5 hover:bg-black/10 rounded-lg text-xs font-medium transition-all">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                    {t('copy')}
                  </button>
                  {configCenterDevice && (
                    <button
                      onClick={() => void onFetchLiveConfig()}
                      disabled={isTakingSnapshot}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#00bceb] text-white rounded-lg text-xs font-medium hover:bg-[#0096bd] transition-all disabled:opacity-50"
                    >
                      <Download size={12} /> {t('fetchLiveConfig')}
                    </button>
                  )}
                </div>
              </div>
              <div className="flex-1 overflow-hidden flex">
                {configViewContent ? (
                  <>
                    <div className="w-12 bg-[#1a1a1a] text-white/20 font-mono text-xs text-right pr-3 py-4 select-none overflow-hidden leading-6">
                      {configViewContent.split('\n').map((_, index) => <div key={index}>{index + 1}</div>)}
                    </div>
                    <div className="flex-1 bg-[#1E1E1E] overflow-auto p-4 font-mono text-xs text-[#d4d4d4] leading-6">
                      {configViewContent.split('\n').map((line, index) => (
                        <div key={index} className={`hover:bg-white/5 px-1 rounded ${line.startsWith('#') || line.startsWith('!') ? 'text-[#6a9955]' : line.match(/^(interface|vlan|ip route|ospf|bgp|acl)/) ? 'text-[#569cd6]' : line.match(/shutdown|down/) ? 'text-[#f48771]' : ''}`}>{line || ' '}</div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="flex-1 bg-[#1E1E1E] flex flex-col items-center justify-center text-white/20">
                    <FileText size={32} strokeWidth={1} />
                    <p className="mt-3 text-sm">{t('configViewHint')}</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col h-full">
              <div className="p-4 border-b border-black/5 bg-black/[0.01] flex items-center justify-between">
                <div>
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-black/40">
                    {configCenterDevice ? `${configCenterDevice.hostname} — ${t('snapshotHistory')}` : t('allSnapshots')}
                  </h3>
                  <p className="text-[9px] text-black/30 mt-0.5">{filteredSnapshots.length} {t('snapshotsCount')}</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    value={configSnapshotKeyword}
                    onChange={(event) => onConfigSnapshotKeywordChange(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        void onSearchSnapshots();
                      }
                    }}
                    placeholder={language === 'zh' ? '模糊搜索: 设备名或IP' : 'Fuzzy search: hostname or IP'}
                    className="w-56 text-[10px] border border-black/10 rounded-lg px-2 py-1 outline-none bg-white"
                  />
                  <button onClick={() => void onSearchSnapshots()} className="px-2 py-1 text-[10px] border border-black/10 rounded-lg hover:bg-black/5">{language === 'zh' ? '查找' : 'Search'}</button>
                  <button onClick={() => void onClearSearch()} className="px-2 py-1 text-[10px] border border-black/10 rounded-lg hover:bg-black/5">{language === 'zh' ? '清空' : 'Clear'}</button>
                  <span className="text-[9px] font-bold uppercase text-black/30">{t('retentionPeriod')}</span>
                  <select value={retentionDays} onChange={(event) => onRetentionDaysChange(Number(event.target.value))} title={language === 'zh' ? '快照保留周期' : 'Snapshot retention period'} className="text-[10px] border border-black/10 rounded-lg px-2 py-1 outline-none bg-white">
                    <option value={30}>30 {t('retentionDays')}</option>
                    <option value={90}>90 {t('retentionDays')}</option>
                    <option value={180}>180 {t('retentionDays')}</option>
                    <option value={365}>1 {language === 'zh' ? '年' : 'yr'} (365d)</option>
                    <option value={730}>2 {language === 'zh' ? '年' : 'yr'} (730d)</option>
                  </select>
                  <button onClick={() => void onRefreshSnapshots()} title={language === 'zh' ? '刷新配置快照' : 'Refresh config snapshots'} className="p-1.5 rounded-lg border border-black/10 hover:bg-black/5 transition-all">
                    <RotateCcw size={13} className={configSnapshotsLoading ? 'animate-spin' : ''} />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-auto">
                {filteredSnapshots.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-black/20 p-8 text-center">
                    <Download size={32} strokeWidth={1} />
                    <p className="mt-3 text-sm font-medium">
                      {!configCenterDevice && !configSnapshotKeyword.trim() ? (language === 'zh' ? '请先按设备名或IP过滤' : 'Filter by hostname or IP first') : t('noSnapshots')}
                    </p>
                    <p className="text-xs mt-1">
                      {!configCenterDevice && !configSnapshotKeyword.trim() ? (language === 'zh' ? '为避免一次加载全部配置，请先输入筛选条件。' : 'To avoid loading all configs at once, enter a filter before searching.') : t('noSnapshotHint')}
                    </p>
                  </div>
                ) : (
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-black/[0.01] border-b border-black/5">
                        <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-black/30">{t('deviceInfo')}</th>
                        <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-black/30">{t('vendorGroup')}</th>
                        <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-black/30">{t('timestamp')}</th>
                        <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-black/30">{t('triggerType')}</th>
                        <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-black/30">{t('fileSize')}</th>
                        <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-black/30 text-right">{t('actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSnapshots.map((snapshot, index, array) => {
                        const previous = array[index + 1];
                        const changed = previous && snapshot.content !== previous.content;
                        return (
                          <tr key={snapshot.id} className="border-b border-black/5 hover:bg-black/[0.01] transition-colors">
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium">{snapshot.hostname}</span>
                                {changed && <span className="text-[8px] font-bold px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full uppercase">{t('changedBadge')}</span>}
                              </div>
                            </td>
                            <td className="px-5 py-3"><span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-black/5 text-black/50">{snapshot.vendor || '—'}</span></td>
                            <td className="px-5 py-3 text-xs text-black/50 font-mono">{new Date(snapshot.timestamp).toLocaleString()}</td>
                            <td className="px-5 py-3">
                              <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${snapshot.trigger === 'manual' ? 'bg-blue-50 text-blue-600' : snapshot.trigger === 'scheduled' ? 'bg-purple-50 text-purple-600' : snapshot.trigger === 'pre-change' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>{snapshot.trigger}</span>
                            </td>
                            <td className="px-5 py-3 text-xs text-black/40 font-mono">{snapshot.size > 1024 ? `${(snapshot.size / 1024).toFixed(1)}KB` : `${snapshot.size}B`}</td>
                            <td className="px-5 py-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button onClick={() => void onOpenSnapshot(snapshot)} className="text-[10px] font-bold uppercase text-[#00bceb] hover:underline">{t('viewConfig')}</button>
                                <button onClick={() => void onOpenDiff(snapshot)} className="text-[10px] font-bold uppercase text-black/40 hover:text-black hover:underline">{t('diffCompare')}</button>
                                <button onClick={() => void onCopySnapshot(snapshot)} className="text-[10px] font-bold uppercase text-black/40 hover:text-black hover:underline">{t('copy')}</button>
                                <button onClick={() => void onDeleteSnapshot(snapshot.id)} className="text-[10px] font-bold uppercase text-red-400 hover:text-red-600 hover:underline">{t('delete')}</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConfigBackupTab;