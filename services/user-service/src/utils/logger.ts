/**
 * @file 日志工具
 * @description 结构化日志记录，支持控制台和文件输出
 * @author StockAI开发团队
 * @created 2026-03-15
 */

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import { config } from '@/config/env';

/**
 * 日志级别
 */
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
  trace: 4,
};

/**
 * 日志级别颜色
 */
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  debug: 'blue',
  trace: 'magenta',
};

// 添加颜色支持
winston.addColors(colors);

/**
 * 日志格式
 */
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json(),
  winston.format((info) => {
    // 添加服务名称和进程ID
    info.service = config.service.name;
    info.pid = process.pid;
    info.env = config.server.env;
    
    // 处理错误对象
    if (info instanceof Error) {
      info.message = info.message;
      info.stack = info.stack;
    }
    
    return info;
  })()
);

/**
 * 控制台输出格式（开发环境）
 */
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'HH:mm:ss.SSS' }),
  winston.format.printf((info) => {
    const { timestamp, level, message, service, ...meta } = info;
    
    let logMessage = `[${timestamp}] [${service}] ${level}: ${message}`;
    
    // 添加元数据
    const metaString = JSON.stringify(meta, null, 2);
    if (metaString !== '{}') {
      logMessage += `\n${metaString}`;
    }
    
    return logMessage;
  })
);

/**
 * 创建日志目录
 */
const logDir = path.resolve(process.cwd(), config.logging.dir);
try {
  require('fs').mkdirSync(logDir, { recursive: true });
} catch (error) {
  console.error('创建日志目录失败:', error);
}

/**
 * 日志传输器
 */
const transports = [
  // 控制台输出（仅开发环境）
  ...(config.server.isDevelopment
    ? [
        new winston.transports.Console({
          level: config.service.logLevel,
          format: consoleFormat,
        }),
      ]
    : []),
  
  // 错误日志文件
  new DailyRotateFile({
    level: 'error',
    filename: path.join(logDir, 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: config.logging.fileMaxSize,
    maxFiles: config.logging.fileMaxFiles,
    format,
  }),
  
  // 所有日志文件
  new DailyRotateFile({
    level: config.service.logLevel,
    filename: path.join(logDir, 'combined-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: config.logging.fileMaxSize,
    maxFiles: config.logging.fileMaxFiles,
    format,
  }),
  
  // 审计日志（重要操作）
  new DailyRotateFile({
    level: 'info',
    filename: path.join(logDir, 'audit-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: config.logging.fileMaxSize,
    maxFiles: config.logging.fileMaxFiles,
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
  }),
];

/**
 * 创建日志记录器
 */
export const logger = winston.createLogger({
  level: config.service.logLevel,
  levels,
  format,
  transports,
  exitOnError: false,
});

/**
 * 日志流（用于Morgan等中间件）
 */
export const stream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};

/**
 * 审计日志函数
 */
export function auditLog(
  action: string,
  userId?: string,
  resourceType?: string,
  resourceId?: string,
  details?: any
): void {
  logger.info('审计日志', {
    type: 'audit',
    action,
    userId,
    resourceType,
    resourceId,
    details,
    timestamp: new Date().toISOString(),
    ip: 'N/A', // 将在中间件中填充
    userAgent: 'N/A', // 将在中间件中填充
  });
}

/**
 * 性能日志函数
 */
export function performanceLog(
  operation: string,
  durationMs: number,
  metadata?: any
): void {
  logger.debug('性能日志', {
    type: 'performance',
    operation,
    durationMs,
    metadata,
    timestamp: new Date().toISOString(),
  });
}

/**
 * 安全日志函数
 */
export function securityLog(
  event: string,
  level: 'low' | 'medium' | 'high',
  details?: any
): void {
  const logLevel = level === 'high' ? 'error' : level === 'medium' ? 'warn' : 'info';
  
  logger.log(logLevel, '安全日志', {
    type: 'security',
    event,
    level,
    details,
    timestamp: new Date().toISOString(),
  });
}

/**
 * 请求日志函数
 */
export function requestLog(
  method: string,
  url: string,
  statusCode: number,
  durationMs: number,
  userId?: string,
  metadata?: any
): void {
  logger.info('请求日志', {
    type: 'request',
    method,
    url,
    statusCode,
    durationMs,
    userId,
    metadata,
    timestamp: new Date().toISOString(),
  });
}

/**
 * 业务日志函数
 */
export function businessLog(
  event: string,
  data: any,
  userId?: string
): void {
  logger.info('业务日志', {
    type: 'business',
    event,
    data,
    userId,
    timestamp: new Date().toISOString(),
  });
}

/**
 * 导出日志工具
 */
export default {
  logger,
  stream,
  auditLog,
  performanceLog,
  securityLog,
  requestLog,
  businessLog,
};