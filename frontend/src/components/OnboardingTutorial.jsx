/**
 * Onboarding Tutorial Component
 * 
 * First-time user walkthrough that guides users through the app's features.
 * Uses step-by-step tooltips with highlights on relevant UI elements.
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronRight, 
  ChevronLeft, 
  Sparkles, 
  PieChart, 
  TrendingUp, 
  Target, 
  Settings,
  BarChart3,
  GitCompare,
  Download,
  CheckCircle
} from 'lucide-react';

// Tutorial steps configuration
const TUTORIAL_STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to PortfolioPath Pro! 🎉',
    description: 'Let\'s take a quick tour of the app to help you get started with Monte Carlo portfolio simulations.',
    icon: Sparkles,
    position: 'center',
    highlight: null,
  },
  {
    id: 'portfolio',
    title: 'Build Your Portfolio',
    description: 'Start by adding ticker symbols and their weights. We fetch real market data from Yahoo Finance to power your simulations.',
    icon: PieChart,
    position: 'right',
    highlight: '[data-tour="portfolio"]',
  },
  {
    id: 'presets',
    title: 'Quick Start Templates',
    description: 'Not sure where to start? Choose from pre-built portfolios like "Classic 60/40" or "Aggressive Growth".',
    icon: Target,
    position: 'bottom',
    highlight: '[data-tour="presets"]',
  },
  {
    id: 'parameters',
    title: 'Configure Simulation',
    description: 'Set your initial investment, time horizon, and number of simulations. More simulations = more accurate results.',
    icon: Settings,
    position: 'left',
    highlight: '[data-tour="parameters"]',
  },
  {
    id: 'advanced',
    title: 'Advanced Models',
    description: 'Enable sophisticated features like GARCH volatility, regime switching, and jump diffusion for more realistic scenarios.',
    icon: BarChart3,
    position: 'left',
    highlight: '[data-tour="advanced"]',
  },
  {
    id: 'compare',
    title: 'Compare Portfolios',
    description: 'Toggle comparison mode to analyze two portfolios side-by-side. Great for testing different strategies!',
    icon: GitCompare,
    position: 'bottom',
    highlight: '[data-tour="compare"]',
  },
  {
    id: 'results',
    title: 'Analyze Results',
    description: 'After running a simulation, explore fan charts, risk metrics, goal probabilities, and more in the results view.',
    icon: TrendingUp,
    position: 'center',
    highlight: null,
  },
  {
    id: 'export',
    title: 'Export & Save',
    description: 'Save your portfolios to your account and export results to PDF or CSV for sharing.',
    icon: Download,
    position: 'center',
    highlight: null,
  },
  {
    id: 'complete',
    title: 'You\'re All Set! 🚀',
    description: 'Start building your first portfolio and run a simulation. You can always restart this tour from settings.',
    icon: CheckCircle,
    position: 'center',
    highlight: null,
  },
];

// LocalStorage key for tracking tutorial completion
const TUTORIAL_COMPLETED_KEY = 'portfoliopath_tutorial_completed';

/**
 * Check if user has completed the tutorial
 */
export const shouldShowTutorial = (userId) => {
  if (!userId) return false;
  const completedUsers = JSON.parse(localStorage.getItem(TUTORIAL_COMPLETED_KEY) || '[]');
  return !completedUsers.includes(userId);
};

/**
 * Mark tutorial as completed for a specific user
 */
export const markTutorialComplete = (userId) => {
  if (!userId) return;
  const completedUsers = JSON.parse(localStorage.getItem(TUTORIAL_COMPLETED_KEY) || '[]');
  if (!completedUsers.includes(userId)) {
    completedUsers.push(userId);
    localStorage.setItem(TUTORIAL_COMPLETED_KEY, JSON.stringify(completedUsers));
  }
};

/**
 * Reset tutorial for a specific user (for "restart tour" feature)
 */
export const resetTutorial = (userId) => {
  if (!userId) return;
  const completedUsers = JSON.parse(localStorage.getItem(TUTORIAL_COMPLETED_KEY) || '[]');
  const filtered = completedUsers.filter(id => id !== userId);
  localStorage.setItem(TUTORIAL_COMPLETED_KEY, JSON.stringify(filtered));
};

/**
 * Main Onboarding Tutorial Component
 */
