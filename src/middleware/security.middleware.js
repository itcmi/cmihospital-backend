const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const slowDown = require("express-slow-down");
const mongoSanitize = require("express-mongo-sanitize");
const hpp = require("hpp");
const config = require("../config/app");
const logger = require("../utils/logger");

// Rate limiting configuration
const createRateLimiter = (windowMs, max, message) =>
  rateLimit({
    windowMs,
    max,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
      res.status(429).json({ error: message });
    },
  });

// Speed limiting configuration
const createSpeedLimiter = (windowMs, delayAfter, delayMsValue) =>
  slowDown({
    windowMs,
    delayAfter,
    delayMs: () => delayMsValue,
    // Removed onLimitReached - it's deprecated in v7
    // If you need to log when speed limit is reached, you can use skipSuccessfulRequests
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
  });

const securityMiddleware = {
  // Basic security headers
  helmet: helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  }),

  // General rate limiter
  generalRateLimit: createRateLimiter(
    config.security.rateLimitWindowMs, // 15 minutes
    config.security.rateLimitMaxAttempts, // 100 requests
    "Too many requests from this IP, please try again later"
  ),

  // Auth rate limiter (stricter)
  authRateLimit: createRateLimiter(
    15 * 60 * 1000, // 15 minutes
    5, // 5 attempts
    "Too many authentication attempts, please try again later"
  ),

  // Speed limiter
  speedLimit: createSpeedLimiter(
    15 * 60 * 1000, // 15 minutes
    50, // Start slowing down after 50 requests
    500 // Delay by 500ms
  ),

  // Sanitize input
  sanitize: mongoSanitize(),

  // Prevent HTTP Parameter Pollution
  hpp: hpp(),
};

module.exports = securityMiddleware;
