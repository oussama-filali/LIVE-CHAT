import React, { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, isChecking, checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (isChecking) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#111217] text-gray-400">
        <Loader2 className="w-10 h-10 animate-spin text-[#5b6cf9] mb-4" />
        <span className="text-sm font-medium">Chargement de la session...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  return children;
}
