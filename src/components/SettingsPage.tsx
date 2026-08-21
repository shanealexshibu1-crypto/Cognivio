import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LogOut, 
  ChevronRight, 
  Shield, 
  User, 
  Palette,
  Type,
  Zap,
  Save
} from 'lucide-react';
import { useAuth } from './AuthProvider';
import { db } from '../lib/firebase';
import { 
  doc, 
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';
import { cn } from '../lib/utils';
import { journalThemes, journalFonts } from '../lib/theme';


function SelectTheme({ value, onChange }: { value: string, onChange: (v: string) => void }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const activeTheme = journalThemes[value] || journalThemes.ocean;
  return (
    <div className="relative">
      <button type="button" onClick={() => setIsOpen(!isOpen)} className="w-full flex items-center justify-between p-4 bg-white border-2 border-brand-100 rounded-2xl hover:border-brand-300 transition-all focus:outline-none">
        <div className="flex items-center gap-4">
          <div className={cn("w-6 h-6 rounded-full shadow-inner shrink-0", activeTheme.bg)}></div>
          <span className="font-bold text-slate-700">{activeTheme.label}</span>
        </div>
        <ChevronRight className={cn("w-5 h-5 text-slate-400 transition-transform duration-300", isOpen && "rotate-90")} />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute z-50 w-full mt-2 p-2 bg-white rounded-2xl border border-brand-100 shadow-xl max-h-64 overflow-y-auto custom-scrollbar">
            {Object.keys(journalThemes).map(key => (
              <button
                key={key}
                onClick={() => { onChange(key); setIsOpen(false); }}
                className={cn(
                  "w-full flex items-center gap-4 p-3 rounded-xl transition-all text-left",
                  value === key ? "bg-brand-50 text-brand-900" : "hover:bg-slate-50 text-slate-600"
                )}
              >
                <div className={cn("w-6 h-6 rounded-full shadow-inner shrink-0", journalThemes[key].bg)}></div>
                <span className="font-bold text-sm">{journalThemes[key].label}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function SelectFont({ value, onChange }: { value: string, onChange: (v: string) => void }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const activeFont = journalFonts.find(f => f.id === value) || journalFonts[0];
  return (
    <div className="relative">
      <button type="button" onClick={() => setIsOpen(!isOpen)} className="w-full flex items-center justify-between p-4 bg-white border-2 border-brand-100 rounded-2xl hover:border-brand-300 transition-all focus:outline-none">
        <div className="flex items-center gap-4">
          <div className={cn("w-10 h-10 bg-brand-50 rounded-lg flex items-center justify-center text-xl font-bold shadow-sm", activeFont.font)}>Aa</div>
          <span className="font-bold text-slate-700">{activeFont.label}</span>
        </div>
        <ChevronRight className={cn("w-5 h-5 text-slate-400 transition-transform duration-300", isOpen && "rotate-90")} />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute z-50 w-full mt-2 p-2 bg-white rounded-2xl border border-brand-100 shadow-xl">
            {journalFonts.map(f => (
              <button
                key={f.id}
                onClick={() => { onChange(f.id); setIsOpen(false); }}
                className={cn(
                  "w-full flex items-center gap-4 p-3 rounded-xl transition-all text-left",
                  value === f.id ? "bg-brand-50 text-brand-900" : "hover:bg-slate-50 text-slate-600"
                )}
              >
                <div className={cn("w-10 h-10 bg-white rounded-lg flex items-center justify-center text-xl font-bold shadow-sm", f.font)}>Aa</div>
                <span className="font-bold text-sm">{f.label}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function SettingsPage() {
  const { profile, signOut, refreshProfile } = useAuth();

  const showStudentSettings = profile?.role === 'student' || profile?.role === 'monitor';

  
  const [themeColor, setThemeColor] = useState(showStudentSettings ? (profile as any).journalTheme || 'ocean' : 'ocean');
  const [journalFont, setJournalFont] = useState(showStudentSettings ? (profile as any).journalFont || 'serif' : 'serif');
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const hasChanges = (showStudentSettings && (
    themeColor !== ((profile as any).journalTheme || 'ocean') ||
    journalFont !== ((profile as any).journalFont || 'serif')
  ));

  const handleSavePreferences = async () => {
    if (!profile) return;
    setSaveLoading(true);
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        journalTheme: themeColor,
        journalFont: journalFont,
        updatedAt: serverTimestamp()
      });
      await refreshProfile();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      console.error("Error updating preference:", error);
    } finally {
      setSaveLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <header className="mb-12">
        <h1 className="text-4xl font-display font-bold text-brand-900 mb-2 tracking-tight">Settings</h1>
        <p className="text-slate-500 text-lg">Manage your account, preferences, and connections.</p>
      </header>

      <div className="space-y-8">
        {/* Profile Details */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-brand-100 shadow-sm">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 bg-brand-50 rounded-2xl flex items-center justify-center border border-brand-100 shrink-0">
              <User className="w-10 h-10 text-brand-500" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-slate-800">{profile?.name}</h2>
              <p className="text-slate-500 font-medium">{profile?.email}</p>
              <div className="mt-2 flex gap-2">
                 <div className="inline-flex px-3 py-1 bg-brand-50 rounded-full text-brand-700 text-[10px] font-black uppercase tracking-widest border border-brand-100">
                    {profile?.role}
                 </div>
                 {profile?.grade && (
                   <div className="inline-flex px-3 py-1 bg-slate-50 rounded-full text-slate-600 text-[10px] font-black uppercase tracking-widest border border-slate-100">
                      {profile.grade} {profile.section}
                   </div>
                 )}
              </div>
            </div>
          </div>
        </div>

        {/* Journal Customization (Students Only) */}
        {showStudentSettings && (
          <>
            <div className="bg-white p-8 rounded-[2.5rem] border border-brand-100 shadow-sm space-y-8">
              <header className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-slate-800 mb-2 flex items-center gap-2">
                    <Palette className="w-5 h-5 text-brand-500" /> Journal Appearance
                  </h3>
                  <p className="text-slate-500 text-sm">Customize how your personal reflection pages look and feel.</p>
                </div>
                <button
                  onClick={handleSavePreferences}
                  disabled={!hasChanges || saveLoading}
                  className={cn(
                    "px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2",
                    hasChanges 
                      ? "bg-brand-900 text-white shadow-lg shadow-brand-900/20 active:scale-95" 
                      : (saveSuccess ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-400 cursor-not-allowed")
                  )}
                >
                  {saveLoading ? (
                    <Zap className="w-4 h-4 animate-spin" />
                  ) : saveSuccess ? (
                    <Zap className="w-4 h-4" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {saveSuccess ? "Saved!" : "Save Changes"}
                </button>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <section>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-4">Color Palette</label>
                  <SelectTheme value={themeColor} onChange={setThemeColor} />
                </section>

                <section>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-4">Typography</label>
                  <SelectFont value={journalFont} onChange={setJournalFont} />
                </section>
              </div>
            </div>
          </>
        )}

        {/* Global Account Management */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-brand-100 shadow-sm overflow-hidden">
          <header className="mb-8">
            <h3 className="text-xl font-bold text-slate-800 mb-2">Account Management</h3>
            <p className="text-slate-500 text-sm">Privacy and logout controls.</p>
          </header>

          <div className="grid grid-cols-1 gap-4">
            <button 
              onClick={handleLogout}
              className="flex items-center gap-4 p-6 bg-slate-50 border border-slate-100 rounded-2xl group hover:bg-slate-100 transition-all font-bold text-slate-700 shadow-sm"
            >
              <div className="w-12 h-12 bg-white rounded-[1rem] flex items-center justify-center shadow-sm text-slate-400 transition-colors group-hover:text-brand-600">
                <LogOut className="w-5 h-5" />
              </div>
              <div className="text-left">
                <span className="block">Log Out</span>
                <span className="text-[10px] font-normal text-slate-400">End current session</span>
              </div>
            </button>
          </div>
        </div>
      </div>

      <footer className="mt-16 text-center text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">
        Cognivio Wellness Platform &copy; 2026
      </footer>
    </div>
  );
}