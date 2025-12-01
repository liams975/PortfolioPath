import React, { useState } from 'react';
import { Save, FolderOpen, Trash2, Calendar, Target, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const SavedPortfolios = ({ onLoadPortfolio, currentPortfolio, onClose }) => {
  const { getPortfolios, deletePortfolio, savePortfolio } = useAuth();
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [portfolioName, setPortfolioName] = useState('');
  const [saveError, setSaveError] = useState('');
  
  const savedPortfolios = getPortfolios();

  const handleSave = () => {
    if (!portfolioName.trim()) {
      setSaveError('Please enter a portfolio name');
      return;
    }

    const result = savePortfolio({
      name: portfolioName,
      ...currentPortfolio
    });

    if (result.success) {
      setShowSaveDialog(false);
      setPortfolioName('');
      setSaveError('');
    } else {
      setSaveError(result.error);
    }
  };

  const handleDelete = (portfolioId) => {
    if (window.confirm('Delete this portfolio?')) {
      deletePortfolio(portfolioId);
    }
  };

  const handleLoad = (portfolio) => {
    onLoadPortfolio(portfolio.data);
    onClose();
  };

  return (
    <div className="bg-zinc-900/50 backdrop-blur-xl rounded-xl p-5 border border-zinc-800/50 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold flex items-center gap-2 text-zinc-200">
          <FolderOpen className="w-4 h-4 text-rose-400" />
          Saved Portfolios
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowSaveDialog(true)}
            className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-all text-xs font-medium flex items-center gap-1.5 border border-zinc-700/50"
          >
            <Save className="w-3 h-3" />
            Save
          </button>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-zinc-800 rounded-lg transition-all"
          >
            <X className="w-4 h-4 text-zinc-400" />
          </button>
        </div>
      </div>

      {showSaveDialog && (
        <div className="bg-zinc-800/50 rounded-lg p-4 mb-4 border border-zinc-700/50">
          <input
            type="text"
            value={portfolioName}
            onChange={(e) => setPortfolioName(e.target.value)}
            placeholder="Portfolio name..."
            className="w-full bg-zinc-900/50 border border-zinc-700/50 rounded-lg px-3 py-2 text-zinc-100 placeholder-zinc-600 focus:ring-1 focus:ring-rose-500/50 focus:border-rose-500/50 focus:outline-none text-sm mb-3"
            autoFocus
          />
          {saveError && <p className="text-red-400 text-xs mb-3">{saveError}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 rounded-lg transition-colors text-sm font-medium"
            >
              Save
            </button>
            <button
              onClick={() => { setShowSaveDialog(false); setSaveError(''); setPortfolioName(''); }}
              className="flex-1 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg transition-colors text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {savedPortfolios.length === 0 ? (
        <div className="text-center py-6 text-zinc-500">
          <FolderOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-xs">No saved portfolios</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {savedPortfolios.map((portfolio) => (
            <div
              key={portfolio.id}
              className="bg-zinc-800/30 rounded-lg p-3 border border-zinc-700/30 hover:border-zinc-600/50 transition-all group flex items-center justify-between"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Target className="w-3 h-3 text-rose-400 flex-shrink-0" />
                  <span className="text-sm font-medium text-zinc-200 truncate">{portfolio.name}</span>
                </div>
                <div className="flex gap-3 mt-1 text-xs text-zinc-500">
                  <span>${portfolio.data.initialValue?.toLocaleString()}</span>
                  <span>{portfolio.data.portfolio?.length || 0} assets</span>
                  <span>{portfolio.data.timeHorizon}d</span>
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => handleLoad(portfolio)}
                  className="px-2 py-1 text-xs bg-zinc-700/50 hover:bg-rose-900/50 rounded transition-all text-zinc-300"
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
