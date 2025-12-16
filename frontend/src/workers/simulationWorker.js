/**
 * ============================================================================
 * SIMULATION WEB WORKER
 * ============================================================================
 * 
 * Runs Monte Carlo simulations off the main thread to prevent UI freezing.
 * Communicates via postMessage for progress updates and results.
 * 
 * ============================================================================
 */

// Box-Muller transform for normal distribution
const randomNormal = (mean = 0, stdDev = 1) => {
  const u1 = Math.random();
  const u2 = Math.random();
  const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return z0 * stdDev + mean;
};

// Student-t distribution for fat tails
const randomStudentT = (degreesOfFreedom = 5) => {
  const df = degreesOfFreedom;
  const z = randomNormal();
  const chi2 = Array.from({ length: df }, () => Math.pow(randomNormal(), 2))
    .reduce((a, b) => a + b, 0);
  return z * Math.sqrt(df / chi2);
};

// Cholesky decomposition
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

// Generate correlated returns
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

// GARCH(1,1) model
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
}

// Regime Switching model
class RegimeSwitchingModel {
  constructor() {
    this.regimes = {
      bull: { mean: 0.0006, vol: 0.01, label: 'Bull Market' },
      bear: { mean: -0.0003, vol: 0.025, label: 'Bear Market' }
    };
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

// Jump diffusion
const generateJump = (jumpIntensity = 0.02, jumpMean = -0.02, jumpVol = 0.03) => {
  if (Math.random() < jumpIntensity) {
    return randomNormal(jumpMean, jumpVol);
  }
  return 0;
};

// Mean reversion model
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

// Generate correlation matrix
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
        
        if (['SPY', 'QQQ', 'VTI', 'IWM'].includes(t1) && 
            ['SPY', 'QQQ', 'VTI', 'IWM'].includes(t2)) {
          matrix[i][j] = 0.85;
        } else if (['AAPL', 'MSFT', 'GOOGL', 'QQQ', 'NVDA', 'META'].includes(t1) && 
                   ['AAPL', 'MSFT', 'GOOGL', 'QQQ', 'NVDA', 'META'].includes(t2)) {
          matrix[i][j] = 0.75;
        } else if ((t1 === 'BND' && t2 !== 'GLD') || (t2 === 'BND' && t1 !== 'GLD')) {
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
};

// Default asset parameters
const defaultAssetParams = {
  'SPY': { mean: 0.0003, vol: 0.01 },
  'QQQ': { mean: 0.0004, vol: 0.015 },
  'AAPL': { mean: 0.0005, vol: 0.018 },
  'MSFT': { mean: 0.0004, vol: 0.016 },
  'GOOGL': { mean: 0.0004, vol: 0.017 },
  'TSLA': { mean: 0.0006, vol: 0.035 },
  'VTI': { mean: 0.0003, vol: 0.01 },
  'BND': { mean: 0.0001, vol: 0.004 },
  'GLD': { mean: 0.0002, vol: 0.012 },
  'IWM': { mean: 0.0003, vol: 0.016 },
  'AMZN': { mean: 0.0004, vol: 0.02 },
  'NVDA': { mean: 0.0006, vol: 0.03 },
  'META': { mean: 0.0004, vol: 0.025 },
};

// Main simulation function
const runSimulation = (portfolio, initialValue, days, simulations, options = {}) => {
  const {
    useCorrelation = true,
    useFatTails = true,
    useGARCH = true,
    useRegimeSwitching = true,
    useJumpDiffusion = true,
    useMeanReversion = false,
    scenarios = {},
    assetParams = {}
  } = options;
  
  const results = [];
  const tickers = portfolio.map(p => p.ticker);
  const weights = portfolio.map(p => p.weight);
  
  // Merge default params with custom params
  const mergedParams = { ...defaultAssetParams, ...assetParams };
  
  // Pre-compute correlation structure
  const correlationMatrix = useCorrelation ? generateCorrelationMatrix(tickers) : null;
  const choleskyMatrix = correlationMatrix ? choleskyDecomposition(correlationMatrix) : null;
  
  const progressInterval = Math.floor(simulations / 20); // Report 20 times
  
  for (let sim = 0; sim < simulations; sim++) {
    // Report progress
    if (sim % progressInterval === 0) {
      self.postMessage({ 
        type: 'progress', 
        progress: Math.round((sim / simulations) * 100) 
      });
    }
    
    let value = initialValue;
    const path = [{ day: 0, value, regime: 'bull' }];
    
    // Initialize models
    const garchModels = useGARCH 
      ? portfolio.map(() => new GARCHModel())
      : null;
    
    const meanReversionModels = useMeanReversion
      ? portfolio.map(({ ticker }) => {
          const params = mergedParams[ticker] || { mean: 0.0003 };
          return new MeanReversionModel(params.mean, 0.05);
        })
      : null;
    
    const regimeModel = useRegimeSwitching ? new RegimeSwitchingModel() : null;
    
    // Track for drawdown calculation
    let peakValue = initialValue;
    let maxDrawdown = 0;
    
    for (let day = 1; day <= days; day++) {
      let dailyReturn = 0;
      
      const regimeParams = regimeModel ? regimeModel.getParameters() : null;
      const currentRegime = regimeModel ? regimeModel.getCurrentRegime() : 'bull';
      
      let returns;
      if (useCorrelation && choleskyMatrix) {
        returns = generateCorrelatedReturns(choleskyMatrix, useFatTails, 5);
      } else {
        returns = portfolio.map(() => useFatTails ? randomStudentT(5) : randomNormal());
      }
      
      portfolio.forEach(({ ticker, weight }, idx) => {
        const assetParameters = mergedParams[ticker] || { mean: 0.0003, vol: 0.012 };
        
        let mean = assetParameters.mean;
        let vol = assetParameters.vol;
        
        if (useMeanReversion && meanReversionModels) {
          mean = meanReversionModels[idx].step(vol * 0.1);
        }
        
        if (regimeParams) {
          mean = mean * (regimeParams.mean / 0.0003);
          vol = vol * (regimeParams.vol / 0.01);
        }
        
        if (useGARCH && garchModels) {
          const baseReturn = returns[idx] * vol + mean;
          vol = garchModels[idx].update(baseReturn);
        }
        
        let assetReturn = returns[idx] * vol + mean;
        
        if (useJumpDiffusion) {
          const jumpSize = generateJump(0.01, -0.015, 0.025);
          assetReturn += jumpSize;
        }
        
        if (scenarios.recession) assetReturn *= 0.7;
        if (scenarios.volatilitySpike) assetReturn *= (1 + randomNormal(0, 0.5));
        if (scenarios.bullMarket) assetReturn *= 1.3;
        
        dailyReturn += assetReturn * weight;
      });
      
      value *= (1 + dailyReturn);
      
      // Track drawdown
      if (value > peakValue) {
        peakValue = value;
      }
      const currentDrawdown = (peakValue - value) / peakValue;
      if (currentDrawdown > maxDrawdown) {
        maxDrawdown = currentDrawdown;
      }
      
      if (regimeModel) regimeModel.transition();
      
      path.push({ day, value, regime: currentRegime, drawdown: currentDrawdown });
    }
    
    // Store max drawdown with the path
    path.maxDrawdown = maxDrawdown;
    results.push(path);
  }
  
  return results;
};

// Listen for messages
self.onmessage = function(e) {
  const { type, payload } = e.data;
  
  if (type === 'runSimulation') {
    const { portfolio, initialValue, days, simulations, options } = payload;
    
    try {
      self.postMessage({ type: 'started' });
      
      const results = runSimulation(portfolio, initialValue, days, simulations, options);
      
      self.postMessage({ 
        type: 'complete', 
        results,
        stats: {
          simulations: results.length,
          days: days
        }
      });
    } catch (error) {
      self.postMessage({ 
        type: 'error', 
        error: error.message 
      });
    }
  }
};
