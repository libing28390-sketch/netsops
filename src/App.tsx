import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'motion/react';
import { Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom';
import * as htmlToImage from 'html-to-image';
import { Plus, Server, CheckCircle, CheckCircle2, XCircle, RotateCcw, Play, Activity, LayoutDashboard, Database, Zap, ShieldCheck, History, LogOut, Search, Bell, Settings, Download, Upload, FileText, ChevronLeft, ChevronRight, Filter, Globe, TrendingUp, PieChart as PieChartIcon, Clock, AlertTriangle, X, Edit2, AlertCircle, FolderOpen, Eye, EyeOff, Sun, Moon, User, ChevronDown, Copy, Menu, PanelLeftClose, Monitor, ExternalLink, Trash2 } from 'lucide-react';
import { useI18n } from './i18n.tsx';
import * as XLSX from 'xlsx';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell } from 'recharts';
import TopologyGraph from './components/TopologyGraph.tsx';
import MonitoringCenter from './components/MonitoringCenter.tsx';
import type { ConfigVersion, Device, Job, AuditEvent, ComplianceFinding, ComplianceRunPoint, ComplianceOverview, ScheduledTask, Script, ConfigTemplate, ConfigSnapshot, DiffLine, User as UserType, ThemeMode, SessionUser, NotificationItem } from './types';
import { PLATFORM_LABELS, getPlatformLabel, getVendorFromPlatform } from './types';
import { sectionHeaderRowClass, sectionToolbarClass, primaryActionBtnClass, secondaryActionBtnClass, darkActionBtnClass, severityBadgeClass, complianceStatusBadgeClass, auditStatusBadgeClass, parseJsonObject } from './components/shared';
import Pagination from './components/Pagination';
import DashboardTab from './pages/DashboardTab';
import ComplianceTab from './pages/ComplianceTab';
import HistoryTab from './pages/HistoryTab';
import UsersTab from './pages/UsersTab';
import InventoryDevicesTab from './pages/InventoryDevicesTab';

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

