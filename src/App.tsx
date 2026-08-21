import React, { useState } from 'react';
import { AuthProvider, useAuth } from './components/AuthProvider';
import { AuthView } from './components/auth/AuthFlow';
import { PinScreen } from './components/auth/PinScreen';
import { SetPinScreen } from './components/auth/SetPinScreen';
import { DashboardLayout } from './components/DashboardLayout';
import { MonitorDashboard } from './components/dashboards/MonitorDashboard';
import { StudentDashboard } from './components/dashboards/StudentDashboard';
import { TeacherDashboard } from './components/dashboards/TeacherDashboard';
import { AdminDashboard } from './components/dashboards/AdminDashboard';
import { SettingsPage } from './components/SettingsPage';

function AppContent() {
  const { user, profile, loading } = useAuth();
  const [activeTab, setActiveTab] = React.useState('overview');
  const [isPinVerified, setIsPinVerified] = useState(false);
  const previousOnboardedState = React.useRef(profile?.onboarded);

  
  React.useEffect(() => {
    if (profile?.onboarded === true && previousOnboardedState.current === false) {
      setIsPinVerified(true);
    }
    previousOnboardedState.current = profile?.onboarded;
  }, [profile?.onboarded]);

  
  React.useEffect(() => {
    setActiveTab('overview');
  }, [profile?.uid]);


  React.useEffect(() => {
    setIsPinVerified(false);
  }, [user?.uid]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-500"></div>
      </div>
    );
  }

  if (!user || !profile || !profile.onboarded) {
    return <AuthView />;
  }

  if (!profile.pinCode) {
    return <SetPinScreen onSuccess={() => setIsPinVerified(true)} />;
  }

  if (profile.pinCode && !isPinVerified) {
    return <PinScreen onSuccess={() => setIsPinVerified(true)} />;
  }

  const renderDashboard = () => {
    if (activeTab === 'settings') {
      return <SettingsPage />;
    }

    switch (profile.role) {
      case 'monitor': 
        if (activeTab === 'journal' || activeTab === 'mindfulness') {
          return <StudentDashboard activeTab={activeTab} onTabChange={setActiveTab} />;
        }
        return <MonitorDashboard activeTab={activeTab} onTabChange={setActiveTab} />;
      case 'student': return <StudentDashboard activeTab={activeTab} onTabChange={setActiveTab} />;
      case 'teacher': return <TeacherDashboard activeTab={activeTab} onTabChange={setActiveTab} />;
      case 'admin': return <AdminDashboard activeTab={activeTab} onTabChange={setActiveTab} />;
      default: return <div className="text-center p-12 glass rounded-3xl">Unknown role level access.</div>;
    }
  };

  return (
    <DashboardLayout activeTab={activeTab} onTabChange={setActiveTab}>
      {renderDashboard()}
    </DashboardLayout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}