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
    } : {
      bg: 'bg-gradient-to-br from-stone-100 via-slate-50 to-zinc-100',
      card: 'bg-white/90 backdrop-blur-xl border-stone-200/80',
      cardHover: 'hover:border-stone-300',
      text: 'text-stone-800',
      textMuted: 'text-stone-500',
      textSubtle: 'text-stone-400',
      input: 'bg-stone-50 border-stone-200 text-stone-800 placeholder-stone-400',
      inputFocus: 'focus:ring-rose-500/50 focus:border-rose-500',
      accent: 'text-rose-600',
      accentBg: 'bg-rose-600',
      button: 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500',
      buttonSecondary: 'bg-stone-100 hover:bg-stone-200 border-stone-300 text-stone-700',
      border: 'border border-stone-200/80',
      muted: 'text-stone-500',
    }
  };

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
};
