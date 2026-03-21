import React from 'react';
import { Database, RotateCcw } from 'lucide-react';
import type { ConfigSnapshot, Device } from '../types';
import { sectionHeaderRowClass } from '../components/shared';

interface ConfigScheduleTabProps {
  t: (key: string) => string;
  language: string;
  devices: Device[];
  configSnapshots: ConfigSnapshot[];
  isTakingSnapshot: boolean;
  scheduleEnabled: boolean;
  scheduleHour: number;
  scheduleMinute: number;
  scheduleLoading: boolean;
  retentionDays: number;
  getVendorFromPlatform: (platform?: string) => string;
  onToggleScheduleEnabled: () => void;
  onScheduleHourChange: (value: number) => void;
  onScheduleMinuteChange: (value: number) => void;
  onRetentionDaysChange: (value: number) => void;
  onSaveSchedule: () => Promise<void> | void;
  onRunBackupNow: () => Promise<void> | void;
}

const ConfigScheduleTab: React.FC<ConfigScheduleTabProps> = ({
  t,
  language,
  devices,
  configSnapshots,
  isTakingSnapshot,
  scheduleEnabled,
  scheduleHour,
  scheduleMinute,
  scheduleLoading,
  retentionDays,
  getVendorFromPlatform,
  onToggleScheduleEnabled,
  onScheduleHourChange,
  onScheduleMinuteChange,
  onRetentionDaysChange,
  onSaveSchedule,
  onRunBackupNow,
}) => {
  const onlineDeviceCount = devices.filter((device) => device.status === 'online').length;

  return (
    <div className="h-full overflow-auto">
      <div className={`${sectionHeaderRowClass} mb-5`}>
        <div>
          <h2 className="text-2xl font-medium tracking-tight">{t('scheduledBackup')}</h2>
          <p className="text-sm text-black/40">{t('enableScheduleHint')}</p>
        </div>
        <button
          onClick={() => void onRunBackupNow()}
          disabled={isTakingSnapshot}
          className="flex items-center gap-2 px-4 py-2 bg-[#00bceb] text-white rounded-xl text-sm font-medium hover:bg-[#0096bd] transition-all disabled:opacity-50"
        >
          <Database size={14} />
          {t('runBackupNow')}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
        <div className="bg-[#00bceb]/5 border border-[#00bceb]/20 rounded-2xl p-5 flex gap-4">
          <div className="p-2.5 bg-[#00bceb]/10 rounded-xl text-[#00bceb] flex-shrink-0"><Database size={20} /></div>
          <div>
            <p className="text-sm font-semibold text-black/70">{t('backupStoragePath')}</p>
            <p className="text-xs font-mono text-black/40 mt-0.5">backup / YYYY / MM / Vendor / Hostname /</p>
            <p className="text-xs font-mono text-black/30">YYYYMMDD_HHMMSS_trigger.cfg</p>
            <p className="text-[10px] text-black/30 mt-2">{t('backupPathHint')}</p>
          </div>
        </div>

        <div className="bg-white border border-black/5 rounded-2xl p-5 shadow-sm flex items-center gap-6">
          <div className="text-center">
            <p className="text-3xl font-bold text-[#00bceb]">{configSnapshots.length}</p>
            <p className="text-[10px] text-black/30 mt-1 uppercase font-bold tracking-wider">{t('snapshotsCount')}</p>
          </div>
          <div className="w-px h-12 bg-black/5" />
          <div className="text-center">
            <p className="text-3xl font-bold">{onlineDeviceCount}</p>
            <p className="text-[10px] text-black/30 mt-1 uppercase font-bold tracking-wider">{t('devicesOnline')}</p>
          </div>
          <div className="w-px h-12 bg-black/5" />
          <div className="text-center">
            <p className="text-3xl font-bold text-emerald-500">{scheduleEnabled ? '✓' : '✗'}</p>
            <p className="text-[10px] text-black/30 mt-1 uppercase font-bold tracking-wider">{t('enableSchedule')}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-white border border-black/5 rounded-2xl p-6 shadow-sm">
          <h3 className="text-sm font-bold mb-5">⏰ {t('scheduledBackup')}</h3>
          <div className="space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-black/5">
              <div>
                <p className="text-sm font-medium">{t('enableSchedule')}</p>
                <p className="text-[11px] text-black/40 mt-0.5">{t('enableScheduleHint')}</p>
              </div>
              <button
                onClick={onToggleScheduleEnabled}
                title={scheduleEnabled ? (language === 'zh' ? '关闭定时备份' : 'Disable scheduled backup') : (language === 'zh' ? '开启定时备份' : 'Enable scheduled backup')}
                className={`relative w-11 h-6 rounded-full transition-colors ${scheduleEnabled ? 'bg-[#00bceb]' : 'bg-black/10'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${scheduleEnabled ? 'translate-x-5' : ''}`} />
              </button>
            </div>

            <div className={`flex items-end gap-3 transition-opacity ${scheduleEnabled ? '' : 'opacity-40 pointer-events-none'}`}>
              <div>
                <label className="text-[10px] font-bold uppercase text-black/30 block mb-1">{t('scheduleHour')}</label>
                <select
                  value={scheduleHour}
                  onChange={(e) => onScheduleHourChange(Number(e.target.value))}
                  title={language === 'zh' ? '定时备份小时' : 'Scheduled backup hour'}
                  className="px-3 py-2 border border-black/10 rounded-xl text-sm outline-none bg-white w-28"
                >
                  {Array.from({ length: 24 }, (_, index) => <option key={index} value={index}>{String(index).padStart(2, '0')}:00</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-black/30 block mb-1">{t('scheduleMinute')}</label>
                <select
                  value={scheduleMinute}
                  onChange={(e) => onScheduleMinuteChange(Number(e.target.value))}
                  title={language === 'zh' ? '定时备份分钟' : 'Scheduled backup minute'}
                  className="px-3 py-2 border border-black/10 rounded-xl text-sm outline-none bg-white w-24"
                >
                  {[0, 15, 30, 45].map((minute) => <option key={minute} value={minute}>{String(minute).padStart(2, '0')}</option>)}
                </select>
              </div>
              <p className="text-xs text-black/40 mb-2">
                {t('nextBackupAt')}: <strong className="font-mono text-black/60">{String(scheduleHour).padStart(2, '0')}:{String(scheduleMinute).padStart(2, '0')} {language === 'zh' ? '（每天）' : '(daily)'}</strong>
              </p>
            </div>

            <div className="pt-4 border-t border-black/5">
              <label className="text-[10px] font-bold uppercase text-black/30 block mb-1">{t('retentionPeriod')}</label>
              <div className="flex items-center gap-3">
                <select
                  value={retentionDays}
                  onChange={(e) => onRetentionDaysChange(Number(e.target.value))}
                  title={language === 'zh' ? '保留天数' : 'Retention days'}
                  className="px-3 py-2 border border-black/10 rounded-xl text-sm outline-none bg-white"
                >
                  <option value={30}>30 {t('retentionDays')}</option>
                  <option value={90}>90 {t('retentionDays')}</option>
                  <option value={180}>180 {t('retentionDays')}</option>
                  <option value={365}>1 {language === 'zh' ? '年' : 'yr'} (365d)</option>
                  <option value={730}>2 {language === 'zh' ? '年' : 'yr'} (730d)</option>
                </select>
                <p className="text-[11px] text-black/30">{t('retentionHint')}</p>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => void onSaveSchedule()}
                disabled={scheduleLoading}
                className="flex items-center gap-2 px-5 py-2 bg-black text-white rounded-xl text-sm font-medium hover:bg-black/80 transition-all disabled:opacity-50"
              >
                {scheduleLoading && <RotateCcw size={14} className="animate-spin" />}
                {t('saveSchedule')}
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white border border-black/5 rounded-2xl p-6 shadow-sm">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-black/40 mb-4">{t('backupStats')}</h3>
          <div className="space-y-2">
            {devices.map((device) => {
              const count = configSnapshots.filter((snapshot) => snapshot.device_id === device.id).length;
              const latest = configSnapshots.find((snapshot) => snapshot.device_id === device.id);
              return (
                <div key={device.id} className="flex items-center justify-between py-2.5 border-b border-black/5 last:border-0">
                  <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${device.status === 'online' ? 'bg-emerald-500' : 'bg-red-400'}`} />
                    <span className="text-xs font-medium">{device.hostname}</span>
                    <span className="text-[9px] text-black/30">{getVendorFromPlatform(device.platform)}</span>
                  </div>
                  <div className="flex items-center gap-3 text-right">
                    <span className="text-[10px] text-black/40">{latest ? new Date(latest.timestamp).toLocaleString() : '—'}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${count > 0 ? 'bg-black/5 text-black/60' : 'bg-red-50 text-red-400'}`}>
                      {count} {t('snapshotsCount')}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfigScheduleTab;