/**
 * @file 请求日志中间件
 * @description 记录HTTP请求的详细信息
 * @author StockAI开发团队
 * @created 2026-03-15
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '@/utils/logger';

/**
 * 请求日志中间件
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  
  // 记录请求开始
  logger.debug('请求开始', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: (req as any).user?.userId,
  });
  
  // 保存原始的end方法
  const originalEnd = res.end;
  
  // 重写end方法以记录响应
  res.end = function (chunk?: any, encoding?: any, callback?: any): any {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;
    
    // 记录请求完成
    const logData = {
      method: req.method,
      url: req.originalUrl,
      statusCode,
      durationMs: duration,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: (req as any).user?.userId,
      contentLength: res.get('Content-Length') || 0,
    };
    
    // 根据状态码选择日志级别
    if (statusCode >= 500) {
      logger.error('请求完成（服务器错误）', logData);
    } else if (statusCode >= 400) {
      logger.warn('请求完成（客户端错误）', logData);
    } else {
      logger.info('请求完成', logData);
    }
    
    // 调用原始的end方法
    return originalEnd.call(this, chunk, encoding, callback);
  };
  
  next();
}

/**
 * 详细请求日志中间件（记录请求体和响应体）
 */
export function detailedRequestLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  
  // 记录请求详细信息
  const requestLog = {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    headers: {
      'content-type': req.get('Content-Type'),
      'authorization': req.get('Authorization') ? '[REDACTED]' : undefined,
      'user-agent': req.get('User-Agent'),
    },
    query: req.query,
    params: req.params,
    body: req.body,
    userId: (req as any).user?.userId,
  };
  
  logger.debug('详细请求开始', requestLog);
  
  // 保存原始的send和end方法
  const originalSend = res.send;
  const originalEnd = res.end;
  
  let responseBody: any = null;
  
  // 重写send方法以捕获响应体
  res.send = function (body?: any): any {
    responseBody = body;
    return originalSend.call(this, body);
  };
  
  // 重写end方法以记录响应
  res.end = function (chunk?: any, encoding?: any, callback?: any): any {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;
    
    // 记录详细响应信息
    const responseLog = {
      method: req.method,
      url: req.originalUrl,
      statusCode,
      durationMs: duration,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: (req as any).user?.userId,
      responseBody: responseBody,
      contentLength: res.get('Content-Length') || 0,
    };
    
    // 根据状态码选择日志级别
    if (statusCode >= 500) {
      logger.error('详细请求完成（服务器错误）', responseLog);
    } else if (statusCode >= 400) {
      logger.warn('详细请求完成（客户端错误）', responseLog);
    } else {
      logger.info('详细请求完成', responseLog);
    }
    
    // 调用原始的end方法
    return originalEnd.call(this, chunk, encoding, callback);
  };
  
  next();
}

/**
 * 性能监控中间件
 */
export function performanceMonitor(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  const startMemory = process.memoryUsage();
  
  // 保存原始的end方法
  const originalEnd = res.end;
  
  // 重写end方法以记录性能数据
  res.end = function (chunk?: any, encoding?: any, callback?: any): any {
    const duration = Date.now() - startTime;
    const endMemory = process.memoryUsage();
    
    const memoryDiff = {
      rss: endMemory.rss - startMemory.rss,
      heapTotal: endMemory.heapTotal - startMemory.heapTotal,
      heapUsed: endMemory.heapUsed - startMemory.heapUsed,
      external: endMemory.external - startMemory.external,
    };
    
    // 记录性能数据
    logger.performanceLog(req.originalUrl, duration, {
      method: req.method,
      statusCode: res.statusCode,
      memoryDiff,
      userId: (req as any).user?.userId,
    });
    
    // 如果请求时间过长，记录警告
    if (duration > 1000) { // 超过1秒
      logger.warn('请求处理时间过长', {
        method: req.method,
        url: req.originalUrl,
        durationMs: duration,
        userId: (req as any).user?.userId,
      });
    }
    
    // 如果内存使用增加过多，记录警告
    if (memoryDiff.heapUsed > 10 * 1024 * 1024) { // 超过10MB
      logger.warn('请求内存使用增加过多', {
        method: req.method,
        url: req.originalUrl,
        memoryDiffMB: memoryDiff.heapUsed / (1024 * 1024),
        userId: (req as any).user?.userId,
      });
    }
    
    // 调用原始的end方法
    return originalEnd.call(this, chunk, encoding, callback);
  };
  
  next();
}

/**
 * 审计日志中间件（记录重要操作）
 */
export function auditLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  
  // 检查是否为重要操作
  const isImportantOperation = [
    'POST', 'PUT', 'PATCH', 'DELETE'
  ].includes(req.method) || req.originalUrl.includes('/admin/');
  
  if (!isImportantOperation) {
    next();
    return;
  }
  
  // 保存原始的end方法
  const originalEnd = res.end;
  
  // 重写end方法以记录审计日志
  res.end = function (chunk?: any, encoding?: any, callback?: any): any {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;
    
    // 记录审计日志
    logger.auditLog(
      `${req.method}_${req.originalUrl.replace(/\//g, '_')}`,
      (req as any).user?.userId,
      'api',
      req.originalUrl,
      {
        method: req.method,
        url: req.originalUrl,
        statusCode,
        durationMs: duration,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        requestBody: req.body,
        userId: (req as any).user?.userId,
      }
    );
    
    // 调用原始的end方法
    return originalEnd.call(this, chunk, encoding, callback);
  };
  
  next();
}

/**
 * 导出所有日志中间件
 */
export default {
  requestLogger,
  detailedRequestLogger,
  performanceMonitor,
  auditLogger,
};