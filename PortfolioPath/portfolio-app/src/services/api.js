/**
 * ============================================================================
 * API SERVICE LAYER - FULL BACKEND INTEGRATION
 * ============================================================================
 * 
 * This service connects to the FastAPI backend for:
 * - Real-time stock data (via yfinance)
 * - Monte Carlo simulations (NumPy-powered backend)
 * - User authentication (JWT)
 * - Portfolio persistence (SQLite)
 * 
 * Backend: http://localhost:8000
 * 
 * ============================================================================
 */

// Configuration
const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  TIMEOUT: 30000,
};

// ============================================================================
// AUTH TOKEN MANAGEMENT
// ============================================================================

let authToken = localStorage.getItem('portfoliopath_token') || null;

export const setAuthToken = (token) => {
  authToken = token;
  if (token) {
    localStorage.setItem('portfoliopath_token', token);
  } else {
    localStorage.removeItem('portfoliopath_token');
  }
};

export const getAuthToken = () => authToken;

export const clearAuthToken = () => {
  authToken = null;
  localStorage.removeItem('portfoliopath_token');
};

// Helper for authenticated requests
const authHeaders = () => ({
  'Content-Type': 'application/json',
  ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
});

// ============================================================================
// AUTHENTICATION API
// ============================================================================

export const registerUser = async (email, password, username, fullName = '') => {
  const response = await fetch(`${API_CONFIG.BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      email, 
      password, 
      username: username || email.split('@')[0], // Use email prefix if no username
      full_name: fullName 
    }),
    signal: AbortSignal.timeout(API_CONFIG.TIMEOUT)
  });
  
  if (!response.ok) {
    const error = await response.json();
    // Handle validation errors
    if (error.detail && Array.isArray(error.detail)) {
      const messages = error.detail.map(d => d.msg).join(', ');
      throw new Error(messages);
    }
    throw new Error(error.detail || 'Registration failed');
  }
  
  return response.json();
};

export const loginUser = async (email, password) => {
  const response = await fetch(`${API_CONFIG.BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    signal: AbortSignal.timeout(API_CONFIG.TIMEOUT)
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Login failed');
  }
  
  const data = await response.json();
  setAuthToken(data.access_token);
  return data;
};

export const logoutUser = () => {
  clearAuthToken();
};

export const getCurrentUser = async () => {
  if (!authToken) throw new Error('Not authenticated');
  
  const response = await fetch(`${API_CONFIG.BASE_URL}/api/auth/me`, {
    headers: authHeaders(),
    signal: AbortSignal.timeout(API_CONFIG.TIMEOUT)
  });
  
  if (!response.ok) {
    if (response.status === 401) {
      clearAuthToken();
      throw new Error('Session expired');
    }
    throw new Error('Failed to get user profile');
  }
  
  return response.json();
};

export const isAuthenticated = () => !!authToken;

// ============================================================================
// STOCK DATA API
// ============================================================================

export const fetchStockQuote = async (ticker) => {
  try {
    const response = await fetch(`${API_CONFIG.BASE_URL}/api/stocks/quote/${ticker}`, {
      signal: AbortSignal.timeout(API_CONFIG.TIMEOUT)
    });
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Ticker "${ticker}" not found. Please check the symbol.`);
      }
      throw new Error(`Failed to fetch ${ticker}: ${response.statusText}`);
    }
    const data = await response.json();
    return { ...data, timestamp: Date.now() };
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`Request timed out while fetching ${ticker}. Please try again.`);
    }
    throw error;
  }
};

export const fetchBatchQuotes = async (tickers) => {
  try {
    const response = await fetch(`${API_CONFIG.BASE_URL}/api/stocks/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tickers: tickers }),
      signal: AbortSignal.timeout(API_CONFIG.TIMEOUT)
    });
    if (!response.ok) {
      if (response.status === 400) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || 'Invalid request. Please check your ticker symbols.');
      }
      throw new Error(`Failed to fetch quotes: ${response.statusText}`);
    }
    const data = await response.json();
    return data.quotes || {};
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Request timed out while fetching quotes. Please try again.');
    }
    throw error;
  }
};

