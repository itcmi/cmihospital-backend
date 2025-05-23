const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");
const User = require("../models/User.model");
const { AppError } = require("../middleware/error.middleware");
const config = require("../config/app");
const logger = require("../utils/logger");
const emailService = require("./email.service");

class AuthService {
  generateTokens(userId) {
    const payload = { userId };

    const accessToken = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    });

    const refreshToken = jwt.sign(payload, config.jwt.refreshSecret, {
      expiresIn: config.jwt.refreshExpiresIn,
    });

    return { accessToken, refreshToken };
  }

  async register(userData) {
    try {
      const user = await User.create({
        ...userData,
        emailVerificationToken: uuidv4(),
      });

      const tokens = this.generateTokens(user.id);

      // Send verification email
      await emailService.sendVerificationEmail(
        user.email,
        user.emailVerificationToken
      );

      logger.info(`User registered: ${user.email}`);

      return {
        user,
        tokens,
      };
    } catch (error) {
      logger.error("Registration error:", error);
      throw new AppError("Registration failed", 500);
    }
  }

  async login(email, password) {
    try {
      const user = await User.findOne({
        where: { email },
        attributes: { include: ["password"] },
      });

      if (!user || !(await user.comparePassword(password))) {
        throw new AppError("Invalid email or password", 401);
      }

      if (!user.isActive) {
        throw new AppError("Account is deactivated", 401);
      }

      // Update last login
      await user.update({ lastLogin: new Date() });

      const tokens = this.generateTokens(user.id);

      logger.info(`User logged in: ${user.email}`);

      return {
        user,
        tokens,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;

      logger.error("Login error:", error);
      throw new AppError("Login failed", 500);
    }
  }

  async refreshToken(refreshToken) {
    try {
      const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret);
      const user = await User.findByPk(decoded.userId);

      if (!user || !user.isActive) {
        throw new AppError("Invalid refresh token", 401);
      }

      const tokens = this.generateTokens(user.id);

      return { tokens };
    } catch (error) {
      logger.error("Token refresh error:", error);
      throw new AppError("Invalid refresh token", 401);
    }
  }

  async forgotPassword(email) {
    try {
      const user = await User.findOne({ where: { email } });

      if (!user) {
        // Don't reveal if email exists
        return {
          message: "If email exists, reset instructions have been sent",
        };
      }

      const resetToken = crypto.randomBytes(32).toString("hex");
      const resetExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      await user.update({
        passwordResetToken: resetToken,
        passwordResetExpires: resetExpires,
      });

      await emailService.sendPasswordResetEmail(email, resetToken);

      logger.info(`Password reset requested: ${email}`);

      return { message: "If email exists, reset instructions have been sent" };
    } catch (error) {
      logger.error("Forgot password error:", error);
      throw new AppError("Failed to process password reset request", 500);
    }
  }

  async resetPassword(token, newPassword) {
    try {
      const user = await User.findOne({
        where: {
          passwordResetToken: token,
          passwordResetExpires: { [Op.gt]: new Date() },
        },
      });

      if (!user) {
        throw new AppError("Invalid or expired reset token", 400);
      }

      await user.update({
        password: newPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
      });

      logger.info(`Password reset completed: ${user.email}`);

      return { message: "Password reset successful" };
    } catch (error) {
      if (error instanceof AppError) throw error;

      logger.error("Reset password error:", error);
      throw new AppError("Failed to reset password", 500);
    }
  }

  async verifyEmail(token) {
    try {
      const user = await User.findOne({
        where: { emailVerificationToken: token },
      });

      if (!user) {
        throw new AppError("Invalid verification token", 400);
      }

      await user.update({
        emailVerified: true,
        emailVerificationToken: null,
      });

      logger.info(`Email verified: ${user.email}`);

      return { message: "Email verified successfully" };
    } catch (error) {
      if (error instanceof AppError) throw error;

      logger.error("Email verification error:", error);
      throw new AppError("Failed to verify email", 500);
    }
  }
}

module.exports = new AuthService();
