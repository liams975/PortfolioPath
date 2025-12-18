/**
 * Onboarding Tutorial Component
 * 
 * First-time user walkthrough that guides users through the app's features.
 * Simple modal-based tutorial without complex animations.
 */

import { useState, useEffect, useCallback } from 'react';
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

// Tutorial steps configuration - simplified without highlights
const TUTORIAL_STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to PortfolioPath Pro! 🎉',
    description: 'Let\'s take a quick tour of the app to help you get started with Monte Carlo portfolio simulations.',
    icon: Sparkles,
  },
  {
    id: 'portfolio',
    title: 'Build Your Portfolio',
    description: 'Start by adding ticker symbols (like AAPL, GOOGL, SPY) and their weights. We fetch real market data from Yahoo Finance to power your simulations.',
    icon: PieChart,
  },
  {
    id: 'presets',
    title: 'Quick Start Templates',
    description: 'Not sure where to start? Use the preset portfolios like "Classic 60/40" or "Aggressive Growth" to get started quickly.',
    icon: Target,
  },
  {
    id: 'parameters',
    title: 'Configure Simulation',
    description: 'Set your initial investment amount, time horizon (in years), and number of simulations. More simulations = more accurate results.',
    icon: Settings,
  },
  {
    id: 'advanced',
    title: 'Advanced Models',
    description: 'Enable sophisticated features like GARCH volatility, regime switching, and jump diffusion for more realistic market scenarios.',
    icon: BarChart3,
  },
  {
    id: 'compare',
    title: 'Compare Portfolios',
    description: 'Use the Compare button to analyze two portfolios side-by-side. Great for testing different investment strategies!',
    icon: GitCompare,
  },
  {
    id: 'results',
    title: 'Analyze Results',
    description: 'After running a simulation, explore fan charts showing potential outcomes, risk metrics, and probability of reaching your goals.',
    icon: TrendingUp,
  },
  {
    id: 'export',
    title: 'Export & Save',
    description: 'Save your portfolios to your account for later. You can also export results to PDF or CSV for sharing.',
    icon: Download,
  },
  {
    id: 'complete',
    title: 'You\'re All Set! 🚀',
    description: 'Start building your first portfolio and click "Run Simulation" to see the magic happen!',
    icon: CheckCircle,
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
  return !completedUsers.includes(String(userId));
};

/**
 * Mark tutorial as completed for a specific user
 */
export const markTutorialComplete = (userId) => {
  if (!userId) return;
  const completedUsers = JSON.parse(localStorage.getItem(TUTORIAL_COMPLETED_KEY) || '[]');
  const userIdStr = String(userId);
  if (!completedUsers.includes(userIdStr)) {
    completedUsers.push(userIdStr);
    localStorage.setItem(TUTORIAL_COMPLETED_KEY, JSON.stringify(completedUsers));
  }
};

/**
 * Reset tutorial for a specific user (for "restart tour" feature)
 */
export const resetTutorial = (userId) => {
  if (!userId) return;
  const completedUsers = JSON.parse(localStorage.getItem(TUTORIAL_COMPLETED_KEY) || '[]');
  const filtered = completedUsers.filter(id => id !== String(userId));
  localStorage.setItem(TUTORIAL_COMPLETED_KEY, JSON.stringify(filtered));
};

/**
 * Main Onboarding Tutorial Component - Simple Modal Version
 */
const OnboardingTutorial = ({ isOpen, onClose, isDark = true, userId }) => {
  const [currentStep, setCurrentStep] = useState(0);

  // Reset step when tutorial opens
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
    }
  }, [isOpen]);

  const colors = isDark ? {
    card: 'bg-zinc-800',
    border: 'border-zinc-700',
    text: 'text-zinc-100',
    textMuted: 'text-zinc-400',
  } : {
    card: 'bg-white',
    border: 'border-gray-200',
    text: 'text-gray-900',
    textMuted: 'text-gray-500',
  };

  const step = TUTORIAL_STEPS[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === TUTORIAL_STEPS.length - 1;
  const Icon = step.icon;

  const handleNext = useCallback(() => {
    if (isLastStep) {
      markTutorialComplete(userId);
      onClose();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  }, [isLastStep, userId, onClose]);

  const handlePrev = useCallback(() => {
    if (!isFirstStep) {
      setCurrentStep(prev => prev - 1);
    }
  }, [isFirstStep]);

  const handleSkip = useCallback(() => {
    markTutorialComplete(userId);
    onClose();
  }, [userId, onClose]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'Escape') {
        handleSkip();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleNext, handlePrev, handleSkip]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/85"
        onClick={handleSkip}
      />
      
      {/* Modal Card */}
      <div 
        className={`relative ${colors.card} ${colors.border} border rounded-2xl p-8 shadow-2xl max-w-lg mx-4 w-full`}
        style={{ maxHeight: '90vh', overflow: 'auto' }}
      >
        {/* Skip button */}
        <button
          onClick={handleSkip}
          className={`absolute top-4 right-4 text-xs ${colors.textMuted} hover:text-rose-400 transition-colors`}
        >
          Skip tour
        </button>

        {/* Step Counter */}
        <div className={`text-xs ${colors.textMuted} text-center mb-4`}>
          Step {currentStep + 1} of {TUTORIAL_STEPS.length}
        </div>

        {/* Icon */}
        <div className="flex items-center justify-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center shadow-lg shadow-rose-500/30">
            <Icon className="w-8 h-8 text-white" />
          </div>
        </div>

        {/* Content */}
        <div className="text-center mb-8">
          <h3 className={`text-2xl font-bold ${colors.text} mb-3`}>
            {step.title}
          </h3>
          <p className={`${colors.textMuted} leading-relaxed`}>
            {step.description}
          </p>
        </div>

        {/* Progress Dots */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {TUTORIAL_STEPS.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentStep(idx)}
              className={`h-2 rounded-full transition-all duration-300 cursor-pointer hover:opacity-80 ${
                idx === currentStep 
                  ? 'bg-rose-500 w-8' 
                  : idx < currentStep 
                    ? 'bg-rose-500/50 w-2' 
                    : isDark ? 'bg-zinc-600 w-2' : 'bg-gray-300 w-2'
              }`}
            />
          ))}
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-center gap-4">
          {!isFirstStep && (
            <button
              onClick={handlePrev}
              className={`px-5 py-2.5 ${colors.card} ${colors.border} border rounded-xl flex items-center gap-2 ${colors.text} hover:bg-zinc-700/50 transition-colors`}
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
          )}
          
          <button
            onClick={handleNext}
            className="px-8 py-2.5 bg-gradient-to-r from-rose-500 to-red-600 rounded-xl flex items-center gap-2 text-white font-semibold hover:from-rose-600 hover:to-red-700 transition-all shadow-lg shadow-rose-500/30"
          >
            {isLastStep ? 'Get Started!' : 'Next'}
            {!isLastStep && <ChevronRight className="w-4 h-4" />}
          </button>
        </div>

        {/* Keyboard hint */}
        <p className={`text-xs ${colors.textMuted} text-center mt-6`}>
          Use ← → arrow keys to navigate • Esc to skip
        </p>
      </div>
    </div>
  );
};

/**
 * Hook to manage tutorial state
 */
export const useTutorial = (userId) => {
  const [showTutorial, setShowTutorial] = useState(false);

  useEffect(() => {
    if (!userId) return;
    
    // Show tutorial for any user who hasn't completed it
    if (shouldShowTutorial(userId)) {
      // Delay to let the main UI render first
      const timer = setTimeout(() => {
        setShowTutorial(true);
      }, 1000);
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
