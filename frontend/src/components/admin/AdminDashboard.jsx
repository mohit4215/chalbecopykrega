import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  BarChart3, 
  Users, 
  ArrowLeft, 
  AlertTriangle,
  Lock
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import AdminOverview from './AdminOverview';
import AdminUserManagement from './AdminUserManagement';

export default function AdminDashboard({ onExitAdmin }) {
  const { user, authFetch } = useAuth();
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'users'
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchStats = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await authFetch('/api/admin/stats');
      if (!res.ok) {
        throw new Error('Access denied or failed to load superadmin metrics.');
      }
      const data = await res.json();
      setStats(data);
    } catch (err) {
      setError(err.message || 'Failed to fetch admin stats.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.is_admin) {
      fetchStats();
    }
  }, [user]);

  // RBAC Gate: Verify Superadmin Privileges
  if (!user?.is_admin) {
    return (
      <div className="bg-white rounded-3xl border border-rose-200 p-8 sm:p-12 text-center max-w-lg mx-auto shadow-sm my-12">
        <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-3xl flex items-center justify-center mx-auto mb-4">
          <Lock className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-black text-slate-900">Superadmin Access Required</h3>
        <p className="text-xs text-slate-500 mt-2">
          Your account (<strong>{user?.email}</strong>) does not have administrative permissions to view this portal.
        </p>
        <button
          type="button"
          onClick={onExitAdmin}
          className="mt-6 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-sm transition inline-flex items-center gap-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Application</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Superadmin Top Banner & Navigation */}
      <div className="bg-slate-900 text-white p-5 rounded-3xl shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center shadow-inner">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold text-white">Superadmin Control Portal</h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/40">
                RBAC Level 1
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Auditor: <strong className="text-slate-200">{user.email}</strong> • Global System Health & Revenue
            </p>
          </div>
        </div>

        {/* Tab Switcher & Exit Button */}
        <div className="flex items-center gap-2">
          <div className="bg-slate-800/80 p-1 rounded-2xl border border-slate-700/60 flex items-center">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-xl flex items-center gap-1.5 transition ${
                activeTab === 'overview'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Overview</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('users')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-xl flex items-center gap-1.5 transition ${
                activeTab === 'users'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>User Directory</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onExitAdmin}
            className="px-3 py-1.5 text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700/80 border border-slate-700 rounded-xl flex items-center gap-1.5 transition ml-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Exit Portal</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Content Area */}
      {activeTab === 'overview' ? (
        <AdminOverview
          stats={stats}
          onRefresh={fetchStats}
          loading={loading}
        />
      ) : (
        <AdminUserManagement />
      )}
    </div>
  );
}
