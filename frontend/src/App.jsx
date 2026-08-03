import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Auth from './pages/Auth';
import Home from './pages/Home';
import { useAuthStore } from './store/authStore';

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center text-white" style={{ backgroundColor: '#111217' }}>
      Chargement...
    </div>
  );
}

// Bloque l'accès si pas connecté
function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuthStore();
  if (isLoading) return <LoadingScreen />;
  return isAuthenticated ? children : <Navigate to="/auth" replace />;
}

// Empêche d'aller sur /auth si déjà connecté
function PublicRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuthStore();
  if (isLoading) return <LoadingScreen />;
  return isAuthenticated ? <Navigate to="/" replace /> : children;
}

export default function App() {
  const checkAuth = useAuthStore((state) => state.checkAuth);

  // Au montage de l'app : on demande /auth/me pour savoir si le cookie
  // accessToken en place correspond encore à une session valide
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/auth"
          element={
            <PublicRoute>
              <Auth />
            </PublicRoute>
          }
        />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
