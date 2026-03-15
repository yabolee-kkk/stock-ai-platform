/**
 * @file 用户模型测试
 * @description 用户数据模型单元测试
 * @author StockAI开发团队
 * @created 2026-03-15
 */

import { Pool } from 'pg';
import bcrypt from 'bcrypt';
import { createClient } from 'redis';
import { userModel } from '@/models/user.model';
import { 
  CreateUserDto, 
  UpdateUserDto,
  TemplateType,
  AuthType,
  UserRole,
  UserStatus,
} from '@/models/user.types';
import { ConflictError, NotFoundError, AuthenticationError } from '@/middlewares/errorHandler';

// 模拟数据
const mockUserData: CreateUserDto = {
  username: 'testuser',
  email: 'test@example.com',
  password: 'TestPass123!',
  displayName: 'Test User',
};

const mockUserResponse = {
  id: 'mock-uuid-1234-5678-9012',
  username: 'testuser',
  email: 'test@example.com',
  phone: undefined,
  displayName: 'Test User',
  avatarUrl: '',
  bio: '',
  location: '',
  role: UserRole.USER,
  status: UserStatus.ACTIVE,
  preferences: expect.any(Object),
  emailVerified: false,
  phoneVerified: false,
  createdAt: expect.any(Date),
  updatedAt: expect.any(Date),
};

