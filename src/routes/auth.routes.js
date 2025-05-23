const express = require("express");
const authController = require("../controllers/auth.controller");
const { authenticate } = require("../middleware/auth.middleware");
const { validate, schemas } = require("../middleware/validation.middleware");
const securityMiddleware = require("../middleware/security.middleware");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: User authentication endpoints
 */

/**
 * @swagger
 * /api/v1/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - firstName
 *               - lastName
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               phone:
 *                 type: string
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Validation error
 *       409:
 *         description: User already exists
 */
router.post(
  "/register",
  securityMiddleware.authRateLimit,
  validate(schemas.userRegister),
  authController.register
);

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 */
router.post(
  "/login",
  securityMiddleware.authRateLimit,
  validate(schemas.userLogin),
  authController.login
);

router.post("/logout", authController.logout);
router.post("/refresh-token", authController.refreshToken);
router.post(
  "/forgot-password",
  securityMiddleware.authRateLimit,
  authController.forgotPassword
);
router.post(
  "/reset-password",
  securityMiddleware.authRateLimit,
  authController.resetPassword
);
router.get("/verify-email/:token", authController.verifyEmail);
router.get("/profile", authenticate, authController.getProfile);

module.exports = router;
