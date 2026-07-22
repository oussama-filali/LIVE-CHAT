import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export const requireAuth = (req, res, next) => {
  // OWASP: Le token est lu depuis un cookie httpOnly, jamais depuis l'en-tête Authorization / localStorage
  const token = req.cookies?.accessToken;

  if (!token) {
    return res.status(401).json({ error: 'Accès non autorisé. Token manquant.' });
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token invalide ou expiré.' });
  }
};