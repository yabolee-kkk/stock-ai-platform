/**
 * @file 认证服务测试
 * @description 认证服务单元测试
 * @author StockAI开发团队
 * @created 2026-03-15
 */

import jwt from 'jsonwebtoken';
import { createClient } from 'redis';
import { authService } from '@/services/auth.service';
import { userModel } from '@/models/user.model';
import { 
  TokenType,
  UserRole,
  UserStatus,
} from '@/models/user.types';
import { AuthenticationError, NotFoundError } from '@/middlewares/errorHandler';

// 模拟数据
const mockUser = {
  id: 'test-user-id',
  username: 'testuser',
  email: 'test@example.com',
  role: UserRole.USER,
  status: UserStatus.ACTIVE,
  passwordHash: '$2b$10$mockhash',
};

const mockUserResponse = {
  id: 'test-user-id',
  username: 'testuser',
  email: 'test@example.com',
  role: UserRole.USER,
  status: UserStatus.ACTIVE,
  preferences: {
    templates: {
      stockInfo: { defaultTemplateId: 'stock_info_concise' },
      analysis: { defaultTemplateId: 'analysis_technical' },
      report: { defaultTemplateId: 'report_detailed' },
    },
    display: {},
    notifications: {},
    investment: {},
    other: {},
  },
  emailVerified: false,
  phoneVerified: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('认证服务测试', () => {
  let mockRedisClient: any;
  
  beforeEach(() => {
    // 获取模拟的Redis客户端
    mockRedisClient = createClient() as any;
    
    // 清除之前的模拟调用
    jest.clearAllMocks();
  });
  
  describe('generateAccessToken - 生成访问令牌', () => {
    test('应该成功生成访问令牌', async () => {
      const token = await authService.generateAccessToken(mockUser as any);
      
      expect(token).toBe('mock.jwt.token');
      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'test-user-id',
          username: 'testuser',
          email: 'test@example.com',
          role: UserRole.USER,
          type: TokenType.ACCESS,
        }),
        expect.any(String),
        expect.objectContaining({
          expiresIn: expect.any(String),
          issuer: expect.any(String),
          subject: 'test-user-id',
        })
      );
    });
  });
  
  describe('generateRefreshToken - 生成刷新令牌', () => {
    test('应该成功生成刷新令牌并存储到Redis', async () => {
      const token = await authService.generateRefreshToken(mockUser as any);
      
      expect(token).toBe('mock.jwt.token');
      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          type: TokenType.REFRESH,
        }),
        expect.any(String),
        expect.objectContaining({
          expiresIn: expect.any(String),
          issuer: expect.any(String),
          subject: 'test-user-id',
        })
      );
      
      // 验证令牌存储到Redis
      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        'token:refresh:test-user-id',
        7 * 24 * 60 * 60, // 7天TTL
        'mock.jwt.token'
      );
    });
  });
  
  describe('verifyAccessToken - 验证访问令牌', () => {
    test('应该验证有效的访问令牌', async () => {
      const mockPayload = {
        userId: 'test-user-id',
        username: 'testuser',
        email: 'test@example.com',
        role: UserRole.USER,
        type: TokenType.ACCESS,
      };
      
      // 模拟JWT验证成功
      (jwt.verify as jest.Mock).mockReturnValue(mockPayload);
      
      // 模拟用户存在
      jest.spyOn(userModel, 'findById').mockResolvedValue({
        ...mockUser,
        status: UserStatus.ACTIVE,
      } as any);
      
      const result = await authService.verifyAccessToken('valid.token');
      
      expect(result).toEqual({
        valid: true,
        payload: mockPayload,
      });
    });
    
    test('当令牌在黑名单中时应返回无效', async () => {
      // 模拟黑名单检查
      mockRedisClient.get.mockResolvedValue('blacklisted');
      
      const result = await authService.verifyAccessToken('blacklisted.token');
      
      expect(result).toEqual({
        valid: false,
        error: '令牌已被撤销',
      });
    });
    
    test('当令牌类型错误时应返回无效', async () => {
      const mockPayload = {
        userId: 'test-user-id',
        type: TokenType.REFRESH, // 错误的类型
      };
      
      (jwt.verify as jest.Mock).mockReturnValue(mockPayload);
      
      const result = await authService.verifyAccessToken('wrong.type.token');
      
      expect(result).toEqual({
        valid: false,
        error: '无效的令牌类型',
      });
    });
    
    test('当用户不存在时应返回无效', async () => {
      const mockPayload = {
        userId: 'non-existent-user',
        type: TokenType.ACCESS,
      };
      
      (jwt.verify as jest.Mock).mockReturnValue(mockPayload);
      jest.spyOn(userModel, 'findById').mockResolvedValue(null);
      
      const result = await authService.verifyAccessToken('user.not.found.token');
      
      expect(result).toEqual({
        valid: false,
        error: '用户不存在或已被禁用',
      });
    });
    
    test('当用户被禁用时应返回无效', async () => {
      const mockPayload = {
        userId: 'disabled-user',
        type: TokenType.ACCESS,
      };
      
      (jwt.verify as jest.Mock).mockReturnValue(mockPayload);
      jest.spyOn(userModel, 'findById').mockResolvedValue({
        ...mockUser,
        status: UserStatus.SUSPENDED,
      } as any);
      
      const result = await authService.verifyAccessToken('user.disabled.token');
      
      expect(result).toEqual({
        valid: false,
        error: '用户不存在或已被禁用',
      });
    });
    
    test('当令牌过期时应返回无效', async () => {
      (jwt.verify as jest.Mock).mockImplementation(() => {
        const error = new Error('Token expired');
        error.name = 'TokenExpiredError';
        throw error;
      });
      
      const result = await authService.verifyAccessToken('expired.token');
      
      expect(result).toEqual({
        valid: false,
        error: '令牌已过期',
      });
    });
    
    test('当令牌无效时应返回无效', async () => {
      (jwt.verify as jest.Mock).mockImplementation(() => {
        const error = new Error('Invalid token');
        error.name = 'JsonWebTokenError';
        throw error;
      });
      
      const result = await authService.verifyAccessToken('invalid.token');
      
      expect(result).toEqual({
        valid: false,
        error: '无效的令牌',
      });
    });
  });
  
  describe('verifyRefreshToken - 验证刷新令牌', () => {
    test('应该验证有效的刷新令牌', async () => {
      const mockPayload = {
        userId: 'test-user-id',
        type: TokenType.REFRESH,
      };
      
      // 模拟JWT验证成功
      (jwt.verify as jest.Mock).mockReturnValue(mockPayload);
      
      // 模拟用户存在
      jest.spyOn(userModel, 'findById').mockResolvedValue({
        ...mockUser,
        status: UserStatus.ACTIVE,
      } as any);
      
      // 模拟Redis中有匹配的令牌
      mockRedisClient.get.mockResolvedValue('stored.refresh.token');
      
      const result = await authService.verifyRefreshToken('stored.refresh.token');
      
      expect(result).toEqual({
        valid: true,
        payload: mockPayload,
      });
    });
    
    test('当Redis中没有令牌时应返回无效', async () => {
      const mockPayload = {
        userId: 'test-user-id',
        type: TokenType.REFRESH,
      };
      
      (jwt.verify as jest.Mock).mockReturnValue(mockPayload);
      jest.spyOn(userModel, 'findById').mockResolvedValue(mockUser as any);
      
      // 模拟Redis中没有令牌
      mockRedisClient.get.mockResolvedValue(null);
      
      const result = await authService.verifyRefreshToken('not.stored.token');
      
      expect(result).toEqual({
        valid: false,
        error: '刷新令牌无效或已过期',
      });
    });
    
    test('当Redis中的令牌不匹配时应返回无效', async () => {
      const mockPayload = {
        userId: 'test-user-id',
        type: TokenType.REFRESH,
      };
      
      (jwt.verify as jest.Mock).mockReturnValue(mockPayload);
      jest.spyOn(userModel, 'findById').mockResolvedValue(mockUser as any);
      
      // 模拟Redis中有不同的令牌
      mockRedisClient.get.mockResolvedValue('different.token');
      
      const result = await authService.verifyRefreshToken('provided.token');
      
      expect(result).toEqual({
        valid: false,
        error: '刷新令牌无效或已过期',
      });
    });
  });
  
  describe('refreshAccessToken - 刷新访问令牌', () => {
    test('应该成功刷新访问令牌', async () => {
      const mockRefreshPayload = {
        userId: 'test-user-id',
        type: TokenType.REFRESH,
      };
      
      // 模拟验证刷新令牌成功
      jest.spyOn(authService, 'verifyRefreshToken').mockResolvedValue({
        valid: true,
        payload: mockRefreshPayload,
      });
      
      // 模拟用户存在
      jest.spyOn(userModel, 'findById').mockResolvedValue(mockUser as any);
      
      // 模拟生成访问令牌
      jest.spyOn(authService, 'generateAccessToken').mockResolvedValue('new.access.token');
      
      // 模拟用户模型转换
      jest.spyOn(userModel, 'toResponseDto').mockReturnValue(mockUserResponse as any);
      
      const result = await authService.refreshAccessToken('valid.refresh.token');
      
      expect(result).toEqual({
        user: mockUserResponse,
        accessToken: 'new.access.token',
        refreshToken: 'valid.refresh.token',
        expiresIn: 15 * 60, // 15分钟
        tokenType: 'Bearer',
      });
    });
    
    test('当刷新令牌无效时应抛出错误', async () => {
      // 模拟验证刷新令牌失败
      jest.spyOn(authService, 'verifyRefreshToken').mockResolvedValue({
        valid: false,
        error: '刷新令牌无效',
      });
      
      await expect(authService.refreshAccessToken('invalid.refresh.token'))
        .rejects
        .toThrow(AuthenticationError);
      
      await expect(authService.refreshAccessToken('invalid.refresh.token'))
        .rejects
        .toThrow('刷新令牌无效');
    });
    
    test('当用户不存在时应抛出错误', async () => {
      const mockRefreshPayload = {
        userId: 'non-existent-user',
        type: TokenType.REFRESH,
      };
      
      // 模拟验证刷新令牌成功
      jest.spyOn(authService, 'verifyRefreshToken').mockResolvedValue({
        valid: true,
        payload: mockRefreshPayload,
      });
      
      // 模拟用户不存在
      jest.spyOn(userModel, 'findById').mockResolvedValue(null);
      
      await expect(authService.refreshAccessToken('valid.refresh.token'))
        .rejects
        .toThrow(NotFoundError);
      
      await expect(authService.refreshAccessToken('valid.refresh.token'))
        .rejects
        .toThrow('用户不存在');
    });
  });
  
  describe('login - 用户登录', () => {
    test('应该成功登录并返回令牌', async () => {
      // 模拟验证凭据成功
      jest.spyOn(userModel, 'validateCredentials').mockResolvedValue(mockUser as any);
      
      // 模拟生成令牌
      jest.spyOn(authService, 'generateAccessToken').mockResolvedValue('access.token');
      jest.spyOn(authService, 'generateRefreshToken').mockResolvedValue('refresh.token');
      
      // 模拟用户模型转换
      jest.spyOn(userModel, 'toResponseDto').mockReturnValue(mockUserResponse as any);
      
      const result = await authService.login({
        username: 'testuser',
        password: 'TestPass123!',
      });
      
      expect(result).toEqual({
        user: mockUserResponse,
        accessToken: 'access.token',
        refreshToken: 'refresh.token',
        expiresIn: 15 * 60,
        tokenType: 'Bearer',
      });
      
      // 验证凭据验证被调用
      expect(userModel.validateCredentials).toHaveBeenCalledWith(
        'testuser',
        'TestPass123!'
      );
    });
    
    test('当凭据无效时应抛出错误', async () => {
      // 模拟验证凭据失败
      jest.spyOn(userModel, 'validateCredentials').mockResolvedValue(null);
      
      await expect(authService.login({
        username: 'testuser',
        password: 'WrongPass!',
      })).rejects.toThrow(AuthenticationError);
      
      await expect(authService.login({
        username: 'testuser',
        password: 'WrongPass!',
      })).rejects.toThrow('用户名或密码错误');
    });
  });
  
  describe('logout - 用户注销', () => {
    test('应该成功注销并清除令牌', async () => {
      await authService.logout('test-user-id', 'access.token');
      
      // 验证刷新令牌被删除
      expect(mockRedisClient.del).toHaveBeenCalledWith('token:refresh:test-user-id');
      
      // 验证访问令牌被加入黑名单
      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        'token:blacklist:access.token',
        expect.any(Number),
        'blacklisted'
      );
    });
    
    test('没有访问令牌时也应成功注销', async () => {
      await authService.logout('test-user-id');
      
      // 验证刷新令牌被删除
      expect(mockRedisClient.del).toHaveBeenCalledWith('token:refresh:test-user-id');
      
      // 验证没有尝试加入黑名单
      expect(mockRedisClient.setEx).not.toHaveBeenCalledWith(
        'token:blacklist:',
        expect.any(Number),
        'blacklisted'
      );
    });
  });
  
  describe('generateVerificationToken - 生成验证令牌', () => {
    test('应该成功生成邮箱验证令牌', async () => {
      const token = await authService.generateVerificationToken('test-user-id', 'test@example.com');
      
      expect(token).toBe('mock.jwt.token');
      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'test-user-id',
          email: 'test@example.com',
          type: TokenType.VERIFICATION,
        }),
        expect.any(String),
        expect.objectContaining({
          expiresIn: expect.any(String),
          issuer: expect.any(String),
          subject: 'test-user-id',
        })
      );
      
      // 验证令牌存储到Redis
      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        'token:verification:test-user-id',
        24 * 60 * 60, // 24小时TTL
        'mock.jwt.token'
      );
    });
  });
  
  describe('verifyVerificationToken - 验证验证令牌', () => {
    test('应该验证有效的验证令牌', async () => {
      const mockPayload = {
        userId: 'test-user-id',
        type: TokenType.VERIFICATION,
      };
      
      // 模拟JWT验证成功
      (jwt.verify as jest.Mock).mockReturnValue(mockPayload);
      
      // 模拟Redis中有匹配的令牌
      mockRedisClient.get.mockResolvedValue('stored.verification.token');
      
      const result = await authService.verifyVerificationToken('stored.verification.token');
      
      expect(result).toEqual({
        valid: true,
        payload: mockPayload,
      });
    });
    
    test('当令牌类型错误时应返回无效', async () => {
      const mockPayload = {
        userId: 'test-user-id',
        type: TokenType.ACCESS, // 错误的类型
      };
      
      (jwt.verify as jest.Mock).mockReturnValue(mockPayload);
      
      const result = await authService.verifyVerificationToken('wrong.type.token');
      
      expect(result).toEqual({
        valid: false,
        error: '无效的验证令牌类型',
      });
    });
  });
  
  describe('generateApiKey - 生成API密钥', () => {
    test('应该成功生成API密钥', async () => {
      const result = await authService.generateApiKey('test-user-id', 'Test API Key');
      
      expect(result).toEqual({
        id: expect.any(String),
        key: expect.stringMatching(/^sk_/),
        name: 'Test API Key',
        createdAt: expect.any(Date),
      });
      
      // 验证API密钥存储到Redis
      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        expect.stringContaining('api_key:test-user-id:'),
        365 * 24 * 60 * 60, // 1年TTL
        expect.any(Object)
      );
    });
  });
  
  describe('verifyApiKey - 验证API密钥', () => {
    test('应该验证有效的API密钥', async () => {
      const result = await authService.verifyApiKey('sk_validapikey');
      
      expect(result).toEqual({
        valid: true,
        userId: 'temp-user-id',
        keyId: 'temp-key-id',
      });
    });
    
    test('当API密钥格式无效时应返回无效', async () => {
      const result = await authService.verifyApiKey('invalid-key');
      
      expect(result).toEqual({
        valid: false,
        error: '无效的API密钥格式',
      });
    });
  });
});