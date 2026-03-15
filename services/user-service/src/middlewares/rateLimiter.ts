/**
 * @file 速率限制中间件
 * @description 限制API请求频率，防止滥用
 * @author StockAI开发团队
 * @created 2026-03-15
 */

import rateLimit from 'express-rate-limit';
import { RateLimitError } from '@/middlewares/errorHandler';
import { config } from '@/config/env';
import { logger } from '@/utils/logger';

/**
 * 创建速率限制器
 */
function createRateLimiter(options?: {
  windowMs?: number;
  max?: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
  keyGenerator?: (req: any) => string;
}) {
  const {
    windowMs = config.rateLimit.windowMs,
    max = config.rateLimit.maxRequests,
    message = '请求过于频繁，请稍后再试',
    skipSuccessfulRequests = config.rateLimit.skipSuccessfulRequests,
    keyGenerator = (req) => req.ip, // 默认使用IP地址
  } = options || {};
  
  return rateLimit({
    windowMs,
    max,
    message,
    skipSuccessfulRequests,
    keyGenerator,
    handler: (req, res) => {
      // 记录速率限制触发
      logger.securityLog('rate_limit_triggered', 'medium', {
        ip: req.ip,
        url: req.originalUrl,
        method: req.method,
        userId: (req as any).user?.userId,
        key: keyGenerator(req),
      });
      
      // 返回错误响应
      const error = new RateLimitError(message);
      res.status(error.statusCode).json({
        error: {
          code: error.code,
          message: error.message,
          timestamp: new Date().toISOString(),
          retryAfter: Math.ceil(windowMs / 1000),
        },
      });
    },
    standardHeaders: true, // 返回标准的速率限制头信息
    legacyHeaders: false, // 禁用旧的X-RateLimit-*头信息
  });
}

/**
 * 全局速率限制器（所有请求）
 */
export const globalRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100, // 每个IP最多100次请求
  message: '请求过于频繁，请15分钟后再试',
});

/**
 * 严格速率限制器（敏感操作）
 */
export const strictRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1小时
  max: 10, // 每个IP最多10次请求
  message: '操作过于频繁，请1小时后再试',
  skipSuccessfulRequests: false, // 即使成功也计数
});

/**
 * 认证相关速率限制器
 */
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 5, // 每个IP最多5次认证尝试
  message: '认证尝试过于频繁，请15分钟后再试',
  skipSuccessfulRequests: false, // 即使成功也计数
});

/**
 * API密钥速率限制器
 */
export const apiKeyRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1小时
  max: 1000, // 每个API密钥最多1000次请求
  message: 'API调用过于频繁，请1小时后再试',
  keyGenerator: (req) => {
    // 使用API密钥作为限制键
    const apiKey = req.headers['x-api-key'] as string;
    return apiKey || req.ip;
  },
});

/**
 * 用户特定速率限制器
 */
export const userRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1小时
  max: 500, // 每个用户最多500次请求
  message: '您的请求过于频繁，请1小时后再试',
  keyGenerator: (req) => {
    // 使用用户ID作为限制键
    const userId = (req as any).user?.userId;
    return userId || req.ip;
  },
});

/**
 * 动态速率限制器（根据用户角色）
 */
export function dynamicRateLimiter(req: any, res: any, next: any) {
  const user = req.user;
  
  // 根据用户角色设置不同的限制
  let limiter;
  
  if (!user) {
    // 未认证用户使用全局限制
    limiter = globalRateLimiter;
  } else if (user.role === 'admin' || user.role === 'super_admin') {
    // 管理员有更高的限制
    limiter = createRateLimiter({
      windowMs: 60 * 60 * 1000, // 1小时
      max: 5000, // 管理员最多5000次请求
      keyGenerator: (req) => req.user?.userId || req.ip,
    });
  } else if (user.role === 'premium') {
    // 高级用户有中等限制
    limiter = createRateLimiter({
      windowMs: 60 * 60 * 1000, // 1小时
      max: 1000, // 高级用户最多1000次请求
      keyGenerator: (req) => req.user?.userId || req.ip,
    });
  } else {
    // 普通用户使用用户限制
    limiter = userRateLimiter;
  }
  
  // 应用速率限制器
  limiter(req, res, next);
}

/**
 * 按端点分组速率限制器
 */
export const endpointRateLimiters = {
  // 认证端点
  auth: {
    login: authRateLimiter,
    register: createRateLimiter({
      windowMs: 24 * 60 * 60 * 1000, // 24小时
      max: 10, // 每个IP最多注册10次
      message: '注册过于频繁，请24小时后再试',
    }),
    forgotPassword: createRateLimiter({
      windowMs: 60 * 60 * 1000, // 1小时
      max: 3, // 每个IP最多3次忘记密码请求
      message: '密码重置请求过于频繁，请1小时后再试',
    }),
  },
  
  // 用户端点
  users: {
    update: userRateLimiter,
    delete: strictRateLimiter,
    list: globalRateLimiter,
  },
  
  // 模板端点（用户核心需求）
  templates: {
    update: userRateLimiter,
    get: globalRateLimiter,
  },
  
  // API密钥端点
  apiKeys: {
    generate: strictRateLimiter,
    list: userRateLimiter,
    delete: strictRateLimiter,
  },
};

/**
 * 获取端点速率限制器
 */
export function getEndpointRateLimiter(endpoint: string, action: string) {
  const group = endpointRateLimiters[endpoint as keyof typeof endpointRateLimiters];
  if (!group) {
    return globalRateLimiter;
  }
  
  const limiter = group[action as keyof typeof group];
  return limiter || globalRateLimiter;
}

/**
 * 速率限制状态检查
 */
export function checkRateLimitStatus(req: any, res: any, next: any) {
  // 这个函数可以用于检查当前速率限制状态
  // 在实际实现中，可能需要查询Redis中的计数器
  
  const key = req.ip;
  const userId = req.user?.userId;
  
  logger.debug('速率限制状态检查', {
    ip: req.ip,
    userId,
    url: req.originalUrl,
    method: req.method,
  });
  
  next();
}

/**
 * 导出所有速率限制器
 */
export default {
  globalRateLimiter,
  strictRateLimiter,
  authRateLimiter,
  apiKeyRateLimiter,
  userRateLimiter,
  dynamicRateLimiter,
  endpointRateLimiters,
  getEndpointRateLimiter,
  checkRateLimitStatus,
};