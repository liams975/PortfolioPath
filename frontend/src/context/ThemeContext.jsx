import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('portfoliopath-theme');
    return saved ? saved === 'dark' : true;
  });

  useEffect(() => {
    localStorage.setItem('portfoliopath-theme', isDark ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  const toggleTheme = () => setIsDark(!isDark);

  const theme = {
    isDark,
    toggleTheme,
    colors: isDark ? {
      bg: 'bg-gradient-to-br from-zinc-950 via-neutral-950 to-stone-950',
      card: 'bg-zinc-900/50 backdrop-blur-xl',
      cardSolid: 'bg-zinc-900',
      cardHover: 'hover:border-zinc-700/50',
      text: 'text-zinc-100',
      textMuted: 'text-zinc-400',
      textSubtle: 'text-zinc-500',
      input: 'bg-zinc-800/50 border-zinc-700/50 text-zinc-100 placeholder-zinc-600',
      inputFocus: 'focus:ring-rose-500/50 focus:border-rose-500/50',
      accent: 'text-rose-400',
      accentBg: 'bg-rose-600',
      button: 'bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-500 hover:to-red-600',
      buttonSecondary: 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700/50',
      border: 'border border-zinc-800/50',
      muted: 'text-zinc-400',
      // Chart colors for dark mode
      chartGrid: '#3f3f46',
      chartText: '#a1a1aa',
      successBg: 'bg-emerald-900/30 border-emerald-700/50',
      successText: 'text-emerald-400',
      warningBg: 'bg-amber-900/30 border-amber-700/50',
      warningText: 'text-amber-400',
      errorBg: 'bg-red-900/30 border-red-700/50',
      errorText: 'text-red-400',
    } : {
      bg: 'bg-gradient-to-br from-slate-50 via-gray-50 to-stone-100',
      card: 'bg-white shadow-sm border-gray-200',
      cardSolid: 'bg-white',
      cardHover: 'hover:border-gray-300 hover:shadow-md',
      text: 'text-gray-900',
      textMuted: 'text-gray-600',
      textSubtle: 'text-gray-500',
      input: 'bg-white border-gray-300 text-gray-900 placeholder-gray-400',
      inputFocus: 'focus:ring-rose-500/50 focus:border-rose-500 focus:ring-2',
      accent: 'text-rose-600',
      accentBg: 'bg-rose-600',
      button: 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 shadow-lg shadow-rose-600/20',
      buttonSecondary: 'bg-gray-100 hover:bg-gray-200 border-gray-300 text-gray-700',
      border: 'border border-gray-200',
      muted: 'text-gray-500',
      // Chart colors for light mode
      chartGrid: '#e5e7eb',
      chartText: '#6b7280',
      successBg: 'bg-emerald-50 border-emerald-200',
      successText: 'text-emerald-700',
      warningBg: 'bg-amber-50 border-amber-200',
      warningText: 'text-amber-700',
      errorBg: 'bg-red-50 border-red-200',
      errorText: 'text-red-700',
    }
  };

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
};
