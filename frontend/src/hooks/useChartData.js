/**
 * Chart Data Hooks
 * 
 * Custom React hooks for calculating chart data from simulation results.
 * These are memoized computations that were previously inline in PortfolioPath.jsx.
 */

import { useMemo } from 'react';
import { generateCorrelationMatrix, assetDatabase, CHART_COLORS } from '../constants/portfolioConstants';

/**
 * Hook to calculate fan chart data (confidence cone)
 */
export const useFanChartData = (simulationResults, timeHorizon) => {
  return useMemo(() => {
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
};

/**
 * Hook to calculate dynamic percentile data based on slider
 */
export const useDynamicPercentileData = (simulationResults, comparisonResults, timeHorizon, selectedPercentile) => {
  return useMemo(() => {
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
};

/**
 * Hook to calculate sample paths data for individual simulation comparison
 */
export const useSamplePathsData = (simulationResults, timeHorizon) => {
  return useMemo(() => {
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
};

/**
 * Hook to calculate distribution histogram data
 */
export const useDistributionData = (simulationResults, riskMetrics, initialValue) => {
  return useMemo(() => {
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
};

/**
 * Hook to calculate correlation matrix for portfolio
 */
export const useCorrelationData = (portfolio) => {
  return useMemo(() => {
    if (!portfolio.length) return null;
    const tickers = portfolio.map(p => p.ticker).filter(t => t);
    if (tickers.length < 2) return null;
    return generateCorrelationMatrix(tickers);
  }, [portfolio]);
};

/**
 * Hook to calculate pie chart data for portfolio allocation
 */
export const usePieChartData = (portfolio) => {
  return useMemo(() => {
    return portfolio
      .filter(p => p.ticker && p.weight > 0)
      .map((p, idx) => ({
        name: p.ticker,
        value: p.weight * 100,
        color: CHART_COLORS.primary[idx % CHART_COLORS.primary.length]
      }));
  }, [portfolio]);
};

/**
 * Hook to calculate comparison pie chart data
 */
export const useComparisonPieData = (comparisonPortfolio) => {
  return useMemo(() => {
    return comparisonPortfolio
      .filter(p => p.ticker && p.weight > 0)
      .map((p, idx) => ({
        name: p.ticker,
        value: p.weight * 100,
        color: CHART_COLORS.comparison[idx % CHART_COLORS.comparison.length]
      }));
  }, [comparisonPortfolio]);
};

/**
 * Hook to calculate efficient frontier data
 */
export const useEfficientFrontierData = (showEfficientFrontier, riskMetrics, comparisonRiskMetrics, portfolio) => {
  return useMemo(() => {
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
};

/**
 * Hook to calculate benchmark simulation data
 */
export const useBenchmarkSimulation = (simulationResults, benchmarkTicker) => {
  return useMemo(() => {
    if (!simulationResults || !benchmarkTicker) return null;
    
    // Use benchmark-specific parameters
    const benchmarkParams = assetDatabase[benchmarkTicker] || { mean: 0.0003, vol: 0.012 };
    
    // Calculate annualized metrics for benchmark
    return {
      mean: benchmarkParams.mean * 252 * 100, // Annualized return %
      volatility: benchmarkParams.vol * Math.sqrt(252) * 100, // Annualized volatility %
      ticker: benchmarkTicker
    };
  }, [simulationResults, benchmarkTicker]);
};
