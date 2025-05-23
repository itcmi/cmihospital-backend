const express = require("express");
const userController = require("../controllers/user.controller");
const { authenticate, authorize } = require("../middleware/auth.middleware");
const { validate, schemas } = require("../middleware/validation.middleware");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: User management endpoints
 */

// All user routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /api/v1/users:
 *   get:
 *     summary: Get all users (Admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: Number of users per page
 *     responses:
 *       200:
 *         description: List of users
 *       403:
 *         description: Insufficient permissions
 */
router.get(
  "/",
  authorize("admin", "super_admin"),
  validate(schemas.pagination, "query"),
  userController.getUsers
);

router.get("/:id", authorize("admin", "super_admin"), userController.getUser);

router.post(
  "/",
  authorize("admin", "super_admin"),
  validate(schemas.userRegister),
  userController.createUser
);

router.put(
  "/:id",
  authorize("admin", "super_admin"),
  validate(schemas.userUpdate),
  userController.updateUser
);

router.delete("/:id", authorize("super_admin"), userController.deleteUser);

module.exports = router;
