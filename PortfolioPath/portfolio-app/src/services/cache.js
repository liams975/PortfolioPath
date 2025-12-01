/**
 * ============================================================================
 * CACHE SERVICE - LocalStorage Persistence
 * ============================================================================
 * 
 * Manages caching of simulation results, portfolios, and user preferences.
 * Uses localStorage with automatic expiration.
 * 
 * ============================================================================
 */

const CACHE_PREFIX = 'portfoliopath_';
const DEFAULT_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Generate cache key
 */
const getCacheKey = (key) => `${CACHE_PREFIX}${key}`;

/**
 * Save data to cache with optional TTL
 * @param {string} key - Cache key
 * @param {any} data - Data to cache
 * @param {number} ttl - Time to live in ms (default 24h)
 */
export const saveToCache = (key, data, ttl = DEFAULT_TTL) => {
  try {
    const cacheEntry = {
      data,
      timestamp: Date.now(),
      expiry: Date.now() + ttl
    };
    localStorage.setItem(getCacheKey(key), JSON.stringify(cacheEntry));
    return true;
  } catch (e) {
    console.warn('Cache save failed:', e);
    return false;
  }
};

/**
 * Load data from cache
 * @param {string} key - Cache key
 * @returns {any|null} Cached data or null if expired/missing
 */
export const loadFromCache = (key) => {
  try {
    const cached = localStorage.getItem(getCacheKey(key));
    if (!cached) return null;
    
    const { data, expiry } = JSON.parse(cached);
    
    // Check expiry
    if (Date.now() > expiry) {
      localStorage.removeItem(getCacheKey(key));
      return null;
    }
    
    return data;
  } catch (e) {
    console.warn('Cache load failed:', e);
    return null;
  }
};

/**
 * Remove item from cache
 */
export const removeFromCache = (key) => {
  try {
    localStorage.removeItem(getCacheKey(key));
    return true;
  } catch (e) {
    return false;
  }
};

/**
 * Clear all PortfolioPath cache
 */
export const clearCache = () => {
  try {
    const keys = Object.keys(localStorage).filter(k => k.startsWith(CACHE_PREFIX));
    keys.forEach(k => localStorage.removeItem(k));
    return true;
  } catch (e) {
    return false;
  }
};

// ============================================================================
// PORTFOLIO SPECIFIC CACHE METHODS
// ============================================================================

/**
 * Save portfolio to local storage
 */
export const savePortfolioLocal = (portfolio, name) => {
  const portfolios = loadPortfoliosLocal();
  const existing = portfolios.findIndex(p => p.name === name);
  
  const portfolioEntry = {
    id: existing >= 0 ? portfolios[existing].id : `local_${Date.now()}`,
    name,
    portfolio: portfolio.portfolio,
    initialValue: portfolio.initialValue,
    timeHorizon: portfolio.timeHorizon,
    numSimulations: portfolio.numSimulations,
    advancedOptions: portfolio.advancedOptions,
    scenarios: portfolio.scenarios,
    savedAt: new Date().toISOString()
  };
  
  if (existing >= 0) {
    portfolios[existing] = portfolioEntry;
  } else {
    portfolios.push(portfolioEntry);
  }
  
  saveToCache('saved_portfolios', portfolios, Infinity);
  return portfolioEntry;
};

/**
 * Load all saved portfolios
 */
export const loadPortfoliosLocal = () => {
  return loadFromCache('saved_portfolios') || [];
};

/**
 * Delete a saved portfolio
 */
export const deletePortfolioLocal = (id) => {
  const portfolios = loadPortfoliosLocal();
  const filtered = portfolios.filter(p => p.id !== id);
  saveToCache('saved_portfolios', filtered, Infinity);
  return true;
};

// ============================================================================
// SIMULATION RESULT CACHE
// ============================================================================

/**
 * Generate hash for portfolio configuration (for cache key)
 */
const hashPortfolioConfig = (config) => {
  const str = JSON.stringify({
    portfolio: config.portfolio,
    initialValue: config.initialValue,
    timeHorizon: config.timeHorizon,
    numSimulations: config.numSimulations,
    advancedOptions: config.advancedOptions,
    scenarios: config.scenarios
  });
  
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `sim_${Math.abs(hash)}`;
};

/**
 * Cache simulation results
 */
export const cacheSimulationResults = (config, results, metrics) => {
  const key = hashPortfolioConfig(config);
  saveToCache(key, { results: summarizeResults(results), metrics }, 60 * 60 * 1000); // 1 hour
  return key;
};

/**
 * Get cached simulation results
 */
export const getCachedSimulation = (config) => {
  const key = hashPortfolioConfig(config);
  return loadFromCache(key);
};

/**
 * Summarize results for caching (reduce storage size)
 * Stores only key percentiles, not all paths
 */
const summarizeResults = (results) => {
  if (!results || results.length === 0) return null;
  
  const finalValues = results.map(path => path[path.length - 1]?.value || 0).sort((a, b) => a - b);
  const maxDrawdowns = results.map(path => path.maxDrawdown || 0).sort((a, b) => a - b);
  
  return {
    finalValues: {
      p5: finalValues[Math.floor(finalValues.length * 0.05)],
      p10: finalValues[Math.floor(finalValues.length * 0.1)],
      p25: finalValues[Math.floor(finalValues.length * 0.25)],
      p50: finalValues[Math.floor(finalValues.length * 0.5)],
      p75: finalValues[Math.floor(finalValues.length * 0.75)],
      p90: finalValues[Math.floor(finalValues.length * 0.9)],
      p95: finalValues[Math.floor(finalValues.length * 0.95)],
      min: finalValues[0],
      max: finalValues[finalValues.length - 1]
    },
    maxDrawdowns: {
      median: maxDrawdowns[Math.floor(maxDrawdowns.length * 0.5)],
      p95: maxDrawdowns[Math.floor(maxDrawdowns.length * 0.95)],
      worst: maxDrawdowns[maxDrawdowns.length - 1]
    },
    numSimulations: results.length
  };
};

// ============================================================================
// USER PREFERENCES
// ============================================================================

/**
 * Save user preferences
 */
export const savePreferences = (prefs) => {
  saveToCache('preferences', prefs, Infinity);
};

/**
 * Load user preferences
 */
export const loadPreferences = () => {
  return loadFromCache('preferences') || {
    theme: 'dark',
    defaultSimulations: 1000,
    defaultTimeHorizon: 252,
    showTutorial: true
  };
};

/**
 * Update a single preference
 */
export const updatePreference = (key, value) => {
  const prefs = loadPreferences();
  prefs[key] = value;
  savePreferences(prefs);
  return prefs;
};

export default {
  saveToCache,
  loadFromCache,
  removeFromCache,
  clearCache,
  savePortfolioLocal,
  loadPortfoliosLocal,
  deletePortfolioLocal,
  cacheSimulationResults,
  getCachedSimulation,
  savePreferences,
  loadPreferences,
  updatePreference
};
