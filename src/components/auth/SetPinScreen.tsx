import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Lock, Delete, LogOut, ChevronRight, Sparkles } from 'lucide-react';
import { useAuth } from '../AuthProvider';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { cn } from '../../lib/utils';

export function SetPinScreen({ onSuccess }: { onSuccess: () => void }) {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        setPin(prev => {
          if (prev.length < 4) {
            setError('');
            return prev + e.key;
          }
          return prev;
        });
      } else if (e.key === 'Backspace') {
        setPin(prev => {
          setError('');
          return prev.slice(0, -1);
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleKeyPress = (key: string) => {
    if (pin.length < 4) {
      setPin(prev => prev + key);
      setError('');
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
    setError('');
  };

  const handleSavePin = async () => {
    if (pin.length !== 4 || !user) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        pinCode: pin
      });
      await refreshProfile();
      onSuccess();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-brand-50 relative">
      <div className="absolute top-8 right-8">
        <button onClick={signOut} className="flex items-center gap-2 text-slate-400 hover:text-red-500 transition-colors bg-white px-4 py-2 rounded-full shadow-sm text-sm font-semibold">
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm border border-brand-100 text-brand-500">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-3xl mb-2 font-serif">
            Secure your app
          </h2>
          <p className="text-sm opacity-60">Please create a 4-digit PIN for your account.</p>
        </div>

        {error && <p className="text-red-500 text-xs font-medium bg-red-50 p-3 rounded-xl mb-4 text-center">{error}</p>}

        <div className="flex justify-center gap-4 mb-8">
          {[0, 1, 2, 3].map(i => (
            <div 
              key={i}
              className={cn(
                "w-4 h-4 rounded-full transition-all duration-300",
                pin.length > i ? "bg-brand-500 scale-110" : "bg-brand-200"
              )}
            />
          ))}
        </div>

        <div className="grid grid-cols-3 gap-4 max-w-[280px] mx-auto mb-8">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
            <button
              key={num}
              onClick={() => handleKeyPress(num.toString())}
              className="w-16 h-16 rounded-full bg-white text-2xl font-semibold text-slate-700 shadow-sm hover:bg-brand-50 hover:text-brand-500 transition-colors mx-auto active:scale-95"
            >
              {num}
            </button>
          ))}
          <div />
          <button
            onClick={() => handleKeyPress('0')}
            className="w-16 h-16 rounded-full bg-white text-2xl font-semibold text-slate-700 shadow-sm hover:bg-brand-50 hover:text-brand-500 transition-colors mx-auto active:scale-95"
          >
            0
          </button>
          <button
            onClick={handleDelete}
            className="w-16 h-16 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors mx-auto active:scale-95"
          >
            <Delete className="w-6 h-6" />
          </button>
        </div>

        <button 
          onClick={handleSavePin}
          disabled={pin.length !== 4 || loading}
          className="w-full bg-brand-500 text-white py-4 rounded-2xl font-semibold text-lg hover:bg-brand-600 transition-all flex justify-center gap-2 items-center group disabled:opacity-50 shadow-xl shadow-brand-500/20"
        >
          {loading ? 'Saving...' : 'Save PIN'}
          {!loading && <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
        </button>
      </motion.div>
    </div>
  );
}