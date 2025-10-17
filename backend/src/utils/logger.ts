/**
 * Winston logger configuration
 */

import winston from "winston";
import path from "path";
import { fileURLToPath } from "url";
import { existsSync, mkdirSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, "../../logs");
if (!existsSync(logsDir)) {
  mkdirSync(logsDir, { recursive: true });
}

const logLevel = process.env.LOG_LEVEL || "info";

// Custom format for console
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: "HH:mm:ss" }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length
      ? "\n" + JSON.stringify(meta, null, 2)
      : "";
    return `${timestamp} [${level}]: ${message}${metaStr}`;
  })
);

// Custom format for file
const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

export const logger = winston.createLogger({
  level: logLevel,
  transports: [
    // Console output (colorized, readable)
    new winston.transports.Console({
      format: consoleFormat
    }),

    // Error log file
    new winston.transports.File({
      filename: path.join(logsDir, "error.log"),
      level: "error",
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),

    // Combined log file
    new winston.transports.File({
      filename: path.join(logsDir, "combined.log"),
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ]
});

// If not in production, log to console with more detail
if (process.env.NODE_ENV !== "production") {
  logger.debug("Logger initialized");
  logger.debug(`Log level: ${logLevel}`);
}
