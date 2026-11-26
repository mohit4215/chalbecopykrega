import React, { useState } from 'react';
import { 
  FileText, 
  History, 
  CreditCard, 
  Lock, 
  ShieldAlert, 
  Sun, 
  Moon, 
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
    { id: 'scan', label: 'New Scan', icon: FileText },
    { id: 'history', label: 'Scan History', icon: History },
    { id: 'repository', label: 'Reference Library', icon: Database },
    { id: 'pricing', label: 'Plans & Pricing', icon: Tag, badge: isPro ? 'Pro' : null },
    { id: 'developers', label: 'Developer API', icon: Code2 },
    { id: 'billing', label: 'Account & Billing', icon: CreditCard },
    { id: 'privacy', label: 'Privacy & Retention', icon: Lock },
  ];

  if (user?.is_admin) {
    navItems.push({
      id: 'admin',
      label: 'Admin Console',
      icon: ShieldAlert,
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-150">
      {/* Top Header */}
      <header className="sticky top-0 z-40 h-14 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 sm:px-6">
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
            <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center bg-slate-900 border border-slate-800 shadow-xs group-hover:scale-105 transition-transform shrink-0">
              <img src="/logo.jpg" alt="Poach Logo" className="w-full h-full object-cover" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">Poach</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                  Originality Engine
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Center: Contextual Breadcrumb */}
        <div className="hidden lg:flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span className="font-medium text-slate-700 dark:text-slate-300 capitalize">
            {activeTab === 'scan' ? 'Document Scan' : activeTab === 'report' ? 'Originality Report' : activeTab.replace('-', ' ')}
          </span>
          {report && activeTab === 'report' && (
            <>
              <span className="text-slate-300 dark:text-slate-700">/</span>
              <span className="text-slate-900 dark:text-slate-100 font-medium truncate max-w-xs text-xs">
                {report.document_title || report.filename || 'Report'}
              </span>
            </>
          )}
        </div>

        {/* Right Header Actions */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Quick Tools */}
          <div className="hidden sm:flex items-center gap-1">
            {onOpenCodeInspector && (
              <button
                type="button"
                onClick={onOpenCodeInspector}
                className="px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition"
              >
                Code Diff
              </button>
            )}
            {onOpenCohortCollusion && (
              <button
                type="button"
                onClick={onOpenCohortCollusion}
                className="px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition"
              >
                Collusion Check
              </button>
            )}
          </div>

          {/* Credits Counter Pill */}
          {isAuthenticated && (
            <div
              id="tour-credits-counter"
              onClick={() => onTabChange('billing')}
              className="cursor-pointer px-2.5 py-1 bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-md flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 transition"
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

          {/* User Avatar & Dropdown Menu */}
          {isAuthenticated ? (
            <Dropdown
              align="right"
              trigger={
                <button
                  type="button"
                  className="flex items-center gap-2 p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                >
                  <div className="w-7 h-7 rounded-md bg-slate-800 dark:bg-slate-700 text-white font-medium text-xs flex items-center justify-center">
                    {user?.email ? user.email.slice(0, 2).toUpperCase() : 'U'}
                  </div>
                </button>
              }
            >
              {({ close }) => (
                <div className="w-56 py-1">
                  <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                    <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">{user?.email}</p>
                    <p className="text-[11px] text-slate-400 capitalize">{user?.subscription_tier || 'Free'} Tier • {user?.scan_credits || 0} credits</p>
                  </div>
                  <DropdownItem onClick={() => { onTabChange('billing'); close(); }} icon={CreditCard}>
                    Account & Billing
                  </DropdownItem>
                  <DropdownItem onClick={() => { onTabChange('privacy'); close(); }} icon={Lock}>
                    Privacy Settings
                  </DropdownItem>
                  {user?.is_admin && (
                    <DropdownItem onClick={() => { onTabChange('admin'); close(); }} icon={ShieldAlert}>
                      Admin Console
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
            'hidden md:flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-all duration-150 select-none z-30',
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
                      ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-semibold shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 font-medium'
                  )}
                >
                  <Icon className={cn('w-4 h-4 shrink-0', isActive ? 'text-inherit' : 'text-slate-400 dark:text-slate-500')} />
                  
                  {!sidebarCollapsed && (
                    <div className="flex-1 flex items-center justify-between truncate">
                      <span className="truncate">{item.label}</span>
                      {item.badge && (
                        <span className="ml-1.5 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400">
                          {item.badge}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Quick Actions Footer */}
          <div className="p-2 border-t border-slate-100 dark:border-slate-800 space-y-1">
            {onOpenCodeInspector && (
              <button
                type="button"
                onClick={onOpenCodeInspector}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition"
                title={sidebarCollapsed ? 'Code AST Inspector' : undefined}
              >
                <Code2 className="w-4 h-4 text-indigo-500 shrink-0" />
                {!sidebarCollapsed && <span>Code AST Diff</span>}
              </button>
            )}

            {onOpenCohortCollusion && (
              <button
                type="button"
                onClick={onOpenCohortCollusion}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition"
                title={sidebarCollapsed ? 'Cohort Collusion' : undefined}
              >
                <Users className="w-4 h-4 text-amber-500 shrink-0" />
                {!sidebarCollapsed && <span>Cohort Collusion</span>}
              </button>
            )}
          </div>

          {/* Sidebar Collapse Toggle */}
          <div className="p-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="w-full flex items-center justify-center p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition"
              title={sidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'}
            >
              {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>
        </aside>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex">
            <div
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="relative w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col p-4 shadow-xl">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-2">
                <span className="text-sm font-bold text-slate-900 dark:text-white">Navigation</span>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 space-y-1 overflow-y-auto">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleItemClick(item)}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition',
                        isActive
                          ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-semibold'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                {onOpenCodeInspector && (
                  <button
                    type="button"
                    onClick={() => { onOpenCodeInspector(); setMobileMenuOpen(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                  >
                    <Code2 className="w-4 h-4 text-indigo-500" />
                    <span>Code AST Inspector</span>
                  </button>
                )}

                {onOpenCohortCollusion && (
                  <button
                    type="button"
                    onClick={() => { onOpenCohortCollusion(); setMobileMenuOpen(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                  >
                    <Users className="w-4 h-4 text-amber-500" />
                    <span>Cohort Collusion</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Viewport Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 flex flex-col">
          <div className="max-w-7xl w-full mx-auto flex-1 flex flex-col">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
