/**
 * Onboarding Tutorial Component
 * 
 * First-time user walkthrough that guides users through the app's features.
 * Uses step-by-step tooltips with highlights on relevant UI elements.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
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
const TUTORIAL_DISMISSED_KEY = 'portfoliopath_tutorial_dismissed';

/**
 * Check if user has completed or dismissed the tutorial
 */
export const shouldShowTutorial = () => {
  const completed = localStorage.getItem(TUTORIAL_COMPLETED_KEY);
  const dismissed = localStorage.getItem(TUTORIAL_DISMISSED_KEY);
  return !completed && !dismissed;
};

/**
 * Mark tutorial as completed
 */
export const markTutorialComplete = () => {
  localStorage.setItem(TUTORIAL_COMPLETED_KEY, 'true');
};

/**
 * Reset tutorial (for "restart tour" feature)
 */
export const resetTutorial = () => {
  localStorage.removeItem(TUTORIAL_COMPLETED_KEY);
  localStorage.removeItem(TUTORIAL_DISMISSED_KEY);
};

/**
 * Main Onboarding Tutorial Component
 */
const OnboardingTutorial = ({ isOpen, onClose, isDark = true }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [highlightedElement, setHighlightedElement] = useState(null);

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
    if (isLastStep) {
      markTutorialComplete();
      onClose();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  }, [isLastStep, onClose]);

  const handlePrev = useCallback(() => {
    if (!isFirstStep) {
      setCurrentStep(prev => prev - 1);
    }
  }, [isFirstStep]);

  const handleSkip = useCallback(() => {
    localStorage.setItem(TUTORIAL_DISMISSED_KEY, 'true');
    onClose();
  }, [onClose]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      handleSkip();
    } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
      handleNext();
    } else if (e.key === 'ArrowLeft') {
      handlePrev();
    }
  }, [handleSkip, handleNext, handlePrev]);

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
        {/* Dark overlay with spotlight effect */}
        <div 
          className="absolute inset-0 bg-black/80"
          onClick={handleSkip}
        />

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

          {/* Progress Dots */}
          <div className="flex items-center justify-center gap-1.5 mb-6">
            {TUTORIAL_STEPS.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentStep(idx)}
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

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={handleSkip}
              className={`px-4 py-2 text-sm ${colors.textMuted} hover:${colors.text} transition-colors`}
            >
              Skip Tour
            </button>
            
            <div className="flex items-center gap-2">
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
                className={`px-6 py-2 bg-gradient-to-r ${colors.accent} rounded-lg flex items-center gap-1 text-sm text-white font-medium hover:opacity-90 transition-opacity`}
              >
                {isLastStep ? 'Get Started' : 'Next'}
                {!isLastStep && <ChevronRight className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Keyboard hints */}
          <p className={`text-xs ${colors.textMuted} text-center mt-4`}>
            Use ← → arrows or Esc to navigate
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

/**
 * Hook to manage tutorial state
 */
export const useTutorial = () => {
  const [showTutorial, setShowTutorial] = useState(false);

  useEffect(() => {
    // Show tutorial for first-time users after a short delay
    const timer = setTimeout(() => {
      if (shouldShowTutorial()) {
        setShowTutorial(true);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  const startTutorial = useCallback(() => {
    resetTutorial();
    setShowTutorial(true);
  }, []);

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
