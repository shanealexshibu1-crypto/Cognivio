import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { UserRole } from '../../types';
import { cn } from '../../lib/utils';
import { Mail, Lock, User, Calendar, ShieldCheck, ChevronRight, ArrowLeft, Sparkles, BookHeart } from 'lucide-react';
import { useAuth } from '../AuthProvider';

type View = 'login' | 'signup' | 'forgot' | 'onboarding' | 'verifyEmail';

export function AuthView() {
  const [view, setView] = useState<View>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  
  const [step, setStep] = useState(1);
  const [age, setAge] = useState<number | ''>('');
  const [role, setRole] = useState<UserRole | ''>('');
  const [grade, setGrade] = useState('');
  const [section, setSection] = useState('');
  const [name, setName] = useState('');
  const [pinCode, setPinCode] = useState('');

  const { refreshProfile } = useAuth();

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      const result = await signInWithPopup(auth, provider);
      const docRef = doc(db, 'users', result.user.uid);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists() || !docSnap.data()?.onboarded) {
        if (!docSnap.exists()) {
          setName(result.user.displayName || '');
        } else {
          const data = docSnap.data();
          setName(data.name || result.user.displayName || '');
          setAge(data.age || '');
          setRole(data.role || '');
          setGrade(data.grade || '');
          setSection(data.section || '');
        }
        setView('onboarding');
      } else {
        await refreshProfile();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      if (view === 'login') {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const docSnap = await getDoc(doc(db, 'users', userCredential.user.uid));
        if (!docSnap.exists() || !docSnap.data()?.onboarded) {
          setView('onboarding');
        }
      } else if (view === 'signup') {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await sendEmailVerification(userCredential.user);
        setView('verifyEmail');
      } else if (view === 'forgot') {
        await sendPasswordResetEmail(auth, email);
        setError('Reset link sent to your email.');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    
    setLoading(true);
    try {
      const profile: any = {
        uid: auth.currentUser.uid,
        email: auth.currentUser.email,
        name,
        role: role as UserRole,
        age: Number(age),
        onboarded: true,
        pinCode,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      if (role === 'student' || role === 'monitor' || role === 'teacher') {
        profile.grade = grade;
        profile.section = section;
      }
      
      await setDoc(doc(db, 'users', auth.currentUser.uid), profile);
      await refreshProfile();
    } catch (err: any) {
      console.error("Onboarding error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (view === 'verifyEmail') {
      interval = setInterval(async () => {
        if (auth.currentUser) {
          await auth.currentUser.reload();
          if (auth.currentUser.emailVerified) {
            await auth.currentUser.getIdToken(true);
            setStep(1);
            setView('onboarding');
          }
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [view]);

  const isAdult = age !== '' && Number(age) >= 20;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-brand-50 relative">

      <div className="flex w-full max-w-6xl items-center justify-center relative z-10">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md card-organic"
        >
          <div className="mb-8 w-full">
            <AnimatePresence mode="wait">
              {view === 'onboarding' ? (
                <div className="flex gap-2">
                  {[1, 2, 3].map(i => (
                    <div key={i} className={cn("h-1 flex-1 rounded-full transition-all duration-500", step >= i ? "bg-brand-500" : "bg-brand-50")} />
                  ))}
                </div>
              ) : (
                <div className="flex justify-center">
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-brand-500 shadow-sm border border-brand-100">
                    <div className="w-4 h-4 bg-brand-500 rounded-sm rotate-45" />
                  </div>
                </div>
              )}
            </AnimatePresence>
          </div>

          <AnimatePresence mode="wait">
            {view === 'verifyEmail' ? (
              <motion.div
                key="verifyEmail"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="text-center w-full"
              >
                <div className="w-16 h-16 bg-brand-50 text-brand-500 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Mail className="w-8 h-8" />
                </div>
                <h2 className="text-3xl mb-4 font-serif">Check your email.</h2>
                <p className="text-sm opacity-60 mb-8 max-w-sm mx-auto">
                  We've sent a verification link to <span className="font-bold text-brand-900">{email}</span>. 
                  Waiting for you to verify your email address...
                </p>

                {error && <p className="text-red-500 text-xs text-center font-medium bg-red-50 p-3 rounded-xl mb-6">{error}</p>}

                <div className="space-y-4">
                  <div className="flex justify-center mb-6">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-brand-500"></div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                        if (auth.currentUser) {
                            sendEmailVerification(auth.currentUser);
                            setError('Verification email resent.');
                        }
                    }}
                    className="text-sm font-medium text-brand-500 block w-full mb-2"
                  >
                    Resend verification email
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                        auth.signOut();
                        setView('signup');
                    }}
                    className="text-sm font-medium text-slate-400 hover:text-slate-600 flex items-center justify-center gap-1 w-full mt-4 transition-colors"
                  >
                    <ArrowLeft className="w-3 h-3" /> Back to Sign Up
                  </button>
                </div>
              </motion.div>
            ) : view !== 'onboarding' ? (
              <motion.div
                key="auth"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <h2 className="text-3xl mb-2 font-serif">
                  {view === 'login' ? 'Welcome back.' : view === 'signup' ? 'Join Cognivio.' : 'Reset Access.'}
                </h2>
                <p className="text-sm opacity-60 mb-8">Access your personalized wellness portal.</p>

                <form onSubmit={handleAuth} className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-brand-500 mb-2">Email Address</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="e.g. name@school.com"
                      className="w-full px-6 py-4 rounded-[1.5rem] bg-brand-50 border-2 border-transparent focus:border-brand-500 outline-none transition-all"
                    />
                  </div>

                  {view !== 'forgot' && (
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-brand-500 mb-2">Password</label>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        placeholder="••••••••"
                        className="w-full px-6 py-4 rounded-2xl bg-brand-50 border-2 border-transparent focus:border-brand-500 outline-none transition-all"
                      />
                    </div>
                  )}

                  {error && <p className="text-red-500 text-xs text-center font-medium bg-red-50 p-3 rounded-xl">{error}</p>}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-brand-500 text-white py-5 rounded-2xl font-semibold text-lg hover:bg-brand-600 transition-all flex justify-between px-8 items-center group shadow-xl shadow-brand-500/20 disabled:opacity-50"
                  >
                    {loading ? 'Processing...' : view === 'login' ? 'Sign In' : view === 'signup' ? 'Get Started' : 'Reset Password'}
                    <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </button>

                  {view !== 'forgot' && (
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-brand-200"></div>
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-white px-2 text-slate-400">Or continue with</span>
                      </div>
                    </div>
                  )}

                  {view !== 'forgot' && (
                    <button
                      type="button"
                      onClick={handleGoogleSignIn}
                      disabled={loading}
                      className="w-full flex items-center justify-center gap-3 py-4 bg-white border-2 border-brand-50 rounded-2xl font-medium text-slate-700 hover:bg-brand-50 hover:border-brand-100 transition-all active:scale-[0.98] disabled:opacity-50 shadow-sm"
                    >
                      <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
                      Google Account
                    </button>
                  )}

                  <div className="flex flex-col gap-3 pt-4 text-center">
                    {view === 'login' ? (
                      <>
                        <p className="text-sm opacity-50">
                          New here? <button type="button" onClick={() => setView('signup')} className="font-bold underline">Create account</button>
                        </p>
                        <button type="button" onClick={() => setView('forgot')} className="text-xs opacity-40 hover:opacity-100">Forgot password?</button>
                      </>
                    ) : (
                      <p className="text-sm opacity-50">
                        Member? <button type="button" onClick={() => setView('login')} className="font-bold underline">Login here</button>
                      </p>
                    )}
                  </div>
                </form>
              </motion.div>
            ) : (
              <motion.div
                key="onboarding"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                {step === 1 && (
                  <div className="space-y-6">
                    <h2 className="text-3xl mb-2 font-serif">Let's get started.</h2>
                    <p className="text-sm opacity-60 mb-8">First, we need to tailor the experience for you.</p>

                    {error && <p className="text-red-500 text-xs font-medium bg-red-50 p-3 rounded-xl mb-4">{error}</p>}

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-brand-500 mb-3">How old are you?</label>
                      <input
                        type="number"
                        placeholder="Enter your age"
                        value={age}
                        onChange={(e) => setAge(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full px-6 py-4 rounded-2xl bg-brand-50 border-2 border-transparent focus:border-brand-500 outline-none transition-all text-lg"
                      />
                    </div>



                    <button 
                      onClick={() => age !== '' && setStep(2)}
                      disabled={age === ''}
                      className="w-full bg-brand-500 text-white py-5 rounded-2xl font-semibold text-lg hover:bg-brand-600 transition-colors flex justify-between px-8 items-center group disabled:opacity-50"
                    >
                      Confirm & Continue
                      <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-6">
                    <button onClick={() => setStep(1)} className="text-slate-400 flex items-center gap-1 text-sm"><ArrowLeft className="w-3 h-3" /> Back</button>
                    <h2 className="text-3xl mb-2 font-serif">Your Role.</h2>
                    <p className="text-sm opacity-60 mb-4">Choose how you'll use Cognivio.</p>
                    
                    {error && <p className="text-red-500 text-xs font-medium bg-red-50 p-3 rounded-xl mb-4">{error}</p>}
                    <div className="grid grid-cols-1 gap-3">
                      {isAdult ? (
                        <>
                          <RoleButton active={role === 'teacher'} onClick={() => setRole('teacher')} label="Teacher" />
                          <RoleButton active={role === 'admin'} onClick={() => setRole('admin')} label="Admin" />
                        </>
                      ) : (
                        <>
                          <RoleButton active={role === 'student'} onClick={() => setRole('student')} label="Student" />
                          <RoleButton active={role === 'monitor'} onClick={() => setRole('monitor')} label="ERGA Monitor" />
                        </>
                      )}
                    </div>
                    <button 
                      onClick={() => role !== '' && setStep(3)}
                      disabled={role === ''}
                      className="w-full bg-brand-500 text-white py-5 rounded-2xl font-semibold text-lg hover:bg-brand-600 transition-colors flex justify-between px-8 items-center group disabled:opacity-50"
                    >
                      Continue
                      <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-6">
                    <button onClick={() => setStep(2)} className="text-slate-400 flex items-center gap-1 text-sm"><ArrowLeft className="w-3 h-3" /> Back</button>
                    <h2 className="text-3xl mb-2 font-serif">Personal Details.</h2>
                    
                    {error && <p className="text-red-500 text-xs font-medium bg-red-50 p-3 rounded-xl mb-4">{error}</p>}
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-brand-500 mb-2">Full Name</label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                          <input
                            type="text"
                            placeholder="e.g. Alex Johnson"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            className="w-full pl-11 pr-4 py-3 bg-brand-50 border-2 border-transparent focus:border-brand-500 rounded-[1.2rem] outline-none transition-all"
                          />
                        </div>
                      </div>

                      {(role === 'student' || role === 'monitor' || role === 'teacher') && (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-brand-500 mb-2">Grade</label>
                            <div className="relative">
                              <BookHeart className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                              <select
                                value={grade}
                                onChange={(e) => setGrade(e.target.value)}
                                required
                                className="w-full pl-11 pr-4 py-3 bg-brand-50 border-2 border-transparent focus:border-brand-500 rounded-[1.2rem] outline-none transition-all appearance-none"
                              >
                                <option value="">Select Grade</option>
                                {["6th Grade", "7th Grade", "8th Grade", "9th Grade", "10th Grade", "11th Grade", "12th Grade"].map(g => (
                                  <option key={g} value={g}>{g}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-brand-500 mb-2">Section</label>
                            <div className="relative">
                              <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                              <select
                                value={section}
                                onChange={(e) => setSection(e.target.value)}
                                required
                                className="w-full pl-11 pr-4 py-3 bg-brand-50 border-2 border-transparent focus:border-brand-500 rounded-[1.2rem] outline-none transition-all appearance-none"
                              >
                                <option value="">Select Section</option>
                                {["A1", "A2", "A3", "B1", "B2", "B3"].map(s => (
                                  <option key={s} value={s}>{s}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <button 
                      type="button"
                      onClick={() => setStep(4)}
                      disabled={!name || ((role === 'student' || role === 'monitor' || role === 'teacher') && (!grade || !section))}
                      className="w-full bg-brand-500 text-white py-5 rounded-2xl font-semibold text-lg hover:bg-brand-600 transition-all flex justify-between px-8 items-center group disabled:opacity-50 shadow-xl shadow-brand-500/20"
                    >
                      Continue
                      <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                )}

                {step === 4 && (
                  <form onSubmit={handleOnboarding} className="space-y-6">
                    <button type="button" onClick={() => setStep(3)} className="text-slate-400 flex items-center gap-1 text-sm"><ArrowLeft className="w-3 h-3" /> Back</button>
                    <h2 className="text-3xl mb-2 font-serif">Secure your app.</h2>
                    <p className="text-sm opacity-60 mb-8">Set a 4-digit PIN code to unlock the app when you return.</p>
                    
                    {error && <p className="text-red-500 text-xs font-medium bg-red-50 p-3 rounded-xl mb-4">{error}</p>}
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-brand-500 mb-2">Create 4-Digit PIN</label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                          <input
                            type="password"
                            placeholder="****"
                            maxLength={4}
                            value={pinCode}
                            onChange={(e) => setPinCode(e.target.value.replace(/\D/g, ''))}
                            required
                            className="w-full pl-11 pr-4 py-3 bg-brand-50 border-2 border-transparent focus:border-brand-500 rounded-[1.2rem] outline-none transition-all text-center tracking-widest text-2xl font-mono"
                          />
                        </div>
                      </div>
                    </div>

                    <button 
                      type="submit"
                      disabled={loading || pinCode.length !== 4}
                      className="w-full bg-brand-500 text-white py-5 rounded-2xl font-semibold text-lg hover:bg-brand-600 transition-all flex justify-between px-8 items-center group disabled:opacity-50 shadow-xl shadow-brand-500/20"
                    >
                      {loading ? 'Finalizing...' : 'Complete Registration'}
                      <Sparkles className="w-5 h-5 group-hover:scale-125 transition-transform" />
                    </button>
                  </form>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

    </div>
  );
}

function RoleButton({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "p-4 border rounded-xl text-left transition-all",
        active ? "bg-brand-500 border-brand-600 text-white shadow-md shadow-brand-100 scale-[1.02]" : "bg-brand-50 border-brand-100 text-slate-700 hover:border-brand-200"
      )}
    >
      <div className="font-semibold">{label}</div>
    </button>
  );
}