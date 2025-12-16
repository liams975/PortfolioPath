/**
 * Mathematical Utilities for Monte Carlo Simulations
 * 
 * This module contains statistical and mathematical functions used
 * for portfolio simulation and risk analysis.
 */

// ============================================================================
// RANDOM NUMBER GENERATORS
// ============================================================================

/**
 * Box-Muller transform for generating normally distributed random numbers
 * @param {number} mean - Mean of the distribution
 * @param {number} stdDev - Standard deviation
 * @returns {number} A random number from N(mean, stdDev)
 */
export const randomNormal = (mean = 0, stdDev = 1) => {
  const u1 = Math.random();
  const u2 = Math.random();
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return z0 * stdDev + mean;
};

/**
 * Student-t distribution for fat tails (using Gamma approximation)
 * Generates returns with "fat tails" - more extreme events than normal distribution
 * This better matches real market behavior where crashes and booms are more common
 * @param {number} degreesOfFreedom - Degrees of freedom (lower = fatter tails)
 * @returns {number} A random number from t-distribution
 */
export const randomStudentT = (degreesOfFreedom = 5) => {
  const df = degreesOfFreedom;
  const z = randomNormal();
  const chi2 = Array.from({ length: df }, () => Math.pow(randomNormal(), 2))
    .reduce((a, b) => a + b, 0);
  return z * Math.sqrt(df / chi2);
};

// ============================================================================
// MATRIX OPERATIONS
// ============================================================================

/**
 * Cholesky decomposition for correlation matrix
 * Matrix math technique to ensure assets move together realistically
 * Example: When SPY rises, QQQ tends to rise too (they're correlated)
 * @param {number[][]} matrix - Correlation matrix
 * @returns {number[][]} Lower triangular Cholesky matrix
 */
export const choleskyDecomposition = (matrix) => {
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

/**
 * Generate correlated random variables using Cholesky decomposition
 * @param {number[][]} choleskyMatrix - Pre-computed Cholesky matrix
 * @param {boolean} useFatTails - Whether to use t-distribution
 * @param {number} df - Degrees of freedom for t-distribution
 * @returns {number[]} Array of correlated random returns
 */
export const generateCorrelatedReturns = (choleskyMatrix, useFatTails = false, df = 5) => {
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
// VOLATILITY MODELS
// ============================================================================

/**
 * GARCH(1,1) Volatility Model
 * Models volatility clustering - big moves tend to be followed by big moves
 */
export class GARCHModel {
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

/**
 * Regime Switching Model
 * Models market regimes (bull/bear) with transition probabilities
 */
export class RegimeSwitchingModel {
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
// MEAN REVERSION (Ornstein-Uhlenbeck)
// ============================================================================

/**
 * Mean Reversion Model
 * Models tendency of prices to revert to long-term mean
 * Useful for interest rates, volatility, and some commodities
 */
export class MeanReversionModel {
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
// JUMP DIFFUSION MODEL (Merton)
// ============================================================================

/**
 * Generate jump for Merton jump-diffusion model
 * Models sudden market shocks (earnings surprises, geopolitical events)
 * @param {number} jumpIntensity - Probability of jump occurring
 * @param {number} jumpMean - Mean jump size
 * @param {number} jumpVol - Volatility of jump size
 * @returns {number} Jump size (0 if no jump)
 */
export const generateJump = (jumpIntensity = 0.02, jumpMean = -0.02, jumpVol = 0.03) => {
  // Poisson process for jump occurrence
  if (Math.random() < jumpIntensity) {
    // Jump size is normally distributed
    return randomNormal(jumpMean, jumpVol);
  }
  return 0;
};
