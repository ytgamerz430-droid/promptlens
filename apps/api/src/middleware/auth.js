import jwt from 'jsonwebtoken';
import { err } from '../utils/http.js';

const SECRET = process.env.SESSION_SECRET || 'dev-secret-change-me';
const EXPIRES_IN = '7d';

export function signToken(userId) {
  return jwt.sign({ sub: userId }, SECRET, { expiresIn: EXPIRES_IN });
}

/** Bearer JWT verification. Attaches req.user = { id }. */
export function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
  if (!token) return err(res, 401, 'UNAUTHORIZED', 'Authentication is required.');
  try {
    const payload = jwt.verify(token, SECRET);
    req.user = { id: payload.sub };
    return next();
  } catch {
    return err(res, 401, 'UNAUTHORIZED', 'Your session has expired. Please sign in again.');
  }
}
