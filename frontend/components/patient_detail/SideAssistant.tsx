
import React, { useState, useRef, useEffect } from 'react';
import { Patient, Language, EarExamRecord } from '../../types';
import { translations } from '../../services/translations';
import { chatWithMedicalAssistant } from '../../services/geminiService';
import { Sparkles, Send, Bot, X, MessageSquarePlus, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SideAssistantProps {
    patient: Patient;
    isOpen?: boolean; // Kept for interface compat, internal state controls visibility
    lang: Language;
    currentExam: EarExamRecord;
    activeSide: string;
}

interface ChatMessage {
    id: string;
    role: 'user' | 'ai';
    text: string;
}

export const SideAssistant: React.FC<SideAssistantProps> = ({ patient, lang, currentExam, activeSide }) => {
    const t = (translations[lang] as any);
    const [isExpanded, setIsExpanded] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const endRef = useRef<HTMLDivElement>(null);

    // Auto-scroll on new message
    useEffect(() => { 
        if (isExpanded) {
            endRef.current?.scrollIntoView({ behavior: 'smooth' }); 
        }
    }, [messages, isTyping, isExpanded]);

    const handleSend = async () => {
        if (!input.trim() || isTyping) return;
        const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: input };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsTyping(true);
        try {
            // Build rich context from BOTH ears if available (accessing via patient prop if needed, or focused on current)
            // Ideally, we want the assistant to know everything.
            // Since props give `currentExam` (active side), let's construct context based on that + patient info.
            
            // To get both ears, we really need access to patient.exams.left and patient.exams.right
            // The prop `currentExam` is just the active one. Let's try to access patient.exams if available.
            
            const leftData = patient.exams?.left;
            const rightData = patient.exams?.right;
            
            const formatFindings = (side: string, exam?: EarExamRecord) => {
                if(!exam || !exam.detailedFindings) return `${side}: No detailed data`;
                const eac = exam.detailedFindings.EAC.map(f => f.label_en).join(', ');
                const tm = exam.detailedFindings.TM.map(f => `${f.label_en}${f.percentage ? `(${f.percentage}%)` : ''}`).join(', ');
                return `${side} Ear: [EAC: ${eac || 'Clear'}], [TM: ${tm || 'Normal'}]`;
            };

            const fullContext = `
                Patient: ${patient.name} (${patient.age}, ${patient.gender}).
                Current Active View: ${activeSide}.
                Clinical Data:
                1. ${formatFindings('Left', leftData)}
                2. ${formatFindings('Right', rightData)}
                Notes: ${patient.notes || 'None'}
            `;
            
            const response = await chatWithMedicalAssistant(userMsg.text, [], fullContext);
            setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'ai', text: response }]);
        } finally { setIsTyping(false); }
    };

    return (
        <>
            {/* Dock Toggle Button */}
            <motion.button
                onClick={() => setIsExpanded(!isExpanded)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`absolute bottom-6 right-6 z-40 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-colors ${isExpanded ? 'bg-red-500 hover:bg-red-600' : 'bg-indigo-600 hover:bg-indigo-700'}`}
            >
                {isExpanded ? <X className="text-white" size={24} /> : <Bot className="text-white" size={28} />}
                {!isExpanded && (
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-400"></span>
                    </span>
                )}
            </motion.button>

            {/* Expanded Chat Panel */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        className="absolute bottom-24 right-6 z-40 w-[380px] h-[500px] max-h-[80vh] bg-white dark:bg-[#1e293b] rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden"
                    >
                        {/* Header */}
                        <div className="h-14 bg-indigo-600 flex items-center justify-between px-5 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white">
                                    <Sparkles size={16} />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-white font-bold text-sm">{t.aiAssistant}</span>
                                    {/* Removed subtitle as requested */}
                                </div>
                            </div>
                            <button onClick={() => setIsExpanded(false)} className="text-white/70 hover:text-white transition-colors">
                                <ChevronUp size={20} className="rotate-180" />
                            </button>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-slate-50 dark:bg-[#0f172a]">
                            {messages.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-center opacity-40 space-y-4 p-8">
                                    <Bot size={48} className="text-slate-400" />
                                    <p className="text-xs font-bold text-slate-500 leading-relaxed">
                                        {lang === 'zh' ? '我是您的臨床 AI 助手。您可以詢問關於當前病灶的鑑別診斷、治療建議或藥物交互作用。' : 'I am your clinical AI assistant. Ask me about differential diagnosis, treatment options, or guidelines based on current findings.'}
                                    </p>
                                </div>
                            ) : (
                                messages.map(msg => (
                                    <div key={msg.id} className={`flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                        <div className={`px-4 py-2.5 rounded-2xl text-xs font-medium leading-relaxed max-w-[85%] shadow-sm ${
                                            msg.role === 'user' 
                                            ? 'bg-indigo-600 text-white rounded-br-none' 
                                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-bl-none'
                                        }`}>
                                            {msg.text}
                                        </div>
                                    </div>
                                ))
                            )}
                            {isTyping && (
                                <div className="flex justify-start">
                                    <div className="bg-white dark:bg-slate-800 px-4 py-3 rounded-2xl rounded-bl-none border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-1.5">
                                        <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" />
                                        <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-75" />
                                        <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-150" />
                                    </div>
                                </div>
                            )}
                            <div ref={endRef} />
                        </div>

                        {/* Input Area */}
                        <div className="p-3 bg-white dark:bg-[#1e293b] border-t border-slate-200 dark:border-slate-700 shrink-0">
                            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900 rounded-xl p-1 pr-2 border border-slate-200 dark:border-slate-800 focus-within:border-indigo-500 transition-colors">
                                <input 
                                    type="text" 
                                    value={input} 
                                    onChange={(e) => setInput(e.target.value)} 
                                    onKeyDown={(e) => e.key === 'Enter' && handleSend()} 
                                    placeholder={lang === 'zh' ? "輸入臨床問題..." : "Type a question..."} 
                                    className="flex-1 bg-transparent border-none outline-none px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 placeholder:text-slate-400" 
                                />
                                <button 
                                    onClick={input.trim() ? handleSend : undefined} 
                                    disabled={!input.trim() || isTyping}
                                    className={`p-2 rounded-lg transition-all ${input.trim() ? 'bg-indigo-600 text-white shadow-md active:scale-95' : 'bg-slate-200 dark:bg-slate-800 text-slate-400'}`}
                                >
                                    <Send size={14} />
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};
