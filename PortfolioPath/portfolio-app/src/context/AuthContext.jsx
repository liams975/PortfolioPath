import React, { createContext, useContext, useState, useEffect } from 'react';

/**
 * AuthContext - Authentication & User Management
 * 
 * This is a CLIENT-SIDE ONLY implementation for demonstration.
 * For production, you MUST implement:
 * 1. Backend API (Node.js/Express, Python/Flask, etc.)
 * 2. Secure password hashing (bcrypt, argon2)
 * 3. JWT tokens or session-based auth
 * 4. Database (PostgreSQL, MongoDB, etc.)
 * 5. HTTPS encryption
 * 6. Rate limiting & CAPTCHA
 * 
 * Current implementation uses localStorage - NOT secure for production!
 */

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    const storedUser = localStorage.getItem('portfoliopath_user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        localStorage.removeItem('portfoliopath_user');
      }
    }
    setLoading(false);
  }, []);

  /**
   * Register a new user
   * TODO: Replace with API call to backend
   */
  const register = async (email, password, name) => {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));

      // Check if user already exists (localStorage demo only)
      const existingUsers = JSON.parse(localStorage.getItem('portfoliopath_users') || '[]');
      if (existingUsers.some(u => u.email === email)) {
        throw new Error('Email already registered');
      }

      const newUser = {
        id: Date.now().toString(),
        email,
        name,
        createdAt: new Date().toISOString(),
        portfolios: []
      };

      // Store user (INSECURE - for demo only)
      existingUsers.push({ ...newUser, password }); // Never store plain passwords!
      localStorage.setItem('portfoliopath_users', JSON.stringify(existingUsers));
      
      // Set current user (without password)
      const { password: _, ...userWithoutPassword } = newUser;
      setUser(userWithoutPassword);
      localStorage.setItem('portfoliopath_user', JSON.stringify(userWithoutPassword));

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Login existing user
   * TODO: Replace with API call to backend
   */
  const login = async (email, password) => {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));

      const existingUsers = JSON.parse(localStorage.getItem('portfoliopath_users') || '[]');
      const foundUser = existingUsers.find(u => u.email === email && u.password === password);

      if (!foundUser) {
        throw new Error('Invalid email or password');
      }

      const { password: _, ...userWithoutPassword } = foundUser;
      setUser(userWithoutPassword);
      localStorage.setItem('portfoliopath_user', JSON.stringify(userWithoutPassword));

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Logout current user
   */
  const logout = () => {
    setUser(null);
    localStorage.removeItem('portfoliopath_user');
  };

  /**
   * Save a portfolio for the current user
   */
  const savePortfolio = (portfolioData) => {
    if (!user) return { success: false, error: 'Not authenticated' };

    try {
      const portfolio = {
        id: Date.now().toString(),
        name: portfolioData.name || `Portfolio ${new Date().toLocaleDateString()}`,
        data: portfolioData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Update user's portfolios
      const existingUsers = JSON.parse(localStorage.getItem('portfoliopath_users') || '[]');
      const userIndex = existingUsers.findIndex(u => u.id === user.id);
      
      if (userIndex !== -1) {
        if (!existingUsers[userIndex].portfolios) {
          existingUsers[userIndex].portfolios = [];
        }
        existingUsers[userIndex].portfolios.push(portfolio);
        localStorage.setItem('portfoliopath_users', JSON.stringify(existingUsers));

        // Update current user state
        const updatedUser = { ...user, portfolios: [...(user.portfolios || []), portfolio] };
        setUser(updatedUser);
        localStorage.setItem('portfoliopath_user', JSON.stringify(updatedUser));

        return { success: true, portfolio };
      }

      throw new Error('User not found');
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Load saved portfolios for current user
   */
  const getPortfolios = () => {
    return user?.portfolios || [];
  };

  /**
   * Delete a portfolio
   */
  const deletePortfolio = (portfolioId) => {
    if (!user) return { success: false, error: 'Not authenticated' };

    try {
      const existingUsers = JSON.parse(localStorage.getItem('portfoliopath_users') || '[]');
      const userIndex = existingUsers.findIndex(u => u.id === user.id);
      
      if (userIndex !== -1) {
        existingUsers[userIndex].portfolios = existingUsers[userIndex].portfolios.filter(
          p => p.id !== portfolioId
        );
        localStorage.setItem('portfoliopath_users', JSON.stringify(existingUsers));

        const updatedUser = { 
          ...user, 
          portfolios: existingUsers[userIndex].portfolios 
        };
        setUser(updatedUser);
        localStorage.setItem('portfoliopath_user', JSON.stringify(updatedUser));

        return { success: true };
      }

      throw new Error('User not found');
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const value = {
    user,
    loading,
    register,
    login,
    logout,
    savePortfolio,
    getPortfolios,
    deletePortfolio,
    isAuthenticated: !!user
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
