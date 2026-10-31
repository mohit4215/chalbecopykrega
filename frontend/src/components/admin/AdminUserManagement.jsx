import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Filter, 
  ShieldAlert, 
  ShieldCheck, 
  Coins, 
  Ban, 
  Trash2, 
  CheckCircle2, 
  ChevronLeft, 
  ChevronRight, 
  X,
  PlusCircle,
  MinusCircle,
  RotateCcw,
  Loader2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function AdminUserManagement() {
  const { authFetch, user: currentAdmin } = useAuth();
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [limit] = useState(10);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Credit Adjustment Modal State
  const [creditModalUser, setCreditModalUser] = useState(null);
  const [creditAction, setCreditAction] = useState('grant'); // 'grant' | 'revoke' | 'set'
  const [creditAmount, setCreditAmount] = useState(25);
  const [isSubmittingCredit, setIsSubmittingCredit] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      });
      if (search.trim()) params.append('search', search.trim());
      if (tierFilter !== 'all') params.append('tier', tierFilter);

      const res = await authFetch(`/api/admin/users?${params.toString()}`);
      if (!res.ok) {
        throw new Error('Failed to load user directory.');
      }
      const data = await res.json();
      setUsers(data.users || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
    } catch (err) {
      setError(err.message || 'Error loading users.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page, tierFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  const handleToggleBan = async (user) => {
    if (user.id === currentAdmin?.id) {
      alert("You cannot suspend your own superadmin account.");
      return;
    }
    const actionText = user.is_banned ? 're-activate' : 'suspend';
    if (!window.confirm(`Are you sure you want to ${actionText} the account for ${user.email}?`)) {
      return;
    }

    try {
      const res = await authFetch(`/api/admin/users/${user.id}/toggle-status`, {
        method: 'POST'
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to update account status.');
      }
      fetchUsers();
    } catch (err) {
      alert(`Action failed: ${err.message}`);
    }
  };

  const handleDeleteUser = async (user) => {
    if (user.id === currentAdmin?.id) {
      alert("You cannot delete your own superadmin account.");
      return;
    }
    if (!window.confirm(`PERMANENT ACTION: Delete user ${user.email} and all their audit history?`)) {
      return;
    }

    try {
      const res = await authFetch(`/api/admin/users/${user.id}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to delete user.');
      }
      fetchUsers();
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleSaveCredits = async (e) => {
    e.preventDefault();
    if (!creditModalUser) return;
    setIsSubmittingCredit(true);

    try {
      const res = await authFetch(`/api/admin/users/${creditModalUser.id}/credits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: creditAction,
          amount: parseInt(creditAmount, 10) || 0
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to adjust credits.');
      }

      setCreditModalUser(null);
      fetchUsers();
    } catch (err) {
      alert(`Credit adjustment failed: ${err.message}`);
    } finally {
      setIsSubmittingCredit(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 sm:p-8 space-y-6">
      {/* Header & Filter Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-100 gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900">User Directory & Management</h3>
              <p className="text-xs text-slate-500">
                Total registered user accounts: <strong className="text-slate-800">{total}</strong>
              </p>
            </div>
          </div>
        </div>

        {/* Search Bar & Tier Filter */}
        <div className="flex flex-wrap items-center gap-3">
          <form onSubmit={handleSearchSubmit} className="relative flex items-center">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by email..."
              className="pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 w-56"
            />
          </form>

          <select
            value={tierFilter}
            onChange={(e) => {
              setTierFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium text-slate-700"
          >
            <option value="all">All Tiers</option>
            <option value="free">Free Tier</option>
            <option value="pro">Pro Tier</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
          {error}
        </div>
      )}

      {/* Users Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <th className="py-3 px-4">User / Email</th>
              <th className="py-3 px-4">Role</th>
              <th className="py-3 px-4">Subscription</th>
              <th className="py-3 px-4">Credits</th>
              <th className="py-3 px-4">Scans Run</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan="7" className="py-12 text-center text-xs text-slate-500">
                  <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  Loading user records...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan="7" className="py-12 text-center text-xs text-slate-500">
                  No accounts match the current filters.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/80 transition">
                  <td className="py-4 px-4">
                    <div className="font-bold text-slate-900">{u.email}</div>
                    <div className="text-[10px] text-slate-400 font-mono">ID: {u.id.slice(0, 8)}...</div>
                  </td>

                  <td className="py-4 px-4">
                    {u.is_admin ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-50 text-purple-700 border border-purple-200">
                        <ShieldAlert className="w-3 h-3 text-purple-600" /> Superadmin
                      </span>
                    ) : (
                      <span className="text-xs text-slate-500 font-medium">Member</span>
                    )}
                  </td>

                  <td className="py-4 px-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      u.subscription_tier === 'pro'
                        ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}>
                      {u.subscription_tier?.toUpperCase()}
                    </span>
                  </td>

                  <td className="py-4 px-4 font-bold text-slate-800">
                    <span className="inline-flex items-center gap-1">
                      <Coins className="w-3.5 h-3.5 text-amber-500" />
                      {u.scan_credits}
                    </span>
                  </td>

                  <td className="py-4 px-4 font-semibold text-slate-700">
                    {u.total_scans}
                  </td>

                  <td className="py-4 px-4">
                    {u.is_banned ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                        Suspended
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Active
                      </span>
                    )}
                  </td>

                  <td className="py-4 px-4 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* Edit Credits */}
                      <button
                        type="button"
                        onClick={() => {
                          setCreditModalUser(u);
                          setCreditAction('grant');
                          setCreditAmount(25);
                        }}
                        className="px-2.5 py-1 text-xs font-bold text-slate-700 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg border border-slate-200 transition"
                        title="Adjust Scan Credits"
                      >
                        Credits
                      </button>

                      {/* Suspend / Re-activate */}
                      <button
                        type="button"
                        onClick={() => handleToggleBan(u)}
                        disabled={u.id === currentAdmin?.id}
                        className={`p-1.5 rounded-lg border transition ${
                          u.is_banned
                            ? 'text-emerald-600 hover:bg-emerald-50 border-emerald-200'
                            : 'text-amber-600 hover:bg-amber-50 border-amber-200'
                        } disabled:opacity-40`}
                        title={u.is_banned ? 'Re-activate Account' : 'Suspend Account'}
                      >
                        <Ban className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete User */}
                      <button
                        type="button"
                        onClick={() => handleDeleteUser(u)}
                        disabled={u.id === currentAdmin?.id}
                        className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg border border-rose-200 transition disabled:opacity-40"
                        title="Delete User Account"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-100 text-xs text-slate-500">
        <div>
          Showing page <strong>{page}</strong> of <strong>{pages}</strong> ({total} total users)
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-bold text-slate-700">{page}</span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(pages, p + 1))}
            disabled={page >= pages}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Credit Adjustment Modal */}
      {creditModalUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 relative">
            <button
              type="button"
              onClick={() => setCreditModalUser(null)}
              className="absolute right-4 top-4 p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-amber-50 text-amber-600 rounded-2xl">
                <Coins className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-extrabold text-slate-900">Adjust Scan Credits</h4>
                <p className="text-xs text-slate-500">{creditModalUser.email}</p>
              </div>
            </div>

            <form onSubmit={handleSaveCredits} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Current Balance</label>
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-extrabold text-slate-800">
                  {creditModalUser.scan_credits} Credits
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">Adjustment Action</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setCreditAction('grant')}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border flex items-center justify-center gap-1.5 transition ${
                      creditAction === 'grant'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <PlusCircle className="w-3.5 h-3.5" /> Grant (+)
                  </button>

                  <button
                    type="button"
                    onClick={() => setCreditAction('revoke')}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border flex items-center justify-center gap-1.5 transition ${
                      creditAction === 'revoke'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <MinusCircle className="w-3.5 h-3.5" /> Revoke (-)
                  </button>

                  <button
                    type="button"
                    onClick={() => setCreditAction('set')}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border flex items-center justify-center gap-1.5 transition ${
                      creditAction === 'set'
                        ? 'bg-slate-800 text-white border-slate-800 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Set (=)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Credit Amount</label>
                <input
                  type="number"
                  min="0"
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-bold"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCreditModalUser(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCredit}
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl shadow-sm transition flex items-center gap-2"
                >
                  {isSubmittingCredit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Apply Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
