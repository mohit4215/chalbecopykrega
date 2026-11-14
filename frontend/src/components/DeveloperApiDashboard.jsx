import React, { useState, useEffect } from 'react';
import { 
  Key, 
  Plus, 
  Trash2, 
  Copy, 
  Check, 
  Terminal, 
  ShieldCheck, 
  ExternalLink,
  Code2,
  AlertCircle,
  Zap,
  Lock
} from 'lucide-react';
import { Button } from './ui/button';
import { useAuth } from '../context/AuthContext';

export default function DeveloperApiDashboard() {
  const { authFetch, user } = useAuth();
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [newKeyData, setNewKeyData] = useState(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [activeCodeTab, setActiveCodeTab] = useState('curl');
  const [error, setError] = useState('');

  const fetchKeys = async () => {
    try {
      setLoading(true);
      const res = await authFetch('/api/v1/keys');
      if (res.ok) {
        const data = await res.json();
        setKeys(data);
      }
    } catch (err) {
      setError('Failed to fetch developer API keys.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  const handleCreateKey = async (e) => {
    e.preventDefault();
    if (!keyName.trim()) return;
    try {
      setCreating(true);
      setError('');
      const res = await authFetch('/api/v1/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: keyName.trim() })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Could not generate API key.');
      }
      const data = await res.json();
      setNewKeyData(data);
      setKeyName('');
      fetchKeys();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleRevokeKey = async (keyId) => {
    if (!window.confirm('Are you sure you want to revoke this API key? Applications using it will lose access immediately.')) return;
    try {
      const res = await authFetch(`/api/v1/keys/${keyId}`, { method: 'DELETE' });
      if (res.ok) {
        setKeys(prev => prev.filter(k => k.id !== keyId));
      }
    } catch {
      setError('Failed to revoke API key.');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const sampleKey = newKeyData?.api_key || (keys[0] ? `${keys[0].key_prefix}************************` : 'sk_live_your_api_key_here');

  const codeSnippets = {
    curl: `curl -X POST https://chalbecopykrega-api.onrender.com/api/v1/scan \\
  -H "Authorization: Bearer ${sampleKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "text": "Deep learning models require extensive hyperparameter optimization and tokenization.",
    "title": "Machine_Learning_Paper.txt",
    "enable_web_search": true
  }'`,
    python: `import requests

API_KEY = "${sampleKey}"
ENDPOINT = "https://chalbecopykrega-api.onrender.com/api/v1/scan"

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

payload = {
    "text": "Deep learning models require extensive hyperparameter optimization...",
    "title": "Research_Paper.txt",
    "enable_web_search": True
}

response = requests.post(ENDPOINT, json=payload, headers=headers)
report = response.json()

print(f"Originality Score: {report['originality_score']}%")
print(f"AI Detection: {report['ai_detection']['ai_probability']}% ({report['ai_detection']['verdict']})")
print(f"Matched Sources: {len(report['matches'])}")`,
    node: `const axios = require('axios');

const API_KEY = '${sampleKey}';

async function scanDocument() {
  const response = await axios.post(
    'https://chalbecopykrega-api.onrender.com/api/v1/scan',
    {
      text: 'Deep learning models require extensive hyperparameter optimization...',
      title: 'Essay_Draft.txt',
      enable_web_search: true
    },
    {
      headers: {
        'Authorization': \`Bearer \${API_KEY}\`,
        'Content-Type': 'application/json'
      }
    }
  );

  console.log('Originality:', response.data.originality_score);
  console.log('AI Content Probability:', response.data.ai_detection.ai_probability);
}

scanDocument();`
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 py-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white rounded-3xl p-8 sm:p-10 shadow-xl relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/30 text-indigo-200 text-xs font-bold uppercase tracking-wider mb-4 border border-indigo-400/30">
            <Zap className="w-3.5 h-3.5" />
            Commercial SaaS Developer API
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
            Programmatic Plagiarism & AI Verification API
          </h1>
          <p className="text-sm text-indigo-100/90 mt-3 leading-relaxed">
            Integrate Poach directly into Canvas, Moodle, Blackboard, or internal student portals.
            Query billion-page web archives and AI writing detectors via high-throughput REST endpoints.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl flex items-center gap-3 text-rose-700 dark:text-rose-300 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Generated Key Reveal Modal */}
      {newKeyData && (
        <div className="p-6 bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-500/60 rounded-3xl shadow-lg space-y-3">
          <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200 font-extrabold text-sm">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <span>API Key Generated Successfully</span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Please copy this key now. For your security, <strong className="text-emerald-700 dark:text-emerald-300">you will not be able to view the full secret again</strong>.
          </p>
          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-emerald-300 dark:border-emerald-800 font-mono text-xs select-all">
            <span className="flex-1 truncate font-bold text-slate-800 dark:text-slate-100">{newKeyData.api_key}</span>
            <Button
              size="sm"
              onClick={() => copyToClipboard(newKeyData.api_key)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold shrink-0"
            >
              {copiedKey ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
              {copiedKey ? 'Copied' : 'Copy Key'}
            </Button>
          </div>
        </div>
      )}

      {/* API Key Management Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left (7 Cols): Keys List & Creation */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">Active API Keys</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Manage keys authenticated with your account ({user?.subscription_tier?.toUpperCase()} Tier).
                </p>
              </div>
            </div>

            {/* Create Key Form */}
            <form onSubmit={handleCreateKey} className="flex gap-2">
              <input
                type="text"
                placeholder="Key label (e.g., Canvas LMS Production, Webhook CLI)"
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <Button type="submit" isLoading={creating} disabled={!keyName.trim()} className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shrink-0">
                <Plus className="w-4 h-4 mr-1.5" />
                Generate Key
              </Button>
            </form>

            {/* Keys Table */}
            {loading ? (
              <div className="py-8 text-center text-xs text-slate-400">Loading API keys...</div>
            ) : keys.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                No active API keys found. Generate a key above to start building.
              </div>
            ) : (
              <div className="space-y-3">
                {keys.map((k) => (
                  <div key={k.id} className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Key className="w-4 h-4 text-indigo-600 shrink-0" />
                        <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{k.name}</h4>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                          Active
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-1">
                        <span>{k.key_prefix}••••••••</span>
                        <span>•</span>
                        <span>{k.rate_limit_per_minute} req/min</span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRevokeKey(k.id)}
                      className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 p-2 h-auto rounded-xl"
                      title="Revoke key"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right (5 Cols): Interactive Quickstart Snippets */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-900 text-slate-100 rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                <Terminal className="w-4 h-4 text-indigo-400" />
                <span>REST API Quickstart</span>
              </div>
              <div className="flex gap-1">
                {['curl', 'python', 'node'].map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveCodeTab(tab)}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition uppercase ${
                      activeCodeTab === tab ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            <pre className="p-4 bg-slate-950 rounded-2xl border border-slate-800/80 text-[11px] font-mono overflow-x-auto text-emerald-400 leading-relaxed max-h-72">
              <code>{codeSnippets[activeCodeTab]}</code>
            </pre>

            <div className="pt-2 text-[11px] text-slate-400 flex items-center justify-between">
              <span>Interactive Swagger Specs:</span>
              <a
                href="/docs"
                target="_blank"
                rel="noreferrer"
                className="text-indigo-400 hover:underline flex items-center gap-1 font-bold"
              >
                <span>/docs</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
