import React, { Suspense, lazy, useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'motion/react';
import { Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom';
import * as htmlToImage from 'html-to-image';
import { Plus, Server, CheckCircle, CheckCircle2, XCircle, RotateCcw, Play, Activity, LayoutDashboard, Database, Zap, ShieldCheck, History, LogOut, Search, Bell, Settings, Download, Upload, FileText, ChevronLeft, ChevronRight, Filter, Globe, TrendingUp, PieChart as PieChartIcon, Clock, AlertTriangle, X, Edit2, AlertCircle, FolderOpen, Eye, EyeOff, Sun, Moon, User, ChevronDown, Copy, Menu, PanelLeftClose, Monitor, ExternalLink, Trash2, Wrench, Maximize2, Minimize2, BarChart3, GitCompareArrows, Cpu, Network } from 'lucide-react';
import { useI18n } from './i18n.tsx';
import * as XLSX from 'xlsx';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell } from 'recharts';
import type { ConfigVersion, Device, Job, AuditEvent, ComplianceFinding, ComplianceRunPoint, ComplianceOverview, ScheduledTask, Script, ConfigTemplate, ConfigSnapshot, DiffLine, User as UserType, ThemeMode, SessionUser, NotificationItem, HostResourceSnapshot, DeviceHealthAlertItem, DeviceHealthDetailResponse, DeviceHealthTrendResponse, DeviceConnectionCheckSummary } from './types';
import { PLATFORM_LABELS, getPlatformLabel, getVendorFromPlatform } from './types';
import { sectionHeaderRowClass, sectionToolbarClass, primaryActionBtnClass, secondaryActionBtnClass, darkActionBtnClass, severityBadgeClass, complianceStatusBadgeClass, auditStatusBadgeClass, parseJsonObject } from './components/shared';
import Pagination from './components/Pagination';

const TopologyGraph = lazy(() => import('./components/TopologyGraph.tsx'));
const MonitoringCenter = lazy(() => import('./components/MonitoringCenter.tsx'));
const DeviceHealthTab = lazy(() => import('./pages/DeviceHealthTab'));
const DashboardTab = lazy(() => import('./pages/DashboardTab'));
const ComplianceTab = lazy(() => import('./pages/ComplianceTab'));
const HistoryTab = lazy(() => import('./pages/HistoryTab'));
const UsersTab = lazy(() => import('./pages/UsersTab'));
const InventoryDevicesTab = lazy(() => import('./pages/InventoryDevicesTab'));
const AlertDeskTab = lazy(() => import('./pages/AlertDeskTab'));
const AlertRulesTab = lazy(() => import('./pages/AlertRulesTab'));
const AlertMaintenanceTab = lazy(() => import('./pages/AlertMaintenanceTab'));
const ReportsTab = lazy(() => import('./pages/ReportsTab'));
const ConfigDriftTab = lazy(() => import('./pages/ConfigDriftTab'));
const CapacityPlanningTab = lazy(() => import('./pages/CapacityPlanningTab'));
const IPVlanTab = lazy(() => import('./pages/IPVlanTab'));

// Types imported from ./types — re-export User as UserType to avoid clash with lucide-react User icon

interface AppRuntimeBoundaryProps {
  children: React.ReactNode;
  language: string;
}

interface AppRuntimeBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class AppRuntimeBoundary extends React.Component<AppRuntimeBoundaryProps, AppRuntimeBoundaryState> {
  declare props: Readonly<AppRuntimeBoundaryProps>;
  state: AppRuntimeBoundaryState = { hasError: false, errorMessage: '' };

  static getDerivedStateFromError(error: Error): AppRuntimeBoundaryState {
    return { hasError: true, errorMessage: error?.message || 'Unknown runtime error' };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Keep details in console for fast diagnosis while avoiding a blank screen for users.
    console.error('Runtime error in authenticated app shell:', error, errorInfo);
  }

  handleReload = (): void => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const isZh = this.props.language === 'zh';
    return (
      <div className="min-h-screen bg-[#061324] text-white flex items-center justify-center p-6">
        <div className="max-w-xl w-full rounded-2xl border border-white/15 bg-white/5 backdrop-blur-sm p-6">
          <h2 className="text-xl font-bold">
            {isZh ? '页面运行异常，已阻止白屏' : 'Runtime issue detected, white screen prevented'}
          </h2>
          <p className="mt-3 text-sm text-white/75">
            {isZh
              ? '应用捕获到前端运行时错误。请点击“重新加载”恢复；若仍复现，请把此错误信息发给我继续定位。'
              : 'The app caught a frontend runtime error. Click Reload to recover. If it happens again, share this message for quick diagnosis.'}
          </p>
          <pre className="mt-4 rounded-xl bg-black/35 border border-white/10 p-3 text-xs text-red-200 whitespace-pre-wrap break-all">
            {this.state.errorMessage}
          </pre>
          <div className="mt-5 flex items-center gap-2">
            <button
              onClick={this.handleReload}
              className="px-4 py-2 rounded-lg bg-[#00bceb] text-white text-sm font-semibold hover:bg-[#0096bd] transition-colors"
            >
              {isZh ? '重新加载' : 'Reload'}
            </button>
          </div>
        </div>
      </div>
    );
  }
}

const LEGACY_SSH_ERROR_CODE = 'legacy_ssh_algorithms';
const SSH_AUTH_ERROR_CODE = 'ssh_authentication_failed';
const SSH_TIMEOUT_ERROR_CODE = 'ssh_transport_timeout';
const SSH_TRANSPORT_ERROR_CODE = 'ssh_transport_unreachable';

const buildConnectionTestMessage = (detail: any, errorCode?: string): string => {
  const normalizedDetail = typeof detail === 'string'
    ? detail
    : (detail && typeof detail === 'object' && 'message' in detail ? String(detail.message) : 'Connection failed');

  if (errorCode === LEGACY_SSH_ERROR_CODE) {
    return '设备 SSH 算法较旧，兼容重试后仍未完成协商。';
  }

  if (errorCode === SSH_AUTH_ERROR_CODE) {
    return '设备可达，但 SSH 认证被拒绝。请检查账号密码或 AAA/VTY 配置。';
  }

  if (errorCode === SSH_TIMEOUT_ERROR_CODE) {
    return 'SSH 会话建立或读取超时，请检查设备负载、VTY 状态或中间策略。';
  }

  if (errorCode === SSH_TRANSPORT_ERROR_CODE) {
    return 'SSH 传输层未建立，请检查 22 端口、SSH 服务和 ACL/防火墙策略。';
  }

  return normalizedDetail || 'Connection failed';
};

const buildConnectionTestHint = (errorCode?: string, language: string = 'zh'): string | null => {
  const isZh = language === 'zh';
  if (errorCode === LEGACY_SSH_ERROR_CODE) {
    return isZh ? '建议先核对设备 SSH 算法与镜像版本。' : 'Check device SSH algorithm support and software version.';
  }
  if (errorCode === SSH_AUTH_ERROR_CODE) {
    return isZh ? '建议先用同一账号手工 SSH 登录，再检查 AAA、VTY、login local。' : 'Try a manual SSH login with the same account, then review AAA, VTY, and login local.';
  }
  if (errorCode === SSH_TIMEOUT_ERROR_CODE) {
    return isZh ? '建议先检查设备 CPU、会话配额和中间安全设备。' : 'Check device CPU, session limits, and any inline security controls.';
  }
  if (errorCode === SSH_TRANSPORT_ERROR_CODE) {
    return isZh ? '建议先确认 22 端口、SSH 服务和路径 ACL。' : 'Verify TCP/22, the SSH service, and path ACLs.';
  }
  return null;
};

const buildConnectionCheckStatus = (
  success: boolean,
  mode: 'quick' | 'deep',
  errorCode?: string,
  stages?: Array<{ stage: string; ok: boolean }>,
): DeviceConnectionCheckSummary['status'] => {
  if (success) return 'ok';
  if (errorCode === LEGACY_SSH_ERROR_CODE) return 'ssh_legacy';
  if (errorCode === SSH_AUTH_ERROR_CODE) return 'ssh_auth_fail';
  if (errorCode === SSH_TIMEOUT_ERROR_CODE) return 'ssh_timeout';
  if (errorCode === SSH_TRANSPORT_ERROR_CODE) return 'ssh_transport';
  if (mode === 'quick' || stages?.some((stage) => stage.stage === 'tcp' && !stage.ok)) return 'tcp_fail';
  return 'fail';
};

const connectionCheckBadgeMeta: Record<DeviceConnectionCheckSummary['status'], { zh: string; en: string; className: string }> = {
  ok: { zh: 'OK', en: 'OK', className: 'border-emerald-200 bg-emerald-100 text-emerald-700' },
  tcp_fail: { zh: 'TCP 失败', en: 'TCP Fail', className: 'border-red-200 bg-red-100 text-red-700' },
  ssh_auth_fail: { zh: 'SSH 认证失败', en: 'SSH Auth Fail', className: 'border-rose-200 bg-rose-100 text-rose-700' },
  ssh_timeout: { zh: 'SSH 超时', en: 'SSH Timeout', className: 'border-orange-200 bg-orange-100 text-orange-700' },
  ssh_transport: { zh: 'SSH 传输失败', en: 'SSH Transport', className: 'border-slate-200 bg-slate-100 text-slate-700' },
  ssh_legacy: { zh: 'SSH 算法旧', en: 'Legacy SSH', className: 'border-amber-200 bg-amber-100 text-amber-700' },
  fail: { zh: '失败', en: 'Fail', className: 'border-red-200 bg-red-100 text-red-700' },
};

const formatConnectionCheckTime = (value: string, language: string) => {
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

// Sparkline imported from ./components/Sparkline

const App: React.FC = () => {
  const { t, language, setLanguage } = useI18n();
  const avatarPresets = [
    { id: 'preset:fox', emoji: '🦊', label: 'Fox', bgClass: 'bg-gradient-to-br from-orange-400 to-amber-600' },
    { id: 'preset:panda', emoji: '🐼', label: 'Panda', bgClass: 'bg-gradient-to-br from-slate-500 to-slate-700' },
    { id: 'preset:tiger', emoji: '🐯', label: 'Tiger', bgClass: 'bg-gradient-to-br from-amber-500 to-orange-600' },
    { id: 'preset:wolf', emoji: '🐺', label: 'Wolf', bgClass: 'bg-gradient-to-br from-zinc-500 to-zinc-700' },
    { id: 'preset:lion', emoji: '🦁', label: 'Lion', bgClass: 'bg-gradient-to-br from-yellow-500 to-amber-700' },
    { id: 'preset:koala', emoji: '🐨', label: 'Koala', bgClass: 'bg-gradient-to-br from-sky-400 to-blue-600' },
    { id: 'preset:owl', emoji: '🦉', label: 'Owl', bgClass: 'bg-gradient-to-br from-violet-500 to-indigo-700' },
    { id: 'preset:penguin', emoji: '🐧', label: 'Penguin', bgClass: 'bg-gradient-to-br from-cyan-500 to-blue-700' },
    { id: 'preset:rabbit', emoji: '🐰', label: 'Rabbit', bgClass: 'bg-gradient-to-br from-pink-400 to-fuchsia-600' },
    { id: 'preset:cat', emoji: '🐱', label: 'Cat', bgClass: 'bg-gradient-to-br from-rose-400 to-red-600' },
    { id: 'preset:dog', emoji: '🐶', label: 'Dog', bgClass: 'bg-gradient-to-br from-emerald-500 to-teal-700' },
    { id: 'preset:whale', emoji: '🐳', label: 'Whale', bgClass: 'bg-gradient-to-br from-cyan-400 to-indigo-600' },
  ] as const;
  const resolvePreset = (avatarValue?: string) => avatarPresets.find(p => p.id === avatarValue);
  const renderAvatarContent = (avatarValue: string, fallbackIconSize: number) => {
    const preset = resolvePreset(avatarValue);
    if (preset) {
      const emojiSizeClass = fallbackIconSize <= 15 ? 'text-sm' : fallbackIconSize <= 18 ? 'text-base' : 'text-xl';
      return (
        <div className={`w-full h-full ${preset.bgClass} flex items-center justify-center`}>
          <span className={`${emojiSizeClass} leading-none`}>{preset.emoji}</span>
        </div>
      );
    }
    if (avatarValue?.startsWith('preset:')) {
      return <User size={fallbackIconSize} />;
    }
    if (avatarValue) {
      return <img src={avatarValue} alt="avatar" className="w-full h-full object-cover" />;
    }
    return <User size={fallbackIconSize} />;
  };
  const getResolvedTheme = (mode: ThemeMode): 'light' | 'dark' => {
    return mode;
  };
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('netops_theme_mode') as ThemeMode | null;
    if (!saved || (saved !== 'light' && saved !== 'dark')) {
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return saved;
  });
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() => getResolvedTheme(((localStorage.getItem('netops_theme_mode') as ThemeMode | null) || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')) as ThemeMode));
  const [currentUser, setCurrentUser] = useState<SessionUser>({ username: 'admin' });
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = React.useRef<HTMLDivElement | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notificationReadMap, setNotificationReadMap] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem('netops_notification_reads');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const [profileAvatarPreview, setProfileAvatarPreview] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [loginForm, setLoginForm] = useState(() => {
    const saved = localStorage.getItem('netops_user');
    return { username: saved || '', password: '' };
  });
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [globalVars, setGlobalVars] = useState<{id?: string, key: string, value: string}[]>([]);
  const [configTemplates, setConfigTemplates] = useState<ConfigTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [editorContent, setEditorContent] = useState<string>('');

  // Check session token on mount
  useEffect(() => {
    const token = localStorage.getItem('netops_token');
    if (!token) { setAuthChecking(false); return; }
    fetch('/api/session', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(async r => {
        if (r.ok) {
          const data = await r.json();
          setIsAuthenticated(true);
          if (data?.user?.username) {
            setCurrentUser(data.user);
            if (data.user.preferred_language === 'en' || data.user.preferred_language === 'zh') {
              setLanguage(data.user.preferred_language);
            }
          }
        } else {
          localStorage.removeItem('netops_token');
        }
      })
      .catch(() => { localStorage.removeItem('netops_token'); })
      .finally(() => setAuthChecking(false));
  }, []);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => {
    localStorage.setItem('netops_notification_reads', JSON.stringify(notificationReadMap));
  }, [notificationReadMap]);

  useEffect(() => {
    const tpl = configTemplates.find(t => t.id === selectedTemplateId);
    if (tpl) {
      setEditorContent(tpl.content);
    }
  }, [selectedTemplateId, configTemplates]);

  const handleSaveTemplate = async () => {
    const tpl = configTemplates.find(t => t.id === selectedTemplateId);
    if (!tpl) return;
    
    try {
      const response = await fetch(`/api/templates/${selectedTemplateId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: tpl.name,
          type: tpl.type,
          vendor: tpl.vendor || '',
          content: editorContent,
          lastUsed: 'Just now'
        })
      });
      if (response.ok) {
        setConfigTemplates(prev => prev.map(t => 
          t.id === selectedTemplateId ? { ...t, content: editorContent, lastUsed: 'Just now' } : t
        ));
        showToast(t('saveSuccess'), 'success');
      } else {
        showToast('Failed to save template', 'error');
      }
    } catch (error) {
      showToast('Connection error', 'error');
    }
  };

  const handleAddUser = async () => {
    if (!newUserForm.username || !newUserForm.password) {
      showToast(t('fillAllFields'), 'error');
      return;
    }
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUserForm)
      });
      const data = await response.json();
      if (response.ok) {
        setUsers([...users, data]);
        setShowAddUserModal(false);
        setNewUserForm({ username: '', password: '', role: 'Operator' });
        showToast(t('userCreated'), 'success');
      } else {
        showToast(`Error: ${data.error}`, 'error');
      }
    } catch (error) {
      showToast('Connection error', 'error');
    }
  };

  const handleEditUser = async () => {
    if (!editingUser || !editUserForm.username) {
      showToast(t('fillAllFields'), 'error');
      return;
    }
    try {
      const payload: Record<string, string> = { username: editUserForm.username, role: editUserForm.role };
      if (editUserForm.password) payload.password = editUserForm.password;
      const response = await fetch(`/api/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (response.ok) {
        setUsers(prev => prev.map(u => u.id === editingUser.id ? { ...u, ...data } : u));
        setShowEditUserModal(false);
        setEditingUser(null);
        showToast('用户已更新', 'success');
      } else {
        showToast(`Error: ${data.detail || data.error}`, 'error');
      }
    } catch (error) {
      showToast('Connection error', 'error');
    }
  };

  const handleLogin = async () => {
    setLoginError(null);
    if (!loginForm.username || !loginForm.password) {
      setLoginError(t('fillAllFields'));
      return;
    }
    
    setIsAuthenticating(true);
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm)
      });
      
      const data = await response.json();
      if (response.ok && data.success) {
        if (data.token) localStorage.setItem('netops_token', data.token);
        if (rememberMe) {
          localStorage.setItem('netops_remember', 'true');
          localStorage.setItem('netops_user', loginForm.username);
        } else {
          localStorage.removeItem('netops_remember');
          localStorage.removeItem('netops_user');
        }
        setIsAuthenticated(true);
        if (data.user?.username) {
          setCurrentUser(data.user);
          if (data.user.preferred_language === 'en' || data.user.preferred_language === 'zh') {
            setLanguage(data.user.preferred_language);
          }
        }
        setUsers(prev => prev.map(u => u.id === data.user.id ? { ...u, lastLogin: data.user.lastLogin } : u));
        showToast(t('loginSuccess'), 'success');
      } else if (response.status === 429) {
        setLoginError(data.detail || t('accountLocked'));
      } else {
        setLoginError(data.detail || data.error || t('invalidCredentials'));
      }
    } catch (error) {
      setLoginError('Connection error');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleAddVar = async () => {
    const key = prompt('Enter variable key (e.g. syslog_server):');
    if (!key) return;
    const value = prompt('Enter variable value:');
    if (!value) return;

    try {
      const response = await fetch('/api/vars', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value })
      });
      const data = await response.json();
      if (response.ok) {
        setGlobalVars([...globalVars, data]);
        showToast('Variable added', 'success');
      } else {
        showToast(`Error: ${data.error}`, 'error');
      }
    } catch (error) {
      showToast('Connection error', 'error');
    }
  };

  const handleDeleteVar = async (id: string) => {
    if (!confirm('Are you sure you want to delete this variable?')) return;
    try {
      const response = await fetch(`/api/vars/${id}`, { method: 'DELETE' });
      if (response.ok) {
        setGlobalVars(prev => prev.filter(v => v.id !== id));
        showToast('Variable deleted', 'success');
      } else {
        showToast('Failed to delete variable', 'error');
      }
    } catch (error) {
      showToast('Connection error', 'error');
    }
  };

  const handleImportVars = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json<any>(worksheet);

        if (jsonData && jsonData.length > 0) {
          const newVars = jsonData.map(item => ({
            key: item.key || item['Key'] || item['变量名'] || '',
            value: String(item.value || item['Value'] || item['变量值'] || '')
          })).filter(v => v.key);

          let successCount = 0;
          for (const v of newVars) {
            try {
              const res = await fetch('/api/vars', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(v)
              });
              if (res.ok) {
                const savedVar = await res.json();
                setGlobalVars(prev => [...prev, savedVar]);
                successCount++;
              }
            } catch (err) {
              console.error('Failed to import var:', v.key, err);
            }
          }

          showToast(t('importSuccessVars').replace('{{count}}', String(successCount)), 'success');
        }
      } catch (error) {
        showToast(t('importError'), 'error');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleNewTemplate = async () => {
    const newId = `tpl-${Date.now()}`;
    const newTpl: ConfigTemplate = {
      id: newId,
      name: 'New Template',
      type: 'Jinja2',
      lastUsed: 'Never',
      category: 'custom',
      vendor: 'Custom',
      content: '# Enter your template here'
    };
    
    try {
      const response = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTpl)
      });
      if (response.ok) {
        setConfigTemplates([...configTemplates, newTpl]);
        setSelectedTemplateId(newId);
      } else {
        showToast('Failed to create template', 'error');
      }
    } catch (error) {
      showToast('Connection error', 'error');
    }
  };

  const handleOpenTemplateDeploy = () => {
    if (!editorContent.trim()) {
      showToast(language === 'zh' ? '模板内容为空，无法提交到执行台' : 'Template content is empty and cannot be sent to Automation', 'error');
      return;
    }

    const targetDeviceIds = configScopedDevices.map((device) => device.id);
    if (targetDeviceIds.length === 0) {
      showToast(
        language === 'zh' ? '当前发布范围没有匹配设备，无法提交到 Automation' : 'No devices match the current release scope, so nothing can be sent to Automation',
        'error'
      );
      return;
    }

    const initialVariableValues = configVariableKeys.reduce((acc, key) => {
      if (key in configVariableMap) acc[key] = configVariableMap[key];
      return acc;
    }, {} as Record<string, string>);

    const primaryTargetId = configScopedDevices.find((device) => device.status === 'online')?.id || targetDeviceIds[0];

    setAutomationGroupOpen(true);
    navigate('/automation/execute', {
      state: {
        configAutomationBridge: {
          source: 'configuration',
          mode: 'config',
          command: editorContent,
          templateName: selectedConfigTemplate?.name || 'Template Command',
          targetDeviceIds,
          primaryTargetId,
          variableValues: initialVariableValues,
        },
      },
    });

    showToast(
      language === 'zh'
        ? `已转到 Automation 执行台，载入 ${targetDeviceIds.length} 台目标设备`
        : `Sent to Automation workspace with ${targetDeviceIds.length} target device(s)`,
      'info'
    );
  };

  const handleDiscardChanges = () => {
    const tpl = configTemplates.find(t => t.id === selectedTemplateId);
    if (tpl) {
      setEditorContent(tpl.content);
      showToast(t('changesDiscarded'), 'info');
    }
  };

  const handleValidateTemplateWorkspace = () => {
    setConfigWorkspaceView('checks');
    if (configValidationIssues.length === 0) {
      showToast(
        language === 'zh'
          ? `校验通过，可提交到 Automation 执行 ${configScopedDevices.length} 台设备`
          : `Validation passed. Ready to send ${configScopedDevices.length} target devices to Automation`,
        'success'
      );
      return;
    }

    showToast(configValidationIssues[0], 'error');
  };
  // getVendorFromPlatform, PLATFORM_LABELS, getPlatformLabel imported from ./types

  const [scripts, setScripts] = useState<Script[]>([]);
  const [selectedScript, setSelectedScript] = useState<Script | null>(null);
  const [selectedAutomationTemplate, setSelectedAutomationTemplate] = useState<ConfigTemplate | null>(null);
  const [editedScriptContent, setEditedScriptContent] = useState<string>('');
  const [customCommand, setCustomCommand] = useState('');
  const [customCommandMode, setCustomCommandMode] = useState<'query' | 'config'>('query');
  const [scriptParams, setScriptParams] = useState<Record<string, string>>({});
  // Batch execution
  const [batchMode, setBatchMode] = useState(false);
  const [batchDeviceIds, setBatchDeviceIds] = useState<string[]>([]);
  const [batchResults, setBatchResults] = useState<{deviceId: string; hostname: string; status: 'pending'|'running'|'success'|'failed'; output?: string}[]>([]);
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  // Dry-run mode
  const [dryRun, setDryRun] = useState(false);
  // Command favorites
  const [commandFavorites, setCommandFavorites] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('cmdFavorites') || '[]'); } catch { return []; }
  });
  const [showFavorites, setShowFavorites] = useState(false);
  // Script variable substitution — parsed from {{VAR}} in script content
  const [scriptVars, setScriptVars] = useState<Record<string, string>>({});

  // Quick Query (read-only commands, no history saved)
  const [quickQueryOutput, setQuickQueryOutput] = useState<string>('');
  const [quickQueryRunning, setQuickQueryRunning] = useState(false);
  const [quickQueryLabel, setQuickQueryLabel] = useState('');
  const [quickQueryStructured, setQuickQueryStructured] = useState<any | null>(null);
  const [quickQueryView, setQuickQueryView] = useState<'terminal' | 'table'>('terminal');
  const [quickQueryMaximized, setQuickQueryMaximized] = useState(false);
  const [quickQueryCommands, setQuickQueryCommands] = useState<string[]>([]);

  // ---------- Config Center ----------
  const [retentionDays, setRetentionDays] = useState<number>(365);
  const [configSnapshots, setConfigSnapshots] = useState<ConfigSnapshot[]>([]);
  const [configSnapshotsLoading, setConfigSnapshotsLoading] = useState(false);
  const [configCenterDevice, setConfigCenterDevice] = useState<Device | null>(null);
  const [configViewContent, setConfigViewContent] = useState<string>('');
  const [configViewSnapshot, setConfigViewSnapshot] = useState<ConfigSnapshot | null>(null);
  const [configDiffLeft, setConfigDiffLeft] = useState<ConfigSnapshot | null>(null);
  const [configDiffRight, setConfigDiffRight] = useState<ConfigSnapshot | null>(null);
  const [diffOnlyChanges, setDiffOnlyChanges] = useState(false);
  const [diffShowFullBoth, setDiffShowFullBoth] = useState(false);
  const [diffFocusChangeIdx, setDiffFocusChangeIdx] = useState(0);
  const [diffBlockQuery, setDiffBlockQuery] = useState('');
  const [configSnapshotKeyword, setConfigSnapshotKeyword] = useState('');
  const [configSearchQuery, setConfigSearchQuery] = useState('');
  const [configSearchResults, setConfigSearchResults] = useState<any[]>([]);
  const [configSearchLoading, setConfigSearchLoading] = useState(false);
  const [isTakingSnapshot, setIsTakingSnapshot] = useState(false);
  const diffLineRefs = React.useRef<Record<number, HTMLDivElement | null>>({});
  // Schedule state
  const [scheduleEnabled, setScheduleEnabled] = useState(true);
  const [scheduleHour, setScheduleHour] = useState(2);
  const [scheduleMinute, setScheduleMinute] = useState(0);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const [configGroupOpen, setConfigGroupOpen] = useState(() => location.pathname.startsWith('/config'));
  const [automationGroupOpen, setAutomationGroupOpen] = useState(() => location.pathname.startsWith('/automation'));
  const [inventoryGroupOpen, setInventoryGroupOpen] = useState(() => location.pathname.startsWith('/inventory'));
  const [alertGroupOpen, setAlertGroupOpen] = useState(() => ['alerts', 'alert-rules', 'maintenance'].includes(location.pathname.split('/')[1] || 'dashboard'));
  const [monitoringGroupOpen, setMonitoringGroupOpen] = useState(() => location.pathname === '/monitoring' || location.pathname === '/inventory/interfaces');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.innerWidth < 768);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  // Playbook state
  const [scenarios, setScenarios] = useState<any[]>([]);
  const [platforms, setPlatforms] = useState<Record<string, any>>({});
  const [playbookPlatform, setPlaybookPlatform] = useState<string>('cisco_ios');
  const [playbookExecutions, setPlaybookExecutions] = useState<any[]>([]);
  const [selectedScenario, setSelectedScenario] = useState<any>(null);
  const [playbookVars, setPlaybookVars] = useState<Record<string, string>>({});
  const [playbookDeviceIds, setPlaybookDeviceIds] = useState<string[]>([]);
  const [playbookDryRun, setPlaybookDryRun] = useState(true);
  const [playbookConcurrency, setPlaybookConcurrency] = useState(1);
  const [playbookPreview, setPlaybookPreview] = useState<any>(null);
  const [quickPlaybookScenario, setQuickPlaybookScenario] = useState<any>(null);
  const [quickPlaybookVars, setQuickPlaybookVars] = useState<Record<string, string>>({});
  const [quickPlaybookPlatform, setQuickPlaybookPlatform] = useState<string>('cisco_ios');
  const [quickPlaybookDryRun, setQuickPlaybookDryRun] = useState(true);
  const [quickPlaybookConcurrency, setQuickPlaybookConcurrency] = useState(1);
  const [quickPlaybookPreview, setQuickPlaybookPreview] = useState<any>(null);
  const [quickRiskConfirmed, setQuickRiskConfirmed] = useState(false);
  const [isQuickPlaybookRunning, setIsQuickPlaybookRunning] = useState(false);
  const [quickExecutionResult, setQuickExecutionResult] = useState<{ executionId: string; deviceCount: number; dryRun: boolean; scenarioName: string; scenarioNameZh: string; timestamp: number } | null>(null);
  const [showCustomCommandModal, setShowCustomCommandModal] = useState(false);
  const [showCmdPreviewModal, setShowCmdPreviewModal] = useState(false);
  const [scenarioSearch, setScenarioSearch] = useState('');
  const [showAddScenarioModal, setShowAddScenarioModal] = useState(false);
  const [newScenarioForm, setNewScenarioForm] = useState({
    name: '',
    name_zh: '',
    description: '',
    description_zh: '',
    category: 'Custom',
    icon: '🧩',
    risk: 'medium',
    platform: 'cisco_ios',
    pre_check: '',
    execute: '',
    post_check: '',
    rollback: '',
  });
  const [newScenarioVariables, setNewScenarioVariables] = useState<Array<{ key: string; label: string; type: string; required: boolean; placeholder?: string }>>([]);
  const [scenarioDraftOrigin, setScenarioDraftOrigin] = useState<{ kind: 'manual' | 'template'; templateName?: string; variableKeys: string[] }>({
    kind: 'manual',
    variableKeys: [],
  });
  const [isSavingScenario, setIsSavingScenario] = useState(false);
  const [wsMessages, setWsMessages] = useState<any[]>([]);
  const [deviceStatusMap, setDeviceStatusMap] = useState<Record<string, { hostname: string; status: string; currentPhase?: string; phases: Record<string, { success: boolean; output?: string }>; error?: string }>>({});
  const [wsCompleteMsg, setWsCompleteMsg] = useState<any>(null);
  const [activeExecutionId, setActiveExecutionId] = useState<string | null>(null);
  const [selectedExecutionDetail, setSelectedExecutionDetail] = useState<any | null>(null);
  const [selectedExecutionLoading, setSelectedExecutionLoading] = useState(false);
  const [executionStatus, setExecutionStatus] = useState<string>('idle');
  // History pagination & lazy device loading
  const [playbookHistoryPage, setPlaybookHistoryPage] = useState(1);
  const [playbookHistoryTotal, setPlaybookHistoryTotal] = useState(0);
  const [playbookHistoryStatusFilter, setPlaybookHistoryStatusFilter] = useState('all');
  const [playbookHistoryScenarioSearch, setPlaybookHistoryScenarioSearch] = useState('');
  const [selectedExecDevices, setSelectedExecDevices] = useState<any[]>([]);
  const [selectedExecDevicesTotal, setSelectedExecDevicesTotal] = useState(0);
  const [selectedExecDevicesPage, setSelectedExecDevicesPage] = useState(1);
  const [selectedExecDevicesStatusFilter, setSelectedExecDevicesStatusFilter] = useState('all');
  const [selectedExecDevicesLoading, setSelectedExecDevicesLoading] = useState(false);
  const [selectedDeviceDetail, setSelectedDeviceDetail] = useState<any | null>(null);
  const [selectedDeviceDetailLoading, setSelectedDeviceDetailLoading] = useState(false);
  const wsRef = React.useRef<WebSocket | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [scheduledTasks, setScheduledTasks] = useState<ScheduledTask[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [topologyLinks, setTopologyLinks] = useState<any[]>([]);
  const [topologySearch, setTopologySearch] = useState('');
  const [topologyStatusFilter, setTopologyStatusFilter] = useState<'all' | 'online' | 'offline' | 'pending'>('all');
  const [topologyRoleFilter, setTopologyRoleFilter] = useState('all');
  const [topologySiteFilter, setTopologySiteFilter] = useState('all');
  const [selectedTopologyDeviceId, setSelectedTopologyDeviceId] = useState<string | null>(null);
  const [selectedTopologyLinkKey, setSelectedTopologyLinkKey] = useState<string | null>(null);
  const [topologyDiscoveryRunning, setTopologyDiscoveryRunning] = useState(false);
  const topologyRef = React.useRef<HTMLDivElement>(null);

  type TopologyOperationalState = 'up' | 'degraded' | 'down' | 'stale' | 'unknown';

  type TopologyInterfaceSnapshot = {
    name: string;
    status: string;
    maxUtilizationPct: number | null;
    errorCount: number;
    discardCount: number;
    flapping: boolean;
    operationalState: TopologyOperationalState;
  };

  type TopologyDecoratedLink = {
    id?: string;
    link_key?: string;
    source_device_id: string;
    target_device_id: string;
    source_port?: string;
    source_port_normalized?: string;
    target_port?: string;
    target_port_normalized?: string;
    source_hostname?: string;
    target_hostname?: string;
    source_hostname_resolved?: string;
    target_hostname_resolved?: string;
    discovery_source?: string;
    evidence_count?: number;
    metadata_json?: string;
    last_seen?: string;
    inferred?: boolean;
    status?: string;
    operational_state: TopologyOperationalState;
    operational_summary: string;
    evidence_sources: string[];
    reverse_confirmed: boolean;
    source_interface_snapshot: TopologyInterfaceSnapshot | null;
    target_interface_snapshot: TopologyInterfaceSnapshot | null;
  };

  const activeTab = location.pathname.split('/')[1] || 'dashboard';
  const configPage = location.pathname.split('/')[2] || 'backup';
  const automationPage = location.pathname.split('/')[2] || 'execute';
  const inventorySubPage = location.pathname.split('/')[2] || 'devices';
  const setActiveTab = (tab: string) => {
    navigate(`/${tab}`);
    if (isMobile) setSidebarCollapsed(true);
  };
  const navTo = (path: string) => {
    navigate(path);
    if (isMobile) setSidebarCollapsed(true);
  };

  const pageTitle = useMemo(() => {
    if (activeTab === 'automation') {
      const map: Record<string, string> = {
        execute: t('directExecution'),
        scenarios: t('scenarioLibrary'),
        history: t('executionHistory'),
      };
      return map[automationPage] || automationPage;
    }
    if (activeTab === 'config') {
      const map: Record<string, string> = {
        backup: t('backupHistory'),
        diff: t('diffCompare'),
        search: t('configSearchTab'),
        schedule: t('scheduledBackup'),
        drift: language === 'zh' ? '配置漂移' : 'Config Drift',
      };
      return map[configPage] || configPage;
    }
    if (activeTab === 'inventory') {
      const map: Record<string, string> = {
        devices: t('deviceList'),
        interfaces: t('interfaceMonitoring'),
      };
      return map[inventorySubPage] || inventorySubPage;
    }
    if (activeTab === 'users') return t('userManagement');
    if (activeTab === 'alerts') return language === 'zh' ? '告警信息' : 'Alert Desk';
    if (activeTab === 'alert-rules') return language === 'zh' ? '告警规则' : 'Alert Rules';
    if (activeTab === 'maintenance') return language === 'zh' ? '维护期' : 'Maintenance';
    if (activeTab === 'history') return t('auditLogs');
    if (activeTab === 'configuration') return language === 'zh' ? '平台设置' : 'Platform Settings';
    if (activeTab === 'reports') return language === 'zh' ? '运维报表' : 'Reports';
    if (activeTab === 'capacity') return language === 'zh' ? '容量规划' : 'Capacity Planning';
    if (activeTab === 'ipam') return language === 'zh' ? 'IP/VLAN管理' : 'IP/VLAN Management';
    if (activeTab === 'compliance') return t('compliance');
    if (activeTab === 'monitoring') return language === 'zh' ? '监控中心' : 'Monitoring Center';
    if (activeTab === 'health') return language === 'zh' ? '健康检测' : 'Health Detection';
    if (activeTab === 'topology') return 'Topology';
    return t('dashboard');
  }, [activeTab, automationPage, configPage, inventorySubPage, language, t]);

  const filteredScenarios = useMemo(() => {
    const q = scenarioSearch.trim().toLowerCase();
    if (!q) return scenarios;

    return scenarios.filter((sc: any) => {
      const textParts: string[] = [
        sc.id,
        sc.name,
        sc.name_zh,
        sc.description,
        sc.description_zh,
        sc.category,
        sc.risk,
      ].filter(Boolean);

      (sc.variables || []).forEach((v: any) => {
        textParts.push(v.key || '', v.label || '', v.placeholder || '');
      });

      Object.values(sc.platform_phases || {}).forEach((phase: any) => {
        ['pre_check', 'execute', 'post_check', 'rollback'].forEach((key) => {
          (phase?.[key] || []).forEach((cmd: string) => textParts.push(cmd));
        });
      });

      const blob = textParts.join(' ').toLowerCase();
      return blob.includes(q);
    });
  }, [scenarios, scenarioSearch]);

  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setSidebarCollapsed(true);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (isAuthenticated && location.pathname === '/') {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, location.pathname, navigate]);

  useEffect(() => {
    if (['alerts', 'alert-rules', 'maintenance'].includes(activeTab)) {
      setAlertGroupOpen(true);
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'monitoring' || location.pathname === '/inventory/interfaces') {
      setMonitoringGroupOpen(true);
    }
  }, [activeTab, location.pathname]);

  // Load config snapshots from backend when entering Config Center tab
  const loadConfigSnapshots = async (
    deviceId?: string,
    options?: { requireFilter?: boolean; q?: string }
  ) => {
    const q = (options?.q ?? configSnapshotKeyword).trim();
    const requireFilter = options?.requireFilter ?? false;
    const hasAnyFilter = Boolean(deviceId || q);

    if (requireFilter && !hasAnyFilter) {
      setConfigSnapshots([]);
      setConfigSnapshotsLoading(false);
      return;
    }

    setConfigSnapshotsLoading(true);
    try {
      const params = new URLSearchParams();
      if (deviceId) params.set('device_id', deviceId);
      if (q) params.set('q', q);
      const qs = params.toString();
      const url = qs ? `/api/configs/snapshots?${qs}` : '/api/configs/snapshots';
      const resp = await fetch(url);
      if (resp.ok) {
        const data = await resp.json() as ConfigSnapshot[];
        setConfigSnapshots(data);
      }
    } catch { /* network error */ }
    finally { setConfigSnapshotsLoading(false); }
  };

  // Load schedule settings from backend
  const loadScheduleConfig = async () => {
    try {
      const resp = await fetch('/api/configs/schedule');
      if (resp.ok) {
        const cfg = await resp.json();
        setScheduleEnabled(cfg.enabled ?? true);
        setScheduleHour(cfg.hour ?? 2);
        setScheduleMinute(cfg.minute ?? 0);
      }
    } catch { /* ignore */ }
  };

  // ── Playbook helpers ──
  const loadScenarios = async () => {
    try {
      const [scenResp, platResp] = await Promise.all([
        fetch('/api/playbooks/scenarios'),
        fetch('/api/playbooks/platforms'),
      ]);
      if (scenResp.ok) setScenarios(await scenResp.json());
      if (platResp.ok) setPlatforms(await platResp.json());
    } catch { /* ignore */ }
  };

  const loadPlaybookHistory = async (
    page = playbookHistoryPage,
    statusFilter = playbookHistoryStatusFilter,
    scenarioFilter = playbookHistoryScenarioSearch,
  ) => {
    try {
      const params = new URLSearchParams({
        page: String(page),
        page_size: '20',
        status: statusFilter,
        scenario: scenarioFilter,
      });
      const playbookResp = await fetch(`/api/playbooks?${params}`);
      let playbookItems: any[] = [];
      let playbookTotal = 0;
      if (playbookResp.ok) {
        const d = await playbookResp.json();
        playbookItems = (d.items || []).map((e: any) => ({ ...e, _type: 'playbook' }));
        playbookTotal = d.total || 0;
      }
      setPlaybookExecutions(playbookItems);
      setPlaybookHistoryTotal(playbookTotal);
    } catch { /* ignore */ }
  };

  const loadExecDevices = async (
    execId: string,
    page = 1,
    statusFilter = 'all',
    search = '',
  ) => {
    setSelectedExecDevicesLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        page_size: '20',
        status: statusFilter,
        search,
      });
      const r = await fetch(`/api/playbooks/${execId}/devices?${params}`);
      if (r.ok) {
        const data = await r.json();
        setSelectedExecDevices(data.items || []);
        setSelectedExecDevicesTotal(data.total || 0);
      }
    } finally {
      setSelectedExecDevicesLoading(false);
    }
  };

  const loadNotifications = useCallback(async () => {
    try {
      const userId = currentUser.id ? encodeURIComponent(String(currentUser.id)) : '';
      const url = userId ? `/api/notifications?limit=40&user_id=${userId}` : '/api/notifications?limit=40';
      const resp = await fetch(url);
      if (!resp.ok) return;
      const data = await resp.json();
      setNotifications((data || []).map((n: any) => ({
        id: String(n.id),
        title: n.source === 'system_resource'
          ? (language === 'zh' ? `平台资源告警: ${n.title}` : `Platform Resource Alert: ${n.title}`)
          : n.title,
        message: n.message,
        time: n.time,
        source: n.source,
        severity: n.severity,
        read: !!n.read || !!notificationReadMap[String(n.id)],
      })));
    } catch {
      // ignore polling errors
    }
  }, [currentUser.id, language, notificationReadMap]);

  const markNotificationsAsRead = useCallback(async (ids: string[]) => {
    if (!ids.length || !currentUser.id) return;
    try {
      await fetch('/api/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: String(currentUser.id), notification_ids: ids }),
      });
    } catch {
      // keep optimistic local UI state even on transient API errors
    }
  }, [currentUser.id]);

  const openQuickPlaybookModal = (scenario: any) => {
    const platform = scenario.default_platform || scenario.supported_platforms?.[0] || 'cisco_ios';
    setQuickPlaybookScenario(scenario);
    setQuickPlaybookPlatform(platform);
    setQuickPlaybookVars({});
    setQuickPlaybookDryRun(true);
    setQuickPlaybookConcurrency(1);
    setQuickPlaybookPreview(null);
    setQuickRiskConfirmed(false);
    setQuickExecutionResult(null);
  };

  const loadQuickPlaybookPreview = useCallback(async (scenario: any, platform: string, variables: Record<string, string>) => {
    if (!scenario?.id || !platform) {
      setQuickPlaybookPreview(null);
      return;
    }
    try {
      const resp = await fetch('/api/playbooks/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario_id: scenario.id, platform, variables }),
      });
      if (!resp.ok) {
        setQuickPlaybookPreview(null);
        return;
      }
      setQuickPlaybookPreview(await resp.json());
    } catch {
      setQuickPlaybookPreview(null);
    }
  }, []);

  const runQuickPlaybook = async (dryRunOverride?: boolean) => {
    if (!quickPlaybookScenario) return;
    const targetDeviceIds = batchMode
      ? batchDeviceIds
      : (selectedDevice?.id ? [selectedDevice.id] : []);

    if (targetDeviceIds.length === 0) {
      showToast('Select target device(s) first in Direct Execution', 'error');
      return;
    }
    if (quickHasMixedPlatforms) {
      showToast(language === 'zh' ? '批量目标包含多个平台，请按平台分组执行。' : 'Batch targets contain multiple platforms. Execute one platform group at a time.', 'error');
      return;
    }
    if (quickPlatformMismatch) {
      showToast(language === 'zh' ? '当前场景不支持所选设备平台。' : 'Current scenario does not support selected device platform.', 'error');
      return;
    }

    const effectiveDryRun = dryRunOverride !== undefined ? dryRunOverride : quickPlaybookDryRun;
    if (dryRunOverride !== undefined) setQuickPlaybookDryRun(dryRunOverride);

    setWsMessages([]);
    setDeviceStatusMap({});
    setWsCompleteMsg(null);
    setIsQuickPlaybookRunning(true);
    try {
      const resp = await fetch('/api/playbooks/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario_id: quickPlaybookScenario.id,
          platform: quickPlaybookPlatform,
          device_ids: targetDeviceIds,
          variables: quickPlaybookVars,
          dry_run: effectiveDryRun,
          concurrency: quickPlaybookConcurrency,
          author: currentUser.username || 'admin',
          actor_id: currentUser.id,
          actor_role: currentUser.role || 'Administrator',
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        showToast(`Execution failed: ${data.detail || resp.statusText}`, 'error');
        setIsQuickPlaybookRunning(false);
        return;
      }

      showToast(language === 'zh' ? `已提交执行，${targetDeviceIds.length} 台设备` : `Execution submitted for ${targetDeviceIds.length} device(s)`, 'success');
      setSelectedScenario(quickPlaybookScenario);
      setPlaybookPlatform(quickPlaybookPlatform);
      setPlaybookVars(quickPlaybookVars);
      setPlaybookDryRun(effectiveDryRun);
      setPlaybookConcurrency(quickPlaybookConcurrency);
      setPlaybookDeviceIds(targetDeviceIds);
      setActiveExecutionId(data.execution_id || null);
      setExecutionStatus('running');
      setQuickExecutionResult({
        executionId: data.execution_id || '',
        deviceCount: targetDeviceIds.length,
        dryRun: effectiveDryRun,
        scenarioName: quickPlaybookScenario.name,
        scenarioNameZh: quickPlaybookScenario.name_zh,
        timestamp: Date.now(),
      });
      // Open WebSocket for live per-device output in Panel 3
      const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const wsUrl = `${wsProtocol}://${window.location.host}/api/ws/playbook/${data.execution_id}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          setWsMessages(prev => [...prev, msg]);
          // Aggregate into deviceStatusMap for Panel 3
          if (msg.type === 'device_start') {
            setDeviceStatusMap(prev => ({ ...prev, [msg.device_id]: { hostname: msg.hostname || String(msg.device_id), status: 'running', phases: {} } }));
          } else if (msg.type === 'phase_done') {
            setDeviceStatusMap(prev => {
              const dev = prev[msg.device_id];
              if (!dev) return prev;
              return { ...prev, [msg.device_id]: { ...dev, phases: { ...dev.phases, [msg.phase]: { success: msg.output?.success ?? true, output: msg.output?.output } } } };
            });
          } else if (msg.type === 'device_done') {
            setDeviceStatusMap(prev => {
              const dev = prev[msg.device_id];
              return dev ? { ...prev, [msg.device_id]: { ...dev, status: msg.status || 'success', currentPhase: undefined } } : prev;
            });
          } else if (msg.type === 'device_error') {
            setDeviceStatusMap(prev => ({ ...prev, [msg.device_id]: { hostname: String(msg.device_id), status: 'error', phases: {}, error: msg.error || 'Unknown error' } }));
          } else if (msg.type === 'complete') {
            setWsCompleteMsg(msg);
            setExecutionStatus(msg.status);
            setIsQuickPlaybookRunning(false);
            ws.close();
            loadPlaybookHistory();
          }
        } catch { /* ignore */ }
      };
      ws.onerror = () => { setExecutionStatus('ws_error'); setIsQuickPlaybookRunning(false); };
      ws.onclose = () => { wsRef.current = null; };
      loadPlaybookHistory();
    } catch {
      showToast('Connection error', 'error');
      setIsQuickPlaybookRunning(false);
    }
  };

  useEffect(() => {
    if (!quickPlaybookScenario) return;
    const timer = window.setTimeout(() => {
      loadQuickPlaybookPreview(quickPlaybookScenario, quickPlaybookPlatform, quickPlaybookVars);
    }, 220);
    return () => window.clearTimeout(timer);
  }, [quickPlaybookScenario, quickPlaybookPlatform, quickPlaybookVars, loadQuickPlaybookPreview]);

  const splitLines = (text: string) => text.split('\n').map(s => s.trim()).filter(Boolean);

  const quickTargetDevices = useMemo(() => {
    if (batchMode) {
      const selectedIds = new Set(batchDeviceIds);
      return devices.filter((d) => selectedIds.has(d.id));
    }
    return selectedDevice ? [selectedDevice] : [];
  }, [batchMode, batchDeviceIds, devices, selectedDevice]);

  const quickDetectedPlatforms = useMemo(() => {
    return Array.from(new Set(quickTargetDevices.map((d) => d.platform).filter(Boolean)));
  }, [quickTargetDevices]);

  const quickHasMixedPlatforms = quickDetectedPlatforms.length > 1;
  const quickDetectedPlatform = quickDetectedPlatforms.length === 1 ? quickDetectedPlatforms[0] : '';
  const quickScenarioSupportsDetectedPlatform = !!(
    quickPlaybookScenario &&
    quickDetectedPlatform &&
    (quickPlaybookScenario.supported_platforms || []).includes(quickDetectedPlatform)
  );
  const quickAutoPlatform = quickDetectedPlatform
    || quickPlaybookScenario?.default_platform
    || quickPlaybookScenario?.supported_platforms?.[0]
    || 'cisco_ios';

  const quickPlatformMismatch = !!(
    quickPlaybookScenario &&
    quickDetectedPlatform &&
    !quickScenarioSupportsDetectedPlatform
  );

  useEffect(() => {
    if (!quickPlaybookScenario) return;
    if (quickPlaybookPlatform !== quickAutoPlatform) {
      setQuickPlaybookPlatform(quickAutoPlatform);
    }
  }, [quickPlaybookScenario, quickAutoPlatform, quickPlaybookPlatform]);
  const resetScenarioDraft = useCallback(() => {
    setShowAddScenarioModal(false);
    setNewScenarioForm({
      name: '',
      name_zh: '',
      description: '',
      description_zh: '',
      category: 'Custom',
      icon: '🧩',
      risk: 'medium',
      platform: 'cisco_ios',
      pre_check: '',
      execute: '',
      post_check: '',
      rollback: '',
    });
    setNewScenarioVariables([]);
    setScenarioDraftOrigin({ kind: 'manual', variableKeys: [] });
  }, []);

  const inferScenarioVariableType = (key: string): 'text' | 'number' => {
    const normalized = key.toLowerCase();
    if (/(id|vlan|asn|metric|count|port|timeout|mtu|weight|preference|cost|bandwidth|delay)$/.test(normalized)) {
      return 'number';
    }
    return 'text';
  };

  const formatScenarioVariableLabel = (key: string) => key
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

  const handleCreateScenarioDraftFromTemplate = () => {
    if (!selectedConfigTemplate) {
      showToast(language === 'zh' ? '请先选择模板资产' : 'Select a template asset first', 'error');
      return;
    }

    if (!editorContent.trim()) {
      showToast(language === 'zh' ? '模板内容为空，无法生成场景草稿' : 'Template content is empty and cannot be converted into a scenario draft', 'error');
      return;
    }

    const platformFromScope = configScopePlatform !== 'all'
      ? configScopePlatform
      : (configPlatformOptions[0]
        || ({
          Cisco: 'cisco_ios',
          Juniper: 'juniper_junos',
          Huawei: 'huawei_vrp',
          H3C: 'h3c_comware',
          Arista: 'arista_eos',
        } as Record<string, string>)[selectedConfigTemplate.vendor || '']
        || 'cisco_ios');

    const detectedVariables = extractVars(editorContent);
    const variableDrafts = detectedVariables.map((key) => ({
      key,
      label: formatScenarioVariableLabel(key),
      type: inferScenarioVariableType(key),
      required: true,
      placeholder: configVariableMap[key] || key,
    }));

    setNewScenarioForm({
      name: `${selectedConfigTemplate.name} Draft`,
      name_zh: `${selectedConfigTemplate.name} 草稿`,
      description: `Imported from configuration template ${selectedConfigTemplate.name}`,
      description_zh: `由配置模板 ${selectedConfigTemplate.name} 转换而来`,
      category: 'Config Template',
      icon: '🧩',
      risk: configScopedDevices.length > 10 ? 'high' : configScopedDevices.length > 1 ? 'medium' : 'low',
      platform: platformFromScope,
      pre_check: '',
      execute: editorContent,
      post_check: '',
      rollback: '',
    });
    setNewScenarioVariables(variableDrafts);
    setScenarioDraftOrigin({
      kind: 'template',
      templateName: selectedConfigTemplate.name,
      variableKeys: detectedVariables,
    });
    setShowAddScenarioModal(true);
  };

  const openManualScenarioDraft = () => {
    resetScenarioDraft();
    setShowAddScenarioModal(true);
  };

  const createScenario = async () => {
    if (!newScenarioForm.name.trim()) {
      showToast('Scenario name is required', 'error');
      return;
    }
    if (!newScenarioForm.execute.trim()) {
      showToast('Execute commands cannot be empty', 'error');
      return;
    }

    const platform = newScenarioForm.platform;
    const payload = {
      name: newScenarioForm.name.trim(),
      name_zh: newScenarioForm.name_zh.trim() || newScenarioForm.name.trim(),
      description: newScenarioForm.description.trim(),
      description_zh: newScenarioForm.description_zh.trim() || newScenarioForm.description.trim(),
      category: newScenarioForm.category.trim() || 'Custom',
      icon: newScenarioForm.icon.trim() || '🧩',
      risk: newScenarioForm.risk,
      supported_platforms: [platform],
      default_platform: platform,
      variables: newScenarioVariables,
      platform_phases: {
        [platform]: {
          pre_check: splitLines(newScenarioForm.pre_check),
          execute: splitLines(newScenarioForm.execute),
          post_check: splitLines(newScenarioForm.post_check),
          rollback: splitLines(newScenarioForm.rollback),
        },
      },
    };

    setIsSavingScenario(true);
    try {
      const resp = await fetch('/api/playbooks/scenarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        showToast(`Error: ${data.detail || resp.statusText}`, 'error');
        return;
      }

      resetScenarioDraft();
      showToast('Custom scenario created', 'success');
      await loadScenarios();
      openQuickPlaybookModal(data);
      navigate('/automation/execute');
    } catch {
      showToast('Connection error', 'error');
    } finally {
      setIsSavingScenario(false);
    }
  };

  const previewPlaybook = async () => {
    if (!selectedScenario) {
      showToast(language === 'zh' ? '请先选择场景' : 'Please select a scenario first', 'error');
      return;
    }
    const missingRequired = (selectedScenario.variables || [])
      .filter((v: any) => v.required && !String(playbookVars[v.key] ?? '').trim())
      .map((v: any) => v.label || v.key);
    if (missingRequired.length > 0) {
      showToast(
        language === 'zh'
          ? `缺少必填字段: ${missingRequired.join(', ')}`
          : `Missing required fields: ${missingRequired.join(', ')}`,
        'error'
      );
      setPlaybookPreview(null);
      return;
    }
    try {
      const resp = await fetch('/api/playbooks/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario_id: selectedScenario.id, platform: playbookPlatform, variables: playbookVars }),
      });
      if (resp.ok) {
        setPlaybookPreview(await resp.json());
        showToast(language === 'zh' ? '命令预览已生成' : 'Command preview generated', 'success');
      } else {
        const err = await resp.json().catch(() => ({ detail: resp.statusText }));
        showToast(`Preview failed: ${err.detail || 'Unknown error'}`, 'error');
      }
    } catch {
      showToast(language === 'zh' ? '预览请求失败，请检查网络连接' : 'Preview request failed. Please check your network.', 'error');
    }
  };

  const executePlaybook = async (dryRunOverride?: boolean) => {
    if (!selectedScenario) {
      showToast(language === 'zh' ? '请先选择场景' : 'Please select a scenario first', 'error');
      return;
    }
    if (playbookDeviceIds.length === 0) {
      showToast(language === 'zh' ? '请先选择目标设备' : 'Please select target devices first', 'error');
      return;
    }
    const missingRequired = (selectedScenario.variables || [])
      .filter((v: any) => v.required && !String(playbookVars[v.key] ?? '').trim())
      .map((v: any) => v.label || v.key);
    if (missingRequired.length > 0) {
      showToast(
        language === 'zh'
          ? `缺少必填字段: ${missingRequired.join(', ')}`
          : `Missing required fields: ${missingRequired.join(', ')}`,
        'error'
      );
      return;
    }
    const effectiveDryRun = dryRunOverride !== undefined ? dryRunOverride : playbookDryRun;
    setPlaybookDryRun(effectiveDryRun);
    setExecutionStatus('starting');
    setWsMessages([]);
    setDeviceStatusMap({});
    setWsCompleteMsg(null);
    try {
      const resp = await fetch('/api/playbooks/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario_id: selectedScenario.id,
          platform: playbookPlatform,
          device_ids: playbookDeviceIds,
          variables: playbookVars,
          dry_run: effectiveDryRun,
          concurrency: playbookConcurrency,
          author: currentUser.username || 'admin',
          actor_id: currentUser.id,
          actor_role: currentUser.role || 'Administrator',
        }),
      });
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        showToast(`执行失败: ${errData.detail || resp.statusText}`, 'error');
        setExecutionStatus('idle');
        return;
      }
      if (resp.ok) {
        const { execution_id } = await resp.json();
        setActiveExecutionId(execution_id);
        setExecutionStatus('running');
        showToast(effectiveDryRun ? (language === 'zh' ? 'Dry-Run 已启动' : 'Dry-Run started') : (language === 'zh' ? '执行任务已启动' : 'Execution started'), 'success');
        // Optimistic: add new execution to the list immediately
        setPlaybookExecutions(prev => [{
          id: execution_id,
          scenario_id: selectedScenario.id,
          scenario_name: selectedScenario.name,
          platform: playbookPlatform,
          device_ids: JSON.stringify(playbookDeviceIds),
          variables: JSON.stringify(playbookVars),
          status: 'running',
          dry_run: effectiveDryRun ? 1 : 0,
          author: 'admin',
          concurrency: playbookConcurrency,
          results_json: '{}',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, ...prev]);
        // Connect WebSocket via Vite proxy (same origin)
        const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
        const wsUrl = `${wsProtocol}://${window.location.host}/api/ws/playbook/${execution_id}`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;
        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data);
            setWsMessages(prev => [...prev, msg]);
            // Aggregate into deviceStatusMap
            if (msg.type === 'device_start') {
              setDeviceStatusMap(prev => ({ ...prev, [msg.device_id]: { hostname: msg.hostname || String(msg.device_id), status: 'running', phases: {} } }));
            } else if (msg.type === 'phase_done') {
              setDeviceStatusMap(prev => {
                const dev = prev[msg.device_id];
                if (!dev) return prev;
                return { ...prev, [msg.device_id]: { ...dev, phases: { ...dev.phases, [msg.phase]: { success: msg.output?.success ?? true, output: msg.output?.output } } } };
              });
            } else if (msg.type === 'device_done') {
              setDeviceStatusMap(prev => {
                const dev = prev[msg.device_id];
                return dev ? { ...prev, [msg.device_id]: { ...dev, status: msg.status || 'success', currentPhase: undefined } } : prev;
              });
            } else if (msg.type === 'device_error') {
              setDeviceStatusMap(prev => ({ ...prev, [msg.device_id]: { hostname: String(msg.device_id), status: 'error', phases: {}, error: msg.error || 'Unknown error' } }));
            } else if (msg.type === 'complete') {
              setWsCompleteMsg(msg);
              setExecutionStatus(msg.status);
              ws.close();
              // Refresh to get final results
              loadPlaybookHistory();
            }
          } catch { /* ignore */ }
        };
        ws.onerror = () => setExecutionStatus('ws_error');
        ws.onclose = () => { wsRef.current = null; };
        // Navigate to history to watch
        navigate('/automation/history');
      } else {
        const err = await resp.json().catch(() => ({ detail: resp.statusText }));
        showToast(`Execution failed: ${err.detail || 'Unknown error'}`, 'error');
        setExecutionStatus('idle');
      }
    } catch (e: any) {
      showToast(`Execution error: ${e.message || 'Network error'}`, 'error');
      setExecutionStatus('idle');
    }
  };

  useEffect(() => {
    if (activeTab === 'automation') {
      if (automationPage === 'playbooks') { navigate('/automation/execute'); return; }
      loadScenarios();
      if (automationPage === 'execute' || automationPage === 'scenarios' || automationPage === 'history') {
        loadPlaybookHistory();
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, automationPage]);

  const resetAutomationSubmenuState = useCallback((page: string) => {
    if (page === 'execute') {
      setAutomationSearch('');
      setBatchMode(false);
      setBatchDeviceIds([]);
      setSelectedDevice(null);
      setQuickPlaybookScenario(null);
      setQuickPlaybookVars({});
      setQuickPlaybookPlatform('cisco_ios');
      setQuickPlaybookDryRun(true);
      setQuickPlaybookConcurrency(1);
      setQuickPlaybookPreview(null);
      setQuickRiskConfirmed(false);
      setShowCustomCommandModal(false);
      setShowCmdPreviewModal(false);
      setQuickQueryOutput('');
      setQuickQueryLabel('');
      setQuickQueryStructured(null);
      setQuickQueryView('terminal');
      setQuickQueryMaximized(false);
      setQuickQueryCommands([]);
      return;
    }

    if (page === 'playbooks') {
      setSelectedScenario(null);
      setPlaybookVars({});
      setPlaybookDeviceIds([]);
      setPlaybookDryRun(true);
      setPlaybookConcurrency(1);
      setPlaybookPreview(null);
      return;
    }

    if (page === 'scenarios') {
      setShowAddScenarioModal(false);
      setScenarioSearch('');
    }

    if (page === 'history') {
      setPlaybookHistoryPage(1);
      setPlaybookHistoryStatusFilter('');
      setPlaybookHistoryScenarioSearch('');
    }
  }, []);

  const resetConfigSubmenuState = useCallback((page: string) => {
    if (page === 'backup') {
      setConfigCenterDevice(null);
      setConfigViewSnapshot(null);
      setConfigViewContent('');
      setConfigSnapshots([]);
      setConfigSnapshotsLoading(false);
      setIsTakingSnapshot(false);
      return;
    }

    if (page === 'diff') {
      setConfigDiffLeft(null);
      setConfigDiffRight(null);
      return;
    }

    if (page === 'search') {
      setConfigSearchQuery('');
      setConfigSearchResults([]);
      setConfigSearchLoading(false);
      return;
    }

    if (page === 'schedule') {
      setShowScheduleModal(false);
      setSchedulingTask(null);
      setScheduleForm({
        type: 'once',
        interval: 'daily',
        time: '',
        timezone: 'UTC',
      });
    }
  }, []);

  const resetInventorySubmenuState = useCallback((page: string) => {
    if (page === 'devices') {
      setInventorySearch('');
      setInventoryPlatformFilter('all');
      setInventoryStatusFilter('all');
      setInventorySortConfig(null);
      setSelectedDeviceIds([]);
      setInventoryPage(1);
      return;
    }

    if (page === 'interfaces') {
      setIntfSearch('');
      setIntfDevicePage(1);
      setIntfExpandedDevice(null);
      setIntfPageMap({});
      setIntfFilterMap({});
      setIntfStatusFilter('hasData');
      setIntfSortBy('name');
      setIntfHideEmpty(true);
    }
  }, []);

  type SubmenuTab = 'automation' | 'config' | 'inventory';

  const submenuPageByTab = useMemo<Record<SubmenuTab, string>>(() => ({
    automation: automationPage,
    config: configPage,
    inventory: inventorySubPage,
  }), [automationPage, configPage, inventorySubPage]);

  const submenuResetByTab = useMemo<Record<SubmenuTab, (page: string) => void>>(() => ({
    automation: resetAutomationSubmenuState,
    config: resetConfigSubmenuState,
    inventory: resetInventorySubmenuState,
  }), [resetAutomationSubmenuState, resetConfigSubmenuState, resetInventorySubmenuState]);

  const prevSubmenuPageRef = React.useRef<Record<SubmenuTab, string>>({
    automation: automationPage,
    config: configPage,
    inventory: inventorySubPage,
  });

  useEffect(() => {
    if (!(activeTab === 'automation' || activeTab === 'config' || activeTab === 'inventory')) return;

    const tab = activeTab as SubmenuTab;
    const currentPage = submenuPageByTab[tab];
    const prevPage = prevSubmenuPageRef.current[tab];
    if (prevPage === currentPage) return;

    submenuResetByTab[tab](prevPage);
    prevSubmenuPageRef.current[tab] = currentPage;
  }, [activeTab, submenuPageByTab, submenuResetByTab]);

  useEffect(() => {
    if (!isAuthenticated) return;
    loadNotifications();
    const timer = window.setInterval(loadNotifications, 15000);
    return () => window.clearInterval(timer);
  }, [isAuthenticated, loadNotifications]);

  // When entering config_center tab, refresh snapshots + schedule
  useEffect(() => {
    if (activeTab === 'config') {
      if (configPage === 'backup') {
        loadConfigSnapshots(configCenterDevice?.id, { requireFilter: true });
      }
      if (configPage === 'diff') {
        loadConfigSnapshots(configCenterDevice?.id, { requireFilter: true });
      }
      if (configPage === 'search') {
        loadConfigSnapshots(configCenterDevice?.id);
      }
      if (configPage === 'schedule') {
        loadScheduleConfig();
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, configPage, configCenterDevice?.id]);

  const handleExportMap = async () => {
    if (!topologyRef.current) return;
    showToast('Preparing topology map for export...', 'info');
    try {
      // Wait a bit for any animations to settle
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const dataUrl = await htmlToImage.toPng(topologyRef.current, {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left'
        }
      });
      
      const link = document.createElement('a');
      link.download = `network-topology-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = dataUrl;
      link.click();
      showToast('Topology map exported successfully', 'success');
    } catch (error) {
      console.error('Export error:', error);
      showToast('Failed to export map. Please try again.', 'error');
    }
  };

  const [users, setUsers] = useState<UserType[]>([]);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  // 密码显示/隐藏 state
  const [showLoginPwd, setShowLoginPwd] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => localStorage.getItem('netops_remember') === 'true');
  const [trendDays, setTrendDays] = useState<7 | 30>(7);
  const [dashBannerCollapsed, setDashBannerCollapsed] = useState(false);
  const [dashLastRefresh, setDashLastRefresh] = useState<Date>(new Date());
  const [showNewUserPwd, setShowNewUserPwd] = useState(false);
  const [showEditUserPwd, setShowEditUserPwd] = useState(false);
  const [showAddDevicePwd, setShowAddDevicePwd] = useState(false);
  const [showEditDevicePwd, setShowEditDevicePwd] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showProfilePwd, setShowProfilePwd] = useState(false);
  const [profileForm, setProfileForm] = useState({ username: '', password: '', confirmPassword: '' });
  const [notificationChannels, setNotificationChannels] = useState<{
    feishu:   { webhook_url: string; enabled: boolean };
    dingtalk: { webhook_url: string; enabled: boolean; secret: string };
    wechat:   { webhook_url: string; enabled: boolean };
  }>({
    feishu:   { webhook_url: '', enabled: false },
    dingtalk: { webhook_url: '', enabled: false, secret: '' },
    wechat:   { webhook_url: '', enabled: false },
  });
  const [notifyTestLoading, setNotifyTestLoading] = useState<string>(''); // platform name being tested
  const [editingUser, setEditingUser] = useState<UserType | null>(null);
  const [editUserForm, setEditUserForm] = useState({ username: '', password: '', role: 'Operator' });
  const [configWorkspaceView, setConfigWorkspaceView] = useState<'source' | 'rendered' | 'checks'>('source');
  const [configScopePlatform, setConfigScopePlatform] = useState<string>('all');
  const [configScopeRole, setConfigScopeRole] = useState<string>('all');
  const [configScopeSite, setConfigScopeSite] = useState<string>('all');
  const [newUserForm, setNewUserForm] = useState({ username: '', password: '', role: 'Operator' });
  const [isLoading, setIsLoading] = useState(true);
  const currentUserRecord = users.find(u => u.username === currentUser.username);
  const currentUserLastLogin = currentUserRecord?.lastLogin || 'Never';
  const unreadNotifications = notifications.filter(n => !n.read);
  const unreadNotificationCount = notifications.filter(n => !n.read).length;
  const currentAvatar = currentUser.avatar_url || currentUserRecord?.avatar_url || '';
  const automationBridgeState = (location.state as { configAutomationBridge?: {
    source?: string;
    mode?: 'query' | 'config';
    command?: string;
    templateName?: string;
    targetDeviceIds?: string[];
    primaryTargetId?: string;
    variableValues?: Record<string, string>;
  } } | null)?.configAutomationBridge;
  const selectedConfigTemplate = useMemo(
    () => configTemplates.find((template) => template.id === selectedTemplateId) || null,
    [configTemplates, selectedTemplateId]
  );
  const configVariableKeys = useMemo(() => extractVars(editorContent), [editorContent]);
  const configVariableMap = useMemo(
    () => globalVars.reduce((acc, item) => {
      acc[item.key] = String(item.value ?? '');
      return acc;
    }, {} as Record<string, string>),
    [globalVars]
  );
  const configMissingVariables = useMemo(
    () => configVariableKeys.filter((key) => !String(configVariableMap[key] ?? '').trim()),
    [configVariableKeys, configVariableMap]
  );
  const configRenderedPreview = useMemo(
    () => editorContent.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, key: string) => configVariableMap[key] ?? `{{ ${key} }}`),
    [editorContent, configVariableMap]
  );
  const configVendorScopedDevices = useMemo(() => {
    const vendor = (selectedConfigTemplate?.vendor || '').trim();
    if (!vendor || vendor.toLowerCase() === 'custom') return devices;
    return devices.filter((device) => getVendorFromPlatform(device.platform).toLowerCase() === vendor.toLowerCase());
  }, [devices, selectedConfigTemplate]);
  const configPlatformOptions = useMemo(
    () => Array.from(new Set(configVendorScopedDevices.map((device) => device.platform).filter(Boolean))).sort(),
    [configVendorScopedDevices]
  );
  const configRoleOptions = useMemo(
    () => Array.from(new Set(configVendorScopedDevices.map((device) => device.role).filter(Boolean))).sort(),
    [configVendorScopedDevices]
  );
  const configSiteOptions = useMemo(
    () => Array.from(new Set(configVendorScopedDevices.map((device) => device.site).filter(Boolean))).sort(),
    [configVendorScopedDevices]
  );
  const configScopedDevices = useMemo(() => configVendorScopedDevices.filter((device) => {
    if (configScopePlatform !== 'all' && device.platform !== configScopePlatform) return false;
    if (configScopeRole !== 'all' && device.role !== configScopeRole) return false;
    if (configScopeSite !== 'all' && device.site !== configScopeSite) return false;
    return true;
  }), [configVendorScopedDevices, configScopePlatform, configScopeRole, configScopeSite]);
  const configScopedOnlineCount = useMemo(
    () => configScopedDevices.filter((device) => device.status === 'online').length,
    [configScopedDevices]
  );
  const configValidationIssues = useMemo(() => {
    const issues: string[] = [];
    if (!selectedConfigTemplate) {
      issues.push(language === 'zh' ? '尚未选择模板资产' : 'No template asset selected');
    }
    if (!editorContent.trim()) {
      issues.push(language === 'zh' ? '模板内容为空' : 'Template content is empty');
    }
    if (configMissingVariables.length > 0) {
      issues.push(
        language === 'zh'
          ? `仍有未赋值变量: ${configMissingVariables.join('、')}`
          : `Missing variable values: ${configMissingVariables.join(', ')}`
      );
    }
    if (configScopedDevices.length === 0) {
      issues.push(language === 'zh' ? '当前发布范围内没有匹配设备' : 'No devices match the current release scope');
    }
    return issues;
  }, [selectedConfigTemplate, editorContent, configMissingVariables, configScopedDevices, language]);
  const configValidationWarnings = useMemo(() => {
    const warnings: string[] = [];
    const offlineCount = configScopedDevices.filter((device) => device.status !== 'online').length;
    if (offlineCount > 0) {
      warnings.push(
        language === 'zh'
          ? `${offlineCount} 台目标设备当前不在线，建议先做连接性确认`
          : `${offlineCount} target devices are not online; verify reachability before release`
      );
    }
    if (configScopedDevices.length > 20) {
      warnings.push(
        language === 'zh'
          ? '当前发布范围较大，建议先小范围灰度'
          : 'Release scope is large; consider a staged rollout first'
      );
    }
    return warnings;
  }, [configScopedDevices, language]);
  const configReadinessScore = useMemo(() => {
    let score = 100;
    if (!editorContent.trim()) score -= 45;
    score -= Math.min(30, configMissingVariables.length * 15);
    if (configScopedDevices.length === 0) score -= 30;
    score -= Math.min(20, configScopedDevices.filter((device) => device.status !== 'online').length * 5);
    return Math.max(0, score);
  }, [editorContent, configMissingVariables, configScopedDevices]);
  const hasQuickTargets = batchMode ? batchDeviceIds.length > 0 : !!selectedDevice;
  const quickMissingRequiredFields = useMemo(() => {
    const vars = quickPlaybookScenario?.variables || [];
    return vars
      .filter((v: any) => v.required && !String(quickPlaybookVars[v.key] ?? '').trim())
      .map((v: any) => (language === 'zh' ? (v.label_zh || v.label || v.key) : (v.label || v.key)));
  }, [quickPlaybookScenario, quickPlaybookVars, language]);
  const customCommandVars = useMemo(() => extractVars(customCommand), [customCommand]);

  useEffect(() => {
    setConfigWorkspaceView('source');
    setConfigScopePlatform('all');
    setConfigScopeRole('all');
    setConfigScopeSite('all');
  }, [selectedTemplateId]);

  useEffect(() => {
    if (activeTab !== 'automation' || automationPage !== 'execute' || !automationBridgeState) return;

    const targetDeviceIds = Array.isArray(automationBridgeState.targetDeviceIds) ? automationBridgeState.targetDeviceIds : [];
    const primaryTargetId = automationBridgeState.primaryTargetId;
    const primaryDevice = devices.find((device) => device.id === primaryTargetId)
      || devices.find((device) => targetDeviceIds.includes(device.id))
      || null;

    setAutomationSearch('');
    setQuickPlaybookScenario(null);
    setQuickPlaybookPreview(null);
    setQuickPlaybookVars({});
    setQuickRiskConfirmed(false);
    setQuickQueryOutput('');
    setQuickQueryLabel('');
    setQuickQueryStructured(null);
    setQuickQueryView('terminal');
    setQuickQueryMaximized(false);
    setQuickQueryCommands([]);
    setCustomCommand(automationBridgeState.command || '');
    setCustomCommandMode(automationBridgeState.mode === 'query' ? 'query' : 'config');
    setScriptVars(automationBridgeState.variableValues || {});

    if (targetDeviceIds.length > 1) {
      setBatchMode(true);
      setBatchDeviceIds(targetDeviceIds);
      setSelectedDevice(primaryDevice);
    } else {
      setBatchMode(false);
      setBatchDeviceIds([]);
      setSelectedDevice(primaryDevice);
    }

    setShowCustomCommandModal(true);

    navigate('/automation/execute', { replace: true, state: null });
  }, [activeTab, automationPage, automationBridgeState, devices, navigate]);

  const handleLogout = () => {
    localStorage.removeItem('netops_token');
    setShowUserMenu(false);
    setShowNotifications(false);
    setIsAuthenticated(false);
  };

  const openProfileModal = () => {
    setProfileForm({
      username: currentUser.username || currentUserRecord?.username || '',
      password: '',
      confirmPassword: '',
    });
    setProfileAvatarPreview(currentAvatar);
    setShowProfilePwd(false);
    setShowNotifications(false);
    setShowUserMenu(false);
    // 加载通知渠道配置
    const savedChannels = currentUserRecord?.notification_channels as any;
    setNotificationChannels({
      feishu:   { webhook_url: savedChannels?.feishu?.webhook_url   || '', enabled: !!savedChannels?.feishu?.enabled   },
      dingtalk: { webhook_url: savedChannels?.dingtalk?.webhook_url || '', enabled: !!savedChannels?.dingtalk?.enabled, secret: savedChannels?.dingtalk?.secret || '' },
      wechat:   { webhook_url: savedChannels?.wechat?.webhook_url   || '', enabled: !!savedChannels?.wechat?.enabled   },
    });
    setNotifyTestLoading('');
    setShowProfileModal(true);
  };

  const handleProfileAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Please select an image file', 'error');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showToast('Image must be 2MB or smaller', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setProfileAvatarPreview(reader.result);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const markAllNotificationsRead = () => {
    const ids = unreadNotifications.map(n => n.id);
    if (ids.length === 0) return;
    setNotificationReadMap(prev => {
      const next = { ...prev };
      unreadNotifications.forEach(item => { next[item.id] = true; });
      return next;
    });
    setNotifications(prev => prev.map(item => ({ ...item, read: true })));
    markNotificationsAsRead(ids);
  };

  const handleSaveProfile = async () => {
    const profileUserId = currentUser.id ?? currentUserRecord?.id;
    if (!profileUserId) {
      showToast('Unable to identify current user', 'error');
      return;
    }
    if (!profileForm.username.trim()) {
      showToast(t('fillAllFields'), 'error');
      return;
    }
    if (profileForm.password && profileForm.password !== profileForm.confirmPassword) {
      showToast('Passwords do not match', 'error');
      return;
    }

    try {
      const payload: Record<string, any> = {
        username: profileForm.username.trim(),
        role: (currentUserRecord?.role || currentUser.role || 'Operator') as string,
        avatar_url: profileAvatarPreview,
        notification_channels: notificationChannels,
      };
      if (profileForm.password) payload.password = profileForm.password;

      const response = await fetch(`/api/users/${profileUserId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (response.ok) {
        setCurrentUser(prev => ({ ...prev, username: data.username, role: data.role, avatar_url: data.avatar_url || '' }));
        setUsers(prev => prev.map(u => String(u.id) === String(profileUserId) ? { ...u, ...data } : u));
        setShowProfileModal(false);
        showToast('Profile updated', 'success');
      } else {
        showToast(`Error: ${data.detail || data.error}`, 'error');
      }
    } catch (error) {
      showToast('Connection error', 'error');
    }
  };

  useEffect(() => {
    localStorage.setItem('netops_theme_mode', themeMode);
    const next = getResolvedTheme(themeMode);
    setResolvedTheme(next);
    document.documentElement.setAttribute('data-theme', next);
  }, [themeMode]);

  const fetchSharedData = useCallback(async () => {
    try {
      const [jobsRes, scriptsRes, usersRes, templatesRes, varsRes, linksRes] = await Promise.all([
        fetch('/api/jobs'),
        fetch('/api/scripts'),
        fetch('/api/users'),
        fetch('/api/templates'),
        fetch('/api/vars'),
        fetch('/api/topology/links')
      ]);

      if (jobsRes.ok) setJobs(await jobsRes.json());
      if (scriptsRes.ok) setScripts(await scriptsRes.json());
      if (usersRes.ok) setUsers(await usersRes.json());
      if (templatesRes.ok) {
        const tpls = await templatesRes.json();
        setConfigTemplates(tpls);
        if (tpls.length > 0 && !selectedTemplateId) {
          setSelectedTemplateId(tpls[0].id);
        }
      }
      if (varsRes.ok) setGlobalVars(await varsRes.json());
      if (linksRes.ok) setTopologyLinks(await linksRes.json());
      setDashLastRefresh(new Date());
    } catch (error) {
      console.error('Failed to fetch shared data:', error);
    }
  }, [selectedTemplateId]);

  const deviceFetchMode = useMemo<'light' | 'full'>(() => {
    // Keep full payload where deep device fields are actively used.
    if (activeTab === 'inventory') return 'full';
    if (activeTab === 'automation') return 'full';
    if (activeTab === 'config') return 'full';
    if (activeTab === 'topology') return 'full';
    return 'light';
  }, [activeTab]);

  const safeJsonArray = (value: any) => {
    if (Array.isArray(value)) return value;
    if (typeof value !== 'string' || !value.trim()) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const normalizeDeviceRecord = (raw: any): Device => {
    const hostname = typeof raw?.hostname === 'string' && raw.hostname.trim()
      ? raw.hostname
      : (typeof raw?.id === 'string' ? raw.id : 'Unknown');

    return {
      ...raw,
      id: String(raw?.id || ''),
      hostname,
      ip_address: typeof raw?.ip_address === 'string' ? raw.ip_address : '',
      platform: typeof raw?.platform === 'string' ? raw.platform : 'unknown',
      status: (raw?.status === 'online' || raw?.status === 'offline' || raw?.status === 'pending') ? raw.status : 'offline',
      compliance: (raw?.compliance === 'compliant' || raw?.compliance === 'non-compliant' || raw?.compliance === 'unknown') ? raw.compliance : 'unknown',
      role: typeof raw?.role === 'string' ? raw.role : '',
      site: typeof raw?.site === 'string' ? raw.site : '',
      model: typeof raw?.model === 'string' ? raw.model : '',
      version: typeof raw?.version === 'string' ? raw.version : '',
      sn: typeof raw?.sn === 'string' ? raw.sn : '',
      uptime: typeof raw?.uptime === 'string' ? raw.uptime : '',
      connection_method: raw?.connection_method === 'netconf' ? 'netconf' : 'ssh',
      config_history: safeJsonArray(raw?.config_history),
      interface_data: safeJsonArray(raw?.interface_data),
      cpu_history: safeJsonArray(raw?.cpu_history),
      memory_history: safeJsonArray(raw?.memory_history),
      health_status: ['healthy', 'warning', 'critical', 'unknown'].includes(String(raw?.health_status)) ? raw.health_status : 'unknown',
      health_score: typeof raw?.health_score === 'number' ? raw.health_score : Number(raw?.health_score || 0),
      health_summary: typeof raw?.health_summary === 'string' ? raw.health_summary : '',
      health_reasons: Array.isArray(raw?.health_reasons) ? raw.health_reasons : [],
      open_alert_count: typeof raw?.open_alert_count === 'number' ? raw.open_alert_count : Number(raw?.open_alert_count || 0),
      critical_open_alerts: typeof raw?.critical_open_alerts === 'number' ? raw.critical_open_alerts : Number(raw?.critical_open_alerts || 0),
      major_open_alerts: typeof raw?.major_open_alerts === 'number' ? raw.major_open_alerts : Number(raw?.major_open_alerts || 0),
      warning_open_alerts: typeof raw?.warning_open_alerts === 'number' ? raw.warning_open_alerts : Number(raw?.warning_open_alerts || 0),
      interface_down_count: typeof raw?.interface_down_count === 'number' ? raw.interface_down_count : Number(raw?.interface_down_count || 0),
      interface_flap_count: typeof raw?.interface_flap_count === 'number' ? raw.interface_flap_count : Number(raw?.interface_flap_count || 0),
      high_util_interface_count: typeof raw?.high_util_interface_count === 'number' ? raw.high_util_interface_count : Number(raw?.high_util_interface_count || 0),
      interface_error_count: typeof raw?.interface_error_count === 'number' ? raw.interface_error_count : Number(raw?.interface_error_count || 0),
    } as Device;
  };

  const fetchDevicesData = useCallback(async () => {
    try {
      const params = new URLSearchParams({ mode: deviceFetchMode });
      const devicesRes = await fetch(`/api/devices?${params.toString()}`);
      if (!devicesRes.ok) return;
      const devs = await devicesRes.json();
      setDevices((Array.isArray(devs) ? devs : []).map((d: any) => {
        const normalized = normalizeDeviceRecord(d);
        if (deviceFetchMode === 'light') {
          return {
            ...normalized,
            config_history: [],
          };
        }
        return normalized;
      }));
      setDevicesLastUpdatedAt(Date.now());
    } catch (error) {
      console.error('Failed to fetch devices data:', error);
    }
  }, [deviceFetchMode]);

  useEffect(() => {
    if (!isAuthenticated) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    Promise.all([fetchSharedData(), fetchDevicesData()]).finally(() => setIsLoading(false));

    const sharedInterval = setInterval(fetchSharedData, 5000);
    // Reduce heavy full device refresh pressure while inventory table uses server-side paging.
    const devicePollMs = activeTab === 'inventory' && inventorySubPage === 'devices'
      ? 30000
      : activeTab === 'inventory' && inventorySubPage === 'interfaces'
        ? 5000
        : 15000;
    const devicesInterval = setInterval(fetchDevicesData, devicePollMs);

    return () => {
      clearInterval(sharedInterval);
      clearInterval(devicesInterval);
    };
  }, [isAuthenticated, fetchSharedData, fetchDevicesData, activeTab, inventorySubPage]);

  // Force refresh when switching between submenus so returning pages always show latest data.
  useEffect(() => {
    if (!isAuthenticated) return;
    fetchSharedData();
    if (!(activeTab === 'inventory' && inventorySubPage === 'devices')) {
      fetchDevicesData();
    }
  }, [isAuthenticated, location.pathname, fetchSharedData, fetchDevicesData, activeTab, inventorySubPage]);

  // 合规趋势：基于过去N天任务执行成功率
  const complianceTrend = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return Array.from({ length: trendDays }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (trendDays - 1 - i));
      const dateStr = d.toISOString().slice(0, 10);
      const dayJobs = jobs.filter(j => j.created_at && j.created_at.startsWith(dateStr));
      let rate: number;
      if (dayJobs.length === 0) {
        const total = devices.length;
        rate = total > 0 ? Math.round((devices.filter(dv => dv.compliance === 'compliant').length / total) * 100) : 100;
      } else {
        const success = dayJobs.filter(j => j.status === 'success').length;
        rate = Math.round((success / dayJobs.length) * 100);
      }
      const label = trendDays <= 7 ? days[d.getDay()] : `${months[d.getMonth()]} ${d.getDate()}`;
      return { name: label, rate };
    });
  }, [jobs, devices, trendDays]);

  // 平台分布：基于真实设备数据
  const platformData = useMemo(() => {
    const PLATFORM_COLORS: Record<string, string> = {
      cisco_ios: '#0ea5e9',
      cisco_nxos: '#0369a1',
      cisco_iosxr: '#7c3aed',
      huawei_vrp: '#f59e0b',
      h3c_comware: '#f97316',
      arista_eos: '#6366f1',
      juniper_junos: '#10b981',
    };
    const total = devices.length;
    if (total === 0) return [];
    const counts: Record<string, number> = {};
    devices.forEach(d => { counts[d.platform] = (counts[d.platform] || 0) + 1; });
    return Object.entries(counts).map(([platform, count]) => ({
      name: PLATFORM_LABELS[platform] || platform,
      value: Math.round((count / total) * 100),
      color: PLATFORM_COLORS[platform] || '#94a3b8',
    }));
  }, [devices]);

  const [showDiff, setShowDiff] = useState(false);
  const [currentDiff, setCurrentDiff] = useState({ before: '', after: '' });
  const [showImportModal, setShowImportModal] = useState(false);
  
  // Pagination State
  const [inventoryPage, setInventoryPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [automationListPage, setAutomationListPage] = useState(1);
  const [compliancePage, setCompliancePage] = useState(1);
  const [inventoryPageSize, setInventoryPageSize] = useState(10);
  const [historyPageSize, setHistoryPageSize] = useState(10);
  const [historyStatusFilter, setHistoryStatusFilter] = useState<'all' | Job['status']>('all');
  const [historyTimeFilter, setHistoryTimeFilter] = useState<'all' | '24h' | '7d' | '30d'>('all');
  const [historyRows, setHistoryRows] = useState<Job[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [auditPage, setAuditPage] = useState(1);
  const [auditPageSize, setAuditPageSize] = useState(10);
  const [auditRows, setAuditRows] = useState<AuditEvent[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditCategoryFilter, setAuditCategoryFilter] = useState('all');
  const [auditSeverityFilter, setAuditSeverityFilter] = useState('all');
  const [auditStatusFilter, setAuditStatusFilter] = useState('all');
  const [auditTimeFilter, setAuditTimeFilter] = useState<'all' | '24h' | '7d' | '30d'>('7d');
  const [selectedAuditEvent, setSelectedAuditEvent] = useState<AuditEvent | null>(null);
  const [complianceOverview, setComplianceOverview] = useState<ComplianceOverview | null>(null);
  const [complianceFindings, setComplianceFindings] = useState<ComplianceFinding[]>([]);
  const [complianceFindingTotal, setComplianceFindingTotal] = useState(0);
  const [complianceLoading, setComplianceLoading] = useState(false);
  const [complianceRunLoading, setComplianceRunLoading] = useState(false);
  const [complianceSeverityFilter, setComplianceSeverityFilter] = useState('all');
  const [complianceStatusFilter, setComplianceStatusFilter] = useState('open');
  const [complianceCategoryFilter, setComplianceCategoryFilter] = useState('all');
  const [compliancePageSize, setCompliancePageSize] = useState(10);
  const [complianceRefreshTick, setComplianceRefreshTick] = useState(0);
  const [selectedFinding, setSelectedFinding] = useState<ComplianceFinding | null>(null);
  const [inventoryRows, setInventoryRows] = useState<Device[]>([]);
  const [inventoryTotal, setInventoryTotal] = useState(0);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryRefreshTick, setInventoryRefreshTick] = useState(0);
  const [devicesLastUpdatedAt, setDevicesLastUpdatedAt] = useState<number | null>(null);
  const [intfNowTick, setIntfNowTick] = useState(0);
  const [hostResources, setHostResources] = useState<HostResourceSnapshot | null>(null);

  // Monitoring Center state (search-first, no full device listing)
  const [monitorSearch, setMonitorSearch] = useState('');
  const [monitorSearchResults, setMonitorSearchResults] = useState<any[]>([]);
  const [monitorSearching, setMonitorSearching] = useState(false);
  const [monitorSelectedDevice, setMonitorSelectedDevice] = useState<any | null>(null);
  const [monitorOverview, setMonitorOverview] = useState<any | null>(null);
  const [monitorRealtime, setMonitorRealtime] = useState<any | null>(null);
  const [monitorTrend, setMonitorTrend] = useState<any | null>(null);
  const [monitorTrendInterface, setMonitorTrendInterface] = useState('');
  const [monitorTrendResolution, setMonitorTrendResolution] = useState<'1m' | '5m'>('1m');
  const [monitorTrendStartInput, setMonitorTrendStartInput] = useState('');
  const [monitorTrendEndInput, setMonitorTrendEndInput] = useState('');
  const [monitorTrendRange, setMonitorTrendRange] = useState<{ start_time?: string; end_time?: string }>({});
  const [monitorTrendZoom, setMonitorTrendZoom] = useState<{ startIndex: number; endIndex: number } | null>(null);
  const [monitorTrendDragStart, setMonitorTrendDragStart] = useState<number | null>(null);
  const [monitorTrendDragEnd, setMonitorTrendDragEnd] = useState<number | null>(null);
  const [monitorTrendMetrics, setMonitorTrendMetrics] = useState<string[]>(['in_bps', 'out_bps']);
  const [monitorTrendUiMode, setMonitorTrendUiMode] = useState<'pro' | 'compact'>(() => {
    const saved = localStorage.getItem('netops_monitor_trend_ui_mode');
    return saved === 'pro' ? 'pro' : 'compact';
  });
  const [monitorAlerts, setMonitorAlerts] = useState<any[]>([]);
  const [monitorAlertTotal, setMonitorAlertTotal] = useState(0);
  const [monitorAlertsPage, setMonitorAlertsPage] = useState(1);
  const [monitorAlertsPageSize] = useState(10);
  const [monitorAlertsSeverity, setMonitorAlertsSeverity] = useState('all');
  const [monitorAlertsPhase, setMonitorAlertsPhase] = useState('all');
  const [monitorLoading, setMonitorLoading] = useState(false);
  const [monitorPageVisible, setMonitorPageVisible] = useState(() => typeof document === 'undefined' ? true : document.visibilityState === 'visible');
  const [monitorDashboardSiteFilter, setMonitorDashboardSiteFilter] = useState('all');
  const [monitorDashboardAlertFilter, setMonitorDashboardAlertFilter] = useState<'all' | 'critical' | 'major' | 'warning'>('all');
  const monitorRequestEpochRef = React.useRef(0);

  const isAbortError = (error: unknown) => {
    if (!error) return false;
    if (error instanceof DOMException && error.name === 'AbortError') return true;
    return typeof error === 'object' && (error as { name?: string }).name === 'AbortError';
  };

  // Inventory Filters & Sorting
  const [inventorySearch, setInventorySearch] = useState('');
  const [inventoryPlatformFilter, setInventoryPlatformFilter] = useState('all');
  const [inventoryStatusFilter, setInventoryStatusFilter] = useState('all');
  const [inventorySortConfig, setInventorySortConfig] = useState<{ key: keyof Device, direction: 'asc' | 'desc' } | null>(null);
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([]);

  useEffect(() => {
    setInventoryPage(1);
  }, [inventorySearch, inventoryPlatformFilter, inventoryStatusFilter, inventoryPageSize]);

  useEffect(() => {
    setSelectedDeviceIds([]);
  }, [inventorySearch, inventoryPlatformFilter, inventoryStatusFilter, inventorySortConfig, inventoryPage]);

  useEffect(() => {
    const totalInventoryPages = Math.max(1, Math.ceil(inventoryTotal / inventoryPageSize));
    if (inventoryPage > totalInventoryPages) {
      setInventoryPage(totalInventoryPages);
    }
  }, [inventoryTotal, inventoryPage, inventoryPageSize]);

  useEffect(() => {
    if (!isAuthenticated || activeTab !== 'inventory' || inventorySubPage !== 'devices') return;

    let cancelled = false;
    const fetchInventoryPage = async () => {
      setInventoryLoading(true);
      try {
        const params = new URLSearchParams({
          search: inventorySearch,
          platform: inventoryPlatformFilter,
          status: inventoryStatusFilter,
          page: String(inventoryPage),
          page_size: String(inventoryPageSize),
          sort_key: inventorySortConfig?.key || 'hostname',
          sort_direction: inventorySortConfig?.direction || 'asc',
        });

        const resp = await fetch(`/api/devices?${params.toString()}`);
        if (!resp.ok) throw new Error('Failed to fetch inventory data');
        const data = await resp.json();
        if (cancelled) return;

        if (Array.isArray(data)) {
          setInventoryRows(data.map((item: any) => normalizeDeviceRecord(item)));
          setInventoryTotal(data.length);
        } else {
          setInventoryRows(Array.isArray(data.items) ? data.items.map((item: any) => normalizeDeviceRecord(item)) : []);
          setInventoryTotal(typeof data.total === 'number' ? data.total : 0);
        }
      } catch {
        if (cancelled) return;
        setInventoryRows([]);
        setInventoryTotal(0);
      } finally {
        if (!cancelled) setInventoryLoading(false);
      }
    };

    fetchInventoryPage();
    return () => {
      cancelled = true;
    };
  }, [
    isAuthenticated,
    activeTab,
    inventorySubPage,
    inventorySearch,
    inventoryPlatformFilter,
    inventoryStatusFilter,
    inventorySortConfig,
    inventoryPage,
    inventoryPageSize,
    inventoryRefreshTick,
  ]);

  useEffect(() => {
    if (!(activeTab === 'inventory' && inventorySubPage === 'interfaces')) return;
    const timer = setInterval(() => setIntfNowTick((v) => v + 1), 1000);
    return () => clearInterval(timer);
  }, [activeTab, inventorySubPage]);

  const intfUpdatedAgoSec = useMemo(() => {
    if (!devicesLastUpdatedAt) return null;
    return Math.max(0, Math.floor((Date.now() - devicesLastUpdatedAt) / 1000));
  }, [devicesLastUpdatedAt, intfNowTick]);

  const fetchMonitoringOverview = useCallback(async (forceRefresh = false, signal?: AbortSignal) => {
    const reqEpoch = monitorRequestEpochRef.current;
    try {
      const suffix = forceRefresh ? '?force_refresh=1' : '';
      const resp = await fetch(`/api/monitoring/overview${suffix}`, { signal });
      if (!resp.ok) return;
      const payload = await resp.json();
      if (reqEpoch !== monitorRequestEpochRef.current) return;
      setMonitorOverview(payload);
    } catch (error) {
      if (isAbortError(error)) return;
      // ignore transient errors
    }
  }, []);

  const fetchHostResources = useCallback(async (signal?: AbortSignal) => {
    try {
      const resp = await fetch('/api/health/resources', { signal });
      if (!resp.ok) return;
      const payload = await resp.json() as HostResourceSnapshot;
      setHostResources(payload);
    } catch (error) {
      if (isAbortError(error)) return;
      // ignore transient errors
    }
  }, []);

  const fetchMonitoringAlerts = useCallback(async (signal?: AbortSignal) => {
    const reqEpoch = monitorRequestEpochRef.current;
    try {
      const params = new URLSearchParams({
        page: String(monitorAlertsPage),
        page_size: String(monitorAlertsPageSize),
        severity: monitorAlertsSeverity,
        phase: monitorAlertsPhase,
      });
      if (monitorSelectedDevice?.id) params.set('device_id', monitorSelectedDevice.id);
      const resp = await fetch(`/api/monitoring/alerts?${params.toString()}`, { signal });
      if (!resp.ok) return;
      const data = await resp.json();
      if (reqEpoch !== monitorRequestEpochRef.current) return;
      setMonitorAlerts(Array.isArray(data.items) ? data.items : []);
      setMonitorAlertTotal(typeof data.total === 'number' ? data.total : 0);
    } catch (error) {
      if (isAbortError(error)) return;
      // ignore transient errors
    }
  }, [monitorAlertsPage, monitorAlertsPageSize, monitorAlertsSeverity, monitorAlertsPhase, monitorSelectedDevice?.id]);

  const fetchMonitoringRealtime = useCallback(async (deviceId: string, signal?: AbortSignal) => {
    const reqEpoch = monitorRequestEpochRef.current;
    const resp = await fetch(`/api/monitoring/device/${deviceId}/realtime?window_minutes=15&limit=1000`, { signal });
    if (!resp.ok) throw new Error('realtime fetch failed');
    const payload = await resp.json();
    if (reqEpoch !== monitorRequestEpochRef.current) throw new Error('stale monitoring realtime response');
    return payload;
  }, []);

  const fetchMonitoringTrend = useCallback(async (
    deviceId: string,
    interfaceName?: string,
    resolution: '1m' | '5m' = '1m',
    range?: { start_time?: string; end_time?: string },
    signal?: AbortSignal,
  ) => {
    const reqEpoch = monitorRequestEpochRef.current;
    const params = new URLSearchParams({ range_hours: '24', resolution });
    const name = (interfaceName || '').trim();
    if (name) params.set('interface_name', name);
    if (range?.start_time) params.set('start_time', range.start_time);
    if (range?.end_time) params.set('end_time', range.end_time);
    const resp = await fetch(`/api/monitoring/device/${deviceId}/trend?${params.toString()}`, { signal });
    if (!resp.ok) throw new Error('trend fetch failed');
    const payload = await resp.json();
    if (reqEpoch !== monitorRequestEpochRef.current) throw new Error('stale monitoring trend response');
    return payload;
  }, []);

  useEffect(() => {
    monitorRequestEpochRef.current += 1;
    if (activeTab === 'monitoring' || activeTab === 'health') return;
    setMonitorSearch('');
    setMonitorSearchResults([]);
    setMonitorSearching(false);
    setMonitorSelectedDevice(null);
    setMonitorOverview(null);
    setMonitorRealtime(null);
    setMonitorTrend(null);
    setMonitorTrendInterface('');
    setMonitorTrendResolution('1m');
    setMonitorTrendStartInput('');
    setMonitorTrendEndInput('');
    setMonitorTrendRange({});
    setMonitorTrendZoom(null);
    setMonitorTrendDragStart(null);
    setMonitorTrendDragEnd(null);
    setMonitorTrendMetrics(['in_bps', 'out_bps']);
    setMonitorAlerts([]);
    setMonitorAlertTotal(0);
    setMonitorAlertsPage(1);
    setMonitorAlertsSeverity('all');
    setMonitorAlertsPhase('all');
    setMonitorLoading(false);
    setMonitorDashboardSiteFilter('all');
    setMonitorDashboardAlertFilter('all');
  }, [activeTab]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      setMonitorPageVisible(document.visibilityState === 'visible');
    };

    handleVisibilityChange();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    let currentController: AbortController | null = null;
    const runResources = () => {
      if (currentController) currentController.abort();
      currentController = new AbortController();
      fetchHostResources(currentController.signal);
    };

    runResources();
    if (!monitorPageVisible) return;
    const timer = window.setInterval(runResources, 15000);
    return () => {
      window.clearInterval(timer);
      if (currentController) currentController.abort();
    };
  }, [isAuthenticated, fetchHostResources, monitorPageVisible]);

  useEffect(() => {
    if (!isAuthenticated || !['monitoring', 'health'].includes(activeTab)) return;
    let currentController: AbortController | null = null;
    const runOverview = (forceRefresh = false) => {
      if (currentController) currentController.abort();
      currentController = new AbortController();
      fetchMonitoringOverview(forceRefresh, currentController.signal);
    };

    runOverview(true);
    if (!monitorPageVisible) return;
    const timer = window.setInterval(() => runOverview(false), 5000);
    return () => {
      window.clearInterval(timer);
      if (currentController) currentController.abort();
    };
  }, [isAuthenticated, activeTab, fetchMonitoringOverview, monitorPageVisible]);

  useEffect(() => {
    if (!isAuthenticated || activeTab !== 'monitoring') return;
    let currentController: AbortController | null = null;
    const runAlerts = () => {
      if (currentController) currentController.abort();
      currentController = new AbortController();
      fetchMonitoringAlerts(currentController.signal);
    };

    runAlerts();
    if (!monitorPageVisible) return;
    const timer = window.setInterval(runAlerts, 10000);
    return () => {
      window.clearInterval(timer);
      if (currentController) currentController.abort();
    };
  }, [isAuthenticated, activeTab, fetchMonitoringAlerts, monitorPageVisible]);

  const formatResourcePercent = (value: number | null | undefined) => {
    if (value == null || !Number.isFinite(value)) return '--';
    return `${Math.round(value)}%`;
  };

  const formatCompactResourcePercent = (value: number | null | undefined) => {
    if (value == null || !Number.isFinite(value)) return '--';
    return String(Math.round(value));
  };

  const hostResourceTone = hostResources?.status === 'critical'
    ? 'bg-red-500/15 text-red-200 border-red-400/25'
    : hostResources?.status === 'degraded'
      ? 'bg-amber-500/15 text-amber-100 border-amber-300/25'
      : 'bg-emerald-500/15 text-emerald-100 border-emerald-300/25';

  const hostResourceSummary = hostResources
    ? `CPU ${formatResourcePercent(hostResources.cpu_percent)} · MEM ${formatResourcePercent(hostResources.memory_percent)} · DISK ${formatResourcePercent(hostResources.disk_percent)}`
    : (language === 'zh' ? '等待资源数据' : 'Waiting for resource data');

  const formatTopologyPort = (value?: string) => {
    const raw = String(value || '').trim();
    if (!raw) return language === 'zh' ? '未识别接口' : 'Unknown Port';
    return raw
      .replace(/^GigabitEthernet/i, 'Gi')
      .replace(/^TenGigabitEthernet/i, 'Te')
      .replace(/^TwentyFiveGigE/i, 'Tw')
      .replace(/^FortyGigabitEthernet/i, 'Fo')
      .replace(/^HundredGigabitEthernet/i, 'Hu')
      .replace(/^Ethernet/i, 'Eth')
      .replace(/^Port-channel/i, 'Po')
      .replace(/^Loopback/i, 'Lo');
  };

  const normalizeTopologyPort = (value?: string) => String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/^gigabitethernet/, 'gi')
    .replace(/^tengigabitethernet/, 'te')
    .replace(/^twentyfivegige/, 'tw')
    .replace(/^fortygigabitethernet/, 'fo')
    .replace(/^hundredgigabitethernet/, 'hu')
    .replace(/^ethernet/, 'eth')
    .replace(/^port-channel/, 'po')
    .replace(/^loopback/, 'lo');

  const formatTopologyEvidenceLabel = (value: string) => {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) return language === 'zh' ? '未知来源' : 'Unknown Source';
    if (normalized === 'lldp') return 'LLDP';
    if (normalized === 'cdp') return 'CDP';
    if (normalized === 'snmp') return 'SNMP';
    if (normalized === 'arp') return 'ARP';
    if (normalized === 'mac') return 'MAC';
    return normalized.toUpperCase();
  };

  const getTopologyOperationalTone = (state?: TopologyOperationalState) => {
    switch (state) {
      case 'up':
        return {
          badge: 'border-emerald-200 bg-emerald-100 text-emerald-700',
          panel: 'border-emerald-200/70 bg-emerald-50',
          dot: 'bg-emerald-500',
        };
      case 'degraded':
        return {
          badge: 'border-amber-200 bg-amber-100 text-amber-700',
          panel: 'border-amber-200/70 bg-amber-50',
          dot: 'bg-amber-500',
        };
      case 'down':
        return {
          badge: 'border-rose-200 bg-rose-100 text-rose-700',
          panel: 'border-rose-200/70 bg-rose-50',
          dot: 'bg-rose-500',
        };
      case 'stale':
        return {
          badge: 'border-sky-200 bg-sky-100 text-sky-700',
          panel: 'border-sky-200/70 bg-sky-50',
          dot: 'bg-sky-500',
        };
      default:
        return {
          badge: 'border-slate-200 bg-slate-100 text-slate-700',
          panel: 'border-slate-200/70 bg-slate-50',
          dot: 'bg-slate-400',
        };
    }
  };

  const formatTopologyOperationalState = (state?: TopologyOperationalState) => {
    if (language === 'zh') {
      if (state === 'up') return '正常';
      if (state === 'degraded') return '退化';
      if (state === 'down') return '中断';
      if (state === 'stale') return '陈旧';
      return '未知';
    }
    if (state === 'up') return 'Up';
    if (state === 'degraded') return 'Degraded';
    if (state === 'down') return 'Down';
    if (state === 'stale') return 'Stale';
    return 'Unknown';
  };

  const formatTopologyLastSeen = (value?: string) => {
    if (!value) return language === 'zh' ? '未知' : 'Unknown';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return language === 'zh' ? '未知' : 'Unknown';
    return date.toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US', { hour12: false });
  };

  const evaluateTopologyInterfaceSnapshot = (device: Device | null | undefined, port?: string): TopologyInterfaceSnapshot | null => {
    if (!device || !port) return null;
    const normalizedPort = normalizeTopologyPort(port);
    if (!normalizedPort) return null;

    const match = (device.interface_data || []).find((item) => {
      const names = [item?.name, item?.description].map((entry) => normalizeTopologyPort(entry));
      return names.includes(normalizedPort);
    });
    if (!match) return null;

    const maxUtilizationPct = [match.bw_in_pct, match.bw_out_pct]
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
      .reduce<number | null>((current, next) => (current == null ? next : Math.max(current, next)), null);

    const errorCount = Number(match.in_errors || 0) + Number(match.out_errors || 0);
    const discardCount = Number(match.in_discards || 0) + Number(match.out_discards || 0);
    const status = String(match.status || 'unknown').toLowerCase();

    let operationalState: TopologyOperationalState = 'unknown';
    if (status === 'down') {
      operationalState = 'down';
    } else if (match.flapping || errorCount > 0 || discardCount > 0 || (maxUtilizationPct != null && maxUtilizationPct >= 85)) {
      operationalState = 'degraded';
    } else if (status === 'up') {
      operationalState = 'up';
    }

    return {
      name: String(match.name || port),
      status,
      maxUtilizationPct,
      errorCount,
      discardCount,
      flapping: Boolean(match.flapping),
      operationalState,
    };
  };

  const describeTopologyLink = (link: any, sourceDevice?: Device, targetDevice?: Device): TopologyDecoratedLink => {
    const metadata = parseJsonObject(link.metadata_json);
    const metadataProtocols = Array.isArray(metadata.protocols) ? metadata.protocols : [];
    const discoverySources = String(link.discovery_source || '')
      .split('+')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
    const evidenceSources = Array.from(new Set([...metadataProtocols, ...discoverySources]));
    const sourceInterfaceSnapshot = evaluateTopologyInterfaceSnapshot(sourceDevice, link.source_port_normalized || link.source_port);
    const targetInterfaceSnapshot = evaluateTopologyInterfaceSnapshot(targetDevice, link.target_port_normalized || link.target_port);
    const sourceDeviceStatus = String(sourceDevice?.status || 'unknown').toLowerCase();
    const targetDeviceStatus = String(targetDevice?.status || 'unknown').toLowerCase();
    const lastSeenTime = link.last_seen ? new Date(link.last_seen).getTime() : NaN;
    const staleThresholdMs = 30 * 60 * 1000;
    const isStale = Number.isFinite(lastSeenTime) && (Date.now() - lastSeenTime > staleThresholdMs);

    let operationalState: TopologyOperationalState = 'unknown';
    let operationalSummary = language === 'zh' ? '缺少接口遥测，链路状态未知。' : 'Link state is unknown because interface telemetry is unavailable.';

    if (link.inferred) {
      operationalState = 'unknown';
      operationalSummary = language === 'zh' ? '这是推断链路，需要等待真实邻居证据确认。' : 'This is an inferred adjacency and needs direct neighbor evidence.';
    } else if (sourceDeviceStatus === 'offline' || targetDeviceStatus === 'offline') {
      operationalState = 'down';
      operationalSummary = language === 'zh' ? '至少一端设备离线，链路视为中断。' : 'At least one endpoint device is offline, so the link is treated as down.';
    } else if (isStale) {
      operationalState = 'stale';
      operationalSummary = language === 'zh' ? '这条链路在最近 30 分钟内没有被新的邻居发现刷新，建议重新触发发现确认当前连通性。' : 'This adjacency has not been refreshed by recent discovery within the last 30 minutes. Run discovery again to confirm current connectivity.';
    } else if (sourceInterfaceSnapshot?.operationalState === 'down' || targetInterfaceSnapshot?.operationalState === 'down') {
      operationalState = 'down';
      operationalSummary = language === 'zh' ? '本端或对端接口处于 down。' : 'One side of the adjacency reports the interface as down.';
    } else if (
      sourceDeviceStatus === 'pending'
      || targetDeviceStatus === 'pending'
      || sourceInterfaceSnapshot?.operationalState === 'degraded'
      || targetInterfaceSnapshot?.operationalState === 'degraded'
    ) {
      operationalState = 'degraded';
      operationalSummary = language === 'zh' ? '链路可达，但接口存在高利用率、抖动或错误计数。' : 'The link is reachable but shows utilization, flapping, or error signals.';
    } else if (
      sourceInterfaceSnapshot?.operationalState === 'up'
      && targetInterfaceSnapshot?.operationalState === 'up'
      && sourceDeviceStatus === 'online'
      && targetDeviceStatus === 'online'
    ) {
      operationalState = 'up';
      operationalSummary = language === 'zh' ? '双端接口均为 up，且未发现明显退化信号。' : 'Both interfaces are up and no degradation signals were detected.';
    }

    return {
      ...link,
      operational_state: operationalState,
      operational_summary: operationalSummary,
      evidence_sources: evidenceSources,
      reverse_confirmed: Boolean(metadata.reverse_seen),
      source_interface_snapshot: sourceInterfaceSnapshot,
      target_interface_snapshot: targetInterfaceSnapshot,
    };
  };

  const formatTopologyInterfaceTelemetry = (snapshot: TopologyInterfaceSnapshot | null) => {
    if (!snapshot) return language === 'zh' ? '暂无接口遥测' : 'No interface telemetry';
    const segments: string[] = [];
    if (snapshot.status) segments.push(snapshot.status.toUpperCase());
    if (snapshot.maxUtilizationPct != null) segments.push(`${language === 'zh' ? '利用率' : 'Util'} ${Math.round(snapshot.maxUtilizationPct)}%`);
    if (snapshot.errorCount > 0) segments.push(`${language === 'zh' ? '错误' : 'Err'} ${snapshot.errorCount}`);
    if (snapshot.discardCount > 0) segments.push(`${language === 'zh' ? '丢弃' : 'Drop'} ${snapshot.discardCount}`);
    if (snapshot.flapping) segments.push(language === 'zh' ? '抖动' : 'Flap');
    return segments.join(' · ') || (language === 'zh' ? '暂无接口遥测' : 'No interface telemetry');
  };

  const topologySiteOptions = useMemo(() => {
    const siteValues: string[] = devices
      .map((device) => String(device.site || '').trim())
      .filter((value): value is string => Boolean(value));
    const uniqueSites: string[] = [...new Set<string>(siteValues)];
    uniqueSites.sort((left: string, right: string) => left.localeCompare(right));
    return uniqueSites;
  }, [devices]);

  const topologyRoleOptions = useMemo(() => {
    const roleValues: string[] = devices
      .map((device) => String(device.role || '').trim())
      .filter((value): value is string => Boolean(value));
    const uniqueRoles: string[] = [...new Set<string>(roleValues)];
    uniqueRoles.sort((left: string, right: string) => left.localeCompare(right));
    return uniqueRoles;
  }, [devices]);

  const topologyVisibleDevices = useMemo(() => {
    const query = topologySearch.trim().toLowerCase();
    return devices.filter((device) => {
      const matchesQuery = !query || [device.hostname, device.ip_address, device.site, device.role].some((value) => String(value || '').toLowerCase().includes(query));
      const matchesStatus = topologyStatusFilter === 'all' || device.status === topologyStatusFilter;
      const matchesRole = topologyRoleFilter === 'all' || String(device.role || '') === topologyRoleFilter;
      const matchesSite = topologySiteFilter === 'all' || String(device.site || '') === topologySiteFilter;
      return matchesQuery && matchesStatus && matchesRole && matchesSite;
    });
  }, [devices, topologyRoleFilter, topologySearch, topologySiteFilter, topologyStatusFilter]);

  const topologyVisibleDeviceIds = useMemo(
    () => new Set(topologyVisibleDevices.map((device) => device.id)),
    [topologyVisibleDevices],
  );

  const topologyVisibleLinks = useMemo(() => {
    const deviceMap = new Map<string, Device>();
    topologyVisibleDevices.forEach((device) => {
      deviceMap.set(device.id, device);
    });
    return topologyLinks
      .filter((link) => topologyVisibleDeviceIds.has(link.source_device_id) && topologyVisibleDeviceIds.has(link.target_device_id))
      .map((link) => describeTopologyLink(link, deviceMap.get(link.source_device_id), deviceMap.get(link.target_device_id)));
  }, [describeTopologyLink, topologyLinks, topologyVisibleDeviceIds, topologyVisibleDevices]);

  const topologyDeviceLinks = useMemo(() => {
    if (!selectedTopologyDeviceId) return [] as any[];
    return topologyVisibleLinks
      .filter((link) => link.source_device_id === selectedTopologyDeviceId || link.target_device_id === selectedTopologyDeviceId)
      .sort((left, right) => {
        const leftPeer = left.source_device_id === selectedTopologyDeviceId ? String(left.target_hostname || '') : String(left.source_hostname || '');
        const rightPeer = right.source_device_id === selectedTopologyDeviceId ? String(right.target_hostname || '') : String(right.source_hostname || '');
        return leftPeer.localeCompare(rightPeer);
      });
  }, [selectedTopologyDeviceId, topologyVisibleLinks]);

  const topologyConnectedDeviceIds = useMemo(() => {
    const connected = new Set<string>();
    topologyVisibleLinks.forEach((link) => {
      if (link.source_device_id) connected.add(link.source_device_id);
      if (link.target_device_id) connected.add(link.target_device_id);
    });
    return connected;
  }, [topologyVisibleLinks]);

  const topologyStats = useMemo(() => ({
    nodeCount: topologyVisibleDevices.length,
    linkCount: topologyVisibleLinks.length,
    siteCount: new Set(topologyVisibleDevices.map((device) => String(device.site || '').trim()).filter(Boolean)).size,
    atRiskCount: topologyVisibleDevices.filter((device) => device.status !== 'online' || device.health_status === 'critical' || (device.open_alert_count || 0) > 0).length,
    orphanCount: topologyVisibleDevices.filter((device) => !topologyConnectedDeviceIds.has(device.id)).length,
  }), [topologyConnectedDeviceIds, topologyVisibleDevices, topologyVisibleLinks.length]);

  const topologyLinkStats = useMemo(() => ({
    up: topologyVisibleLinks.filter((link: TopologyDecoratedLink) => link.operational_state === 'up').length,
    degraded: topologyVisibleLinks.filter((link: TopologyDecoratedLink) => link.operational_state === 'degraded').length,
    down: topologyVisibleLinks.filter((link: TopologyDecoratedLink) => link.operational_state === 'down').length,
    stale: topologyVisibleLinks.filter((link: TopologyDecoratedLink) => link.operational_state === 'stale').length,
    multiSource: topologyVisibleLinks.filter((link: TopologyDecoratedLink) => link.evidence_sources.length > 1 || link.reverse_confirmed || Number(link.evidence_count || 0) > 1).length,
  }), [topologyVisibleLinks]);

  const selectedTopologyDevice = useMemo(
    () => topologyVisibleDevices.find((device) => device.id === selectedTopologyDeviceId) || null,
    [selectedTopologyDeviceId, topologyVisibleDevices],
  );

  const selectedTopologyLink = useMemo<TopologyDecoratedLink | null>(
    () => topologyVisibleLinks.find((link) => (link.link_key || link.id) === selectedTopologyLinkKey) || null,
    [selectedTopologyLinkKey, topologyVisibleLinks],
  );

  const topologyNeighborIds = useMemo(() => {
    if (!selectedTopologyDeviceId) return new Set<string>();
    const neighbors = new Set<string>();
    topologyVisibleLinks.forEach((link) => {
      if (link.source_device_id === selectedTopologyDeviceId && link.target_device_id) neighbors.add(link.target_device_id);
      if (link.target_device_id === selectedTopologyDeviceId && link.source_device_id) neighbors.add(link.source_device_id);
    });
    return neighbors;
  }, [selectedTopologyDeviceId, topologyVisibleLinks]);

  const topologyNeighborDevices = useMemo(
    () => topologyVisibleDevices.filter((device) => topologyNeighborIds.has(device.id)).sort((left, right) => left.hostname.localeCompare(right.hostname)),
    [topologyNeighborIds, topologyVisibleDevices],
  );

  const topologyOrphanDevices = useMemo(
    () => topologyVisibleDevices.filter((device) => !topologyConnectedDeviceIds.has(device.id)).sort((left, right) => left.hostname.localeCompare(right.hostname)),
    [topologyConnectedDeviceIds, topologyVisibleDevices],
  );

  const topologyPriorityDevices = useMemo(
    () => [...topologyVisibleDevices]
      .sort((left, right) => {
        const leftScore = (left.status !== 'online' ? 100 : 0) + (left.critical_open_alerts || 0) * 10 + (left.open_alert_count || 0);
        const rightScore = (right.status !== 'online' ? 100 : 0) + (right.critical_open_alerts || 0) * 10 + (right.open_alert_count || 0);
        return rightScore - leftScore;
      })
      .slice(0, 5),
    [topologyVisibleDevices],
  );

  useEffect(() => {
    if (topologyVisibleDevices.length === 0) {
      if (selectedTopologyDeviceId !== null) setSelectedTopologyDeviceId(null);
      if (selectedTopologyLinkKey !== null) setSelectedTopologyLinkKey(null);
      return;
    }

    if (!selectedTopologyDeviceId || !topologyVisibleDevices.some((device) => device.id === selectedTopologyDeviceId)) {
      setSelectedTopologyDeviceId(topologyVisibleDevices[0].id);
    }
  }, [selectedTopologyDeviceId, selectedTopologyLinkKey, topologyVisibleDevices]);

  useEffect(() => {
    if (!selectedTopologyDeviceId) {
      if (selectedTopologyLinkKey !== null) setSelectedTopologyLinkKey(null);
      return;
    }

    if (topologyDeviceLinks.length === 0) {
      if (selectedTopologyLinkKey !== null) setSelectedTopologyLinkKey(null);
      return;
    }

    if (!selectedTopologyLinkKey || !topologyDeviceLinks.some((link) => (link.link_key || link.id) === selectedTopologyLinkKey)) {
      setSelectedTopologyLinkKey(topologyDeviceLinks[0].link_key || topologyDeviceLinks[0].id || null);
    }
  }, [selectedTopologyDeviceId, selectedTopologyLinkKey, topologyDeviceLinks]);

  useEffect(() => {
    setMonitorAlertsPage(1);
  }, [monitorAlertsSeverity, monitorAlertsPhase, monitorSelectedDevice?.id]);

  useEffect(() => {
    if (!isAuthenticated || activeTab !== 'monitoring') return;
    const q = monitorSearch.trim();
    if (!q) {
      setMonitorSearchResults([]);
      setMonitorSearching(false);
      return;
    }

    let cancelled = false;
    let searchController: AbortController | null = null;
    setMonitorSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        searchController = new AbortController();
        const resp = await fetch(`/api/monitoring/search-devices?q=${encodeURIComponent(q)}&limit=20`, { signal: searchController.signal });
        if (!resp.ok) return;
        const data = await resp.json();
        if (!cancelled) {
          setMonitorSearchResults(Array.isArray(data.items) ? data.items : []);
        }
      } catch (error) {
        if (isAbortError(error)) return;
        if (!cancelled) setMonitorSearchResults([]);
      } finally {
        if (!cancelled) setMonitorSearching(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (searchController) searchController.abort();
    };
  }, [isAuthenticated, activeTab, monitorSearch]);

  useEffect(() => {
    if (!isAuthenticated || activeTab !== 'monitoring' || !monitorSelectedDevice?.id) {
      setMonitorRealtime(null);
      setMonitorTrend(null);
      return;
    }

    let cancelled = false;
    let realtimeController: AbortController | null = null;
    let trendController: AbortController | null = null;

    const loadRealtime = async () => {
      if (realtimeController) realtimeController.abort();
      realtimeController = new AbortController();
      return fetchMonitoringRealtime(monitorSelectedDevice.id, realtimeController.signal);
    };

    const loadTrend = async () => {
      if (trendController) trendController.abort();
      trendController = new AbortController();
      return fetchMonitoringTrend(
        monitorSelectedDevice.id,
        monitorTrendInterface,
        monitorTrendResolution,
        monitorTrendRange,
        trendController.signal,
      );
    };

    const load = async () => {
      setMonitorLoading(true);
      try {
        const [rt, tr] = await Promise.all([
          loadRealtime(),
          loadTrend(),
        ]);
        if (!cancelled) {
          setMonitorRealtime(rt);
          setMonitorTrend(tr);
        }
      } catch (error) {
        if (isAbortError(error)) return;
        if (!cancelled) {
          setMonitorRealtime(null);
          setMonitorTrend(null);
        }
      } finally {
        if (!cancelled) setMonitorLoading(false);
      }
    };

    load();
    if (!monitorPageVisible) {
      return () => {
        cancelled = true;
        if (realtimeController) realtimeController.abort();
        if (trendController) trendController.abort();
      };
    }
    const realtimeTimer = window.setInterval(async () => {
      try {
        const rt = await loadRealtime();
        if (!cancelled) setMonitorRealtime(rt);
      } catch (error) {
        if (isAbortError(error)) return;
        // ignore transient errors
      }
    }, 5000);
    const trendTimer = window.setInterval(async () => {
      try {
        const tr = await loadTrend();
        if (!cancelled) setMonitorTrend(tr);
      } catch (error) {
        if (isAbortError(error)) return;
        // ignore transient errors
      }
    }, 60000);

    return () => {
      cancelled = true;
      window.clearInterval(realtimeTimer);
      window.clearInterval(trendTimer);
      if (realtimeController) realtimeController.abort();
      if (trendController) trendController.abort();
    };
  }, [isAuthenticated, activeTab, monitorSelectedDevice?.id, monitorTrendInterface, monitorTrendResolution, monitorTrendRange.start_time, monitorTrendRange.end_time, fetchMonitoringRealtime, fetchMonitoringTrend, monitorPageVisible]);

  useEffect(() => {
    setMonitorTrendInterface('');
    setMonitorTrendStartInput('');
    setMonitorTrendEndInput('');
    setMonitorTrendRange({});
  }, [monitorSelectedDevice?.id]);

  useEffect(() => {
    setMonitorTrendZoom(null);
    setMonitorTrendDragStart(null);
    setMonitorTrendDragEnd(null);
  }, [monitorSelectedDevice?.id, monitorTrendInterface, monitorTrendResolution]);

  useEffect(() => {
    localStorage.setItem('netops_monitor_trend_ui_mode', monitorTrendUiMode);
  }, [monitorTrendUiMode]);

  useEffect(() => {
    setHistoryPage(1);
  }, [historyStatusFilter, historyTimeFilter, historyPageSize]);

  useEffect(() => {
    const totalHistoryPages = Math.max(1, Math.ceil(historyTotal / historyPageSize));
    if (historyPage > totalHistoryPages) {
      setHistoryPage(totalHistoryPages);
    }
  }, [historyTotal, historyPage, historyPageSize]);

  useEffect(() => {
    if (!isAuthenticated || activeTab !== 'history') return;

    let cancelled = false;
    const fetchHistoryPage = async () => {
      setHistoryLoading(true);
      try {
        const params = new URLSearchParams({
          status: historyStatusFilter,
          time_range: historyTimeFilter,
          page: String(historyPage),
          page_size: String(historyPageSize),
        });
        const resp = await fetch(`/api/jobs?${params.toString()}`);
        if (!resp.ok) throw new Error('Failed to fetch history data');

        const data = await resp.json();
        if (cancelled) return;

        if (Array.isArray(data)) {
          setHistoryRows(data);
          setHistoryTotal(data.length);
        } else {
          setHistoryRows(Array.isArray(data.items) ? data.items : []);
          setHistoryTotal(typeof data.total === 'number' ? data.total : 0);
        }
      } catch {
        if (cancelled) return;
        setHistoryRows([]);
        setHistoryTotal(0);
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    };

    fetchHistoryPage();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, activeTab, historyStatusFilter, historyTimeFilter, historyPage, historyPageSize]);

  useEffect(() => {
    setAuditPage(1);
  }, [auditCategoryFilter, auditSeverityFilter, auditStatusFilter, auditTimeFilter, auditPageSize]);

  useEffect(() => {
    if (!isAuthenticated || activeTab !== 'history') return;

    let cancelled = false;
    const loadAuditEvents = async () => {
      setAuditLoading(true);
      try {
        const params = new URLSearchParams({
          category: auditCategoryFilter,
          severity: auditSeverityFilter,
          status: auditStatusFilter,
          time_range: auditTimeFilter,
          page: String(auditPage),
          page_size: String(auditPageSize),
        });
        const resp = await fetch(`/api/audit/events?${params.toString()}`);
        if (!resp.ok) throw new Error('Failed to fetch audit events');
        const data = await resp.json();
        if (cancelled) return;
        setAuditRows(Array.isArray(data.items) ? data.items : []);
        setAuditTotal(typeof data.total === 'number' ? data.total : 0);
      } catch {
        if (cancelled) return;
        setAuditRows([]);
        setAuditTotal(0);
      } finally {
        if (!cancelled) setAuditLoading(false);
      }
    };

    loadAuditEvents();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, activeTab, auditCategoryFilter, auditSeverityFilter, auditStatusFilter, auditTimeFilter, auditPage, auditPageSize]);

  useEffect(() => {
    setCompliancePage(1);
  }, [complianceSeverityFilter, complianceStatusFilter, complianceCategoryFilter, compliancePageSize]);

  useEffect(() => {
    if (!isAuthenticated || activeTab !== 'compliance') return;

    let cancelled = false;
    const loadCompliance = async () => {
      setComplianceLoading(true);
      try {
        const params = new URLSearchParams({
          severity: complianceSeverityFilter,
          status: complianceStatusFilter,
          category: complianceCategoryFilter,
          page: String(compliancePage),
          page_size: String(compliancePageSize),
        });
        const [overviewResp, findingsResp] = await Promise.all([
          fetch('/api/compliance/overview'),
          fetch(`/api/compliance/findings?${params.toString()}`),
        ]);
        if (!overviewResp.ok || !findingsResp.ok) throw new Error('Failed to fetch compliance data');
        const overviewData = await overviewResp.json();
        const findingsData = await findingsResp.json();
        if (cancelled) return;
        setComplianceOverview(overviewData);
        setComplianceFindings(Array.isArray(findingsData.items) ? findingsData.items : []);
        setComplianceFindingTotal(typeof findingsData.total === 'number' ? findingsData.total : 0);
      } catch {
        if (cancelled) return;
        setComplianceOverview(null);
        setComplianceFindings([]);
        setComplianceFindingTotal(0);
      } finally {
        if (!cancelled) setComplianceLoading(false);
      }
    };

    loadCompliance();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, activeTab, complianceSeverityFilter, complianceStatusFilter, complianceCategoryFilter, compliancePage, compliancePageSize, complianceRefreshTick]);

  const runComplianceAudit = async () => {
    setComplianceRunLoading(true);
    try {
      const resp = await fetch('/api/compliance/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          author: currentUser.username || 'admin',
          actor_id: currentUser.id,
          actor_role: currentUser.role || 'Administrator',
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        showToast(`Compliance audit failed: ${data.detail || resp.statusText}`, 'error');
        return;
      }
      showToast(language === 'zh' ? `审计完成，合规得分 ${data.score}%` : `Audit completed. Score ${data.score}%`, 'success');
      setComplianceRefreshTick((v) => v + 1);
    } catch {
      showToast(language === 'zh' ? '审计执行失败' : 'Compliance audit request failed', 'error');
    } finally {
      setComplianceRunLoading(false);
    }
  };

  const updateComplianceFinding = async (findingId: string, patch: { status?: string; owner?: string; note?: string }) => {
    try {
      const resp = await fetch(`/api/compliance/findings/${findingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        showToast(`Update failed: ${data.detail || resp.statusText}`, 'error');
        return;
      }
      setSelectedFinding(data);
      setComplianceRefreshTick((v) => v + 1);
      showToast(language === 'zh' ? '审计问题已更新' : 'Finding updated', 'success');
    } catch {
      showToast(language === 'zh' ? '更新失败' : 'Update failed', 'error');
    }
  };

  const openAuditEventDetail = async (event: AuditEvent) => {
    try {
      const resp = await fetch(`/api/audit/events/${event.id}`);
      const data = await resp.json().catch(() => event);
      if (!resp.ok) throw new Error('Failed to fetch audit event detail');
      setSelectedAuditEvent(data);
    } catch {
      setSelectedAuditEvent(event);
      showToast(language === 'zh' ? '无法加载完整审计详情，已显示当前记录。' : 'Unable to load full audit details, showing current row.', 'info');
    }
  };

  const openComplianceFindingDetail = async (finding: ComplianceFinding) => {
    try {
      const resp = await fetch(`/api/compliance/findings/${finding.id}`);
      const data = await resp.json().catch(() => finding);
      if (!resp.ok) throw new Error('Failed to fetch compliance finding detail');
      setSelectedFinding(data);
    } catch {
      setSelectedFinding(finding);
      showToast(language === 'zh' ? '无法加载完整问题详情，已显示当前记录。' : 'Unable to load full finding details, showing current row.', 'info');
    }
  };

  const handleSort = (key: keyof Device) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (inventorySortConfig && inventorySortConfig.key === key && inventorySortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setInventorySortConfig({ key, direction });
  };

  const [automationSearch, setAutomationSearch] = useState('');
  const [automationPlatformFilter, setAutomationPlatformFilter] = useState('all');
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionTestDevice, setConnectionTestDevice] = useState<Device | null>(null);
  const [connectionTestMode, setConnectionTestMode] = useState<'quick' | 'deep'>('quick');
  const [connectionTestingDeviceId, setConnectionTestingDeviceId] = useState<string | null>(null);
  const [deviceConnectionChecks, setDeviceConnectionChecks] = useState<Record<string, DeviceConnectionCheckSummary>>({});
  // Interface monitoring page state
  const [intfSearch, setIntfSearch] = useState('');
  const [intfDevicePage, setIntfDevicePage] = useState(1);
  const [intfExpandedDevice, setIntfExpandedDevice] = useState<string | null>(null);
  const [intfPageMap, setIntfPageMap] = useState<Record<string, number>>({});
  const [intfFilterMap, setIntfFilterMap] = useState<Record<string, string>>({});
  const [intfStatusFilter, setIntfStatusFilter] = useState<'all' | 'hasData' | 'hasDown' | 'hasErrors'>('hasData');
  const [intfSortBy, setIntfSortBy] = useState<'name' | 'downCount' | 'errors' | 'bw'>('name');
  const [intfHideEmpty, setIntfHideEmpty] = useState(true);
  // SNMP test state
  const [snmpTestingId, setSnmpTestingId] = useState<string | null>(null);
  const [snmpSyncingId, setSnmpSyncingId] = useState<string | null>(null);
  const [snmpTestResult, setSnmpTestResult] = useState<any>(null);
  const [showSnmpTestResult, setShowSnmpTestResult] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [viewingConfig, setViewingConfig] = useState<ConfigVersion | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [schedulingTask, setSchedulingTask] = useState<string | null>(null);
  const [scheduleForm, setScheduleForm] = useState({
    type: 'once' as 'once' | 'recurring',
    interval: 'daily' as 'daily' | 'weekly' | 'monthly',
    time: '',
    timezone: 'UTC'
  });
  const [showRemediationModal, setShowRemediationModal] = useState(false);
  const [remediatingDevice, setRemediatingDevice] = useState<Device | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [viewingDevice, setViewingDevice] = useState<Device | null>(null);
  const [viewingDeviceAlerts, setViewingDeviceAlerts] = useState<DeviceHealthAlertItem[]>([]);
  const [deviceDetailLoading, setDeviceDetailLoading] = useState(false);
  const [deviceTrendRangeHours, setDeviceTrendRangeHours] = useState(24);
  const [deviceHealthTrend, setDeviceHealthTrend] = useState<DeviceHealthTrendResponse | null>(null);
  const [deviceHealthTrendLoading, setDeviceHealthTrendLoading] = useState(false);
  const [deviceOperationalData, setDeviceOperationalData] = useState<any | null>(null);
  const [deviceOperationalDataLoading, setDeviceOperationalDataLoading] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [editForm, setEditForm] = useState<Partial<Device>>({});
  const [addForm, setAddForm] = useState<Partial<Device>>({
    hostname: '',
    ip_address: '',
    platform: 'cisco_ios',
    role: 'Access',
    site: '',
    connection_method: 'ssh',
    username: '',
    password: '',
    snmp_community: 'public',
    snmp_port: 161
  });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deviceToDelete, setDeviceToDelete] = useState<string | null>(null);
  const [isDeletingSelected, setIsDeletingSelected] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const copyTextWithFallback = async (text: string): Promise<boolean> => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // Fall back to legacy copy approach below.
    }

    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', 'true');
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.style.top = '0';
      document.body.appendChild(textarea);
      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length);
      const copied = document.execCommand('copy');
      document.body.removeChild(textarea);
      return copied;
    } catch {
      return false;
    }
  };

  const handleShowDetails = (device: Device) => {
    setViewingDevice(device);
    setViewingDeviceAlerts([]);
    setDeviceTrendRangeHours(24);
    setDeviceHealthTrend(null);
    setDeviceOperationalData(null);
    setShowDetailsModal(true);
    setDeviceDetailLoading(true);

    fetch(`/api/device-health/device/${device.id}`)
      .then(async (resp) => {
        if (!resp.ok) throw new Error('Failed to load device health detail');
        const data = await resp.json() as DeviceHealthDetailResponse;
        setViewingDevice(normalizeDeviceRecord(data.device));
        setViewingDeviceAlerts(Array.isArray(data.recent_open_alerts) ? data.recent_open_alerts : []);
      })
      .catch(() => {
        showToast(language === 'zh' ? '无法加载完整健康详情，已显示当前设备快照。' : 'Unable to load full health details, showing the current device snapshot.', 'info');
      })
      .finally(() => setDeviceDetailLoading(false));
  };

  useEffect(() => {
    if (!showDetailsModal || !viewingDevice?.id) return;

    let cancelled = false;
    const loadDeviceTrend = async () => {
      setDeviceHealthTrendLoading(true);
      try {
        const resp = await fetch(`/api/device-health/device/${viewingDevice.id}/trend?range_hours=${deviceTrendRangeHours}`);
        if (!resp.ok) throw new Error('Failed to load device trend');
        const data = await resp.json() as DeviceHealthTrendResponse;
        if (!cancelled) setDeviceHealthTrend(data);
      } catch {
        if (!cancelled) setDeviceHealthTrend(null);
      } finally {
        if (!cancelled) setDeviceHealthTrendLoading(false);
      }
    };

    loadDeviceTrend();
    return () => {
      cancelled = true;
    };
  }, [deviceTrendRangeHours, showDetailsModal, viewingDevice?.id]);

  const deviceTrendInsights = useMemo(() => {
    const series = deviceHealthTrend?.series || [];
    if (series.length === 0) {
      return {
        latest: null,
        previous: null,
        scoreDelta: 0,
        alertDelta: 0,
        addedReasons: [] as string[],
        removedReasons: [] as string[],
      };
    }

    const latest = series[series.length - 1];
    const previous = series.length > 1 ? series[series.length - 2] : null;
    const latestReasons = Array.isArray(latest.health_reasons) ? latest.health_reasons : [];
    const previousReasons = previous && Array.isArray(previous.health_reasons) ? previous.health_reasons : [];

    return {
      latest,
      previous,
      scoreDelta: latest && previous ? Number(latest.health_score || 0) - Number(previous.health_score || 0) : 0,
      alertDelta: latest && previous ? Number(latest.open_alert_count || 0) - Number(previous.open_alert_count || 0) : 0,
      addedReasons: latestReasons.filter((reason) => !previousReasons.includes(reason)),
      removedReasons: previousReasons.filter((reason) => !latestReasons.includes(reason)),
    };
  }, [deviceHealthTrend]);

  const viewingDeviceConnectionSummary = viewingDevice?.id ? deviceConnectionChecks[viewingDevice.id] : null;

  const operationalCategoryLabelMap: Record<string, { zh: string; en: string }> = {
    interfaces: { zh: '接口信息', en: 'Interfaces' },
    neighbors: { zh: '邻居信息', en: 'Neighbors' },
    arp: { zh: 'ARP', en: 'ARP' },
    mac_table: { zh: 'MAC 地址表', en: 'MAC Table' },
    routing_table: { zh: '路由表', en: 'Routing Table' },
    bgp: { zh: 'BGP', en: 'BGP' },
    ospf: { zh: 'OSPF', en: 'OSPF' },
  };

  const loadDeviceOperationalData = async (deviceId: string) => {
    setDeviceOperationalDataLoading(true);
    try {
      const resp = await fetch(`/api/devices/${deviceId}/operational-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categories: ['interfaces', 'neighbors', 'arp', 'mac_table', 'routing_table', 'bgp', 'ospf'],
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data?.detail || 'Failed to collect operational data');
      }
      setDeviceOperationalData(data);
      showToast(language === 'zh' ? '已完成设备运行数据采集' : 'Operational data collected', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to collect operational data';
      showToast(language === 'zh' ? `采集失败：${message}` : message, 'error');
    } finally {
      setDeviceOperationalDataLoading(false);
    }
  };

  const handleRemediate = (device: Device) => {
    setRemediatingDevice(device);
    setShowRemediationModal(true);
  };

  const confirmRemediation = () => {
    if (!remediatingDevice) return;
    
    // Create a remediation job
    const newJob: Job = {
      id: String(Date.now()),
      device_id: remediatingDevice.id,
      task_name: 'Auto-Remediation: Golden Config',
      status: 'running',
      created_at: new Date().toISOString(),
    };
    setJobs([newJob, ...jobs]);
    setShowRemediationModal(false);
    setActiveTab('automation');
    setSelectedDevice(remediatingDevice);
    
    // Simulate task completion and compliance update
    setTimeout(() => {
      setJobs(prev => prev.map(j => j.id === newJob.id ? { ...j, status: 'success' } : j));
      setDevices(prev => prev.map(d => d.id === remediatingDevice.id ? { ...d, compliance: 'compliant' } : d));
      
      // Add new config version
      const newVersion: ConfigVersion = {
        id: `v${Date.now()}`,
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
        content: remediatingDevice.current_config + '\n! Remediated to Golden Config',
        author: 'system',
        description: 'Auto-Remediation'
      };
      setDevices(prev => prev.map(d => {
        if (d.id === remediatingDevice.id) {
          return {
            ...d,
            current_config: newVersion.content,
            config_history: [newVersion, ...d.config_history]
          };
        }
        return d;
      }));
    }, 3000);
  };

  const handleScheduleTask = () => {
    if (!selectedDevice || !schedulingTask) return;
    
    const newTask: ScheduledTask = {
      id: Date.now(),
      device_id: selectedDevice.id,
      task_name: schedulingTask,
      schedule_type: scheduleForm.type,
      interval: scheduleForm.type === 'recurring' ? scheduleForm.interval : undefined,
      scheduled_time: scheduleForm.time,
      timezone: scheduleForm.timezone,
      status: 'active'
    };
    
    setScheduledTasks([...scheduledTasks, newTask]);
    setShowScheduleModal(false);
    setSchedulingTask(null);
    alert(`Task "${schedulingTask}" scheduled successfully.`);
  };

  const handleExportConfig = (device: Device) => {
    if (!device.current_config) return;
    const blob = new Blob([device.current_config], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${device.hostname}_config.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportConfig = (e: React.ChangeEvent<HTMLInputElement>, device: Device) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const newVersion: ConfigVersion = {
        id: `v${Date.now()}`,
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
        content: device.current_config || '',
        author: 'admin',
        description: 'Backup before import'
      };
      
      const updatedDevices = devices.map(d => {
        if (d.id === device.id) {
          return {
            ...d,
            current_config: content,
            config_history: [newVersion, ...d.config_history]
          };
        }
        return d;
      });
      setDevices(updatedDevices);
      if (selectedDevice?.id === device.id) {
        setSelectedDevice(updatedDevices.find(d => d.id === device.id) || null);
      }
      alert('Configuration imported successfully.');
    };
    reader.readAsText(file);
  };

  const handleRollbackConfig = async (device: Device, version: ConfigVersion) => {
    const newVersion: ConfigVersion = {
      id: `v${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
      content: device.current_config || '',
      author: 'admin',
      description: `Rollback to ${version.id}`
    };

    const updatedHistory = [newVersion, ...device.config_history];
    
    try {
      // 1. Execute the rollback on the device
      const execRes = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_id: device.id,
          command: version.content
        })
      });

      if (!execRes.ok) {
        showToast('Failed to execute rollback on device', 'error');
        return;
      }

      // 2. Persist the new state in the DB
      const dbRes = await fetch(`/api/devices/${device.id}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_config: version.content,
          config_history: updatedHistory
        })
      });

      if (dbRes.ok) {
        const updatedDevice = {
          ...device,
          current_config: version.content,
          config_history: updatedHistory
        };

        setDevices(prev => prev.map(d => d.id === device.id ? updatedDevice : d));
        
        if (selectedDevice?.id === device.id) {
          setSelectedDevice(updatedDevice);
        }
        
        setViewingConfig(null);
        setShowConfigModal(false);
        showToast(`Rolled back to version ${version.id}`, 'success');
      } else {
        showToast('Failed to update configuration history', 'error');
      }
    } catch (error) {
      showToast('Connection error during rollback', 'error');
    }
  };

  const confirmDeleteDevice = async () => {
    if (!deviceToDelete && !isDeletingSelected) return;
    
    if (isDeletingSelected) {
      if (selectedDeviceIds.length === 0) return;
      
      let successCount = 0;
      let failCount = 0;
      
      for (const id of selectedDeviceIds) {
        try {
          const response = await fetch(`/api/devices/${id}`, { method: 'DELETE' });
          if (response.ok) {
            successCount++;
            setDevices(prev => prev.filter(d => d.id !== id));
          } else {
            failCount++;
          }
        } catch (error) {
          failCount++;
        }
      }
      
      setSelectedDeviceIds([]);
      setInventoryRefreshTick((v) => v + 1);
      if (failCount === 0) {
        showToast(`Successfully deleted ${successCount} devices`, 'success');
      } else {
        showToast(`Deleted ${successCount} devices, failed to delete ${failCount} devices`, 'error');
      }
    } else if (deviceToDelete) {
      try {
        const response = await fetch(`/api/devices/${deviceToDelete}`, { method: 'DELETE' });
        if (response.ok) {
          setDevices(prev => prev.filter(d => d.id !== deviceToDelete));
          setSelectedDeviceIds(prev => prev.filter(selectedId => selectedId !== deviceToDelete));
          setInventoryRefreshTick((v) => v + 1);
          showToast('Device deleted successfully', 'success');
        } else {
          const data = await response.json();
          showToast(`Failed to delete device: ${data.error}`, 'error');
        }
      } catch (error) {
        showToast(`Error deleting device: ${error}`, 'error');
      }
    }
    
    setShowDeleteModal(false);
    setDeviceToDelete(null);
    setIsDeletingSelected(false);
  };

  const handleSaveEdit = async () => {
    if (!editingDevice) return;
    try {
      const response = await fetch(`/api/devices/${editingDevice.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      });
      if (response.ok) {
        setDevices(prev => prev.map(d => d.id === editingDevice.id ? { ...d, ...editForm } as Device : d));
        setInventoryRefreshTick((v) => v + 1);
        setShowEditModal(false);
        showToast('Device updated successfully', 'success');
      } else {
        const data = await response.json();
        showToast(`Failed to update device: ${data.detail || data.error || response.statusText}`, 'error');
      }
    } catch (error) {
      showToast(`Error updating device: ${error}`, 'error');
    }
  };

  const handleAddDevice = async () => {
    if (!addForm.hostname || !addForm.ip_address) {
      showToast('Hostname and IP Address are required', 'error');
      return;
    }
    try {
      const response = await fetch('/api/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addForm)
      });
      const data = await response.json();
      if (response.ok) {
        setDevices([...devices, data]);
        setInventoryRefreshTick((v) => v + 1);
        setInventoryPage(1);
        setShowAddModal(false);
        setAddForm({
          hostname: '',
          ip_address: '',
          platform: 'cisco_ios',
          role: 'Access',
          site: '',
          connection_method: 'ssh',
          username: '',
          password: '',
          snmp_community: 'public',
          snmp_port: 161
        });
        showToast('Device added successfully', 'success');
      } else {
        showToast(`Failed to add device: ${data.error}`, 'error');
      }
    } catch (error) {
      showToast(`Error adding device: ${error}`, 'error');
    }
  };

  const handleDeleteDevice = (id: string) => {
    setDeviceToDelete(id);
    setIsDeletingSelected(false);
    setShowDeleteModal(true);
  };

  const handleDeleteSelected = () => {
    if (selectedDeviceIds.length === 0) return;
    setIsDeletingSelected(true);
    setDeviceToDelete(null);
    setShowDeleteModal(true);
  };

  const [showTestResult, setShowTestResult] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; output?: string; rawError?: string; errorCode?: string; checkMode?: string; stages?: Array<{ stage: string; ok: boolean; summary: string; detail: string; latency_ms?: number | null }> } | null>(null);

  const handleTestConnection = async (deviceToTest: Device | null = selectedDevice, mode: 'quick' | 'deep' = 'quick') => {
    if (!deviceToTest) return;
    setIsTestingConnection(true);
    setTestResult(null);
    setConnectionTestDevice(deviceToTest);
    setConnectionTestMode(mode);
    setConnectionTestingDeviceId(deviceToTest.id);
    setShowTestResult(true);
    try {
      const response = await fetch('/api/devices/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_id: deviceToTest.id,
          hostname: deviceToTest.hostname,
          ip_address: deviceToTest.ip_address,
          username: deviceToTest.username,
          password: deviceToTest.password,
          method: deviceToTest.connection_method,
          platform: deviceToTest.platform,
          check_mode: mode,
        })
      });
      const data = await response.json();
      if (response.ok) {
        const stages = Array.isArray(data.stages) ? data.stages : [];
        const summary: DeviceConnectionCheckSummary = {
          status: buildConnectionCheckStatus(true, mode, undefined, stages),
          mode,
          checked_at: new Date().toISOString(),
        };
        setDeviceConnectionChecks((prev) => ({ ...prev, [deviceToTest.id]: summary }));
        setTestResult({ success: true, message: data.message, output: data.output, checkMode: data.check_mode, stages });
      } else {
        const stages = Array.isArray(data.stages) ? data.stages : [];
        const summary: DeviceConnectionCheckSummary = {
          status: buildConnectionCheckStatus(false, mode, data.error_code, stages),
          mode,
          checked_at: new Date().toISOString(),
          error_code: data.error_code,
        };
        setDeviceConnectionChecks((prev) => ({ ...prev, [deviceToTest.id]: summary }));
        setTestResult({
          success: false,
          message: buildConnectionTestMessage(data.detail || data.error, data.error_code),
          output: data.output,
          rawError: data.raw_error,
          errorCode: data.error_code,
          checkMode: data.check_mode,
          stages,
        });
      }
    } catch (error: any) {
      setDeviceConnectionChecks((prev) => ({
        ...prev,
        [deviceToTest.id]: {
          status: 'fail',
          mode,
          checked_at: new Date().toISOString(),
        },
      }));
      setTestResult({ success: false, message: error.message || 'Network error' });
    } finally {
      setIsTestingConnection(false);
      setConnectionTestingDeviceId(null);
    }
  };

  const handleSnmpTest = async (deviceId: string) => {
    setSnmpTestingId(deviceId);
    setSnmpTestResult(null);
    setShowSnmpTestResult(true);
    try {
      const resp = await fetch(`/api/devices/${deviceId}/snmp-test`, { method: 'POST' });
      const data = await resp.json();
      setSnmpTestResult(data);
      // 测试成功且后端已同步数据 → 立刻用返回值更新本地 state，无需等待轮询
      if (data.success && data.synced) {
        setDevices(prev => prev.map(d => {
          if (d.id !== deviceId) return d;
          return {
            ...d,
            ...(data.sys_name   ? { hostname: d.hostname || data.sys_name } : {}),
            ...(data.sys_descr  ? { model: d.model || data.sys_descr.split('\n')[0].slice(0, 80) } : {}),
          };
        }));
        // 触发一次完整刷新，把接口/CPU/内存等新数据也拉回来
        await fetchDevicesData();
      }
    } catch (err: any) {
      setSnmpTestResult({ success: false, error: err.message || 'Network error' });
    } finally {
      setSnmpTestingId(null);
    }
  };

  const handleSnmpSyncNow = async (deviceId: string) => {
    setSnmpSyncingId(deviceId);
    try {
      const resp = await fetch(`/api/devices/${deviceId}/snmp-test`, { method: 'POST' });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        showToast(language === 'zh' ? 'SNMP 立即同步失败' : 'SNMP sync failed', 'error');
        return;
      }
      await fetchDevicesData();
      showToast(language === 'zh' ? 'SNMP 信息已更新' : 'SNMP data refreshed', 'success');
    } catch (err) {
      showToast(language === 'zh' ? 'SNMP 立即同步失败' : 'SNMP sync failed', 'error');
    } finally {
      setSnmpSyncingId(null);
    }
  };

  const handleTriggerDiscovery = async () => {
    setTopologyDiscoveryRunning(true);
    try {
      const response = await fetch('/api/topology/discover', { method: 'POST' });
      if (response.ok) {
        showToast(language === 'zh' ? '已启动一次手动拓扑刷新，稍后自动更新链路状态' : 'Manual topology refresh started. Link state will update shortly.', 'success');
        window.setTimeout(async () => {
          try {
            const linksResponse = await fetch('/api/topology/links');
            if (linksResponse.ok) {
              const nextLinks = await linksResponse.json();
              setTopologyLinks(Array.isArray(nextLinks) ? nextLinks : []);
            }
          } catch {
            // Ignore delayed refresh errors. The next shared data refresh will reconcile state.
          }
        }, 2500);
      } else {
        showToast(language === 'zh' ? '拓扑发现启动失败' : 'Failed to start topology discovery', 'error');
      }
    } catch (error) {
      showToast(language === 'zh' ? '连接失败，无法触发拓扑发现' : 'Connection error', 'error');
    } finally {
      setTopologyDiscoveryRunning(false);
    }
  };

  const handleExport = () => {
    // Exclude current_config and config_history for a cleaner export
    const exportData = devices.map(({ current_config, config_history, ...rest }) => rest);
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Inventory");
    XLSX.writeFile(workbook, "network_inventory.xlsx");
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json<any>(worksheet);

        if (jsonData && jsonData.length > 0) {
          const existingHostnames = new Set(devices.map(d => d.hostname));
          const existingIps = new Set(devices.map(d => d.ip_address));
          
          const newDevices: Device[] = [];
          let skippedCount = 0;

          jsonData.forEach((item, index) => {
            const hostname = item.hostname || item['Device Info'] || item['主机名'] || `Unknown-${index}`;
            const ip_address = item.ip_address || item['IP Address'] || item['IP地址'] || '0.0.0.0';

            if (existingHostnames.has(hostname) || existingIps.has(ip_address)) {
              skippedCount++;
              return;
            }

            newDevices.push({
              id: String(Date.now() + index),
              hostname,
              ip_address,
              platform: item.platform || item['Platform'] || item['平台'] || 'unknown',
              status: item.status || item['Status'] || item['状态'] || 'pending',
              compliance: item.compliance || item['Compliance'] || item['合规性'] || 'unknown',
              sn: item.sn || item['SN'] || item['序列号'] || '',
              model: item.model || item['Model'] || item['型号'] || '',
              version: item.version || item['Version'] || item['版本'] || '',
              role: item.role || item['Role'] || item['角色'] || '',
              site: item.site || item['Site'] || item['站点'] || '',
              uptime: item.uptime || item['Uptime'] || item['运行时间'] || '0d 0h',
              connection_method: item.connection_method || item['Method'] || item['连接方式'] || 'ssh',
              config_history: []
            });
            
            existingHostnames.add(hostname);
            existingIps.add(ip_address);
          });
          
          if (newDevices.length > 0) {
            fetch('/api/devices/import', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ devices: newDevices })
            })
            .then(res => res.json())
            .then(data => {
              if (data.status === 'success') {
                setDevices(prev => [...prev, ...newDevices]);
                setInventoryRefreshTick((v) => v + 1);
                setInventoryPage(1);
                const msg = t('importSuccess').replace('{{count}}', newDevices.length.toString()) + 
                            (skippedCount > 0 ? t('importSkipped').replace('{{count}}', skippedCount.toString()) : '');
                showToast(msg, 'success');
              } else {
                showToast(`Import failed: ${data.error}`, 'error');
              }
            })
            .catch(err => {
              showToast(`Import error: ${err}`, 'error');
            });
          } else if (skippedCount > 0) {
            showToast(t('importNoNew').replace('{{count}}', skippedCount.toString()), 'info');
          }
        }
      } catch (error) {
        showToast(t('importError'), 'error');
      }
    };
    reader.readAsArrayBuffer(file);
    // Reset input
    e.target.value = '';
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-[#00172D] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#00bceb] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    const isDark = resolvedTheme === 'dark';
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 font-sans relative overflow-hidden ${isDark ? 'bg-[#050D1B]' : 'bg-[#EAF3FA]'}`}>
        {/* Ambient glow orbs */}
        <div className="absolute top-[-15%] right-[-8%] h-[55vw] w-[55vw] rounded-full bg-[radial-gradient(circle,rgba(0,188,235,0.13)_0%,transparent_65%)] pointer-events-none" />
        <div className="absolute bottom-[-20%] left-[-12%] h-[50vw] w-[50vw] rounded-full bg-[radial-gradient(circle,rgba(0,80,115,0.22)_0%,transparent_65%)] pointer-events-none" />
        <div className="absolute top-[40%] left-[20%] h-[30vw] w-[30vw] rounded-full bg-[radial-gradient(circle,rgba(0,40,90,0.18)_0%,transparent_70%)] pointer-events-none" />

        {/* Dot-grid background */}
        <div className="absolute inset-0 bg-[radial-gradient(rgba(0,188,235,0.9)_1px,transparent_1px)] bg-[length:36px_36px] opacity-[0.055] pointer-events-none" />

        {/* Animated network topology decoration */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.07] pointer-events-none" xmlns="http://www.w3.org/2000/svg">
          <style>{`
            @keyframes nodePulse { 0%,100%{r:4;opacity:0.6} 50%{r:6;opacity:1} }
            @keyframes ringPulse { 0%,100%{r:10;opacity:0.3} 50%{r:16;opacity:0.1} }
            @keyframes dashFlow { 0%{stroke-dashoffset:0} 100%{stroke-dashoffset:-20} }
            .node-pulse { animation: nodePulse 3s ease-in-out infinite; }
            .ring-pulse { animation: ringPulse 4s ease-in-out infinite; }
            .line-flow { stroke-dasharray: 8 12; animation: dashFlow 2s linear infinite; }
            .delay-0 { animation-delay: 0s; }
            .delay-05 { animation-delay: 0.5s; }
            .delay-08 { animation-delay: 0.8s; }
            .delay-1 { animation-delay: 1s; }
            .delay-12 { animation-delay: 1.2s; }
            .delay-15 { animation-delay: 1.5s; }
            .delay-18 { animation-delay: 1.8s; }
            .delay-2 { animation-delay: 2s; }
            .delay-25 { animation-delay: 2.5s; }
          `}</style>
          <line x1="10%" y1="20%" x2="35%" y2="45%" stroke="#00bceb" strokeWidth="0.8" className="line-flow" />
          <line x1="35%" y1="45%" x2="65%" y2="30%" stroke="#00bceb" strokeWidth="0.8" className="line-flow" />
          <line x1="65%" y1="30%" x2="88%" y2="55%" stroke="#00bceb" strokeWidth="0.8" className="line-flow" />
          <line x1="35%" y1="45%" x2="50%" y2="70%" stroke="#00bceb" strokeWidth="0.8" className="line-flow" />
          <line x1="50%" y1="70%" x2="75%" y2="80%" stroke="#00bceb" strokeWidth="0.8" className="line-flow" />
          <line x1="65%" y1="30%" x2="50%" y2="70%" stroke="#005073" strokeWidth="0.6" className="line-flow" />
          <line x1="10%" y1="20%" x2="50%" y2="70%" stroke="#005073" strokeWidth="0.4" className="line-flow" />
          <line x1="20%" y1="85%" x2="35%" y2="45%" stroke="#005073" strokeWidth="0.4" className="line-flow" />
          <line x1="88%" y1="15%" x2="65%" y2="30%" stroke="#00bceb" strokeWidth="0.5" className="line-flow" />
          <line x1="75%" y1="80%" x2="92%" y2="68%" stroke="#005073" strokeWidth="0.4" className="line-flow" />
          <circle cx="10%" cy="20%" r="4" fill="#00bceb" className="node-pulse delay-0" />
          <circle cx="35%" cy="45%" r="5" fill="#00bceb" className="node-pulse delay-05" />
          <circle cx="65%" cy="30%" r="4" fill="#00bceb" className="node-pulse delay-1" />
          <circle cx="88%" cy="55%" r="3" fill="#005073" className="node-pulse delay-15" />
          <circle cx="50%" cy="70%" r="4" fill="#005073" className="node-pulse delay-2" />
          <circle cx="75%" cy="80%" r="3" fill="#00bceb" className="node-pulse delay-08" />
          <circle cx="20%" cy="85%" r="3" fill="#005073" className="node-pulse delay-12" />
          <circle cx="88%" cy="15%" r="3" fill="#00bceb" className="node-pulse delay-25" />
          <circle cx="92%" cy="68%" r="2.5" fill="#005073" className="node-pulse delay-18" />
          <circle cx="10%" cy="20%" r="10" fill="none" stroke="#00bceb" strokeWidth="0.5" className="ring-pulse delay-0" />
          <circle cx="35%" cy="45%" r="12" fill="none" stroke="#00bceb" strokeWidth="0.5" className="ring-pulse delay-1" />
          <circle cx="65%" cy="30%" r="9" fill="none" stroke="#00bceb" strokeWidth="0.5" className="ring-pulse delay-2" />
          <circle cx="50%" cy="70%" r="11" fill="none" stroke="#005073" strokeWidth="0.5" className="ring-pulse delay-15" />
        </svg>

        <motion.div
          initial={{ y: 28, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="relative z-10 w-full max-w-[420px]"
        >
          {/* Brand header — above the card */}
          <div className="text-center mb-8">
            <div className="mb-5 inline-flex h-[72px] w-[72px] items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#003d57_0%,#00bceb_100%)] shadow-[0_0_48px_rgba(0,188,235,0.35),0_0_0_1px_rgba(0,188,235,0.2)]">
              <Activity size={36} className="text-white" />
            </div>
            <h1 className={`text-[28px] font-black tracking-tight leading-none ${isDark ? 'text-white' : 'text-[#0B2A3C]'}`}>NetPilot</h1>
            <p className="text-[#00bceb] text-[10px] font-bold uppercase tracking-[0.28em] mt-2 opacity-80">Network Operations Command Center</p>
          </div>

          {/* Glass card */}
          <div className={`overflow-hidden rounded-3xl backdrop-blur-2xl ${isDark
            ? 'border border-[rgba(0,188,235,0.18)] bg-white/[0.035] shadow-[0_0_80px_rgba(0,188,235,0.07),0_24px_48px_rgba(0,0,0,0.5)]'
            : 'border border-[rgba(0,80,115,0.18)] bg-white/[0.82] shadow-[0_26px_48px_rgba(0,45,85,0.22),0_0_0_1px_rgba(255,255,255,0.45)]'
          }`}>
            {/* Top glow line */}
            <div className="h-px bg-[linear-gradient(90deg,transparent_0%,rgba(0,188,235,0.7)_50%,transparent_100%)]" />

            <div className="p-10">
              <div className="text-center mb-8">
                <h2 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-[#12364A]'}`}>{t('welcomeBack')}</h2>
                <p className={`text-xs mt-1.5 ${isDark ? 'text-white/45' : 'text-[#2B5A75]/70'}`}>{t('loginSubtitle')}</p>
              </div>

              <motion.div
                animate={loginError ? { x: [-8, 8, -8, 8, 0] } : {}}
                transition={{ duration: 0.35 }}
                className="space-y-5"
                onKeyDown={(e) => { if (e.key === 'Enter') handleLogin(); }}
              >
                {/* Username */}
                <div className="space-y-2">
                  <label className={`ml-0.5 text-[10px] font-bold uppercase tracking-[0.18em] ${isDark ? 'text-[#00bceb]/72' : 'text-[rgba(0,114,152,0.88)]'}`}>{t('username')}</label>
                  <div className="relative">
                    <div className={`absolute left-4 top-1/2 -translate-y-1/2 ${isDark ? 'text-white/20' : 'text-[#0A4E70]/45'}`}>
                      <User size={16} />
                    </div>
                    <input
                      type="text"
                      placeholder="admin"
                      autoFocus
                      value={loginForm.username}
                      onChange={(e) => { setLoginForm({ ...loginForm, username: e.target.value }); setLoginError(null); }}
                      className={`w-full rounded-xl border-[1.5px] py-3.5 pl-11 pr-4 text-sm outline-none transition-all ${isDark ? 'text-white placeholder-white/20' : 'text-[#0B2A3C] placeholder-[#49728A]/45'} ${loginError ? 'border-red-500/70' : isDark ? 'border-white/8 bg-white/5 focus:border-[#00bceb]/60 focus:bg-[#00bceb]/6' : 'border-[rgba(0,80,115,0.22)] bg-white/[0.74] focus:border-[rgba(0,166,212,0.88)] focus:bg-white/[0.92]'}`}
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <label className={`ml-0.5 text-[10px] font-bold uppercase tracking-[0.18em] ${isDark ? 'text-[#00bceb]/72' : 'text-[rgba(0,114,152,0.88)]'}`}>{t('password')}</label>
                  <div className="relative">
                    <div className={`absolute left-4 top-1/2 -translate-y-1/2 ${isDark ? 'text-white/20' : 'text-[#0A4E70]/45'}`}>
                      <ShieldCheck size={16} />
                    </div>
                    <input
                      type={showLoginPwd ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={loginForm.password}
                      onChange={(e) => { setLoginForm({ ...loginForm, password: e.target.value }); setLoginError(null); }}
                      className={`w-full rounded-xl border-[1.5px] py-3.5 pl-11 pr-12 text-sm outline-none transition-all ${isDark ? 'text-white placeholder-white/20' : 'text-[#0B2A3C] placeholder-[#49728A]/45'} ${loginError ? 'border-red-500/70' : isDark ? 'border-white/8 bg-white/5 focus:border-[#00bceb]/60 focus:bg-[#00bceb]/6' : 'border-[rgba(0,80,115,0.22)] bg-white/[0.74] focus:border-[rgba(0,166,212,0.88)] focus:bg-white/[0.92]'}`}
                    />
                    <button type="button" onClick={() => setShowLoginPwd(v => !v)} className={`absolute right-4 top-1/2 -translate-y-1/2 transition-colors ${isDark ? 'text-white/25 hover:text-white/60' : 'text-[#0A4E70]/45 hover:text-[#0A4E70]'}`}>
                      {showLoginPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {loginError && (
                  <motion.p
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-xs font-medium text-red-400 flex items-center gap-1.5"
                  >
                    <XCircle size={13} />{loginError}
                  </motion.p>
                )}

                {/* Remember me */}
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-black/20 accent-[#00bceb]"
                  />
                  <span className={`text-xs ${isDark ? 'text-white/40' : 'text-[#2B5A75]/60'}`}>{t('rememberMe')}</span>
                </label>

                {/* Login button */}
                <div className="pt-2">
                  <button
                    onClick={handleLogin}
                    disabled={isAuthenticating}
                    className={`flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-xs font-bold uppercase tracking-[0.18em] text-white transition-all disabled:opacity-50 ${loginError ? 'bg-red-500/80 shadow-[0_0_24px_rgba(239,68,68,0.3)]' : 'bg-[linear-gradient(135deg,#00527a_0%,#00bceb_100%)] shadow-[0_0_32px_rgba(0,188,235,0.25),0_4px_16px_rgba(0,0,0,0.4)]'}`}
                  >
                    {isAuthenticating ? (
                      <><RotateCcw className="animate-spin" size={15} />{t('authenticating')}</>
                    ) : (
                      <>{t('login')}<Play size={13} /></>
                    )}
                  </button>
                </div>
              </motion.div>

              {/* Footer status bar */}
              <div className={`mt-8 pt-6 ${isDark ? 'border-t border-white/6' : 'border-t border-[rgba(0,80,115,0.14)]'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                    <span className={`text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'text-white/25' : 'text-[rgba(9,47,69,0.52)]'}`}>{t('systemOnline')}</span>
                  </div>
                  <span className={`text-[10px] font-mono ${isDark ? 'text-white/15' : 'text-[rgba(9,47,69,0.4)]'}`}>NOC v2.0</span>
                </div>
                <p className={`mt-2 text-center text-[10px] ${isDark ? 'text-white/20' : 'text-[rgba(9,47,69,0.46)]'}`}>
                  {t('copyright')} {new Date().getFullYear()} {t('allRightsReserved')}
                </p>
              </div>
            </div>

            {/* Bottom glow line */}
            <div className="h-px bg-[linear-gradient(90deg,transparent_0%,rgba(0,80,115,0.5)_50%,transparent_100%)]" />
          </div>
        </motion.div>
      </div>
    );
  }

  const previewDiff = () => {
    if (!selectedDevice) return;
    
    const currentConfig = selectedDevice.current_config || 'No configuration available.';
    // Simulate a proposed change by adding a VLAN config
    const proposedConfig = currentConfig + '\n\n! Proposed Change\ninterface Vlan100\n description Added by NetOps\n ip address 10.100.0.1 255.255.255.0\n no shutdown\n!';
    
    setCurrentDiff({
      before: currentConfig,
      after: proposedConfig
    });
    setShowDiff(true);
  };

  const runTask = async (taskName: string) => {
    if (!selectedDevice) return false;
    
    setShowDiff(false);
    setIsTestingConnection(true); // Reuse testing state for loading
    
    try {
      let commandPayload = undefined;
      if (taskName === 'Compliance Audit') {
        commandPayload = 'show version';
      } else if (taskName === 'VLAN Update') {
        commandPayload = 'system-view\nvlan 100\ndescription Added by NetOps\nquit\ninterface Vlan-interface100\nip address 10.100.0.1 255.255.255.0\nquit';
      } else if (taskName === 'Custom Command') {
        commandPayload = customCommand;
      }

      const response = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_id: selectedDevice.id,
          script_id: (taskName === 'VLAN Update' || taskName === 'Compliance Audit' || taskName === 'Custom Command') 
            ? undefined 
            : (selectedScript?.id || selectedAutomationTemplate?.id),
          command: (taskName === 'VLAN Update' || taskName === 'Compliance Audit' || taskName === 'Custom Command') ? commandPayload : editedScriptContent,
          // Custom Command 的 isConfig 由后端按命令内容自动判断，前端不强制设定
          isConfig: taskName === 'VLAN Update'
            ? true
            : taskName === 'Custom Command'
              ? customCommandMode === 'config'
              : (!!selectedScript || !!selectedAutomationTemplate),
          author: currentUser.username || 'admin',
          actor_id: currentUser.id,
          actor_role: currentUser.role || 'Administrator',
        })
      });
      
      const data = await response.json();
      if (response.ok) {
        showToast(`Task "${taskName}" completed on ${selectedDevice.hostname}`, 'success');
        // 执行成功后清空 Custom Command 输入框
        if (taskName === 'Custom Command') setCustomCommand('');
        // Fetch updated jobs
        const jobsRes = await fetch('/api/jobs');
        if (jobsRes.ok) {
          const updatedJobs = await jobsRes.json();
          setJobs(updatedJobs);
          // Automatically show the output of the new job
          const newJob = updatedJobs.find((j: any) => j.id === data.jobId);
          if (newJob) setSelectedJob(newJob);
        }
        return true;
      } else {
        showToast(`Task failed: ${data.error}`, 'error');
        return false;
      }
    } catch (error) {
      showToast(`Execution error: ${error}`, 'error');
      return false;
    } finally {
      setIsTestingConnection(false);
    }
  };

  const formatQuickQueryRawOutput = (payload: any, language: string) => {
    const category = Array.isArray(payload?.categories) ? payload.categories[0] : null;
    if (!category) {
      return language === 'zh' ? '没有返回可展示的数据。' : 'No displayable data returned.';
    }

    if (category?.error) {
      return `Error: ${category.error}`;
    }

    const rawOutputs = Array.isArray(category?.raw_outputs) ? category.raw_outputs : [];
    if (rawOutputs.length > 0) {
      const lines: string[] = [];
      for (const item of rawOutputs) {
        lines.push(`[${item.command}]`);
        lines.push(String(item.output || ''));
        lines.push('');
      }
      return lines.join('\n').trim();
    }

    return language === 'zh' ? '命令已执行，但没有返回原始回显。' : 'Command executed, but no raw output was returned.';
  };

  const sanitizeExportName = (value: string, fallback: string) => {
    const normalized = String(value || fallback)
      .trim()
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    return normalized || fallback;
  };

  const getQuickQueryCommands = (payload: any, fallbackCommands?: string): string[] => {
    const category = Array.isArray(payload?.categories) ? payload.categories[0] : null;
    const payloadCommands = Array.isArray(category?.commands)
      ? category.commands.map((command: any) => String(command || '').trim()).filter(Boolean)
      : [];
    if (payloadCommands.length > 0) {
      return payloadCommands;
    }
    return String(fallbackCommands || '')
      .split('\n')
      .map((command) => command.trim())
      .filter(Boolean);
  };

  const getQuickQueryStructuredTable = (payload: any): {
    category: any;
    records: Record<string, any>[];
    columns: string[];
  } => {
    const category = Array.isArray(payload?.categories) ? payload.categories[0] : null;
    const records: Record<string, any>[] = Array.isArray(category?.records) ? category.records : [];
    const columnSet = new Set<string>();
    records.forEach((item) => {
      Object.keys(item || {}).forEach((key) => columnSet.add(key));
    });
    const columns: string[] = Array.from(columnSet.values());
    return { category, records, columns };
  };

  const quickQueryTable = getQuickQueryStructuredTable(quickQueryStructured);

  const exportQuickQueryTable = (commands: string[]) => {
    if (!quickQueryTable.records.length) {
      showToast(language === 'zh' ? '当前没有可导出的表格记录' : 'No structured records to export', 'error');
      return;
    }

    const dataSheet = XLSX.utils.json_to_sheet(quickQueryTable.records, { header: quickQueryTable.columns });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, dataSheet, 'Data');

    const metaRows = [
      { key: language === 'zh' ? '查询名称' : 'Query', value: quickQueryLabel },
      { key: language === 'zh' ? '设备' : 'Device', value: quickQueryStructured?.device?.hostname || '' },
      { key: language === 'zh' ? '平台' : 'Platform', value: quickQueryStructured?.device?.platform || '' },
      { key: language === 'zh' ? '采集时间' : 'Collected At', value: quickQueryStructured?.collected_at || '' },
      { key: language === 'zh' ? '解析器' : 'Parser', value: quickQueryTable.category?.parser || 'ntc-templates' },
      { key: language === 'zh' ? '记录数' : 'Records', value: String(quickQueryTable.records.length) },
      { key: language === 'zh' ? '实际执行命令' : 'Executed Commands', value: commands.join('\n') },
    ];
    const metaSheet = XLSX.utils.json_to_sheet(metaRows);
    XLSX.utils.book_append_sheet(workbook, metaSheet, 'Meta');

    const deviceName = sanitizeExportName(quickQueryStructured?.device?.hostname || 'device', 'device');
    const queryName = sanitizeExportName(quickQueryLabel || 'quick-query', 'quick-query');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    XLSX.writeFile(workbook, `${deviceName}_${queryName}_${timestamp}.xlsx`);
    showToast(language === 'zh' ? '已导出 Excel' : 'Excel exported', 'success');
  };

  // Quick query — read-only command, no history saved
  const runQuickQuery = async (label: string, commands: string, operationalCategory?: string) => {
    const device = selectedDevice || (batchMode && batchDeviceIds.length === 1 ? devices.find(d => d.id === batchDeviceIds[0]) : null);
    if (!device) {
      showToast(language === 'zh' ? '请先选择一台设备' : 'Select a device first', 'error');
      return;
    }
    const fallbackCommands = commands
      .split('\n')
      .map((command) => command.trim())
      .filter(Boolean);
    setQuickQueryLabel(label);
    setQuickQueryOutput('');
    setQuickQueryStructured(null);
    setQuickQueryView('terminal');
    setQuickQueryCommands(fallbackCommands);
    setQuickQueryRunning(true);
    try {
      if (operationalCategory) {
        const resp = await fetch(`/api/devices/${device.id}/operational-data`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ categories: [operationalCategory] }),
        });
        const data = await resp.json();
        if (resp.ok) {
          const firstCategory = Array.isArray(data?.categories) ? data.categories[0] : null;
          const hasStructuredRecords = Array.isArray(firstCategory?.records) && firstCategory.records.length > 0;
          setQuickQueryCommands(getQuickQueryCommands(data, commands));
          setQuickQueryStructured(data);
          setQuickQueryOutput(formatQuickQueryRawOutput(data, language));
          setQuickQueryView(hasStructuredRecords ? 'table' : 'terminal');
        } else {
          setQuickQueryOutput(`Error: ${data.detail || data.error || 'Unknown error'}`);
        }
        return;
      }

      const resp = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_id: device.id,
          command: commands,
          isConfig: false,
          save_history: false,
          author: currentUser.username || 'admin',
          actor_id: currentUser.id,
          actor_role: currentUser.role || 'Administrator',
        }),
      });
      const data = await resp.json();
      if (resp.ok) {
        setQuickQueryStructured(null);
        setQuickQueryOutput(data.output || 'No output');
      } else {
        setQuickQueryOutput(`Error: ${data.error || data.detail || 'Unknown error'}`);
      }
    } catch (e: any) {
      setQuickQueryOutput(`Error: ${e.message || e}`);
    } finally {
      setQuickQueryRunning(false);
    }
  };

  const runParsedCustomCommand = async (label: string, command: string) => {
    const device = selectedDevice || (batchMode && batchDeviceIds.length === 1 ? devices.find((item) => item.id === batchDeviceIds[0]) : null);
    if (!device) {
      showToast(language === 'zh' ? '请先选择一台设备' : 'Select a device first', 'error');
      return false;
    }

    const commandList = command
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);

    setQuickQueryLabel(label);
    setQuickQueryOutput('');
    setQuickQueryStructured(null);
    setQuickQueryView('terminal');
    setQuickQueryCommands(commandList);
    setQuickQueryRunning(true);

    try {
      const resp = await fetch(`/api/devices/${device.id}/parsed-command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        showToast(data.detail || data.error || (language === 'zh' ? '执行失败' : 'Execution failed'), 'error');
        return false;
      }

      const firstCategory = Array.isArray(data?.categories) ? data.categories[0] : null;
      const hasStructuredRecords = Array.isArray(firstCategory?.records) && firstCategory.records.length > 0;
      setQuickQueryCommands(getQuickQueryCommands(data, command));
      setQuickQueryStructured(data);
      setQuickQueryOutput(formatQuickQueryRawOutput(data, language));
      setQuickQueryView(hasStructuredRecords ? 'table' : 'terminal');
      return true;
    } catch (error: any) {
      showToast(error?.message || String(error), 'error');
      return false;
    } finally {
      setQuickQueryRunning(false);
    }
  };

  const rollback = (jobId: string) => {
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: 'rolled_back' } : j));
  };

  // ---------- Batch execution ----------
  const runBatchTask = async (taskName: string) => {
    const targets = devices.filter(d => batchDeviceIds.includes(d.id));
    if (targets.length === 0) return false;
    setIsBatchRunning(true);
    setBatchResults(targets.map(d => ({ deviceId: d.id, hostname: d.hostname, status: 'pending' })));
    let failedCount = 0;

    for (const device of targets) {
      setBatchResults(prev => prev.map(r => r.deviceId === device.id ? { ...r, status: 'running' } : r));
      try {
        let commandPayload: string | undefined;
        if (taskName === 'Custom Command') commandPayload = applyScriptVars(customCommand);
        else if (taskName === 'Compliance Audit') commandPayload = 'show version';
        else commandPayload = applyScriptVars(editedScriptContent);

        if (dryRun) {
          await new Promise(r => setTimeout(r, 500));
          setBatchResults(prev => prev.map(r => r.deviceId === device.id
            ? { ...r, status: 'success', output: `[DRY-RUN] Would execute on ${device.hostname}:\n${commandPayload}` }
            : r));
          continue;
        }

        const resp = await fetch('/api/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            device_id: device.id,
            command: commandPayload,
            isConfig: taskName === 'Custom Command'
              ? customCommandMode === 'config'
              : taskName !== 'Compliance Audit',
            author: currentUser.username || 'admin',
            actor_id: currentUser.id,
            actor_role: currentUser.role || 'Administrator',
          })
        });
        const data = await resp.json();
        if (!resp.ok) failedCount += 1;
        setBatchResults(prev => prev.map(r => r.deviceId === device.id
          ? { ...r, status: resp.ok ? 'success' : 'failed', output: data.output || data.error }
          : r));
      } catch (e) {
        failedCount += 1;
        setBatchResults(prev => prev.map(r => r.deviceId === device.id
          ? { ...r, status: 'failed', output: String(e) }
          : r));
      }
    }
    const jobsRes = await fetch('/api/jobs');
    if (jobsRes.ok) setJobs(await jobsRes.json());
    setIsBatchRunning(false);
    if (failedCount > 0) {
      showToast(`Batch task "${taskName}" finished with ${failedCount} failure(s)`, 'error');
      return false;
    }
    showToast(`Batch task "${taskName}" completed on ${targets.length} devices`, 'success');
    return true;
  };

  // Apply {{VAR}} substitution to a command/script string
  function applyScriptVars(text: string) {
    return text.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, key) => scriptVars[key] ?? `{{${key}}}`);
  }

  // Extract variable names from {{VAR}} in a given text
  function extractVars(text: string): string[] {
    const matches = [...text.matchAll(/\{\{\s*([\w.-]+)\s*\}\}/g)];
    return [...new Set(matches.map(m => m[1]))];
  }

  // Save / remove a command favorite
  const saveFavorite = (cmd: string) => {
    if (!cmd.trim()) return;
    const updated = commandFavorites.includes(cmd) ? commandFavorites.filter(c => c !== cmd) : [cmd, ...commandFavorites].slice(0, 20);
    setCommandFavorites(updated);
    localStorage.setItem('cmdFavorites', JSON.stringify(updated));
  };

  const isFavorited = (cmd: string) => commandFavorites.includes(cmd);

  const closeCustomCommandModal = () => {
    setShowCustomCommandModal(false);
    setShowFavorites(false);
  };

  const submitCustomCommand = async () => {
    const resolvedCommand = applyScriptVars(customCommand).trim();
    if (!resolvedCommand) {
      showToast(language === 'zh' ? '请先输入命令内容' : 'Enter command content first', 'error');
      return;
    }

    const missingVars = customCommandVars.filter((key) => !String(scriptVars[key] ?? '').trim());
    if (missingVars.length > 0) {
      showToast(
        language === 'zh'
          ? `请先填写变量: ${missingVars.join('、')}`
          : `Fill variable values first: ${missingVars.join(', ')}`,
        'error'
      );
      return;
    }

    if (batchMode) {
      if (batchDeviceIds.length === 0) {
        showToast(language === 'zh' ? '请先选择目标设备' : 'Select target devices first', 'error');
        return;
      }
      const ok = await runBatchTask('Custom Command');
      if (ok) closeCustomCommandModal();
      return;
    }

    if (!selectedDevice) {
      showToast(language === 'zh' ? '请先选择目标设备' : 'Select a target device first', 'error');
      return;
    }

    if (customCommandMode === 'query') {
      const ok = await runParsedCustomCommand(language === 'zh' ? '自定义查询' : 'Custom Query', resolvedCommand);
      if (ok) closeCustomCommandModal();
      return;
    }

    const ok = await runTask('Custom Command');
    if (ok) closeCustomCommandModal();
  };

  // ---------- Config Center helpers ----------
  const takeConfigSnapshot = async (device: Device, trigger: ConfigSnapshot['trigger'] = 'manual') => {
    setIsTakingSnapshot(true);
    try {
      // Step 1: fetch live config from device
      let configContent = '% No configuration returned';
      try {
        const _p = (device.platform || '').toLowerCase();
        const _cmd = (_p.includes('cisco') || _p.includes('arista') || _p.includes('rgos'))
          ? 'show running-config'
          : (_p.includes('juniper') || _p.includes('junos'))
            ? 'show configuration'
            : 'display current-configuration';
        const execResp = await fetch('/api/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            device_id: device.id,
            command: _cmd,
            isConfig: false,
            author: currentUser.username || 'admin',
            actor_id: currentUser.id,
            actor_role: currentUser.role || currentUserRecord?.role || 'Administrator',
          })
        });
        if (execResp.ok) {
          const execData = await execResp.json();
          configContent = execData.output || device.current_config || '% No configuration returned';
        } else {
          configContent = device.current_config || '% No configuration available (device offline)';
        }
      } catch {
        configContent = device.current_config || '% Device unreachable';
      }

      // Step 2: persist to backend (filesystem + SQLite)
      const saveResp = await fetch('/api/configs/snapshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_id: device.id,
          hostname: device.hostname,
          vendor: getVendorFromPlatform(device.platform),
          content: configContent,
          trigger,
          author: currentUser.username || 'admin',
          actor_id: currentUser.id,
          actor_role: currentUser.role || currentUserRecord?.role || 'Administrator',
        })
      });
      if (saveResp.ok) {
        const snap = await saveResp.json() as ConfigSnapshot;
        // Attach content for immediate display (not returned by list endpoint)
        snap.content = configContent;
        setConfigSnapshots(prev => [snap, ...prev]);
        showToast(`${t('snapshotSaved')} ${device.hostname}`, 'success');
        return snap;
      } else {
        showToast('Failed to persist snapshot', 'error');
      }
    } catch {
      showToast('Snapshot failed', 'error');
    } finally {
      setIsTakingSnapshot(false);
    }
    return null;
  };

  // Load content for a snapshot (lazy, from backend)
  const loadSnapshotContent = async (snap: ConfigSnapshot): Promise<string> => {
    if (snap.content) return snap.content;
    try {
      const resp = await fetch(`/api/configs/snapshots/${snap.id}/content`);
      if (resp.ok) {
        const data = await resp.json();
        return data.content as string;
      }
    } catch { /* ignore */ }
    return '';
  };

  const getSnapshotCompareKey = (snap: ConfigSnapshot | null): string => {
    if (!snap) return '';
    const ip = (snap.ip_address || '').trim();
    if (ip) return `ip:${ip}`;
    // Fallback for historical records without IP metadata.
    return `device:${snap.device_id}`;
  };

  const sameTargetSnapshots = (() => {
    const leftKey = getSnapshotCompareKey(configDiffLeft);
    if (!leftKey) return [] as ConfigSnapshot[];
    return configSnapshots.filter((snap) => {
      if (configDiffLeft && snap.id === configDiffLeft.id) return false;
      return getSnapshotCompareKey(snap) === leftKey;
    });
  })();

  // Delete a snapshot
  const deleteSnapshot = async (snapId: string) => {
    try {
      const resp = await fetch(`/api/configs/snapshots/${snapId}`, { method: 'DELETE' });
      if (resp.ok) {
        setConfigSnapshots(prev => prev.filter(s => s.id !== snapId));
        showToast(t('snapshotDeleted'), 'success');
      }
    } catch { /* ignore */ }
  };

  // Save schedule config
  const saveScheduleConfig = async () => {
    setScheduleLoading(true);
    try {
      const resp = await fetch('/api/configs/schedule', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: scheduleEnabled, hour: scheduleHour, minute: scheduleMinute })
      });
      if (resp.ok) showToast(t('scheduleUpdated'), 'success');
    } catch { /* ignore */ }
    finally { setScheduleLoading(false); }
  };



  // Simple unified diff — returns DiffLine[]
  const computeDiff = (oldText: string, newText: string): DiffLine[] => {
    const oldLines = oldText.replace(/\r\n/g, '\n').split('\n');
    const newLines = newText.replace(/\r\n/g, '\n').split('\n');
    const m = oldLines.length;
    const n = newLines.length;

    // LCS dynamic programming — O(m*n) correctness, handles any offset
    const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (oldLines[i - 1] === newLines[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    // Backtrack through dp table to reconstruct edit operations
    const ops: Array<{ type: 'context' | 'add' | 'remove'; oi?: number; ni?: number }> = [];
    let i = m, j = n;
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
        ops.push({ type: 'context', oi: i - 1, ni: j - 1 });
        i--; j--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        ops.push({ type: 'add', ni: j - 1 });
        j--;
      } else {
        ops.push({ type: 'remove', oi: i - 1 });
        i--;
      }
    }
    ops.reverse();

    return ops.map(op => {
      if (op.type === 'context') return { type: 'context', lineA: op.oi! + 1, lineB: op.ni! + 1, content: oldLines[op.oi!] };
      if (op.type === 'add')     return { type: 'add',     lineB: op.ni! + 1, content: newLines[op.ni!] };
      return                            { type: 'remove',  lineA: op.oi! + 1, content: oldLines[op.oi!] };
    });
  };

  const activeDiffLines: DiffLine[] = configDiffLeft && configDiffRight
    ? computeDiff(configDiffLeft.content || '', configDiffRight.content || '')
    : [];

  const activeChangeLineIndexes: number[] = [];
  activeDiffLines.forEach((line, idx) => {
    if (line.type !== 'context') activeChangeLineIndexes.push(idx);
  });

  const renderedDiffLines = activeDiffLines
    .map((line, originalIndex) => ({ line, originalIndex }))
    .filter((entry) => (diffOnlyChanges ? entry.line.type !== 'context' : true));

  const fullSideBySideRows = activeDiffLines
    .map((line, originalIndex) => {
      if (line.type === 'context') {
        return {
          originalIndex,
          rowType: 'context' as const,
          leftLine: line.lineA || null,
          rightLine: line.lineB || null,
          leftContent: line.content,
          rightContent: line.content,
        };
      }

      if (line.type === 'remove') {
        return {
          originalIndex,
          rowType: 'remove' as const,
          leftLine: line.lineA || null,
          rightLine: null,
          leftContent: line.content,
          rightContent: '',
        };
      }

      return {
        originalIndex,
        rowType: 'add' as const,
        leftLine: null,
        rightLine: line.lineB || null,
        leftContent: '',
        rightContent: line.content,
      };
    })
    .filter((row) => (diffOnlyChanges ? row.rowType !== 'context' : true));

  const diffChangeBlocks: Array<{ startChangeIdx: number; endChangeIdx: number; label: string; searchText: string }> = [];
  if (activeChangeLineIndexes.length > 0) {
    let blockStart = 0;
    for (let i = 1; i < activeChangeLineIndexes.length; i++) {
      const prevLineIndex = activeChangeLineIndexes[i - 1];
      const currentLineIndex = activeChangeLineIndexes[i];
      if (currentLineIndex - prevLineIndex > 8) {
        const startLine = activeDiffLines[activeChangeLineIndexes[blockStart]];
        const labelBase = (startLine?.content || '').trim();
        const searchText = activeChangeLineIndexes
          .slice(blockStart, i)
          .map((idx) => activeDiffLines[idx]?.content || '')
          .join(' ')
          .toLowerCase();
        diffChangeBlocks.push({
          startChangeIdx: blockStart,
          endChangeIdx: i - 1,
          label: labelBase.length > 42 ? `${labelBase.slice(0, 42)}...` : (labelBase || (language === 'zh' ? '变更片段' : 'Change block')),
          searchText,
        });
        blockStart = i;
      }
    }

    const lastLine = activeDiffLines[activeChangeLineIndexes[blockStart]];
    const lastLabelBase = (lastLine?.content || '').trim();
    const lastSearchText = activeChangeLineIndexes
      .slice(blockStart)
      .map((idx) => activeDiffLines[idx]?.content || '')
      .join(' ')
      .toLowerCase();
    diffChangeBlocks.push({
      startChangeIdx: blockStart,
      endChangeIdx: activeChangeLineIndexes.length - 1,
      label: lastLabelBase.length > 42 ? `${lastLabelBase.slice(0, 42)}...` : (lastLabelBase || (language === 'zh' ? '变更片段' : 'Change block')),
      searchText: lastSearchText,
    });
  }

  const q = diffBlockQuery.trim().toLowerCase();
  const filteredDiffChangeBlocks = q
    ? diffChangeBlocks.filter((block) => block.label.toLowerCase().includes(q) || block.searchText.includes(q))
    : diffChangeBlocks;

  const focusDiffChangeAt = (changeIdx: number) => {
    if (activeChangeLineIndexes.length === 0) return;
    const safeIdx = Math.max(0, Math.min(changeIdx, activeChangeLineIndexes.length - 1));
    const targetLine = activeChangeLineIndexes[safeIdx];
    setDiffFocusChangeIdx(safeIdx);
    window.requestAnimationFrame(() => {
      diffLineRefs.current[targetLine]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };

  const jumpToDiff = (direction: 'prev' | 'next') => {
    const total = activeChangeLineIndexes.length;
    if (total === 0) return;

    setDiffFocusChangeIdx((prev) => {
      const next = direction === 'next'
        ? (prev + 1) % total
        : (prev - 1 + total) % total;
      const targetLine = activeChangeLineIndexes[next];
      window.requestAnimationFrame(() => {
        diffLineRefs.current[targetLine]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      return next;
    });
  };

  // Pagination imported from ./components/Pagination

  // CSS constants and badge helpers imported from ./components/shared

  const lazyPanelFallback = (
    <div className="flex min-h-[240px] items-center justify-center rounded-2xl border border-black/5 bg-white/70 text-sm text-black/40">
      {language === 'zh' ? '加载中...' : 'Loading...'}
    </div>
  );

  return (
    <AppRuntimeBoundary language={language}>
      <div className="app-shell flex h-screen text-[#141414] font-sans overflow-hidden">
      {/* Mobile sidebar backdrop */}
      {isMobile && !sidebarCollapsed && (
        <div className="fixed inset-0 z-[25] bg-black/50 md:hidden" onClick={() => setSidebarCollapsed(true)} />
      )}
      {/* Sidebar */}
      <aside className={`theme-sidebar flex flex-col shadow-2xl transition-all duration-300 ease-in-out ${
        isMobile
          ? `fixed inset-y-0 left-0 w-64 z-30 ${sidebarCollapsed ? '-translate-x-full' : 'translate-x-0'}`
          : `z-20 ${sidebarCollapsed ? 'w-0 min-w-0 overflow-hidden opacity-0' : 'w-64'}`
      }`}>
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#00bceb] rounded-lg flex items-center justify-center text-white shadow-lg shadow-[#00bceb]/20">
              <Activity size={18} />
            </div>
            <h1 className="font-bold tracking-tight text-white whitespace-nowrap">NetPilot</h1>
          </div>
          <button
            onClick={() => setSidebarCollapsed(true)}
            title={language === 'zh' ? '收起侧栏' : 'Collapse sidebar'}
            className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-all"
          >
            <PanelLeftClose size={16} />
          </button>
        </div>

        <nav className="sidebar-nav-scroll flex flex-col flex-1 p-4 space-y-0.5 mt-2 overflow-y-auto">
          {/* ── Section: 感知层 / Awareness ── */}
          <div className="order-[5] px-3 pt-1 pb-2">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/25">{language === 'zh' ? '感知层' : 'AWARENESS'}</p>
          </div>

          <button
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all order-10 ${
              activeTab === 'dashboard'
                ? 'bg-[#00bceb] text-white shadow-lg shadow-[#00bceb]/20'
                : 'text-white/60 hover:bg-white/5 hover:text-white'
            }`}
          >
            <LayoutDashboard size={17} className="shrink-0" />
            <span className="min-w-0 flex-1 text-left truncate whitespace-nowrap">{t('dashboard')}</span>
          </button>

          {/* ── Monitoring collapsible group ── */}
          <div className="order-20">
            <button
              onClick={() => {
                const next = !monitoringGroupOpen;
                setMonitoringGroupOpen(next);
                if (next && activeTab !== 'monitoring' && location.pathname !== '/inventory/interfaces') {
                  setActiveTab('monitoring');
                }
              }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all group ${
                activeTab === 'monitoring' || location.pathname === '/inventory/interfaces'
                  ? 'text-white'
                  : 'text-white/60 hover:bg-white/5 hover:text-white'
              }`}
            >
              <TrendingUp size={17} className={activeTab === 'monitoring' || location.pathname === '/inventory/interfaces' ? 'text-[#00bceb]' : ''} />
              <span className="flex-1 text-left">{language === 'zh' ? '监控中心' : 'Monitoring'}</span>
              <span className={`shrink-0 whitespace-nowrap rounded-full border px-2 py-1 text-[9px] font-bold uppercase tracking-[0.14em] mr-1 ${hostResourceTone}`} title={hostResourceSummary}>
                {hostResources
                  ? (language === 'zh'
                    ? `${formatCompactResourcePercent(hostResources.cpu_percent)}/${formatCompactResourcePercent(hostResources.memory_percent)}`
                    : `${formatCompactResourcePercent(hostResources.cpu_percent)}/${formatCompactResourcePercent(hostResources.memory_percent)}`)
                  : '--/--'}
              </span>
              <ChevronRight
                size={14}
                className={`text-white/30 transition-transform duration-200 ${
                  monitoringGroupOpen ? 'rotate-90' : ''
                }`}
              />
            </button>
            <div className={`overflow-hidden transition-all duration-200 ease-in-out ${
              monitoringGroupOpen ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'
            }`}>
              <div className="pl-3 pr-1 pt-0.5 pb-1 space-y-0.5">
                {([
                  { id: 'monitoring', path: null, icon: Monitor, label: language === 'zh' ? '平台资源' : 'Host Resources' },
                  { id: 'inventory-interfaces', path: '/inventory/interfaces', icon: Activity, label: t('interfaceMonitoring') },
                ] as const).map(item => {
                  const isActive = item.path ? location.pathname === item.path : activeTab === 'monitoring';
                  return (
                    <button
                      key={item.id}
                      onClick={() => item.path ? navTo(item.path) : setActiveTab('monitoring')}
                      className={`w-full flex items-center gap-2.5 pl-5 pr-3 py-2 rounded-lg text-sm transition-all ${
                        isActive
                          ? 'bg-[#00bceb]/15 text-[#00bceb] font-semibold'
                          : 'text-white/40 hover:bg-white/5 hover:text-white/80 font-medium'
                      }`}
                    >
                      {isActive && <span className="w-1 h-1 rounded-full bg-[#00bceb] flex-shrink-0" />}
                      {!isActive && <span className="w-1 h-1 flex-shrink-0" />}
                      <item.icon size={14} />
                      <span className="text-[13px]">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="order-30">
            <button
              onClick={() => {
                const next = !alertGroupOpen;
                setAlertGroupOpen(next);
                if (next && !['alerts', 'alert-rules', 'maintenance'].includes(activeTab)) {
                  setActiveTab('alerts');
                }
              }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all group ${
                ['alerts', 'alert-rules', 'maintenance'].includes(activeTab)
                  ? 'text-white'
                  : 'text-white/60 hover:bg-white/5 hover:text-white'
              }`}
            >
              <AlertTriangle size={17} className={['alerts', 'alert-rules', 'maintenance'].includes(activeTab) ? 'text-[#00bceb]' : ''} />
              <span className="flex-1 text-left">{language === 'zh' ? '告警中心' : 'Alert Center'}</span>
              <ChevronRight
                size={14}
                className={`text-white/30 transition-transform duration-200 ${
                  alertGroupOpen ? 'rotate-90' : ''
                }`}
              />
            </button>
            <div className={`overflow-hidden transition-all duration-200 ease-in-out ${
              alertGroupOpen ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'
            }`}>
              <div className="pl-3 pr-1 pt-0.5 pb-1 space-y-0.5">
                {([
                  { id: 'alerts', icon: AlertTriangle, label: language === 'zh' ? '告警信息' : 'Alert Desk' },
                  { id: 'alert-rules', icon: Settings, label: language === 'zh' ? '告警规则' : 'Alert Rules' },
                  { id: 'maintenance', icon: Wrench, label: language === 'zh' ? '维护期' : 'Maintenance' },
                ] as const).map(item => {
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={`w-full flex items-center gap-2.5 pl-5 pr-3 py-2 rounded-lg text-sm transition-all ${
                        isActive
                          ? 'bg-[#00bceb]/15 text-[#00bceb] font-semibold'
                          : 'text-white/40 hover:bg-white/5 hover:text-white/80 font-medium'
                      }`}
                    >
                      {isActive && <span className="w-1 h-1 rounded-full bg-[#00bceb] flex-shrink-0" />}
                      {!isActive && <span className="w-1 h-1 flex-shrink-0" />}
                      <item.icon size={14} />
                      <span className="text-[13px]">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {[
            { id: 'topology', icon: Globe, label: 'Topology' },
            { id: 'health', icon: Activity, label: language === 'zh' ? '健康检测' : 'Health Detection' },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === item.id
                  ? 'bg-[#00bceb] text-white shadow-lg shadow-[#00bceb]/20'
                  : 'text-white/60 hover:bg-white/5 hover:text-white'
              } ${item.id === 'topology' ? 'order-[45]' : 'order-[50]'}`}
            >
              <item.icon size={17} className="shrink-0" />
              <span className="min-w-0 flex-1 text-left truncate whitespace-nowrap">{item.label}</span>
            </button>
          ))}

          {/* ── Section: 资产层 / Assets ── */}
          <div className="order-[55] px-3 pt-4 pb-2">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/25">{language === 'zh' ? '资产层' : 'ASSETS'}</p>
          </div>

          <button
            onClick={() => setActiveTab('ipam')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all order-[57] ${
              activeTab === 'ipam'
                ? 'bg-[#00bceb] text-white shadow-lg shadow-[#00bceb]/20'
                : 'text-white/60 hover:bg-white/5 hover:text-white'
            }`}
          >
            <Network size={17} className="shrink-0" />
            <span className="min-w-0 flex-1 text-left truncate whitespace-nowrap">{language === 'zh' ? 'IP/VLAN管理' : 'IP/VLAN Mgmt'}</span>
          </button>

          {/* ── Inventory (devices only) ── */}
          <div className="order-60">
            <button
              onClick={() => {
                const next = !inventoryGroupOpen;
                setInventoryGroupOpen(next);
                if (next && !location.pathname.startsWith('/inventory')) navTo('/inventory/devices');
              }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all group ${
                activeTab === 'inventory'
                  ? 'text-white'
                  : 'text-white/60 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Database size={17} className={activeTab === 'inventory' ? 'text-[#00bceb]' : ''} />
              <span className="flex-1 text-left">{t('inventory')}</span>
              <ChevronRight
                size={14}
                className={`text-white/30 transition-transform duration-200 ${
                  inventoryGroupOpen ? 'rotate-90' : ''
                }`}
              />
            </button>
            <div className={`overflow-hidden transition-all duration-200 ease-in-out ${
              inventoryGroupOpen ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'
            }`}>
              <div className="pl-3 pr-1 pt-0.5 pb-1 space-y-0.5">
                {([
                  { path: 'inventory/devices',    icon: Server,   label: t('deviceList') },
                ] as const).map(item => {
                  const isActive = location.pathname === `/${item.path}`;
                  return (
                    <button
                      key={item.path}
                      onClick={() => navTo(`/${item.path}`)}
                      className={`w-full flex items-center gap-2.5 pl-5 pr-3 py-2 rounded-lg text-sm transition-all ${
                        isActive
                          ? 'bg-[#00bceb]/15 text-[#00bceb] font-semibold'
                          : 'text-white/40 hover:bg-white/5 hover:text-white/80 font-medium'
                      }`}
                    >
                      {isActive && <span className="w-1 h-1 rounded-full bg-[#00bceb] flex-shrink-0" />}
                      {!isActive && <span className="w-1 h-1 flex-shrink-0" />}
                      <item.icon size={14} />
                      <span className="text-[13px]">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Section: 操作层 / Operations ── */}
          <div className="order-[75] px-3 pt-4 pb-2">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/25">{language === 'zh' ? '操作层' : 'OPERATIONS'}</p>
          </div>

          {/* ── Automation collapsible group ── */}
          <div className="order-80">
            <button
              onClick={() => {
                const next = !automationGroupOpen;
                setAutomationGroupOpen(next);
                if (next && !location.pathname.startsWith('/automation')) navTo('/automation/execute');
              }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all group ${
                activeTab === 'automation'
                  ? 'text-white'
                  : 'text-white/60 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Zap size={17} className={activeTab === 'automation' ? 'text-[#00bceb]' : ''} />
              <span className="flex-1 text-left">{t('automation')}</span>
              <ChevronRight
                size={14}
                className={`text-white/30 transition-transform duration-200 ${
                  automationGroupOpen ? 'rotate-90' : ''
                }`}
              />
            </button>
            <div className={`overflow-hidden transition-all duration-200 ease-in-out ${
              automationGroupOpen ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'
            }`}>
              <div className="pl-3 pr-1 pt-0.5 pb-1 space-y-0.5">
                {([
                  { path: 'automation/execute',   icon: Zap,        label: t('directExecution') },
                  { path: 'automation/scenarios', icon: FolderOpen, label: t('scenarioLibrary') },
                  { path: 'automation/history',   icon: History,   label: t('executionHistory') },
                ] as const).map(item => {
                  const isActive = location.pathname === `/${item.path}`;
                  return (
                    <button
                      key={item.path}
                      onClick={() => navTo(`/${item.path}`)}
                      className={`w-full flex items-center gap-2.5 pl-5 pr-3 py-2 rounded-lg text-sm transition-all ${
                        isActive
                          ? 'bg-[#00bceb]/15 text-[#00bceb] font-semibold'
                          : 'text-white/40 hover:bg-white/5 hover:text-white/80 font-medium'
                      }`}
                    >
                      {isActive && <span className="w-1 h-1 rounded-full bg-[#00bceb] flex-shrink-0" />}
                      {!isActive && <span className="w-1 h-1 flex-shrink-0" />}
                      <item.icon size={14} />
                      <span className="text-[13px]">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Config Center collapsible group ── */}
          <div className="order-70">
            <button
              onClick={() => {
                const next = !configGroupOpen;
                setConfigGroupOpen(next);
                if (next && !location.pathname.startsWith('/config')) navTo('/config/backup');
              }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all group ${
                activeTab === 'config'
                  ? 'text-white'
                  : 'text-white/60 hover:bg-white/5 hover:text-white'
              }`}
            >
              <FolderOpen size={17} className={activeTab === 'config' ? 'text-[#00bceb]' : ''} />
              <span className="flex-1 text-left">{t('configCenter')}</span>
              <ChevronRight
                size={14}
                className={`text-white/30 transition-transform duration-200 ${
                  configGroupOpen ? 'rotate-90' : ''
                }`}
              />
            </button>

            {/* Sub-items — animated expand/collapse */}
            <div className={`overflow-hidden transition-all duration-200 ease-in-out ${
              configGroupOpen ? 'max-h-64 opacity-100' : 'max-h-0 opacity-0'
            }`}>
              <div className="pl-3 pr-1 pt-0.5 pb-1 space-y-0.5">
                {([
                  { path: 'config/backup',   icon: Download,  label: t('backupHistory') },
                  { path: 'config/diff',     icon: FileText,  label: t('diffCompare') },
                  { path: 'config/search',   icon: Search,    label: t('configSearchTab') },
                  { path: 'config/schedule', icon: Clock,     label: t('scheduledBackup') },
                  { path: 'config/drift',    icon: GitCompareArrows, label: language === 'zh' ? '配置漂移' : 'Config Drift' },
                ] as const).map(item => {
                  const isActive = location.pathname === `/${item.path}`;
                  return (
                    <button
                      key={item.path}
                      onClick={() => navTo(`/${item.path}`)}
                      className={`w-full flex items-center gap-2.5 pl-5 pr-3 py-2 rounded-lg text-sm transition-all ${
                        isActive
                          ? 'bg-[#00bceb]/15 text-[#00bceb] font-semibold'
                          : 'text-white/40 hover:bg-white/5 hover:text-white/80 font-medium'
                      }`}
                    >
                      {isActive && <span className="w-1 h-1 rounded-full bg-[#00bceb] flex-shrink-0" />}
                      {!isActive && <span className="w-1 h-1 flex-shrink-0" />}
                      <item.icon size={14} />
                      <span className="text-[13px]">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <button
            onClick={() => setActiveTab('compliance')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all order-[88] ${
              activeTab === 'compliance'
                ? 'bg-[#00bceb] text-white shadow-lg shadow-[#00bceb]/20'
                : 'text-white/60 hover:bg-white/5 hover:text-white'
            }`}
          >
            <ShieldCheck size={17} className="shrink-0" />
            <span className="min-w-0 flex-1 text-left truncate whitespace-nowrap">{t('compliance')}</span>
          </button>

          <button
            onClick={() => setActiveTab('capacity')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all order-[90] ${
              activeTab === 'capacity'
                ? 'bg-[#00bceb] text-white shadow-lg shadow-[#00bceb]/20'
                : 'text-white/60 hover:bg-white/5 hover:text-white'
            }`}
          >
            <Cpu size={17} className="shrink-0" />
            <span className="min-w-0 flex-1 text-left truncate whitespace-nowrap">{language === 'zh' ? '容量规划' : 'Capacity'}</span>
          </button>

          {/* ── Section: 管理层 / Management ── */}
          <div className="order-[95] px-3 pt-4 pb-2">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/25">{language === 'zh' ? '管理层' : 'MANAGEMENT'}</p>
          </div>

          {[
            { id: 'history',       icon: History,      label: t('auditLogs') },
            { id: 'reports',       icon: BarChart3,    label: language === 'zh' ? '报表中心' : 'Reports' },
            { id: 'configuration', icon: Settings,    label: t('configuration') },
            { id: 'users',         icon: User,        label: t('userManagement') },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === item.id
                  ? 'bg-[#00bceb] text-white shadow-lg shadow-[#00bceb]/20'
                  : 'text-white/60 hover:bg-white/5 hover:text-white'
              } ${item.id === 'history' ? 'order-[100]' : item.id === 'reports' ? 'order-[105]' : item.id === 'configuration' ? 'order-[110]' : 'order-[120]'}`}
            >
              <item.icon size={17} className="shrink-0" />
              <span className="min-w-0 flex-1 text-left truncate whitespace-nowrap">{item.label}</span>
            </button>
          ))}
        </nav>

      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="theme-header h-14 md:h-16 shadow-sm px-3 md:px-8 flex items-center justify-between z-10">
          <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
            <button
              onClick={() => setSidebarCollapsed(v => !v)}
              title={language === 'zh' ? (sidebarCollapsed ? '展开侧栏' : '收起侧栏') : (sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar')}
              className={`p-2 rounded-lg transition-all ${resolvedTheme === 'dark' ? 'text-white/55 hover:text-white hover:bg-white/10' : 'text-black/45 hover:text-black hover:bg-black/5'}`}
            >
              <Menu size={20} />
            </button>
            <div>
              <h2 className={`text-base md:text-lg font-semibold tracking-tight truncate ${resolvedTheme === 'dark' ? 'text-white/92' : 'text-black/85'}`}>
                {pageTitle}
              </h2>
              <p className={`text-[11px] hidden sm:block ${resolvedTheme === 'dark' ? 'text-white/45' : 'text-black/40'}`}>
                {new Date().toLocaleDateString()} · NetPilot Control Plane
              </p>
            </div>
          </div>
          <div className="relative flex items-center gap-3" ref={userMenuRef}>
            <div className="relative">
              <button
                onClick={() => {
                  setShowUserMenu(false);
                  setShowNotifications(v => !v);
                }}
                className={`p-2 relative rounded-lg transition-colors ${resolvedTheme === 'dark' ? 'text-white/55 hover:text-white hover:bg-white/10' : 'text-black/40 hover:text-black hover:bg-black/5'}`}
                title="Notifications"
              >
                <Bell size={20} />
                {unreadNotificationCount > 0 && (
                  <span className={`absolute top-1.5 right-1.5 min-w-2 h-2 px-0.5 bg-red-500 rounded-full border-2 text-[9px] leading-none flex items-center justify-center text-white ${resolvedTheme === 'dark' ? 'border-[#0f1828]' : 'border-white'}`} />
                )}
              </button>

              {showNotifications && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.16, ease: 'easeOut' }}
                  className={`absolute top-12 right-0 w-[calc(100vw-2rem)] sm:w-80 max-w-80 rounded-xl shadow-2xl z-50 overflow-hidden ${resolvedTheme === 'dark' ? 'bg-[#121c2d] border border-white/10' : 'bg-white border border-black/10'}`}
                >
                  <div className={`px-4 py-3 border-b flex items-center justify-between ${resolvedTheme === 'dark' ? 'border-white/10 bg-white/5' : 'border-black/5 bg-black/[0.02]'}`}>
                    <p className={`text-sm font-semibold ${resolvedTheme === 'dark' ? 'text-white/90' : 'text-black/80'}`}>Notifications</p>
                    <button
                      onClick={markAllNotificationsRead}
                      className={`text-[11px] font-semibold ${resolvedTheme === 'dark' ? 'text-[#00bceb] hover:text-[#40d6f6]' : 'text-[#008bb0] hover:text-[#006c8a]'}`}
                    >
                      Mark all read
                    </button>
                  </div>
                  <div className="max-h-80 overflow-auto">
                    {unreadNotifications.map(item => (
                      <button
                        key={item.id}
                        onClick={() => {
                          setNotificationReadMap(prev => ({ ...prev, [item.id]: true }));
                          setNotifications(prev => prev.map(n => n.id === item.id ? { ...n, read: true } : n));
                          markNotificationsAsRead([item.id]);
                        }}
                        className={`w-full text-left px-4 py-3 border-b transition-all ${resolvedTheme === 'dark' ? 'border-white/5 hover:bg-white/5' : 'border-black/5 hover:bg-black/[0.02]'}`}
                      >
                        <div className="flex items-start gap-3">
                          <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${item.read ? 'bg-transparent border border-transparent' : 'bg-[#00bceb]'}`} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] ${
                                item.source === 'system_resource'
                                  ? 'bg-red-100 text-red-700'
                                  : item.source === 'network_monitor'
                                    ? 'bg-cyan-100 text-cyan-700'
                                    : 'bg-black/5 text-black/45'
                              }`}>
                                {item.source === 'system_resource'
                                  ? (language === 'zh' ? '平台资源' : 'Platform')
                                  : item.source === 'network_monitor'
                                    ? (language === 'zh' ? '网络监控' : 'Network')
                                    : (item.source || (language === 'zh' ? '通知' : 'Notice'))}
                              </span>
                              {item.severity && <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] ${
                                item.severity === 'critical' || item.severity === 'high'
                                  ? 'bg-red-100 text-red-700'
                                  : item.severity === 'major' || item.severity === 'medium'
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-emerald-100 text-emerald-700'
                              }`}>
                                {item.severity === 'critical'
                                  ? (language === 'zh' ? '严重' : 'Critical')
                                  : item.severity === 'major'
                                    ? (language === 'zh' ? '主要' : 'Major')
                                    : item.severity === 'warning'
                                      ? (language === 'zh' ? '次要' : 'Minor')
                                    : item.severity === 'high'
                                      ? (language === 'zh' ? '高' : 'High')
                                      : item.severity === 'medium'
                                        ? (language === 'zh' ? '中' : 'Medium')
                                        : (language === 'zh' ? '低' : 'Low')}
                              </span>}
                            </div>
                            <p className={`text-sm font-semibold truncate ${resolvedTheme === 'dark' ? 'text-white/90' : 'text-black/80'}`}>{item.title}</p>
                            <p className={`text-xs mt-0.5 ${resolvedTheme === 'dark' ? 'text-white/55' : 'text-black/50'}`}>{item.message}</p>
                            <p className={`text-[10px] mt-1 ${resolvedTheme === 'dark' ? 'text-white/40' : 'text-black/40'}`}>{item.time ? new Date(item.time).toLocaleString() : ''}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                    {unreadNotifications.length === 0 && (
                      <p className={`px-4 py-6 text-center text-xs ${resolvedTheme === 'dark' ? 'text-white/50' : 'text-black/45'}`}>
                        No notifications.
                      </p>
                    )}
                  </div>
                </motion.div>
              )}
            </div>

            <button
              onClick={() => {
                setShowNotifications(false);
                setShowUserMenu(v => !v);
              }}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all ${resolvedTheme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-black/[0.04]'}`}
            >
              <div className={`w-7 h-7 rounded-full border overflow-hidden flex items-center justify-center ${resolvedTheme === 'dark' ? 'bg-white/10 border-white/10 text-white/70' : 'bg-black/10 border-black/5 text-black/60'}`}>
                {renderAvatarContent(currentAvatar, 15)}
              </div>
              <span className={`text-xs font-semibold max-w-24 truncate ${resolvedTheme === 'dark' ? 'text-white/85' : 'text-black/70'}`}>{currentUser.username}</span>
              <ChevronDown size={14} className={resolvedTheme === 'dark' ? 'text-white/45' : 'text-black/35'} />
            </button>

            {showUserMenu && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.16, ease: 'easeOut' }}
                className={`absolute top-14 right-0 w-[calc(100vw-2rem)] sm:w-[300px] max-w-[300px] rounded-xl shadow-2xl z-50 overflow-hidden ${resolvedTheme === 'dark' ? 'bg-[#161b22] border border-white/[0.12]' : 'bg-white border border-black/[0.12] shadow-lg'}`}
              >
                {/* Header: avatar + signed in as */}
                <div className={`flex items-center gap-3 px-4 py-3 border-b ${resolvedTheme === 'dark' ? 'border-white/[0.08]' : 'border-black/[0.06]'}`}>
                  <div className={`w-9 h-9 rounded-full border overflow-hidden flex-shrink-0 flex items-center justify-center ${resolvedTheme === 'dark' ? 'bg-white/10 border-white/10 text-white/70' : 'bg-black/10 border-black/5 text-black/60'}`}>
                    {renderAvatarContent(currentAvatar, 18)}
                  </div>
                  <div className="min-w-0">
                    <p className={`text-[13px] font-semibold truncate leading-tight ${resolvedTheme === 'dark' ? 'text-white/90' : 'text-black/85'}`}>{currentUser.username}</p>
                    <p className={`text-[11px] truncate ${resolvedTheme === 'dark' ? 'text-white/45' : 'text-black/45'}`}>{currentUser.role || 'Administrator'}</p>
                  </div>
                </div>

                {/* Navigation shortcuts */}
                <div className={`py-1 border-b ${resolvedTheme === 'dark' ? 'border-white/[0.08]' : 'border-black/[0.06]'}`}>
                  <button
                    onClick={openProfileModal}
                    className={`w-full flex items-center gap-3 px-4 py-[7px] text-[13px] transition-colors ${resolvedTheme === 'dark' ? 'text-white/80 hover:bg-white/[0.06]' : 'text-black/70 hover:bg-black/[0.03]'}`}
                  >
                    <User size={16} className="flex-shrink-0 opacity-70" />
                    {language === 'zh' ? '个人资料' : 'Your profile'}
                  </button>
                  <button
                    onClick={() => { setActiveTab('dashboard'); setShowUserMenu(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-[7px] text-[13px] transition-colors ${resolvedTheme === 'dark' ? 'text-white/80 hover:bg-white/[0.06]' : 'text-black/70 hover:bg-black/[0.03]'}`}
                  >
                    <LayoutDashboard size={16} className="flex-shrink-0 opacity-70" />
                    {language === 'zh' ? '仪表盘' : 'Dashboard'}
                  </button>
                  <button
                    onClick={() => { setActiveTab('monitoring'); setShowUserMenu(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-[7px] text-[13px] transition-colors ${resolvedTheme === 'dark' ? 'text-white/80 hover:bg-white/[0.06]' : 'text-black/70 hover:bg-black/[0.03]'}`}
                  >
                    <Activity size={16} className="flex-shrink-0 opacity-70" />
                    {language === 'zh' ? '监控中心' : 'Monitoring'}
                  </button>
                  <button
                    onClick={() => { setActiveTab('health'); setShowUserMenu(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-[7px] text-[13px] transition-colors ${resolvedTheme === 'dark' ? 'text-white/80 hover:bg-white/[0.06]' : 'text-black/70 hover:bg-black/[0.03]'}`}
                  >
                    <ShieldCheck size={16} className="flex-shrink-0 opacity-70" />
                    {language === 'zh' ? '健康检测' : 'Health Detection'}
                  </button>
                  <button
                    onClick={() => { setActiveTab('history'); setShowUserMenu(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-[7px] text-[13px] transition-colors ${resolvedTheme === 'dark' ? 'text-white/80 hover:bg-white/[0.06]' : 'text-black/70 hover:bg-black/[0.03]'}`}
                  >
                    <History size={16} className="flex-shrink-0 opacity-70" />
                    {language === 'zh' ? '审计日志' : 'Audit logs'}
                  </button>
                </div>

                {/* Appearance & Language */}
                <div className={`py-1 border-b ${resolvedTheme === 'dark' ? 'border-white/[0.08]' : 'border-black/[0.06]'}`}>
                  <div className={`w-full flex items-center justify-between px-4 py-[7px] text-[13px] ${resolvedTheme === 'dark' ? 'text-white/80' : 'text-black/70'}`}>
                    <div className="flex items-center gap-3">
                      {resolvedTheme === 'dark' ? <Moon size={16} className="flex-shrink-0 opacity-70" /> : <Sun size={16} className="flex-shrink-0 opacity-70" />}
                      <span>{language === 'zh' ? '外观' : 'Appearance'}</span>
                    </div>
                    <div className={`flex items-center rounded-md border p-0.5 ${resolvedTheme === 'dark' ? 'border-white/10 bg-white/5' : 'border-black/10 bg-black/[0.03]'}`}>
                      <button
                        onClick={() => setThemeMode('light')}
                        title="Light"
                        className={`p-1 rounded transition-all ${themeMode === 'light' ? 'bg-[#00bceb]/15 text-[#00bceb]' : (resolvedTheme === 'dark' ? 'text-white/45 hover:text-white' : 'text-black/40 hover:text-black')}`}
                      >
                        <Sun size={13} />
                      </button>
                      <button
                        onClick={() => setThemeMode('dark')}
                        title="Dark"
                        className={`p-1 rounded transition-all ${themeMode === 'dark' ? 'bg-[#00bceb]/15 text-[#00bceb]' : (resolvedTheme === 'dark' ? 'text-white/45 hover:text-white' : 'text-black/40 hover:text-black')}`}
                      >
                        <Moon size={13} />
                      </button>
                    </div>
                  </div>
                  <div className={`w-full flex items-center justify-between px-4 py-[7px] text-[13px] ${resolvedTheme === 'dark' ? 'text-white/80' : 'text-black/70'}`}>
                    <div className="flex items-center gap-3">
                      <Globe size={16} className="flex-shrink-0 opacity-70" />
                      <span>{language === 'zh' ? '语言' : 'Language'}</span>
                    </div>
                    <div className={`flex items-center rounded-md border p-0.5 ${resolvedTheme === 'dark' ? 'border-white/10 bg-white/5' : 'border-black/10 bg-black/[0.03]'}`}>
                      <button
                        onClick={() => {
                          setLanguage('en' as any);
                          if (currentUser.id) {
                            const token = localStorage.getItem('netops_token');
                            fetch(`/api/users/${currentUser.id}`, {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
                              body: JSON.stringify({ preferred_language: 'en' }),
                            }).catch(() => {});
                          }
                        }}
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all ${language === 'en' ? 'bg-[#00bceb]/15 text-[#00bceb]' : (resolvedTheme === 'dark' ? 'text-white/45 hover:text-white' : 'text-black/40 hover:text-black')}`}
                      >
                        EN
                      </button>
                      <button
                        onClick={() => {
                          setLanguage('zh' as any);
                          if (currentUser.id) {
                            const token = localStorage.getItem('netops_token');
                            fetch(`/api/users/${currentUser.id}`, {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
                              body: JSON.stringify({ preferred_language: 'zh' }),
                            }).catch(() => {});
                          }
                        }}
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all ${language === 'zh' ? 'bg-[#00bceb]/15 text-[#00bceb]' : (resolvedTheme === 'dark' ? 'text-white/45 hover:text-white' : 'text-black/40 hover:text-black')}`}
                      >
                        中文
                      </button>
                    </div>
                  </div>
                </div>

                {/* Last login */}
                <div className={`px-4 py-2 border-b ${resolvedTheme === 'dark' ? 'border-white/[0.08]' : 'border-black/[0.06]'}`}>
                  <p className={`text-[11px] flex items-center gap-2 ${resolvedTheme === 'dark' ? 'text-white/35' : 'text-black/35'}`}>
                    <Clock size={12} className="flex-shrink-0" />
                    {language === 'zh' ? '上次登录' : 'Last login'}: {currentUserLastLogin}
                  </p>
                </div>

                {/* Sign out */}
                <div className="py-1">
                  <button
                    onClick={handleLogout}
                    className={`w-full flex items-center gap-3 px-4 py-[7px] text-[13px] transition-colors ${resolvedTheme === 'dark' ? 'text-white/80 hover:bg-white/[0.06]' : 'text-black/70 hover:bg-black/[0.03]'}`}
                  >
                    <LogOut size={16} className="flex-shrink-0 opacity-70" />
                    {t('logout')}
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 pb-8 md:p-8 md:pb-16">
          {activeTab === 'dashboard' && (
            <Suspense fallback={lazyPanelFallback}>
              <DashboardTab
                devices={devices}
                jobs={jobs}
                scheduledTasks={scheduledTasks}
                trendDays={trendDays}
                setTrendDays={setTrendDays}
                complianceTrend={complianceTrend}
                platformData={platformData}
                dashBannerCollapsed={dashBannerCollapsed}
                setDashBannerCollapsed={setDashBannerCollapsed}
                dashLastRefresh={dashLastRefresh}
                hostResources={hostResources}
                unreadNotificationCount={unreadNotificationCount}
                language={language}
                t={t}
                setActiveTab={setActiveTab}
                navigate={navigate}
              />
            </Suspense>
          )}

          {activeTab === 'monitoring' && (
            <Suspense fallback={lazyPanelFallback}>
              <MonitoringCenter
                language={language}
                monitorSearch={monitorSearch}
                setMonitorSearch={setMonitorSearch}
                monitorSearchResults={monitorSearchResults}
                monitorSearching={monitorSearching}
                monitorSelectedDevice={monitorSelectedDevice}
                setMonitorSelectedDevice={setMonitorSelectedDevice}
                monitorOverview={monitorOverview}
                monitorRealtime={monitorRealtime}
                monitorTrend={monitorTrend}
                monitorTrendInterface={monitorTrendInterface}
                setMonitorTrendInterface={setMonitorTrendInterface}
                monitorTrendResolution={monitorTrendResolution}
                setMonitorTrendResolution={setMonitorTrendResolution}
                monitorTrendStartInput={monitorTrendStartInput}
                setMonitorTrendStartInput={setMonitorTrendStartInput}
                monitorTrendEndInput={monitorTrendEndInput}
                setMonitorTrendEndInput={setMonitorTrendEndInput}
                monitorTrendRange={monitorTrendRange}
                setMonitorTrendRange={setMonitorTrendRange}
                monitorTrendZoom={monitorTrendZoom}
                setMonitorTrendZoom={setMonitorTrendZoom}
                monitorTrendDragStart={monitorTrendDragStart}
                setMonitorTrendDragStart={setMonitorTrendDragStart}
                monitorTrendDragEnd={monitorTrendDragEnd}
                setMonitorTrendDragEnd={setMonitorTrendDragEnd}
                monitorTrendMetrics={monitorTrendMetrics}
                setMonitorTrendMetrics={setMonitorTrendMetrics}
                monitorTrendUiMode={monitorTrendUiMode}
                setMonitorTrendUiMode={setMonitorTrendUiMode}
                monitorAlerts={monitorAlerts}
                monitorAlertTotal={monitorAlertTotal}
                monitorAlertsPage={monitorAlertsPage}
                setMonitorAlertsPage={setMonitorAlertsPage}
                monitorAlertsPageSize={monitorAlertsPageSize}
                monitorAlertsSeverity={monitorAlertsSeverity}
                setMonitorAlertsSeverity={setMonitorAlertsSeverity}
                monitorAlertsPhase={monitorAlertsPhase}
                setMonitorAlertsPhase={setMonitorAlertsPhase}
                monitorLoading={monitorLoading}
                monitorPageVisible={monitorPageVisible}
                monitorDashboardSiteFilter={monitorDashboardSiteFilter}
                setMonitorDashboardSiteFilter={setMonitorDashboardSiteFilter}
                monitorDashboardAlertFilter={monitorDashboardAlertFilter}
                setMonitorDashboardAlertFilter={setMonitorDashboardAlertFilter}
                hostResources={hostResources}
                fetchMonitoringOverview={() => fetchMonitoringOverview(true)}
                fetchMonitoringAlerts={fetchMonitoringAlerts}
                fetchMonitoringRealtime={fetchMonitoringRealtime}
                fetchHostResources={fetchHostResources}
                setMonitorRealtime={setMonitorRealtime}
                showToast={showToast}
              />
            </Suspense>
          )}

          {activeTab === 'health' && (
            <Suspense fallback={lazyPanelFallback}>
              <DeviceHealthTab
                devices={devices}
                overview={monitorOverview?.device_health_summary || null}
                language={language}
                onShowDetails={handleShowDetails}
                onOpenMonitoring={() => setActiveTab('monitoring')}
              />
            </Suspense>
          )}

          {activeTab === 'alerts' && (
            <Suspense fallback={lazyPanelFallback}>
              <AlertDeskTab
                language={language}
                currentUsername={currentUser.username}
                showToast={showToast}
                activeAlertSection="alerts"
                onNavigateAlertSection={(section) => setActiveTab(section)}
                onOpenMaintenanceForAlert={(alert) => {
                  const params = new URLSearchParams({
                    open: '1',
                    name: alert ? `${alert.hostname || alert.ip_address || 'Alert'} Maintenance` : '',
                    target_ip: alert?.ip_address || '',
                  });
                  navigate(`/maintenance?${params.toString()}`);
                }}
              />
            </Suspense>
          )}

          {activeTab === 'alert-rules' && (
            <Suspense fallback={lazyPanelFallback}>
              <AlertRulesTab
                language={language}
                currentUsername={currentUser.username}
                showToast={showToast}
                activeAlertSection="alert-rules"
                onNavigateAlertSection={(section) => setActiveTab(section)}
              />
            </Suspense>
          )}

          {activeTab === 'maintenance' && (
            <Suspense fallback={lazyPanelFallback}>
              <AlertMaintenanceTab
                language={language}
                currentUsername={currentUser.username}
                showToast={showToast}
                activeAlertSection="maintenance"
                onNavigateAlertSection={(section) => setActiveTab(section)}
              />
            </Suspense>
          )}

          {activeTab === 'inventory' && inventorySubPage === 'devices' && (
            <Suspense fallback={lazyPanelFallback}>
              <InventoryDevicesTab
                inventoryRows={inventoryRows}
                inventoryTotal={inventoryTotal}
                inventoryPage={inventoryPage}
                setInventoryPage={setInventoryPage}
                inventoryPageSize={inventoryPageSize}
                setInventoryPageSize={setInventoryPageSize}
                inventorySearch={inventorySearch}
                setInventorySearch={setInventorySearch}
                inventoryPlatformFilter={inventoryPlatformFilter}
                setInventoryPlatformFilter={setInventoryPlatformFilter}
                inventoryStatusFilter={inventoryStatusFilter}
                setInventoryStatusFilter={setInventoryStatusFilter}
                inventorySortConfig={inventorySortConfig}
                inventoryLoading={inventoryLoading}
                selectedDeviceIds={selectedDeviceIds}
                setSelectedDeviceIds={setSelectedDeviceIds}
                handleSort={handleSort}
                handleImport={handleImport}
                handleExport={handleExport}
                handleDeleteDevice={handleDeleteDevice}
                handleDeleteSelected={handleDeleteSelected}
                handleShowDetails={handleShowDetails}
                handleTestConnection={handleTestConnection}
                deviceConnectionChecks={deviceConnectionChecks}
                connectionTestingDeviceId={connectionTestingDeviceId}
                setShowAddModal={setShowAddModal}
                setShowEditModal={setShowEditModal}
                setEditingDevice={setEditingDevice}
                setEditForm={setEditForm}
                setSelectedDevice={setSelectedDevice}
                setActiveTab={setActiveTab}
                language={language}
                t={t}
              />
            </Suspense>
          )}

          {/* ── Interface Monitoring Sub-Page ── */}
          {activeTab === 'inventory' && inventorySubPage === 'interfaces' && (() => {
            const DEVS_PER_PAGE = 10;
            const INTFS_PER_PAGE = 15;
            const fmtBytes = (b: number) => b > 1073741824 ? `${(b / 1073741824).toFixed(1)} GB` : b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : b > 1024 ? `${(b / 1024).toFixed(0)} KB` : `${b} B`;
            const fmtRate = (bps?: number) => {
              if (bps == null || !Number.isFinite(bps) || bps < 0) return '-';
              if (bps >= 1_000_000_000) return `${(bps / 1_000_000_000).toFixed(2)} Gbps`;
              if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(2)} Mbps`;
              if (bps >= 1_000) return `${(bps / 1_000).toFixed(1)} Kbps`;
              return `${bps.toFixed(0)} bps`;
            };
            const fmtDuration = (secs?: number) => {
              if (secs == null || secs < 0) return '-';
              if (secs < 60) return `${secs}s`;
              if (secs < 3600) return `${Math.floor(secs / 60)}m`;
              if (secs < 86400) return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`;
              return `${Math.floor(secs / 86400)}d ${Math.floor((secs % 86400) / 3600)}h`;
            };

            // Helper: compute device-level stats
            const devStats = (d: Device) => {
              const intfs = d.interface_data || [];
              const upC = intfs.filter(i => i.status === 'up').length;
              const downC = intfs.filter(i => i.status === 'down').length;
              const errC = intfs.reduce((a, i) => a + (i.in_errors || 0) + (i.out_errors || 0), 0);
              const discC = intfs.reduce((a, i) => a + (i.in_discards || 0) + (i.out_discards || 0), 0);
              const maxBw = intfs.reduce((m, i) => Math.max(m, i.bw_in_pct || 0, i.bw_out_pct || 0), 0);
              const flapping = intfs.some(i => i.flapping);
              return { intfs, upC, downC, errC, discC, maxBw, flapping, hasData: intfs.length > 0 };
            };

            // Step 1: search filter
            const searchFiltered = devices.filter(d => {
              if (!intfSearch.trim()) return true;
              const q = intfSearch.toLowerCase();
              return d.hostname.toLowerCase().includes(q) || d.ip_address.toLowerCase().includes(q);
            });

            // Step 2: status filter
            const statusFiltered = searchFiltered.filter(d => {
              const s = devStats(d);
              if (intfStatusFilter === 'hasData') return s.hasData;
              if (intfStatusFilter === 'hasDown') return s.downC > 0;
              if (intfStatusFilter === 'hasErrors') return (s.errC + s.discC) > 0 || s.flapping;
              return true;
            });
            const hiddenCount = searchFiltered.length - statusFiltered.length;

            // Step 3: sort
            const sortedDevices = [...statusFiltered].sort((a, b) => {
              const sa = devStats(a), sb = devStats(b);
              if (intfSortBy === 'downCount') return sb.downC - sa.downC || a.hostname.localeCompare(b.hostname);
              if (intfSortBy === 'errors') return (sb.errC + sb.discC) - (sa.errC + sa.discC) || a.hostname.localeCompare(b.hostname);
              if (intfSortBy === 'bw') return sb.maxBw - sa.maxBw || a.hostname.localeCompare(b.hostname);
              return a.hostname.localeCompare(b.hostname);
            });

            // Global stats
            const totalUp = searchFiltered.reduce((s, d) => s + (d.interface_data?.filter(i => i.status === 'up').length || 0), 0);
            const totalDown = searchFiltered.reduce((s, d) => s + (d.interface_data?.filter(i => i.status === 'down').length || 0), 0);
            const totalErrors = searchFiltered.reduce((s, d) => s + (d.interface_data?.reduce((a, i) => a + (i.in_errors || 0) + (i.out_errors || 0), 0) || 0), 0);
            const totalDiscards = searchFiltered.reduce((s, d) => s + (d.interface_data?.reduce((a, i) => a + (i.in_discards || 0) + (i.out_discards || 0), 0) || 0), 0);

            // Top-5 bandwidth interfaces
            const topNBw: { hostname: string; name: string; bwIn: number; bwOut: number; speedMbps: number; inBps: number; outBps: number }[] = [];
            searchFiltered.forEach(d => {
              (d.interface_data || []).forEach(intf => {
                const bwIn = intf.bw_in_pct || 0;
                const bwOut = intf.bw_out_pct || 0;
                if (bwIn > 0 || bwOut > 0) topNBw.push({ hostname: d.hostname, name: intf.name, bwIn, bwOut, speedMbps: intf.speed_mbps, inBps: intf.in_bps || 0, outBps: intf.out_bps || 0 });
              });
            });
            topNBw.sort((a, b) => Math.max(b.bwIn, b.bwOut) - Math.max(a.bwIn, a.bwOut));
            const top5Bw = topNBw.slice(0, 5);

            const totalDevPages = Math.max(1, Math.ceil(sortedDevices.length / DEVS_PER_PAGE));
            const safePage = Math.min(intfDevicePage, totalDevPages);
            const pagedDevices = sortedDevices.slice((safePage - 1) * DEVS_PER_PAGE, safePage * DEVS_PER_PAGE);

            const filterTabs: { key: typeof intfStatusFilter; label: string; count: number }[] = [
              { key: 'all', label: language === 'zh' ? '全部' : 'All', count: searchFiltered.length },
              { key: 'hasData', label: language === 'zh' ? '有接口数据' : 'Has Data', count: searchFiltered.filter(d => (d.interface_data || []).length > 0).length },
              { key: 'hasDown', label: language === 'zh' ? '有DOWN口' : 'Has DOWN', count: searchFiltered.filter(d => (d.interface_data || []).some(i => i.status === 'down')).length },
              { key: 'hasErrors', label: language === 'zh' ? '有错误/丢包' : 'Errors/Drops', count: searchFiltered.filter(d => (d.interface_data || []).some(i => (i.in_errors || 0) + (i.out_errors || 0) + (i.in_discards || 0) + (i.out_discards || 0) > 0 || i.flapping)).length },
            ];

            return (
            <div className="space-y-6">
              <div className="flex flex-col gap-4">
                <div className={sectionHeaderRowClass}>
                  <div>
                    <h2 className="text-2xl font-medium tracking-tight">{language === 'zh' ? '接口监控' : 'Interface Monitoring'}</h2>
                    <p className="text-sm text-black/40">{language === 'zh' ? '所有设备的接口实时状态总览' : 'Real-time interface status overview for all devices'}</p>
                  </div>
                  <div className="flex gap-3 items-center flex-wrap">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-black/5 rounded-xl">
                      <span className="w-2 h-2 rounded-full bg-[#00bceb]" />
                      <span className="text-xs text-black/60">
                        {intfUpdatedAgoSec === null
                          ? (language === 'zh' ? '同步中...' : 'Syncing...')
                          : (language === 'zh' ? `${intfUpdatedAgoSec}s 前更新` : `Updated ${intfUpdatedAgoSec}s ago`)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-black/5 rounded-xl">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span className="text-xs text-black/60">UP: {totalUp}</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-black/5 rounded-xl">
                      <span className="w-2 h-2 rounded-full bg-red-500" />
                      <span className="text-xs text-black/60">DOWN: {totalDown}</span>
                    </div>
                    {totalErrors > 0 && (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-100 rounded-xl">
                        <span className="text-xs text-red-600 font-medium">{language === 'zh' ? '错误' : 'Errors'}: {totalErrors.toLocaleString()}</span>
                      </div>
                    )}
                    {totalDiscards > 0 && (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-50 border border-orange-100 rounded-xl">
                        <span className="text-xs text-orange-600 font-medium">{language === 'zh' ? '丢包' : 'Drops'}: {totalDiscards.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Top-5 Bandwidth Ranking */}
                {top5Bw.length > 0 && (
                  <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-black/40 mb-3">{language === 'zh' ? 'Top 5 带宽利用率接口' : 'Top 5 Bandwidth Utilization'}</h3>
                    <div className="space-y-2.5">
                      {top5Bw.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-3">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${idx === 0 ? 'bg-red-100 text-red-600' : idx === 1 ? 'bg-orange-100 text-orange-600' : 'bg-black/5 text-black/40'}`}>{idx + 1}</span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold truncate">{item.hostname}</span>
                              <span className="text-[10px] font-mono text-black/40 truncate">{item.name}</span>
                              {item.speedMbps > 0 && <span className="text-[10px] text-black/25">{item.speedMbps >= 1000 ? `${item.speedMbps / 1000}G` : `${item.speedMbps}M`}</span>}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <div className="flex items-center gap-1 flex-1">
                                <span className="text-[9px] text-blue-500 w-5 flex-shrink-0">IN</span>
                                <progress className="util-progress util-progress-in flex-1" max={100} value={Math.min(item.bwIn, 100)} />
                                <span className="text-[10px] font-mono text-blue-600 w-12 text-right">{item.bwIn.toFixed(1)}%</span>
                              </div>
                              <div className="flex items-center gap-1 flex-1">
                                <span className="text-[9px] text-orange-500 w-7 flex-shrink-0">OUT</span>
                                <progress className="util-progress util-progress-out flex-1" max={100} value={Math.min(item.bwOut, 100)} />
                                <span className="text-[10px] font-mono text-orange-600 w-12 text-right">{item.bwOut.toFixed(1)}%</span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0 ml-2">
                            <div className="text-[10px] font-mono text-blue-600">{fmtRate(item.inBps)}</div>
                            <div className="text-[10px] font-mono text-orange-600">{fmtRate(item.outBps)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Search + Filter tabs + Sort */}
                <div className="flex flex-col gap-3">
                  <div className={sectionToolbarClass}>
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-black/40" size={16} />
                      <input
                        type="text"
                        placeholder={language === 'zh' ? '搜索主机名或 IP 地址...' : 'Search by hostname or IP...'}
                        value={intfSearch}
                        onChange={(e) => { setIntfSearch(e.target.value); setIntfDevicePage(1); }}
                        className="w-full pl-9 pr-3 py-2 bg-black/[0.02] border border-black/5 rounded-xl text-sm focus:border-black/20 outline-none transition-all"
                      />
                    </div>
                    <select
                      value={intfSortBy}
                      onChange={(e) => { setIntfSortBy(e.target.value as any); setIntfDevicePage(1); }}
                      title={language === 'zh' ? '接口监控排序方式' : 'Interface monitoring sort order'}
                      className="px-3 py-2 bg-black/[0.02] border border-black/5 rounded-xl text-xs outline-none cursor-pointer"
                    >
                      <option value="name">{language === 'zh' ? '按主机名排序' : 'Sort by Name'}</option>
                                    onClick={() => setActiveTab('alerts')}
                      <option value="errors">{language === 'zh' ? '按错误数↓' : 'Sort by Errors'}</option>
                      <option value="bw">{language === 'zh' ? '按带宽利用率↓' : 'Sort by BW%'}</option>
                    </select>
                    <span className="text-xs text-black/40">{sortedDevices.length} {language === 'zh' ? '台设备' : 'devices'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {filterTabs.map(tab => (
                      <button
                        key={tab.key}
                        onClick={() => { setIntfStatusFilter(tab.key); setIntfDevicePage(1); }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${intfStatusFilter === tab.key ? 'bg-black text-white shadow-sm' : 'bg-black/[0.03] text-black/50 hover:bg-black/[0.06]'}`}
                      >
                        {tab.label} <span className={`ml-1 ${intfStatusFilter === tab.key ? 'text-white/60' : 'text-black/30'}`}>({tab.count})</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Device list */}
              {sortedDevices.length === 0 ? (
                <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-16 text-center">
                  <Server size={48} className="mx-auto text-black/10 mb-4" />
                  <p className="text-black/40 text-sm">{language === 'zh' ? '没有匹配的设备' : 'No matching devices'}</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
                  {pagedDevices.map((device) => {
                    const isExpanded = intfExpandedDevice === device.id;
                    const intfs = device.interface_data || [];
                    const ds = devStats(device);
                    // Inner interface filter & pagination
                    const innerFilter = intfFilterMap[device.id] || '';
                    const filteredIntfs = intfs.filter(i => !innerFilter.trim() || i.name.toLowerCase().includes(innerFilter.toLowerCase()));
                    const innerPage = intfPageMap[device.id] || 1;
                    const innerTotalPages = Math.max(1, Math.ceil(filteredIntfs.length / INTFS_PER_PAGE));
                    const safeInnerPage = Math.min(innerPage, innerTotalPages);
                    const pagedIntfs = filteredIntfs.slice((safeInnerPage - 1) * INTFS_PER_PAGE, safeInnerPage * INTFS_PER_PAGE);

                    return (
                      <div key={device.id} className="border-b border-black/5 last:border-b-0">
                        {/* Device row — clickable */}
                        <div
                          className="px-6 py-3.5 flex items-center justify-between cursor-pointer hover:bg-black/[0.01] transition-colors select-none"
                          onClick={() => setIntfExpandedDevice(isExpanded ? null : device.id)}
                        >
                          <div className="flex items-center gap-4 min-w-0">
                            <ChevronRight size={16} className={`text-black/30 transition-transform duration-200 flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`} />
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${device.status === 'online' ? 'bg-emerald-50 text-emerald-600' : 'bg-black/5 text-black/30'}`}>
                              <Server size={16} />
                            </div>
                            <div className="min-w-0">
                              <span className="font-semibold text-sm">{device.hostname}</span>
                              <span className="text-xs text-black/40 ml-3">{device.ip_address}</span>
                              <span className="text-xs text-black/30 ml-2">{device.platform}</span>
                              {ds.flapping && <span className="ml-2 px-1.5 py-0.5 text-[9px] font-bold uppercase bg-red-100 text-red-600 rounded animate-pulse">FLAP</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${device.status === 'online' ? 'bg-emerald-500' : 'bg-black/20'}`} />
                            {intfs.length > 0 ? (
                              <div className="flex items-center gap-3 text-xs">
                                <span className="text-emerald-600 font-medium">{ds.upC} up</span>
                                <span className={`font-medium ${ds.downC > 0 ? 'text-red-500' : 'text-black/30'}`}>{ds.downC} down</span>
                                {ds.errC > 0 && <span className="text-red-500 font-medium">{ds.errC.toLocaleString()} err</span>}
                                <span className="text-black/30">{intfs.length} total</span>
                              </div>
                            ) : (
                              <span className="text-[10px] text-black/30 italic">{language === 'zh' ? '未采集到接口数据' : 'No interface data'}</span>
                            )}
                            <button
                              onClick={(e) => { e.stopPropagation(); handleSnmpTest(device.id); }}
                              disabled={snmpTestingId === device.id}
                              className="ml-2 px-3 py-1 text-[10px] font-bold uppercase bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-all disabled:opacity-50 flex-shrink-0"
                            >
                              {snmpTestingId === device.id ? 'Testing...' : 'SNMP Test'}
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleSnmpSyncNow(device.id); }}
                              disabled={snmpSyncingId === device.id}
                              className="px-3 py-1 text-[10px] font-bold uppercase bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-all disabled:opacity-50 flex-shrink-0"
                            >
                              {snmpSyncingId === device.id
                                ? (language === 'zh' ? '同步中...' : 'Syncing...')
                                : (language === 'zh' ? '立即同步SNMP' : 'SNMP Sync Now')}
                            </button>
                          </div>
                        </div>

                        {/* Expanded interface table */}
                        {isExpanded && (
                          <div className="bg-black/[0.01] border-t border-black/5 px-6 pb-4 pt-3">
                            {intfs.length === 0 ? (
                              <p className="text-sm text-black/30 py-4 text-center">{language === 'zh' ? '暂无接口数据，请确认设备已开启 SNMP，并可点击“立即同步SNMP”主动拉取。' : 'No interface data. Verify SNMP is enabled, then click "SNMP Sync Now" to fetch immediately.'}</p>
                            ) : (
                              <>
                                {/* Interface search */}
                                <div className="flex items-center gap-3 mb-3">
                                  <div className="relative flex-1 max-w-xs">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-black/30" size={14} />
                                    <input
                                      type="text"
                                      placeholder={language === 'zh' ? '搜索接口名...' : 'Filter interface...'}
                                      value={innerFilter}
                                      onChange={(e) => {
                                        setIntfFilterMap(prev => ({ ...prev, [device.id]: e.target.value }));
                                        setIntfPageMap(prev => ({ ...prev, [device.id]: 1 }));
                                      }}
                                      className="w-full pl-8 pr-3 py-1.5 bg-white border border-black/10 rounded-lg text-xs outline-none focus:border-black/20"
                                    />
                                  </div>
                                  <span className="text-[10px] text-black/30">{filteredIntfs.length} {language === 'zh' ? '条匹配' : 'matched'}</span>
                                </div>
                                {/* Table */}
                                <div className="border border-black/5 rounded-xl overflow-hidden">
                                  <table className="w-full text-xs">
                                    <thead className="bg-black/[0.02]">
                                      <tr>
                                        <th className="px-4 py-2.5 text-left font-bold text-[10px] uppercase tracking-wider text-black/40">{language === 'zh' ? '接口' : 'Interface'}</th>
                                        <th className="px-4 py-2.5 text-left font-bold text-[10px] uppercase tracking-wider text-black/40">{language === 'zh' ? '状态' : 'Status'}</th>
                                        <th className="px-4 py-2.5 text-right font-bold text-[10px] uppercase tracking-wider text-black/40">{language === 'zh' ? '速率' : 'Speed'}</th>
                                        <th className="px-4 py-2.5 text-right font-bold text-[10px] uppercase tracking-wider text-black/40">{language === 'zh' ? '入速率' : 'IN Rate'}</th>
                                        <th className="px-4 py-2.5 text-right font-bold text-[10px] uppercase tracking-wider text-black/40">{language === 'zh' ? '出速率' : 'OUT Rate'}</th>
                                        <th className="px-4 py-2.5 text-right font-bold text-[10px] uppercase tracking-wider text-black/40">BW% IN/OUT</th>
                                        <th className="px-4 py-2.5 text-right font-bold text-[10px] uppercase tracking-wider text-black/40">{language === 'zh' ? '错误' : 'Errors'}</th>
                                        <th className="px-4 py-2.5 text-right font-bold text-[10px] uppercase tracking-wider text-black/40">{language === 'zh' ? '丢包' : 'Drops'}</th>
                                        <th className="px-4 py-2.5 text-center font-bold text-[10px] uppercase tracking-wider text-black/40">{language === 'zh' ? '持续时间' : 'Since'}</th>
                                        <th className="px-4 py-2.5 text-left font-bold text-[10px] uppercase tracking-wider text-black/40">{language === 'zh' ? '描述' : 'Description'}</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-black/5">
                                      {pagedIntfs.map((intf, i) => {
                                        const intfErrors = (intf.in_errors || 0) + (intf.out_errors || 0);
                                        const intfDiscards = (intf.in_discards || 0) + (intf.out_discards || 0);
                                        const bwIn = intf.bw_in_pct ?? null;
                                        const bwOut = intf.bw_out_pct ?? null;
                                        return (
                                        <tr key={i} className="hover:bg-white/80 transition-colors">
                                          <td className="px-4 py-2 font-mono text-[11px] font-medium">{intf.name}</td>
                                          <td className="px-4 py-2">
                                            <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase ${intf.status === 'up' ? 'text-emerald-600' : 'text-red-500'}`}>
                                              <span className={`w-1.5 h-1.5 rounded-full ${intf.status === 'up' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                              {intf.status}
                                            </span>
                                            {intf.flapping && <span className="ml-1 px-1 py-0.5 text-[8px] font-bold uppercase bg-red-100 text-red-600 rounded animate-pulse">FLAP</span>}
                                          </td>
                                          <td className="px-4 py-2 text-right text-black/60">{intf.speed_mbps > 0 ? (intf.speed_mbps >= 1000 ? `${intf.speed_mbps / 1000}G` : `${intf.speed_mbps}M`) : '-'}</td>
                                          <td className="px-4 py-2 text-right font-mono text-[10px]">
                                            <div className="text-blue-600">{fmtRate(intf.in_bps)}</div>
                                            <div className="text-black/30">{fmtBytes(intf.in_octets || 0)}</div>
                                          </td>
                                          <td className="px-4 py-2 text-right font-mono text-[10px]">
                                            <div className="text-orange-600">{fmtRate(intf.out_bps)}</div>
                                            <div className="text-black/30">{fmtBytes(intf.out_octets || 0)}</div>
                                          </td>
                                          <td className="px-4 py-2 text-right">
                                            {bwIn != null || bwOut != null ? (
                                              <div className="space-y-0.5">
                                                <div className="flex items-center justify-end gap-1">
                                                  <span className="text-[8px] text-blue-500 w-5 text-right">IN</span>
                                                  <progress className="util-progress util-progress-in w-10" max={100} value={Math.min(bwIn || 0, 100)} />
                                                  <span className={`font-mono text-[9px] w-10 text-right ${(bwIn || 0) > 80 ? 'text-red-600' : 'text-blue-600'}`}>{(bwIn || 0).toFixed(1)}%</span>
                                                </div>
                                                <div className="flex items-center justify-end gap-1">
                                                  <span className="text-[8px] text-orange-500 w-5 text-right">OUT</span>
                                                  <progress className="util-progress util-progress-out w-10" max={100} value={Math.min(bwOut || 0, 100)} />
                                                  <span className={`font-mono text-[9px] w-10 text-right ${(bwOut || 0) > 80 ? 'text-red-600' : 'text-orange-600'}`}>{(bwOut || 0).toFixed(1)}%</span>
                                                </div>
                                              </div>
                                            ) : <span className="text-[10px] text-black/20">-</span>}
                                          </td>
                                          <td className="px-4 py-2 text-right">
                                            <span className={`font-mono text-[10px] ${intfErrors > 0 ? 'text-red-600 font-bold' : 'text-black/30'}`}>{intfErrors > 0 ? intfErrors.toLocaleString() : '0'}</span>
                                          </td>
                                          <td className="px-4 py-2 text-right">
                                            <span className={`font-mono text-[10px] ${intfDiscards > 0 ? 'text-orange-600 font-bold' : 'text-black/30'}`}>{intfDiscards > 0 ? intfDiscards.toLocaleString() : '0'}</span>
                                          </td>
                                          <td className="px-4 py-2 text-center">
                                            <span className="font-mono text-[10px] text-black/40">{fmtDuration(intf.last_change_secs)}</span>
                                          </td>
                                          <td className="px-4 py-2 text-black/40 truncate max-w-[150px]">{intf.description || '-'}</td>
                                        </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                                {/* Interface pagination */}
                                {innerTotalPages > 1 && (
                                  <div className="flex items-center justify-between mt-3 px-1">
                                    <span className="text-[10px] text-black/30">{language === 'zh' ? `第 ${safeInnerPage}/${innerTotalPages} 页` : `Page ${safeInnerPage} of ${innerTotalPages}`}</span>
                                    <div className="flex gap-1">
                                      <button
                                        disabled={safeInnerPage <= 1}
                                        onClick={() => setIntfPageMap(prev => ({ ...prev, [device.id]: safeInnerPage - 1 }))}
                                        title={language === 'zh' ? '上一页' : 'Previous page'}
                                        className="px-2 py-1 text-[10px] border border-black/10 rounded-md hover:bg-black/5 disabled:opacity-30 transition-all"
                                      >
                                        <ChevronLeft size={12} />
                                      </button>
                                      <button
                                        disabled={safeInnerPage >= innerTotalPages}
                                        onClick={() => setIntfPageMap(prev => ({ ...prev, [device.id]: safeInnerPage + 1 }))}
                                        title={language === 'zh' ? '下一页' : 'Next page'}
                                        className="px-2 py-1 text-[10px] border border-black/10 rounded-md hover:bg-black/5 disabled:opacity-30 transition-all"
                                      >
                                        <ChevronRight size={12} />
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Device pagination */}
                  {totalDevPages > 1 && (
                    <div className="px-6 py-3 border-t border-black/5 flex items-center justify-between">
                      <span className="text-xs text-black/40">{language === 'zh' ? `共 ${sortedDevices.length} 台设备，第 ${safePage}/${totalDevPages} 页` : `${sortedDevices.length} devices, page ${safePage} of ${totalDevPages}`}</span>
                      <div className="flex gap-1">
                        <button
                          disabled={safePage <= 1}
                          onClick={() => setIntfDevicePage(safePage - 1)}
                          title={language === 'zh' ? '上一页' : 'Previous page'}
                          className="p-1.5 rounded-lg border border-black/5 hover:bg-black/5 disabled:opacity-30 transition-all"
                        >
                          <ChevronLeft size={16} />
                        </button>
                        <button
                          disabled={safePage >= totalDevPages}
                          onClick={() => setIntfDevicePage(safePage + 1)}
                          title={language === 'zh' ? '下一页' : 'Next page'}
                          className="p-1.5 rounded-lg border border-black/5 hover:bg-black/5 disabled:opacity-30 transition-all"
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Hidden (no-data) devices summary */}
              {intfStatusFilter !== 'all' && (() => {
                const allCount = devices.filter(d => !intfSearch.trim() || d.hostname.toLowerCase().includes(intfSearch.toLowerCase()) || d.ip_address.includes(intfSearch)).length;
                const hiddenCount = allCount - sortedDevices.length;
                return hiddenCount > 0 ? (
                  <div className="text-center py-3">
                    <span className="text-xs text-black/30">
                      {language === 'zh'
                        ? `${hiddenCount} 台设备被当前筛选条件隐藏`
                        : `${hiddenCount} devices hidden by current filter`}
                    </span>
                    <button onClick={() => { setIntfStatusFilter('all'); setIntfDevicePage(1); }} className="ml-2 text-xs text-blue-500 hover:underline">
                      {language === 'zh' ? '显示全部' : 'Show all'}
                    </button>
                  </div>
                ) : null;
              })()}
            </div>
            );
          })()}

          {activeTab === 'topology' && (
            <div className="h-full flex flex-col space-y-6">
              <div className={sectionHeaderRowClass}>
                <div>
                  <h2 className="text-2xl font-medium tracking-tight">{language === 'zh' ? '网络拓扑' : 'Network Topology'}</h2>
                  <p className="text-sm text-black/40">
                    {language === 'zh'
                      ? '基于 LLDP 邻居发现展示网络连接关系，按站点、角色和状态快速缩小故障域。'
                      : 'Visualize LLDP-based network adjacency and reduce the fault domain by site, role, and health state.'}
                  </p>
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={handleTriggerDiscovery}
                    className={secondaryActionBtnClass}
                    disabled={topologyDiscoveryRunning}
                  >
                    <RotateCcw size={16} />
                    {topologyDiscoveryRunning
                      ? (language === 'zh' ? '发现中...' : 'Discovering...')
                      : (language === 'zh' ? '刷新发现' : 'Refresh Discovery')}
                  </button>
                  <button 
                    onClick={handleExportMap}
                    className={darkActionBtnClass}
                  >
                    <Download size={16} />
                    {language === 'zh' ? '导出拓扑图' : 'Export Map'}
                  </button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
                {[
                  {
                    label: language === 'zh' ? '可视节点' : 'Visible Nodes',
                    value: topologyStats.nodeCount,
                    tone: 'bg-[#00bceb]/10 text-[#007ea0] border-[#00bceb]/20',
                  },
                  {
                    label: language === 'zh' ? '链路关系' : 'Adjacencies',
                    value: topologyStats.linkCount,
                    tone: 'bg-slate-100 text-slate-700 border-slate-200',
                  },
                  {
                    label: language === 'zh' ? '覆盖站点' : 'Sites',
                    value: topologyStats.siteCount,
                    tone: 'bg-emerald-100 text-emerald-700 border-emerald-200',
                  },
                  {
                    label: language === 'zh' ? '风险节点' : 'At Risk',
                    value: topologyStats.atRiskCount,
                    tone: 'bg-amber-100 text-amber-700 border-amber-200',
                  },
                  {
                    label: language === 'zh' ? '孤立节点' : 'Orphans',
                    value: topologyStats.orphanCount,
                    tone: 'bg-rose-100 text-rose-700 border-rose-200',
                  },
                  {
                    label: language === 'zh' ? '健康链路' : 'Healthy Links',
                    value: topologyLinkStats.up,
                    tone: 'bg-emerald-100 text-emerald-700 border-emerald-200',
                  },
                  {
                    label: language === 'zh' ? '退化链路' : 'Degraded Links',
                    value: topologyLinkStats.degraded,
                    tone: 'bg-amber-100 text-amber-700 border-amber-200',
                  },
                  {
                    label: language === 'zh' ? '中断链路' : 'Down Links',
                    value: topologyLinkStats.down,
                    tone: 'bg-rose-100 text-rose-700 border-rose-200',
                  },
                  {
                    label: language === 'zh' ? '陈旧链路' : 'Stale Links',
                    value: topologyLinkStats.stale,
                    tone: 'bg-sky-100 text-sky-700 border-sky-200',
                  },
                  {
                    label: language === 'zh' ? '多源证据' : 'Multi-source',
                    value: topologyLinkStats.multiSource,
                    tone: 'bg-sky-100 text-sky-700 border-sky-200',
                  },
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
                    <div className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${item.tone}`}>
                      {item.label}
                    </div>
                    <div className="mt-3 text-3xl font-semibold tracking-tight text-[#0f172a]">{item.value}</div>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,0.8fr))]">
                  <label className="flex items-center gap-2 rounded-xl border border-black/10 px-3 py-2">
                    <Search size={15} className="text-black/35" />
                    <input
                      value={topologySearch}
                      onChange={(e) => setTopologySearch(e.target.value)}
                      placeholder={language === 'zh' ? '搜索主机名、IP、站点、角色' : 'Search hostname, IP, site, role'}
                      className="w-full bg-transparent text-sm outline-none placeholder:text-black/30"
                    />
                  </label>
                  <select
                    value={topologySiteFilter}
                    onChange={(e) => setTopologySiteFilter(e.target.value)}
                    title={language === 'zh' ? '按站点筛选拓扑' : 'Filter topology by site'}
                    className="rounded-xl border border-black/10 px-3 py-2 text-sm outline-none"
                  >
                    <option value="all">{language === 'zh' ? '全部站点' : 'All Sites'}</option>
                    {topologySiteOptions.map((site) => <option key={site} value={site}>{site}</option>)}
                  </select>
                  <select
                    value={topologyRoleFilter}
                    onChange={(e) => setTopologyRoleFilter(e.target.value)}
                    title={language === 'zh' ? '按角色筛选拓扑' : 'Filter topology by role'}
                    className="rounded-xl border border-black/10 px-3 py-2 text-sm outline-none"
                  >
                    <option value="all">{language === 'zh' ? '全部角色' : 'All Roles'}</option>
                    {topologyRoleOptions.map((role) => <option key={role} value={role}>{role}</option>)}
                  </select>
                  <select
                    value={topologyStatusFilter}
                    onChange={(e) => setTopologyStatusFilter(e.target.value as 'all' | 'online' | 'offline' | 'pending')}
                    title={language === 'zh' ? '按状态筛选拓扑' : 'Filter topology by status'}
                    className="rounded-xl border border-black/10 px-3 py-2 text-sm outline-none"
                  >
                    <option value="all">{language === 'zh' ? '全部状态' : 'All Status'}</option>
                    <option value="online">{language === 'zh' ? '在线' : 'Online'}</option>
                    <option value="offline">{language === 'zh' ? '离线' : 'Offline'}</option>
                    <option value="pending">{language === 'zh' ? '待确认' : 'Pending'}</option>
                  </select>
                </div>
              </div>

              <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,2.2fr)_minmax(320px,0.95fr)]">
                <div className="relative flex min-h-[620px] flex-col overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm" ref={topologyRef}>
                  <div className="absolute inset-0 bg-[radial-gradient(#000_1px,transparent_1px)] bg-[length:20px_20px] opacity-[0.03]" />
                  <div className="relative flex items-center justify-between border-b border-black/5 px-5 py-4">
                    <div>
                      <h3 className="text-lg font-semibold tracking-tight text-[#0f172a]">
                        {language === 'zh' ? '拓扑画布' : 'Topology Canvas'}
                      </h3>
                      <p className="text-xs text-black/45">
                        {language === 'zh'
                          ? '离线设备默认保留展示；陈旧链路表示最近 30 分钟未刷新。手动发现用于立即校验，不应作为唯一更新方式。'
                          : 'Offline devices remain visible by default. Stale links mean discovery has not refreshed within the last 30 minutes. Manual discovery is for immediate validation, not the only update path.'}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-black/45">
                      <span className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/90 px-3 py-1.5">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        {language === 'zh' ? '节点在线 / 链路正常' : 'Node Online / Link Up'}
                      </span>
                      <span className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/90 px-3 py-1.5">
                        <span className="h-2 w-2 rounded-full bg-amber-500" />
                        {language === 'zh' ? '节点告警 / 链路退化' : 'Node Alert / Link Degraded'}
                      </span>
                      <span className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/90 px-3 py-1.5">
                        <span className="h-2 w-2 rounded-full bg-red-500" />
                        {language === 'zh' ? '节点离线 / 链路中断' : 'Node Offline / Link Down'}
                      </span>
                      <span className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/90 px-3 py-1.5">
                        <span className="h-2 w-2 rounded-full bg-sky-500" />
                        {language === 'zh' ? '链路陈旧' : 'Link Stale'}
                      </span>
                      <span className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/90 px-3 py-1.5">
                        <span className="h-2 w-2 rounded-full bg-slate-400" />
                        {language === 'zh' ? '链路未知' : 'Link Unknown'}
                      </span>
                    </div>
                  </div>

                  <div className="relative flex-1">
                    {topologyVisibleDevices.length === 0 ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
                        <div className="rounded-full border border-black/10 bg-slate-50 p-4 text-slate-500">
                          <Globe size={26} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-700">
                            {language === 'zh' ? '当前筛选条件下没有可展示的设备' : 'No devices match the current topology filter'}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {language === 'zh' ? '清空搜索或放宽站点、角色、状态筛选后重试。' : 'Clear the search or relax the site, role, or status filters.'}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="relative h-full w-full"
                      >
                        <Suspense fallback={lazyPanelFallback}>
                          <TopologyGraph 
                            devices={topologyVisibleDevices}
                            links={topologyVisibleLinks}
                            selectedNodeId={selectedTopologyDeviceId}
                            selectedLinkKey={selectedTopologyLinkKey}
                            onNodeClick={(device) => {
                              setSelectedTopologyDeviceId(device.id);
                            }}
                            onLinkClick={(link) => {
                              setSelectedTopologyDeviceId(link.source_device_id);
                              setSelectedTopologyLinkKey(link.link_key || link.id || null);
                            }}
                          />
                        </Suspense>
                      </motion.div>
                    )}
                  </div>

                  <div className="relative flex flex-wrap items-center gap-3 border-t border-black/5 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-black/45">
                    <span>{language === 'zh' ? `当前展示 ${topologyStats.nodeCount} 个节点 / ${topologyStats.linkCount} 条链路` : `Showing ${topologyStats.nodeCount} nodes / ${topologyStats.linkCount} links`}</span>
                    <span className="h-3 w-px bg-black/10" />
                    <span>{language === 'zh' ? `${topologyLinkStats.up} 正常 · ${topologyLinkStats.degraded} 退化 · ${topologyLinkStats.down} 中断 · ${topologyLinkStats.stale} 陈旧` : `${topologyLinkStats.up} up · ${topologyLinkStats.degraded} degraded · ${topologyLinkStats.down} down · ${topologyLinkStats.stale} stale`}</span>
                    <span className="h-3 w-px bg-black/10" />
                    <span>{language === 'zh' ? '虚线代表推断链路' : 'Dashed lines indicate inferred links'}</span>
                  </div>
                </div>

                <div className="flex min-h-[620px] flex-col gap-4">
                  <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-black/35">
                          {language === 'zh' ? '当前节点' : 'Selected Node'}
                        </p>
                        <h3 className="mt-2 text-xl font-semibold tracking-tight text-[#0f172a]">
                          {selectedTopologyDevice?.hostname || (language === 'zh' ? '未选择设备' : 'No device selected')}
                        </h3>
                        <p className="mt-1 text-sm text-black/45">
                          {selectedTopologyDevice
                            ? `${selectedTopologyDevice.ip_address} · ${selectedTopologyDevice.site || '-'} · ${selectedTopologyDevice.role || '-'}`
                            : (language === 'zh' ? '点击左侧节点查看邻接关系与健康态势。' : 'Select a node on the left to inspect adjacency and operational context.')}
                        </p>
                      </div>
                      {selectedTopologyDevice && (
                        <span className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${
                          selectedTopologyDevice.status === 'online'
                            ? 'border-emerald-200 bg-emerald-100 text-emerald-700'
                            : selectedTopologyDevice.status === 'pending'
                              ? 'border-amber-200 bg-amber-100 text-amber-700'
                              : 'border-rose-200 bg-rose-100 text-rose-700'
                        }`}>
                          {selectedTopologyDevice.status}
                        </span>
                      )}
                    </div>

                    {selectedTopologyDevice ? (
                      <>
                        <div className="mt-4 grid grid-cols-2 gap-3">
                          <div className="rounded-xl border border-black/5 bg-slate-50 p-3">
                            <p className="text-[11px] uppercase tracking-[0.14em] text-black/35">{language === 'zh' ? '邻接节点' : 'Neighbors'}</p>
                            <p className="mt-2 text-2xl font-semibold text-[#0f172a]">{topologyNeighborDevices.length}</p>
                          </div>
                          <div className="rounded-xl border border-black/5 bg-slate-50 p-3">
                            <p className="text-[11px] uppercase tracking-[0.14em] text-black/35">{language === 'zh' ? '接口链路' : 'Interface Links'}</p>
                            <p className="mt-2 text-2xl font-semibold text-[#0f172a]">{topologyDeviceLinks.length}</p>
                          </div>
                        </div>

                        <div className="mt-4 flex gap-2">
                          <button onClick={() => handleShowDetails(selectedTopologyDevice)} className={secondaryActionBtnClass}>
                            <Eye size={16} />
                            {language === 'zh' ? '查看设备详情' : 'Open Device Detail'}
                          </button>
                          <button onClick={() => navTo('/monitoring')} className={secondaryActionBtnClass}>
                            <Monitor size={16} />
                            {language === 'zh' ? '进入监控中心' : 'Open Monitoring'}
                          </button>
                        </div>

                        <div className="mt-5">
                          <div className="mb-2 flex items-center justify-between">
                            <p className="text-sm font-semibold text-[#0f172a]">{language === 'zh' ? '接口链路详情' : 'Interface Adjacencies'}</p>
                            <span className="text-xs text-black/35">{topologyDeviceLinks.length}</span>
                          </div>
                          <div className="space-y-2">
                            {topologyDeviceLinks.length > 0 ? topologyDeviceLinks.slice(0, 8).map((link) => {
                              const isSource = link.source_device_id === selectedTopologyDevice.id;
                              const peerName = isSource
                                ? (link.target_hostname || link.target_hostname_resolved || '')
                                : (link.source_hostname || link.source_hostname_resolved || '');
                              const localPort = formatTopologyPort(isSource ? link.source_port : link.target_port);
                              const remotePort = formatTopologyPort(isSource ? link.target_port : link.source_port);
                              const localTelemetry = formatTopologyInterfaceTelemetry(isSource ? link.source_interface_snapshot : link.target_interface_snapshot);
                              const remoteTelemetry = formatTopologyInterfaceTelemetry(isSource ? link.target_interface_snapshot : link.source_interface_snapshot);
                              const peerId = isSource ? link.target_device_id : link.source_device_id;
                              const linkKey = link.link_key || link.id;
                              const operationalTone = getTopologyOperationalTone(link.operational_state);
                              return (
                                <div
                                  key={linkKey}
                                  className={`w-full rounded-xl border px-3 py-3 text-left transition-all ${
                                    selectedTopologyLinkKey && linkKey === selectedTopologyLinkKey
                                      ? 'border-[#00bceb]/40 bg-[#00bceb]/6'
                                      : 'border-black/5 bg-slate-50 hover:border-[#00bceb]/30 hover:bg-[#00bceb]/5'
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <button
                                      type="button"
                                      onClick={() => setSelectedTopologyLinkKey(linkKey || null)}
                                      className="flex-1 text-left"
                                    >
                                      <div className="flex flex-wrap items-center gap-2">
                                        <p className="text-sm font-semibold text-[#0f172a]">{peerName || (language === 'zh' ? '对端设备' : 'Peer Device')}</p>
                                        <span className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${operationalTone.badge}`}>
                                          {formatTopologyOperationalState(link.operational_state)}
                                        </span>
                                      </div>
                                      <p className="mt-1 text-xs text-black/45">{language === 'zh' ? '本端接口' : 'Local'}: {localPort} · {localTelemetry}</p>
                                      <p className="text-xs text-black/45">{language === 'zh' ? '对端接口' : 'Remote'}: {remotePort} · {remoteTelemetry}</p>
                                      <p className="text-xs text-black/35">{language === 'zh' ? '最近发现' : 'Last seen'}: {formatTopologyLastSeen(link.last_seen)}</p>
                                    </button>
                                    <div className="flex items-center gap-2">
                                      <div className="flex flex-wrap justify-end gap-1">
                                        {link.evidence_sources.slice(0, 2).map((source) => (
                                          <span key={`${linkKey}-${source}`} className="rounded-full bg-slate-200 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-700">
                                            {formatTopologyEvidenceLabel(source)}
                                          </span>
                                        ))}
                                        {link.reverse_confirmed && (
                                          <span className="rounded-full bg-sky-100 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-sky-700">
                                            {language === 'zh' ? '双端确认' : 'Bidirectional'}
                                          </span>
                                        )}
                                      </div>
                                      {peerId && (
                                        <button
                                          type="button"
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            setSelectedTopologyDeviceId(peerId);
                                            setSelectedTopologyLinkKey(linkKey || null);
                                          }}
                                          className="text-[11px] font-semibold text-[#0284c7] hover:text-[#0369a1]"
                                        >
                                          {language === 'zh' ? '切到对端' : 'Open Peer'}
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            }) : (
                              <div className="rounded-xl border border-dashed border-black/10 bg-slate-50 px-3 py-4 text-sm text-black/45">
                                {language === 'zh' ? '当前节点暂无可展示的接口链路。' : 'No interface adjacency data is available for the selected node.'}
                              </div>
                            )}
                          </div>
                        </div>

                        {selectedTopologyLink && (
                          <div className={`mt-5 rounded-xl border p-3 ${getTopologyOperationalTone(selectedTopologyLink.operational_state).panel}`}>
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-700">{language === 'zh' ? '当前选中链路' : 'Selected Link'}</p>
                              <span className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${getTopologyOperationalTone(selectedTopologyLink.operational_state).badge}`}>
                                {formatTopologyOperationalState(selectedTopologyLink.operational_state)}
                              </span>
                            </div>
                            <div className="mt-2 space-y-1 text-sm text-slate-700">
                              <p><span className="font-semibold">{selectedTopologyLink.source_hostname || selectedTopologyLink.source_hostname_resolved || selectedTopologyLink.source_device_id}</span> · {formatTopologyPort(selectedTopologyLink.source_port)}</p>
                              <p><span className="font-semibold">{selectedTopologyLink.target_hostname || selectedTopologyLink.target_hostname_resolved || selectedTopologyLink.target_device_id}</span> · {formatTopologyPort(selectedTopologyLink.target_port)}</p>
                            </div>
                            <p className="mt-2 text-xs text-slate-500">{language === 'zh' ? '最近发现' : 'Last seen'}: {formatTopologyLastSeen(selectedTopologyLink.last_seen)}</p>
                            <p className="mt-2 text-xs text-slate-600">{selectedTopologyLink.operational_summary}</p>
                            <div className="mt-3 grid gap-2 md:grid-cols-2">
                              <div className="rounded-lg border border-white/70 bg-white/70 px-3 py-2">
                                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-black/35">{language === 'zh' ? '源接口遥测' : 'Source Telemetry'}</p>
                                <p className="mt-1 text-xs text-slate-700">{formatTopologyInterfaceTelemetry(selectedTopologyLink.source_interface_snapshot)}</p>
                              </div>
                              <div className="rounded-lg border border-white/70 bg-white/70 px-3 py-2">
                                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-black/35">{language === 'zh' ? '对端接口遥测' : 'Target Telemetry'}</p>
                                <p className="mt-1 text-xs text-slate-700">{formatTopologyInterfaceTelemetry(selectedTopologyLink.target_interface_snapshot)}</p>
                              </div>
                            </div>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              {(selectedTopologyLink.evidence_sources.length > 0 ? selectedTopologyLink.evidence_sources : ['lldp']).map((source) => (
                                <span key={`selected-link-${source}`} className="rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-700 ring-1 ring-black/5">
                                  {formatTopologyEvidenceLabel(source)}
                                </span>
                              ))}
                              <span className="rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-700 ring-1 ring-black/5">
                                {language === 'zh' ? `证据 ${Number(selectedTopologyLink.evidence_count || 0)}` : `Evidence ${Number(selectedTopologyLink.evidence_count || 0)}`}
                              </span>
                              {selectedTopologyLink.reverse_confirmed && (
                                <span className="rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-sky-700 ring-1 ring-sky-200">
                                  {language === 'zh' ? '双向确认' : 'Reverse Confirmed'}
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        <div className="mt-5">
                          <div className="mb-2 flex items-center justify-between">
                            <p className="text-sm font-semibold text-[#0f172a]">{language === 'zh' ? '直接邻居' : 'Direct Neighbors'}</p>
                            <span className="text-xs text-black/35">{topologyNeighborDevices.length}</span>
                          </div>
                          <div className="space-y-2">
                            {topologyNeighborDevices.length > 0 ? topologyNeighborDevices.slice(0, 6).map((device) => (
                              <button
                                key={device.id}
                                onClick={() => setSelectedTopologyDeviceId(device.id)}
                                className="flex w-full items-center justify-between rounded-xl border border-black/5 bg-slate-50 px-3 py-2 text-left transition-all hover:border-[#00bceb]/30 hover:bg-[#00bceb]/5"
                              >
                                <div>
                                  <p className="text-sm font-semibold text-[#0f172a]">{device.hostname}</p>
                                  <p className="text-xs text-black/40">{device.ip_address} · {device.role || '-'}</p>
                                </div>
                                <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${device.status === 'online' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                  {device.status}
                                </span>
                              </button>
                            )) : (
                              <div className="rounded-xl border border-dashed border-black/10 bg-slate-50 px-3 py-4 text-sm text-black/45">
                                {language === 'zh' ? '当前节点没有发现邻接关系，可能是边缘孤立设备或邻居发现尚未完成。' : 'No adjacent nodes were found for the current device. It may be isolated or discovery has not completed yet.'}
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    ) : null}
                  </div>

                  <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-semibold tracking-tight text-[#0f172a]">{language === 'zh' ? '优先关注' : 'Priority Watchlist'}</h3>
                      <AlertCircle size={16} className="text-amber-500" />
                    </div>
                    <div className="mt-4 space-y-2">
                      {topologyPriorityDevices.length > 0 ? topologyPriorityDevices.map((device) => (
                        <button
                          key={device.id}
                          onClick={() => setSelectedTopologyDeviceId(device.id)}
                          className="flex w-full items-center justify-between rounded-xl border border-black/5 bg-slate-50 px-3 py-2 text-left transition-all hover:border-[#00bceb]/30 hover:bg-[#00bceb]/5"
                        >
                          <div>
                            <p className="text-sm font-semibold text-[#0f172a]">{device.hostname}</p>
                            <p className="text-xs text-black/40">{device.site || '-'} · {device.role || '-'}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-semibold text-rose-600">{device.open_alert_count || 0} {language === 'zh' ? '告警' : 'alerts'}</p>
                            <p className="text-[11px] text-black/35">{device.status}</p>
                          </div>
                        </button>
                      )) : (
                        <div className="rounded-xl border border-dashed border-black/10 bg-slate-50 px-3 py-4 text-sm text-black/45">
                          {language === 'zh' ? '当前过滤范围内没有需要优先处置的节点。' : 'No high-priority devices in the current topology scope.'}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-semibold tracking-tight text-[#0f172a]">{language === 'zh' ? '孤立节点' : 'Orphan Devices'}</h3>
                      <span className="text-xs text-black/35">{topologyOrphanDevices.length}</span>
                    </div>
                    <div className="mt-4 space-y-2">
                      {topologyOrphanDevices.length > 0 ? topologyOrphanDevices.slice(0, 6).map((device) => (
                        <button
                          key={device.id}
                          onClick={() => setSelectedTopologyDeviceId(device.id)}
                          className="flex w-full items-center justify-between rounded-xl border border-black/5 bg-slate-50 px-3 py-2 text-left transition-all hover:border-[#00bceb]/30 hover:bg-[#00bceb]/5"
                        >
                          <div>
                            <p className="text-sm font-semibold text-[#0f172a]">{device.hostname}</p>
                            <p className="text-xs text-black/40">{device.ip_address}</p>
                          </div>
                          <span className="rounded-full bg-slate-200 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-700">
                            {device.site || (language === 'zh' ? '未分站点' : 'Unassigned')}
                          </span>
                        </button>
                      )) : (
                        <div className="rounded-xl border border-dashed border-black/10 bg-slate-50 px-3 py-4 text-sm text-black/45">
                          {language === 'zh' ? '当前视图下未发现孤立节点。' : 'No orphan devices in the current view.'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'automation' && automationPage === 'execute' && (
            <div className="h-full min-h-0 flex flex-col gap-4 relative">
              {/* ── Header ── */}
              <div className={sectionHeaderRowClass}>
                <div>
                  <h2 className="text-2xl font-medium tracking-tight">{t('directExecution')}</h2>
                  <p className="text-sm text-black/40">{language === 'zh' ? '选择场景，配置参数，批量下发到设备' : 'Select scenario, configure parameters, deploy to devices'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => navigate('/automation/history')}
                    className="px-3 py-2 text-xs font-semibold border border-black/10 rounded-lg hover:bg-black/5 transition-all"
                  >
                    {language === 'zh' ? '查看实时历史' : 'View Live History'}
                  </button>
                </div>
              </div>

              {/* ── 3-panel layout (flex, fixed side columns) ── */}
              <div className="flex-1 min-h-0 flex gap-4 overflow-hidden">
                {(() => {
                  const targetCount = batchMode ? batchDeviceIds.length : (selectedDevice ? 1 : 0);
                  const missingTarget = !hasQuickTargets;
                  const riskNeedsConfirm = quickPlaybookScenario?.risk === 'high' && !quickRiskConfirmed;
                  const hasMissingRequired = quickMissingRequiredFields.length > 0;
                  const previewLineCount = (['pre_check', 'execute', 'post_check', 'rollback'] as const)
                    .reduce((acc, phase) => acc + (quickPlaybookPreview?.[phase]?.length || 0), 0);
                  const isZh = language === 'zh';

                  const classifyVarGroup = (v: any) => {
                    const text = `${v?.key || ''} ${v?.label || ''}`.toLowerCase();
                    if (/ip|prefix|mask|gateway|network|neighbor|next_hop|peer/.test(text)) return 'address';
                    if (/interface|port|intf|vlan/.test(text)) return 'interface';
                    if (/asn|as\b|route|bgp|ospf|policy|metric|community/.test(text)) return 'routing';
                    return 'general';
                  };
                  const varGroupOrder = ['address', 'interface', 'routing', 'general'];
                  const varGroupLabel = (group: string) => {
                    if (group === 'address') return isZh ? '地址与邻居' : 'Address and Neighbors';
                    if (group === 'interface') return isZh ? '接口与二层' : 'Interfaces and L2';
                    if (group === 'routing') return isZh ? '路由与策略' : 'Routing and Policy';
                    return isZh ? '通用参数' : 'General Parameters';
                  };
                  const groupedVariables = (quickPlaybookScenario?.variables || []).reduce((acc: Record<string, any[]>, v: any) => {
                    const group = classifyVarGroup(v);
                    if (!acc[group]) acc[group] = [];
                    acc[group].push(v);
                    return acc;
                  }, {});

                  const blockingIssueItems: Array<{ message: string; severity: 'critical' | 'high' | 'medium'; score: number }> = [];
                  if (missingTarget) {
                    blockingIssueItems.push({
                      message: isZh ? '请先选择目标设备' : 'Select target device(s) first',
                      severity: 'critical',
                      score: 100,
                    });
                  }
                  if (quickHasMixedPlatforms) {
                    blockingIssueItems.push({
                      message: isZh ? '检测到多平台设备，请按平台分批执行' : 'Mixed platforms detected, split execution by platform',
                      severity: 'critical',
                      score: 90,
                    });
                  }
                  if (quickPlatformMismatch) {
                    blockingIssueItems.push({
                      message: isZh ? '该场景不支持当前设备平台' : 'Scenario does not support current device platform',
                      severity: 'high',
                      score: 80,
                    });
                  }
                  if (hasMissingRequired) {
                    blockingIssueItems.push({
                      message: isZh ? `缺少必填字段：${quickMissingRequiredFields.join('、')}` : `Missing required fields: ${quickMissingRequiredFields.join(', ')}`,
                      severity: 'high',
                      score: 70,
                    });
                  }
                  if (riskNeedsConfirm) {
                    blockingIssueItems.push({
                      message: isZh ? '请先确认高风险执行' : 'Confirm high-risk execution first',
                      severity: 'medium',
                      score: 60,
                    });
                  }

                  const blockingIssues = [...blockingIssueItems].sort((a, b) => b.score - a.score);
                  const executeDisabledReason = blockingIssues[0]?.message || '';
                  const advisoryNotes: string[] = [];
                  if (quickPlaybookDryRun) {
                    advisoryNotes.push(isZh ? '当前为 Validation 模式，仅校验不下发。' : 'Validation mode is enabled: this run will not push config changes.');
                  }
                  if (targetCount > 1 && quickPlaybookConcurrency > 1) {
                    advisoryNotes.push(isZh ? `当前并发为 ${quickPlaybookConcurrency}，建议先小批量验证。` : `Concurrency is set to ${quickPlaybookConcurrency}; validate with a smaller batch first.`);
                  }

                  return (
                    <>
                      {/* ══════════════════════════════════════════════════
                          PANEL 1 – Target Device (fixed 220px)
                      ══════════════════════════════════════════════════ */}
                      <div className="w-[220px] flex-shrink-0 flex flex-col bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
                        {/* header */}
                        <div className="px-3 py-3 border-b border-black/5 bg-black/[0.01] space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-black text-white text-[9px] font-bold">1</span>
                              <span className="text-[10px] font-bold uppercase tracking-widest text-black/50">
                                {isZh ? '目标设备' : 'Target'}
                              </span>
                            </div>
                            <button
                              onClick={() => { setBatchMode(v => !v); setBatchDeviceIds([]); }}
                              className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider transition-all ${batchMode ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-black/5 text-black/40 hover:bg-black/10'}`}
                            >
                              <Database size={9} /> {isZh ? '批量' : 'Batch'}
                            </button>
                          </div>
                          {targetCount > 0 && (
                            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-50 border border-emerald-100">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                              <span className="text-[10px] font-semibold text-emerald-700">
                                {batchMode
                                  ? (isZh ? `已选 ${targetCount} 台` : `${targetCount} selected`)
                                  : (selectedDevice?.hostname || '')}
                              </span>
                            </div>
                          )}
                          <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-black/25" size={12} />
                            <input
                              type="text"
                              placeholder={isZh ? '搜索设备...' : 'Search devices...'}
                              value={automationSearch}
                              onChange={(e) => setAutomationSearch(e.target.value)}
                              className="w-full pl-7 pr-2 py-1.5 bg-white border border-black/8 rounded-lg text-[11px] focus:border-black/20 outline-none"
                            />
                          </div>
                        </div>
                        {/* device list – grouped by online/offline */}
                        <div className="flex-1 min-h-0 overflow-auto p-2 space-y-0.5">
                          {(() => {
                            const filtered = devices.filter(d => d.hostname.toLowerCase().includes(automationSearch.toLowerCase()) || d.ip_address.includes(automationSearch));
                            const onlineDevices = filtered.filter(d => d.status === 'online');
                            const offlineDevices = filtered.filter(d => d.status !== 'online');
                            const renderDevice = (device: any) => {
                              const checked = batchDeviceIds.includes(device.id);
                              const isSelected = batchMode ? checked : selectedDevice?.id === device.id;
                              return (
                                <button
                                  key={device.id}
                                  onClick={() => {
                                    if (batchMode) {
                                      setBatchDeviceIds(prev => checked ? prev.filter(id => id !== device.id) : [...prev, device.id]);
                                    } else {
                                      if (selectedDevice?.id !== device.id) {
                                        setQuickQueryOutput('');
                                        setQuickQueryLabel('');
                                        setQuickQueryStructured(null);
                                        setQuickQueryView('terminal');
                                        setQuickQueryMaximized(false);
                                        setQuickQueryCommands([]);
                                      }
                                      setSelectedDevice(device);
                                    }
                                  }}
                                  className={`w-full px-2.5 py-2 rounded-xl text-left border transition-all ${isSelected
                                    ? (batchMode ? 'bg-amber-50 border-amber-200' : 'bg-black text-white border-black')
                                    : 'border-transparent hover:border-black/8 hover:bg-black/[0.02]'}`}
                                >
                                  <div className="flex items-center justify-between gap-1">
                                    <p className={`text-[11px] font-semibold truncate ${isSelected && !batchMode ? 'text-white' : 'text-black/80'}`}>
                                      {device.hostname}
                                    </p>
                                    <span className={`w-1.5 h-1.5 flex-shrink-0 rounded-full ${device.status === 'online' ? 'bg-emerald-500' : 'bg-red-400'}`} />
                                  </div>
                                  <p className={`text-[10px] font-mono mt-0.5 ${isSelected && !batchMode ? 'text-white/50' : 'text-black/35'}`}>
                                    {device.ip_address}
                                  </p>
                                </button>
                              );
                            };
                            return (
                              <>
                                {/* Online group */}
                                {onlineDevices.length > 0 && (
                                  <>
                                    <div className="flex items-center gap-1.5 px-2 pt-1 pb-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                                      <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-600/70">{isZh ? '在线' : 'Online'}</span>
                                      <span className="text-[9px] font-mono text-black/30">{onlineDevices.length}</span>
                                    </div>
                                    {onlineDevices.map(renderDevice)}
                                  </>
                                )}
                                {/* Offline group */}
                                {offlineDevices.length > 0 && (
                                  <>
                                    {onlineDevices.length > 0 && <div className="border-t border-black/5 my-1.5" />}
                                    <div className="flex items-center gap-1.5 px-2 pt-1 pb-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                                      <span className="text-[9px] font-bold uppercase tracking-widest text-red-500/70">{isZh ? '离线' : 'Offline'}</span>
                                      <span className="text-[9px] font-mono text-black/30">{offlineDevices.length}</span>
                                    </div>
                                    {offlineDevices.map(renderDevice)}
                                  </>
                                )}
                                {filtered.length === 0 && (
                                  <div className="text-center py-6 text-[10px] text-black/25">{isZh ? '无匹配设备' : 'No devices found'}</div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                        {/* Custom command button – bottom of device panel */}
                        <div className="flex-shrink-0 p-2 border-t border-black/5">
                          <button
                            type="button"
                            onClick={() => setShowCustomCommandModal(true)}
                            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#00bceb] text-white text-[11px] font-bold hover:bg-[#0096bd] transition-all"
                            title={isZh ? '快速新建自定义命令' : 'Quick create custom command'}
                          >
                            <Plus size={13} />
                            <span className="truncate">
                              {batchMode
                                ? (batchDeviceIds.length > 0
                                  ? (isZh ? `新建命令 (${batchDeviceIds.length}台)` : `New Cmd (${batchDeviceIds.length})`)
                                  : (isZh ? '新建命令' : 'New Cmd'))
                                : (selectedDevice?.hostname
                                  ? (isZh ? `命令 → ${selectedDevice.hostname}` : `Cmd → ${selectedDevice.hostname}`)
                                  : (isZh ? '新建命令' : 'New Cmd'))}
                            </span>
                          </button>
                        </div>
                      </div>

                      {/* ══════════════════════════════════════════════════
                          PANEL 2 – Scenario + Config (flex-1)
                      ══════════════════════════════════════════════════ */}
                      <div className="flex-1 min-w-0 flex flex-col gap-3 overflow-hidden">
                        {/* Scenario Explorer – collapses to compact bar when a scenario is selected */}
                        <div className="flex-shrink-0 bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
                          {quickPlaybookScenario ? (
                            /* Compact selected-scenario bar */
                            <div className="px-4 py-2.5 flex items-center gap-3">
                              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-black text-white text-[9px] font-bold flex-shrink-0">2</span>
                              <span className="text-base leading-none flex-shrink-0">{quickPlaybookScenario.icon}</span>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold truncate">{isZh ? quickPlaybookScenario.name_zh : quickPlaybookScenario.name}</p>
                              </div>
                              <span className={`flex-shrink-0 inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                                quickPlaybookScenario.risk === 'high' ? 'text-red-600 bg-red-50 border-red-200'
                                : quickPlaybookScenario.risk === 'medium' ? 'text-amber-600 bg-amber-50 border-amber-200'
                                : 'text-emerald-600 bg-emerald-50 border-emerald-200'
                              }`}>
                                <span className={`w-1 h-1 rounded-full ${
                                  quickPlaybookScenario.risk === 'high' ? 'bg-red-500' : quickPlaybookScenario.risk === 'medium' ? 'bg-amber-400' : 'bg-emerald-500'
                                }`} />
                                {quickPlaybookScenario.risk === 'high' ? (isZh ? '高危' : 'HIGH') : quickPlaybookScenario.risk === 'medium' ? (isZh ? '中等' : 'MED') : (isZh ? '低风' : 'LOW')}
                              </span>
                              <button
                                onClick={() => {
                                  setQuickPlaybookScenario(null);
                                  setQuickPlaybookPreview(null);
                                  setQuickPlaybookVars({});
                                  setQuickRiskConfirmed(false);
                                }}
                                className="flex-shrink-0 text-[10px] text-black/40 hover:text-black/70 border border-black/10 rounded-lg px-2 py-1 hover:bg-black/5 transition-all"
                              >
                                {isZh ? '重选' : 'Change'}
                              </button>
                            </div>
                          ) : (
                            /* Full scenario grid */
                            <>
                              <div className="px-4 py-3 border-b border-black/5 bg-black/[0.01] flex items-center justify-between gap-3">
                                <div className="flex items-center gap-1.5">
                                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-black text-white text-[9px] font-bold">2</span>
                                  <span className="text-[10px] font-bold uppercase tracking-widest text-black/50">
                                    {isZh ? '选择场景' : 'Scenario'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  <div className="relative flex-1 min-w-0">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-black/25" size={12} />
                                    <input
                                      type="text"
                                      value={scenarioSearch}
                                      onChange={(e) => setScenarioSearch(e.target.value)}
                                      placeholder={isZh ? '搜索场景...' : 'Search...'}
                                      className="w-full pl-7 pr-2 py-1.5 border border-black/8 rounded-lg text-[11px] outline-none focus:border-[#00bceb]/40"
                                    />
                                  </div>
                                  <button
                                    onClick={() => navigate('/automation/scenarios')}
                                    className="flex-shrink-0 text-[11px] font-semibold text-[#008bb0] hover:underline"
                                  >
                                    {isZh ? '场景库 →' : 'Library →'}
                                  </button>
                                </div>
                              </div>
                              <div className="p-3 grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 max-h-[190px] overflow-auto content-start">
                                {filteredScenarios.slice(0, 16).map((sc: any) => {
                                  const riskColor = sc.risk === 'high'
                                    ? 'text-red-600 bg-red-50 border-red-200'
                                    : sc.risk === 'medium'
                                      ? 'text-amber-600 bg-amber-50 border-amber-200'
                                      : 'text-emerald-600 bg-emerald-50 border-emerald-200';
                                  const riskDot = sc.risk === 'high' ? 'bg-red-500' : sc.risk === 'medium' ? 'bg-amber-400' : 'bg-emerald-500';
                                  const riskStripe = sc.risk === 'high' ? 'border-l-red-400' : sc.risk === 'medium' ? 'border-l-amber-400' : 'border-l-emerald-400';
                                  return (
                                    <button
                                      key={sc.id}
                                      onClick={() => openQuickPlaybookModal(sc)}
                                      className={`group p-2.5 rounded-xl border border-l-[3px] text-left transition-all border-black/8 hover:border-[#00bceb]/30 hover:bg-[#00bceb]/5 ${riskStripe}`}
                                    >
                                      <div className="flex items-start justify-between gap-1 mb-1.5">
                                        <span className="text-base leading-none">{sc.icon}</span>
                                        <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${riskColor}`}>
                                          <span className={`w-1 h-1 rounded-full ${riskDot}`} />
                                          {sc.risk === 'high' ? (isZh ? '高危' : 'HIGH') : sc.risk === 'medium' ? (isZh ? '中等' : 'MED') : (isZh ? '低风' : 'LOW')}
                                        </span>
                                      </div>
                                      <p className="text-[11px] font-bold leading-snug line-clamp-1">{isZh ? sc.name_zh : sc.name}</p>
                                      <p className="text-[10px] text-black/40 mt-0.5 line-clamp-1">{isZh ? sc.description_zh : sc.description}</p>
                                    </button>
                                  );
                                })}
                                {filteredScenarios.length === 0 && (
                                  <div className="col-span-4 text-center py-8 text-xs text-black/35">
                                    {isZh ? '没有匹配的场景' : 'No matching scenarios'}
                                  </div>
                                )}
                              </div>
                            </>
                          )}
                        </div>

                        {/* Config / Variables area – flex-1 */}
                        <div className="flex-1 min-h-0 bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden flex flex-col">
                          {quickPlaybookScenario ? (
                            <>
                              {/* Sub-header: scenario identity + step 3 badge */}
                              <div className="flex-shrink-0 px-4 py-3 border-b border-black/5 bg-black/[0.01] flex items-center gap-3">
                                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-black text-white text-[9px] font-bold flex-shrink-0">3</span>
                                <span className="text-base leading-none">{quickPlaybookScenario.icon}</span>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-bold truncate">{isZh ? quickPlaybookScenario.name_zh : quickPlaybookScenario.name}</p>
                                  <p className="text-[10px] text-black/40 truncate">{isZh ? quickPlaybookScenario.description_zh : quickPlaybookScenario.description}</p>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <span className="text-[10px] text-black/35 font-mono">{getPlatformLabel(quickPlaybookPlatform)}</span>
                                  <select
                                    value={quickPlaybookConcurrency}
                                    onChange={(e) => setQuickPlaybookConcurrency(Number(e.target.value))}
                                    className="px-2 py-1 border border-black/10 rounded-lg text-[11px] bg-white outline-none"
                                    title={isZh ? '并发数' : 'Concurrency'}
                                  >
                                    {[1, 2, 3, 5, 10].map(n => <option key={n} value={n}>×{n}</option>)}
                                  </select>
                                  {/* Concurrency only – dryRun is now handled by the two action buttons */}
                                </div>
                              </div>

                              {/* Scrollable variable body – fills all remaining height */}
                              <div className="flex-1 min-h-0 overflow-auto p-4 space-y-4">
                                {(quickPlaybookScenario.variables || []).length > 0 ? (
                                  varGroupOrder
                                    .filter((group) => (groupedVariables[group] || []).length > 0)
                                    .map((group) => (
                                      <div key={group}>
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-black/35 mb-2">{varGroupLabel(group)}</p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                          {(groupedVariables[group] || []).map((v: any) => (
                                            <div key={v.key} className="rounded-xl border border-black/8 p-3 bg-black/[0.01]">
                                              <div className="flex items-center justify-between gap-2 mb-1.5">
                                                <label className="text-[11px] font-semibold text-black/75 truncate">{isZh ? (v.label_zh || v.label || v.key) : (v.label || v.key)}</label>
                                                <span className={`flex-shrink-0 text-[9px] px-1.5 py-0.5 rounded-full font-bold ${v.required ? 'bg-red-100 text-red-600' : 'bg-black/8 text-black/40'}`}>
                                                  {v.required ? (isZh ? '必填' : 'REQ') : (isZh ? '选填' : 'OPT')}
                                                </span>
                                              </div>
                                              <input
                                                type={v.type === 'number' ? 'number' : 'text'}
                                                value={quickPlaybookVars[v.key] || ''}
                                                onChange={(e) => setQuickPlaybookVars(prev => ({ ...prev, [v.key]: e.target.value }))}
                                                placeholder={v.platform_hints?.[quickPlaybookPlatform] || v.placeholder || v.key}
                                                className={`w-full px-2.5 py-1.5 border rounded-lg text-xs outline-none bg-white transition-colors ${quickMissingRequiredFields.includes(v.key) ? 'border-red-300 focus:border-red-400' : 'border-black/10 focus:border-[#00bceb]/40'}`}
                                              />
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    ))
                                ) : (
                                  <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs text-emerald-700">
                                    <span>✓</span>
                                    <span>{isZh ? '该场景无需填写变量，可直接执行。' : 'No variables required. Ready to run.'}</span>
                                  </div>
                                )}
                              </div>
                            </>
                          ) : (quickQueryRunning || quickQueryOutput) ? (
                            /* ── Terminal output in center panel ── */
                            <>
                              {quickQueryMaximized && (
                                <div className="fixed inset-0 z-[70] bg-[#020817]/72 backdrop-blur-sm" />
                              )}
                              <div className={quickQueryMaximized
                                ? 'fixed left-1/2 top-1/2 z-[80] flex h-[84vh] w-[min(1280px,90vw)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-3xl border border-white/10 bg-[linear-gradient(180deg,#0d1117_0%,#151b23_100%)] shadow-[0_32px_120px_rgba(0,0,0,0.6)]'
                                : 'flex flex-1 flex-col overflow-hidden rounded-b-2xl bg-[linear-gradient(180deg,#0d1117_0%,#151b23_100%)]'}>
                              {/* Terminal Title Bar */}
                              <div className="shrink-0 flex items-center justify-between border-b border-white/[0.06] bg-[linear-gradient(90deg,#1c2030_0%,#161b22_100%)] px-4 py-2.5">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="flex gap-[6px] mr-1 shrink-0">
                                    <span className="w-[10px] h-[10px] rounded-full bg-[#ff5f57]/80" />
                                    <span className="w-[10px] h-[10px] rounded-full bg-[#febc2e]/80" />
                                    <span className="w-[10px] h-[10px] rounded-full bg-[#28c840]/80" />
                                  </div>
                                  {quickQueryRunning
                                    ? <RotateCcw size={13} className="animate-spin text-[#00bceb] shrink-0" />
                                    : <Monitor size={13} className="text-emerald-400 shrink-0" />}
                                  <span className="text-[12px] font-bold text-white/90 truncate">{quickQueryLabel}</span>
                                  <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-md bg-white/[0.06] text-white/35 font-mono border border-white/[0.04]">{selectedDevice?.hostname || devices.find(d => d.id === batchDeviceIds[0])?.hostname || ''}</span>
                                  {!quickQueryRunning && quickQueryStructured && (
                                    <div className="ml-2 flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.04] p-1">
                                      <button
                                        onClick={() => setQuickQueryView('terminal')}
                                        className={`rounded-md px-2 py-1 text-[10px] font-bold uppercase transition-all ${quickQueryView === 'terminal' ? 'bg-white/14 text-white' : 'text-white/45 hover:text-white/75'}`}
                                        title={isZh ? '终端回显' : 'Terminal Output'}
                                      >
                                        {isZh ? '终端' : 'Terminal'}
                                      </button>
                                      <button
                                        onClick={() => setQuickQueryView('table')}
                                        className={`rounded-md px-2 py-1 text-[10px] font-bold uppercase transition-all ${quickQueryView === 'table' ? 'bg-white/14 text-white' : 'text-white/45 hover:text-white/75'}`}
                                        title={isZh ? '结构化表格' : 'Structured Table'}
                                      >
                                        {isZh ? '表格' : 'Table'}
                                      </button>
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-0.5 shrink-0">
                                  {!quickQueryRunning && quickQueryOutput && (
                                    <button
                                      onClick={() => setQuickQueryMaximized((current) => !current)}
                                      className="text-white/25 hover:text-white/60 p-2 rounded-lg hover:bg-white/[0.06] transition-all"
                                      title={quickQueryMaximized ? (isZh ? '还原' : 'Restore') : (isZh ? '放大' : 'Maximize')}
                                    >
                                      {quickQueryMaximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                                    </button>
                                  )}
                                  {!quickQueryRunning && quickQueryStructured && quickQueryTable.records.length > 0 && (
                                    <button
                                      onClick={() => exportQuickQueryTable(quickQueryCommands)}
                                      className="text-white/25 hover:text-white/60 p-2 rounded-lg hover:bg-white/[0.06] transition-all"
                                      title={isZh ? '导出 Excel' : 'Export Excel'}
                                    >
                                      <Download size={13} />
                                    </button>
                                  )}
                                  {!quickQueryRunning && quickQueryOutput && (
                                    <button
                                      onClick={async () => { const ok = await copyTextWithFallback(quickQueryOutput); showToast(ok ? (isZh ? '已复制' : 'Copied') : (isZh ? '复制失败' : 'Copy failed'), ok ? 'success' : 'error'); }}
                                      className="text-white/25 hover:text-white/60 p-2 rounded-lg hover:bg-white/[0.06] transition-all"
                                      title={isZh ? '复制' : 'Copy'}
                                    >
                                      <Copy size={13} />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => { setQuickQueryOutput(''); setQuickQueryLabel(''); setQuickQueryStructured(null); setQuickQueryView('terminal'); setQuickQueryMaximized(false); setQuickQueryCommands([]); }}
                                    className="text-white/25 hover:text-white/60 p-2 rounded-lg hover:bg-white/[0.06] transition-all"
                                    title={isZh ? '关闭' : 'Close'}
                                  >
                                    <X size={13} />
                                  </button>
                                </div>
                              </div>
                              {!quickQueryRunning && quickQueryCommands.length > 0 && (
                                <div className="shrink-0 border-b border-white/[0.05] bg-[linear-gradient(180deg,rgba(16,23,34,0.92)_0%,rgba(9,14,22,0.82)_100%)] px-4 py-3">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2">
                                        <span className="inline-flex items-center rounded-full border border-cyan-400/18 bg-cyan-400/10 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-cyan-100/90">
                                          {isZh ? '实际执行命令' : 'Executed Commands'}
                                        </span>
                                        <span className="text-[10px] text-white/38">
                                          {isZh ? `${quickQueryCommands.length} 条` : `${quickQueryCommands.length} command${quickQueryCommands.length > 1 ? 's' : ''}`}
                                        </span>
                                      </div>
                                      <div className="mt-2 flex flex-col gap-1.5">
                                        {quickQueryCommands.map((command, index) => (
                                          <div
                                            key={`${command}-${index}`}
                                            className="overflow-hidden rounded-xl border border-cyan-400/14 bg-[linear-gradient(180deg,rgba(3,11,21,0.96)_0%,rgba(7,18,32,0.92)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                                          >
                                            <div className="flex items-stretch">
                                              <span className="w-1 shrink-0 bg-[linear-gradient(180deg,rgba(34,211,238,0.95)_0%,rgba(6,182,212,0.45)_100%)]" />
                                              <div className="min-w-0 flex-1 px-3 py-2">
                                                <div className="mb-1 flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.16em] text-cyan-200/55">
                                                  <span>{isZh ? '命令' : 'Command'}</span>
                                                  <span className="text-white/18">#{index + 1}</span>
                                                </div>
                                                <code className="block overflow-x-auto text-[11px] font-medium leading-relaxed text-[#F7FBFF]">
                                                  {command}
                                                </code>
                                              </div>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                    <button
                                      onClick={async () => {
                                        const ok = await copyTextWithFallback(quickQueryCommands.join('\n'));
                                        showToast(ok ? (isZh ? '命令已复制' : 'Commands copied') : (isZh ? '复制失败' : 'Copy failed'), ok ? 'success' : 'error');
                                      }}
                                      className="shrink-0 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-white/60 transition-all hover:bg-white/[0.08] hover:text-white"
                                      title={isZh ? '复制命令' : 'Copy commands'}
                                    >
                                      {isZh ? '复制命令' : 'Copy'}
                                    </button>
                                  </div>
                                </div>
                              )}
                              {/* Terminal Output — fills remaining space */}
                              <div className="flex-1 overflow-auto terminal-scroll">
                                {quickQueryRunning ? (
                                  <div className="flex flex-col items-center justify-center py-16 gap-4">
                                    <div className="w-10 h-10 rounded-full border-2 border-[#00bceb]/20 border-t-[#00bceb] animate-spin" />
                                    <span className="text-xs text-white/25 font-mono">{isZh ? '正在查询...' : 'Querying...'}</span>
                                  </div>
                                ) : quickQueryStructured && quickQueryView === 'table' ? (
                                  <div className="p-5 space-y-4">
                                    <div className="flex items-center justify-between gap-3 border-b border-white/[0.04] pb-3">
                                      <div>
                                        <p className="text-[12px] font-bold text-white/90">{quickQueryLabel}</p>
                                        <p className="mt-1 text-[10px] text-white/35">
                                          {quickQueryTable.category?.parser || 'ntc-templates'} · {isZh ? '记录数' : 'Records'} {Number(quickQueryTable.category?.count || 0)}
                                        </p>
                                      </div>
                                      {quickQueryTable.category?.parse_errors?.length > 0 && (
                                        <span className="rounded-full bg-amber-500/12 px-2 py-1 text-[10px] font-bold uppercase text-amber-300">
                                          {isZh ? '部分回退' : 'Partial Fallback'}
                                        </span>
                                      )}
                                    </div>

                                    {quickQueryTable.records.length > 0 ? (
                                      <div className={quickQueryMaximized
                                        ? 'overflow-auto rounded-xl border border-white/[0.06] bg-black/20 max-h-[calc(84vh-12rem)]'
                                        : 'overflow-auto rounded-xl border border-white/[0.06] bg-black/20 min-h-[24rem] max-h-[58vh]'}>
                                        <table className="min-w-full text-left text-[12px] text-[#d8e2eb]">
                                          <thead className="sticky top-0 bg-[#101722]">
                                            <tr className="border-b border-white/[0.06]">
                                              {quickQueryTable.columns.map((column) => (
                                                <th key={column} className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white/45 whitespace-nowrap">
                                                  {column}
                                                </th>
                                              ))}
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {quickQueryTable.records.map((record: Record<string, any>, index: number) => (
                                              <tr key={`quick-row-${index}`} className="border-b border-white/[0.04] last:border-b-0 hover:bg-white/[0.03]">
                                                {quickQueryTable.columns.map((column) => {
                                                  const value = record?.[column];
                                                  return (
                                                    <td key={`${index}-${column}`} className="px-3 py-2 align-top text-[11px] text-[#d8e2eb] whitespace-nowrap">
                                                      {value == null || value === '' ? <span className="text-white/20">-</span> : String(value)}
                                                    </td>
                                                  );
                                                })}
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    ) : (
                                      <div className="rounded-xl border border-dashed border-white/[0.08] bg-white/[0.02] px-4 py-5 text-sm text-white/45">
                                        {isZh ? '当前没有结构化记录，可切回终端查看原始回显。' : 'No structured records are available for this query. Switch back to Terminal for raw output.'}
                                      </div>
                                    )}

                                    {quickQueryTable.category?.parse_errors?.length > 0 && (
                                      <div className="rounded-xl border border-amber-400/20 bg-amber-400/8 px-4 py-3 text-xs text-amber-200">
                                        <p className="font-bold uppercase tracking-[0.14em]">{isZh ? '解析提示' : 'Parsing Notes'}</p>
                                        <div className="mt-2 space-y-1">
                                          {quickQueryTable.category.parse_errors.map((item: any, index: number) => (
                                            <div key={`parse-error-${index}`}>{item.command}: {item.error}</div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="p-5">
                                    <div className="mb-3 flex items-start gap-2 border-b border-white/[0.04] pb-3">
                                      <span className="text-emerald-400/60 font-mono font-bold text-[11px] mt-0.5 select-none shrink-0">❯</span>
                                      <code className="text-[11px] font-mono text-emerald-400/40 leading-relaxed whitespace-pre-wrap">{quickQueryLabel}</code>
                                    </div>
                                    <pre className="text-[13px] font-mono text-[#e6edf3] leading-[1.75] whitespace-pre-wrap break-all select-text">{quickQueryOutput}</pre>
                                  </div>
                                )}
                              </div>
                              </div>
                            </>
                          ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 p-6">
                              <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-black/[0.03]">
                                <Zap size={24} strokeWidth={1.2} className="text-black/25" />
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-black/40">{isZh ? '从上方选择场景' : 'Select a scenario above'}</p>
                                <p className="text-xs text-black/30 mt-1">{isZh ? '选中场景后在此填写变量并执行' : 'Fill in variables and run from this panel'}</p>
                              </div>
                              {/* Scenario risk breakdown */}
                              <div className="w-full max-w-xs grid grid-cols-3 gap-2 mt-2">
                                {[
                                  { risk: 'low', color: 'emerald', label: isZh ? '低风险' : 'Low Risk' },
                                  { risk: 'medium', color: 'amber', label: isZh ? '中等' : 'Medium' },
                                  { risk: 'high', color: 'red', label: isZh ? '高危' : 'High Risk' },
                                ].map(r => {
                                  const count = filteredScenarios.filter((s: any) => s.risk === r.risk).length;
                                  return (
                                    <div key={r.risk} className={`rounded-xl border p-2.5 text-center ${
                                      r.color === 'emerald' ? 'border-emerald-100 bg-emerald-50/50' :
                                      r.color === 'amber' ? 'border-amber-100 bg-amber-50/50' :
                                      'border-red-100 bg-red-50/50'
                                    }`}>
                                      <p className={`text-lg font-bold ${
                                        r.color === 'emerald' ? 'text-emerald-600' :
                                        r.color === 'amber' ? 'text-amber-600' :
                                        'text-red-600'
                                      }`}>{count}</p>
                                      <p className="text-[10px] text-black/40">{r.label}</p>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* ══════════════════════════════════════════════════
                          PANEL 3 – Execution Decision (fixed 360px)
                      ══════════════════════════════════════════════════ */}
                      <div className="w-[360px] flex-shrink-0 flex flex-col bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
                        {/* Header: scenario risk level + target summary */}
                        <div className="px-4 py-3 border-b border-black/5">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-black text-white text-[9px] font-bold flex-shrink-0">✓</span>
                              <span className="text-[10px] font-bold uppercase tracking-widest text-black/50">
                                {isZh ? '执行决策' : 'Execution Decision'}
                              </span>
                            </div>
                            <button
                              onClick={() => setShowCustomCommandModal(true)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[#00bceb]/25 bg-[#00bceb]/8 text-[#007d9d] text-[10px] font-bold hover:bg-[#00bceb]/14 transition-all"
                              title={isZh ? '在当前设备上下文直接编写命令' : 'Open command composer in current device context'}
                            >
                              <FileText size={11} />
                              {targetCount > 0 ? (isZh ? '对当前目标下命令' : 'Command Target') : (isZh ? '自定义命令' : 'Custom')}
                            </button>
                          </div>
                          <div className="mt-2 flex items-center justify-between gap-2">
                            {/* Scenario inherent risk badge */}
                            {quickPlaybookScenario ? (
                              <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                                quickPlaybookScenario.risk === 'high'
                                  ? 'bg-red-50 border-red-200 text-red-700'
                                  : quickPlaybookScenario.risk === 'medium'
                                    ? 'bg-amber-50 border-amber-200 text-amber-700'
                                    : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${
                                  quickPlaybookScenario.risk === 'high' ? 'bg-red-500' : quickPlaybookScenario.risk === 'medium' ? 'bg-amber-400' : 'bg-emerald-500'
                                }`} />
                                {quickPlaybookScenario.risk === 'high'
                                  ? (isZh ? '高危场景' : 'HIGH RISK')
                                  : quickPlaybookScenario.risk === 'medium'
                                    ? (isZh ? '中等风险' : 'MED RISK')
                                    : (isZh ? '低风险' : 'LOW RISK')}
                              </span>
                            ) : (
                              <span className="text-[10px] text-black/30">{isZh ? '未选场景' : 'No scenario'}</span>
                            )}
                          </div>
                          {/* Target / mode summary */}
                          <div className="mt-2 flex items-center gap-2 flex-wrap">
                            <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full ${targetCount > 0 ? 'bg-black text-white' : 'bg-black/8 text-black/40'}`}>
                              {targetCount > 0
                                ? (batchMode ? `${targetCount} ${isZh ? '台' : 'devices'}` : (selectedDevice?.hostname || ''))
                                : (isZh ? '未选设备' : 'No device')}
                            </span>
                            {quickPlaybookDryRun && (
                              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold">
                                DRY-RUN
                              </span>
                            )}
                            {quickPlaybookConcurrency > 1 && (
                              <span className="text-[10px] text-black/40">×{quickPlaybookConcurrency} concurrency</span>
                            )}
                          </div>
                        </div>

                        {/* Body – context-aware: execution result → stats when idle → execution details when scenario selected */}
                        {(isQuickPlaybookRunning || quickExecutionResult) ? (
                          (() => {
                            const completeMsg = wsCompleteMsg;
                            const deviceEntries = Object.entries(deviceStatusMap);
                            const scenarioTitle = quickExecutionResult
                              ? (isZh ? (quickExecutionResult.scenarioNameZh || quickExecutionResult.scenarioName) : quickExecutionResult.scenarioName)
                              : (quickPlaybookScenario ? (isZh ? (quickPlaybookScenario.name_zh || quickPlaybookScenario.name) : quickPlaybookScenario.name) : '');
                            return (
                              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                                {/* Status header */}
                                <div className={`px-4 py-3 border-b flex items-center gap-2 ${completeMsg ? (completeMsg.status === 'success' ? 'bg-emerald-50 border-emerald-100' : completeMsg.status === 'partial_failure' ? 'bg-amber-50 border-amber-100' : 'bg-red-50 border-red-100') : 'bg-blue-50 border-blue-100'}`}>
                                  {isQuickPlaybookRunning ? (
                                    <RotateCcw size={14} className="text-blue-500 animate-spin shrink-0" />
                                  ) : completeMsg?.status === 'success' ? (
                                    <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                                  ) : completeMsg?.status === 'partial_failure' ? (
                                    <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                                  ) : (
                                    <XCircle size={14} className="text-red-500 shrink-0" />
                                  )}
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold text-black/70 truncate">{scenarioTitle}</p>
                                    <p className="text-[10px] text-black/40">
                                      {isQuickPlaybookRunning
                                        ? (isZh ? '正在执行...' : 'Executing...')
                                        : completeMsg
                                          ? `${isZh ? '完成' : 'Done'} · ${completeMsg.summary?.success ?? 0}✓ ${completeMsg.summary?.failed ?? 0}✗`
                                          : (isZh ? '已提交' : 'Submitted')}
                                    </p>
                                  </div>
                                  {quickExecutionResult?.dryRun && (
                                    <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 shrink-0">DRY</span>
                                  )}
                                </div>
                                {/* Per-device cards */}
                                <div className="flex-1 min-h-0 overflow-auto p-3 space-y-2">
                                  {deviceEntries.length === 0 && isQuickPlaybookRunning && (
                                    <div className="flex flex-col items-center justify-center h-24 gap-2">
                                      <RotateCcw size={20} className="text-blue-400 animate-spin" />
                                      <p className="text-xs text-black/30">{isZh ? '等待设备响应...' : 'Waiting for device response...'}</p>
                                    </div>
                                  )}
                                  {deviceEntries.map(([devId, dev]: [string, { hostname: string; status: string; phases: Record<string, { success: boolean; output?: string }>; error?: string }]) => (
                                    <div key={devId} className={`rounded-xl border p-3 space-y-1.5 ${dev.status === 'running' ? 'border-blue-100 bg-blue-50/40' : dev.status === 'success' ? 'border-emerald-100 bg-emerald-50/40' : dev.status === 'partial_failure' ? 'border-amber-100 bg-amber-50/40' : 'border-red-100 bg-red-50/40'}`}>
                                      <div className="flex items-center gap-2">
                                        {dev.status === 'running' ? (
                                          <RotateCcw size={11} className="text-blue-500 animate-spin shrink-0" />
                                        ) : dev.status === 'success' ? (
                                          <CheckCircle2 size={11} className="text-emerald-500 shrink-0" />
                                        ) : dev.status === 'partial_failure' ? (
                                          <AlertTriangle size={11} className="text-amber-500 shrink-0" />
                                        ) : (
                                          <XCircle size={11} className="text-red-500 shrink-0" />
                                        )}
                                        <span className="text-xs font-semibold text-black/70 truncate">{dev.hostname}</span>
                                      </div>
                                      {Object.keys(dev.phases).length > 0 && (
                                        <div className="flex flex-wrap gap-1 pl-4">
                                          {Object.entries(dev.phases).map(([phase, ph]) => (
                                            <span key={phase} className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${ph.success ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                              {ph.success ? '✓' : '✗'} {phase}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                      {dev.error && (
                                        <p className="text-[10px] text-red-600 pl-4 font-mono truncate">{dev.error}</p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                                {/* Bottom buttons — shown only when execution is complete */}
                                {!isQuickPlaybookRunning && (
                                  <div className="p-3 pt-2 space-y-1.5 border-t border-black/5">
                                    <button
                                      onClick={() => navigate('/automation/history')}
                                      className="w-full px-3 py-2 rounded-lg bg-[#00bceb] text-white text-xs font-bold hover:bg-[#0096bd] transition-all flex items-center justify-center gap-2"
                                    >
                                      <ExternalLink size={11} />
                                      {isZh ? '查看完整历史' : 'View Full History'}
                                    </button>
                                    <button
                                      onClick={() => { setWsMessages([]); setDeviceStatusMap({}); setWsCompleteMsg(null); setQuickExecutionResult(null); setExecutionStatus('idle'); setQuickPlaybookScenario(null); }}
                                      className="w-full px-3 py-2 rounded-lg border border-black/10 text-xs font-semibold text-black/50 hover:bg-black/5 transition-all"
                                    >
                                      {isZh ? '新建任务' : 'New Task'}
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })()
                        ) : !quickPlaybookScenario ? (
                          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                            {/* Quick Query section */}
                            {(() => {
                              const plat = (selectedDevice?.platform || (batchMode && batchDeviceIds.length === 1 ? devices.find(d => d.id === batchDeviceIds[0])?.platform : '') || '').toLowerCase();
                              const isCisco = plat.includes('cisco') || plat.includes('arista') || plat.includes('rgos');
                              const isHuawei = plat.includes('huawei') || plat.includes('h3c') || plat.includes('ce_');
                              const isJuniper = plat.includes('juniper') || plat.includes('junos');
                              const presets: { icon: string; label: string; labelEn: string; cmds: string; group: string; operationalCategory?: string }[] = [
                                { icon: '📡', label: '接口状态', labelEn: 'Interfaces', group: 'net', operationalCategory: 'interfaces', cmds: isCisco ? 'show ip interface brief' : isHuawei ? 'display interface brief' : isJuniper ? 'show interfaces terse' : 'show ip interface brief' },
                                { icon: '📋', label: 'ARP表', labelEn: 'ARP Table', group: 'net', operationalCategory: 'arp', cmds: isCisco ? 'show arp' : isHuawei ? 'display arp' : isJuniper ? 'show arp' : 'show arp' },
                                { icon: '🏷️', label: 'MAC表', labelEn: 'MAC Table', group: 'net', operationalCategory: 'mac_table', cmds: isCisco ? 'show mac address-table' : isHuawei ? 'display mac-address' : isJuniper ? 'show ethernet-switching table' : 'show mac address-table' },
                                { icon: '📊', label: 'VLAN', labelEn: 'VLAN', group: 'net', cmds: isCisco ? 'show vlan brief' : isHuawei ? 'display vlan' : isJuniper ? 'show vlans' : 'show vlan brief' },
                                { icon: '📌', label: 'LLDP邻居', labelEn: 'LLDP', group: 'net', operationalCategory: 'neighbors', cmds: isCisco ? 'show lldp neighbors' : isHuawei ? 'display lldp neighbor brief' : isJuniper ? 'show lldp neighbors' : 'show lldp neighbors' },
                                { icon: '🗺️', label: '路由表', labelEn: 'Routes', group: 'route', operationalCategory: 'routing_table', cmds: isCisco ? 'show ip route' : isHuawei ? 'display ip routing-table' : isJuniper ? 'show route' : 'show ip route' },
                                { icon: '🔗', label: 'BGP邻居', labelEn: 'BGP Peers', group: 'route', operationalCategory: 'bgp', cmds: isCisco ? 'show bgp summary' : isHuawei ? 'display bgp peer' : isJuniper ? 'show bgp summary' : 'show bgp summary' },
                                { icon: '🔍', label: 'OSPF邻居', labelEn: 'OSPF Nbrs', group: 'route', operationalCategory: 'ospf', cmds: isCisco ? 'show ip ospf neighbor' : isHuawei ? 'display ospf peer brief' : isJuniper ? 'show ospf neighbor' : 'show ip ospf neighbor' },
                                { icon: '🏥', label: '设备信息', labelEn: 'Version', group: 'sys', cmds: isCisco ? 'show version' : isHuawei ? 'display version' : isJuniper ? 'show version' : 'show version' },
                                { icon: '📝', label: '日志', labelEn: 'Logs', group: 'sys', cmds: isCisco ? 'show logging | tail 30' : isHuawei ? 'display logbuffer last 30' : isJuniper ? 'show log messages | last 30' : 'show logging | tail 30' },
                                { icon: '⏱️', label: '运行时间', labelEn: 'Uptime', group: 'sys', cmds: isCisco ? 'show uptime' : isHuawei ? 'display clock\ndisplay version | include uptime' : isJuniper ? 'show system uptime' : 'show uptime' },
                                { icon: '💾', label: '运行配置', labelEn: 'Running Config', group: 'sys', cmds: isCisco ? 'show running-config' : isHuawei ? 'display current-configuration' : isJuniper ? 'show configuration' : 'show running-config' },
                              ];
                              const userSavedCmds: { icon: string; label: string; labelEn: string; cmds: string; operationalCategory?: string }[] = (() => {
                                try { return JSON.parse(localStorage.getItem('quickQuerySaved') || '[]'); } catch { return []; }
                              })();
                              const allCmds = [...presets, ...userSavedCmds.map(c => ({ ...c, group: 'custom' }))];
                              const hasDevice = !!(selectedDevice || (batchMode && batchDeviceIds.length === 1));
                              const deviceName = selectedDevice?.hostname || devices.find(d => d.id === batchDeviceIds[0])?.hostname || '';

                              // ═══════════════════════════════════════════
                              // ── CATEGORIZED QUERY GRID MODE ──
                              // ═══════════════════════════════════════════
                              const categoryGroups = [
                                { key: 'net', label: isZh ? '🌐 网络基础' : '🌐 Network', accentClass: 'query-accent-net' },
                                { key: 'route', label: isZh ? '🔀 路由协议' : '🔀 Routing', accentClass: 'query-accent-route' },
                                { key: 'sys', label: isZh ? '🖥️ 系统运维' : '🖥️ System', accentClass: 'query-accent-sys' },
                                ...(userSavedCmds.length > 0 ? [{ key: 'custom', label: isZh ? '⭐ 自定义' : '⭐ Custom', accentClass: 'query-accent-custom' }] : []),
                              ];

                              return (
                                <div className="flex-1 overflow-auto p-4 space-y-4">
                                  {/* Header */}
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2.5">
                                      <div className="w-1 h-4 rounded-full bg-[#00bceb]" />
                                      <span className="text-xs font-bold text-black/70">{isZh ? '快捷查询' : 'Quick Query'}</span>
                                    </div>
                                    {hasDevice && (
                                      <span className="text-[10px] px-2.5 py-1 rounded-lg bg-gradient-to-r from-[#00bceb]/10 to-[#00bceb]/5 text-[#0087a9] font-mono font-bold border border-[#00bceb]/10">
                                        {deviceName}
                                      </span>
                                    )}
                                  </div>

                                  {!hasDevice ? (
                                    <div className="rounded-2xl border-2 border-dashed border-black/8 p-8 text-center">
                                      <Server size={28} strokeWidth={1.2} className="mx-auto mb-3 text-black/10" />
                                      <p className="text-sm text-black/30 font-medium">{isZh ? '← 先在左侧选择一台设备' : '← Select a device first'}</p>
                                    </div>
                                  ) : (
                                    <>
                                      {categoryGroups.map(grp => {
                                        const items = allCmds.filter(c => c.group === grp.key);
                                        if (items.length === 0) return null;
                                        return (
                                          <div key={grp.key}>
                                            <div className="flex items-center gap-2 mb-2">
                                              <div className={`h-3 w-0.5 rounded-full ${grp.accentClass}`} />
                                              <span className={`text-[10px] font-bold tracking-wide ${grp.accentClass}`}>{grp.label}</span>
                                              <div className={`flex-1 h-px ${grp.accentClass}-line`} />
                                            </div>
                                            <div className="grid grid-cols-4 gap-2">
                                              {items.map((cmd, i) => (
                                                <button key={`${grp.key}-${i}`}
                                                  disabled={quickQueryRunning}
                                                  onClick={() => runQuickQuery(isZh ? cmd.label : cmd.labelEn, cmd.cmds, cmd.operationalCategory)}
                                                  title={cmd.cmds}
                                                  className="group relative flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl border border-black/[0.05] bg-white hover:border-[#00bceb]/25 hover:shadow-lg hover:shadow-[#00bceb]/[0.06] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 disabled:opacity-40 disabled:hover:translate-y-0"
                                                >
                                                  <span className="text-[18px] leading-none group-hover:scale-110 transition-transform duration-200">{cmd.icon}</span>
                                                  <span className="text-[10px] font-semibold text-black/55 group-hover:text-[#0087a9] leading-tight text-center transition-colors">{isZh ? cmd.label : cmd.labelEn}</span>
                                                </button>
                                              ))}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </>
                                  )}

                                  {/* Scenario guide */}
                                  <div className="pt-3 border-t border-black/5">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-black/25 mb-2">{isZh ? '场景执行' : 'Scenario Execution'}</p>
                                    <div className="space-y-1.5">
                                      {[
                                        { step: '1', text: isZh ? '在左侧选择目标设备' : 'Select target device on the left', done: targetCount > 0 },
                                        { step: '2', text: isZh ? '在中间选择执行场景' : 'Choose a scenario in the center', done: false },
                                        { step: '3', text: isZh ? '填写参数后点击执行' : 'Fill variables and execute', done: false },
                                      ].map(item => (
                                        <div key={item.step} className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 ${item.done ? 'border-emerald-200 bg-emerald-50' : 'border-black/5 bg-black/[0.01]'}`}>
                                          <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold flex-shrink-0 ${item.done ? 'bg-emerald-500 text-white' : 'bg-black/10 text-black/40'}`}>
                                            {item.done ? '✓' : item.step}
                                          </span>
                                          <span className={`text-xs ${item.done ? 'text-emerald-700' : 'text-black/50'}`}>{item.text}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        ) : (
                        <>
                        <div className="flex-1 min-h-0 overflow-auto p-4 space-y-3">

                          {/* Blocking issues section */}
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-black/40">
                                {isZh ? '阻塞项' : 'Blocking Issues'}
                              </p>
                              {blockingIssues.length > 0 && (
                                <span className="text-[10px] font-bold w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center">
                                  {blockingIssues.length}
                                </span>
                              )}
                            </div>
                            {blockingIssues.length > 0 ? (
                              <ul className="space-y-1.5">
                                {blockingIssues.map((issue, idx) => (
                                  <li key={idx} className={`flex items-start gap-2 rounded-xl px-3 py-2 border text-xs ${
                                    issue.severity === 'critical'
                                      ? 'border-red-200 bg-red-50 text-red-700'
                                      : issue.severity === 'high'
                                        ? 'border-orange-200 bg-orange-50 text-orange-700'
                                        : 'border-amber-200 bg-amber-50 text-amber-700'
                                  }`}>
                                    <span className="flex-shrink-0 mt-0.5 font-black text-[11px]">
                                      {issue.severity === 'critical' ? '✕' : issue.severity === 'high' ? '!' : '▲'}
                                    </span>
                                    <span className="flex-1">{issue.message}</span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                                <span className="font-bold">✓</span>
                                <span>{isZh ? '检查通过，可以执行。' : 'All clear. Ready to run.'}</span>
                              </div>
                            )}
                          </div>

                          {/* Advisory notes */}
                          {advisoryNotes.length > 0 && (
                            <div className="space-y-1.5">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-black/35">
                                {isZh ? '操作提示' : 'Advisory'}
                              </p>
                              {advisoryNotes.map((note, idx) => (
                                <div key={idx} className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                                  <span className="flex-shrink-0 font-bold">ℹ</span>
                                  <span>{note}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* High-risk confirm checkbox */}
                          {quickPlaybookScenario?.risk === 'high' && (
                            <label className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={quickRiskConfirmed}
                                onChange={(e) => setQuickRiskConfirmed(e.target.checked)}
                                className="mt-0.5 flex-shrink-0"
                              />
                              <span>{isZh ? '我已了解该场景为高风险操作，并确认继续执行。' : 'I understand this is a high-risk operation and want to proceed.'}</span>
                            </label>
                          )}

                          {/* Command preview – compact summary row + expand button */}
                          <div className="rounded-xl border border-black/10 overflow-hidden">
                            <div className="px-3 py-2.5 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-black/40 flex-shrink-0">
                                  {isZh ? '命令预览' : 'Preview'}
                                </p>
                                {previewLineCount > 0 ? (
                                  <span className="text-[10px] text-black/40 font-mono truncate">
                                    {quickPlaybookPlatform} · {previewLineCount} {isZh ? '行' : 'lines'}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-black/25">
                                    {quickPlaybookScenario ? (isZh ? '生成中...' : 'Generating...') : (isZh ? '未选场景' : 'No scenario')}
                                  </span>
                                )}
                              </div>
                              {quickPlaybookPreview && (
                                <button
                                  onClick={() => setShowCmdPreviewModal(true)}
                                  className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-black/10 text-[10px] font-semibold text-black/55 hover:bg-black/5 transition-all"
                                >
                                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 9L9 1M9 1H4M9 1V6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                  {isZh ? '展开' : 'Expand'}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* ── Fixed bottom action bar – TWO EXPLICIT BUTTONS ── */}
                        <div className="flex-shrink-0 border-t border-black/5 p-4 bg-white space-y-2">
                          {/* Recommended flow tip */}
                          <p className="text-[10px] text-black/35 text-center">
                            {isZh ? '推荐：先运行校验确认无误，再应用变更' : 'Recommended: validate first, then apply changes'}
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            {/* Run Validation */}
                            <button
                              onClick={() => runQuickPlaybook(true)}
                              disabled={!quickPlaybookScenario || !hasQuickTargets || isQuickPlaybookRunning || quickHasMixedPlatforms || quickPlatformMismatch || hasMissingRequired || (quickPlaybookScenario?.risk === 'high' && !quickRiskConfirmed)}
                              title={executeDisabledReason || (isZh ? '仅校验，不下发配置' : 'Validate only, no config push')}
                              className={`px-3 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                                (!quickPlaybookScenario || !hasQuickTargets || isQuickPlaybookRunning || quickHasMixedPlatforms || quickPlatformMismatch || hasMissingRequired || (quickPlaybookScenario?.risk === 'high' && !quickRiskConfirmed))
                                  ? 'bg-black/5 text-black/25 border-black/8 cursor-not-allowed'
                                  : 'bg-white text-black/70 border-black/15 hover:bg-black/5'
                              }`}
                            >
                              {isQuickPlaybookRunning && quickPlaybookDryRun ? (isZh ? '校验中...' : 'Validating...') : (isZh ? '运行校验' : 'Run Validation')}
                            </button>
                            {/* Apply Changes */}
                            <button
                              onClick={() => runQuickPlaybook(false)}
                              disabled={!quickPlaybookScenario || !hasQuickTargets || isQuickPlaybookRunning || quickHasMixedPlatforms || quickPlatformMismatch || hasMissingRequired || (quickPlaybookScenario?.risk === 'high' && !quickRiskConfirmed)}
                              title={executeDisabledReason || (isZh ? '真实下发配置变更' : 'Push config changes to device')}
                              className={`px-3 py-2.5 rounded-xl text-xs font-bold text-white transition-all ${
                                (!quickPlaybookScenario || !hasQuickTargets || isQuickPlaybookRunning || quickHasMixedPlatforms || quickPlatformMismatch || hasMissingRequired || (quickPlaybookScenario?.risk === 'high' && !quickRiskConfirmed))
                                  ? 'bg-black/15 text-black/30 cursor-not-allowed'
                                  : 'bg-[#00bceb] hover:bg-[#0096bd]'
                              }`}
                            >
                              {isQuickPlaybookRunning && !quickPlaybookDryRun ? (isZh ? '下发中...' : 'Applying...') : (isZh ? `应用变更 (${targetCount})` : `Apply Changes (${targetCount})`)}
                            </button>
                          </div>
                        </div>
                        </>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>


            </div>
          )}

          {/* ================================================================
               /automation/playbooks — Playbook 创建与执行
          ================================================================ */}
          {activeTab === 'automation' && automationPage === 'playbooks' && (
            <div className="h-full flex flex-col overflow-hidden">
              <div className="flex justify-between items-end mb-5 flex-shrink-0">
                <div>
                  <h2 className="text-2xl font-medium tracking-tight">Playbooks</h2>
                  <p className="text-sm text-black/40">{t('playbookDesc')}</p>
                </div>
              </div>

              <div className="mb-4 rounded-xl border border-black/10 bg-black/[0.02] px-4 py-3 text-xs text-black/60">
                {language === 'zh'
                  ? '标准流程：选择场景 -> 填写变量 -> 选择目标设备 -> Preview Commands -> Validation / Apply Changes。'
                  : 'Standard workflow: Select scenario -> Fill variables -> Select targets -> Preview Commands -> Validation / Apply Changes.'}
              </div>

              <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-5 overflow-hidden">
                {/* Left: Scenario selector */}
                <div className="md:col-span-3 flex flex-col bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
                  <div className="p-4 border-b border-black/5 bg-black/[0.01] space-y-2">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-black/40">{t('chooseScenario')}</h3>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-black/30" size={13} />
                      <input
                        value={scenarioSearch}
                        onChange={(e) => setScenarioSearch(e.target.value)}
                        placeholder="Search keyword"
                        className="w-full pl-8 pr-2 py-1.5 text-xs border border-black/10 rounded-lg outline-none focus:border-[#00bceb]/40"
                      />
                    </div>
                  </div>
                  <div className="flex-1 overflow-auto p-2 space-y-1">
                    {filteredScenarios.map(sc => (
                      <button
                        key={sc.id}
                        onClick={() => {
                          setSelectedScenario(sc);
                          setPlaybookVars({});
                          setPlaybookPreview(null);
                          setPlaybookPlatform(sc.default_platform || sc.supported_platforms?.[0] || 'cisco_ios');
                        }}
                        className={`w-full p-3 rounded-xl text-left transition-all ${
                          selectedScenario?.id === sc.id ? 'bg-black text-white' : 'hover:bg-black/5'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{sc.icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold truncate">{language === 'zh' ? sc.name_zh : sc.name}</p>
                            <p className={`text-[10px] mt-0.5 truncate ${selectedScenario?.id === sc.id ? 'text-white/50' : 'text-black/40'}`}>
                              {language === 'zh' ? sc.description_zh : sc.description}
                            </p>
                          </div>
                          <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full ${
                            sc.risk === 'high' ? 'bg-red-100 text-red-600' : sc.risk === 'medium' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'
                          }`}>{sc.risk}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Middle: Config & variables */}
                <div className="md:col-span-5 flex flex-col bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
                  {selectedScenario ? (
                    <div className="flex flex-col h-full">
                      <div className="p-4 border-b border-black/5 bg-black/[0.01]">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{selectedScenario.icon}</span>
                          <div className="flex-1">
                            <h3 className="text-sm font-bold">{language === 'zh' ? selectedScenario.name_zh : selectedScenario.name}</h3>
                            <p className="text-[10px] text-black/40">{selectedScenario.category} · {selectedScenario.supported_platforms?.length || 0} {t('platformsSupported')}</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex-1 overflow-auto p-5 space-y-4">
                        {/* Platform selector */}
                        <div>
                          <h4 className="text-[10px] font-bold uppercase tracking-widest text-black/30 mb-2">{t('selectPlatform')}</h4>
                          <div className="grid grid-cols-2 gap-1.5">
                            {(selectedScenario.supported_platforms || []).map((pk: string) => {
                              const pl = platforms[pk];
                              if (!pl) return null;
                              return (
                                <button
                                  key={pk}
                                  onClick={() => { setPlaybookPlatform(pk); setPlaybookPreview(null); }}
                                  className={`flex items-center gap-2 p-2 rounded-lg text-left text-xs transition-all ${
                                    playbookPlatform === pk ? 'bg-[#00bceb]/10 border border-[#00bceb]/30 text-[#00bceb] font-semibold' : 'border border-black/5 hover:border-black/20'
                                  }`}
                                >
                                  <span>{pl.icon}</span>
                                  <div className="min-w-0">
                                    <p className="font-semibold truncate">{pl.vendor} {pl.name}</p>
                                    <p className={`text-[9px] truncate ${playbookPlatform === pk ? 'text-[#00bceb]/60' : 'text-black/30'}`}>{pl.description}</p>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        {/* Variables form */}
                        <div>
                          <h4 className="text-[10px] font-bold uppercase tracking-widest text-black/30 mb-3">{t('variables')}</h4>
                          <div className="space-y-3">
                            {selectedScenario.variables?.map((v: any) => (
                              <div key={v.key}>
                                <label className="text-xs font-medium flex items-center gap-1">
                                  {v.label}
                                  {v.required && <span className="text-red-400">*</span>}
                                </label>
                                {v.type === 'textarea' ? (
                                  <textarea
                                    value={playbookVars[v.key] || ''}
                                    onChange={e => setPlaybookVars(prev => ({ ...prev, [v.key]: e.target.value }))}
                                    placeholder={v.platform_hints?.[playbookPlatform] || v.placeholder}
                                    rows={3}
                                    className="w-full mt-1 px-3 py-2 border border-black/10 rounded-xl text-xs font-mono outline-none focus:border-[#00bceb]/50"
                                  />
                                ) : v.type === 'select' ? (
                                  <select
                                    value={playbookVars[v.key] || v.options?.[0] || ''}
                                    onChange={e => setPlaybookVars(prev => ({ ...prev, [v.key]: e.target.value }))}
                                    title={v.label_zh || v.label || v.key}
                                    className="w-full mt-1 px-3 py-2 border border-black/10 rounded-xl text-xs outline-none"
                                  >
                                    {v.options?.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                                  </select>
                                ) : (
                                  <input
                                    type={v.type === 'number' ? 'number' : 'text'}
                                    value={playbookVars[v.key] || ''}
                                    onChange={e => setPlaybookVars(prev => ({ ...prev, [v.key]: e.target.value }))}
                                    placeholder={v.platform_hints?.[playbookPlatform] || v.placeholder}
                                    className="w-full mt-1 px-3 py-2 border border-black/10 rounded-xl text-xs font-mono outline-none focus:border-[#00bceb]/50"
                                  />
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Device selection */}
                        <div>
                          <h4 className="text-[10px] font-bold uppercase tracking-widest text-black/30 mb-2">{t('targetDevices')}</h4>
                          <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-auto">
                            {devices.filter(d => d.status === 'online').map(d => (
                              <button
                                key={d.id}
                                onClick={() => setPlaybookDeviceIds(prev =>
                                  prev.includes(d.id) ? prev.filter(x => x !== d.id) : [...prev, d.id]
                                )}
                                className={`flex items-center gap-2 p-2 rounded-lg text-xs transition-all ${
                                  playbookDeviceIds.includes(d.id) ? 'bg-[#00bceb]/10 border border-[#00bceb]/30 text-[#00bceb] font-semibold' : 'border border-black/5 hover:border-black/20'
                                }`}
                              >
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                {d.hostname}
                              </button>
                            ))}
                          </div>
                          {playbookDeviceIds.length > 0 && (
                            <p className="text-[10px] mt-1.5 text-[#00bceb] font-semibold">{playbookDeviceIds.length} {t('devicesSelected')}</p>
                          )}
                        </div>

                        {/* Execution options */}
                        <div className="flex items-center gap-4 pt-3 border-t border-black/5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-black/40">{t('concurrency')}:</span>
                            <select value={playbookConcurrency} onChange={e => setPlaybookConcurrency(Number(e.target.value))}
                              title={language === 'zh' ? '并发执行数量' : 'Execution concurrency'}
                              className="text-xs border border-black/10 rounded-lg px-2 py-1 outline-none">
                              {[1,2,3,5,10].map(n => <option key={n} value={n}>{n}</option>)}
                            </select>
                          </div>
                        </div>

                        {/* Action buttons — two explicit buttons, same UI as execute page */}
                        <div className="pt-2 space-y-2">
                          <p className="text-[10px] text-black/35 text-center">
                            {language === 'zh' ? '推荐：先运行校验确认无误，再应用变更' : 'Recommended: validate first, then apply changes'}
                          </p>
                          <div className="grid grid-cols-3 gap-2">
                            <button onClick={previewPlaybook}
                              className="flex items-center justify-center gap-1 px-3 py-2.5 border border-black/10 rounded-xl text-xs font-bold hover:bg-black/5 transition-all">
                              <Search size={12} /> {t('previewCommands')}
                            </button>
                            <button
                              onClick={() => executePlaybook(true)}
                              disabled={playbookDeviceIds.length === 0 || executionStatus === 'starting'}
                              className={`px-3 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                                playbookDeviceIds.length === 0 || executionStatus === 'starting'
                                  ? 'bg-black/5 text-black/25 border-black/8 cursor-not-allowed'
                                  : 'bg-white text-black/70 border-black/15 hover:bg-black/5'
                              }`}
                            >
                              {executionStatus === 'starting' && playbookDryRun ? (language === 'zh' ? '校验中...' : 'Validating...') : (language === 'zh' ? '运行校验' : 'Run Validation')}
                            </button>
                            <button
                              onClick={() => executePlaybook(false)}
                              disabled={playbookDeviceIds.length === 0 || executionStatus === 'starting'}
                              className={`px-3 py-2.5 rounded-xl text-xs font-bold text-white transition-all ${
                                playbookDeviceIds.length === 0 || executionStatus === 'starting'
                                  ? 'bg-black/15 text-black/30 cursor-not-allowed'
                                  : 'bg-[#00bceb] hover:bg-[#0096bd] shadow-lg shadow-[#00bceb]/20'
                              }`}
                            >
                              {executionStatus === 'starting' && !playbookDryRun ? (language === 'zh' ? '下发中...' : 'Applying...') : (language === 'zh' ? '应用变更' : 'Apply Changes')}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-black/20 p-8 text-center">
                      <Zap size={36} strokeWidth={1} />
                      <p className="mt-3 text-sm font-medium">{t('selectScenarioHint')}</p>
                    </div>
                  )}
                </div>

                {/* Right: Command preview */}
                <div className="md:col-span-4 flex flex-col bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
                  <div className="p-4 border-b border-black/5 bg-black/[0.01]">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-black/40">{t('commandPreview')}</h3>
                  </div>
                  {playbookPreview ? (
                    <div className="flex-1 overflow-auto bg-[#1E1E1E] font-mono text-xs p-4 space-y-4">
                      {playbookPreview.platform && platforms[playbookPreview.platform] && (
                        <div className="flex items-center gap-2 pb-2 border-b border-white/10">
                          <span>{platforms[playbookPreview.platform].icon}</span>
                          <span className="text-white/50 text-[10px]">{platforms[playbookPreview.platform].vendor} {platforms[playbookPreview.platform].name}</span>
                        </div>
                      )}
                      {(['pre_check', 'execute', 'post_check', 'rollback'] as const).map(phase => {
                        const cmds = playbookPreview[phase] || [];
                        if (cmds.length === 0) return null;
                        const colors: Record<string, string> = {
                          pre_check: 'text-blue-400',
                          execute: 'text-emerald-400',
                          post_check: 'text-purple-400',
                          rollback: 'text-red-400',
                        };
                        return (
                          <div key={phase}>
                            <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${colors[phase]}`}>
                              ── {phase.replace('_', ' ')} ──
                            </p>
                            {cmds.map((cmd: string, i: number) => (
                              <div key={i} className="text-[#d4d4d4] leading-6 hover:bg-white/5 px-2 rounded">{cmd}</div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex-1 bg-[#1E1E1E] flex flex-col items-center justify-center text-white/20">
                      <FileText size={32} strokeWidth={1} />
                      <p className="mt-3 text-sm">{t('previewHint')}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ================================================================
               /automation/scenarios — 内置场景库
          ================================================================ */}
          {activeTab === 'automation' && automationPage === 'scenarios' && (
            <div className="h-full overflow-auto">
              <div className={`${sectionHeaderRowClass} mb-5`}>
                <div>
                  <h2 className="text-2xl font-medium tracking-tight">{t('scenarioLibrary')}</h2>
                  <p className="text-sm text-black/40">{t('scenarioLibraryDesc')}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-black/30" size={13} />
                    <input
                      value={scenarioSearch}
                      onChange={(e) => setScenarioSearch(e.target.value)}
                      placeholder="Search scenario keyword"
                      className="pl-8 pr-3 py-2 text-xs border border-black/10 rounded-xl outline-none focus:border-[#00bceb]/40 w-64"
                    />
                  </div>
                  <button
                    onClick={openManualScenarioDraft}
                    className="px-3 py-2 bg-[#00bceb] text-white rounded-xl text-xs font-semibold hover:bg-[#0096bd] transition-all"
                  >
                    + Custom Scenario
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredScenarios.map(sc => {
                  const riskColor = sc.risk === 'high' ? 'border-red-200 bg-red-50/30' : sc.risk === 'medium' ? 'border-amber-200 bg-amber-50/30' : 'border-emerald-200 bg-emerald-50/30';
                  return (
                    <div key={sc.id} className={`rounded-2xl border ${riskColor} p-6 hover:shadow-lg transition-all`}>
                      <div className="flex items-start justify-between mb-3">
                        <span className="text-3xl">{sc.icon}</span>
                        <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          sc.risk === 'high' ? 'bg-red-100 text-red-600' : sc.risk === 'medium' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'
                        }`}>{sc.risk} risk</span>
                      </div>
                      <h3 className="text-sm font-bold mb-1">{language === 'zh' ? sc.name_zh : sc.name}</h3>
                      <p className="text-xs text-black/50 mb-3">{language === 'zh' ? sc.description_zh : sc.description}</p>
                      <div className="flex flex-wrap gap-1 mb-3">
                        <span className="text-[9px] font-bold uppercase px-2 py-0.5 bg-black/5 rounded-full text-black/40">{sc.category}</span>
                        {sc.is_custom && <span className="text-[9px] font-bold uppercase px-2 py-0.5 bg-[#00bceb]/10 rounded-full text-[#008bb0]">Custom</span>}
                        {(sc.supported_platforms || []).map((pk: string) => {
                          const pl = platforms[pk];
                          return <span key={pk} className="text-[9px] px-2 py-0.5 bg-black/5 rounded-full text-black/30">{pl ? `${pl.icon} ${pl.vendor}` : pk}</span>;
                        })}
                      </div>
                      <div className="text-[10px] text-black/30 space-y-0.5 mb-4">
                        {(() => {
                          const defPlatform = sc.default_platform || sc.supported_platforms?.[0];
                          const ph = sc.platform_phases?.[defPlatform] || {};
                          return (<>
                            <p>📋 Pre-Check: {ph.pre_check?.length || 0} commands</p>
                            <p>⚡ Execute: {ph.execute?.length || 0} commands</p>
                            <p>✅ Post-Check: {ph.post_check?.length || 0} commands</p>
                            <p>↩️ Rollback: {ph.rollback?.length || 0} commands</p>
                            <p>🏢 {t('platformsSupported')}: {sc.supported_platforms?.length || 0}</p>
                          </>);
                        })()}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => { openQuickPlaybookModal(sc); navigate('/automation/execute'); }}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-[#00bceb] text-white rounded-xl text-xs font-medium hover:bg-[#0096bd] transition-all"
                        >
                          <Play size={12} /> {t('useScenario')}
                        </button>
                        <button
                          onClick={() => { openQuickPlaybookModal(sc); navigate('/automation/execute'); }}
                          className="px-3 py-2 border border-black/10 rounded-xl text-xs font-medium hover:bg-black/5 transition-all"
                        >
                          {t('previewCommands')}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ================================================================
               /automation/history — 执行历史 + 实时 WebSocket 流
          ================================================================ */}
          {activeTab === 'automation' && automationPage === 'history' && (() => {
            const isZh = language === 'zh';
            return (
            <div className="h-full flex flex-col overflow-hidden">
              <div className="flex justify-between items-end mb-5 flex-shrink-0">
                <div>
                  <h2 className="text-2xl font-medium tracking-tight">{t('executionHistory')}</h2>
                  <p className="text-sm text-black/40">{t('executionHistoryDesc')}</p>
                </div>
                <button onClick={loadPlaybookHistory}
                  title={isZh ? '刷新执行历史' : 'Refresh execution history'}
                  className="p-2 rounded-xl border border-black/10 hover:bg-black/5 transition-all">
                  <RotateCcw size={14} />
                </button>
              </div>

              <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-5 overflow-hidden">
                {/* Left: Execution list */}
                <div className="md:col-span-4 flex flex-col bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
                  {/* Header with count + search + filters */}
                  <div className="border-b border-black/5 bg-black/[0.01]">
                    <div className="px-4 pt-3 pb-2 flex items-center justify-between">
                      <h3 className="text-[10px] font-bold uppercase tracking-widest text-black/40">
                        {playbookHistoryTotal > 0 ? `${playbookHistoryTotal} ${t('executions')}` : `${playbookExecutions.length} ${t('executions')}`}
                      </h3>
                    </div>
                    {/* Search bar */}
                    <div className="px-3 pb-2">
                      <div className="relative">
                        <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-black/25" />
                        <input
                          type="text"
                          value={playbookHistoryScenarioSearch}
                          onChange={e => {
                            setPlaybookHistoryScenarioSearch(e.target.value);
                            setPlaybookHistoryPage(1);
                            loadPlaybookHistory(1, playbookHistoryStatusFilter, e.target.value);
                          }}
                          placeholder={isZh ? '搜索场景名称...' : 'Search scenario...'}
                          className="w-full text-[11px] pl-7 pr-7 py-1.5 rounded-lg bg-black/[0.03] border border-black/5 focus:outline-none focus:border-black/15 focus:bg-white transition-all placeholder:text-black/20"
                        />
                        {playbookHistoryScenarioSearch && (
                          <button onClick={() => { setPlaybookHistoryScenarioSearch(''); setPlaybookHistoryPage(1); loadPlaybookHistory(1, playbookHistoryStatusFilter, ''); }}
                            title={isZh ? '清空搜索' : 'Clear search'}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-black/25 hover:text-black/50">
                            <X size={11} />
                          </button>
                        )}
                      </div>
                    </div>
                    {/* Status filter pills */}
                    <div className="px-3 pb-2.5 flex items-center gap-1 flex-wrap">
                      {[
                        { key: 'all', label: isZh ? '全部' : 'All', cls: 'bg-black/10 text-black/70' },
                        { key: 'success', label: '✓', cls: 'bg-emerald-100 text-emerald-700' },
                        { key: 'failed', label: '✗', cls: 'bg-red-100 text-red-700' },
                        { key: 'partial_failure', label: isZh ? '部分' : 'Partial', cls: 'bg-amber-100 text-amber-700' },
                        { key: 'dry_run_complete', label: 'DRY', cls: 'bg-cyan-100 text-cyan-700' },
                      ].map(f => (
                        <button key={f.key}
                          onClick={() => { setPlaybookHistoryStatusFilter(f.key); setPlaybookHistoryPage(1); loadPlaybookHistory(1, f.key, playbookHistoryScenarioSearch); }}
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-md transition-all ${
                            playbookHistoryStatusFilter === f.key ? `${f.cls} shadow-sm` : 'text-black/30 hover:bg-black/[0.04]'
                          }`}
                        >{f.label}</button>
                      ))}
                    </div>
                  </div>
                  <div className="flex-1 overflow-auto">
                    {playbookExecutions.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-black/20 p-8">
                        <History size={28} strokeWidth={1} />
                        <p className="mt-2 text-xs">{t('noExecutions')}</p>
                      </div>
                    ) : playbookExecutions.map(exec => {
                      const isLive = exec.id === activeExecutionId && executionStatus === 'running';
                      const accentColor = exec.status === 'success' ? 'bg-emerald-400' :
                        exec.status === 'running' || exec.status === 'pending' ? 'bg-blue-400' :
                        exec.status === 'dry_run_complete' ? 'bg-amber-400' : 'bg-red-400';
                      const devCount = exec.total_devices || (() => { try { return JSON.parse(exec.device_ids || '[]').length; } catch { return 0; } })();
                      return (
                        <button
                          key={exec.id}
                          onClick={async () => {
                            setActiveExecutionId(exec.id);
                            setSelectedExecutionDetail(null);
                            setSelectedExecDevices([]);
                            setSelectedExecDevicesTotal(0);
                            setSelectedExecDevicesPage(1);
                            setSelectedExecDevicesStatusFilter('all');
                            setSelectedDeviceDetail(null);
                            if (executionStatus !== 'running') {
                              if (exec._type === 'job') {
                                setSelectedExecutionDetail(exec);
                              } else {
                                setSelectedExecutionLoading(true);
                                try {
                                  const r = await fetch(`/api/playbooks/${exec.id}/summary`);
                                  if (r.ok) setSelectedExecutionDetail(await r.json());
                                  await loadExecDevices(exec.id, 1, 'all', '');
                                } finally {
                                  setSelectedExecutionLoading(false);
                                }
                              }
                            }
                          }}
                          className={`w-full text-left border-b border-black/5 transition-all flex group/row ${
                            activeExecutionId === exec.id ? 'bg-black/[0.04]' : 'hover:bg-black/[0.015]'
                          }`}
                        >
                          {/* Left accent bar */}
                          <div className={`w-1 shrink-0 ${activeExecutionId === exec.id ? accentColor : 'bg-transparent'}`} />
                          <div className="flex-1 p-3.5 pl-3 min-w-0">
                            <div className="flex items-center gap-2">
                              {isLive && <span className="w-2 h-2 rounded-full bg-[#00bceb] animate-pulse shrink-0" />}
                              <span className="text-xs font-bold truncate">{exec.scenario_name}</span>
                              {exec._type === 'job' && <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded bg-cyan-50 text-cyan-600 shrink-0">DIRECT</span>}
                              <span className={`ml-auto shrink-0 text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${
                                exec.status === 'success' ? 'bg-emerald-50 text-emerald-600' :
                                exec.status === 'running' || exec.status === 'pending' ? 'bg-blue-50 text-blue-600' :
                                exec.status === 'dry_run_complete' ? 'bg-amber-50 text-amber-600' :
                                'bg-red-50 text-red-600'
                              }`}>{exec._type === 'job' ? exec.status : (exec.dry_run ? 'DRY-RUN' : exec.status?.replace(/_/g, ' '))}</span>
                              {/* Delete button — visible on hover */}
                              {exec._type !== 'job' && !isLive && (
                                <button
                                  title={isZh ? '删除此记录' : 'Delete this record'}
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    if (!confirm(isZh ? `确定删除「${exec.scenario_name}」的执行记录？` : `Delete execution "${exec.scenario_name}"?`)) return;
                                    try {
                                      const r = await fetch(`/api/playbooks/${exec.id}`, { method: 'DELETE' });
                                      if (r.ok) {
                                        showToast(isZh ? '已删除' : 'Deleted', 'success');
                                        if (activeExecutionId === exec.id) { setActiveExecutionId(null); setSelectedExecutionDetail(null); }
                                        loadPlaybookHistory();
                                      } else { showToast(isZh ? '删除失败' : 'Delete failed', 'error'); }
                                    } catch { showToast(isZh ? '删除失败' : 'Delete failed', 'error'); }
                                  }}
                                  className="ml-1 shrink-0 p-1 rounded-md text-black/0 group-hover/row:text-black/25 hover:!text-red-500 hover:!bg-red-50 transition-all"
                                >
                                  <Trash2 size={11} />
                                </button>
                              )}
                            </div>
                            <div className="flex items-center gap-2.5 mt-1.5 text-[10px] text-black/35">
                              {exec._type === 'job'
                                ? <span className="truncate">{devices.find((d: any) => d.id === exec.device_id)?.hostname || `Device #${exec.device_id}`}</span>
                                : <span className="flex items-center gap-0.5"><Server size={9} />{devCount}</span>
                              }
                              <span className="text-black/15">·</span>
                              <span className="truncate">{new Date(exec.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                              {exec.success_count > 0 && <span className="text-emerald-500">✓{exec.success_count}</span>}
                              {exec.failed_count > 0 && <span className="text-red-500">✗{exec.failed_count}</span>}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {/* History pagination */}
                  {playbookHistoryTotal > 20 && (
                    <div className="p-3 border-t border-black/5 flex items-center justify-center gap-2">
                      <button
                        disabled={playbookHistoryPage <= 1}
                        onClick={() => { const p = playbookHistoryPage - 1; setPlaybookHistoryPage(p); loadPlaybookHistory(p); }}
                        title={language === 'zh' ? '上一页' : 'Previous page'}
                        className="px-2 py-1 text-[10px] rounded border border-black/10 disabled:opacity-30"
                      >
                        <ChevronLeft size={10} />
                      </button>
                      <span className="text-[10px] text-black/40">{playbookHistoryPage} / {Math.ceil(playbookHistoryTotal / 20)}</span>
                      <button
                        disabled={playbookHistoryPage * 20 >= playbookHistoryTotal}
                        onClick={() => { const p = playbookHistoryPage + 1; setPlaybookHistoryPage(p); loadPlaybookHistory(p); }}
                        title={language === 'zh' ? '下一页' : 'Next page'}
                        className="px-2 py-1 text-[10px] rounded border border-black/10 disabled:opacity-30"
                      >
                        <ChevronRight size={10} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Right: Live output / execution details */}
                <div className="md:col-span-8 flex flex-col bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden relative">
                  {activeExecutionId && executionStatus === 'running' ? (
                    /* ── Live WebSocket stream ── */
                    <div className="flex flex-col h-full">
                      <div className="p-4 border-b border-black/5 bg-black/[0.01] flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-[#00bceb] animate-pulse" />
                          <h3 className="text-xs font-bold">{t('liveExecution')}</h3>
                          <span className="text-[10px] text-black/30 font-mono">{activeExecutionId.slice(0, 8)}...</span>
                        </div>
                        <span className="text-[9px] font-bold uppercase text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{t('running')}</span>
                      </div>
                      <div className="flex-1 overflow-auto bg-[#1E1E1E] font-mono text-xs p-4 space-y-1">
                        {wsMessages.map((msg, i) => {
                          const color =
                            msg.type === 'start' ? 'text-blue-400' :
                            msg.type === 'device_start' ? 'text-cyan-400' :
                            msg.type === 'phase_start' ? 'text-purple-400' :
                            msg.type === 'phase_done' ? 'text-emerald-400' :
                            msg.type === 'device_done' ? 'text-green-300' :
                            msg.type === 'rollback_start' || msg.type === 'rollback_done' ? 'text-red-400' :
                            msg.type === 'device_error' ? 'text-red-500' :
                            msg.type === 'complete' ? 'text-yellow-300' :
                            'text-[#d4d4d4]';
                          return (
                            <div key={i} className={`${color} leading-5`}>
                              <span className="text-white/20 mr-2">{String(i + 1).padStart(3, ' ')}</span>
                              {msg.type === 'start' && `▶ Playbook started — ${msg.total_devices} device(s) ${msg.dry_run ? '[DRY-RUN]' : ''}`}
                              {msg.type === 'device_start' && `┌─ ${msg.hostname} (${msg.index + 1}/${msg.total})`}
                              {msg.type === 'phase_start' && `│  ⏳ ${msg.phase.replace('_', ' ').toUpperCase()} — ${msg.commands?.length || 0} command(s) ${msg.dry_run ? '[DRY-RUN]' : ''}`}
                              {msg.type === 'phase_done' && `│  ✓ ${msg.phase.replace('_', ' ').toUpperCase()} ${msg.dry_run ? '[DRY-RUN]' : '— done'}`}
                              {msg.type === 'phase_done' && msg.output?.output && (
                                <div className="ml-8 text-[#d4d4d4]/60 whitespace-pre-wrap">{msg.output.output.slice(0, 500)}</div>
                              )}
                              {msg.type === 'device_done' && `└─ ${msg.hostname} — ${msg.status}`}
                              {msg.type === 'rollback_start' && `│  ⚠ ROLLBACK TRIGGERED — ${msg.hostname}`}
                              {msg.type === 'rollback_done' && `│  ↩ Rollback complete — ${msg.hostname}`}
                              {msg.type === 'device_error' && `✗ ERROR — ${msg.device_id}: ${msg.error}`}
                              {msg.type === 'complete' && `\n✦ COMPLETE — Status: ${msg.status} | Success: ${msg.summary?.success}/${msg.summary?.total} | Failed: ${msg.summary?.failed}`}
                            </div>
                          );
                        })}
                        <div className="h-4" />
                      </div>
                    </div>
                  ) : activeExecutionId ? (
                    /* ── Static result view ── */
                    (() => {
                      if (selectedExecutionLoading) return (
                        <div className="h-full flex items-center justify-center text-black/30">
                          <RotateCcw size={20} className="animate-spin" />
                        </div>
                      );
                      const exec = selectedExecutionDetail || playbookExecutions.find((e: any) => e.id === activeExecutionId);
                      if (!exec) return <div className="p-8 text-center text-black/20 text-sm">{t('noData')}</div>;

                      // Direct execution (job) detail view
                      if (exec._type === 'job') {
                        const dev = devices.find((d: any) => d.id === exec.device_id);
                        return (
                          <div className="flex flex-col h-full">
                            <div className="p-4 border-b border-black/5 bg-black/[0.01]">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-sm font-bold">{exec.task_name}</h3>
                                <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-cyan-50 text-cyan-600">DIRECT</span>
                                <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${
                                  exec.status === 'success' ? 'bg-emerald-50 text-emerald-600' :
                                  exec.status === 'failed' || exec.status === 'blocked' ? 'bg-red-50 text-red-600' :
                                  exec.status === 'running' ? 'bg-blue-50 text-blue-600' :
                                  'bg-gray-50 text-gray-600'
                                }`}>{exec.status}</span>
                              </div>
                              <p className="text-[10px] text-black/40 mt-0.5">
                                {dev?.hostname || `Device #${exec.device_id}`}{dev?.ip_address ? ` (${dev.ip_address})` : ''} · {new Date(exec.created_at).toLocaleString()}
                              </p>
                            </div>
                            <div className="flex-1 overflow-auto p-4">
                              <pre className="text-[11px] font-mono text-black/60 bg-black/[0.02] rounded-xl p-3 whitespace-pre-wrap min-h-full">{exec.output || 'No output'}</pre>
                            </div>
                          </div>
                        );
                      }

                      const totalDevices = exec.total_devices || (() => { try { return JSON.parse(exec.device_ids || '[]').length; } catch { return 0; } })();
                      const successCount = exec.success_count || 0;
                      const failedCount = exec.failed_count || 0;
                      const partialCount = exec.partial_count || 0;
                      const durationSec = exec.duration_ms ? (exec.duration_ms / 1000).toFixed(1) : null;
                      const statusBadge = exec.status === 'success' ? 'bg-emerald-50 text-emerald-600'
                        : exec.status === 'dry_run_complete' ? 'bg-amber-50 text-amber-600'
                        : 'bg-red-50 text-red-600';
                      return (
                        <div className="flex flex-col h-full">
                          {/* ── Header with stats ribbon ── */}
                          <div className="p-5 border-b border-black/5 bg-gradient-to-r from-black/[0.015] to-transparent">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-base font-bold tracking-tight">{exec.scenario_name}</h3>
                              <span className={`text-[9px] font-bold uppercase px-2.5 py-1 rounded-full ${statusBadge}`}>{exec.dry_run ? 'DRY-RUN' : exec.status?.replace(/_/g, ' ')}</span>
                            </div>
                            <div className="flex items-center gap-4 text-[10px] text-black/40">
                              <span className="flex items-center gap-1"><Server size={10} />{totalDevices} {isZh ? '台设备' : 'devices'}</span>
                              <span className="flex items-center gap-1"><User size={10} />{exec.author}</span>
                              <span className="flex items-center gap-1"><Clock size={10} />{new Date(exec.created_at).toLocaleString()}</span>
                              {durationSec && <span className="flex items-center gap-1">⏱ {durationSec}s</span>}
                            </div>
                            {/* Stats mini-cards */}
                            {totalDevices > 0 && (
                              <div className="flex gap-2 mt-3">
                                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-100">
                                  <CheckCircle2 size={11} className="text-emerald-500" />
                                  <span className="text-[11px] font-bold text-emerald-700">{successCount}</span>
                                  <span className="text-[9px] text-emerald-500">{isZh ? '成功' : 'OK'}</span>
                                </div>
                                {failedCount > 0 && (
                                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 border border-red-100">
                                    <XCircle size={11} className="text-red-500" />
                                    <span className="text-[11px] font-bold text-red-700">{failedCount}</span>
                                    <span className="text-[9px] text-red-500">{isZh ? '失败' : 'Failed'}</span>
                                  </div>
                                )}
                                {partialCount > 0 && (
                                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-100">
                                    <AlertTriangle size={11} className="text-amber-500" />
                                    <span className="text-[11px] font-bold text-amber-700">{partialCount}</span>
                                    <span className="text-[9px] text-amber-500">{isZh ? '部分' : 'Partial'}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          {/* Status filter toolbar */}
                          <div className="px-4 py-2.5 border-b border-black/5 flex items-center gap-1.5 flex-wrap bg-black/[0.008]">
                            {[
                              { key: 'all', label: isZh ? '全部' : 'All', activeCls: 'bg-black/10 text-black/70', icon: null },
                              { key: 'success', label: isZh ? '成功' : 'Success', activeCls: 'bg-emerald-100 text-emerald-700', icon: '✓' },
                              { key: 'failed', label: isZh ? '失败' : 'Failed', activeCls: 'bg-red-100 text-red-700', icon: '✗' },
                              { key: 'error', label: isZh ? '错误' : 'Error', activeCls: 'bg-orange-100 text-orange-700', icon: '!' },
                              { key: 'post_check_failed', label: isZh ? '检查失败' : 'Check Failed', activeCls: 'bg-amber-100 text-amber-700', icon: '⚠' },
                            ].map(st => (
                              <button key={st.key}
                                onClick={async () => {
                                  setSelectedExecDevicesStatusFilter(st.key);
                                  setSelectedExecDevicesPage(1);
                                  await loadExecDevices(exec.id, 1, st.key, '');
                                }}
                                className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
                                  selectedExecDevicesStatusFilter === st.key
                                    ? `${st.activeCls} shadow-sm`
                                    : 'text-black/35 hover:bg-black/[0.04] hover:text-black/50'
                                }`}
                              >
                                {st.icon && <span className="text-[9px]">{st.icon}</span>}
                                {st.key === 'all' ? `${st.label} (${selectedExecDevicesTotal})` : st.label}
                              </button>
                            ))}
                          </div>
                          <div className="flex-1 overflow-auto p-4 space-y-3">
                            {selectedExecDevicesLoading ? (
                              <div className="flex items-center justify-center py-8">
                                <RotateCcw size={16} className="animate-spin text-black/30" />
                              </div>
                            ) : selectedExecDevices.length === 0 ? (
                              <div className="text-center py-12 text-black/20">
                                <Search size={24} strokeWidth={1} className="mx-auto mb-2 text-black/15" />
                                <p className="text-xs">{isZh ? '没有匹配的设备' : 'No matching devices'}</p>
                              </div>
                            ) : selectedExecDevices.map((device: any) => {
                              const isOk = device.status === 'success';
                              const borderCls = isOk ? 'border-emerald-100 hover:border-emerald-200' : 'border-red-100 hover:border-red-200';
                              const bgCls = isOk ? 'bg-emerald-50/30' : 'bg-red-50/30';
                              const iconBgCls = isOk ? 'bg-emerald-100' : 'bg-red-100';
                              const statusBadgeCls = isOk ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600';
                              return (
                              <button key={device.device_id}
                                onClick={async () => {
                                  setSelectedDeviceDetailLoading(true);
                                  setSelectedDeviceDetail(null);
                                  try {
                                    const r = await fetch(`/api/playbooks/${exec.id}/devices/${device.device_id}`);
                                    if (r.ok) setSelectedDeviceDetail(await r.json());
                                  } finally {
                                    setSelectedDeviceDetailLoading(false);
                                  }
                                }}
                                className={`w-full rounded-xl border overflow-hidden text-left transition-all group hover:shadow-md ${borderCls}`}
                              >
                                <div className={`flex items-center justify-between px-4 py-3 ${bgCls}`}>
                                  <div className="flex items-center gap-2.5">
                                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${iconBgCls}`}>
                                      {isOk
                                        ? <CheckCircle2 size={13} className="text-emerald-600" />
                                        : <XCircle size={13} className="text-red-600" />
                                      }
                                    </div>
                                    <div>
                                      <span className="text-xs font-bold text-black/75 block">{device.hostname}</span>
                                      {device.ip_address && <span className="text-[10px] text-black/30">{device.ip_address}</span>}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2.5">
                                    {device.duration_ms > 0 && (
                                      <span className="text-[10px] text-black/25 flex items-center gap-0.5">
                                        <Clock size={9} />{(device.duration_ms / 1000).toFixed(1)}s
                                      </span>
                                    )}
                                    <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${statusBadgeCls}`}>
                                      {device.status?.replace(/_/g, ' ')}
                                    </span>
                                    <ChevronRight size={12} className="text-black/15 group-hover:text-black/30 transition-colors" />
                                  </div>
                                </div>
                                {device.error_message && (
                                  <div className="px-4 py-2 bg-red-50/50 border-t border-red-100/50">
                                    <p className="text-[10px] text-red-600 font-mono truncate flex items-center gap-1">
                                      <AlertCircle size={9} className="shrink-0" />{device.error_message}
                                    </p>
                                  </div>
                                )}
                              </button>
                              );
                            })}
                            {/* Device list pagination */}
                            {selectedExecDevicesTotal > 20 && (
                              <div className="flex justify-center gap-2 pt-2">
                                <button
                                  disabled={selectedExecDevicesPage <= 1}
                                  onClick={() => { const p = selectedExecDevicesPage - 1; setSelectedExecDevicesPage(p); loadExecDevices(exec.id, p, selectedExecDevicesStatusFilter); }}
                                  title={language === 'zh' ? '上一页' : 'Previous page'}
                                  className="px-2 py-1 text-xs rounded border border-black/10 disabled:opacity-30"
                                ><ChevronLeft size={12} /></button>
                                <span className="text-xs text-black/40 px-2 py-1">{selectedExecDevicesPage} / {Math.ceil(selectedExecDevicesTotal / 20)}</span>
                                <button
                                  disabled={selectedExecDevicesPage * 20 >= selectedExecDevicesTotal}
                                  onClick={() => { const p = selectedExecDevicesPage + 1; setSelectedExecDevicesPage(p); loadExecDevices(exec.id, p, selectedExecDevicesStatusFilter); }}
                                  title={language === 'zh' ? '下一页' : 'Next page'}
                                  className="px-2 py-1 text-xs rounded border border-black/10 disabled:opacity-30"
                                ><ChevronRight size={12} /></button>
                              </div>
                            )}
                          </div>
                          {/* Device detail overlay */}
                          {(selectedDeviceDetail || selectedDeviceDetailLoading) && (
                            <div className="absolute inset-0 bg-white z-10 flex flex-col rounded-2xl">
                              <div className="p-4 border-b border-black/5 flex items-center gap-3 bg-gradient-to-r from-black/[0.015] to-transparent">
                                <button onClick={() => setSelectedDeviceDetail(null)} className="p-1.5 rounded-lg hover:bg-black/5 transition-colors" title="Back">
                                  <ChevronLeft size={14} />
                                </button>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold truncate">{selectedDeviceDetail?.hostname || '...'}</span>
                                    {selectedDeviceDetail?.ip_address && <span className="text-[10px] text-black/30">{selectedDeviceDetail.ip_address}</span>}
                                    {selectedDeviceDetail?.status && (
                                      <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${
                                        selectedDeviceDetail.status === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                                      }`}>{selectedDeviceDetail.status?.replace(/_/g, ' ')}</span>
                                    )}
                                  </div>
                                  {selectedDeviceDetail?.duration_ms > 0 && (
                                    <p className="text-[10px] text-black/30 mt-0.5">⏱ {(selectedDeviceDetail.duration_ms / 1000).toFixed(1)}s</p>
                                  )}
                                </div>
                              </div>
                              {selectedDeviceDetailLoading ? (
                                <div className="flex-1 flex items-center justify-center"><RotateCcw size={16} className="animate-spin text-black/30" /></div>
                              ) : selectedDeviceDetail && (
                                <div className="flex-1 overflow-auto p-4 space-y-3">
                                  {selectedDeviceDetail.error_message && (
                                    <div className="rounded-xl border border-red-100 bg-red-50/60 p-4 flex items-start gap-3">
                                      <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                                        <AlertCircle size={14} className="text-red-600" />
                                      </div>
                                      <div className="min-w-0">
                                        <p className="text-[10px] font-bold text-red-700 mb-1">{isZh ? '错误信息' : 'Error Message'}</p>
                                        <pre className="text-[11px] font-mono text-red-600 whitespace-pre-wrap break-all">{selectedDeviceDetail.error_message}</pre>
                                      </div>
                                    </div>
                                  )}
                                  {(() => {
                                    const phases = (() => { try { return JSON.parse(selectedDeviceDetail.phases_json || '{}'); } catch { return {}; } })();
                                    return Object.entries(phases).map(([phase, data]: [string, any]) => (
                                      <div key={phase} className="rounded-xl border border-black/5 overflow-hidden">
                                        <div className="flex items-center justify-between px-4 py-2.5 bg-black/[0.02] border-b border-black/5">
                                          <p className="text-[10px] font-bold uppercase tracking-wider text-black/40">{phase.replace(/_/g, ' ')}</p>
                                          {data?.success !== undefined && (
                                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                                              data.success ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                                            }`}>
                                              {data.success ? '✓ Pass' : '✗ Fail'}
                                            </span>
                                          )}
                                        </div>
                                        <div className="px-4 py-3">
                                          {data?.commands && (
                                            <p className="text-[10px] text-black/30 mb-1.5">{Array.isArray(data.commands) ? data.commands.length : 0} {isZh ? '条命令' : 'commands'}</p>
                                          )}
                                          {data?.output ? (
                                            <pre className="text-[11px] font-mono text-black/60 bg-black/[0.02] rounded-lg p-3 max-h-48 overflow-auto whitespace-pre-wrap">{typeof data.output === 'string' ? data.output : JSON.stringify(data.output, null, 2)}</pre>
                                          ) : (
                                            <p className="text-[10px] text-black/20 italic">{isZh ? '无输出' : 'No output'}</p>
                                          )}
                                        </div>
                                      </div>
                                    ));
                                  })()}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })()
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-black/20 p-8">
                      <div className="w-16 h-16 rounded-2xl bg-black/[0.03] flex items-center justify-center mb-4">
                        <History size={28} strokeWidth={1} className="text-black/15" />
                      </div>
                      <p className="text-sm font-medium text-black/25">{t('selectExecutionHint')}</p>
                      <p className="text-[11px] text-black/15 mt-1">{isZh ? '点击左侧列表查看详情' : 'Click an item from the list to view details'}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            );
          })()}

          {activeTab === 'compliance' && (
            <Suspense fallback={lazyPanelFallback}>
              <ComplianceTab
                complianceOverview={complianceOverview}
                complianceFindings={complianceFindings}
                complianceFindingTotal={complianceFindingTotal}
                complianceSeverityFilter={complianceSeverityFilter}
                setComplianceSeverityFilter={setComplianceSeverityFilter}
                complianceStatusFilter={complianceStatusFilter}
                setComplianceStatusFilter={setComplianceStatusFilter}
                complianceCategoryFilter={complianceCategoryFilter}
                setComplianceCategoryFilter={setComplianceCategoryFilter}
                compliancePage={compliancePage}
                setCompliancePage={setCompliancePage}
                compliancePageSize={compliancePageSize}
                setCompliancePageSize={setCompliancePageSize}
                complianceLoading={complianceLoading}
                complianceRunLoading={complianceRunLoading}
                runComplianceAudit={runComplianceAudit}
                openComplianceFindingDetail={openComplianceFindingDetail}
                updateComplianceFinding={updateComplianceFinding}
                language={language}
                t={t}
              />
            </Suspense>
          )}

          {/* ================================================================
               /config/backup  —  备份历史
          ================================================================ */}
          {activeTab === 'config' && configPage === 'backup' && (
            <div className="h-full flex flex-col overflow-hidden">
              {/* Header */}
              <div className="flex justify-between items-end mb-5 flex-shrink-0">
                <div>
                  <h2 className="text-2xl font-medium tracking-tight">{t('backupHistory')}</h2>
                  <p className="text-sm text-black/40">{t('backupStoragePath')}: <span className="font-mono">backup/YYYY/MM/Vendor/Hostname/</span></p>
                </div>
                <div className="flex gap-2">
                  {configCenterDevice && (
                    <button
                      onClick={() => takeConfigSnapshot(configCenterDevice)}
                      disabled={isTakingSnapshot}
                      className="flex items-center gap-2 px-4 py-2 bg-[#00bceb] text-white rounded-xl text-sm font-medium hover:bg-[#0096bd] transition-all shadow-lg shadow-[#00bceb]/20 disabled:opacity-50"
                    >
                      {isTakingSnapshot ? <RotateCcw size={14} className="animate-spin" /> : <Download size={14} />}
                      {t('takeSnapshot')}
                    </button>
                  )}
                  <button
                    onClick={async () => {
                      const online = devices.filter(d => d.status === 'online');
                      showToast(`${t('backupStarted')} (${online.length} ${t('devicesOnline')})`, 'info');
                      for (const d of online) await takeConfigSnapshot(d, 'manual');
                      showToast(t('backupComplete'), 'success');
                      await loadConfigSnapshots(configCenterDevice?.id, { requireFilter: true });
                    }}
                    disabled={isTakingSnapshot}
                    className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-xl text-sm font-medium hover:bg-black/80 transition-all disabled:opacity-50"
                  >
                    <Database size={14} />
                    {t('backupAllOnline')}
                  </button>
                </div>
              </div>

              {/* 3-col + 9-col split */}
              <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-5 overflow-hidden">
                {/* Device list */}
                <div className="md:col-span-3 flex flex-col bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
                  <div className="p-4 border-b border-black/5 bg-black/[0.01]">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-black/40">{t('selectDevice')}</h3>
                    <button onClick={() => { setConfigCenterDevice(null); setConfigViewSnapshot(null); setConfigViewContent(''); }}
                      className={`mt-2 text-[9px] font-bold uppercase tracking-wider transition-all ${!configCenterDevice ? 'text-[#00bceb]' : 'text-black/30 hover:text-black'}`}
                    >{t('allSnapshots')}</button>
                  </div>
                  <div className="flex-1 overflow-auto">
                    {(() => {
                      const byVendor = devices.reduce<Record<string, Device[]>>((acc, d) => {
                        const v = getVendorFromPlatform(d.platform); if (!acc[v]) acc[v] = []; acc[v].push(d); return acc;
                      }, {} as Record<string, Device[]>);
                      return (Object.entries(byVendor) as [string, Device[]][]).map(([vendor, vDevices]) => (
                        <div key={vendor}>
                          <div className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest text-black/30 bg-black/[0.02] border-b border-black/5 sticky top-0">{vendor}</div>
                          <div className="p-2 space-y-1">
                            {vDevices.map(device => {
                              const cnt = configSnapshots.filter(s => s.device_id === device.id).length;
                              return (
                                <button key={device.id} onClick={() => { setConfigCenterDevice(device); setConfigViewSnapshot(null); setConfigViewContent(''); }}
                                  className={`w-full p-3 rounded-xl text-left transition-all ${configCenterDevice?.id === device.id ? 'bg-black text-white' : 'hover:bg-black/5 text-black/60 hover:text-black'}`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <div className={`w-1.5 h-1.5 rounded-full ${device.status === 'online' ? 'bg-emerald-500' : 'bg-red-400'}`} />
                                      <span className="text-xs font-medium">{device.hostname}</span>
                                    </div>
                                    {cnt > 0 && <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${configCenterDevice?.id === device.id ? 'bg-white/20 text-white' : 'bg-black/5 text-black/40'}`}>{cnt}</span>}
                                  </div>
                                  <p className={`text-[9px] font-mono mt-0.5 ${configCenterDevice?.id === device.id ? 'text-white/40' : 'text-black/30'}`}>{device.ip_address}</p>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>

                {/* Right panel: snapshot list | config viewer */}
                <div className="md:col-span-9 flex flex-col bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
                  {configViewSnapshot ? (
                    /* ── Config Viewer ── */
                    <div className="flex flex-col h-full">
                      <div className="p-4 border-b border-black/5 bg-black/[0.01] flex items-center justify-between">
                        <div>
                          <button onClick={() => { setConfigViewSnapshot(null); setConfigViewContent(''); }}
                            className="text-[10px] font-bold uppercase text-black/30 hover:text-black flex items-center gap-1 mb-1">
                            <ChevronLeft size={12} /> {t('backToList')}
                          </button>
                          <h3 className="text-[10px] font-bold uppercase tracking-widest text-black/40">{t('configViewTab')}</h3>
                          <p className="text-xs text-black/40 mt-0.5">
                            {configViewSnapshot.hostname} · {new Date(configViewSnapshot.timestamp).toLocaleString()} · <span className="capitalize">{configViewSnapshot.trigger}</span>
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {configViewContent && <span className="text-[10px] text-black/30 font-mono">{configViewContent.split('\n').length} {t('linesCount')}</span>}
                          <button
                            onClick={() => { const ta = document.createElement('textarea'); ta.value = configViewContent; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); showToast(t('configCopied'), 'success'); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-black/5 hover:bg-black/10 rounded-lg text-xs font-medium transition-all"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                            {t('copy')}
                          </button>
                          {configCenterDevice && (
                            <button
                              onClick={async () => { const snap = await takeConfigSnapshot(configCenterDevice); if (snap) { setConfigViewSnapshot(snap); setConfigViewContent(snap.content || ''); } }}
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
                              {configViewContent.split('\n').map((_, i) => <div key={i}>{i + 1}</div>)}
                            </div>
                            <div className="flex-1 bg-[#1E1E1E] overflow-auto p-4 font-mono text-xs text-[#d4d4d4] leading-6">
                              {configViewContent.split('\n').map((line, i) => (
                                <div key={i} className={`hover:bg-white/5 px-1 rounded ${
                                  line.startsWith('#') || line.startsWith('!') ? 'text-[#6a9955]' :
                                  line.match(/^(interface|vlan|ip route|ospf|bgp|acl)/) ? 'text-[#569cd6]' :
                                  line.match(/shutdown|down/) ? 'text-[#f48771]' : ''
                                }`}>{line || ' '}</div>
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
                    /* ── Snapshot List ── */
                    <div className="flex flex-col h-full">
                      <div className="p-4 border-b border-black/5 bg-black/[0.01] flex items-center justify-between">
                        <div>
                          <h3 className="text-[10px] font-bold uppercase tracking-widest text-black/40">
                            {configCenterDevice ? `${configCenterDevice.hostname} — ${t('snapshotHistory')}` : t('allSnapshots')}
                          </h3>
                          <p className="text-[9px] text-black/30 mt-0.5">
                            {configSnapshots.filter(s => !configCenterDevice || s.device_id === configCenterDevice.id).length} {t('snapshotsCount')}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            value={configSnapshotKeyword}
                            onChange={(e) => setConfigSnapshotKeyword(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                loadConfigSnapshots(configCenterDevice?.id, { requireFilter: true });
                              }
                            }}
                            placeholder={language === 'zh' ? '模糊搜索: 设备名或IP' : 'Fuzzy search: hostname or IP'}
                            className="w-56 text-[10px] border border-black/10 rounded-lg px-2 py-1 outline-none bg-white"
                          />
                          <button
                            onClick={() => loadConfigSnapshots(configCenterDevice?.id, { requireFilter: true })}
                            className="px-2 py-1 text-[10px] border border-black/10 rounded-lg hover:bg-black/5"
                          >
                            {language === 'zh' ? '查找' : 'Search'}
                          </button>
                          <button
                            onClick={() => {
                              setConfigSnapshotKeyword('');
                              loadConfigSnapshots(configCenterDevice?.id, { requireFilter: true, q: '' });
                            }}
                            className="px-2 py-1 text-[10px] border border-black/10 rounded-lg hover:bg-black/5"
                          >
                            {language === 'zh' ? '清空' : 'Clear'}
                          </button>
                          <span className="text-[9px] font-bold uppercase text-black/30">{t('retentionPeriod')}</span>
                          <select value={retentionDays} onChange={e => setRetentionDays(Number(e.target.value))}
                            title={language === 'zh' ? '快照保留周期' : 'Snapshot retention period'}
                            className="text-[10px] border border-black/10 rounded-lg px-2 py-1 outline-none bg-white">
                            <option value={30}>30 {t('retentionDays')}</option>
                            <option value={90}>90 {t('retentionDays')}</option>
                            <option value={180}>180 {t('retentionDays')}</option>
                            <option value={365}>1 {language === 'zh' ? '年' : 'yr'} (365d)</option>
                            <option value={730}>2 {language === 'zh' ? '年' : 'yr'} (730d)</option>
                          </select>
                          <button onClick={() => loadConfigSnapshots(configCenterDevice?.id, { requireFilter: true })}
                            title={language === 'zh' ? '刷新配置快照' : 'Refresh config snapshots'}
                            className="p-1.5 rounded-lg border border-black/10 hover:bg-black/5 transition-all">
                            <RotateCcw size={13} className={configSnapshotsLoading ? 'animate-spin' : ''} />
                          </button>
                        </div>
                      </div>
                      <div className="flex-1 overflow-auto">
                        {configSnapshots.filter(s => !configCenterDevice || s.device_id === configCenterDevice.id).length === 0 ? (
                          <div className="h-full flex flex-col items-center justify-center text-black/20 p-8 text-center">
                            <Download size={32} strokeWidth={1} />
                            <p className="mt-3 text-sm font-medium">
                              {!configCenterDevice && !configSnapshotKeyword.trim()
                                ? (language === 'zh' ? '请先按设备名或IP过滤' : 'Filter by hostname or IP first')
                                : t('noSnapshots')}
                            </p>
                            <p className="text-xs mt-1">
                              {!configCenterDevice && !configSnapshotKeyword.trim()
                                ? (language === 'zh' ? '为避免一次加载全部配置，请先输入筛选条件。' : 'To avoid loading all configs at once, enter a filter before searching.')
                                : t('noSnapshotHint')}
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
                              {configSnapshots
                                .filter(s => !configCenterDevice || s.device_id === configCenterDevice.id)
                                .map((snap, idx, arr) => {
                                  const prev = arr[idx + 1];
                                  const changed = prev && snap.content !== prev.content;
                                  return (
                                    <tr key={snap.id} className="border-b border-black/5 hover:bg-black/[0.01] transition-colors">
                                      <td className="px-5 py-3">
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs font-medium">{snap.hostname}</span>
                                          {changed && <span className="text-[8px] font-bold px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full uppercase">{t('changedBadge')}</span>}
                                        </div>
                                      </td>
                                      <td className="px-5 py-3">
                                        <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-black/5 text-black/50">{snap.vendor || '—'}</span>
                                      </td>
                                      <td className="px-5 py-3 text-xs text-black/50 font-mono">{new Date(snap.timestamp).toLocaleString()}</td>
                                      <td className="px-5 py-3">
                                        <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${
                                          snap.trigger === 'manual' ? 'bg-blue-50 text-blue-600' :
                                          snap.trigger === 'scheduled' ? 'bg-purple-50 text-purple-600' :
                                          snap.trigger === 'pre-change' ? 'bg-amber-50 text-amber-600' :
                                          'bg-emerald-50 text-emerald-600'
                                        }`}>{snap.trigger}</span>
                                      </td>
                                      <td className="px-5 py-3 text-xs text-black/40 font-mono">{snap.size > 1024 ? `${(snap.size/1024).toFixed(1)}KB` : `${snap.size}B`}</td>
                                      <td className="px-5 py-3 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                          <button
                                            onClick={async () => { const c = await loadSnapshotContent(snap); setConfigViewSnapshot({ ...snap, content: c }); setConfigViewContent(c); }}
                                            className="text-[10px] font-bold uppercase text-[#00bceb] hover:underline"
                                          >{t('viewConfig')}</button>
                                          <button
                                            onClick={async () => {
                                              const c = await loadSnapshotContent(snap);
                                              setConfigSnapshotKeyword(snap.ip_address || snap.hostname || '');
                                              setConfigDiffLeft({ ...snap, content: c });
                                              navigate('/config/diff');
                                            }}
                                            className="text-[10px] font-bold uppercase text-black/40 hover:text-black hover:underline"
                                          >{t('diffCompare')}</button>
                                          <button
                                            onClick={async () => { const c = await loadSnapshotContent(snap); const ta = document.createElement('textarea'); ta.value = c; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); showToast(t('configCopied'), 'success'); }}
                                            className="text-[10px] font-bold uppercase text-black/40 hover:text-black hover:underline"
                                          >{t('copy')}</button>
                                          <button onClick={() => deleteSnapshot(snap.id)}
                                            className="text-[10px] font-bold uppercase text-red-400 hover:text-red-600 hover:underline"
                                          >{t('delete')}</button>
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
          )}

          {/* ================================================================
               /config/diff  —  配置对比
          ================================================================ */}
          {activeTab === 'config' && configPage === 'diff' && (
            <div className="h-full flex flex-col overflow-hidden">
              <div className="flex justify-between items-end mb-5 flex-shrink-0">
                <div>
                  <h2 className="text-2xl font-medium tracking-tight">{t('diffCompare')}</h2>
                  <p className="text-sm text-black/40">{t('diffCompareTitle')}</p>
                </div>
                <button onClick={() => {
                  setConfigDiffLeft(null);
                  setConfigDiffRight(null);
                  setDiffFocusChangeIdx(0);
                  setDiffBlockQuery('');
                  diffLineRefs.current = {};
                }}
                  className="text-xs text-black/30 hover:text-black transition-all px-3 py-1.5 border border-black/10 rounded-lg">
                  {t('cancel')}
                </button>
              </div>

              <div className="flex-1 bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden flex flex-col">
                {/* Selectors */}
                <div className="p-5 border-b border-black/5 bg-black/[0.01]">
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    <input
                      value={configSnapshotKeyword}
                      onChange={(e) => setConfigSnapshotKeyword(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          loadConfigSnapshots(configCenterDevice?.id, { requireFilter: true });
                        }
                      }}
                      placeholder={language === 'zh' ? '模糊搜索: 交换机名称或IP' : 'Fuzzy search: switch name or IP'}
                      className="w-64 px-2 py-1.5 text-xs border border-black/10 rounded-lg outline-none bg-white"
                    />
                    <button
                      onClick={() => loadConfigSnapshots(configCenterDevice?.id, { requireFilter: true })}
                      className="px-2.5 py-1.5 text-[10px] border border-black/10 rounded-lg hover:bg-black/5"
                    >
                      {language === 'zh' ? '查找快照' : 'Search snapshots'}
                    </button>
                    <button
                      onClick={() => {
                        setConfigSnapshotKeyword('');
                        loadConfigSnapshots(configCenterDevice?.id, { requireFilter: true, q: '' });
                      }}
                      className="px-2.5 py-1.5 text-[10px] border border-black/10 rounded-lg hover:bg-black/5"
                    >
                      {language === 'zh' ? '清空' : 'Clear'}
                    </button>
                    <button
                      onClick={() => loadConfigSnapshots(configCenterDevice?.id, { requireFilter: true })}
                      className="p-1.5 rounded-lg border border-black/10 hover:bg-black/5 transition-all"
                      title={language === 'zh' ? '刷新快照列表' : 'Refresh snapshots'}
                    >
                      <RotateCcw size={13} className={configSnapshotsLoading ? 'animate-spin' : ''} />
                    </button>
                    {!configCenterDevice && !configSnapshotKeyword.trim() && (
                      <span className="text-[11px] text-black/40">
                        {language === 'zh' ? '请先按设备名或IP过滤，再选择快照对比' : 'Filter by hostname/IP first, then pick snapshots for diff'}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {(['left', 'right'] as const).map(side => {
                      const current = side === 'left' ? configDiffLeft : configDiffRight;
                      const snapList = side === 'right' && configDiffLeft ? sameTargetSnapshots : configSnapshots;
                      return (
                        <div key={side}>
                          <label className="text-[10px] font-bold uppercase text-black/30 mb-1.5 block">
                            {side === 'left' ? t('beforeLabel') : t('afterLabel')}
                            {current && <span className="ml-2 font-mono text-[#00bceb] normal-case">{current.hostname}{current.ip_address ? ` (${current.ip_address})` : ''} · {new Date(current.timestamp).toLocaleString()}</span>}
                          </label>
                          <select
                            value={current?.id || ''}
                            disabled={side === 'right' && !configDiffLeft}
                            title={side === 'left' ? (language === 'zh' ? '选择变更前快照' : 'Select before snapshot') : (language === 'zh' ? '选择变更后快照' : 'Select after snapshot')}
                            onChange={async e => {
                              const snap = snapList.find(s => s.id === e.target.value) || null;
                              if (snap) {
                                const content = await loadSnapshotContent(snap);
                                const selected = { ...snap, content };
                                if (side === 'left') {
                                  setConfigDiffLeft(selected);
                                  setDiffFocusChangeIdx(0);
                                  setDiffBlockQuery('');
                                  diffLineRefs.current = {};
                                  // Keep right side valid after base snapshot changes.
                                  if (
                                    configDiffRight &&
                                    (configDiffRight.id === selected.id || getSnapshotCompareKey(configDiffRight) !== getSnapshotCompareKey(selected))
                                  ) {
                                    setConfigDiffRight(null);
                                  }
                                } else {
                                  // Extra guard against stale options.
                                  if (configDiffLeft && getSnapshotCompareKey(selected) !== getSnapshotCompareKey(configDiffLeft)) {
                                    setConfigDiffRight(null);
                                  } else {
                                    setConfigDiffRight(selected);
                                  }
                                  setDiffFocusChangeIdx(0);
                                  diffLineRefs.current = {};
                                }
                                return;
                              }

                              if (side === 'left') {
                                setConfigDiffLeft(null);
                                setConfigDiffRight(null);
                                setDiffFocusChangeIdx(0);
                                setDiffBlockQuery('');
                                diffLineRefs.current = {};
                              } else {
                                setConfigDiffRight(null);
                                setDiffFocusChangeIdx(0);
                                diffLineRefs.current = {};
                              }
                            }}
                            className="w-full px-3 py-2 border border-black/10 rounded-xl text-xs outline-none bg-white"
                          >
                            <option value="">
                              {side === 'right' && !configDiffLeft
                                ? (language === 'zh' ? '请先选择左侧快照' : 'Select left snapshot first')
                                : t('chooseSnapshot')}
                            </option>
                            {snapList.map(s => (
                              <option key={s.id} value={s.id}>
                                {s.hostname}{s.ip_address ? ` (${s.ip_address})` : ''} · {new Date(s.timestamp).toLocaleString()} ({s.trigger})
                              </option>
                            ))}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                  {configDiffLeft && (
                    <p className="mt-3 text-[11px] text-black/45">
                      {language === 'zh'
                        ? `右侧仅展示与左侧同IP的快照${configDiffLeft.ip_address ? `（${configDiffLeft.ip_address}）` : ''}`
                        : `Right side only shows snapshots from the same IP${configDiffLeft.ip_address ? ` (${configDiffLeft.ip_address})` : ''}`}
                    </p>
                  )}
                </div>

                {/* Diff output */}
                <div className="flex-1 overflow-auto font-mono text-xs leading-6">
                  {configDiffLeft && configDiffRight ? (() => {
                    const added = activeDiffLines.filter(l => l.type === 'add').length;
                    const removed = activeDiffLines.filter(l => l.type === 'remove').length;
                    const safeFocusIdx = activeChangeLineIndexes.length === 0 ? 0 : Math.min(diffFocusChangeIdx, activeChangeLineIndexes.length - 1);
                    const focusedLineIndex = activeChangeLineIndexes[safeFocusIdx];
                    return (
                      <div className="h-full bg-[#1E1E1E] flex flex-col">
                        <div className="flex items-center gap-3 px-5 py-2.5 border-b border-white/5 text-xs">
                          <span className="font-mono text-white/40">{configDiffLeft.hostname}</span>
                          <span className="text-white/20">→</span>
                          <span className="font-mono text-white/40">{configDiffRight.hostname}</span>
                          <span className="ml-auto text-emerald-400">+{added} {t('linesAdded')}</span>
                          <span className="text-red-400">−{removed} {t('linesRemoved')}</span>
                          {added === 0 && removed === 0 && <span className="text-white/40">{t('noDiff')}</span>}
                          {activeChangeLineIndexes.length > 0 && (
                            <span className="text-white/45 font-mono">
                              {safeFocusIdx + 1}/{activeChangeLineIndexes.length}
                            </span>
                          )}
                          <button
                            onClick={() => jumpToDiff('prev')}
                            disabled={activeChangeLineIndexes.length === 0}
                            className="p-1 rounded border border-white/15 text-white/60 hover:text-white hover:border-white/30 disabled:opacity-30 disabled:cursor-not-allowed"
                            title={language === 'zh' ? '上一处差异 (P)' : 'Previous change (P)'}
                          >
                            <ChevronLeft size={13} />
                          </button>
                          <button
                            onClick={() => jumpToDiff('next')}
                            disabled={activeChangeLineIndexes.length === 0}
                            className="p-1 rounded border border-white/15 text-white/60 hover:text-white hover:border-white/30 disabled:opacity-30 disabled:cursor-not-allowed"
                            title={language === 'zh' ? '下一处差异 (N)' : 'Next change (N)'}
                          >
                            <ChevronRight size={13} />
                          </button>
                          <button
                            onClick={() => setDiffOnlyChanges((prev) => !prev)}
                            className={`px-2 py-1 rounded border transition-colors ${diffOnlyChanges
                              ? 'border-[#00bceb]/60 text-[#00d3ff] bg-[#00bceb]/10'
                              : 'border-white/15 text-white/60 hover:text-white hover:border-white/30'}`}
                            title={language === 'zh' ? '仅显示变更行 (F)' : 'Show changed lines only (F)'}
                          >
                            {language === 'zh' ? '仅变更' : 'Changes only'}
                          </button>
                          <button
                            onClick={() => setDiffShowFullBoth((prev) => !prev)}
                            className={`px-2 py-1 rounded border transition-colors ${diffShowFullBoth
                              ? 'border-[#00bceb]/60 text-[#00d3ff] bg-[#00bceb]/10'
                              : 'border-white/15 text-white/60 hover:text-white hover:border-white/30'}`}
                            title={language === 'zh' ? '显示两侧完整配置' : 'Show full configs on both sides'}
                          >
                            {language === 'zh' ? '两侧全部' : 'Both full'}
                          </button>
                        </div>
                        <div className="px-5 py-1.5 border-b border-white/5 text-[11px] text-white/35">
                          {language === 'zh' ? '可使用右上角按钮快速定位与筛选差异块' : 'Use toolbar buttons above to jump and filter change blocks quickly'}
                        </div>
                        <div className="flex-1 min-h-0 flex overflow-hidden">
                          <div className="flex-1 overflow-auto">
                            {diffShowFullBoth ? (
                              <div className="min-w-[960px]">
                                <div className="sticky top-0 z-10 grid grid-cols-2 border-b border-white/10 bg-[#181818] text-[10px] uppercase tracking-wider text-white/45">
                                  <div className="px-4 py-1.5 border-r border-white/10">{language === 'zh' ? '左侧配置 (A)' : 'Left Config (A)'}</div>
                                  <div className="px-4 py-1.5">{language === 'zh' ? '右侧配置 (B)' : 'Right Config (B)'}</div>
                                </div>
                                {fullSideBySideRows.map((row) => {
                                  const isFocused = focusedLineIndex !== undefined && row.originalIndex === focusedLineIndex;
                                  return (
                                    <div
                                      key={row.originalIndex}
                                      ref={(el) => { diffLineRefs.current[row.originalIndex] = el; }}
                                      className={`grid grid-cols-2 ${isFocused ? 'ring-1 ring-[#00d3ff]/80 bg-[#00bceb]/10' : ''}`}
                                    >
                                      <div className={`flex items-start px-4 py-0.5 border-r border-white/10 ${row.rowType === 'remove' ? 'bg-red-500/15' : ''}`}>
                                        <span className="w-10 text-right text-white/20 pr-3 select-none flex-shrink-0">{row.leftLine || ''}</span>
                                        <span className="w-4 select-none flex-shrink-0 text-red-400">{row.rowType === 'remove' ? '−' : ' '}</span>
                                        <span className={`${row.rowType === 'remove' ? 'text-red-300' : 'text-[#d4d4d4]'} whitespace-pre`}>{row.leftContent}</span>
                                      </div>
                                      <div className={`flex items-start px-4 py-0.5 ${row.rowType === 'add' ? 'bg-emerald-500/15' : ''}`}>
                                        <span className="w-10 text-right text-white/20 pr-3 select-none flex-shrink-0">{row.rightLine || ''}</span>
                                        <span className="w-4 select-none flex-shrink-0 text-emerald-400">{row.rowType === 'add' ? '+' : ' '}</span>
                                        <span className={`${row.rowType === 'add' ? 'text-emerald-300' : 'text-[#d4d4d4]'} whitespace-pre`}>{row.rightContent}</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              renderedDiffLines.map(({ line, originalIndex }) => {
                                const isFocused = focusedLineIndex !== undefined && originalIndex === focusedLineIndex;
                                return (
                                  <div
                                    key={originalIndex}
                                    ref={(el) => { diffLineRefs.current[originalIndex] = el; }}
                                    className={`flex items-start px-4 py-0.5 ${
                                      line.type === 'add' ? 'bg-emerald-500/15' :
                                      line.type === 'remove' ? 'bg-red-500/15' : ''
                                    } ${isFocused ? 'ring-1 ring-[#00d3ff]/80 bg-[#00bceb]/10' : ''}`}
                                  >
                                    <span className="w-10 text-right text-white/20 pr-3 select-none flex-shrink-0">{line.lineA || ''}</span>
                                    <span className="w-10 text-right text-white/20 pr-3 select-none flex-shrink-0">{line.lineB || ''}</span>
                                    <span className={`w-4 select-none flex-shrink-0 ${line.type === 'add' ? 'text-emerald-400' : line.type === 'remove' ? 'text-red-400' : 'text-white/20'}`}>
                                      {line.type === 'add' ? '+' : line.type === 'remove' ? '−' : ' '}
                                    </span>
                                    <span className={`${line.type === 'add' ? 'text-emerald-300' : line.type === 'remove' ? 'text-red-300' : 'text-[#d4d4d4]'} whitespace-pre`}>{line.content}</span>
                                  </div>
                                );
                              })
                            )}
                          </div>
                          {diffChangeBlocks.length > 0 && (
                            <aside className="hidden xl:block w-64 border-l border-white/10 bg-[#181818] overflow-auto">
                              <div className="px-3 py-2 border-b border-white/10">
                                <div className="text-[10px] uppercase tracking-wider text-white/45 font-bold">
                                  {language === 'zh' ? '变更目录' : 'Change Map'}
                                </div>
                                <input
                                  value={diffBlockQuery}
                                  onChange={(e) => setDiffBlockQuery(e.target.value)}
                                  placeholder={language === 'zh' ? '过滤: interface / route / acl' : 'Filter: interface / route / acl'}
                                  className="mt-2 w-full px-2 py-1.5 rounded-md border border-white/15 bg-black/25 text-[10px] text-white/80 placeholder:text-white/30 outline-none focus:border-[#00bceb]/50"
                                />
                                <div className="mt-2 flex flex-wrap gap-1">
                                  {['interface', 'route', 'acl', 'bgp', 'ospf', 'vlan'].map((kw) => (
                                    <button
                                      key={kw}
                                      onClick={() => setDiffBlockQuery((prev) => (prev.toLowerCase() === kw ? '' : kw))}
                                      className={`px-1.5 py-0.5 rounded text-[9px] border transition-colors ${diffBlockQuery.toLowerCase() === kw
                                        ? 'border-[#00bceb]/60 text-[#7ee8ff] bg-[#00bceb]/10'
                                        : 'border-white/15 text-white/55 hover:text-white hover:border-white/30'}`}
                                    >
                                      {kw}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <div className="p-2 space-y-1.5">
                                {filteredDiffChangeBlocks.map((block, blockIdx) => {
                                  const isActive = diffFocusChangeIdx >= block.startChangeIdx && diffFocusChangeIdx <= block.endChangeIdx;
                                  return (
                                    <button
                                      key={`${block.startChangeIdx}-${block.endChangeIdx}`}
                                      onClick={() => focusDiffChangeAt(block.startChangeIdx)}
                                      className={`w-full text-left px-2.5 py-2 rounded-lg border transition-all ${isActive
                                        ? 'border-[#00bceb]/60 bg-[#00bceb]/15 text-[#7ee8ff]'
                                        : 'border-white/10 text-white/60 hover:text-white hover:border-white/25 hover:bg-white/5'}`}
                                      title={block.label}
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="text-[10px] font-bold">#{blockIdx + 1}</span>
                                        <span className="text-[10px] font-mono text-white/45">
                                          {block.startChangeIdx + 1}-{block.endChangeIdx + 1}
                                        </span>
                                      </div>
                                      <div className="mt-1 text-[10px] leading-4 truncate">{block.label}</div>
                                    </button>
                                  );
                                })}
                                {filteredDiffChangeBlocks.length === 0 && (
                                  <p className="px-2 py-2 text-[10px] text-white/35">
                                    {language === 'zh' ? '没有匹配的变更块' : 'No matching change block'}
                                  </p>
                                )}
                              </div>
                            </aside>
                          )}
                        </div>
                      </div>
                    );
                  })() : (
                    <div className="h-full bg-[#1E1E1E] flex flex-col items-center justify-center text-white/20 text-center p-8">
                      <span className="text-5xl mb-4">⟷</span>
                      <p className="text-sm">{t('diffHint')}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ================================================================
               /config/search  —  配置搜索
          ================================================================ */}
          {activeTab === 'config' && configPage === 'search' && (
            <div className="h-full flex flex-col overflow-hidden">
              <div className="flex justify-between items-end mb-5 flex-shrink-0">
                <div>
                  <h2 className="text-2xl font-medium tracking-tight">{t('configSearchTab')}</h2>
                  <p className="text-sm text-black/40">{t('globalConfigSearchDesc')}</p>
                </div>
              </div>

              <div className="flex-1 bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden flex flex-col">
                <div className="p-5 border-b border-black/5 bg-black/[0.01]">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-black/30" size={15} />
                      <input
                        autoFocus
                        type="text"
                        placeholder="e.g.  192.168.1.1  |  10.0.0.0/24  |  vlan 100  |  ospf  |  bgp 65001"
                        value={configSearchQuery}
                        onChange={e => setConfigSearchQuery(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && configSearchQuery.trim().length >= 2) {
                            (async () => {
                              setConfigSearchLoading(true);
                              try {
                                const resp = await fetch(`/api/configs/search?q=${encodeURIComponent(configSearchQuery.trim())}`);
                                if (resp.ok) setConfigSearchResults(await resp.json());
                              } catch { /* ignore */ }
                              setConfigSearchLoading(false);
                            })();
                          }
                        }}
                        className="w-full pl-10 pr-3 py-2.5 border border-black/10 rounded-xl text-sm font-mono focus:border-[#00bceb]/50 outline-none transition-all"
                      />
                    </div>
                    <button
                      onClick={async () => {
                        if (configSearchQuery.trim().length < 2) return;
                        setConfigSearchLoading(true);
                        try {
                          const resp = await fetch(`/api/configs/search?q=${encodeURIComponent(configSearchQuery.trim())}`);
                          if (resp.ok) setConfigSearchResults(await resp.json());
                        } catch { /* ignore */ }
                        setConfigSearchLoading(false);
                      }}
                      disabled={configSearchLoading || configSearchQuery.trim().length < 2}
                      className="px-5 py-2 bg-[#00bceb] text-white rounded-xl text-xs font-bold hover:bg-[#0096bd] transition-all disabled:opacity-50"
                    >
                      {configSearchLoading ? <RotateCcw size={14} className="animate-spin" /> : <Search size={14} />}
                    </button>
                  </div>
                  <div className="flex gap-1.5 mt-2">
                    {['192.168', '10.0.0', 'vlan', 'ospf', 'bgp', 'acl', 'interface', 'route-static', 'ntp', 'snmp'].map(kw => (
                      <button key={kw} onClick={() => setConfigSearchQuery(kw)}
                        className="px-2.5 py-1 text-[10px] font-bold bg-black/5 hover:bg-black/10 rounded-lg transition-all">{kw}</button>
                    ))}
                  </div>
                </div>
                <div className="flex-1 overflow-auto p-5 space-y-3">
                  {configSearchQuery.trim() === '' && configSearchResults.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-black/20 text-center">
                      <Search size={36} strokeWidth={1} />
                      <p className="mt-3 text-sm font-medium">{t('globalSearchHint')}</p>
                      <p className="text-xs mt-1 text-black/30 max-w-md">{t('globalSearchHintDesc')}</p>
                    </div>
                  ) : configSearchLoading ? (
                    <div className="h-full flex flex-col items-center justify-center text-black/30">
                      <RotateCcw size={28} className="animate-spin mb-3" />
                      <p className="text-sm">{t('searching')}...</p>
                    </div>
                  ) : configSearchResults.length === 0 && configSearchQuery.trim().length >= 2 ? (
                    <div className="text-black/30 text-center py-16 text-sm">{t('noMatchesFound')} "{configSearchQuery}"</div>
                  ) : (
                    <>
                      {configSearchResults.length > 0 && (
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-xs font-bold text-black/50">
                            {configSearchResults.length} {t('devicesMatched')} · {configSearchResults.reduce((s: number, r: any) => s + r.total_matches, 0)} {t('totalMatches')}
                          </span>
                        </div>
                      )}
                      {configSearchResults.map((result: any) => {
                        const q = configSearchQuery.toLowerCase().trim();
                        return (
                          <div key={result.snapshot_id} className="rounded-xl border border-black/5 overflow-hidden">
                            <div className="flex items-center justify-between px-4 py-2.5 bg-black/[0.02] border-b border-black/5">
                              <div className="flex items-center gap-2">
                                <Server size={13} className="text-black/30" />
                                <span className="text-xs font-bold">{result.hostname}</span>
                                <span className="text-[10px] text-black/30 font-mono">{result.ip_address}</span>
                                {result.vendor && <span className="text-[9px] px-1.5 py-0.5 bg-black/5 rounded text-black/40">{result.vendor}</span>}
                                {result.platform && <span className="text-[9px] px-1.5 py-0.5 bg-black/5 rounded text-black/40">{result.platform}</span>}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] text-black/30">{result.snapshot_time ? new Date(result.snapshot_time).toLocaleString() : ''}</span>
                                <span className="text-[9px] font-bold bg-[#00bceb]/10 text-[#00bceb] px-2 py-0.5 rounded-full">{result.total_matches} match{result.total_matches > 1 ? 'es' : ''}</span>
                              </div>
                            </div>
                            <div className="bg-[#1E1E1E] font-mono text-xs">
                              {result.matches.slice(0, 12).map((m: any) => (
                                <div key={m.line} className="flex items-start px-4 py-1 hover:bg-white/5">
                                  <span className="w-10 text-right text-white/20 pr-4 select-none flex-shrink-0">{m.line}</span>
                                  <span className="text-[#d4d4d4] whitespace-pre">
                                    {m.content.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')).map((part: string, pi: number) =>
                                      part.toLowerCase() === q ? <mark key={pi} className="bg-[#00bceb]/30 text-[#00bceb] rounded px-0.5">{part}</mark> : part
                                    )}
                                  </span>
                                </div>
                              ))}
                              {result.total_matches > 12 && <div className="px-4 py-1 text-white/20 text-[10px]">... and {result.total_matches - 12} {t('moreLines')}</div>}
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ================================================================
               /config/schedule  —  定时备份
          ================================================================ */}
          {activeTab === 'config' && configPage === 'schedule' && (
            <div className="h-full overflow-auto">
              <div className={`${sectionHeaderRowClass} mb-5`}>
                <div>
                  <h2 className="text-2xl font-medium tracking-tight">{t('scheduledBackup')}</h2>
                  <p className="text-sm text-black/40">{t('enableScheduleHint')}</p>
                </div>
                <button
                  onClick={async () => {
                    const online = devices.filter(d => d.status === 'online');
                    showToast(`${t('backupStarted')} (${online.length} ${t('devicesOnline')})`, 'info');
                    for (const d of online) await takeConfigSnapshot(d, 'scheduled');
                    showToast(t('backupComplete'), 'success');
                    await loadConfigSnapshots();
                  }}
                  disabled={isTakingSnapshot}
                  className="flex items-center gap-2 px-4 py-2 bg-[#00bceb] text-white rounded-xl text-sm font-medium hover:bg-[#0096bd] transition-all disabled:opacity-50"
                >
                  <Database size={14} />
                  {t('runBackupNow')}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                {/* Storage path info */}
                <div className="bg-[#00bceb]/5 border border-[#00bceb]/20 rounded-2xl p-5 flex gap-4">
                  <div className="p-2.5 bg-[#00bceb]/10 rounded-xl text-[#00bceb] flex-shrink-0"><Database size={20} /></div>
                  <div>
                    <p className="text-sm font-semibold text-black/70">{t('backupStoragePath')}</p>
                    <p className="text-xs font-mono text-black/40 mt-0.5">backup / YYYY / MM / Vendor / Hostname /</p>
                    <p className="text-xs font-mono text-black/30">YYYYMMDD_HHMMSS_trigger.cfg</p>
                    <p className="text-[10px] text-black/30 mt-2">{t('backupPathHint')}</p>
                  </div>
                </div>
                {/* Summary */}
                <div className="bg-white border border-black/5 rounded-2xl p-5 shadow-sm flex items-center gap-6">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-[#00bceb]">{configSnapshots.length}</p>
                    <p className="text-[10px] text-black/30 mt-1 uppercase font-bold tracking-wider">{t('snapshotsCount')}</p>
                  </div>
                  <div className="w-px h-12 bg-black/5" />
                  <div className="text-center">
                    <p className="text-3xl font-bold">{devices.filter(d => d.status === 'online').length}</p>
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
                {/* Schedule settings */}
                <div className="bg-white border border-black/5 rounded-2xl p-6 shadow-sm">
                  <h3 className="text-sm font-bold mb-5">⏰ {t('scheduledBackup')}</h3>
                  <div className="space-y-5">
                    {/* Toggle */}
                    <div className="flex items-center justify-between pb-4 border-b border-black/5">
                      <div>
                        <p className="text-sm font-medium">{t('enableSchedule')}</p>
                        <p className="text-[11px] text-black/40 mt-0.5">{t('enableScheduleHint')}</p>
                      </div>
                      <button onClick={() => setScheduleEnabled(!scheduleEnabled)}
                        title={scheduleEnabled ? (language === 'zh' ? '关闭定时备份' : 'Disable scheduled backup') : (language === 'zh' ? '开启定时备份' : 'Enable scheduled backup')}
                        className={`relative w-11 h-6 rounded-full transition-colors ${scheduleEnabled ? 'bg-[#00bceb]' : 'bg-black/10'}`}>
                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${scheduleEnabled ? 'translate-x-5' : ''}`} />
                      </button>
                    </div>
                    {/* Time */}
                    <div className={`flex items-end gap-3 transition-opacity ${scheduleEnabled ? '' : 'opacity-40 pointer-events-none'}`}>
                      <div>
                        <label className="text-[10px] font-bold uppercase text-black/30 block mb-1">{t('scheduleHour')}</label>
                        <select value={scheduleHour} onChange={e => setScheduleHour(Number(e.target.value))}
                          title={language === 'zh' ? '定时备份小时' : 'Scheduled backup hour'}
                          className="px-3 py-2 border border-black/10 rounded-xl text-sm outline-none bg-white w-28">
                          {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{String(i).padStart(2,'0')}:00</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase text-black/30 block mb-1">{t('scheduleMinute')}</label>
                        <select value={scheduleMinute} onChange={e => setScheduleMinute(Number(e.target.value))}
                          title={language === 'zh' ? '定时备份分钟' : 'Scheduled backup minute'}
                          className="px-3 py-2 border border-black/10 rounded-xl text-sm outline-none bg-white w-24">
                          {[0,15,30,45].map(m => <option key={m} value={m}>{String(m).padStart(2,'0')}</option>)}
                        </select>
                      </div>
                      <p className="text-xs text-black/40 mb-2">
                        {t('nextBackupAt')}: <strong className="font-mono text-black/60">
                          {String(scheduleHour).padStart(2,'0')}:{String(scheduleMinute).padStart(2,'0')} {language === 'zh' ? '（每天）' : '(daily)'}
                        </strong>
                      </p>
                    </div>
                    {/* Retention */}
                    <div className="pt-4 border-t border-black/5">
                      <label className="text-[10px] font-bold uppercase text-black/30 block mb-1">{t('retentionPeriod')}</label>
                      <div className="flex items-center gap-3">
                        <select value={retentionDays} onChange={e => setRetentionDays(Number(e.target.value))}
                          title={language === 'zh' ? '保留天数' : 'Retention days'}
                          className="px-3 py-2 border border-black/10 rounded-xl text-sm outline-none bg-white">
                          <option value={30}>30 {t('retentionDays')}</option>
                          <option value={90}>90 {t('retentionDays')}</option>
                          <option value={180}>180 {t('retentionDays')}</option>
                          <option value={365}>1 {language === 'zh' ? '年' : 'yr'} (365d)</option>
                          <option value={730}>2 {language === 'zh' ? '年' : 'yr'} (730d)</option>
                        </select>
                        <p className="text-[11px] text-black/30">{t('retentionHint')}</p>
                      </div>
                    </div>
                    {/* Save */}
                    <div className="pt-2">
                      <button onClick={saveScheduleConfig} disabled={scheduleLoading}
                        className="flex items-center gap-2 px-5 py-2 bg-black text-white rounded-xl text-sm font-medium hover:bg-black/80 transition-all disabled:opacity-50">
                        {scheduleLoading && <RotateCcw size={14} className="animate-spin" />}
                        {t('saveSchedule')}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Per-device backup stats */}
                <div className="bg-white border border-black/5 rounded-2xl p-6 shadow-sm">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-black/40 mb-4">{t('backupStats')}</h3>
                  <div className="space-y-2">
                    {devices.map(device => {
                      const count = configSnapshots.filter(s => s.device_id === device.id).length;
                      const latest = configSnapshots.find(s => s.device_id === device.id);
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
          )}



                    {activeTab === 'configuration' && (
            <div className="h-full flex flex-col gap-5 overflow-hidden">
              <div className={sectionHeaderRowClass}>
                <div>
                  <h2 className="text-2xl font-medium tracking-tight">{t('configManagement')}</h2>
                  <p className="text-sm text-black/40">
                    {language === 'zh'
                      ? '把模板资产、渲染预览、发布范围和发布检查放到同一个工作台里。'
                      : 'Bring template assets, rendered preview, release scope, and preflight checks into one workspace.'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <label className="cursor-pointer px-4 py-2 border border-black/10 rounded-xl text-sm font-medium hover:bg-black/5 transition-all">
                    {t('importVars')}
                    <input type="file" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleImportVars} />
                  </label>
                  <button
                    onClick={handleNewTemplate}
                    className="bg-[#00bceb] text-white px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-[#0096bd] transition-all shadow-lg shadow-[#00bceb]/20"
                  >
                    <Plus size={18} />
                    {t('newTemplate')}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 flex-shrink-0">
                <div className="bg-white rounded-2xl border border-black/5 p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-[0.24em] text-black/35 font-bold">
                      {language === 'zh' ? '模板资产' : 'Template Assets'}
                    </span>
                    <FolderOpen size={14} className="text-black/25" />
                  </div>
                  <p className="mt-3 text-3xl font-semibold text-black">{configTemplates.length}</p>
                  <p className="mt-1 text-xs text-black/45">
                    {language === 'zh'
                      ? `${configTemplates.filter((tpl) => tpl.category === 'official').length} 个官方模板，${configTemplates.filter((tpl) => tpl.category !== 'official').length} 个自定义模板`
                      : `${configTemplates.filter((tpl) => tpl.category === 'official').length} official, ${configTemplates.filter((tpl) => tpl.category !== 'official').length} custom`}
                  </p>
                </div>
                <div className="bg-white rounded-2xl border border-black/5 p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-[0.24em] text-black/35 font-bold">
                      {language === 'zh' ? '变量完备度' : 'Variable Coverage'}
                    </span>
                    <Database size={14} className="text-black/25" />
                  </div>
                  <p className="mt-3 text-3xl font-semibold text-black">{configVariableKeys.length - configMissingVariables.length}/{configVariableKeys.length || 0}</p>
                  <p className="mt-1 text-xs text-black/45">
                    {configMissingVariables.length === 0
                      ? (language === 'zh' ? '当前模板变量已全部赋值' : 'All variables are populated for the selected template')
                      : (language === 'zh' ? `缺失 ${configMissingVariables.length} 个变量` : `${configMissingVariables.length} variables missing`)}
                  </p>
                </div>
                <div className="bg-white rounded-2xl border border-black/5 p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-[0.24em] text-black/35 font-bold">
                      {language === 'zh' ? '匹配设备' : 'Matched Targets'}
                    </span>
                    <Server size={14} className="text-black/25" />
                  </div>
                  <p className="mt-3 text-3xl font-semibold text-black">{configScopedDevices.length}</p>
                  <p className="mt-1 text-xs text-black/45">
                    {language === 'zh'
                      ? `${configScopedOnlineCount} 台在线，可用于当前发布范围`
                      : `${configScopedOnlineCount} online devices in current release scope`}
                  </p>
                </div>
                <div className="bg-white rounded-2xl border border-black/5 p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-[0.24em] text-black/35 font-bold">
                      {language === 'zh' ? '发布就绪度' : 'Release Readiness'}
                    </span>
                    <ShieldCheck size={14} className="text-black/25" />
                  </div>
                  <p className="mt-3 text-3xl font-semibold text-black">{configReadinessScore}</p>
                  <p className="mt-1 text-xs text-black/45">
                    {configValidationIssues.length === 0
                      ? (language === 'zh' ? '通过基础校验，可进入发布动作' : 'Base checks passed. Ready for release actions')
                      : (language === 'zh' ? `${configValidationIssues.length} 个阻断项待处理` : `${configValidationIssues.length} blocking issues to resolve`)}
                  </p>
                </div>
              </div>

              <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-12 gap-4 overflow-hidden">
                <div className="xl:col-span-3 flex flex-col gap-4 min-h-0 overflow-auto pr-1">
                  <div className="bg-[#f3fbfd] rounded-2xl border border-[#b7edf7] p-5 shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-xl bg-[#00bceb]/10 text-[#0096bd]">
                        <Activity size={18} />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">
                          {language === 'zh' ? '配置中心工作流' : 'Configuration Workflow'}
                        </h3>
                        <p className="mt-1 text-xs leading-5 text-slate-600">
                          {language === 'zh'
                            ? '先选模板资产，再完成变量渲染和发布范围确认，最后做发布前检查后再下发。'
                            : 'Select a template asset, complete variable rendering and release scope, then run preflight checks before deployment.'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-black/5 p-5 shadow-sm min-h-0 flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-black/40">{t('templates')}</h3>
                        <p className="mt-1 text-[11px] text-black/35">
                          {language === 'zh' ? '按厂商分组的模板资产库' : 'Template asset library grouped by vendor'}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-5 overflow-auto pr-1">
                      {Object.entries(
                        configTemplates.reduce((acc, tpl) => {
                          const vendor = tpl.vendor || 'Custom';
                          if (!acc[vendor]) acc[vendor] = [];
                          acc[vendor].push(tpl);
                          return acc;
                        }, {} as Record<string, ConfigTemplate[]>) as Record<string, ConfigTemplate[]>
                      ).map(([vendor, templates]: [string, ConfigTemplate[]]) => (
                        <div key={vendor} className="space-y-2">
                          <div className="flex items-center justify-between px-1">
                            <h4 className="text-[10px] font-bold uppercase tracking-[0.22em] text-black/30">{vendor}</h4>
                            <span className="text-[10px] text-black/25">{templates.length}</span>
                          </div>
                          <div className="space-y-2">
                            {templates.map((tpl) => {
                              const templateVars = extractVars(tpl.content);
                              const isSelected = selectedTemplateId === tpl.id;
                              return (
                                <button
                                  key={tpl.id}
                                  onClick={() => setSelectedTemplateId(tpl.id)}
                                  className={`w-full rounded-xl border p-3 text-left transition-all ${isSelected
                                    ? 'border-black bg-black text-white shadow-md'
                                    : 'border-black/5 bg-white hover:border-black/15 hover:bg-black/[0.02] text-black/75'}`}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-sm font-semibold">{tpl.name}</span>
                                        {tpl.category === 'official' && (
                                          <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase ${isSelected ? 'bg-white/10 text-white/70' : 'bg-blue-100 text-blue-700'}`}>
                                            {t('official')}
                                          </span>
                                        )}
                                      </div>
                                      <p className={`mt-1 text-[10px] ${isSelected ? 'text-white/45' : 'text-black/35'}`}>
                                        {language === 'zh' ? `最近使用 ${tpl.lastUsed}` : `Last used ${tpl.lastUsed}`}
                                      </p>
                                    </div>
                                    <span className={`text-[10px] font-bold uppercase ${isSelected ? 'text-white/45' : 'text-black/30'}`}>{tpl.type}</span>
                                  </div>
                                  <div className="mt-3 flex items-center gap-2 flex-wrap text-[10px]">
                                    <span className={`px-2 py-1 rounded-full ${isSelected ? 'bg-white/10 text-white/60' : 'bg-black/[0.04] text-black/45'}`}>
                                      {templateVars.length} {language === 'zh' ? '变量' : 'vars'}
                                    </span>
                                    <span className={`px-2 py-1 rounded-full ${isSelected ? 'bg-white/10 text-white/60' : 'bg-black/[0.04] text-black/45'}`}>
                                      {tpl.vendor || 'Custom'}
                                    </span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-black/5 p-5 shadow-sm min-h-0 flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-black/40">{t('globalVars')}</h3>
                        <p className="mt-1 text-[11px] text-black/35">
                          {language === 'zh' ? '渲染模板时复用的全局参数' : 'Reusable variables for template rendering'}
                        </p>
                      </div>
                      <button
                        onClick={handleAddVar}
                        className="text-[10px] text-blue-600 font-bold hover:underline uppercase"
                      >
                        {t('addVar')}
                      </button>
                    </div>
                    <div className="space-y-3 overflow-auto pr-1">
                      {globalVars.map((v, i) => (
                        <div key={v.id || i} className="group relative flex justify-between items-center py-2 border-b border-black/5">
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-mono text-black/60 truncate">{v.key}</span>
                            <span className="text-[10px] text-black/30 font-mono">{'{{ ' + v.key + ' }}'}</span>
                          </div>
                          <div className="flex items-center gap-3 ml-3">
                            <span className="text-xs font-medium max-w-[120px] truncate">{v.value}</span>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText('{{ ' + v.key + ' }}');
                                  showToast(t('copied'), 'success');
                                }}
                                className="bg-white shadow-sm border border-black/5 p-1 rounded text-black/40 hover:text-black"
                                title="Copy reference"
                              >
                                <FileText size={12} />
                              </button>
                              <button
                                onClick={() => v.id && handleDeleteVar(v.id)}
                                className="bg-white shadow-sm border border-black/5 p-1 rounded text-red-400 hover:text-red-600"
                                title="Delete variable"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 p-3 bg-blue-50 rounded-xl border border-blue-100">
                      <p className="text-[10px] text-blue-800 leading-relaxed">
                        <strong>{t('howToRef')}:</strong> {t('varRefGuide')}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="xl:col-span-6 min-h-0 bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden flex flex-col">
                  <div className="p-5 border-b border-black/5 bg-black/[0.015]">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="p-2 bg-black/5 rounded-xl text-black/60">
                          <Settings size={18} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              type="text"
                              value={selectedConfigTemplate?.name || ''}
                              title={language === 'zh' ? '模板名称' : 'Template name'}
                              onChange={(e) => {
                                const newName = e.target.value;
                                setConfigTemplates((prev) => prev.map((template) =>
                                  template.id === selectedTemplateId ? { ...template, name: newName } : template
                                ));
                              }}
                              className="bg-black/5 px-3 py-1.5 rounded-xl font-medium border border-black/5 focus:border-black/20 outline-none transition-all min-w-[240px] max-w-full"
                              placeholder="Template Name"
                            />
                            <select
                              value={selectedConfigTemplate?.vendor || 'Custom'}
                              title={language === 'zh' ? '模板厂商' : 'Template vendor'}
                              onChange={(e) => {
                                const newVendor = e.target.value;
                                setConfigTemplates((prev) => prev.map((template) =>
                                  template.id === selectedTemplateId ? { ...template, vendor: newVendor } : template
                                ));
                              }}
                              className="bg-black/5 text-xs px-2.5 py-1.5 rounded-xl outline-none"
                            >
                              {['Cisco', 'Juniper', 'Huawei', 'H3C', 'Arista', 'Other', 'Custom'].map((vendor) => (
                                <option key={vendor} value={vendor}>{vendor}</option>
                              ))}
                            </select>
                            <select
                              value={selectedConfigTemplate?.type || 'Jinja2'}
                              title={language === 'zh' ? '模板类型' : 'Template type'}
                              onChange={(e) => {
                                const newType = e.target.value as 'Jinja2' | 'YAML';
                                setConfigTemplates((prev) => prev.map((template) =>
                                  template.id === selectedTemplateId ? { ...template, type: newType } : template
                                ));
                              }}
                              className="bg-black/5 text-xs font-bold uppercase px-2.5 py-1.5 rounded-xl outline-none"
                            >
                              <option value="Jinja2">Jinja2</option>
                              <option value="YAML">YAML</option>
                            </select>
                          </div>
                          <p className="mt-2 text-[11px] text-black/40">
                            {language === 'zh'
                              ? '上方维护模板名称、适用厂商和格式；下方切换源码、渲染结果和发布前检查。'
                              : 'Manage template name, vendor, and format here, then switch between source, rendered result, and release checks below.'}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={handleDiscardChanges}
                          className="px-3 py-2 text-xs font-medium text-black/50 hover:text-black border border-black/10 rounded-xl hover:bg-black/[0.03]"
                        >
                          {t('discard')}
                        </button>
                        <button
                          onClick={() => setConfigWorkspaceView('rendered')}
                          className="px-3 py-2 text-xs font-medium text-black/70 border border-black/10 rounded-xl hover:bg-black/[0.03] flex items-center gap-1.5"
                        >
                          <Eye size={14} />
                          {language === 'zh' ? '渲染预览' : 'Rendered Preview'}
                        </button>
                        <button
                          onClick={handleValidateTemplateWorkspace}
                          className="px-3 py-2 bg-black text-white rounded-xl text-xs font-medium hover:bg-black/80 transition-all flex items-center gap-1.5"
                        >
                          <ShieldCheck size={14} />
                          {language === 'zh' ? '发布前检查' : 'Preflight Check'}
                        </button>
                        <button
                          onClick={handleSaveTemplate}
                          className="px-4 py-2 bg-[#0f172a] text-white rounded-xl text-xs font-medium hover:bg-[#020617] transition-all"
                        >
                          {t('saveChanges')}
                        </button>
                        <button
                          onClick={handleCreateScenarioDraftFromTemplate}
                          className="px-4 py-2 bg-[#005b75] text-white rounded-xl text-xs font-medium hover:bg-[#00465a] transition-all"
                        >
                          {language === 'zh' ? '转成场景草稿' : 'Convert to Scenario Draft'}
                        </button>
                        <button
                          onClick={handleOpenTemplateDeploy}
                          className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-medium hover:bg-emerald-700 transition-all shadow-sm"
                        >
                          {language === 'zh' ? '提交到 Automation' : 'Send to Automation'}
                        </button>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {[
                        { key: 'source', label: language === 'zh' ? '源模板' : 'Source' },
                        { key: 'rendered', label: language === 'zh' ? '渲染结果' : 'Rendered' },
                        { key: 'checks', label: language === 'zh' ? '发布检查' : 'Checks' },
                      ].map((tab) => (
                        <button
                          key={tab.key}
                          onClick={() => setConfigWorkspaceView(tab.key as 'source' | 'rendered' | 'checks')}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${configWorkspaceView === tab.key
                            ? 'bg-black text-white'
                            : 'bg-black/[0.04] text-black/55 hover:bg-black/[0.08]'}`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="px-5 py-3 border-b border-black/5 bg-amber-50/70 text-[11px] text-amber-900/80">
                    {configMissingVariables.length > 0
                      ? (language === 'zh'
                        ? `当前仍有未赋值变量: ${configMissingVariables.join('、')}。渲染预览会保留占位符。`
                        : `Variables still missing: ${configMissingVariables.join(', ')}. Rendered preview will keep placeholders.`)
                      : (language === 'zh'
                        ? '渲染预览仅基于全局变量替换，不会连接设备拉取运行态配置。'
                        : 'Rendered preview uses global variables only and does not connect to devices for runtime config.')}
                  </div>

                  {configWorkspaceView === 'source' && (
                    <div className="flex-1 flex bg-[#1E1E1E] overflow-hidden min-h-0">
                      <div className="w-12 py-6 bg-black/20 text-white/20 select-none text-right pr-3 font-mono text-sm leading-6 overflow-hidden">
                        {editorContent.split('\n').map((_, i) => <div key={i}>{i + 1}</div>)}
                      </div>
                      <textarea
                        value={editorContent}
                        onChange={(e) => setEditorContent(e.target.value)}
                        title={language === 'zh' ? '模板源码编辑器' : 'Template source editor'}
                        placeholder={language === 'zh' ? '在这里编辑模板源码' : 'Edit template source here'}
                        className="flex-1 p-6 bg-transparent font-mono text-sm text-[#D4D4D4] outline-none resize-none leading-6"
                        spellCheck={false}
                      />
                    </div>
                  )}

                  {configWorkspaceView === 'rendered' && (
                    <div className="flex-1 min-h-0 overflow-auto bg-[#101820] text-[#d6e2ea] font-mono text-sm leading-6 p-6">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.22em] text-white/35">
                            {language === 'zh' ? '渲染结果' : 'Rendered Result'}
                          </p>
                          <p className="mt-1 text-[11px] text-white/45">
                            {language === 'zh' ? '用于人工预览、Review 和发布前核对。' : 'Use this for operator preview, review, and pre-release verification.'}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(configRenderedPreview);
                            showToast(t('copied'), 'success');
                          }}
                          className="px-3 py-1.5 rounded-xl border border-white/10 text-xs text-white/70 hover:text-white hover:border-white/20 flex items-center gap-1.5"
                        >
                          <Copy size={13} />
                          {language === 'zh' ? '复制渲染结果' : 'Copy rendered output'}
                        </button>
                      </div>
                      <pre className="whitespace-pre-wrap break-words">{configRenderedPreview || (language === 'zh' ? '暂无内容' : 'No content')}</pre>
                    </div>
                  )}

                  {configWorkspaceView === 'checks' && (
                    <div className="flex-1 min-h-0 overflow-auto p-5 bg-[#fafafa]">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white rounded-2xl border border-black/5 p-5 shadow-sm">
                          <div className="flex items-center gap-2">
                            <ShieldCheck size={16} className="text-emerald-600" />
                            <h3 className="text-sm font-semibold text-black">
                              {language === 'zh' ? '阻断项' : 'Blocking Checks'}
                            </h3>
                          </div>
                          <div className="mt-4 space-y-2">
                            {configValidationIssues.length === 0 ? (
                              <div className="flex items-start gap-2 text-sm text-emerald-700">
                                <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" />
                                <span>{language === 'zh' ? '基础检查全部通过，可以执行发布。' : 'All base checks passed. Release can proceed.'}</span>
                              </div>
                            ) : configValidationIssues.map((issue) => (
                              <div key={issue} className="flex items-start gap-2 text-sm text-red-600">
                                <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                                <span>{issue}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="bg-white rounded-2xl border border-black/5 p-5 shadow-sm">
                          <div className="flex items-center gap-2">
                            <AlertCircle size={16} className="text-amber-600" />
                            <h3 className="text-sm font-semibold text-black">
                              {language === 'zh' ? '发布提醒' : 'Release Advisories'}
                            </h3>
                          </div>
                          <div className="mt-4 space-y-2">
                            {configValidationWarnings.length === 0 ? (
                              <div className="flex items-start gap-2 text-sm text-slate-600">
                                <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0 text-emerald-600" />
                                <span>{language === 'zh' ? '没有额外风险提醒。' : 'No additional advisories.'}</span>
                              </div>
                            ) : configValidationWarnings.map((warning) => (
                              <div key={warning} className="flex items-start gap-2 text-sm text-amber-700">
                                <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                                <span>{warning}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="bg-white rounded-2xl border border-black/5 p-5 shadow-sm md:col-span-2">
                          <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div>
                              <h3 className="text-sm font-semibold text-black">
                                {language === 'zh' ? '推荐的内网发布顺序' : 'Recommended Internal Release Flow'}
                              </h3>
                              <p className="mt-1 text-xs text-black/45">
                                {language === 'zh'
                                  ? '适合当前内网使用场景，不强依赖审批系统或外部工单平台。'
                                  : 'Optimized for internal-only use without depending on approval portals or external ticketing systems.'}
                              </p>
                            </div>
                          </div>
                          <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
                            {[
                              language === 'zh' ? '1. 锁定模板与变量版本' : '1. Freeze template and variables',
                              language === 'zh' ? '2. 按平台/角色/站点筛目标' : '2. Narrow targets by platform/role/site',
                              language === 'zh' ? '3. 先挑在线设备做小范围验证' : '3. Start with a small online canary set',
                              language === 'zh' ? '4. 再执行批量下发和回溯核查' : '4. Then deploy broadly and review outcomes',
                            ].map((item) => (
                              <div key={item} className="rounded-xl border border-black/5 bg-black/[0.02] px-3 py-3 text-black/70">{item}</div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="xl:col-span-3 flex flex-col gap-4 min-h-0 overflow-auto pl-1">
                  <div className="bg-white rounded-2xl border border-black/5 p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <Filter size={15} className="text-black/40" />
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-black/40">
                        {language === 'zh' ? '发布范围' : 'Release Scope'}
                      </h3>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-black/30 block mb-1.5">
                          {language === 'zh' ? '平台' : 'Platform'}
                        </label>
                        <select
                          value={configScopePlatform}
                          title={language === 'zh' ? '发布范围平台' : 'Release scope platform'}
                          onChange={(e) => setConfigScopePlatform(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-black/10 bg-white text-sm outline-none"
                        >
                          <option value="all">{language === 'zh' ? '全部平台' : 'All platforms'}</option>
                          {configPlatformOptions.map((platform) => (
                            <option key={platform} value={platform}>{getPlatformLabel(platform)}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-black/30 block mb-1.5">
                          {language === 'zh' ? '设备角色' : 'Device Role'}
                        </label>
                        <select
                          value={configScopeRole}
                          title={language === 'zh' ? '发布范围设备角色' : 'Release scope device role'}
                          onChange={(e) => setConfigScopeRole(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-black/10 bg-white text-sm outline-none"
                        >
                          <option value="all">{language === 'zh' ? '全部角色' : 'All roles'}</option>
                          {configRoleOptions.map((role) => (
                            <option key={role} value={role}>{role}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-black/30 block mb-1.5">
                          {language === 'zh' ? '站点' : 'Site'}
                        </label>
                        <select
                          value={configScopeSite}
                          title={language === 'zh' ? '发布范围站点' : 'Release scope site'}
                          onChange={(e) => setConfigScopeSite(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-black/10 bg-white text-sm outline-none"
                        >
                          <option value="all">{language === 'zh' ? '全部站点' : 'All sites'}</option>
                          {configSiteOptions.map((site) => (
                            <option key={site} value={site}>{site}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="mt-4 rounded-xl bg-black/[0.03] px-3 py-3 text-xs text-black/55">
                      {language === 'zh'
                        ? `当前模板厂商范围：${selectedConfigTemplate?.vendor || 'Custom'}。发布范围内共 ${configScopedDevices.length} 台设备。`
                        : `Current template vendor scope: ${selectedConfigTemplate?.vendor || 'Custom'}. ${configScopedDevices.length} devices are in release scope.`}
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-black/5 p-5 shadow-sm min-h-0 flex flex-col">
                    <div className="flex items-center justify-between gap-2 mb-4">
                      <div>
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-black/40">
                          {language === 'zh' ? '目标设备预览' : 'Target Preview'}
                        </h3>
                        <p className="mt-1 text-[11px] text-black/35">
                          {language === 'zh' ? '按当前过滤条件匹配到的设备' : 'Devices matched by the current release filters'}
                        </p>
                      </div>
                      <span className="text-[10px] px-2 py-1 rounded-full bg-black/[0.05] text-black/50">
                        {configScopedOnlineCount}/{configScopedDevices.length} {language === 'zh' ? '在线' : 'online'}
                      </span>
                    </div>
                    <div className="space-y-2 overflow-auto pr-1">
                      {configScopedDevices.slice(0, 8).map((device) => (
                        <div key={device.id} className="rounded-xl border border-black/5 px-3 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-black truncate">{device.hostname}</p>
                              <p className="mt-1 text-[11px] text-black/40 font-mono truncate">{device.ip_address}</p>
                            </div>
                            <span className={`text-[10px] px-2 py-1 rounded-full ${device.status === 'online' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                              {device.status}
                            </span>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-black/45">
                            <span className="px-2 py-1 rounded-full bg-black/[0.04]">{getPlatformLabel(device.platform)}</span>
                            {device.role && <span className="px-2 py-1 rounded-full bg-black/[0.04]">{device.role}</span>}
                            {device.site && <span className="px-2 py-1 rounded-full bg-black/[0.04]">{device.site}</span>}
                          </div>
                        </div>
                      ))}
                      {configScopedDevices.length === 0 && (
                        <div className="rounded-xl border border-dashed border-black/10 px-4 py-8 text-center text-sm text-black/35">
                          {language === 'zh' ? '当前没有匹配设备，请调整发布范围。' : 'No devices match the current filters. Adjust the release scope.'}
                        </div>
                      )}
                      {configScopedDevices.length > 8 && (
                        <p className="text-[11px] text-black/35 px-1">
                          {language === 'zh' ? `另有 ${configScopedDevices.length - 8} 台设备未展开显示` : `${configScopedDevices.length - 8} more devices not expanded here`}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-black/5 p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <Globe size={15} className="text-black/40" />
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-black/40">
                        {language === 'zh' ? '治理提示' : 'Governance Notes'}
                      </h3>
                    </div>
                    <div className="space-y-3 text-sm text-black/65">
                      <div className="rounded-xl bg-black/[0.03] px-3 py-3">
                        <p className="font-medium text-black">
                          {language === 'zh' ? '建议动作' : 'Recommended Action'}
                        </p>
                        <p className="mt-1 text-xs text-black/50">
                          {configReadinessScore >= 85
                            ? (language === 'zh' ? '先挑一台在线设备验证，再逐步扩大范围。' : 'Validate on one online device first, then expand gradually.')
                            : (language === 'zh' ? '先补全变量或缩小发布范围，再执行下发。' : 'Complete variables or narrow the scope before deployment.')}
                        </p>
                      </div>
                      <div className="rounded-xl bg-black/[0.03] px-3 py-3">
                        <p className="font-medium text-black">
                          {language === 'zh' ? '当前能力边界' : 'Current Capability Boundary'}
                        </p>
                        <p className="mt-1 text-xs text-black/50">
                          {language === 'zh'
                            ? '当前页面提供模板渲染预览、范围筛选和单设备下发入口；如要做审批、版本签发和回滚编排，建议后续单独补后台流程。'
                            : 'This workspace currently provides rendered preview, release scoping, and single-device deployment. Approval, signed releases, and rollback orchestration should be added as separate backend workflows later.'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <Suspense fallback={lazyPanelFallback}>
              <UsersTab
                users={users}
                showAddUserModal={showAddUserModal}
                setShowAddUserModal={setShowAddUserModal}
                showEditUserModal={showEditUserModal}
                setShowEditUserModal={setShowEditUserModal}
                editingUser={editingUser}
                setEditingUser={setEditingUser}
                newUserForm={newUserForm}
                setNewUserForm={setNewUserForm}
                editUserForm={editUserForm}
                setEditUserForm={setEditUserForm}
                showNewUserPwd={showNewUserPwd}
                setShowNewUserPwd={setShowNewUserPwd}
                showEditUserPwd={showEditUserPwd}
                setShowEditUserPwd={setShowEditUserPwd}
                handleAddUser={handleAddUser}
                handleEditUser={handleEditUser}
                language={language}
                t={t}
              />
            </Suspense>
          )}
          {activeTab === 'history' && (
            <Suspense fallback={lazyPanelFallback}>
              <HistoryTab
                auditRows={auditRows}
                auditTotal={auditTotal}
                auditPage={auditPage}
                setAuditPage={setAuditPage}
                auditPageSize={auditPageSize}
                setAuditPageSize={setAuditPageSize}
                auditLoading={auditLoading}
                auditCategoryFilter={auditCategoryFilter}
                setAuditCategoryFilter={setAuditCategoryFilter}
                auditSeverityFilter={auditSeverityFilter}
                setAuditSeverityFilter={setAuditSeverityFilter}
                auditStatusFilter={auditStatusFilter}
                setAuditStatusFilter={setAuditStatusFilter}
                auditTimeFilter={auditTimeFilter}
                setAuditTimeFilter={setAuditTimeFilter}
                openAuditEventDetail={openAuditEventDetail}
                language={language}
                t={t}
              />
            </Suspense>
          )}

          {activeTab === 'reports' && (
            <Suspense fallback={lazyPanelFallback}>
              <ReportsTab
                devices={devices}
                jobs={jobs}
                complianceOverview={complianceOverview}
                platformData={platformData}
                language={language}
                t={t}
              />
            </Suspense>
          )}

          {activeTab === 'config' && configPage === 'drift' && (
            <Suspense fallback={lazyPanelFallback}>
              <ConfigDriftTab language={language} t={t} />
            </Suspense>
          )}

          {activeTab === 'capacity' && (
            <Suspense fallback={lazyPanelFallback}>
              <CapacityPlanningTab language={language} t={t} />
            </Suspense>
          )}

          {activeTab === 'ipam' && (
            <Suspense fallback={lazyPanelFallback}>
              <IPVlanTab language={language} t={t} />
            </Suspense>
          )}
        </main>
        <footer className={`h-10 px-8 border-t flex items-center justify-between text-[11px] ${resolvedTheme === 'dark' ? 'border-white/10 text-white/45 bg-[#0b1320]' : 'border-black/8 text-black/45 bg-white/70'}`}>
          <span>Copyright (c) {new Date().getFullYear()} NetPilot. All rights reserved.</span>
          <span className="font-mono">NOC v2.0</span>
        </footer>
      </div>

      {/* ── Command Preview Modal ── */}
      {showCustomCommandModal && (
        <div
          className="fixed inset-0 bg-black/55 backdrop-blur-sm flex items-center justify-center z-[85] p-4"
          onClick={closeCustomCommandModal}
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-3xl max-h-[86vh] rounded-3xl bg-white shadow-2xl border border-black/8 overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-5 border-b border-black/6 bg-[linear-gradient(135deg,rgba(0,188,235,0.08),rgba(0,82,122,0.04))]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#0087a9]">
                    {language === 'zh' ? 'Direct Execution' : 'Direct Execution'}
                  </p>
                  <h3 className="mt-1 text-xl font-semibold text-black/85">
                    {language === 'zh' ? '自定义命令' : 'Custom Command'}
                  </h3>
                </div>
                <button
                  onClick={closeCustomCommandModal}
                  title={language === 'zh' ? '关闭' : 'Close'}
                  className="text-black/35 hover:text-black/70 transition-colors mt-1"
                >
                  <X size={20} />
                </button>
              </div>
              {/* Mode toggle — primary control, always visible in header */}
              <div className="mt-4 flex items-center gap-3">
                <span className="text-[11px] font-semibold text-black/40">
                  {language === 'zh' ? '执行模式' : 'Mode'}
                </span>
                <div className="flex items-center bg-black/[0.06] rounded-xl p-[3px] gap-[3px]">
                  <button
                    onClick={() => setCustomCommandMode('query')}
                    className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${
                      customCommandMode === 'query'
                        ? 'bg-white text-[#0087a9] shadow-sm shadow-black/10'
                        : 'text-black/40 hover:text-black/60'
                    }`}
                  >
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" className="opacity-80"><circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.8"/><path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                    {language === 'zh' ? '查看' : 'Query'}
                  </button>
                  <button
                    onClick={() => setCustomCommandMode('config')}
                    className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${
                      customCommandMode === 'config'
                        ? 'bg-[#005b75] text-white shadow-sm shadow-[#005b75]/30'
                        : 'text-black/40 hover:text-black/60'
                    }`}
                  >
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" className="opacity-80"><path d="M2 4h12M2 8h8M2 12h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                    {language === 'zh' ? '配置' : 'Config'}
                  </button>
                </div>
                <span className={`text-[11px] font-medium transition-colors ${
                  customCommandMode === 'query' ? 'text-sky-600' : 'text-amber-600'
                }`}>
                  {customCommandMode === 'query'
                    ? (language === 'zh' ? 'Exec 模式 — 只读，不改变配置' : 'Exec mode — read-only, no changes')
                    : (language === 'zh' ? 'Config 模式 — 自动进入配置视图' : 'Config mode — enters config view automatically')}
                </span>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-auto p-6 space-y-5 bg-[#fbfdff]">
              <div className="grid grid-cols-1 lg:grid-cols-[1.25fr,0.75fr] gap-5">
                <div className="space-y-4">
                  <div className="rounded-2xl border border-black/8 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-black/35">
                        {language === 'zh' ? '命令内容' : 'Command Content'}
                      </p>
                      <div className="flex items-center gap-1.5">
                        {customCommandMode === 'query' && (
                          <button
                            disabled={!customCommand.trim()}
                            onClick={() => {
                              const label = prompt(language === 'zh' ? '给这个查询起个名字：' : 'Name this query:', '');
                              if (!label) return;
                              try {
                                const saved: { icon: string; label: string; labelEn: string; cmds: string }[] = JSON.parse(localStorage.getItem('quickQuerySaved') || '[]');
                                saved.push({ icon: '⭐', label, labelEn: label, cmds: customCommand.trim() });
                                localStorage.setItem('quickQuerySaved', JSON.stringify(saved));
                                showToast(language === 'zh' ? '已保存到快捷查询' : 'Saved to Quick Query', 'success');
                              } catch { /* ignore */ }
                            }}
                            className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all ${customCommand.trim()
                              ? 'border-[#00bceb]/30 text-[#0087a9] hover:bg-[#00bceb]/10' : 'border-black/8 text-black/25 cursor-not-allowed'}`}
                          >
                            {language === 'zh' ? '+ 快捷查询' : '+ Quick Query'}
                          </button>
                        )}
                        <button
                          onClick={() => saveFavorite(customCommand)}
                          disabled={!customCommand.trim()}
                          className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all ${customCommand.trim()
                            ? (isFavorited(customCommand)
                              ? 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100'
                              : 'border-black/10 text-black/60 hover:bg-black/5')
                            : 'border-black/8 text-black/25 cursor-not-allowed'}`}
                        >
                          {isFavorited(customCommand)
                            ? (language === 'zh' ? '取消收藏' : 'Unfavorite')
                            : (language === 'zh' ? '收藏命令' : 'Save Favorite')}
                        </button>
                      </div>
                    </div>
                    <textarea
                      value={customCommand}
                      onChange={(e) => setCustomCommand(e.target.value)}
                      placeholder={customCommandMode === 'query'
                        ? (language === 'zh'
                          ? '例如:\nshow ip interface brief\nshow version\ndisplay version'
                          : 'Example:\nshow ip interface brief\nshow version\ndisplay version')
                        : (language === 'zh'
                          ? '例如:\ninterface Vlan100\n description Branch Office\n ip address 10.10.0.1 255.255.255.0'
                          : 'Example:\ninterface Vlan100\n description Branch Office\n ip address 10.10.0.1 255.255.255.0')}
                      className="w-full min-h-[260px] resize-y rounded-2xl border border-black/10 bg-[#0c1622] px-4 py-3 text-[13px] leading-6 text-[#d9f3ff] font-mono outline-none focus:border-[#00bceb]/50"
                    />
                  </div>

                  {customCommandVars.length > 0 && (
                    <div className="rounded-2xl border border-black/8 bg-white p-4 shadow-sm space-y-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-black/35">
                          {language === 'zh' ? '变量替换' : 'Variable Substitution'}
                        </p>
                        <p className="mt-1 text-xs text-black/40">
                          {language === 'zh' ? '使用 `{{VAR}}` 占位符时，请在这里填写值。' : 'Fill values for any `{{VAR}}` placeholders here.'}
                        </p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {customCommandVars.map((key) => (
                          <label key={key} className="space-y-1.5">
                            <span className="text-[11px] font-semibold text-black/65">{key}</span>
                            <input
                              type="text"
                              value={scriptVars[key] || ''}
                              onChange={(e) => setScriptVars((prev) => ({ ...prev, [key]: e.target.value }))}
                              placeholder={language === 'zh' ? `输入 ${key}` : `Enter ${key}`}
                              className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-[#00bceb]/45"
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl border border-black/8 bg-white p-4 shadow-sm space-y-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-black/35">
                      {language === 'zh' ? '执行目标' : 'Execution Target'}
                    </p>
                    <div className="rounded-xl border border-black/8 bg-black/[0.02] px-3 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-black/75">
                          {batchMode
                            ? (language === 'zh' ? `批量模式 · ${batchDeviceIds.length} 台设备` : `Batch mode · ${batchDeviceIds.length} devices`)
                            : (selectedDevice
                              ? `${selectedDevice.hostname} (${selectedDevice.ip_address})`
                              : (language === 'zh' ? '未选择设备' : 'No device selected'))}
                        </p>
                        {!batchMode && selectedDevice && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[#00bceb]/10 text-[#0087a9] font-mono">
                            {selectedDevice.platform || 'unknown'}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-[11px] text-black/40">
                        {batchMode
                          ? (language === 'zh' ? '使用左侧设备列表维护批量目标。' : 'Manage batch targets from the device list on the left.')
                          : (language === 'zh' ? '当前将下发到左侧选中的单台设备。' : 'Command will run on the device selected in the left panel.')}
                      </p>
                    </div>
                    <div className={`rounded-xl px-3 py-3 text-xs leading-5 transition-all ${
                      customCommandMode === 'query'
                        ? 'border border-sky-200 bg-sky-50 text-sky-700'
                        : 'border border-amber-200 bg-amber-50 text-amber-700'
                    }`}>
                      {customCommandMode === 'query'
                        ? (language === 'zh'
                          ? '查看模式：命令在 Exec 模式下执行，适用于 show、display、ping、tracert 等只读命令。若匹配到 ntc-templates，会自动生成表格；未匹配时默认保留原始终端输出。'
                          : 'Query mode: commands run in exec mode. Use for show, display, ping, tracert — read-only, no config changes. When an ntc template matches, the result is structured automatically; otherwise the raw terminal output is preserved.')
                        : (language === 'zh'
                          ? <>配置模式——各平台自动进入配置视图：<br/>· Cisco：<code className="font-mono">configure terminal</code><br/>· Huawei / H3C：<code className="font-mono">system-view</code><br/>· Arista EOS：<code className="font-mono">configure session</code>（事务，失败自动回滚）<br/>· Juniper：<code className="font-mono">configure</code></>
                          : <><b>Config mode</b> — config view entered automatically per platform:<br/>· Cisco: <code className="font-mono">configure terminal</code><br/>· Huawei / H3C: <code className="font-mono">system-view</code><br/>· Arista EOS: <code className="font-mono">configure session</code> (transactional, auto-rollback on error)<br/>· Juniper: <code className="font-mono">configure</code></>)}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-black/8 bg-white p-4 shadow-sm space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-black/35">
                        {language === 'zh' ? '常用命令' : 'Favorites'}
                      </p>
                      <button
                        onClick={() => setShowFavorites((prev) => !prev)}
                        className="text-[11px] font-semibold text-[#0087a9] hover:text-[#006c86]"
                      >
                        {showFavorites
                          ? (language === 'zh' ? '收起' : 'Hide')
                          : (language === 'zh' ? '展开' : 'Show')}
                      </button>
                    </div>
                    {showFavorites ? (
                      commandFavorites.length > 0 ? (
                        <div className="space-y-2 max-h-[260px] overflow-auto pr-1">
                          {commandFavorites.map((favorite, idx) => (
                            <div key={`${favorite}-${idx}`} className="rounded-xl border border-black/8 bg-black/[0.02] p-3">
                              <pre className="text-[11px] leading-5 text-black/70 font-mono whitespace-pre-wrap break-all">{favorite}</pre>
                              <div className="mt-2 flex items-center justify-between gap-2">
                                <button
                                  onClick={() => setCustomCommand(favorite)}
                                  className="px-2.5 py-1.5 rounded-lg bg-[#00bceb] text-white text-[11px] font-semibold hover:bg-[#009ac2] transition-all"
                                >
                                  {language === 'zh' ? '填入编辑器' : 'Use Command'}
                                </button>
                                <button
                                  onClick={() => saveFavorite(favorite)}
                                  className="px-2.5 py-1.5 rounded-lg border border-black/10 text-[11px] font-semibold text-black/55 hover:bg-black/5 transition-all"
                                >
                                  {language === 'zh' ? '移除' : 'Remove'}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed border-black/10 px-3 py-4 text-xs text-black/35 text-center">
                          {language === 'zh' ? '还没有收藏的命令。' : 'No saved commands yet.'}
                        </div>
                      )
                    ) : (
                      <p className="text-xs text-black/35">
                        {language === 'zh' ? '可将常用配置收藏到这里，便于快速复用。' : 'Save frequently used commands here for quick reuse.'}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-black/6 bg-white flex items-center justify-between gap-3">
              <p className="text-xs text-black/35">
                {language === 'zh'
                  ? (batchMode ? '将按左侧批量目标逐台执行。' : '执行结果会自动出现在历史记录中。')
                  : (batchMode ? 'Commands will execute sequentially across the selected batch.' : 'Execution results will appear in the history view automatically.')}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={closeCustomCommandModal}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-black/60 hover:text-black hover:bg-black/5 transition-all"
                >
                  {t('cancel')}
                </button>
                <button
                  onClick={submitCustomCommand}
                  disabled={!(batchMode ? batchDeviceIds.length > 0 : selectedDevice) || !customCommand.trim() || (batchMode ? isBatchRunning : isTestingConnection)}
                  className={`px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all ${(batchMode ? batchDeviceIds.length > 0 : selectedDevice) && customCommand.trim() && !(batchMode ? isBatchRunning : isTestingConnection)
                    ? 'bg-[#005b75] hover:bg-[#00465a] shadow-lg shadow-[#005b75]/20'
                    : 'bg-black/15 text-black/30 cursor-not-allowed'}`}
                >
                  {batchMode
                    ? ((isBatchRunning)
                      ? (language === 'zh' ? '批量执行中...' : 'Running Batch...')
                      : (language === 'zh' ? `批量下发 (${batchDeviceIds.length})` : `Run Batch (${batchDeviceIds.length})`))
                    : ((isTestingConnection)
                      ? (language === 'zh' ? '执行中...' : 'Running...')
                      : (language === 'zh' ? '执行命令' : 'Run Command'))}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {showCmdPreviewModal && quickPlaybookPreview && (
        <div
          className="fixed inset-0 bg-black/55 backdrop-blur-sm flex items-center justify-center z-[80] p-4"
          onClick={() => setShowCmdPreviewModal(false)}
        >
          <div
            className="w-full max-w-2xl max-h-[80vh] rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col bg-[#0f1117]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <p className="text-sm font-bold text-white/90">
                  {quickPlaybookScenario ? (language === 'zh' ? quickPlaybookScenario.name_zh : quickPlaybookScenario.name) : 'Command Preview'}
                </p>
                <span className="text-[10px] font-mono text-white/35">{quickPlaybookPlatform}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    const phases = ['pre_check', 'execute', 'post_check', 'rollback'] as const;
                    const content = phases
                      .map((phase) => {
                        const cmds = quickPlaybookPreview?.[phase] || [];
                        if (!cmds.length) return '';
                        return `[${phase.toUpperCase()}]\n${cmds.join('\n')}`;
                      })
                      .filter(Boolean)
                      .join('\n\n');
                    const copied = await copyTextWithFallback(content);
                    showToast(copied ? (language === 'zh' ? '命令已复制' : 'Copied') : (language === 'zh' ? '复制失败' : 'Copy failed'), copied ? 'success' : 'error');
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/8 text-white/60 hover:bg-white/15 text-xs font-semibold transition-all"
                >
                  <Copy size={12} /> {language === 'zh' ? '复制全部' : 'Copy All'}
                </button>
                <button
                  onClick={() => setShowCmdPreviewModal(false)}
                  title={language === 'zh' ? '关闭' : 'Close'}
                  className="text-white/40 hover:text-white/80 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            {/* Modal body: command phases */}
            <div className="flex-1 min-h-0 overflow-auto p-5 space-y-4 font-mono text-[12px]">
              {(['pre_check', 'execute', 'post_check', 'rollback'] as const).map((phase) => {
                const cmds: string[] = quickPlaybookPreview?.[phase] || [];
                if (!cmds.length) return null;
                const phaseColor: Record<string, string> = {
                  pre_check: 'text-sky-400',
                  execute: 'text-[#00bceb]',
                  post_check: 'text-emerald-400',
                  rollback: 'text-amber-400',
                };
                return (
                  <div key={phase}>
                    <p className={`text-[10px] uppercase tracking-widest font-bold mb-2 ${phaseColor[phase] || 'text-white/40'}`}>
                      {phase.replace('_', ' ')}
                    </p>
                    <div className="rounded-xl bg-white/5 p-4 border border-white/8 space-y-1">
                      {cmds.map((cmd, idx) => (
                        <div key={idx} className="text-white/80 leading-6 whitespace-pre-wrap">{cmd}</div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {showAddScenarioModal && (
        <div className="fixed inset-0 bg-black/35 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className={`w-full max-w-3xl rounded-2xl border shadow-2xl overflow-hidden ${resolvedTheme === 'dark' ? 'bg-[#121c2d] border-white/10' : 'bg-white border-black/10'}`}
          >
            <div className={`px-6 py-4 border-b flex items-center justify-between ${resolvedTheme === 'dark' ? 'border-white/10' : 'border-black/10'}`}>
              <div>
                <h3 className={`text-lg font-bold ${resolvedTheme === 'dark' ? 'text-white/90' : 'text-[#0b2a3c]'}`}>Create Custom Scenario</h3>
                <p className={`text-xs mt-1 ${resolvedTheme === 'dark' ? 'text-white/45' : 'text-black/45'}`}>Define a reusable playbook scenario (single platform).</p>
              </div>
              <button onClick={resetScenarioDraft} className={resolvedTheme === 'dark' ? 'text-white/50 hover:text-white' : 'text-black/40 hover:text-black'} title="Close">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4 max-h-[70vh] overflow-auto">
              {scenarioDraftOrigin.kind === 'template' && (
                <div className="col-span-2 rounded-2xl border border-[#00bceb]/20 bg-[#00bceb]/6 px-4 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#007d9d]">
                        {language === 'zh' ? 'Template Imported Draft' : 'Template Imported Draft'}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-black/80">
                        {language === 'zh'
                          ? `草稿来源：${scenarioDraftOrigin.templateName || '配置模板'}`
                          : `Draft source: ${scenarioDraftOrigin.templateName || 'Configuration Template'}`}
                      </p>
                      <p className="mt-1 text-xs text-black/50">
                        {language === 'zh'
                          ? '已自动把模板正文带入 Execute 阶段，并把占位符转换成场景变量。你可以继续补充 pre-check、post-check 和 rollback。'
                          : 'The template body has been imported into the Execute phase and placeholders were converted into scenario variables. You can continue editing pre-check, post-check, and rollback.'}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-[#007d9d] border border-[#00bceb]/20">
                      {scenarioDraftOrigin.variableKeys.length} {language === 'zh' ? '变量' : 'vars'}
                    </span>
                  </div>
                </div>
              )}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-black/45">Name</label>
                <input value={newScenarioForm.name} onChange={(e) => setNewScenarioForm(prev => ({ ...prev, name: e.target.value }))} title="Scenario name" placeholder="e.g. Core interface recovery" className="mt-1 w-full px-3 py-2 border border-black/10 rounded-xl text-sm outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-black/45">Name (ZH)</label>
                <input value={newScenarioForm.name_zh} onChange={(e) => setNewScenarioForm(prev => ({ ...prev, name_zh: e.target.value }))} title="Scenario name in Chinese" placeholder="例如：核心链路恢复" className="mt-1 w-full px-3 py-2 border border-black/10 rounded-xl text-sm outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-black/45">Description</label>
                <input value={newScenarioForm.description} onChange={(e) => setNewScenarioForm(prev => ({ ...prev, description: e.target.value }))} title="Scenario description" placeholder="Short summary for operators" className="mt-1 w-full px-3 py-2 border border-black/10 rounded-xl text-sm outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-black/45">Description (ZH)</label>
                <input value={newScenarioForm.description_zh} onChange={(e) => setNewScenarioForm(prev => ({ ...prev, description_zh: e.target.value }))} title="Scenario description in Chinese" placeholder="给运维人员的简要说明" className="mt-1 w-full px-3 py-2 border border-black/10 rounded-xl text-sm outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-black/45">Category</label>
                <input value={newScenarioForm.category} onChange={(e) => setNewScenarioForm(prev => ({ ...prev, category: e.target.value }))} title="Scenario category" placeholder="routing / access / security" className="mt-1 w-full px-3 py-2 border border-black/10 rounded-xl text-sm outline-none" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-black/45">Icon</label>
                  <input value={newScenarioForm.icon} onChange={(e) => setNewScenarioForm(prev => ({ ...prev, icon: e.target.value }))} title="Scenario icon" placeholder="Zap" className="mt-1 w-full px-3 py-2 border border-black/10 rounded-xl text-sm outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-black/45">Risk</label>
                  <select value={newScenarioForm.risk} onChange={(e) => setNewScenarioForm(prev => ({ ...prev, risk: e.target.value }))} title="Scenario risk" className="mt-1 w-full px-3 py-2 border border-black/10 rounded-xl text-sm outline-none bg-white">
                    <option value="low">low</option>
                    <option value="medium">medium</option>
                    <option value="high">high</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-black/45">Platform</label>
                  <select value={newScenarioForm.platform} onChange={(e) => setNewScenarioForm(prev => ({ ...prev, platform: e.target.value }))} title="Scenario platform" className="mt-1 w-full px-3 py-2 border border-black/10 rounded-xl text-sm outline-none bg-white">
                    {Object.keys(platforms).map(pk => <option key={pk} value={pk}>{pk}</option>)}
                  </select>
                </div>
              </div>
              <div className="col-span-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-black/45">Pre-Check Commands (one per line)</label>
                <textarea value={newScenarioForm.pre_check} onChange={(e) => setNewScenarioForm(prev => ({ ...prev, pre_check: e.target.value }))} title="Pre-check commands" placeholder="show interface status" className="mt-1 w-full h-20 px-3 py-2 border border-black/10 rounded-xl text-xs font-mono outline-none" />
              </div>
              <div className="col-span-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-black/45">Execute Commands (one per line)</label>
                <textarea value={newScenarioForm.execute} onChange={(e) => setNewScenarioForm(prev => ({ ...prev, execute: e.target.value }))} title="Execute commands" placeholder="configure terminal" className="mt-1 w-full h-24 px-3 py-2 border border-black/10 rounded-xl text-xs font-mono outline-none" />
              </div>
              {newScenarioVariables.length > 0 && (
                <div className="col-span-2 rounded-2xl border border-black/10 bg-black/[0.02] p-4">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-black/45">Variables</label>
                      <p className="mt-1 text-xs text-black/40">
                        {language === 'zh' ? '以下变量会随场景一起保存，后续在 Automation 执行时填写。' : 'These variables will be saved with the scenario and filled in later during Automation execution.'}
                      </p>
                    </div>
                    <span className="text-[10px] text-black/35">{newScenarioVariables.length}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {newScenarioVariables.map((variable) => (
                      <div key={variable.key} className="rounded-xl border border-black/8 bg-white px-3 py-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-black/75">{variable.label}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 font-bold">
                            {variable.required ? (language === 'zh' ? '必填' : 'REQ') : (language === 'zh' ? '选填' : 'OPT')}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] font-mono text-black/45">{variable.key}</p>
                        <p className="mt-2 text-[11px] text-black/40">
                          {language === 'zh' ? `类型：${variable.type}` : `Type: ${variable.type}`}
                          {variable.placeholder ? ` · ${language === 'zh' ? '默认提示' : 'Hint'}: ${variable.placeholder}` : ''}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="col-span-2 grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-black/45">Post-Check Commands</label>
                  <textarea value={newScenarioForm.post_check} onChange={(e) => setNewScenarioForm(prev => ({ ...prev, post_check: e.target.value }))} title="Post-check commands" placeholder="show logging | last 20" className="mt-1 w-full h-20 px-3 py-2 border border-black/10 rounded-xl text-xs font-mono outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-black/45">Rollback Commands</label>
                  <textarea value={newScenarioForm.rollback} onChange={(e) => setNewScenarioForm(prev => ({ ...prev, rollback: e.target.value }))} title="Rollback commands" placeholder="rollback configuration" className="mt-1 w-full h-20 px-3 py-2 border border-black/10 rounded-xl text-xs font-mono outline-none" />
                </div>
              </div>
            </div>
            <div className={`px-6 py-4 border-t flex gap-3 ${resolvedTheme === 'dark' ? 'border-white/10' : 'border-black/10'}`}>
              <button onClick={resetScenarioDraft} className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${resolvedTheme === 'dark' ? 'bg-white/10 text-white/80 hover:bg-white/15' : 'bg-black/[0.04] text-black/70 hover:bg-black/[0.08]'}`}>
                Cancel
              </button>
              <button onClick={createScenario} disabled={isSavingScenario} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#008bb0] hover:bg-[#00769a] transition-all shadow-lg shadow-[#00bceb]/20 disabled:opacity-60">
                {isSavingScenario ? 'Saving...' : 'Create Scenario'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {showProfileModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className={`w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden ${resolvedTheme === 'dark' ? 'bg-[#121c2d] border-white/10' : 'bg-white border-black/10'}`}
          >
            <div className={`px-6 py-4 border-b ${resolvedTheme === 'dark' ? 'border-white/10' : 'border-black/10'}`}>
              <h3 className={`text-lg font-bold ${resolvedTheme === 'dark' ? 'text-white/90' : 'text-[#0b2a3c]'}`}>Profile</h3>
              <p className={`text-xs mt-1 ${resolvedTheme === 'dark' ? 'text-white/45' : 'text-black/45'}`}>Manage your account information</p>
            </div>

            <div className="px-6 py-5 space-y-4 max-h-[75vh] overflow-y-auto">
              <div>
                <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1.5 ${resolvedTheme === 'dark' ? 'text-white/55' : 'text-black/45'}`}>Avatar</label>
                <div className="flex items-center gap-3">
                  <div className={`w-14 h-14 rounded-full border overflow-hidden flex items-center justify-center ${resolvedTheme === 'dark' ? 'bg-white/10 border-white/10 text-white/75' : 'bg-black/10 border-black/10 text-black/60'}`}>
                    {renderAvatarContent(profileAvatarPreview, 24)}
                  </div>
                  <div className="flex gap-2">
                    <label className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${resolvedTheme === 'dark' ? 'bg-white/10 text-white/80 hover:bg-white/15' : 'bg-black/[0.05] text-black/70 hover:bg-black/[0.08]'}`}>
                      Upload
                      <input type="file" accept="image/*" className="hidden" onChange={handleProfileAvatarChange} />
                    </label>
                    <button
                      type="button"
                      onClick={() => setProfileAvatarPreview('')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${resolvedTheme === 'dark' ? 'bg-red-500/15 text-red-300 hover:bg-red-500/20' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}
                    >
                      Use Default
                    </button>
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-5 gap-2">
                  {avatarPresets.map((preset) => {
                    const active = profileAvatarPreview === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setProfileAvatarPreview(preset.id)}
                        className={`w-9 h-9 rounded-full border overflow-hidden flex items-center justify-center transition-all ${active ? 'ring-2 ring-[#00bceb]/60 border-[#00bceb]/40' : (resolvedTheme === 'dark' ? 'border-white/15 hover:border-white/35' : 'border-black/10 hover:border-black/25')}`}
                        title={preset.label}
                      >
                        <div className={`w-full h-full ${preset.bgClass} flex items-center justify-center`}>
                          <span className="text-sm leading-none">{preset.emoji}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <p className={`text-[10px] mt-1.5 ${resolvedTheme === 'dark' ? 'text-white/35' : 'text-black/35'}`}>Supports PNG/JPG/WebP, max 2MB. Stored in your user profile.</p>
              </div>

              <div>
                <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1.5 ${resolvedTheme === 'dark' ? 'text-white/55' : 'text-black/45'}`}>Username</label>
                <input
                  type="text"
                  value={profileForm.username}
                  onChange={(e) => setProfileForm(prev => ({ ...prev, username: e.target.value }))}
                  title="Profile username"
                  placeholder="Username"
                  className={`w-full rounded-xl px-3 py-2.5 text-sm outline-none border transition-all ${resolvedTheme === 'dark' ? 'bg-white/5 border-white/15 text-white placeholder-white/30 focus:border-[#00bceb]/60' : 'bg-black/[0.02] border-black/10 text-[#0b2a3c] placeholder-black/30 focus:border-[#00bceb]/50'}`}
                />
              </div>

              <div>
                <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1.5 ${resolvedTheme === 'dark' ? 'text-white/55' : 'text-black/45'}`}>Role</label>
                <input
                  type="text"
                  value={currentUser.role || currentUserRecord?.role || 'Administrator'}
                  disabled
                  title="Profile role"
                  className={`w-full rounded-xl px-3 py-2.5 text-sm border ${resolvedTheme === 'dark' ? 'bg-white/5 border-white/10 text-white/60' : 'bg-black/[0.03] border-black/10 text-black/55'}`}
                />
              </div>

              <div>
                <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1.5 ${resolvedTheme === 'dark' ? 'text-white/55' : 'text-black/45'}`}>New Password</label>
                <div className="relative">
                  <input
                    type={showProfilePwd ? 'text' : 'password'}
                    value={profileForm.password}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, password: e.target.value }))}
                    title="New password"
                    placeholder="Leave blank to keep unchanged"
                    className={`w-full rounded-xl px-3 pr-10 py-2.5 text-sm outline-none border transition-all ${resolvedTheme === 'dark' ? 'bg-white/5 border-white/15 text-white placeholder-white/30 focus:border-[#00bceb]/60' : 'bg-black/[0.02] border-black/10 text-[#0b2a3c] placeholder-black/30 focus:border-[#00bceb]/50'}`}
                  />
                  <button type="button" title={showProfilePwd ? 'Hide password' : 'Show password'} onClick={() => setShowProfilePwd(v => !v)} className={`absolute right-3 top-1/2 -translate-y-1/2 ${resolvedTheme === 'dark' ? 'text-white/40 hover:text-white/70' : 'text-black/35 hover:text-black/60'}`}>
                    {showProfilePwd ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div>
                <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1.5 ${resolvedTheme === 'dark' ? 'text-white/55' : 'text-black/45'}`}>Confirm Password</label>
                <input
                  type={showProfilePwd ? 'text' : 'password'}
                  value={profileForm.confirmPassword}
                  onChange={(e) => setProfileForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  title="Confirm password"
                  placeholder="Confirm new password"
                  className={`w-full rounded-xl px-3 py-2.5 text-sm outline-none border transition-all ${resolvedTheme === 'dark' ? 'bg-white/5 border-white/15 text-white placeholder-white/30 focus:border-[#00bceb]/60' : 'bg-black/[0.02] border-black/10 text-[#0b2a3c] placeholder-black/30 focus:border-[#00bceb]/50'}`}
                />
              </div>

              {/* ── 通知渠道配置 ── */}
              <div className={`pt-3 border-t ${resolvedTheme === 'dark' ? 'border-white/10' : 'border-black/8'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <Bell size={13} className={resolvedTheme === 'dark' ? 'text-[#00bceb]' : 'text-[#008bb0]'} />
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${resolvedTheme === 'dark' ? 'text-white/55' : 'text-black/45'}`}>
                    告警通知渠道
                  </span>
                </div>
                <p className={`text-[11px] mb-3 leading-relaxed ${resolvedTheme === 'dark' ? 'text-white/30' : 'text-black/35'}`}>
                  接收接口 DOWN、带宽超阈值等网络告警推送。<br/>
                  开启后填入 Webhook 地址，点击「发送测试消息」验证连通性，确认无误后保存。
                </p>

                {([
                  {
                    key: 'feishu',
                    label: '飞书',
                    sub: 'Feishu',
                    icon: 'FS',
                    iconBg: 'bg-[#1664FF]',
                    badge: 'bg-blue-500/10 text-blue-500',
                    hint: 'https://open.feishu.cn/open-apis/bot/v2/hook/…',
                    hasSecret: false,
                    docsUrl: 'https://open.feishu.cn/document/client-docs/bot-v3/add-custom-bot',
                    docsLabel: '配置教程 →',
                    tip: '在飞书群 ➜ 设置 ➜ 群机器人 ➜ 添加机器人 ➜ 自定义机器人，复制 Webhook URL 粘贴到此处。消息格式：彩色卡片（含8字段）。',
                  },
                  {
                    key: 'dingtalk',
                    label: '钉钉',
                    sub: 'DingTalk',
                    icon: 'DT',
                    iconBg: 'bg-[#3296FA]',
                    badge: 'bg-sky-500/10 text-sky-500',
                    hint: 'https://oapi.dingtalk.com/robot/send?access_token=…',
                    hasSecret: true,
                    docsUrl: 'https://open.dingtalk.com/document/robots/custom-robot-access',
                    docsLabel: '配置教程 →',
                    tip: '在钉钉群 ➜ 群设置 ➜ 智能群助手 ➜ 添加机器人 ➜ 自定义。安全设置选「加签」时把密钥填入下方 Secret 栏；选「自定义关键词」时关键词填 NetPilot 即可。',
                  },
                  {
                    key: 'wechat',
                    label: '企业微信',
                    sub: 'WeCom',
                    icon: 'WC',
                    iconBg: 'bg-[#07C160]',
                    badge: 'bg-green-500/10 text-green-500',
                    hint: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=…',
                    hasSecret: false,
                    docsUrl: 'https://developer.work.weixin.qq.com/document/path/91770',
                    docsLabel: '配置教程 →',
                    tip: '在企业微信群 ➜ 右键群名称 ➜ 添加群机器人 ➜ 新创建一个机器人，复制 Webhook URL 粘贴到此处。',
                  },
                ] as const).map(({ key, label, sub, icon, iconBg, badge, hint, hasSecret, docsUrl, docsLabel, tip }) => {
                  const ch = notificationChannels[key];
                  const isEnabled = ch.enabled;
                  return (
                    <div key={key} className={`mb-2.5 rounded-xl border overflow-hidden transition-all ${
                      isEnabled
                        ? (resolvedTheme === 'dark' ? 'border-[#00bceb]/25 bg-[#00bceb]/[0.04]' : 'border-[#00bceb]/30 bg-[#00bceb]/[0.03]')
                        : (resolvedTheme === 'dark' ? 'border-white/8 bg-transparent' : 'border-black/6 bg-transparent')
                    }`}>
                      {/* 卡片头 */}
                      <div className="flex items-center gap-2.5 px-3 py-2.5">
                        <span className={`w-7 h-7 rounded-lg ${iconBg} flex items-center justify-center text-[9px] font-black text-white shrink-0 shadow-sm`}>
                          {icon}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[12px] font-semibold ${resolvedTheme === 'dark' ? 'text-white/85' : 'text-black/75'}`}>{label}</span>
                            <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${badge}`}>{sub}</span>
                          </div>
                        </div>
                        {/* 教程链接 */}
                        <a
                          href={docsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`text-[10px] shrink-0 mr-1 ${resolvedTheme === 'dark' ? 'text-white/25 hover:text-[#00bceb]' : 'text-black/30 hover:text-[#008bb0]'} transition-colors`}
                        >
                          {docsLabel}
                        </a>
                        {/* Toggle */}
                        <button
                          type="button"
                          title={isEnabled ? '关闭此渠道' : '开启此渠道'}
                          onClick={() => setNotificationChannels(prev => ({ ...prev, [key]: { ...prev[key], enabled: !prev[key].enabled } }))}
                          className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${isEnabled ? 'bg-[#00bceb]' : (resolvedTheme === 'dark' ? 'bg-white/15' : 'bg-black/12')}`}
                        >
                          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${isEnabled ? 'left-[18px]' : 'left-0.5'}`} />
                        </button>
                      </div>

                      {/* 展开内容：始终显示 URL 输入（方便未开启时也能填好再一起保存） */}
                      <div className={`px-3 pb-3 flex flex-col gap-1.5`}>
                        {/* 提示文字 */}
                        <p className={`text-[10px] leading-relaxed ${resolvedTheme === 'dark' ? 'text-white/30' : 'text-black/35'}`}>{tip}</p>
                        {/* Webhook URL */}
                        <input
                          type="text"
                          value={ch.webhook_url}
                          onChange={(e) => setNotificationChannels(prev => ({ ...prev, [key]: { ...prev[key], webhook_url: e.target.value } }))}
                          title={`${label} Webhook URL`}
                          placeholder={hint}
                          className={`w-full rounded-lg px-2.5 py-2 text-[11px] outline-none border transition-all font-mono ${resolvedTheme === 'dark'
                            ? 'bg-black/20 border-white/10 text-white/80 placeholder-white/20 focus:border-[#00bceb]/50'
                            : 'bg-white/60 border-black/8 text-[#0b2a3c] placeholder-black/20 focus:border-[#00bceb]/40'}`}
                        />
                        {/* 钉钉加签 Secret */}
                        {hasSecret && (
                          <input
                            type="password"
                            value={(ch as any).secret || ''}
                            onChange={(e) => setNotificationChannels(prev => ({ ...prev, [key]: { ...prev[key], secret: e.target.value } }))}
                            title={`${label} Secret`}
                            placeholder="加签 Secret（可选，留空则不验签）"
                            className={`w-full rounded-lg px-2.5 py-2 text-[11px] outline-none border transition-all font-mono ${resolvedTheme === 'dark'
                              ? 'bg-black/20 border-white/10 text-white/80 placeholder-white/20 focus:border-[#00bceb]/50'
                              : 'bg-white/60 border-black/8 text-[#0b2a3c] placeholder-black/20 focus:border-[#00bceb]/40'}`}
                          />
                        )}
                        {/* 发送测试 */}
                        <button
                          type="button"
                          title={`向 ${label} 发送测试告警`}
                          disabled={!ch.webhook_url.trim() || notifyTestLoading === key}
                          onClick={async () => {
                            const profileUserId = currentUser.id ?? currentUserRecord?.id;
                            if (!profileUserId) return;
                            setNotifyTestLoading(key);
                            try {
                              const res = await fetch(`/api/users/${profileUserId}/notify-test`, {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                  'Authorization': `Bearer ${localStorage.getItem('sessionToken') || ''}`,
                                },
                                body: JSON.stringify({
                                  platform: key,
                                  webhook_url: ch.webhook_url,
                                  secret: (ch as any).secret || '',
                                }),
                              });
                              const d = await res.json();
                              if (res.ok) showToast(`${label} 测试消息已发送 ✓`, 'success');
                              else showToast(`发送失败: ${d.detail || d.error}`, 'error');
                            } catch { showToast('连接错误', 'error'); }
                            finally { setNotifyTestLoading(''); }
                          }}
                          className={`w-full py-1.5 rounded-lg text-[11px] font-semibold transition-all flex items-center justify-center gap-1.5 ${
                            !ch.webhook_url.trim() || notifyTestLoading === key
                              ? (resolvedTheme === 'dark' ? 'bg-white/5 text-white/20 cursor-not-allowed' : 'bg-black/4 text-black/20 cursor-not-allowed')
                              : (resolvedTheme === 'dark' ? 'bg-[#00bceb]/12 text-[#00bceb] hover:bg-[#00bceb]/22 border border-[#00bceb]/20' : 'bg-[#e8f9ff] text-[#007fa3] hover:bg-[#d2f2fd] border border-[#00bceb]/20')
                          }`}
                        >
                          {notifyTestLoading === key
                            ? <><span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />发送中...</>
                            : '📨 发送测试消息'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className={`text-[11px] ${resolvedTheme === 'dark' ? 'text-white/40' : 'text-black/40'}`}>Last login: {currentUserLastLogin}</p>
            </div>

            <div className={`px-6 py-4 border-t flex gap-3 ${resolvedTheme === 'dark' ? 'border-white/10' : 'border-black/10'}`}>
              <button
                onClick={() => setShowProfileModal(false)}
                className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${resolvedTheme === 'dark' ? 'bg-white/10 text-white/80 hover:bg-white/15' : 'bg-black/[0.04] text-black/70 hover:bg-black/[0.08]'}`}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProfile}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#008bb0] hover:bg-[#00769a] transition-all shadow-lg shadow-[#00bceb]/20"
              >
                Save Profile
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Test Connection Result Modal */}
      {showTestResult && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-black/5 overflow-hidden"
          >
            <div className={`p-6 flex items-center justify-between border-b border-black/5 ${
              isTestingConnection ? 'bg-blue-50' : 
              testResult?.success ? 'bg-emerald-50' : 'bg-red-50'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${
                  isTestingConnection ? 'bg-blue-500 text-white animate-pulse' : 
                  testResult?.success ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
                }`}>
                  {isTestingConnection ? <RotateCcw className="animate-spin" size={20} /> : 
                   testResult?.success ? <ShieldCheck size={20} /> : <AlertCircle size={20} />}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#00172D]">
                    {isTestingConnection
                      ? (connectionTestMode === 'deep'
                        ? (language === 'zh' ? 'SSH 登录校验中...' : 'Running SSH Login Validation...')
                        : (language === 'zh' ? '快速连通性检测中...' : 'Running Reachability Check...'))
                      : testResult?.success
                        ? (testResult?.checkMode === 'deep'
                          ? (language === 'zh' ? 'SSH 登录成功' : 'SSH Login Successful')
                          : (language === 'zh' ? '连通性正常' : 'Reachability Confirmed'))
                        : (testResult?.checkMode === 'deep'
                          ? (language === 'zh' ? 'SSH 登录异常' : 'SSH Login Failed')
                          : (language === 'zh' ? '连通性异常' : 'Reachability Failed'))}
                  </h3>
                  <p className="text-xs text-black/40">
                    {connectionTestDevice?.hostname || '-'} ({connectionTestDevice?.ip_address || '-'})
                  </p>
                </div>
              </div>
              {!isTestingConnection && (
                <button onClick={() => setShowTestResult(false)} title={language === 'zh' ? '关闭结果窗口' : 'Close result dialog'} className="text-black/40 hover:text-black">
                  <XCircle size={24} />
                </button>
              )}
            </div>

            <div className="p-8 space-y-6">
              {isTestingConnection ? (
                <div className="py-12 flex flex-col items-center justify-center gap-4">
                  <div className="relative">
                    <div className="w-16 h-16 border-4 border-blue-100 rounded-full" />
                    <div className="absolute inset-0 w-16 h-16 border-4 border-blue-500 rounded-full border-t-transparent animate-spin" />
                  </div>
                  <p className="text-sm font-medium text-blue-600 animate-pulse">
                    {connectionTestMode === 'deep'
                      ? (language === 'zh' ? '正在检查 ICMP、目标端口与 SSH 登录状态...' : 'Checking ICMP, target port, and SSH login state...')
                      : (language === 'zh' ? '正在检查 ICMP 与目标端口可达性...' : 'Checking ICMP and target port reachability...')}
                  </p>
                </div>
              ) : (
                <>
                  <div className="rounded-2xl border border-blue-100 bg-blue-50/60 px-4 py-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-700">{language === 'zh' ? '检测模式' : 'Check Mode'}</p>
                    <p className="mt-2 text-sm text-blue-900">
                      {testResult?.checkMode === 'quick' || !testResult?.checkMode
                        ? (language === 'zh' ? '当前结果只检查 ICMP 和管理端口。' : 'This result only checks ICMP and the management port.')
                        : (language === 'zh' ? '当前结果已执行 SSH 登录校验。' : 'This result includes an SSH login validation.')}
                    </p>
                  </div>

                  {Array.isArray(testResult?.stages) && testResult.stages.length > 0 && (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      {testResult.stages.map((stage) => {
                        const tone = stage.ok
                          ? 'border-emerald-100 bg-emerald-50/60 text-emerald-800'
                          : 'border-red-100 bg-red-50/60 text-red-800';
                        const label = stage.stage === 'icmp'
                          ? 'ICMP'
                          : stage.stage === 'tcp'
                            ? (connectionTestDevice?.connection_method === 'telnet' ? 'TCP/23' : 'TCP/22')
                            : 'SSH';
                        return (
                          <div key={`${stage.stage}-${stage.summary}`} className={`rounded-2xl border p-4 ${tone}`}>
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-[11px] font-bold uppercase tracking-[0.18em]">{label}</p>
                              <span className="rounded-full bg-white/80 px-2 py-1 text-[10px] font-bold uppercase">
                                {stage.ok ? (language === 'zh' ? '正常' : 'OK') : (language === 'zh' ? '失败' : 'Fail')}
                              </span>
                            </div>
                            <p className="mt-2 text-sm font-semibold">{stage.summary}</p>
                            <p className="mt-1 text-xs opacity-80 leading-5">{stage.detail}</p>
                            {typeof stage.latency_ms === 'number' && Number.isFinite(stage.latency_ms) && (
                              <p className="mt-2 text-[11px] font-medium opacity-80">{language === 'zh' ? '耗时' : 'Latency'} {stage.latency_ms} ms</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className={`p-4 rounded-2xl border ${
                    testResult?.success ? 'bg-emerald-50/50 border-emerald-100' : 'bg-red-50/50 border-red-100'
                  }`}>
                    <p className={`text-sm font-medium ${testResult?.success ? 'text-emerald-800' : 'text-red-800'}`}>
                      {testResult?.message}
                    </p>
                    {!testResult?.success && buildConnectionTestHint(testResult?.errorCode, language) && (
                      <p className="mt-2 text-xs leading-5 text-red-700/90">
                        {buildConnectionTestHint(testResult?.errorCode, language)}
                      </p>
                    )}
                  </div>
                  
                  {testResult?.output && (
                    <details className="rounded-2xl border border-black/10 bg-black/[0.02] px-4 py-3">
                      <summary className="cursor-pointer text-[11px] font-bold uppercase tracking-[0.18em] text-black/45">
                        {language === 'zh' ? '展开原始日志' : 'Show raw log'}
                      </summary>
                      {testResult.rawError && (
                        <p className="mt-3 text-xs leading-5 text-black/55">
                          {language === 'zh' ? '原始错误：' : 'Raw error: '}{testResult.rawError}
                        </p>
                      )}
                      <div className="mt-3 bg-[#00172D] p-4 rounded-xl overflow-auto max-h-[200px]">
                        <pre className="text-xs font-mono text-emerald-400/90 whitespace-pre-wrap">
                          {testResult.output}
                        </pre>
                      </div>
                    </details>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button 
                      onClick={() => setShowTestResult(false)}
                      className="flex-1 px-4 py-3 rounded-xl border border-black/10 font-bold uppercase tracking-widest text-[10px] hover:bg-black/5 transition-all"
                    >
                      Close
                    </button>
                    {!testResult?.success && (
                      <div className="flex flex-1 gap-3">
                        <button 
                          onClick={() => handleTestConnection(connectionTestDevice || selectedDevice, 'quick')}
                          className="flex-1 px-4 py-3 rounded-xl bg-black text-white font-bold uppercase tracking-widest text-[10px] hover:bg-black/80 transition-all shadow-lg shadow-black/20"
                        >
                          {language === 'zh' ? '重试快速检测' : 'Retry Quick Check'}
                        </button>
                        <button 
                          onClick={() => handleTestConnection(connectionTestDevice || selectedDevice, 'deep')}
                          className="flex-1 px-4 py-3 rounded-xl border border-black/10 font-bold uppercase tracking-widest text-[10px] hover:bg-black/5 transition-all"
                        >
                          {language === 'zh' ? 'SSH 登录校验' : 'SSH Login Check'}
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="p-8 space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-medium">{t('importInventory')}</h3>
                <button onClick={() => setShowImportModal(false)} title={language === 'zh' ? '关闭导入窗口' : 'Close import dialog'} className="text-black/40 hover:text-black">
                  <XCircle size={24} />
                </button>
              </div>
              
              <div className="space-y-4">
                <p className="text-sm text-black/40">{t('importDesc')}</p>
                
                <div className="border-2 border-dashed border-black/10 rounded-2xl p-10 flex flex-col items-center justify-center gap-4 hover:border-black/20 transition-all cursor-pointer bg-black/[0.01]">
                  <div className="w-12 h-12 bg-black/5 rounded-full flex items-center justify-center text-black/40">
                    <Upload size={24} />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium">{t('clickToUpload')}</p>
                    <p className="text-xs text-black/30 mt-1">JSON, CSV (max. 10MB)</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-xl border border-blue-100">
                  <FileText className="text-blue-500" size={20} />
                  <div className="flex-1">
                    <p className="text-xs font-medium text-blue-900">{t('downloadTemplate')}</p>
                    <p className="text-[10px] text-blue-700">{t('getStandardCsv')}</p>
                  </div>
                  <button className="text-[10px] font-bold uppercase text-blue-600 hover:underline">{t('export')}</button>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  onClick={() => setShowImportModal(false)}
                  className="flex-1 px-4 py-3 rounded-xl border border-black/10 text-sm font-medium hover:bg-black/5 transition-all"
                >
                  {t('cancel')}
                </button>
                <button 
                  onClick={() => {
                    // Simulate import
                    alert('Import feature simulation: Data processed successfully.');
                    setShowImportModal(false);
                  }}
                  className="flex-1 px-4 py-3 rounded-xl bg-black text-white text-sm font-medium hover:bg-black/80 transition-all"
                >
                  {t('startImport')}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Config Diff Modal */}
      {showDiff && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-black/5 flex justify-between items-center bg-black/5">
              <div>
                <h3 className="text-lg font-medium">{t('configChangeReview')}</h3>
                <p className="text-xs text-black/40">{t('reviewDiff')} {selectedDevice?.hostname}</p>
              </div>
              <button onClick={() => setShowDiff(false)} title={language === 'zh' ? '关闭差异窗口' : 'Close diff dialog'} className="text-black/40 hover:text-black">
                <XCircle size={24} />
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-px bg-black/10 h-[400px]">
              <div className="bg-white p-6 overflow-auto border-r border-black/5">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-black/30 mb-4">{t('currentConfig')}</h4>
                <pre className="text-xs font-mono text-red-600 bg-red-50 p-4 rounded-lg whitespace-pre-wrap">
                  {currentDiff.before}
                </pre>
              </div>
              <div className="bg-white p-6 overflow-auto">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-black/30 mb-4">{t('proposedChange')}</h4>
                <pre className="text-xs font-mono text-emerald-600 bg-emerald-50 p-4 rounded-lg whitespace-pre-wrap">
                  {currentDiff.after}
                </pre>
              </div>
            </div>

            <div className="p-6 bg-white border-t border-black/5 flex justify-end gap-4">
              <button 
                onClick={() => setShowDiff(false)}
                className="px-6 py-2 text-sm font-medium text-black/60 hover:text-black"
              >
                {t('cancel')}
              </button>
              <button 
                onClick={() => runTask('VLAN Update')}
                className="px-8 py-2 bg-black text-white rounded-xl text-sm font-medium hover:bg-black/80 transition-all shadow-lg shadow-black/20"
              >
                {t('commitDeploy')}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Historical Config Modal */}
      {showConfigModal && viewingConfig && selectedDevice && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-black/5 flex justify-between items-center bg-black/5">
              <div>
                <h3 className="text-lg font-medium">{t('viewConfig')}: {viewingConfig.id}</h3>
                <p className="text-xs text-black/40">{viewingConfig.timestamp} • {viewingConfig.author}</p>
              </div>
              <button onClick={() => setShowConfigModal(false)} title={language === 'zh' ? '关闭配置窗口' : 'Close configuration dialog'} className="text-black/40 hover:text-black">
                <XCircle size={24} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-[10px] font-bold uppercase text-black/40">
                <div>
                  <p>{t('description')}</p>
                  <p className="text-black mt-1 normal-case font-medium">{viewingConfig.description}</p>
                </div>
                <div>
                  <p>{t('author')}</p>
                  <p className="text-black mt-1 normal-case font-medium">{viewingConfig.author}</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase text-black/40">{t('configContent')}</p>
                <div className="bg-black/[0.02] border border-black/5 rounded-xl p-4 max-h-[400px] overflow-auto">
                  <pre className="text-xs font-mono text-black/60 whitespace-pre-wrap">
                    {viewingConfig.content}
                  </pre>
                </div>
              </div>
            </div>

            <div className="p-6 bg-white border-t border-black/5 flex justify-end gap-4">
              <button 
                onClick={() => setShowConfigModal(false)}
                className="px-6 py-2 text-sm font-medium text-black/60 hover:text-black"
              >
                {t('cancel')}
              </button>
              <button 
                onClick={() => handleRollbackConfig(selectedDevice, viewingConfig)}
                className="px-8 py-2 bg-orange-600 text-white rounded-xl text-sm font-medium hover:bg-orange-700 transition-all shadow-lg shadow-orange-600/20 flex items-center gap-2"
              >
                <RotateCcw size={16} />
                {t('rollbackTo')}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Schedule Modal */}
      {showScheduleModal && schedulingTask && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-black/5 flex justify-between items-center bg-black/5">
              <div>
                <h3 className="text-lg font-medium">{t('scheduleTask')}</h3>
                <p className="text-xs text-black/40">{schedulingTask} for {selectedDevice?.hostname}</p>
              </div>
              <button onClick={() => setShowScheduleModal(false)} title={language === 'zh' ? '关闭定时任务窗口' : 'Close schedule dialog'} className="text-black/40 hover:text-black">
                <XCircle size={24} />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase text-black/40">{t('scheduleType')}</label>
                <div className="flex gap-2">
                  {(['once', 'recurring'] as const).map(type => (
                    <button
                      key={type}
                      onClick={() => setScheduleForm({ ...scheduleForm, type })}
                      className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-all ${
                        scheduleForm.type === type 
                          ? 'bg-black text-white border-black' 
                          : 'bg-white text-black/60 border-black/10 hover:border-black/20'
                      }`}
                    >
                      {t(type)}
                    </button>
                  ))}
                </div>
              </div>

              {scheduleForm.type === 'recurring' && (
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase text-black/40">{t('interval')}</label>
                  <select
                    value={scheduleForm.interval}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, interval: e.target.value as any })}
                    title={language === 'zh' ? '计划周期' : 'Schedule interval'}
                    className="w-full px-4 py-2 bg-black/[0.02] border border-black/10 rounded-xl text-xs outline-none focus:border-black/20"
                  >
                    <option value="daily">{t('daily')}</option>
                    <option value="weekly">{t('weekly')}</option>
                    <option value="monthly">{t('monthly')}</option>
                  </select>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase text-black/40">{t('scheduledTime')}</label>
                <input 
                  type="datetime-local"
                  value={scheduleForm.time}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, time: e.target.value })}
                  title={language === 'zh' ? '计划执行时间' : 'Scheduled execution time'}
                  className="w-full px-4 py-2 bg-black/[0.02] border border-black/10 rounded-xl text-xs outline-none focus:border-black/20"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase text-black/40">{t('timezone')}</label>
                <select
                  value={scheduleForm.timezone}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, timezone: e.target.value })}
                  title={language === 'zh' ? '时区' : 'Timezone'}
                  className="w-full px-4 py-2 bg-black/[0.02] border border-black/10 rounded-xl text-xs outline-none focus:border-black/20"
                >
                  <option value="UTC">UTC</option>
                  <option value="PST">PST (UTC-8)</option>
                  <option value="EST">EST (UTC-5)</option>
                  <option value="CST">CST (UTC+8)</option>
                </select>
              </div>
            </div>

            <div className="p-6 bg-white border-t border-black/5 flex justify-end gap-4">
              <button 
                onClick={() => setShowScheduleModal(false)}
                className="px-6 py-2 text-sm font-medium text-black/60 hover:text-black"
              >
                {t('cancel')}
              </button>
              <button 
                onClick={handleScheduleTask}
                className="px-8 py-2 bg-black text-white rounded-xl text-sm font-medium hover:bg-black/80 transition-all shadow-lg shadow-black/20"
              >
                {t('schedule')}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Remediation Modal */}
      {showRemediationModal && remediatingDevice && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-black/5 flex justify-between items-center bg-red-50">
              <div className="flex items-center gap-3">
                <ShieldCheck className="text-red-600" size={24} />
                <div>
                  <h3 className="text-lg font-medium text-red-900">{t('autoRemediation')}</h3>
                  <p className="text-xs text-red-700/70">{remediatingDevice.hostname}</p>
                </div>
              </div>
              <button onClick={() => setShowRemediationModal(false)} title={language === 'zh' ? '关闭修复确认窗口' : 'Close remediation dialog'} className="text-red-900/40 hover:text-red-900">
                <XCircle size={24} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <p className="text-sm text-black/60">
                {t('remediationDesc')}
              </p>
              <div className="bg-black/[0.02] border border-black/5 rounded-xl p-4">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-black/40 mb-2">{t('proposedActions')}</h4>
                <ul className="text-xs font-mono text-black/60 space-y-2 list-disc list-inside">
                  <li>Apply Golden Config template: <span className="text-black font-semibold">base_security_v2</span></li>
                  <li>Update NTP server settings</li>
                  <li>Disable insecure protocols (Telnet, HTTP)</li>
                </ul>
              </div>
            </div>

            <div className="p-6 bg-white border-t border-black/5 flex justify-end gap-4">
              <button 
                onClick={() => setShowRemediationModal(false)}
                className="px-6 py-2 text-sm font-medium text-black/60 hover:text-black"
              >
                {t('cancel')}
              </button>
              <button 
                onClick={confirmRemediation}
                className="px-8 py-2 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 transition-all shadow-lg shadow-red-600/20 flex items-center gap-2"
              >
                <Play size={16} />
                {t('startRemediation')}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-black/5 flex justify-between items-center bg-red-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 text-red-600 rounded-lg">
                  <AlertTriangle size={20} />
                </div>
                <h2 className="text-lg font-semibold text-red-900">
                  {isDeletingSelected ? 'Delete Selected Devices' : 'Delete Device'}
                </h2>
              </div>
              <button onClick={() => { setShowDeleteModal(false); setDeviceToDelete(null); setIsDeletingSelected(false); }} title={language === 'zh' ? '关闭删除确认窗口' : 'Close delete confirmation'} className="text-red-900/40 hover:text-red-900">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6">
              <p className="text-sm text-black/60">
                {isDeletingSelected 
                  ? `Are you sure you want to delete ${selectedDeviceIds.length} selected devices? This action cannot be undone.` 
                  : 'Are you sure you want to delete this device? This action cannot be undone.'}
              </p>
            </div>

            <div className="p-6 border-t border-black/5 bg-black/[0.02] flex justify-end gap-3">
              <button 
                onClick={() => { setShowDeleteModal(false); setDeviceToDelete(null); setIsDeletingSelected(false); }}
                className="px-6 py-2 text-sm font-medium text-black/60 hover:text-black"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDeleteDevice}
                className="px-8 py-2 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 transition-all shadow-lg shadow-red-600/20"
              >
                Delete
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Edit Device Modal */}
      {/* Add Device Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="p-6 border-b border-black/5 flex justify-between items-center bg-black/[0.02]">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                  <Plus size={20} />
                </div>
                <h2 className="text-lg font-semibold text-black">Add New Device</h2>
              </div>
              <button onClick={() => setShowAddModal(false)} title={language === 'zh' ? '关闭新增设备窗口' : 'Close add device dialog'} className="text-black/40 hover:text-black">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-medium text-black/60 mb-1.5 uppercase tracking-wider">Hostname</label>
                  <input 
                    type="text" 
                    value={addForm.hostname || ''}
                    title="Device hostname"
                    onChange={(e) => setAddForm({...addForm, hostname: e.target.value})}
                    className="w-full bg-black/[0.02] border border-black/5 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-black/20 focus:bg-white transition-colors"
                    placeholder="e.g. Core-SW-01"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-black/60 mb-1.5 uppercase tracking-wider">IP Address</label>
                  <input 
                    type="text" 
                    value={addForm.ip_address || ''}
                    title="Device IP address"
                    onChange={(e) => setAddForm({...addForm, ip_address: e.target.value})}
                    className="w-full bg-black/[0.02] border border-black/5 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-black/20 focus:bg-white transition-colors"
                    placeholder="e.g. 192.168.1.1"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-black/60 mb-1.5 uppercase tracking-wider">Software / Platform</label>
                  <select 
                    value={addForm.platform || 'cisco_ios'}
                    title="Device platform"
                    onChange={(e) => setAddForm({...addForm, platform: e.target.value})}
                    className="w-full bg-black/[0.02] border border-black/5 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-black/20 focus:bg-white transition-colors"
                  >
                    <option value="cisco_ios">Cisco IOS</option>
                    <option value="cisco_nxos">Cisco NX-OS</option>
                    <option value="juniper_junos">Juniper Junos</option>
                    <option value="arista_eos">Arista EOS</option>
                    <option value="fortinet_fortios">Fortinet FortiOS</option>
                    <option value="huawei_vrp">Huawei VRP</option>
                    <option value="h3c_comware">H3C Comware</option>
                    <option value="ruijie_rgos">Ruijie RGOS</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-black/60 mb-1.5 uppercase tracking-wider">Role</label>
                  <select 
                    value={addForm.role || 'Access'}
                    title="Device role"
                    onChange={(e) => setAddForm({...addForm, role: e.target.value})}
                    className="w-full bg-black/[0.02] border border-black/5 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-black/20 focus:bg-white transition-colors"
                  >
                    <option value="Core">Core</option>
                    <option value="Distribution">Distribution</option>
                    <option value="Access">Access</option>
                    <option value="Edge">Edge</option>
                    <option value="Firewall">Firewall</option>
                    <option value="Load Balancer">Load Balancer</option>
                    <option value="Unknown">Unknown</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-black/60 mb-1.5 uppercase tracking-wider">Connection Method</label>
                  <select 
                    value={addForm.connection_method || 'ssh'}
                    title="Connection method"
                    onChange={(e) => setAddForm({...addForm, connection_method: e.target.value as 'ssh' | 'netconf'})}
                    className="w-full bg-black/[0.02] border border-black/5 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-black/20 focus:bg-white transition-colors"
                  >
                    <option value="ssh">SSH</option>
                    <option value="netconf">NETCONF</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-black/60 mb-1.5 uppercase tracking-wider">Site</label>
                  <input 
                    type="text" 
                    value={addForm.site || ''}
                    title="Device site"
                    onChange={(e) => setAddForm({...addForm, site: e.target.value})}
                    className="w-full bg-black/[0.02] border border-black/5 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-black/20 focus:bg-white transition-colors"
                    placeholder="e.g. DataCenter-A"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-black/60 mb-1.5 uppercase tracking-wider">Serial Number</label>
                  <input 
                    type="text" 
                    value={addForm.sn || ''}
                    title="Serial number"
                    onChange={(e) => setAddForm({...addForm, sn: e.target.value})}
                    className="w-full bg-black/[0.02] border border-black/5 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-black/20 focus:bg-white transition-colors"
                    placeholder="e.g. SN12345678"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-black/60 mb-1.5 uppercase tracking-wider">Model</label>
                  <input 
                    type="text" 
                    value={addForm.model || ''}
                    title="Device model"
                    onChange={(e) => setAddForm({...addForm, model: e.target.value})}
                    className="w-full bg-black/[0.02] border border-black/5 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-black/20 focus:bg-white transition-colors"
                    placeholder="e.g. C9300-48P"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-black/60 mb-1.5 uppercase tracking-wider">Software Version</label>
                  <input 
                    type="text" 
                    value={addForm.version || ''}
                    title="Software version"
                    onChange={(e) => setAddForm({...addForm, version: e.target.value})}
                    className="w-full bg-black/[0.02] border border-black/5 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-black/20 focus:bg-white transition-colors"
                    placeholder="e.g. 17.3.3"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-black/60 mb-1.5 uppercase tracking-wider">SNMP Community</label>
                  <input 
                    type="text" 
                    value={addForm.snmp_community || 'public'}
                    title="SNMP community"
                    onChange={(e) => setAddForm({...addForm, snmp_community: e.target.value})}
                    className="w-full bg-black/[0.02] border border-black/5 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-black/20 focus:bg-white transition-colors"
                    placeholder="public"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-black/60 mb-1.5 uppercase tracking-wider">SNMP Port</label>
                  <input 
                    type="number" 
                    value={addForm.snmp_port || 161}
                    title="SNMP port"
                    onChange={(e) => setAddForm({...addForm, snmp_port: parseInt(e.target.value)})}
                    className="w-full bg-black/[0.02] border border-black/5 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-black/20 focus:bg-white transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-black/60 mb-1.5 uppercase tracking-wider">Username</label>
                  <input 
                    type="text" 
                    value={addForm.username || ''}
                    title="Login username"
                    onChange={(e) => setAddForm({...addForm, username: e.target.value})}
                    className="w-full bg-black/[0.02] border border-black/5 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-black/20 focus:bg-white transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-black/60 mb-1.5 uppercase tracking-wider">Password</label>
                  <div className="relative">
                    <input 
                      type={showAddDevicePwd ? 'text' : 'password'}
                      value={addForm.password || ''}
                      title="Login password"
                      onChange={(e) => setAddForm({...addForm, password: e.target.value})}
                      className="w-full bg-black/[0.02] border border-black/5 rounded-xl px-4 pr-10 py-2.5 text-sm outline-none focus:border-black/20 focus:bg-white transition-colors"
                    />
                    <button type="button" title={showAddDevicePwd ? 'Hide password' : 'Show password'} onClick={() => setShowAddDevicePwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-black/30 hover:text-black/60 transition-colors">
                      {showAddDevicePwd ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-black/5 flex gap-3 bg-black/[0.01]">
              <button 
                onClick={() => setShowAddModal(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-black/10 font-bold uppercase tracking-widest text-[10px] hover:bg-black/5 transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={handleAddDevice}
                className="flex-1 px-4 py-2.5 rounded-xl bg-black text-white font-bold uppercase tracking-widest text-[10px] hover:bg-black/80 transition-all shadow-lg shadow-black/20"
              >
                Create Device
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {showEditModal && editingDevice && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="p-6 border-b border-black/5 flex justify-between items-center bg-black/[0.02]">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                  <Edit2 size={20} />
                </div>
                <h2 className="text-lg font-semibold text-black">Edit Device</h2>
              </div>
              <button onClick={() => setShowEditModal(false)} title={language === 'zh' ? '关闭编辑设备窗口' : 'Close edit device dialog'} className="text-black/40 hover:text-black">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-medium text-black/60 mb-1.5 uppercase tracking-wider">Hostname</label>
                  <input 
                    type="text" 
                    value={editForm.hostname || ''}
                    title="Device hostname"
                    onChange={(e) => setEditForm({...editForm, hostname: e.target.value})}
                    className="w-full bg-black/[0.02] border border-black/5 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-black/20 focus:bg-white transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-black/60 mb-1.5 uppercase tracking-wider">IP Address</label>
                  <input 
                    type="text" 
                    value={editForm.ip_address || ''}
                    title="Device IP address"
                    onChange={(e) => setEditForm({...editForm, ip_address: e.target.value})}
                    className="w-full bg-black/[0.02] border border-black/5 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-black/20 focus:bg-white transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-black/60 mb-1.5 uppercase tracking-wider">Software / Platform</label>
                  <select 
                    value={editForm.platform || ''}
                    title="Device platform"
                    onChange={(e) => setEditForm({...editForm, platform: e.target.value})}
                    className="w-full bg-black/[0.02] border border-black/5 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-black/20 focus:bg-white transition-colors"
                  >
                    <option value="cisco_ios">Cisco IOS</option>
                    <option value="cisco_nxos">Cisco NX-OS</option>
                    <option value="juniper_junos">Juniper Junos</option>
                    <option value="arista_eos">Arista EOS</option>
                    <option value="fortinet_fortios">Fortinet FortiOS</option>
                    <option value="huawei_vrp">Huawei VRP</option>
                    <option value="h3c_comware">H3C Comware</option>
                    <option value="ruijie_rgos">Ruijie RGOS</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-black/60 mb-1.5 uppercase tracking-wider">Role</label>
                  <select 
                    value={editForm.role || ''}
                    title="Device role"
                    onChange={(e) => setEditForm({...editForm, role: e.target.value})}
                    className="w-full bg-black/[0.02] border border-black/5 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-black/20 focus:bg-white transition-colors"
                  >
                    <option value="Core">Core</option>
                    <option value="Distribution">Distribution</option>
                    <option value="Access">Access</option>
                    <option value="Edge">Edge</option>
                    <option value="Firewall">Firewall</option>
                    <option value="Load Balancer">Load Balancer</option>
                    <option value="Unknown">Unknown</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-black/60 mb-1.5 uppercase tracking-wider">Connection Method</label>
                  <select 
                    value={editForm.connection_method || ''}
                    title="Connection method"
                    onChange={(e) => setEditForm({...editForm, connection_method: e.target.value as 'ssh' | 'netconf'})}
                    className="w-full bg-black/[0.02] border border-black/5 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-black/20 focus:bg-white transition-colors"
                  >
                    <option value="ssh">SSH</option>
                    <option value="netconf">NETCONF</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-black/60 mb-1.5 uppercase tracking-wider">Serial Number</label>
                  <input 
                    type="text" 
                    value={editForm.sn || ''}
                    title="Serial number"
                    onChange={(e) => setEditForm({...editForm, sn: e.target.value})}
                    className="w-full bg-black/[0.02] border border-black/5 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-black/20 focus:bg-white transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-black/60 mb-1.5 uppercase tracking-wider">Model</label>
                  <input 
                    type="text" 
                    value={editForm.model || ''}
                    title="Device model"
                    onChange={(e) => setEditForm({...editForm, model: e.target.value})}
                    className="w-full bg-black/[0.02] border border-black/5 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-black/20 focus:bg-white transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-black/60 mb-1.5 uppercase tracking-wider">Version</label>
                  <input 
                    type="text" 
                    value={editForm.version || ''}
                    title="Software version"
                    onChange={(e) => setEditForm({...editForm, version: e.target.value})}
                    className="w-full bg-black/[0.02] border border-black/5 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-black/20 focus:bg-white transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-black/60 mb-1.5 uppercase tracking-wider">Site</label>
                  <input 
                    type="text" 
                    value={editForm.site || ''}
                    title="Device site"
                    onChange={(e) => setEditForm({...editForm, site: e.target.value})}
                    className="w-full bg-black/[0.02] border border-black/5 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-black/20 focus:bg-white transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-black/60 mb-1.5 uppercase tracking-wider">SNMP Community</label>
                  <input 
                    type="text" 
                    value={editForm.snmp_community || ''}
                    title="SNMP community"
                    onChange={(e) => setEditForm({...editForm, snmp_community: e.target.value})}
                    className="w-full bg-black/[0.02] border border-black/5 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-black/20 focus:bg-white transition-colors"
                    placeholder="public"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-black/60 mb-1.5 uppercase tracking-wider">SNMP Port</label>
                  <input 
                    type="number" 
                    value={editForm.snmp_port || 161}
                    title="SNMP port"
                    onChange={(e) => setEditForm({...editForm, snmp_port: parseInt(e.target.value)})}
                    className="w-full bg-black/[0.02] border border-black/5 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-black/20 focus:bg-white transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-black/60 mb-1.5 uppercase tracking-wider">Username</label>
                  <input 
                    type="text" 
                    value={editForm.username || ''}
                    title="Login username"
                    onChange={(e) => setEditForm({...editForm, username: e.target.value})}
                    className="w-full bg-black/[0.02] border border-black/5 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-black/20 focus:bg-white transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-black/60 mb-1.5 uppercase tracking-wider">Password</label>
                  <div className="relative">
                    <input 
                      type={showEditDevicePwd ? 'text' : 'password'}
                      value={editForm.password || ''}
                      title="Login password"
                      onChange={(e) => setEditForm({...editForm, password: e.target.value})}
                      placeholder="Leave blank to keep unchanged"
                      className="w-full bg-black/[0.02] border border-black/5 rounded-xl px-4 pr-10 py-2.5 text-sm outline-none focus:border-black/20 focus:bg-white transition-colors"
                    />
                    <button type="button" title={showEditDevicePwd ? 'Hide password' : 'Show password'} onClick={() => setShowEditDevicePwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-black/30 hover:text-black/60 transition-colors">
                      {showEditDevicePwd ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-black/5 bg-black/[0.02] flex justify-end gap-3">
              <button 
                onClick={() => setShowEditModal(false)}
                className="px-6 py-2 text-sm font-medium text-black/60 hover:text-black"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveEdit}
                className="px-8 py-2 bg-black text-white rounded-xl text-sm font-medium hover:bg-black/80 transition-all shadow-lg shadow-black/10"
              >
                Save Changes
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Device Details Modal */}
      {showDetailsModal && viewingDevice && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <div className="shrink-0 border-b border-black/5 bg-black/[0.02] px-5 py-4 sm:px-6 flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <Server className="text-black/60" size={24} />
                <div className="min-w-0">
                  <h3 className="text-lg font-medium">{t('deviceDetails')}</h3>
                  <p className="truncate text-xs text-black/40">{viewingDevice.hostname}</p>
                  {(viewingDeviceConnectionSummary || connectionTestingDeviceId === viewingDevice.id) && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {connectionTestingDeviceId === viewingDevice.id ? (
                        <span className="rounded-full border border-blue-200 bg-blue-100 px-2 py-1 text-[10px] font-bold uppercase text-blue-700">
                          {language === 'zh' ? '检测中' : 'Running'}
                        </span>
                      ) : viewingDeviceConnectionSummary ? (
                        <span className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase ${connectionCheckBadgeMeta[viewingDeviceConnectionSummary.status].className}`}>
                          {language === 'zh' ? connectionCheckBadgeMeta[viewingDeviceConnectionSummary.status].zh : connectionCheckBadgeMeta[viewingDeviceConnectionSummary.status].en}
                        </span>
                      ) : null}
                      {viewingDeviceConnectionSummary && (
                        <span className="text-[11px] text-black/40">
                          {(viewingDeviceConnectionSummary.mode === 'deep'
                            ? (language === 'zh' ? 'SSH 登录校验' : 'SSH login check')
                            : (language === 'zh' ? '快速连通性检测' : 'Reachability check'))}
                          {' · '}
                          {formatConnectionCheckTime(viewingDeviceConnectionSummary.checked_at, language)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 self-start sm:self-center">
                <span className="hidden text-[11px] text-black/40 sm:inline">
                  {deviceDetailLoading
                    ? (language === 'zh' ? '健康详情加载中...' : 'Loading health detail...')
                    : (language === 'zh' ? '健康详情已更新' : 'Health detail updated')}
                </span>
                <button onClick={() => setShowDetailsModal(false)} title={language === 'zh' ? '关闭设备详情' : 'Close device details'} className="text-black/20 hover:text-black">
                  <XCircle size={24} />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <div className="p-5 sm:p-6 xl:p-8 grid grid-cols-1 xl:grid-cols-[1fr_1fr_0.95fr] gap-6 xl:gap-8">
                <div className="space-y-6 xl:sticky xl:top-0 self-start">
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-black/30 mb-2">{language === 'zh' ? '健康概览' : 'Health Overview'}</h4>
                  <div className="rounded-2xl border border-black/5 bg-[linear-gradient(180deg,rgba(0,0,0,0.01),rgba(0,0,0,0.03))] p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-black/35">{language === 'zh' ? '健康评分' : 'Health Score'}</p>
                        <p className="mt-1 text-2xl font-semibold text-[#00172D]">{Math.max(0, Math.min(100, Number(viewingDevice.health_score || 0)))}</p>
                        <p className="text-[11px] text-black/45">{language === 'zh' ? '统一设备健康分' : 'Unified device health score'}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase ${viewingDevice.health_status === 'critical' ? 'bg-red-100 text-red-700' : viewingDevice.health_status === 'warning' ? 'bg-amber-100 text-amber-700' : viewingDevice.health_status === 'healthy' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                        {viewingDevice.health_status === 'critical'
                          ? (language === 'zh' ? '严重' : 'Critical')
                          : viewingDevice.health_status === 'warning'
                            ? (language === 'zh' ? '告警' : 'Warning')
                            : viewingDevice.health_status === 'healthy'
                              ? (language === 'zh' ? '健康' : 'Healthy')
                              : (language === 'zh' ? '未知' : 'Unknown')}
                      </span>
                    </div>
                    <p className="text-sm text-black/60">{viewingDevice.health_summary || (language === 'zh' ? '当前没有检测到明显健康问题。' : 'No material health issue is currently detected.')}</p>
                    <div className="grid grid-cols-2 gap-3 text-xs text-black/50">
                      <div className="rounded-xl border border-black/5 bg-white px-3 py-2">{language === 'zh' ? '开放告警' : 'Open alerts'} <span className="ml-1 font-semibold text-[#00172D]">{Number(viewingDevice.open_alert_count || 0)}</span></div>
                      <div className="rounded-xl border border-black/5 bg-white px-3 py-2">{language === 'zh' ? '接口 Down' : 'Interfaces down'} <span className="ml-1 font-semibold text-[#00172D]">{Number(viewingDevice.interface_down_count || 0)}</span></div>
                      <div className="rounded-xl border border-black/5 bg-white px-3 py-2">{language === 'zh' ? '接口抖动' : 'Flapping'} <span className="ml-1 font-semibold text-[#00172D]">{Number(viewingDevice.interface_flap_count || 0)}</span></div>
                      <div className="rounded-xl border border-black/5 bg-white px-3 py-2">{language === 'zh' ? '高利用率' : 'High util'} <span className="ml-1 font-semibold text-[#00172D]">{Number(viewingDevice.high_util_interface_count || 0)}</span></div>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-black/30 mb-2">{t('basicInfo')}</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-black/40">{t('hostname')}</span>
                      <span className="font-medium">{viewingDevice.hostname}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-black/40">{t('ipAddress')}</span>
                      <span className="font-mono">{viewingDevice.ip_address}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-black/40">{t('platform')}</span>
                      <span className="font-medium">{viewingDevice.platform}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-black/40">{t('status')}</span>
                      <span className={`font-bold uppercase text-[10px] ${viewingDevice.status === 'online' ? 'text-emerald-600' : 'text-red-600'}`}>
                        {viewingDevice.status}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-black/30 mb-2">{t('locationRole')}</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-black/40">{t('site')}</span>
                      <span className="font-medium">{viewingDevice.site}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-black/40">{t('role')}</span>
                      <span className="font-medium">{viewingDevice.role}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-black/40">SNMP Name</span>
                      <span className="font-medium">{viewingDevice.sys_name || '-'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-black/40">{language === 'zh' ? 'SNMP 位置' : 'SNMP Location'}</span>
                      <span className="font-medium text-right max-w-[180px] truncate" title={viewingDevice.sys_location || ''}>{viewingDevice.sys_location || '-'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-black/40">{language === 'zh' ? '联系人' : 'Contact'}</span>
                      <span className="font-medium">{viewingDevice.sys_contact || '-'}</span>
                    </div>
                  </div>
                </div>
              </div>

                <div className="space-y-6">
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-black/30 mb-2">{t('hardwareInfo')}</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-black/40">{t('model')}</span>
                      <span className="font-medium">{viewingDevice.model}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-black/40">{t('serialNumber')}</span>
                      <span className="font-mono">{viewingDevice.sn}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-black/40">{t('version')}</span>
                      <span className="font-medium">{viewingDevice.version}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-black/40">{t('uptime')}</span>
                      <span className="font-medium">{viewingDevice.uptime}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-black/30 mb-2">Environmental Health</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-black/40">Temperature</span>
                      <span className={`font-medium ${!viewingDevice.temp ? 'text-black/30' : viewingDevice.temp > 50 ? 'text-orange-600' : 'text-emerald-600'}`}>
                        {viewingDevice.temp != null ? `${viewingDevice.temp}°C` : 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-black/40">Fan Status</span>
                      <span className={`font-bold uppercase text-[10px] ${!viewingDevice.fan_status ? 'text-black/30' : viewingDevice.fan_status === 'ok' ? 'text-emerald-600' : 'text-red-600'}`}>
                        {viewingDevice.fan_status || 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-black/40">PSU Status</span>
                      <span className={`font-bold uppercase text-[10px] ${!viewingDevice.psu_status ? 'text-black/30' : viewingDevice.psu_status === 'redundant' ? 'text-emerald-600' : 'text-orange-600'}`}>
                        {viewingDevice.psu_status || 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-black/30 mb-2">{language === 'zh' ? '健康原因' : 'Health Reasons'}</h4>
                  <div className="space-y-2 rounded-2xl border border-black/5 bg-black/[0.01] p-4">
                    {Array.isArray(viewingDevice.health_reasons) && viewingDevice.health_reasons.length > 0 ? viewingDevice.health_reasons.slice(0, 6).map((reason, index) => (
                      <div key={`${reason}-${index}`} className="rounded-xl border border-black/5 bg-white px-3 py-2 text-sm text-black/60">
                        {reason}
                      </div>
                    )) : (
                      <div className="rounded-xl border border-dashed border-black/10 bg-white px-3 py-4 text-sm text-black/40">
                        {language === 'zh' ? '当前没有需要升级处理的健康原因。' : 'There are no escalated health reasons right now.'}
                      </div>
                    )}
                  </div>
                </div>
              </div>

                <div className="space-y-6">
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-black/30 mb-2">{language === 'zh' ? '开放告警' : 'Open Alerts'}</h4>
                  <div className="space-y-2 rounded-2xl border border-black/5 bg-black/[0.01] p-4 max-h-[520px] overflow-auto">
                    {viewingDeviceAlerts.length > 0 ? viewingDeviceAlerts.map((alert) => {
                      const tone = String(alert.severity || '').toLowerCase() === 'critical' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700';
                      return (
                        <div key={alert.id} className="rounded-xl border border-black/5 bg-white p-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${tone}`}>{String(alert.severity || '').toUpperCase()}</span>
                            <span className="text-[11px] text-black/40">{new Date(alert.created_at).toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US', { hour12: false })}</span>
                          </div>
                          <p className="mt-2 text-sm font-semibold text-[#0b2340]">{alert.title}</p>
                          <p className="mt-1 text-[11px] text-black/55">{alert.message}</p>
                          {alert.interface_name && <p className="mt-2 text-[11px] font-mono text-black/35">{alert.interface_name}</p>}
                        </div>
                      );
                    }) : (
                      <div className="rounded-xl border border-dashed border-black/10 bg-white px-3 py-4 text-sm text-black/40">
                        {deviceDetailLoading
                          ? (language === 'zh' ? '正在加载告警详情...' : 'Loading alert detail...')
                          : (language === 'zh' ? '当前没有未恢复告警。' : 'There are no open alerts right now.')}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-black/30">{language === 'zh' ? '健康趋势' : 'Health Trend'}</h4>
                    <div className="flex items-center gap-2">
                      {[1, 24, 168].map((hours) => (
                        <button
                          key={hours}
                          type="button"
                          onClick={() => setDeviceTrendRangeHours(hours)}
                          className={`rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] transition-all ${deviceTrendRangeHours === hours ? 'bg-black text-white' : 'border border-black/10 text-black/50 hover:bg-black/[0.03]'}`}
                        >
                          {hours === 1 ? (language === 'zh' ? '1 小时' : '1h') : hours === 24 ? (language === 'zh' ? '24 小时' : '24h') : (language === 'zh' ? '7 天' : '7d')}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-black/5 bg-[linear-gradient(180deg,rgba(0,0,0,0.01),rgba(0,0,0,0.03))] p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3 text-[11px] text-black/45">
                      <span>
                        {deviceHealthTrendLoading
                          ? (language === 'zh' ? '趋势加载中...' : 'Loading trend...')
                          : `${deviceHealthTrend?.sample_count || 0} ${language === 'zh' ? '个采样点' : 'samples'}`}
                      </span>
                      <span>{language === 'zh' ? '开放告警' : 'Open alerts'} {Number(viewingDevice.open_alert_count || 0)}</span>
                    </div>
                    <div className="h-[220px] rounded-xl border border-black/5 bg-white p-3">
                      {deviceHealthTrend?.series?.length ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={deviceHealthTrend.series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="#dbe4ee" />
                            <XAxis
                              dataKey="ts"
                              axisLine={false}
                              tickLine={false}
                              tick={{ fontSize: 11, fill: '#60748a' }}
                              tickFormatter={(value) => new Date(String(value)).toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })}
                              minTickGap={28}
                            />
                            <YAxis yAxisId="score" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#60748a' }} domain={[0, 100]} width={32} />
                            <YAxis yAxisId="alerts" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#60748a' }} width={28} />
                            <Tooltip
                              contentStyle={{ borderRadius: 14, borderColor: '#d9e3ef', boxShadow: '0 18px 38px rgba(15,23,42,0.12)', padding: '14px 16px', background: 'rgba(255,255,255,0.96)' }}
                              labelFormatter={(value) => new Date(String(value)).toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US', { hour12: false })}
                            />
                            <Area yAxisId="score" type="monotone" dataKey="health_score" name={language === 'zh' ? '健康分' : 'Health score'} stroke="#2563eb" fill="#2563eb1f" strokeWidth={2.1} isAnimationActive={false} />
                            <Area yAxisId="alerts" type="monotone" dataKey="open_alert_count" name={language === 'zh' ? '开放告警' : 'Open alerts'} stroke="#dc2626" fill="#dc262618" strokeWidth={1.8} isAnimationActive={false} />
                          </AreaChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm text-black/35">
                          {deviceHealthTrendLoading
                            ? (language === 'zh' ? '正在拉取设备趋势...' : 'Loading device trend...')
                            : (language === 'zh' ? '当前没有该设备的健康趋势样本。' : 'No health trend samples are available for this device yet.')}
                        </div>
                      )}
                    </div>
                    {deviceHealthTrend?.series?.length ? (
                      <div className="grid grid-cols-1 gap-2 text-xs text-black/55">
                        {[...deviceHealthTrend.series].slice(-2).reverse().map((point) => (
                          <div key={point.ts} className="rounded-xl border border-black/5 bg-white px-3 py-2">
                            <div className="flex items-center justify-between gap-3">
                              <span className="font-medium text-[#00172D]">{new Date(point.ts).toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US', { hour12: false })}</span>
                              <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${point.health_status === 'critical' ? 'bg-red-100 text-red-700' : point.health_status === 'warning' ? 'bg-amber-100 text-amber-700' : point.health_status === 'healthy' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{point.health_status}</span>
                            </div>
                            <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-black/45">
                              <span>{language === 'zh' ? '健康分' : 'Score'} {Number(point.health_score || 0)}</span>
                              <span>{language === 'zh' ? '开放告警' : 'Open alerts'} {Number(point.open_alert_count || 0)}</span>
                              <span>{language === 'zh' ? 'Down 接口' : 'Down links'} {Number(point.interface_down_count || 0)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <div className="rounded-xl border border-black/5 bg-white p-4 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-black/35">{language === 'zh' ? '最近一次变化' : 'Latest Change'}</p>
                        <span className="text-[11px] text-black/40">
                          {deviceTrendInsights.latest
                            ? new Date(deviceTrendInsights.latest.ts).toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US', { hour12: false })
                            : (language === 'zh' ? '暂无样本' : 'No samples')}
                        </span>
                      </div>
                      {deviceTrendInsights.latest ? (
                        <>
                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div className="rounded-xl border border-black/5 bg-black/[0.015] px-3 py-2 text-black/55">
                              <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-black/35">{language === 'zh' ? '健康分变化' : 'Score delta'}</span>
                              <span className={`mt-1 block text-sm font-semibold ${deviceTrendInsights.scoreDelta < 0 ? 'text-red-600' : deviceTrendInsights.scoreDelta > 0 ? 'text-emerald-600' : 'text-[#00172D]'}`}>
                                {deviceTrendInsights.scoreDelta > 0 ? '+' : ''}{deviceTrendInsights.scoreDelta}
                              </span>
                            </div>
                            <div className="rounded-xl border border-black/5 bg-black/[0.015] px-3 py-2 text-black/55">
                              <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-black/35">{language === 'zh' ? '告警数变化' : 'Alert delta'}</span>
                              <span className={`mt-1 block text-sm font-semibold ${deviceTrendInsights.alertDelta > 0 ? 'text-red-600' : deviceTrendInsights.alertDelta < 0 ? 'text-emerald-600' : 'text-[#00172D]'}`}>
                                {deviceTrendInsights.alertDelta > 0 ? '+' : ''}{deviceTrendInsights.alertDelta}
                              </span>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                            <div className="rounded-xl border border-red-100 bg-red-50/50 p-3">
                              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-red-600">{language === 'zh' ? '新增风险原因' : 'New risk reasons'}</p>
                              <div className="mt-2 space-y-2">
                                {deviceTrendInsights.addedReasons.length > 0 ? deviceTrendInsights.addedReasons.slice(0, 4).map((reason) => (
                                  <div key={reason} className="rounded-lg bg-white px-3 py-2 text-xs text-red-700 border border-red-100">{reason}</div>
                                )) : (
                                  <div className="rounded-lg border border-dashed border-red-200 bg-white/80 px-3 py-2 text-xs text-red-400">
                                    {language === 'zh' ? '最近一次采样没有新增风险原因。' : 'No new risk reasons appeared in the latest sample.'}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3">
                              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-700">{language === 'zh' ? '已缓解原因' : 'Cleared reasons'}</p>
                              <div className="mt-2 space-y-2">
                                {deviceTrendInsights.removedReasons.length > 0 ? deviceTrendInsights.removedReasons.slice(0, 4).map((reason) => (
                                  <div key={reason} className="rounded-lg bg-white px-3 py-2 text-xs text-emerald-700 border border-emerald-100">{reason}</div>
                                )) : (
                                  <div className="rounded-lg border border-dashed border-emerald-200 bg-white/80 px-3 py-2 text-xs text-emerald-500">
                                    {language === 'zh' ? '最近一次采样没有观察到已缓解原因。' : 'No reasons were cleared in the latest sample.'}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="rounded-xl border border-dashed border-black/10 bg-black/[0.015] px-3 py-4 text-sm text-black/40">
                          {language === 'zh' ? '至少需要一次健康采样后才能比较原因变化。' : 'At least one health sample is required before reason changes can be compared.'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              </div>

              <div className="px-5 pb-5 sm:px-6 xl:px-8">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-black/30">{language === 'zh' ? '运行数据视图' : 'Operational Data'}</h4>
                    <p className="mt-1 text-xs text-black/40">
                      {language === 'zh'
                        ? '采集接口、邻居、ARP、MAC、路由表、BGP 和 OSPF 的结构化结果。'
                        : 'Collect structured views for interfaces, neighbors, ARP, MAC, routing, BGP, and OSPF.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => viewingDevice?.id && loadDeviceOperationalData(viewingDevice.id)}
                    disabled={deviceOperationalDataLoading}
                    className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-all ${deviceOperationalDataLoading ? 'bg-slate-400' : 'bg-[#00172D] hover:bg-[#0b2849]'}`}
                  >
                    <RotateCcw size={15} className={deviceOperationalDataLoading ? 'animate-spin' : ''} />
                    {deviceOperationalDataLoading
                      ? (language === 'zh' ? '采集中...' : 'Collecting...')
                      : (deviceOperationalData ? (language === 'zh' ? '重新采集' : 'Refresh') : (language === 'zh' ? '开始采集' : 'Collect'))}
                  </button>
                </div>

                {!deviceOperationalData ? (
                  <div className="rounded-2xl border border-dashed border-black/10 bg-black/[0.015] px-4 py-5 text-sm text-black/40">
                    {language === 'zh'
                      ? '点击“开始采集”后，会按平台命令模板抓取这 6 类运行数据，并用 ntc-templates 解析后展示。'
                      : 'Click Collect to run platform-specific commands for these six categories and display ntc-templates parsing results.'}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-xl border border-black/5 bg-white px-4 py-3 text-sm text-black/55">
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-black/35">{language === 'zh' ? '成功分类' : 'Successful'}</p>
                        <p className="mt-1 text-xl font-semibold text-[#00172D]">{Number(deviceOperationalData.summary?.successful_categories || 0)}</p>
                      </div>
                      <div className="rounded-xl border border-black/5 bg-white px-4 py-3 text-sm text-black/55">
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-black/35">{language === 'zh' ? '失败分类' : 'Failed'}</p>
                        <p className="mt-1 text-xl font-semibold text-[#00172D]">{Number(deviceOperationalData.summary?.failed_categories || 0)}</p>
                      </div>
                      <div className="rounded-xl border border-black/5 bg-white px-4 py-3 text-sm text-black/55">
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-black/35">{language === 'zh' ? '结构化记录' : 'Records'}</p>
                        <p className="mt-1 text-xl font-semibold text-[#00172D]">{Number(deviceOperationalData.summary?.total_records || 0)}</p>
                      </div>
                      <div className="rounded-xl border border-black/5 bg-white px-4 py-3 text-sm text-black/55">
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-black/35">{language === 'zh' ? '采集时间' : 'Collected'}</p>
                        <p className="mt-1 text-sm font-semibold text-[#00172D]">{new Date(String(deviceOperationalData.collected_at || '')).toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US', { hour12: false })}</p>
                      </div>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-2">
                      {(Array.isArray(deviceOperationalData.categories) ? deviceOperationalData.categories : []).map((category: any) => {
                        const records = Array.isArray(category.records) ? category.records : [];
                        const rawOutputs = Array.isArray(category.raw_outputs) ? category.raw_outputs : [];
                        const toneClass = category.success ? 'border-emerald-100' : 'border-red-100';
                        const label = operationalCategoryLabelMap[category.key]?.[language === 'zh' ? 'zh' : 'en'] || category.key;
                        return (
                          <div key={category.key} className={`rounded-2xl border bg-white ${toneClass} overflow-hidden`}>
                            <div className="flex items-center justify-between gap-3 border-b border-black/5 bg-black/[0.02] px-4 py-3">
                              <div>
                                <p className="text-sm font-semibold text-[#00172D]">{label}</p>
                                <p className="mt-1 text-[11px] text-black/40">{Array.isArray(category.commands) ? category.commands.join(' | ') : '-'}</p>
                              </div>
                              <div className="text-right">
                                <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${category.success ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                  {category.success ? (language === 'zh' ? '成功' : 'OK') : (language === 'zh' ? '失败' : 'Fail')}
                                </span>
                                <p className="mt-1 text-[11px] font-medium text-black/45">{Number(category.count || 0)} {language === 'zh' ? '条' : 'rows'}</p>
                              </div>
                            </div>
                            <div className="space-y-3 p-4">
                              {category.error && (
                                <div className="rounded-xl border border-red-100 bg-red-50/60 px-3 py-2 text-xs text-red-700">{category.error}</div>
                              )}
                              {records.length > 0 ? (
                                <pre className="max-h-64 overflow-auto rounded-xl bg-black/[0.025] p-3 text-[11px] text-black/65 whitespace-pre-wrap">{JSON.stringify(records.slice(0, 12), null, 2)}</pre>
                              ) : rawOutputs.length > 0 ? (
                                <div className="space-y-2">
                                  {rawOutputs.slice(0, 2).map((item: any, index: number) => (
                                    <div key={`${category.key}-raw-${index}`} className="rounded-xl border border-black/5 bg-black/[0.015] p-3">
                                      <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-black/35">{item.command}</p>
                                      <pre className="max-h-40 overflow-auto text-[11px] text-black/60 whitespace-pre-wrap">{String(item.output || '').slice(0, 3000)}</pre>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="rounded-xl border border-dashed border-black/10 bg-black/[0.015] px-3 py-4 text-sm text-black/40">
                                  {language === 'zh' ? '已执行命令，但没有得到可展示的结构化记录。' : 'Commands ran, but no displayable structured records were returned.'}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Interface Monitoring Table */}
              {viewingDevice.interface_data && viewingDevice.interface_data.length > 0 && (
                <div className="px-5 pb-5 sm:px-6 sm:pb-6 xl:px-8 xl:pb-6">
                  <h4 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-black/30">{language === 'zh' ? '接口监控' : 'Interface Monitoring'} ({viewingDevice.interface_data.length})</h4>
                  <div className="max-h-60 overflow-auto rounded-xl border border-black/5">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-black/[0.02]">
                        <tr>
                          <th className="px-3 py-2 text-left font-bold text-[10px] uppercase text-black/40">{language === 'zh' ? '接口' : 'Interface'}</th>
                          <th className="px-3 py-2 text-left font-bold text-[10px] uppercase text-black/40">{language === 'zh' ? '状态' : 'Status'}</th>
                          <th className="px-3 py-2 text-right font-bold text-[10px] uppercase text-black/40">{language === 'zh' ? '速率' : 'Speed'}</th>
                          <th className="px-3 py-2 text-right font-bold text-[10px] uppercase text-black/40">IN</th>
                          <th className="px-3 py-2 text-right font-bold text-[10px] uppercase text-black/40">OUT</th>
                          <th className="px-3 py-2 text-right font-bold text-[10px] uppercase text-black/40">{language === 'zh' ? '带宽' : 'BW%'}</th>
                          <th className="px-3 py-2 text-right font-bold text-[10px] uppercase text-black/40">{language === 'zh' ? '错误' : 'Err'}</th>
                          <th className="px-3 py-2 text-right font-bold text-[10px] uppercase text-black/40">{language === 'zh' ? '丢包' : 'Drop'}</th>
                          <th className="px-3 py-2 text-left font-bold text-[10px] uppercase text-black/40">{language === 'zh' ? '描述' : 'Desc'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black/5">
                        {viewingDevice.interface_data.map((intf, i) => {
                          const fmtBytes = (b: number) => b > 1073741824 ? `${(b / 1073741824).toFixed(1)} GB` : b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : b > 1024 ? `${(b / 1024).toFixed(0)} KB` : `${b} B`;
                          const fmtRate = (bps?: number) => {
                            if (bps == null || !Number.isFinite(bps) || bps < 0) return '-';
                            if (bps >= 1_000_000_000) return `${(bps / 1_000_000_000).toFixed(2)} Gbps`;
                            if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(2)} Mbps`;
                            if (bps >= 1_000) return `${(bps / 1_000).toFixed(1)} Kbps`;
                            return `${bps.toFixed(0)} bps`;
                          };
                          const totalErr = (intf.in_errors || 0) + (intf.out_errors || 0);
                          const totalDrop = (intf.in_discards || 0) + (intf.out_discards || 0);
                          const maxBw = (intf.bw_in_pct != null || intf.bw_out_pct != null) ? Math.max(intf.bw_in_pct || 0, intf.bw_out_pct || 0) : null;
                          return (
                            <tr key={i} className="hover:bg-black/[0.01]">
                              <td className="px-3 py-1.5 font-mono text-[11px]">{intf.name}</td>
                              <td className="px-3 py-1.5">
                                <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase ${intf.status === 'up' ? 'text-emerald-600' : 'text-red-500'}`}>
                                  <span className={`h-1.5 w-1.5 rounded-full ${intf.status === 'up' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                  {intf.status}
                                </span>
                              </td>
                              <td className="px-3 py-1.5 text-right text-black/60">{intf.speed_mbps > 0 ? `${intf.speed_mbps >= 1000 ? `${intf.speed_mbps / 1000}G` : `${intf.speed_mbps}M`}` : '-'}</td>
                              <td className="px-3 py-1.5 text-right font-mono text-[10px]">
                                <div className="text-blue-600">{fmtRate(intf.in_bps)}</div>
                                <div className="text-black/30">{fmtBytes(intf.in_octets || 0)}</div>
                              </td>
                              <td className="px-3 py-1.5 text-right font-mono text-[10px]">
                                <div className="text-orange-600">{fmtRate(intf.out_bps)}</div>
                                <div className="text-black/30">{fmtBytes(intf.out_octets || 0)}</div>
                              </td>
                              <td className="px-3 py-1.5 text-right font-mono text-[10px]">
                                {maxBw != null ? <span className={maxBw > 80 ? 'text-red-600' : maxBw > 50 ? 'text-orange-600' : 'text-black/50'}>{maxBw.toFixed(1)}%</span> : <span className="text-black/20">-</span>}
                              </td>
                              <td className="px-3 py-1.5 text-right font-mono text-[10px]">
                                <span className={totalErr > 0 ? 'text-red-600 font-bold' : 'text-black/30'}>{totalErr}</span>
                              </td>
                              <td className="px-3 py-1.5 text-right font-mono text-[10px]">
                                <span className={totalDrop > 0 ? 'text-orange-600 font-bold' : 'text-black/30'}>{totalDrop}</span>
                              </td>
                              <td className="max-w-[120px] truncate px-3 py-1.5 text-black/40">{intf.description || '-'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="shrink-0 border-t border-black/5 bg-black/[0.01] px-5 py-4 sm:px-6">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex flex-wrap gap-3">
                <button 
                  onClick={() => handleTestConnection(viewingDevice, 'quick')}
                  disabled={isTestingConnection}
                  className="px-6 py-2 bg-blue-50 text-blue-600 rounded-xl text-sm font-medium hover:bg-blue-100 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  <Activity size={16} />
                  {isTestingConnection ? 'Testing...' : (language === 'zh' ? '快速连通性' : 'Reachability Check')}
                </button>
                <button 
                  onClick={() => handleTestConnection(viewingDevice, 'deep')}
                  disabled={isTestingConnection}
                  className="px-6 py-2 bg-violet-50 text-violet-700 rounded-xl text-sm font-medium hover:bg-violet-100 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  <ShieldCheck size={16} />
                  {isTestingConnection ? 'Testing...' : (language === 'zh' ? 'SSH 登录校验' : 'SSH Login Check')}
                </button>
                <button
                  onClick={() => handleSnmpTest(viewingDevice.id)}
                  disabled={snmpTestingId === viewingDevice.id}
                  className="px-6 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-sm font-medium hover:bg-emerald-100 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  <Activity size={16} />
                  {snmpTestingId === viewingDevice.id ? 'Testing...' : 'SNMP Test'}
                </button>
                <button
                  onClick={() => handleSnmpSyncNow(viewingDevice.id)}
                  disabled={snmpSyncingId === viewingDevice.id}
                  className="px-6 py-2 bg-cyan-50 text-cyan-700 rounded-xl text-sm font-medium hover:bg-cyan-100 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  <RotateCcw size={16} className={snmpSyncingId === viewingDevice.id ? 'animate-spin' : ''} />
                  {snmpSyncingId === viewingDevice.id
                    ? (language === 'zh' ? '同步中...' : 'Syncing...')
                    : (language === 'zh' ? '立即同步SNMP' : 'SNMP Sync Now')}
                </button>
                <button 
                  onClick={() => {
                    setSelectedDevice(viewingDevice);
                    setActiveTab('automation');
                    setShowDetailsModal(false);
                  }}
                  className="px-6 py-2 border border-black/10 text-black rounded-xl text-sm font-medium hover:bg-black/5 transition-all flex items-center gap-2"
                >
                  <Zap size={16} />
                  Go to Automation
                </button>
                </div>
                <div className="flex justify-end">
                  <button 
                    onClick={() => setShowDetailsModal(false)}
                    className="px-8 py-2 bg-black text-white rounded-xl text-sm font-medium hover:bg-black/80 transition-all shadow-lg shadow-black/20"
                  >
                    {t('close')}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* SNMP Test Result Modal */}
      {showSnmpTestResult && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onClick={() => setShowSnmpTestResult(false)}>
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-black/5 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-black/5 flex justify-between items-center">
              <h3 className="text-sm font-semibold">SNMP Test Result</h3>
              <button onClick={() => setShowSnmpTestResult(false)} title={language === 'zh' ? '关闭 SNMP 测试结果' : 'Close SNMP test result'} className="text-black/30 hover:text-black">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {!snmpTestResult ? (
                <div className="flex items-center justify-center py-8">
                  <RotateCcw className="animate-spin text-black/20" size={24} />
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${snmpTestResult.success ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                      {snmpTestResult.success ? <CheckCircle size={20} /> : <XCircle size={20} />}
                    </div>
                    <div>
                      <p className={`font-semibold text-sm ${snmpTestResult.success ? 'text-emerald-600' : 'text-red-500'}`}>
                        {snmpTestResult.success ? (language === 'zh' ? 'SNMP 连通成功' : 'SNMP Reachable') : (language === 'zh' ? 'SNMP 连通失败' : 'SNMP Unreachable')}
                      </p>
                      {snmpTestResult.response_ms != null && (
                        <p className="text-[10px] text-black/40">{language === 'zh' ? '响应延迟' : 'Response time'}: {snmpTestResult.response_ms} ms</p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1.5 border-b border-black/5">
                      <span className="text-black/40">IP</span>
                      <span className="font-mono">{snmpTestResult.ip}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-black/5">
                      <span className="text-black/40">Community</span>
                      <span className="font-mono">{snmpTestResult.community}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-black/5">
                      <span className="text-black/40">Port</span>
                      <span>{snmpTestResult.port}</span>
                    </div>
                    {snmpTestResult.sys_name && (
                      <div className="flex justify-between py-1.5 border-b border-black/5">
                        <span className="text-black/40">sysName</span>
                        <span className="font-medium text-right max-w-[200px] truncate">{snmpTestResult.sys_name}</span>
                      </div>
                    )}
                    {snmpTestResult.sys_descr && (
                      <div className="py-1.5 border-b border-black/5">
                        <span className="text-black/40 block mb-1">sysDescr</span>
                        <span className="text-[11px] text-black/60 break-all">{snmpTestResult.sys_descr}</span>
                      </div>
                    )}
                    {snmpTestResult.error && (
                      <div className="py-1.5">
                        <span className="text-red-500 block mb-1">{language === 'zh' ? '错误信息' : 'Error'}</span>
                        <span className="text-[11px] text-red-400 break-all">{snmpTestResult.error}</span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Audit Event Detail Modal */}
      {selectedAuditEvent && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-black/5 overflow-hidden flex flex-col max-h-[82vh]"
          >
            <div className="p-6 border-b border-black/5 flex justify-between items-start bg-black/[0.01]">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-medium">{selectedAuditEvent.summary}</h3>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${auditStatusBadgeClass(selectedAuditEvent.status)}`}>{selectedAuditEvent.status}</span>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${severityBadgeClass(selectedAuditEvent.severity)}`}>{selectedAuditEvent.severity}</span>
                </div>
                <p className="mt-2 text-xs text-black/40 font-mono">{selectedAuditEvent.event_type} · {new Date(selectedAuditEvent.created_at).toLocaleString()}</p>
              </div>
              <button onClick={() => setSelectedAuditEvent(null)} title={language === 'zh' ? '关闭审计详情' : 'Close audit details'} className="text-black/40 hover:text-black">
                <XCircle size={22} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-black/5 p-4 bg-black/[0.02]">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-black/35">{language === 'zh' ? '行为主体' : 'Actor'}</p>
                  <p className="mt-2 text-sm font-medium">{selectedAuditEvent.actor_username || 'system'}</p>
                  <p className="text-xs text-black/40 mt-1">{selectedAuditEvent.actor_role || 'Unknown role'}</p>
                  <p className="text-xs text-black/35 mt-1 font-mono">{selectedAuditEvent.source_ip || 'N/A'}</p>
                </div>
                <div className="rounded-2xl border border-black/5 p-4 bg-black/[0.02]">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-black/35">{language === 'zh' ? '目标对象' : 'Target'}</p>
                  <p className="mt-2 text-sm font-medium">{selectedAuditEvent.target_name || 'N/A'}</p>
                  <p className="text-xs text-black/40 mt-1">{selectedAuditEvent.target_type || 'Unknown type'} · {selectedAuditEvent.target_id || 'N/A'}</p>
                  <p className="text-xs text-black/35 mt-1 font-mono">device={selectedAuditEvent.device_id || 'N/A'} job={selectedAuditEvent.job_id || 'N/A'}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-black/5 p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-black/35">{language === 'zh' ? '事件详情' : 'Event Details'}</p>
                <pre className="mt-3 text-xs text-black/70 bg-black/[0.02] rounded-xl p-4 overflow-auto whitespace-pre-wrap font-mono">
                  {JSON.stringify(selectedAuditEvent.details || parseJsonObject(selectedAuditEvent.details_json), null, 2)}
                </pre>
              </div>
            </div>
            <div className="p-4 border-t border-black/5 flex justify-end">
              <button onClick={() => setSelectedAuditEvent(null)} className="px-6 py-2 bg-black text-white rounded-xl text-sm font-medium hover:bg-black/80 transition-all">
                {t('close')}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Compliance Finding Detail Modal */}
      {selectedFinding && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-black/5 overflow-hidden flex flex-col max-h-[84vh]"
          >
            <div className="p-6 border-b border-black/5 flex justify-between items-start bg-black/[0.01]">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-medium">{selectedFinding.title}</h3>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${severityBadgeClass(selectedFinding.severity)}`}>{selectedFinding.severity}</span>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${complianceStatusBadgeClass(selectedFinding.status)}`}>{selectedFinding.status.replace('_', ' ')}</span>
                </div>
                <p className="mt-2 text-xs text-black/40 font-mono">{selectedFinding.rule_id} · {selectedFinding.hostname || selectedFinding.device_id} · {selectedFinding.ip_address || 'N/A'}</p>
              </div>
              <button onClick={() => setSelectedFinding(null)} title={language === 'zh' ? '关闭问题详情' : 'Close finding details'} className="text-black/40 hover:text-black">
                <XCircle size={22} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-black/5 p-4 bg-black/[0.02]">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-black/35">{language === 'zh' ? '问题描述' : 'Description'}</p>
                  <p className="mt-3 text-sm text-black/75 leading-6">{selectedFinding.description}</p>
                  <p className="mt-4 text-[10px] font-bold uppercase tracking-widest text-black/35">{language === 'zh' ? '整改建议' : 'Remediation'}</p>
                  <p className="mt-2 text-sm text-black/70 leading-6">{selectedFinding.remediation || (language === 'zh' ? '暂无建议' : 'No remediation provided.')}</p>
                </div>
                <div className="rounded-2xl border border-black/5 p-4 bg-black/[0.02] space-y-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-black/35">{language === 'zh' ? '观察值' : 'Observed Value'}</p>
                    <p className="mt-2 text-xs text-black/70 font-mono whitespace-pre-wrap">{selectedFinding.observed_value || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-black/35">{language === 'zh' ? '证据' : 'Evidence'}</p>
                    <p className="mt-2 text-xs text-black/70 font-mono whitespace-pre-wrap">{selectedFinding.evidence || 'N/A'}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-black/35">{language === 'zh' ? '状态' : 'Status'}</label>
                  <select
                    value={selectedFinding.status}
                    title={language === 'zh' ? '审计项状态' : 'Finding status'}
                    onChange={(e) => setSelectedFinding((prev) => prev ? { ...prev, status: e.target.value } : prev)}
                    className="mt-2 w-full px-3 py-2 rounded-xl border border-black/10 text-sm outline-none bg-white"
                  >
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="accepted_risk">Accepted Risk</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-black/35">{language === 'zh' ? '负责人' : 'Owner'}</label>
                  <input
                    value={selectedFinding.owner || ''}
                    title={language === 'zh' ? '负责人' : 'Owner'}
                    onChange={(e) => setSelectedFinding((prev) => prev ? { ...prev, owner: e.target.value } : prev)}
                    className="mt-2 w-full px-3 py-2 rounded-xl border border-black/10 text-sm outline-none"
                    placeholder={language === 'zh' ? '例如：SecOps / NOC' : 'e.g. SecOps / NOC'}
                  />
                </div>
                <div className="rounded-2xl border border-black/5 p-4 bg-black/[0.02]">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-black/35">{language === 'zh' ? '时间线' : 'Timeline'}</p>
                  <p className="mt-2 text-xs text-black/60">{language === 'zh' ? '首次发现' : 'First seen'}: {new Date(selectedFinding.first_seen_at).toLocaleString()}</p>
                  <p className="mt-1 text-xs text-black/60">{language === 'zh' ? '最近发现' : 'Last seen'}: {new Date(selectedFinding.last_seen_at).toLocaleString()}</p>
                  <p className="mt-1 text-xs text-black/60">{language === 'zh' ? '已解决' : 'Resolved'}: {selectedFinding.resolved_at ? new Date(selectedFinding.resolved_at).toLocaleString() : 'N/A'}</p>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-black/35">{language === 'zh' ? '备注' : 'Note'}</label>
                <textarea
                  value={selectedFinding.note || ''}
                  title={language === 'zh' ? '备注' : 'Note'}
                  onChange={(e) => setSelectedFinding((prev) => prev ? { ...prev, note: e.target.value } : prev)}
                  className="mt-2 w-full min-h-[120px] px-4 py-3 rounded-2xl border border-black/10 text-sm outline-none resize-y"
                  placeholder={language === 'zh' ? '记录处理过程、风险接受依据或整改计划。' : 'Document triage notes, risk acceptance rationale, or remediation plan.'}
                />
              </div>
            </div>
            <div className="p-4 border-t border-black/5 flex justify-between gap-3">
              <button onClick={() => setSelectedFinding(null)} className="px-6 py-2 border border-black/10 rounded-xl text-sm font-medium hover:bg-black/5 transition-all">
                {t('cancel')}
              </button>
              <button
                onClick={() => updateComplianceFinding(selectedFinding.id, {
                  status: selectedFinding.status,
                  owner: selectedFinding.owner,
                  note: selectedFinding.note,
                })}
                className="px-6 py-2 bg-black text-white rounded-xl text-sm font-medium hover:bg-black/80 transition-all"
              >
                {language === 'zh' ? '保存审计处置' : 'Save Finding'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Job Output Modal */}
      {selectedJob && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-black/5 overflow-hidden flex flex-col max-h-[80vh]"
          >
            <div className="p-6 border-b border-black/5 flex justify-between items-center bg-black/[0.01]">
              <div>
                <h3 className="text-lg font-medium">{selectedJob.task_name}</h3>
                <p className="text-xs text-black/40 uppercase tracking-wider">{new Date(selectedJob.created_at).toLocaleString()}</p>
              </div>
              <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${
                selectedJob.status === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
              }`}>
                {selectedJob.status}
              </div>
            </div>
            <div className="flex-1 overflow-auto p-6 bg-[#1E1E1E] font-mono text-xs text-[#D4D4D4] relative group">
              <button
                onClick={() => {
                  const text = selectedJob.output || '';
                  if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(text).then(() => {
                      showToast(t('copied'), 'success');
                    }).catch(() => {
                      const ta = document.createElement('textarea');
                      ta.value = text;
                      ta.style.position = 'fixed';
                      ta.style.opacity = '0';
                      document.body.appendChild(ta);
                      ta.select();
                      document.execCommand('copy');
                      document.body.removeChild(ta);
                      showToast(t('copied'), 'success');
                    });
                  } else {
                    const ta = document.createElement('textarea');
                    ta.value = text;
                    ta.style.position = 'fixed';
                    ta.style.opacity = '0';
                    document.body.appendChild(ta);
                    ta.select();
                    document.execCommand('copy');
                    document.body.removeChild(ta);
                    showToast(t('copied'), 'success');
                  }
                }}
                className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                title="Copy Output"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
              </button>
              <pre className="whitespace-pre-wrap">{selectedJob.output || 'No output recorded.'}</pre>
            </div>
            <div className="p-4 border-t border-black/5 flex justify-end gap-3">
              <button 
                onClick={() => setSelectedJob(null)}
                className="px-6 py-2 bg-black text-white rounded-xl text-sm font-medium hover:bg-black/80 transition-all"
              >
                {t('close')}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <motion.div 
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 50, opacity: 0 }}
          className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border ${
            toast.type === 'success' ? 'bg-emerald-600 border-emerald-500 text-white' :
            toast.type === 'error' ? 'bg-red-600 border-red-500 text-white' :
            'bg-black border-black/10 text-white'
          }`}
        >
          {toast.type === 'success' && <CheckCircle size={18} />}
          {toast.type === 'error' && <XCircle size={18} />}
          {toast.type === 'info' && <Bell size={18} />}
          <span className="text-sm font-medium">{toast.message}</span>
        </motion.div>
      )}
      </div>
    </AppRuntimeBoundary>
  );
};

export default App;
