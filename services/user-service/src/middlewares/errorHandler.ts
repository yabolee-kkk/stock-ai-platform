/**
 * @file 错误处理中间件
 * @description 统一错误处理，返回标准化的错误响应
 * @author StockAI开发团队
 * @created 2026-03-15
 */

import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { logger } from '@/utils/logger';
import { config } from '@/config/env';

/**
 * 自定义错误类型
 */
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public isOperational = true,
    public code?: string
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 验证错误
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(StatusCodes.BAD_REQUEST, message);
    this.code = 'VALIDATION_ERROR';
    this.details = details;
  }
  
  details?: any;
}

/**
 * 认证错误
 */
export class AuthenticationError extends AppError {
  constructor(message = '认证失败') {
    super(StatusCodes.UNAUTHORIZED, message);
    this.code = 'AUTHENTICATION_ERROR';
  }
}

/**
 * 授权错误
 */
export class AuthorizationError extends AppError {
  constructor(message = '权限不足') {
    super(StatusCodes.FORBIDDEN, message);
    this.code = 'AUTHORIZATION_ERROR';
  }
}

/**
 * 资源不存在错误
 */
export class NotFoundError extends AppError {
  constructor(message = '资源不存在') {
    super(StatusCodes.NOT_FOUND, message);
    this.code = 'NOT_FOUND_ERROR';
  }
}

/**
 * 冲突错误
 */
export class ConflictError extends AppError {
  constructor(message = '资源冲突') {
    super(StatusCodes.CONFLICT, message);
    this.code = 'CONFLICT_ERROR';
  }
}

/**
 * 数据库错误
 */
export class DatabaseError extends AppError {
  constructor(message = '数据库操作失败') {
    super(StatusCodes.INTERNAL_SERVER_ERROR, message);
    this.code = 'DATABASE_ERROR';
  }
}

/**
 * 外部服务错误
 */
export class ExternalServiceError extends AppError {
  constructor(message = '外部服务调用失败') {
    super(StatusCodes.BAD_GATEWAY, message);
    this.code = 'EXTERNAL_SERVICE_ERROR';
  }
}

/**
 * 速率限制错误
 */
export class RateLimitError extends AppError {
  constructor(message = '请求过于频繁') {
    super(StatusCodes.TOO_MANY_REQUESTS, message);
    this.code = 'RATE_LIMIT_ERROR';
  }
}

/**
 * 错误响应格式
 */
interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
    requestId?: string;
    path?: string;
    stack?: string;
  };
}

/**
 * 错误处理中间件
 */
export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // 获取请求ID（如果有）
  const requestId = req.headers['x-request-id'] as string;
  
  // 标准化错误
  let statusCode = StatusCodes.INTERNAL_SERVER_ERROR;
  let code = 'INTERNAL_SERVER_ERROR';
  let message = '服务器内部错误';
  let details: any = undefined;
  let isOperational = false;
  
  // 处理不同类型的错误
  if (error instanceof AppError) {
    statusCode = error.statusCode;
    code = error.code || 'APP_ERROR';
    message = error.message;
    details = (error as any).details;
    isOperational = error.isOperational;
  } else if (error.name === 'ValidationError') {
    // Joi验证错误
    statusCode = StatusCodes.BAD_REQUEST;
    code = 'VALIDATION_ERROR';
    message = '请求参数验证失败';
    details = (error as any).details;
    isOperational = true;
  } else if (error.name === 'JsonWebTokenError') {
    // JWT错误
    statusCode = StatusCodes.UNAUTHORIZED;
    code = 'JWT_ERROR';
    message = '令牌无效';
    isOperational = true;
  } else if (error.name === 'TokenExpiredError') {
    // JWT过期
    statusCode = StatusCodes.UNAUTHORIZED;
    code = 'JWT_EXPIRED';
    message = '令牌已过期';
    isOperational = true;
  } else if (error.name === 'SyntaxError' && 'body' in error) {
    // JSON解析错误
    statusCode = StatusCodes.BAD_REQUEST;
    code = 'INVALID_JSON';
    message = '请求体JSON格式错误';
    isOperational = true;
  }
  
  // 记录错误日志
  if (isOperational) {
    logger.warn('操作错误', {
      error: {
        name: error.name,
        message: error.message,
        code,
        statusCode,
        details,
      },
      request: {
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        requestId,
      },
    });
  } else {
    logger.error('系统错误', {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code,
        statusCode,
        details,
      },
      request: {
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        requestId,
      },
    });
  }
  
  // 构建错误响应
  const errorResponse: ErrorResponse = {
    error: {
      code,
      message,
      timestamp: new Date().toISOString(),
      requestId,
      path: req.originalUrl,
    },
  };
  
  // 添加详细信息
  if (details) {
    errorResponse.error.details = details;
  }
  
  // 开发环境添加堆栈信息
  if (config.server.isDevelopment && error.stack) {
    errorResponse.error.stack = error.stack;
  }
  
  // 发送错误响应
  res.status(statusCode).json(errorResponse);
}

/**
 * 异步错误包装器
 */
export function asyncErrorHandler(fn: Function) {
  return function (req: Request, res: Response, next: NextFunction) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * 404处理中间件
 */
export function notFoundHandler(req: Request, res: Response): void {
  const error = new NotFoundError(`路径 ${req.method} ${req.originalUrl} 不存在`);
  
  // 记录404错误
  logger.warn('404错误', {
    request: {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    },
  });
  
  // 通过错误处理中间件处理
  errorHandler(error, req, res, () => {});
}

/**
 * 导出错误处理工具
 */
export default {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  DatabaseError,
  ExternalServiceError,
  RateLimitError,
  errorHandler,
  asyncErrorHandler,
  notFoundHandler,
};