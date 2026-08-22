import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Smile, Zap, Moon, Target, MessageSquare, Save, Sparkles, LayoutDashboard, Book, ChevronRight, ChevronLeft, Search, Calendar, Plus, BarChart3, Clock, Wind, X } from 'lucide-react';
import { addDoc, collection, serverTimestamp, query, where, orderBy, limit, getDocs, updateDoc, doc, Timestamp, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { useAuth } from '../AuthProvider';
import { StudentJournal } from '../../types';
import { cn } from '../../lib/utils';
import { journalThemes, getFontClass } from '../../lib/theme';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { groupByWeek } from '../../lib/dateUtils';
import ReactMarkdown from 'react-markdown';
import { analyzeJournalRisk } from '../../services/aiService';

interface StudentDashboardProps {
  activeTab: string;
  onTabChange: (id: string) => void;
}

const moodEmojis = [
  { emoji: '😫', label: 'Awful', value: 10 },
  { emoji: '🙁', label: 'Bad', value: 30 },
  { emoji: '😐', label: 'Okay', value: 50 },
  { emoji: '🙂', label: 'Good', value: 75 },
  { emoji: '😊', label: 'Great', value: 100 },
];

export function StudentDashboard({ activeTab, onTabChange }: StudentDashboardProps) {
  const { profile } = useAuth();
  const [journals, setJournals] = useState<StudentJournal[]>([]);
  const [loading, setLoading] = useState(true);
  const [isBookOpen, setIsBookOpen] = useState(false);
  const [journalView, setJournalView] = useState<'create' | 'list'>('create');
  const [searchQuery, setSearchQuery] = useState('');
  const [weekOffset, setWeekOffset] = useState(0);
  const themeColor = (profile as any)?.journalTheme || 'ocean';
  const journalFont = (profile as any)?.journalFont || 'serif';
  

  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'ai', content: string }[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [showBreathing, setShowBreathing] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);

  const [formData, setFormData] = useState<Partial<StudentJournal>>({
    mood: 50,
    stress: 30,
    energy: 70,
    sleep: 8,
    focus: 60,
    happiness: 70,
    anxiety: 20,
    social: 50,
    motivation: 60,
    note: '',
    date: format(new Date(), 'yyyy-MM-dd'),
  });

  const [saveLoading, setSaveLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [wellnessTip, setWellnessTip] = useState<string>('');

  useEffect(() => {
    let unsubscribe: () => void;
    if (profile?.uid) {
      const q = query(
        collection(db, 'studentJournals'),
        where('studentId', '==', profile.uid),
        orderBy('date', 'desc'),
        limit(30)
      );
      setLoading(true);
      unsubscribe = onSnapshot(q, async (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StudentJournal));
        setJournals(data);
        setLoading(false);
        
        if (data.length > 0 && activeTab === 'overview') {
          const { getWellnessTip } = await import('../../services/aiService');
          const tip = await getWellnessTip(data[0]);
          setWellnessTip(tip);
        }
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, 'studentJournals');
        setLoading(false);
      });
    }
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [profile?.uid, activeTab]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isTyping) return;

    const userMessage = chatInput.trim();
    setChatInput('');
    const newMessages = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);
    setIsTyping(true);

    try {
      const { getMindfulnessAdvice } = await import('../../services/mindfulnessAI');
      const recentData = journals.slice(0, 7);

      let firstChunk = true;
      const finalRes = await getMindfulnessAdvice(newMessages, recentData, profile?.name || 'Student', (chunk) => {
        if (firstChunk) {
          firstChunk = false;
          setIsTyping(false);
          setMessages(prev => [...prev, { role: 'ai', content: chunk }]);
        } else {
          setMessages(prev => {
            const newMsgs = [...prev];
            const lastMsg = newMsgs[newMsgs.length - 1];
            if (lastMsg && lastMsg.role === 'ai') {
              newMsgs[newMsgs.length - 1] = { ...lastMsg, content: chunk };
            }
            return newMsgs;
          });
        }
      });
      
      
      setMessages(prev => {
        if (firstChunk) {
          return [...prev, { role: 'ai', content: finalRes }];
        } else {
          const newMsgs = [...prev];
          const lastMsg = newMsgs[newMsgs.length - 1];
          if (lastMsg && lastMsg.role === 'ai') {
            newMsgs[newMsgs.length - 1] = { ...lastMsg, content: finalRes };
          }
          return newMsgs;
        }
      });
    } catch (error) {
      setMessages(prev => [...prev, { role: 'ai', content: "Sorry, I'm having trouble thinking right now. Please try again later." }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveLoading(true);
    try {
      const targetDate = formData.date || format(new Date(), 'yyyy-MM-dd');
      const existingEntry = journals.find(j => j.date === targetDate);
      let journalId = '';

      const submitData = Object.fromEntries(
        Object.entries({
          ...formData,
          date: targetDate,
          studentId: profile?.uid || null,
          grade: profile?.grade || null,
          section: profile?.section || null,
        }).filter(([_, v]) => v !== undefined)
      );

      if (existingEntry) {
        await updateDoc(doc(db, 'studentJournals', existingEntry.id!), {
          ...submitData,
          updatedAt: serverTimestamp(),
        });
        journalId = existingEntry.id!;
      } else {
        const journalRef = await addDoc(collection(db, 'studentJournals'), {
          ...submitData,
          createdAt: serverTimestamp(),
        });
        journalId = journalRef.id;
      }
        
     
      try {
        let riskResult = await analyzeJournalRisk(formData);
        
        
        if (!riskResult.isAtRisk) {
          const mood = formData.mood || 0;
          const stress = formData.stress || 0;
          const energy = formData.energy || 100;
          const focus = formData.focus || 100;
          const happiness = formData.happiness || 100;
          
          if (mood < 25 || stress > 75 || energy < 15 || focus < 20 || happiness < 25) {
             riskResult = {
               isAtRisk: true,
               severity: (mood < 15 || stress > 90) ? 'high' : 'medium',
               alertType: stress > 75 ? 'stress-high' : 'mood-low',
               reason: `Automatic alert: Low wellness scores detected (Mood: ${mood}, Stress: ${stress}, Focus: ${focus}).`
             };
          }
        }
        
        if (riskResult.isAtRisk) {
          
          const teachersQuery = query(
            collection(db, 'users'),
            where('role', '==', 'teacher'),
            where('grade', '==', profile?.grade),
            where('section', '==', profile?.section)
          );
          const teachersSnapshot = await getDocs(teachersQuery);
          
          if (teachersSnapshot.empty) {
            console.warn(`No teacher found for ${profile?.grade} ${profile?.section}. Alerts cannot be dispatched.`);
            
          }
          
          const alertPromises = teachersSnapshot.docs.map(teacherDoc => {
            console.log(`Dispatching alert to teacher: ${teacherDoc.id}`);
            return addDoc(collection(db, 'alerts'), {
              studentId: profile?.uid,
              studentName: profile?.name,
              teacherId: teacherDoc.id,
              type: riskResult.alertType || 'high_stress',
              severity: riskResult.severity || 'medium',
              message: riskResult.reason || `${profile?.name} reported a concerning wellness entry.`,
              status: 'pending',
              journalId: journalId,
              snapshot: {
                mood: formData.mood || 0,
                stress: formData.stress || 0,
                energy: formData.energy || 0
              },
              createdAt: serverTimestamp()
            });
          });

          await Promise.all(alertPromises);
          console.log('AI Wellness alerts dispatched to teachers');
        }
      } catch (error) {
        console.error("Error creating alert:", error);
      }
      
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setJournalView('list');
      }, 2000);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'studentJournals');
    } finally {
      setSaveLoading(false);
    }
  };

  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());

  
  const calculateStreak = () => {
    if (journals.length === 0) return 0;
    
    
    const sorted = [...journals].sort((a, b) => b.date.localeCompare(a.date));
    const today = format(new Date(), 'yyyy-MM-dd');
    const yesterday = format(new Date(Date.now() - 86400000), 'yyyy-MM-dd');
    
    let streak = 0;
    let checkDate = sorted[0].date === today ? today : yesterday;
    
    
    if (sorted[0].date !== today && sorted[0].date !== yesterday) return 0;

    const entryDates = new Set(journals.map(j => j.date));
    let currentCheck = new Date(checkDate);
    
    while (entryDates.has(format(currentCheck, 'yyyy-MM-dd'))) {
      streak++;
      currentCheck.setDate(currentCheck.getDate() - 1);
    }
    
    return streak;
  };

  const streak = calculateStreak();


  const activeTheme = journalThemes[themeColor] || journalThemes.ocean;

  const groupedWeeks = groupByWeek(journals, j => j.date);
  const currentWeek = groupedWeeks[weekOffset] || { items: [], label: 'This Week', weekStart: new Date(), weekEnd: new Date() };

  const chartData = currentWeek.items
    .filter(j => {
      const day = new Date(j.date).getDay();
      return day !== 0 && day !== 6;
    })
    .map(j => ({
      date: format(new Date(j.date), 'EEE'),
      fullDate: format(new Date(j.date), 'MMM dd'),
      stress: j.stress,
      sleep: (j.sleep || 0) * 8.3, 
      actualSleep: j.sleep,
      mood: j.mood
    }));

  const weekLabel = currentWeek.label;

  const firstName = profile?.name?.split(' ')[0] || 'Student';

  const filteredJournals = journals.filter(j => 
    format(new Date(j.date), 'MMM dd, yyyy').toLowerCase().includes(searchQuery.toLowerCase()) ||
    j.note?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto px-4 pb-20">
      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
            <motion.div 
              key="overview"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8 pb-20"
            >
              <header className="bg-white p-8 rounded-[2.5rem] border border-brand-200 relative overflow-hidden shadow-sm">
                <div className="absolute -right-12 -top-12 opacity-5 pointer-events-none">
                  <Sparkles className="w-64 h-64 text-brand-900" />
                </div>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                  <div>
                    <h1 className="text-4xl font-display font-semibold text-brand-900 tracking-tight leading-tight">
                      Welcome back, {firstName}!
                    </h1>
                    <p className="text-slate-500 mt-2 text-lg font-light">Here's your wellness journey at a glance.</p>
                  </div>
                  <div className="flex gap-4">
                     {streak > 0 && (
                       <div className="bg-orange-50 px-5 py-3 rounded-[1.5rem] border border-orange-100 flex items-center gap-3 shadow-sm">
                         <div className="w-8 h-8 bg-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20">
                           <Zap className="w-4 h-4 text-white fill-current" />
                         </div>
                         <div>
                           <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest">Streak</p>
                           <p className="text-sm font-bold text-orange-700">{streak} Days</p>
                         </div>
                       </div>
                     )}
                     <QuickState icon={Clock} label="Last Entry" value={journals[0] ? format(new Date(journals[0].date), 'MMM dd') : 'None'} />
                     <QuickState icon={BarChart3} label="Total Entries" value={journals.length.toString()} />
                  </div>
                </div>
              </header>

              {/* Charts Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Wellness Tip Card */}
                {wellnessTip && (
                  <div className="lg:col-span-2 bg-gradient-to-r from-brand-50 to-indigo-50 p-8 rounded-[2.5rem] border border-brand-100 shadow-sm flex items-start gap-6">
                    <div className="w-12 h-12 bg-brand-500 rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-brand-500/30">
                      <Sparkles className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-brand-900 mb-2">Wellness Tip of the Day</h3>
                      <p className="text-brand-700 font-medium leading-relaxed">{wellnessTip}</p>
                    </div>
                  </div>
                )}
                {/* Stress vs Sleep Graph Card */}
                <div className="bg-white p-8 rounded-[2.5rem] border border-brand-200 shadow-sm group hover:shadow-md transition-shadow">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
                    <div>
                      <h2 className="text-2xl font-bold text-brand-900">Vitals</h2>
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
                    <div className="flex bg-slate-50 p-2 rounded-[1.5rem] gap-6 border border-slate-100">
                      <LegendItem dotColor="bg-brand-500" label="Stress" />
                      <LegendItem dotColor="bg-indigo-500" label="Sleep" />
                    </div>
                  </div>

                  <div className="h-[300px] w-full">
                    {loading ? (
                       <div className="h-full flex items-center justify-center">
                         <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
                       </div>
                    ) : chartData.length > 1 ? (
                      <div className="overflow-x-auto overflow-y-hidden w-full h-full pb-2 scrollbar-thin scrollbar-thumb-brand-200 scrollbar-track-transparent">
                        <div style={{ minWidth: '600px', height: '100%' }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData} margin={{ top: 5, right: 20, left: -20, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                              <XAxis 
                                dataKey="date" 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fill: '#64748b', fontSize: 13, fontWeight: 600 }}
                                dy={15}
                              />
                              <YAxis hide domain={[0, 100]} />
                               <Tooltip 
                                content={({ active, payload }) => {
                                  if (active && payload && payload.length) {
                                    return (
                                      <div className="bg-brand-900 text-white p-4 rounded-[1.5rem] shadow-2xl border border-white/10 backdrop-blur-md">
                                        <p className="font-bold text-sm mb-2 border-b border-white/20 pb-2">{payload[0].payload.fullDate} ({payload[0].payload.date})</p>
                                        <div className="space-y-1.5">
                                          <div className="flex justify-between items-center gap-6">
                                            <span className="text-[10px] uppercase font-black text-brand-400">Stress</span>
                                            <span className="text-sm font-bold text-brand-300">{payload[0].value}%</span>
                                          </div>
                                          <div className="flex justify-between items-center gap-6">
                                            <span className="text-[10px] uppercase font-black text-indigo-400">Sleep</span>
                                            <span className="text-sm font-bold text-indigo-300">{payload[0].payload.actualSleep}h</span>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  }
                                  return null;
                                }}
                              />
                              <Line type="monotone" dataKey="stress" stroke="#7c3aed" strokeWidth={4} dot={{ r: 5, fill: '#7c3aed', strokeWidth: 0 }} activeDot={{ r: 8, strokeWidth: 2, stroke: '#fff' }} animationDuration={2000} />
                              <Line type="monotone" dataKey="sleep" stroke="#6366f1" strokeWidth={4} dot={{ r: 5, fill: '#6366f1', strokeWidth: 0 }} activeDot={{ r: 8, strokeWidth: 2, stroke: '#fff' }} animationDuration={2000} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    ) : (
                      <ChartPlaceholder icon={BarChart3} label="More data needed" />
                    )}
                  </div>
                </div>

                {/* Mood Graph Card */}
                <div className="bg-white p-8 rounded-[2.5rem] border border-brand-200 shadow-sm group hover:shadow-md transition-shadow">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
                    <div>
                      <h2 className="text-2xl font-bold text-brand-900">Mood Tracking</h2>
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
                    <div className="flex bg-slate-50 p-2 rounded-[1.5rem] gap-6 border border-slate-100">
                      <LegendItem dotColor="bg-yellow-400" label="Mood Level" />
                    </div>
                  </div>

                  <div className="h-[300px] w-full">
                    {loading ? (
                       <div className="h-full flex items-center justify-center">
                         <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
                       </div>
                    ) : chartData.length > 1 ? (
                      <div className="overflow-x-auto overflow-y-hidden w-full h-full pb-2 scrollbar-thin scrollbar-thumb-brand-200 scrollbar-track-transparent">
                        <div style={{ minWidth: '600px', height: '100%' }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData} margin={{ top: 5, right: 20, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis 
                            dataKey="date" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fill: '#64748b', fontSize: 13, fontWeight: 600 }}
                            dy={15}
                          />
                          <YAxis hide domain={[0, 100]} />
                          <Tooltip 
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                return (
                                      <div className="bg-brand-900 text-white p-4 rounded-[1.5rem] shadow-2xl border border-white/10 backdrop-blur-md">
                                        <p className="font-bold text-sm mb-2 border-b border-white/20 pb-2">{payload[0].payload.fullDate} ({payload[0].payload.date})</p>
                                        <div className="flex justify-between items-center gap-6">
                                      <span className="text-[10px] uppercase font-black text-yellow-400">Mood</span>
                                      <span className="text-sm font-bold text-yellow-300">{payload[0].value}%</span>
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Line 
                            type="stepAfter" 
                            dataKey="mood" 
                            stroke="#facc15" 
                            strokeWidth={4} 
                            dot={{ r: 6, fill: '#facc15', strokeWidth: 2, stroke: '#fff' }}
                            activeDot={{ r: 10, strokeWidth: 3, stroke: '#fff' }}
                            animationDuration={2000}
                          />
                        </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    ) : (
                      <ChartPlaceholder icon={Smile} label="Mood chart locked" />
                    )}
                  </div>
                </div>
              </div>

              {/* Weekly Average Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <DeepStatCard 
                   label="Weekly Sleep" 
                   value={`${(journals.reduce((acc, curr) => acc + (curr.sleep || 0), 0) / (journals.length || 1)).toFixed(1)}h`} 
                   icon={Moon} 
                   color="bg-indigo-500"
                   percentage={((journals.reduce((acc, curr) => acc + (curr.sleep || 0), 0) / (journals.length || 1)) / 12) * 100}
                />
                <DeepStatCard 
                   label="Latest Mood" 
                   value={journals[0]?.mood ? `${journals[0].mood}%` : 'N/A'} 
                   icon={Smile} 
                   color="bg-yellow-400"
                   percentage={journals[0]?.mood || 0}
                />
                <DeepStatCard 
                   label="Class Focus" 
                   value={`${(journals.slice(0, 7).reduce((acc, curr) => acc + (curr.focus || 0), 0) / (Math.min(journals.length, 7) || 1)).toFixed(0)}%`} 
                   icon={Target} 
                   color="bg-emerald-500"
                   percentage={(journals.slice(0, 7).reduce((acc, curr) => acc + (curr.focus || 0), 0) / (Math.min(journals.length, 7) || 1))}
                />
              </div>
            </motion.div>
          )}

          {activeTab === 'journal' && (
            <motion.div 
              key="journal"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="flex justify-center items-center min-h-[600px] perspective-1000 mb-20"
            >
              {!isBookOpen ? (
                /* Book Cover View */
                <motion.div 
                  onClick={() => setIsBookOpen(true)}
                  whileHover={{ rotateY: -20, x: -30, scale: 1.02 }}
                  className={cn(
                    "w-[420px] h-[580px] rounded-r-[3rem] rounded-l-md shadow-[40px_40px_80px_-20px_rgba(0,0,0,0.3)] relative cursor-pointer group transform-gpu transition-all duration-700 border-l-[15px]",
                    activeTheme.cover,
                    activeTheme.spine
                  )}
                  style={{ transformOrigin: 'left center' }}
                >
                  <div className="absolute inset-5 border border-white/10 rounded-r-[2.5rem] pointer-events-none"></div>
                  <div className="flex flex-col items-center justify-center h-full text-center p-14 text-white relative z-10">
                    <div className="mb-12 w-32 h-32 flex items-center justify-center rounded-full bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl relative">
                      <span className="text-6xl">{activeTheme.emoji}</span>
                      <motion.div 
                        animate={{ scale: [1, 1.2, 1] }} 
                        transition={{ duration: 4, repeat: Infinity }}
                        className="absolute -top-1 -right-1"
                      >
                        <Sparkles className={cn("w-6 h-6", activeTheme.accent)} />
                      </motion.div>
                    </div>
                    <h2 className={cn("text-4xl mb-6 leading-tight font-bold tracking-tight", getFontClass(journalFont))}>
                      {firstName}
                      <span className={cn("block text-2xl mt-4 font-light italic capitalize tracking-normal", activeTheme.accent)}>Well begin journey</span>
                    </h2>
                    <div className={cn("w-16 h-1 mb-8 mx-auto rounded-full shadow-inner shadow-black/20", activeTheme.accentBg)}></div>
                  </div>
                  
                  {/* Edge detailing */}
                  <div className="absolute right-3 top-0 bottom-0 w-8 flex flex-col justify-around py-4 opacity-10 pointer-events-none">
                    {[...Array(20)].map((_, i) => <div key={i} className="h-0.5 w-full bg-white" />)}
                  </div>

                  <div className={cn("absolute right-0 top-1/2 -translate-y-1/2 p-4 rounded-l-2xl shadow-xl translate-x-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-500", activeTheme.coverHoverBtn)}>
                     <ChevronRight className={cn("w-8 h-8", activeTheme.accent)} />
                  </div>
                </motion.div>
              ) : (
                /* Opened Book View */
                <motion.div 
                  initial={{ rotateY: -100, opacity: 0 }}
                  animate={{ rotateY: 0, opacity: 1 }}
                  transition={{ duration: 1, ease: "circOut" }}
                  className={cn(
                    "w-full max-w-6xl bg-[#faf9f6] rounded-[3rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.25)] flex min-h-[700px] relative overflow-hidden border-[15px] group/book",
                    activeTheme.pageBorder
                  )}
                >
                  {/* Decorative Borders/Frames */}
                  <div className="absolute inset-4 border-2 border-stone-200/40 rounded-[2.5rem] pointer-events-none z-20"></div>
                  <div className="absolute inset-8 border border-stone-200/20 rounded-[2rem] pointer-events-none z-20"></div>

                  {/* Book Gutter/Spine Shadow */}
                  <div className="absolute left-[35%] top-0 bottom-0 w-16 -translate-x-1/2 bg-gradient-to-r from-stone-50 via-black/10 to-stone-50 z-10 pointer-events-none shadow-inner opacity-40"></div>

                  {/* Left Page (Calendar & Date Selector) */}
                  <div className="w-[35%] bg-white border-r border-stone-200 flex flex-col z-0 relative">
                    <div className="p-8 border-b border-stone-100 relative">
                      <div className="flex justify-between items-center mb-6">
                        <button 
                          onClick={() => setIsBookOpen(false)}
                          className="text-slate-400 hover:text-brand-900 transition-all flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] group/btn"
                        >
                          <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" /> Back
                        </button>
                      </div>
                      
                      <button 
                        onClick={() => {
                          const todayStr = format(new Date(), 'yyyy-MM-dd');
                          const todayEntry = journals.find(j => j.date === todayStr);
                          
                          if (todayEntry) {
                            setFormData({
                              ...todayEntry,
                              date: todayStr
                            });
                          } else {
                            setFormData({
                              mood: 50, stress: 30, energy: 70, sleep: 8, focus: 60, happiness: 70, anxiety: 20, social: 50, motivation: 60, note: '',
                              date: todayStr
                            });
                          }
                          setJournalView('create');
                          setSelectedEntryId(null);
                        }}
                        className={cn(
                          "w-full py-3 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-3 transition-all shadow-xl active:scale-[0.98]",
                          activeTheme.bg,
                          "hover:brightness-110 shadow-black/10"
                        )}
                      >
                        {journals.find(j => j.date === format(new Date(), 'yyyy-MM-dd')) ? <><Zap className="w-4 h-4" /> Edit Today's Reflection</> : <><Plus className="w-4 h-4" /> New Reflections</>}
                      </button>
                    </div>
                    
                    <div className="p-6 flex-1 flex flex-col space-y-6">
                      <div className="flex items-center justify-between px-2">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Date</h4>
                        <div className="flex gap-1">
                          <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))} className="p-1 hover:bg-slate-100 rounded-md transition-colors"><ChevronLeft className="w-4 h-4" /></button>
                          <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))} className="p-1 hover:bg-slate-100 rounded-md transition-colors"><ChevronRight className="w-4 h-4" /></button>
                        </div>
                      </div>
                      
                      <div className="bg-stone-50 p-4 rounded-[2rem] border border-stone-100 shadow-inner">
                        <p className="text-center text-sm font-bold text-slate-700 mb-4">{format(currentDate, 'MMMM yyyy')}</p>
                        <div className="grid grid-cols-7 gap-1 text-center">
                          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, index) => <span key={`${d}-${index}`} className="text-[9px] font-black text-slate-300 uppercase">{d}</span>)}
                          {Array.from({ length: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay() }).map((_, i) => <div key={`empty-${i}`} />)}
                          {Array.from({ length: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate() }).map((_, i) => {
                            const dateObj = new Date(currentDate.getFullYear(), currentDate.getMonth(), i + 1);
                            const dateStr = format(dateObj, 'yyyy-MM-dd');
                            const todayStr = format(new Date(), 'yyyy-MM-dd');
                            const entry = journals.find(j => j.date === dateStr);
                            const isSelected = journals.find(j => j.id === selectedEntryId)?.date === dateStr;
                            const isToday = dateStr === todayStr;
                            const isPast = dateObj < new Date(new Date().setHours(0,0,0,0));
                            const canInteract = entry || isToday;
                            
                            return (
                              <button 
                                key={i}
                                disabled={!canInteract}
                                onClick={() => {
                                  if (entry) {
                                    if (isToday) {
                                      setFormData({ ...entry });
                                      setJournalView('create');
                                      setSelectedEntryId(null);
                                    } else {
                                      setSelectedEntryId(entry.id!);
                                      setJournalView('list');
                                    }
                                  } else if (isToday) {
                                    setFormData({ 
                                      mood: 50, stress: 30, energy: 70, sleep: 8, focus: 60, happiness: 70, anxiety: 20, social: 50, motivation: 60, note: '',
                                      date: dateStr 
                                    });
                                    setJournalView('create');
                                    setSelectedEntryId(null);
                                  }
                                }}
                                className={cn(
                                  "aspect-square flex items-center justify-center text-xs rounded-lg transition-all relative group",
                                  isSelected ? cn(activeTheme.bg, "text-white font-bold z-10 scale-110 shadow-lg") : 
                                  isToday ? cn("border-2 text-brand-900 font-black", activeTheme.borderStrong) :
                                  entry ? "bg-white text-slate-700 border border-brand-100 font-bold hover:bg-brand-50" : "text-slate-300 opacity-40 cursor-default"
                                )}
                              >
                                {i + 1}
                                {entry && !isSelected && <div className={cn("absolute bottom-1 w-1 h-1 rounded-full", activeTheme.bg)} />}
                                {isToday && !entry && <div className={cn("absolute -top-1 -right-1 w-2 h-2 rounded-full animate-pulse", activeTheme.bg)} />}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Recent List */}
                      <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar pr-1">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 opacity-50">Quick History</p>
                        {journals.slice(0, 5).map(entry => (
                          <button 
                            key={entry.id}
                            onClick={() => {
                              setSelectedEntryId(entry.id!);
                              setJournalView('list');
                            }}
                            className={cn(
                              "w-full p-4 rounded-xl text-left border flex items-center justify-between group transition-all",
                              selectedEntryId === entry.id ? "bg-brand-50 border-brand-200" : "bg-white border-transparent hover:bg-slate-50"
                            )}
                          >
                             <div className="flex items-center gap-3">
                               <div className={cn(
                                 "w-10 h-10 rounded-xl flex items-center justify-center text-[10px] font-black",
                                 selectedEntryId === entry.id ? "bg-white text-brand-900" : "bg-slate-50 text-slate-400"
                               )}>
                                 {format(new Date(entry.date), 'dd')}
                               </div>
                               <div>
                                 <p className="text-xs font-bold text-slate-700 line-clamp-1">{entry.note || 'Reflection'}</p>
                                 <p className="text-[10px] text-slate-400 font-medium">{format(new Date(entry.date), 'MMM yyyy')}</p>
                               </div>
                             </div>
                             <ChevronRight className={cn("w-4 h-4 transition-transform", selectedEntryId === entry.id ? "text-brand-500 translate-x-1" : "text-slate-200")} />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right Page (Editor / Content) */}
                  <div className="flex-1 bg-stone-50 p-16 flex flex-col relative z-0">
                    <AnimatePresence mode="wait">
                        <motion.div
                          key={journalView + (selectedEntryId || 'new')}
                          initial={{ rotateY: -30, opacity: 0, x: 20, transformOrigin: 'left center' }}
                          animate={{ rotateY: 0, opacity: 1, x: 0 }}
                          exit={{ rotateY: 30, opacity: 0, x: -20 }}
                          transition={{ duration: 0.5, ease: "easeInOut" }}
                          className="h-full flex flex-col relative z-20"
                        >
                          {journalView === 'create' ? (
                            <form onSubmit={handleSubmit} className="h-full flex flex-col relative">
                              {/* Inner Page Border */}
                              <div className="absolute -inset-8 border border-stone-200/30 rounded-[2.5rem] pointer-events-none"></div>
                              
                              <div className="flex justify-between items-start mb-12 pb-6 border-b border-stone-200/60">
                                <div>
                                  <p className={cn("text-[10px] font-black uppercase tracking-[0.4em] mb-1", activeTheme.accent)}>
                                    {journals.find(j => j.date === formData.date) ? 'Editing Reflections' : 'New Entry'}
                                  </p>
                                  <h3 className={cn("text-3xl font-bold", activeTheme.text, getFontClass(journalFont))}>Today's Reflection</h3>
                                  <p className={cn("text-slate-500 font-medium text-base mt-1 italic", getFontClass(journalFont))}>{format(new Date(formData.date!), 'EEEE, MMMM do')}</p>
                                </div>
                                <div className={cn("p-3 bg-white rounded-xl border border-stone-200 shadow-sm opacity-20", activeTheme.text)}>
                                  <Plus className="w-6 h-6" />
                                </div>
                              </div>
                              
                              {/* Editor Form Content */}
                              <div className="flex-1 flex flex-col gap-10">
                                <div className="grid grid-cols-2 gap-x-12 gap-y-8">
                                  <JournalSlider label="Energy" value={formData.energy!} onChange={v => setFormData({...formData, energy: v})} color="bg-orange-400" />
                                  <JournalSlider label="Sleep" value={formData.sleep!} max={12} onChange={v => setFormData({...formData, sleep: v})} color="bg-indigo-400" />
                                  <div className="space-y-4">
                                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] group-hover/slider:text-brand-900 transition-colors uppercase">My Mood</label>
                                    <div className="flex justify-between items-center bg-white p-2 rounded-[1.5rem] border border-stone-100 shadow-inner">
                                      {moodEmojis.map((m) => (
                                        <button
                                          key={m.value}
                                          type="button"
                                          onClick={() => setFormData({ ...formData, mood: m.value })}
                                          className={cn(
                                            "w-10 h-10 flex items-center justify-center text-xl rounded-xl transition-all relative group",
                                            formData.mood === m.value 
                                              ? "bg-yellow-400 scale-110 shadow-lg shadow-yellow-400/20" 
                                              : "hover:bg-slate-50 text-slate-300 hover:text-slate-600 grayscale hover:grayscale-0"
                                          )}
                                        >
                                          {m.emoji}
                                          {formData.mood === m.value && (
                                            <motion.div 
                                              layoutId="mood-active"
                                              className="absolute -bottom-2 w-1.5 h-1.5 bg-yellow-600 rounded-full"
                                            />
                                          )}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                  <JournalSlider label="Peace" value={100 - formData.stress!} onChange={v => setFormData({...formData, stress: 100 - v})} color="bg-emerald-400" />
                                </div>
                                <div className={cn("flex-1 pt-6 border-t-2 relative text-slate-700", activeTheme.border, getFontClass(journalFont))}>
                                  <textarea value={formData.note} onChange={e => setFormData({...formData, note: e.target.value})} required className="w-full bg-transparent border-none focus:ring-0 p-4 text-xl font-light leading-loose placeholder:text-stone-300 resize-none h-full min-h-[300px]" placeholder="What's on your mind today?" />
                                  {/* Internal Decorative Border */}
                                  <div className={cn("absolute inset-0 border-2 rounded-[2rem] pointer-events-none opacity-10", activeTheme.border)}></div>
                                </div>
                              </div>

                              <div className="mt-8 flex justify-end">
                                 <button 
                                   disabled={saveLoading} 
                                   type="submit" 
                                   className={cn(
                                     "px-10 py-4 rounded-[1.5rem] font-bold text-base flex items-center gap-3 transition-all transform active:scale-95 shadow-xl shadow-black/10", 
                                     success ? "bg-green-500 text-white" : cn(activeTheme.bg, "text-white hover:brightness-110")
                                   )}
                                 >
                                   {success ? <><Zap className="w-5 h-5" /> Saved</> : <><Save className="w-5 h-5" /> {saveLoading ? 'Archiving...' : journals.find(j => j.date === formData.date) ? 'Update reflections' : 'Record reflections'}</>}
                                 </button>
                              </div>
                            </form>
                          ) : (
                            <div className="h-full flex flex-col relative text-slate-700">
                              {/* Inner Page Border */}
                              <div className="absolute -inset-8 border border-stone-200/30 rounded-[2.5rem] pointer-events-none"></div>
                              
                              {journals.find(j => j.id === selectedEntryId) ? (
                                <>
                                  <div className="flex justify-between items-start mb-12 pb-6 border-b border-stone-200/60">
                                    <div>
                                      <p className={cn("text-[10px] font-black uppercase tracking-[0.4em] mb-1", activeTheme.accent)}>Archived Page</p>
                                      <h3 className={cn("text-3xl font-bold", activeTheme.text, getFontClass(journalFont))}>Reflection</h3>
                                      <p className={cn("text-slate-500 font-medium text-base mt-1 italic", getFontClass(journalFont))}>
                                        {format(new Date(journals.find(j => j.id === selectedEntryId)!.date), 'EEEE, MMMM do, yyyy')}
                                      </p>
                                    </div>
                                    <div className="p-3 bg-white rounded-xl border border-stone-200 shadow-sm text-brand-400">
                                      <Book className="w-6 h-6" />
                                    </div>
                                  </div>
                                  
                                  <div className="flex-1 space-y-12 overflow-y-auto custom-scrollbar pr-4">
                                    <div className="grid grid-cols-2 gap-6">
                                       <ReviewStat label="Energy" value={journals.find(j => j.id === selectedEntryId)!.energy!} color="bg-orange-400" />
                                       <ReviewStat label="Sleep" value={journals.find(j => j.id === selectedEntryId)!.sleep!} max={12} color="bg-indigo-400" unit="h" />
                                       <div className="bg-white p-5 rounded-[1.5rem] border border-stone-100 shadow-sm flex items-center justify-between">
                                          <div>
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Mood</span>
                                            <span className="text-xl font-bold text-brand-900">
                                              {moodEmojis.find(m => m.value === journals.find(j => j.id === selectedEntryId)!.mood)?.label || 'Not Set'}
                                            </span>
                                          </div>
                                          <div className="text-3xl">
                                            {moodEmojis.find(m => m.value === journals.find(j => j.id === selectedEntryId)!.mood)?.emoji || '😶'}
                                          </div>
                                       </div>
                                       <ReviewStat label="Stress" value={journals.find(j => j.id === selectedEntryId)!.stress!} color="bg-red-400" inverse />
                                    </div>
                                    
                                    <div className="pt-8 border-t border-stone-200/40">
                                      <div className="flex items-center gap-3 mb-6 opacity-40">
                                         <div className="w-1.5 h-1.5 rounded-full bg-brand-900" />
                                         <span className="text-[10px] font-black text-brand-900 uppercase">Personal Note</span>
                                      </div>
                                      <p className={cn("text-2xl font-light leading-loose italic border-l-4 border-brand-100 pl-8", getFontClass(journalFont))}>
                                         "{journals.find(j => j.id === selectedEntryId)!.note}"
                                      </p>
                                    </div>
                                  </div>
                                </>
                              ) : (
                                 <div className="h-full flex items-center justify-center text-center">
                                    <p className="text-slate-400 italic">Select a date on the calendar to read your entry.</p>
                                 </div>
                              )}
                            </div>
                          )}
                        </motion.div>
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {activeTab === 'mindfulness' && (
            <motion.div 
              key="mindfulness"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="h-[calc(100vh-160px)] flex flex-col bg-white rounded-[2.5rem] border border-brand-200 shadow-xl overflow-hidden relative"
            >
              <AnimatePresence>
                {showBreathing && (
                  <BreathingExercise onClose={() => setShowBreathing(false)} />
                )}
                {showQuiz && (
                  <WellnessAssessment 
                    onClose={() => setShowQuiz(false)} 
                    onComplete={async (answers) => {
                      setShowQuiz(false);
                      const assessmentText = `I just finished my Wellness Assessment. Here are my results:
- Sleep: ${answers[0]}
- Focus: ${answers[1]}
- Stress Management: ${answers[2]}
- Goal for today: ${answers[3]}

Santi, can you analyze this and provide some personalized remedies or precautions?`;
                      
                      const userMsg = { role: 'user' as const, content: assessmentText };
                      setMessages(prev => [...prev, userMsg]);
                      setIsTyping(true);
                      
                      try {
                        const { getMindfulnessAdvice } = await import('../../services/mindfulnessAI');
                        let firstChunk = true;
                        const finalRes = await getMindfulnessAdvice(assessmentText, [formData as any], profile?.name || 'Student', (chunk) => {
                          if (firstChunk) {
                            firstChunk = false;
                            setIsTyping(false);
                            setMessages(prev => [...prev, { role: 'ai', content: chunk }]);
                          } else {
                            setMessages(prev => {
                              const newMsgs = [...prev];
                              const lastMsg = newMsgs[newMsgs.length - 1];
                              if (lastMsg && lastMsg.role === 'ai') {
                                newMsgs[newMsgs.length - 1] = { ...lastMsg, content: chunk };
                              }
                              return newMsgs;
                            });
                          }
                        });

                        setMessages(prev => {
                          if (firstChunk) {
                            return [...prev, { role: 'ai', content: finalRes }];
                          } else {
                            const newMsgs = [...prev];
                            const lastMsg = newMsgs[newMsgs.length - 1];
                            if (lastMsg && lastMsg.role === 'ai') {
                              newMsgs[newMsgs.length - 1] = { ...lastMsg, content: finalRes };
                            }
                            return newMsgs;
                          }
                        });
                      } catch (error) {
                        console.error('Wellness Analysis Error:', error);
                        setMessages(prev => [...prev, { role: 'ai', content: "I'm having a little trouble analyzing those results right now. But looking at your answers, it seems like focusing on your goal today is a great first step!" }]);
                      } finally {
                        setIsTyping(false);
                      }
                    }}
                  />
                )}
              </AnimatePresence>
              {/* Chat Header */}
              <div className="p-8 border-b border-brand-100 bg-brand-50/50 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-brand-900 rounded-[1.5rem] flex items-center justify-center shadow-lg shadow-brand-900/20">
                    <Sparkles className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-brand-900">Santi AI</h3>
                    <p className="text-sm text-slate-500 font-medium">Your personal mindfulness coach</p>
                  </div>
                </div>
                <div className="px-5 py-2.5 bg-white rounded-[1.5rem] border border-brand-100 shadow-sm flex items-center gap-3">
                   <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                   <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest text-center">Connected to insights</span>
                </div>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto p-10 space-y-8 scroll-smooth custom-scrollbar">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-6">
                    <div className="w-20 h-20 bg-brand-50 rounded-full flex items-center justify-center border border-brand-100">
                      <MessageSquare className="w-10 h-10 text-brand-300" />
                    </div>
                    <div>
                      <h4 className="text-2xl font-serif italic text-brand-900 font-bold mb-3">Breath in, breath out...</h4>
                      <p className="text-slate-500 leading-relaxed font-light text-lg">
                        I've analyzed your journals from the last 7 days. How can I help you today, {firstName}?
                      </p>
                    </div>
                    <div className="grid grid-cols-1 gap-3 w-full">
                       <SuggestionButton onClick={() => setChatInput("How has my stress been lately?")}>"How's my stress trend?"</SuggestionButton>
                       <SuggestionButton onClick={() => setChatInput("Give me a mindfulness tip based on my sleep.")}>"Improve my sleep routine"</SuggestionButton>
                    </div>
                  </div>
                ) : (
                  messages.map((m, i) => (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        "flex gap-4 max-w-[85%]",
                        m.role === 'user' ? "ml-auto flex-row-reverse" : "mr-auto"
                      )}
                    >
                      {m.role === 'ai' && (
                        <div className="w-8 h-8 rounded-full bg-brand-900 flex items-center justify-center shrink-0 mt-2 shadow-md">
                          <Sparkles className="w-4 h-4 text-white" />
                        </div>
                      )}
                      <div className={cn(
                        "p-6 rounded-[1.5rem] text-sm leading-relaxed",
                        m.role === 'user' 
                          ? "bg-brand-900 text-white rounded-tr-none shadow-xl shadow-brand-900/10" 
                          : "bg-slate-50 text-slate-700 border border-slate-100 rounded-tl-none font-medium"
                      )}>
                        {m.role === 'ai' ? (
                          <div className="prose prose-sm prose-slate max-w-none prose-p:leading-relaxed prose-li:my-1 prose-headings:text-brand-900">
                            
                            <ReactMarkdown>{m.content.replace('[Start Breathing Session]', '').replace('[Start Quiz]', '')}</ReactMarkdown>
                            <div className="flex flex-wrap gap-3 mt-4">
                              {m.content.includes('[Start Breathing Session]') && (
                                <button 
                                  onClick={() => setShowBreathing(true)}
                                  className="px-6 py-3 bg-brand-900 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-brand-800 transition-all shadow-lg shadow-brand-900/20 active:scale-95"
                                >
                                  <Wind className="w-4 h-4" /> Start 2-Min Breathing Session
                                </button>
                              )}
                              {m.content.includes('[Start Quiz]') && (
                                <button 
                                  onClick={() => setShowQuiz(true)}
                                  className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-900/20 active:scale-95"
                                >
                                  <Target className="w-4 h-4" /> Start Wellness Assessment
                                </button>
                              )}
                            </div>
                          </div>
                        ) : (
                          m.content
                        )}
                      </div>
                    </motion.div>
                  ))
                )}
                {isTyping && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex gap-4 max-w-[85%] mr-auto"
                  >
                    <div className="w-8 h-8 rounded-full bg-brand-900 flex items-center justify-center shrink-0 mt-2 shadow-md">
                      <Sparkles className="w-4 h-4 text-white" />
                    </div>
                    <div className="p-6 bg-slate-50 text-slate-700 border border-slate-100 rounded-[1.5rem] rounded-tl-none text-sm leading-relaxed font-medium flex items-center gap-2">
                       <div className="flex gap-1">
                          <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.5 }} className="w-1.5 h-1.5 bg-brand-400 rounded-full" />
                          <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.2 }} className="w-1.5 h-1.5 bg-brand-400 rounded-full" />
                          <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.4 }} className="w-1.5 h-1.5 bg-brand-400 rounded-full" />
                       </div>
                       <span className="italic text-slate-400">Santi is thinking...</span>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Chat Input */}
              <div className="p-8 border-t border-brand-100 bg-white">
                <form onSubmit={handleSendMessage} className="relative">
                  <input 
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Ask Santi anything about your wellbeing..."
                    className="w-full pl-8 pr-16 py-6 bg-slate-50 border-2 border-transparent focus:border-brand-200 focus:bg-white rounded-[2.5rem] outline-none transition-all text-base font-medium shadow-inner"
                  />
                  <button 
                    type="submit"
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-12 h-12 bg-brand-900 text-white rounded-full flex items-center justify-center hover:bg-brand-950 transition-all shadow-lg shadow-brand-900/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!chatInput.trim() || isTyping}
                  >
                    <Zap className="w-5 h-5 fill-current" />
                  </button>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
    </div>
  );
}

