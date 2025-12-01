/**
 * ============================================================================
 * API SERVICE LAYER
 * ============================================================================
 * 
 * This service abstracts all data fetching and external API calls.
 * Currently uses mock data, but designed for easy backend integration.
 * 
 * TO CONNECT TO REAL BACKEND:
 * 1. Update BASE_URL to your API endpoint
 * 2. Remove mock implementations
 * 3. Uncomment the real fetch calls
 * 
 * ============================================================================
 */

// Configuration - Update this when connecting to real backend
const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
  TIMEOUT: 30000,
  USE_MOCK: true, // Set to false when backend is ready
};

// ============================================================================
// MOCK DATA (Remove when backend is ready)
// ============================================================================

const MOCK_STOCK_DATA = {
  'SPY': { price: 450.25, change: 1.2, name: 'S&P 500 ETF', mean: 0.0003, vol: 0.01 },
  'QQQ': { price: 380.50, change: 2.1, name: 'Nasdaq 100 ETF', mean: 0.0004, vol: 0.015 },
  'AAPL': { price: 178.50, change: 0.8, name: 'Apple Inc.', mean: 0.0005, vol: 0.018 },
  'MSFT': { price: 378.25, change: 1.5, name: 'Microsoft Corp.', mean: 0.0004, vol: 0.016 },
  'GOOGL': { price: 141.80, change: -0.3, name: 'Alphabet Inc.', mean: 0.0004, vol: 0.017 },
  'TSLA': { price: 248.50, change: 3.2, name: 'Tesla Inc.', mean: 0.0006, vol: 0.035 },
  'VTI': { price: 235.75, change: 1.0, name: 'Total Stock Market ETF', mean: 0.0003, vol: 0.01 },
  'BND': { price: 72.50, change: -0.2, name: 'Bond Index ETF', mean: 0.0001, vol: 0.004 },
  'GLD': { price: 185.30, change: 0.5, name: 'Gold ETF', mean: 0.0002, vol: 0.012 },
  'IWM': { price: 198.25, change: 1.8, name: 'Small Cap ETF', mean: 0.0003, vol: 0.016 },
  'AMZN': { price: 178.25, change: 1.3, name: 'Amazon.com Inc.', mean: 0.0004, vol: 0.02 },
  'NVDA': { price: 495.50, change: 4.5, name: 'NVIDIA Corp.', mean: 0.0006, vol: 0.03 },
  'META': { price: 505.75, change: 2.8, name: 'Meta Platforms', mean: 0.0004, vol: 0.025 },
  'BRK.B': { price: 365.50, change: 0.6, name: 'Berkshire Hathaway', mean: 0.0003, vol: 0.012 },
  'JPM': { price: 175.25, change: 1.1, name: 'JPMorgan Chase', mean: 0.0003, vol: 0.015 },
  'V': { price: 275.50, change: 0.9, name: 'Visa Inc.', mean: 0.0003, vol: 0.014 },
  'GOOG': { price: 140.25, change: -0.2, name: 'Alphabet Class C', mean: 0.0004, vol: 0.017 },
  'NFLX': { price: 485.75, change: 2.5, name: 'Netflix Inc.', mean: 0.0004, vol: 0.028 },
  'DIS': { price: 95.25, change: -0.5, name: 'Walt Disney Co.', mean: 0.0002, vol: 0.02 },
  'AMD': { price: 125.50, change: 3.8, name: 'AMD Inc.', mean: 0.0005, vol: 0.032 },
  'INTC': { price: 45.25, change: -1.2, name: 'Intel Corp.', mean: 0.0001, vol: 0.022 },
  'VEA': { price: 48.50, change: 0.4, name: 'Developed Markets ETF', mean: 0.0002, vol: 0.011 },
  'VWO': { price: 42.25, change: 0.6, name: 'Emerging Markets ETF', mean: 0.0002, vol: 0.014 },
  'AGG': { price: 98.75, change: -0.1, name: 'Aggregate Bond ETF', mean: 0.0001, vol: 0.003 },
  'TLT': { price: 92.50, change: -0.4, name: 'Long-Term Treasury ETF', mean: 0.0001, vol: 0.012 },
  'XOM': { price: 105.25, change: 0.8, name: 'Exxon Mobil', mean: 0.0002, vol: 0.018 },
  'JNJ': { price: 158.50, change: 0.3, name: 'Johnson & Johnson', mean: 0.0002, vol: 0.01 },
  'WMT': { price: 165.75, change: 0.5, name: 'Walmart Inc.', mean: 0.0002, vol: 0.012 },
  'PG': { price: 155.25, change: 0.4, name: 'Procter & Gamble', mean: 0.0002, vol: 0.01 },
  'UNH': { price: 545.50, change: 1.2, name: 'UnitedHealth Group', mean: 0.0003, vol: 0.014 },
};

