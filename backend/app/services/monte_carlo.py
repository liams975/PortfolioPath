"""Monte Carlo simulation engine using NumPy for performance."""
import numpy as np
from typing import Dict, List, Any
from dataclasses import dataclass
import asyncio
from concurrent.futures import ThreadPoolExecutor

# Shared thread pool for CPU-bound simulations
_executor = ThreadPoolExecutor(max_workers=2)


@dataclass
class SimulationConfig:
    """Configuration for Monte Carlo simulation."""
    initial_investment: float = 10000
    monthly_contribution: float = 0
    time_horizon: int = 10  # years
    num_simulations: int = 1000
    include_dividends: bool = True
    dividend_yield: float = 0.02
    include_jump_diffusion: bool = False
    jump_probability: float = 0.05
    jump_mean: float = -0.1
    jump_std: float = 0.15
    rebalancing_frequency: str = "none"  # none, monthly, quarterly, yearly


class MonteCarloEngine:
    """High-performance Monte Carlo simulation engine using NumPy."""
    
    @staticmethod
    def _run_simulation_sync(
        expected_return: float,
        volatility: float,
        config: SimulationConfig
    ) -> Dict[str, Any]:
        """Run Monte Carlo simulation synchronously."""
        # Time parameters
        years = config.time_horizon
        months = years * 12
        
        # Initialize arrays
        num_sims = config.num_simulations
        paths = np.zeros((num_sims, months + 1))
        paths[:, 0] = config.initial_investment
        
        # Monthly parameters for GBM (log-normal model)
        # For GBM: dS/S = mu*dt + sigma*dW
        # Monthly drift should account for volatility drag: (mu - sigma^2/2) / 12
        monthly_vol = volatility / np.sqrt(12)
        monthly_drift = (expected_return - 0.5 * volatility**2) / 12
        monthly_div = config.dividend_yield / 12 if config.include_dividends else 0
        
        # Generate random shocks for GBM
        np.random.seed()  # Ensure different results each run
        random_shocks = np.random.normal(0, 1, (num_sims, months))
        
        # Calculate log returns: (drift + dividend)*dt + vol*sqrt(dt)*Z
        log_returns = (monthly_drift + monthly_div) + monthly_vol * random_shocks
        
        # Add jump diffusion if enabled (in log space)
        if config.include_jump_diffusion:
            jumps = np.random.binomial(1, config.jump_probability, (num_sims, months))
            jump_sizes = np.random.normal(config.jump_mean, config.jump_std, (num_sims, months))
            log_returns += jumps * jump_sizes
        
        # Simulate paths using GBM: S(t+1) = S(t) * exp(log_return)
        for t in range(months):
            paths[:, t + 1] = paths[:, t] * np.exp(log_returns[:, t]) + config.monthly_contribution
        
        # Calculate statistics at each time point
        percentiles = [5, 10, 25, 50, 75, 90, 95]
        yearly_data = []
        
        for year in range(years + 1):
            month_idx = year * 12 if year < years else months
            values = paths[:, month_idx]
            
            yearly_data.append({
                "year": year,
                "mean": float(np.mean(values)),
                "median": float(np.median(values)),
                "std": float(np.std(values)),
                "min": float(np.min(values)),
                "max": float(np.max(values)),
                "percentiles": {
                    str(p): float(np.percentile(values, p))
                    for p in percentiles
                }
            })
        
        # Final values
        final_values = paths[:, -1]
        total_invested = config.initial_investment + (config.monthly_contribution * months)
        
        # Risk metrics
        returns = np.diff(paths, axis=1) / paths[:, :-1]
        
        # Calculate drawdowns
        running_max = np.maximum.accumulate(paths, axis=1)
        drawdowns = (paths - running_max) / running_max
        max_drawdowns = np.min(drawdowns, axis=1)
        
        # Probability calculations
        prob_profit = float(np.mean(final_values > total_invested))
        prob_double = float(np.mean(final_values > 2 * config.initial_investment))
        prob_loss = float(np.mean(final_values < total_invested))
        
        # Sample paths for visualization (10 representative paths)
        sample_indices = np.linspace(0, num_sims - 1, 10, dtype=int)
        sample_paths = []
        for idx in sample_indices:
            path_data = []
            for year in range(years + 1):
                month_idx = year * 12 if year < years else months
                path_data.append({
                    "year": year,
                    "value": float(paths[idx, month_idx])
                })
            sample_paths.append(path_data)
        
        return {
            "summary": {
                "initial_investment": config.initial_investment,
                "total_invested": float(total_invested),
                "expected_return": expected_return,
                "volatility": volatility,
                "time_horizon": years,
                "num_simulations": num_sims,
            },
            "final_values": {
                "mean": float(np.mean(final_values)),
                "median": float(np.median(final_values)),
                "std": float(np.std(final_values)),
                "min": float(np.min(final_values)),
                "max": float(np.max(final_values)),
                "percentiles": {
                    str(p): float(np.percentile(final_values, p))
                    for p in percentiles
                }
            },
            "risk_metrics": {
                "probability_profit": prob_profit,
                "probability_double": prob_double,
                "probability_loss": prob_loss,
                "value_at_risk_5": float(np.percentile(final_values, 5)),
                "value_at_risk_1": float(np.percentile(final_values, 1)),
                "expected_shortfall_5": float(np.mean(final_values[final_values <= np.percentile(final_values, 5)])),
                "max_drawdown_mean": float(np.mean(max_drawdowns)),
                "max_drawdown_worst": float(np.min(max_drawdowns)),
                "sharpe_ratio": float(np.mean(returns) / np.std(returns) * np.sqrt(12)) if np.std(returns) > 0 else 0,
            },
            "yearly_data": yearly_data,
            "sample_paths": sample_paths,
        }
    
    @staticmethod
    async def run_simulation(
        expected_return: float,
        volatility: float,
        config: SimulationConfig
    ) -> Dict[str, Any]:
        """Run Monte Carlo simulation asynchronously."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            _executor,
            MonteCarloEngine._run_simulation_sync,
            expected_return,
            volatility,
            config
        )
    
    @staticmethod
    def _calculate_portfolio_metrics_sync(
        holdings: List[Dict[str, Any]],
        historical_data: Dict[str, Any]
    ) -> Dict[str, float]:
        """Calculate portfolio metrics from holdings and historical data."""
        
        # Build returns matrix and weights
        returns_list = []
        weights = []
        
        for holding in holdings:
            ticker = holding['ticker']
            allocation = holding['allocation'] / 100
            
            if ticker in historical_data:
                hist = historical_data[ticker]
                returns_list.append(hist['returns'])
                weights.append(allocation)
        
        if not returns_list:
            return {
                "expected_return": 0.08,
                "volatility": 0.15,
                "sharpe_ratio": 0.53
            }
        
        # Convert to numpy arrays
        weights = np.array(weights)
        weights = weights / weights.sum()  # Normalize
        
        # Stack returns and align
        min_len = min(len(r) for r in returns_list)
        returns_matrix = np.column_stack([r[-min_len:] for r in returns_list])
        
        # Portfolio return and volatility
        mean_returns = np.mean(returns_matrix, axis=0)
        cov_matrix = np.cov(returns_matrix.T)
        
        portfolio_return = np.dot(weights, mean_returns) * 252  # Annualized
        portfolio_vol = np.sqrt(np.dot(weights.T, np.dot(cov_matrix, weights))) * np.sqrt(252)
        
        sharpe = portfolio_return / portfolio_vol if portfolio_vol > 0 else 0
        
        return {
            "expected_return": float(portfolio_return),
            "volatility": float(portfolio_vol),
            "sharpe_ratio": float(sharpe)
        }
    
    @staticmethod
    async def calculate_portfolio_metrics(
        holdings: List[Dict[str, Any]],
        historical_data: Dict[str, Any]
    ) -> Dict[str, float]:
        """Calculate portfolio metrics asynchronously."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            _executor,
            MonteCarloEngine._calculate_portfolio_metrics_sync,
            holdings,
            historical_data
        )
    
    @staticmethod
    def _generate_efficient_frontier_sync(
        tickers: List[str],
        returns_data: Dict[str, List[float]],
        num_portfolios: int = 100
    ) -> Dict[str, Any]:
        """Generate efficient frontier points."""
        
        if len(tickers) < 2:
            return {"points": [], "error": "Need at least 2 assets"}
        
        # Prepare data
        min_len = min(len(returns_data.get(t, [])) for t in tickers)
        if min_len < 30:
            return {"points": [], "error": "Insufficient data"}
        
        returns_matrix = np.column_stack([
            returns_data[t][-min_len:] for t in tickers
        ])
        
        mean_returns = np.mean(returns_matrix, axis=0) * 252
        cov_matrix = np.cov(returns_matrix.T) * 252
        
        n_assets = len(tickers)
        points = []
        
        # Generate random portfolios
        for _ in range(num_portfolios):
            weights = np.random.random(n_assets)
            weights /= weights.sum()
            
            port_return = np.dot(weights, mean_returns)
            port_vol = np.sqrt(np.dot(weights.T, np.dot(cov_matrix, weights)))
            sharpe = port_return / port_vol if port_vol > 0 else 0
            
            points.append({
                "return": float(port_return),
                "volatility": float(port_vol),
                "sharpe": float(sharpe),
                "weights": {tickers[i]: float(weights[i]) for i in range(n_assets)}
            })
        
        # Sort by volatility for frontier
        points.sort(key=lambda x: x['volatility'])
        
        # Find efficient frontier (highest return for each vol level)
        frontier_points = []
        max_return = float('-inf')
        for p in sorted(points, key=lambda x: x['volatility']):
            if p['return'] >= max_return:
                frontier_points.append(p)
                max_return = p['return']
        
        return {
            "all_portfolios": points,
            "efficient_frontier": frontier_points,
            "assets": tickers
        }
    
    @staticmethod
    async def generate_efficient_frontier(
        tickers: List[str],
        returns_data: Dict[str, List[float]],
        num_portfolios: int = 100
    ) -> Dict[str, Any]:
        """Generate efficient frontier asynchronously."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            _executor,
            MonteCarloEngine._generate_efficient_frontier_sync,
            tickers,
            returns_data,
            num_portfolios
        )
