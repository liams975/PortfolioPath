/**
 * Real Market Data Hook
 * 
 * Fetches and caches real-time market data from Yahoo Finance backend.
 * Falls back to static data when offline.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchAssetParameters, fetchBatchQuotes, fetchCorrelationMatrix } from '../services/api';
import { assetDatabase } from '../constants/portfolioConstants';

// In-memory cache for market data
const marketDataCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Custom hook to fetch real market parameters for portfolio assets
 * @param {Array} portfolio - Array of { ticker, weight } objects
 * @param {boolean} enabled - Whether to fetch data
 * @returns {Object} - { data, loading, error, refresh }
 */
export const useMarketData = (portfolio, enabled = true) => {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const fetchedTickers = useRef(new Set());

  const fetchData = useCallback(async () => {
    if (!enabled || !portfolio?.length) return;

    const tickers = portfolio
      .map(p => p.ticker?.toUpperCase())
      .filter(t => t && t.length > 0);

    if (tickers.length === 0) return;

    // Check which tickers need fresh data
    const now = Date.now();
    const tickersToFetch = tickers.filter(ticker => {
      const cached = marketDataCache.get(ticker);
      return !cached || (now - cached.timestamp > CACHE_DURATION);
    });

    // Return cached data if all fresh
    if (tickersToFetch.length === 0) {
      const cachedData = {};
      tickers.forEach(ticker => {
        const cached = marketDataCache.get(ticker);
        if (cached) {
          cachedData[ticker] = cached.data;
        }
      });
      setData(cachedData);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch parameters for all tickers in parallel
      const results = await Promise.allSettled(
        tickersToFetch.map(async (ticker) => {
          try {
            const params = await fetchAssetParameters(ticker);
            return { ticker, params };
          } catch (err) {
            // Fallback to static data
            const staticData = assetDatabase[ticker] || { 
              mean: 0.0003, 
              vol: 0.015, 
              name: ticker 
            };
            return { ticker, params: staticData, isStatic: true };
          }
        })
      );

      const newData = { ...data };
      
      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          const { ticker, params, isStatic } = result.value;
          newData[ticker] = params;
          
          // Cache successful fetches
          if (!isStatic) {
            marketDataCache.set(ticker, {
              data: params,
              timestamp: now
            });
          }
          fetchedTickers.current.add(ticker);
        }
      });

      // Include any remaining cached data
      tickers.forEach(ticker => {
        if (!newData[ticker]) {
          const cached = marketDataCache.get(ticker);
          if (cached) {
            newData[ticker] = cached.data;
          } else {
            // Ultimate fallback to static
            newData[ticker] = assetDatabase[ticker] || { 
              mean: 0.0003, 
              vol: 0.015, 
              name: ticker 
            };
          }
        }
      });

      setData(newData);
    } catch (err) {
      setError(err.message);
      // Fallback to static data on complete failure
      const fallbackData = {};
      tickers.forEach(ticker => {
        fallbackData[ticker] = assetDatabase[ticker] || { 
          mean: 0.0003, 
          vol: 0.015, 
          name: ticker 
        };
      });
      setData(fallbackData);
    } finally {
      setLoading(false);
    }
  }, [portfolio, enabled]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refresh = useCallback(() => {
    // Clear cache for these tickers
    portfolio?.forEach(p => {
      if (p.ticker) {
        marketDataCache.delete(p.ticker.toUpperCase());
      }
    });
    fetchData();
  }, [portfolio, fetchData]);

  return { data, loading, error, refresh };
};

/**
 * Hook to fetch real-time quotes for display (price, change, etc.)
 * @param {Array} tickers - Array of ticker symbols
 * @param {boolean} enabled - Whether to fetch
 * @returns {Object} - { quotes, loading, error }
 */
export const useRealTimeQuotes = (tickers, enabled = true) => {
  const [quotes, setQuotes] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!enabled || !tickers?.length) return;

    const validTickers = tickers.filter(t => t && t.length > 0);
    if (validTickers.length === 0) return;

    let isMounted = true;

    const fetchQuotes = async () => {
      setLoading(true);
      try {
        const data = await fetchBatchQuotes(validTickers);
        if (isMounted) {
          setQuotes(data);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchQuotes();

    // Refresh every 30 seconds
    const interval = setInterval(fetchQuotes, 30000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [tickers?.join(','), enabled]);

  return { quotes, loading, error };
};

/**
 * Hook to fetch correlation matrix for portfolio assets
 * @param {Array} tickers - Array of ticker symbols
 * @param {boolean} enabled - Whether to fetch
 * @returns {Object} - { matrix, loading, error }
 */
export const useCorrelationMatrix = (tickers, enabled = true) => {
  const [matrix, setMatrix] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!enabled || !tickers?.length || tickers.length < 2) {
      setMatrix(null);
      return;
    }

    const validTickers = tickers.filter(t => t && t.length > 0);
    if (validTickers.length < 2) return;

    let isMounted = true;

    const fetchMatrix = async () => {
      setLoading(true);
      try {
        const data = await fetchCorrelationMatrix(validTickers);
        if (isMounted) {
          setMatrix(data);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message);
          // Fallback to identity matrix
          const n = validTickers.length;
          const identity = Array(n).fill(0).map((_, i) => 
            Array(n).fill(0).map((_, j) => i === j ? 1 : 0.3)
          );
          setMatrix(identity);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchMatrix();

    return () => {
      isMounted = false;
    };
  }, [tickers?.join(','), enabled]);

  return { matrix, loading, error };
};

/**
 * Get asset parameters from cache or static data (synchronous)
 * @param {string} ticker - Ticker symbol
 * @returns {Object} - { mean, vol, name }
 */
export const getAssetParams = (ticker) => {
  const upperTicker = ticker?.toUpperCase();
  if (!upperTicker) {
    return { mean: 0.0003, vol: 0.015, name: 'Unknown' };
  }

  // Check cache first
  const cached = marketDataCache.get(upperTicker);
  if (cached) {
    return cached.data;
  }

  // Fallback to static
  return assetDatabase[upperTicker] || { 
    mean: 0.0003, 
    vol: 0.015, 
    name: upperTicker 
  };
};

/**
 * Clear the market data cache
 */
export const clearMarketDataCache = () => {
  marketDataCache.clear();
};

export default useMarketData;
