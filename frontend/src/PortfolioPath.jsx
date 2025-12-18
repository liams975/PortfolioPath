import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart, PieChart, Pie, Cell, ReferenceLine } from 'recharts';
import { TrendingUp, AlertTriangle, Target, Activity, Settings, BarChart3, Network, Zap, User, LogOut, FolderOpen, Sun, Moon, Download, GitCompare, Sliders, Scale, Crosshair, TrendingDown, Loader2, Package, RefreshCw, Crown, Star, UserCircle } from 'lucide-react';
import { useAuth } from './context/AuthContext';
import { useTheme } from './context/ThemeContext';
import { usePremium, PRO_FEATURES, ProFeatureGate } from './context/PremiumContext';
import AuthModal from './components/AuthModal';
import PaymentModal from './components/PaymentModal';
import AccountSettings from './components/AccountSettings';
import OnboardingTutorial, { useTutorial } from './components/OnboardingTutorial';
import SavedPortfolios from './components/SavedPortfolios';
import { TickerInput } from './components/TickerInput';
import { exportToCSV, exportToPDF } from './utils/exportUtils';
import { cacheSimulationResults } from './services/cache';
import { toast } from './utils/toast';
import { handleError } from './utils/errorHandler';
import { checkApiHealth, runSimulation as runBackendSimulation } from './services/api';

// Import from modularized files
import {
  PRESET_PORTFOLIOS,
  STRESS_SCENARIOS,
  DEFAULT_PORTFOLIO,
  DEFAULT_COMPARISON_PORTFOLIO,
  DEFAULT_ADVANCED_OPTIONS,
  assetDatabase,
  generateCorrelationMatrix
} from './constants/portfolioConstants';

// Real market data hook
import { useMarketData, useRealTimeQuotes, getAssetParams } from './hooks/useMarketData';

import {
  runAdvancedMonteCarloSimulation,
  transformBackendResponse,
  calculateRiskMetrics,
  calculateGoalProbability,
  calculateDrawdownMetrics
} from './utils/simulation';

