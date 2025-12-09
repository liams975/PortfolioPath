import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart, PieChart, Pie, Cell, ScatterChart, Scatter, ReferenceLine } from 'recharts';
import { TrendingUp, AlertTriangle, Target, Activity, Settings, BarChart3, Network, Zap, User, LogOut, FolderOpen, Sun, Moon, Download, FileText, GitCompare, Sliders, Scale, Crosshair, TrendingDown, Loader2, CheckCircle, Package, RefreshCw } from 'lucide-react';
import { useAuth } from './context/AuthContext';
import { useTheme } from './context/ThemeContext';
import AuthModal from './components/AuthModal';
import SavedPortfolios from './components/SavedPortfolios';
import { TickerInput } from './components/TickerInput';
import { exportToCSV, exportToPDF } from './utils/exportUtils';
import { savePortfolioLocal, loadPortfoliosLocal, cacheSimulationResults, getCachedSimulation, savePreferences, loadPreferences } from './services/cache';
import { toast } from './utils/toast';
import { handleError, retryWithBackoff } from './utils/errorHandler';
import { checkApiHealth, runSimulation as runBackendSimulation, fetchAssetParameters } from './services/api';

/**
 * ============================================================================
 * PORTFOLIOPATH PRO - ADVANCED MONTE CARLO PORTFOLIO SIMULATOR
 * ============================================================================
 * 
 * This application uses Monte Carlo simulation to project potential future 
 * outcomes for investment portfolios. It runs thousands of "what-if" scenarios
 * to show you the range of possible returns.
 * 
 * KEY CONCEPTS:
 * 
 * 1. TIME HORIZON (Default: 252 days)
 *    - NOT based on historical data from a specific timeframe
 *    - Forward-looking synthetic scenarios
 *    - 252 trading days ≈ 1 year (excludes weekends/holidays)
 *    - You can adjust to model different investment periods
 * 
 * 2. MONTE CARLO SIMULATION
 *    - Runs 1,000+ simulations of possible futures
 *    - Each simulation generates daily returns based on:
 *      • Statistical parameters (mean return, volatility)
 *      • Correlation between assets
 *      • Random market events
 *    - Produces a distribution of outcomes (best, worst, most likely)
 * 
 * 3. ASSET PARAMETERS
 *    - Each ticker has pre-defined statistical properties:
 *      • Mean: Average daily return (e.g., 0.0003 = 0.03% daily, ~7.5% annually)
 *      • Volatility: Daily price fluctuation (e.g., 0.01 = 1% daily, ~16% annually)
 *    - These are TYPICAL long-term averages, not live market data
 * 
 * 4. ADVANCED FEATURES (Optional):
 *    
 *    a) CORRELATION MATRIX (Cholesky Decomposition)
 *       - Models how assets move together
 *       - Example: When S&P 500 falls 5%, tech stocks likely fall too
 *       - Bonds often move opposite to stocks
 *    
 *    b) FAT-TAILED DISTRIBUTIONS (Student-t)
 *       - Real markets have more extreme events than normal distribution
 *       - Captures "black swan" events (crashes, booms)
 *    
 *    c) GARCH(1,1) VOLATILITY
 *       - Volatility clustering: Wild markets stay wild, calm stays calm
 *       - After a market crash, expect continued high volatility
 *    
 *    d) REGIME SWITCHING (Bull/Bear Markets)
 *       - Markets alternate between rising (bull) and falling (bear) phases
 *       - Bull: Positive returns, lower volatility
 *       - Bear: Negative returns, higher volatility
 *       - Randomly transitions between states based on probabilities
 * 
 * 5. SCENARIO TESTING
 *    - Recession: -30% to expected returns
 *    - Volatility Spike: +50% market swings (crisis simulation)
 *    - Bull Market: +30% to expected returns
 * 
 * 6. RISK METRICS EXPLAINED
 *    - VaR (95%): "5% chance of losing at least this much"
 *    - Expected Shortfall: "Average loss in worst 5% of cases"
 *    - Kurtosis: Measures tail risk (>3 = more extreme events)
 *    - Sharpe Ratio: Return per unit of risk (higher = better)
 * 
 * IMPORTANT NOTES:
 * - This is a SIMULATION, not a prediction
 * - No transaction costs or taxes included
 * - Assumes daily compounding of returns
 * - Asset parameters are simplified (not live market data)
 * 
 * See MODEL_EXPLANATION.md for detailed technical documentation
 * ============================================================================
 */

// ============================================================================
// ADVANCED MATHEMATICAL UTILITIES
// ============================================================================

// Box-Muller transform for normal distribution
// Converts uniform random numbers into normally distributed numbers (bell curve)
// Used for basic market return modeling
const randomNormal = (mean = 0, stdDev = 1) => {
  const u1 = Math.random();
  const u2 = Math.random();
  const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return z0 * stdDev + mean;
};

// Student-t distribution for fat tails (using Gamma approximation)
// Generates returns with "fat tails" - more extreme events than normal distribution
// This better matches real market behavior where crashes and booms are more common
const randomStudentT = (degreesOfFreedom = 5) => {
  const df = degreesOfFreedom;
  const z = randomNormal();
  const chi2 = Array.from({ length: df }, () => Math.pow(randomNormal(), 2))
    .reduce((a, b) => a + b, 0);
  return z * Math.sqrt(df / chi2);
};

// Cholesky decomposition for correlation matrix
// Matrix math technique to ensure assets move together realistically
// Example: When SPY rises, QQQ tends to rise too (they're correlated)
const choleskyDecomposition = (matrix) => {
  const n = matrix.length;
  const L = Array(n).fill(0).map(() => Array(n).fill(0));
  
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = 0;
      for (let k = 0; k < j; k++) {
        sum += L[i][k] * L[j][k];
      }
      
      if (i === j) {
        L[i][j] = Math.sqrt(Math.max(matrix[i][i] - sum, 0.0001));
      } else {
        L[i][j] = (matrix[i][j] - sum) / L[j][j];
      }
    }
  }
  return L;
};

// Generate correlated random variables
const generateCorrelatedReturns = (choleskyMatrix, useFatTails = false, df = 5) => {
  const n = choleskyMatrix.length;
  const uncorrelated = useFatTails 
    ? Array.from({ length: n }, () => randomStudentT(df))
    : Array.from({ length: n }, () => randomNormal());
  
  const correlated = Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      correlated[i] += choleskyMatrix[i][j] * uncorrelated[j];
    }
  }
  return correlated;
};

// ============================================================================
// GARCH(1,1) VOLATILITY MODEL
// ============================================================================

class GARCHModel {
  constructor(omega = 0.000001, alpha = 0.1, beta = 0.85) {
    this.omega = omega;
    this.alpha = alpha;
    this.beta = beta;
    this.currentVariance = 0.0001;
  }
  
  update(returnShock) {
    this.currentVariance = this.omega + 
      this.alpha * Math.pow(returnShock, 2) + 
      this.beta * this.currentVariance;
    return Math.sqrt(this.currentVariance);
  }
  
  getVolatility() {
    return Math.sqrt(this.currentVariance);
  }
}

// ============================================================================
// REGIME SWITCHING MODEL (2-STATE Markov Chain)
// ============================================================================

class RegimeSwitchingModel {
  constructor() {
    // Bull and Bear regime parameters
    this.regimes = {
      bull: { mean: 0.0006, vol: 0.01, label: 'Bull Market' },
      bear: { mean: -0.0003, vol: 0.025, label: 'Bear Market' }
    };
    
    // Transition probabilities
    this.transitionMatrix = {
      bull: { bull: 0.95, bear: 0.05 },
      bear: { bull: 0.10, bear: 0.90 }
    };
    
    this.currentRegime = 'bull';
  }
  
  transition() {
    const rand = Math.random();
    const probs = this.transitionMatrix[this.currentRegime];
    
    if (rand < probs.bear) {
      this.currentRegime = 'bear';
    } else {
      this.currentRegime = 'bull';
    }
    
    return this.currentRegime;
  }
  
  getParameters() {
    return this.regimes[this.currentRegime];
  }
  
  getCurrentRegime() {
    return this.currentRegime;
  }
}

// ============================================================================
// ENHANCED ASSET DATA WITH CORRELATIONS
// ============================================================================

const assetDatabase = {
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
};

// ============================================================================
// PRESET PORTFOLIO TEMPLATES
// ============================================================================

