import React, { useState, useEffect, useCallback } from 'react';
import { Check, X, Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import { validateTicker, fetchStockQuote } from '../services/api';

// Fallback stock database for offline mode
const STOCK_DATABASE = {
  // Major Indices & ETFs
  'SPY': { name: 'SPDR S&P 500 ETF', price: 478.32, change: 0.45, sector: 'Index' },
  'QQQ': { name: 'Invesco QQQ Trust', price: 405.87, change: 0.72, sector: 'Index' },
  'DIA': { name: 'SPDR Dow Jones ETF', price: 389.45, change: 0.32, sector: 'Index' },
  'VTI': { name: 'Vanguard Total Stock', price: 235.89, change: 0.67, sector: 'Index' },
  'IWM': { name: 'iShares Russell 2000', price: 198.45, change: 0.23, sector: 'Index' },
  'VOO': { name: 'Vanguard S&P 500 ETF', price: 438.92, change: 0.48, sector: 'Index' },
  'VEA': { name: 'Vanguard FTSE Developed', price: 48.23, change: -0.12, sector: 'International' },
  'VWO': { name: 'Vanguard Emerging Markets', price: 42.67, change: -0.34, sector: 'International' },
  'EFA': { name: 'iShares MSCI EAFE', price: 76.89, change: 0.21, sector: 'International' },
  'EEM': { name: 'iShares Emerging Markets', price: 39.45, change: -0.56, sector: 'International' },
  
  // Tech Giants
  'AAPL': { name: 'Apple Inc.', price: 189.95, change: -0.23, sector: 'Technology' },
  'MSFT': { name: 'Microsoft Corp.', price: 378.91, change: 0.89, sector: 'Technology' },
  'GOOGL': { name: 'Alphabet Inc. Class A', price: 141.80, change: 0.34, sector: 'Technology' },
  'GOOG': { name: 'Alphabet Inc. Class C', price: 142.56, change: 0.38, sector: 'Technology' },
  'AMZN': { name: 'Amazon.com Inc.', price: 178.25, change: 1.12, sector: 'Consumer' },
  'TSLA': { name: 'Tesla Inc.', price: 238.45, change: -1.87, sector: 'Automotive' },
  'NVDA': { name: 'NVIDIA Corp.', price: 495.22, change: 2.34, sector: 'Technology' },
  'META': { name: 'Meta Platforms Inc.', price: 325.48, change: 0.56, sector: 'Technology' },
  'NFLX': { name: 'Netflix Inc.', price: 478.90, change: 1.23, sector: 'Technology' },
  'ADBE': { name: 'Adobe Inc.', price: 548.32, change: 0.67, sector: 'Technology' },
  'CRM': { name: 'Salesforce Inc.', price: 267.89, change: 0.45, sector: 'Technology' },
  'ORCL': { name: 'Oracle Corp.', price: 118.45, change: 0.78, sector: 'Technology' },
  'AMD': { name: 'Advanced Micro Devices', price: 124.67, change: 1.56, sector: 'Technology' },
  'INTC': { name: 'Intel Corp.', price: 45.23, change: -0.89, sector: 'Technology' },
  'CSCO': { name: 'Cisco Systems', price: 52.34, change: 0.23, sector: 'Technology' },
  'AVGO': { name: 'Broadcom Inc.', price: 892.45, change: 1.12, sector: 'Technology' },
  
  // Finance
  'JPM': { name: 'JPMorgan Chase', price: 167.89, change: 0.56, sector: 'Financial' },
  'BAC': { name: 'Bank of America', price: 34.56, change: 0.34, sector: 'Financial' },
  'WFC': { name: 'Wells Fargo', price: 45.78, change: 0.23, sector: 'Financial' },
  'GS': { name: 'Goldman Sachs', price: 378.90, change: 0.89, sector: 'Financial' },
  'MS': { name: 'Morgan Stanley', price: 89.45, change: 0.45, sector: 'Financial' },
  'V': { name: 'Visa Inc.', price: 267.34, change: 0.67, sector: 'Financial' },
  'MA': { name: 'Mastercard Inc.', price: 423.56, change: 0.78, sector: 'Financial' },
  'BRK.B': { name: 'Berkshire Hathaway B', price: 356.78, change: 0.34, sector: 'Financial' },
  'XLF': { name: 'Financial Select SPDR', price: 38.67, change: 0.34, sector: 'Financial' },
  
  // Healthcare
  'JNJ': { name: 'Johnson & Johnson', price: 156.78, change: 0.12, sector: 'Healthcare' },
  'UNH': { name: 'UnitedHealth Group', price: 534.56, change: 0.45, sector: 'Healthcare' },
  'PFE': { name: 'Pfizer Inc.', price: 28.90, change: -0.34, sector: 'Healthcare' },
  'MRK': { name: 'Merck & Co.', price: 112.34, change: 0.23, sector: 'Healthcare' },
  'ABBV': { name: 'AbbVie Inc.', price: 167.89, change: 0.56, sector: 'Healthcare' },
  'LLY': { name: 'Eli Lilly', price: 589.45, change: 1.23, sector: 'Healthcare' },
  'XLV': { name: 'Health Care Select SPDR', price: 134.56, change: -0.12, sector: 'Healthcare' },
  
  // Consumer
  'WMT': { name: 'Walmart Inc.', price: 156.78, change: 0.34, sector: 'Consumer' },
  'COST': { name: 'Costco Wholesale', price: 567.89, change: 0.56, sector: 'Consumer' },
  'HD': { name: 'Home Depot', price: 345.67, change: 0.45, sector: 'Consumer' },
  'MCD': { name: 'McDonald\'s Corp.', price: 289.45, change: 0.23, sector: 'Consumer' },
  'NKE': { name: 'Nike Inc.', price: 98.34, change: -0.45, sector: 'Consumer' },
  'SBUX': { name: 'Starbucks Corp.', price: 98.67, change: 0.34, sector: 'Consumer' },
  'DIS': { name: 'Walt Disney Co.', price: 89.45, change: 0.67, sector: 'Consumer' },
  'KO': { name: 'Coca-Cola Co.', price: 58.90, change: 0.12, sector: 'Consumer' },
  'PEP': { name: 'PepsiCo Inc.', price: 168.45, change: 0.23, sector: 'Consumer' },
  'PG': { name: 'Procter & Gamble', price: 156.78, change: 0.34, sector: 'Consumer' },
  
  // Energy
  'XOM': { name: 'Exxon Mobil', price: 108.45, change: 0.89, sector: 'Energy' },
  'CVX': { name: 'Chevron Corp.', price: 156.78, change: 0.67, sector: 'Energy' },
  'COP': { name: 'ConocoPhillips', price: 118.34, change: 0.78, sector: 'Energy' },
  'XLE': { name: 'Energy Select SPDR', price: 89.12, change: 1.23, sector: 'Energy' },
  
  // Bonds & Fixed Income
  'BND': { name: 'Vanguard Bond ETF', price: 72.45, change: 0.12, sector: 'Bonds' },
  'TLT': { name: 'iShares 20+ Year Treasury', price: 92.34, change: 0.56, sector: 'Bonds' },
  'AGG': { name: 'iShares Core US Aggregate', price: 98.12, change: 0.08, sector: 'Bonds' },
  'LQD': { name: 'iShares Investment Grade', price: 108.45, change: 0.15, sector: 'Bonds' },
  'HYG': { name: 'iShares High Yield Corp', price: 76.89, change: 0.23, sector: 'Bonds' },
  'TIP': { name: 'iShares TIPS Bond', price: 108.34, change: 0.18, sector: 'Bonds' },
  
  // Real Estate
  'VNQ': { name: 'Vanguard Real Estate', price: 82.34, change: -0.45, sector: 'Real Estate' },
  'IYR': { name: 'iShares US Real Estate', price: 89.45, change: -0.34, sector: 'Real Estate' },
  
  // Commodities
  'GLD': { name: 'SPDR Gold Trust', price: 185.67, change: -0.34, sector: 'Commodities' },
  'SLV': { name: 'iShares Silver Trust', price: 22.45, change: 0.56, sector: 'Commodities' },
  'USO': { name: 'United States Oil Fund', price: 78.90, change: 1.23, sector: 'Commodities' },
  'DBC': { name: 'Invesco DB Commodity', price: 23.45, change: 0.45, sector: 'Commodities' },
  
  // Sector ETFs
  'XLK': { name: 'Technology Select SPDR', price: 178.90, change: 0.89, sector: 'Technology' },
  'XLY': { name: 'Consumer Discretionary SPDR', price: 167.45, change: 0.56, sector: 'Consumer' },
  'XLP': { name: 'Consumer Staples SPDR', price: 72.34, change: 0.23, sector: 'Consumer' },
  'XLI': { name: 'Industrial Select SPDR', price: 112.45, change: 0.45, sector: 'Industrial' },
  'XLB': { name: 'Materials Select SPDR', price: 87.89, change: 0.34, sector: 'Materials' },
  'XLU': { name: 'Utilities Select SPDR', price: 67.45, change: 0.12, sector: 'Utilities' },
  'XLRE': { name: 'Real Estate Select SPDR', price: 38.90, change: -0.23, sector: 'Real Estate' },
  
  // Crypto-adjacent
  'COIN': { name: 'Coinbase Global', price: 178.45, change: 2.34, sector: 'Technology' },
  'MSTR': { name: 'MicroStrategy', price: 456.78, change: 3.45, sector: 'Technology' },
};

// Fetch ticker info from backend API with fallback to local database
const fetchTickerInfo = async (ticker) => {
  const upperTicker = ticker.toUpperCase();
  
  try {
    // Try backend validation first
    const isValid = await validateTicker(upperTicker);
    
    if (isValid) {
      // Fetch real quote from backend
      try {
        const quote = await fetchStockQuote(upperTicker);
        if (quote && quote.price) {
          return {
            valid: true,
            name: quote.name || quote.longName || upperTicker,
            price: quote.price,
            change: quote.changePercent || 0,
            sector: quote.sector || 'Unknown'
          };
        }
      } catch (quoteError) {
        console.warn('Failed to fetch quote, using validation only:', quoteError);
        // If validation passed but quote fetch failed, still return valid
        return {
          valid: true,
          name: upperTicker,
          price: 0,
          change: 0,
          sector: 'Unknown'
        };
      }
    }
    
    // Backend validation failed, try local database as fallback
    if (STOCK_DATABASE[upperTicker]) {
      return { valid: true, ...STOCK_DATABASE[upperTicker] };
    }
    
    return { valid: false };
  } catch (error) {
    // Backend unavailable, use local database as fallback
    console.warn('Backend validation failed, using local database:', error);
    if (STOCK_DATABASE[upperTicker]) {
      return { valid: true, ...STOCK_DATABASE[upperTicker] };
    }
    return { valid: false };
  }
};

export const useTickerValidation = (ticker, debounceMs = 500) => {
  const [status, setStatus] = useState('idle'); // idle, loading, valid, invalid
  const [data, setData] = useState(null);

  const validate = useCallback(async () => {
    if (!ticker || ticker.length < 1) {
      setStatus('idle');
      setData(null);
      return;
    }

    setStatus('loading');
    try {
      const result = await fetchTickerInfo(ticker);
      if (result.valid) {
        setStatus('valid');
        setData(result);
      } else {
        setStatus('invalid');
        setData(null);
      }
    } catch (error) {
      setStatus('invalid');
      setData(null);
    }
  }, [ticker]);

  useEffect(() => {
    const timer = setTimeout(validate, debounceMs);
    return () => clearTimeout(timer);
  }, [validate, debounceMs]);

  return { status, data };
};

export const TickerInput = ({ 
  value, 
  onChange, 
  onRemove, 
  weight, 
  onWeightChange,
  isDark = true 
}) => {
  const { status, data } = useTickerValidation(value);

  const statusIcon = {
    idle: null,
    loading: <Loader2 className="w-4 h-4 text-zinc-400 animate-spin" />,
    valid: <Check className="w-4 h-4 text-emerald-400" />,
    invalid: <X className="w-4 h-4 text-red-400" />,
  };

  const borderColor = {
    idle: isDark ? 'border-zinc-700/50' : 'border-gray-300',
    loading: isDark ? 'border-zinc-600' : 'border-gray-400',
    valid: 'border-emerald-500/50',
    invalid: 'border-red-500/50',
  };

  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <div className="relative w-28">
          <input
            type="text"
            placeholder="TICKER"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={`w-full ${isDark ? 'bg-zinc-800/50' : 'bg-white'} border ${borderColor[status]} rounded-lg px-3 py-2 pr-8 ${isDark ? 'text-zinc-100 placeholder-zinc-600' : 'text-gray-900 placeholder-gray-400'} focus:ring-1 focus:ring-rose-500/50 focus:border-rose-500/50 focus:outline-none transition-all text-sm font-mono uppercase`}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            {statusIcon[status]}
          </div>
        </div>
        <div className="relative flex-1">
          <input
            type="number"
            placeholder="Weight %"
            value={weight ? (weight * 100).toFixed(0) : ''}
            onChange={(e) => {
              const pct = parseFloat(e.target.value) || 0;
              onWeightChange(Math.max(0, Math.min(100, pct)) / 100);
            }}
            min="0"
            max="100"
            step="1"
            className={`w-full ${isDark ? 'bg-zinc-800/50 border-zinc-700/50 text-zinc-100 placeholder-zinc-600' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'} border rounded-lg px-3 py-2 pr-8 focus:ring-1 focus:ring-rose-500/50 focus:border-rose-500/50 focus:outline-none transition-all text-sm font-mono`}
          />
          <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>%</span>
        </div>
        <button
          onClick={onRemove}
          className={`px-3 py-2 ${isDark ? 'bg-zinc-800 hover:bg-rose-900/50 text-zinc-400 hover:text-rose-400' : 'bg-gray-100 hover:bg-red-100 text-gray-500 hover:text-red-500'} rounded-lg transition-all text-sm`}
        >
          ✕
        </button>
      </div>
      
      {/* Price preview when valid */}
      {status === 'valid' && data && (
        <div className={`flex items-center gap-2 px-2 py-1 ${isDark ? 'bg-zinc-800/30' : 'bg-gray-50'} rounded text-xs`}>
          <span className={isDark ? 'text-zinc-400' : 'text-gray-500'}>{data.name}</span>
          <span className="mx-1">•</span>
          <span className={isDark ? 'text-zinc-200' : 'text-gray-700'} style={{ fontFamily: 'monospace' }}>${data.price.toFixed(2)}</span>
          <span className={`flex items-center gap-0.5 ${data.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {data.change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {data.change >= 0 ? '+' : ''}{data.change}%
          </span>
          <span className={`ml-auto ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>{data.sector}</span>
        </div>
      )}
      
      {status === 'invalid' && value.length > 0 && (
        <div className="text-xs text-red-400 px-2">
          Ticker not found. Try SPY, QQQ, AAPL, MSFT, etc.
        </div>
      )}
    </div>
  );
};

export default TickerInput;
