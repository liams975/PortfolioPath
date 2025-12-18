import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, Lock, User, AlertCircle, Shield, CheckCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const AuthModal = ({ isOpen, onClose, mode: initialMode = 'login' }) => {
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  
  const { login, register } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let result;
      if (mode === 'login') {
        result = await login(email, password);
      } else {
        if (!name.trim()) {
          setError('Name is required');
          setLoading(false);
          return;
        }
        if (password.length < 8) {
          setError('Password must be at least 8 characters');
          setLoading(false);
          return;
        }
        result = await register(email, password, name);
        
        // Set a flag for new user registration (for tutorial)
        if (result.success && result.isNewUser) {
          sessionStorage.setItem('portfoliopath_just_registered', 'true');
        }
      }

      if (result.success) {
        setSuccess(true);
        // Delay close for success animation
        setTimeout(() => {
          onClose();
          setEmail('');
          setPassword('');
          setName('');
          setSuccess(false);
        }, 800);
      } else {
        setError(result.error);
      }
    } catch (_err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    setError('');
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
      // Reset state after animation completes
      setTimeout(() => {
        setEmail('');
        setPassword('');
        setName('');
        setError('');
        setSuccess(false);
      }, 300);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4"
          onClick={handleClose}
        >
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="bg-zinc-900 rounded-xl shadow-2xl border border-zinc-800 max-w-sm w-full p-6 relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Success overlay */}
            <AnimatePresence>
              {success && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-zinc-900/95 z-10 flex flex-col items-center justify-center"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", damping: 15, stiffness: 300 }}
                  >
                    <CheckCircle className="w-16 h-16 text-emerald-400 mb-4" />
                  </motion.div>
                  <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="text-emerald-400 font-medium text-lg"
                  >
                    {mode === 'login' ? 'Welcome back!' : 'Account created!'}
                  </motion.p>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              onClick={handleClose}
              disabled={loading}
              className="absolute top-3 right-3 p-2 hover:bg-zinc-800 rounded-lg transition-all disabled:opacity-50"
            >
              <X className="w-4 h-4 text-zinc-400 hover:text-zinc-200" />
            </button>

            <motion.div 
              className="text-center mb-6"
              key={mode}
              initial={{ opacity: 0, x: mode === 'login' ? -20 : 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}
            >
              <h2 className="text-xl font-bold text-rose-400 mb-1">
                {mode === 'login' ? 'Sign In' : 'Create Account'}
              </h2>
              <p className="text-zinc-500 text-xs">
                {mode === 'login' 
                  ? 'Access your saved portfolios' 
                  : 'Save and track portfolios'}
              </p>
            </motion.div>

            <div className="bg-emerald-900/30 border border-emerald-700/50 rounded-lg p-3 mb-4 flex gap-2">
              <Shield className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-zinc-400">
                <strong className="text-emerald-400">Secure:</strong> Backend authentication with encrypted passwords.
              </p>
            </div>

            <AnimatePresence mode="wait">
              {error && (
                <motion.div 
                  initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                  animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  transition={{ duration: 0.2 }}
                  className="bg-red-900/30 border border-red-900/50 rounded-lg p-3 flex gap-2 overflow-hidden"
                >
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <p className="text-xs text-red-300">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleSubmit} className="space-y-4">
              <AnimatePresence mode="wait">
                {mode === 'register' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <label className="block text-xs font-medium mb-1.5 text-zinc-400 uppercase tracking-wider">Username</label>
                    <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg pl-10 pr-4 py-2.5 text-zinc-100 placeholder-zinc-600 focus:ring-1 focus:ring-rose-500/50 focus:border-rose-500/50 focus:outline-none transition-all text-sm"
                        placeholder="johndoe"
                        required={mode === 'register'}
                        minLength={3}
                        disabled={loading}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div>
                <label className="block text-xs font-medium mb-1.5 text-zinc-400 uppercase tracking-wider">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg pl-10 pr-4 py-2.5 text-zinc-100 placeholder-zinc-600 focus:ring-1 focus:ring-rose-500/50 focus:border-rose-500/50 focus:outline-none transition-all text-sm"
                    placeholder="you@example.com"
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5 text-zinc-400 uppercase tracking-wider">
                  Password {mode === 'register' && <span className="text-zinc-600">(min 8 chars)</span>}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg pl-10 pr-4 py-2.5 text-zinc-100 placeholder-zinc-600 focus:ring-1 focus:ring-rose-500/50 focus:border-rose-500/50 focus:outline-none transition-all text-sm"
                    placeholder="••••••••"
                    required
                    minLength={mode === 'register' ? 8 : 1}
                    disabled={loading}
                  />
                </div>
              </div>

              <motion.button
                type="submit"
                disabled={loading}
                whileHover={{ scale: loading ? 1 : 1.02 }}
                whileTap={{ scale: loading ? 1 : 0.98 }}
                className="w-full py-2.5 bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-500 hover:to-red-600 rounded-lg transition-all font-medium text-sm shadow-lg shadow-rose-900/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : mode === 'login' ? 'Sign In' : 'Create Account'}
              </motion.button>
            </form>

            <div className="mt-4 text-center">
              <p className="text-zinc-500 text-xs">
                {mode === 'login' ? "No account?" : 'Have an account?'}
                {' '}
                <button
                  type="button"
                  onClick={toggleMode}
                  disabled={loading}
                  className="text-rose-400 hover:text-rose-300 font-medium transition-colors disabled:opacity-50"
                >
                  {mode === 'login' ? 'Sign up' : 'Sign in'}
                </button>
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AuthModal;
