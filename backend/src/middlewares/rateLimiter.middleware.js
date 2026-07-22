import rateLimit from 'express-rate-limit';

// Limiteur global
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Limite chaque IP à 500 requêtes
  message: { error: 'Trop de requêtes, veuillez réessayer plus tard.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Limiteur strict pour l'authentification
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // 5 tentatives par 15 minutes
  message: { error: 'Trop de tentatives, veuillez réessayer dans 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});