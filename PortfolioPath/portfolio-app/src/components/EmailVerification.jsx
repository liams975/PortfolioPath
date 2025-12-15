import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { verifyEmail, resendVerificationEmail } from '../services/api';

const EmailVerification = ({ 
  isOpen, 
  onClose, 
  darkMode, 
  user,
  onVerificationComplete,
  verificationToken // If provided, verify immediately
}) => {
  const [status, setStatus] = useState('idle'); // idle, verifying, success, error
  const [message, setMessage] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  // Handle verification token from URL
  useEffect(() => {
    if (verificationToken) {
      handleVerification(verificationToken);
    }
  }, [verificationToken]);

  // Cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleVerification = async (token) => {
    setStatus('verifying');
    setMessage('Verifying your email...');
    
    try {
      const result = await verifyEmail(token);
      setStatus('success');
      setMessage('Your email has been verified successfully!');
      if (onVerificationComplete) {
        setTimeout(() => onVerificationComplete(), 2000);
      }
    } catch (error) {
      setStatus('error');
      setMessage(error.message || 'Verification failed. The link may have expired.');
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    
    setStatus('verifying');
    setMessage('Sending verification email...');
    
    try {
      await resendVerificationEmail();
      setStatus('idle');
      setMessage('Verification email sent! Check your inbox.');
      setResendCooldown(60); // 60 second cooldown
    } catch (error) {
      setStatus('error');
      setMessage(error.message || 'Failed to send verification email.');
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className={`relative w-full max-w-md p-6 rounded-2xl shadow-xl ${
            darkMode ? 'bg-gray-800' : 'bg-white'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className={`absolute top-4 right-4 p-1 rounded-full transition-colors ${
              darkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Icon */}
          <div className="flex justify-center mb-4">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
              status === 'success' 
                ? 'bg-green-500/20 text-green-500'
                : status === 'error'
                ? 'bg-red-500/20 text-red-500'
                : 'bg-blue-500/20 text-blue-500'
            }`}>
              {status === 'success' ? (
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : status === 'error' ? (
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : status === 'verifying' ? (
                <svg className="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              )}
            </div>
          </div>

          {/* Title */}
          <h2 className={`text-xl font-bold text-center mb-2 ${
            darkMode ? 'text-white' : 'text-gray-900'
          }`}>
            {status === 'success' 
              ? 'Email Verified!' 
              : status === 'error'
              ? 'Verification Failed'
              : 'Verify Your Email'}
          </h2>

          {/* Message */}
          <p className={`text-center mb-6 ${
            darkMode ? 'text-gray-400' : 'text-gray-600'
          }`}>
            {message || (user 
              ? `We've sent a verification email to ${user.email}. Please check your inbox and click the link to verify your account.`
              : 'Please verify your email address to access all features.'
            )}
          </p>

          {/* Actions */}
          {status !== 'success' && status !== 'verifying' && (
            <div className="space-y-3">
              <button
                onClick={handleResend}
                disabled={resendCooldown > 0}
                className={`w-full py-3 px-4 rounded-lg font-medium transition-all ${
                  resendCooldown > 0
                    ? darkMode 
                      ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white'
                }`}
              >
                {resendCooldown > 0 
                  ? `Resend in ${resendCooldown}s`
                  : 'Resend Verification Email'
                }
              </button>
              
              <button
                onClick={onClose}
                className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                  darkMode 
                    ? 'bg-gray-700 hover:bg-gray-600 text-white'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                }`}
              >
                Close
              </button>
            </div>
          )}

          {status === 'success' && (
            <button
              onClick={onClose}
              className="w-full py-3 px-4 rounded-lg font-medium bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white transition-all"
            >
              Continue
            </button>
          )}

          {/* Tip for checking spam */}
          {status === 'idle' && (
            <p className={`text-xs text-center mt-4 ${
              darkMode ? 'text-gray-500' : 'text-gray-400'
            }`}>
              💡 Tip: Check your spam folder if you don't see the email in your inbox.
            </p>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default EmailVerification;
