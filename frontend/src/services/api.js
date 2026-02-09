/**
 * API Service - PortfolioPath Demo
 * 
 * Connects to the Vercel-hosted FastAPI backend for:
 * - Real-time stock data (via yfinance)
 * - Monte Carlo simulations
 */

const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  TIMEOUT: 30000,
};

const headers = () => ({ 'Content-Type': 'application/json' });

// ============================================================================
// HEALTH CHECK
// ============================================================================

export const checkApiHealth = async () => {
  try {
    const response = await fetch(`${API_CONFIG.BASE_URL}/api/health`, {
      signal: AbortSignal.timeout(5000)
    });
    return response.ok;
  } catch {
    return false;
  }
};

// ============================================================================
// STOCK DATA
// ============================================================================

export const getStockData = async (ticker, period = '1y') => {
  const response = await fetch(
    `${API_CONFIG.BASE_URL}/api/stocks/${ticker}?period=${period}`,
    { signal: AbortSignal.timeout(API_CONFIG.TIMEOUT) }
  );
  if (!response.ok) throw new Error(`Failed to fetch ${ticker}`);
  return response.json();
};

export const validateTicker = async (ticker) => {
  try {
    const response = await fetch(
      `${API_CONFIG.BASE_URL}/api/stocks/${ticker}/validate`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!response.ok) return { valid: false, ticker: ticker.toUpperCase() };
    return response.json();
  } catch {
    return { valid: false, ticker: ticker.toUpperCase() };
  }
};

export const getBatchStockData = async (tickers, period = '1y') => {
  const response = await fetch(`${API_CONFIG.BASE_URL}/api/stocks/batch`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(tickers),
    signal: AbortSignal.timeout(API_CONFIG.TIMEOUT)
  });
  if (!response.ok) throw new Error('Failed to fetch batch stock data');
  return response.json();
};

// ============================================================================
// SIMULATION
// ============================================================================

export const runSimulation = async (config) => {
  const response = await fetch(`${API_CONFIG.BASE_URL}/api/simulate`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      tickers: config.tickers,
      weights: config.weights,
      initial_value: config.initialValue || config.initial_value || 10000,
      time_horizon: config.timeHorizon || config.time_horizon || 252,
      num_simulations: config.numSimulations || config.num_simulations || 1000,
      use_garch: config.useGARCH || config.use_garch || false,
      use_regime_switching: config.useRegimeSwitching || config.use_regime_switching || false,
      use_jump_diffusion: config.useJumpDiffusion || config.use_jump_diffusion || false,
      monthly_contribution: config.monthlyContribution || config.monthly_contribution || 0,
    }),
    signal: AbortSignal.timeout(60000) // 60s for simulations
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Simulation failed' }));
    throw new Error(error.detail || 'Simulation failed');
  }
  
  return response.json();
};

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

const api = {
  checkApiHealth,
  getStockData,
  validateTicker,
  getBatchStockData,
  runSimulation,
};

export default api;
