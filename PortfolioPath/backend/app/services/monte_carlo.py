"""
Monte Carlo Simulation Engine
=============================
NumPy-powered Monte Carlo simulation for portfolio analysis.
Significantly faster than JavaScript implementation.
"""

import numpy as np
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass
from enum import Enum
import asyncio
from concurrent.futures import ProcessPoolExecutor


class DistributionType(Enum):
    NORMAL = "normal"
    STUDENT_T = "student_t"


@dataclass
class AssetParameters:
    """Parameters for a single asset."""
    ticker: str
    weight: float
    mean_return: float  # Daily mean return
    volatility: float   # Daily volatility
    

@dataclass
class SimulationConfig:
    """Configuration for Monte Carlo simulation."""
    initial_value: float = 10000
    time_horizon: int = 252  # Trading days
    num_simulations: int = 1000
    use_correlation: bool = True
    use_fat_tails: bool = True
    use_garch: bool = True
    use_regime_switching: bool = True
    use_jump_diffusion: bool = True
    df: int = 5  # Degrees of freedom for Student-t
    

@dataclass
class SimulationResult:
    """Results from Monte Carlo simulation."""
    paths: np.ndarray  # Shape: (num_simulations, time_horizon + 1)
    final_values: np.ndarray
    metrics: Dict[str, float]
    percentiles: Dict[str, float]
    drawdowns: Dict[str, float]


