import React, { useState } from 'react';
import { AuditLog, UserRole } from '../types';
import { History, Search, Download, Filter, FileSpreadsheet, Lock } from 'lucide-react';

interface AuditLogViewProps {
  logs: AuditLog[];
  role: UserRole;
  isSheetsConnected: boolean;
  onConnectSheets: () => void;
  sheetsEmail?: string;
}

export const AuditLogView: React.FC<AuditLogViewProps> = ({ 
  logs, 
  role,
  isSheetsConnected,
  onConnectSheets,
  sheetsEmail,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('All');

  const filteredLogs = logs
    .filter((log) => {
      const matchSearch =
        log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.userEmail.toLowerCase().includes(searchTerm.toLowerCase());

      const matchRole = roleFilter === 'All' || log.userRole === roleFilter;

      return matchSearch && matchRole;
    })
    // Show newest first
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const exportLogsAsCSV = () => {
    // Basic CSV compiler
    const headers = ['ID', 'Timestamp', 'Operator Role', 'Operator Email', 'Action Event', 'Detailed Narrative'];
    const rows = filteredLogs.map((l) => [
      l.id,
      l.timestamp,
      l.userRole,
      l.userEmail,
      l.action,
      l.details.replace(/,/g, ' -'), // sanitise delimiter
    ]);

    const csvContent = [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Audit_Ledgers_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div id="compliance-audit-logs" className="glass-panel rounded-[32px] p-6 soft-card-shadow luxury-glow bg-white/70">
      
      {/* Google Sheets Sync Module Header widget */}
      <div className="mb-6 p-6 rounded-2xl border border-slate-200/50 bg-gradient-to-r from-[#D0FAFB]/20 via-pink-50/10 to-[#E1EEFF]/20 soft-card-shadow flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-white rounded-xl border border-slate-100 shadow-sm animate-pulse">
            <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
          </div>
          <div className="text-left font-sans">
            <h4 className="text-xs font-bold tracking-widest text-[#2f4f4f] uppercase">Transaction Logging Service</h4>
            <p className="text-[10px] text-slate-400 mt-1 max-w-sm font-light">
              Write actions, payments, and interest evaluations to Google Sheets in real-time.
            </p>
          </div>
        </div>

        <div>
          {isSheetsConnected ? (
            <div className="flex flex-col items-end gap-1 font-sans">
              <span className="text-[9px] bg-emerald-500 text-white font-mono px-3 py-1 rounded-full uppercase border border-emerald-600 flex items-center gap-1.5 shadow-sm font-bold">
                <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />
                <span>Google Sheets Sync Active</span>
              </span>
              <span className="text-[8px] text-slate-400 font-mono mt-0.5">Linked as: {sheetsEmail}</span>
              <a 
                href="https://docs.google.com/spreadsheets/d/1Lk4-23rlanQNaRjkPsDZVPHlDRib8cSkI1Z_zJ71qzM/edit?usp=sharing" 
                target="_blank" 
                rel="noreferrer"
                className="text-[9px] text-emerald-800 underline font-semibold hover:text-emerald-950 mt-1 block"
              >
                Open Google Spreadsheet ↗
              </a>
            </div>
          ) : (
            <button
              onClick={onConnectSheets}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition-all shadow-sm hover:scale-[1.02]"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Connect Google Sheets Integration</span>
            </button>
          )}
        </div>
      </div>

      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-105 pb-4 mb-5 font-sans">
        <div className="flex items-center space-x-2 text-left">
          <History className="w-5 h-5 text-slate-500" />
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">
              System Audit Trails (数据合规审计)
            </h3>
            <p className="text-[11px] text-slate-400 font-light mt-0.5">
              Compliance logging ledger — tracking immutable database mutations
            </p>
          </div>
        </div>

        <button
          onClick={exportLogsAsCSV}
          className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-805 rounded-xl text-xs cursor-pointer hover:scale-[1.02] shadow-sm font-bold transition-all"
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-500 font-bold" />
          <span>Export Ledger as CSV</span>
        </button>
      </div>

      {/* Filters bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
          <input
            type="text"
            placeholder="Search activities or emails..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white/60 border border-slate-200 py-2.5 pl-9 pr-3 rounded-xl text-xs placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 shadow-sm"
          />
        </div>

        {/* Role filters */}
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="bg-white/60 border border-slate-200 rounded-xl py-2.5 px-3 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans cursor-pointer w-full font-bold shadow-sm"
          >
            <option value="All">All Operative Levels</option>
            <option value="Admin">Admin Level Only</option>
            <option value="Staff">Staff / CS Level Only</option>
          </select>
        </div>

        {/* Compliance details */}
        <div className="flex items-center gap-1.5 bg-rose-50/50 border border-rose-100 p-2.5 rounded-xl justify-center md:justify-end shadow-sm">
          <Lock className="w-3.5 h-3.5 text-rose-500" />
          <span className="text-[10px] text-rose-600 uppercase font-bold tracking-wider font-mono">
            Immutable Audit Trail Active
          </span>
        </div>
      </div>

      {/* Main logs stream */}
      <div className="max-h-[350px] overflow-y-auto border border-slate-200/60 rounded-2xl bg-white soft-card-shadow">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 font-semibold text-[10px] text-slate-500 uppercase tracking-wider border-b border-slate-100">
              <th className="py-3 px-5">Date stamp</th>
              <th className="py-3 px-5">Executor Info</th>
              <th className="py-3 px-5">Action Event</th>
              <th className="py-3 px-5">Narrative Details</th>
            </tr>
          </thead>
          <tbody className="text-[11px] font-mono leading-relaxed divide-y divide-slate-100 bg-white">
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-12 text-center text-slate-400 font-sans font-light">
                  No matching audit entries found on this level query.
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => {
                let badgeClass = 'text-blue-600 bg-blue-50 border-blue-100';
                if (log.userRole === 'Admin') badgeClass = 'text-rose-600 bg-rose-50 border-rose-100';
                if (log.userRole === 'Staff') badgeClass = 'text-teal-600 bg-teal-50 border-teal-100';

                return (
                  <tr key={log.id} className="hover:bg-slate-50/20 transition-colors">
                    <td className="py-3 px-5 text-slate-400 shrink-0 font-sans whitespace-nowrap font-light">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3 px-5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[8.5px] px-2.5 py-0.5 rounded-full uppercase font-bold tracking-wider border ${badgeClass}`}>
                          {log.userRole}
                        </span>
                        <span className="text-slate-700 font-sans font-bold">{log.userEmail}</span>
                      </div>
                    </td>
                    <td className="py-3 px-5 font-bold text-slate-800 whitespace-nowrap">
                      <span className="bg-slate-100 py-1 px-2.5 rounded-md border border-slate-200/60 font-mono text-[10px] font-normal">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-5 text-slate-500 font-sans leading-relaxed max-w-sm font-light">
                      {log.details}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