const OnboardingTutorial = ({ isOpen, onClose, isDark = true, userId }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [highlightedElement, setHighlightedElement] = useState(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const colors = isDark ? {
    bg: 'bg-zinc-900',
    card: 'bg-zinc-800',
    border: 'border-zinc-700',
    text: 'text-zinc-100',
    textMuted: 'text-zinc-400',
    accent: 'from-rose-500 to-red-500',
  } : {
    bg: 'bg-white',
    card: 'bg-gray-50',
    border: 'border-gray-200',
    text: 'text-gray-900',
    textMuted: 'text-gray-500',
    accent: 'from-rose-500 to-red-500',
  };

  const step = TUTORIAL_STEPS[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === TUTORIAL_STEPS.length - 1;

  // Update highlighted element when step changes
  useEffect(() => {
    if (step.highlight) {
      const element = document.querySelector(step.highlight);
      if (element) {
        setHighlightedElement(element);
        // Scroll element into view
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        setHighlightedElement(null);
      }
    } else {
      setHighlightedElement(null);
    }
  }, [currentStep, step.highlight]);

  const handleNext = useCallback(() => {
    if (isTransitioning) return;
    if (isLastStep) {
      markTutorialComplete(userId);
      onClose();
    } else {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentStep(prev => prev + 1);
        setIsTransitioning(false);
      }, 100);
    }
  }, [isLastStep, onClose, userId, isTransitioning]);

  const handlePrev = useCallback(() => {
    if (isTransitioning) return;
    if (!isFirstStep) {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentStep(prev => prev - 1);
        setIsTransitioning(false);
      }, 100);
    }
  }, [isFirstStep, isTransitioning]);

  // Remove skip handler - users must complete the tutorial
  const _handleComplete = useCallback(() => {
    markTutorialComplete(userId);
    onClose();
  }, [onClose, userId]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'ArrowRight' || e.key === 'Enter') {
      handleNext();
    } else if (e.key === 'ArrowLeft') {
      handlePrev();
    }
    // Remove Escape key handling - can't skip tutorial
  }, [handleNext, handlePrev]);

  useEffect(() => {
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const Icon = step.icon;

  // Calculate tooltip position based on highlighted element
  const getTooltipPosition = () => {
    if (!highlightedElement || step.position === 'center') {
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      };
    }

    const rect = highlightedElement.getBoundingClientRect();
    const positions = {
      top: {
        position: 'fixed',
        top: `${rect.top - 16}px`,
        left: `${rect.left + rect.width / 2}px`,
        transform: 'translate(-50%, -100%)',
      },
      bottom: {
        position: 'fixed',
        top: `${rect.bottom + 16}px`,
        left: `${rect.left + rect.width / 2}px`,
        transform: 'translateX(-50%)',
      },
      left: {
        position: 'fixed',
        top: `${rect.top + rect.height / 2}px`,
        left: `${rect.left - 16}px`,
        transform: 'translate(-100%, -50%)',
      },
      right: {
        position: 'fixed',
        top: `${rect.top + rect.height / 2}px`,
        left: `${rect.right + 16}px`,
        transform: 'translateY(-50%)',
      },
    };

    return positions[step.position] || positions.bottom;
  };

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100]"
      >
        {/* Dark overlay - not clickable */}
        <div className="absolute inset-0 bg-black/80" />

        {/* Highlight ring around target element */}
        {highlightedElement && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute pointer-events-none"
            style={{
              top: highlightedElement.getBoundingClientRect().top - 8,
              left: highlightedElement.getBoundingClientRect().left - 8,
              width: highlightedElement.getBoundingClientRect().width + 16,
              height: highlightedElement.getBoundingClientRect().height + 16,
              borderRadius: '12px',
              boxShadow: '0 0 0 4px rgba(244, 63, 94, 0.5), 0 0 0 9999px rgba(0, 0, 0, 0.8)',
            }}
          />
        )}

        {/* Tooltip Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          style={getTooltipPosition()}
          className={`${colors.card} ${colors.border} border rounded-2xl p-6 shadow-2xl max-w-md z-[101]`}
        >
          {/* Icon */}
          <div className="flex items-center justify-center mb-4">
            <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${colors.accent} flex items-center justify-center`}>
              <Icon className="w-7 h-7 text-white" />
            </div>
          </div>

          {/* Content */}
          <div className="text-center mb-6">
            <h3 className={`text-xl font-bold ${colors.text} mb-2`}>
              {step.title}
            </h3>
            <p className={`${colors.textMuted} text-sm leading-relaxed`}>
              {step.description}
            </p>
          </div>

          {/* Progress Dots - not clickable */}
          <div className="flex items-center justify-center gap-1.5 mb-6">
            {TUTORIAL_STEPS.map((_, idx) => (
              <div
                key={idx}
                className={`w-2 h-2 rounded-full transition-all ${
                  idx === currentStep 
                    ? 'bg-rose-500 w-6' 
                    : idx < currentStep 
                      ? 'bg-rose-500/50' 
                      : isDark ? 'bg-zinc-600' : 'bg-gray-300'
                }`}
              />
            ))}
          </div>

          {/* Navigation Buttons - no skip option */}
          <div className="flex items-center justify-center gap-3">
              {!isFirstStep && (
                <button
                  onClick={handlePrev}
                  className={`px-4 py-2 ${colors.card} ${colors.border} border rounded-lg flex items-center gap-1 text-sm ${colors.text} hover:bg-zinc-700 transition-colors`}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back
                </button>
              )}
              
              <button
                onClick={handleNext}
                disabled={isTransitioning}
                className={`px-6 py-2 bg-gradient-to-r ${colors.accent} rounded-lg flex items-center gap-1 text-sm text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50`}
              >
                {isLastStep ? 'Get Started' : 'Next'}
                {!isLastStep && <ChevronRight className="w-4 h-4" />}
              </button>
          </div>

          {/* Keyboard hints */}
          <p className={`text-xs ${colors.textMuted} text-center mt-4`}>
            Use ← → arrows to navigate
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

/**
 * Hook to manage tutorial state
 * Shows tutorial for any user who hasn't completed it yet
 */
export const useTutorial = (userId) => {
  const [showTutorial, setShowTutorial] = useState(false);

  useEffect(() => {
    if (!userId) return;
    
    // Check if this user has completed the tutorial
    // Show tutorial for ANY user who hasn't completed it
    if (shouldShowTutorial(userId)) {
      const timer = setTimeout(() => {
        setShowTutorial(true);
      }, 800); // Small delay to let the UI settle
      return () => clearTimeout(timer);
    }
  }, [userId]);

  const startTutorial = useCallback(() => {
    if (userId) {
      resetTutorial(userId);
      setShowTutorial(true);
    }
  }, [userId]);

  const closeTutorial = useCallback(() => {
    setShowTutorial(false);
  }, []);

  return {
    showTutorial,
    startTutorial,
    closeTutorial,
  };
};

export default OnboardingTutorial;
