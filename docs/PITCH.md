# PortfolioPath - Sales Pitch & Strategy

## The Problem

> "Retail investors make portfolio decisions based on gut feeling or oversimplified tools that assume markets behave normally. They don't."

Most portfolio calculators show simple averages and assume markets follow normal distributions. But markets crash, volatility clusters, and regime changes happen. Traditional tools leave investors blind to real downside risk.

---

## The Solution

**PortfolioPath** uses institutional-grade Monte Carlo simulation to show investors the true range of outcomes—including crashes, volatility spikes, and regime changes.

### Live Demo
- **App:** https://portfoliopath-f9197.web.app
- **API:** https://portfoliopath-production.up.railway.app

---

## Key Differentiators

### 1. Academic-Grade Simulation Models

| Model | What It Does | Why It Matters |
|-------|--------------|----------------|
| **GARCH(1,1)** | Volatility clustering | Big moves follow big moves |
| **Regime Switching** | Bull/bear market transitions | Captures market cycles |
| **Fat Tails (Student-t)** | More realistic crash probabilities | Normal distributions underestimate crashes |
| **Jump Diffusion** | Sudden market shocks | Models flash crashes, black swans |
| **Correlation Matrix** | Assets move together | Realistic diversification effects |

*"While competitors assume markets behave normally, PortfolioPath models how markets actually behave."*

### 2. Interactive Percentile Explorer
Slider lets users explore **any** percentile outcome in real-time. Most tools only show fixed 10th/50th/90th percentiles.

### 3. Goal Probability Calculator
Direct answer to "What's my chance of reaching $X?" with a visual probability gauge.

### 4. Stress Test Scenarios
Pre-built scenarios (2008 crash, COVID, stagflation) show how portfolios perform in historical crises.

---

## Competitive Landscape

| Competitor | Monte Carlo Quality | Interactive Percentile | Stress Testing | Price |
|------------|--------------------|-----------------------|----------------|-------|
| **PortfolioPath** | ✅ GARCH, Regime, Jumps | ✅ Any % | ✅ Pre-built | Free / $9.99/mo |
| Portfolio Visualizer | ❌ Basic | ❌ Fixed | ❌ Manual | $19-47/mo |
| ProjectionLab | ❌ Basic | ❌ Fixed | ❌ None | $8-12/mo |
| Empower | ❌ None | ❌ None | ❌ None | Free (sells advisory) |
| cFIREsim | ❌ Basic | ❌ Fixed | ❌ Limited | Free |

---

## Market Opportunity

| Segment | Size | Description |
|---------|------|-------------|
| **TAM** | 150M+ | Self-directed investors in US |
| **SAM** | 30M | Actively managing portfolios online |
| **SOM** | 500K | Seriously engaged DIY investors (FIRE, Bogleheads) |

---

## Business Model

### Freemium Tiers

| Tier | Price | Features |
|------|-------|----------|
| **Free** | $0 | 3 portfolios, 100 simulations, basic metrics |
| **Pro** | $9.99/mo | Unlimited portfolios, 10,000 simulations, all models, export |
| **Advisor** | $49.99/mo | White-label, client management, API access |

### Revenue Projections (Conservative)

| Year | Users | Conversion | MRR | ARR |
|------|-------|------------|-----|-----|
| Y1 | 10,000 | 3% | $3,000 | $36,000 |
| Y2 | 50,000 | 4% | $20,000 | $240,000 |
| Y3 | 150,000 | 5% | $75,000 | $900,000 |

---

## Current Features

- ✅ Monte Carlo simulation with advanced models
- ✅ Portfolio comparison tool
- ✅ Real-time risk metrics (VaR, Sharpe ratio, drawdown)
- ✅ Goal probability calculator
- ✅ Preset portfolio templates
- ✅ Stress testing scenarios
- ✅ User authentication & saved portfolios
- ✅ Real Yahoo Finance market data
- ✅ CSV/PDF export
- ✅ Dark/light theme

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React + Vite + Tailwind CSS |
| Backend | Python FastAPI |
| Database | SQLite (PostgreSQL ready) |
| Hosting | Firebase (frontend) + Railway (backend) |
| Payments | Stripe (integrated) |

---

## Roadmap

### Near-term
- [ ] Historical backtesting
- [ ] Withdrawal/contribution modeling
- [ ] Inflation adjustment
- [ ] Rebalancing simulation

### Medium-term
- [ ] Mobile app (React Native)
- [ ] Tax-loss harvesting simulation
- [ ] Brokerage integration

### Long-term
- [ ] AI portfolio recommendations
- [ ] Advisor white-label version
- [ ] API access for developers

---

## Pitch Deck Summary

1. **Problem:** Investors can't see true risk with simple calculators
2. **Solution:** Institutional-grade Monte Carlo simulation made accessible
3. **Demo:** Live at portfoliopath-f9197.web.app
4. **Market:** 30M+ DIY investors actively managing online
5. **Differentiation:** Only tool with GARCH, regime switching, fat tails, jumps
6. **Business Model:** Freemium → $9.99/mo Pro → $49.99/mo Advisor
7. **Traction:** [Add metrics here]
8. **Ask:** [Funding amount and use of funds]

---

*Last Updated: December 2024*
