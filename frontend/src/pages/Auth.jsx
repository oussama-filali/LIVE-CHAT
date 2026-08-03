import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, MessageSquare } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

export default function Auth() {
  const [isSignIn, setIsSignIn] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const login = useAuthStore((state) => state.login);
  const register = useAuthStore((state) => state.register);
  const error = useAuthStore((state) => state.error);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    username: '',
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    const result = isSignIn
      ? await login({ email: formData.email, password: formData.password })
      : await register(formData);

    setIsSubmitting(false);

    if (result.success) {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen w-full bg-grid-pattern flex flex-col items-center justify-center p-4" style={{ backgroundColor: '#111217' }}>
      
      {/* En-tête : Logo & Titre */}
      <div className="flex flex-col items-center mb-6 text-center">
        <div 
          className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3 shadow-lg" 
          style={{ backgroundColor: '#5b6cf9', boxShadow: '0 10px 25px -5px rgba(91, 108, 249, 0.4)' }}
        >
          <MessageSquare className="w-7 h-7 text-white fill-current" />
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Live Chat</h1>
        <p className="text-gray-400 text-xs mt-1">
          Connecting peers since 1999, now unconstrained.
        </p>
      </div>

      {/* Carte Formulaire */}
      <div 
        className="w-full max-w-[420px] rounded-2xl p-7 shadow-2xl border"
        style={{ backgroundColor: '#20232a', borderColor: '#2b2f38' }}
      >
        {/* Switch Onglets Sign In / Create Account */}
        <div className="flex p-1 rounded-xl mb-6" style={{ backgroundColor: '#16181d' }}>
          <button
            type="button"
            onClick={() => setIsSignIn(true)}
            className="flex-1 py-2.5 text-xs font-semibold rounded-lg transition-all duration-200"
            style={{
              backgroundColor: isSignIn ? '#5b6cf9' : 'transparent',
              color: isSignIn ? '#ffffff' : '#8a8f9d'
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setIsSignIn(false)}
            className="flex-1 py-2.5 text-xs font-semibold rounded-lg transition-all duration-200"
            style={{
              backgroundColor: !isSignIn ? '#5b6cf9' : 'transparent',
              color: !isSignIn ? '#ffffff' : '#8a8f9d'
            }}
          >
            Create Account
          </button>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isSignIn && (
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                USERNAME
              </label>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                placeholder="johndoe"
                required
                className="w-full rounded-lg px-4 py-3 text-white text-sm focus:outline-none transition-colors placeholder-gray-600 border"
                style={{ backgroundColor: '#16181d', borderColor: '#2b2f38' }}
              />
            </div>
          )}

          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
              EMAIL
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="you@example.com"
              required
              className="w-full rounded-lg px-4 py-3 text-white text-sm focus:outline-none transition-colors placeholder-gray-600 border"
              style={{ backgroundColor: '#16181d', borderColor: '#2b2f38' }}
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
              PASSWORD
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••"
                required
                className="w-full rounded-lg px-4 py-3 text-white text-sm focus:outline-none transition-colors placeholder-gray-600 pr-10 border"
                style={{ backgroundColor: '#16181d', borderColor: '#2b2f38' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {isSignIn && (
            <div className="flex justify-end pt-1">
              <a href="#" className="text-xs hover:underline font-medium" style={{ color: '#5b6cf9' }}>
                Forgot your password?
              </a>
            </div>
          )}

          {error && (
            <div
              className="text-xs rounded-lg px-3 py-2 border"
              style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)', color: '#f87171' }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full text-white font-semibold py-3 rounded-lg transition-colors duration-200 mt-2 shadow-lg disabled:opacity-60"
            style={{ 
              backgroundColor: '#5b6cf9',
              boxShadow: '0 8px 20px -4px rgba(91, 108, 249, 0.4)' 
            }}
          >
            {isSubmitting ? 'Chargement...' : isSignIn ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        {/* Switch bas de carte */}
        <div className="text-center mt-6 text-xs text-gray-400">
          {isSignIn ? (
            <p>
              New here?{' '}
              <button
                type="button"
                onClick={() => setIsSignIn(false)}
                className="font-semibold hover:underline ml-1"
                style={{ color: '#5b6cf9' }}
              >
                Create an account
              </button>
            </p>
          ) : (
            <p>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => setIsSignIn(true)}
                className="font-semibold hover:underline ml-1"
                style={{ color: '#5b6cf9' }}
              >
                Sign in
              </button>
            </p>
          )}
        </div>
      </div>

      {/* Footer Legal */}
      <p className="text-[11px] text-gray-500 mt-8 text-center">
        By continuing, you agree to our{' '}
        <a href="#" className="text-gray-400 hover:underline">Terms</a> &{' '}
        <a href="#" className="text-gray-400 hover:underline">Privacy Policy</a>.
      </p>
    </div>
  );
}
