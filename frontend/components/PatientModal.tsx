
import React, { useState, useEffect, useRef } from 'react';
import { X, Save, UserPlus, AlertCircle, ChevronDown, Check } from 'lucide-react';
import { Patient, Language } from '../types';
import { translations } from '../services/translations';
import { motion, AnimatePresence } from 'framer-motion';

// --- Styled Components (Matching Login Page "Filled" Style) ---

const FormInput = ({ 
    label, value, onChange, placeholder, type = "text", error, onBlur, maxLength, noLabel
}: { 
    label: string, value: string, onChange: (val: string) => void, placeholder: string, type?: string, error?: boolean, onBlur?: () => void, maxLength?: number, noLabel?: boolean
}) => (
  <div className="space-y-1.5 w-full">
      {!noLabel && (
          <label className={`text-[10px] font-black uppercase tracking-widest ml-3 transition-colors ${error ? 'text-red-500' : 'text-slate-400'}`}>
              {label}
          </label>
      )}
      <input 
          type={type} 
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          maxLength={maxLength}
          placeholder={placeholder}
          className={`w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-900 border rounded-2xl font-bold text-sm outline-none transition-all
              ${error 
                  ? 'border-red-500 text-red-600 focus:ring-2 focus:ring-red-500/20' 
                  : 'border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10'
              }
              placeholder:font-medium placeholder:text-slate-400
          `}
      />
  </div>
);