const MOCK_HISTORICAL_DATA = {
  // Simplified historical scenarios for stress testing
  '2008_crash': { returnModifier: -0.45, volModifier: 2.5, duration: 252 },
  '2020_covid': { returnModifier: -0.35, volModifier: 3.0, duration: 60 },
  'dotcom_bust': { returnModifier: -0.40, volModifier: 2.0, duration: 504 },
  'bull_2017': { returnModifier: 0.25, volModifier: 0.6, duration: 252 },
  'stagflation_70s': { returnModifier: -0.15, volModifier: 1.8, duration: 756 },
};

// ============================================================================
// API METHODS
// ============================================================================

/**
 * Fetch real-time stock quote
 * @param {string} ticker - Stock ticker symbol
 * @returns {Promise<Object>} Stock data with price, change, name
 */
export const fetchStockQuote = async (ticker) => {
  if (API_CONFIG.USE_MOCK) {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
    
    const data = MOCK_STOCK_DATA[ticker.toUpperCase()];
    if (!data) {
      throw new Error(`Ticker ${ticker} not found`);
    }
    return { ...data, ticker: ticker.toUpperCase(), timestamp: Date.now() };
  }
  
  // Real API call (uncomment when backend is ready)
  // const response = await fetch(`${API_CONFIG.BASE_URL}/quote/${ticker}`, {
  //   signal: AbortSignal.timeout(API_CONFIG.TIMEOUT)
  // });
  // if (!response.ok) throw new Error(`Failed to fetch ${ticker}`);
  // return response.json();
};

/**
 * Fetch multiple stock quotes in batch
 * @param {string[]} tickers - Array of ticker symbols
 * @returns {Promise<Object>} Map of ticker -> stock data
 */
export const fetchBatchQuotes = async (tickers) => {
  if (API_CONFIG.USE_MOCK) {
    await new Promise(resolve => setTimeout(resolve, 150 + Math.random() * 250));
    
    const results = {};
    for (const ticker of tickers) {
      const data = MOCK_STOCK_DATA[ticker.toUpperCase()];
      if (data) {
        results[ticker.toUpperCase()] = { ...data, ticker: ticker.toUpperCase() };
      }
    }
    return results;
  }
  
  // Real API call
  // const response = await fetch(`${API_CONFIG.BASE_URL}/quotes`, {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ tickers }),
  //   signal: AbortSignal.timeout(API_CONFIG.TIMEOUT)
  // });
  // if (!response.ok) throw new Error('Failed to fetch quotes');
  // return response.json();
};

/**
 * Fetch asset parameters (mean return, volatility) for simulation
 * @param {string} ticker - Stock ticker symbol
 * @returns {Promise<Object>} Asset parameters { mean, vol, name }
 */
export const fetchAssetParameters = async (ticker) => {
  if (API_CONFIG.USE_MOCK) {
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const data = MOCK_STOCK_DATA[ticker.toUpperCase()];
    if (!data) {
      // Return default parameters for unknown tickers
      return { mean: 0.0003, vol: 0.015, name: ticker.toUpperCase() };
    }
    return { mean: data.mean, vol: data.vol, name: data.name };
  }
  
  // Real API call
  // const response = await fetch(`${API_CONFIG.BASE_URL}/parameters/${ticker}`);
  // if (!response.ok) throw new Error(`Failed to fetch parameters for ${ticker}`);
  // return response.json();
};

/**
 * Fetch historical scenario data for stress testing
 * @param {string} scenarioId - Scenario identifier (e.g., '2008_crash')
 * @returns {Promise<Object>} Scenario parameters
 */
export const fetchHistoricalScenario = async (scenarioId) => {
  if (API_CONFIG.USE_MOCK) {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const scenario = MOCK_HISTORICAL_DATA[scenarioId];
    if (!scenario) {
      throw new Error(`Scenario ${scenarioId} not found`);
    }
    return { id: scenarioId, ...scenario };
  }
  
  // Real API call
  // const response = await fetch(`${API_CONFIG.BASE_URL}/scenarios/${scenarioId}`);
  // if (!response.ok) throw new Error(`Failed to fetch scenario ${scenarioId}`);
  // return response.json();
};

/**
 * Get all available tickers
 * @returns {Promise<string[]>} Array of available ticker symbols
 */
export const fetchAvailableTickers = async () => {
  if (API_CONFIG.USE_MOCK) {
    await new Promise(resolve => setTimeout(resolve, 50));
    return Object.keys(MOCK_STOCK_DATA);
  }
  
  // Real API call
  // const response = await fetch(`${API_CONFIG.BASE_URL}/tickers`);
  // if (!response.ok) throw new Error('Failed to fetch tickers');
  // return response.json();
};

/**
 * Validate if a ticker exists
 * @param {string} ticker - Ticker to validate
 * @returns {Promise<boolean>} Whether ticker is valid
 */
export const validateTicker = async (ticker) => {
  if (API_CONFIG.USE_MOCK) {
    return MOCK_STOCK_DATA.hasOwnProperty(ticker.toUpperCase());
  }
  
  // Real API call
  // const response = await fetch(`${API_CONFIG.BASE_URL}/validate/${ticker}`);
  // return response.ok;
};

