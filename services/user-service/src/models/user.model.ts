/**
 * @file 用户数据模型
 * @description 用户数据访问层，处理数据库操作
 * @author StockAI开发团队
 * @created 2026-03-15
 */

import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { query, getTransactionClient, commitTransaction, rollbackTransaction } from '@/config/database';
import { setCache, getCache, deleteCache } from '@/config/redis';
import { logger } from '@/utils/logger';
import {
  UserModel,
  CreateUserDto,
  UpdateUserDto,
  UserResponseDto,
  UserRole,
  UserStatus,
  AuthType,
  TemplateType,
  UserPreferences,
  TemplatePreference,
  DisplayPreference,
  NotificationPreference,
  InvestmentPreference,
} from '@/models/user.types';
import { config } from '@/config/env';
import { ConflictError, NotFoundError, AuthenticationError, DatabaseError } from '@/middlewares/errorHandler';

/**
 * 用户模型类
 */
export class UserModelClass {
  private readonly CACHE_TTL = 300; // 5分钟缓存
  private readonly CACHE_PREFIX = 'user:';
  
  /**
   * 获取默认用户偏好
   */
  private getDefaultPreferences(): UserPreferences {
    return {
      templates: {
        stockInfo: {
          defaultTemplateId: 'stock_info_concise',
          customConfig: {},
        },
        analysis: {
          defaultTemplateId: 'analysis_technical',
          customConfig: {},
        },
        report: {
          defaultTemplateId: 'report_detailed',
          customConfig: {},
        },
      },
      display: {
        compactMode: false,
        showCharts: true,
        colorScheme: 'auto',
        fontSize: 'medium',
        language: 'zh-CN',
        timezone: 'Asia/Shanghai',
        dateFormat: 'YYYY-MM-DD',
        numberFormat: 'comma',
      },
      notifications: {
        priceAlerts: true,
        volumeAlerts: false,
        newsAlerts: true,
        reportAlerts: false,
        email: {
          enabled: true,
          frequency: 'immediate',
        },
        push: {
          enabled: true,
          frequency: 'daily',
        },
        sms: {
          enabled: false,
          frequency: 'weekly',
        },
      },
      investment: {
        riskTolerance: 'moderate',
        investmentHorizon: 'medium',
        sectors: [],
        regions: ['CN'],
        dividendPreference: false,
        growthPreference: true,
      },
      other: {},
    };
  }
  
  /**
   * 生成缓存键
   */
  private getCacheKey(userId: string): string {
    return `${this.CACHE_PREFIX}${userId}`;
  }
  
