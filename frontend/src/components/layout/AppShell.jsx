import React, { useState } from 'react';
import { 
  FileText, 
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
  Code2,
  Database,
  Users,
  Tag
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
  onOpenCodeInspector,
  onOpenCohortCollusion,
  report,
  children
}) {
  const { user, isAuthenticated, logout } = useAuth();
  const { toggleTheme, isDark } = useTheme();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isPro = user?.subscription_tier === 'pro' && user?.subscription_status === 'active';

  const navItems = [
    { id: 'scan', label: 'Document Audit', icon: FileText, badge: null },
    { id: 'repository', label: 'Reference Corpus', icon: Database, badge: '4 Repos' },
    { id: 'cohort-collusion', label: 'Cohort Collusion', icon: Users, badge: 'Matrix', action: onOpenCohortCollusion },
    { id: 'code-inspector', label: 'Code AST Inspector', icon: Code2, badge: 'AST', action: onOpenCodeInspector },
    { id: 'history', label: 'Audit Records', icon: History, badge: null },
    { id: 'pricing', label: 'Institutional Plans', icon: Tag, badge: isPro ? 'Pro' : null },
    { id: 'developers', label: 'Developer API', icon: Code2, badge: 'v1' },
    { id: 'billing', label: 'Usage & Invoices', icon: CreditCard, badge: null },
    { id: 'privacy', label: 'Privacy & Retention', icon: Lock, badge: 'GDPR' },
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

  const handleItemClick = (item) => {
    if (item.action) {
      item.action();
      setMobileMenuOpen(false);
    } else {
      onTabChange(item.id);
      setMobileMenuOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#090d16] text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-150">
      {/* Top Header */}
      <header className="sticky top-0 z-40 h-14 bg-white/95 dark:bg-[#0d121f]/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between px-4 sm:px-6">
        {/* Left: Mobile Menu Toggle & Brand Logo */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="md:hidden p-1.5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>

          <div
            onClick={() => onTabChange(report ? 'report' : 'scan')}
            className="flex items-center gap-2.5 cursor-pointer select-none group"
          >
            <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center bg-zinc-950 border border-zinc-800 shadow-2xs group-hover:scale-105 transition-transform shrink-0">
              <img src="/logo.jpg" alt="Poach Logo" className="w-full h-full object-cover" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">Poach</span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  Originality Engine
                </span>
              </div>
              <p className="hidden sm:block text-[10px] text-slate-400 dark:text-slate-500 font-normal">
                Academic Originality Engine
              </p>
            </div>
          </div>
        </div>

        {/* Center: Contextual Breadcrumbs */}
        <div className="hidden lg:flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span className="font-medium text-slate-700 dark:text-slate-300 capitalize">
            {activeTab === 'scan' ? 'Document Audit' : activeTab.replace('-', ' ')}
          </span>
          {report && activeTab === 'report' && (
            <>
              <span className="text-slate-300 dark:text-slate-700">/</span>
              <span className="text-slate-900 dark:text-slate-100 font-medium truncate max-w-xs font-mono text-[11px]">
                {report.document_title || 'Audit Report'}
              </span>
            </>
          )}
        </div>

        {/* Right Header Actions */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Credits Counter Pill */}
          {isAuthenticated && (
            <div
              id="tour-credits-counter"
              onClick={() => onTabChange('billing')}
              className="cursor-pointer px-2.5 py-1 bg-slate-100 hover:bg-slate-200/70 dark:bg-slate-800 dark:hover:bg-slate-700/70 border border-slate-200 dark:border-slate-700 rounded-md flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 transition tabular-nums"
              title="Click to manage subscription or purchase credits"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span className="font-medium">{isPro ? 'Pro Unlimited' : `${user?.scan_credits ?? 0} Credits`}</span>
            </div>
          )}

          {/* Dark / Light Theme Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title={isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
            aria-label="Toggle theme"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
          </button>

          {/* Product Tour Trigger */}
          {onStartTour && (
            <button
              type="button"
              onClick={onStartTour}
              className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title="Documentation & Guided Walkthrough"
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
                  className="flex items-center gap-2 p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                >
                  <div className="w-7 h-7 rounded-md bg-slate-800 dark:bg-slate-700 text-white font-medium text-xs flex items-center justify-center font-mono">
                    {user?.email ? user.email.slice(0, 2).toUpperCase() : 'U'}
                  </div>
                </button>
              }
            >
              {({ close }) => (
                <div className="w-56 py-1">
                  <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                    <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">{user?.email}</p>
                    <p className="text-[10px] text-slate-400 capitalize">{user?.subscription_tier || 'Free'} Tier • {user?.scan_credits || 0} credits</p>
                  </div>
                  <DropdownItem onClick={() => { onTabChange('billing'); close(); }} icon={CreditCard}>
                    Usage & Invoices
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
                      Guided Tour
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
            'hidden md:flex flex-col bg-white dark:bg-[#0d121f] border-r border-slate-200/80 dark:border-slate-800 transition-all duration-150 select-none z-30',
            sidebarCollapsed ? 'w-16' : 'w-56'
          )}
        >
          {/* Navigation Links */}
          <div className="flex-1 p-2 space-y-0.5 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleItemClick(item)}
                  title={sidebarCollapsed ? item.label : undefined}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-colors duration-100 text-left',
                    isActive
                      ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-semibold shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100 font-medium'
                  )}
                >
                  <Icon className={cn('w-4 h-4 shrink-0', isActive ? 'text-inherit' : 'text-slate-400 dark:text-slate-500')} />
                  
                  {!sidebarCollapsed && (
                    <div className="flex-1 flex items-center justify-between truncate">
                      <span className="truncate">{item.label}</span>
                      {item.badge && (
                        <span
                          className={cn(
                            'text-[9px] px-1.5 py-0.2 rounded font-mono font-medium',
                            isActive
                              ? 'bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
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
          <div className="p-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
            {!sidebarCollapsed && (
              <span className="font-mono text-[10px]">
                Poach v2.4
              </span>
            )}
            <button
              type="button"
              onClick={() => setSidebarCollapsed((prev) => !prev)}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition mx-auto"
              title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            >
              {sidebarCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
            </button>
          </div>
        </aside>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex">
            <div className="w-64 bg-white dark:bg-[#0d121f] h-full p-4 flex flex-col justify-between shadow-xl animate-in slide-in-from-left duration-150">
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md overflow-hidden bg-zinc-950 border border-zinc-800 shrink-0">
                      <img src="/logo.jpg" alt="Poach Logo" className="w-full h-full object-cover" />
                    </div>
                    <span className="font-bold text-sm text-slate-900 dark:text-white">Poach Navigation</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-md"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-0.5">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleItemClick(item)}
                        className={cn(
                          'w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition',
                          isActive
                            ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-semibold'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium'
                        )}
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon className="w-4 h-4" />
                          <span>{item.label}</span>
                        </div>
                        {item.badge && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                <p className="text-[10px] text-slate-400 font-mono">Signed in: {user?.email || 'Guest'}</p>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto bg-[#f8fafc] dark:bg-[#090d16] p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto h-full flex flex-col">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
