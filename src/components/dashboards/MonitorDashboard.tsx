import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Plus, History, TrendingUp, Save, BarChart3, User, Search, ArrowUpDown, FileText, ChevronLeft, ChevronRight as ChevronRightIcon } from 'lucide-react';
import { format } from 'date-fns';
import { groupByWeek } from '../../lib/dateUtils';
import { addDoc, collection, serverTimestamp, query, where, getDocs, orderBy, limit, Timestamp, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { useAuth } from '../AuthProvider';
import { NutritionReport } from '../../types';
import { cn } from '../../lib/utils';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

interface MonitorDashboardProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function MonitorDashboard({ activeTab, onTabChange }: MonitorDashboardProps) {
  const { profile } = useAuth();
  const [view, setView] = useState<'overview' | 'form' | 'history'>('overview');

  useEffect(() => {
    if (activeTab === 'overview' || activeTab === 'history') {
      setView(activeTab);
    }
  }, [activeTab]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [reports, setReports] = useState<any[]>([]);
  const [hasSubmittedToday, setHasSubmittedToday] = useState(false);
  
  
  const [searchDate, setSearchDate] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });
  const [weekOffset, setWeekOffset] = useState(0);

  const [error, setError] = useState('');

  const [formData, setFormData] = useState<Partial<NutritionReport>>({
    classId: profile?.grade || '',
    section: profile?.section || '',
    totalStudents: 0,
    presentStudents: 0,
    adequateCarbs: 0,
    adequateProteins: 0,
    adequateFats: 0,
    adequateWater: 0,
    junkFoodCount: 0,
    date: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    let unsubscribe: () => void;
    if (profile?.uid) {
      const q = query(
        collection(db, 'nutritionReports'),
        where('monitorId', '==', profile.uid),
        orderBy('date', 'desc'),
        limit(100) 
      );
      unsubscribe = onSnapshot(q, (snap) => {
        const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setReports(data); 

        const today = new Date().toISOString().split('T')[0];
        const submittedToday = data.some((r: any) => r.date === today);
        setHasSubmittedToday(submittedToday);
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, 'nutritionReports');
      });
    }
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [profile?.uid]);

  const groupedWeeks = groupByWeek(reports, r => r.date);
  const currentWeek = groupedWeeks[weekOffset] || { items: [], label: 'This Week', weekStart: new Date(), weekEnd: new Date() };

  const chartData = currentWeek.items.map(r => ({
    date: format(new Date(r.date), 'EEE'),
    fullDate: format(new Date(r.date), 'MMM dd'),
    Carbs: r.adequateCarbs,
    Proteins: r.adequateProteins,
    Fats: r.adequateFats,
    Water: r.adequateWater,
    JunkFood: r.junkFoodCount,
  }));

  const weekLabel = currentWeek.label;

  const filteredReports = reports
    .filter(r => r.date.includes(searchDate) || r.classId.toLowerCase().includes(searchDate.toLowerCase()))
    .sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const checkExistingSubmission = async (classId: string, section: string, date: string) => {
    const q = query(
      collection(db, 'nutritionReports'),
      where('classId', '==', classId),
      where('section', '==', section),
      where('date', '==', date),
      where('monitorId', '==', profile?.uid)
    );
    const snap = await getDocs(q);
    return !snap.empty;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);
    setError('');

    
    const present = formData.presentStudents || 0;
    const total = formData.totalStudents || 0;
    const questions = [
      formData.adequateCarbs,
      formData.adequateProteins,
      formData.adequateFats,
      formData.adequateWater,
      formData.junkFoodCount
    ];

    if (total < 0 || present < 0) {
      setError("Student counts cannot be negative.");
      setLoading(false);
      return;
    }

    if (present > total) {
      setError("Students present cannot exceed students enrolled.");
      setLoading(false);
      return;
    }

    if (questions.some(q => (q || 0) > present)) {
      setError(`Nutrition counts cannot exceed the number of students present (${present}).`);
      setLoading(false);
      return;
    }

    try {
      const alreadySubmitted = await checkExistingSubmission(formData.classId!, formData.section!, formData.date!);
      if (alreadySubmitted) {
        setError('A report has already been submitted for this class today.');
        setLoading(false);
        return;
      }

      
      // 70% weight for positive nutrition, 30% weight for fast food avoidance
      const nutritionAvg = questions.slice(0, 4).reduce((a, b) => (a || 0) + (b || 0), 0) / (4 * present);
      const junkAvoidance = 1 - ((formData.junkFoodCount || 0) / present);
      const score = Math.round((nutritionAvg * 70) + (junkAvoidance * 30));

      await addDoc(collection(db, 'nutritionReports'), {
        ...formData,
        healthScore: score,
        monitorId: profile?.uid,
        monitorName: profile?.name,
        createdAt: serverTimestamp(),
      });
      setHasSubmittedToday(true);
      setSuccess(true);
      setView('overview');

      setFormData({
        ...formData,
        adequateCarbs: 0,
        adequateProteins: 0,
        adequateFats: 0,
        adequateWater: 0,
        junkFoodCount: 0,
      });
    } catch (err) {
      console.error(err);
      setError('An error occurred while submitting the report.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <header className="flex justify-between items-center bg-white p-6 rounded-[2.5rem] border border-brand-200">
        <div>
          <h1 className="text-2xl font-display font-semibold text-brand-900">ERGA Portal</h1>
          <p className="text-slate-500">Monitor and track school nutrition daily.</p>
        </div>
      </header>

      {view === 'overview' && (
        <div className="space-y-8">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-display font-medium text-brand-900">Quick Actions</h2>
            {!hasSubmittedToday && (
              <button 
                onClick={() => setView('form')}
                className="px-6 py-3 bg-brand-500 text-white rounded-[1.5rem] flex items-center gap-2 shadow-lg shadow-brand-500/20 hover:bg-brand-600 transition-all font-semibold"
              >
                <Plus className="w-5 h-5" /> Submit Today's Report
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard title="Total Submissions" value={reports.length.toString()} color="bg-blue-500" />
            <StatCard title="Avg Attendance" value={reports.length > 0 ? `${Math.round(reports.reduce((acc, r) => acc + (r.presentStudents / r.totalStudents), 0) / reports.length * 100)}%` : '0%'} color="bg-green-500" />
            <StatCard title="Nutrition Compliance" value={reports.length > 0 ? `${Math.round(reports.reduce((acc, r) => acc + (r.adequateCarbs + r.adequateProteins + r.adequateFats) / (r.presentStudents * 3), 0) / reports.length * 100)}%` : '0%'} color="bg-brand-500" />
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] border border-brand-200 shadow-sm space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-display font-semibold text-brand-900">Weekly Nutrition Trends</h2>
                <div className="flex items-center gap-2 mt-1">
                  <button 
                    onClick={() => setWeekOffset(prev => Math.min(prev + 1, groupedWeeks.length - 1))}
                    disabled={weekOffset >= groupedWeeks.length - 1 || groupedWeeks.length === 0}
                    className="p-1 rounded-full hover:bg-slate-100 disabled:opacity-50 text-slate-500"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <p className="text-slate-500 font-medium text-sm w-36 text-center">{weekLabel}</p>
                  <button 
                    onClick={() => setWeekOffset(prev => Math.max(prev - 1, 0))}
                    disabled={weekOffset === 0}
                    className="p-1 rounded-full hover:bg-slate-100 disabled:opacity-50 text-slate-500"
                  >
                    <ChevronRightIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#5A5A40]" /> Carbs</span>
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500" /> Proteins</span>
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-orange-500" /> Fats</span>
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-cyan-500" /> Water</span>
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500" /> Fast Food</span>
              </div>
            </div>
            <div className="h-80 w-full overflow-x-auto overflow-y-hidden pb-2 scrollbar-thin scrollbar-thumb-brand-200 scrollbar-track-transparent">
              <div style={{ minWidth: '600px', height: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-brand-900 text-white p-4 rounded-[1.5rem] shadow-2xl border border-white/10 backdrop-blur-md">
                              <p className="font-bold text-sm mb-2 border-b border-white/20 pb-2">{payload[0].payload.fullDate} ({payload[0].payload.date})</p>
                              {payload.map((entry, index) => (
                                <div key={index} className="flex justify-between gap-6 text-xs mb-1 items-center">
                                  <span className="font-black uppercase tracking-widest text-[10px]" style={{ color: entry.color }}>{entry.name}</span>
                                  <span className="font-bold text-sm" style={{ color: entry.color }}>{entry.value}</span>
                                </div>
                              ))}
                            </div>
                          );
                        }
                        return null;
                      }}
                      cursor={{ fill: '#f8fafc' }}
                    />
                    <Bar dataKey="Carbs" fill="#5A5A40" radius={[8, 8, 0, 0]} barSize={12} />
                    <Bar dataKey="Proteins" fill="#3b82f6" radius={[8, 8, 0, 0]} barSize={12} />
                    <Bar dataKey="Fats" fill="#f97316" radius={[8, 8, 0, 0]} barSize={12} />
                    <Bar dataKey="Water" fill="#06b6d4" radius={[8, 8, 0, 0]} barSize={12} />
                    <Bar dataKey="JunkFood" fill="#ef4444" radius={[8, 8, 0, 0]} barSize={12} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Recent History on Overview */}
          <div className="bg-white p-8 rounded-[2.5rem] border border-brand-200 shadow-sm space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-display font-semibold text-brand-900">Recent Reports</h2>
              <button 
                onClick={() => onTabChange('history')}
                className="text-brand-500 text-sm font-bold hover:underline underline-offset-4"
              >
                View full history →
              </button>
            </div>
            
            <div className="space-y-4">
              {reports.slice(0, 5).map((report) => (
                <div key={report.id} className="flex items-center justify-between p-4 bg-brand-50 rounded-2xl border border-brand-100">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-brand-500 shadow-sm">
                      <History className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-brand-900">
                        {new Date(report.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                      <p className="text-xs text-slate-500">Attendance: {report.presentStudents}/{report.totalStudents}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <MetricBadge label="C" value={report.adequateCarbs} max={report.presentStudents} />
                    <MetricBadge label="P" value={report.adequateProteins} max={report.presentStudents} />
                    <MetricBadge label="F" value={report.adequateFats} max={report.presentStudents} />
                    <MetricBadge label="W" value={report.adequateWater} max={report.presentStudents} />
                    <MetricBadge label="FF" value={report.junkFoodCount} max={report.presentStudents} inverse />
                  </div>
                </div>
              ))}
              {reports.length === 0 && (
                <p className="text-center py-8 text-slate-400 italic">No reports submitted yet.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {view === 'history' && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-[2.5rem] border border-brand-200 shadow-sm space-y-6"
        >
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h2 className="text-xl font-display font-semibold text-brand-900">Submission History</h2>
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input 
                type="text" 
                placeholder="Filter by date or class..."
                value={searchDate}
                onChange={e => setSearchDate(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-brand-50 border border-brand-100 rounded-xl text-sm outline-none focus:border-brand-500 transition-colors"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-brand-100">
                  <th className="py-4 px-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    <button onClick={() => handleSort('date')} className="flex items-center gap-1 hover:text-brand-500 transition-colors">
                      Date <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-4 px-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    <button onClick={() => handleSort('classId')} className="flex items-center gap-1 hover:text-brand-500 transition-colors">
                      Class <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-4 px-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Attendance</th>
                  <th className="py-4 px-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Nutrition Indices</th>
                  <th className="py-4 px-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-50">
                {filteredReports.map((report) => (
                  <tr key={report.id} className="group hover:bg-brand-50/50 transition-colors">
                    <td className="py-4 px-4 text-sm font-medium text-brand-900">
                      {new Date(report.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="py-4 px-4 text-sm text-slate-600">{report.classId}</td>
                    <td className="py-4 px-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-brand-900">{report.presentStudents} / {report.totalStudents}</span>
                        <div className="w-24 h-1 bg-brand-100 rounded-full mt-1 overflow-hidden">
                          <div 
                            className="h-full bg-brand-500" 
                            style={{ width: `${(report.presentStudents / report.totalStudents) * 100}%` }} 
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex gap-2">
                        <MetricBadge label="C" value={report.adequateCarbs} max={report.presentStudents} />
                        <MetricBadge label="P" value={report.adequateProteins} max={report.presentStudents} />
                        <MetricBadge label="F" value={report.adequateFats} max={report.presentStudents} />
                        <MetricBadge label="W" value={report.adequateWater} max={report.presentStudents} />
                        <MetricBadge label="FF" value={report.junkFoodCount} max={report.presentStudents} inverse />
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 text-[10px] font-bold rounded-full uppercase">
                        <FileText className="w-3 h-3" /> Submitted
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredReports.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400 italic">No reports found matching your criteria.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {view === 'form' && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-8 rounded-[2.5rem] border border-brand-200 shadow-sm"
        >
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 rounded-[1.5rem] text-sm font-medium">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2 p-6 bg-brand-50 rounded-[2.5rem] border border-brand-100 flex flex-col md:flex-row gap-6 justify-between items-center">
                <div className="flex gap-4 items-center">
                  <div className="w-12 h-12 bg-white rounded-[1.5rem] flex items-center justify-center text-brand-500 shadow-sm">
                    <User className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-brand-900">{profile?.grade} {profile?.section}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold text-brand-900">{new Date(formData.date!).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                </div>
              </div>
              
              <FormField label="Total Students Enrolled">
                <input 
                  type="number" 
                  required
                  min="0"
                  value={formData.totalStudents}
                  onChange={e => {
                    const val = Math.max(0, Number(e.target.value));
                    setFormData({...formData, totalStudents: val});
                  }}
                  className="w-full p-3 bg-brand-50 border border-brand-100 rounded-[1rem]"
                />
              </FormField>
              <FormField label="Students Present Today">
                <input 
                  type="number" 
                  required
                  min="0"
                  max={formData.totalStudents}
                  value={formData.presentStudents}
                  onChange={e => {
                    let val = Math.max(0, Number(e.target.value));
                    if (val > (formData.totalStudents || 0)) val = formData.totalStudents || 0;
                    
                    
                    setFormData({
                      ...formData, 
                      presentStudents: val,
                      adequateCarbs: Math.min(formData.adequateCarbs || 0, val),
                      adequateProteins: Math.min(formData.adequateProteins || 0, val),
                      adequateFats: Math.min(formData.adequateFats || 0, val),
                      adequateWater: Math.min(formData.adequateWater || 0, val),
                      junkFoodCount: Math.min(formData.junkFoodCount || 0, val),
                    });
                  }}
                  className="w-full p-3 bg-brand-50 border border-brand-100 rounded-[1rem]"
                />
              </FormField>
            </div>

            <div className="pt-8 border-t border-brand-100">
              <h3 className="text-lg font-display font-medium text-brand-900 mb-6">Nutrition Questions</h3>
              <div className="space-y-4">
                <NutritionInput 
                  label="Q1: Adequate Carbohydrates (Cereals, Rice, Oats)" 
                  value={formData.adequateCarbs}
                  max={formData.presentStudents}
                  onChange={val => setFormData({...formData, adequateCarbs: val})}
                />
                <NutritionInput 
                  label="Q2: Adequate Proteins (Chicken, Eggs, Pulses)" 
                  value={formData.adequateProteins}
                  max={formData.presentStudents}
                  onChange={val => setFormData({...formData, adequateProteins: val})}
                />
                <NutritionInput 
                  label="Q3: Healthy Fats & Vitamins (Fruits, Veggies, Nuts)" 
                  value={formData.adequateFats}
                  max={formData.presentStudents}
                  onChange={val => setFormData({...formData, adequateFats: val})}
                />
                <NutritionInput 
                  label="Q4: Drinking Adequate Water" 
                  value={formData.adequateWater}
                  max={formData.presentStudents}
                  onChange={val => setFormData({...formData, adequateWater: val})}
                />
                <NutritionInput 
                  label="Q5: How many students brought fast food?" 
                  value={formData.junkFoodCount}
                  max={formData.presentStudents}
                  onChange={val => setFormData({...formData, junkFoodCount: val})}
                  inverse
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-4 bg-brand-900 text-white rounded-[1.5rem] font-semibold shadow-xl shadow-brand-100 hover:bg-brand-600 transition-all flex items-center justify-center gap-2"
            >
              <Save className="w-5 h-5" />
              {loading ? 'Submitting...' : 'Save Daily Report'}
            </button>
          </form>
        </motion.div>
      )}
    </div>
  );
}

function MetricBadge({ label, value, max, inverse = false }: { label: string, value: number, max: number, inverse?: boolean }) {
  const percentage = (value / max) * 100;
  let colorClass = "bg-red-50 text-red-600";
  
  if (inverse) {
    if (percentage <= 20) colorClass = "bg-green-50 text-green-600";
    else if (percentage <= 50) colorClass = "bg-brand-50 text-brand-600";
  } else {
    if (percentage >= 80) colorClass = "bg-green-50 text-green-600";
    else if (percentage >= 50) colorClass = "bg-brand-50 text-brand-600";
  }

  return (
    <div className={cn("flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold", colorClass)}>
      <span>{label}</span>
      <span className="opacity-60">{value}</span>
    </div>
  );
}

function FormField({ label, children }: { label: string, children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      {children}
    </div>
  );
}

function NutritionInput({ label, value, max, onChange, inverse = false }: { label: string, value: number | undefined, max: number | undefined, onChange: (val: number) => void, inverse?: boolean }) {
  return (
    <div className="p-4 bg-brand-50 rounded-[1.5rem] border border-brand-100 flex items-center justify-between">
      <span className="text-sm text-brand-900 font-medium max-w-sm">{label}</span>
      <div className="flex items-center gap-4">
        <input 
          type="range" 
          min="0" 
          max={max || 100} 
          value={value || 0}
          onChange={e => onChange(Number(e.target.value))}
          className="w-32 h-2 bg-brand-200 rounded-lg appearance-none cursor-pointer accent-brand-500"
        />
        <span className={cn("text-lg font-bold min-w-[3ch] text-center", inverse ? (value! > (max! / 2) ? 'text-red-500' : 'text-brand-500') : (value! < (max! / 2) ? 'text-red-500' : 'text-brand-500'))}>
          {value}
        </span>
      </div>
    </div>
  );
}

function StatCard({ title, value, color }: { title: string, value: string, color: string }) {
  return (
    <div className="bg-white p-6 rounded-[2.5rem] border border-brand-200 shadow-sm relative overflow-hidden group">
      <div className={cn("absolute top-0 right-0 w-2 h-full", color)} />
      <p className="text-slate-500 text-sm mb-1">{title}</p>
      <h3 className="text-3xl font-display font-bold text-brand-900">{value}</h3>
    </div>
  );
}