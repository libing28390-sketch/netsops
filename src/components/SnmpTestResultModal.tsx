import React from 'react';
import { CheckCircle, RotateCcw, XCircle } from 'lucide-react';
import ResultStatusModal from './ResultStatusModal';

interface SnmpTestResult {
  success?: boolean;
  response_ms?: number | null;
  ip?: string;
  community?: string;
  port?: number;
  sys_name?: string;
  sys_descr?: string;
  error?: string;
}

interface SnmpTestResultModalProps {
  open: boolean;
  language: string;
  result: SnmpTestResult | null;
  onClose: () => void;
}

const SnmpTestResultModal: React.FC<SnmpTestResultModalProps> = ({ open, language, result, onClose }) => {
  const success = !!result?.success;

  return (
    <ResultStatusModal
      open={open}
      onClose={onClose}
      title="SNMP Test Result"
      closeTitle={language === 'zh' ? '关闭 SNMP 测试结果' : 'Close SNMP test result'}
      icon={result ? (success ? CheckCircle : XCircle) : RotateCcw}
      iconClassName={result ? (success ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500') : 'bg-slate-100 text-slate-500'}
      onBackdropClick={onClose}
    >
      {!result ? (
        <div className="flex items-center justify-center py-8">
          <RotateCcw className="animate-spin text-black/20" size={24} />
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${success ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
              {success ? <CheckCircle size={20} /> : <XCircle size={20} />}
            </div>
            <div>
              <p className={`font-semibold text-sm ${success ? 'text-emerald-600' : 'text-red-500'}`}>
                {success ? (language === 'zh' ? 'SNMP 连通成功' : 'SNMP Reachable') : (language === 'zh' ? 'SNMP 连通失败' : 'SNMP Unreachable')}
              </p>
              {result.response_ms != null && (
                <p className="text-[10px] text-black/40">{language === 'zh' ? '响应延迟' : 'Response time'}: {result.response_ms} ms</p>
              )}
            </div>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1.5 border-b border-black/5">
              <span className="text-black/40">IP</span>
              <span className="font-mono">{result.ip || '-'}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-black/5">
              <span className="text-black/40">Community</span>
              <span className="font-mono">{result.community || '-'}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-black/5">
              <span className="text-black/40">Port</span>
              <span>{result.port ?? '-'}</span>
            </div>
            {result.sys_name && (
              <div className="flex justify-between py-1.5 border-b border-black/5">
                <span className="text-black/40">sysName</span>
                <span className="font-medium text-right max-w-[200px] truncate">{result.sys_name}</span>
              </div>
            )}
            {result.sys_descr && (
              <div className="py-1.5 border-b border-black/5">
                <span className="text-black/40 block mb-1">sysDescr</span>
                <span className="text-[11px] text-black/60 break-all">{result.sys_descr}</span>
              </div>
            )}
            {result.error && (
              <div className="py-1.5">
                <span className="text-red-500 block mb-1">{language === 'zh' ? '错误信息' : 'Error'}</span>
                <span className="text-[11px] text-red-400 break-all">{result.error}</span>
              </div>
            )}
          </div>
        </>
      )}
    </ResultStatusModal>
  );
};

export default SnmpTestResultModal;