const FormSelect = ({ 
    label, value, options, isOpen, setIsOpen, onSelect, error, containerRef, placeholder, noLabel
}: { 
    label: string, value: string, options: {value: string, label: string}[], isOpen: boolean, setIsOpen: (v: boolean) => void, onSelect: (v: string) => void, error?: boolean, containerRef: React.RefObject<HTMLDivElement | null>, placeholder?: string, noLabel?: boolean
}) => (
    <div className="relative space-y-1.5 w-full" ref={containerRef}>
        {!noLabel && (
            <label className={`text-[10px] font-black uppercase tracking-widest ml-3 transition-colors ${error ? 'text-red-500' : 'text-slate-400'}`}>
                {label}
            </label>
        )}
        <button 
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full px-5 py-3.5 border rounded-2xl font-bold text-sm outline-none transition-all flex items-center justify-between text-left
              ${error 
                  ? 'bg-red-50 dark:bg-red-900/10 border-red-500 text-red-600' 
                  : isOpen
                      ? 'bg-white dark:bg-slate-900 border-blue-500 ring-4 ring-blue-500/10 text-slate-900 dark:text-white'
                      : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white hover:border-slate-300 dark:hover:border-slate-600'
              }
          `}
        >
            <span className={!value ? 'text-slate-400 font-medium' : ''}>
                {value ? options.find(o => o.value === value)?.label : (placeholder || '')}
            </span>
            <ChevronDown size={16} className={`transition-transform duration-200 ${isOpen ? 'rotate-180 text-blue-600' : 'text-slate-400'}`} />
        </button>

        {/* Dropdown Menu */}
        <AnimatePresence>
            {isOpen && (
                <motion.div 
                  initial={{ opacity: 0, y: 5, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 5, scale: 0.98 }}
                  transition={{ duration: 0.1 }}
                  className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-50 max-h-60 overflow-y-auto custom-scrollbar py-2"
                >
                    {options.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => { onSelect(opt.value); setIsOpen(false); }}
                          className={`w-full px-5 py-3 text-left text-xs font-bold flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors
                              ${value === opt.value 
                                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' 
                                  : 'text-slate-700 dark:text-slate-300'
                              }
                          `}
                        >
                            {opt.label}
                            {value === opt.value && <Check size={14} />}
                        </button>
                    ))}
                </motion.div>
            )}
        </AnimatePresence>
    </div>
);

// --- Main Component ---

interface PatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (patient: Partial<Patient>) => void;
  initialData?: Patient | null;
  lang: Language;
  isDarkMode: boolean;
}

const PatientModal: React.FC<PatientModalProps> = ({ 
  isOpen, onClose, onSave, initialData, lang, isDarkMode 
}) => {
  const t = (translations[lang] as any);
  
  // Form State
  const [formData, setFormData] = useState<Partial<Patient>>({
    name: '', birthDate: '', age: 0, gender: undefined, status: 'Stable',
    imageUrl: `https://placehold.co/800x600/e2e8f0/475569?text=Ear+Scan`
  });
  const [validationError, setValidationError] = useState('');
  
  // Date State
  const [year, setYear] = useState('');
  const [month, setMonth] = useState('');
  const [day, setDay] = useState('');
  const [dateErrors, setDateErrors] = useState({ year: false, month: false, day: false, future: false });
  
  // Dropdown States
  const [isMonthOpen, setIsMonthOpen] = useState(false);
  const [isGenderOpen, setIsGenderOpen] = useState(false);

  // Refs for click outside
  const monthRef = useRef<HTMLDivElement>(null);
  const genderRef = useRef<HTMLDivElement>(null);

  // Generic Click Outside Hook logic
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        const target = event.target as Node;
        if (isMonthOpen && monthRef.current && !monthRef.current.contains(target)) setIsMonthOpen(false);
        if (isGenderOpen && genderRef.current && !genderRef.current.contains(target)) setIsGenderOpen(false);
    };
    
    if (isOpen) {
        document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMonthOpen, isGenderOpen, isOpen]);

  // Auto-calculate age
  const calculateAge = (dobString: string): number => {
      const birthDate = new Date(dobString);
      if (isNaN(birthDate.getTime())) return 0;
      
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
          age--;
      }
      return age >= 0 ? age : 0;
  };

  // Sync initial data
  useEffect(() => {
    if (isOpen) {
        setValidationError('');
        setDateErrors({ year: false, month: false, day: false, future: false });
        // Reset dropdowns
        setIsMonthOpen(false);
        setIsGenderOpen(false);

        if (initialData) {
            setFormData(initialData);
            if (initialData.birthDate) {
                const [y, m, d] = initialData.birthDate.split('-');
                setYear(y || '');
                setMonth(m || '');
                setDay(d || '');
            }
        } else {
            // Reset form for new entry - gender undefined
            setFormData({ 
                name: '', birthDate: '', age: 0, gender: undefined, status: 'Stable', 
                diagnosis: 'Normal', notes: '',
                imageUrl: `https://placehold.co/800x600/e2e8f0/475569?text=New+Ear+Scan` 
            });
            setYear('');
            setMonth('');
            setDay('');
        }
    }
  }, [initialData, isOpen]);

  // Sync Date parts to formData
  useEffect(() => {
      if (year && month && day) {
          const dateStr = `${year}-${month}-${day}`;
          // Check validity before calculating age
          const isValid = validateDateInputs(year, month, day);
          if (isValid) {
             const age = calculateAge(dateStr);
             setFormData(prev => ({ ...prev, birthDate: dateStr, age }));
          }
      }
  }, [year, month, day]);

  const validateDateInputs = (y: string, m: string, d: string) => {
      const yNum = parseInt(y);
      const mNum = parseInt(m);
      const dNum = parseInt(d);
      
      const today = new Date();
      
      let isYearInvalid = false;
      let isMonthInvalid = false;
      let isDayInvalid = false;
      let isFutureInvalid = false;

      // Year Validation: Must be 4 digits, > 1900
      if (!y || isNaN(yNum) || y.length !== 4 || yNum < 1900) isYearInvalid = true;
      
      // Month Validation
      if (!m || isNaN(mNum) || mNum < 1 || mNum > 12) isMonthInvalid = true;
      
      // Day Validation: Check against days in month (handles leap years)
      if (!d || isNaN(dNum) || dNum < 1) {
          isDayInvalid = true;
      } else if (!isYearInvalid && !isMonthInvalid) {
          const daysInMonth = new Date(yNum, mNum, 0).getDate();
          if (dNum > daysInMonth) isDayInvalid = true;
      }

      // Check for future date specifically
      if (!isYearInvalid && !isMonthInvalid && !isDayInvalid) {
          const inputDate = new Date(yNum, mNum - 1, dNum);
          // Zero out time for comparison
          const todayZero = new Date(today.getFullYear(), today.getMonth(), today.getDate());
          if (inputDate > todayZero) {
              isFutureInvalid = true;
          }
      }

      setDateErrors({ 
          year: isYearInvalid || isFutureInvalid, 
          month: isMonthInvalid || isFutureInvalid, 
          day: isDayInvalid || isFutureInvalid,
          future: isFutureInvalid 
      });

      return !isYearInvalid && !isMonthInvalid && !isDayInvalid && !isFutureInvalid;
  };

  const handleBlur = () => {
      if (year || month || day) {
        validateDateInputs(year, month, day);
      }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate Required Fields - Ensure Name and Gender are present
    if (!formData.name || !formData.gender) {
        setValidationError('requiredFields');
        return;
    }

    // Validate Date
    if (!validateDateInputs(year, month, day)) {
        setValidationError('invalidDate');
        return;
    }

    onSave({
        ...formData,
        birthDate: `${year}-${month}-${day}`
    });
    onClose();
  };

  const getErrorMessage = () => {
      if (!validationError) return '';
      if (validationError === 'invalidDate') return lang === 'zh' ? '請輸入有效的出生日期' : 'Invalid Date';
      return (t as any)[validationError] || validationError;
  };

  // Options Data
  const months = Array.from({length: 12}, (_, i) => ({
      value: String(i + 1).padStart(2, '0'),
      label: lang === 'zh' ? `${i + 1}月` : new Date(0, i).toLocaleString('en', { month: 'long' })
  }));

  const genderOptions = [
      { value: 'Male', label: t.male },
      { value: 'Female', label: t.female }
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 bg-slate-900/60 backdrop-blur-md" />
          <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-white dark:bg-[#0b1120] rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-visible border border-slate-100 dark:border-slate-800"
          >
            
            {/* Header */}
            <div className="p-8 pb-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3">
                  {initialData ? <Save className="text-blue-600" /> : <UserPlus className="text-blue-600" />}
                  {initialData ? t.updateRecord : t.register}
                </h2>
                <p className="text-slate-500 dark:text-slate-400 text-xs font-bold mt-2 uppercase tracking-wide">{t.configMetadata}</p>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400">
                <X size={20} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              
              {/* Row 1: Name and Gender */}
              <div className="flex gap-4">
                 <div className="flex-[2]">
                    <FormInput 
                        label={t.patientName} 
                        value={formData.name || ''} 
                        onChange={v => setFormData({...formData, name: v})} 
                        placeholder={lang === 'zh' ? '輸入病患姓名' : 'Enter name'}
                    />
                 </div>
                 <div className="flex-[1]">
                    <FormSelect 
                        label={t.gender}
                        placeholder={lang === 'zh' ? '選擇' : 'Select'}
                        value={formData.gender || ''}
                        options={genderOptions}
                        isOpen={isGenderOpen}
                        setIsOpen={setIsGenderOpen}
                        onSelect={(v) => setFormData({...formData, gender: v as any})}
                        containerRef={genderRef}
                    />
                 </div>
              </div>

              {/* Row 2: Date of Birth */}
              <div className="space-y-1.5 relative z-20">
                  <div className="flex justify-between items-center ml-3 pr-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.birthDate}</label>
                      {formData.age !== undefined && !dateErrors.future && (
                          <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded uppercase tracking-wider">
                              {formData.age} Y
                          </span>
                      )}
                  </div>
                  <div className="flex gap-4">
                      {/* Year Input */}
                      <div className="flex-[1.5]">
                          <FormInput
                             label={t.year}
                             value={year}
                             onChange={(v) => { if (/^\d{0,4}$/.test(v)) setYear(v); }}
                             onBlur={handleBlur}
                             maxLength={4}
                             placeholder={lang === 'zh' ? 'YYYY' : 'YYYY'}
                             error={dateErrors.year}
                             noLabel
                          />
                      </div>
                      
                      {/* Month Select */}
                      <div className="flex-[2]">
                          <FormSelect 
                            label={t.month}
                            placeholder={lang === 'zh' ? 'MM' : 'MM'}
                            value={month}
                            options={months}
                            isOpen={isMonthOpen}
                            setIsOpen={setIsMonthOpen}
                            onSelect={(v) => { setMonth(v); validateDateInputs(year, v, day); }}
                            error={dateErrors.month}
                            containerRef={monthRef}
                            noLabel
                          />
                      </div>

                      {/* Day Input */}
                      <div className="flex-[1.5]">
                          <FormInput
                             label={t.day}
                             value={day}
                             onChange={(v) => { if (/^\d{0,2}$/.test(v)) setDay(v); }}
                             onBlur={handleBlur}
                             maxLength={2}
                             placeholder={lang === 'zh' ? 'DD' : 'DD'}
                             error={dateErrors.day}
                             noLabel
                          />
                      </div>
                  </div>
                  {/* Helper Text for validation errors */}
                  {(dateErrors.year || dateErrors.month || dateErrors.day) && (
                      <div className="text-[10px] font-bold text-red-500 flex items-center gap-1 mt-1 pl-3">
                          <AlertCircle size={10} /> 
                          {dateErrors.future 
                            ? (lang === 'zh' ? '出生日期不能超過今天' : 'Date cannot be in the future') 
                            : (lang === 'zh' ? '請輸入有效的出生日期' : 'Please enter a valid birth date')
                          }
                      </div>
                  )}
              </div>

              {validationError && (
                 <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="p-4 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-2xl flex items-center justify-center gap-2 text-red-600 dark:text-red-400 text-xs font-black uppercase tracking-widest">
                    <AlertCircle size={16} /> {getErrorMessage()}
                 </motion.div>
              )}
            </form>

            <div className="p-8 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-4 rounded-b-[2.5rem]">
              <button type="button" onClick={onClose} className="flex-1 py-4 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-700 shadow-sm">{t.cancel}</button>
              <button onClick={handleSubmit} className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl text-xs uppercase tracking-widest shadow-xl shadow-blue-500/20 active:scale-95 transition-all">
                  {initialData ? t.saveChanges : t.register}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default PatientModal;