import {
  useFanChartData,
  useDynamicPercentileData,
  useSamplePathsData,
  useDistributionData,
  useCorrelationData,
  usePieChartData,
  useComparisonPieData,
  useEfficientFrontierData,
  useBenchmarkSimulation
} from './hooks/useChartData';

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
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  
  // Onboarding tutorial
  const { showTutorial, startTutorial, closeTutorial } = useTutorial();
  
  // Premium/Pro tier status
  const { 
    isPremium, 
    hasFeature, 
    canRunSimulation, 
    trackSimulation,
    dailySimulations,
    FREE_SIMULATION_LIMIT 
  } = usePremium();

  // Real market data hooks - fetch live parameters from Yahoo Finance
  const { 
    data: marketData, 
    loading: marketDataLoading, 
    error: marketDataError,
    refresh: refreshMarketData 
  } = useMarketData(portfolio, backendConnected);
  
  // Also fetch for comparison portfolio when in comparison mode
  const { 
    data: comparisonMarketData,
    loading: comparisonMarketLoading 
  } = useMarketData(comparisonPortfolio, backendConnected && comparisonMode);
  
  // Real-time quotes for display (prices, changes)
  const tickers = useMemo(() => 
    portfolio.map(p => p.ticker).filter(t => t && t.length > 0),
    [portfolio]
  );
  const { quotes: liveQuotes, loading: quotesLoading } = useRealTimeQuotes(tickers, backendConnected);

  // Helper to get asset parameters (uses real data if available, falls back to static)
  const getPortfolioAssetParams = useCallback((ticker) => {
    const upperTicker = ticker?.toUpperCase();
    if (!upperTicker) return { mean: 0.0003, vol: 0.015, name: 'Unknown' };
    
    // Try real market data first
    if (marketData?.[upperTicker]) {
      return marketData[upperTicker];
    }
    
    // Fallback to cache or static
    return getAssetParams(upperTicker);
  }, [marketData]);

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
    // Validate portfolio has at least one valid ticker
    const validPositions = portfolio.filter(p => p.ticker && p.ticker.trim().length > 0 && p.weight > 0);
    if (validPositions.length === 0) {
      toast.error('Please add at least one valid asset with a weight greater than 0%');
      return;
    }
    
    // Check for invalid ticker formats
    const invalidTickers = portfolio.filter(p => p.ticker && !/^[A-Za-z0-9.-]+$/.test(p.ticker.trim()));
    if (invalidTickers.length > 0) {
      toast.error(`Invalid ticker format: ${invalidTickers.map(p => p.ticker).join(', ')}. Tickers can only contain letters, numbers, dots, and hyphens.`);
      return;
    }
    
    if (Math.abs(totalWeight - 1) > 0.01) {
      toast.error(`Portfolio weights must sum to 100% (currently ${(totalWeight * 100).toFixed(1)}%)`);
      return;
    }
    
    // Check simulation limit for free users
    const simLimit = canRunSimulation();
    if (!simLimit.allowed) {
      toast.error(
        `Daily simulation limit reached (${FREE_SIMULATION_LIMIT}/${FREE_SIMULATION_LIMIT}). Upgrade to Pro for unlimited simulations!`,
        { duration: 5000 }
      );
      setShowPaymentModal(true);
      return;
    }
    
    // Track simulation usage
    if (!trackSimulation()) {
      toast.warning('Simulation limit reached. Upgrade to Pro for unlimited access.');
      setShowPaymentModal(true);
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
          
          if (transformedResults) {
            setSimulationProgress(100);
            setSimulationResults(transformedResults);
            
            // Cache results
            cacheSimulationResults(getCurrentPortfolioData(), transformedResults, calculateRiskMetrics(transformedResults, initialValue));
            
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
              }
            } else {
              setComparisonResults(null);
            }
            
            setIsSimulating(false);
            setView('results');
            // Scroll to top when results load
            window.scrollTo({ top: 0, behavior: 'smooth' });
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
        
        // Cache results
        cacheSimulationResults(getCurrentPortfolioData(), results, calculateRiskMetrics(results, initialValue));
        
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
        } else {
          setComparisonResults(null);
        }
        
        setIsSimulating(false);
        setView('results');
        // Scroll to top when results load
        window.scrollTo({ top: 0, behavior: 'smooth' });
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
    return calculateRiskMetrics(simulationResults, initialValue);
  }, [simulationResults, initialValue]);
  
  // Comparison risk metrics
  const comparisonRiskMetrics = useMemo(() => {
    if (!comparisonResults) return null;
    return calculateRiskMetrics(comparisonResults, initialValue);
  }, [comparisonResults, initialValue]);

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

  // Efficient Frontier calculation - uses real market data when available
  const efficientFrontierData = useMemo(() => {
    if (!showEfficientFrontier || !riskMetrics) return [];
    
    // Generate random portfolio combinations for efficient frontier visualization
    const points = [];
    const tickerList = portfolio.map(p => p.ticker).filter(t => t);
    
    // Generate 50 random portfolio allocations
    for (let i = 0; i < 50; i++) {
      const randomWeights = tickerList.map(() => Math.random());
      const sum = randomWeights.reduce((a, b) => a + b, 0);
      const normalizedWeights = randomWeights.map(w => w / sum);
      
      // Calculate expected return and volatility for this allocation
      // Uses real market data when available
      let expectedReturn = 0;
      let variance = 0;
      
      normalizedWeights.forEach((w, idx) => {
        const params = getPortfolioAssetParams(tickerList[idx]);
        expectedReturn += w * params.mean * 252 * 100; // Annualized
        variance += Math.pow(w * params.vol * Math.sqrt(252) * 100, 2);
      });
      
      points.push({
        volatility: Math.sqrt(variance),
        return: expectedReturn,
        weights: normalizedWeights.map((w, i) => `${tickerList[i]}: ${(w * 100).toFixed(0)}%`).join(', ')
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
  }, [showEfficientFrontier, riskMetrics, comparisonRiskMetrics, portfolio, getPortfolioAssetParams]);

  // Benchmark simulation for comparison - uses real market data when available
  const benchmarkSimulation = useMemo(() => {
    if (!simulationResults || !benchmarkTicker) return null;
    
    // Use real market data for benchmark when available
    const benchmarkParams = getPortfolioAssetParams(benchmarkTicker);
    
    // Calculate annualized metrics for benchmark
    return {
      mean: benchmarkParams.mean * 252 * 100, // Annualized return %
      volatility: benchmarkParams.vol * Math.sqrt(252) * 100, // Annualized volatility %
      ticker: benchmarkTicker,
      isRealData: !!marketData?.[benchmarkTicker.toUpperCase()]
    };
  }, [simulationResults, benchmarkTicker, getPortfolioAssetParams, marketData]);

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
              {/* API Connection Indicator */}
              <div 
                className={`flex items-center gap-2 px-3 py-2 ${colors.card} ${colors.border} rounded-lg`}
                title={backendConnected ? 'API Connected' : 'API Disconnected'}
              >
                <div className={`w-2 h-2 rounded-full ${backendConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
                <span className={`text-xs ${colors.textMuted}`}>{backendConnected ? 'API Online' : 'API Offline'}</span>
              </div>
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
                data-tour="compare"
                onClick={() => setComparisonMode(!comparisonMode)}
                className={`px-4 py-2 ${comparisonMode ? 'bg-blue-600 border-blue-500' : colors.buttonSecondary} rounded-lg transition-all border flex items-center gap-2 text-sm`}
              >
                <GitCompare className={`w-4 h-4 ${comparisonMode ? 'text-white' : colors.accent}`} />
                <span className={comparisonMode ? 'text-white' : colors.textMuted}>Compare</span>
              </button>
              
              {isAuthenticated ? (
                <>
                  {/* Pro Badge / Upgrade Button */}
                  {isPremium ? (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-lg">
                      <Crown className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-semibold text-amber-400">PRO</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowPaymentModal(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-rose-500 to-red-500 hover:from-rose-600 hover:to-red-600 rounded-lg transition-all shadow-lg shadow-rose-900/30"
                    >
                      <Star className="w-4 h-4 text-white" />
                      <span className="text-xs font-semibold text-white">Upgrade</span>
                    </button>
                  )}
                  
                  <button
                    onClick={() => setShowSavedPortfolios(!showSavedPortfolios)}
                    className={`px-4 py-2 ${colors.card} rounded-lg transition-all border flex items-center gap-2 text-sm`}
                  >
                    <FolderOpen className={`w-4 h-4 ${colors.accent}`} />
                    <span className={colors.textMuted}>Portfolios</span>
                  </button>
                  <button 
                    onClick={() => setShowAccountSettings(true)}
                    className={`flex items-center gap-2 px-4 py-2 ${colors.card} rounded-lg border hover:border-rose-500/50 transition-all cursor-pointer`}
                    title="Account Settings"
                  >
                    <User className={`w-4 h-4 ${colors.accent}`} />
                    <span className={`text-sm ${colors.textMuted}`}>{user.name}</span>
                    <Settings className={`w-3 h-3 ${colors.textSubtle}`} />
                  </button>
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
          <div data-tour="presets" className={`mb-4 ${colors.card} rounded-xl p-4 border`}>
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
            <div className={`lg:col-span-2 ${colors.card} backdrop-blur-xl rounded-xl p-6 ${colors.border}`}>
              <h2 className={`text-lg font-semibold mb-5 flex items-center gap-2 ${colors.text}`}>
                <Target className="w-5 h-5 text-rose-400" />
                Portfolio Configuration
              </h2>

              <div data-tour="parameters" className="grid grid-cols-2 gap-4 mb-5">
                <div>
                  <label className={`block text-xs font-medium mb-2 ${colors.textMuted} uppercase tracking-wider`}>Initial Capital ($)</label>
                  <input
                    type="number"
                    value={initialValue}
                    onChange={(e) => setInitialValue(Math.max(0, parseFloat(e.target.value) || 0))}
                    min="0"
                    className={`w-full ${colors.input} ${colors.border} rounded-lg px-4 py-2.5 ${colors.text} placeholder-zinc-500 focus:ring-1 focus:ring-rose-500/50 focus:border-rose-500/50 focus:outline-none transition-all text-sm font-mono`}
                  />
                </div>
                <div>
                  <label className={`block text-xs font-medium mb-2 ${colors.textMuted} uppercase tracking-wider`}>Simulations (100-10,000)</label>
                  <input
                    type="number"
                    value={numSimulations}
                    onChange={(e) => setNumSimulations(Math.max(100, Math.min(10000, parseInt(e.target.value) || 1000)))}
                    min="100"
                    max="10000"
                    className={`w-full ${colors.input} ${colors.border} rounded-lg px-4 py-2.5 ${colors.text} placeholder-zinc-500 focus:ring-1 focus:ring-rose-500/50 focus:border-rose-500/50 focus:outline-none transition-all text-sm font-mono`}
                  />
                </div>
              </div>

              <div className="mb-5">
                <div className="flex justify-between items-center mb-2">
                  <label className={`text-xs font-medium ${colors.textMuted} uppercase tracking-wider`}>Time Horizon (Trading Days)</label>
                  <span className={`text-xs ${colors.textSubtle}`}>≈ {(timeHorizon / 252).toFixed(1)} years</span>
                </div>
                <input
                  type="number"
                  value={timeHorizon}
                  onChange={(e) => setTimeHorizon(Math.max(1, Math.min(2520, parseInt(e.target.value) || 252)))}
                  min="1"
                  max="2520"
                  className={`w-full ${colors.input} ${colors.border} rounded-lg px-4 py-2.5 ${colors.text} placeholder-zinc-500 focus:ring-1 focus:ring-rose-500/50 focus:border-rose-500/50 focus:outline-none transition-all text-sm font-mono`}
                />
                <div className={`mt-2 h-1 ${isDark ? 'bg-zinc-800' : 'bg-gray-200'} rounded-full overflow-hidden`}>
                  <div className="h-full bg-gradient-to-r from-rose-500 to-red-500 transition-all" style={{ width: `${(timeHorizon / 2520) * 100}%` }}></div>
                </div>
                <div className={`flex justify-between text-xs ${colors.textSubtle} mt-1`}>
                  <span>1 day</span>
                  <span>1 yr (252)</span>
                  <span>5 yrs (1260)</span>
                  <span>10 yrs (2520)</span>
                </div>
              </div>

              {/* Asset Allocation */}
              <div data-tour="portfolio" className="mb-4">
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
            <div data-tour="advanced" className={`${colors.card} backdrop-blur-xl rounded-xl p-6 ${colors.border}`}>
              <h2 className={`text-lg font-semibold mb-5 flex items-center gap-2 ${colors.text}`}>
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

          {/* Simulation Limit Indicator (Free Users) */}
          {!isPremium && isAuthenticated && (
            <div className={`mt-4 p-3 ${colors.card} rounded-lg border flex items-center justify-between`}>
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-rose-400" />
                <span className={`text-sm ${colors.textMuted}`}>
                  Daily Simulations: {dailySimulations}/{FREE_SIMULATION_LIMIT}
                </span>
              </div>
              <button
                onClick={() => setShowPaymentModal(true)}
                className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1"
              >
                <Star className="w-3 h-3" />
                Get Unlimited
              </button>
            </div>
          )}

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
        
        {/* Payment Modal */}
        <PaymentModal 
          isOpen={showPaymentModal} 
          onClose={() => setShowPaymentModal(false)}
          isDark={isDark}
        />
        
        {/* Onboarding Tutorial */}
        <OnboardingTutorial
          isOpen={showTutorial}
          onClose={closeTutorial}
          isDark={isDark}
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
            className={`mb-6 px-5 py-2 ${colors.card} hover:opacity-80 backdrop-blur-xl rounded-lg transition-all ${colors.border} ${colors.textMuted} text-sm`}
          >
            ← Back
          </button>

          <div className={`${colors.card} backdrop-blur-xl rounded-xl p-6 ${colors.border}`}>
            <h2 className={`text-xl font-semibold mb-4 flex items-center gap-2 ${colors.text}`}>
              <Settings className="w-5 h-5 text-rose-400" />
              Scenario Testing
            </h2>

            <p className={`${colors.textMuted} mb-6 text-sm`}>
              Apply stress scenarios to adjust simulation parameters.
            </p>

            <div className="space-y-3">
              {[
                { key: 'recession', label: 'Recession', desc: 'Returns -30%, higher correlation' },
                { key: 'volatilitySpike', label: 'Volatility Spike', desc: 'Volatility +50%' },
                { key: 'bullMarket', label: 'Bull Market', desc: 'Returns +30%' },
              ].map(({ key, label, desc }) => (
                <label key={key} className={`flex items-center justify-between p-3 ${isDark ? 'bg-zinc-800/30 hover:bg-zinc-800/50 border-zinc-700/30' : 'bg-gray-50 hover:bg-gray-100 border-gray-200'} rounded-lg cursor-pointer transition-all border`}>
                  <div>
                    <div className={`text-sm font-medium ${colors.text}`}>{label}</div>
                    <div className={`text-xs ${colors.textSubtle}`}>{desc}</div>
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
              className={`w-full mt-5 py-3 ${colors.button} rounded-lg transition-all font-medium shadow-lg shadow-rose-900/30 text-white`}
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
              className={`px-4 py-2 ${colors.card} ${isDark ? 'hover:bg-zinc-800' : 'hover:bg-gray-200'} backdrop-blur-xl rounded-lg transition-all ${colors.border} text-sm`}
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
                  <XAxis 
                    dataKey="day" 
                    stroke={isDark ? '#71717a' : '#78716c'} 
                    tick={{ fontSize: 10 }} 
                    tickFormatter={(day) => day === 0 ? 'Now' : day >= 252 ? `${(day/252).toFixed(1)}y` : `${day}d`}
                  />
                  <YAxis stroke={isDark ? '#71717a' : '#78716c'} tick={{ fontSize: 10 }} tickFormatter={(v) => v >= 1000000 ? `$${(v/1000000).toFixed(1)}M` : `$${(v/1000).toFixed(0)}k`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: isDark ? '#18181b' : '#fafaf9', border: '1px solid #3f3f46', borderRadius: '8px', fontSize: '12px' }} 
                    formatter={(value, name) => [`$${value.toLocaleString(undefined, {maximumFractionDigits: 0})}`, name]}
                    labelFormatter={(day) => `Day ${day} (${(day/252).toFixed(2)} years)`}
                  />
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
                    <XAxis 
                      dataKey="day" 
                      stroke={isDark ? '#71717a' : '#78716c'} 
                      tick={{ fontSize: 10 }} 
                      tickFormatter={(day) => day === 0 ? 'Now' : day >= 252 ? `${(day/252).toFixed(1)}y` : `${day}d`}
                    />
                    <YAxis 
                      stroke={isDark ? '#71717a' : '#78716c'} 
                      tick={{ fontSize: 10 }} 
                      tickFormatter={(v) => `-${v.toFixed(0)}%`}
                      domain={[0, 'auto']}
                      reversed
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: isDark ? '#18181b' : '#fafaf9', border: '1px solid #3f3f46', borderRadius: '8px', fontSize: '12px' }}
                      formatter={(value, name) => [`-${value.toFixed(2)}%`, name]}
                      labelFormatter={(day) => `Day ${day} (${(day/252).toFixed(2)} years)`}
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

          {/* Interactive Percentile Path Chart */}
          <div className={`mb-4 ${colors.card} backdrop-blur-xl rounded-lg p-4 ${colors.border}`}>
            <h3 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${colors.text}`}>
              <Sliders className="w-4 h-4 text-rose-400" />
              Interactive Percentile Path ({selectedPercentile}th Percentile)
              {comparisonMode && comparisonResults && <span className="text-blue-400 ml-2">vs Comparison</span>}
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={dynamicPercentileData}>
                <defs>
                  <linearGradient id="percentileGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#e11d48" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#e11d48" stopOpacity={0.05}/>
                  </linearGradient>
                  <linearGradient id="comparisonGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#27272a' : '#e7e5e4'} />
                <XAxis 
                  dataKey="day" 
                  stroke={isDark ? '#71717a' : '#78716c'} 
                  tick={{ fontSize: 10 }} 
                  tickFormatter={(day) => day === 0 ? 'Now' : day >= 252 ? `${(day/252).toFixed(1)}y` : `${day}d`}
                />
                <YAxis stroke={isDark ? '#71717a' : '#78716c'} tick={{ fontSize: 10 }} tickFormatter={(v) => v >= 1000000 ? `$${(v/1000000).toFixed(1)}M` : `$${(v/1000).toFixed(0)}k`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: isDark ? '#18181b' : '#fafaf9', border: '1px solid #3f3f46', borderRadius: '8px', fontSize: '12px' }} 
                  formatter={(value, name) => [`$${value?.toLocaleString(undefined, {maximumFractionDigits: 0}) || 'N/A'}`, name === 'selected' ? `${selectedPercentile}th %ile (Main)` : `${selectedPercentile}th %ile (Comparison)`]}
                  labelFormatter={(day) => `Day ${day} (${(day/252).toFixed(2)} years)`}
                />
                <ReferenceLine y={initialValue} stroke="#71717a" strokeDasharray="3 3" />
                {goalAmount > 0 && <ReferenceLine y={goalAmount} stroke="#10b981" strokeDasharray="5 5" label={{ value: 'Goal', fill: '#10b981', fontSize: 10 }} />}
                <Area type="monotone" dataKey="selected" stroke="#e11d48" strokeWidth={2.5} fill="url(#percentileGradient)" name="selected" />
                {comparisonMode && comparisonResults && (
                  <Area type="monotone" dataKey="comparison" stroke="#3b82f6" strokeWidth={2.5} fill="url(#comparisonGradient)" name="comparison" />
                )}
              </AreaChart>
            </ResponsiveContainer>
            <p className={`text-xs ${colors.textMuted} mt-2 text-center`}>
              Use the percentile slider in the header to adjust. This shows where {selectedPercentile}% of simulations fell at or below.
            </p>
          </div>

          {/* Sample Paths Chart - Full Width */}
          <div className={`mb-4 ${colors.card} backdrop-blur-xl rounded-lg p-4 ${colors.border} relative z-10`}>
            <h3 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${colors.text}`}>
              <TrendingUp className="w-4 h-4 text-rose-400" />
              Sample Simulation Paths (10 Representative Outcomes)
            </h3>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={samplePathsData}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#27272a' : '#e7e5e4'} />
                <XAxis 
                  dataKey="day" 
                  stroke={isDark ? '#71717a' : '#78716c'} 
                  tick={{ fontSize: 10 }} 
                  tickFormatter={(day) => day === 0 ? 'Now' : day >= 252 ? `${(day/252).toFixed(1)}y` : `${day}d`}
                />
                <YAxis stroke={isDark ? '#71717a' : '#78716c'} tick={{ fontSize: 10 }} tickFormatter={(v) => v >= 1000000 ? `$${(v/1000000).toFixed(1)}M` : `$${(v/1000).toFixed(0)}k`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: isDark ? '#18181b' : '#fafaf9', border: '1px solid #3f3f46', borderRadius: '8px', fontSize: '12px' }} 
                  formatter={(value, name) => [`$${value?.toLocaleString(undefined, {maximumFractionDigits: 0}) || 'N/A'}`, name]}
                  labelFormatter={(day) => `Day ${day} (${(day/252).toFixed(2)} years)`}
                />
                <ReferenceLine y={initialValue} stroke="#71717a" strokeDasharray="3 3" label={{ value: 'Initial', fill: '#71717a', fontSize: 10 }} />
                {goalAmount > 0 && <ReferenceLine y={goalAmount} stroke="#10b981" strokeDasharray="5 5" label={{ value: 'Goal', fill: '#10b981', fontSize: 10 }} />}
                {[...Array(10)].map((_, i) => (
                  <Line
                    key={i}
                    type="monotone"
                    dataKey={`path${i}`}
                    stroke={`hsl(${355 - i * 8}, 70%, ${55 + i * 3}%)`}
                    strokeWidth={1.5}
                    dot={false}
                    name={`Sim ${i + 1}`}
                    strokeOpacity={0.8}
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
                  <defs>
                    <linearGradient id="distributionGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#e11d48" stopOpacity={0.5}/>
                      <stop offset="95%" stopColor="#e11d48" stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#27272a' : '#e7e5e4'} />
                  <XAxis dataKey="value" stroke={isDark ? '#71717a' : '#78716c'} tick={{ fontSize: 9 }} tickFormatter={(v) => v >= 1000000 ? `$${(v/1000000).toFixed(1)}M` : `$${(v/1000).toFixed(0)}k`} />
                  <YAxis stroke={isDark ? '#71717a' : '#78716c'} tick={{ fontSize: 9 }} tickFormatter={(v) => `${v}%`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: isDark ? '#18181b' : '#fafaf9', border: '1px solid #3f3f46', borderRadius: '8px', fontSize: '12px' }} 
                    formatter={(value) => [`${value.toFixed(1)}% of outcomes`, 'Frequency']}
                    labelFormatter={(value) => `Portfolio Value: $${value.toLocaleString()}`}
                  />
                  <ReferenceLine x={initialValue} stroke="#71717a" strokeDasharray="3 3" label={{ value: 'Initial', fill: '#71717a', fontSize: 9, position: 'top' }} />
                  {goalAmount > 0 && <ReferenceLine x={goalAmount} stroke="#10b981" strokeDasharray="3 3" label={{ value: 'Goal', fill: '#10b981', fontSize: 9, position: 'top' }} />}
                  <Area type="basis" dataKey="frequency" stroke="#e11d48" strokeWidth={2} fill="url(#distributionGradient)" />
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
      
      {/* Payment Modal */}
      <PaymentModal 
        isOpen={showPaymentModal} 
        onClose={() => setShowPaymentModal(false)}
        isDark={isDark}
      />
      
      {/* Account Settings Modal */}
      <AccountSettings 
        isOpen={showAccountSettings} 
        onClose={() => setShowAccountSettings(false)}
        onUpgrade={() => {
          setShowAccountSettings(false);
          setShowPaymentModal(true);
        }}
      />
    </>
  );
};

export default PortfolioPath;