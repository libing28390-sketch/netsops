import React from 'react';
import { AlertCircle, RotateCcw, ShieldCheck } from 'lucide-react';
import type { Device } from '../types';
import { buildConnectionTestHint } from '../utils/connectionHelpers';
import ResultStatusModal from './ResultStatusModal';

interface ConnectionStage {
  stage: string;
  ok: boolean;
  summary: string;
  detail: string;
  latency_ms?: number | null;
}

interface ConnectionTestResult {
  success: boolean;
  message: string;
  output?: string;
  rawError?: string;
  errorCode?: string;
  checkMode?: string;
  stages?: ConnectionStage[];
}

interface TestConnectionResultModalProps {
  open: boolean;
  language: string;
  isTestingConnection: boolean;
  connectionTestMode: 'quick' | 'deep';
  connectionTestDevice: Device | null;
  selectedDevice: Device | null;
  testResult: ConnectionTestResult | null;
  onClose: () => void;
  onRetry: (device: Device | null, mode: 'quick' | 'deep') => void;
}

const TestConnectionResultModal: React.FC<TestConnectionResultModalProps> = ({
  open,
  language,
  isTestingConnection,
  connectionTestMode,
  connectionTestDevice,
  selectedDevice,
  testResult,
  onClose,
  onRetry,
}) => {
  const targetDevice = connectionTestDevice || selectedDevice;
  const success = !!testResult?.success;

  const title = isTestingConnection
    ? (connectionTestMode === 'deep'
      ? (language === 'zh' ? 'SSH 登录校验中...' : 'Running SSH Login Validation...')
      : (language === 'zh' ? '快速连通性检测中...' : 'Running Reachability Check...'))
    : success
      ? (testResult?.checkMode === 'deep'
        ? (language === 'zh' ? 'SSH 登录成功' : 'SSH Login Successful')
        : (language === 'zh' ? '连通性正常' : 'Reachability Confirmed'))
      : (testResult?.checkMode === 'deep'
        ? (language === 'zh' ? 'SSH 登录异常' : 'SSH Login Failed')
        : (language === 'zh' ? '连通性异常' : 'Reachability Failed'));

  return (
    <ResultStatusModal
      open={open}
      onClose={onClose}
      title={title}
      closeTitle={language === 'zh' ? '关闭结果窗口' : 'Close result dialog'}
      icon={isTestingConnection ? RotateCcw : success ? ShieldCheck : AlertCircle}
      iconClassName={isTestingConnection ? 'bg-blue-500 text-white animate-pulse' : success ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}
      headerClassName={isTestingConnection ? 'border-b border-black/5 bg-blue-50' : success ? 'border-b border-black/5 bg-emerald-50' : 'border-b border-black/5 bg-red-50'}
      panelClassName="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-black/5 overflow-hidden"
      bodyClassName="p-8 space-y-6"
      closeDisabled={isTestingConnection}
    >
      <p className="text-xs text-black/40 -mt-3">{targetDevice?.hostname || '-'} ({targetDevice?.ip_address || '-'})</p>
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
                    ? (targetDevice?.connection_method === 'telnet' ? 'TCP/23' : 'TCP/22')
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

          <div className={`p-4 rounded-2xl border ${success ? 'bg-emerald-50/50 border-emerald-100' : 'bg-red-50/50 border-red-100'}`}>
            <p className={`text-sm font-medium ${success ? 'text-emerald-800' : 'text-red-800'}`}>{testResult?.message}</p>
            {!success && buildConnectionTestHint(testResult?.errorCode, language) && (
              <p className="mt-2 text-xs leading-5 text-red-700/90">{buildConnectionTestHint(testResult?.errorCode, language)}</p>
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
                <pre className="text-xs font-mono text-emerald-400/90 whitespace-pre-wrap">{testResult.output}</pre>
              </div>
            </details>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 rounded-xl border border-black/10 font-bold uppercase tracking-widest text-[10px] hover:bg-black/5 transition-all"
            >
              Close
            </button>
            {!success && (
              <div className="flex flex-1 gap-3">
                <button
                  onClick={() => onRetry(targetDevice, 'quick')}
                  className="flex-1 px-4 py-3 rounded-xl bg-black text-white font-bold uppercase tracking-widest text-[10px] hover:bg-black/80 transition-all shadow-lg shadow-black/20"
                >
                  {language === 'zh' ? '重试快速检测' : 'Retry Quick Check'}
                </button>
                <button
                  onClick={() => onRetry(targetDevice, 'deep')}
                  className="flex-1 px-4 py-3 rounded-xl border border-black/10 font-bold uppercase tracking-widest text-[10px] hover:bg-black/5 transition-all"
                >
                  {language === 'zh' ? 'SSH 登录校验' : 'SSH Login Check'}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </ResultStatusModal>
  );
};

export default TestConnectionResultModal;