describe('用户模型测试', () => {
  let mockPool: any;
  let mockRedisClient: any;
  
  beforeEach(() => {
    // 获取模拟的Pool和Redis客户端
    mockPool = new (Pool as jest.MockedClass<typeof Pool>)();
    mockRedisClient = createClient() as any;
    
    // 清除之前的模拟调用
    jest.clearAllMocks();
  });
  
  describe('create - 创建用户', () => {
    test('应该成功创建用户', async () => {
      // 模拟数据库查询 - 没有重复用户
      mockPool.connect.mockResolvedValue({
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // 检查重复用户
          .mockResolvedValueOnce({ rows: [] }) // 创建扩展
          .mockResolvedValueOnce({ 
            rows: [{
              id: 'mock-uuid-1234-5678-9012',
              username: 'testuser',
              email: 'test@example.com',
              // ... 其他字段
            }] 
          }), // 插入用户
        release: jest.fn(),
      });
      
      const result = await userModel.create(mockUserData);
      
      // 验证结果
      expect(result).toEqual(expect.objectContaining({
        id: 'mock-uuid-1234-5678-9012',
        username: 'testuser',
        email: 'test@example.com',
        displayName: 'Test User',
      }));
      
      // 验证bcrypt被调用
      expect(bcrypt.hash).toHaveBeenCalledWith(
        'TestPass123!',
        expect.any(Number)
      );
    });
    
    test('当用户名已存在时应抛出冲突错误', async () => {
      // 模拟数据库查询 - 存在重复用户
      mockPool.connect.mockResolvedValue({
        query: jest.fn().mockResolvedValue({ 
          rows: [{ username: 'testuser' }] 
        }),
        release: jest.fn(),
      });
      
      await expect(userModel.create(mockUserData))
        .rejects
        .toThrow(ConflictError);
      
      await expect(userModel.create(mockUserData))
        .rejects
        .toThrow('用户名已存在');
    });
    
    test('当邮箱已存在时应抛出冲突错误', async () => {
      // 模拟数据库查询 - 存在重复邮箱
      mockPool.connect.mockResolvedValue({
        query: jest.fn().mockResolvedValue({ 
          rows: [{ email: 'test@example.com' }] 
        }),
        release: jest.fn(),
      });
      
      await expect(userModel.create(mockUserData))
        .rejects
        .toThrow(ConflictError);
      
      await expect(userModel.create(mockUserData))
        .rejects
        .toThrow('邮箱已存在');
    });
  });
  
  describe('findById - 根据ID查找用户', () => {
    test('应该返回用户数据', async () => {
      const mockUser = {
        id: 'test-id',
        username: 'testuser',
        email: 'test@example.com',
        // ... 其他字段
      };
      
      // 模拟数据库查询
      mockPool.query.mockResolvedValue({ rows: [mockUser] });
      
      const result = await userModel.findById('test-id');
      
      expect(result).toEqual(mockUser);
      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL',
        ['test-id']
      );
    });
    
    test('当用户不存在时应返回null', async () => {
      // 模拟数据库查询 - 没有结果
      mockPool.query.mockResolvedValue({ rows: [] });
      
      const result = await userModel.findById('non-existent-id');
      
      expect(result).toBeNull();
    });
    
    test('应该使用缓存', async () => {
      const mockUser = {
        id: 'cached-user-id',
        username: 'cacheduser',
        email: 'cached@example.com',
      };
      
      // 模拟Redis缓存
      mockRedisClient.get.mockResolvedValue(JSON.stringify(mockUser));
      
      const result = await userModel.findById('cached-user-id', true);
      
      expect(result).toEqual(mockUser);
      // 应该从缓存获取，而不是查询数据库
      expect(mockPool.query).not.toHaveBeenCalled();
    });
  });
  
  describe('update - 更新用户', () => {
    const updateData: UpdateUserDto = {
      displayName: 'Updated Name',
      bio: 'Updated bio',
    };
    
    test('应该成功更新用户信息', async () => {
      // 模拟现有用户
      const existingUser = {
        id: 'test-id',
        username: 'testuser',
        email: 'test@example.com',
        preferences: userModel['getDefaultPreferences'](),
      };
      
      // 模拟数据库查询 - 用户存在且没有冲突
      mockPool.connect.mockResolvedValue({
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // 检查冲突
          .mockResolvedValueOnce({ rows: [existingUser] }) // 查找用户
          .mockResolvedValueOnce({ 
            rows: [{ ...existingUser, ...updateData }] 
          }), // 更新用户
        release: jest.fn(),
      });
      
      const result = await userModel.update('test-id', updateData);
      
      expect(result).toEqual(expect.objectContaining({
        id: 'test-id',
        displayName: 'Updated Name',
        bio: 'Updated bio',
      }));
      
      // 验证缓存被清除
      expect(mockRedisClient.del).toHaveBeenCalled();
    });
    
    test('当用户不存在时应抛出错误', async () => {
      // 模拟数据库查询 - 用户不存在
      mockPool.connect.mockResolvedValue({
        query: jest.fn().mockResolvedValue({ rows: [] }),
        release: jest.fn(),
      });
      
      await expect(userModel.update('non-existent-id', updateData))
        .rejects
        .toThrow(NotFoundError);
      
      await expect(userModel.update('non-existent-id', updateData))
        .rejects
        .toThrow('用户不存在');
    });
  });
  
  describe('validateCredentials - 验证用户凭据', () => {
    const mockUser = {
      id: 'test-id',
      username: 'testuser',
      email: 'test@example.com',
      passwordHash: '$2b$10$mockhash',
      status: UserStatus.ACTIVE,
      lockedUntil: null,
      failedLoginAttempts: 0,
    };
    
    test('应该验证成功', async () => {
      // 模拟数据库查询 - 用户存在
      mockPool.connect.mockResolvedValue({
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [mockUser] }) // 查找用户
          .mockResolvedValueOnce({ rows: [] }), // 更新登录信息
        release: jest.fn(),
      });
      
      const result = await userModel.validateCredentials('testuser', 'TestPass123!');
      
      expect(result).toEqual(mockUser);
      expect(bcrypt.compare).toHaveBeenCalledWith(
        'TestPass123!',
        '$2b$10$mockhash'
      );
    });
    
    test('当密码错误时应返回null', async () => {
      // 模拟密码比较失败
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      
      // 模拟数据库查询
      mockPool.connect.mockResolvedValue({
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [mockUser] })
          .mockResolvedValueOnce({ rows: [] }),
        release: jest.fn(),
      });
      
      const result = await userModel.validateCredentials('testuser', 'WrongPass!');
      
      expect(result).toBeNull();
      expect(bcrypt.compare).toHaveBeenCalledWith(
        'WrongPass!',
        '$2b$10$mockhash'
      );
    });
    
    test('当用户不存在时应返回null', async () => {
      // 模拟数据库查询 - 没有用户
      mockPool.connect.mockResolvedValue({
        query: jest.fn().mockResolvedValue({ rows: [] }),
        release: jest.fn(),
      });
      
      const result = await userModel.validateCredentials('nonexistent', 'TestPass123!');
      
      expect(result).toBeNull();
    });
    
    test('当账户被锁定时应抛出错误', async () => {
      const lockedUser = {
        ...mockUser,
        lockedUntil: new Date(Date.now() + 100000), // 未来时间
      };
      
      // 模拟数据库查询
      mockPool.connect.mockResolvedValue({
        query: jest.fn().mockResolvedValue({ rows: [lockedUser] }),
        release: jest.fn(),
      });
      
      await expect(userModel.validateCredentials('testuser', 'TestPass123!'))
        .rejects
        .toThrow(AuthenticationError);
      
      await expect(userModel.validateCredentials('testuser', 'TestPass123!'))
        .rejects
        .toThrow('账户已被锁定');
    });
  });
  
  describe('updateTemplatePreference - 更新模板偏好', () => {
    test('应该成功更新模板偏好', async () => {
      const existingUser = {
        id: 'test-id',
        username: 'testuser',
        email: 'test@example.com',
        preferences: userModel['getDefaultPreferences'](),
      };
      
      // 模拟更新
      const mockUpdate = jest.spyOn(userModel, 'update').mockResolvedValue({
        ...mockUserResponse,
        id: 'test-id',
        preferences: {
          ...existingUser.preferences,
          templates: {
            ...existingUser.preferences.templates,
            stockInfo: {
              defaultTemplateId: 'new-template-id',
              customConfig: { theme: 'dark' },
            },
          },
        },
      } as any);
      
      const result = await userModel.updateTemplatePreference(
        'test-id',
        TemplateType.STOCK_INFO,
        'new-template-id',
        { theme: 'dark' }
      );
      
      expect(result.preferences.templates.stockInfo).toEqual({
        defaultTemplateId: 'new-template-id',
        customConfig: { theme: 'dark' },
      });
      
      expect(mockUpdate).toHaveBeenCalledWith('test-id', {
        preferences: expect.objectContaining({
          templates: expect.objectContaining({
            stockInfo: expect.objectContaining({
              defaultTemplateId: 'new-template-id',
              customConfig: { theme: 'dark' },
            }),
          }),
        }),
      });
      
      mockUpdate.mockRestore();
    });
  });
  
  describe('delete - 删除用户', () => {
    test('应该成功删除用户', async () => {
      // 模拟用户存在
      mockPool.connect.mockResolvedValue({
        query: jest.fn().mockResolvedValue({ rows: [{}] }),
        release: jest.fn(),
      });
      
      // 模拟软删除
      mockPool.query.mockResolvedValue({ rowCount: 1 });
      
      await expect(userModel.delete('test-id')).resolves.not.toThrow();
      
      expect(mockPool.query).toHaveBeenCalledWith(
        'UPDATE users SET deleted_at = $1, updated_at = $2 WHERE id = $3 AND deleted_at IS NULL',
        [expect.any(Date), expect.any(Date), 'test-id']
      );
      
      // 验证缓存被清除
      expect(mockRedisClient.del).toHaveBeenCalled();
    });
    
    test('当用户不存在时应抛出错误', async () => {
      // 模拟用户不存在
      mockPool.connect.mockResolvedValue({
        query: jest.fn().mockResolvedValue({ rows: [] }),
        release: jest.fn(),
      });
      
      // 模拟软删除 - 没有影响的行
      mockPool.query.mockResolvedValue({ rowCount: 0 });
      
      await expect(userModel.delete('non-existent-id'))
        .rejects
        .toThrow(NotFoundError);
      
      await expect(userModel.delete('non-existent-id'))
        .rejects
        .toThrow('用户不存在');
    });
  });
  
  describe('辅助方法', () => {
    test('getDefaultPreferences - 应该返回默认偏好', () => {
      const defaultPrefs = userModel['getDefaultPreferences']();
      
      expect(defaultPrefs).toHaveProperty('templates');
      expect(defaultPrefs).toHaveProperty('display');
      expect(defaultPrefs).toHaveProperty('notifications');
      expect(defaultPrefs).toHaveProperty('investment');
      expect(defaultPrefs).toHaveProperty('other');
      
      // 验证模板偏好结构
      expect(defaultPrefs.templates).toHaveProperty('stockInfo');
      expect(defaultPrefs.templates).toHaveProperty('analysis');
      expect(defaultPrefs.templates).toHaveProperty('report');
      
      // 验证默认模板ID
      expect(defaultPrefs.templates.stockInfo.defaultTemplateId).toBe('stock_info_concise');
      expect(defaultPrefs.templates.analysis.defaultTemplateId).toBe('analysis_technical');
      expect(defaultPrefs.templates.report.defaultTemplateId).toBe('report_detailed');
    });
    
    test('toResponseDto - 应该正确转换用户模型为响应DTO', () => {
      const userModelInstance = {
        id: 'test-id',
        username: 'testuser',
        email: 'test@example.com',
        phone: undefined,
        passwordHash: 'hash',
        authType: AuthType.EMAIL,
        emailVerified: false,
        phoneVerified: false,
        displayName: 'Test User',
        avatarUrl: '',
        bio: '',
        location: '',
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
        permissions: ['read:profile'],
        preferences: userModel['getDefaultPreferences'](),
        lastLoginAt: null,
        lastLoginIp: '',
        failedLoginAttempts: 0,
        lockedUntil: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };
      
      const response = userModel.toResponseDto(userModelInstance as any);
      
      expect(response).toEqual({
        id: 'test-id',
        username: 'testuser',
        email: 'test@example.com',
        phone: undefined,
        displayName: 'Test User',
        avatarUrl: '',
        bio: '',
        location: '',
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
        preferences: userModelInstance.preferences,
        emailVerified: false,
        phoneVerified: false,
        createdAt: userModelInstance.createdAt,
        updatedAt: userModelInstance.updatedAt,
      });
      
      // 不应该包含敏感信息
      expect(response).not.toHaveProperty('passwordHash');
      expect(response).not.toHaveProperty('permissions');
      expect(response).not.toHaveProperty('lastLoginIp');
      expect(response).not.toHaveProperty('failedLoginAttempts');
      expect(response).not.toHaveProperty('lockedUntil');
      expect(response).not.toHaveProperty('deletedAt');
    });
  });
});