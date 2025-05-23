const Joi = require("joi");
const logger = require("../utils/logger");

const validate = (schema, property = "body") => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      allowUnknown: false,
      stripUnknown: true,
    });

    if (error) {
      const errorMessage = error.details.map((detail) => ({
        field: detail.context.key,
        message: detail.message,
      }));

      logger.warn("Validation error:", {
        ip: req.ip,
        endpoint: req.originalUrl,
        errors: errorMessage,
      });

      return res.status(400).json({
        error: "Validation failed",
        details: errorMessage,
      });
    }

    // Replace request data with validated data
    req[property] = value;
    next();
  };
};

// Common validation schemas
const schemas = {
  // User registration
  userRegister: Joi.object({
    email: Joi.string().email().required().max(255),
    password: Joi.string()
      .min(8)
      .max(128)
      .required()
      .pattern(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/
      )
      .message(
        "Password must contain at least one uppercase, lowercase, number, and special character"
      ),
    firstName: Joi.string().min(2).max(50).required(),
    lastName: Joi.string().min(2).max(50).required(),
    phone: Joi.string()
      .pattern(/^[0-9]{10,15}$/)
      .optional(),
  }),

  // User login
  userLogin: Joi.object({
    email: Joi.string().email().required().max(255),
    password: Joi.string().required().max(128),
  }),

  // Update user profile
  userUpdate: Joi.object({
    firstName: Joi.string().min(2).max(50).optional(),
    lastName: Joi.string().min(2).max(50).optional(),
    phone: Joi.string()
      .pattern(/^[0-9]{10,15}$/)
      .optional(),
  }),

  // Pagination
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    sortBy: Joi.string().optional(),
    sortOrder: Joi.string().valid("asc", "desc").default("asc"),
  }),
};

module.exports = {
  validate,
  schemas,
};