export const fetchHistoricalData = async (ticker, period = '5y', targetDays = null) => {
  try {
    let url = `${API_CONFIG.BASE_URL}/api/stocks/historical/${ticker}?period=${period}`;
    if (targetDays) {
      url += `&target_days=${targetDays}`;
    }
    const response = await fetch(
      url,
      { signal: AbortSignal.timeout(API_CONFIG.TIMEOUT) }
    );
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Historical data not available for "${ticker}".`);
      }
      throw new Error(`Failed to fetch historical data for ${ticker}: ${response.statusText}`);
    }
    return response.json();
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`Request timed out while fetching historical data for ${ticker}. Please try again.`);
    }
    throw error;
  }
};

export const fetchAssetParameters = async (ticker, targetDays = 252) => {
  try {
    const data = await fetchHistoricalData(ticker, 'max', targetDays);
    return { 
      mean: data.statistics?.mean_return || 0.0003, 
      vol: data.statistics?.volatility || 0.015, 
      name: data.ticker,
      sharpeRatio: data.statistics?.sharpe_ratio || 0,
      maxDrawdown: data.statistics?.max_drawdown || 0,
      totalReturn: data.statistics?.total_return || 0,
      dataPoints: data.statistics?.data_points || 0,
      weighted: data.statistics?.weighted || false
    };
  } catch {
    return { mean: 0.0003, vol: 0.015, name: ticker.toUpperCase() };
  }
};

export const validateTicker = async (ticker) => {
  try {
    const response = await fetch(`${API_CONFIG.BASE_URL}/api/stocks/validate/${ticker}`);
    if (!response.ok) return false;
    const data = await response.json();
    return data.valid === true;
  } catch {
    return false;
  }
};

export const searchTickers = async (query) => {
  try {
    const response = await fetch(
      `${API_CONFIG.BASE_URL}/api/stocks/search?q=${encodeURIComponent(query)}`,
      { signal: AbortSignal.timeout(API_CONFIG.TIMEOUT) }
    );
    if (!response.ok) return [];
    return response.json();
  } catch {
    return [];
  }
};

export const fetchCorrelationMatrix = async (tickers) => {
  try {
    const response = await fetch(`${API_CONFIG.BASE_URL}/api/stocks/correlation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tickers: tickers, period: '5y' }),
      signal: AbortSignal.timeout(API_CONFIG.TIMEOUT)
    });
    if (!response.ok) throw new Error('Failed to fetch correlation matrix');
    const data = await response.json();
    return data.matrix || data;
  } catch {
    const n = tickers.length;
    const matrix = Array(n).fill(0).map(() => Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        matrix[i][j] = i === j ? 1 : 0.5;
      }
    }
    return matrix;
  }
};

// ============================================================================
// MONTE CARLO SIMULATION API
// ============================================================================

export const runSimulation = async ({
  holdings,
  initialInvestment = 10000,
  monthlyContribution = 0,
  timeHorizon = 10,
  numSimulations = 1000,
  includeDividends = true,
  dividendYield = null,
  includeJumpDiffusion = false,
  jumpProbability = 0.05,
  jumpMean = -0.1,
  jumpStd = 0.15
}) => {
  const response = await fetch(`${API_CONFIG.BASE_URL}/api/simulation/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      holdings: holdings.map(h => ({
        ticker: h.ticker,
        allocation: h.allocation
      })),
      initial_investment: initialInvestment,
      monthly_contribution: monthlyContribution,
      time_horizon: timeHorizon,
      num_simulations: numSimulations,
      include_dividends: includeDividends,
      dividend_yield: dividendYield,
      include_jump_diffusion: includeJumpDiffusion,
      jump_probability: jumpProbability,
      jump_mean: jumpMean,
      jump_std: jumpStd
    }),
    signal: AbortSignal.timeout(60000)
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Simulation failed' }));
    throw new Error(error.detail || 'Simulation failed');
  }
  
  return response.json();
};

export const comparePortfolios = async (portfolioA, portfolioB) => {
  const response = await fetch(`${API_CONFIG.BASE_URL}/api/simulation/compare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      portfolio_a: portfolioA,
      portfolio_b: portfolioB
    }),
    signal: AbortSignal.timeout(120000)
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Comparison failed');
  }
  
  return response.json();
};

export const generateEfficientFrontier = async (tickers, numPortfolios = 100) => {
  const response = await fetch(
    `${API_CONFIG.BASE_URL}/api/simulation/efficient-frontier?num_portfolios=${numPortfolios}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tickers),
      signal: AbortSignal.timeout(60000)
    }
  );
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to generate efficient frontier');
  }
  
  return response.json();
};

export const calculateGoalProbability = async (simulationParams, targetAmount) => {
  const response = await fetch(
    `${API_CONFIG.BASE_URL}/api/simulation/goal-probability?target_amount=${targetAmount}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(simulationParams),
      signal: AbortSignal.timeout(60000)
    }
  );
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to calculate goal probability');
  }
  
  return response.json();
};

// ============================================================================
// PORTFOLIO PERSISTENCE API
// ============================================================================

