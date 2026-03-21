import React from 'react';
import { motion } from 'motion/react';
import { Edit2, Eye, EyeOff, Plus, X } from 'lucide-react';
import type { Device } from '../types';

type DeviceFormMode = 'add' | 'edit';

interface DeviceFormModalProps {
  mode: DeviceFormMode;
  language: string;
  form: Partial<Device>;
  passwordVisible: boolean;
  onFormChange: (nextForm: Partial<Device>) => void;
  onTogglePasswordVisibility: () => void;
  onClose: () => void;
  onSubmit: () => void;
}

const PLATFORM_OPTIONS = [
  { value: 'cisco_ios', label: 'Cisco IOS' },
  { value: 'cisco_nxos', label: 'Cisco NX-OS' },
  { value: 'juniper_junos', label: 'Juniper Junos' },
  { value: 'arista_eos', label: 'Arista EOS' },
  { value: 'fortinet_fortios', label: 'Fortinet FortiOS' },
  { value: 'huawei_vrp', label: 'Huawei VRP' },
  { value: 'h3c_comware', label: 'H3C Comware' },
  { value: 'ruijie_rgos', label: 'Ruijie RGOS' },
];

const ROLE_OPTIONS = [
  'Core',
  'Distribution',
  'Access',
  'Edge',
  'Firewall',
  'Load Balancer',
  'Unknown',
];

