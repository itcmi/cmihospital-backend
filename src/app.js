require("dotenv").config();
const express = require("express");
const cors = require("cors");
const compression = require("compression");
const cookieParser = require("cookie-parser");
const swaggerUi = require("swagger-ui-express");
const swaggerJsdoc = require("swagger-jsdoc");

// Import configurations and middleware
const config = require("./config/app");
const { testConnection } = require("./config/database");
const logger = require("./utils/logger");
const securityMiddleware = require("./middleware/security.middleware");
const {
  globalErrorHandler,
  notFound,
} = require("./middleware/error.middleware");

// Import routes
const apiRoutes = require("./routes/api.routes");

// Create Express app
const app = express();

// Trust proxy (important for rate limiting behind reverse proxy)
app.set("trust proxy", 1);

// Security middleware
app.use(securityMiddleware.helmet);
app.use(securityMiddleware.sanitize);
app.use(securityMiddleware.hpp);
app.use(securityMiddleware.generalRateLimit);
app.use(securityMiddleware.speedLimit);

// CORS configuration
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(",") || [
      "http://localhost:3000",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// Compression middleware
app.use(compression());

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.originalUrl}`, {
    ip: req.ip,
    userAgent: req.get("User-Agent"),
  });
  next();
});

// Swagger documentation
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Professional Backend API",
      version: "1.0.0",
      description:
        "A professional Node.js backend API with Express.js and MySQL",
      contact: {
        name: "API Support",
        email: "support@example.com",
      },
    },
    servers: [
      {
        url: `http://localhost:${config.app.port}/api/${config.app.apiVersion}`,
        description: "Development server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
  },
  apis: ["./src/routes/*.js"], // Path to the API docs
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// API routes
app.use(`/api/${config.app.apiVersion}`, apiRoutes);

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    message: "Professional Backend API",
    version: "1.0.0",
    documentation: "/api-docs",
    health: `/api/${config.app.apiVersion}/health`,
  });
});

// Handle unmatched routes
app.use(notFound);

// Global error handler
app.use(globalErrorHandler);

// Start server
const startServer = async () => {
  try {
    // Test database connection
    await testConnection();

    // Start HTTP server
    const server = app.listen(config.app.port, () => {
      logger.info(
        `Server running on port ${config.app.port} in ${config.app.env} mode`
      );
      logger.info(
        `API Documentation: http://localhost:${config.app.port}/api-docs`
      );
    });

    // Graceful shutdown
    const gracefulShutdown = (signal) => {
      logger.info(`${signal} received, shutting down gracefully`);
      server.close(() => {
        logger.info("Process terminated");
        process.exit(0);
      });
    };

    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
};

// Only start server if this file is executed directly
if (require.main === module) {
  startServer();
}

module.exports = app;
