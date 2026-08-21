import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell
} from 'recharts';
import { motion } from 'motion/react';
import { 
  Activity, Users, AlertTriangle, Sparkles, TrendingDown, TrendingUp, Download, Search, Settings, 
  CheckCircle2, Clock, AlertCircle, ChevronRight, ChevronLeft, UserMinus, Smile, Target, BookHeart
} from 'lucide-react';
import { getWellnessInsights } from '../../services/aiService';
import { collection, query, getDocs, orderBy, limit, where, doc, updateDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { useAuth } from '../AuthProvider';
import { cn } from '../../lib/utils';
import { NutritionReport, StudentJournal } from '../../types';
import ReactMarkdown from 'react-markdown';
import { format } from 'date-fns';
import { groupByWeek } from '../../lib/dateUtils';

const COLORS = ['#57b89d', '#ff9f43', '#ff6b6b', '#5f27cd', '#48dbfb'];

interface TeacherDashboardProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function TeacherDashboard({ activeTab, onTabChange }: TeacherDashboardProps) {
  const { profile } = useAuth();
  const [insights, setInsights] = useState<any>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [reports, setReports] = useState<NutritionReport[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [students, setStudents] = useState<any[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [journals, setJournals] = useState<StudentJournal[]>([]);
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [weekOffset, setWeekOffset] = useState(0);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteContent, setNoteContent] = useState('');

  useEffect(() => {
    let unsubscribeReports: () => void;
    let unsubscribeJournals: () => void;
    if (profile?.grade && profile?.section) {
      const q = query(
        collection(db, 'nutritionReports'), 
        where('classId', '==', profile.grade),
        where('section', '==', profile.section),
        orderBy('date', 'desc'), 
        limit(10)
      );
      unsubscribeReports = onSnapshot(q, async (snapshot) => {
        const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as NutritionReport[];
        setReports(data);
        
        if (data.length > 0) {
          setLoadingInsights(true);
          const aiResult = await getWellnessInsights(data, 'teacher');
          setInsights(aiResult);
          setLoadingInsights(false);
        }
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, 'nutritionReports');
      });

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const qJournals = query(
        collection(db, 'studentJournals'),
        where('grade', '==', profile.grade),
        where('section', '==', profile.section),
        where('date', '>=', thirtyDaysAgo.toISOString().split('T')[0])
      );
      unsubscribeJournals = onSnapshot(qJournals, (snapshot) => {
        setJournals(snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as StudentJournal[]);
      }, (err) => {
        console.error("Journal sync error", err);
      });
    }
    return () => {
      if (unsubscribeReports) unsubscribeReports();
      if (unsubscribeJournals) unsubscribeJournals();
    };
  }, [profile?.grade, profile?.section]);

  useEffect(() => {
    let unsubscribe: () => void;

    if (profile?.uid) {
      setLoadingAlerts(true);
      const q = query(
        collection(db, 'alerts'), 
        where('teacherId', '==', profile.uid),
        orderBy('status', 'asc'),
        orderBy('createdAt', 'desc')
      );

      unsubscribe = onSnapshot(q, (snapshot) => {
        setAlerts(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoadingAlerts(false);
      }, (err) => {
        
        if (activeTab === 'alerts') {
          handleFirestoreError(err, OperationType.LIST, 'alerts');
        } else {
          console.error("Silent alert sync error:", err);
        }
        setLoadingAlerts(false);
      });
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [profile?.uid]);

  useEffect(() => {
    let unsubscribe: () => void;
    if (activeTab === 'students' && profile?.grade && profile?.section) {
      setLoadingStudents(true);
      const q = query(
        collection(db, 'users'),
        where('role', '==', 'student'),
        where('grade', '==', profile.grade),
        where('section', '==', profile.section),
        orderBy('name', 'asc')
      );
      unsubscribe = onSnapshot(q, (snapshot) => {
        setStudents(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoadingStudents(false);
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, 'users');
        setLoadingStudents(false);
      });
    }
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [activeTab, profile?.grade, profile?.section]);

  const saveNote = async (alertId: string) => {
    try {
      const alertRef = doc(db, 'alerts', alertId);
      await updateDoc(alertRef, {
        privateNote: noteContent,
        updatedAt: serverTimestamp()
      });
      setEditingNote(null);
    } catch (error) {
      console.error("Error saving note:", error);
    }
  };

  const resolveAlert = async (alertId: string) => {
    try {
      const alertRef = doc(db, 'alerts', alertId);
      await updateDoc(alertRef, {
        status: 'resolved',
        resolvedAt: serverTimestamp()
      });
      
      setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, status: 'resolved' } : a));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `alerts/${alertId}`);
    }
  };

  const studentCount = students.length;
  const avgSleep = journals.length > 0 ? (journals.reduce((acc, j) => acc + (j.sleep || 0), 0) / journals.length).toFixed(1) : '0';
  const avgMood = journals.length > 0 ? Math.round(journals.reduce((acc, j) => acc + (j.mood || 0), 0) / journals.length) : 0;
  const avgFocus = journals.length > 0 ? Math.round(journals.reduce((acc, j) => acc + (j.focus || 0), 0) / journals.length) : 0;
  const overallWellness = Math.round((Number(avgSleep) * 10 + avgMood + avgFocus) / 3);

  const groupedWeeks = groupByWeek(reports, r => r.date);
  const currentWeek = groupedWeeks[weekOffset] || { items: [], label: 'This Week', weekStart: new Date(), weekEnd: new Date() };

  const chartData = currentWeek.items
    .filter(r => {
      const day = new Date(r.date).getDay();
      return day !== 0 && day !== 6;
    })
    .map(r => ({
      name: format(new Date(r.date), 'EEE'),
      fullDate: format(new Date(r.date), 'MMM dd'),
      attendance: (r.presentStudents / r.totalStudents) * 100,
      health: r.healthScore || 0
    })).reverse();

  const weekLabel = currentWeek.label;

  return (
    <div className="space-y-8 pb-12">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-display font-semibold text-brand-900 tracking-tight">
            {activeTab === 'alerts' ? 'Student Wellness Alerts' : 
             activeTab === 'students' ? 'Students Directory' : 'Classroom Analytics'}
          </h1>
          <p className="text-slate-500">
            {activeTab === 'alerts' 
              ? 'Address concerning wellness trends in your classroom.' : 
             activeTab === 'students' ? `Managing students in ${profile?.grade} ${profile?.section}` :
             'Monitor wellness, nutrition, and engagement trends.'}
          </p>
        </div>
        <div className="flex gap-3">
          {/* Real-time sync enabled */}
        </div>
      </header>

      {activeTab === 'overview' && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <ScoreCard icon={Users} label="Students" value={studentCount.toString()} color="text-blue-500" />
            <ScoreCard icon={Activity} label="Overall Score" value={overallWellness.toString()} color="text-brand-500" />
            <ScoreCard icon={Clock} label="Avg Sleep" value={`${avgSleep}h`} color="text-indigo-500" />
            <ScoreCard icon={Smile} label="Avg Mood" value={avgMood.toString()} color="text-yellow-500" />
            <ScoreCard icon={Target} label="Avg Focus" value={avgFocus.toString()} color="text-green-500" />
            <ScoreCard 
              icon={AlertCircle} 
              label="Total Alerts" 
              value={alerts.length.toString()} 
              color="text-red-500"
              onClick={() => onTabChange('alerts')}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] border border-brand-200 shadow-sm space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-display font-semibold text-brand-900">Attendance & Health Trends</h2>
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
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="flex gap-4 text-xs font-semibold">
                   <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-brand-500" /> Health Score</span>
                   <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-500" /> Attendance</span>
                </div>
              </div>
              <div className="h-80 w-full overflow-x-auto overflow-y-hidden pb-2 scrollbar-thin scrollbar-thumb-brand-200 scrollbar-track-transparent">
                <div style={{ minWidth: '600px', height: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} domain={[0, 100]} />
                      <Tooltip 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-brand-900 text-white p-4 rounded-[1.5rem] shadow-2xl border border-white/10 backdrop-blur-md">
                                <p className="font-bold text-sm mb-2 border-b border-white/20 pb-2">{payload[0].payload.fullDate} ({payload[0].payload.name})</p>
                                <div className="space-y-1.5">
                                  <div className="flex justify-between items-center gap-6">
                                    <span className="text-[10px] uppercase font-black text-brand-400">Health</span>
                                    <span className="text-sm font-bold text-brand-300">{payload[0].value}%</span>
                                  </div>
                                  <div className="flex justify-between items-center gap-6">
                                    <span className="text-[10px] uppercase font-black text-blue-400">Attendance</span>
                                    <span className="text-sm font-bold text-blue-300">{payload[1]?.value}%</span>
                                  </div>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Line type="monotone" dataKey="health" stroke="#57b89d" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} />
                      <Line type="monotone" dataKey="attendance" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="bg-brand-900 text-white p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden">
              <div className="absolute -top-12 -right-12 w-48 h-48 bg-brand-500/20 rounded-full blur-3xl" />
              <h2 className="text-xl font-display font-semibold mb-6 flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-brand-200" /> AI Classroom Assistant
              </h2>
              {loadingInsights ? (
                <div className="space-y-4 animate-pulse">
                  <div className="h-4 bg-white/10 rounded w-3/4" />
                  <div className="h-4 bg-white/10 rounded w-full" />
                  <div className="h-4 bg-white/10 rounded w-2/3" />
                </div>
              ) : insights ? (
                <div className="space-y-6">
                  <div className="p-4 bg-white/10 rounded-[1.5rem] border border-white/10 prose prose-invert prose-sm">
                    <ReactMarkdown>{insights.summary}</ReactMarkdown>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-brand-200 uppercase tracking-wider mb-3">Priority Actions</h3>
                    <div className="space-y-3">
                      {insights.recommendations?.map((rec: any, i: number) => (
                        <div key={i} className="flex gap-3 text-sm">
                          <div className="mt-1 w-2 h-2 rounded-full bg-brand-200 shrink-0" />
                          <p><span className="font-bold text-white">{rec.title}:</span> {rec.content}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                 <p className="text-brand-100 opacity-60 italic">Submit more daily reports to generate classroom insights.</p>
              )}
            </div>
          </div>

          {/* Recent Daily Health Reports */}
          <div className="bg-white p-8 rounded-[2.5rem] border border-brand-200 shadow-sm space-y-6">
            <h2 className="text-xl font-display font-semibold text-brand-900">Recent Daily Health Reports</h2>
            <div className="space-y-4">
              {reports.slice(0, 5).map((report) => (
                <div key={report.id} className="p-4 bg-brand-50 rounded-2xl border border-brand-100 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-brand-900">{new Date(report.date).toLocaleDateString()}</p>
                    <p className="text-xs text-slate-500">Attendance: {report.presentStudents}/{report.totalStudents}</p>
                  </div>
                  <div className={cn(
                    "px-3 py-1 rounded-full text-xs font-bold",
                    report.healthScore! >= 80 ? "bg-green-50 text-green-600" : "bg-brand-50 text-brand-600"
                  )}>
                    Health Score: {report.healthScore}%
                  </div>
                </div>
              ))}
              {reports.length === 0 && (
                <p className="text-center py-8 text-slate-400 italic">No reports submitted yet.</p>
              )}
            </div>
          </div>
        </>
      )}

      {activeTab === 'students' && (
        <div className="space-y-6">
          {loadingStudents ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-brand-500"></div>
              <p className="text-slate-500">Loading student directory...</p>
            </div>
          ) : students.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {students.map((student) => (
                <motion.div 
                  key={student.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-white p-6 rounded-[2.5rem] border border-brand-200 shadow-sm hover:shadow-md transition-all group"
                >
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 rounded-[1.5rem] bg-brand-50 flex items-center justify-center text-2xl font-bold text-brand-500">
                      {student.name?.[0] || 'S'}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-brand-900 group-hover:text-brand-500 transition-colors">
                        {student.name}
                      </h3>
                      <p className="text-sm text-slate-400 font-medium">Student • {student.age} years old</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    <div className="p-3 bg-slate-50 rounded-xl">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Grade</p>
                      <p className="text-sm font-semibold text-brand-900">{student.grade}</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Section</p>
                      <p className="text-sm font-semibold text-brand-900">{student.section}</p>
                    </div>
                  </div>

                  <button className="w-full py-3 bg-brand-50 text-brand-500 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-brand-500 hover:text-white transition-all">
                    View Health Record <ChevronRight className="w-4 h-4" />
                  </button>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="bg-white p-20 rounded-[2.5rem] border border-brand-200 border-dashed text-center space-y-4">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
                <Users className="w-8 h-8 text-slate-300" />
              </div>
              <div className="max-w-xs mx-auto">
                <h3 className="text-lg font-bold text-brand-900">No Students Found</h3>
                <p className="text-slate-500 text-sm">No students have registered for {profile?.grade} {profile?.section} yet.</p>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'alerts' && (
        <div className="space-y-6">
          <div className="flex gap-2 items-center bg-white p-2 rounded-2xl shadow-sm border border-brand-200 max-w-fit">
            <span className="text-sm font-semibold text-slate-500 ml-4 mr-2">Filter:</span>
            {['all', 'high', 'medium', 'low'].map(s => (
              <button
                key={s}
                onClick={() => setSeverityFilter(s)}
                className={cn(
                  "px-4 py-2 rounded-xl text-sm font-bold uppercase tracking-widest transition-all",
                  severityFilter === s ? "bg-brand-500 text-white shadow-md shadow-brand-500/20" : "text-slate-400 hover:bg-slate-50"
                )}
              >
                {s}
              </button>
            ))}
          </div>

          {loadingAlerts ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-brand-500"></div>
              <p className="text-slate-500">Scanning wellness data...</p>
            </div>
          ) : alerts.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {alerts.filter(a => severityFilter === 'all' || a.severity === severityFilter).map((alert) => (
                <motion.div 
                  key={alert.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "bg-white p-6 rounded-[2.5rem] border shadow-sm relative overflow-hidden transition-all",
                    alert.status === 'resolved' ? "border-slate-200 opacity-60" : "border-red-100 shadow-red-100/50"
                  )}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "p-3 rounded-[1.5rem]",
                        alert.status === 'resolved' ? "bg-slate-50 text-slate-400" : "bg-red-50 text-red-500"
                      )}>
                        {alert.status === 'resolved' ? <CheckCircle2 className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
                      </div>
                      <div>
                        <h3 className={cn("text-lg font-bold tracking-tight", alert.status === 'resolved' ? "text-slate-500" : "text-brand-900")}>
                          {alert.studentName}
                        </h3>
                        <p className="text-sm text-slate-400">
                          {alert.status === 'resolved' ? 'Resolved trend' : 'Concerning wellness trend'}
                        </p>
                      </div>
                    </div>
                    {alert.status === 'pending' && (
                      <button 
                        onClick={() => resolveAlert(alert.id)}
                        className="px-4 py-2 bg-brand-500 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-brand-600 transition-all shadow-lg shadow-brand-500/20"
                      >
                        Mark Reviewed
                      </button>
                    )}
                  </div>

                    <div className="space-y-4">
                      {alert.snapshot && alert.status === 'pending' && (
                        <div className="grid grid-cols-3 gap-2">
                          <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 flex flex-col items-center justify-center text-center">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Mood</span>
                            <span className="text-lg font-bold text-blue-700">{alert.snapshot.mood}%</span>
                          </div>
                          <div className="p-3 bg-red-50/50 rounded-xl border border-red-100 flex flex-col items-center justify-center text-center">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Stress</span>
                            <span className="text-lg font-bold text-red-700">{alert.snapshot.stress}%</span>
                          </div>
                          <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-100 flex flex-col items-center justify-center text-center">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Energy</span>
                            <span className="text-lg font-bold text-amber-700">{alert.snapshot.energy}%</span>
                          </div>
                        </div>
                      )}

                    <div className="p-4 bg-brand-50/50 rounded-[1.5rem] border border-brand-100">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Alert Type</span>
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                          alert.severity === 'high' ? "bg-red-500 text-white" : "bg-brand-500 text-white"
                        )}>
                          {alert.severity} • {alert.type.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-sm text-brand-900 leading-relaxed font-semibold mb-2">Exact Reason:</p>
                      <p className="text-sm text-brand-900 leading-relaxed">{alert.message}</p>
                    </div>

                    <div className="border-t border-brand-100 pt-4">
                      {editingNote === alert.id ? (
                        <div className="space-y-2">
                          <textarea
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none resize-none"
                            rows={3}
                            placeholder="Add private note..."
                            value={noteContent}
                            onChange={(e) => setNoteContent(e.target.value)}
                          />
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => setEditingNote(null)} className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-lg">Cancel</button>
                            <button onClick={() => saveNote(alert.id)} className="px-3 py-1.5 text-xs font-bold bg-brand-500 text-white rounded-lg">Save</button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <h4 className="text-xs font-bold uppercase text-slate-400">Private Notes</h4>
                            <button 
                              onClick={() => { setEditingNote(alert.id); setNoteContent(alert.privateNote || ''); }}
                              className="text-brand-500 hover:text-brand-700 text-xs font-bold"
                            >
                              Edit Note
                            </button>
                          </div>
                          {alert.privateNote ? (
                             <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">{alert.privateNote}</p>
                          ) : (
                             <p className="text-sm text-slate-400 italic">No private notes added.</p>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex justify-between items-center text-xs text-slate-400 mt-4">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>Detected {alert.createdAt?.seconds ? new Date(alert.createdAt.seconds * 1000).toLocaleDateString() : 'recently'}</span>
                      </div>
                      {alert.status === 'resolved' && (
                         <div className="flex items-center gap-1 text-green-600 font-semibold">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Reviewed</span>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="bg-white p-20 rounded-[2.5rem] border border-brand-200 border-dashed text-center space-y-4">
              <div className="w-16 h-16 bg-brand-50 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-brand-500" />
              </div>
              <div className="max-w-xs mx-auto">
                <h3 className="text-lg font-bold text-brand-900">All Clear!</h3>
                <p className="text-slate-500 text-sm mb-6">No critical wellness alerts found for your students at this time.</p>
              </div>
            </div>
          )}
          
          <div className="p-6 bg-brand-900 rounded-[2.5rem] text-white relative overflow-hidden">
            <div className="flex items-center gap-4 relative z-10">
              <div className="p-3 bg-white/10 rounded-[1.2rem]">
                <Sparkles className="w-6 h-6 text-brand-200" />
              </div>
              <div>
                <h4 className="font-bold">Automated Trend Detection</h4>
                <p className="text-sm text-brand-100 opacity-80">ERGA automatically scans daily journals for patterns of low mood or extreme stress.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ScoreCard({ icon: Icon, label, value, color, onClick }: any) {
  return (
    <div 
      onClick={onClick}
      className={cn(
        "bg-white p-6 rounded-[2.5rem] border border-brand-200 shadow-sm hover:scale-[1.02] transition-transform",
        onClick && "cursor-pointer"
      )}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className={cn("p-2 rounded-xl", color.replace('text-', 'bg-').replace('500', '50'))}>
          <Icon className={cn("w-5 h-5", color)} />
        </div>
        <span className="text-slate-500 font-medium text-sm">{label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <h3 className="text-4xl font-display font-bold text-brand-900 tracking-tighter">{value}</h3>
      </div>
    </div>
  );
}