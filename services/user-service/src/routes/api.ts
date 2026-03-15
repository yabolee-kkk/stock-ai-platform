/**
 * @file API路由
 * @description 用户服务API路由定义
 * @author StockAI开发团队
 * @created 2026-03-15
 */

import { Router } from 'express';
import { userController } from '@/controllers/user.controller';
import { authMiddleware } from '@/middlewares/auth.middleware';
import userValidators from '@/validators/user.validator';
import rateLimiters from '@/middlewares/rateLimiter';

/**
 * 创建API路由器
 */
export const apiRouter = Router();

/**
 * 公共路由（无需认证）
 */

// 用户注册
apiRouter.post(
  '/auth/register',
  rateLimiters.endpointRateLimiters.auth.register,
  userValidators.registerValidator,
  userController.register
);

// 用户登录
apiRouter.post(
  '/auth/login',
  rateLimiters.endpointRateLimiters.auth.login,
  userValidators.loginValidator,
  userController.login
);

// 刷新令牌
apiRouter.post(
  '/auth/refresh',
  userValidators.refreshTokenValidator,
  userController.refreshToken
);

// 健康检查
apiRouter.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'user-service',
    timestamp: new Date().toISOString(),
    version: '0.1.0',
  });
});

/**
 * 受保护路由（需要认证）
 */

// 获取当前用户信息
apiRouter.get(
  '/users/me',
  authMiddleware.authenticate,
  rateLimiters.userRateLimiter,
  userController.getCurrentUser
);

// 更新用户信息
apiRouter.put(
  '/users/me',
  authMiddleware.authenticate,
  rateLimiters.endpointRateLimiters.users.update,
  userValidators.updateUserValidator,
  userController.updateUser
);

// 用户注销
apiRouter.post(
  '/auth/logout',
  authMiddleware.authenticate,
  userController.logout
);

/**
 * 模板偏好路由（用户核心需求）
 */

// 获取用户模板偏好
apiRouter.get(
  '/users/me/templates',
  authMiddleware.authenticate,
  rateLimiters.endpointRateLimiters.templates.get,
  userController.getTemplatePreferences
);

// 更新用户模板偏好
apiRouter.put(
  '/users/me/templates',
  authMiddleware.authenticate,
  rateLimiters.endpointRateLimiters.templates.update,
  userValidators.updateTemplatePreferenceValidator,
  userController.updateTemplatePreference
);

/**
 * API密钥管理路由
 */

// 生成API密钥
apiRouter.post(
  '/users/me/api-keys',
  authMiddleware.authenticate,
  rateLimiters.endpointRateLimiters.apiKeys.generate,
  userValidators.generateApiKeyValidator,
  userController.generateApiKey
);

/**
 * 管理员路由（需要管理员权限）
 */

// 获取用户列表（管理员）
apiRouter.get(
  '/admin/users',
  authMiddleware.authenticate,
  authMiddleware.requireRole(['admin', 'super_admin']),
  rateLimiters.endpointRateLimiters.users.list,
  userValidators.paginationValidator,
  userController.getUsers
);

// 删除用户（管理员或用户自己）
apiRouter.delete(
  '/users/:id',
  authMiddleware.authenticate,
  authMiddleware.isOwnerOrAdmin('id'),
  rateLimiters.endpointRateLimiters.users.delete,
  userValidators.userIdParamValidator,
  userController.deleteUser
);

/**
 * API文档路由
 */

// API文档
apiRouter.get('/docs', (req, res) => {
  res.json({
    name: 'StockAI用户服务API',
    version: '0.1.0',
    description: '用户认证、管理和模板偏好API',
    endpoints: {
      public: {
        'POST /api/auth/register': '用户注册',
        'POST /api/auth/login': '用户登录',
        'POST /api/auth/refresh': '刷新令牌',
        'GET /api/health': '健康检查',
      },
      protected: {
        'GET /api/users/me': '获取当前用户信息',
        'PUT /api/users/me': '更新用户信息',
        'POST /api/auth/logout': '用户注销',
        'GET /api/users/me/templates': '获取模板偏好',
        'PUT /api/users/me/templates': '更新模板偏好',
        'POST /api/users/me/api-keys': '生成API密钥',
      },
      admin: {
        'GET /api/admin/users': '获取用户列表（管理员）',
        'DELETE /api/users/:id': '删除用户',
      },
    },
    authentication: {
      type: 'Bearer Token',
      header: 'Authorization: Bearer <token>',
    },
    rateLimiting: {
      note: '所有端点都有速率限制，请合理使用API',
    },
  });
});

/**
 * 导出路由器
 */
export default apiRouter;