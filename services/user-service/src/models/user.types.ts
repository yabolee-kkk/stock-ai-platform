/**
 * @file 用户类型定义
 * @description 用户相关TypeScript类型和接口定义
 * @author StockAI开发团队
 * @created 2026-03-15
 */

/**
 * 用户角色
 */
export enum UserRole {
  USER = 'user',
  PREMIUM = 'premium',
  ADMIN = 'admin',
  SUPER_ADMIN = 'super_admin',
}

/**
 * 用户状态
 */
export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  PENDING = 'pending',
}

/**
 * 用户认证类型
 */
export enum AuthType {
  EMAIL = 'email',
  GOOGLE = 'google',
  GITHUB = 'github',
  WECHAT = 'wechat',
  PHONE = 'phone',
}

/**
 * 模板类型（用户核心需求）
 */
export enum TemplateType {
  STOCK_INFO = 'stock_info',      // 股票信息
  ANALYSIS = 'analysis',          // 分析报告
  REPORT = 'report',              // 详细报告
  COMPARISON = 'comparison',      // 对比分析
  PORTFOLIO = 'portfolio',        // 投资组合
  ALERT = 'alert',                // 提醒通知
}

/**
 * 模板配置
 */
export interface TemplateConfig {
  id: string;
  name: string;                   // 模板名称（如：简洁版、详细版）
  description?: string;           // 模板描述
  type: TemplateType;             // 模板类型
  isDefault: boolean;            // 是否默认模板
  isPublic: boolean;             // 是否公开模板
  config: Record<string, any>;   // 模板具体配置（JSON格式）
  version: string;               // 模板版本
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 模板偏好
 */
export interface TemplatePreference {
  stockInfo: {
    defaultTemplateId: string;    // 默认股票信息模板ID
    customConfig?: Record<string, any>; // 自定义配置
  };
  analysis: {
    defaultTemplateId: string;    // 默认分析模板ID
    customConfig?: Record<string, any>;
  };
  report: {
    defaultTemplateId: string;    // 默认报告模板ID
    customConfig?: Record<string, any>;
  };
  comparison?: {
    defaultTemplateId: string;
    customConfig?: Record<string, any>;
  };
  portfolio?: {
    defaultTemplateId: string;
    customConfig?: Record<string, any>;
  };
  alert?: {
    defaultTemplateId: string;
    customConfig?: Record<string, any>;
  };
}

/**
 * 显示偏好
 */
export interface DisplayPreference {
  compactMode: boolean;           // 紧凑模式
  showCharts: boolean;            // 显示图表
  colorScheme: 'light' | 'dark' | 'auto'; // 颜色主题
  fontSize: 'small' | 'medium' | 'large'; // 字体大小
  language: 'zh-CN' | 'en-US';    // 界面语言
  timezone: string;              // 时区
  dateFormat: string;            // 日期格式
  numberFormat: 'comma' | 'dot'; // 数字格式
}

/**
 * 通知偏好
 */
export interface NotificationPreference {
  priceAlerts: boolean;           // 价格提醒
  volumeAlerts: boolean;          // 成交量提醒
  newsAlerts: boolean;            // 新闻提醒
  reportAlerts: boolean;          // 报告提醒
  email: {
    enabled: boolean;             // 邮件通知
    frequency: 'immediate' | 'daily' | 'weekly';
  };
  push: {
    enabled: boolean;             // 推送通知
    frequency: 'immediate' | 'daily' | 'weekly';
  };
  sms: {
    enabled: boolean;             // 短信通知
    frequency: 'immediate' | 'daily' | 'weekly';
  };
}

/**
 * 投资偏好
 */
export interface InvestmentPreference {
  riskTolerance: 'conservative' | 'moderate' | 'aggressive'; // 风险承受能力
  investmentHorizon: 'short' | 'medium' | 'long'; // 投资期限
  sectors: string[];              // 关注行业
  regions: string[];              // 关注地区
  minMarketCap?: number;          // 最小市值
  maxMarketCap?: number;          // 最大市值
  dividendPreference: boolean;    // 是否偏好分红股
  growthPreference: boolean;      // 是否偏好成长股
}

/**
 * 用户偏好（综合）
 */
export interface UserPreferences {
  // 模板偏好（用户核心需求）
  templates: TemplatePreference;
  
