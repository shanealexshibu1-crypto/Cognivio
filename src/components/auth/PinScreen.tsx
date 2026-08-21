import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, Delete, LogOut } from 'lucide-react';
import { useAuth } from '../AuthProvider';
import { cn } from '../../lib/utils';

export function PinScreen({ onSuccess }: { onSuccess: () => void }) {
  const { profile, signOut } = useAuth();
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  const correctPin = profile?.pinCode;

  useEffect(() => {
    if (pin.length === 4) {
      if (pin === correctPin) {
        onSuccess();
      } else {
        setError(true);
        setTimeout(() => {
          setPin('');
          setError(false);
        }, 500);
      }
    }
  }, [pin, correctPin, onSuccess]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        setPin(prev => {
          if (prev.length < 4) {
            setError(false);
            return prev + e.key;
          }
          return prev;
        });
      } else if (e.key === 'Backspace') {
        setPin(prev => {
          setError(false);
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
      setError(false);
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
    setError(false);
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
            Welcome Back{profile?.name ? `, ${profile.name.split(' ')[0]}` : ''}
          </h2>
          <p className="text-sm opacity-60">Enter your 4-digit PIN to unlock</p>
        </div>

        <motion.div 
          animate={error ? { x: [-10, 10, -10, 10, 0] } : {}}
          transition={{ duration: 0.4 }}
          className="flex justify-center gap-4 mb-12"
        >
          {[0, 1, 2, 3].map(i => (
            <div 
              key={i}
              className={cn(
                "w-4 h-4 rounded-full transition-all duration-300",
                pin.length > i ? "bg-brand-500 scale-110" : "bg-brand-200",
                error && pin.length > i && "bg-red-500"
              )}
            />
          ))}
        </motion.div>

        <div className="grid grid-cols-3 gap-4 max-w-[280px] mx-auto">
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
      </motion.div>
    </div>
  );
}