const DeviceFormModal: React.FC<DeviceFormModalProps> = ({
  mode,
  language,
  form,
  passwordVisible,
  onFormChange,
  onTogglePasswordVisibility,
  onClose,
  onSubmit,
}) => {
  const isAdd = mode === 'add';

  const handleFieldChange = <K extends keyof Device>(key: K, value: Device[K] | string | number | undefined) => {
    onFormChange({ ...form, [key]: value });
  };

  const title = isAdd
    ? (language === 'zh' ? '新增设备' : 'Add New Device')
    : (language === 'zh' ? '编辑设备' : 'Edit Device');

  const submitLabel = isAdd
    ? (language === 'zh' ? '创建设备' : 'Create Device')
    : (language === 'zh' ? '保存修改' : 'Save Changes');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-black/5 bg-black/[0.02] p-6">
          <div className="flex items-center gap-3">
            <div className={`rounded-lg p-2 ${isAdd ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>
              {isAdd ? <Plus size={20} /> : <Edit2 size={20} />}
            </div>
            <h2 className="text-lg font-semibold text-black">{title}</h2>
          </div>
          <button
            onClick={onClose}
            title={isAdd
              ? (language === 'zh' ? '关闭新增设备窗口' : 'Close add device dialog')
              : (language === 'zh' ? '关闭编辑设备窗口' : 'Close edit device dialog')}
            className="text-black/40 transition-colors hover:text-black"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-black/60">Hostname</label>
              <input
                type="text"
                value={form.hostname || ''}
                title="Device hostname"
                onChange={(event) => handleFieldChange('hostname', event.target.value)}
                className="w-full rounded-xl border border-black/5 bg-black/[0.02] px-4 py-2.5 text-sm outline-none transition-colors focus:border-black/20 focus:bg-white"
                placeholder="e.g. Core-SW-01"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-black/60">IP Address</label>
              <input
                type="text"
                value={form.ip_address || ''}
                title="Device IP address"
                onChange={(event) => handleFieldChange('ip_address', event.target.value)}
                className="w-full rounded-xl border border-black/5 bg-black/[0.02] px-4 py-2.5 text-sm outline-none transition-colors focus:border-black/20 focus:bg-white"
                placeholder="e.g. 192.168.1.1"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-black/60">Software / Platform</label>
              <select
                value={form.platform || 'cisco_ios'}
                title="Device platform"
                onChange={(event) => handleFieldChange('platform', event.target.value)}
                className="w-full rounded-xl border border-black/5 bg-black/[0.02] px-4 py-2.5 text-sm outline-none transition-colors focus:border-black/20 focus:bg-white"
              >
                {PLATFORM_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-black/60">Role</label>
              <select
                value={form.role || 'Access'}
                title="Device role"
                onChange={(event) => handleFieldChange('role', event.target.value)}
                className="w-full rounded-xl border border-black/5 bg-black/[0.02] px-4 py-2.5 text-sm outline-none transition-colors focus:border-black/20 focus:bg-white"
              >
                {ROLE_OPTIONS.map((role) => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-black/60">Connection Method</label>
              <select
                value={form.connection_method || 'ssh'}
                title="Connection method"
                onChange={(event) => handleFieldChange('connection_method', event.target.value as Device['connection_method'])}
                className="w-full rounded-xl border border-black/5 bg-black/[0.02] px-4 py-2.5 text-sm outline-none transition-colors focus:border-black/20 focus:bg-white"
              >
                <option value="ssh">SSH</option>
                <option value="netconf">NETCONF</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-black/60">Site</label>
              <input
                type="text"
                value={form.site || ''}
                title="Device site"
                onChange={(event) => handleFieldChange('site', event.target.value)}
                className="w-full rounded-xl border border-black/5 bg-black/[0.02] px-4 py-2.5 text-sm outline-none transition-colors focus:border-black/20 focus:bg-white"
                placeholder="e.g. DataCenter-A"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-black/60">Serial Number</label>
              <input
                type="text"
                value={form.sn || ''}
                title="Serial number"
                onChange={(event) => handleFieldChange('sn', event.target.value)}
                className="w-full rounded-xl border border-black/5 bg-black/[0.02] px-4 py-2.5 text-sm outline-none transition-colors focus:border-black/20 focus:bg-white"
                placeholder="e.g. SN12345678"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-black/60">Model</label>
              <input
                type="text"
                value={form.model || ''}
                title="Device model"
                onChange={(event) => handleFieldChange('model', event.target.value)}
                className="w-full rounded-xl border border-black/5 bg-black/[0.02] px-4 py-2.5 text-sm outline-none transition-colors focus:border-black/20 focus:bg-white"
                placeholder="e.g. C9300-48P"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-black/60">{isAdd ? 'Software Version' : 'Version'}</label>
              <input
                type="text"
                value={form.version || ''}
                title="Software version"
                onChange={(event) => handleFieldChange('version', event.target.value)}
                className="w-full rounded-xl border border-black/5 bg-black/[0.02] px-4 py-2.5 text-sm outline-none transition-colors focus:border-black/20 focus:bg-white"
                placeholder="e.g. 17.3.3"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-black/60">SNMP Community</label>
              <input
                type="text"
                value={form.snmp_community || (isAdd ? 'public' : '')}
                title="SNMP community"
                onChange={(event) => handleFieldChange('snmp_community', event.target.value)}
                className="w-full rounded-xl border border-black/5 bg-black/[0.02] px-4 py-2.5 text-sm outline-none transition-colors focus:border-black/20 focus:bg-white"
                placeholder="public"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-black/60">SNMP Port</label>
              <input
                type="number"
                value={form.snmp_port || 161}
                title="SNMP port"
                onChange={(event) => handleFieldChange('snmp_port', Number.parseInt(event.target.value || '161', 10))}
                className="w-full rounded-xl border border-black/5 bg-black/[0.02] px-4 py-2.5 text-sm outline-none transition-colors focus:border-black/20 focus:bg-white"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-black/60">Username</label>
              <input
                type="text"
                value={form.username || ''}
                title="Login username"
                onChange={(event) => handleFieldChange('username', event.target.value)}
                className="w-full rounded-xl border border-black/5 bg-black/[0.02] px-4 py-2.5 text-sm outline-none transition-colors focus:border-black/20 focus:bg-white"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-black/60">Password</label>
              <div className="relative">
                <input
                  type={passwordVisible ? 'text' : 'password'}
                  value={form.password || ''}
                  title="Login password"
                  onChange={(event) => handleFieldChange('password', event.target.value)}
                  placeholder={isAdd ? '' : 'Leave blank to keep unchanged'}
                  className="w-full rounded-xl border border-black/5 bg-black/[0.02] px-4 py-2.5 pr-10 text-sm outline-none transition-colors focus:border-black/20 focus:bg-white"
                />
                <button
                  type="button"
                  title={passwordVisible ? 'Hide password' : 'Show password'}
                  onClick={onTogglePasswordVisibility}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-black/30 transition-colors hover:text-black/60"
                >
                  {passwordVisible ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className={`border-t border-black/5 ${isAdd ? 'bg-black/[0.01]' : 'bg-black/[0.02]'} p-6 ${isAdd ? 'flex gap-3' : 'flex justify-end gap-3'}`}>
          <button
            onClick={onClose}
            className={isAdd
              ? 'flex-1 rounded-xl border border-black/10 px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-all hover:bg-black/5'
              : 'px-6 py-2 text-sm font-medium text-black/60 hover:text-black'}
          >
            {language === 'zh' ? '取消' : 'Cancel'}
          </button>
          <button
            onClick={onSubmit}
            className={isAdd
              ? 'flex-1 rounded-xl bg-black px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-white shadow-lg shadow-black/20 transition-all hover:bg-black/80'
              : 'rounded-xl bg-black px-8 py-2 text-sm font-medium text-white shadow-lg shadow-black/10 transition-all hover:bg-black/80'}
          >
            {submitLabel}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default DeviceFormModal;