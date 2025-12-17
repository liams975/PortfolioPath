/**
 * Premium/Subscription Context
 * 
 * Manages user premium status and provides Pro feature gating
 * Now uses server-side simulation tracking for accurate limits
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getPaymentStatus, verifyPaymentSession, getSimulationUsage } from '../services/api';
import { useAuth } from './AuthContext';
import { toast } from '../utils/toast';

const PremiumContext = createContext(null);

// Pro tier feature list
export const PRO_FEATURES = {
  UNLIMITED_SIMULATIONS: 'unlimited_simulations',
  ADVANCED_MODELS: 'advanced_models',
  COMPARISON_MODE: 'comparison_mode',
  EXPORT_PDF: 'export_pdf',
  EXPORT_CSV: 'export_csv',
  EFFICIENT_FRONTIER: 'efficient_frontier',
  STRESS_TESTING: 'stress_testing',
  CORRELATION_MATRIX: 'correlation_matrix',
  SAVED_PORTFOLIOS: 'saved_portfolios',
  PRIORITY_SUPPORT: 'priority_support',
};

// Features available in free tier
const FREE_FEATURES = [
  PRO_FEATURES.SAVED_PORTFOLIOS, // Limited to 3
];

// Daily simulation limits for free tier (matches backend)
const FREE_SIMULATION_LIMIT = 10;
const FREE_PORTFOLIO_LIMIT = 3;

export const PremiumProvider = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dailySimulations, setDailySimulations] = useState(0);
  const [paymentVerifying, setPaymentVerifying] = useState(false);

  // Check for payment callback in URL
  useEffect(() => {
    const checkPaymentCallback = async () => {
      const params = new URLSearchParams(window.location.search);
      const sessionId = params.get('session_id');
      const paymentStatus = params.get('payment');

      // Handle successful payment redirect
      if (sessionId) {
        setPaymentVerifying(true);
        try {
          const result = await verifyPaymentSession(sessionId);
          if (result.is_premium) {
            setIsPremium(true);
            toast.success('🎉 Welcome to Pro! Your payment was successful.');
          } else if (result.status === 'pending') {
            toast.warning('Payment is still processing. Please wait a moment.');
          }
        } catch (error) {
          toast.error('Could not verify payment. Please contact support.');
        } finally {
          setPaymentVerifying(false);
          // Clean URL
          window.history.replaceState({}, '', window.location.pathname);
        }
      }
      
      // Handle cancelled payment
      if (paymentStatus === 'cancel') {
        toast.warning('Payment was cancelled. You can try again anytime.');
        window.history.replaceState({}, '', window.location.pathname);
      }
    };

    if (isAuthenticated) {
      checkPaymentCallback();
    }
  }, [isAuthenticated]);

  // Fetch premium status when authenticated
  useEffect(() => {
    const fetchPremiumStatus = async () => {
      if (!isAuthenticated) {
        setIsPremium(false);
        setLoading(false);
        return;
      }

      try {
        const status = await getPaymentStatus();
        setIsPremium(status.is_premium || false);
      } catch (error) {
        console.error('Failed to fetch premium status:', error);
        setIsPremium(false);
      } finally {
        setLoading(false);
      }
    };

    fetchPremiumStatus();
  }, [isAuthenticated, user]);

  // Fetch simulation usage from server
  const refreshUsage = useCallback(async () => {
    if (!isAuthenticated) {
      setDailySimulations(0);
      return;
    }

    try {
      const usage = await getSimulationUsage();
      setDailySimulations(usage.daily_simulations || 0);
      if (usage.is_premium) {
        setIsPremium(true);
      }
    } catch (error) {
      console.error('Failed to fetch simulation usage:', error);
    }
  }, [isAuthenticated]);

  // Load simulation usage from server on auth change
  useEffect(() => {
    refreshUsage();
  }, [refreshUsage]);

  // Track simulation usage (called after successful simulation)
  // The actual tracking is now done server-side, this just refreshes the count
  const trackSimulation = useCallback(async () => {
    if (isPremium) return true; // No limit for premium
    
    // Refresh count from server after simulation
    await refreshUsage();
    return true;
  }, [isPremium, refreshUsage]);

  // Check if feature is available
  const hasFeature = useCallback((featureKey) => {
    if (isPremium) return true;
    return FREE_FEATURES.includes(featureKey);
  }, [isPremium]);

  // Check simulation limit (server is the source of truth)
  const canRunSimulation = useCallback(() => {
    if (isPremium) return { allowed: true, remaining: Infinity };
    const remaining = Math.max(0, FREE_SIMULATION_LIMIT - dailySimulations);
    return { 
      allowed: remaining > 0, 
      remaining,
      limit: FREE_SIMULATION_LIMIT
    };
  }, [isPremium, dailySimulations]);

  // Check portfolio save limit
  const canSavePortfolio = useCallback((currentCount) => {
    if (isPremium) return { allowed: true, remaining: Infinity };
    return {
      allowed: currentCount < FREE_PORTFOLIO_LIMIT,
      remaining: Math.max(0, FREE_PORTFOLIO_LIMIT - currentCount),
      limit: FREE_PORTFOLIO_LIMIT
    };
  }, [isPremium]);

  const value = {
    isPremium,
    loading,
    paymentVerifying,
    hasFeature,
    canRunSimulation,
    canSavePortfolio,
    trackSimulation,
    refreshUsage,
    dailySimulations,
    FREE_SIMULATION_LIMIT,
    FREE_PORTFOLIO_LIMIT,
  };

  return (
    <PremiumContext.Provider value={value}>
      {children}
    </PremiumContext.Provider>
  );
};

export const usePremium = () => {
  const context = useContext(PremiumContext);
  if (!context) {
    throw new Error('usePremium must be used within a PremiumProvider');
  }
  return context;
};

/**
 * Pro Feature Gate Component
 * Wraps features that require Pro tier
 */
export const ProFeatureGate = ({ 
  feature, 
  children, 
  fallback = null,
  showUpgradePrompt = true 
}) => {
  const { hasFeature, isPremium } = usePremium();
  
  if (hasFeature(feature)) {
    return children;
  }
  
  if (fallback) {
    return fallback;
  }
  
  if (showUpgradePrompt) {
    return (
      <div className="relative group">
        <div className="opacity-50 pointer-events-none filter blur-[1px]">
          {children}
        </div>
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg">
          <div className="text-center p-4">
            <span className="inline-block px-2 py-1 bg-gradient-to-r from-rose-500 to-red-500 text-white text-xs font-semibold rounded-full mb-2">
              PRO
            </span>
            <p className="text-white text-sm font-medium">Upgrade to unlock this feature</p>
          </div>
        </div>
      </div>
    );
  }
  
  return null;
};

export default PremiumContext;
