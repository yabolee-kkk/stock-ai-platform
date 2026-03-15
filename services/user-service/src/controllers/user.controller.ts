/**
 * @file 用户控制器
 * @description 处理用户相关的HTTP请求
 * @author StockAI开发团队
 * @created 2026-03-15
 */

import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { validationResult } from 'express-validator';
import { userModel } from '@/models/user.model';
import { authService } from '@/services/auth.service';
import { logger } from '@/utils/logger';
import { asyncErrorHandler } from '@/middlewares/errorHandler';
import {
  CreateUserDto,
  UpdateUserDto,
  LoginRequestDto,
  RefreshTokenRequestDto,
  UpdateTemplatePreferenceDto,
  TemplateType,
} from '@/models/user.types';

/**
 * 用户控制器类
 */
export class UserController {
  /**
   * 用户注册
   */
  register = asyncErrorHandler(async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    
    try {
      // 验证请求数据
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        logger.warn('注册请求验证失败', { errors: errors.array() });
        res.status(StatusCodes.BAD_REQUEST).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: '请求参数验证失败',
            details: errors.array(),
          },
        });
        return;
      }
      
      const userData: CreateUserDto = req.body;
      
      // 创建用户
      const user = await userModel.create(userData);
      
      // 生成令牌
      const tokens = await authService.login({
        username: userData.username,
        password: userData.password,
      });
      
      // 记录审计日志
      logger.auditLog('user_registered', user.id, 'user', user.id, {
        username: user.username,
        email: user.email,
      });
      
      // 性能日志
      logger.performanceLog('user_register', Date.now() - startTime, { userId: user.id });
      
      // 返回响应
      res.status(StatusCodes.CREATED).json({
        success: true,
        data: {
          user,
          tokens,
        },
        message: '用户注册成功',
      });
      
    } catch (error) {
      logger.error('用户注册失败', { error });
      throw error;
    }
  });
  
  /**
   * 用户登录
   */
  login = asyncErrorHandler(async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    
    try {
      // 验证请求数据
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        logger.warn('登录请求验证失败', { errors: errors.array() });
        res.status(StatusCodes.BAD_REQUEST).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: '请求参数验证失败',
            details: errors.array(),
          },
        });
        return;
      }
      
      const loginData: LoginRequestDto = req.body;
      const ipAddress = req.ip;
      
      // 用户登录
      const result = await authService.login(loginData, ipAddress);
      
      // 记录审计日志
      logger.auditLog('user_logged_in', result.user.id, 'auth', result.user.id, {
        ipAddress,
      });
      
      // 性能日志
      logger.performanceLog('user_login', Date.now() - startTime, { userId: result.user.id });
      
      // 返回响应
      res.status(StatusCodes.OK).json({
        success: true,
        data: result,
        message: '登录成功',
      });
      
    } catch (error) {
      logger.error('用户登录失败', { error });
      throw error;
    }
  });
  
  /**
   * 获取当前用户信息
   */
  getCurrentUser = asyncErrorHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      // 从认证中间件获取用户ID
      const userId = (req as any).user?.userId;
      if (!userId) {
        res.status(StatusCodes.UNAUTHORIZED).json({
          error: {
            code: 'UNAUTHORIZED',
            message: '用户未认证',
          },
        });
        return;
      }
      
      // 获取用户信息
      const user = await userModel.findById(userId);
      if (!user) {
        res.status(StatusCodes.NOT_FOUND).json({
          error: {
            code: 'USER_NOT_FOUND',
            message: '用户不存在',
          },
        });
        return;
      }
      
      // 返回响应
      res.status(StatusCodes.OK).json({
        success: true,
        data: userModel.toResponseDto(user),
        message: '获取用户信息成功',
      });
      
    } catch (error) {
      logger.error('获取用户信息失败', { error });
      throw error;
    }
  });
  
  /**
   * 更新用户信息
   */
  updateUser = asyncErrorHandler(async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    
    try {
      // 从认证中间件获取用户ID
      const userId = (req as any).user?.userId;
      if (!userId) {
        res.status(StatusCodes.UNAUTHORIZED).json({
          error: {
            code: 'UNAUTHORIZED',
            message: '用户未认证',
          },
        });
        return;
      }
      
      // 验证请求数据
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        logger.warn('更新用户请求验证失败', { errors: errors.array() });
        res.status(StatusCodes.BAD_REQUEST).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: '请求参数验证失败',
            details: errors.array(),
          },
        });
        return;
      }
      
      const updateData: UpdateUserDto = req.body;
      
      // 更新用户信息
      const updatedUser = await userModel.update(userId, updateData);
      
      // 记录审计日志
      logger.auditLog('user_updated', userId, 'user', userId, {
        updatedFields: Object.keys(updateData),
      });
      
      // 性能日志
      logger.performanceLog('user_update', Date.now() - startTime, { userId });
      
      // 返回响应
      res.status(StatusCodes.OK).json({
        success: true,
        data: updatedUser,
        message: '用户信息更新成功',
      });
      
    } catch (error) {
      logger.error('更新用户信息失败', { error });
      throw error;
    }
  });
  
  /**
   * 用户注销
   */
  logout = asyncErrorHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      // 从认证中间件获取用户ID
      const userId = (req as any).user?.userId;
      const accessToken = req.headers.authorization?.replace('Bearer ', '');
      
      if (!userId) {
        res.status(StatusCodes.UNAUTHORIZED).json({
          error: {
            code: 'UNAUTHORIZED',
            message: '用户未认证',
          },
        });
        return;
      }
      
      // 用户注销
      await authService.logout(userId, accessToken);
      
      // 记录审计日志
      logger.auditLog('user_logged_out', userId, 'auth', userId);
      
      // 返回响应
      res.status(StatusCodes.OK).json({
        success: true,
        message: '注销成功',
      });
      
    } catch (error) {
      logger.error('用户注销失败', { error });
      throw error;
    }
  });
  
  /**
   * 刷新访问令牌
   */
  refreshToken = asyncErrorHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      // 验证请求数据
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        logger.warn('刷新令牌请求验证失败', { errors: errors.array() });
        res.status(StatusCodes.BAD_REQUEST).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: '请求参数验证失败',
            details: errors.array(),
          },
        });
        return;
      }
      
      const refreshData: RefreshTokenRequestDto = req.body;
      
      // 刷新访问令牌
      const result = await authService.refreshAccessToken(refreshData.refreshToken);
      
      // 记录审计日志
      logger.auditLog('token_refreshed', result.user.id, 'auth', result.user.id);
      
      // 返回响应
      res.status(StatusCodes.OK).json({
        success: true,
        data: result,
        message: '令牌刷新成功',
      });
      
    } catch (error) {
      logger.error('刷新令牌失败', { error });
      throw error;
    }
  });
  
  /**
   * 更新用户模板偏好（用户核心需求）
   */
  updateTemplatePreference = asyncErrorHandler(async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    
    try {
      // 从认证中间件获取用户ID
      const userId = (req as any).user?.userId;
      if (!userId) {
        res.status(StatusCodes.UNAUTHORIZED).json({
          error: {
            code: 'UNAUTHORIZED',
            message: '用户未认证',
          },
        });
        return;
      }
      
      // 验证请求数据
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        logger.warn('更新模板偏好请求验证失败', { errors: errors.array() });
        res.status(StatusCodes.BAD_REQUEST).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: '请求参数验证失败',
            details: errors.array(),
          },
        });
        return;
      }
      
      const preferenceData: UpdateTemplatePreferenceDto = req.body;
      
      // 验证模板类型
      if (!Object.values(TemplateType).includes(preferenceData.type)) {
        res.status(StatusCodes.BAD_REQUEST).json({
          error: {
            code: 'INVALID_TEMPLATE_TYPE',
            message: '无效的模板类型',
            details: {
              validTypes: Object.values(TemplateType),
            },
          },
        });
        return;
      }
      
      // 更新模板偏好
      const updatedUser = await userModel.updateTemplatePreference(
        userId,
        preferenceData.type,
        preferenceData.templateId,
        preferenceData.customConfig
      );
      
      // 记录审计日志
      logger.auditLog('template_preference_updated', userId, 'user', userId, {
        templateType: preferenceData.type,
        templateId: preferenceData.templateId,
      });
      
      // 性能日志
      logger.performanceLog('template_preference_update', Date.now() - startTime, { userId });
      
      // 返回响应
      res.status(StatusCodes.OK).json({
        success: true,
        data: {
          user: updatedUser,
          updatedPreference: {
            type: preferenceData.type,
            templateId: preferenceData.templateId,
            customConfig: preferenceData.customConfig,
          },
        },
        message: '模板偏好更新成功',
      });
      
    } catch (error) {
      logger.error('更新模板偏好失败', { error });
      throw error;
    }
  });
  
  /**
   * 获取用户模板偏好（用户核心需求）
   */
  getTemplatePreferences = asyncErrorHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      // 从认证中间件获取用户ID
      const userId = (req as any).user?.userId;
      if (!userId) {
        res.status(StatusCodes.UNAUTHORIZED).json({
          error: {
            code: 'UNAUTHORIZED',
            message: '用户未认证',
          },
        });
        return;
      }
      
      // 获取用户信息
      const user = await userModel.findById(userId);
      if (!user) {
        res.status(StatusCodes.NOT_FOUND).json({
          error: {
            code: 'USER_NOT_FOUND',
            message: '用户不存在',
          },
        });
        return;
      }
      
      // 返回模板偏好
      res.status(StatusCodes.OK).json({
        success: true,
        data: {
          templates: user.preferences.templates,
        },
        message: '获取模板偏好成功',
      });
      
    } catch (error) {
      logger.error('获取模板偏好失败', { error });
      throw error;
    }
  });
  
  /**
   * 生成API密钥
   */
  generateApiKey = asyncErrorHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      // 从认证中间件获取用户ID
      const userId = (req as any).user?.userId;
      if (!userId) {
        res.status(StatusCodes.UNAUTHORIZED).json({
          error: {
            code: 'UNAUTHORIZED',
            message: '用户未认证',
          },
        });
        return;
      }
      
      const { name } = req.body;
      
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        res.status(StatusCodes.BAD_REQUEST).json({
          error: {
            code: 'INVALID_API_KEY_NAME',
            message: 'API密钥名称不能为空',
          },
        });
        return;
      }
      
      // 生成API密钥
      const apiKey = await authService.generateApiKey(userId, name.trim());
      
      // 记录审计日志
      logger.auditLog('api_key_generated', userId, 'auth', apiKey.id, { name });
      
      // 返回响应（API密钥只显示一次）
      res.status(StatusCodes.CREATED).json({
        success: true,
        data: apiKey,
        message: 'API密钥生成成功，请妥善保存',
        warning: '此API密钥只会显示一次，请立即保存',
      });
      
    } catch (error) {
      logger.error('生成API密钥失败', { error });
      throw error;
    }
  });
  
  /**
   * 删除用户（仅管理员）
   */
  deleteUser = asyncErrorHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      // 从认证中间件获取用户ID和角色
      const currentUserId = (req as any).user?.userId;
      const currentUserRole = (req as any).user?.role;
      
      if (!currentUserId) {
        res.status(StatusCodes.UNAUTHORIZED).json({
          error: {
            code: 'UNAUTHORIZED',
            message: '用户未认证',
          },
        });
        return;
      }
      
      const targetUserId = req.params.id;
      
      // 检查权限：用户只能删除自己，管理员可以删除任何用户
      if (targetUserId !== currentUserId && currentUserRole !== 'admin' && currentUserRole !== 'super_admin') {
        res.status(StatusCodes.FORBIDDEN).json({
          error: {
            code: 'FORBIDDEN',
            message: '权限不足',
          },
        });
        return;
      }
      
      // 删除用户
      await userModel.delete(targetUserId);
      
      // 记录审计日志
      logger.auditLog('user_deleted', currentUserId, 'user', targetUserId);
      
      // 返回响应
      res.status(StatusCodes.OK).json({
        success: true,
        message: '用户删除成功',
      });
      
    } catch (error) {
      logger.error('删除用户失败', { error });
      throw error;
    }
  });
  
  /**
   * 获取用户列表（仅管理员）
   */
  getUsers = asyncErrorHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      // 从认证中间件获取用户角色
      const currentUserRole = (req as any).user?.role;
      
      if (currentUserRole !== 'admin' && currentUserRole !== 'super_admin') {
        res.status(StatusCodes.FORBIDDEN).json({
          error: {
            code: 'FORBIDDEN',
            message: '权限不足',
          },
        });
        return;
      }
      
      // 解析查询参数
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const role = req.query.role as string;
      const status = req.query.status as string;
      const search = req.query.search as string;
      
      // 分页查询用户
      const result = await userModel.findPaginated(page, limit, {
        role: role as any,
        status: status as any,
        search,
      });
      
      // 返回响应
      res.status(StatusCodes.OK).json({
        success: true,
        data: {
          users: result.users.map(user => userModel.toResponseDto(user)),
          pagination: {
            page: result.page,
            limit: result.limit,
            total: result.total,
            totalPages: result.totalPages,
          },
        },
        message: '获取用户列表成功',
      });
      
    } catch (error) {
      logger.error('获取用户列表失败', { error });
      throw error;
    }
  });
}

/**
 * 导出用户控制器实例
 */
export const userController = new UserController();
export default userController;