  /**
   * 密码哈希
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, config.security.bcryptSaltRounds);
  }
  
  /**
   * 验证密码
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
  
  /**
   * 创建用户
   */
  async create(userData: CreateUserDto): Promise<UserResponseDto> {
    const startTime = Date.now();
    const client = await getTransactionClient();
    
    try {
      // 检查用户名和邮箱是否已存在
      const existingUser = await this.findByUsernameOrEmail(userData.username, userData.email);
      if (existingUser) {
        throw new ConflictError(
          existingUser.username === userData.username 
            ? '用户名已存在' 
            : '邮箱已存在'
        );
      }
      
      // 生成用户ID
      const userId = randomUUID();
      
      // 哈希密码
      const passwordHash = await this.hashPassword(userData.password);
      
      // 获取默认偏好
      const defaultPreferences = this.getDefaultPreferences();
      
      // 合并用户提供的偏好
      const userPreferences: UserPreferences = {
        ...defaultPreferences,
        ...userData.preferences,
      };
      
      // 准备用户数据
      const now = new Date();
      const user: Omit<UserModel, 'id'> = {
        username: userData.username,
        email: userData.email,
        phone: userData.phone,
        passwordHash,
        authType: userData.authType || AuthType.EMAIL,
        emailVerified: false,
        phoneVerified: false,
        displayName: userData.displayName || userData.username,
        avatarUrl: '',
        bio: '',
        location: '',
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
        permissions: ['read:profile', 'write:profile'],
        preferences: userPreferences,
        lastLoginAt: null,
        lastLoginIp: '',
        failedLoginAttempts: 0,
        lockedUntil: null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
      
      // 插入用户
      await client.query(
        `INSERT INTO users (
          id, username, email, phone, password_hash, auth_type, 
          email_verified, phone_verified, display_name, avatar_url, 
          bio, location, role, status, permissions, preferences,
          last_login_at, last_login_ip, failed_login_attempts, locked_until,
          created_at, updated_at, deleted_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)`,
        [
          userId,
          user.username,
          user.email,
          user.phone,
          user.passwordHash,
          user.authType,
          user.emailVerified,
          user.phoneVerified,
          user.displayName,
          user.avatarUrl,
          user.bio,
          user.location,
          user.role,
          user.status,
          JSON.stringify(user.permissions),
          JSON.stringify(user.preferences),
          user.lastLoginAt,
          user.lastLoginIp,
          user.failedLoginAttempts,
          user.lockedUntil,
          user.createdAt,
          user.updatedAt,
          user.deletedAt,
        ]
      );
      
      // 提交事务
      await commitTransaction(client);
      
      // 记录审计日志
      logger.auditLog('user_create', userId, 'user', userId, {
        username: user.username,
        email: user.email,
      });
      
      // 性能日志
      logger.performanceLog('user_create', Date.now() - startTime, { userId });
      
      // 返回用户响应
      return this.toResponseDto({
        ...user,
        id: userId,
      });
      
    } catch (error) {
      await rollbackTransaction(client);
      throw error;
    }
  }
  
  /**
   * 根据ID查找用户
   */
  async findById(id: string, useCache = true): Promise<UserModel | null> {
    const cacheKey = this.getCacheKey(id);
    
    // 尝试从缓存获取
    if (useCache) {
      const cachedUser = await getCache<UserModel>(cacheKey);
      if (cachedUser) {
        logger.debug('从缓存获取用户', { userId: id });
        return cachedUser;
      }
    }
    
    // 从数据库查询
    const result = await query<UserModel>(
      `SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const user = result.rows[0];
    
    // 缓存用户数据
    if (useCache) {
      await setCache(cacheKey, user, this.CACHE_TTL);
    }
    
    return user;
  }
  
  /**
   * 根据用户名或邮箱查找用户
   */
  async findByUsernameOrEmail(username: string, email: string): Promise<UserModel | null> {
    const result = await query<UserModel>(
      `SELECT * FROM users WHERE (username = $1 OR email = $2) AND deleted_at IS NULL LIMIT 1`,
      [username, email]
    );
    
    return result.rows[0] || null;
  }
  
  /**
   * 根据邮箱查找用户
   */
  async findByEmail(email: string): Promise<UserModel | null> {
    const result = await query<UserModel>(
      `SELECT * FROM users WHERE email = $1 AND deleted_at IS NULL LIMIT 1`,
      [email]
    );
    
    return result.rows[0] || null;
  }
  
  /**
   * 根据用户名查找用户
   */
  async findByUsername(username: string): Promise<UserModel | null> {
    const result = await query<UserModel>(
      `SELECT * FROM users WHERE username = $1 AND deleted_at IS NULL LIMIT 1`,
      [username]
    );
    
    return result.rows[0] || null;
  }
  
  /**
   * 更新用户
   */
  async update(id: string, updateData: UpdateUserDto): Promise<UserResponseDto> {
    const startTime = Date.now();
    const client = await getTransactionClient();
    
    try {
      // 检查用户是否存在
      const existingUser = await this.findById(id, false);
      if (!existingUser) {
        throw new NotFoundError('用户不存在');
      }
      
      // 如果更新用户名或邮箱，检查是否冲突
      if (updateData.username || updateData.email) {
        const conflictUser = await this.findByUsernameOrEmail(
          updateData.username || existingUser.username,
          updateData.email || existingUser.email
        );
        
        if (conflictUser && conflictUser.id !== id) {
          throw new ConflictError(
            conflictUser.username === updateData.username 
              ? '用户名已存在' 
              : '邮箱已存在'
          );
        }
      }
      
      // 构建更新字段
      const updates: string[] = [];
      const values: any[] = [];
      let valueIndex = 1;
      
      // 基本字段更新
      if (updateData.username !== undefined) {
        updates.push(`username = $${valueIndex}`);
        values.push(updateData.username);
        valueIndex++;
      }
      
      if (updateData.email !== undefined) {
        updates.push(`email = $${valueIndex}`);
        values.push(updateData.email);
        valueIndex++;
      }
      
      if (updateData.phone !== undefined) {
        updates.push(`phone = $${valueIndex}`);
        values.push(updateData.phone);
        valueIndex++;
      }
      
      if (updateData.displayName !== undefined) {
        updates.push(`display_name = $${valueIndex}`);
        values.push(updateData.displayName);
        valueIndex++;
      }
      
      if (updateData.avatarUrl !== undefined) {
        updates.push(`avatar_url = $${valueIndex}`);
        values.push(updateData.avatarUrl);
        valueIndex++;
      }
      
      if (updateData.bio !== undefined) {
        updates.push(`bio = $${valueIndex}`);
        values.push(updateData.bio);
        valueIndex++;
      }
      
      if (updateData.location !== undefined) {
        updates.push(`location = $${valueIndex}`);
        values.push(updateData.location);
        valueIndex++;
      }
      
      // 偏好更新（用户核心需求）
      if (updateData.preferences !== undefined) {
        // 合并现有偏好和新偏好
        const currentPreferences = existingUser.preferences || this.getDefaultPreferences();
        const mergedPreferences = {
          ...currentPreferences,
          ...updateData.preferences,
        };
        
        updates.push(`preferences = $${valueIndex}`);
        values.push(JSON.stringify(mergedPreferences));
        valueIndex++;
      }
      
      // 更新时间
      updates.push(`updated_at = $${valueIndex}`);
      values.push(new Date());
      valueIndex++;
      
      // 添加用户ID
      values.push(id);
      
      // 执行更新
      const updateQuery = `
        UPDATE users 
        SET ${updates.join(', ')} 
        WHERE id = $${valueIndex} AND deleted_at IS NULL
        RETURNING *
      `;
      
      const result = await client.query<UserModel>(updateQuery, values);
      
      if (result.rows.length === 0) {
        throw new NotFoundError('用户不存在');
      }
      
      // 提交事务
      await commitTransaction(client);
      
      // 清除缓存
      await deleteCache(this.getCacheKey(id));
      
      // 记录审计日志
      logger.auditLog('user_update', id, 'user', id, {
        updatedFields: updates.map(update => update.split(' = ')[0]),
      });
      
      // 性能日志
      logger.performanceLog('user_update', Date.now() - startTime, { userId: id });
      
      // 返回更新后的用户
      return this.toResponseDto(result.rows[0]);
      
    } catch (error) {
      await rollbackTransaction(client);
      throw error;
    }
  }
  
  /**
   * 删除用户（软删除）
   */
  async delete(id: string): Promise<void> {
    const startTime = Date.now();
    
    try {
      // 检查用户是否存在
      const existingUser = await this.findById(id, false);
      if (!existingUser) {
        throw new NotFoundError('用户不存在');
      }
      
      // 执行软删除
      const result = await query(
        `UPDATE users SET deleted_at = $1, updated_at = $2 WHERE id = $3 AND deleted_at IS NULL`,
        [new Date(), new Date(), id]
      );
      
      if (result.rowCount === 0) {
        throw new NotFoundError('用户不存在');
      }
      
      // 清除缓存
      await deleteCache(this.getCacheKey(id));
      
      // 记录审计日志
      logger.auditLog('user_delete', id, 'user', id);
      
      // 性能日志
      logger.performanceLog('user_delete', Date.now() - startTime, { userId: id });
      
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * 验证用户凭据
   */
  async validateCredentials(
    identifier: string, 
    password: string
  ): Promise<UserModel | null> {
    const startTime = Date.now();
    
    try {
      // 查找用户（支持用户名、邮箱、手机号）
      const result = await query<UserModel>(
        `SELECT * FROM users 
         WHERE (username = $1 OR email = $1 OR phone = $1) 
         AND deleted_at IS NULL 
         AND status = 'active'
         LIMIT 1`,
        [identifier]
      );
      
      if (result.rows.length === 0) {
        logger.securityLog('invalid_login_attempt', 'low', { identifier });
        return null;
      }
      
      const user = result.rows[0];
      
      // 检查账户是否被锁定
      if (user.lockedUntil && user.lockedUntil > new Date()) {
        logger.securityLog('account_locked', 'medium', { userId: user.id });
        throw new AuthenticationError('账户已被锁定');
      }
      
      // 验证密码
      const isValid = await this.verifyPassword(password, user.passwordHash);
      
      // 更新登录尝试记录
      const client = await getTransactionClient();
      
      try {
        if (isValid) {
          // 重置失败尝试次数
          await client.query(
            `UPDATE users SET 
              failed_login_attempts = 0,
              last_login_at = $1,
              last_login_ip = 'N/A', -- 实际应由中间件填充
              updated_at = $1
             WHERE id = $2`,
            [new Date(), user.id]
          );
        } else {
          // 增加失败尝试次数
          const newAttempts = user.failedLoginAttempts + 1;
          let lockedUntil = null;
          
          // 如果失败次数超过5次，锁定账户15分钟
          if (newAttempts >= 5) {
            lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
            logger.securityLog('account_auto_locked', 'high', { userId: user.id });
          }
          
          await client.query(
            `UPDATE users SET 
              failed_login_attempts = $1,
              locked_until = $2,
              updated_at = $3
             WHERE id = $4`,
            [newAttempts, lockedUntil, new Date(), user.id]
          );
          
          logger.securityLog('login_failed', 'medium', { 
            userId: user.id, 
            attempts: newAttempts 
          });
        }
        
        await commitTransaction(client);
      } catch (error) {
        await rollbackTransaction(client);
        throw error;
      }
      
      // 清除缓存（因为用户数据已更新）
      await deleteCache(this.getCacheKey(user.id));
      
      // 性能日志
      logger.performanceLog('validate_credentials', Date.now() - startTime, { userId: user.id });
      
      return isValid ? user : null;
      
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * 更新用户模板偏好（用户核心需求）
   */
  async updateTemplatePreference(
    userId: string,
    type: TemplateType,
    templateId: string,
    customConfig?: Record<string, any>
  ): Promise<UserResponseDto> {
    const startTime = Date.now();
    
    try {
      // 获取当前用户
      const user = await this.findById(userId, false);
      if (!user) {
        throw new NotFoundError('用户不存在');
      }
      
      // 更新模板偏好
      const updatedPreferences: UserPreferences = {
        ...user.preferences,
        templates: {
          ...user.preferences.templates,
          [type]: {
            defaultTemplateId: templateId,
            customConfig: customConfig || user.preferences.templates[type]?.customConfig || {},
          },
        },
      };
      
      // 更新用户
      return await this.update(userId, {
        preferences: updatedPreferences,
      });
      
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * 将数据库模型转换为响应DTO
   */
  toResponseDto(user: UserModel): UserResponseDto {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      phone: user.phone,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      location: user.location,
      role: user.role,
      status: user.status,
      preferences: user.preferences,
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
  
  /**
   * 批量获取用户
   */
  async findByIds(ids: string[]): Promise<UserModel[]> {
    if (ids.length === 0) {
      return [];
    }
    
    const result = await query<UserModel>(
      `SELECT * FROM users WHERE id = ANY($1) AND deleted_at IS NULL`,
      [ids]
    );
    
    return result.rows;
  }
  
  /**
   * 分页查询用户
   */
  async findPaginated(
    page: number = 1,
    limit: number = 20,
    filters?: {
      role?: UserRole;
      status?: UserStatus;
      search?: string;
    }
  ): Promise<{
    users: UserModel[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const offset = (page - 1) * limit;
    const whereConditions: string[] = ['deleted_at IS NULL'];
    const values: any[] = [];
    let valueIndex = 1;
    
    // 应用过滤器
    if (filters?.role) {
      whereConditions.push(`role = $${valueIndex}`);
      values.push(filters.role);
      valueIndex++;
    }
    
    if (filters?.status) {
      whereConditions.push(`status = $${valueIndex}`);
      values.push(filters.status);
      valueIndex++;
    }
    
    if (filters?.search) {
      whereConditions.push(
        `(username ILIKE $${valueIndex} OR email ILIKE $${valueIndex} OR display_name ILIKE $${valueIndex})`
      );
      values.push(`%${filters.search}%`);
      valueIndex++;
    }
    
    // 构建WHERE子句
    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}` 
      : '';
    
    // 查询总数
    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM users ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].count, 10);
    
    // 查询数据
    const dataResult = await query<UserModel>(
      `SELECT * FROM users ${whereClause} 
       ORDER BY created_at DESC 
       LIMIT $${valueIndex} OFFSET $${valueIndex + 1}`,
      [...values, limit, offset]
    );
    
    return {
      users: dataResult.rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}

/**
 * 导出用户模型实例
 */
export const userModel = new UserModelClass();
export default userModel;