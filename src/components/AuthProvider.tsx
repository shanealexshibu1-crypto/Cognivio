import React, { useState, useEffect } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  deleteUser,
  reauthenticateWithPopup,
  GoogleAuthProvider,
  User
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { UserProfile, UserRole } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(() => {
    const cached = localStorage.getItem('cognivio_profile');
    return cached ? JSON.parse(cached) : null;
  });
  const [loading, setLoading] = useState(!profile);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        unsubscribeProfile = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data() as UserProfile;
            setProfile(data);
            localStorage.setItem('cognivio_profile', JSON.stringify(data));
          } else {
            setProfile(null);
            localStorage.removeItem('cognivio_profile');
          }
          setLoading(false);
        }, (err) => {
          console.error("Error fetching profile snapshot:", err);
          setProfile(null);
          localStorage.removeItem('cognivio_profile');
          setLoading(false);
        });
      } else {
        if (unsubscribeProfile) unsubscribeProfile();
        setProfile(null);
        localStorage.removeItem('cognivio_profile');
        setLoading(false);
      }
    });
    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  const handleDeleteAccount = async () => {
    if (!user || !profile) return;
    
    if (!window.confirm("Are you absolutely sure you want to delete your account? This action is permanent and cannot be undone.")) {
      return;
    }

    try {
      
      await deleteDoc(doc(db, 'users', user.uid));
      
      
      try {
        await deleteUser(user);
      } catch (authError: any) {
        if (authError.code === 'auth/requires-recent-login') {
          
          const provider = new GoogleAuthProvider();
          provider.setCustomParameters({ prompt: 'select_account' });
          try {
            const reauthResult = await reauthenticateWithPopup(user, provider);
            await deleteUser(reauthResult.user);
          } catch (reauthError) {
            alert("For security reasons, please log out and log back in, then try deleting your account again.");
            
            setProfile(null);
            localStorage.removeItem('cognivio_profile');
            return;
          }
        } else {
          throw authError;
        }
      }
      
      setProfile(null);
      localStorage.removeItem('cognivio_profile');
      setUser(null);
    } catch (error: any) {
      console.error("Delete account error:", error);
      alert("Failed to delete account. " + error.message);
    }
  };

  const value = {
    user,
    profile,
    loading,
    signOut: () => signOut(auth),
    refreshProfile: () => Promise.resolve(),
    deleteAccount: handleDeleteAccount,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}