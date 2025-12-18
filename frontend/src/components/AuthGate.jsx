/**
 * AuthGate - Mandatory Authentication Component
 * 
 * This component wraps the main app and requires users to sign in
 * or create an account before accessing the portfolio simulator.
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  Shield, 
  Zap, 
  BarChart3, 
  Mail, 
  Lock, 
  User, 
  AlertCircle, 
  CheckCircle, 
  Loader2,
  Star,
  Target,
  Activity
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const AuthGate = ({ children }) => {
  const { isAuthenticated, loading: authLoading, login, register } = useAuth();
  const { colors, isDark } = useTheme();
  
  const [mode, setMode] = useState('landing'); // 'login', 'register', 'landing'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Reset form state when user logs out (isAuthenticated becomes false)
  useEffect(() => {
    if (!isAuthenticated && !authLoading) {
      setSuccess(false);
      setError('');
      setEmail('');
      setPassword('');
      setName('');
      setMode('login');
      setLoading(false);
    }
  }, [isAuthenticated, authLoading]);

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className={`min-h-screen ${colors.bg} flex items-center justify-center`}>
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-rose-500 animate-spin mx-auto mb-4" />
          <p className={colors.textMuted}>Loading PortfolioPath...</p>
        </div>
      </div>
    );
  }

  // If authenticated, render the app
  if (isAuthenticated) {
    return children;
  }

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let result;
      if (mode === 'login') {
        result = await login(email, password);
      } else {
        if (!name.trim()) {
          setError('Username is required');
          setLoading(false);
          return;
        }
        if (password.length < 8) {
          setError('Password must be at least 8 characters');
          setLoading(false);
          return;
        }
        // Check for letter and number
        const hasLetter = /[a-zA-Z]/.test(password);
        const hasNumber = /[0-9]/.test(password);
        if (!hasLetter || !hasNumber) {
          setError('Password must contain at least one letter and one number');
          setLoading(false);
          return;
        }
        result = await register(email, password, name);
      }

      if (result.success) {
        setSuccess(true);
      } else {
        setError(result.error || 'Authentication failed');
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Landing page with features
  if (mode === 'landing') {
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
              onClick={() => setMode('register')}
              className="px-8 py-4 bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-500 hover:to-red-600 rounded-xl transition-all font-bold text-lg shadow-xl shadow-rose-900/30 text-white mr-4"
            >
              Get Started Free
            </button>
            <button
              onClick={() => setMode('login')}
              className={`px-8 py-4 ${colors.card} ${colors.border} rounded-xl transition-all font-medium text-lg`}
            >
              Sign In
            </button>
          </div>

          {/* Free Tier Info */}
          <div className={`mt-12 grid md:grid-cols-2 gap-6 max-w-4xl mx-auto`}>
            {/* Free Plan */}
            <div className={`${colors.card} ${colors.border} rounded-xl p-6`}>
              <h3 className={`font-semibold mb-4 flex items-center gap-2 ${colors.text}`}>
                <Star className="w-5 h-5 text-zinc-400" />
                Free Plan
              </h3>
              <p className={`text-2xl font-bold mb-4 ${colors.text}`}>$0<span className="text-sm font-normal text-zinc-500">/forever</span></p>
              <ul className={`space-y-2 text-sm ${colors.textMuted}`}>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-400" /> 10 simulations/day</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-400" /> 3 saved portfolios</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-400" /> Basic risk metrics</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-400" /> Goal probability calculator</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-400" /> Real market data</li>
              </ul>
              <button
                onClick={() => setMode('register')}
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
                onClick={() => setMode('register')}
                className="w-full mt-6 py-3 bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-500 hover:to-red-600 rounded-lg font-medium text-white transition-all shadow-lg shadow-rose-900/30"
              >
                Start Free, Upgrade Anytime
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Auth Form
  return (
    <div className={`min-h-screen ${colors.bg} flex items-center justify-center p-4`}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`${colors.card} ${colors.border} rounded-2xl shadow-2xl max-w-md w-full p-8`}
      >
        {/* Success State */}
        {success ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-8"
          >
            <CheckCircle className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-emerald-400 mb-2">
              {mode === 'login' ? 'Welcome back!' : 'Account created!'}
            </h2>
            <p className={colors.textMuted}>Redirecting to app...</p>
          </motion.div>
        ) : (
          <>
            {/* Header */}
            <div className="text-center mb-6">
              <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-rose-400 to-red-400 bg-clip-text text-transparent">
                PortfolioPath
              </h1>
              <h2 className={`text-lg font-medium ${colors.text}`}>
                {mode === 'login' ? 'Welcome Back' : 'Create Account'}
              </h2>
              <p className={`text-sm ${colors.textMuted} mt-1`}>
                {mode === 'login' 
                  ? 'Sign in to access your portfolios' 
                  : 'Start your free portfolio analysis'}
              </p>
            </div>

            {/* Error Display */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-900/30 border border-red-700/50 rounded-lg p-3 mb-4 flex gap-2"
              >
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-300">{error}</p>
              </motion.div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'register' && (
                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${colors.textMuted} uppercase tracking-wider`}>
                    Username
                  </label>
                  <div className="relative">
                    <User className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${colors.textSubtle}`} />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className={`w-full ${colors.input} ${colors.border} rounded-lg pl-10 pr-4 py-2.5 ${colors.text} focus:ring-1 focus:ring-rose-500/50 focus:border-rose-500/50 focus:outline-none transition-all text-sm`}
                      placeholder="johndoe"
                      required
                      minLength={3}
                      disabled={loading}
                    />
                  </div>
                </div>
              )}

              <div>
                <label className={`block text-xs font-medium mb-1.5 ${colors.textMuted} uppercase tracking-wider`}>
                  Email
                </label>
                <div className="relative">
                  <Mail className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${colors.textSubtle}`} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`w-full ${colors.input} ${colors.border} rounded-lg pl-10 pr-4 py-2.5 ${colors.text} focus:ring-1 focus:ring-rose-500/50 focus:border-rose-500/50 focus:outline-none transition-all text-sm`}
                    placeholder="you@example.com"
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              <div>
                <label className={`block text-xs font-medium mb-1.5 ${colors.textMuted} uppercase tracking-wider`}>
                  Password {mode === 'register' && <span className={colors.textSubtle}>(min 8 chars, letter + number)</span>}
                </label>
                <div className="relative">
                  <Lock className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${colors.textSubtle}`} />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`w-full ${colors.input} ${colors.border} rounded-lg pl-10 pr-4 py-2.5 ${colors.text} focus:ring-1 focus:ring-rose-500/50 focus:border-rose-500/50 focus:outline-none transition-all text-sm`}
                    placeholder="••••••••"
                    required
                    minLength={mode === 'register' ? 8 : 1}
                    disabled={loading}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-500 hover:to-red-600 rounded-lg transition-all font-medium shadow-lg shadow-rose-900/30 text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {mode === 'login' ? 'Signing in...' : 'Creating account...'}
                  </>
                ) : mode === 'login' ? 'Sign In' : 'Create Free Account'}
              </button>
            </form>

            {/* Toggle Mode */}
            <div className="mt-6 text-center">
              <p className={`text-sm ${colors.textMuted}`}>
                {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}
                {' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode(mode === 'login' ? 'register' : 'login');
                    setError('');
                  }}
                  disabled={loading}
                  className="text-rose-400 hover:text-rose-300 font-medium transition-colors"
                >
                  {mode === 'login' ? 'Sign up free' : 'Sign in'}
                </button>
              </p>
            </div>

            {/* Back to Landing */}
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => setMode('landing')}
                className={`text-xs ${colors.textSubtle} hover:${colors.textMuted} transition-colors`}
              >
                ← Back to features
              </button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
};

export default AuthGate;