const PRESET_PORTFOLIOS = {
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

const STRESS_SCENARIOS = {
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
// GOAL PROBABILITY CALCULATOR
// ============================================================================

const calculateGoalProbability = (simulations, targetValue) => {
  if (!simulations || simulations.length === 0) return null;
  
  const finalValues = simulations.map(path => {
    const lastPoint = path[path.length - 1];
    return lastPoint ? lastPoint.value : 0;
  });
  
  const successCount = finalValues.filter(v => v >= targetValue).length;
  const probability = (successCount / finalValues.length) * 100;
  
  // Find the time when probability first exceeds 50%
  let medianCrossingDay = null;
  const days = simulations[0]?.length || 0;
  
  for (let day = 0; day < days; day++) {
    const valuesAtDay = simulations.map(path => path[day]?.value || 0);
    const aboveTarget = valuesAtDay.filter(v => v >= targetValue).length;
    if (aboveTarget / simulations.length >= 0.5) {
      medianCrossingDay = day;
      break;
    }
  }
  
  return {
    probability: probability.toFixed(1),
    successCount,
    totalSimulations: simulations.length,
    medianCrossingDay
  };
};

// ============================================================================
// DRAWDOWN CALCULATOR
// ============================================================================

const calculateDrawdownMetrics = (simulations) => {
  if (!simulations || simulations.length === 0) return null;
  
  const drawdownData = [];
  const maxDrawdowns = [];
  
  // Calculate drawdown for each simulation
  simulations.forEach(path => {
    let peak = path[0]?.value || 0;
    let maxDrawdown = 0;
    
    path.forEach(point => {
      if (point.value > peak) peak = point.value;
      const drawdown = (peak - point.value) / peak;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    });
    
    maxDrawdowns.push(maxDrawdown * 100);
  });
  
  maxDrawdowns.sort((a, b) => a - b);
  
  // Calculate average drawdown path
  const days = simulations[0]?.length || 0;
  const step = Math.max(1, Math.ceil(days / 50));
  
  for (let day = 0; day < days; day += step) {
    const drawdownsAtDay = simulations.map(path => {
      let peak = path[0]?.value || 0;
      for (let d = 0; d <= day; d++) {
        if (path[d]?.value > peak) peak = path[d].value;
      }
      return path[day] ? ((peak - path[day].value) / peak) * 100 : 0;
    }).sort((a, b) => a - b);
    
    drawdownData.push({
      day,
      p10: drawdownsAtDay[Math.floor(drawdownsAtDay.length * 0.1)] || 0,
      median: drawdownsAtDay[Math.floor(drawdownsAtDay.length * 0.5)] || 0,
      p90: drawdownsAtDay[Math.floor(drawdownsAtDay.length * 0.9)] || 0,
      worst: drawdownsAtDay[drawdownsAtDay.length - 1] || 0
    });
  }
  
  return {
    data: drawdownData,
    stats: {
      median: maxDrawdowns[Math.floor(maxDrawdowns.length * 0.5)],
      p90: maxDrawdowns[Math.floor(maxDrawdowns.length * 0.9)],
      p95: maxDrawdowns[Math.floor(maxDrawdowns.length * 0.95)],
      worst: maxDrawdowns[maxDrawdowns.length - 1],
      avgMaxDrawdown: maxDrawdowns.reduce((a, b) => a + b, 0) / maxDrawdowns.length
    }
  };
};

// Correlation matrix (simplified - real would use historical data)
const generateCorrelationMatrix = (tickers) => {
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
        else if (['AAPL', 'MSFT', 'GOOGL', 'QQQ'].includes(t1) && 
                 ['AAPL', 'MSFT', 'GOOGL', 'QQQ'].includes(t2)) {
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

// ============================================================================
// JUMP DIFFUSION MODEL (Merton)
// ============================================================================
// Models sudden market shocks (earnings surprises, geopolitical events)
// Adds random jumps to the continuous diffusion process

const generateJump = (jumpIntensity = 0.02, jumpMean = -0.02, jumpVol = 0.03) => {
  // Poisson process for jump occurrence
  if (Math.random() < jumpIntensity) {
    // Jump size is normally distributed
    return randomNormal(jumpMean, jumpVol);
  }
  return 0;
};

// ============================================================================
// MEAN REVERSION (Ornstein-Uhlenbeck)
// ============================================================================
// Models tendency of prices to revert to long-term mean
// Useful for interest rates, volatility, and some commodities

class MeanReversionModel {
  constructor(longTermMean = 0.0003, reversionSpeed = 0.1) {
    this.longTermMean = longTermMean;
    this.reversionSpeed = reversionSpeed;
    this.currentValue = longTermMean;
  }
  
  step(volatility) {
    const drift = this.reversionSpeed * (this.longTermMean - this.currentValue);
    const diffusion = volatility * randomNormal();
    this.currentValue += drift + diffusion;
    return this.currentValue;
  }
}

// ============================================================================
// ADVANCED MONTE CARLO ENGINE
// ============================================================================

const runAdvancedMonteCarloSimulation = (
  portfolio, 
  initialValue, 
  days, 
  simulations, 
  options = {}
) => {
  const {
    useCorrelation = true,
    useFatTails = true,
    useGARCH = true,
    useRegimeSwitching = true,
    useJumpDiffusion = true,
    useMeanReversion = false,
    scenarios = {}
  } = options;
  
  const results = [];
  const tickers = portfolio.map(p => p.ticker);
  const weights = portfolio.map(p => p.weight);
  
  // Pre-compute correlation structure
  const correlationMatrix = useCorrelation ? generateCorrelationMatrix(tickers) : null;
  const choleskyMatrix = correlationMatrix ? choleskyDecomposition(correlationMatrix) : null;
  
  for (let sim = 0; sim < simulations; sim++) {
    let value = initialValue;
    const path = [{ day: 0, value, regime: 'bull' }];
    
    // Initialize GARCH models for each asset
    const garchModels = useGARCH 
      ? portfolio.map(() => new GARCHModel())
      : null;
    
    // Initialize mean reversion models for each asset
    const meanReversionModels = useMeanReversion
      ? portfolio.map(({ ticker }) => {
          const params = assetDatabase[ticker] || { mean: 0.0003 };
          return new MeanReversionModel(params.mean, 0.05);
        })
      : null;
    
    // Initialize regime switching model
    const regimeModel = useRegimeSwitching ? new RegimeSwitchingModel() : null;
    
    for (let day = 1; day <= days; day++) {
      let dailyReturn = 0;
      
      // Get regime parameters if using regime switching
      const regimeParams = regimeModel ? regimeModel.getParameters() : null;
      const currentRegime = regimeModel ? regimeModel.getCurrentRegime() : 'bull';
      
      // Generate correlated returns
      let returns;
      if (useCorrelation && choleskyMatrix) {
        returns = generateCorrelatedReturns(choleskyMatrix, useFatTails, 5);
      } else {
        returns = portfolio.map(() => useFatTails ? randomStudentT(5) : randomNormal());
      }
      
      portfolio.forEach(({ ticker, weight }, idx) => {
        const assetParams = assetDatabase[ticker] || { mean: 0.0003, vol: 0.012 };
        
        // Base return with regime adjustment
        let mean = assetParams.mean;
        let vol = assetParams.vol;
        
        // Apply mean reversion if enabled
        if (useMeanReversion && meanReversionModels) {
          mean = meanReversionModels[idx].step(vol * 0.1);
        }
        
        if (regimeParams) {
          mean = mean * (regimeParams.mean / 0.0003);
          vol = vol * (regimeParams.vol / 0.01);
        }
        
        // Apply GARCH volatility
        if (useGARCH && garchModels) {
          const baseReturn = returns[idx] * vol + mean;
          vol = garchModels[idx].update(baseReturn);
        }
        
        let assetReturn = returns[idx] * vol + mean;
        
        // Apply jump diffusion (Merton model) if enabled
        if (useJumpDiffusion) {
          const jumpSize = generateJump(0.01, -0.015, 0.025); // 1% daily jump probability
          assetReturn += jumpSize;
        }
        
        // Apply scenario adjustments
        if (scenarios.recession) assetReturn *= 0.7;
        if (scenarios.volatilitySpike) assetReturn *= (1 + randomNormal(0, 0.5));
        if (scenarios.bullMarket) assetReturn *= 1.3;
        
        dailyReturn += assetReturn * weight;
      });
      
      value *= (1 + dailyReturn);
      
      // Transition regime for next period
      if (regimeModel) regimeModel.transition();
      
      path.push({ day, value, regime: currentRegime });
    }
    
    results.push(path);
  }
  
  return results;
};

// ============================================================================
// ============================================================================
// BACKEND RESPONSE TRANSFORMER
// ============================================================================

/**
 * Transform backend simulation response to frontend format
 * Backend returns: { final_values, risk_metrics, sample_paths, yearly_data }
 * Frontend expects: Array of paths, each path is [{ day, value }, ...]
 */
const transformBackendResponse = (backendResponse, timeHorizonDays) => {
  if (!backendResponse) return null;
  
  const initialValue = backendResponse.summary?.initial_investment || 10000;
  const numSimulations = backendResponse.summary?.num_simulations || 1000;
  const timeHorizonYears = backendResponse.summary?.time_horizon || Math.ceil(timeHorizonDays / 252);
  const finalValues = backendResponse.final_values;
  const yearlyData = backendResponse.yearly_data || [];
  const samplePaths = backendResponse.sample_paths || [];
  
  // Generate paths using yearly_data statistics
  const paths = [];
  
  for (let sim = 0; sim < numSimulations; sim++) {
    const path = [];
    
    // Sample a final value from the distribution
    const mean = finalValues?.mean || initialValue;
    const std = finalValues?.std || 0;
    const min = finalValues?.min || initialValue;
    const max = finalValues?.max || initialValue;
    
    // Use percentile-based sampling for more realistic distribution
    const percentile = Math.random() * 100;
    let targetFinalValue;
    
    if (finalValues?.percentiles) {
      // Use actual percentiles if available
      const p = Math.floor(percentile / 10) * 10;
      targetFinalValue = finalValues.percentiles[String(p)] || 
        mean + (Math.random() - 0.5) * std * 2;
    } else {
      // Fallback to normal distribution sampling
      targetFinalValue = Math.max(min, Math.min(max,
        mean + (Math.random() - 0.5) * std * 4
      ));
    }
    
    // Generate path using yearly_data for intermediate points
    for (let day = 0; day <= timeHorizonDays; day++) {
      const year = day / 252;
      const yearIndex = Math.floor(year);
      const nextYearIndex = Math.min(yearIndex + 1, yearlyData.length - 1);
      const t = year - yearIndex;
      
      let value;
      
      if (yearlyData.length > 0 && yearIndex < yearlyData.length) {
        // Use yearly data for interpolation
        const currentYearData = yearlyData[yearIndex];
        const nextYearData = yearlyData[nextYearIndex] || currentYearData;
        
        // Interpolate between years using mean values
        const currentMean = currentYearData.mean || initialValue;
        const nextMean = nextYearData.mean || currentMean;
        const interpolatedMean = currentMean + (nextMean - currentMean) * t;
        
        // Add some variation based on std
        const currentStd = currentYearData.std || 0;
        const variation = (Math.random() - 0.5) * currentStd * 0.5;
        value = interpolatedMean + variation;
      } else {
        // Fallback: linear interpolation from initial to final
        const progress = day / timeHorizonDays;
        value = initialValue + (targetFinalValue - initialValue) * progress;
        
        // Add some random walk variation
        const dailyVol = std / Math.sqrt(timeHorizonDays);
        value *= (1 + (Math.random() - 0.5) * dailyVol * 0.1);
      }
      
      // Ensure value is positive and reasonable
      value = Math.max(0, value);
      
      path.push({ day, value });
    }
    
    // Adjust final value to match target
    if (path.length > 0) {
      const adjustment = targetFinalValue / path[path.length - 1].value;
      path.forEach(point => {
        point.value *= adjustment;
      });
    }
    
    paths.push(path);
  }
  
  return paths;
};

/**
 * Extract backend metrics (expected return and volatility) from response
 * These are the INPUT parameters used in the Monte Carlo, based on real historical data
 */
const extractBackendMetrics = (backendResponse) => {
  if (!backendResponse?.summary) return null;
  
  return {
    expectedReturn: backendResponse.summary.expected_return * 100, // Convert to percentage
    volatility: backendResponse.summary.volatility * 100, // Convert to percentage
    initialInvestment: backendResponse.summary.initial_investment,
    timeHorizon: backendResponse.summary.time_horizon,
  };
};

// RISK METRICS (same as before with safety checks)
// ============================================================================

const calculateRiskMetrics = (simulations, initialValue, timeHorizonDays = 2520) => {
  if (!simulations || simulations.length === 0) return null;
  
  const finalValues = simulations.map(path => {
    const lastPoint = path[path.length - 1];
    return lastPoint ? lastPoint.value : initialValue;
  }).filter(v => v !== undefined && v !== null);
  
  if (finalValues.length === 0) return null;
  
  finalValues.sort((a, b) => a - b);
  
  // Calculate total returns (cumulative over entire period)
  const totalReturns = finalValues.map(v => (v - initialValue) / initialValue);
  const meanTotalReturn = totalReturns.reduce((a, b) => a + b, 0) / totalReturns.length;
  
  // Convert to annualized return: (1 + total_return)^(1/years) - 1
  const years = Math.max(timeHorizonDays / 252, 1);
  const meanAnnualizedReturn = Math.pow(1 + meanTotalReturn, 1 / years) - 1;
  
  // For volatility, we need annualized standard deviation of returns
  const variance = totalReturns.reduce((a, r) => a + Math.pow(r - meanTotalReturn, 2), 0) / totalReturns.length;
  const stdDev = Math.sqrt(variance);
  // Annualize volatility (approximate)
  const annualizedVol = stdDev / Math.sqrt(years);
  
  // Kurtosis calculation for tail risk
  const kurtosis = totalReturns.reduce((a, r) => a + Math.pow(r - meanTotalReturn, 4), 0) / 
    (totalReturns.length * Math.pow(stdDev, 4));
  
  const var95 = finalValues[Math.floor(finalValues.length * 0.05)] || initialValue;
  const var99 = finalValues[Math.floor(finalValues.length * 0.01)] || initialValue;
  
  const tailLosses = finalValues.filter(v => v <= var95);
  const expectedShortfall = tailLosses.length > 0 
    ? tailLosses.reduce((a, b) => a + b, 0) / tailLosses.length 
    : var95;
  
  return {
    mean: meanAnnualizedReturn * 100, // Annualized expected return %
    totalReturn: meanTotalReturn * 100, // Total cumulative return %
    volatility: annualizedVol * 100, // Annualized volatility %
    kurtosis: kurtosis,
    var95: ((var95 - initialValue) / initialValue) * 100,
    var99: ((var99 - initialValue) / initialValue) * 100,
    expectedShortfall: ((expectedShortfall - initialValue) / initialValue) * 100,
    sharpeRatio: annualizedVol > 0 ? meanAnnualizedReturn / annualizedVol : 0,
    percentiles: {
      p10: finalValues[Math.floor(finalValues.length * 0.1)] || initialValue,
      p25: finalValues[Math.floor(finalValues.length * 0.25)] || initialValue,
      p50: finalValues[Math.floor(finalValues.length * 0.5)] || initialValue,
      p75: finalValues[Math.floor(finalValues.length * 0.75)] || initialValue,
      p90: finalValues[Math.floor(finalValues.length * 0.9)] || initialValue,
    }
  };
};

// ============================================================================
// REACT COMPONENT
// ============================================================================

const PortfolioPath = () => {
  const [view, setView] = useState('input');
  const [portfolio, setPortfolio] = useState([
    { ticker: 'SPY', weight: 0.6 },
    { ticker: 'BND', weight: 0.4 }
  ]);
  const [initialValue, setInitialValue] = useState(10000);
  const [timeHorizon, setTimeHorizon] = useState(252);
  const [numSimulations, setNumSimulations] = useState(1000);
  const [scenarios, setScenarios] = useState({});
  const [advancedOptions, setAdvancedOptions] = useState({
    useCorrelation: true,
    useFatTails: true,
    useGARCH: true,
    useRegimeSwitching: true,
    useJumpDiffusion: true,
    useMeanReversion: false
  });
  const [simulationResults, setSimulationResults] = useState(null);
  
  // NEW: Comparison mode state
  const [comparisonMode, setComparisonMode] = useState(false);
  const [comparisonPortfolio, setComparisonPortfolio] = useState([
    { ticker: 'QQQ', weight: 0.7 },
    { ticker: 'GLD', weight: 0.3 }
  ]);
  const [comparisonResults, setComparisonResults] = useState(null);
  
  // NEW: Percentile selector
  const [selectedPercentile, setSelectedPercentile] = useState(50);
  
  // NEW: Benchmark
  const [showBenchmark, setShowBenchmark] = useState(true);
  const [benchmarkTicker, setBenchmarkTicker] = useState('SPY');
  const [benchmarkData, setBenchmarkData] = useState(null); // Real benchmark data from backend
  
  // NEW: Backend-sourced metrics (expected_return and volatility from real data)
  const [backendMetrics, setBackendMetrics] = useState(null);
  const [comparisonBackendMetrics, setComparisonBackendMetrics] = useState(null);
  
  // NEW: Efficient frontier
  const [showEfficientFrontier, setShowEfficientFrontier] = useState(false);
  
  // NEW: Goal Probability
  const [goalAmount, setGoalAmount] = useState(15000);
  const [showGoalProbability, setShowGoalProbability] = useState(true);
  
  // NEW: Simulation loading state
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationProgress, setSimulationProgress] = useState(0);
  
  // NEW: Selected preset
  const [selectedPreset, setSelectedPreset] = useState(null);
  
  // NEW: Backend connection status
  const [backendConnected, setBackendConnected] = useState(true);
  const [isCheckingConnection, setIsCheckingConnection] = useState(false);
  
  // NEW: Loading states for API calls
  const [isLoadingQuotes, setIsLoadingQuotes] = useState(false);
  const [quoteErrors, setQuoteErrors] = useState({});
  
  // NEW: Active stress scenario
  const [activeStressScenario, setActiveStressScenario] = useState('normal');
  
  // Theme
  const theme = useTheme();
  const { isDark, toggleTheme, colors } = theme;
  
  // Auth state
  const { user, logout, isAuthenticated } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showSavedPortfolios, setShowSavedPortfolios] = useState(false);

  const addPosition = () => {
    setPortfolio([...portfolio, { ticker: '', weight: 0 }]);
  };

  const updatePosition = (idx, field, value) => {
    const updated = [...portfolio];
    if (field === 'weight') {
      updated[idx][field] = parseFloat(value) || 0;
    } else {
      updated[idx][field] = value.toUpperCase();
    }
    setPortfolio(updated);
  };

  const removePosition = (idx) => {
    setPortfolio(portfolio.filter((_, i) => i !== idx));
  };
  
  // Comparison portfolio handlers
  const updateComparisonPosition = (idx, field, value) => {
    const updated = [...comparisonPortfolio];
    if (field === 'weight') {
      updated[idx][field] = parseFloat(value) || 0;
    } else {
      updated[idx][field] = value.toUpperCase();
    }
    setComparisonPortfolio(updated);
  };
  
  const addComparisonPosition = () => {
    setComparisonPortfolio([...comparisonPortfolio, { ticker: '', weight: 0 }]);
  };
  
  const removeComparisonPosition = (idx) => {
    setComparisonPortfolio(comparisonPortfolio.filter((_, i) => i !== idx));
  };

  const totalWeight = portfolio.reduce((sum, p) => sum + p.weight, 0);
  const totalComparisonWeight = comparisonPortfolio.reduce((sum, p) => sum + p.weight, 0);

  // Load preset portfolio
  const applyPreset = (presetKey) => {
    const preset = PRESET_PORTFOLIOS[presetKey];
    if (preset) {
      setPortfolio([...preset.portfolio]);
      setSelectedPreset(presetKey);
    }
  };
  
  // Apply stress scenario
  const applyStressScenario = (scenarioKey) => {
    const scenario = STRESS_SCENARIOS[scenarioKey];
    if (scenario) {
      setScenarios(scenario.modifier);
      setActiveStressScenario(scenarioKey);
    }
  };

  // Check backend connection status
  useEffect(() => {
    const checkConnection = async () => {
      setIsCheckingConnection(true);
      try {
        const connected = await checkApiHealth();
        setBackendConnected(connected);
        if (!connected && backendConnected) {
          toast.warning('Backend connection lost. Some features may not work.');
        } else if (connected && !backendConnected) {
          toast.success('Backend connection restored.');
        }
      } catch (error) {
        setBackendConnected(false);
        if (backendConnected) {
          toast.warning('Backend connection lost. Some features may not work.');
        }
      } finally {
        setIsCheckingConnection(false);
      }
    };
    
    // Check immediately
    checkConnection();
    
    // Check every 30 seconds
    const interval = setInterval(checkConnection, 30000);
    
    return () => clearInterval(interval);
  }, [backendConnected]);

  const runSimulation = async () => {
    if (Math.abs(totalWeight - 1) > 0.01) {
      toast.error(`Portfolio weights must sum to 100% (currently ${(totalWeight * 100).toFixed(1)}%)`);
      return;
    }
    
    setIsSimulating(true);
    setSimulationProgress(0);
    
    // Progress simulation
    const progressInterval = setInterval(() => {
      setSimulationProgress(prev => Math.min(prev + 90, 90)); // Cap at 90% until backend responds
    }, 100);
    
    try {
      // Try backend API first
      if (backendConnected) {
        try {
          // Convert portfolio format: { ticker, weight } -> { ticker, allocation }
          const holdings = portfolio.map(p => ({
            ticker: p.ticker.toUpperCase(),
            allocation: p.weight * 100 // Convert 0-1 to 0-100
          }));
          
          // Convert time horizon from days to years (backend expects years)
          const timeHorizonYears = Math.ceil(timeHorizon / 252);
          
          // Call backend API
          const backendResponse = await runBackendSimulation({
            holdings,
            initialInvestment: initialValue,
            monthlyContribution: 0, // TODO: Add monthly contribution support
            timeHorizon: timeHorizonYears,
            numSimulations: numSimulations,
            includeDividends: true,
            includeJumpDiffusion: advancedOptions.useJumpDiffusion || false,
            jumpProbability: 0.05,
            jumpMean: -0.1,
            jumpStd: 0.15
          });
          
          clearInterval(progressInterval);
          setSimulationProgress(95);
          
          // Transform backend response to frontend format
          const transformedResults = transformBackendResponse(backendResponse, timeHorizon);
          
          // Extract and store backend metrics (real expected return and volatility)
          const metrics = extractBackendMetrics(backendResponse);
          setBackendMetrics(metrics);
          
          if (transformedResults) {
            setSimulationProgress(100);
            setSimulationResults(transformedResults);
            
            // Cache results
            cacheSimulationResults(getCurrentPortfolioData(), transformedResults, calculateRiskMetrics(transformedResults, initialValue, timeHorizon));
            
            // Run comparison simulation if in comparison mode
            if (comparisonMode && Math.abs(totalComparisonWeight - 1) <= 0.01) {
              try {
                const compHoldings = comparisonPortfolio.map(p => ({
                  ticker: p.ticker.toUpperCase(),
                  allocation: p.weight * 100
                }));
                
                const compBackendResponse = await runBackendSimulation({
                  holdings: compHoldings,
                  initialInvestment: initialValue,
                  monthlyContribution: 0,
                  timeHorizon: timeHorizonYears,
                  numSimulations: numSimulations,
                  includeDividends: true,
                  includeJumpDiffusion: advancedOptions.useJumpDiffusion || false
                });
                
                const compTransformed = transformBackendResponse(compBackendResponse, timeHorizon);
                if (compTransformed) {
                  setComparisonResults(compTransformed);
                  // Store comparison metrics
                  const compMetrics = extractBackendMetrics(compBackendResponse);
                  setComparisonBackendMetrics(compMetrics);
                }
              } catch (compError) {
                console.warn('Comparison simulation failed, using client-side fallback:', compError);
                // Fallback to client-side for comparison
                const compResults = runAdvancedMonteCarloSimulation(
                  comparisonPortfolio,
                  initialValue,
                  timeHorizon,
                  numSimulations,
                  { ...advancedOptions, scenarios }
                );
                setComparisonResults(compResults);
                setComparisonBackendMetrics(null); // No backend metrics for client-side
              }
            } else {
              setComparisonResults(null);
              setComparisonBackendMetrics(null);
            }
            
            setIsSimulating(false);
            setView('results');
            toast.success('Simulation completed using real market data');
            return;
          }
        } catch (backendError) {
          console.warn('Backend simulation failed, falling back to client-side:', backendError);
          handleError(backendError, 'Backend simulation');
          // Fall through to client-side fallback
        }
      }
      
      // Fallback to client-side simulation
      clearInterval(progressInterval);
      toast.warning('Using client-side simulation (backend unavailable)');
      
      const progressInterval2 = setInterval(() => {
        setSimulationProgress(prev => Math.min(prev + 5, 95));
      }, 100);
      
      // Use setTimeout to allow UI to update before heavy computation
      setTimeout(() => {
        const results = runAdvancedMonteCarloSimulation(
          portfolio,
          initialValue,
          timeHorizon,
          numSimulations,
          {
            ...advancedOptions,
            scenarios
          }
        );
        
        clearInterval(progressInterval2);
        setSimulationProgress(100);
        setSimulationResults(results);
        
        // Clear backend metrics when using client-side simulation
        setBackendMetrics(null);
        
        // Cache results
        cacheSimulationResults(getCurrentPortfolioData(), results, calculateRiskMetrics(results, initialValue, timeHorizon));
        
        // Run comparison simulation if in comparison mode
        if (comparisonMode && Math.abs(totalComparisonWeight - 1) <= 0.01) {
          const compResults = runAdvancedMonteCarloSimulation(
            comparisonPortfolio,
            initialValue,
            timeHorizon,
            numSimulations,
            {
              ...advancedOptions,
              scenarios
            }
          );
          setComparisonResults(compResults);
          setComparisonBackendMetrics(null);
        } else {
          setComparisonResults(null);
          setComparisonBackendMetrics(null);
        }
        
        setIsSimulating(false);
        setView('results');
      }, 50);
      
    } catch (error) {
      clearInterval(progressInterval);
      setIsSimulating(false);
      handleError(error, 'Simulation');
      toast.error('Simulation failed. Please try again.');
    }
  };

  const loadPortfolio = (savedData) => {
    setPortfolio(savedData.portfolio || portfolio);
    setInitialValue(savedData.initialValue || initialValue);
    setTimeHorizon(savedData.timeHorizon || timeHorizon);
    setNumSimulations(savedData.numSimulations || numSimulations);
    setAdvancedOptions(savedData.advancedOptions || advancedOptions);
    setScenarios(savedData.scenarios || scenarios);
  };

  const getCurrentPortfolioData = () => ({
    portfolio,
    initialValue,
    timeHorizon,
    numSimulations,
    advancedOptions,
    scenarios
  });

  const riskMetrics = useMemo(() => {
    if (!simulationResults) return null;
    const calculatedMetrics = calculateRiskMetrics(simulationResults, initialValue, timeHorizon);
    
    // If we have backend metrics, use the backend's expected return and volatility
    // These are based on real historical data, not simulation results
    if (backendMetrics && calculatedMetrics) {
      return {
        ...calculatedMetrics,
        mean: backendMetrics.expectedReturn, // Use backend's expected return (based on historical data)
        volatility: backendMetrics.volatility, // Use backend's volatility (based on historical data)
      };
    }
    
    return calculatedMetrics;
  }, [simulationResults, initialValue, timeHorizon, backendMetrics]);
  
  // Comparison risk metrics
  const comparisonRiskMetrics = useMemo(() => {
    if (!comparisonResults) return null;
    const calculatedMetrics = calculateRiskMetrics(comparisonResults, initialValue, timeHorizon);
    
    // If we have backend metrics for comparison, use them
    if (comparisonBackendMetrics && calculatedMetrics) {
      return {
        ...calculatedMetrics,
        mean: comparisonBackendMetrics.expectedReturn,
        volatility: comparisonBackendMetrics.volatility,
      };
    }
    
    return calculatedMetrics;
  }, [comparisonResults, initialValue, timeHorizon, comparisonBackendMetrics]);

  // Goal probability calculation
  const goalProbability = useMemo(() => {
    if (!simulationResults || !goalAmount) return null;
    return calculateGoalProbability(simulationResults, goalAmount);
  }, [simulationResults, goalAmount]);

  // Drawdown metrics calculation
  const drawdownMetrics = useMemo(() => {
    if (!simulationResults) return null;
    return calculateDrawdownMetrics(simulationResults);
  }, [simulationResults]);

  // Dynamic percentile data based on slider
  const dynamicPercentileData = useMemo(() => {
    if (!simulationResults || simulationResults.length === 0) return [];
    
    const data = [];
    const step = Math.max(1, Math.ceil(timeHorizon / 50));
    const percentileFraction = selectedPercentile / 100;
    
    for (let day = 0; day <= timeHorizon; day += step) {
      const values = simulationResults
        .map(path => path[day] ? path[day].value : null)
        .filter(v => v !== null && v !== undefined)
        .sort((a, b) => a - b);
      
      if (values.length > 0) {
        const point = {
          day,
          selected: values[Math.floor(values.length * percentileFraction)] || values[0],
        };
        
        // Add comparison if available
        if (comparisonResults) {
          const compValues = comparisonResults
            .map(path => path[day] ? path[day].value : null)
            .filter(v => v !== null && v !== undefined)
            .sort((a, b) => a - b);
          if (compValues.length > 0) {
            point.comparison = compValues[Math.floor(compValues.length * percentileFraction)] || compValues[0];
          }
        }
        
        data.push(point);
      }
    }
    return data;
  }, [simulationResults, comparisonResults, timeHorizon, selectedPercentile]);

  const fanChartData = useMemo(() => {
    if (!simulationResults || simulationResults.length === 0) return [];
    
    const data = [];
    const step = Math.max(1, Math.ceil(timeHorizon / 50));
    
    for (let day = 0; day <= timeHorizon; day += step) {
      const values = simulationResults
        .map(path => path[day] ? path[day].value : null)
        .filter(v => v !== null && v !== undefined)
        .sort((a, b) => a - b);
      
      if (values.length > 0) {
        data.push({
          day,
          p10: values[Math.floor(values.length * 0.1)] || values[0],
          p25: values[Math.floor(values.length * 0.25)] || values[0],
          p50: values[Math.floor(values.length * 0.5)] || values[0],
          p75: values[Math.floor(values.length * 0.75)] || values[0],
          p90: values[Math.floor(values.length * 0.9)] || values[0],
        });
      }
    }
    return data;
  }, [simulationResults, timeHorizon]);

  // Sample paths for individual simulation comparison
  const samplePathsData = useMemo(() => {
    if (!simulationResults || simulationResults.length === 0) return [];
    
    // Select 10 diverse sample paths (evenly distributed across outcomes)
    const finalValues = simulationResults.map((path, idx) => ({
      idx,
      finalValue: path[path.length - 1]?.value || 0
    })).sort((a, b) => a.finalValue - b.finalValue);
    
    const numSamples = 10;
    const step = Math.floor(finalValues.length / numSamples);
    const selectedIndices = Array.from({ length: numSamples }, (_, i) => 
      finalValues[Math.min(i * step, finalValues.length - 1)].idx
    );
    
    // Build data for line chart - use path0, path1, etc. to match chart
    const dayStep = Math.max(1, Math.ceil(timeHorizon / 60));
    const data = [];
    
    for (let day = 0; day <= timeHorizon; day += dayStep) {
      const point = { day };
      selectedIndices.forEach((simIdx, i) => {
        const path = simulationResults[simIdx];
        point[`path${i}`] = path[day]?.value || null;
      });
      data.push(point);
    }
    
    return data;
  }, [simulationResults, timeHorizon]);

  const distributionData = useMemo(() => {
    if (!simulationResults || simulationResults.length === 0 || !riskMetrics) return [];
    
    const finalValues = simulationResults
      .map(path => {
        const lastPoint = path[path.length - 1];
        return lastPoint ? lastPoint.value : null;
      })
      .filter(v => v !== null && v !== undefined);
    
    if (finalValues.length === 0) return [];
    
    const min = Math.min(...finalValues);
    const max = Math.max(...finalValues);
    const bins = 40;
    const binSize = (max - min) / bins;
    
    if (binSize === 0) return [];
    
    const histogram = Array(bins).fill(0);
    finalValues.forEach(v => {
      const bin = Math.min(Math.floor((v - min) / binSize), bins - 1);
      histogram[bin]++;
    });
    
    return histogram.map((count, i) => ({
      value: min + i * binSize + binSize / 2,
      frequency: count
    }));
  }, [simulationResults, riskMetrics]);

  const correlationData = useMemo(() => {
    if (!portfolio.length) return null;
    const tickers = portfolio.map(p => p.ticker).filter(t => t);
    if (tickers.length < 2) return null;
    return generateCorrelationMatrix(tickers);
  }, [portfolio]);

  // Pie chart data for portfolio allocation
  const pieChartData = useMemo(() => {
    const COLORS = ['#e11d48', '#f43f5e', '#fb7185', '#fda4af', '#10b981', '#3b82f6', '#8b5cf6', '#f59e0b'];
    return portfolio
      .filter(p => p.ticker && p.weight > 0)
      .map((p, idx) => ({
        name: p.ticker,
        value: p.weight * 100,
        color: COLORS[idx % COLORS.length]
      }));
  }, [portfolio]);
  
  // Comparison pie chart
  const comparisonPieData = useMemo(() => {
    const COLORS = ['#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#10b981', '#8b5cf6', '#f59e0b', '#e11d48'];
    return comparisonPortfolio
      .filter(p => p.ticker && p.weight > 0)
      .map((p, idx) => ({
        name: p.ticker,
        value: p.weight * 100,
        color: COLORS[idx % COLORS.length]
      }));
  }, [comparisonPortfolio]);

  // Efficient Frontier calculation
  const efficientFrontierData = useMemo(() => {
    if (!showEfficientFrontier || !riskMetrics) return [];
    
    // Generate random portfolio combinations for efficient frontier visualization
    const points = [];
    const tickers = portfolio.map(p => p.ticker).filter(t => t);
    
    // Generate 50 random portfolio allocations
    for (let i = 0; i < 50; i++) {
      const randomWeights = tickers.map(() => Math.random());
      const sum = randomWeights.reduce((a, b) => a + b, 0);
      const normalizedWeights = randomWeights.map(w => w / sum);
      
      // Calculate expected return and volatility for this allocation
      let expectedReturn = 0;
      let variance = 0;
      
      normalizedWeights.forEach((w, idx) => {
        const params = assetDatabase[tickers[idx]] || { mean: 0.0003, vol: 0.012 };
        expectedReturn += w * params.mean * 252 * 100; // Annualized
        variance += Math.pow(w * params.vol * Math.sqrt(252) * 100, 2);
      });
      
      points.push({
        volatility: Math.sqrt(variance),
        return: expectedReturn,
        weights: normalizedWeights.map((w, i) => `${tickers[i]}: ${(w * 100).toFixed(0)}%`).join(', ')
      });
    }
    
    // Add current portfolio point
    points.push({
      volatility: riskMetrics.volatility,
      return: riskMetrics.mean,
      isCurrent: true,
      weights: 'Current Portfolio'
    });
    
    // Add comparison portfolio if available
    if (comparisonRiskMetrics) {
      points.push({
        volatility: comparisonRiskMetrics.volatility,
        return: comparisonRiskMetrics.mean,
        isComparison: true,
        weights: 'Comparison Portfolio'
      });
    }
    
    return points;
  }, [showEfficientFrontier, riskMetrics, comparisonRiskMetrics, portfolio]);

  // Fetch benchmark data when ticker changes or simulation runs
  useEffect(() => {
    const fetchBenchmarkData = async () => {
      if (!simulationResults || !benchmarkTicker || !backendConnected) {
        // Use fallback from assetDatabase when backend unavailable
        const fallbackParams = assetDatabase[benchmarkTicker] || { mean: 0.0003, vol: 0.012 };
        setBenchmarkData({
          mean: fallbackParams.mean * 252 * 100, // Annualized return %
          volatility: fallbackParams.vol * Math.sqrt(252) * 100, // Annualized volatility %
          ticker: benchmarkTicker,
          source: 'fallback'
        });
        return;
      }
      
      try {
        // Fetch real historical data for benchmark using same time horizon as portfolio
        const params = await fetchAssetParameters(benchmarkTicker, timeHorizon);
        setBenchmarkData({
          mean: params.mean * 100, // Already annualized from backend, convert to %
          volatility: params.vol * 100, // Already annualized from backend, convert to %
          ticker: benchmarkTicker,
          source: 'backend',
          dataPoints: params.dataPoints,
          weighted: params.weighted
        });
      } catch (error) {
        console.warn('Failed to fetch benchmark data, using fallback:', error);
        // Use fallback from assetDatabase
        const fallbackParams = assetDatabase[benchmarkTicker] || { mean: 0.0003, vol: 0.012 };
        setBenchmarkData({
          mean: fallbackParams.mean * 252 * 100,
          volatility: fallbackParams.vol * Math.sqrt(252) * 100,
          ticker: benchmarkTicker,
          source: 'fallback'
        });
      }
    };
    
    fetchBenchmarkData();
  }, [simulationResults, benchmarkTicker, backendConnected, timeHorizon]);

  // Benchmark simulation for comparison (use benchmarkData state)
  const benchmarkSimulation = useMemo(() => {
    if (!simulationResults || !benchmarkTicker) return null;
    
    // Use real benchmark data if available, otherwise use assetDatabase
    if (benchmarkData) {
      return benchmarkData;
    }
    
    // Fallback to hardcoded values
    const benchmarkParams = assetDatabase[benchmarkTicker] || { mean: 0.0003, vol: 0.012 };
    return {
      mean: benchmarkParams.mean * 252 * 100,
      volatility: benchmarkParams.vol * Math.sqrt(252) * 100,
      ticker: benchmarkTicker
    };
  }, [simulationResults, benchmarkTicker, benchmarkData]);

  // Page transition variants for Framer Motion - minimal transitions to avoid flash
  const pageVariants = {
    initial: { opacity: 1 },
    animate: { opacity: 1 },
    exit: { opacity: 1 }
  };

  // ============================================================================
  // INPUT VIEW
  // ============================================================================
  
  if (view === 'input') {
    return (
      <div 
        key="input"
        className={`min-h-screen ${colors.bg} ${colors.text} p-6`}
      >
        {/* Backend Connection Status Banner */}
        {!backendConnected && (
          <div className="fixed top-0 left-0 right-0 z-50 bg-red-500 text-white px-4 py-2 flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              <span className="text-sm font-medium">Backend connection lost. Some features may not work.</span>
            </div>
            <button
              onClick={async () => {
                setIsCheckingConnection(true);
                try {
                  const connected = await checkApiHealth();
                  setBackendConnected(connected);
                  if (connected) {
                    toast.success('Connection restored!');
                  } else {
                    toast.error('Still unable to connect. Please check if the backend server is running.');
                  }
                } catch (error) {
                  toast.error('Connection check failed.');
                } finally {
                  setIsCheckingConnection(false);
                }
              }}
              disabled={isCheckingConnection}
              className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded text-xs font-medium disabled:opacity-50"
            >
              {isCheckingConnection ? 'Checking...' : 'Retry'}
            </button>
          </div>
        )}
        <div className="max-w-6xl mx-auto" style={{ marginTop: !backendConnected ? '3rem' : '0' }}>
          {/* Header with Auth and Theme Toggle */}
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></div>
              <span className={`text-xs ${colors.textSubtle} font-mono`}>LIVE</span>
              
              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className={`p-2 ${colors.buttonSecondary} rounded-lg transition-all border`}
                title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-500" />}
              </button>
            </div>
            <div className="flex items-center gap-2">
              {/* Comparison Mode Toggle */}
              <button
                onClick={() => setComparisonMode(!comparisonMode)}
                className={`px-4 py-2 ${comparisonMode ? 'bg-blue-600 border-blue-500' : colors.buttonSecondary} rounded-lg transition-all border flex items-center gap-2 text-sm`}
              >
                <GitCompare className={`w-4 h-4 ${comparisonMode ? 'text-white' : colors.accent}`} />
                <span className={comparisonMode ? 'text-white' : colors.textMuted}>Compare</span>
              </button>
              
              {isAuthenticated ? (
                <>
                  <button
                    onClick={() => setShowSavedPortfolios(!showSavedPortfolios)}
                    className={`px-4 py-2 ${colors.card} rounded-lg transition-all border flex items-center gap-2 text-sm`}
                  >
                    <FolderOpen className={`w-4 h-4 ${colors.accent}`} />
                    <span className={colors.textMuted}>Portfolios</span>
                  </button>
                  <div className={`flex items-center gap-2 px-4 py-2 ${colors.card} rounded-lg border`}>
                    <User className={`w-4 h-4 ${colors.accent}`} />
                    <span className={`text-sm ${colors.textMuted}`}>{user.name}</span>
                  </div>
                  <button onClick={logout} className={`p-2 ${isDark ? 'hover:bg-zinc-800' : 'hover:bg-gray-200'} rounded-lg transition-all`} title="Logout">
                    <LogOut className={`w-4 h-4 ${colors.textMuted} hover:text-rose-400`} />
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setShowAuthModal(true)}
                  className={`px-5 py-2 ${colors.button} rounded-lg transition-all duration-200 font-medium flex items-center gap-2 text-sm shadow-lg shadow-rose-900/30 text-white`}
                >
                  <User className="w-4 h-4" />
                  Sign In
                </button>
              )}
            </div>
          </div>

          {/* Title */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-rose-400 via-red-400 to-rose-500 bg-clip-text text-transparent">
              PortfolioPath Pro
            </h1>
            <p className={`${colors.textMuted} font-light text-sm tracking-wide`}>
              Monte Carlo Simulation Engine • Quantitative Risk Analytics
            </p>
          </div>

          {/* Saved Portfolios Panel */}
          {showSavedPortfolios && isAuthenticated && (
            <SavedPortfolios
              onLoadPortfolio={loadPortfolio}
              currentPortfolio={getCurrentPortfolioData()}
              onClose={() => setShowSavedPortfolios(false)}
            />
          )}

          {/* Preset Portfolio Templates */}
          <div className={`mb-4 ${colors.card} rounded-xl p-4 border`}>
            <h3 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${colors.text}`}>
              <Package className="w-4 h-4 text-rose-400" />
              Quick Start Templates
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
              {Object.entries(PRESET_PORTFOLIOS).map(([key, preset]) => (
                <button
                  key={key}
                  onClick={() => applyPreset(key)}
                  className={`p-3 rounded-lg border transition-all text-left ${
                    selectedPreset === key 
                      ? 'bg-rose-600/20 border-rose-500/50 ring-1 ring-rose-500/30' 
                      : `${colors.buttonSecondary} hover:border-rose-500/30`
                  }`}
                >
                  <div className={`text-xs font-medium ${selectedPreset === key ? 'text-rose-400' : colors.text}`}>
                    {preset.name}
                  </div>
                  <div className={`text-xs ${colors.textSubtle} mt-1`}>{preset.risk}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Stress Test Scenarios */}
          <div className={`mb-4 ${colors.card} rounded-xl p-4 border`}>
            <h3 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${colors.text}`}>
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Stress Test Scenarios
            </h3>
            <div className="flex flex-wrap gap-2">
              {Object.entries(STRESS_SCENARIOS).map(([key, scenario]) => (
                <button
                  key={key}
                  onClick={() => applyStressScenario(key)}
                  className={`px-4 py-2 rounded-lg border transition-all flex items-center gap-2 ${
                    activeStressScenario === key 
                      ? 'bg-amber-600/20 border-amber-500/50 ring-1 ring-amber-500/30' 
                      : `${colors.buttonSecondary} hover:border-amber-500/30`
                  }`}
                >
                  <span>{scenario.icon}</span>
                  <span className={`text-sm ${activeStressScenario === key ? 'text-amber-400' : colors.text}`}>
                    {scenario.name}
                  </span>
                </button>
              ))}
            </div>
            {activeStressScenario !== 'normal' && (
              <div className={`mt-3 p-2 rounded-lg ${isDark ? 'bg-amber-900/20' : 'bg-amber-50'} border border-amber-500/30`}>
                <p className={`text-xs ${colors.textMuted}`}>
                  <span className="text-amber-400 font-medium">Active:</span> {STRESS_SCENARIOS[activeStressScenario].description}
                </p>
              </div>
            )}
          </div>

          {/* Main Grid Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Portfolio Config - Left Panel */}
            <div className="lg:col-span-2 bg-zinc-900/50 backdrop-blur-xl rounded-xl p-6 border border-zinc-800/50">
              <h2 className="text-lg font-semibold mb-5 flex items-center gap-2 text-zinc-200">
                <Target className="w-5 h-5 text-rose-400" />
                Portfolio Configuration
              </h2>

              <div className="grid grid-cols-2 gap-4 mb-5">
                <div>
                  <label className="block text-xs font-medium mb-2 text-zinc-400 uppercase tracking-wider">Initial Capital</label>
                  <input
                    type="number"
                    value={initialValue}
                    onChange={(e) => setInitialValue(parseFloat(e.target.value) || 0)}
                    className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-4 py-2.5 text-zinc-100 placeholder-zinc-500 focus:ring-1 focus:ring-rose-500/50 focus:border-rose-500/50 focus:outline-none transition-all text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-2 text-zinc-400 uppercase tracking-wider">Simulations</label>
                  <input
                    type="number"
                    value={numSimulations}
                    onChange={(e) => setNumSimulations(Math.max(100, Math.min(10000, parseInt(e.target.value) || 1000)))}
                    className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-4 py-2.5 text-zinc-100 placeholder-zinc-500 focus:ring-1 focus:ring-rose-500/50 focus:border-rose-500/50 focus:outline-none transition-all text-sm font-mono"
                  />
                </div>
              </div>

              <div className="mb-5">
                <label className="block text-xs font-medium mb-2 text-zinc-400 uppercase tracking-wider">Time Horizon (Days) — Default 252 (1 year)</label>
                <input
                  type="number"
                  value={timeHorizon}
                  onChange={(e) => setTimeHorizon(Math.max(1, Math.min(1000, parseInt(e.target.value) || 252)))}
                  min="1"
                  max="1000"
                  className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-4 py-2.5 text-zinc-100 placeholder-zinc-500 focus:ring-1 focus:ring-rose-500/50 focus:border-rose-500/50 focus:outline-none transition-all text-sm font-mono"
                />
                <div className="mt-2 h-1 bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-rose-500 to-red-500 transition-all" style={{ width: `${(timeHorizon / 1000) * 100}%` }}></div>
                </div>
              </div>

              {/* Asset Allocation */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-3">
                  <label className={`text-xs font-medium ${colors.textMuted} uppercase tracking-wider`}>Asset Allocation</label>
                  <span className={`text-xs font-mono ${Math.abs(totalWeight - 1) < 0.01 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    Σ {(totalWeight * 100).toFixed(1)}% {Math.abs(totalWeight - 1) < 0.01 ? '✓' : ''}
                  </span>
                </div>
                <div className="space-y-2">
                  {portfolio.map((pos, idx) => (
                    <TickerInput
                      key={idx}
                      value={pos.ticker}
                      onChange={(val) => updatePosition(idx, 'ticker', val)}
                      weight={pos.weight}
                      onWeightChange={(val) => updatePosition(idx, 'weight', val)}
                      onRemove={() => removePosition(idx)}
                      isDark={isDark}
                    />
                  ))}
                </div>
                <button
                  onClick={addPosition}
                  className={`w-full mt-3 py-2 ${colors.buttonSecondary} rounded-lg transition-all border border-dashed ${colors.textMuted} hover:${colors.text} text-sm`}
                >
                  + Add Position
                </button>
              </div>
              
              {/* Pie Chart Allocation Visualization */}
              {pieChartData.length > 0 && (
                <div className={`mt-4 p-4 ${isDark ? 'bg-zinc-800/30' : 'bg-gray-50'} rounded-lg`}>
                  <h3 className={`text-xs font-medium ${colors.textMuted} uppercase tracking-wider mb-3`}>Allocation Breakdown</h3>
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width={120} height={120}>
                      <PieChart>
                        <Pie
                          data={pieChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={30}
                          outerRadius={50}
                          dataKey="value"
                          stroke="none"
                        >
                          {pieChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex-1 space-y-1">
                      {pieChartData.map((entry, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-xs">
                          <div className="w-3 h-3 rounded" style={{ backgroundColor: entry.color }}></div>
                          <span className={colors.text}>{entry.name}</span>
                          <span className={`ml-auto font-mono ${colors.textMuted}`}>{entry.value.toFixed(1)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Model Settings - Right Panel */}
            <div className="bg-zinc-900/50 backdrop-blur-xl rounded-xl p-6 border border-zinc-800/50">
              <h2 className="text-lg font-semibold mb-5 flex items-center gap-2 text-zinc-200">
                <Zap className="w-5 h-5 text-rose-400" />
                Model Parameters
              </h2>

              <div className="space-y-3">
                {[
                  { key: 'useCorrelation', label: 'Correlation Matrix', desc: 'Cholesky decomposition' },
                  { key: 'useFatTails', label: 'Fat Tails', desc: 'Student-t distribution' },
                  { key: 'useGARCH', label: 'GARCH(1,1)', desc: 'Volatility clustering' },
                  { key: 'useRegimeSwitching', label: 'Regime Switching', desc: 'Bull/Bear Markov' },
                  { key: 'useJumpDiffusion', label: 'Jump Diffusion', desc: 'Merton model' },
                  { key: 'useMeanReversion', label: 'Mean Reversion', desc: 'Ornstein-Uhlenbeck' },
                ].map(({ key, label, desc }) => (
                  <label key={key} className={`flex items-center justify-between p-3 ${isDark ? 'bg-zinc-800/30 border-zinc-700/30 hover:bg-zinc-800/50' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'} rounded-lg cursor-pointer transition-all border`}>
                    <div>
                      <div className={`text-sm font-medium ${colors.text}`}>{label}</div>
                      <div className={`text-xs ${colors.textSubtle}`}>{desc}</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={advancedOptions[key] || false}
                      onChange={(e) => setAdvancedOptions({...advancedOptions, [key]: e.target.checked})}
                      className="w-4 h-4 accent-rose-500 rounded"
                    />
                  </label>
                ))}
              </div>

              <button
                onClick={() => setView('scenarios')}
                className={`w-full mt-4 py-2.5 ${colors.buttonSecondary} rounded-lg transition-all border ${colors.textMuted} text-sm font-medium`}
              >
                Scenario Testing →
              </button>
            </div>
          </div>

          {/* Comparison Portfolio Section */}
          <AnimatePresence>
            {comparisonMode && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className={`mt-4 ${colors.card} rounded-xl p-6 border`}>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className={`text-lg font-semibold flex items-center gap-2 ${colors.text}`}>
                      <GitCompare className="w-5 h-5 text-blue-400" />
                      Comparison Portfolio
                    </h2>
                    <span className={`text-xs font-mono ${Math.abs(totalComparisonWeight - 1) < 0.01 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      Σ {(totalComparisonWeight * 100).toFixed(1)}%
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      {comparisonPortfolio.map((pos, idx) => (
                        <TickerInput
                          key={idx}
                          value={pos.ticker}
                          onChange={(val) => updateComparisonPosition(idx, 'ticker', val)}
                          weight={pos.weight}
                          onWeightChange={(val) => updateComparisonPosition(idx, 'weight', val)}
                          onRemove={() => removeComparisonPosition(idx)}
                          isDark={isDark}
                        />
                      ))}
                      <button
                        onClick={addComparisonPosition}
                        className={`w-full py-2 ${colors.buttonSecondary} rounded-lg transition-all border border-dashed ${colors.textMuted} text-sm`}
                      >
                        + Add Position
                      </button>
                    </div>
                    
                    {/* Comparison Pie Chart */}
                    {comparisonPieData.length > 0 && (
                      <div className={`p-4 ${isDark ? 'bg-zinc-800/30' : 'bg-gray-50'} rounded-lg`}>
                        <div className="flex items-center gap-4">
                          <ResponsiveContainer width={100} height={100}>
                            <PieChart>
                              <Pie
                                data={comparisonPieData}
                                cx="50%"
                                cy="50%"
                                innerRadius={25}
                                outerRadius={45}
                                dataKey="value"
                                stroke="none"
                              >
                                {comparisonPieData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="flex-1 space-y-1">
                            {comparisonPieData.map((entry, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-xs">
                                <div className="w-3 h-3 rounded" style={{ backgroundColor: entry.color }}></div>
                                <span className={colors.text}>{entry.name}</span>
                                <span className={`ml-auto font-mono ${colors.textMuted}`}>{entry.value.toFixed(1)}%</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Analysis Options */}
          <div className={`p-4 ${colors.card} ${colors.border} rounded-xl mb-4`}>
            <h3 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${colors.text}`}>
              <Settings className="w-4 h-4 text-rose-400" />
              Analysis Options
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Show Efficient Frontier */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showEfficientFrontier}
                  onChange={(e) => setShowEfficientFrontier(e.target.checked)}
                  className="w-4 h-4 accent-rose-500 rounded"
                />
                <span className={`text-sm ${colors.text}`}>Efficient Frontier</span>
              </label>
              
              {/* Benchmark Input */}
              <div className="col-span-2 flex items-center gap-2">
                <span className={`text-sm ${colors.textMuted}`}>Benchmark:</span>
                <input
                  type="text"
                  value={benchmarkTicker}
                  onChange={(e) => setBenchmarkTicker(e.target.value.toUpperCase())}
                  placeholder="SPY"
                  className={`w-20 px-2 py-1 ${colors.input} ${colors.border} rounded text-sm font-mono ${colors.text}`}
                />
                <span className={`text-xs ${colors.textMuted}`}>(for alpha comparison)</span>
              </div>
            </div>
          </div>

          {/* Goal Target Input */}
          <div className={`p-4 ${colors.card} ${colors.border} rounded-xl mb-4`}>
            <h3 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${colors.text}`}>
              <Crosshair className="w-4 h-4 text-emerald-400" />
              Goal Planning
            </h3>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className={`text-xs ${colors.textMuted} uppercase tracking-wider`}>Target Amount</label>
                <div className="flex items-center mt-1">
                  <span className={`${colors.textMuted} mr-2`}>$</span>
                  <input
                    type="number"
                    value={goalAmount}
                    onChange={(e) => setGoalAmount(parseFloat(e.target.value) || 0)}
                    className={`flex-1 px-3 py-2 ${colors.input} ${colors.border} rounded-lg text-sm font-mono ${colors.text}`}
                    placeholder="15000"
                  />
                </div>
              </div>
              <div className="text-center">
                <div className={`text-xs ${colors.textMuted} uppercase tracking-wider`}>Goal vs Initial</div>
                <div className={`text-lg font-bold ${goalAmount > initialValue ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {goalAmount > 0 ? `+${(((goalAmount - initialValue) / initialValue) * 100).toFixed(0)}%` : '0%'}
                </div>
              </div>
            </div>
          </div>

          {/* Run Simulation Button */}
          <button
            onClick={runSimulation}
            disabled={isSimulating}
            className={`w-full mt-6 py-4 ${colors.button} rounded-xl transition-all duration-200 font-bold text-lg shadow-xl shadow-rose-900/30 hover:shadow-rose-600/40 border border-rose-500/30 text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3`}
          >
            {isSimulating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Running Simulations... {simulationProgress}%</span>
              </>
            ) : (
              <>
                {comparisonMode ? 'Run Comparison Simulation' : 'Run Monte Carlo Simulation'}
              </>
            )}
          </button>
          
          {/* Progress bar during simulation */}
          {isSimulating && (
            <div className="mt-3">
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-rose-500 to-red-500 transition-all duration-200"
                  style={{ width: `${simulationProgress}%` }}
                />
              </div>
              <p className={`text-xs ${colors.textMuted} mt-2 text-center`}>
                Processing {numSimulations.toLocaleString()} simulations over {timeHorizon} days...
              </p>
            </div>
          )}
        </div>
        
        {/* Auth Modal */}
        <AuthModal 
          isOpen={showAuthModal} 
          onClose={() => setShowAuthModal(false)}
        />
      </div>
    );
  }

  // ============================================================================
  // SCENARIOS VIEW
  // ============================================================================
  
  if (view === 'scenarios') {
    return (
      <div 
        key="scenarios"
        className={`min-h-screen ${colors.bg} ${colors.text} p-6`}
      >
        <div className="max-w-3xl mx-auto">
          <button
            onClick={() => setView('input')}
            className="mb-6 px-5 py-2 bg-zinc-900/80 hover:bg-zinc-800 backdrop-blur-xl rounded-lg transition-all border border-zinc-700/50 text-zinc-300 text-sm"
          >
            ← Back
          </button>

          <div className="bg-zinc-900/50 backdrop-blur-xl rounded-xl p-6 border border-zinc-800/50">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-zinc-200">
              <Settings className="w-5 h-5 text-rose-400" />
              Scenario Testing
            </h2>

            <p className="text-zinc-400 mb-6 text-sm">
              Apply stress scenarios to adjust simulation parameters.
            </p>

            <div className="space-y-3">
              {[
                { key: 'recession', label: 'Recession', desc: 'Returns -30%, higher correlation' },
                { key: 'volatilitySpike', label: 'Volatility Spike', desc: 'Volatility +50%' },
                { key: 'bullMarket', label: 'Bull Market', desc: 'Returns +30%' },
              ].map(({ key, label, desc }) => (
                <label key={key} className="flex items-center justify-between p-3 bg-zinc-800/30 rounded-lg cursor-pointer hover:bg-zinc-800/50 transition-all border border-zinc-700/30">
                  <div>
                    <div className="text-sm font-medium text-zinc-200">{label}</div>
                    <div className="text-xs text-zinc-500">{desc}</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={scenarios[key] || false}
                    onChange={(e) => setScenarios({ ...scenarios, [key]: e.target.checked })}
                    className="w-4 h-4 accent-rose-500 rounded"
                  />
                </label>
              ))}
            </div>

            <button
              onClick={() => setView('input')}
              className="w-full mt-5 py-3 bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-500 hover:to-red-600 rounded-lg transition-all font-medium shadow-lg shadow-rose-900/30"
            >
              Apply Scenarios
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // RESULTS VIEW
  // ============================================================================
  
  if (view === 'results' && simulationResults && riskMetrics) {
    // Calculate dynamic percentile value
    const dynamicPercentileValue = (() => {
      if (!simulationResults?.finalValues) return null;
      const sorted = [...simulationResults.finalValues].sort((a, b) => a - b);
      const idx = Math.floor((selectedPercentile / 100) * sorted.length);
      return sorted[Math.min(idx, sorted.length - 1)];
    })();

    return (
      <div 
        className={`min-h-screen ${colors.bg} ${colors.text} p-4`}
      >
        <div className="max-w-7xl mx-auto">
          {/* Header with Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <button
              onClick={() => setView('input')}
              className={`px-4 py-2 ${colors.card} hover:bg-zinc-800 dark:hover:bg-zinc-200 backdrop-blur-xl rounded-lg transition-all ${colors.border} text-sm`}
            >
              ← New Simulation
            </button>

            <div className="flex items-center gap-3">
              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className={`p-2 ${colors.card} ${colors.border} rounded-lg hover:bg-zinc-800 transition-all`}
                title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              >
                {isDark ? <Sun className="w-4 h-4 text-yellow-400" /> : <Moon className="w-4 h-4 text-zinc-600" />}
              </button>

              {/* Percentile Slider */}
              <div className={`flex items-center gap-2 px-3 py-2 ${colors.card} ${colors.border} rounded-lg`}>
                <Sliders className="w-4 h-4 text-rose-400" />
                <span className="text-xs text-zinc-400">Percentile:</span>
                <input
                  type="range"
                  min="1"
                  max="99"
                  value={selectedPercentile}
                  onChange={(e) => setSelectedPercentile(parseInt(e.target.value))}
                  className="w-20 accent-rose-500"
                />
                <span className="text-sm font-mono text-rose-400 w-8">{selectedPercentile}%</span>
              </div>

              {/* Export Buttons */}
              <button
                onClick={() => exportToCSV(simulationResults, riskMetrics, portfolio, initialValue)}
                className={`flex items-center gap-2 px-3 py-2 ${colors.card} ${colors.border} rounded-lg hover:bg-zinc-800 transition-all text-sm`}
                title="Export to CSV"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span className="hidden sm:inline">CSV</span>
              </button>
              <button
                onClick={() => exportToPDF(simulationResults, riskMetrics, portfolio, initialValue)}
                className={`flex items-center gap-2 px-3 py-2 ${colors.card} ${colors.border} rounded-lg hover:bg-zinc-800 transition-all text-sm`}
                title="Export to PDF"
              >
                <Download className="w-4 h-4 text-rose-400" />
                <span className="hidden sm:inline">PDF</span>
              </button>
            </div>
          </div>

          {/* Dynamic Percentile Display */}
          {dynamicPercentileValue && (
            <div className={`mb-4 p-3 ${colors.card} ${colors.border} rounded-lg`}>
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-400">
                  At the <span className="text-rose-400 font-bold">{selectedPercentile}th</span> percentile, your portfolio would be worth:
                </span>
                <span className="text-xl font-bold text-rose-400">
                  ${dynamicPercentileValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </div>
              <div className="text-xs text-zinc-500 mt-1">
                This means {selectedPercentile}% of simulations ended at or below this value
              </div>
            </div>
          )}

          {/* Goal Probability Card */}
          {goalProbability && goalAmount > 0 && (
            <div className={`mb-4 p-4 ${colors.card} ${colors.border} rounded-lg`}>
              <h3 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${colors.text}`}>
                <Crosshair className="w-4 h-4 text-emerald-400" />
                Goal Probability Analysis
              </h3>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className={`p-3 rounded-lg ${parseFloat(goalProbability.probability) >= 70 ? 'bg-emerald-900/20 border-emerald-800/50' : parseFloat(goalProbability.probability) >= 40 ? 'bg-amber-900/20 border-amber-800/50' : 'bg-red-900/20 border-red-800/50'} border`}>
                  <span className={`text-xs ${colors.muted}`}>Probability of Reaching ${goalAmount.toLocaleString()}</span>
                  <p className={`text-3xl font-bold ${parseFloat(goalProbability.probability) >= 70 ? 'text-emerald-400' : parseFloat(goalProbability.probability) >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
                    {goalProbability.probability}%
                  </p>
                </div>
                <div className={`p-3 ${isDark ? 'bg-zinc-800/30' : 'bg-gray-100'} rounded-lg`}>
                  <span className={`text-xs ${colors.muted}`}>Successful Simulations</span>
                  <p className={`text-xl font-bold ${colors.text}`}>
                    {goalProbability.successCount.toLocaleString()} / {goalProbability.totalSimulations.toLocaleString()}
                  </p>
                </div>
                <div className={`p-3 ${isDark ? 'bg-zinc-800/30' : 'bg-gray-100'} rounded-lg`}>
                  <span className={`text-xs ${colors.muted}`}>Target Return Needed</span>
                  <p className={`text-xl font-bold ${colors.text}`}>
                    +{(((goalAmount - initialValue) / initialValue) * 100).toFixed(1)}%
                  </p>
                </div>
                <div className={`p-3 ${isDark ? 'bg-zinc-800/30' : 'bg-gray-100'} rounded-lg`}>
                  <span className={`text-xs ${colors.muted}`}>Median Outcome</span>
                  <p className={`text-xl font-bold ${riskMetrics.percentiles.p50 >= goalAmount ? 'text-emerald-400' : 'text-amber-400'}`}>
                    ${riskMetrics.percentiles.p50.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                </div>
              </div>
              {/* Probability gauge */}
              <div className="mt-4">
                <div className="flex justify-between text-xs text-zinc-500 mb-1">
                  <span>0%</span>
                  <span>50%</span>
                  <span>100%</span>
                </div>
                <div className="h-3 bg-zinc-800 rounded-full overflow-hidden relative">
                  <div 
                    className={`h-full transition-all duration-500 ${
                      parseFloat(goalProbability.probability) >= 70 
                        ? 'bg-gradient-to-r from-emerald-600 to-emerald-400' 
                        : parseFloat(goalProbability.probability) >= 40 
                          ? 'bg-gradient-to-r from-amber-600 to-amber-400'
                          : 'bg-gradient-to-r from-red-600 to-red-400'
                    }`}
                    style={{ width: `${goalProbability.probability}%` }}
                  />
                  <div className="absolute top-0 left-1/2 w-0.5 h-full bg-zinc-600" />
                </div>
                <p className={`text-xs ${colors.textMuted} mt-2 text-center`}>
                  {parseFloat(goalProbability.probability) >= 70 
                    ? '✅ Strong likelihood of reaching your goal' 
                    : parseFloat(goalProbability.probability) >= 40 
                      ? '⚠️ Moderate chance - consider adjusting strategy'
                      : '❌ Low probability - increase time horizon or adjust allocation'}
                </p>
              </div>
            </div>
          )}

          {/* Key Metrics Row - Main Portfolio */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <div className={`${colors.card} backdrop-blur-xl rounded-lg p-4 ${colors.border}`}>
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-rose-400" />
                <span className={`text-xs ${colors.muted} uppercase tracking-wide`}>Expected Return</span>
              </div>
              <p className="text-2xl font-bold text-rose-400">{riskMetrics.mean.toFixed(2)}%</p>
            </div>

            <div className={`${colors.card} backdrop-blur-xl rounded-lg p-4 ${colors.border}`}>
              <div className="flex items-center gap-2 mb-1">
                <Activity className="w-4 h-4 text-rose-400" />
                <span className={`text-xs ${colors.muted} uppercase tracking-wide`}>Volatility</span>
              </div>
              <p className={`text-2xl font-bold ${colors.text}`}>{riskMetrics.volatility.toFixed(2)}%</p>
            </div>

            <div className={`${colors.card} backdrop-blur-xl rounded-lg p-4 border border-red-900/50`}>
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <span className={`text-xs ${colors.muted} uppercase tracking-wide`}>VaR (95%)</span>
              </div>
              <p className="text-2xl font-bold text-red-400">{riskMetrics.var95.toFixed(2)}%</p>
            </div>

            <div className={`${colors.card} backdrop-blur-xl rounded-lg p-4 ${colors.border}`}>
              <div className="flex items-center gap-2 mb-1">
                <BarChart3 className="w-4 h-4 text-rose-400" />
                <span className={`text-xs ${colors.muted} uppercase tracking-wide`}>Sharpe Ratio</span>
              </div>
              <p className={`text-2xl font-bold ${colors.text}`}>{riskMetrics.sharpeRatio.toFixed(3)}</p>
            </div>
          </div>

          {/* Comparison Portfolio Metrics */}
          {comparisonMode && comparisonRiskMetrics && (
            <div className={`mb-4 p-4 ${colors.card} ${colors.border} rounded-lg`}>
              <h3 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${colors.text}`}>
                <Scale className="w-4 h-4 text-blue-400" />
                Comparison Portfolio Results
              </h3>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-3 bg-blue-900/20 rounded-lg border border-blue-800/50">
                  <span className={`text-xs ${colors.muted}`}>Expected Return</span>
                  <p className="text-xl font-bold text-blue-400">{comparisonRiskMetrics.mean.toFixed(2)}%</p>
                  <span className={`text-xs ${comparisonRiskMetrics.mean > riskMetrics.mean ? 'text-emerald-400' : 'text-red-400'}`}>
                    {comparisonRiskMetrics.mean > riskMetrics.mean ? '↑' : '↓'} {Math.abs(comparisonRiskMetrics.mean - riskMetrics.mean).toFixed(2)}%
                  </span>
                </div>
                <div className="p-3 bg-blue-900/20 rounded-lg border border-blue-800/50">
                  <span className={`text-xs ${colors.muted}`}>Volatility</span>
                  <p className="text-xl font-bold text-blue-400">{comparisonRiskMetrics.volatility.toFixed(2)}%</p>
                  <span className={`text-xs ${comparisonRiskMetrics.volatility < riskMetrics.volatility ? 'text-emerald-400' : 'text-red-400'}`}>
                    {comparisonRiskMetrics.volatility < riskMetrics.volatility ? '↓' : '↑'} {Math.abs(comparisonRiskMetrics.volatility - riskMetrics.volatility).toFixed(2)}%
                  </span>
                </div>
                <div className="p-3 bg-blue-900/20 rounded-lg border border-blue-800/50">
                  <span className={`text-xs ${colors.muted}`}>VaR (95%)</span>
                  <p className="text-xl font-bold text-blue-400">{comparisonRiskMetrics.var95.toFixed(2)}%</p>
                </div>
                <div className="p-3 bg-blue-900/20 rounded-lg border border-blue-800/50">
                  <span className={`text-xs ${colors.muted}`}>Sharpe Ratio</span>
                  <p className="text-xl font-bold text-blue-400">{comparisonRiskMetrics.sharpeRatio.toFixed(3)}</p>
                  <span className={`text-xs ${comparisonRiskMetrics.sharpeRatio > riskMetrics.sharpeRatio ? 'text-emerald-400' : 'text-red-400'}`}>
                    {comparisonRiskMetrics.sharpeRatio > riskMetrics.sharpeRatio ? '↑' : '↓'} {Math.abs(comparisonRiskMetrics.sharpeRatio - riskMetrics.sharpeRatio).toFixed(3)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Benchmark Comparison */}
          {benchmarkSimulation && (
            <div className={`mb-4 p-4 ${colors.card} ${colors.border} rounded-lg`}>
              <h3 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${colors.text}`}>
                <Target className="w-4 h-4 text-amber-400" />
                Benchmark Comparison ({benchmarkTicker})
              </h3>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-3 bg-amber-900/20 rounded-lg border border-amber-800/50">
                  <span className={`text-xs ${colors.muted}`}>Benchmark Return</span>
                  <p className="text-xl font-bold text-amber-400">{benchmarkSimulation.mean.toFixed(2)}%</p>
                </div>
                <div className="p-3 bg-amber-900/20 rounded-lg border border-amber-800/50">
                  <span className={`text-xs ${colors.muted}`}>Benchmark Vol</span>
                  <p className="text-xl font-bold text-amber-400">{benchmarkSimulation.volatility.toFixed(2)}%</p>
                </div>
                <div className={`p-3 ${riskMetrics.mean > benchmarkSimulation.mean ? 'bg-emerald-900/20 border-emerald-800/50' : 'bg-red-900/20 border-red-800/50'} rounded-lg border`}>
                  <span className={`text-xs ${colors.muted}`}>Alpha (vs Benchmark)</span>
                  <p className={`text-xl font-bold ${riskMetrics.mean > benchmarkSimulation.mean ? 'text-emerald-400' : 'text-red-400'}`}>
                    {(riskMetrics.mean - benchmarkSimulation.mean).toFixed(2)}%
                  </p>
                </div>
                <div className="p-3 bg-amber-900/20 rounded-lg border border-amber-800/50">
                  <span className={`text-xs ${colors.muted}`}>Information Ratio</span>
                  <p className="text-xl font-bold text-amber-400">
                    {((riskMetrics.mean - benchmarkSimulation.mean) / Math.abs(riskMetrics.volatility - benchmarkSimulation.volatility || 1)).toFixed(3)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Main Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            {/* Fan Chart with Confidence Cone Effect */}
            <div className={`${colors.card} backdrop-blur-xl rounded-lg p-4 ${colors.border}`}>
              <h3 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${colors.text}`}>
                <BarChart3 className="w-4 h-4 text-rose-400" />
                Portfolio Value Projections (Confidence Cone)
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={fanChartData}>
                  <defs>
                    <linearGradient id="coneGradient90" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#be123c" stopOpacity={0.05}/>
                      <stop offset="100%" stopColor="#be123c" stopOpacity={0.15}/>
                    </linearGradient>
                    <linearGradient id="coneGradient75" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#e11d48" stopOpacity={0.1}/>
                      <stop offset="100%" stopColor="#e11d48" stopOpacity={0.25}/>
                    </linearGradient>
                    <linearGradient id="coneGradient50" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.2}/>
                      <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.4}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#27272a' : '#e7e5e4'} />
                  <XAxis dataKey="day" stroke={isDark ? '#71717a' : '#78716c'} tick={{ fontSize: 10 }} />
                  <YAxis stroke={isDark ? '#71717a' : '#78716c'} tick={{ fontSize: 10 }} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ backgroundColor: isDark ? '#18181b' : '#fafaf9', border: '1px solid #3f3f46', borderRadius: '8px', fontSize: '12px' }} />
                  <Area type="monotone" dataKey="p90" stroke="#be123c" strokeWidth={1.5} fill="url(#coneGradient90)" name="90th %ile" />
                  <Area type="monotone" dataKey="p75" stroke="#e11d48" strokeWidth={1.5} fill="url(#coneGradient75)" name="75th %ile" />
                  <Area type="monotone" dataKey="p50" stroke="#f43f5e" strokeWidth={2.5} fill="url(#coneGradient50)" name="Median" />
                  <Area type="monotone" dataKey="p25" stroke="#e11d48" strokeWidth={1.5} fill="url(#coneGradient75)" name="25th %ile" />
                  <Area type="monotone" dataKey="p10" stroke="#be123c" strokeWidth={1.5} fill="url(#coneGradient90)" name="10th %ile" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Drawdown Analysis Chart */}
            {drawdownMetrics && drawdownMetrics.data && (
              <div className={`${colors.card} backdrop-blur-xl rounded-lg p-4 ${colors.border}`}>
                <h3 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${colors.text}`}>
                  <TrendingDown className="w-4 h-4 text-red-400" />
                  Drawdown Analysis
                </h3>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={drawdownMetrics.data}>
                    <defs>
                      <linearGradient id="drawdownGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ef4444" stopOpacity={0.1}/>
                        <stop offset="100%" stopColor="#ef4444" stopOpacity={0.4}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#27272a' : '#e7e5e4'} />
                    <XAxis dataKey="day" stroke={isDark ? '#71717a' : '#78716c'} tick={{ fontSize: 10 }} />
                    <YAxis 
                      stroke={isDark ? '#71717a' : '#78716c'} 
                      tick={{ fontSize: 10 }} 
                      tickFormatter={(v) => `-${v.toFixed(0)}%`}
                      domain={[0, 'auto']}
                      reversed
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: isDark ? '#18181b' : '#fafaf9', border: '1px solid #3f3f46', borderRadius: '8px', fontSize: '12px' }}
                      formatter={(value) => [`-${value.toFixed(2)}%`, '']}
                    />
                    <Area type="monotone" dataKey="worst" stroke="#dc2626" strokeWidth={1} fill="url(#drawdownGradient)" name="Worst Case" />
                    <Area type="monotone" dataKey="p90" stroke="#ef4444" strokeWidth={1.5} fill="none" name="90th %ile" strokeDasharray="3 3" />
                    <Area type="monotone" dataKey="median" stroke="#f87171" strokeWidth={2} fill="none" name="Median" />
                  </AreaChart>
                </ResponsiveContainer>
                {/* Drawdown Stats */}
                <div className="grid grid-cols-4 gap-2 mt-3">
                  <div className={`p-2 rounded ${isDark ? 'bg-zinc-800/50' : 'bg-gray-100'} text-center`}>
                    <div className={`text-xs ${colors.textMuted}`}>Median Max DD</div>
                    <div className="text-sm font-bold text-red-400">-{drawdownMetrics.stats.median.toFixed(1)}%</div>
                  </div>
                  <div className={`p-2 rounded ${isDark ? 'bg-zinc-800/50' : 'bg-gray-100'} text-center`}>
                    <div className={`text-xs ${colors.textMuted}`}>90th %ile DD</div>
                    <div className="text-sm font-bold text-red-400">-{drawdownMetrics.stats.p90.toFixed(1)}%</div>
                  </div>
                  <div className={`p-2 rounded ${isDark ? 'bg-zinc-800/50' : 'bg-gray-100'} text-center`}>
                    <div className={`text-xs ${colors.textMuted}`}>95th %ile DD</div>
                    <div className="text-sm font-bold text-red-400">-{drawdownMetrics.stats.p95.toFixed(1)}%</div>
                  </div>
                  <div className="p-2 rounded bg-red-900/30 border border-red-800/50 text-center">
                    <div className={`text-xs ${colors.textMuted}`}>Worst Case</div>
                    <div className="text-sm font-bold text-red-400">-{drawdownMetrics.stats.worst.toFixed(1)}%</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sample Paths Chart - Full Width */}
          <div className={`mb-4 ${colors.card} backdrop-blur-xl rounded-lg p-4 ${colors.border}`}>
            <h3 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${colors.text}`}>
              <TrendingUp className="w-4 h-4 text-rose-400" />
              Sample Simulation Paths (10 Representative Outcomes)
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={samplePathsData}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#27272a' : '#e7e5e4'} />
                <XAxis dataKey="day" stroke={isDark ? '#71717a' : '#78716c'} tick={{ fontSize: 10 }} />
                <YAxis stroke={isDark ? '#71717a' : '#78716c'} tick={{ fontSize: 10 }} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ backgroundColor: isDark ? '#18181b' : '#fafaf9', border: '1px solid #3f3f46', borderRadius: '8px', fontSize: '12px' }} />
                <ReferenceLine y={initialValue} stroke="#71717a" strokeDasharray="3 3" label={{ value: 'Initial', fill: '#71717a', fontSize: 10 }} />
                {goalAmount > 0 && <ReferenceLine y={goalAmount} stroke="#10b981" strokeDasharray="5 5" label={{ value: 'Goal', fill: '#10b981', fontSize: 10 }} />}
                {[...Array(10)].map((_, i) => (
                  <Line
                    key={i}
                    type="monotone"
                    dataKey={`path${i}`}
                    stroke={`hsl(${355 - i * 8}, 70%, ${55 + i * 3}%)`}
                    strokeWidth={1}
                    dot={false}
                    name={`Sim ${i + 1}`}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Efficient Frontier Chart */}
          {showEfficientFrontier && efficientFrontierData && (
            <div className={`mb-4 ${colors.card} backdrop-blur-xl rounded-lg p-4 ${colors.border}`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className={`text-sm font-semibold flex items-center gap-2 ${colors.text}`}>
                  <Target className="w-4 h-4 text-emerald-400" />
                  Efficient Frontier
                </h3>
                <button
                  onClick={() => setShowEfficientFrontier(false)}
                  className={`text-xs ${colors.muted} hover:text-white transition-colors`}
                >
                  Hide
                </button>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={efficientFrontierData}>
                  <defs>
                    <linearGradient id="frontierGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#27272a' : '#e7e5e4'} />
                  <XAxis 
                    dataKey="volatility" 
                    stroke={isDark ? '#71717a' : '#78716c'} 
                    tick={{ fontSize: 10 }} 
                    label={{ value: 'Risk (Volatility %)', position: 'bottom', offset: -5, style: { fontSize: 10, fill: '#71717a' } }}
                  />
                  <YAxis 
                    dataKey="return" 
                    stroke={isDark ? '#71717a' : '#78716c'} 
                    tick={{ fontSize: 10 }}
                    label={{ value: 'Return %', angle: -90, position: 'insideLeft', style: { fontSize: 10, fill: '#71717a' } }}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: isDark ? '#18181b' : '#fafaf9', border: '1px solid #3f3f46', borderRadius: '8px', fontSize: '12px' }}
                    formatter={(value, name) => [`${value?.toFixed(2)}%`, name]}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="return" 
                    stroke="#10b981" 
                    strokeWidth={2}
                    fill="url(#frontierGradient)" 
                    name="Portfolio Return"
                    dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
              <div className="flex items-center gap-4 mt-2 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-rose-500"></div>
                  <span className={colors.muted}>Your Portfolio: {riskMetrics.volatility.toFixed(1)}% risk, {riskMetrics.mean.toFixed(1)}% return</span>
                </div>
                {comparisonMode && comparisonRiskMetrics && (
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                    <span className={colors.muted}>Comparison: {comparisonRiskMetrics.volatility.toFixed(1)}% risk, {comparisonRiskMetrics.mean.toFixed(1)}% return</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Distribution and Risk Metrics Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
            <div className={`${colors.card} backdrop-blur-xl rounded-lg p-4 ${colors.border}`}>
              <h3 className={`text-sm font-semibold mb-3 ${colors.text}`}>Final Value Distribution</h3>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={distributionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#27272a' : '#e7e5e4'} />
                  <XAxis dataKey="value" stroke={isDark ? '#71717a' : '#78716c'} tick={{ fontSize: 9 }} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                  <YAxis stroke={isDark ? '#71717a' : '#78716c'} tick={{ fontSize: 9 }} />
                  <Tooltip contentStyle={{ backgroundColor: isDark ? '#18181b' : '#fafaf9', border: '1px solid #3f3f46', borderRadius: '8px', fontSize: '12px' }} />
                  <Area type="monotone" dataKey="frequency" stroke="#e11d48" fill="#e11d48" fillOpacity={0.4} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Compact Risk Metrics */}
            <div className={`${colors.card} backdrop-blur-xl rounded-lg p-4 ${colors.border}`}>
              <h3 className={`text-sm font-semibold mb-3 ${colors.text}`}>Risk Metrics</h3>
              <div className="space-y-2 text-sm">
                <div className={`flex justify-between items-center p-2 ${isDark ? 'bg-zinc-800/30' : 'bg-zinc-200/50'} rounded`}>
                  <span className={colors.muted}>VaR (99%)</span>
                  <span className="font-mono text-red-400">{riskMetrics.var99.toFixed(2)}%</span>
                </div>
                <div className={`flex justify-between items-center p-2 ${isDark ? 'bg-zinc-800/30' : 'bg-zinc-200/50'} rounded`}>
                  <span className={colors.muted}>Expected Shortfall</span>
                  <span className="font-mono text-red-400">{riskMetrics.expectedShortfall.toFixed(2)}%</span>
                </div>
                <div className={`flex justify-between items-center p-2 ${isDark ? 'bg-zinc-800/30' : 'bg-zinc-200/50'} rounded`}>
                  <span className={colors.muted}>Kurtosis</span>
                  <span className={`font-mono ${colors.text}`}>{riskMetrics.kurtosis.toFixed(2)}</span>
                </div>
                <div className={`flex justify-between items-center p-2 ${isDark ? 'bg-zinc-800/30' : 'bg-zinc-200/50'} rounded`}>
                  <span className={colors.muted}>Skewness</span>
                  <span className={`font-mono ${colors.text}`}>{riskMetrics.skewness?.toFixed(2) || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Outcome Scenarios */}
            <div className={`${colors.card} backdrop-blur-xl rounded-lg p-4 ${colors.border}`}>
              <h3 className={`text-sm font-semibold mb-3 ${colors.text}`}>Outcome Scenarios</h3>
              <div className="space-y-2 text-sm">
                <div className="p-2 bg-red-900/20 rounded border border-red-900/30">
                  <div className="flex justify-between">
                    <span className={colors.muted}>10th %ile</span>
                    <span className="font-mono text-red-400">${riskMetrics.percentiles.p10.toFixed(0)}</span>
                  </div>
                  <div className="text-xs text-zinc-500">{((riskMetrics.percentiles.p10 - initialValue) / initialValue * 100).toFixed(1)}%</div>
                </div>
                <div className={`p-2 ${isDark ? 'bg-zinc-800/30' : 'bg-zinc-200/50'} rounded`}>
                  <div className="flex justify-between">
                    <span className={colors.muted}>Median</span>
                    <span className={`font-mono ${colors.text}`}>${riskMetrics.percentiles.p50.toFixed(0)}</span>
                  </div>
                  <div className="text-xs text-zinc-500">{((riskMetrics.percentiles.p50 - initialValue) / initialValue * 100).toFixed(1)}%</div>
                </div>
                <div className="p-2 bg-emerald-900/20 rounded border border-emerald-900/30">
                  <div className="flex justify-between">
                    <span className={colors.muted}>90th %ile</span>
                    <span className="font-mono text-emerald-400">${riskMetrics.percentiles.p90.toFixed(0)}</span>
                  </div>
                  <div className="text-xs text-zinc-500">{((riskMetrics.percentiles.p90 - initialValue) / initialValue * 100).toFixed(1)}%</div>
                </div>
              </div>
            </div>
          </div>

          {/* Compact Correlation Heatmap */}
          {correlationData && advancedOptions.useCorrelation && (
            <div className={`${colors.card} backdrop-blur-xl rounded-lg p-4 ${colors.border}`}>
              <h3 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${colors.text}`}>
                <Network className="w-4 h-4 text-rose-400" />
                Correlation Matrix
              </h3>
              
              <div className="flex gap-4">
                {/* Compact Heatmap */}
                <div className="flex-shrink-0">
                  <div className="grid gap-0.5" style={{ 
                    gridTemplateColumns: `40px repeat(${portfolio.length}, 36px)`,
                  }}>
                    <div></div>
                    {portfolio.map((p, i) => (
                      <div key={`h-${i}`} className={`text-center font-mono text-xs py-1 ${colors.muted}`}>
                        {p.ticker.substring(0, 4)}
                      </div>
                    ))}
                    
                    {portfolio.map((p, i) => (
                      <React.Fragment key={`r-${i}`}>
                        <div className={`flex items-center justify-end pr-1 font-mono text-xs ${colors.muted}`}>
                          {p.ticker.substring(0, 4)}
                        </div>
                        {correlationData[i].map((corr, j) => {
                          const intensity = Math.abs(corr);
                          const hue = corr > 0 ? '355' : '220';
                          const lightness = 100 - (intensity * 50);
                          
                          return (
                            <div
                              key={`c-${i}-${j}`}
                              className="w-9 h-9 flex items-center justify-center text-xs font-mono rounded hover:scale-110 transition-transform cursor-pointer"
                              style={{
                                backgroundColor: i === j ? (isDark ? '#27272a' : '#e7e5e4') : `hsl(${hue}, 60%, ${lightness}%)`,
                                color: intensity > 0.5 || i === j ? '#fff' : '#000'
                              }}
                              title={`${portfolio[i].ticker} vs ${portfolio[j].ticker}: ${corr.toFixed(3)}`}
                            >
                              {corr.toFixed(2)}
                            </div>
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </div>
                </div>

                {/* Legend and Insights */}
                <div className="flex-1 text-xs space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-2 rounded" style={{
                      background: 'linear-gradient(to right, hsl(220, 60%, 50%), #fff, hsl(355, 60%, 50%))'
                    }}></div>
                    <span className={colors.muted}>-1 → 0 → +1</span>
                  </div>
                  <div className={`${colors.muted} space-y-1`}>
                    <p><span className="text-rose-400">Red</span>: Positive correlation (move together)</p>
                    <p><span className="text-blue-400">Blue</span>: Negative correlation (hedge)</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Auth Modal */}
      <AuthModal 
        isOpen={showAuthModal} 
        onClose={() => setShowAuthModal(false)}
      />
    </>
  );
};

export default PortfolioPath;