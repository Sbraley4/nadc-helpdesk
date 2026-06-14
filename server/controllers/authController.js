const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const prisma = new PrismaClient();

/**
 * POST /api/auth/login
 * Authenticate user and return tokens
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(403).json({ error: 'Account disabled' });
    }

    // Generate tokens
    const tokenPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    });

    const refreshToken = jwt.sign(tokenPayload, process.env.JWT_REFRESH_SECRET, {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    });

    // Return tokens and user data (without password)
    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/refresh
 * Issue new access token using refresh token
 */
const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token required' });
    }

    // Verify refresh token
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch (error) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    // Generate new access token
    const accessToken = jwt.sign(
      {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
    );

    res.json({ accessToken });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/logout
 * Logout user (token blacklisting can be added later)
 */
const logout = async (req, res, next) => {
  try {
    // For now, just return success
    // Token blacklisting can be implemented later with Redis
    res.json({ message: 'Logged out' });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/auth/me
 * Get current authenticated user
 */
const me = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatar: true,
        signature: true,
        availability: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/auth/verify-setup-token/:token
 * Verify that a setup token is valid and not expired
 */
const verifySetupToken = async (req, res, next) => {
  try {
    const { token } = req.params;

    const user = await prisma.user.findUnique({
      where: { passwordResetToken: token },
      select: {
        id: true,
        name: true,
        email: true,
        passwordResetExpires: true,
      },
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired setup link' });
    }

    // Use explicit UTC timestamps for comparison to avoid timezone issues
    const nowMs = Date.now();
    const expiresMs = user.passwordResetExpires ? new Date(user.passwordResetExpires).getTime() : null;

    if (expiresMs && nowMs > expiresMs) {
      console.log(`[Auth] Token expired: now=${nowMs}, expires=${expiresMs}, diff=${(nowMs - expiresMs) / 1000}s`);
      return res.status(400).json({ error: 'Setup link has expired' });
    }

    res.json({
      valid: true,
      user: {
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/setup-password
 * Set password using setup token
 */
const setupPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: 'Token and password are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const user = await prisma.user.findUnique({
      where: { passwordResetToken: token },
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired setup link' });
    }

    // Use explicit UTC timestamps for comparison to avoid timezone issues
    const nowMs = Date.now();
    const expiresMs = user.passwordResetExpires ? new Date(user.passwordResetExpires).getTime() : null;

    if (expiresMs && nowMs > expiresMs) {
      console.log(`[Auth] Token expired during setup: now=${nowMs}, expires=${expiresMs}, diff=${(nowMs - expiresMs) / 1000}s`);
      return res.status(400).json({ error: 'Setup link has expired' });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update user with new password and clear reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
        mustChangePassword: false,
      },
    });

    res.json({ message: 'Password set successfully. You can now log in.' });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/auth/change-password
 * Change password for authenticated user
 */
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }

    // Get user with current password
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash and save new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        mustChangePassword: false,
      },
    });

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/forgot-password
 * Send password reset email
 */
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    // Always return success to prevent email enumeration
    if (!user) {
      console.log(`[Auth] Forgot password requested for non-existent email: ${email}`);
      return res.json({ message: 'If an account exists with that email, a reset link has been sent.' });
    }

    // Generate secure token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    // Save token to user
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetToken,
        passwordResetExpires: resetExpires,
      },
    });

    // Send reset email
    const emailService = require('../services/emailService');
    await emailService.sendPasswordResetEmail(user, resetToken);

    console.log(`[Auth] Password reset email sent to ${email}`);
    res.json({ message: 'If an account exists with that email, a reset link has been sent.' });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/auth/verify-reset-token/:token
 * Verify that a reset token is valid and not expired
 */
const verifyResetToken = async (req, res, next) => {
  try {
    const { token } = req.params;

    const user = await prisma.user.findUnique({
      where: { passwordResetToken: token },
      select: {
        id: true,
        email: true,
        passwordResetExpires: true,
      },
    });

    if (!user) {
      return res.status(400).json({ valid: false, error: 'Invalid or expired reset link' });
    }

    // Check token expiry
    const nowMs = Date.now();
    const expiresMs = user.passwordResetExpires ? new Date(user.passwordResetExpires).getTime() : null;

    if (expiresMs && nowMs > expiresMs) {
      return res.status(400).json({ valid: false, error: 'Reset link has expired' });
    }

    res.json({ valid: true, email: user.email });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/reset-password
 * Reset password using token
 */
const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: 'Token and password are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const user = await prisma.user.findUnique({
      where: { passwordResetToken: token },
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset link' });
    }

    // Check token expiry
    const nowMs = Date.now();
    const expiresMs = user.passwordResetExpires ? new Date(user.passwordResetExpires).getTime() : null;

    if (expiresMs && nowMs > expiresMs) {
      return res.status(400).json({ error: 'Reset link has expired' });
    }

    // Hash and save new password
    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
        mustChangePassword: false,
      },
    });

    console.log(`[Auth] Password reset successfully for user: ${user.email}`);
    res.json({ message: 'Password reset successfully. You can now log in.' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  login,
  refresh,
  logout,
  me,
  verifySetupToken,
  setupPassword,
  changePassword,
  forgotPassword,
  verifyResetToken,
  resetPassword,
};
