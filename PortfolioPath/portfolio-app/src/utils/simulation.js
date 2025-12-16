/**
 * Simulation Engine and Risk Metrics
 * 
 * This module contains the Monte Carlo simulation engine and
 * all risk calculation functions.
 */

import {
  randomNormal,
  randomStudentT,
  choleskyDecomposition,
  generateCorrelatedReturns,
  GARCHModel,
  RegimeSwitchingModel,
  MeanReversionModel,
  generateJump
} from './mathUtils';

import { assetDatabase, generateCorrelationMatrix } from '../constants/portfolioConstants';

// ============================================================================
// ADVANCED MONTE CARLO ENGINE
// ============================================================================

/**
 * Run advanced Monte Carlo simulation with multiple models
 * @param {Array} portfolio - Array of { ticker, weight } objects
 * @param {number} initialValue - Starting portfolio value
 * @param {number} days - Number of days to simulate
 * @param {number} simulations - Number of simulation paths
 * @param {Object} options - Advanced model options
 * @returns {Array} Array of simulation paths
 */
export const runAdvancedMonteCarloSimulation = (
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
// BACKEND RESPONSE TRANSFORMER
// ============================================================================

/**
 * Transform backend simulation response to frontend format
 * Backend returns: { final_values, risk_metrics, sample_paths, yearly_data }
 * Frontend expects: Array of paths, each path is [{ day, value }, ...]
 */
export const transformBackendResponse = (backendResponse, timeHorizonDays) => {
  if (!backendResponse) return null;
  
  const initialValue = backendResponse.summary?.initial_investment || 10000;
  const numSimulations = backendResponse.summary?.num_simulations || 1000;
  const timeHorizonYears = backendResponse.summary?.time_horizon || Math.ceil(timeHorizonDays / 252);
  const finalValues = backendResponse.final_values;
  const yearlyData = backendResponse.yearly_data || [];
  const samplePaths = backendResponse.sample_paths || [];
  
  // Generate paths using yearly_data statistics
  const paths = [];
  
  // Get distribution parameters
  const mean = finalValues?.mean || initialValue;
  const std = finalValues?.std || initialValue * 0.2;
  const min = finalValues?.min || initialValue * 0.5;
  const max = finalValues?.max || initialValue * 2;
  
  for (let sim = 0; sim < numSimulations; sim++) {
    const path = [];
    
    // Use Box-Muller transform for proper normal distribution sampling
    // This creates a smooth bell curve instead of discrete buckets
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    
    // Sample from normal distribution centered on mean with given std
    let targetFinalValue = mean + z * std;
    
    // Clamp to reasonable bounds
    targetFinalValue = Math.max(min * 0.8, Math.min(max * 1.2, targetFinalValue));
    
    // Ensure positive value
    targetFinalValue = Math.max(initialValue * 0.1, targetFinalValue);
    
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

// ============================================================================
// RISK METRICS CALCULATOR
// ============================================================================

/**
 * Calculate comprehensive risk metrics from simulation results
 * @param {Array} simulations - Array of simulation paths
 * @param {number} initialValue - Initial portfolio value
 * @returns {Object} Risk metrics object
 */
export const calculateRiskMetrics = (simulations, initialValue) => {
  if (!simulations || simulations.length === 0) return null;
  
  const finalValues = simulations.map(path => {
    const lastPoint = path[path.length - 1];
    return lastPoint ? lastPoint.value : initialValue;
  }).filter(v => v !== undefined && v !== null);
  
  if (finalValues.length === 0) return null;
  
  finalValues.sort((a, b) => a - b);
  
  const returns = finalValues.map(v => (v - initialValue) / initialValue);
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, r) => a + Math.pow(r - mean, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);
  
  // Kurtosis calculation for tail risk
  const kurtosis = returns.reduce((a, r) => a + Math.pow(r - mean, 4), 0) / 
    (returns.length * Math.pow(stdDev, 4));
  
  // Skewness calculation
  const skewness = returns.reduce((a, r) => a + Math.pow(r - mean, 3), 0) / 
    (returns.length * Math.pow(stdDev, 3));
  
  const var95 = finalValues[Math.floor(finalValues.length * 0.05)] || initialValue;
  const var99 = finalValues[Math.floor(finalValues.length * 0.01)] || initialValue;
  
  const tailLosses = finalValues.filter(v => v <= var95);
  const expectedShortfall = tailLosses.length > 0 
    ? tailLosses.reduce((a, b) => a + b, 0) / tailLosses.length 
    : var95;
  
  return {
    mean: mean * 100,
    volatility: stdDev * 100,
    kurtosis: kurtosis,
    skewness: skewness,
    var95: ((var95 - initialValue) / initialValue) * 100,
    var99: ((var99 - initialValue) / initialValue) * 100,
    expectedShortfall: ((expectedShortfall - initialValue) / initialValue) * 100,
    sharpeRatio: stdDev > 0 ? mean / stdDev : 0,
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
// GOAL PROBABILITY CALCULATOR
// ============================================================================

/**
 * Calculate probability of reaching a target value
 * @param {Array} simulations - Array of simulation paths
 * @param {number} targetValue - Target portfolio value
 * @returns {Object} Goal probability metrics
 */
export const calculateGoalProbability = (simulations, targetValue) => {
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

/**
 * Calculate drawdown metrics from simulation results
 * @param {Array} simulations - Array of simulation paths
 * @returns {Object} Drawdown metrics and data
 */
export const calculateDrawdownMetrics = (simulations) => {
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