  // 显示偏好
  display: DisplayPreference;
  
  // 通知偏好
  notifications: NotificationPreference;
  
  // 投资偏好
  investment: InvestmentPreference;
  
  // 其他偏好
  other: Record<string, any>;
}

/**
 * 用户数据库模型接口
 */
export interface UserModel {
  id: string;                     // UUID主键
  username: string;              // 用户名（唯一）
  email: string;                 // 邮箱（唯一）
  phone?: string;                // 手机号（可选，唯一）
  
  // 密码和认证
  passwordHash: string;          // 密码哈希
  authType: AuthType;            // 认证类型
  emailVerified: boolean;        // 邮箱验证状态
  phoneVerified: boolean;        // 手机验证状态
  
  // 用户信息
  displayName?: string;          // 显示名称
  avatarUrl?: string;            // 头像URL
  bio?: string;                  // 个人简介
  location?: string;             // 位置
  
  // 状态和权限
  role: UserRole;                // 用户角色
  status: UserStatus;            // 用户状态
  permissions: string[];         // 权限列表
  
  // 偏好设置
  preferences: UserPreferences;  // 用户偏好（JSON格式）
  
  // 账户安全
  lastLoginAt?: Date;            // 最后登录时间
  lastLoginIp?: string;          // 最后登录IP
  failedLoginAttempts: number;   // 失败登录次数
  lockedUntil?: Date;            // 锁定到期时间
  
  // 元数据
  createdAt: Date;               // 创建时间
  updatedAt: Date;               // 更新时间
  deletedAt?: Date;              // 软删除时间
}

/**
 * 创建用户DTO
 */
export interface CreateUserDto {
  username: string;
  email: string;
  password: string;
  phone?: string;
  displayName?: string;
  authType?: AuthType;
  preferences?: Partial<UserPreferences>;
}

/**
 * 更新用户DTO
 */
export interface UpdateUserDto {
  username?: string;
  email?: string;
  phone?: string;
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
  location?: string;
  preferences?: Partial<UserPreferences>;
}

/**
 * 用户响应DTO
 */
export interface UserResponseDto {
  id: string;
  username: string;
  email: string;
  phone?: string;
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
  location?: string;
  role: UserRole;
  status: UserStatus;
  preferences: UserPreferences;
  emailVerified: boolean;
  phoneVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 登录请求DTO
 */
export interface LoginRequestDto {
  username?: string;
  email?: string;
  phone?: string;
  password: string;
}

/**
 * 登录响应DTO
 */
export interface LoginResponseDto {
  user: UserResponseDto;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

/**
 * 刷新令牌请求DTO
 */
export interface RefreshTokenRequestDto {
  refreshToken: string;
}

/**
 * 密码重置请求DTO
 */
export interface ResetPasswordRequestDto {
  email: string;
  newPassword: string;
  token: string;
}

/**
 * 验证邮箱请求DTO
 */
export interface VerifyEmailRequestDto {
  token: string;
}

/**
 * 更新模板偏好请求DTO
 */
export interface UpdateTemplatePreferenceDto {
  type: TemplateType;
  templateId: string;
  customConfig?: Record<string, any>;
}

/**
 * API密钥信息
 */
export interface ApiKeyInfo {
  id: string;
  userId: string;
  name: string;
  key: string;
  lastUsedAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
}

/**
 * 导出类型
 */
export type {
  TemplateConfig as TemplateConfigType,
  TemplatePreference as TemplatePreferenceType,
  DisplayPreference as DisplayPreferenceType,
  NotificationPreference as NotificationPreferenceType,
  InvestmentPreference as InvestmentPreferenceType,
  UserPreferences as UserPreferencesType,
  UserModel as UserModelType,
  CreateUserDto as CreateUserDtoType,
  UpdateUserDto as UpdateUserDtoType,
  UserResponseDto as UserResponseDtoType,
  LoginRequestDto as LoginRequestDtoType,
  LoginResponseDto as LoginResponseDtoType,
};