/**
 * Portfolio Constants and Configuration
 * 
 * This module contains static data for assets, presets, and scenarios
 * used throughout the application.
 */

// ============================================================================
// ASSET DATABASE
// ============================================================================

export const assetDatabase = {
  'SPY': { mean: 0.0003, vol: 0.01, name: 'S&P 500 ETF' },
  'QQQ': { mean: 0.0004, vol: 0.015, name: 'Nasdaq 100 ETF' },
  'AAPL': { mean: 0.0005, vol: 0.018, name: 'Apple Inc.' },
  'MSFT': { mean: 0.0004, vol: 0.016, name: 'Microsoft Corp.' },
  'GOOGL': { mean: 0.0004, vol: 0.017, name: 'Alphabet Inc.' },
  'TSLA': { mean: 0.0006, vol: 0.035, name: 'Tesla Inc.' },
  'VTI': { mean: 0.0003, vol: 0.01, name: 'Total Stock Market ETF' },
  'BND': { mean: 0.0001, vol: 0.004, name: 'Bond Index ETF' },
  'GLD': { mean: 0.0002, vol: 0.012, name: 'Gold ETF' },
  'IWM': { mean: 0.0003, vol: 0.016, name: 'Small Cap ETF' },
  'TLT': { mean: 0.00015, vol: 0.012, name: '20+ Year Treasury Bond ETF' },
  'VWO': { mean: 0.00035, vol: 0.018, name: 'Emerging Markets ETF' },
  'VEA': { mean: 0.00025, vol: 0.014, name: 'Developed Markets ETF' },
  'JNJ': { mean: 0.00025, vol: 0.011, name: 'Johnson & Johnson' },
  'PG': { mean: 0.00022, vol: 0.010, name: 'Procter & Gamble' },
  'META': { mean: 0.0005, vol: 0.025, name: 'Meta Platforms' },
  'NVDA': { mean: 0.0007, vol: 0.030, name: 'NVIDIA Corp.' },
};

// ============================================================================
// PRESET PORTFOLIO TEMPLATES
// ============================================================================

export const PRESET_PORTFOLIOS = {
  'classic_60_40': {
    name: 'Classic 60/40',
    description: 'Traditional balanced portfolio',
    portfolio: [
      { ticker: 'SPY', weight: 0.6 },
      { ticker: 'BND', weight: 0.4 }
    ],
    risk: 'Moderate'
  },
  'aggressive_growth': {
    name: 'Aggressive Growth',
    description: 'High risk, high reward tech focus',
    portfolio: [
      { ticker: 'QQQ', weight: 0.5 },
      { ticker: 'AAPL', weight: 0.2 },
      { ticker: 'TSLA', weight: 0.15 },
      { ticker: 'NVDA', weight: 0.15 }
    ],
    risk: 'High'
  },
  'conservative': {
    name: 'Conservative',
    description: 'Capital preservation focus',
    portfolio: [
      { ticker: 'BND', weight: 0.5 },
      { ticker: 'SPY', weight: 0.3 },
      { ticker: 'GLD', weight: 0.2 }
    ],
    risk: 'Low'
  },
  'all_weather': {
    name: 'All Weather',
    description: 'Ray Dalio inspired diversification',
    portfolio: [
      { ticker: 'SPY', weight: 0.3 },
      { ticker: 'TLT', weight: 0.4 },
      { ticker: 'GLD', weight: 0.15 },
      { ticker: 'VWO', weight: 0.15 }
    ],
    risk: 'Moderate'
  },
  'dividend_income': {
    name: 'Dividend Income',
    description: 'Stable dividend-paying stocks',
    portfolio: [
      { ticker: 'VTI', weight: 0.4 },
      { ticker: 'JNJ', weight: 0.2 },
      { ticker: 'PG', weight: 0.2 },
      { ticker: 'BND', weight: 0.2 }
    ],
    risk: 'Low-Moderate'
  },
  'tech_heavy': {
    name: 'Tech Heavy',
    description: 'Technology sector concentration',
    portfolio: [
      { ticker: 'QQQ', weight: 0.4 },
      { ticker: 'MSFT', weight: 0.2 },
      { ticker: 'GOOGL', weight: 0.2 },
      { ticker: 'META', weight: 0.2 }
    ],
    risk: 'High'
  },
  'global_diversified': {
    name: 'Global Diversified',
    description: 'International exposure',
    portfolio: [
      { ticker: 'VTI', weight: 0.4 },
      { ticker: 'VEA', weight: 0.3 },
      { ticker: 'VWO', weight: 0.2 },
      { ticker: 'BND', weight: 0.1 }
    ],
    risk: 'Moderate'
  }
};

