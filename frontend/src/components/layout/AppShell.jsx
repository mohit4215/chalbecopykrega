import React, { useState } from 'react';
import { 
  UploadCloud, 
  History, 
  CreditCard, 
  Lock, 
  ShieldAlert, 
  Sun, 
  Moon, 
  HelpCircle, 
  LogOut, 
  Menu, 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Zap, 
  Sparkles,
  ShieldCheck,
  User as UserIcon,
  CheckCircle2,
  Code2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Dropdown, DropdownItem, DropdownSeparator } from '../ui/dropdown';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';

export default function AppShell({
  activeTab,
  onTabChange,
  onStartTour,
  report,
  children
}) {
  const { user, isAuthenticated, logout } = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isPro = user?.subscription_tier === 'pro' && user?.subscription_status === 'active';

  const navItems = [
    { id: 'scan', label: 'New Scan', icon: UploadCloud, badge: null },
    { id: 'history', label: 'Scan History', icon: History, badge: null },
    { id: 'pricing', label: 'Pricing Plans', icon: Sparkles, badge: isPro ? 'Active' : 'Upgrade' },
    { id: 'developers', label: 'Developer API', icon: Code2, badge: 'v1' },
    { id: 'billing', label: 'Billing & Invoices', icon: CreditCard, badge: null },
    { id: 'privacy', label: 'Data & Privacy', icon: Lock, badge: 'GDPR' },
  ];

  if (user?.is_admin) {
    navItems.push({
      id: 'admin',
      label: 'Superadmin',
      icon: ShieldAlert,
      badge: 'RBAC',
      isAdmin: true,
    });
  }

  const handleNavClick = (tabId) => {
    onTabChange(tabId);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      {/* Top Header */}
      <header className="sticky top-0 z-40 h-16 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 sm:px-6 transition-colors">
        {/* Left: Mobile Menu Toggle & Brand Logo */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="md:hidden p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div
            onClick={() => onTabChange(report ? 'report' : 'scan')}
            className="flex items-center gap-2.5 cursor-pointer select-none"
          >
            <div className="w-9 h-9 rounded-xl bg-indigo-600 dark:bg-indigo-500 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-base font-black tracking-tight text-slate-900 dark:text-white">Poach</span>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                  AI & Web
                </span>
              </div>
              <p className="hidden sm:block text-[10px] text-slate-400 dark:text-slate-500 -mt-0.5">
                Originality Verification Engine
              </p>
            </div>
          </div>
        </div>

        {/* Center: Contextual Breadcrumbs */}
        <div className="hidden lg:flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <span className="capitalize">{activeTab === 'scan' ? 'Document Verification' : activeTab}</span>
          {report && activeTab === 'report' && (
            <>
              <span>/</span>
              <span className="text-slate-900 dark:text-slate-100 font-bold truncate max-w-xs">
                {report.document_title || 'Scan Report'}
              </span>
            </>
          )}
        </div>

        {/* Right Header Actions */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Credits Counter Pill */}
          {isAuthenticated && (
            <div
              id="tour-credits-counter"
              onClick={() => onTabChange('billing')}
              className="cursor-pointer px-3 py-1.5 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/40 border border-amber-200 dark:border-amber-800/60 rounded-full flex items-center gap-1.5 text-xs font-bold text-amber-900 dark:text-amber-300 transition"
              title="Click to manage subscription or purchase credits"
            >
              <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
              <span>{isPro ? 'Pro Unlimited' : `${user?.scan_credits ?? 0} Credits`}</span>
            </div>
          )}

          {/* Dark / Light Theme Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title={isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
            aria-label="Toggle theme"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
          </button>

          {/* Product Tour Trigger */}
          {onStartTour && (
            <button
              type="button"
              onClick={onStartTour}
              className="p-2 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title="Start Guided Tour"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          )}

          {/* User Avatar & Dropdown Menu */}
          {isAuthenticated ? (
            <Dropdown
              align="right"
              trigger={
                <button
                  type="button"
                  className="flex items-center gap-2 p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                >
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-black text-xs flex items-center justify-center shadow-sm">
                    {user?.email ? user.email.slice(0, 2).toUpperCase() : 'U'}
                  </div>
                </button>
              }
            >
              {({ close }) => (
                <div className="w-56 py-1">
                  <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{user?.email}</p>
                    <p className="text-[10px] text-slate-400 capitalize">{user?.subscription_tier || 'Free'} Tier • {user?.scan_credits || 0} credits</p>
                  </div>
                  <DropdownItem onClick={() => { onTabChange('billing'); close(); }} icon={CreditCard}>
                    Subscription & Credits
                  </DropdownItem>
                  <DropdownItem onClick={() => { onTabChange('privacy'); close(); }} icon={Lock}>
                    Privacy & GDPR Settings
                  </DropdownItem>
                  {user?.is_admin && (
                    <DropdownItem onClick={() => { onTabChange('admin'); close(); }} icon={ShieldAlert}>
                      Superadmin Control
                    </DropdownItem>
                  )}
                  {onStartTour && (
                    <DropdownItem onClick={() => { onStartTour(); close(); }} icon={HelpCircle}>
                      Replay Product Tour
                    </DropdownItem>
                  )}
                  <DropdownSeparator />
                  <DropdownItem onClick={() => { logout(); close(); }} icon={LogOut} destructive>
                    Sign Out
                  </DropdownItem>
                </div>
              )}
            </Dropdown>
          ) : (
            <Button size="sm" onClick={() => onTabChange('login')}>
              Sign In
            </Button>
          )}
        </div>
      </header>

      {/* Main Layout Body: Sidebar + Viewport */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Collapsible Sidebar */}
        <aside
          id="tour-settings-menu"
          className={cn(
            'hidden md:flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-all duration-200 select-none z-30',
            sidebarCollapsed ? 'w-20' : 'w-64'
          )}
        >
          {/* Navigation Links */}
          <div className="flex-1 p-3 space-y-1.5 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavClick(item.id)}
                  title={sidebarCollapsed ? item.label : undefined}
                  className={cn(
                    'w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all group relative',
                    isActive
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                  )}
                >
                  <Icon className={cn('w-4 h-4 shrink-0 transition-transform group-hover:scale-110', isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400')} />
                  
                  {!sidebarCollapsed && (
                    <div className="flex-1 flex items-center justify-between truncate">
                      <span className="truncate">{item.label}</span>
                      {item.badge && (
                        <span
                          className={cn(
                            'text-[9px] px-2 py-0.5 rounded-full font-extrabold uppercase',
                            isActive
                              ? 'bg-white/20 text-white'
                              : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                          )}
                        >
                          {item.badge}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Sidebar Footer with Collapse Toggle */}
          <div className="p-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            {!sidebarCollapsed && (
              <span className="text-[10px] font-semibold text-slate-400">
                Poach v2.4 • Clean Zero-Retention
              </span>
            )}
            <button
              type="button"
              onClick={() => setSidebarCollapsed((prev) => !prev)}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition mx-auto"
              title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            >
              {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>
        </aside>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex">
            <div className="w-72 bg-white dark:bg-slate-900 h-full p-4 flex flex-col justify-between shadow-2xl animate-in slide-in-from-left duration-200">
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-indigo-600" />
                    <span className="font-extrabold text-slate-900 dark:text-white">Menu Navigation</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-1">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleNavClick(item.id)}
                        className={cn(
                          'w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition',
                          isActive
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className="w-4 h-4" />
                          <span>{item.label}</span>
                        </div>
                        {item.badge && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-extrabold">
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <p className="text-[11px] text-slate-400">Signed in as: {user?.email || 'Guest'}</p>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto bg-slate-50/50 dark:bg-slate-950/50 p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto h-full flex flex-col">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
