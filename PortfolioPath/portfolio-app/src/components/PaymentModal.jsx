import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CreditCard, CheckCircle, Loader2, Shield, Star, Zap } from 'lucide-react';
import { getPaymentConfig, createCheckoutSession } from '../services/api';
import { toast } from '../utils/toast';

/**
 * Payment Modal Component
 * 
 * Displays premium upgrade options with Stripe integration
 */
const PaymentModal = ({ isOpen, onClose, isDark = true }) => {
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState(null);
  const [loadingConfig, setLoadingConfig] = useState(true);

  const colors = isDark ? {
    bg: 'bg-zinc-900',
    card: 'bg-zinc-800',
    border: 'border-zinc-700',
    text: 'text-zinc-100',
    textMuted: 'text-zinc-400',
    accent: 'bg-rose-500 hover:bg-rose-600',
  } : {
    bg: 'bg-white',
    card: 'bg-gray-50',
    border: 'border-gray-200',
    text: 'text-gray-900',
    textMuted: 'text-gray-500',
    accent: 'bg-rose-500 hover:bg-rose-600',
  };

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const result = await getPaymentConfig();
        setConfig(result);
      } catch (error) {
        console.error('Failed to load payment config:', error);
      } finally {
        setLoadingConfig(false);
      }
    };

    if (isOpen) {
      fetchConfig();
    }
  }, [isOpen]);

  const handlePurchase = async (priceId) => {
    setLoading(true);
    try {
      const { checkout_url } = await createCheckoutSession(priceId);
      // Redirect to Stripe checkout
      window.location.href = checkout_url;
    } catch (error) {
      toast.error(error.message || 'Failed to start checkout');
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className={`${colors.bg} ${colors.border} border rounded-2xl max-w-md w-full p-6 shadow-2xl`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-rose-500 to-rose-600 rounded-xl flex items-center justify-center">
                <Star className="w-5 h-5 text-white" />
              </div>
              <h2 className={`text-xl font-bold ${colors.text}`}>Upgrade to Pro</h2>
            </div>
            <button
              onClick={onClose}
              className={`p-2 rounded-lg ${colors.textMuted} hover:${colors.text} transition-colors`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {loadingConfig ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
            </div>
          ) : !config?.available ? (
            <div className={`text-center py-8 ${colors.textMuted}`}>
              <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Payment system is currently being configured.</p>
              <p className="text-sm mt-2">Please check back later.</p>
            </div>
          ) : (
            <>
              {/* Product Info */}
              {config.products?.map((product) => (
                <div key={product.id} className={`${colors.card} rounded-xl p-5 mb-6`}>
                  <div className="flex items-baseline justify-between mb-4">
                    <div>
                      <h3 className={`text-lg font-semibold ${colors.text}`}>{product.name}</h3>
                      <p className={`text-sm ${colors.textMuted}`}>{product.description}</p>
                    </div>
                    <div className="text-right">
                      <span className={`text-3xl font-bold ${colors.text}`}>${product.price}</span>
                      <span className={`text-sm ${colors.textMuted}`}> once</span>
                    </div>
                  </div>

                  {/* Features List */}
                  <ul className="space-y-2 mb-6">
                    {product.features?.map((feature, idx) => (
                      <li key={idx} className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                        <span className={`text-sm ${colors.text}`}>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Purchase Button */}
                  <button
                    onClick={() => handlePurchase(product.price_id)}
                    disabled={loading || !product.price_id}
                    className={`w-full ${colors.accent} text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-5 h-5" />
                        Get Lifetime Access
                      </>
                    )}
                  </button>
                </div>
              ))}

              {/* Trust Badges */}
              <div className="flex items-center justify-center gap-4 pt-4 border-t border-zinc-700">
                <div className="flex items-center gap-1.5 text-zinc-500">
                  <Shield className="w-4 h-4" />
                  <span className="text-xs">Secure Payment</span>
                </div>
                <div className="flex items-center gap-1.5 text-zinc-500">
                  <Zap className="w-4 h-4" />
                  <span className="text-xs">Instant Access</span>
                </div>
              </div>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default PaymentModal;