export const savePortfolio = async (portfolioData) => {
  if (!authToken) {
    const saved = localStorage.getItem('portfoliopath_portfolios');
    const portfolios = saved ? JSON.parse(saved) : [];
    const newPortfolio = { 
      id: `local_${Date.now()}`, 
      ...portfolioData, 
      savedAt: new Date().toISOString() 
    };
    portfolios.push(newPortfolio);
    localStorage.setItem('portfoliopath_portfolios', JSON.stringify(portfolios));
    return newPortfolio;
  }
  
  const response = await fetch(`${API_CONFIG.BASE_URL}/api/portfolios`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      name: portfolioData.name,
      description: portfolioData.description || '',
      initial_investment: portfolioData.initialInvestment || 10000,
      monthly_contribution: portfolioData.monthlyContribution || 0,
      time_horizon: portfolioData.timeHorizon || 10,
      holdings: portfolioData.holdings || [],
      simulation_config: portfolioData.simulationConfig || {}
    }),
    signal: AbortSignal.timeout(API_CONFIG.TIMEOUT)
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to save portfolio');
  }
  
  return response.json();
};

export const loadPortfolios = async () => {
  if (!authToken) {
    const saved = localStorage.getItem('portfoliopath_portfolios');
    return saved ? JSON.parse(saved) : [];
  }
  
  const response = await fetch(`${API_CONFIG.BASE_URL}/api/portfolios`, {
    headers: authHeaders(),
    signal: AbortSignal.timeout(API_CONFIG.TIMEOUT)
  });
  
  if (!response.ok) {
    if (response.status === 401) {
      clearAuthToken();
      const saved = localStorage.getItem('portfoliopath_portfolios');
      return saved ? JSON.parse(saved) : [];
    }
    throw new Error('Failed to load portfolios');
  }
  
  return response.json();
};

export const getPortfolio = async (portfolioId) => {
  if (!authToken) throw new Error('Not authenticated');
  
  const response = await fetch(`${API_CONFIG.BASE_URL}/api/portfolios/${portfolioId}`, {
    headers: authHeaders(),
    signal: AbortSignal.timeout(API_CONFIG.TIMEOUT)
  });
  
  if (!response.ok) throw new Error('Portfolio not found');
  return response.json();
};

export const updatePortfolio = async (portfolioId, updates) => {
  if (!authToken) throw new Error('Not authenticated');
  
  const response = await fetch(`${API_CONFIG.BASE_URL}/api/portfolios/${portfolioId}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(updates),
    signal: AbortSignal.timeout(API_CONFIG.TIMEOUT)
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to update portfolio');
  }
  
  return response.json();
};

export const deletePortfolio = async (portfolioId) => {
  if (!authToken || String(portfolioId).startsWith('local_')) {
    const saved = localStorage.getItem('portfoliopath_portfolios');
    if (saved) {
      const portfolios = JSON.parse(saved);
      const filtered = portfolios.filter(p => p.id !== portfolioId);
      localStorage.setItem('portfoliopath_portfolios', JSON.stringify(filtered));
    }
    return;
  }
  
  const response = await fetch(`${API_CONFIG.BASE_URL}/api/portfolios/${portfolioId}`, {
    method: 'DELETE',
    headers: authHeaders(),
    signal: AbortSignal.timeout(API_CONFIG.TIMEOUT)
  });
  
  if (!response.ok && response.status !== 204) {
    throw new Error('Failed to delete portfolio');
  }
};

export const duplicatePortfolio = async (portfolioId, newName = null) => {
  if (!authToken) throw new Error('Not authenticated');
  
  const url = new URL(`${API_CONFIG.BASE_URL}/api/portfolios/${portfolioId}/duplicate`);
  if (newName) url.searchParams.set('new_name', newName);
  
  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: authHeaders(),
    signal: AbortSignal.timeout(API_CONFIG.TIMEOUT)
  });
  
  if (!response.ok) throw new Error('Failed to duplicate portfolio');
  return response.json();
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export const checkApiHealth = async () => {
  try {
    const response = await fetch(`${API_CONFIG.BASE_URL}/health`, {
      signal: AbortSignal.timeout(5000)
    });
    return response.ok;
  } catch {
    return false;
  }
};

export const getApiConfig = () => ({
  baseUrl: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  isConnected: true
});

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default {
  // Auth
  registerUser, loginUser, logoutUser, getCurrentUser, isAuthenticated,
  setAuthToken, getAuthToken, clearAuthToken,
  
  // Stock Data
  fetchStockQuote, fetchBatchQuotes, fetchHistoricalData, fetchAssetParameters,
  validateTicker, searchTickers, fetchCorrelationMatrix,
  
  // Simulation
  runSimulation, comparePortfolios, generateEfficientFrontier, calculateGoalProbability,
  
  // Portfolios
  savePortfolio, loadPortfolios, getPortfolio, updatePortfolio, deletePortfolio, duplicatePortfolio,
  
  // Utility
  checkApiHealth, getApiConfig
};