const buildConnectionTestMessage = (detail: any, errorCode?: string): string => {
  const normalizedDetail = typeof detail === 'string'
    ? detail
    : (detail && typeof detail === 'object' && 'message' in detail ? String(detail.message) : 'Connection failed');

  if (errorCode === LEGACY_SSH_ERROR_CODE) {
    return normalizedDetail || '设备 SSH 算法较旧，平台已尝试兼容，但当前协商仍然失败。';
  }

  return normalizedDetail || 'Connection failed';
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
      return (
        <div className={`w-full h-full ${preset.bgClass} flex items-center justify-center`}>
          <span style={{ fontSize: Math.max(12, fallbackIconSize - 1) }}>{preset.emoji}</span>
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

  const handleDeployTemplate = async () => {
    if (!deployTargetDevice) {
      showToast(t('selectDevice'), 'error');
      return;
    }
    
    const device = devices.find(d => d.id === deployTargetDevice);
    if (!device) return;

    setShowDeployTemplateModal(false);
    setIsTestingConnection(true); // Reuse testing state for loading indicator
    
    try {
      const response = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_id: device.id,
          command: editorContent,
          isConfig: true,
          author: currentUser.username || 'admin',
          actor_id: currentUser.id,
          actor_role: currentUser.role || 'Administrator',
        })
      });
      
      const data = await response.json();
      if (response.ok) {
        showToast(`Template deployed to ${device.hostname}`, 'success');
        const jobsRes = await fetch('/api/jobs');
        if (jobsRes.ok) {
          const updatedJobs = await jobsRes.json();
          setJobs(updatedJobs);
          const newJob = updatedJobs.find((j: any) => j.id === data.jobId);
          if (newJob) setSelectedJob(newJob);
        }
      } else {
        showToast(`Deploy failed: ${data.error}`, 'error');
      }
    } catch (error) {
      showToast(`Execution error: ${error}`, 'error');
    } finally {
      setIsTestingConnection(false);
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

  const handleDiscardChanges = () => {
    const tpl = configTemplates.find(t => t.id === selectedTemplateId);
    if (tpl) {
      setEditorContent(tpl.content);
      showToast(t('changesDiscarded'), 'info');
    }
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.innerWidth < 768);
  const [sidebarPulseHidden, setSidebarPulseHidden] = useState(false);
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
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number, y: number }>>({});
  const topologyRef = React.useRef<HTMLDivElement>(null);
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
    if (activeTab === 'history') return t('auditLogs');
    if (activeTab === 'configuration') return t('configuration');
    if (activeTab === 'compliance') return t('compliance');
    if (activeTab === 'monitoring') return language === 'zh' ? '监控中心' : 'Monitoring Center';
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
        title: n.title,
        message: n.message,
        time: n.time,
        source: n.source,
        severity: n.severity,
        read: !!n.read || !!notificationReadMap[String(n.id)],
      })));
    } catch {
      // ignore polling errors
    }
  }, [currentUser.id, notificationReadMap]);

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
      variables: [],
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

      setShowAddScenarioModal(false);
      setNewScenarioForm({
        name: '', name_zh: '', description: '', description_zh: '',
        category: 'Custom', icon: '🧩', risk: 'medium', platform: 'cisco_ios',
        pre_check: '', execute: '', post_check: '', rollback: '',
      });
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

  useEffect(() => {
    if (devices.length > 0 && Object.keys(nodePositions).length === 0) {
      const coreDevices = devices.filter(d => d.role?.toLowerCase() === 'core');
      const edgeDevices = devices.filter(d => d.role?.toLowerCase() === 'edge');
      const accessDevices = devices.filter(d => d.role?.toLowerCase() === 'access');
      const otherDevices = devices.filter(d => !['core', 'edge', 'access'].includes(d.role?.toLowerCase() || ''));

      const getPos = (index: number, total: number, role: string) => {
        const width = 800;
        const height = 500;
        if (role === 'core') {
          return { x: width / 2 + (index - (total - 1) / 2) * 100, y: height / 2 };
        } else if (role === 'edge') {
          return { x: (index + 1) * (width / (total + 1)), y: 100 };
        } else if (role === 'access') {
          return { x: (index + 1) * (width / (total + 1)), y: height - 100 };
        } else {
          return { x: 50, y: (index + 1) * (height / (total + 1)) };
        }
      };

      const initialPositions: Record<string, { x: number, y: number }> = {};
      coreDevices.forEach((d, i) => initialPositions[d.id] = getPos(i, coreDevices.length, 'core'));
      edgeDevices.forEach((d, i) => initialPositions[d.id] = getPos(i, edgeDevices.length, 'edge'));
      accessDevices.forEach((d, i) => initialPositions[d.id] = getPos(i, accessDevices.length, 'access'));
      otherDevices.forEach((d, i) => initialPositions[d.id] = getPos(i, otherDevices.length, 'other'));
      setNodePositions(initialPositions);
    }
  }, [devices]);

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
  const [showDeployTemplateModal, setShowDeployTemplateModal] = useState(false);
  const [deployTargetDevice, setDeployTargetDevice] = useState<string>('');
  const [newUserForm, setNewUserForm] = useState({ username: '', password: '', role: 'Operator' });
  const [isLoading, setIsLoading] = useState(true);
  const currentUserRecord = users.find(u => u.username === currentUser.username);
  const currentUserLastLogin = currentUserRecord?.lastLogin || 'Never';
  const unreadNotifications = notifications.filter(n => !n.read);
  const unreadNotificationCount = notifications.filter(n => !n.read).length;
  const currentAvatar = currentUser.avatar_url || currentUserRecord?.avatar_url || '';
  const hasQuickTargets = batchMode ? batchDeviceIds.length > 0 : !!selectedDevice;
  const quickMissingRequiredFields = useMemo(() => {
    const vars = quickPlaybookScenario?.variables || [];
    return vars
      .filter((v: any) => v.required && !String(quickPlaybookVars[v.key] ?? '').trim())
      .map((v: any) => (language === 'zh' ? (v.label_zh || v.label || v.key) : (v.label || v.key)));
  }, [quickPlaybookScenario, quickPlaybookVars, language]);
  const customCommandVars = useMemo(() => extractVars(customCommand), [customCommand]);

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
      interface_data: Array.isArray(raw?.interface_data) ? raw.interface_data : [],
      cpu_history: Array.isArray(raw?.cpu_history) ? raw.cpu_history : [],
      memory_history: Array.isArray(raw?.memory_history) ? raw.memory_history : [],
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
  const onlineDeviceCount = devices.filter(device => device.status === 'online').length;
  const runningJobCount = jobs.filter(job => job.status === 'running').length;
  const complianceDeviceCount = devices.filter(device => device.compliance === 'compliant').length;
  const onlineDevicePct = devices.length > 0 ? Math.round((onlineDeviceCount / devices.length) * 100) : 0;
  const compliancePct = devices.length > 0 ? Math.round((complianceDeviceCount / devices.length) * 100) : 0;
  const sidebarHealthLevel = unreadNotificationCount >= 5 || onlineDevicePct < 30 || (devices.length > 0 && compliancePct === 0)
    ? 'critical'
    : unreadNotificationCount > 0 || onlineDevicePct < 60 || compliancePct < 50
      ? 'warning'
      : 'healthy';
  const sidebarHealthLabel = sidebarHealthLevel === 'critical'
    ? t('systemCritical')
    : sidebarHealthLevel === 'warning'
      ? t('systemWarning')
      : t('systemHealthy');
  const sidebarHealthBadgeClass = sidebarHealthLevel === 'critical'
    ? 'border-red-400/30 bg-red-400/12 text-red-200'
    : sidebarHealthLevel === 'warning'
      ? 'border-amber-400/30 bg-amber-400/12 text-amber-200'
      : 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300';
  const sidebarHealthDotClass = sidebarHealthLevel === 'critical'
    ? 'bg-red-300'
    : sidebarHealthLevel === 'warning'
      ? 'bg-amber-300'
      : 'bg-emerald-300';
  const sidebarLastSyncLabel = devicesLastUpdatedAt
    ? new Date(devicesLastUpdatedAt).toLocaleTimeString(language === 'zh' ? 'zh-CN' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : t('noSyncData');

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
  const [monitorLoading, setMonitorLoading] = useState(false);
  const [monitorPageVisible, setMonitorPageVisible] = useState(() => typeof document === 'undefined' ? true : document.visibilityState === 'visible');
  const [monitorDashboardSiteFilter, setMonitorDashboardSiteFilter] = useState('all');
  const [monitorDashboardAlertFilter, setMonitorDashboardAlertFilter] = useState<'all' | 'critical' | 'major'>('all');
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
          setInventoryRows(data);
          setInventoryTotal(data.length);
        } else {
          setInventoryRows(Array.isArray(data.items) ? data.items : []);
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

  const fetchMonitoringAlerts = useCallback(async (signal?: AbortSignal) => {
    const reqEpoch = monitorRequestEpochRef.current;
    try {
      const params = new URLSearchParams({
        page: String(monitorAlertsPage),
        page_size: String(monitorAlertsPageSize),
        severity: monitorAlertsSeverity,
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
  }, [monitorAlertsPage, monitorAlertsPageSize, monitorAlertsSeverity, monitorSelectedDevice?.id]);

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
    if (activeTab === 'monitoring') return;
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
    if (!isAuthenticated || activeTab !== 'monitoring') return;
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

  useEffect(() => {
    setMonitorAlertsPage(1);
  }, [monitorAlertsSeverity, monitorSelectedDevice?.id]);

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
    setShowDetailsModal(true);
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
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; output?: string; errorCode?: string } | null>(null);

  const handleTestConnection = async (deviceToTest: Device | null = selectedDevice) => {
    if (!deviceToTest) return;
    setIsTestingConnection(true);
    setTestResult(null);
    setShowTestResult(true);
    try {
      const response = await fetch('/api/devices/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hostname: deviceToTest.hostname,
          ip_address: deviceToTest.ip_address,
          username: deviceToTest.username,
          password: deviceToTest.password,
          method: deviceToTest.connection_method,
          platform: deviceToTest.platform
        })
      });
      const data = await response.json();
      if (response.ok) {
        setTestResult({ success: true, message: data.message, output: data.output });
      } else {
        setTestResult({
          success: false,
          message: buildConnectionTestMessage(data.detail || data.error, data.error_code),
          output: data.output,
          errorCode: data.error_code,
        });
      }
    } catch (error: any) {
      setTestResult({ success: false, message: error.message || 'Network error' });
    } finally {
      setIsTestingConnection(false);
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
    try {
      const response = await fetch('/api/topology/discover', { method: 'POST' });
      if (response.ok) {
        showToast('Topology discovery started', 'success');
      } else {
        showToast('Failed to start discovery', 'error');
      }
    } catch (error) {
      showToast('Connection error', 'error');
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
        <div className="absolute top-[-15%] right-[-8%] w-[55vw] h-[55vw] rounded-full pointer-events-none" style={{background:'radial-gradient(circle,rgba(0,188,235,0.13) 0%,transparent 65%)'}} />
        <div className="absolute bottom-[-20%] left-[-12%] w-[50vw] h-[50vw] rounded-full pointer-events-none" style={{background:'radial-gradient(circle,rgba(0,80,115,0.22) 0%,transparent 65%)'}} />
        <div className="absolute top-[40%] left-[20%] w-[30vw] h-[30vw] rounded-full pointer-events-none" style={{background:'radial-gradient(circle,rgba(0,40,90,0.18) 0%,transparent 70%)'}} />

        {/* Dot-grid background */}
        <div className="absolute inset-0 opacity-[0.055] pointer-events-none" style={{backgroundImage:'radial-gradient(rgba(0,188,235,0.9) 1px,transparent 1px)',backgroundSize:'36px 36px'}} />

        {/* Animated network topology decoration */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.07] pointer-events-none" xmlns="http://www.w3.org/2000/svg">
          <style>{`
            @keyframes nodePulse { 0%,100%{r:4;opacity:0.6} 50%{r:6;opacity:1} }
            @keyframes ringPulse { 0%,100%{r:10;opacity:0.3} 50%{r:16;opacity:0.1} }
            @keyframes dashFlow { 0%{stroke-dashoffset:0} 100%{stroke-dashoffset:-20} }
            .node-pulse { animation: nodePulse 3s ease-in-out infinite; }
            .ring-pulse { animation: ringPulse 4s ease-in-out infinite; }
            .line-flow { stroke-dasharray: 8 12; animation: dashFlow 2s linear infinite; }
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
          <circle cx="10%" cy="20%" r="4" fill="#00bceb" className="node-pulse" style={{animationDelay:'0s'}} />
          <circle cx="35%" cy="45%" r="5" fill="#00bceb" className="node-pulse" style={{animationDelay:'0.5s'}} />
          <circle cx="65%" cy="30%" r="4" fill="#00bceb" className="node-pulse" style={{animationDelay:'1s'}} />
          <circle cx="88%" cy="55%" r="3" fill="#005073" className="node-pulse" style={{animationDelay:'1.5s'}} />
          <circle cx="50%" cy="70%" r="4" fill="#005073" className="node-pulse" style={{animationDelay:'2s'}} />
          <circle cx="75%" cy="80%" r="3" fill="#00bceb" className="node-pulse" style={{animationDelay:'0.8s'}} />
          <circle cx="20%" cy="85%" r="3" fill="#005073" className="node-pulse" style={{animationDelay:'1.2s'}} />
          <circle cx="88%" cy="15%" r="3" fill="#00bceb" className="node-pulse" style={{animationDelay:'2.5s'}} />
          <circle cx="92%" cy="68%" r="2.5" fill="#005073" className="node-pulse" style={{animationDelay:'1.8s'}} />
          <circle cx="10%" cy="20%" r="10" fill="none" stroke="#00bceb" strokeWidth="0.5" className="ring-pulse" style={{animationDelay:'0s'}} />
          <circle cx="35%" cy="45%" r="12" fill="none" stroke="#00bceb" strokeWidth="0.5" className="ring-pulse" style={{animationDelay:'1s'}} />
          <circle cx="65%" cy="30%" r="9" fill="none" stroke="#00bceb" strokeWidth="0.5" className="ring-pulse" style={{animationDelay:'2s'}} />
          <circle cx="50%" cy="70%" r="11" fill="none" stroke="#005073" strokeWidth="0.5" className="ring-pulse" style={{animationDelay:'1.5s'}} />
        </svg>

        <motion.div
          initial={{ y: 28, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="relative z-10 w-full max-w-[420px]"
        >
          {/* Brand header — above the card */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-[72px] h-[72px] rounded-2xl mb-5" style={{background:'linear-gradient(135deg,#003d57 0%,#00bceb 100%)',boxShadow:'0 0 48px rgba(0,188,235,0.35),0 0 0 1px rgba(0,188,235,0.2)'}}>
              <Activity size={36} className="text-white" />
            </div>
            <h1 className={`text-[28px] font-black tracking-tight leading-none ${isDark ? 'text-white' : 'text-[#0B2A3C]'}`}>NetPilot</h1>
            <p className="text-[#00bceb] text-[10px] font-bold uppercase tracking-[0.28em] mt-2 opacity-80">Network Operations Command Center</p>
          </div>

          {/* Glass card */}
          <div className="rounded-3xl overflow-hidden" style={{
            background: isDark ? 'rgba(255,255,255,0.035)' : 'rgba(255,255,255,0.82)',
            backdropFilter:'blur(24px)',
            border: isDark ? '1px solid rgba(0,188,235,0.18)' : '1px solid rgba(0,80,115,0.18)',
            boxShadow: isDark
              ? '0 0 80px rgba(0,188,235,0.07),0 24px 48px rgba(0,0,0,0.5)'
              : '0 26px 48px rgba(0,45,85,0.22), 0 0 0 1px rgba(255,255,255,0.45)'
          }}>
            {/* Top glow line */}
            <div className="h-px" style={{background:'linear-gradient(90deg,transparent 0%,rgba(0,188,235,0.7) 50%,transparent 100%)'}} />

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
                  <label className="text-[10px] font-bold uppercase tracking-[0.18em] ml-0.5" style={{color: isDark ? 'rgba(0,188,235,0.72)' : 'rgba(0,114,152,0.88)'}}>{t('username')}</label>
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
                      className={`w-full pl-11 pr-4 py-3.5 rounded-xl text-sm outline-none transition-all ${isDark ? 'text-white placeholder-white/20' : 'text-[#0B2A3C] placeholder-[#49728A]/45'}`}
                      style={{
                        background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.74)',
                        border: loginError ? '1.5px solid rgba(239,68,68,0.7)' : (isDark ? '1.5px solid rgba(255,255,255,0.08)' : '1.5px solid rgba(0,80,115,0.22)')
                      }}
                      onFocus={e => {
                        e.currentTarget.style.border = isDark ? '1.5px solid rgba(0,188,235,0.6)' : '1.5px solid rgba(0,166,212,0.88)';
                        e.currentTarget.style.background = isDark ? 'rgba(0,188,235,0.06)' : 'rgba(255,255,255,0.92)';
                      }}
                      onBlur={e => {
                        e.currentTarget.style.border = loginError ? '1.5px solid rgba(239,68,68,0.7)' : (isDark ? '1.5px solid rgba(255,255,255,0.08)' : '1.5px solid rgba(0,80,115,0.22)');
                        e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.74)';
                      }}
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-[0.18em] ml-0.5" style={{color: isDark ? 'rgba(0,188,235,0.72)' : 'rgba(0,114,152,0.88)'}}>{t('password')}</label>
                  <div className="relative">
                    <div className={`absolute left-4 top-1/2 -translate-y-1/2 ${isDark ? 'text-white/20' : 'text-[#0A4E70]/45'}`}>
                      <ShieldCheck size={16} />
                    </div>
                    <input
                      type={showLoginPwd ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={loginForm.password}
                      onChange={(e) => { setLoginForm({ ...loginForm, password: e.target.value }); setLoginError(null); }}
                      className={`w-full pl-11 pr-12 py-3.5 rounded-xl text-sm outline-none transition-all ${isDark ? 'text-white placeholder-white/20' : 'text-[#0B2A3C] placeholder-[#49728A]/45'}`}
                      style={{
                        background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.74)',
                        border: loginError ? '1.5px solid rgba(239,68,68,0.7)' : (isDark ? '1.5px solid rgba(255,255,255,0.08)' : '1.5px solid rgba(0,80,115,0.22)')
                      }}
                      onFocus={e => {
                        e.currentTarget.style.border = isDark ? '1.5px solid rgba(0,188,235,0.6)' : '1.5px solid rgba(0,166,212,0.88)';
                        e.currentTarget.style.background = isDark ? 'rgba(0,188,235,0.06)' : 'rgba(255,255,255,0.92)';
                      }}
                      onBlur={e => {
                        e.currentTarget.style.border = loginError ? '1.5px solid rgba(239,68,68,0.7)' : (isDark ? '1.5px solid rgba(255,255,255,0.08)' : '1.5px solid rgba(0,80,115,0.22)');
                        e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.74)';
                      }}
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
                    className="w-full py-3.5 rounded-xl font-bold text-xs uppercase tracking-[0.18em] text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    style={{background: loginError ? 'rgba(239,68,68,0.8)' : 'linear-gradient(135deg,#00527a 0%,#00bceb 100%)',boxShadow: loginError ? '0 0 24px rgba(239,68,68,0.3)' : '0 0 32px rgba(0,188,235,0.25),0 4px 16px rgba(0,0,0,0.4)'}}
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
              <div className="mt-8 pt-6" style={{borderTop: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,80,115,0.14)'}}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" style={{boxShadow:'0 0 6px rgba(52,211,153,0.8)'}} />
                    <span className="text-[10px] font-semibold uppercase tracking-wider" style={{color: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(9,47,69,0.52)'}}>{t('systemOnline')}</span>
                  </div>
                  <span className="text-[10px] font-mono" style={{color: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(9,47,69,0.4)'}}>NOC v2.0</span>
                </div>
                <p className="mt-2 text-[10px] text-center" style={{color: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(9,47,69,0.46)'}}>
                  {t('copyright')} {new Date().getFullYear()} {t('allRightsReserved')}
                </p>
              </div>
            </div>

            {/* Bottom glow line */}
            <div className="h-px" style={{background:'linear-gradient(90deg,transparent 0%,rgba(0,80,115,0.5) 50%,transparent 100%)'}} />
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

  // Quick query — read-only command, no history saved
  const runQuickQuery = async (label: string, commands: string) => {
    const device = selectedDevice || (batchMode && batchDeviceIds.length === 1 ? devices.find(d => d.id === batchDeviceIds[0]) : null);
    if (!device) {
      showToast(language === 'zh' ? '请先选择一台设备' : 'Select a device first', 'error');
      return;
    }
    setQuickQueryLabel(label);
    setQuickQueryOutput('');
    setQuickQueryRunning(true);
    try {
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
    return text.replace(/\{\{(\w+)\}\}/g, (_, k) => scriptVars[k] ?? `{{${k}}}`);
  }

  // Extract variable names from {{VAR}} in a given text
  function extractVars(text: string): string[] {
    const matches = [...text.matchAll(/\{\{(\w+)\}\}/g)];
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

  return (
    <AppRuntimeBoundary language={language}>
      <div className="app-shell flex h-screen text-[#141414] font-sans overflow-hidden">
      {/* Mobile sidebar backdrop */}
      {isMobile && !sidebarCollapsed && (
        <div
          className="fixed inset-0 bg-black/50 z-25 md:hidden"
          style={{ zIndex: 25 }}
          onClick={() => setSidebarCollapsed(true)}
        />
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

        <nav className="sidebar-nav-scroll flex-1 p-4 space-y-0.5 mt-2 overflow-y-auto">
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: t('dashboard') },
            { id: 'monitoring', icon: TrendingUp, label: language === 'zh' ? '监控中心' : 'Monitoring' },
            { id: 'topology', icon: Globe, label: 'Topology' },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === item.id
                  ? 'bg-[#00bceb] text-white shadow-lg shadow-[#00bceb]/20'
                  : 'text-white/60 hover:bg-white/5 hover:text-white'
              }`}
            >
              <item.icon size={17} />
              {item.label}
            </button>
          ))}

          {/* ── Inventory collapsible group ── */}
          <div>
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
                  { path: 'inventory/interfaces', icon: Activity, label: t('interfaceMonitoring') },
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

          {/* ── Automation collapsible group ── */}
          <div className="pt-2">
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
          <div className="pt-2">
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
              configGroupOpen ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'
            }`}>
              <div className="pl-3 pr-1 pt-0.5 pb-1 space-y-0.5">
                {([
                  { path: 'config/backup',   icon: Download,  label: t('backupHistory') },
                  { path: 'config/diff',     icon: FileText,  label: t('diffCompare') },
                  { path: 'config/search',   icon: Search,    label: t('configSearchTab') },
                  { path: 'config/schedule', icon: Clock,     label: t('scheduledBackup') },
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

          {[
            { id: 'configuration', icon: Settings,    label: t('configuration') },
            { id: 'compliance',    icon: ShieldCheck,  label: t('compliance') },
            { id: 'history',       icon: History,      label: t('auditLogs') },
            { id: 'users',         icon: Globe,        label: t('userManagement') },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === item.id
                  ? 'bg-[#00bceb] text-white shadow-lg shadow-[#00bceb]/20'
                  : 'text-white/60 hover:bg-white/5 hover:text-white'
              }`}
            >
              <item.icon size={17} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className={`p-4 pt-0 transition-all duration-200 ${sidebarPulseHidden ? 'hidden' : ''}`}>
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] shadow-[0_18px_40px_rgba(0,0,0,0.18)] overflow-hidden">
            <div className="px-4 py-3 border-b border-white/8 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold tracking-wide text-white/92">{t('networkPulse')}</p>
                <p className="text-[10px] text-white/42">{t('networkPulseSub')}</p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold ${sidebarHealthBadgeClass} ${sidebarHealthLevel === 'critical' ? 'animate-pulse' : ''}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${sidebarHealthDotClass}`} />
                  {sidebarHealthLabel}
                </span>
                <button
                  onClick={() => setSidebarPulseHidden(true)}
                  title={language === 'zh' ? '隐藏面板' : 'Hide panel'}
                  className="p-1 rounded-md text-white/25 hover:text-white/70 hover:bg-white/10 transition-all"
                >
                  <X size={12} />
                </button>
              </div>
            </div>

            <div className="px-2 py-2">
              <button
                onClick={() => {
                  setInventoryGroupOpen(true);
                  navTo('/inventory/devices');
                }}
                className="w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-left transition-all hover:bg-white/6"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-8 h-8 rounded-xl bg-emerald-400/12 text-emerald-300 flex items-center justify-center">
                    <CheckCircle size={15} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">{t('devicesOnlineShort')}</p>
                    <p className="text-sm font-semibold text-white truncate">{onlineDeviceCount}/{devices.length}</p>
                  </div>
                </div>
                <ChevronRight size={14} className="text-white/22" />
              </button>

              <button
                onClick={() => setActiveTab('monitoring')}
                className="w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-left transition-all hover:bg-white/6"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-8 h-8 rounded-xl bg-amber-400/12 text-amber-300 flex items-center justify-center">
                    <AlertTriangle size={15} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">{t('activeAlertsShort')}</p>
                    <p className="text-sm font-semibold text-white truncate">{unreadNotificationCount}</p>
                  </div>
                </div>
                <ChevronRight size={14} className="text-white/22" />
              </button>

              <button
                onClick={() => {
                  setAutomationGroupOpen(true);
                  navTo('/automation/history');
                }}
                className="w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-left transition-all hover:bg-white/6"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-8 h-8 rounded-xl bg-sky-400/12 text-sky-300 flex items-center justify-center">
                    <Play size={15} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">{t('runningTasksShort')}</p>
                    <p className="text-sm font-semibold text-white truncate">{runningJobCount}</p>
                  </div>
                </div>
                <ChevronRight size={14} className="text-white/22" />
              </button>
            </div>

            <div className="px-4 py-3 border-t border-white/8 flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-2 text-white/45">
                <Clock size={13} />
                <span>{t('lastSyncShort')}</span>
              </div>
              <span className="font-medium text-white/78">{sidebarLastSyncLabel}</span>
            </div>
          </div>
        </div>
        {sidebarPulseHidden && (
          <div className="p-4 pt-0">
            <button
              onClick={() => setSidebarPulseHidden(false)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-white/8 text-white/35 hover:text-white/60 hover:bg-white/5 transition-all text-[11px]"
            >
              <Activity size={13} />
              <span>{language === 'zh' ? '显示网络状态' : 'Show Network Pulse'}</span>
            </button>
          </div>
        )}

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
              language={language}
              t={t}
              setActiveTab={setActiveTab}
              navigate={navigate}
            />
          )}

          {activeTab === 'monitoring' && (
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
              monitorLoading={monitorLoading}
              monitorPageVisible={monitorPageVisible}
              monitorDashboardSiteFilter={monitorDashboardSiteFilter}
              setMonitorDashboardSiteFilter={setMonitorDashboardSiteFilter}
              monitorDashboardAlertFilter={monitorDashboardAlertFilter}
              setMonitorDashboardAlertFilter={setMonitorDashboardAlertFilter}
              fetchMonitoringOverview={() => fetchMonitoringOverview(true)}
              fetchMonitoringAlerts={fetchMonitoringAlerts}
              fetchMonitoringRealtime={fetchMonitoringRealtime}
              setMonitorRealtime={setMonitorRealtime}
              showToast={showToast}
            />
          )}

          {activeTab === 'inventory' && inventorySubPage === 'devices' && (
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
              setShowAddModal={setShowAddModal}
              setShowEditModal={setShowEditModal}
              setEditingDevice={setEditingDevice}
              setEditForm={setEditForm}
              setSelectedDevice={setSelectedDevice}
              setActiveTab={setActiveTab}
              language={language}
              t={t}
            />
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
                                <div className="flex-1 h-1.5 bg-black/5 rounded-full overflow-hidden"><div className="h-full rounded-full bg-blue-500" style={{width: `${Math.min(item.bwIn, 100)}%`}} /></div>
                                <span className="text-[10px] font-mono text-blue-600 w-12 text-right">{item.bwIn.toFixed(1)}%</span>
                              </div>
                              <div className="flex items-center gap-1 flex-1">
                                <span className="text-[9px] text-orange-500 w-7 flex-shrink-0">OUT</span>
                                <div className="flex-1 h-1.5 bg-black/5 rounded-full overflow-hidden"><div className="h-full rounded-full bg-orange-500" style={{width: `${Math.min(item.bwOut, 100)}%`}} /></div>
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
                      className="px-3 py-2 bg-black/[0.02] border border-black/5 rounded-xl text-xs outline-none cursor-pointer"
                    >
                      <option value="name">{language === 'zh' ? '按主机名排序' : 'Sort by Name'}</option>
                      <option value="downCount">{language === 'zh' ? '按DOWN口数↓' : 'Sort by DOWN Count'}</option>
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
                                                  <div className="w-10 h-1 bg-black/5 rounded-full overflow-hidden"><div className="h-full rounded-full bg-blue-500" style={{width: `${Math.min(bwIn || 0, 100)}%`}} /></div>
                                                  <span className={`font-mono text-[9px] w-10 text-right ${(bwIn || 0) > 80 ? 'text-red-600' : 'text-blue-600'}`}>{(bwIn || 0).toFixed(1)}%</span>
                                                </div>
                                                <div className="flex items-center justify-end gap-1">
                                                  <span className="text-[8px] text-orange-500 w-5 text-right">OUT</span>
                                                  <div className="w-10 h-1 bg-black/5 rounded-full overflow-hidden"><div className="h-full rounded-full bg-orange-500" style={{width: `${Math.min(bwOut || 0, 100)}%`}} /></div>
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
                                        className="px-2 py-1 text-[10px] border border-black/10 rounded-md hover:bg-black/5 disabled:opacity-30 transition-all"
                                      >
                                        <ChevronLeft size={12} />
                                      </button>
                                      <button
                                        disabled={safeInnerPage >= innerTotalPages}
                                        onClick={() => setIntfPageMap(prev => ({ ...prev, [device.id]: safeInnerPage + 1 }))}
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
                          className="p-1.5 rounded-lg border border-black/5 hover:bg-black/5 disabled:opacity-30 transition-all"
                        >
                          <ChevronLeft size={16} />
                        </button>
                        <button
                          disabled={safePage >= totalDevPages}
                          onClick={() => setIntfDevicePage(safePage + 1)}
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
                  <h2 className="text-2xl font-medium tracking-tight">Network Topology</h2>
                  <p className="text-sm text-black/40">Visualizing device interconnections via LLDP/CDP neighbor discovery</p>
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={handleTriggerDiscovery}
                    className={secondaryActionBtnClass}
                  >
                    <RotateCcw size={16} />
                    Refresh Discovery
                  </button>
                  <button 
                    onClick={handleExportMap}
                    className={darkActionBtnClass}
                  >
                    <Download size={16} />
                    Export Map
                  </button>
                </div>
              </div>
              
              <div className="flex-1 bg-white rounded-2xl border border-black/5 shadow-sm flex items-center justify-center relative overflow-hidden" ref={topologyRef}>
                <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
                
                {/* Simulated Topology Graph */}
                <div className="relative w-full h-full flex items-center justify-center">
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="relative w-full h-full"
                    >
                      {/* Dynamic Topology Graph */}
                      <TopologyGraph 
                        devices={devices} 
                        links={topologyLinks} 
                        onNodeClick={handleShowDetails} 
                      />
                    </motion.div>

                  <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-black/5 backdrop-blur-md border border-black/5 px-4 py-2 rounded-full flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                      <span className="text-[10px] font-bold uppercase text-black/40">Online</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                      <span className="text-[10px] font-bold uppercase text-black/40">Critical</span>
                    </div>
                    <div className="w-px h-3 bg-black/10"></div>
                    <span className="text-[10px] font-bold uppercase text-black/60">{devices.length} Nodes Discovered</span>
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
                            <div className="flex-1 flex flex-col overflow-hidden rounded-b-2xl" style={{ background: 'linear-gradient(180deg, #0d1117 0%, #151b23 100%)' }}>
                              {/* Terminal Title Bar */}
                              <div className="shrink-0 flex items-center justify-between px-4 py-2.5" style={{ background: 'linear-gradient(90deg, #1c2030 0%, #161b22 100%)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
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
                                </div>
                                <div className="flex items-center gap-0.5 shrink-0">
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
                                    onClick={() => { setQuickQueryOutput(''); setQuickQueryLabel(''); }}
                                    className="text-white/25 hover:text-white/60 p-2 rounded-lg hover:bg-white/[0.06] transition-all"
                                    title={isZh ? '关闭' : 'Close'}
                                  >
                                    <X size={13} />
                                  </button>
                                </div>
                              </div>
                              {/* Terminal Output — fills remaining space */}
                              <div className="flex-1 overflow-auto terminal-scroll">
                                {quickQueryRunning ? (
                                  <div className="flex flex-col items-center justify-center py-16 gap-4">
                                    <div className="w-10 h-10 rounded-full border-2 border-[#00bceb]/20 border-t-[#00bceb] animate-spin" />
                                    <span className="text-xs text-white/25 font-mono">{isZh ? '正在查询...' : 'Querying...'}</span>
                                  </div>
                                ) : (
                                  <div className="p-5">
                                    <div className="flex items-start gap-2 mb-3 pb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                      <span className="text-emerald-400/60 font-mono font-bold text-[11px] mt-0.5 select-none shrink-0">❯</span>
                                      <code className="text-[11px] font-mono text-emerald-400/40 leading-relaxed whitespace-pre-wrap">{quickQueryLabel}</code>
                                    </div>
                                    <pre className="text-[13px] font-mono text-[#e6edf3] leading-[1.75] whitespace-pre-wrap break-all select-text">{quickQueryOutput}</pre>
                                  </div>
                                )}
                              </div>
                            </div>
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
                              const presets: { icon: string; label: string; labelEn: string; cmds: string; group: string }[] = [
                                { icon: '📡', label: '接口状态', labelEn: 'Interfaces', group: 'net', cmds: isCisco ? 'show ip interface brief' : isHuawei ? 'display interface brief' : isJuniper ? 'show interfaces terse' : 'show ip interface brief' },
                                { icon: '📋', label: 'ARP表', labelEn: 'ARP Table', group: 'net', cmds: isCisco ? 'show arp' : isHuawei ? 'display arp' : isJuniper ? 'show arp' : 'show arp' },
                                { icon: '🏷️', label: 'MAC表', labelEn: 'MAC Table', group: 'net', cmds: isCisco ? 'show mac address-table' : isHuawei ? 'display mac-address' : isJuniper ? 'show ethernet-switching table' : 'show mac address-table' },
                                { icon: '📊', label: 'VLAN', labelEn: 'VLAN', group: 'net', cmds: isCisco ? 'show vlan brief' : isHuawei ? 'display vlan' : isJuniper ? 'show vlans' : 'show vlan brief' },
                                { icon: '📌', label: 'LLDP邻居', labelEn: 'LLDP', group: 'net', cmds: isCisco ? 'show lldp neighbors' : isHuawei ? 'display lldp neighbor brief' : isJuniper ? 'show lldp neighbors' : 'show lldp neighbors' },
                                { icon: '🗺️', label: '路由表', labelEn: 'Routes', group: 'route', cmds: isCisco ? 'show ip route' : isHuawei ? 'display ip routing-table' : isJuniper ? 'show route' : 'show ip route' },
                                { icon: '🔗', label: 'BGP邻居', labelEn: 'BGP Peers', group: 'route', cmds: isCisco ? 'show bgp summary' : isHuawei ? 'display bgp peer' : isJuniper ? 'show bgp summary' : 'show bgp summary' },
                                { icon: '🔍', label: 'OSPF邻居', labelEn: 'OSPF Nbrs', group: 'route', cmds: isCisco ? 'show ip ospf neighbor' : isHuawei ? 'display ospf peer brief' : isJuniper ? 'show ospf neighbor' : 'show ip ospf neighbor' },
                                { icon: '🏥', label: '设备信息', labelEn: 'Version', group: 'sys', cmds: isCisco ? 'show version' : isHuawei ? 'display version' : isJuniper ? 'show version' : 'show version' },
                                { icon: '📝', label: '日志', labelEn: 'Logs', group: 'sys', cmds: isCisco ? 'show logging | tail 30' : isHuawei ? 'display logbuffer last 30' : isJuniper ? 'show log messages | last 30' : 'show logging | tail 30' },
                                { icon: '⏱️', label: '运行时间', labelEn: 'Uptime', group: 'sys', cmds: isCisco ? 'show uptime' : isHuawei ? 'display clock\ndisplay version | include uptime' : isJuniper ? 'show system uptime' : 'show uptime' },
                                { icon: '💾', label: '运行配置', labelEn: 'Running Config', group: 'sys', cmds: isCisco ? 'show running-config' : isHuawei ? 'display current-configuration' : isJuniper ? 'show configuration' : 'show running-config' },
                              ];
                              const userSavedCmds: { icon: string; label: string; labelEn: string; cmds: string }[] = (() => {
                                try { return JSON.parse(localStorage.getItem('quickQuerySaved') || '[]'); } catch { return []; }
                              })();
                              const allCmds = [...presets, ...userSavedCmds.map(c => ({ ...c, group: 'custom' }))];
                              const hasDevice = !!(selectedDevice || (batchMode && batchDeviceIds.length === 1));
                              const deviceName = selectedDevice?.hostname || devices.find(d => d.id === batchDeviceIds[0])?.hostname || '';
                              const activeCmd = allCmds.find(c => (isZh ? c.label : c.labelEn) === quickQueryLabel);

                              // ═══════════════════════════════════════════
                              // ── CATEGORIZED QUERY GRID MODE ──
                              // ═══════════════════════════════════════════
                              const categoryGroups = [
                                { key: 'net', label: isZh ? '🌐 网络基础' : '🌐 Network', accent: '#3b82f6' },
                                { key: 'route', label: isZh ? '🔀 路由协议' : '🔀 Routing', accent: '#f59e0b' },
                                { key: 'sys', label: isZh ? '🖥️ 系统运维' : '🖥️ System', accent: '#10b981' },
                                ...(userSavedCmds.length > 0 ? [{ key: 'custom', label: isZh ? '⭐ 自定义' : '⭐ Custom', accent: '#a855f7' }] : []),
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
                                              <div className="h-3 w-0.5 rounded-full" style={{ background: grp.accent }} />
                                              <span className="text-[10px] font-bold tracking-wide" style={{ color: grp.accent }}>{grp.label}</span>
                                              <div className="flex-1 h-px" style={{ background: `linear-gradient(90deg, ${grp.accent}18, transparent)` }} />
                                            </div>
                                            <div className="grid grid-cols-4 gap-2">
                                              {items.map((cmd, i) => (
                                                <button key={`${grp.key}-${i}`}
                                                  disabled={quickQueryRunning}
                                                  onClick={() => runQuickQuery(isZh ? cmd.label : cmd.labelEn, cmd.cmds)}
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
                    onClick={() => setShowAddScenarioModal(true)}
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
                        className="px-2 py-1 text-[10px] rounded border border-black/10 disabled:opacity-30"
                      >
                        <ChevronLeft size={10} />
                      </button>
                      <span className="text-[10px] text-black/40">{playbookHistoryPage} / {Math.ceil(playbookHistoryTotal / 20)}</span>
                      <button
                        disabled={playbookHistoryPage * 20 >= playbookHistoryTotal}
                        onClick={() => { const p = playbookHistoryPage + 1; setPlaybookHistoryPage(p); loadPlaybookHistory(p); }}
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
                                  className="px-2 py-1 text-xs rounded border border-black/10 disabled:opacity-30"
                                ><ChevronLeft size={12} /></button>
                                <span className="text-xs text-black/40 px-2 py-1">{selectedExecDevicesPage} / {Math.ceil(selectedExecDevicesTotal / 20)}</span>
                                <button
                                  disabled={selectedExecDevicesPage * 20 >= selectedExecDevicesTotal}
                                  onClick={() => { const p = selectedExecDevicesPage + 1; setSelectedExecDevicesPage(p); loadExecDevices(exec.id, p, selectedExecDevicesStatusFilter); }}
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
                            className="text-[10px] border border-black/10 rounded-lg px-2 py-1 outline-none bg-white">
                            <option value={30}>30 {t('retentionDays')}</option>
                            <option value={90}>90 {t('retentionDays')}</option>
                            <option value={180}>180 {t('retentionDays')}</option>
                            <option value={365}>1 {language === 'zh' ? '年' : 'yr'} (365d)</option>
                            <option value={730}>2 {language === 'zh' ? '年' : 'yr'} (730d)</option>
                          </select>
                          <button onClick={() => loadConfigSnapshots(configCenterDevice?.id, { requireFilter: true })}
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
                        className={`relative w-11 h-6 rounded-full transition-colors ${scheduleEnabled ? 'bg-[#00bceb]' : 'bg-black/10'}`}>
                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${scheduleEnabled ? 'translate-x-5' : ''}`} />
                      </button>
                    </div>
                    {/* Time */}
                    <div className={`flex items-end gap-3 transition-opacity ${scheduleEnabled ? '' : 'opacity-40 pointer-events-none'}`}>
                      <div>
                        <label className="text-[10px] font-bold uppercase text-black/30 block mb-1">{t('scheduleHour')}</label>
                        <select value={scheduleHour} onChange={e => setScheduleHour(Number(e.target.value))}
                          className="px-3 py-2 border border-black/10 rounded-xl text-sm outline-none bg-white w-28">
                          {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{String(i).padStart(2,'0')}:00</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase text-black/30 block mb-1">{t('scheduleMinute')}</label>
                        <select value={scheduleMinute} onChange={e => setScheduleMinute(Number(e.target.value))}
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
            <div className="h-full flex flex-col space-y-8">
              <div className={sectionHeaderRowClass}>
                <div>
                  <h2 className="text-2xl font-medium tracking-tight">{t('configManagement')}</h2>
                  <p className="text-sm text-black/40">{t('manageTemplates')}</p>
                </div>
                <div className="flex gap-3">
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

              <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-8 overflow-hidden">
                <div className="md:col-span-4 flex flex-col gap-6 overflow-auto md:pr-2">
                  {/* Usage Guide */}
                  <div className="bg-emerald-50 rounded-2xl border border-emerald-100 p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                        <ShieldCheck size={18} />
                      </div>
                      <h3 className="text-sm font-semibold text-emerald-900">{t('usageGuide')}</h3>
                    </div>
                    <ul className="space-y-2 text-xs text-emerald-800/70 list-disc list-inside">
                      <li>{t('guideStep1')}</li>
                      <li>{t('guideStep2')}</li>
                      <li>{t('guideStep3')}</li>
                    </ul>
                  </div>

                  <div className="bg-white rounded-2xl border border-black/5 p-6 shadow-sm">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-black/40 mb-4">{t('templates')}</h3>
                    <div className="space-y-6">
                      {Object.entries(
                        configTemplates.reduce((acc, tpl) => {
                          const vendor = tpl.vendor || 'Custom';
                          if (!acc[vendor]) acc[vendor] = [];
                          acc[vendor].push(tpl);
                          return acc;
                        }, {} as Record<string, typeof configTemplates>)
                      ).map(([vendor, templates]) => (
                        <div key={vendor} className="space-y-2">
                          <h4 className="text-[10px] font-bold uppercase tracking-widest text-black/30 px-1">{vendor}</h4>
                          <div className="space-y-1">
                            {(templates as typeof configTemplates).map((tpl) => (
                              <button 
                                key={tpl.id} 
                                onClick={() => setSelectedTemplateId(tpl.id)}
                                className={`w-full p-3 rounded-lg text-left transition-all border ${
                                  selectedTemplateId === tpl.id 
                                    ? 'bg-black text-white border-black shadow-md' 
                                    : 'hover:bg-black/5 text-black/60 hover:text-black border-transparent hover:border-black/5'
                                } group`}
                              >
                                <div className="flex justify-between items-center">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium">{tpl.name}</span>
                                    {tpl.category === 'official' && (
                                      <span className="text-[8px] bg-blue-100 text-blue-600 px-1 rounded font-bold uppercase">{t('official')}</span>
                                    )}
                                  </div>
                                  <span className={`text-[10px] font-bold uppercase ${selectedTemplateId === tpl.id ? 'text-white/40' : 'text-black/30'}`}>
                                    {tpl.type}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center mt-1">
                                  <p className={`text-[10px] ${selectedTemplateId === tpl.id ? 'text-white/40' : 'text-black/40'}`}>
                                    Last used: {tpl.lastUsed}
                                  </p>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-black/5 p-6 shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-black/40">{t('globalVars')}</h3>
                      <button 
                        onClick={handleAddVar}
                        className="text-[10px] text-blue-600 font-bold hover:underline uppercase"
                      >
                        {t('addVar')}
                      </button>
                    </div>
                    <div className="space-y-3">
                      {globalVars.map((v, i) => (
                        <div key={v.id || i} className="group relative flex justify-between items-center py-2 border-b border-black/5">
                          <div className="flex flex-col">
                            <span className="text-xs font-mono text-black/60">{v.key}</span>
                            <span className="text-[10px] text-black/30 font-mono">{'{{ ' + v.key + ' }}'}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-medium">{v.value}</span>
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

                  <div className="md:col-span-8 bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden flex flex-col">
                    <div className="p-6 border-b border-black/5 bg-black/[0.01] flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-black/5 rounded-lg text-black/60">
                          <Settings size={18} />
                        </div>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <input 
                              type="text"
                              value={configTemplates.find(t => t.id === selectedTemplateId)?.name || ''}
                              onChange={(e) => {
                                const newName = e.target.value;
                                setConfigTemplates(prev => prev.map(t => 
                                  t.id === selectedTemplateId ? { ...t, name: newName } : t
                                ));
                              }}
                              className="bg-black/5 px-2 py-0.5 rounded font-medium border border-black/5 focus:border-black/20 outline-none transition-all min-w-[200px]"
                              placeholder="Template Name"
                            />
                            <select 
                              value={configTemplates.find(t => t.id === selectedTemplateId)?.type || 'Jinja2'}
                              onChange={(e) => {
                                const newType = e.target.value as 'Jinja2' | 'YAML';
                                setConfigTemplates(prev => prev.map(t => 
                                  t.id === selectedTemplateId ? { ...t, type: newType } : t
                                ));
                              }}
                              className="bg-black/5 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded outline-none"
                            >
                              <option value="Jinja2">Jinja2</option>
                              <option value="YAML">YAML</option>
                            </select>
                          </div>
                          <p className="text-[10px] text-black/40 uppercase tracking-widest">
                            {t('editorMode')}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={handleDiscardChanges}
                          className="px-3 py-1.5 text-xs font-medium text-black/40 hover:text-black"
                        >
                          {t('discard')}
                        </button>
                        <button 
                          onClick={handleSaveTemplate}
                          className="px-4 py-1.5 bg-black text-white rounded-lg text-xs font-medium hover:bg-black/80 transition-all"
                        >
                          {t('saveChanges')}
                        </button>
                        <button 
                          onClick={() => setShowDeployTemplateModal(true)}
                          className="px-4 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition-all shadow-sm"
                        >
                          {t('deploy')}
                        </button>
                      </div>
                    </div>
                    <div className="flex-1 flex bg-[#1E1E1E] overflow-hidden">
                      <div className="w-12 py-6 bg-black/20 text-white/20 select-none text-right pr-3 font-mono text-sm leading-6">
                        {editorContent.split('\n').map((_, i) => <div key={i}>{i + 1}</div>)}
                      </div>
                      <textarea
                        value={editorContent}
                        onChange={(e) => setEditorContent(e.target.value)}
                        className="flex-1 p-6 bg-transparent font-mono text-sm text-[#D4D4D4] outline-none resize-none leading-6"
                        spellCheck={false}
                      />
                    </div>
                  </div>
              </div>
            </div>
          )}

          {activeTab === 'users' && (
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
          )}
          {activeTab === 'history' && (
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
                          ? '查看模式：命令在 Exec 模式下执行，适用于 show、display、ping、tracert 等只读命令。'
                          : 'Query mode: commands run in exec mode. Use for show, display, ping, tracert — read-only, no config changes.')
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
              <button onClick={() => setShowAddScenarioModal(false)} className={resolvedTheme === 'dark' ? 'text-white/50 hover:text-white' : 'text-black/40 hover:text-black'} title="Close">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4 max-h-[70vh] overflow-auto">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-black/45">Name</label>
                <input value={newScenarioForm.name} onChange={(e) => setNewScenarioForm(prev => ({ ...prev, name: e.target.value }))} className="mt-1 w-full px-3 py-2 border border-black/10 rounded-xl text-sm outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-black/45">Name (ZH)</label>
                <input value={newScenarioForm.name_zh} onChange={(e) => setNewScenarioForm(prev => ({ ...prev, name_zh: e.target.value }))} className="mt-1 w-full px-3 py-2 border border-black/10 rounded-xl text-sm outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-black/45">Description</label>
                <input value={newScenarioForm.description} onChange={(e) => setNewScenarioForm(prev => ({ ...prev, description: e.target.value }))} className="mt-1 w-full px-3 py-2 border border-black/10 rounded-xl text-sm outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-black/45">Description (ZH)</label>
                <input value={newScenarioForm.description_zh} onChange={(e) => setNewScenarioForm(prev => ({ ...prev, description_zh: e.target.value }))} className="mt-1 w-full px-3 py-2 border border-black/10 rounded-xl text-sm outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-black/45">Category</label>
                <input value={newScenarioForm.category} onChange={(e) => setNewScenarioForm(prev => ({ ...prev, category: e.target.value }))} className="mt-1 w-full px-3 py-2 border border-black/10 rounded-xl text-sm outline-none" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-black/45">Icon</label>
                  <input value={newScenarioForm.icon} onChange={(e) => setNewScenarioForm(prev => ({ ...prev, icon: e.target.value }))} className="mt-1 w-full px-3 py-2 border border-black/10 rounded-xl text-sm outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-black/45">Risk</label>
                  <select value={newScenarioForm.risk} onChange={(e) => setNewScenarioForm(prev => ({ ...prev, risk: e.target.value }))} className="mt-1 w-full px-3 py-2 border border-black/10 rounded-xl text-sm outline-none bg-white">
                    <option value="low">low</option>
                    <option value="medium">medium</option>
                    <option value="high">high</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-black/45">Platform</label>
                  <select value={newScenarioForm.platform} onChange={(e) => setNewScenarioForm(prev => ({ ...prev, platform: e.target.value }))} className="mt-1 w-full px-3 py-2 border border-black/10 rounded-xl text-sm outline-none bg-white">
                    {Object.keys(platforms).map(pk => <option key={pk} value={pk}>{pk}</option>)}
                  </select>
                </div>
              </div>
              <div className="col-span-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-black/45">Pre-Check Commands (one per line)</label>
                <textarea value={newScenarioForm.pre_check} onChange={(e) => setNewScenarioForm(prev => ({ ...prev, pre_check: e.target.value }))} className="mt-1 w-full h-20 px-3 py-2 border border-black/10 rounded-xl text-xs font-mono outline-none" />
              </div>
              <div className="col-span-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-black/45">Execute Commands (one per line)</label>
                <textarea value={newScenarioForm.execute} onChange={(e) => setNewScenarioForm(prev => ({ ...prev, execute: e.target.value }))} className="mt-1 w-full h-24 px-3 py-2 border border-black/10 rounded-xl text-xs font-mono outline-none" />
              </div>
              <div className="col-span-2 grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-black/45">Post-Check Commands</label>
                  <textarea value={newScenarioForm.post_check} onChange={(e) => setNewScenarioForm(prev => ({ ...prev, post_check: e.target.value }))} className="mt-1 w-full h-20 px-3 py-2 border border-black/10 rounded-xl text-xs font-mono outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-black/45">Rollback Commands</label>
                  <textarea value={newScenarioForm.rollback} onChange={(e) => setNewScenarioForm(prev => ({ ...prev, rollback: e.target.value }))} className="mt-1 w-full h-20 px-3 py-2 border border-black/10 rounded-xl text-xs font-mono outline-none" />
                </div>
              </div>
            </div>
            <div className={`px-6 py-4 border-t flex gap-3 ${resolvedTheme === 'dark' ? 'border-white/10' : 'border-black/10'}`}>
              <button onClick={() => setShowAddScenarioModal(false)} className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${resolvedTheme === 'dark' ? 'bg-white/10 text-white/80 hover:bg-white/15' : 'bg-black/[0.04] text-black/70 hover:bg-black/[0.08]'}`}>
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
                  className={`w-full rounded-xl px-3 py-2.5 text-sm outline-none border transition-all ${resolvedTheme === 'dark' ? 'bg-white/5 border-white/15 text-white placeholder-white/30 focus:border-[#00bceb]/60' : 'bg-black/[0.02] border-black/10 text-[#0b2a3c] placeholder-black/30 focus:border-[#00bceb]/50'}`}
                />
              </div>

              <div>
                <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1.5 ${resolvedTheme === 'dark' ? 'text-white/55' : 'text-black/45'}`}>Role</label>
                <input
                  type="text"
                  value={currentUser.role || currentUserRecord?.role || 'Administrator'}
                  disabled
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
                    placeholder="Leave blank to keep unchanged"
                    className={`w-full rounded-xl px-3 pr-10 py-2.5 text-sm outline-none border transition-all ${resolvedTheme === 'dark' ? 'bg-white/5 border-white/15 text-white placeholder-white/30 focus:border-[#00bceb]/60' : 'bg-black/[0.02] border-black/10 text-[#0b2a3c] placeholder-black/30 focus:border-[#00bceb]/50'}`}
                  />
                  <button type="button" onClick={() => setShowProfilePwd(v => !v)} className={`absolute right-3 top-1/2 -translate-y-1/2 ${resolvedTheme === 'dark' ? 'text-white/40 hover:text-white/70' : 'text-black/35 hover:text-black/60'}`}>
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
                    {isTestingConnection ? 'Testing Connection...' : 
                     testResult?.success ? 'Connection Successful' : 'Connection Failed'}
                  </h3>
                  <p className="text-xs text-black/40">
                    {selectedDevice?.hostname} ({selectedDevice?.ip_address})
                  </p>
                </div>
              </div>
              {!isTestingConnection && (
                <button onClick={() => setShowTestResult(false)} className="text-black/40 hover:text-black">
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
                  <p className="text-sm font-medium text-blue-600 animate-pulse">Verifying network connectivity via ICMP...</p>
                </div>
              ) : (
                <>
                  <div className={`p-4 rounded-2xl border ${
                    testResult?.success ? 'bg-emerald-50/50 border-emerald-100' : 'bg-red-50/50 border-red-100'
                  }`}>
                    <p className={`text-sm font-medium ${testResult?.success ? 'text-emerald-800' : 'text-red-800'}`}>
                      {testResult?.message}
                    </p>
                  </div>

                  {testResult?.errorCode === LEGACY_SSH_ERROR_CODE && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-700">Legacy SSH Compatibility</p>
                      <p className="mt-2 text-sm text-amber-900">
                        这通常不是账号密码错误，而是设备只支持较老的 SSH KEX、ssh-rsa、cipher 或 MAC 组合。平台已经按兼容模式重试过；如果还失败，优先检查设备镜像和 SSH 配置。
                      </p>
                    </div>
                  )}
                  
                  {testResult?.output && (
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-black/30 ml-1">
                        {testResult?.errorCode === LEGACY_SSH_ERROR_CODE ? 'Raw SSH Error' : 'Device Output'}
                      </label>
                      <div className="bg-[#00172D] p-4 rounded-xl overflow-auto max-h-[200px]">
                        <pre className="text-xs font-mono text-emerald-400/90 whitespace-pre-wrap">
                          {testResult.output}
                        </pre>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button 
                      onClick={() => setShowTestResult(false)}
                      className="flex-1 px-4 py-3 rounded-xl border border-black/10 font-bold uppercase tracking-widest text-[10px] hover:bg-black/5 transition-all"
                    >
                      Close
                    </button>
                    {!testResult?.success && (
                      <button 
                        onClick={() => handleTestConnection()}
                        className="flex-1 px-4 py-3 rounded-xl bg-black text-white font-bold uppercase tracking-widest text-[10px] hover:bg-black/80 transition-all shadow-lg shadow-black/20"
                      >
                        Retry
                      </button>
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
                <button onClick={() => setShowImportModal(false)} className="text-black/40 hover:text-black">
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
              <button onClick={() => setShowDiff(false)} className="text-black/40 hover:text-black">
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

      {/* Deploy Template Modal */}
      {showDeployTemplateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-black/5 flex justify-between items-center bg-black/5">
              <div>
                <h3 className="text-lg font-medium">{t('deploy')}</h3>
                <p className="text-xs text-black/40">Select a device to deploy this template</p>
              </div>
              <button onClick={() => setShowDeployTemplateModal(false)} className="text-black/40 hover:text-black">
                <XCircle size={24} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-black/60 uppercase tracking-wider">{t('selectTarget')}</label>
                <select 
                  value={deployTargetDevice}
                  onChange={(e) => setDeployTargetDevice(e.target.value)}
                  className="w-full px-3 py-2 bg-black/5 border border-black/10 rounded-xl text-sm focus:border-black/20 outline-none transition-all"
                >
                  <option value="">-- {t('selectTarget')} --</option>
                  {devices.filter(d => d.status === 'online').map(device => (
                    <option key={device.id} value={device.id}>{device.hostname} ({device.ip_address})</option>
                  ))}
                </select>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
                <AlertTriangle className="text-amber-500 shrink-0" size={18} />
                <p className="text-xs text-amber-800 leading-relaxed">
                  This will immediately execute the configuration template on the selected device. Ensure all variables are correctly formatted.
                </p>
              </div>
            </div>
            
            <div className="p-4 border-t border-black/5 bg-black/5 flex justify-end gap-3">
              <button 
                onClick={() => setShowDeployTemplateModal(false)}
                className="px-6 py-2 text-sm font-medium text-black/60 hover:text-black"
              >
                {t('cancel')}
              </button>
              <button 
                onClick={handleDeployTemplate}
                disabled={!deployTargetDevice}
                className="px-8 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('deploy')}
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
              <button onClick={() => setShowConfigModal(false)} className="text-black/40 hover:text-black">
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
              <button onClick={() => setShowScheduleModal(false)} className="text-black/40 hover:text-black">
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
                  className="w-full px-4 py-2 bg-black/[0.02] border border-black/10 rounded-xl text-xs outline-none focus:border-black/20"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase text-black/40">{t('timezone')}</label>
                <select
                  value={scheduleForm.timezone}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, timezone: e.target.value })}
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
              <button onClick={() => setShowRemediationModal(false)} className="text-red-900/40 hover:text-red-900">
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
              <button onClick={() => { setShowDeleteModal(false); setDeviceToDelete(null); setIsDeletingSelected(false); }} className="text-red-900/40 hover:text-red-900">
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
              <button onClick={() => setShowAddModal(false)} className="text-black/40 hover:text-black">
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
                    onChange={(e) => setAddForm({...addForm, ip_address: e.target.value})}
                    className="w-full bg-black/[0.02] border border-black/5 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-black/20 focus:bg-white transition-colors"
                    placeholder="e.g. 192.168.1.1"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-black/60 mb-1.5 uppercase tracking-wider">Software / Platform</label>
                  <select 
                    value={addForm.platform || 'cisco_ios'}
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
                    onChange={(e) => setAddForm({...addForm, snmp_port: parseInt(e.target.value)})}
                    className="w-full bg-black/[0.02] border border-black/5 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-black/20 focus:bg-white transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-black/60 mb-1.5 uppercase tracking-wider">Username</label>
                  <input 
                    type="text" 
                    value={addForm.username || ''}
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
                      onChange={(e) => setAddForm({...addForm, password: e.target.value})}
                      className="w-full bg-black/[0.02] border border-black/5 rounded-xl px-4 pr-10 py-2.5 text-sm outline-none focus:border-black/20 focus:bg-white transition-colors"
                    />
                    <button type="button" onClick={() => setShowAddDevicePwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-black/30 hover:text-black/60 transition-colors">
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
              <button onClick={() => setShowEditModal(false)} className="text-black/40 hover:text-black">
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
                    onChange={(e) => setEditForm({...editForm, hostname: e.target.value})}
                    className="w-full bg-black/[0.02] border border-black/5 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-black/20 focus:bg-white transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-black/60 mb-1.5 uppercase tracking-wider">IP Address</label>
                  <input 
                    type="text" 
                    value={editForm.ip_address || ''}
                    onChange={(e) => setEditForm({...editForm, ip_address: e.target.value})}
                    className="w-full bg-black/[0.02] border border-black/5 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-black/20 focus:bg-white transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-black/60 mb-1.5 uppercase tracking-wider">Software / Platform</label>
                  <select 
                    value={editForm.platform || ''}
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
                    onChange={(e) => setEditForm({...editForm, sn: e.target.value})}
                    className="w-full bg-black/[0.02] border border-black/5 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-black/20 focus:bg-white transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-black/60 mb-1.5 uppercase tracking-wider">Model</label>
                  <input 
                    type="text" 
                    value={editForm.model || ''}
                    onChange={(e) => setEditForm({...editForm, model: e.target.value})}
                    className="w-full bg-black/[0.02] border border-black/5 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-black/20 focus:bg-white transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-black/60 mb-1.5 uppercase tracking-wider">Version</label>
                  <input 
                    type="text" 
                    value={editForm.version || ''}
                    onChange={(e) => setEditForm({...editForm, version: e.target.value})}
                    className="w-full bg-black/[0.02] border border-black/5 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-black/20 focus:bg-white transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-black/60 mb-1.5 uppercase tracking-wider">Site</label>
                  <input 
                    type="text" 
                    value={editForm.site || ''}
                    onChange={(e) => setEditForm({...editForm, site: e.target.value})}
                    className="w-full bg-black/[0.02] border border-black/5 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-black/20 focus:bg-white transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-black/60 mb-1.5 uppercase tracking-wider">SNMP Community</label>
                  <input 
                    type="text" 
                    value={editForm.snmp_community || ''}
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
                    onChange={(e) => setEditForm({...editForm, snmp_port: parseInt(e.target.value)})}
                    className="w-full bg-black/[0.02] border border-black/5 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-black/20 focus:bg-white transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-black/60 mb-1.5 uppercase tracking-wider">Username</label>
                  <input 
                    type="text" 
                    value={editForm.username || ''}
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
                      onChange={(e) => setEditForm({...editForm, password: e.target.value})}
                      placeholder="Leave blank to keep unchanged"
                      className="w-full bg-black/[0.02] border border-black/5 rounded-xl px-4 pr-10 py-2.5 text-sm outline-none focus:border-black/20 focus:bg-white transition-colors"
                    />
                    <button type="button" onClick={() => setShowEditDevicePwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-black/30 hover:text-black/60 transition-colors">
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
            className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-black/5 flex justify-between items-center bg-black/[0.02]">
              <div className="flex items-center gap-3">
                <Server className="text-black/60" size={24} />
                <div>
                  <h3 className="text-lg font-medium">{t('deviceDetails')}</h3>
                  <p className="text-xs text-black/40">{viewingDevice.hostname}</p>
                </div>
              </div>
              <button onClick={() => setShowDetailsModal(false)} className="text-black/20 hover:text-black">
                <XCircle size={24} />
              </button>
            </div>
            
            <div className="p-8 grid grid-cols-2 gap-8">
              <div className="space-y-6">
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
              </div>
            </div>

            {/* Interface Monitoring Table */}
            {viewingDevice.interface_data && viewingDevice.interface_data.length > 0 && (
              <div className="px-8 pb-4">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-black/30 mb-3">{language === 'zh' ? '接口监控' : 'Interface Monitoring'} ({viewingDevice.interface_data.length})</h4>
                <div className="border border-black/5 rounded-xl overflow-hidden max-h-60 overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-black/[0.02] sticky top-0">
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
                                <span className={`w-1.5 h-1.5 rounded-full ${intf.status === 'up' ? 'bg-emerald-500' : 'bg-red-500'}`} />
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
                            <td className="px-3 py-1.5 text-black/40 truncate max-w-[120px]">{intf.description || '-'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="p-6 bg-black/[0.01] border-t border-black/5 flex justify-between items-center">
              <div className="flex gap-3">
                <button 
                  onClick={() => handleTestConnection(viewingDevice)}
                  disabled={isTestingConnection}
                  className="px-6 py-2 bg-blue-50 text-blue-600 rounded-xl text-sm font-medium hover:bg-blue-100 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  <Activity size={16} />
                  {isTestingConnection ? 'Testing...' : t('testConnection')}
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
              <button 
                onClick={() => setShowDetailsModal(false)}
                className="px-8 py-2 bg-black text-white rounded-xl text-sm font-medium hover:bg-black/80 transition-all shadow-lg shadow-black/20"
              >
                {t('close')}
              </button>
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
              <button onClick={() => setShowSnmpTestResult(false)} className="text-black/30 hover:text-black">
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
