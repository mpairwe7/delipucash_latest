import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '../lib/prisma.mjs';

// Short-lived access token (configurable, default 15 minutes)
const ACCESS_TOKEN_EXPIRES_IN = process.env.ACCESS_TOKEN_EXPIRES_IN || '15m';

// Long-lived refresh token (configurable, default 30 days)
const REFRESH_TOKEN_DAYS = parseInt(process.env.REFRESH_TOKEN_DAYS || '30', 10);

/**
 * Generate a short-lived JWT access token.
 */
export function generateAccessToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
  });
}

/**
 * Generate a cryptographically random refresh token (opaque, hex-encoded).
 */
export function generateRefreshToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * SHA-256 hash a token for safe DB storage (never store raw refresh tokens).
 */
export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Issue an access + refresh token pair.
 *
 * - If `existingSessionId` is provided, rotates tokens on that session row.
 * - Otherwise creates a new LoginSession with a fresh tokenFamily.
 *
 * @param {string} userId
 * @param {import('express').Request} req — used for device metadata
 * @param {string} [existingSessionId] — session to rotate (refresh flow)
 * @returns {{ accessToken: string, refreshToken: string }}
 */
export async function issueTokenPair(userId, req, existingSessionId) {
  const accessToken = generateAccessToken(userId);
  const rawRefreshToken = generateRefreshToken();
  const hashed = hashToken(rawRefreshToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);

  if (existingSessionId) {
    // Rotation: update the same session row with new refresh token
    await prisma.loginSession.update({
      where: { id: existingSessionId },
      data: {
        sessionToken: accessToken,
        refreshTokenHash: hashed,
        refreshTokenExpiresAt: expiresAt,
        lastActivity: new Date(),
      },
    });
  } else {
    // New login: create session with a fresh tokenFamily
    const deviceInfo = {
      platform: req.headers['user-agent']?.includes('Mobile') ? 'Mobile' : 'Desktop',
      browser: req.headers['user-agent']?.includes('Chrome') ? 'Chrome'
        : req.headers['user-agent']?.includes('Safari') ? 'Safari'
        : req.headers['user-agent']?.includes('Firefox') ? 'Firefox' : 'Unknown',
      os: req.headers['user-agent']?.includes('Android') ? 'Android'
        : req.headers['user-agent']?.includes('iOS') ? 'iOS'
        : req.headers['user-agent']?.includes('Windows') ? 'Windows'
        : req.headers['user-agent']?.includes('Mac') ? 'macOS' : 'Unknown',
    };

    await prisma.loginSession.create({
      data: {
        userId,
        deviceInfo,
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: req.headers['user-agent'],
        sessionToken: accessToken,
        refreshTokenHash: hashed,
        refreshTokenExpiresAt: expiresAt,
        tokenFamily: crypto.randomUUID(),
      },
    });
  }

  return { accessToken, refreshToken: rawRefreshToken };
}
