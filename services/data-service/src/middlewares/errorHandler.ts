import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import logger from '../utils/logger';
import config from '../config/env';

interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

class ErrorHandler {
  /**
   * Handle 404 errors
   */
  static notFound(req: Request, res: Response, next: NextFunction): void {
    const error = new Error(`Not Found - ${req.originalUrl}`) as AppError;
    error.statusCode = StatusCodes.NOT_FOUND;
    next(error);
  }

  /**
   * Global error handler
   */
  static handle(
    error: AppError,
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    const statusCode = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    const message = error.message || 'Internal Server Error';
    const isOperational = error.isOperational || false;

    // Log error
    if (statusCode >= 500) {
      logger.error('Server error:', {
        error: error.message,
        stack: error.stack,
        path: req.path,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });
    } else {
      logger.warn('Client error:', {
        error: error.message,
        statusCode,
        path: req.path,
        method: req.method,
      });
    }

    // Prepare response
    const errorResponse: any = {
      success: false,
      error: message,
      path: req.path,
      timestamp: new Date().toISOString(),
    };

    // Include stack trace in development
    if (config.server.nodeEnv === 'development' && error.stack) {
      errorResponse.stack = error.stack;
    }

    // Include validation errors if present
    if (error.name === 'ValidationError') {
      errorResponse.error = 'Validation Error';
      errorResponse.details = (error as any).errors;
    }

    res.status(statusCode).json(errorResponse);
  }

  /**
   * Create operational error
   */
  static createOperationalError(
    message: string,
    statusCode: number = StatusCodes.BAD_REQUEST
  ): AppError {
    const error = new Error(message) as AppError;
    error.statusCode = statusCode;
    error.isOperational = true;
    return error;
  }

  /**
   * Async error handler wrapper
   */
  static catchAsync(fn: Function) {
    return (req: Request, res: Response, next: NextFunction) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }
}

export default ErrorHandler;