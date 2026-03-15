/**
 * @file 认证服务
 * @description 处理JWT令牌生成、验证和刷新
 * @author StockAI开发团队
 * @created 2026-03-15
 */

import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import { promisify } from 'util';
import { config } from '@/config/env';
import { getRedisClient, setCache, getCache, deleteCache } from '@/config/redis';
import { logger } from '@/utils/logger';
import { userModel } from '@/models/user.model';
import { 
  UserModel, 
  LoginRequestDto, 
  LoginResponseDto,
  UserResponseDto,
  RefreshTokenRequestDto,
} from '@/models/user.types';
import { AuthenticationError, NotFoundError, DatabaseError } from '@/middlewares/errorHandler';

/**
 * 令牌类型
 */
export enum TokenType {
  ACCESS = 'access',
  REFRESH = 'refresh',
  VERIFICATION = 'verification',
  PASSWORD_RESET = 'password_reset',
}

/**
 * 令牌载荷
 */
export interface TokenPayload {
  userId: string;
  username: string;
  email: string;
  role: string;
  type: TokenType;
  iat?: number;
  exp?: number;
}

/**
 * 验证令牌响应
 */
export interface VerifyTokenResponse {
  valid: boolean;
  payload?: TokenPayload;
  error?: string;
}

/**
 * 认证服务类
 */
export class AuthService {
  private readonly ACCESS_TOKEN_TTL = 15 * 60; // 15分钟
  private readonly REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60; // 7天
  private readonly VERIFICATION_TOKEN_TTL = 24 * 60 * 60; // 24小时
  private readonly PASSWORD_RESET_TOKEN_TTL = 1 * 60 * 60; // 1小时
  
  private readonly TOKEN_PREFIX = 'token:';
  private readonly BLACKLIST_PREFIX = 'token:blacklist:';
  
  /**
   * 生成访问令牌
   */
  async generateAccessToken(user: UserModel | UserResponseDto): Promise<string> {
    const payload: TokenPayload = {
      userId: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      type: TokenType.ACCESS,
    };
    
    const options = {
      expiresIn: config.jwt.accessExpiry,
      issuer: config.jwt.issuer,
      subject: user.id,
    };
    
    return jwt.sign(payload, config.jwt.secret, options);
  }
  
  /**
   * 生成刷新令牌
   */
  async generateRefreshToken(user: UserModel | UserResponseDto): Promise<string> {
    const payload: TokenPayload = {
      userId: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      type: TokenType.REFRESH,
    };
    
    const options = {
      expiresIn: config.jwt.refreshExpiry,
      issuer: config.jwt.issuer,
      subject: user.id,
    };
    
    const token = jwt.sign(payload, config.jwt.secret, options);
    
    // 存储刷新令牌到Redis
    const cacheKey = `${this.TOKEN_PREFIX}refresh:${user.id}`;
    await setCache(cacheKey, token, this.REFRESH_TOKEN_TTL);
    
    return token;
  }
  
  /**
   * 验证访问令牌
   */
  async verifyAccessToken(token: string): Promise<VerifyTokenResponse> {
    try {
      // 检查令牌是否在黑名单中
      const isBlacklisted = await this.isTokenBlacklisted(token);
      if (isBlacklisted) {
        return { valid: false, error: '令牌已被撤销' };
      }
      
      // 验证JWT令牌
      const payload = jwt.verify(token, config.jwt.secret, {
        issuer: config.jwt.issuer,
      }) as TokenPayload;
      
      // 验证令牌类型
      if (payload.type !== TokenType.ACCESS) {
        return { valid: false, error: '无效的令牌类型' };
      }
      
      // 验证用户是否存在且激活
      const user = await userModel.findById(payload.userId);
      if (!user || user.status !== 'active') {
        return { valid: false, error: '用户不存在或已被禁用' };
      }
      
      return { valid: true, payload };
      
    } catch (error: any) {
      logger.debug('令牌验证失败', { error: error.message });
      
      let errorMessage = '令牌验证失败';
      if (error.name === 'TokenExpiredError') {
        errorMessage = '令牌已过期';
      } else if (error.name === 'JsonWebTokenError') {
        errorMessage = '无效的令牌';
      }
      
      return { valid: false, error: errorMessage };
    }
  }
  
  /**
   * 验证刷新令牌
   */
  async verifyRefreshToken(token: string): Promise<VerifyTokenResponse> {
    try {
      // 验证JWT令牌
      const payload = jwt.verify(token, config.jwt.secret, {
        issuer: config.jwt.issuer,
      }) as TokenPayload;
      
      // 验证令牌类型
      if (payload.type !== TokenType.REFRESH) {
        return { valid: false, error: '无效的令牌类型' };
      }
      
      // 验证用户是否存在且激活
      const user = await userModel.findById(payload.userId);
      if (!user || user.status !== 'active') {
        return { valid: false, error: '用户不存在或已被禁用' };
      }
      
      // 检查刷新令牌是否在Redis中
      const cacheKey = `${this.TOKEN_PREFIX}refresh:${user.id}`;
      const storedToken = await getCache<string>(cacheKey);
      
      if (!storedToken || storedToken !== token) {
        return { valid: false, error: '刷新令牌无效或已过期' };
      }
      
      return { valid: true, payload };
      
    } catch (error: any) {
      logger.debug('刷新令牌验证失败', { error: error.message });
      
      let errorMessage = '刷新令牌验证失败';
      if (error.name === 'TokenExpiredError') {
        errorMessage = '刷新令牌已过期';
      } else if (error.name === 'JsonWebTokenError') {
        errorMessage = '无效的刷新令牌';
      }
      
      return { valid: false, error: errorMessage };
    }
  }
  
