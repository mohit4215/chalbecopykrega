import React, { useState, useEffect, useCallback } from 'react';
import { 
  Database, 
  Search, 
  Plus, 
  BookOpen, 
  Sparkles, 
  CheckCircle2, 
  Layers, 
  Trash2, 
  X, 
  Loader2, 
  FileText, 
  RefreshCw,
  Building,
  User,
  Eye,
  Globe,
  DownloadCloud
} from 'lucide-react';
import { Button } from './ui/button';
import { useAuth } from '../context/AuthContext';

export default function RepositoryDashboard() {
  const { authFetch } = useAuth();
  const [stats, setStats] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalDocs, setTotalDocs] = useState(0);

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isHarvestModalOpen, setIsHarvestModalOpen] = useState(false);
  const [viewingDoc, setViewingDoc] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  // Manual Form State
  const [formTitle, setFormTitle] = useState('');
  const [formAuthor, setFormAuthor] = useState('');
  const [formCategory, setFormCategory] = useState('Computer Science & AI');
  const [formInstitution, setFormInstitution] = useState('Institutional Library');
  const [formContent, setFormContent] = useState('');

  // Harvester State
  const [curatedTopics, setCuratedTopics] = useState([]);
  const [harvestTopic, setHarvestTopic] = useState('Artificial Intelligence & Machine Learning');
  const [harvestLimit, setHarvestLimit] = useState(5);
  const [harvestSource, setHarvestSource] = useState('all');
  const [isHarvesting, setIsHarvesting] = useState(false);
  const [harvestResult, setHarvestResult] = useState(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await authFetch('/api/repository/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch {
      // Non-critical background failure
    }
  }, [authFetch]);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    setActionError('');
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10'
      });
      if (search.trim()) params.append('search', search.trim());
      if (selectedCategory && selectedCategory !== 'all') params.append('category', selectedCategory);

      const res = await authFetch(`/api/repository/documents?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents || []);
        setTotalDocs(data.total || 0);
        setTotalPages(data.pages || 1);
      }
    } catch {
      setActionError('Failed to fetch reference database documents.');
    } finally {
      setLoading(false);
    }
  }, [authFetch, page, search, selectedCategory]);

  useEffect(() => {
    fetchStats();
    // Load harvest topics
    authFetch('/api/repository/harvest/topics')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d && d.topics) setCuratedTopics(d.topics);
      })
      .catch(() => {});
  }, [fetchStats, authFetch]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleAddDocument = async (e) => {
    e.preventDefault();
    if (!formTitle.trim() || !formAuthor.trim() || !formContent.trim()) {
      setActionError('Please fill in title, author, and document text content.');
      return;
    }

    setIsSubmitting(true);
    setActionError('');
    setActionSuccess('');

    try {
      const res = await authFetch('/api/repository/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formTitle.trim(),
          author: formAuthor.trim(),
          category: formCategory.trim(),
          institution: formInstitution.trim(),
          content: formContent.trim()
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to ingest reference document.');
      }

      setActionSuccess(`Successfully added and indexed "${formTitle}" into the plagiarism reference database!`);
      setFormTitle('');
      setFormAuthor('');
      setFormContent('');
      setIsAddModalOpen(false);
      fetchStats();
      fetchDocuments();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExecuteHarvest = async () => {
    if (!harvestTopic.trim()) {
      setActionError('Please select or specify a topic to harvest.');
      return;
    }

    setIsHarvesting(true);
    setActionError('');
    setHarvestResult(null);

    try {
      const res = await authFetch('/api/repository/harvest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: harvestTopic.trim(),
          limit: parseInt(harvestLimit, 10),
          source: harvestSource
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to harvest open-access papers.');
      }

      const data = await res.json();
      setHarvestResult(data);
      setActionSuccess(`Successfully harvested and indexed ${data.papers_ingested_count} papers (${data.total_new_chunks} vector chunks) from ${data.source_used}!`);
      fetchStats();
      fetchDocuments();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setIsHarvesting(false);
    }
  };

  const handleDeleteDocument = async (docId, title) => {
    if (!window.confirm(`Are you sure you want to remove "${title}" from the plagiarism database?`)) {
      return;
    }

    try {
      const res = await authFetch(`/api/repository/documents/${docId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setActionSuccess(`Document removed from reference corpus.`);
        fetchStats();
        fetchDocuments();
      } else {
        const err = await res.json().catch(() => ({}));
        setActionError(err.detail || 'Failed to remove document.');
      }
    } catch {
      setActionError('Failed to delete document.');
    }
  };

  const categoriesList = [
    'all',
    'Computer Science & AI',
    'Data Science & Statistics',
    'Software Engineering',
    'Applied Mathematics',
    'Biotechnology & Medicine',
    'Economics & Finance',
    'Philosophy & Ethics',
    'Quantum Physics',
    'Law & Legal Studies',
    'History & Political Science',
    'Submitted Student Work'
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8 py-6 px-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <Database className="w-6 h-6" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100">
              Plagiarism Reference Database
            </h1>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
            The institutional repository and cross-referencing corpus against which Poach analyzes all incoming submissions for originality, copy-paste, and paraphrasing.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button variant="outline" size="sm" onClick={() => { fetchStats(); fetchDocuments(); }} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>

          {/* Harvest Academic Corpus Launcher */}
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => {
              setHarvestResult(null);
              setIsHarvestModalOpen(true);
            }} 
            className="gap-2 border-indigo-300 dark:border-indigo-700 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/60"
          >
            <Globe className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            Harvest OpenAlex & arXiv
          </Button>

          <Button size="sm" onClick={() => setIsAddModalOpen(true)} className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold">
            <Plus className="w-4 h-4" />
            Add Paper
          </Button>
        </div>
      </div>

      {/* Notifications */}
      {actionSuccess && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl flex items-center justify-between text-emerald-800 dark:text-emerald-200 text-sm animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess('')} className="p-1 hover:bg-emerald-100 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {actionError && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl flex items-center justify-between text-rose-800 dark:text-rose-200 text-sm">
          <span>{actionError}</span>
          <button onClick={() => setActionError('')} className="p-1 hover:bg-rose-100 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Repository Docs</span>
            <BookOpen className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-3xl font-black text-slate-900 dark:text-slate-100">
            {stats ? stats.total_documents : '—'}
          </div>
          <p className="text-xs text-slate-500 mt-1">Foundational reference papers</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Vector Chunks</span>
            <Layers className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-3xl font-black text-slate-900 dark:text-slate-100">
            {stats ? stats.total_chunks : '—'}
          </div>
          <p className="text-xs text-slate-500 mt-1">Indexed semantic embeddings</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Words Indexed</span>
            <FileText className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-3xl font-black text-slate-900 dark:text-slate-100">
            {stats ? stats.total_words?.toLocaleString() : '—'}
          </div>
          <p className="text-xs text-slate-500 mt-1">Cross-domain literature</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Engine Status</span>
            <Sparkles className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 mt-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Active & Indexing
          </div>
          <p className="text-xs text-slate-500 mt-1">OpenAlex & arXiv connected</p>
        </div>
      </div>

      {/* Fast Ingestion Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 dark:from-slate-900 dark:via-indigo-950/40 dark:to-slate-900 border border-indigo-200 dark:border-indigo-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full bg-indigo-600 text-white font-black text-[10px] uppercase tracking-wider">
              Corpus Expansion
            </span>
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
              Open-Access Academic Literature Harvester
            </h3>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 max-w-2xl">
            Automatically download, parse, and embed peer-reviewed papers from OpenAlex (250M+ works) and arXiv (2.4M+ preprints) to expand your plagiarism comparison base.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setHarvestResult(null);
            setIsHarvestModalOpen(true);
          }}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shrink-0"
        >
          <DownloadCloud className="w-3.5 h-3.5 mr-1.5" />
          Seed Research Papers
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search papers by title, author, institution..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-slate-100"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Category:</span>
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-semibold text-slate-700 dark:text-slate-300"
          >
            {categoriesList.map((cat) => (
              <option key={cat} value={cat}>
                {cat === 'all' ? 'All Disciplines' : cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Documents Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            <p className="text-xs text-slate-400">Loading reference literature...</p>
          </div>
        ) : documents.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <BookOpen className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
            <h3 className="font-bold text-slate-700 dark:text-slate-300 text-sm">No Reference Documents Found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {search ? 'Try adjusting your search criteria.' : 'Use the "Harvest OpenAlex & arXiv" tool to seed hundreds of scholarly research papers into your database.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Document Title</th>
                  <th className="py-3.5 px-4">Author</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Institution</th>
                  <th className="py-3.5 px-4 text-center">Chunks</th>
                  <th className="py-3.5 px-4 text-center">Words</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                    <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-slate-100 max-w-xs truncate" title={doc.title}>
                      {doc.title}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 max-w-[150px] truncate">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{doc.author}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-semibold text-[10px]">
                        {doc.category}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 max-w-[160px] truncate">
                      <div className="flex items-center gap-1.5">
                        <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{doc.institution}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-600 dark:text-slate-300">
                      {doc.chunk_count}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono text-slate-500">
                      {doc.word_count.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-1 whitespace-nowrap">
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => setViewingDoc(doc)}
                        className="text-slate-500 hover:text-slate-900 dark:hover:text-white"
                        title="View Document Details & Chunks"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => handleDeleteDocument(doc.id, doc.title)}
                        className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                        title="Delete Document"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <span>
              Showing {(page - 1) * 10 + 1} to {Math.min(page * 10, totalDocs)} of {totalDocs} papers
            </span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <span className="font-bold text-slate-700 dark:text-slate-300">
                Page {page} of {totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Harvest Open-Access Corpus Modal */}
      {isHarvestModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0d121f] rounded-xl max-w-2xl w-full p-6 space-y-5 shadow-lg border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">
                    Harvest Open-Access Research Corpus
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Pull authentic research across OpenAlex, arXiv, Semantic Scholar, and Crossref into your comparison index.
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsHarvestModalOpen(false)} 
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Quick Topic Chips */}
              {curatedTopics.length > 0 && (
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Quick Disciplines:
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {curatedTopics.map((top) => (
                      <button
                        key={top.id}
                        type="button"
                        onClick={() => setHarvestTopic(top.label)}
                        className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition border ${
                          harvestTopic === top.label
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                        }`}
                      >
                        {top.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Custom Topic Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Search Query or Field
                </label>
                <input
                  type="text"
                  value={harvestTopic}
                  onChange={(e) => setHarvestTopic(e.target.value)}
                  placeholder="e.g. quantum computing, deep learning, macroeconomics..."
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                />
              </div>

              {/* Grid: Source and Quantity */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Repository Source
                  </label>
                  <select
                    value={harvestSource}
                    onChange={(e) => setHarvestSource(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700 dark:text-slate-300 font-medium"
                  >
                    <option value="all">All Sources (OpenAlex, arXiv, Semantic Scholar, Crossref)</option>
                    <option value="openalex">OpenAlex (Global Works - 250M+)</option>
                    <option value="arxiv">arXiv (STEM Preprints - 2.4M+)</option>
                    <option value="semanticscholar">Semantic Scholar (AI & Science Graph - 200M+)</option>
                    <option value="crossref">Crossref (Peer-Reviewed DOIs - 150M+)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Batch Size (Papers)
                  </label>
                  <select
                    value={harvestLimit}
                    onChange={(e) => setHarvestLimit(Number(e.target.value))}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700 dark:text-slate-300 font-medium"
                  >
                    <option value={3}>3 Papers (Quick Seed)</option>
                    <option value={5}>5 Papers (Standard)</option>
                    <option value={10}>10 Papers (Deep Corpus)</option>
                    <option value={20}>20 Papers (Maximum Batch)</option>
                  </select>
                </div>
              </div>

              {/* Harvest Result Preview */}
              {harvestResult && (
                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 space-y-2 text-emerald-900 dark:text-emerald-200 animate-in fade-in duration-150">
                  <div className="flex items-center gap-2 font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Harvest Complete: {harvestResult.papers_ingested_count} Papers Ingested!</span>
                  </div>
                  <p className="text-[11px] opacity-90">
                    Added {harvestResult.total_new_words?.toLocaleString()} words across {harvestResult.total_new_chunks} vector chunks to your live comparison index.
                  </p>
                  <div className="max-h-36 overflow-y-auto space-y-1 pt-1">
                    {harvestResult.ingested_papers?.map((p, i) => (
                      <div key={i} className="p-2 bg-white/80 dark:bg-slate-900/80 rounded-lg text-[10px] font-mono flex items-center justify-between">
                        <span className="truncate max-w-sm font-semibold">{p.title}</span>
                        <span className="text-emerald-700 dark:text-emerald-300 font-bold shrink-0">{p.chunks_indexed} chunks</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button type="button" variant="outline" onClick={() => setIsHarvestModalOpen(false)}>
                Done
              </Button>
              <Button 
                onClick={handleExecuteHarvest} 
                disabled={isHarvesting || !harvestTopic.trim()} 
                className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
              >
                {isHarvesting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Harvesting & Indexing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Start Ingestion
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Document Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0d121f] rounded-xl max-w-lg w-full p-6 space-y-5 shadow-lg border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 rounded-lg">
                  <Plus className="w-4 h-4" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Ingest Reference Document
                </h3>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddDocument} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Document Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Deep Learning Book Chapter 5"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Author / Source
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Ian Goodfellow"
                    value={formAuthor}
                    onChange={(e) => setFormAuthor(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Subject Category
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700 dark:text-slate-300"
                  >
                    {categoriesList.filter(c => c !== 'all').map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Institution / Publisher
                </label>
                <input
                  type="text"
                  placeholder="e.g., IEEE / Stanford University"
                  value={formInstitution}
                  onChange={(e) => setFormInstitution(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Reference Text Content
                </label>
                <textarea
                  required
                  rows={6}
                  placeholder="Paste the reference document text, paper abstract, or chapter excerpt here..."
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  className="w-full p-3.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none font-mono text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting} className="gap-2">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Chunking & Embedding...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Ingest into Database
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Preview Modal */}
      {viewingDoc && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0d121f] rounded-xl max-w-2xl w-full p-6 space-y-5 shadow-lg border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 mb-1 inline-block">
                  {viewingDoc.category}
                </span>
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  {viewingDoc.title}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  By {viewingDoc.author} • {viewingDoc.institution}
                </p>
              </div>
              <button onClick={() => setViewingDoc(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Indexed Content ({viewingDoc.chunk_count} Chunks / {viewingDoc.word_count} Words)
              </label>
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-xs font-mono text-slate-700 dark:text-slate-300 max-h-80 overflow-y-auto leading-relaxed border border-slate-200 dark:border-slate-700">
                {viewingDoc.preview}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={() => setViewingDoc(null)}>
                Close Preview
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