function SuggestionButton({ children, onClick }: { children: React.ReactNode, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="px-6 py-3 rounded-[1.5rem] bg-white border border-brand-100 text-brand-600 text-sm font-bold hover:bg-brand-50 hover:border-brand-200 transition-all shadow-sm active:scale-[0.98]"
    >
      {children}
    </button>
  );
}

function WellnessAssessment({ onClose, onComplete }: { onClose: () => void, onComplete: (answers: string[]) => void }) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);

  const questions = [
    {
      question: "How did you sleep last night?",
      options: ["Restless (< 5hrs)", "Okay (5-7hrs)", "Great (8+ hrs)", "Feeling exhausted"],
      icon: Moon
    },
    {
      question: "What's occupying your mind most today?",
      options: ["School / Exams", "Friendships / Social", "Family stuff", "Just general vibes"],
      icon: MessageSquare
    },
    {
      question: "How do you usually handle stress?",
      options: ["I talk to friends", "I listen to music", "I bottle it up", "I try to exercise"],
      icon: Zap
    },
    {
      question: "What's one thing you want to achieve today?",
      options: ["Finish my homework", "Have a good laugh", "Get some rest", "Learn something new"],
      icon: Target
    }
  ];

  const handleAnswerSelect = (index: number) => {
    if (selectedAnswer !== null) return;
    setSelectedAnswer(index);
    const newAnswers = [...answers, questions[currentQuestion].options[index]];
    setAnswers(newAnswers);
    
    setTimeout(() => {
      if (currentQuestion < questions.length - 1) {
        setCurrentQuestion(q => q + 1);
        setSelectedAnswer(null);
      } else {
        setShowResult(true);
      }
    }, 800);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 bg-brand-900/95 backdrop-blur-md flex flex-col items-center justify-center p-8 text-white"
    >
      <button 
        onClick={onClose}
        className="absolute top-8 right-8 w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-all"
      >
        <X className="w-6 h-6" />
      </button>

      <div className="max-w-2xl w-full">
        {!showResult ? (
          <div className="space-y-8">
            <div className="text-center">
              <div className="flex justify-center mb-4">
                {React.createElement(questions[currentQuestion].icon, { className: "w-12 h-12 text-brand-300" })}
              </div>
              <span className="text-brand-300 font-bold tracking-widest uppercase text-xs">Assessment Step {currentQuestion + 1} of {questions.length}</span>
              <h3 className="text-3xl font-serif mt-2 leading-tight">{questions[currentQuestion].question}</h3>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {questions[currentQuestion].options.map((option, i) => (
                <button
                  key={i}
                  disabled={selectedAnswer !== null}
                  onClick={() => handleAnswerSelect(i)}
                  className={cn(
                    "p-6 rounded-2xl text-left border-2 transition-all duration-300 flex items-center justify-between group",
                    selectedAnswer === null ? "bg-white/5 border-white/20 hover:bg-white/10 hover:border-white/40" :
                    selectedAnswer === i ? "bg-brand-400 border-brand-400 text-brand-900 shadow-[0_0_20px_rgba(255,255,255,0.3)]" : "bg-white/5 border-white/10 opacity-40"
                  )}
                >
                  <span className="text-lg font-bold">{option}</span>
                  {selectedAnswer === i && <Sparkles className="w-6 h-6 text-brand-900" />}
                </button>
              ))}
            </div>
            
            <div className="flex justify-center gap-2">
              {questions.map((_, i) => (
                <div key={i} className={cn("h-1 rounded-full transition-all duration-500", i <= currentQuestion ? "w-8 bg-brand-400" : "w-2 bg-white/20")} />
              ))}
            </div>
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-8"
          >
            <div className="w-24 h-24 bg-brand-400/20 rounded-full flex items-center justify-center mx-auto border-4 border-brand-400/30">
               <Sparkles className="w-12 h-12 text-brand-400" />
            </div>
            
            <div>
              <h3 className="text-4xl font-serif italic mb-2">Deep Insights Gained</h3>
              <p className="text-brand-300 text-lg leading-relaxed max-w-md mx-auto">
                Santi has analyzed your input. I've noted that you're focusing on <span className="text-white font-bold">{answers[1]}</span> and looking to <span className="text-white font-bold">{answers[3]}</span> today.
              </p>
            </div>

            <div className="bg-white/5 p-6 rounded-3xl border border-white/10 text-left space-y-4">
              <h4 className="text-xs font-bold tracking-widest uppercase text-brand-400">Analysis Summary:</h4>
              <div className="grid grid-cols-2 gap-4">
                {answers.map((ans, i) => (
                   <div key={i} className="flex items-center gap-3 bg-white/5 p-3 rounded-xl">
                      <div className="w-2 h-2 rounded-full bg-brand-400" />
                      <span className="text-sm font-medium text-brand-100">{ans}</span>
                   </div>
                ))}
              </div>
            </div>

            <div className="pt-8">
              <button 
                onClick={() => onComplete(answers)}
                className="px-12 py-4 bg-white text-brand-900 rounded-[1.5rem] font-bold text-xl hover:bg-brand-50 transition-all shadow-xl active:scale-95"
              >
                Let's Discuss This
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

function BreathingExercise({ onClose }: { onClose: () => void }) {
  const [timeLeft, setTimeLeft] = useState(120); 
  const [phase, setPhase] = useState<'Inhale' | 'Hold' | 'Exhale'>('Inhale');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!isActive) return;
    
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    const phaseInterval = setInterval(() => {
      setPhase(p => {
        if (p === 'Inhale') return 'Hold';
        if (p === 'Hold') return 'Exhale';
        return 'Inhale';
      });
    }, 4000);

    return () => {
      clearInterval(timer);
      clearInterval(phaseInterval);
    };
  }, [isActive]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 bg-brand-900/95 backdrop-blur-md flex flex-col items-center justify-center p-8 text-white text-center"
    >
      <button 
        onClick={onClose}
        className="absolute top-8 right-8 w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-all"
      >
        <X className="w-6 h-6" />
      </button>

      <div className="max-w-md w-full space-y-12">
        <div>
          <h3 className="text-4xl font-serif italic mb-2">Just Breathe</h3>
          <p className="text-brand-300 font-medium tracking-widest uppercase text-xs">Guided session • {timeLeft > 0 ? formatTime(timeLeft) : 'Complete'}</p>
        </div>

        <div className="relative flex items-center justify-center h-64">
           {/* Pulsing Circle */}
           <motion.div 
             animate={{ 
               scale: phase === 'Inhale' ? 1.5 : phase === 'Hold' ? 1.5 : 0.8,
               opacity: phase === 'Inhale' ? 0.8 : phase === 'Hold' ? 1 : 0.4
             }}
             transition={{ duration: 4, ease: "easeInOut" }}
             className="w-48 h-48 rounded-full bg-brand-400 blur-3xl absolute"
           />
           <motion.div 
             animate={{ 
               scale: phase === 'Inhale' ? 1.2 : phase === 'Hold' ? 1.2 : 0.9,
               borderWidth: phase === 'Hold' ? '8px' : '2px'
             }}
             transition={{ duration: 4, ease: "easeInOut" }}
             className="w-40 h-40 rounded-full border-2 border-white flex items-center justify-center relative z-10"
           >
              <div className="text-2xl font-bold tracking-tight">{phase}</div>
           </motion.div>
        </div>

        {timeLeft > 0 ? (
          <div className="space-y-6">
            <p className="text-lg text-brand-100 font-light leading-relaxed">
              {phase === 'Inhale' && "Take a deep breath in through your nose..."}
              {phase === 'Hold' && "Softly hold your breath..."}
              {phase === 'Exhale' && "Slowly release and let go of all tension..."}
            </p>
            <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: '100%' }}
                animate={{ width: `${(timeLeft / 120) * 100}%` }}
                className="h-full bg-brand-400"
              />
            </div>
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <p className="text-2xl font-serif italic text-brand-200">You did great.</p>
            <button 
              onClick={onClose}
              className="px-10 py-4 bg-white text-brand-900 rounded-[1.5rem] font-bold text-lg hover:bg-brand-50 transition-all shadow-xl"
            >
              Back to Santi
            </button>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

/* Helper Components */

function ChartPlaceholder({ icon: Icon, label }: { icon: any, label: string }) {
  return (
    <div className="h-full flex flex-col items-center justify-center bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200">
      <div className="p-4 bg-white rounded-[1rem] shadow-sm mb-4">
        <Icon className="w-8 h-8 text-slate-300" />
      </div>
      <p className="text-slate-500 font-bold">{label}</p>
      <p className="text-slate-400 text-sm mt-1">Consistency is key to unlocking trends.</p>
    </div>
  );
}

function ReviewStat({ label, value, max = 100, color, inverse, unit = '%' }: { label: string, value: number, max?: number, color: string, inverse?: boolean, unit?: string }) {
  const displayVal = inverse ? 100 - value : value;
  return (
    <div className="bg-white p-5 rounded-[1.5rem] border border-stone-100 shadow-sm">
       <div className="flex justify-between items-center mb-3">
         <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
         <span className="text-xs font-bold text-brand-900">{value}{unit}</span>
       </div>
       <div className="h-1 w-full bg-slate-50 rounded-full overflow-hidden">
          <div className={cn("h-full transition-all duration-1000", color)} style={{ width: `${(value/max)*100}%` }} />
       </div>
    </div>
  );
}

function QuickState({ icon: Icon, label, value }: { icon: any, label: string, value: string }) {
  return (
    <div className="bg-slate-50 px-5 py-3 rounded-[1.5rem] border border-slate-100 flex items-center gap-3 min-w-[140px]">
      <Icon className="w-5 h-5 text-brand-400" />
      <div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{label}</p>
        <p className="text-sm font-bold text-slate-800 leading-none">{value}</p>
      </div>
    </div>
  );
}

function LegendItem({ dotColor, label }: { dotColor: string, label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className={cn("w-2.5 h-2.5 rounded-full", dotColor)}></div>
      <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
    </div>
  );
}

function DeepStatCard({ label, value, icon: Icon, color, percentage }: { label: string, value: string, icon: any, color: string, percentage: number }) {
  return (
    <div className="bg-white p-8 rounded-[2rem] border border-brand-200 shadow-sm flex flex-col group hover:-translate-y-1 transition-all duration-300">
      <div className="flex justify-between items-start mb-6">
        <div className={cn("p-4 rounded-[1rem] shadow-lg shadow-black/5 transition-transform group-hover:scale-110", color)}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">{label}</p>
          <p className="text-3xl font-bold text-brand-900 tracking-tight">{value}</p>
        </div>
      </div>
      <div className="mt-auto">
        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
           <motion.div 
             initial={{ width: 0 }}
             animate={{ width: `${Math.min(Math.max(percentage, 0), 100)}%` }}
             transition={{ duration: 1.5, delay: 0.2 }}
             className={cn("h-full rounded-full transition-all duration-1000", color)}
           />
        </div>
      </div>
    </div>
  );
}

function JournalSlider({ label, value, max = 100, onChange, color }: { label: string, value: number, max?: number, onChange: (v: number) => void, color: string }) {
  return (
    <div className="space-y-5 group/slider">
      <div className="flex justify-between items-center">
        <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] group-hover/slider:text-brand-900 transition-colors uppercase">{label}</label>
        <span className="text-sm font-bold text-brand-900 bg-white px-3 py-1 rounded-[1.5rem] shadow-sm border border-stone-200/50 font-mono">
          {value}{max === 12 ? 'h' : ''}
        </span>
      </div>
      <div className="relative h-4 flex items-center">
        <div className="absolute inset-x-0 h-1.5 bg-stone-200 rounded-full"></div>
        <motion.div 
          className={cn("absolute inset-y-[1.25rem] left-0 h-1.5 transition-all rounded-full z-0", color)}
          style={{ width: `${(value / max) * 100}%` }}
        />
        <input 
          type="range"
          min="0"
          max={max}
          step={max === 12 ? "0.5" : "1"}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
        />
        {/* Thumb Visual */}
        <motion.div 
          className="absolute w-6 h-6 bg-white border-2 border-brand-900 rounded-full shadow-lg z-10 pointer-events-none"
          style={{ left: `calc(${(value / max) * 100}% - 12px)` }}
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 4, repeat: Infinity }}
        />
      </div>
    </div>
  );
}