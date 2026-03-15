/**
 * @file 认证中间件
 * @description JWT令牌验证和用户认证中间件
 * @author StockAI开发团队
 * @created 2026-03-15
 */

import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { authService } from '@/services/auth.service';
import { logger } from '@/utils/logger';
import { AuthenticationError, AuthorizationError } from '@/middlewares/errorHandler';

/**
 * 扩展Express请求类型
 */
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        username: string;
        email: string;
        role: string;
        permissions: string[];
      };
    }
  }
}

/**
 * 认证中间件类
 */
export class AuthMiddleware {
  /**
   * 验证JWT令牌
   */
  authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // 获取令牌
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new AuthenticationError('未提供认证令牌');
      }
      
      const token = authHeader.substring(7); // 移除"Bearer "前缀
      
      // 验证令牌
      const verificationResult = await authService.verifyAccessToken(token);
      if (!verificationResult.valid || !verificationResult.payload) {
        throw new AuthenticationError(verificationResult.error || '令牌验证失败');
      }
      
      const { payload } = verificationResult;
      
      // 将用户信息添加到请求对象
      req.user = {
        userId: payload.userId,
        username: payload.username,
        email: payload.email,
        role: payload.role,
        permissions: [], // 在实际应用中，这里应该从数据库获取用户权限
      };
      
      // 记录请求日志
      logger.requestLog(req.method, req.originalUrl, StatusCodes.OK, 0, payload.userId, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });
      
      next();
      
    } catch (error) {
      logger.securityLog('authentication_failed', 'medium', {
        path: req.originalUrl,
        method: req.method,
        ip: req.ip,
        error: error instanceof Error ? error.message : String(error),
      });
      
      next(error);
    }
  };
  
  /**
   * 验证API密钥
   */
  authenticateApiKey = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // 获取API密钥
      const apiKey = req.headers['x-api-key'] as string;
      if (!apiKey) {
        throw new AuthenticationError('未提供API密钥');
      }
      
      // 验证API密钥
      const verificationResult = await authService.verifyApiKey(apiKey);
      if (!verificationResult.valid) {
        throw new AuthenticationError(verificationResult.error || 'API密钥验证失败');
      }
      
      // 将用户信息添加到请求对象
      req.user = {
        userId: verificationResult.userId || 'api-user',
        username: 'api-user',
        email: 'api@stockai.example.com',
        role: 'api',
        permissions: ['api:access'],
      };
      
      // 记录请求日志
      logger.requestLog(req.method, req.originalUrl, StatusCodes.OK, 0, verificationResult.userId, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        apiKeyId: verificationResult.keyId,
      });
      
      next();
      
    } catch (error) {
      logger.securityLog('api_key_authentication_failed', 'medium', {
        path: req.originalUrl,
        method: req.method,
        ip: req.ip,
        error: error instanceof Error ? error.message : String(error),
      });
      
      next(error);
    }
  };
  
  /**
   * 检查用户角色
   */
  requireRole = (requiredRole: string | string[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      try {
        if (!req.user) {
          throw new AuthenticationError('用户未认证');
        }
        
        const userRole = req.user.role;
        const requiredRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
        
        if (!requiredRoles.includes(userRole)) {
          throw new AuthorizationError(`需要角色: ${requiredRoles.join(', ')}`);
        }
        
        next();
        
      } catch (error) {
        logger.securityLog('role_check_failed', 'low', {
          userId: req.user?.userId,
          userRole: req.user?.role,
          requiredRole,
          path: req.originalUrl,
        });
        
        next(error);
      }
    };
  };
  
  /**
   * 检查用户权限
   */
  requirePermission = (requiredPermission: string | string[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      try {
        if (!req.user) {
          throw new AuthenticationError('用户未认证');
        }
        
        const userPermissions = req.user.permissions;
        const requiredPermissions = Array.isArray(requiredPermission) 
          ? requiredPermission 
          : [requiredPermission];
        
        const hasPermission = requiredPermissions.every(permission => 
          userPermissions.includes(permission)
        );
        
        if (!hasPermission) {
          throw new AuthorizationError(`需要权限: ${requiredPermissions.join(', ')}`);
        }
        
        next();
        
      } catch (error) {
        logger.securityLog('permission_check_failed', 'low', {
          userId: req.user?.userId,
          userPermissions: req.user?.permissions,
          requiredPermission,
          path: req.originalUrl,
        });
        
        next(error);
      }
    };
  };
  
  /**
   * 可选认证（不强制要求认证）
   */
  optionalAuthenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // 获取令牌
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        // 没有令牌，继续处理（用户可能未登录）
        next();
        return;
      }
      
      const token = authHeader.substring(7);
      
      // 验证令牌
      const verificationResult = await authService.verifyAccessToken(token);
      if (!verificationResult.valid || !verificationResult.payload) {
        // 令牌无效，继续处理（用户可能未登录）
        next();
        return;
      }
      
      const { payload } = verificationResult;
      
      // 将用户信息添加到请求对象
      req.user = {
        userId: payload.userId,
        username: payload.username,
        email: payload.email,
        role: payload.role,
        permissions: [],
      };
      
      next();
      
    } catch (error) {
      // 认证失败，但不阻止请求继续处理
      logger.debug('可选认证失败', {
        path: req.originalUrl,
        error: error instanceof Error ? error.message : String(error),
      });
      
      next();
    }
  };
  
  /**
   * 检查用户是否为资源所有者或管理员
   */
  isOwnerOrAdmin = (resourceOwnerIdField = 'userId') => {
    return (req: Request, res: Response, next: NextFunction): void => {
      try {
        if (!req.user) {
          throw new AuthenticationError('用户未认证');
        }
        
        const currentUserId = req.user.userId;
        const currentUserRole = req.user.role;
        const resourceOwnerId = (req.params as any)[resourceOwnerIdField] || req.body[resourceOwnerIdField];
        
        // 如果是管理员，允许访问
        if (currentUserRole === 'admin' || currentUserRole === 'super_admin') {
          next();
          return;
        }
        
        // 检查是否为资源所有者
        if (currentUserId === resourceOwnerId) {
          next();
          return;
        }
        
        throw new AuthorizationError('只能访问自己的资源');
        
      } catch (error) {
        logger.securityLog('owner_check_failed', 'medium', {
          userId: req.user?.userId,
          userRole: req.user?.role,
          resourceOwnerIdField,
          path: req.originalUrl,
        });
        
        next(error);
      }
    };
  };
  
  /**
   * 速率限制中间件（包装器）
   */
  rateLimit = (options?: {
    windowMs?: number;
    maxRequests?: number;
    skipSuccessfulRequests?: boolean;
  }) => {
    // 在实际应用中，这里会集成express-rate-limit
    // 为了简化，我们只记录日志
    return (req: Request, res: Response, next: NextFunction): void => {
      // 记录速率限制检查
      logger.debug('速率限制检查', {
        path: req.originalUrl,
        method: req.method,
        ip: req.ip,
        userId: req.user?.userId,
      });
      
      next();
    };
  };
}

/**
 * 导出认证中间件实例
 */
export const authMiddleware = new AuthMiddleware();
export default authMiddleware;