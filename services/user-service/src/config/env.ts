/**
 * @file 环境配置管理
 * @description 加载和验证环境变量，提供类型安全的配置访问
 * @author StockAI开发团队
 * @created 2026-03-15
 */

import dotenv from 'dotenv';
import path from 'path';
import Joi from 'joi';

// 加载环境变量
dotenv.config({
  path: path.resolve(process.cwd(), '.env'),
});

/**
 * 环境变量验证模式
 */
const envSchema = Joi.object({
  // 服务器配置
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().port().default(3000),
  HOST: Joi.string().hostname().default('0.0.0.0'),
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'info', 'debug', 'trace')
    .default('info'),
  SERVICE_NAME: Joi.string().default('user-service'),

  // 数据库配置
  DATABASE_URL: Joi.string().uri().required(),
  DATABASE_POOL_MIN: Joi.number().integer().min(1).default(2),
  DATABASE_POOL_MAX: Joi.number().integer().min(1).default(20),
  DATABASE_SSL: Joi.boolean().default(false),

  // Redis配置
  REDIS_URL: Joi.string().uri().required(),
  REDIS_PASSWORD: Joi.string().allow('').optional(),
  REDIS_DB: Joi.number().integer().min(0).default(0),

  // JWT配置
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_EXPIRY: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRY: Joi.string().default('7d'),
  JWT_ISSUER: Joi.string().default('stock-ai-platform'),

  // 密码加密
  BCRYPT_SALT_ROUNDS: Joi.number().integer().min(8).max(20).default(12),

  // 速率限制
  RATE_LIMIT_WINDOW_MS: Joi.number().integer().min(1000).default(900000),
  RATE_LIMIT_MAX_REQUESTS: Joi.number().integer().min(1).default(100),
  RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS: Joi.boolean().default(false),

  // CORS配置
  CORS_ORIGIN: Joi.string().default('http://localhost:3000,http://localhost:8080'),
  CORS_CREDENTIALS: Joi.boolean().default(true),

  // 日志配置
  LOG_DIR: Joi.string().default('./logs'),
  LOG_FILE_MAX_SIZE: Joi.string().default('10m'),
  LOG_FILE_MAX_FILES: Joi.string().default('14d'),

  // 邮件配置
  SMTP_HOST: Joi.string().optional(),
  SMTP_PORT: Joi.number().port().optional(),
  SMTP_USER: Joi.string().optional(),
  SMTP_PASS: Joi.string().optional(),
  SMTP_FROM: Joi.string().email().optional(),

  // API密钥配置
  API_KEY_HEADER: Joi.string().default('X-API-Key'),

  // 模板配置（用户偏好）
  DEFAULT_TEMPLATE_TYPE: Joi.string().default('stock_info'),
  DEFAULT_TEMPLATE_NAME: Joi.string().default('简洁版'),
  ENABLE_TEMPLATE_CUSTOMIZATION: Joi.boolean().default(true),
})
  .unknown() // 允许未在模式中定义的变量
  .required();

/**
 * 验证环境变量
 */
const { value: envVars, error } = envSchema.validate(process.env, {
  abortEarly: false,
  stripUnknown: true,
});

if (error) {
  console.error('环境变量验证失败:');
  error.details.forEach((detail) => {
    console.error(`  ${detail.message}`);
  });
  process.exit(1);
}

/**
 * 配置对象
 */
export const config = {
  server: {
    env: envVars.NODE_ENV,
    port: envVars.PORT,
    host: envVars.HOST,
    isDevelopment: envVars.NODE_ENV === 'development',
    isTest: envVars.NODE_ENV === 'test',
    isProduction: envVars.NODE_ENV === 'production',
  },
  
  service: {
    name: envVars.SERVICE_NAME,
    logLevel: envVars.LOG_LEVEL,
  },
  
  database: {
    url: envVars.DATABASE_URL,
    pool: {
      min: envVars.DATABASE_POOL_MIN,
      max: envVars.DATABASE_POOL_MAX,
    },
    ssl: envVars.DATABASE_SSL,
  },
  
  redis: {
    url: envVars.REDIS_URL,
    password: envVars.REDIS_PASSWORD,
    db: envVars.REDIS_DB,
  },
  
  jwt: {
    secret: envVars.JWT_SECRET,
    accessExpiry: envVars.JWT_ACCESS_EXPIRY,
    refreshExpiry: envVars.JWT_REFRESH_EXPIRY,
    issuer: envVars.JWT_ISSUER,
  },
  
  security: {
    bcryptSaltRounds: envVars.BCRYPT_SALT_ROUNDS,
  },
  
  rateLimit: {
    windowMs: envVars.RATE_LIMIT_WINDOW_MS,
    maxRequests: envVars.RATE_LIMIT_MAX_REQUESTS,
    skipSuccessfulRequests: envVars.RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS,
  },
  
  cors: {
    origin: envVars.CORS_ORIGIN.split(','),
    credentials: envVars.CORS_CREDENTIALS,
  },
  
  logging: {
    dir: envVars.LOG_DIR,
    fileMaxSize: envVars.LOG_FILE_MAX_SIZE,
    fileMaxFiles: envVars.LOG_FILE_MAX_FILES,
  },
  
  email: {
    host: envVars.SMTP_HOST,
    port: envVars.SMTP_PORT,
    user: envVars.SMTP_USER,
    pass: envVars.SMTP_PASS,
    from: envVars.SMTP_FROM,
  },
  
  api: {
    keyHeader: envVars.API_KEY_HEADER,
  },
  
  templates: {
    defaultType: envVars.DEFAULT_TEMPLATE_TYPE,
    defaultName: envVars.DEFAULT_TEMPLATE_NAME,
    enableCustomization: envVars.ENABLE_TEMPLATE_CUSTOMIZATION,
  },
} as const;

/**
 * 获取配置值
 */
export type Config = typeof config;
export default config;