/**
 * @file Redis配置
 * @description Redis连接和缓存管理
 * @author StockAI开发团队
 * @created 2026-03-15
 */

import { createClient, RedisClientType } from 'redis';
import { config } from '@/config/env';
import { logger } from '@/utils/logger';

/**
 * Redis客户端实例
 */
let redisClient: RedisClientType | null = null;

/**
 * 连接Redis
 */
export async function connectRedis(): Promise<void> {
  if (redisClient?.isOpen) {
    logger.debug('Redis已连接，跳过重复连接');
    return;
  }

  try {
    redisClient = createClient({
      url: config.redis.url,
      ...(config.redis.password && { password: config.redis.password }),
      database: config.redis.db,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            logger.error('Redis重连次数超过限制');
            return new Error('Redis重连失败');
          }
          return Math.min(retries * 100, 3000);
        },
      },
    });

    // 监听连接事件
    redisClient.on('connect', () => {
      logger.info('Redis连接成功');
    });

    redisClient.on('ready', () => {
      logger.info('Redis准备就绪');
    });

    redisClient.on('error', (error) => {
      logger.error('Redis连接错误', { error });
    });

    redisClient.on('reconnecting', () => {
      logger.warn('Redis重新连接中...');
    });

    redisClient.on('end', () => {
      logger.warn('Redis连接关闭');
    });

    // 连接Redis
    await redisClient.connect();

    // 测试连接
    await redisClient.ping();

    logger.info('Redis连接测试成功');
  } catch (error) {
    logger.error('Redis连接失败', { error });
    throw error;
  }
}

/**
 * 断开Redis连接
 */
export async function disconnectRedis(): Promise<void> {
  if (!redisClient?.isOpen) {
    logger.debug('Redis未连接，跳过断开');
    return;
  }

  try {
    await redisClient.quit();
    redisClient = null;
    logger.info('Redis连接已断开');
  } catch (error) {
    logger.error('断开Redis连接失败', { error });
    throw error;
  }
}

/**
 * 获取Redis客户端
 */
export function getRedisClient(): RedisClientType {
  if (!redisClient?.isOpen) {
    throw new Error('Redis未连接，请先调用connectRedis()');
  }
  return redisClient;
}

/**
 * 设置缓存值
 */
export async function setCache(
  key: string,
  value: any,
  ttlSeconds?: number
): Promise<void> {
  try {
    const client = getRedisClient();
    const stringValue = JSON.stringify(value);
    
    if (ttlSeconds) {
      await client.setEx(key, ttlSeconds, stringValue);
    } else {
      await client.set(key, stringValue);
    }
    
    logger.debug('设置缓存', { key, ttlSeconds });
  } catch (error) {
    logger.error('设置缓存失败', { key, error });
    throw error;
  }
}

/**
 * 获取缓存值
 */
export async function getCache<T = any>(key: string): Promise<T | null> {
  try {
    const client = getRedisClient();
    const value = await client.get(key);
    
    if (value === null) {
      logger.debug('缓存未命中', { key });
      return null;
    }
    
    logger.debug('缓存命中', { key });
    return JSON.parse(value) as T;
  } catch (error) {
    logger.error('获取缓存失败', { key, error });
    throw error;
  }
}

/**
 * 删除缓存
 */
export async function deleteCache(key: string): Promise<void> {
  try {
    const client = getRedisClient();
    await client.del(key);
    
    logger.debug('删除缓存', { key });
  } catch (error) {
    logger.error('删除缓存失败', { key, error });
    throw error;
  }
}

/**
 * 检查缓存是否存在
 */
export async function existsCache(key: string): Promise<boolean> {
  try {
    const client = getRedisClient();
    const exists = await client.exists(key);
    
    return exists === 1;
  } catch (error) {
    logger.error('检查缓存存在失败', { key, error });
    throw error;
  }
}

/**
 * 设置缓存过期时间
 */
export async function expireCache(key: string, ttlSeconds: number): Promise<void> {
  try {
    const client = getRedisClient();
    await client.expire(key, ttlSeconds);
    
    logger.debug('设置缓存过期时间', { key, ttlSeconds });
  } catch (error) {
    logger.error('设置缓存过期时间失败', { key, error });
    throw error;
  }
}

/**
 * 获取缓存剩余时间
 */
export async function ttlCache(key: string): Promise<number> {
  try {
    const client = getRedisClient();
    const ttl = await client.ttl(key);
    
    return ttl;
  } catch (error) {
    logger.error('获取缓存剩余时间失败', { key, error });
    throw error;
  }
}

/**
 * 递增计数器
 */
export async function incrementCounter(key: string, by = 1): Promise<number> {
  try {
    const client = getRedisClient();
    const result = await client.incrBy(key, by);
    
    logger.debug('递增计数器', { key, by, result });
    return result;
  } catch (error) {
    logger.error('递增计数器失败', { key, error });
    throw error;
  }
}

/**
 * 清空当前数据库
 */
export async function flushDatabase(): Promise<void> {
  try {
    const client = getRedisClient();
    await client.flushDb();
    
    logger.warn('Redis数据库已清空');
  } catch (error) {
    logger.error('清空Redis数据库失败', { error });
    throw error;
  }
}

/**
 * Redis健康检查
 */
export async function checkRedisHealth(): Promise<boolean> {
  try {
    const client = getRedisClient();
    await client.ping();
    return true;
  } catch (error) {
    logger.error('Redis健康检查失败', { error });
    return false;
  }
}

/**
 * 导出Redis工具
 */
export default {
  connectRedis,
  disconnectRedis,
  getRedisClient,
  setCache,
  getCache,
  deleteCache,
  existsCache,
  expireCache,
  ttlCache,
  incrementCounter,
  flushDatabase,
  checkRedisHealth,
};