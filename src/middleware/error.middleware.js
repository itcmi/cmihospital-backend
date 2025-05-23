const logger = require("../utils/logger");
const config = require("../config/app");

class AppError extends Error {
  constructor(message, statusCode, isOperational = true) {
    super(message);

    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

const handleSequelizeError = (error) => {
  let message = "Database operation failed";
  let statusCode = 500;

  switch (error.name) {
    case "SequelizeValidationError":
      message = error.errors.map((e) => e.message).join(", ");
      statusCode = 400;
      break;
    case "SequelizeUniqueConstraintError":
      message = "Resource already exists";
      statusCode = 409;
      break;
    case "SequelizeForeignKeyConstraintError":
      message = "Invalid reference to related resource";
      statusCode = 400;
      break;
    case "SequelizeDatabaseError":
      message = "Database query failed";
      statusCode = 500;
      break;
    default:
      message = error.message || "Database error";
  }

  return new AppError(message, statusCode);
};

const handleJWTError = () => new AppError("Invalid token", 401);
const handleJWTExpiredError = () => new AppError("Token expired", 401);

const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack,
  });
};

const sendErrorProd = (err, res) => {
  // Operational errors: send message to client
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
  } else {
    // Programming errors: don't leak error details
    logger.error("ERROR:", err);

    res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
};

const globalErrorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";

  // Log error
  logger.error("Global error handler:", {
    error: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
  });

  let error = { ...err };
  error.message = err.message;

  // Handle specific error types
  if (
    err.name === "SequelizeValidationError" ||
    err.name === "SequelizeUniqueConstraintError" ||
    err.name === "SequelizeForeignKeyConstraintError" ||
    err.name === "SequelizeDatabaseError"
  ) {
    error = handleSequelizeError(error);
  }

  if (err.name === "JsonWebTokenError") error = handleJWTError();
  if (err.name === "TokenExpiredError") error = handleJWTExpiredError();

  if (config.app.env === "development") {
    sendErrorDev(error, res);
  } else {
    sendErrorProd(error, res);
  }
};

// Handle unhandled routes
const notFound = (req, res, next) => {
  const err = new AppError(`Route ${req.originalUrl} not found`, 404);
  next(err);
};

module.exports = {
  AppError,
  globalErrorHandler,
  notFound,
};