// ============================================================================
// STRESS TEST SCENARIOS
// ============================================================================

export const STRESS_SCENARIOS = {
  '2008_crash': {
    name: '2008 Financial Crisis',
    description: 'Simulate market conditions during the 2008 crash',
    modifier: { recession: true },
    icon: '📉'
  },
  'covid_crash': {
    name: 'COVID-19 Crash',
    description: 'March 2020 style rapid drawdown',
    modifier: { volatilitySpike: true, recession: true },
    icon: '🦠'
  },
  'bull_run': {
    name: '2021 Bull Market',
    description: 'Post-pandemic recovery rally',
    modifier: { bullMarket: true },
    icon: '🐂'
  },
  'stagflation': {
    name: 'Stagflation',
    description: '1970s style inflation + stagnation',
    modifier: { recession: true, volatilitySpike: true },
    icon: '📊'
  },
  'normal': {
    name: 'Normal Conditions',
    description: 'Typical market environment',
    modifier: {},
    icon: '📈'
  }
};

// ============================================================================
// DEFAULT VALUES
// ============================================================================

export const DEFAULT_PORTFOLIO = [
  { ticker: 'SPY', weight: 0.6 },
  { ticker: 'BND', weight: 0.4 }
];

export const DEFAULT_COMPARISON_PORTFOLIO = [
  { ticker: 'QQQ', weight: 0.7 },
  { ticker: 'GLD', weight: 0.3 }
];

export const DEFAULT_ADVANCED_OPTIONS = {
  useCorrelation: true,
  useFatTails: true,
  useGARCH: true,
  useRegimeSwitching: true,
  useJumpDiffusion: true,
  useMeanReversion: false
};

// ============================================================================
// CHART COLORS
// ============================================================================

export const CHART_COLORS = {
  primary: ['#e11d48', '#f43f5e', '#fb7185', '#fda4af', '#10b981', '#3b82f6', '#8b5cf6', '#f59e0b'],
  comparison: ['#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#10b981', '#8b5cf6', '#f59e0b', '#e11d48'],
};

// ============================================================================
// CORRELATION MATRIX GENERATOR
// ============================================================================

/**
 * Generate correlation matrix based on asset types
 * @param {string[]} tickers - Array of ticker symbols
 * @returns {number[][]} Correlation matrix
 */
export const generateCorrelationMatrix = (tickers) => {
  const n = tickers.length;
  const matrix = Array(n).fill(0).map(() => Array(n).fill(0));
  
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) {
        matrix[i][j] = 1;
      } else {
        const t1 = tickers[i];
        const t2 = tickers[j];
        
        // Equities correlate highly with each other
        if (['SPY', 'QQQ', 'VTI', 'IWM'].includes(t1) && 
            ['SPY', 'QQQ', 'VTI', 'IWM'].includes(t2)) {
          matrix[i][j] = 0.85;
        }
        // Tech stocks correlate highly
        else if (['AAPL', 'MSFT', 'GOOGL', 'QQQ', 'META', 'NVDA'].includes(t1) && 
                 ['AAPL', 'MSFT', 'GOOGL', 'QQQ', 'META', 'NVDA'].includes(t2)) {
          matrix[i][j] = 0.75;
        }
        // Bonds negatively correlate with stocks
        else if ((t1 === 'BND' && t2 !== 'GLD') || (t2 === 'BND' && t1 !== 'GLD')) {
          matrix[i][j] = -0.3;
        }
        // Gold has low correlation
        else if (t1 === 'GLD' || t2 === 'GLD') {
          matrix[i][j] = 0.1;
        }
        // TSLA is volatile and less correlated
        else if (t1 === 'TSLA' || t2 === 'TSLA') {
          matrix[i][j] = 0.5;
        }
        else {
          matrix[i][j] = 0.6;
        }
      }
    }
  }
  return matrix;
};
