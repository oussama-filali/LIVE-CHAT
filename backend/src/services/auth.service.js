import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {env} from '../config/env.js';

const SALT_ROUNDS = 12;
const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL = '7d';
const JWT_ISSUER = 'live-chat-api';
const JWT_AUDIENCE = 'live-chat-client';

export const hashPassword = (password) => {
  return bcrypt.hash(password, SALT_ROUNDS);
};
export const comparePassword = (password, hashedPassword) => {
  return bcrypt.compare(password, hashedPassword);
};
export const generateAccessToken = (userId) =>
  jwt.sign({ sub: userId, type: 'access' }, env.JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_TTL,
    algorithm: 'HS256',
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });

export const generateRefreshToken = (userId) =>
  jwt.sign({ sub: userId, type: 'refresh' }, env.JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_TOKEN_TTL,
    algorithm: 'HS256',
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });


const verifyToken = (token, secret, expectedType) => {
  const decoded = jwt.verify(token, secret, {
    algorithms: ['HS256'],
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });

  if (decoded.type !== expectedType) {
    throw new Error('Type de token invalide');
  }

  return decoded;
};

export const verifyAccessToken = (token) => 
    verifyToken(token, env.JWT_SECRET, 'access');

export const verifyRefreshToken = (token) => 
    verifyToken(token, env.JWT_REFRESH_SECRET, 'refresh');
