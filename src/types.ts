// Shared type definitions for NetAxis
// Extracted from App.tsx for reuse across components

export interface ConfigVersion {
  id: string;
  timestamp: string;
  content: string;
  author: string;
  description: string;
}

export interface Device {
  id: string;
  hostname: string;
  ip_address: string;
  platform: string;
  status: 'online' | 'offline' | 'pending';
  compliance: 'compliant' | 'non-compliant' | 'unknown';
  sn: string;
  model: string;
  version: string;
  role: string;
  site: string;
  uptime: string;
  connection_method: 'ssh' | 'netconf';
  current_config?: string;
  config_history: ConfigVersion[];
  username?: string;
  password?: string;
  cpu_usage?: number;
  memory_usage?: number;
  cpu_history?: number[];
  memory_history?: number[];
  temp?: number;
  fan_status?: 'ok' | 'fail';
  psu_status?: 'redundant' | 'single' | 'fail';
  snmp_community?: string;
  snmp_port?: number;
  sys_name?: string;
  sys_location?: string;
  sys_contact?: string;
  interface_data?: {
    name: string; status: string; speed_mbps: number;
    in_octets: number; out_octets: number; description: string;
    in_bps?: number; out_bps?: number;
    in_errors?: number; out_errors?: number;
    in_discards?: number; out_discards?: number;
    in_ucast_pkts?: number; out_ucast_pkts?: number;
    bw_in_pct?: number; bw_out_pct?: number;
    last_change_secs?: number; flapping?: boolean;
  }[];
}

export interface Job {
  id: string;
  device_id: string;
  task_name: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'rolled_back';
  output?: string;
  created_at: string;
}

export interface AuditEvent {
  id: string;
  event_type: string;
  category: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: string;
  actor_id?: string;
  actor_username?: string;
  actor_role?: string;
  source_ip?: string;
  target_type?: string;
  target_id?: string;
  target_name?: string;
  device_id?: string;
  job_id?: string;
  execution_id?: string;
  snapshot_id?: string;
  summary: string;
  details?: Record<string, any>;
  details_json?: string;
  created_at: string;
}

export interface ComplianceFinding {
  id: string;
  fingerprint: string;
  rule_id: string;
  device_id: string;
  run_id?: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  title: string;
  description: string;
  detail?: string;
  remediation?: string;
  status: 'open' | 'in_progress' | 'resolved' | 'accepted_risk';
  owner?: string;
  note?: string;
  first_seen: string;
  last_seen: string;
  resolved_at?: string;
  created_at: string;
  updated_at: string;
  hostname?: string;
  ip_address?: string;
}

export interface ComplianceRunPoint {
  run_id: string;
  created_at: string;
  score: number;
  total_findings: number;
  device_count: number;
}

export interface ComplianceOverview {
  total_findings: number;
  open_findings: number;
  resolved_findings: number;
  in_progress_findings: number;
  accepted_risk_findings: number;
  latest_score: number;
  severity_breakdown: Record<string, number>;
  category_breakdown: Record<string, number>;
  run_history: ComplianceRunPoint[];
}

export interface ScheduledTask {
  id: number;
  device_id: string;
  task_name: string;
  schedule_type: 'once' | 'recurring';
  interval?: 'daily' | 'weekly' | 'monthly';
  scheduled_time: string;
  timezone: string;
  status: 'active' | 'completed' | 'failed';
}

export interface Script {
  id: string;
  name: string;
  content: string;
  type: string;
  description: string;
  parameters?: string[];
}

export interface ConfigTemplate {
  id: string;
  name: string;
  type: string;
  lastUsed: string;
  category: string;
  content: string;
}

export interface ConfigSnapshot {
  id: string;
  device_id: string;
  hostname: string;
  ip_address?: string;
  vendor: string;
  trigger: 'manual' | 'auto' | 'change';
  author: string;
  content?: string;
  created_at: string;
}

export interface DiffLine {
  type: 'context' | 'add' | 'remove';
  lineA?: number;
  lineB?: number;
  content: string;
}

export interface User {
  id: string;
  username: string;
  role: string;
  lastLogin?: string;
  status?: string;
  avatar_url?: string;
}

export type ThemeMode = 'light' | 'dark';

export interface SessionUser {
  id?: string | number;
  username: string;
  role?: string;
  avatar_url?: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  source?: string;
  severity?: 'low' | 'medium' | 'high';
  read: boolean;
}

export const PLATFORM_LABELS: Record<string, string> = {
  cisco_ios: 'Cisco IOS',
  cisco_nxos: 'Cisco NX-OS',
  cisco_iosxr: 'Cisco IOS-XR',
  huawei_vrp: 'Huawei VRP',
  h3c_comware: 'H3C Comware',
  arista_eos: 'Arista EOS',
  juniper_junos: 'Juniper Junos',
};

export const getPlatformLabel = (platform: string) => PLATFORM_LABELS[platform] || platform;

export const getVendorFromPlatform = (platform: string) => {
  const p = platform.toLowerCase();
  if (p.includes('cisco')) return 'Cisco';
  if (p.includes('juniper')) return 'Juniper';
  if (p.includes('huawei')) return 'Huawei';
  if (p.includes('arista')) return 'Arista';
  return 'Other';
};
