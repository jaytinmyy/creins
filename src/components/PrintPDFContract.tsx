import React, { useState } from 'react';
import { Customer, InstallmentPlan, RepaymentInstallment, UserRole } from '../types';
import { formatRM } from '../utils/calc';
import { Printer, FileText, Settings, X, ShieldAlert, CheckCircle2, AlertTriangle, Ticket } from 'lucide-react';

interface PrintPDFContractProps {
  customer: Customer;
  plan: InstallmentPlan;
  evaluatedSchedule: RepaymentInstallment[];
  simulatedStats: {
    totalLateFees: number;
    overallPenaltyAmount: number;
    overallFinalAmount: number;
  };
  onClose: () => void;
  headerCompanyName?: string;
  headerCompanyPhone?: string;
  logoUrl?: string;
  customTerms?: string;
}

export const PrintPDFContract: React.FC<PrintPDFContractProps> = ({
  customer,
  plan,
  evaluatedSchedule,
  simulatedStats,
  onClose,
  headerCompanyName,
  headerCompanyPhone,
  logoUrl,
  customTerms,
}) => {
  // Configurable company details
  const [companyName, setCompanyName] = useState(headerCompanyName || 'CRE CREDIT & LEASING');
  const [companyPhone, setCompanyPhone] = useState(headerCompanyPhone || '+6012-345 6789');
  const [showConfig, setShowConfig] = useState(false);

  // Print-specific security features & Bank information
  const [showWatermark, setShowWatermark] = useState(true);
  const [stampColor, setStampColor] = useState<'red' | 'indigo' | 'slate'>('red');
  const [bankName, setBankName] = useState('Maybank (Malayan Banking Berhad)');
  const [bankAccountName, setBankAccountName] = useState('CRE CREDIT & LEASING CO.');
  const [bankAccountNumber, setBankAccountNumber] = useState('5124-7890-3456');
  const [showBankDetails, setShowBankDetails] = useState(false);
  const [securitySerial, setSecuritySerial] = useState(`MYS-CRE-${customer.code}-${plan.id.slice(-5).toUpperCase()}`);

  // QR Payment Gateway Configuration
  const [showQrCode, setShowQrCode] = useState(true);
  const [qrType, setQrType] = useState<'duitnow' | 'tng'>('duitnow');
  const [qrMerchantName, setQrMerchantName] = useState(headerCompanyName || 'CRE CREDIT & LEASING CO.');
  const [uploadedQrUrl, setUploadedQrUrl] = useState<string | null>(null);

  React.useEffect(() => {
    if (headerCompanyName) {
      setCompanyName(headerCompanyName);
      setQrMerchantName(headerCompanyName);
    }
    if (headerCompanyPhone) setCompanyPhone(headerCompanyPhone);
  }, [headerCompanyName, headerCompanyPhone]);

  const handlePrint = () => {
    window.print();
  };

  const totalPaymentsMade = evaluatedSchedule
    .filter((inst) => inst.status === 'Paid')
    .reduce((sum, inst) => sum + inst.amount, 0);

  const totalOutstanding = evaluatedSchedule
    .filter((inst) => inst.status !== 'Paid')
    .reduce((sum, inst) => sum + inst.amount, 0);

  const renderQRCodeSVG = () => {
    const isDuitNow = qrType === 'duitnow';
    const primaryColor = isDuitNow ? '#D12440' : '#01519C';
    const labelText = isDuitNow ? 'DuitNow QR' : "TNG eWallet";

    return (
      <div className="flex flex-col items-center bg-white border border-slate-200/60 p-2 rounded-xl w-[115px] shrink-0 text-center shadow-3xs relative no-print-bg">
        {/* Header bar matching official style */}
        <div 
          style={{ backgroundColor: primaryColor }} 
          className="w-full text-white text-[6.5px] font-black uppercase text-center py-0.5 rounded-sm tracking-wider mb-1 leading-none"
        >
          {labelText}
        </div>

        {/* Custom Uploaded or High-fidelity Vector QR Code */}
        <div className="relative p-0.5 bg-white border border-slate-100 rounded-md w-18 h-18 flex items-center justify-center overflow-hidden">
          {uploadedQrUrl ? (
            <img 
              src={uploadedQrUrl} 
              alt="Uploaded Payment QR" 
              className="w-full h-full object-contain" 
              referrerPolicy="no-referrer"
            />
          ) : (
            <svg viewBox="0 0 100 100" className="w-full h-full text-slate-900 select-none">
              {/* Finder pattern top-left */}
              <rect x="0" y="0" width="22" height="22" fill="currentColor" rx="1.5" />
              <rect x="3" y="3" width="16" height="16" fill="white" rx="1" />
              <rect x="6" y="6" width="10" height="10" fill="currentColor" rx="0.5" />

              {/* Finder pattern top-right */}
              <rect x="78" y="0" width="22" height="22" fill="currentColor" rx="1.5" />
              <rect x="81" y="3" width="16" height="16" fill="white" rx="1" />
              <rect x="84" y="6" width="10" height="10" fill="currentColor" rx="0.5" />

              {/* Finder pattern bottom-left */}
              <rect x="0" y="78" width="22" height="22" fill="currentColor" rx="1.5" />
              <rect x="3" y="81" width="16" height="16" fill="white" rx="1" />
              <rect x="6" y="84" width="10" height="10" fill="currentColor" rx="0.5" />

              {/* Alignment marker bottom-right */}
              <rect x="74" y="74" width="8" height="8" fill="currentColor" rx="0.5" />
              <rect x="76" y="76" width="4" height="4" fill="white" />
              <rect x="77" y="77" width="2" height="2" fill="currentColor" />

              {/* Pseudo-Random QR Code Pixels Grid */}
              <g fill="currentColor">
                {/* Row 1-4 random mock blocks */}
                <rect x="28" y="2" width="4" height="4" />
                <rect x="36" y="0" width="8" height="4" />
                <rect x="48" y="2" width="4" height="8" />
                <rect x="56" y="0" width="4" height="4" />
                <rect x="64" y="2" width="8" height="4" />

                <rect x="28" y="10" width="8" height="4" />
                <rect x="40" y="8" width="4" height="4" />
                <rect x="56" y="10" width="8" height="4" />
                <rect x="68" y="8" width="4" height="8" />

                {/* Row 5-8 random mock blocks */}
                <rect x="0" y="28" width="4" height="8" />
                <rect x="8" y="32" width="8" height="4" />
                <rect x="24" y="28" width="4" height="4" />
                <rect x="32" y="32" width="12" height="4" />
                <rect x="48" y="28" width="8" height="8" fill={primaryColor} opacity="0.15" />
                <rect x="60" y="32" width="4" height="4" />
                <rect x="68" y="28" width="12" height="4" />
                <rect x="84" y="32" width="4" height="8" />
                <rect x="92" y="28" width="8" height="4" />

                {/* Row 9-12 random mock blocks */}
                <rect x="4" y="44" width="8" height="4" />
                <rect x="16" y="40" width="4" height="8" />
                <rect x="28" y="44" width="12" height="4" />
                <rect x="44" y="40" width="4" height="4" />
                <rect x="52" y="44" width="8" height="4" />
                <rect x="64" y="40" width="4" height="8" />
                <rect x="72" y="44" width="12" height="4" />
                <rect x="88" y="40" width="4" height="4" />
                <rect x="96" y="44" width="4" height="4" />

                {/* Row 13-16 random mock blocks */}
                <rect x="0" y="56" width="12" height="4" />
                <rect x="16" y="52" width="4" height="4" />
                <rect x="24" y="56" width="8" height="8" />
                <rect x="36" y="52" width="4" height="4" />
                <rect x="44" y="56" width="12" height="4" />
                <rect x="60" y="52" width="8" height="4" />
                <rect x="72" y="56" width="4" height="8" />
                <rect x="80" y="52" width="12" height="4" />
                <rect x="96" y="56" width="4" height="4" />

                <rect x="8" y="68" width="4" height="4" />
                <rect x="16" y="64" width="8" height="4" />
                <rect x="36" y="68" width="4" height="8" />
                <rect x="48" y="64" width="12" height="4" />
                <rect x="64" y="68" width="4" height="4" />
                <rect x="84" y="64" width="8" height="4" />
                <rect x="96" y="68" width="4" height="12" />

                {/* Row 17-20 random mock blocks */}
                <rect x="28" y="80" width="8" height="4" />
                <rect x="40" y="84" width="4" height="8" />
                <rect x="48" y="80" width="12" height="4" />
                <rect x="64" y="84" width="8" height="4" />
                <rect x="88" y="80" width="4" height="8" />

                <rect x="28" y="92" width="4" height="4" />
                <rect x="36" y="96" width="12" height="4" />
                <rect x="52" y="92" width="4" height="4" />
                <rect x="60" y="96" width="8" height="4" />
                <rect x="72" y="92" width="16" height="4" />
              </g>

              {/* Core Brand Badge overlay exactly in center */}
              <rect x="36" y="36" width="28" height="28" fill="white" rx="3" />
              {isDuitNow ? (
                <g transform="translate(38, 38) scale(0.24)">
                  <rect x="10" y="10" width="80" height="80" fill="#D12440" rx="20" transform="rotate(45 50 50)" />
                  <circle cx="50" cy="50" r="18" fill="white" />
                  <rect x="46" y="32" width="8" height="36" fill="#D12440" rx="1" />
                  <circle cx="54" cy="50" r="10" fill="#D12440" />
                  <circle cx="54" cy="50" r="4" fill="white" />
                </g>
              ) : (
                <g transform="translate(38, 38) scale(0.24)" fill="#01519C">
                  <rect x="5" y="15" width="90" height="70" fill="#01519C" rx="14" />
                  <text x="50" y="46" fill="white" fontFamily="sans-serif" fontSize="16" fontWeight="bold" textAnchor="middle">Touch</text>
                  <rect x="25" y="52" width="50" height="4" fill="#00A651" rx="1" />
                  <text x="50" y="74" fill="white" fontFamily="sans-serif" fontSize="18" fontWeight="black" textAnchor="middle">eWallet</text>
                </g>
              )}
            </svg>
          )}
        </div>

        {/* Footer merchant identification */}
        <span className="text-[6px] text-slate-400 font-extrabold uppercase mt-1 leading-none tracking-wider truncate w-full">
          Scan to Repay
        </span>
        <span className="text-[7.5px] text-slate-800 font-black font-sans leading-tight mt-0.5 max-w-full truncate">
          {qrMerchantName}
        </span>
      </div>
    );
  };

  // Dynamic stamp configuration
  const stampColors = {
    red: {
      border: 'border-rose-600/90 text-rose-600 bg-rose-50/10',
      badge: 'bg-rose-100/90 text-rose-700 border-rose-200',
      text: 'text-rose-600',
      fill: '#dc2626'
    },
    indigo: {
      border: 'border-indigo-600/95 text-indigo-600 bg-indigo-50/10',
      badge: 'bg-indigo-100/90 text-indigo-700 border-indigo-200',
      text: 'text-indigo-600',
      fill: '#4f46e5'
    },
    slate: {
      border: 'border-slate-800 text-slate-800 bg-slate-50/5',
      badge: 'bg-slate-200/90 text-slate-800 border-slate-300',
      text: 'text-slate-800',
      fill: '#1e293b'
    }
  };
  const activeStamp = stampColors[stampColor] || stampColors.red;

  return (
    <div className="glass-panel p-6 rounded-[28px] border border-slate-200/60 bg-gradient-to-tr from-[#D0FAFB]/15 via-[#FFF0F7]/25 to-[#E1EEFF]/15 shadow-md relative luxury-glow">
      {/* Mini Controls Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-white/45 pb-4 mb-6 no-print">
        <div>
          <span className="text-[10px] font-extrabold text-[#ed85a7] uppercase tracking-widest block font-sans">Corporate Publisher Desk</span>
          <h2 className="text-sm font-extrabold text-slate-900 font-sans flex items-center gap-2">
            <FileText className="w-4.5 h-4.5 text-pink-500" />
            <span>Official A4 Contract Invoice & Anti-Counterfeit Receipt (防伪打印)</span>
          </h2>
        </div>

        <div className="flex gap-2 mt-3 sm:mt-0 font-sans">
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 rounded-xl text-xs font-bold cursor-pointer transition-all"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Adjust Security & Print Options</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4.5 py-2 bg-gradient-to-r from-pink-500 to-indigo-600 hover:from-pink-600 hover:to-indigo-700 text-white font-extrabold rounded-xl text-xs cursor-pointer shadow-md transition-all scale-102 hover:scale-105 active:scale-95"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print or Download PDF</span>
          </button>
        </div>
      </div>

      {showConfig && (
        <div className="mb-6 p-5 bg-white/85 backdrop-blur border border-pink-100/50 rounded-2xl grid grid-cols-1 md:grid-cols-4 gap-4.5 no-print text-xs font-sans">
          {/* Section 1: Firm Info */}
          <div className="space-y-3 border-r border-slate-100 pr-4">
            <h4 className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Company & Contact Header</h4>
            <div>
              <label className="block text-[8px] font-bold text-slate-550 uppercase mb-1">Company Name</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full text-xs bg-white border border-slate-200 rounded-xl p-2 text-slate-800 font-bold focus:outline-none focus:ring-1 focus:ring-pink-500"
              />
            </div>
            <div>
              <label className="block text-[8px] font-bold text-slate-550 uppercase mb-1">Company Contact</label>
              <input
                type="text"
                value={companyPhone}
                onChange={(e) => setCompanyPhone(e.target.value)}
                className="w-full text-xs bg-white border border-slate-200 rounded-xl p-2 text-slate-800 font-bold focus:outline-none focus:ring-1 focus:ring-pink-500"
              />
            </div>
          </div>

          {/* Section 2: Security & Watermark */}
          <div className="space-y-3 border-r border-slate-100 pr-4">
            <h4 className="text-[10px] font-extrabold uppercase text-[#0d9488] tracking-wider">Anti-Counterfeit Protection</h4>
            <div>
              <label className="block text-[8px] font-bold text-slate-550 uppercase mb-1">Verification Serial Key (条码编号)</label>
              <input
                type="text"
                value={securitySerial}
                onChange={(e) => setSecuritySerial(e.target.value)}
                className="w-full text-xs bg-white border border-slate-200 rounded-xl p-2 font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-pink-500"
              />
            </div>
            <div className="space-y-2 pt-1.5">
              <label className="flex items-center gap-2 text-slate-700 font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={showWatermark}
                  onChange={(e) => setShowWatermark(e.target.checked)}
                  className="rounded text-pink-500 focus:ring-pink-500 w-3.5 h-3.5"
                />
                <span>Enable Fine-text Watermark Background</span>
              </label>
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-slate-500 uppercase font-semibold">Official Seal Color:</span>
                <select
                  value={stampColor}
                  onChange={(e) => setStampColor(e.target.value as any)}
                  className="bg-white border border-slate-200 rounded px-1.5 py-0.5 text-[11px] font-bold text-slate-800"
                >
                  <option value="red">🔴 Authentic Red Stamp (红色防伪公章)</option>
                  <option value="indigo">🔵 Royal Indigo Stamp (深蓝背书印章)</option>
                  <option value="slate">⚫ Carbon Black (单色复印模式)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Official Bank details for anti-hijack */}
          <div className="space-y-3 border-r border-slate-100 pr-4">
            <h4 className="text-[10px] font-extrabold uppercase text-indigo-500 tracking-wider">Default Bank Instructions (防挟持收款银行)</h4>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-slate-700 font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={showBankDetails}
                  onChange={(e) => setShowBankDetails(e.target.checked)}
                  className="rounded text-indigo-500 focus:ring-indigo-500 w-3.5 h-3.5"
                />
                <span>Include Protected Bank Instructions</span>
              </label>
              {showBankDetails && (
                <div className="space-y-1.5 p-2 bg-slate-50 rounded-xl border border-slate-200 bg-white">
                  <input
                    type="text"
                    value={bankName}
                    placeholder="Bank Name"
                    onChange={(e) => setBankName(e.target.value)}
                    className="w-full text-[10px] border border-slate-150 rounded p-1 text-slate-800 font-bold"
                  />
                  <input
                    type="text"
                    value={bankAccountName}
                    placeholder="Account Name"
                    onChange={(e) => setBankAccountName(e.target.value)}
                    className="w-full text-[10px] border border-slate-150 rounded p-1 text-slate-800 font-bold"
                  />
                  <input
                    type="text"
                    value={bankAccountNumber}
                    placeholder="Account Number"
                    onChange={(e) => setBankAccountNumber(e.target.value)}
                    className="w-full text-[10px] font-mono border border-slate-150 rounded p-1 text-slate-800 font-bold"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Section 4: DuitNow / TNG QR Code options */}
          <div className="space-y-3">
            <h4 className="text-[10px] font-extrabold uppercase text-[#dc2626] tracking-wider">Official QR Payment (快捷扫码收款)</h4>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-slate-700 font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={showQrCode}
                  onChange={(e) => setShowQrCode(e.target.checked)}
                  className="rounded text-[#dc2626] focus:ring-[#dc2626] w-3.5 h-3.5"
                />
                <span>Include TNG / DuitNow QR Sticker</span>
              </label>

              {showQrCode && (
                <div className="space-y-1.5 p-2 bg-slate-50 rounded-xl border border-slate-200 bg-white">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[8px] font-bold text-slate-500 uppercase">Provider:</span>
                    <div className="flex bg-slate-150 rounded p-0.5 w-full">
                      <button
                        type="button"
                        onClick={() => setQrType('duitnow')}
                        className={`text-[9px] font-bold py-0.5 px-2 rounded-md flex-1 text-center cursor-pointer transition-all ${
                          qrType === 'duitnow' ? 'bg-[#D12440] text-white shadow-3xs' : 'text-slate-600 hover:text-slate-800'
                        }`}
                      >
                        DuitNow QR
                      </button>
                      <button
                        type="button"
                        onClick={() => setQrType('tng')}
                        className={`text-[9px] font-bold py-0.5 px-2 rounded-md flex-1 text-center cursor-pointer transition-all ${
                          qrType === 'tng' ? 'bg-[#01519C] text-white shadow-3xs' : 'text-slate-600 hover:text-slate-800'
                        }`}
                      >
                        TNG eWallet
                      </button>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-[8px] font-bold text-slate-550 uppercase mb-0.5">Merchant Name</label>
                    <input
                      type="text"
                      value={qrMerchantName}
                      placeholder="e.g. CRE CREDIT & LEASING"
                      onChange={(e) => setQrMerchantName(e.target.value)}
                      className="w-full text-[10px] border border-slate-150 rounded p-1 text-slate-800 font-bold"
                    />
                  </div>

                  <div className="pt-1.5 border-t border-slate-100">
                    <label className="block text-[8px] font-bold text-slate-550 uppercase mb-1">
                      Upload Payment QR Code image (上传真实付款二维码)
                    </label>
                    <div className="flex gap-1.5 items-center">
                      <label className="flex-1 text-center py-1 px-2 border border-dashed border-[#ed85a7]/60 hover:border-[#ed85a7] bg-pink-50/20 hover:bg-pink-50/45 text-pink-600 font-semibold rounded-lg text-[9px] cursor-pointer transition-all">
                        <span>{uploadedQrUrl ? 'Change Image (更替图片)' : 'Choose Image (选图)'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (event) => {
                                if (event.target?.result) {
                                  setUploadedQrUrl(event.target.result as string);
                                }
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                      {uploadedQrUrl && (
                        <button
                          type="button"
                          onClick={() => setUploadedQrUrl(null)}
                          className="px-2 py-1 bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 hover:border-rose-300 font-semibold rounded-lg text-[9px] cursor-pointer transition-all"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PAPER PORTRAIT SIMULATOR */}
      <div className="flex justify-center bg-transparent py-2 text-left">
        <div
          id="A4-simulated-paper"
          className="print-page w-full max-w-[210mm] min-h-[297mm] bg-white text-slate-900 p-8 md:p-12 shadow-xl border border-slate-200 rounded-[24px] font-sans text-left leading-relaxed text-sm select-text relative overflow-hidden"
        >
          {/* Security Repeating Watermark Background */}
          {showWatermark && (
            <div className="absolute inset-0 pointer-events-none opacity-[0.038] xl:opacity-[0.025] overflow-hidden select-none flex flex-wrap justify-center items-center gap-14 rotate-[-18deg] z-0 p-8">
              {Array.from({ length: 48 }).map((_, i) => (
                <span key={i} className="font-mono text-[9px] font-extrabold tracking-[0.25em] uppercase whitespace-nowrap shrink-0">
                  ★ ORIGINAL CRE SECURE LEDGER ★ VERIFIED DOCUMENT ★ DO NOT DUPLICATE (防伪正品) ★
                </span>
              ))}
            </div>
          )}

          {/* Company Seal Header */}
          <div className="border-b-2 border-slate-900 pb-5 mb-5 flex justify-between items-center relative z-10">
            <div className="space-y-2">
              <span className="text-[8px] font-extrabold text-slate-900 bg-[#D0FAFB]/70 border border-slate-900 px-2.5 py-1 uppercase tracking-widest rounded-md">
                OFFICIAL CREDIT INTEGRITY LEDGER (防伪防篡改账单)
              </span>
              <div className="flex items-center gap-3 mt-2">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt="CRE Logo"
                    className="w-14 h-14 object-contain rounded-xl border border-pink-200 bg-white p-1 shadow-xs"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-[#D0FAFB] via-[#FFF0F7] to-[#E1EEFF] flex items-center justify-center font-extrabold text-xs text-slate-900 border border-pink-200">
                    CRE
                  </div>
                )}
                <div>
                  <h1 className="text-base font-extrabold tracking-tight text-slate-900 uppercase font-sans">
                    {companyName}
                  </h1>
                  {companyPhone && (
                    <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider font-bold">
                      Contact Partner: {companyPhone}
                    </p>
                  )}
                </div>
              </div>
            </div>
            
            <div className="text-right space-y-1">
              <div className="inline-block p-1 bg-white relative">
                <div className={`w-20 h-20 border-4 border-double ${activeStamp.border} rounded-full flex flex-col items-center justify-center text-center uppercase leading-none select-none p-1 relative shadow-3xs`}>
                  {/* Decorative stamp inner rings */}
                  <div className={`absolute inset-0.5 rounded-full border border-dashed ${activeStamp.text} opacity-30`} />
                  <span className="text-[5px] tracking-widest font-sans font-extrabold opacity-75">CRE MALAYSIA</span>
                  <span className="font-mono text-[8px] font-black tracking-wide my-1 px-1 py-0.5 rounded bg-white shadow-2xs rotate-[-12deg] border border-slate-100">
                     SECURED
                  </span>
                  <span className="text-[4.5px] tracking-wider font-bold">★ SECURITY DEPT ★</span>
                </div>
              </div>
              <p className="text-[8px] text-slate-400 font-mono font-bold">Printed: {new Date().toISOString().split('T')[0]}</p>
            </div>
          </div>

          {/* Micro-Print Integrity Strip / Dynamic Barcode */}
          <div className="w-full flex items-center justify-between gap-4 py-1.5 px-3 bg-slate-50/60 border border-slate-200/80 mb-5 rounded-xl relative overflow-hidden z-10 no-print-bg">
            <div className="flex items-center gap-2">
              <span className="flex h-1.5 w-1.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#0d9488] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#0d9488]"></span>
              </span>
              <span className="text-[8px] font-mono font-bold tracking-wider text-slate-600 flex items-center gap-2">
                <span>VERIFICATION KEY (核定防伪编号):</span>
                <span className="text-slate-900 bg-white font-black px-2 py-0.5 border border-slate-250 rounded font-mono">{securitySerial}</span>
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="flex flex-col items-end">
                <span className="text-[6px] font-mono text-slate-450 tracking-tight leading-none">SIGNATURE HASH: {plan.id.slice(-6).toUpperCase()}-{customer.code}</span>
              </div>
              <div className="flex items-center gap-[1.5px] h-6 bg-white px-1.5 border border-slate-200 rounded" title="Secure Barcode">
                {[1, 3, 1, 2, 1, 4, 1, 2, 3, 1, 2, 1, 3, 2, 1, 4, 1, 2].map((w, idx) => (
                  <div key={idx} className="bg-slate-900 h-4" style={{ width: `${w * 0.75}px` }} />
                ))}
              </div>
            </div>
          </div>

          {/* Document Title */}
          <div className="text-center mb-6 relative z-10">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 font-display">
              INSTALLMENT PURCHASE & LEASE CONTRACT STATEMENT
            </h2>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5">
              PLAN ID REF: PLN-{plan.id.slice(-5).toUpperCase()} | CLIENT UNIQUE CODE: {customer.code}
            </p>
          </div>

          {/* Dossiers Grid */}
          <div className="grid grid-cols-3 gap-4 border border-slate-200 p-4 mb-6 bg-slate-50/70">
            <div>
              <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider block">DEBTOR / CLIENT DETAILS:</span>
              <p className="font-bold text-slate-900 mt-0.5 font-display text-xs">{customer.name}</p>
              <p className="text-[11px] text-slate-600 mt-1">
                <span className="font-mono font-semibold">IC Number:</span> {customer.icNumber}
              </p>
              <p className="text-[11px] text-slate-600 mt-0.5 font-mono">
                <span className="font-semibold text-slate-400">Phone:</span> {customer.phoneNumber}
              </p>
            </div>
            <div className="border-l border-slate-200 pl-4">
              <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider block">GUARANTOR DETAILS (担保人):</span>
              <p className="font-bold text-slate-900 mt-0.5 font-display text-xs">{customer.guarantorName || 'N/A'}</p>
              <p className="text-[11px] text-slate-600 mt-1">
                <span className="font-mono font-semibold">IC Number:</span> {customer.guarantorIcNumber || 'N/A'}
              </p>
              <p className="text-[11px] text-slate-600 mt-0.5 font-mono">
                <span className="font-semibold text-slate-400">Relation:</span> {customer.guarantorRelation || 'N/A'}
              </p>
              <p className="text-[11px] text-slate-600 mt-0.5 font-mono">
                <span className="font-semibold text-slate-400">Phone:</span> {customer.guarantorPhoneNumber || 'N/A'}
              </p>
            </div>
            <div className="border-l border-slate-200 pl-4">
              <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider block">CREDIT TERMS TIMELINE:</span>
              <p className="text-[11px] text-slate-600 mt-1 flex items-center gap-1 font-mono">
                <span className="font-semibold text-slate-550">Start:</span> {customer.startDate}
              </p>
              <p className="text-[11px] text-slate-600 mt-0.5 flex items-center gap-1 font-mono">
                <span className="font-semibold text-slate-550">Maturity:</span> {customer.endDate}
              </p>
              <p className="text-[11px] text-slate-600 mt-0.5 flex items-center gap-1 font-mono">
                <span className="font-semibold text-slate-550">Tenure:</span> {plan.input.months} months
              </p>
            </div>
          </div>

          {/* Accounting Matrix Breakdown */}
          <div className="mb-6 bg-transparent">
            <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider block mb-2">I. FINANCIAL COEFFICIENT LEDGER</span>
            <table className="w-full text-xs text-left border-collapse border border-slate-200">
              <thead>
                <tr className="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider text-[9px] border-b border-slate-200">
                  <th className="py-2 px-3">Debit Ledger Item</th>
                  <th className="py-2 px-3 text-right">Amortization Subtotal</th>
                  <th className="py-2 px-3 text-right">Percentage / Ratio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                <tr>
                  <td className="py-1.5 px-3 font-semibold text-slate-800">Core Principal Financing (本金)</td>
                  <td className="py-1.5 px-3 text-right font-mono text-slate-900">{formatRM(plan.input.principalAmount)}</td>
                  <td className="py-1.5 px-3 text-right text-slate-400 font-mono">100.00%</td>
                </tr>
                <tr>
                  <td className="py-1.5 px-3 font-semibold text-slate-800">
                    Maturity Credit Lease Interest (利息 - {plan.input.interestType === 'flat' ? 'Flat Lease' : 'Monthly Simple'})
                  </td>
                  <td className="py-1.5 px-3 text-right font-mono text-slate-900">+{formatRM(plan.totalInterest)}</td>
                  <td className="py-1.5 px-3 text-right text-slate-400 font-mono">{plan.input.interestRatePercent.toFixed(2)}%</td>
                </tr>
                <tr>
                  <td className="py-1.5 px-3 font-semibold text-slate-800">Administrative & Services surcharge (服务费)</td>
                  <td className="py-1.5 px-3 text-right font-mono text-slate-900">+{formatRM(plan.totalServiceFee)}</td>
                  <td className="py-1.5 px-3 text-right text-slate-400 font-mono">
                    {plan.input.serviceFeeType === 'percent' ? `${plan.input.serviceFeeValue}%` : 'Fixed RM'}
                  </td>
                </tr>
                <tr className="text-blue-900 bg-slate-50/50">
                  <td className="py-1.5 px-3 font-semibold">Special Premium Credits Slashed (折扣优惠)</td>
                  <td className="py-1.5 px-3 text-right font-mono">-{formatRM(plan.totalDiscount)}</td>
                  <td className="py-1.5 px-3 text-right text-slate-500 font-mono">
                    {plan.input.discountType === 'percent' ? `${plan.input.discountValue}%` : 'Fixed RM'}
                  </td>
                </tr>
                {simulatedStats.totalLateFees > 0 && (
                  <tr className="text-rose-900 bg-rose-50/20">
                    <td className="py-1.5 px-3 font-semibold">Accumulated Late Payment Charges (逾期延迟罚金)</td>
                    <td className="py-1.5 px-3 text-right font-mono">+{formatRM(simulatedStats.totalLateFees)}</td>
                    <td className="py-1.5 px-3 text-right text-rose-800 font-mono">Simulated Clock</td>
                  </tr>
                )}
                {simulatedStats.overallPenaltyAmount > 0 && (
                  <tr className="text-rose-900 bg-rose-50/20">
                    <td className="py-1.5 px-3 font-semibold">Contract Expiry Breach Fine (违约金)</td>
                    <td className="py-1.5 px-3 text-right font-mono">+{formatRM(simulatedStats.overallPenaltyAmount)}</td>
                    <td className="py-1.5 px-3 text-right text-rose-800 font-mono">Overdue Timeline</td>
                  </tr>
                )}
                <tr className="bg-slate-900 text-white font-bold uppercase text-[10px]">
                  <td className="py-2.5 px-3">Net Balance Receivable Limit</td>
                  <td className="py-2.5 px-3 text-right font-mono">{formatRM(simulatedStats.overallFinalAmount)}</td>
                  <td className="py-2.5 px-3 text-right text-slate-350 font-mono">Net Ledger</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Sub schedules */}
          <div className="mb-6 relative z-10">
            <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider block mb-2">II. AMORTIZATION REPAYMENT MILESTONES (还款里程碑明细)</span>
            <table className="w-full text-[10px] text-left border-collapse border border-slate-200">
              <thead>
                <tr className="bg-slate-50 font-bold text-slate-705 uppercase tracking-wider text-[8px] border-b border-slate-200">
                  <th className="py-1 px-2 text-left">Month</th>
                  <th className="py-1 px-2 text-left">Due Date Details</th>
                  <th className="py-1 px-2 text-right">Payment Size</th>
                  <th className="py-1 px-2 text-right">Principal</th>
                  <th className="py-1 px-2 text-right">Interest</th>
                  <th className="py-1 px-2 text-right">Paid Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {evaluatedSchedule.map((inst) => (
                  <tr key={inst.monthNumber}>
                    <td className="py-1.5 px-2 font-sans text-slate-500">Month-{inst.monthNumber}</td>
                    <td className="py-1.5 px-2 font-sans text-slate-500">{inst.dueDate}</td>
                    <td className="py-1.5 px-2 text-right text-slate-900 font-bold">{formatRM(inst.amount)}</td>
                    <td className="py-1.5 px-2 text-right text-slate-450">{formatRM(inst.principalShare)}</td>
                    <td className="py-1.5 px-2 text-right text-slate-450">{formatRM(inst.interestShare)}</td>
                    <td className="py-1.5 px-2 text-right">
                      <span className={`font-sans text-[8px] px-1.5 py-0.5 rounded font-bold uppercase border ${
                        inst.status === 'Paid'
                          ? 'bg-[#D0FAFB] text-teal-850 border-[#B5F2F4]'
                          : inst.status === 'Overdue'
                          ? 'bg-[#FBE2ED] text-rose-900 border-[#E9C6D7]'
                          : 'bg-white text-slate-600 border-slate-200'
                      }`}>
                        {inst.status === 'Paid' ? 'Cleared' : inst.status === 'Overdue' ? 'Overdue' : 'Unpaid'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Section III: Extra Fees & Late Charges Breakdown */}
          <div className="mb-6 relative z-10">
            <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider block mb-2">
              III. EXTRA SURCHARGES & DELINQUENCY SUMMARY (额外费用与逾期滞纳金账目汇总)
            </span>
            <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Custom Surcharges Sub-column */}
                <div>
                  <span className="text-[8px] font-extrabold text-slate-400 uppercase tracking-widest block mb-2 px-1 py-0.5 bg-slate-100 rounded-sm inline-block">
                    A. EXTRA FEES & CHARGES / 额外增收费用明细
                  </span>
                  {plan.extraFees && plan.extraFees.length > 0 ? (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                      {plan.extraFees.map((f) => (
                        <div key={f.id} className="flex justify-between items-center text-[10.5px] font-mono py-1 border-b border-slate-150/50 last:border-0">
                          <span className="text-slate-600 font-sans truncate pr-2" title={f.reason}>
                            <strong>{f.reason}</strong> <span className="text-[8.5px] text-slate-450 block sm:inline">({f.date})</span>
                          </span>
                          <span className="font-bold text-slate-900 shrink-0">+{formatRM(f.amount)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center border border-dashed border-slate-200 rounded-xl py-6 bg-white">
                      <Ticket className="w-5 h-5 text-slate-300 mb-1" />
                      <p className="text-[9px] text-slate-400 text-center uppercase font-bold tracking-wider">
                        No custom extra fees allocated
                      </p>
                    </div>
                  )}
                </div>

                {/* Delinquency Surcharges Sub-column */}
                <div className="border-t pt-3 md:border-t-0 md:pt-0 md:border-l md:pl-5 border-slate-200">
                  <span className="text-[8px] font-extrabold text-slate-400 uppercase tracking-widest block mb-2 px-1 py-0.5 bg-slate-100 rounded-sm inline-block">
                    B. ACCRUED LATE PENALTIES / 逾期惩罚与违约汇总
                  </span>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-[10.5px] font-mono py-1 border-b border-dashed border-slate-200">
                      <span className="text-slate-600 font-sans">Total Late Payment Surcharges:</span>
                      <span className="font-bold text-slate-900">+{formatRM(simulatedStats.totalLateFees)}</span>
                    </div>

                    <div className="flex justify-between items-center text-[10.5px] font-mono py-1 border-b border-dashed border-slate-200">
                      <span className="text-slate-600 font-sans">Contract Expiry Breach Fine:</span>
                      <span className="font-bold text-slate-900">+{formatRM(simulatedStats.overallPenaltyAmount)}</span>
                    </div>

                    {/* Breakdown details if any installments are overdue */}
                    {evaluatedSchedule.some(inst => inst.status === 'Overdue' || inst.lateFeeCharged > 0) ? (
                      <div className="mt-2.5 p-2 bg-rose-50/40 rounded-xl border border-rose-100 text-[9px] text-rose-900 leading-normal">
                        <span className="font-black uppercase tracking-wider block mb-1 text-[8px] flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
                          <span>Active Arrears Alert:</span>
                        </span>
                        <div className="space-y-1">
                          {evaluatedSchedule.filter(inst => inst.status === 'Overdue' || inst.lateFeeCharged > 0).map(inst => (
                            <div key={inst.monthNumber} className="flex justify-between font-mono">
                              <span>Month-{inst.monthNumber} ({inst.dueDate}):</span>
                              <span className="font-semibold text-rose-800">+{formatRM(inst.lateFeeCharged)} ({inst.overdueDays}d Late)</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2.5 p-2 bg-[#D0FAFB]/30 rounded-xl border border-[#B5F2F4] text-[9px] text-[#0d9488] leading-tight text-center font-bold uppercase tracking-wider flex items-center justify-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Credit Standing: No Late Penalties</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Surcharge Grand Indicator */}
              <div className="mt-4 pt-3 border-t-2 border-double border-slate-200 flex justify-between items-center bg-slate-100/10 -mx-4 -mb-4 px-4 py-2.5 rounded-b-2xl">
                <div>
                  <span className="text-[8px] font-extrabold text-slate-400 uppercase tracking-widest block">GRAND SURCHARGES LEDGER BALANCE:</span>
                  <p className="text-[9.5px] text-slate-450 font-sans mt-0.5 leading-none">Sum of all custom extra fees, monthly late fines, and breach penalties</p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-black font-mono text-rose-600 bg-rose-50/50 px-2.5 py-1 rounded border border-rose-150">
                    +{formatRM(simulatedStats.totalLateFees + simulatedStats.overallPenaltyAmount + (plan.extraFees?.reduce((sum, f) => sum + f.amount, 0) ?? 0))}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Bank Instructions (收款银行与二维码防伪指南) */}
          {(showBankDetails || showQrCode) && (
            <div className={`mb-6 border border-slate-200/80 p-4 bg-slate-50/50 rounded-2xl text-[9px] font-sans relative z-10 no-print-bg ${!showBankDetails ? 'text-center' : ''}`}>
              <h4 className={`font-extrabold text-[#0f172a] uppercase tracking-widest text-[8px] mb-2.5 flex items-center gap-1.5 border-b border-slate-200 pb-1.5 ${!showBankDetails ? 'justify-center text-center' : ''}`}>
                <span className="inline-block w-1.5 h-3 bg-indigo-500 rounded-sm"></span>
                <span>IV. OFFICIAL TRANSACTION SIGN-OFF CHANNELS / 官方指定核准还款渠道</span>
              </h4>
              <div className={`flex flex-col gap-4 ${showBankDetails ? 'md:flex-row justify-between items-stretch' : 'justify-center items-center text-center'}`}>
                {showBankDetails && (
                  <div className="flex-1 space-y-2 text-left">
                    <span className="text-[7.5px] text-slate-400 font-extrabold block uppercase tracking-wider mb-1">DIRECT WIRE / BANK TRANSFER INSTRUCTIONS:</span>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <div className="bg-white p-2 border border-slate-150 rounded-xl space-y-0.5 shadow-3xs">
                        <span className="text-[7px] text-slate-400 font-bold block uppercase leading-none">Beneficiary Bank / 收款银行</span>
                        <p className="text-[9.5px] font-black text-slate-850 leading-tight">{bankName}</p>
                      </div>
                      <div className="bg-white p-2 border border-slate-150 rounded-xl space-y-0.5 shadow-3xs">
                        <span className="text-[7px] text-slate-400 font-bold block uppercase leading-none">Recipient Name / 账户持有人</span>
                        <p className="text-[9.5px] font-black text-slate-850 leading-tight truncate">{bankAccountName}</p>
                      </div>
                      <div className="bg-white p-2 border border-slate-150 rounded-xl space-y-0.5 shadow-3xs bg-gradient-to-tr from-[#E1EEFF]/15 to-transparent">
                        <span className="text-[7px] text-slate-400 font-bold block uppercase leading-none">Credit Account Number / 官方专用帐号</span>
                        <p className="text-[9.5px] font-black text-indigo-700 font-mono tracking-wider">{bankAccountNumber}</p>
                      </div>
                    </div>
                  </div>
                )}

                {showQrCode && (
                  <div className={`flex justify-center items-center ${showBankDetails ? 'md:justify-end shrink-0' : 'mx-auto'}`}>
                    {renderQRCodeSVG()}
                  </div>
                )}
              </div>
              <p className={`text-[7.5px] text-rose-600 font-semibold mt-2.5 flex items-center justify-center gap-1 leading-normal ${!showBankDetails ? 'justify-center' : ''}`}>
                <span className="font-extrabold shrink-0">⚠️ CRITICAL SECURITY WARNING:</span>
                <span>Confirm beneficiary accounts or scanned credentials match exactly before committing any deposits to prevent electronic redirection or malicious hijacks. Keep your print invoice confidential.</span>
              </p>
            </div>
          )}

          {/* Legal Bindings */}
          <div className="mb-6 border border-pink-150/60 p-4.5 bg-gradient-to-tr from-[#D0FAFB]/10 via-[#FFF0F7]/15 to-[#E1EEFF]/10 rounded-2xl text-[9px] text-slate-755 leading-normal font-sans relative z-10">
            <h4 className="font-extrabold text-slate-900 uppercase tracking-widest text-[8px] mb-2 flex items-center gap-1.5 border-b border-pink-100 pb-1.5">
              <span>Standard Legal Covenants / 租售条款和条例</span>
            </h4>
            {customTerms ? (
              <div className="whitespace-pre-wrap leading-relaxed space-y-1 text-slate-700 font-mono text-[8.5px] font-semibold">
                {customTerms}
              </div>
            ) : (
              <ol className="list-decimal pl-4.5 space-y-1.5 text-slate-600">
                <li>
                  <strong>Interest Guarantee:</strong> Under credit sales guidelines, {plan.input.interestType === 'flat' ? 'Flat Interest' : 'Monthly Interest'} rates apply to the collective tenure limit. Advanced settlements can request early adjustments subject to the creditor board rules.
                </li>
                <li>
                  <strong>Overdue Penalties:</strong> Delinquencies beyond contract payment periods incur late fees of {' '}
                  <span className="font-semibold text-slate-900">{plan.input.latePaymentFeeType === 'daily' ? `RM ${plan.input.latePaymentFeeValue}/day` : `${plan.input.latePaymentFeeValue}% fixed`}</span>, applied upon grace window expiration.
                </li>
                <li>
                  <strong>Contract Expiry Breach:</strong> If outstanding balances persist past maturity limits (
                  <span className="font-bold text-slate-905">{customer.endDate}</span>), an automated contract breach penalty fee of {' '}
                  <span className="font-bold text-slate-905">{formatRM(plan.input.penaltyFeeAmount)}</span> is appended.
                </li>
                <li>
                  <strong>Malaysia Law Declaration:</strong> This printed receipt represents a valid transaction reference pursuant to Credit Hire Purchase sales procedures. Both parties acknowledge terms lists are legally binding.
                </li>
              </ol>
            )}
          </div>

          {/* Signature Deck */}
          <div className="mt-8 grid grid-cols-3 gap-6 font-sans text-center relative z-10">
            <div>
              <div className="border-b border-slate-300 h-10 w-full mx-auto max-w-[140px]" />
              <p className="font-bold text-[9px] text-slate-800 mt-2 uppercase">{customer.name}</p>
              <p className="text-[7.5px] text-slate-400 uppercase tracking-widest font-bold">Debtor Signature</p>
              <p className="text-[7.5px] text-slate-400 font-mono">IC: {customer.icNumber}</p>
            </div>
            <div>
              <div className="border-b border-slate-300 h-10 w-full mx-auto max-w-[140px]" />
              <p className="font-bold text-[9px] text-slate-800 mt-2 uppercase">{customer.guarantorName || 'N/A'}</p>
              <p className="text-[7.5px] text-slate-400 uppercase tracking-widest font-bold">Guarantor Signature</p>
              <p className="text-[7.5px] text-slate-400 font-mono">IC: {customer.guarantorIcNumber || 'N/A'}</p>
            </div>
            <div>
              <div className="border-b border-slate-300 h-10 w-full mx-auto max-w-[140px]" />
              <p className="font-bold text-[9px] text-slate-800 mt-2 uppercase">{companyName}</p>
              <p className="text-[7.5px] text-slate-400 uppercase tracking-widest font-bold">Authorized Officer Signatory</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