  /**
   * 刷新访问令牌
   */
  async refreshAccessToken(refreshToken: string): Promise<LoginResponseDto> {
    // 验证刷新令牌
    const verificationResult = await this.verifyRefreshToken(refreshToken);
    if (!verificationResult.valid || !verificationResult.payload) {
      throw new AuthenticationError(verificationResult.error || '刷新令牌无效');
    }
    
    const { payload } = verificationResult;
    
    // 获取用户信息
    const user = await userModel.findById(payload.userId);
    if (!user) {
      throw new NotFoundError('用户不存在');
    }
    
    // 生成新的访问令牌
    const accessToken = await this.generateAccessToken(user);
    const userResponse = userModel.toResponseDto(user);
    
    // 记录审计日志
    logger.auditLog('token_refresh', user.id, 'auth', user.id);
    
    return {
      user: userResponse,
      accessToken,
      refreshToken, // 返回相同的刷新令牌
      expiresIn: this.ACCESS_TOKEN_TTL,
      tokenType: 'Bearer',
    };
  }
  
  /**
   * 用户登录
   */
  async login(loginData: LoginRequestDto, ipAddress?: string): Promise<LoginResponseDto> {
    const startTime = Date.now();
    
    try {
      // 验证用户凭据
      const user = await userModel.validateCredentials(
        loginData.username || loginData.email || loginData.phone || '',
        loginData.password
      );
      
      if (!user) {
        throw new AuthenticationError('用户名或密码错误');
      }
      
      // 生成令牌
      const [accessToken, refreshToken] = await Promise.all([
        this.generateAccessToken(user),
        this.generateRefreshToken(user),
      ]);
      
      const userResponse = userModel.toResponseDto(user);
      
      // 更新最后登录信息（如果需要IP地址，由调用者传入）
      if (ipAddress) {
        // 在实际实现中，这里会更新数据库中的last_login_ip
        // 为了简化，我们只记录日志
        logger.auditLog('user_login', user.id, 'auth', user.id, { ipAddress });
      }
      
      // 性能日志
      logger.performanceLog('user_login', Date.now() - startTime, { userId: user.id });
      
      return {
        user: userResponse,
        accessToken,
        refreshToken,
        expiresIn: this.ACCESS_TOKEN_TTL,
        tokenType: 'Bearer',
      };
      
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * 用户注销
   */
  async logout(userId: string, accessToken?: string): Promise<void> {
    try {
      // 删除刷新令牌
      const refreshTokenKey = `${this.TOKEN_PREFIX}refresh:${userId}`;
      await deleteCache(refreshTokenKey);
      
      // 如果有访问令牌，将其加入黑名单
      if (accessToken) {
        await this.addTokenToBlacklist(accessToken);
      }
      
      // 记录审计日志
      logger.auditLog('user_logout', userId, 'auth', userId);
      
    } catch (error) {
      logger.error('用户注销失败', { userId, error });
      throw new DatabaseError('注销失败');
    }
  }
  
  /**
   * 生成邮箱验证令牌
   */
  async generateVerificationToken(userId: string, email: string): Promise<string> {
    const payload: TokenPayload = {
      userId,
      email,
      username: '',
      role: '',
      type: TokenType.VERIFICATION,
    };
    
    const token = jwt.sign(payload, config.jwt.secret, {
      expiresIn: `${this.VERIFICATION_TOKEN_TTL}s`,
      issuer: config.jwt.issuer,
      subject: userId,
    });
    
    // 存储验证令牌
    const cacheKey = `${this.TOKEN_PREFIX}verification:${userId}`;
    await setCache(cacheKey, token, this.VERIFICATION_TOKEN_TTL);
    
    return token;
  }
  
  /**
   * 验证邮箱验证令牌
   */
  async verifyVerificationToken(token: string): Promise<VerifyTokenResponse> {
    try {
      const payload = jwt.verify(token, config.jwt.secret, {
        issuer: config.jwt.issuer,
      }) as TokenPayload;
      
      if (payload.type !== TokenType.VERIFICATION) {
        return { valid: false, error: '无效的验证令牌类型' };
      }
      
      // 检查令牌是否有效
      const cacheKey = `${this.TOKEN_PREFIX}verification:${payload.userId}`;
      const storedToken = await getCache<string>(cacheKey);
      
      if (!storedToken || storedToken !== token) {
        return { valid: false, error: '验证令牌无效或已过期' };
      }
      
      return { valid: true, payload };
      
    } catch (error: any) {
      let errorMessage = '验证令牌无效';
      if (error.name === 'TokenExpiredError') {
        errorMessage = '验证令牌已过期';
      }
      
      return { valid: false, error: errorMessage };
    }
  }
  
  /**
   * 生成密码重置令牌
   */
  async generatePasswordResetToken(userId: string, email: string): Promise<string> {
    const payload: TokenPayload = {
      userId,
      email,
      username: '',
      role: '',
      type: TokenType.PASSWORD_RESET,
    };
    
    const token = jwt.sign(payload, config.jwt.secret, {
      expiresIn: `${this.PASSWORD_RESET_TOKEN_TTL}s`,
      issuer: config.jwt.issuer,
      subject: userId,
    });
    
    // 存储重置令牌
    const cacheKey = `${this.TOKEN_PREFIX}password_reset:${userId}`;
    await setCache(cacheKey, token, this.PASSWORD_RESET_TOKEN_TTL);
    
    return token;
  }
  
  /**
   * 验证密码重置令牌
   */
  async verifyPasswordResetToken(token: string): Promise<VerifyTokenResponse> {
    try {
      const payload = jwt.verify(token, config.jwt.secret, {
        issuer: config.jwt.issuer,
      }) as TokenPayload;
      
      if (payload.type !== TokenType.PASSWORD_RESET) {
        return { valid: false, error: '无效的密码重置令牌类型' };
      }
      
      // 检查令牌是否有效
      const cacheKey = `${this.TOKEN_PREFIX}password_reset:${payload.userId}`;
      const storedToken = await getCache<string>(cacheKey);
      
      if (!storedToken || storedToken !== token) {
        return { valid: false, error: '密码重置令牌无效或已过期' };
      }
      
      return { valid: true, payload };
      
    } catch (error: any) {
      let errorMessage = '密码重置令牌无效';
      if (error.name === 'TokenExpiredError') {
        errorMessage = '密码重置令牌已过期';
      }
      
      return { valid: false, error: errorMessage };
    }
  }
  
  /**
   * 生成API密钥
   */
  async generateApiKey(userId: string, name: string): Promise<{
    id: string;
    key: string;
    name: string;
    createdAt: Date;
  }> {
    const apiKeyId = randomBytes(16).toString('hex');
    const apiKey = `sk_${randomBytes(32).toString('hex')}`;
    
    const cacheKey = `api_key:${userId}:${apiKeyId}`;
    const apiKeyData = {
      id: apiKeyId,
      userId,
      name,
      key: apiKey,
      createdAt: new Date(),
      lastUsedAt: null,
    };
    
    await setCache(cacheKey, apiKeyData, 365 * 24 * 60 * 60); // 1年有效期
    
    // 记录审计日志
    logger.auditLog('api_key_generated', userId, 'auth', apiKeyId, { name });
    
    return {
      id: apiKeyId,
      key: apiKey,
      name,
      createdAt: new Date(),
    };
  }
  
  /**
   * 验证API密钥
   */
  async verifyApiKey(apiKey: string): Promise<{
    valid: boolean;
    userId?: string;
    keyId?: string;
    error?: string;
  }> {
    try {
      // 在实际实现中，需要从Redis或数据库查询API密钥
      // 这里简化处理，只检查格式
      if (!apiKey.startsWith('sk_')) {
        return { valid: false, error: '无效的API密钥格式' };
      }
      
      // 这里应该有实际的验证逻辑
      // 暂时返回成功
      return { valid: true, userId: 'temp-user-id', keyId: 'temp-key-id' };
      
    } catch (error) {
      return { valid: false, error: 'API密钥验证失败' };
    }
  }
  
  /**
   * 将令牌加入黑名单
   */
  private async addTokenToBlacklist(token: string): Promise<void> {
    try {
      // 解码令牌获取过期时间
      const decoded = jwt.decode(token) as any;
      if (!decoded || !decoded.exp) {
        return;
      }
      
      const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);
      if (expiresIn > 0) {
        const blacklistKey = `${this.BLACKLIST_PREFIX}${token}`;
        await setCache(blacklistKey, 'blacklisted', expiresIn);
      }
      
    } catch (error) {
      logger.error('添加令牌到黑名单失败', { error });
    }
  }
  
  /**
   * 检查令牌是否在黑名单中
   */
  private async isTokenBlacklisted(token: string): Promise<boolean> {
    try {
      const blacklistKey = `${this.BLACKLIST_PREFIX}${token}`;
      const result = await getCache<string>(blacklistKey);
      return result === 'blacklisted';
    } catch (error) {
      return false;
    }
  }
  
  /**
   * 清除用户的刷新令牌
   */
  async clearUserRefreshTokens(userId: string): Promise<void> {
    try {
      const refreshTokenKey = `${this.TOKEN_PREFIX}refresh:${userId}`;
      await deleteCache(refreshTokenKey);
    } catch (error) {
      logger.error('清除用户刷新令牌失败', { userId, error });
    }
  }
}

/**
 * 导出认证服务实例
 */
export const authService = new AuthService();
export default authService;