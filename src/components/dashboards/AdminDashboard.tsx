import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, orderBy, where, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { 
  Activity, Users, AlertTriangle, TrendingUp, Search, Clock, Zap, BookHeart, ChevronRight, BarChart3
} from 'lucide-react';
import { StudentJournal, UserProfile, WellnessAlert } from '../../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts';

interface AdminDashboardProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function AdminDashboard({ activeTab, onTabChange }: AdminDashboardProps) {
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [journals, setJournals] = useState<StudentJournal[]>([]);
  const [alerts, setAlerts] = useState<WellnessAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubStudents: () => void;
    let unsubJournals: () => void;
    let unsubAlerts: () => void;

    const fetchAdminData = async () => {
      setLoading(true);
      
      const qStudents = query(collection(db, 'users'), where('role', '==', 'student'));
      unsubStudents = onSnapshot(qStudents, (snap) => {
        setStudents(snap.docs.map(d => ({ ...d.data(), uid: d.id } as UserProfile)));
      }, (err) => console.error("Admin Students Error:", err));

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const qJournals = query(collection(db, 'studentJournals'), where('date', '>=', thirtyDaysAgo.toISOString().split('T')[0]));
      unsubJournals = onSnapshot(qJournals, (snap) => {
        setJournals(snap.docs.map(d => ({ id: d.id, ...d.data() } as StudentJournal)));
      }, (err) => console.error("Admin Journals Error:", err));

      const qAlerts = query(collection(db, 'alerts'), where('status', '==', 'pending'));
      unsubAlerts = onSnapshot(qAlerts, (snap) => {
        setAlerts(snap.docs.map(d => ({ id: d.id, ...d.data() } as WellnessAlert)));
      }, (err) => console.error("Admin Alerts Error:", err));

      setLoading(false);
    };

    fetchAdminData();
    
