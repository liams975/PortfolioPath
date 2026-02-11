/**
 * LandingPage - Feature showcase landing page
 * 
 * Displays the app features and pricing tiers before entering the simulator.
 * No actual authentication - clicking "Get Started" goes straight to the app.
 */

import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  Shield, 
  Zap, 
  BarChart3, 
  CheckCircle, 
  Star,
  Target,
  Activity
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const LandingPage = ({ onEnter }) => {
  const { colors } = useTheme();

  return (
    <div className={`min-h-screen ${colors.bg} ${colors.text}`}>
      {/* Hero Section */}
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl font-bold mb-4 bg-gradient-to-r from-rose-400 via-red-400 to-rose-500 bg-clip-text text-transparent"
          >
            PortfolioPath Pro
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className={`text-xl ${colors.textMuted} max-w-2xl mx-auto`}
          >
            Advanced Monte Carlo portfolio simulation with institutional-grade risk analytics
          </motion.p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {[
            { icon: BarChart3, title: 'Monte Carlo Simulation', desc: '1,000+ simulations with GARCH, regime switching, and jump diffusion models' },
            { icon: Target, title: 'Goal Planning', desc: 'Calculate probability of reaching your financial targets' },
            { icon: Activity, title: 'Risk Analytics', desc: 'VaR, Sharpe ratio, drawdown analysis, and more' },
            { icon: Zap, title: 'Real Market Data', desc: 'Live Yahoo Finance integration for accurate parameters' },
            { icon: Shield, title: 'Stress Testing', desc: 'Test against 2008 crash, COVID, stagflation scenarios' },
            { icon: TrendingUp, title: 'Portfolio Comparison', desc: 'Side-by-side analysis of different strategies' },
          ].map((feature, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * idx }}
              className={`${colors.card} ${colors.border} rounded-xl p-6`}
            >
              <feature.icon className="w-8 h-8 text-rose-400 mb-3" />
              <h3 className={`font-semibold mb-2 ${colors.text}`}>{feature.title}</h3>
              <p className={`text-sm ${colors.textMuted}`}>{feature.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center">
          <button
            onClick={onEnter}
            className="px-8 py-4 bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-500 hover:to-red-600 rounded-xl transition-all font-bold text-lg shadow-xl shadow-rose-900/30 text-white"
          >
            Get Started Free
          </button>
        </div>

        {/* Tier Info */}
        <div className={`mt-12 grid md:grid-cols-2 gap-6 max-w-4xl mx-auto`}>
          {/* Free Plan */}
          <div className={`${colors.card} ${colors.border} rounded-xl p-6`}>
            <h3 className={`font-semibold mb-4 flex items-center gap-2 ${colors.text}`}>
              <Star className="w-5 h-5 text-zinc-400" />
              Free Plan
            </h3>
            <p className={`text-2xl font-bold mb-4 ${colors.text}`}>$0<span className="text-sm font-normal text-zinc-500">/forever</span></p>
            <ul className={`space-y-2 text-sm ${colors.textMuted}`}>
              <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-400" /> Unlimited simulations</li>
              <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-400" /> Save portfolios locally</li>
              <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-400" /> Basic risk metrics</li>
              <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-400" /> Goal probability calculator</li>
              <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-400" /> Real market data</li>
            </ul>
            <button
              onClick={onEnter}
              className={`w-full mt-6 py-3 ${colors.card} ${colors.border} rounded-lg font-medium transition-all hover:border-rose-500/50`}
            >
              Get Started Free
            </button>
          </div>

          {/* Pro Plan */}
          <div className={`${colors.card} border-2 border-rose-500/50 rounded-xl p-6 relative overflow-hidden`}>
            <div className="absolute top-0 right-0 bg-gradient-to-l from-rose-500 to-red-500 text-white text-xs font-bold px-4 py-1 rounded-bl-lg">
              RECOMMENDED
            </div>
            <h3 className={`font-semibold mb-4 flex items-center gap-2 ${colors.text}`}>
              <Star className="w-5 h-5 text-amber-400" />
              Pro Plan
            </h3>
            <p className={`text-2xl font-bold mb-4 ${colors.text}`}>$9.99<span className="text-sm font-normal text-zinc-500">/month</span></p>
            <ul className={`space-y-2 text-sm ${colors.textMuted}`}>
              <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-rose-400" /> <span className="text-rose-400 font-medium">Unlimited</span> simulations</li>
              <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-rose-400" /> <span className="text-rose-400 font-medium">Unlimited</span> saved portfolios</li>
              <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-rose-400" /> Advanced models (GARCH, regime switching)</li>
              <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-rose-400" /> Efficient frontier analysis</li>
              <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-rose-400" /> PDF & CSV export</li>
              <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-rose-400" /> Stress testing scenarios</li>
              <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-rose-400" /> Correlation matrix</li>
              <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-rose-400" /> Priority support</li>
            </ul>
            <button
              onClick={onEnter}
              className="w-full mt-6 py-3 bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-500 hover:to-red-600 rounded-lg font-medium text-white transition-all shadow-lg shadow-rose-900/30"
            >
              Start Free, Upgrade Anytime
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
