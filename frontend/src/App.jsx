import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Auth from './pages/Auth';
import Chat from './pages/Chat';
import ProtectedRoute from './components/ProtectedRoute';
import PublicRoute from './components/PublicRoute';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Route publique pour connexion/inscription protégée contre les connexions déjà actives */}
        <Route 
          path="/auth" 
          element={
            <PublicRoute>
              <Auth />
            </PublicRoute>
          } 
        />

        {/* Route privée de l'application de Chat */}
        <Route 
          path="/" 
          element={
            <ProtectedRoute>
              <Chat />
            </ProtectedRoute>
          } 
        />

        {/* Redirection automatique vers la racine */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
