/**
 * Enhanced Error Handling Utilities
 * Provides user-friendly error messages with context
 */

import { toast } from './toast';

/**
 * Get a user-friendly error message from an error object
 */
export const getErrorMessage = (error, context = '') => {
  // Handle AbortError (timeout)
  if (error?.name === 'AbortError' || error?.message?.includes('timeout')) {
    return 'Request timed out. The server may be slow. Please try again.';
  }
  
  // Handle network errors
  if (error?.message?.includes('NetworkError') || error?.message?.includes('Failed to fetch')) {
    return 'Network error. Please check your internet connection and try again.';
  }
  
  // Handle 404 errors
  if (error?.message?.includes('404') || error?.message?.includes('not found')) {
    if (context) {
      return `"${context}" was not found. Please check the symbol and try again.`;
    }
    return 'The requested resource was not found. Please try again.';
  }
  
  // Handle 429 errors (rate limiting)
  if (error?.message?.includes('429') || error?.message?.includes('rate limit')) {
    return 'Too many requests. Please wait a moment before trying again.';
  }
  
  // Handle 401 errors (unauthorized)
  if (error?.message?.includes('401') || error?.message?.includes('unauthorized')) {
    return 'Your session has expired. Please log in again.';
  }
  
  // Handle 403 errors (forbidden)
  if (error?.message?.includes('403') || error?.message?.includes('forbidden')) {
    return 'You do not have permission to perform this action.';
  }
  
  // Handle 500 errors (server error)
  if (error?.message?.includes('500') || error?.message?.includes('server error')) {
    return 'Server error. Please try again later.';
  }
  
  // Handle validation errors
  if (error?.message?.includes('validation') || error?.message?.includes('invalid')) {
    return error.message || 'Invalid input. Please check your data and try again.';
  }
  
  // Return the error message if it exists, otherwise generic message
  return error?.message || 'An unexpected error occurred. Please try again.';
};

/**
 * Handle an error and show appropriate user feedback
 */
export const handleError = (error, context = '', showToast = true) => {
  const message = getErrorMessage(error, context);
  
  if (showToast) {
    toast.error(message);
  }
  
  // Log to console for debugging
  console.error('Error:', error);
  console.error('Context:', context);
  console.error('User message:', message);
  
  return message;
};

/**
 * Retry a function with exponential backoff
 */
export const retryWithBackoff = async (
  fn,
  maxRetries = 3,
  initialDelay = 1000,
  onRetry = null
) => {
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Don't retry on certain errors
      if (error?.message?.includes('404') || error?.message?.includes('401') || error?.message?.includes('403')) {
        throw error;
      }
      
      if (attempt < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, attempt);
        if (onRetry) {
          onRetry(attempt + 1, maxRetries, delay);
        }
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
};

export default {
  getErrorMessage,
  handleError,
  retryWithBackoff,
};

