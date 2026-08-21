import React from 'react';
import { useAuth } from './AuthProvider';
import { cn } from '../lib/utils';
import { 
  LogOut, 
  LayoutDashboard, 
  ClipboardList, 
  BookHeart, 
  Users, 
  ChefHat, 
  Bell, 
  Menu, 
  X, 
  ShieldCheck,
  Trash2,
  Settings
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { Logo } from './Logo';

interface DashboardLayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (id: string) => void;
}

export function DashboardLayout({ children, activeTab, onTabChange }: DashboardLayoutProps) {
  const { profile, signOut } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);

  const getNavItems = () => {
    const commonNav = [{ icon: Settings, label: 'Settings', id: 'settings' }];
    
    switch (profile?.role) {
      case 'monitor':
        return [
          { icon: LayoutDashboard, label: 'Overview', id: 'overview' },
          { icon: Users, label: 'History', id: 'history' },
          { icon: BookHeart, label: 'Journal', id: 'journal' },
          { icon: Bell, label: 'Mindfulness', id: 'mindfulness' },
          ...commonNav
        ];
      case 'teacher':
        return [
          { icon: LayoutDashboard, label: 'Class Stats', id: 'overview' },
          { icon: Users, label: 'Students', id: 'students' },
          { icon: Bell, label: 'Alerts', id: 'alerts' },
          ...commonNav
        ];
      case 'student':
        return [
          { icon: LayoutDashboard, label: 'My Wellness', id: 'overview' },
          { icon: BookHeart, label: 'Journal', id: 'journal' },
          { icon: Bell, label: 'Mindfulness', id: 'mindfulness' },
          ...commonNav
        ];
      case 'admin':
        return [
          { icon: LayoutDashboard, label: 'School Overview', id: 'overview' },
          { icon: ClipboardList, label: 'Leaderboard', id: 'leaderboard' },
          { icon: Bell, label: 'Alerts', id: 'alerts' },
          ...commonNav
        ];
      default:
        return commonNav;
    }
  };

  const navItems = getNavItems();

  return (
    <div className="min-h-screen bg-brand-50 flex">
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {!isSidebarOpen && (
          <motion.button 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(true)}
            className="fixed top-4 left-4 z-50 p-2 bg-white rounded-xl shadow-lg border border-brand-200 md:hidden"
          >
            <Menu className="w-6 h-6 text-brand-900" />
          </motion.button>
        )}
      </AnimatePresence>

      <aside 
        className={cn(
          "bg-white border-r border-brand-200 transition-all duration-300 fixed md:relative z-40 h-full shadow-sm",
          isSidebarOpen ? "w-64" : "w-0 -translate-x-full md:w-0 md:translate-x-0 overflow-hidden"
        )}
      >
        <div className="p-6 h-full flex flex-col">
          <div className="flex items-center gap-3 mb-10 overflow-hidden">
            <Logo className="w-10 h-10 shrink-0" />
            <span className="font-serif font-semibold text-xl text-brand-900 tracking-tight whitespace-nowrap">cognivio</span>
            <button onClick={() => setIsSidebarOpen(false)} className="ml-auto md:hidden">
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          <nav className="flex-1 space-y-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all group overflow-hidden whitespace-nowrap",
                  activeTab === item.id 
                    ? "bg-brand-500 text-white shadow-lg shadow-brand-500/20" 
                    : "text-slate-600 hover:bg-brand-50 hover:text-brand-500"
                )}
              >
                <item.icon className={cn(
                  "w-5 h-5 transition-transform",
                  activeTab === item.id ? "scale-110" : "group-hover:scale-110"
                )} />
                <span className="font-medium text-sm tracking-tight">{item.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </aside>

      <main className={cn(
        "flex-1 transition-all duration-300 p-4 md:p-8 relative",
        isSidebarOpen ? "md:ml-0" : "md:ml-0"
      )}>
        {children}
      </main>
    </div>
  );
}