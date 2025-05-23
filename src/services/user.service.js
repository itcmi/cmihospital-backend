const { Op } = require("sequelize");
const User = require("../models/User.model");
const { AppError } = require("../middleware/error.middleware");
const logger = require("../utils/logger");

class UserService {
  async createUser(userData) {
    try {
      const existingUser = await User.findOne({
        where: { email: userData.email },
      });

      if (existingUser) {
        throw new AppError("User with this email already exists", 409);
      }

      const user = await User.create(userData);
      logger.info(`New user created: ${user.email}`);

      return user;
    } catch (error) {
      if (error instanceof AppError) throw error;

      logger.error("Error creating user:", error);
      throw new AppError("Failed to create user", 500);
    }
  }

  async getUserById(id) {
    try {
      const user = await User.findByPk(id);

      if (!user) {
        throw new AppError("User not found", 404);
      }

      return user;
    } catch (error) {
      if (error instanceof AppError) throw error;

      logger.error("Error fetching user:", error);
      throw new AppError("Failed to fetch user", 500);
    }
  }

  async getUserByEmail(email) {
    try {
      const user = await User.findOne({
        where: { email },
      });

      return user;
    } catch (error) {
      logger.error("Error fetching user by email:", error);
      throw new AppError("Failed to fetch user", 500);
    }
  }

  async updateUser(id, updateData) {
    try {
      const user = await this.getUserById(id);

      await user.update(updateData);
      logger.info(`User updated: ${user.email}`);

      return user;
    } catch (error) {
      if (error instanceof AppError) throw error;

      logger.error("Error updating user:", error);
      throw new AppError("Failed to update user", 500);
    }
  }

  async deleteUser(id) {
    try {
      const user = await this.getUserById(id);

      await user.destroy();
      logger.info(`User deleted: ${user.email}`);

      return { message: "User deleted successfully" };
    } catch (error) {
      if (error instanceof AppError) throw error;

      logger.error("Error deleting user:", error);
      throw new AppError("Failed to delete user", 500);
    }
  }

  async getUsers(options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = "createdAt",
        sortOrder = "desc",
        search = "",
        isActive,
      } = options;

      const offset = (page - 1) * limit;

      const whereClause = {};

      if (search) {
        whereClause[Op.or] = [
          { firstName: { [Op.like]: `%${search}%` } },
          { lastName: { [Op.like]: `%${search}%` } },
          { email: { [Op.like]: `%${search}%` } },
        ];
      }

      if (isActive !== undefined) {
        whereClause.isActive = isActive;
      }

      const { count, rows } = await User.findAndCountAll({
        where: whereClause,
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [[sortBy, sortOrder.toUpperCase()]],
      });

      return {
        users: rows,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(count / limit),
          totalItems: count,
          itemsPerPage: parseInt(limit),
        },
      };
    } catch (error) {
      logger.error("Error fetching users:", error);
      throw new AppError("Failed to fetch users", 500);
    }
  }
}

module.exports = new UserService();
