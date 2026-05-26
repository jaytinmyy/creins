import React, { useState, useRef, useEffect } from 'react';
import { Customer, UserRole } from '../types';
import { generateCustomerCode, formatRM } from '../utils/calc';
import { mockICPlaceholder, mockProofPlaceholder } from '../utils/mockData';
import { ShieldAlert, User, ShieldCheck, Mail, UploadCloud, CheckCircle2, UserPlus, X } from 'lucide-react';

interface CustomerFormProps {
  onAddCustomer: (customer: Omit<Customer, 'id' | 'code' | 'active'>) => void;
  onEditCustomer?: (customer: Customer) => void;
  customerToEdit?: Customer | null;
  nextIndex: number;
  role: UserRole;
  onClose: () => void;
}

export const CustomerForm: React.FC<CustomerFormProps> = ({
  onAddCustomer,
  onEditCustomer,
  customerToEdit,
  nextIndex,
  role,
  onClose,
}) => {
  const isReadOnly = role === 'Viewer';
  const isEditMode = !!customerToEdit;
  const clientCode = customerToEdit ? customerToEdit.code : generateCustomerCode(nextIndex);

  const [formData, setFormData] = useState({
    name: '',
    icNumber: '',
    phoneNumber: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: (() => {
      const d = new Date();
      d.setMonth(d.getMonth() + 6); // default 6 months from now
      return d.toISOString().split('T')[0];
    })(),
    guarantorName: '',
    guarantorIcNumber: '',
    guarantorPhoneNumber: '',
    guarantorRelation: '',
  });

  const [icImages, setIcImages] = useState<string[]>([]);
  const [proofImages, setProofImages] = useState<string[]>([]);

  // Sync state if customerToEdit changes
  useEffect(() => {
    if (customerToEdit) {
      setFormData({
        name: customerToEdit.name,
        icNumber: customerToEdit.icNumber,
        phoneNumber: customerToEdit.phoneNumber,
        startDate: customerToEdit.startDate,
        endDate: customerToEdit.endDate,
        guarantorName: customerToEdit.guarantorName || '',
        guarantorIcNumber: customerToEdit.guarantorIcNumber || '',
        guarantorPhoneNumber: customerToEdit.guarantorPhoneNumber || '',
        guarantorRelation: customerToEdit.guarantorRelation || '',
      });
      if (customerToEdit.icImages && customerToEdit.icImages.length > 0) {
        setIcImages(customerToEdit.icImages);
      } else if (customerToEdit.icImage) {
        setIcImages([customerToEdit.icImage]);
      } else {
        setIcImages([mockICPlaceholder]);
      }

      if (customerToEdit.proofImages && customerToEdit.proofImages.length > 0) {
        setProofImages(customerToEdit.proofImages);
      } else if (customerToEdit.proofImage) {
        setProofImages([customerToEdit.proofImage]);
      } else {
        setProofImages([mockProofPlaceholder]);
      }
    } else {
      setFormData({
        name: '',
        icNumber: '',
        phoneNumber: '',
        startDate: new Date().toISOString().split('T')[0],
        endDate: (() => {
          const d = new Date();
          d.setMonth(d.getMonth() + 6);
          return d.toISOString().split('T')[0];
        })(),
        guarantorName: '',
        guarantorIcNumber: '',
        guarantorPhoneNumber: '',
        guarantorRelation: '',
      });
      setIcImages([mockICPlaceholder]);
      setProofImages([mockProofPlaceholder]);
    }
  }, [customerToEdit]);

  const [icFileName, setIcFileName] = useState<string>(customerToEdit ? 'Existing_IC_Document.png' : 'Default_Simulated_IC.png');
  const [proofFileName, setProofFileName] = useState<string>(customerToEdit ? 'Existing_Proof_Document.png' : 'Default_Simulated_Proof.png');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const icInputRef = useRef<HTMLInputElement>(null);
  const proofInputRef = useRef<HTMLInputElement>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const ProcessFile = (file: File, type: 'ic' | 'proof') => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const base64Str = reader.result;
        if (type === 'ic') {
          setIcImages((prev) => {
            const filtered = prev.filter(img => img !== mockICPlaceholder);
            if (filtered.length >= 2) return prev; // limit to 2
            return [...filtered, base64Str];
          });
          setIcFileName(file.name);
        } else {
          setProofImages((prev) => {
            const filtered = prev.filter(img => img !== mockProofPlaceholder);
            if (filtered.length >= 5) return prev; // limit to 5
            return [...filtered, base64Str];
          });
          setProofFileName(file.name);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const deleteImage = (type: 'ic' | 'proof', idxToDelete: number) => {
    if (type === 'ic') {
      setIcImages((prev) => {
        const res = prev.filter((_, idx) => idx !== idxToDelete);
        return res.length === 0 ? [mockICPlaceholder] : res;
      });
    } else {
      setProofImages((prev) => {
        const res = prev.filter((_, idx) => idx !== idxToDelete);
        return res.length === 0 ? [mockProofPlaceholder] : res;
      });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'ic' | 'proof') => {
    if (e.target.files && e.target.files[0]) {
      ProcessFile(e.target.files[0], type);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, type: 'ic' | 'proof') => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      ProcessFile(e.dataTransfer.files[0], type);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;

    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = 'Full name is required';
    if (!formData.icNumber.trim()) {
      newErrors.icNumber = 'IC Number is required';
    } else if (!/^\d{6}-\d{2}-\d{4}$/.test(formData.icNumber.trim()) && formData.icNumber.trim().length < 12) {
      newErrors.icNumber = 'Standard format: YYMMDD-PB-XXXX (e.g. 910212-14-1122)';
    }
    if (!formData.phoneNumber.trim()) {
      newErrors.phoneNumber = 'Phone number is required';
    }

    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate);
    if (end <= start) {
      newErrors.endDate = 'End date must be strictly after Start date';
    }

    // Guarantor Validation (Must have 1 guarantor)
    if (!formData.guarantorName.trim()) {
      newErrors.guarantorName = 'Guarantor full name is required (必须填写担保人姓名)';
    }
    if (!formData.guarantorIcNumber.trim()) {
      newErrors.guarantorIcNumber = 'Guarantor IC Number is required (必须填写担保人身份证号)';
    } else if (!/^\d{6}-\d{2}-\d{4}$/.test(formData.guarantorIcNumber.trim()) && formData.guarantorIcNumber.trim().length < 12) {
      newErrors.guarantorIcNumber = 'Standard format: YYMMDD-PB-XXXX (e.g. 680512-10-5334)';
    }
    if (!formData.guarantorPhoneNumber.trim()) {
      newErrors.guarantorPhoneNumber = 'Guarantor phone number is required (必须填写担保人电话号码)';
    }
    if (!formData.guarantorRelation.trim()) {
      newErrors.guarantorRelation = 'Guarantor relationship description is required (必须填写担保人关系)';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const finalIcImages = icImages.filter(img => img !== mockICPlaceholder);
    const finalProofImages = proofImages.filter(img => img !== mockProofPlaceholder);

    if (isEditMode && customerToEdit && onEditCustomer) {
      onEditCustomer({
        ...customerToEdit,
        name: formData.name.trim(),
        icNumber: formData.icNumber.trim(),
        phoneNumber: formData.phoneNumber.trim(),
        startDate: formData.startDate,
        endDate: formData.endDate,
        icImage: finalIcImages[0] || mockICPlaceholder,
        proofImage: finalProofImages[0] || mockProofPlaceholder,
        icImages: finalIcImages,
        proofImages: finalProofImages,
        guarantorName: formData.guarantorName.trim(),
        guarantorIcNumber: formData.guarantorIcNumber.trim(),
        guarantorPhoneNumber: formData.guarantorPhoneNumber.trim(),
        guarantorRelation: formData.guarantorRelation.trim(),
      });
    } else {
      onAddCustomer({
        name: formData.name.trim(),
        icNumber: formData.icNumber.trim(),
        phoneNumber: formData.phoneNumber.trim(),
        icImage: finalIcImages[0] || mockICPlaceholder,
        proofImage: finalProofImages[0] || mockProofPlaceholder,
        icImages: finalIcImages,
        proofImages: finalProofImages,
        startDate: formData.startDate,
        endDate: formData.endDate,
        guarantorName: formData.guarantorName.trim(),
        guarantorIcNumber: formData.guarantorIcNumber.trim(),
        guarantorPhoneNumber: formData.guarantorPhoneNumber.trim(),
        guarantorRelation: formData.guarantorRelation.trim(),
      });
    }
  };

  return (
    <div className="bg-white/95 backdrop-blur-xl text-left rounded-3xl p-7 border border-slate-200/70 soft-card-shadow max-w-2xl mx-auto">
      <div className="flex items-center justify-between border-b border-slate-100 pb-5 mb-6">
        <div className="flex items-center space-x-2.5">
          <UserPlus className="w-5 h-5 text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-800 tracking-tight uppercase">
            {isEditMode ? 'Edit Debtor Profile' : 'Register Core Debtor Profile'}
          </h2>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-650 transition-all p-1.5 hover:bg-slate-50 rounded-full cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {isReadOnly ? (
        <div className="flex items-center gap-3 p-4 bg-[#fdf0f5] border border-rose-100 text-rose-950 rounded-2xl text-[11.5px] leading-relaxed mb-6 font-light shadow-xs">
          <ShieldAlert className="w-5 h-5 shrink-0 text-rose-500" />
          <p>
            <strong className="font-semibold">Role Restriction:</strong> Your current access level (<strong className="font-semibold">Viewer Only</strong>) is read-only.
            Please switch user roles at the top right to register or edit customers.
          </p>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-6 font-sans">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          
          {/* Automatic Code Info */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Client Unique ID Code
            </label>
            <input
              type="text"
              value={clientCode}
              disabled
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3.5 text-slate-505 font-mono text-xs cursor-not-allowed font-medium"
            />
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Full Name (姓名)
            </label>
            <input
              type="text"
              name="name"
              placeholder="e.g. Tan Ah Kow"
              value={formData.name}
              onChange={handleInputChange}
              disabled={isReadOnly}
              className={`w-full border rounded-xl py-2.5 px-3.5 text-xs transition-all focus:outline-none focus:ring-1 ${
                errors.name
                  ? 'border-rose-450 bg-rose-50/55 text-slate-800'
                  : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50 text-slate-900 focus:bg-white focus:border-slate-400 focus:ring-slate-300'
              }`}
            />
            {errors.name && <p className="text-rose-650 text-[10.5px] mt-1.5 font-medium">{errors.name}</p>}
          </div>

          {/* Identity Card Number */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Identity Card Number (IC/Passport)
            </label>
            <input
              type="text"
              name="icNumber"
              placeholder="e.g. 920415-14-5339"
              value={formData.icNumber}
              onChange={handleInputChange}
              disabled={isReadOnly}
              className={`w-full border rounded-xl py-2.5 px-3.5 text-xs font-mono transition-all focus:outline-none focus:ring-1 ${
                errors.icNumber
                  ? 'border-rose-450 bg-rose-50/55 text-slate-805'
                  : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50 text-slate-900 focus:bg-white focus:border-slate-400 focus:ring-slate-300'
              }`}
            />
            {errors.icNumber ? (
              <p className="text-rose-655 text-[10.5px] mt-1.5 font-medium">{errors.icNumber}</p>
            ) : (
              <p className="text-[9px] text-slate-450 mt-1.5 leading-tight font-light font-sans">Standard format: YYMMDD-PB-XXXX</p>
            )}
          </div>

          {/* Phone Number */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Phone Number
            </label>
            <input
              type="text"
              name="phoneNumber"
              placeholder="+6012-XXXXXXX"
              value={formData.phoneNumber}
              onChange={handleInputChange}
              disabled={isReadOnly}
              className={`w-full border rounded-xl py-2.5 px-3.5 text-xs transition-all focus:outline-none focus:ring-1 ${
                errors.phoneNumber
                  ? 'border-rose-450 bg-rose-50/55 text-slate-800'
                  : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50 text-slate-900 focus:bg-white focus:border-slate-400 focus:ring-slate-300 font-mono'
              }`}
            />
            {errors.phoneNumber && <p className="text-rose-655 text-[10.5px] mt-1.5 font-medium">{errors.phoneNumber}</p>}
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Lease Start Date
            </label>
            <input
              type="date"
              name="startDate"
              value={formData.startDate}
              onChange={handleInputChange}
              disabled={isReadOnly}
              className="w-full border border-slate-200 bg-slate-50/50 hover:bg-slate-50 focus:bg-white text-slate-800 rounded-xl py-2.5 px-3.5 text-xs font-mono focus:outline-none focus:border-slate-400 transition-all"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Lease Maturity Date
            </label>
            <input
              type="date"
              name="endDate"
              value={formData.endDate}
              onChange={handleInputChange}
              disabled={isReadOnly}
              className={`w-full border rounded-xl py-2.5 px-3.5 text-xs font-mono transition-all focus:outline-none ${
                errors.endDate ? 'border-rose-400 bg-rose-50/45' : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50 focus:bg-white focus:border-slate-400 text-slate-800'
              }`}
            />
            {errors.endDate ? (
              <p className="text-rose-655 text-[10.5px] mt-1.5 font-medium">{errors.endDate}</p>
            ) : (
              <p className="text-[9px] text-slate-440 mt-1.5 leading-tight font-light font-sans">Contract resolution calendar threshold</p>
            )}
          </div>
        </div>

        {/* Guarantor Profile Section */}
        <div className="border-t border-slate-100 pt-6 mt-6">
          <h3 className="text-xs font-black text-slate-805 uppercase tracking-wider mb-4 flex items-center gap-2">
            <span className="w-1.5 h-3 bg-indigo-600 rounded-full"></span>
            <span>Guarantor Information (担保人信息 - 必须填写1位)</span>
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Guarantor Name */}
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Guarantor Full Name (担保人姓名)
              </label>
              <input
                type="text"
                name="guarantorName"
                placeholder="e.g. Tan Ah Kow (Guarantor)"
                value={formData.guarantorName}
                onChange={handleInputChange}
                disabled={isReadOnly}
                className={`w-full border rounded-xl py-2.5 px-3.5 text-xs transition-all focus:outline-none focus:ring-1 ${
                  errors.guarantorName
                    ? 'border-rose-450 bg-rose-50/55 text-slate-800'
                    : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50 text-slate-900 focus:bg-white focus:border-slate-400 focus:ring-slate-300'
                }`}
              />
              {errors.guarantorName && <p className="text-rose-650 text-[10.5px] mt-1.5 font-medium">{errors.guarantorName}</p>}
            </div>

            {/* Guarantor IC Number */}
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Guarantor IC Number (担保人身份证号)
              </label>
              <input
                type="text"
                name="guarantorIcNumber"
                placeholder="e.g. 650412-14-1122"
                value={formData.guarantorIcNumber}
                onChange={handleInputChange}
                disabled={isReadOnly}
                className={`w-full border rounded-xl py-2.5 px-3.5 text-xs font-mono transition-all focus:outline-none focus:ring-1 ${
                  errors.guarantorIcNumber
                    ? 'border-rose-450 bg-rose-50/55 text-slate-805'
                    : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50 text-slate-900 focus:bg-white focus:border-slate-400 focus:ring-slate-300'
                }`}
              />
              {errors.guarantorIcNumber ? (
                <p className="text-rose-655 text-[10.5px] mt-1.5 font-medium">{errors.guarantorIcNumber}</p>
              ) : (
                <p className="text-[9px] text-slate-450 mt-1.5 leading-tight font-light font-sans">Standard format: YYMMDD-PB-XXXX</p>
              )}
            </div>

            {/* Guarantor Phone Number */}
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Guarantor Phone Number (担保人电话号码)
              </label>
              <input
                type="text"
                name="guarantorPhoneNumber"
                placeholder="+6012-XXXXXXX"
                value={formData.guarantorPhoneNumber}
                onChange={handleInputChange}
                disabled={isReadOnly}
                className={`w-full border rounded-xl py-2.5 px-3.5 text-xs font-mono transition-all focus:outline-none focus:ring-1 ${
                  errors.guarantorPhoneNumber
                    ? 'border-rose-450 bg-rose-50/55 text-slate-800'
                    : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50 text-slate-900 focus:bg-white focus:border-slate-400 focus:ring-slate-300'
                }`}
              />
              {errors.guarantorPhoneNumber && <p className="text-rose-655 text-[10.5px] mt-1.5 font-medium">{errors.guarantorPhoneNumber}</p>}
            </div>

            {/* Guarantor Relationship */}
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Guarantor Relationship (担保人关系)
              </label>
              <input
                type="text"
                name="guarantorRelation"
                placeholder="e.g. Spouse (配偶) or Father (父亲)"
                value={formData.guarantorRelation}
                onChange={handleInputChange}
                disabled={isReadOnly}
                className={`w-full border rounded-xl py-2.5 px-3.5 text-xs transition-all focus:outline-none focus:ring-1 ${
                  errors.guarantorRelation
                    ? 'border-rose-450 bg-rose-50/55 text-slate-800'
                    : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50 text-slate-900 focus:bg-white focus:border-slate-400 focus:ring-slate-300'
                }`}
              />
              {errors.guarantorRelation && <p className="text-rose-655 text-[10.5px] mt-1.5 font-medium">{errors.guarantorRelation}</p>}
            </div>
          </div>
        </div>

        {/* File Drag and Drop Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
          
          {/* IC File Upload */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2 flex justify-between items-center">
              <span>IC / Passport Attachment Image (IC 图片 - 最多2张)</span>
              <span className="text-[#0d9488] font-bold">
                ({icImages.filter(img => img !== mockICPlaceholder).length}/2 uploaded)
              </span>
            </label>
            <div
              onDragOver={handleDragOver}
              onDrop={(e) => !isReadOnly && handleDrop(e, 'ic')}
              onClick={() => {
                const count = icImages.filter(img => img !== mockICPlaceholder).length;
                if (!isReadOnly && count < 2) {
                  icInputRef.current?.click();
                }
              }}
              className={`border border-dashed rounded-2xl p-5 text-center cursor-pointer transition flex flex-col items-center justify-center min-h-[120px] ${
                isReadOnly 
                  ? 'opacity-65 cursor-not-allowed bg-slate-50/50 border-slate-200'
                  : icImages.filter(img => img !== mockICPlaceholder).length >= 2
                    ? 'bg-slate-50 border-slate-200 cursor-not-allowed opacity-75'
                    : 'bg-teal-50/15 hover:bg-teal-50/35 border-teal-200/90'
              }`}
            >
              <input
                type="file"
                ref={icInputRef}
                className="hidden"
                accept="image/*"
                onChange={(e) => handleFileChange(e, 'ic')}
                disabled={isReadOnly || icImages.filter(img => img !== mockICPlaceholder).length >= 2}
              />
              <UploadCloud className="w-5 h-5 text-teal-600/70 mb-2" />
              <div className="text-[11.5px] font-medium text-slate-800">
                {icImages.filter(img => img !== mockICPlaceholder).length >= 2 ? (
                  <span className="text-teal-700 font-semibold text-xs">Maximum limit reached (2/2)</span>
                ) : icFileName && icImages.length > 0 && icImages[0] !== mockICPlaceholder ? (
                  <span className="text-slate-850 font-mono inline-flex items-center gap-1.5 bg-teal-100/40 px-2.5 py-1 rounded-xl text-[10px] border border-teal-200/50 max-w-[200px] truncate">
                    <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0" /> Upload More
                  </span>
                ) : (
                  'Drag & Drop or Tap to Upload IC'
                )}
              </div>
              <p className="text-[9px] text-slate-400 mt-1.5 font-light font-sans">PNG, JPG, SVG supported (Auto Base64 URL)</p>
            </div>

            {/* IC Image Grid Thumbnails */}
            {icImages.length > 0 && (
              <div className="mt-3 grid grid-cols-2 gap-2 max-w-xs mx-auto">
                {icImages.map((img, idx) => (
                  <div key={idx} className="relative group border border-slate-100 rounded-xl p-1.5 bg-slate-50 flex items-center justify-center h-20 shadow-2xs transition-all hover:scale-102">
                    <img src={img} alt={`IC #${idx + 1}`} className="max-h-full max-w-full object-contain rounded-lg" referrerPolicy="no-referrer" />
                    {img !== mockICPlaceholder && !isReadOnly && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); deleteImage('ic', idx); }}
                        className="absolute -top-1.5 -right-1.5 bg-red-500 hover:bg-red-650 text-white rounded-full p-1 shadow-md transition-all cursor-pointer opacity-90 hover:opacity-100"
                        title="Delete image"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Proof Evidence Upload */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2 flex justify-between items-center">
              <span>Legal Evidence / Contract Proof File (证明文件 - 最多5张)</span>
              <span className="text-rose-600 font-bold">
                ({proofImages.filter(img => img !== mockProofPlaceholder).length}/5 uploaded)
              </span>
            </label>
            <div
              onDragOver={handleDragOver}
              onDrop={(e) => !isReadOnly && handleDrop(e, 'proof')}
              onClick={() => {
                const count = proofImages.filter(img => img !== mockProofPlaceholder).length;
                if (!isReadOnly && count < 5) {
                  proofInputRef.current?.click();
                }
              }}
              className={`border border-dashed rounded-2xl p-5 text-center cursor-pointer transition flex flex-col items-center justify-center min-h-[120px] ${
                isReadOnly 
                  ? 'opacity-65 cursor-not-allowed bg-slate-50/50 border-slate-200'
                  : proofImages.filter(img => img !== mockProofPlaceholder).length >= 5
                    ? 'bg-slate-50 border-slate-200 cursor-not-allowed opacity-75'
                    : 'bg-rose-50/15 hover:bg-rose-50/35 border-rose-200/90'
              }`}
            >
              <input
                type="file"
                ref={proofInputRef}
                className="hidden"
                accept="image/*"
                onChange={(e) => handleFileChange(e, 'proof')}
                disabled={isReadOnly || proofImages.filter(img => img !== mockProofPlaceholder).length >= 5}
              />
              <UploadCloud className="w-5 h-5 text-rose-600/70 mb-2" />
              <div className="text-[11.5px] font-medium text-slate-800">
                {proofImages.filter(img => img !== mockProofPlaceholder).length >= 5 ? (
                  <span className="text-rose-700 font-semibold text-xs">Maximum limit reached (5/5)</span>
                ) : proofFileName && proofImages.length > 0 && proofImages[0] !== mockProofPlaceholder ? (
                  <span className="text-slate-850 font-mono inline-flex items-center gap-1.5 bg-rose-100/40 px-2.5 py-1 rounded-xl text-[10px] border border-rose-200/50 max-w-[200px] truncate">
                    <CheckCircle2 className="w-3.5 h-3.5 text-rose-600 shrink-0" /> Upload More
                  </span>
                ) : (
                  'Drag & Drop or Tap to Upload Document'
                )}
              </div>
              <p className="text-[9px] text-slate-400 mt-1.5 font-light font-sans">Repayment collateral payslips or screenshots</p>
            </div>

            {/* Proof Image Grid Thumbnails */}
            {proofImages.length > 0 && (
              <div className="mt-3 grid grid-cols-3 gap-2 mx-auto">
                {proofImages.map((img, idx) => (
                  <div key={idx} className="relative group border border-slate-100 rounded-xl p-1.5 bg-slate-50 flex items-center justify-center h-16 shadow-2xs transition-all hover:scale-102">
                    <img src={img} alt={`Proof #${idx + 1}`} className="max-h-full max-w-full object-contain rounded-lg" referrerPolicy="no-referrer" />
                    {img !== mockProofPlaceholder && !isReadOnly && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); deleteImage('proof', idx); }}
                        className="absolute -top-1.5 -right-1.5 bg-red-500 hover:bg-red-650 text-white rounded-full p-0.5 shadow-md transition-all cursor-pointer opacity-90 hover:opacity-100"
                        title="Delete image"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Submission Panel */}
        <div className="flex justify-end gap-3 pt-5 border-t border-slate-100 mt-8">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-xs font-medium text-slate-500 hover:text-slate-805 hover:bg-slate-50 cursor-pointer border border-slate-200 rounded-xl bg-white soft-button-shadow transition-all"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isReadOnly}
            className={`px-5 py-2.5 rounded-xl text-xs font-semibold text-white transition-all cursor-pointer soft-button-shadow ${
              isReadOnly
                ? 'bg-slate-200 text-slate-400 border border-slate-100 cursor-not-allowed shadow-none'
                : 'bg-slate-900 hover:bg-slate-800 hover:-translate-y-0.5'
            }`}
          >
            {isEditMode ? 'Apply Profile Edits' : 'Create Customer Profile'}
          </button>
        </div>
      </form>
    </div>
  );
};
