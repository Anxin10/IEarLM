
import React from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { DashboardStats, Language } from '../types';
import {
    FileText, Users, Target, TrendingUp, ArrowUpRight,
    CalendarRange, UserPlus
} from 'lucide-react';
import { motion } from 'framer-motion';
import { translations, getDiseaseDisplayName } from '../services/translations';

interface DashboardProps {
    stats: DashboardStats;
    isDarkMode: boolean;
    lang: Language;
}

const COLORS = ['#3b82f6', '#6366f1', '#f43f5e', '#10b981', '#f59e0b', '#ec4899'];

const StatCard = ({ title, value, icon: Icon, color, trend, delay }: any) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay }}
        className="bg-white dark:bg-[#0b1120] p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between"
    >
        <div className="flex justify-between items-start">
            <div className={`p-3 rounded-2xl ${color} bg-opacity-10`}>
                <Icon size={28} className={color.replace('bg-', 'text-')} />
            </div>
            <div className="flex items-center gap-1 text-green-500 font-bold text-[10px] bg-green-50 dark:bg-green-500/10 px-2 py-1 rounded-lg">
                <ArrowUpRight size={12} />
                {trend}
            </div>
        </div>
        <div className="mt-4">
            <p className="text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest">{title}</p>
            <h3 className="text-3xl font-black text-slate-900 dark:text-white mt-1">{value}</h3>
        </div>
    </motion.div>
);

const Dashboard: React.FC<DashboardProps> = ({ stats, isDarkMode, lang }) => {
    const t = translations[lang] as any;
    const textColor = isDarkMode ? '#94a3b8' : '#64748b';
    const totalCases = stats.diseaseDistribution.reduce((acc, curr) => acc + curr.value, 0);

    // Transform Data for Charts with Bilingual Support
    const translatedDistribution = stats.diseaseDistribution.map(item => {
        const translatedName = getDiseaseDisplayName(item.name, lang);
        return {
            ...item,
            // If in Chinese, show "Chinese (English)", otherwise just English
            displayName: lang === 'zh' && item.name !== 'Normal' ? `${translatedName} (${item.name})` : translatedName
        };
    });

    const translatedMonthlyVisits = stats.monthlyVisits.map(item => ({
        ...item,
        // Translate month name (e.g., Aug -> 8月)
        displayName: t[item.name] || item.name
    }));

    return (
        // Fixed: Added dark:bg-[#020617] to ensure proper background in dark mode
        <div className="h-full flex flex-col bg-slate-50 dark:bg-[#020617] transition-colors duration-500 overflow-hidden">

            {/* Header - Fixed Height */}
            <div className="h-20 bg-white dark:bg-[#0b1120] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 md:px-10 shrink-0 z-30 transition-colors">
                <div className="flex items-center">
                    <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tighter uppercase whitespace-nowrap">
                        {t.dashboard}
                    </h1>
                    <div className="w-[1px] h-4 bg-slate-300 dark:bg-slate-700 mx-4 shrink-0"></div>
                    <p className="hidden lg:block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] whitespace-nowrap">
                        {t.analyticsSub}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {/* Live Data Feed badge removed as requested */}
                </div>
            </div>

            {/* Content Body - Fill remaining height, no body scroll */}
            <div className="flex-1 flex flex-col p-6 md:p-8 gap-6 overflow-hidden">

                {/* Top Section: Stats Cards (Fixed Height / Shrink 0) */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 shrink-0">
                    {/* 1. Total Patients 2026 */}
                    <StatCard
                        title={t.totalPatientsYear}
                        value={stats.totalPatients}
                        icon={CalendarRange}
                        color="bg-blue-600"
                        trend="+14.2%"
                        delay={0.1}
                    />
                    {/* 2. Total Patients This Month */}
                    <StatCard
                        title={t.totalPatientsMonth}
                        value={stats.newPatientsThisMonth || 0}
                        icon={UserPlus}
                        color="bg-indigo-500"
                        trend="+8.5%"
                        delay={0.2}
                    />
                    {/* 3. AI Accuracy */}
                    <StatCard
                        title={t.aiAccuracy}
                        value={`${stats.aiAccuracy}%`}
                        icon={Target}
                        color="bg-indigo-600"
                        trend="+0.8%"
                        delay={0.3}
                    />
                    {/* 4. Generated Reports */}
                    <StatCard
                        title={t.genReportCount}
                        value={stats.generatedReportsCount || 0}
                        icon={FileText}
                        color="bg-green-500"
                        trend="+22.4%"
                        delay={0.4}
                    />
                </div>

                {/* Bottom Section: Charts (Flex 1 to fill remaining space) */}
                <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* Area Chart */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.5 }}
                        className="lg:col-span-2 bg-white dark:bg-[#0b1120] p-6 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col h-full overflow-hidden"
                    >
                        <div className="flex justify-between items-center mb-4 shrink-0">
                            <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                                <TrendingUp className="text-blue-600" /> {t.growthTrend}
                            </h3>
                        </div>
                        <div className="flex-1 w-full min-h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={translatedMonthlyVisits} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorVisits" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? "#1e293b" : "#e2e8f0"} />
                                    <XAxis dataKey="displayName" axisLine={false} tickLine={false} tick={{ fill: textColor, fontSize: 10, fontWeight: 900 }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: textColor, fontSize: 10, fontWeight: 900 }} />
                                    <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', backgroundColor: isDarkMode ? '#1e293b' : '#fff', color: isDarkMode ? '#fff' : '#000', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }} />
                                    <Area type="monotone" dataKey="visits" stroke="#3b82f6" strokeWidth={4} fillOpacity={1} fill="url(#colorVisits)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </motion.div>

                    {/* Pie Chart */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.6 }}
                        className="bg-white dark:bg-[#0b1120] p-6 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col h-full overflow-hidden"
                    >
                        <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2 shrink-0">{t.diseaseMapping}</h3>
                        <div className="flex-1 min-h-[300px] relative -ml-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={translatedDistribution}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius="50%"
                                        outerRadius="80%"
                                        fill="#8884d8"
                                        paddingAngle={5}
                                        dataKey="value"
                                        nameKey="displayName"
                                        stroke={isDarkMode ? '#0b1120' : '#fff'}
                                        strokeWidth={4}
                                    >
                                        {translatedDistribution.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', backgroundColor: isDarkMode ? '#1e293b' : '#fff', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        {/* List container: allow internal scroll if items exceed height, but keep page static */}
                        <div className="shrink-0 mt-4 overflow-y-auto max-h-[140px] custom-scrollbar pr-2 space-y-2">
                            {translatedDistribution.map((entry, index) => (
                                <div key={entry.name} className="flex items-center justify-between group py-1">
                                    <div className="flex items-center gap-3 min-w-0 flex-1 mr-4">
                                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                                        <span className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest truncate group-hover:text-slate-800 dark:group-hover:text-slate-200 transition-colors" title={entry.displayName}>
                                            {entry.displayName}
                                        </span>
                                    </div>
                                    <span className="text-sm font-black text-slate-800 dark:text-white whitespace-nowrap">
                                        {totalCases > 0 ? ((entry.value / totalCases) * 100).toFixed(0) : 0}%
                                    </span>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                </div>


            </div>
        </div>
    );
};
export default Dashboard;