class MonteCarloEngine:
    """
    High-performance Monte Carlo simulation engine using NumPy.
    
    Features:
    - Correlated asset returns (Cholesky decomposition)
    - Fat-tailed distributions (Student-t)
    - GARCH(1,1) volatility clustering
    - Regime switching (Bull/Bear Markov chain)
    - Jump diffusion (Merton model)
    """
    
    def __init__(self, seed: Optional[int] = None):
        """Initialize engine with optional random seed for reproducibility."""
        if seed is not None:
            np.random.seed(seed)
    
    def _generate_correlation_matrix(self, tickers: List[str]) -> np.ndarray:
        """
        Generate a correlation matrix for the given tickers.
        In production, this should use actual historical correlations.
        """
        n = len(tickers)
        
        # Default correlations by asset class
        equity_tickers = {'SPY', 'QQQ', 'VTI', 'IWM', 'AAPL', 'MSFT', 'GOOGL', 
                         'AMZN', 'NVDA', 'META', 'TSLA', 'AMD', 'INTC', 'NFLX'}
        bond_tickers = {'BND', 'AGG', 'TLT'}
        commodity_tickers = {'GLD', 'SLV', 'USO'}
        
        matrix = np.eye(n)
        
        for i in range(n):
            for j in range(i + 1, n):
                t1, t2 = tickers[i], tickers[j]
                
                # Determine correlation based on asset classes
                if t1 in equity_tickers and t2 in equity_tickers:
                    # Tech stocks correlate more highly
                    tech = {'AAPL', 'MSFT', 'GOOGL', 'NVDA', 'META', 'AMD', 'QQQ'}
                    if t1 in tech and t2 in tech:
                        corr = 0.75
                    else:
                        corr = 0.65
                elif t1 in bond_tickers and t2 in bond_tickers:
                    corr = 0.85
                elif (t1 in equity_tickers and t2 in bond_tickers) or \
                     (t2 in equity_tickers and t1 in bond_tickers):
                    corr = -0.25  # Negative stock-bond correlation
                elif t1 in commodity_tickers or t2 in commodity_tickers:
                    corr = 0.1  # Low correlation with commodities
                else:
                    corr = 0.5  # Default moderate correlation
                
                matrix[i, j] = corr
                matrix[j, i] = corr
        
        return matrix
    
    def _cholesky_decomposition(self, matrix: np.ndarray) -> np.ndarray:
        """Compute Cholesky decomposition for correlated returns."""
        try:
            return np.linalg.cholesky(matrix)
        except np.linalg.LinAlgError:
            # Matrix not positive definite, use eigenvalue adjustment
            eigenvalues, eigenvectors = np.linalg.eigh(matrix)
            eigenvalues = np.maximum(eigenvalues, 1e-8)
            adjusted = eigenvectors @ np.diag(eigenvalues) @ eigenvectors.T
            return np.linalg.cholesky(adjusted)
    
    def _generate_random_returns(
        self, 
        n_assets: int, 
        n_simulations: int, 
        n_days: int,
        use_fat_tails: bool = True,
        df: int = 5
    ) -> np.ndarray:
        """Generate random returns, optionally with fat tails."""
        if use_fat_tails:
            # Student-t distribution for fat tails
            return np.random.standard_t(df, size=(n_simulations, n_days, n_assets))
        else:
            # Standard normal distribution
            return np.random.standard_normal(size=(n_simulations, n_days, n_assets))
    
    def _apply_correlation(
        self, 
        returns: np.ndarray, 
        cholesky_matrix: np.ndarray
    ) -> np.ndarray:
        """Apply correlation structure to returns using Cholesky decomposition."""
        # returns shape: (n_simulations, n_days, n_assets)
        # cholesky_matrix shape: (n_assets, n_assets)
        return returns @ cholesky_matrix.T
    
    def _apply_garch(
        self, 
        returns: np.ndarray, 
        base_volatilities: np.ndarray,
        omega: float = 0.000001,
        alpha: float = 0.1,
        beta: float = 0.85
    ) -> np.ndarray:
        """Apply GARCH(1,1) volatility clustering."""
        n_simulations, n_days, n_assets = returns.shape
        volatilities = np.zeros_like(returns)
        current_variance = base_volatilities ** 2
        
        for t in range(n_days):
            volatilities[:, t, :] = np.sqrt(current_variance)
            
            if t > 0:
                # Update variance based on previous shock
                shock_sq = (returns[:, t-1, :] * base_volatilities) ** 2
                current_variance = omega + alpha * shock_sq + beta * current_variance
        
        return volatilities
    
    def _apply_regime_switching(
        self,
        returns: np.ndarray,
        bull_mean_mult: float = 1.5,
        bull_vol_mult: float = 0.7,
        bear_mean_mult: float = -0.5,
        bear_vol_mult: float = 1.8,
        p_bull_to_bear: float = 0.05,
        p_bear_to_bull: float = 0.10
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        """Apply regime switching (Markov chain) to returns."""
        n_simulations, n_days, n_assets = returns.shape
        
        # Initialize regime states (1 = bull, 0 = bear)
        regimes = np.ones((n_simulations, n_days), dtype=int)
        mean_multipliers = np.ones((n_simulations, n_days))
        vol_multipliers = np.ones((n_simulations, n_days))
        
        # Transition probabilities
        transitions = np.random.random((n_simulations, n_days))
        
        for t in range(1, n_days):
            # Current regime is bull (1)
            bull_mask = regimes[:, t-1] == 1
            # Transition to bear
            regimes[bull_mask, t] = np.where(
                transitions[bull_mask, t] < p_bull_to_bear, 0, 1
            )
            
            # Current regime is bear (0)
            bear_mask = ~bull_mask
            # Transition to bull
            regimes[bear_mask, t] = np.where(
                transitions[bear_mask, t] < p_bear_to_bull, 1, 0
            )
        
        # Apply multipliers based on regime
        mean_multipliers = np.where(regimes == 1, bull_mean_mult, bear_mean_mult)
        vol_multipliers = np.where(regimes == 1, bull_vol_mult, bear_vol_mult)
        
        return mean_multipliers, vol_multipliers, regimes
    
    def _apply_jump_diffusion(
        self,
        returns: np.ndarray,
        jump_intensity: float = 0.02,  # Probability of jump per day
        jump_mean: float = -0.03,      # Average jump size (negative = crash)
        jump_vol: float = 0.04         # Jump size volatility
    ) -> np.ndarray:
        """Apply Merton jump diffusion model."""
        n_simulations, n_days, n_assets = returns.shape
        
        # Generate jump occurrences (Poisson process)
        jump_occurs = np.random.random((n_simulations, n_days, n_assets)) < jump_intensity
        
        # Generate jump sizes
        jump_sizes = np.random.normal(jump_mean, jump_vol, (n_simulations, n_days, n_assets))
        
        # Apply jumps
        jumps = jump_occurs * jump_sizes
        
        return returns + jumps
    
    def run_simulation(
        self,
        assets: List[AssetParameters],
        config: SimulationConfig,
        correlation_matrix: Optional[np.ndarray] = None
    ) -> SimulationResult:
        """
        Run Monte Carlo simulation.
        
        Args:
            assets: List of asset parameters with weights
            config: Simulation configuration
            correlation_matrix: Optional pre-computed correlation matrix
        
        Returns:
            SimulationResult with paths, metrics, and percentiles
        """
        n_assets = len(assets)
        n_sims = config.num_simulations
        n_days = config.time_horizon
        
        # Extract parameters
        tickers = [a.ticker for a in assets]
        weights = np.array([a.weight for a in assets])
        means = np.array([a.mean_return for a in assets])
        vols = np.array([a.volatility for a in assets])
        
        # Generate correlation matrix if needed
        if config.use_correlation:
            if correlation_matrix is None:
                correlation_matrix = self._generate_correlation_matrix(tickers)
            cholesky = self._cholesky_decomposition(correlation_matrix)
        
        # Generate random returns
        random_returns = self._generate_random_returns(
            n_assets, n_sims, n_days,
            config.use_fat_tails, config.df
        )
        
        # Apply correlation
        if config.use_correlation:
            random_returns = self._apply_correlation(random_returns, cholesky)
        
        # Initialize volatilities
        if config.use_garch:
            volatilities = self._apply_garch(random_returns, vols)
        else:
            volatilities = np.broadcast_to(vols, (n_sims, n_days, n_assets))
        
        # Apply regime switching
        if config.use_regime_switching:
            mean_mult, vol_mult, regimes = self._apply_regime_switching(random_returns)
            # Reshape for broadcasting
            mean_mult = mean_mult[:, :, np.newaxis]
            vol_mult = vol_mult[:, :, np.newaxis]
        else:
            mean_mult = np.ones((n_sims, n_days, 1))
            vol_mult = np.ones((n_sims, n_days, 1))
            regimes = np.ones((n_sims, n_days))
        
        # Calculate asset returns
        asset_returns = random_returns * volatilities * vol_mult + means * mean_mult
        
        # Apply jump diffusion
        if config.use_jump_diffusion:
            asset_returns = self._apply_jump_diffusion(asset_returns)
        
        # Calculate portfolio returns (weighted sum)
        portfolio_returns = np.sum(asset_returns * weights, axis=2)  # Shape: (n_sims, n_days)
        
        # Calculate portfolio value paths
        paths = np.zeros((n_sims, n_days + 1))
        paths[:, 0] = config.initial_value
        
        for t in range(n_days):
            paths[:, t + 1] = paths[:, t] * (1 + portfolio_returns[:, t])
        
        # Calculate final values
        final_values = paths[:, -1]
        
        # Calculate metrics
        returns = (final_values - config.initial_value) / config.initial_value
        metrics = self._calculate_metrics(returns, paths, config.initial_value)
        
        # Calculate percentiles
        percentiles = self._calculate_percentiles(final_values)
        
        # Calculate drawdowns
        drawdowns = self._calculate_drawdowns(paths)
        
        return SimulationResult(
            paths=paths,
            final_values=final_values,
            metrics=metrics,
            percentiles=percentiles,
            drawdowns=drawdowns
        )
    
    def _calculate_metrics(
        self, 
        returns: np.ndarray, 
        paths: np.ndarray,
        initial_value: float
    ) -> Dict[str, float]:
        """Calculate risk and return metrics."""
        mean_return = np.mean(returns) * 100
        volatility = np.std(returns) * 100
        
        # Sharpe ratio (assuming 4% risk-free rate, annualized)
        risk_free = 0.04 / 252 * paths.shape[1]  # Scale to simulation period
        sharpe = (np.mean(returns) - risk_free) / np.std(returns) if np.std(returns) > 0 else 0
        
        # Value at Risk
        var_95 = (np.percentile(returns, 5)) * 100
        var_99 = (np.percentile(returns, 1)) * 100
        
        # Expected Shortfall (CVaR)
        threshold_95 = np.percentile(returns, 5)
        es_95 = np.mean(returns[returns <= threshold_95]) * 100
        
        # Skewness and Kurtosis
        skewness = float(((returns - returns.mean()) ** 3).mean() / (returns.std() ** 3))
        kurtosis = float(((returns - returns.mean()) ** 4).mean() / (returns.std() ** 4))
        
        # Probability of profit
        prob_profit = np.mean(returns > 0) * 100
        
        return {
            "meanReturn": round(mean_return, 2),
            "volatility": round(volatility, 2),
            "sharpeRatio": round(sharpe, 3),
            "var95": round(var_95, 2),
            "var99": round(var_99, 2),
            "expectedShortfall": round(es_95, 2),
            "skewness": round(skewness, 4),
            "kurtosis": round(kurtosis, 4),
            "probProfit": round(prob_profit, 1)
        }
    
    def _calculate_percentiles(self, final_values: np.ndarray) -> Dict[str, float]:
        """Calculate percentile values."""
        return {
            "p5": round(float(np.percentile(final_values, 5)), 2),
            "p10": round(float(np.percentile(final_values, 10)), 2),
            "p25": round(float(np.percentile(final_values, 25)), 2),
            "p50": round(float(np.percentile(final_values, 50)), 2),
            "p75": round(float(np.percentile(final_values, 75)), 2),
            "p90": round(float(np.percentile(final_values, 90)), 2),
            "p95": round(float(np.percentile(final_values, 95)), 2),
            "min": round(float(np.min(final_values)), 2),
            "max": round(float(np.max(final_values)), 2),
            "mean": round(float(np.mean(final_values)), 2)
        }
    
    def _calculate_drawdowns(self, paths: np.ndarray) -> Dict[str, float]:
        """Calculate drawdown statistics."""
        # Running maximum
        running_max = np.maximum.accumulate(paths, axis=1)
        
        # Drawdowns (negative values)
        drawdowns = (paths - running_max) / running_max
        
        # Maximum drawdown per simulation
        max_drawdowns = np.min(drawdowns, axis=1)
        
        return {
            "medianMaxDrawdown": round(float(np.percentile(max_drawdowns, 50)) * 100, 2),
            "p90MaxDrawdown": round(float(np.percentile(max_drawdowns, 10)) * 100, 2),  # Worst 10%
            "p95MaxDrawdown": round(float(np.percentile(max_drawdowns, 5)) * 100, 2),   # Worst 5%
            "worstDrawdown": round(float(np.min(max_drawdowns)) * 100, 2),
            "avgMaxDrawdown": round(float(np.mean(max_drawdowns)) * 100, 2)
        }
    
    def calculate_goal_probability(
        self,
        result: SimulationResult,
        target_value: float
    ) -> Dict[str, Any]:
        """Calculate probability of reaching a target value."""
        success_count = np.sum(result.final_values >= target_value)
        probability = success_count / len(result.final_values) * 100
        
        # Find median crossing day (if target achieved in median case)
        median_path = np.percentile(result.paths, 50, axis=0)
        crossing_day = None
        for day, value in enumerate(median_path):
            if value >= target_value:
                crossing_day = day
                break
        
        return {
            "probability": round(probability, 1),
            "successCount": int(success_count),
            "totalSimulations": len(result.final_values),
            "medianCrossingDay": crossing_day,
            "targetValue": target_value
        }


# Async wrapper for running simulation in process pool
async def run_simulation_async(
    assets: List[Dict],
    config: Dict,
    correlation_matrix: Optional[List[List[float]]] = None
) -> Dict[str, Any]:
    """Async wrapper to run simulation in a separate process."""
    
    def run():
        engine = MonteCarloEngine()
        
        # Convert dicts to dataclasses
        asset_params = [
            AssetParameters(
                ticker=a["ticker"],
                weight=a["weight"],
                mean_return=a.get("meanReturn", 0.0003),
                volatility=a.get("volatility", 0.015)
            )
            for a in assets
        ]
        
        sim_config = SimulationConfig(
            initial_value=config.get("initialValue", 10000),
            time_horizon=config.get("timeHorizon", 252),
            num_simulations=config.get("numSimulations", 1000),
            use_correlation=config.get("useCorrelation", True),
            use_fat_tails=config.get("useFatTails", True),
            use_garch=config.get("useGarch", True),
            use_regime_switching=config.get("useRegimeSwitching", True),
            use_jump_diffusion=config.get("useJumpDiffusion", True)
        )
        
        corr_matrix = np.array(correlation_matrix) if correlation_matrix else None
        
        result = engine.run_simulation(asset_params, sim_config, corr_matrix)
        
        # Convert to serializable format
        # Sample paths for visualization (keep 10 representative paths)
        sample_indices = np.linspace(0, len(result.paths) - 1, 10, dtype=int)
        sample_paths = result.paths[sample_indices].tolist()
        
        # Fan chart data (percentiles over time)
        fan_data = []
        step = max(1, sim_config.time_horizon // 50)
        for day in range(0, sim_config.time_horizon + 1, step):
            values = result.paths[:, day]
            fan_data.append({
                "day": day,
                "p10": round(float(np.percentile(values, 10)), 2),
                "p25": round(float(np.percentile(values, 25)), 2),
                "p50": round(float(np.percentile(values, 50)), 2),
                "p75": round(float(np.percentile(values, 75)), 2),
                "p90": round(float(np.percentile(values, 90)), 2)
            })
        
        return {
            "metrics": result.metrics,
            "percentiles": result.percentiles,
            "drawdowns": result.drawdowns,
            "samplePaths": sample_paths,
            "fanChartData": fan_data,
            "numSimulations": sim_config.num_simulations,
            "timeHorizon": sim_config.time_horizon
        }
    
    loop = asyncio.get_event_loop()
    with ProcessPoolExecutor(max_workers=1) as executor:
        return await loop.run_in_executor(executor, run)


# Singleton engine for simple use cases
monte_carlo_engine = MonteCarloEngine()
