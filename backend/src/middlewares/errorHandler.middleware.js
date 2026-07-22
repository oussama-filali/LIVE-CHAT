import { env } from '../config/env.js';

// Middleware défini avec 4 paramètres pour qu'Express le traite comme Error Handler
export const errorHandler = (err, req, res, next) => {
  // Logs complets côté serveur
  console.error(`[ERROR] ${req.method} ${req.url} - ${err.message}`, err.stack);

  // OWASP: Ne jamais divulguer la stack trace en production
  const statusCode = err.statusCode || 500;
  const message = env.NODE_ENV === 'production' 
    ? 'Une erreur interne est survenue.' 
    : err.message;

  res.status(statusCode).json({ error: message });
};