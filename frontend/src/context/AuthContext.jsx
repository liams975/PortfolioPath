import { createContext, useContext, useState, useEffect } from 'react';
import { 
  registerUser as apiRegister, 
  loginUser as apiLogin, 
  logoutUser as apiLogout,
  getCurrentUser as apiGetCurrentUser,
  getAuthToken,
  savePortfolio as apiSavePortfolio,
  loadPortfolios as apiLoadPortfolios,
  deletePortfolio as apiDeletePortfolio
} from '../services/api';

/**
 * AuthContext - Authentication & User Management
 * 
 * Connected to FastAPI backend with:
 * - JWT token authentication
 * - Secure password hashing (bcrypt)
 * - SQLite database persistence
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
    const checkAuth = async () => {
      const token = getAuthToken();
      if (token) {
        try {
          const userData = await apiGetCurrentUser();
          setUser(userData);
        } catch (_e) {
          // Token invalid or expired
          console.log('Session expired or invalid');
        }
      }
      setLoading(false);
    };
    checkAuth();
  }, []);

  /**
   * Register a new user
   */
  const register = async (email, password, name) => {
    try {
      // Register user with backend
      const _newUser = await apiRegister(email, password, name, name);
      
      // Auto-login after registration
      await apiLogin(email, password);
      const userData = await apiGetCurrentUser();
      setUser(userData);

      // Return success with isNewUser flag for tutorial trigger
      return { success: true, isNewUser: true, userId: userData.id };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Login existing user
   */
  const login = async (email, password) => {
    try {
      await apiLogin(email, password);
      const userData = await apiGetCurrentUser();
      setUser(userData);

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Logout current user
   */
  const logout = () => {
    apiLogout();
    setUser(null);
  };

  /**
   * Save a portfolio for the current user
   */
  const savePortfolio = async (portfolioData) => {
    if (!user) return { success: false, error: 'Not authenticated' };

    try {
      const portfolio = await apiSavePortfolio(portfolioData);
      return { success: true, portfolio };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Load saved portfolios for current user
   */
  const getPortfolios = async () => {
    if (!user) return [];
    try {
      const portfolios = await apiLoadPortfolios();
      return portfolios;
    } catch (error) {
      console.error('Error loading portfolios:', error);
      return [];
    }
  };

  /**
   * Delete a portfolio
   */
  const deletePortfolio = async (portfolioId) => {
    if (!user) return { success: false, error: 'Not authenticated' };

    try {
      await apiDeletePortfolio(portfolioId);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Refresh user data from the server
   */
  const refreshUser = async () => {
    const token = getAuthToken();
    if (token) {
      try {
        const userData = await apiGetCurrentUser();
        setUser(userData);
        return userData;
      } catch (_e) {
        console.log('Failed to refresh user data');
        return null;
      }
    }
    return null;
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
    refreshUser,
    isAuthenticated: !!user
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
