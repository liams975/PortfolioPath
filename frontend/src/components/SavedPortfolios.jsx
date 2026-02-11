/**
 * SavedPortfolios - Local storage based portfolio saving
 * 
 * Saves/loads portfolios to localStorage instead of a backend.
 */

import { useState, useEffect } from 'react';
import { Save, FolderOpen, Trash2, Target, X, Loader2 } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const STORAGE_KEY = 'portfoliopath_saved_portfolios';

const getStoredPortfolios = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const setStoredPortfolios = (portfolios) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(portfolios));
};

const SavedPortfolios = ({ onLoadPortfolio, currentPortfolio, onClose }) => {
  const { isDark, colors } = useTheme();
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [portfolioName, setPortfolioName] = useState('');
  const [saveError, setSaveError] = useState('');
  const [savedPortfolios, setSavedPortfolios] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Load portfolios on mount
  useEffect(() => {
    setLoading(true);
    const portfolios = getStoredPortfolios();
    setSavedPortfolios(portfolios);
    setLoading(false);
  }, []);

  const handleSave = () => {
    if (!portfolioName.trim()) {
      setSaveError('Please enter a portfolio name');
      return;
    }

    try {
      const portfolios = getStoredPortfolios();
      const newPortfolio = {
        id: Date.now().toString(),
        name: portfolioName.trim(),
        data: currentPortfolio,
        createdAt: new Date().toISOString(),
      };
      portfolios.push(newPortfolio);
      setStoredPortfolios(portfolios);
      setSavedPortfolios(portfolios);
      setShowSaveDialog(false);
      setPortfolioName('');
      setSaveError('');
    } catch (error) {
      setSaveError('Failed to save portfolio');
    }
  };

  const handleDelete = (portfolioId) => {
    if (window.confirm('Delete this portfolio?')) {
      const portfolios = getStoredPortfolios().filter(p => p.id !== portfolioId);
      setStoredPortfolios(portfolios);
      setSavedPortfolios(portfolios);
    }
  };

  const handleLoad = (portfolio) => {
    onLoadPortfolio(portfolio.data);
    onClose();
  };

  return (
    <div className={`${isDark ? 'bg-zinc-900/50 border-zinc-800/50' : 'bg-white/80 border-gray-200'} backdrop-blur-xl rounded-xl p-5 border mb-4`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className={`text-sm font-semibold flex items-center gap-2 ${colors.text}`}>
          <FolderOpen className="w-4 h-4 text-rose-400" />
          Saved Portfolios
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowSaveDialog(true)}
            className={`px-3 py-1.5 ${isDark ? 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700/50' : 'bg-gray-100 hover:bg-gray-200 border-gray-200'} rounded-lg transition-all text-xs font-medium flex items-center gap-1.5 border`}
          >
            <Save className="w-3 h-3" />
            Save Current
          </button>
          <button
            onClick={onClose}
            className={`p-1.5 ${isDark ? 'hover:bg-zinc-800' : 'hover:bg-gray-100'} rounded-lg transition-all`}
          >
            <X className={`w-4 h-4 ${colors.textMuted}`} />
          </button>
        </div>
      </div>

      {showSaveDialog && (
        <div className={`${isDark ? 'bg-zinc-800/50 border-zinc-700/50' : 'bg-gray-50 border-gray-200'} rounded-lg p-4 mb-4 border`}>
          <input
            type="text"
            value={portfolioName}
            onChange={(e) => setPortfolioName(e.target.value)}
            placeholder="Portfolio name..."
            className={`w-full ${isDark ? 'bg-zinc-900/50 border-zinc-700/50 text-zinc-100 placeholder-zinc-600' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'} border rounded-lg px-3 py-2 focus:ring-1 focus:ring-rose-500/50 focus:border-rose-500/50 focus:outline-none text-sm mb-3`}
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          />
          {saveError && <p className="text-red-400 text-xs mb-3">{saveError}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 rounded-lg transition-colors text-sm font-medium text-white"
            >
              Save
            </button>
            <button
              onClick={() => { setShowSaveDialog(false); setSaveError(''); setPortfolioName(''); }}
              className={`flex-1 py-2 ${isDark ? 'bg-zinc-700 hover:bg-zinc-600' : 'bg-gray-200 hover:bg-gray-300'} rounded-lg transition-colors text-sm`}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className={`text-center py-6 ${colors.textMuted}`}>
          <Loader2 className="w-6 h-6 mx-auto mb-2 animate-spin opacity-50" />
          <p className="text-xs">Loading portfolios...</p>
        </div>
      ) : savedPortfolios.length === 0 ? (
        <div className={`text-center py-6 ${colors.textMuted}`}>
          <FolderOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-xs">No saved portfolios yet</p>
          <p className="text-xs mt-1 opacity-70">Click "Save Current" to save your first portfolio</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {savedPortfolios.map((portfolio) => (
            <div
              key={portfolio.id}
              className={`${isDark ? 'bg-zinc-800/30 border-zinc-700/30 hover:border-zinc-600/50' : 'bg-gray-50 border-gray-200 hover:border-gray-300'} rounded-lg p-3 border transition-all group flex items-center justify-between`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Target className="w-3 h-3 text-rose-400 flex-shrink-0" />
                  <span className={`text-sm font-medium ${colors.text} truncate`}>{portfolio.name}</span>
                </div>
                <div className={`flex gap-3 mt-1 text-xs ${colors.textMuted}`}>
                  <span>${portfolio.data?.initialValue?.toLocaleString() || portfolio.data?.initialInvestment?.toLocaleString() || '10,000'}</span>
                  <span>{portfolio.data?.portfolio?.length || 0} assets</span>
                  <span>{portfolio.data?.timeHorizon || 252}d</span>
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => handleLoad(portfolio)}
                  className={`px-2 py-1 text-xs ${isDark ? 'bg-zinc-700/50 hover:bg-rose-900/50 text-zinc-300' : 'bg-gray-200 hover:bg-rose-100 text-gray-700'} rounded transition-all`}
                >
                  Load
                </button>
                <button
                  onClick={() => handleDelete(portfolio.id)}
                  className="p-1 hover:bg-red-900/50 rounded transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-3 h-3 text-red-400" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SavedPortfolios;
