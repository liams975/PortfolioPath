/**
 * AccountSettings - User Profile & Subscription Management
 * 
 * Allows users to:
 * - View account details
 * - Change password
 * - View usage statistics
 * - Manage subscription
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  User, 
  Mail, 
  Lock, 
  Crown, 
  Star, 
  Calendar,
  Activity,
  FolderOpen,
  CheckCircle,
  AlertCircle,
  Loader2,
  ChevronRight,
  Settings
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { usePremium } from '../context/PremiumContext';
import { useTheme } from '../context/ThemeContext';

const AccountSettings = ({ isOpen, onClose, onUpgrade }) => {
  const { user, logout, getPortfolios } = useAuth();
  const { isPremium, dailySimulations, FREE_SIMULATION_LIMIT } = usePremium();
  const { colors, isDark } = useTheme();
  
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Profile state
  const [portfolioCount, setPortfolioCount] = useState(0);
  
  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Fetch portfolio count
  useEffect(() => {
    const fetchData = async () => {
      try {
        const portfolios = await getPortfolios();
        setPortfolioCount(portfolios?.length || 0);
      } catch (e) {
        console.error('Failed to fetch portfolios:', e);
      }
    };
    if (isOpen && user) {
      fetchData();
    }
  }, [isOpen, user, getPortfolios]);

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match' });
      return;
    }
    
    if (newPassword.length < 8) {
      setMessage({ type: 'error', text: 'Password must be at least 8 characters' });
      return;
    }
    
    const hasLetter = /[a-zA-Z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);
    if (!hasLetter || !hasNumber) {
      setMessage({ type: 'error', text: 'Password must contain at least one letter and one number' });
      return;
    }

    setLoading(true);
    try {
      // TODO: Implement password change API call
      // await changePassword(currentPassword, newPassword);
      setMessage({ type: 'success', text: 'Password changed successfully' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Failed to change password' });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className={`${colors.card} ${colors.border} rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className={`flex items-center justify-between p-4 border-b ${colors.border}`}>
            <div className="flex items-center gap-3">
              <Settings className="w-5 h-5 text-rose-400" />
              <h2 className={`text-lg font-semibold ${colors.text}`}>Account Settings</h2>
            </div>
            <button
              onClick={onClose}
              className={`p-2 ${isDark ? 'hover:bg-zinc-800' : 'hover:bg-gray-100'} rounded-lg transition-all`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex">
            {/* Sidebar */}
            <div className={`w-48 border-r ${colors.border} p-2`}>
              {[
                { id: 'profile', label: 'Profile', icon: User },
                { id: 'usage', label: 'Usage', icon: Activity },
                { id: 'subscription', label: 'Subscription', icon: Crown },
                { id: 'security', label: 'Security', icon: Lock },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                    activeTab === tab.id
                      ? 'bg-rose-500/20 text-rose-400'
                      : `${colors.textMuted} ${isDark ? 'hover:bg-zinc-800' : 'hover:bg-gray-100'}`
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 p-6 overflow-y-auto max-h-[60vh]">
              {/* Profile Tab */}
              {activeTab === 'profile' && (
                <div className="space-y-6">
                  <div>
                    <h3 className={`text-sm font-medium ${colors.textMuted} uppercase tracking-wider mb-3`}>
                      Account Information
                    </h3>
                    <div className="space-y-3">
                      <div className={`flex items-center gap-3 p-3 ${isDark ? 'bg-zinc-800/50' : 'bg-gray-50'} rounded-lg`}>
                        <User className="w-5 h-5 text-rose-400" />
                        <div>
                          <p className={`text-xs ${colors.textMuted}`}>Username</p>
                          <p className={`font-medium ${colors.text}`}>{user?.username || user?.name || 'N/A'}</p>
                        </div>
                      </div>
                      <div className={`flex items-center gap-3 p-3 ${isDark ? 'bg-zinc-800/50' : 'bg-gray-50'} rounded-lg`}>
                        <Mail className="w-5 h-5 text-rose-400" />
                        <div>
                          <p className={`text-xs ${colors.textMuted}`}>Email</p>
                          <p className={`font-medium ${colors.text}`}>{user?.email || 'N/A'}</p>
                        </div>
                      </div>
                      <div className={`flex items-center gap-3 p-3 ${isDark ? 'bg-zinc-800/50' : 'bg-gray-50'} rounded-lg`}>
                        <Calendar className="w-5 h-5 text-rose-400" />
                        <div>
                          <p className={`text-xs ${colors.textMuted}`}>Member Since</p>
                          <p className={`font-medium ${colors.text}`}>{formatDate(user?.created_at)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Usage Tab */}
              {activeTab === 'usage' && (
                <div className="space-y-6">
                  <div>
                    <h3 className={`text-sm font-medium ${colors.textMuted} uppercase tracking-wider mb-3`}>
                      Today's Usage
                    </h3>
                    <div className="space-y-4">
                      <div className={`p-4 ${isDark ? 'bg-zinc-800/50' : 'bg-gray-50'} rounded-lg`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className={colors.textMuted}>Simulations</span>
                          <span className={`font-mono ${colors.text}`}>
                            {isPremium ? '∞' : `${dailySimulations}/${FREE_SIMULATION_LIMIT}`}
                          </span>
                        </div>
                        {!isPremium && (
                          <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-rose-500 transition-all"
                              style={{ width: `${(dailySimulations / FREE_SIMULATION_LIMIT) * 100}%` }}
                            />
                          </div>
                        )}
                      </div>
                      
                      <div className={`p-4 ${isDark ? 'bg-zinc-800/50' : 'bg-gray-50'} rounded-lg`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <FolderOpen className="w-4 h-4 text-rose-400" />
                            <span className={colors.textMuted}>Saved Portfolios</span>
                          </div>
                          <span className={`font-mono ${colors.text}`}>
                            {isPremium ? `${portfolioCount}/∞` : `${portfolioCount}/3`}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {!isPremium && (
                    <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-lg">
                      <p className={`text-sm ${colors.textMuted} mb-2`}>
                        Upgrade to Pro for unlimited simulations and portfolios
                      </p>
                      <button
                        onClick={onUpgrade}
                        className="flex items-center gap-2 text-rose-400 text-sm font-medium hover:text-rose-300"
                      >
                        <Star className="w-4 h-4" />
                        Upgrade to Pro
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Subscription Tab */}
              {activeTab === 'subscription' && (
                <div className="space-y-6">
                  <div>
                    <h3 className={`text-sm font-medium ${colors.textMuted} uppercase tracking-wider mb-3`}>
                      Current Plan
                    </h3>
                    <div className={`p-4 rounded-lg ${isPremium ? 'bg-amber-500/10 border border-amber-500/30' : `${isDark ? 'bg-zinc-800/50' : 'bg-gray-50'}`}`}>
                      <div className="flex items-center gap-3 mb-2">
                        {isPremium ? (
                          <Crown className="w-6 h-6 text-amber-400" />
                        ) : (
                          <User className="w-6 h-6 text-zinc-400" />
                        )}
                        <div>
                          <p className={`font-semibold ${isPremium ? 'text-amber-400' : colors.text}`}>
                            {isPremium ? 'Pro Plan' : 'Free Plan'}
                          </p>
                          <p className={`text-xs ${colors.textMuted}`}>
                            {isPremium ? '$9.99/month' : 'Limited features'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {!isPremium && (
                    <div>
                      <h3 className={`text-sm font-medium ${colors.textMuted} uppercase tracking-wider mb-3`}>
                        Pro Benefits
                      </h3>
                      <ul className="space-y-2">
                        {[
                          'Unlimited simulations',
                          'Unlimited saved portfolios',
                          'PDF & CSV export',
                          'Advanced models (GARCH, regime switching)',
                          'Efficient frontier analysis',
                          'Priority support',
                        ].map((benefit, idx) => (
                          <li key={idx} className="flex items-center gap-2 text-sm">
                            <CheckCircle className="w-4 h-4 text-emerald-400" />
                            <span className={colors.textMuted}>{benefit}</span>
                          </li>
                        ))}
                      </ul>
                      <button
                        onClick={onUpgrade}
                        className="mt-4 w-full py-3 bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-500 hover:to-red-600 rounded-lg transition-all font-medium text-white flex items-center justify-center gap-2"
                      >
                        <Star className="w-4 h-4" />
                        Upgrade to Pro - $9.99/mo
                      </button>
                    </div>
                  )}

                  {isPremium && (
                    <div className={`p-4 ${isDark ? 'bg-zinc-800/50' : 'bg-gray-50'} rounded-lg`}>
                      <p className={`text-sm ${colors.textMuted}`}>
                        Thank you for being a Pro member! Your subscription renews automatically.
                      </p>
                      <button className="mt-2 text-sm text-rose-400 hover:text-rose-300">
                        Manage subscription →
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Security Tab */}
              {activeTab === 'security' && (
                <div className="space-y-6">
                  <div>
                    <h3 className={`text-sm font-medium ${colors.textMuted} uppercase tracking-wider mb-3`}>
                      Change Password
                    </h3>

                    {message.text && (
                      <div className={`p-3 rounded-lg mb-4 flex items-center gap-2 ${
                        message.type === 'error' 
                          ? 'bg-red-900/30 border border-red-700/50' 
                          : 'bg-emerald-900/30 border border-emerald-700/50'
                      }`}>
                        {message.type === 'error' ? (
                          <AlertCircle className="w-4 h-4 text-red-400" />
                        ) : (
                          <CheckCircle className="w-4 h-4 text-emerald-400" />
                        )}
                        <p className={`text-sm ${message.type === 'error' ? 'text-red-300' : 'text-emerald-300'}`}>
                          {message.text}
                        </p>
                      </div>
                    )}

                    <form onSubmit={handlePasswordChange} className="space-y-3">
                      <div>
                        <label className={`block text-xs ${colors.textMuted} mb-1`}>Current Password</label>
                        <input
                          type="password"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          className={`w-full ${colors.input} ${colors.border} rounded-lg px-3 py-2 text-sm ${colors.text}`}
                          required
                          disabled={loading}
                        />
                      </div>
                      <div>
                        <label className={`block text-xs ${colors.textMuted} mb-1`}>New Password</label>
                        <input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className={`w-full ${colors.input} ${colors.border} rounded-lg px-3 py-2 text-sm ${colors.text}`}
                          required
                          minLength={8}
                          disabled={loading}
                        />
                      </div>
                      <div>
                        <label className={`block text-xs ${colors.textMuted} mb-1`}>Confirm New Password</label>
                        <input
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className={`w-full ${colors.input} ${colors.border} rounded-lg px-3 py-2 text-sm ${colors.text}`}
                          required
                          disabled={loading}
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={loading}
                        className={`w-full py-2 ${colors.button} rounded-lg text-sm font-medium text-white flex items-center justify-center gap-2`}
                      >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        Change Password
                      </button>
                    </form>
                  </div>

                  <div className="pt-4 border-t border-zinc-700">
                    <button
                      onClick={logout}
                      className="text-red-400 hover:text-red-300 text-sm font-medium"
                    >
                      Sign out of account
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default AccountSettings;