    return () => {
      if (unsubStudents) unsubStudents();
      if (unsubJournals) unsubJournals();
      if (unsubAlerts) unsubAlerts();
    };
  }, []);

  const getClassesStats = () => {
    const classesMap = new Map<string, any>();
    
    students.forEach(student => {
      if (!student.grade || !student.section) return;
      const className = `${student.grade} ${student.section}`;
      if (!classesMap.has(className)) {
        classesMap.set(className, {
          className,
          studentIds: new Set(),
          journals: [],
          alerts: 0
        });
      }
      classesMap.get(className).studentIds.add(student.uid);
    });

    journals.forEach(journal => {
      if (!journal.grade || !journal.section) return;
      const className = `${journal.grade} ${journal.section}`;
      if (classesMap.has(className)) {
        classesMap.get(className).journals.push(journal);
      }
    });

    alerts.forEach(alert => {
       
      
       const student = students.find(s => s.uid === alert.studentId);
       if (student && student.grade && student.section) {
         const className = `${student.grade} ${student.section}`;
         if (classesMap.has(className)) {
            classesMap.get(className).alerts++;
         }
       }
    });

    const stats = Array.from(classesMap.values()).map(c => {
      const studentCount = c.studentIds.size;
      const journalCount = c.journals.length;
      
      const avgSleep = journalCount > 0 ? c.journals.reduce((acc: number, j: any) => acc + (j.sleep || 0), 0) / journalCount : 0;
      const avgMood = journalCount > 0 ? c.journals.reduce((acc: number, j: any) => acc + (j.mood || 0), 0) / journalCount : 0;
      const avgFocus = journalCount > 0 ? c.journals.reduce((acc: number, j: any) => acc + (j.focus || 0), 0) / journalCount : 0;
      
      const sleepScore = Math.min((avgSleep / 8) * 100, 100);
      const moodScore = (avgMood / 5) * 100;
      const focusScore = (avgFocus / 5) * 100;

      const overallScore = journalCount > 0 ? Math.round((sleepScore + moodScore + focusScore) / 3) : 0;

      return {
        className: c.className,
        studentCount,
        overallScore,
        avgSleep: Math.round(avgSleep * 10) / 10,
        avgMood: Math.round(avgMood),
        avgFocus: Math.round(avgFocus),
        alerts: c.alerts
      };
    });

    return stats.sort((a, b) => b.overallScore - a.overallScore);
  };

  const classStats = getClassesStats();

  const renderOverview = () => (
    <div className="space-y-8 pb-12">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-display font-semibold text-brand-900 tracking-tight">School Overview</h1>
          <p className="text-slate-500">High-level summary of every class wellness.</p>
        </div>
      </header>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-[2rem] border border-brand-200 shadow-sm flex items-center gap-4">
           <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-500 flex justify-center items-center"><Users className="w-6 h-6" /></div>
           <div>
             <p className="text-sm font-semibold text-slate-500">Total Students</p>
             <p className="text-2xl font-bold">{students.length}</p>
           </div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-brand-200 shadow-sm flex items-center gap-4">
           <div className="w-12 h-12 rounded-xl bg-brand-50 text-brand-500 flex justify-center items-center"><Activity className="w-6 h-6" /></div>
           <div>
             <p className="text-sm font-semibold text-slate-500">Avg Wellness</p>
             <p className="text-2xl font-bold">{classStats.length > 0 ? Math.round(classStats.reduce((acc, c) => acc + c.overallScore, 0) / classStats.length) : 0}</p>
           </div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-brand-200 shadow-sm flex items-center gap-4">
           <div className="w-12 h-12 rounded-xl bg-red-50 text-red-500 flex justify-center items-center"><AlertTriangle className="w-6 h-6" /></div>
           <div>
             <p className="text-sm font-semibold text-slate-500">Active Alerts</p>
             <p className="text-2xl font-bold">{alerts.length}</p>
           </div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-brand-200 shadow-sm flex items-center gap-4">
           <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-500 flex justify-center items-center"><BookHeart className="w-6 h-6" /></div>
           <div>
             <p className="text-sm font-semibold text-slate-500">Journal Entries</p>
             <p className="text-2xl font-bold">{journals.length}</p>
           </div>
        </div>
      </div>

      {classStats.length > 0 && (
        <div className="bg-white p-8 rounded-[2.5rem] border border-brand-200 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-brand-900 flex items-center gap-3">
              <BarChart3 className="w-6 h-6 text-brand-500" />
              Class Wellness Comparison
            </h2>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={classStats} margin={{ top: 20, right: 30, left: 0, bottom: 5 }} barSize={40}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="className" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <RechartsTooltip 
                  cursor={{ fill: '#f1f5f9' }}
                  contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="overallScore" name="Wellness Score" radius={[8, 8, 8, 8]}>
                  {classStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.overallScore >= 80 ? '#10b981' : entry.overallScore >= 60 ? '#f59e0b' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
      
      <div className="bg-white p-8 rounded-[2.5rem] border border-brand-200 shadow-sm">
        <h2 className="text-2xl font-bold text-brand-900 mb-6">Class Summaries</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-brand-100 text-slate-500 text-sm font-semibold uppercase tracking-wider">
                <th className="pb-4 pr-4">Class</th>
                <th className="pb-4 px-4 text-center">Students</th>
                <th className="pb-4 px-4 text-center">Score</th>
                <th className="pb-4 px-4 text-center">Sleep (h)</th>
                <th className="pb-4 px-4 text-center">Mood</th>
                <th className="pb-4 px-4 text-center">Focus</th>
                <th className="pb-4 pl-4 text-center">Alerts</th>
              </tr>
            </thead>
            <tbody>
              {classStats.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 italic">No class data available. Students need to be assigned to classes.</td>
                </tr>
              ) : classStats.map((c, i) => (
                <tr key={i} className="border-b border-brand-50 hover:bg-brand-50/50 transition-colors">
                  <td className="py-4 pr-4 font-bold text-brand-900">{c.className}</td>
                  <td className="py-4 px-4 text-center text-slate-600">{c.studentCount}</td>
                  <td className="py-4 px-4 text-center">
                    <span className="bg-brand-100 text-brand-700 px-3 py-1 rounded-full text-sm font-bold">{c.overallScore}</span>
                  </td>
                  <td className="py-4 px-4 text-center text-slate-600">{c.avgSleep}h</td>
                  <td className="py-4 px-4 text-center text-slate-600">{c.avgMood}</td>
                  <td className="py-4 px-4 text-center text-slate-600">{c.avgFocus}</td>
                  <td className="py-4 pl-4 text-center">
                    {c.alerts > 0 ? (
                      <span className="text-red-500 font-bold bg-red-50 px-3 py-1 rounded-full text-sm">{c.alerts}</span>
                    ) : (
                      <span className="text-slate-400 text-sm">0</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderLeaderboard = () => (
    <div className="space-y-8 pb-12">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-display font-semibold text-brand-900 tracking-tight">School Leaderboard</h1>
          <p className="text-slate-500">Ranking classes by overall wellness score.</p>
        </div>
      </header>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {classStats.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-400 italic">No class data available to rank.</div>
        ) : classStats.map((c, i) => (
          <div key={i} className="bg-white p-6 rounded-[2rem] border border-brand-200 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group cursor-pointer" onClick={() => onTabChange('overview')}>
            <div className="absolute top-0 right-0 w-24 h-24 bg-brand-50 rounded-bl-[4rem] flex justify-end items-start p-6 -z-10 transition-transform group-hover:scale-110">
              <span className="text-4xl font-black text-brand-200/50">#{i + 1}</span>
            </div>
            
            <h3 className="text-2xl font-bold text-brand-900 mb-1">{c.className}</h3>
            <p className="text-sm font-medium text-slate-500 mb-6">{c.studentCount} Students</p>
            
            <div className="space-y-4">
              <div className="flex justify-between items-end border-b border-brand-50 pb-4">
                <span className="text-sm font-semibold text-slate-500">Overall Score</span>
                <span className="text-3xl font-black text-brand-500">{c.overallScore}</span>
              </div>
              
              <div className="grid grid-cols-3 gap-2 text-center pt-2">
                <div>
                  <p className="text-xs font-bold text-slate-400 mb-1">SLEEP</p>
                  <p className="text-sm font-bold text-indigo-900">{c.avgSleep}h</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 mb-1">MOOD</p>
                  <p className="text-sm font-bold text-yellow-600">{c.avgMood}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 mb-1">FOCUS</p>
                  <p className="text-sm font-bold text-blue-600">{c.avgFocus}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderAlerts = () => (
    <div className="space-y-8 pb-12">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-display font-semibold text-brand-900 tracking-tight">Active Alerts</h1>
          <p className="text-slate-500">School-wide pending wellness alerts.</p>
        </div>
      </header>
      
      {alerts.length === 0 ? (
        <div className="bg-white p-12 rounded-[2.5rem] border border-brand-200 shadow-sm text-center">
          <div className="w-16 h-16 bg-brand-50 text-brand-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Activity className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-brand-900 mb-2">No Active Alerts</h3>
          <p className="text-slate-500 max-w-md mx-auto">All classes are currently doing well. There are no pending wellness alerts.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {alerts.map((alert) => {
            const student = students.find(s => s.uid === alert.studentId);
            if (!student) return null;
            return (
              <div key={alert.id} className="bg-white p-6 rounded-[2rem] border border-brand-200 shadow-sm relative overflow-hidden group">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-brand-900 mb-1">
                      {student.name}
                    </h3>
                    <p className="text-sm font-semibold text-slate-500">
                      {student.grade} {student.section}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${alert.severity === 'high' ? 'bg-red-100 text-red-700' : 'bg-brand-100 text-brand-700'}`}>
                    {alert.severity} • {alert.type.replace('_', ' ')}
                  </span>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-4">
                  <p className="text-sm text-slate-700 font-medium">{alert.message}</p>
                </div>
                <div className="flex justify-between items-center text-xs text-slate-400 mt-2">
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    <span>{alert.createdAt?.seconds ? new Date(alert.createdAt.seconds * 1000).toLocaleDateString() : 'recently'}</span>
                  </div>
                  <span className="font-semibold text-amber-500 bg-amber-50 px-2 py-1 rounded-lg border border-amber-100">Pending Review by Teacher</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  if (loading) {
     return <div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div></div>;
  }

  if (activeTab === 'alerts') return renderAlerts();
  return activeTab === 'overview' ? renderOverview() : renderLeaderboard();
}