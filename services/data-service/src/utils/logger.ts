import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import config from '../config/env';

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Create console transport for development
const consoleTransport = new winston.transports.Console({
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.simple()
  ),
});

// Create file transport for production
const fileTransport = new DailyRotateFile({
  filename: config.logging.filePath.replace('.log', '-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d',
});

// Create logger instance
const logger = winston.createLogger({
  level: config.logging.level,
  format: logFormat,
  defaultMeta: { service: 'data-service' },
  transports: [],
});

// Add transports based on environment
if (config.server.nodeEnv === 'production') {
  logger.add(fileTransport);
} else {
  logger.add(consoleTransport);
  // Also log to file in development for debugging
  logger.add(fileTransport);
}

// Log unhandled exceptions
logger.exceptions.handle(
  new winston.transports.Console(),
  new winston.transports.File({ filename: 'logs/exceptions.log' })
);

// Log unhandled rejections
logger.rejections.handle(
  new winston.transports.File({ filename: 'logs/rejections.log' })
);

export default logger;