/**
 * Save portfolio to backend (requires auth)
 * @param {Object} portfolioData - Portfolio configuration
 * @param {string} token - Auth token
 * @returns {Promise<Object>} Saved portfolio with ID
 */
export const savePortfolio = async (portfolioData, token) => {
  if (API_CONFIG.USE_MOCK) {
    await new Promise(resolve => setTimeout(resolve, 200));
    return { 
      id: `portfolio_${Date.now()}`, 
      ...portfolioData, 
      savedAt: new Date().toISOString() 
    };
  }
  
  // Real API call
  // const response = await fetch(`${API_CONFIG.BASE_URL}/portfolios`, {
  //   method: 'POST',
  //   headers: { 
  //     'Content-Type': 'application/json',
  //     'Authorization': `Bearer ${token}`
  //   },
  //   body: JSON.stringify(portfolioData)
  // });
  // if (!response.ok) throw new Error('Failed to save portfolio');
  // return response.json();
};

/**
 * Load user's saved portfolios
 * @param {string} token - Auth token
 * @returns {Promise<Object[]>} Array of saved portfolios
 */
export const loadPortfolios = async (token) => {
  if (API_CONFIG.USE_MOCK) {
    await new Promise(resolve => setTimeout(resolve, 150));
    // Return from localStorage if available
    const saved = localStorage.getItem('portfoliopath_portfolios');
    return saved ? JSON.parse(saved) : [];
  }
  
  // Real API call
  // const response = await fetch(`${API_CONFIG.BASE_URL}/portfolios`, {
  //   headers: { 'Authorization': `Bearer ${token}` }
  // });
  // if (!response.ok) throw new Error('Failed to load portfolios');
  // return response.json();
};

// ============================================================================
// CORRELATION DATA
// ============================================================================

/**
 * Fetch correlation matrix for given tickers
 * @param {string[]} tickers - Array of ticker symbols
 * @returns {Promise<number[][]>} Correlation matrix
 */
export const fetchCorrelationMatrix = async (tickers) => {
  if (API_CONFIG.USE_MOCK) {
    // Generate mock correlation matrix (same logic as current)
    const n = tickers.length;
    const matrix = Array(n).fill(0).map(() => Array(n).fill(0));
    
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) {
          matrix[i][j] = 1;
        } else {
          const t1 = tickers[i];
          const t2 = tickers[j];
          
          if (['SPY', 'QQQ', 'VTI', 'IWM'].includes(t1) && 
              ['SPY', 'QQQ', 'VTI', 'IWM'].includes(t2)) {
            matrix[i][j] = 0.85;
          } else if (['AAPL', 'MSFT', 'GOOGL', 'QQQ', 'NVDA', 'META'].includes(t1) && 
                     ['AAPL', 'MSFT', 'GOOGL', 'QQQ', 'NVDA', 'META'].includes(t2)) {
            matrix[i][j] = 0.75;
          } else if ((t1 === 'BND' || t1 === 'AGG' || t1 === 'TLT') && 
                     !['BND', 'AGG', 'TLT', 'GLD'].includes(t2)) {
            matrix[i][j] = -0.3;
          } else if (t2 === 'BND' || t2 === 'AGG' || t2 === 'TLT') {
            matrix[i][j] = -0.3;
          } else if (t1 === 'GLD' || t2 === 'GLD') {
            matrix[i][j] = 0.1;
          } else if (t1 === 'TSLA' || t2 === 'TSLA') {
            matrix[i][j] = 0.5;
          } else {
            matrix[i][j] = 0.6;
          }
        }
      }
    }
    return matrix;
  }
  
  // Real API call
  // const response = await fetch(`${API_CONFIG.BASE_URL}/correlation`, {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ tickers })
  // });
  // if (!response.ok) throw new Error('Failed to fetch correlation matrix');
  // return response.json();
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check API health/connectivity
 * @returns {Promise<boolean>} Whether API is reachable
 */
export const checkApiHealth = async () => {
  if (API_CONFIG.USE_MOCK) return true;
  
  try {
    const response = await fetch(`${API_CONFIG.BASE_URL}/health`, {
      signal: AbortSignal.timeout(5000)
    });
    return response.ok;
  } catch {
    return false;
  }
};

/**
 * Get API configuration status
 * @returns {Object} Current API configuration
 */
export const getApiConfig = () => ({
  baseUrl: API_CONFIG.BASE_URL,
  useMock: API_CONFIG.USE_MOCK,
  timeout: API_CONFIG.TIMEOUT
});

export default {
  fetchStockQuote,
  fetchBatchQuotes,
  fetchAssetParameters,
  fetchHistoricalScenario,
  fetchAvailableTickers,
  validateTicker,
  savePortfolio,
  loadPortfolios,
  fetchCorrelationMatrix,
  checkApiHealth,
  getApiConfig
};
