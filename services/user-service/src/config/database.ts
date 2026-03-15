/**
 * @file 数据库配置
 * @description PostgreSQL数据库连接池配置和管理
 * @author StockAI开发团队
 * @created 2026-03-15
 */

import { Pool, PoolConfig } from 'pg';
import { config } from '@/config/env';
import { logger } from '@/utils/logger';

/**
 * 数据库连接池配置
 */
const poolConfig: PoolConfig = {
  connectionString: config.database.url,
  max: config.database.pool.max,
  min: config.database.pool.min,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  query_timeout: 30000,
  statement_timeout: 30000,
  ...(config.database.ssl && {
    ssl: {
      rejectUnauthorized: false,
    },
  }),
};

/**
 * 数据库连接池实例
 */
export const pool = new Pool(poolConfig);

/**
 * 数据库连接状态
 */
let isConnected = false;

/**
 * 连接数据库
 */
export async function connectDatabase(): Promise<void> {
  if (isConnected) {
    logger.debug('数据库已连接，跳过重复连接');
    return;
  }

  try {
    // 测试连接
    const client = await pool.connect();
    
    // 检查数据库版本
    const versionResult = await client.query('SELECT version()');
    const version = versionResult.rows[0].version;
    
    // 检查必要的扩展
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await client.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
    
    client.release();
    
    isConnected = true;
    
    logger.info('数据库连接成功', {
      version,
      poolSize: {
        min: config.database.pool.min,
        max: config.database.pool.max,
      },
    });
    
    // 监听连接错误
    pool.on('error', (error) => {
      logger.error('数据库连接池错误', { error });
      isConnected = false;
    });
    
    // 监听连接获取
    pool.on('connect', () => {
      logger.debug('获取数据库连接');
    });
    
    // 监听连接移除
    pool.on('remove', () => {
      logger.debug('移除数据库连接');
    });
    
  } catch (error) {
    logger.error('数据库连接失败', { error });
    throw error;
  }
}

/**
 * 断开数据库连接
 */
export async function disconnectDatabase(): Promise<void> {
  if (!isConnected) {
    logger.debug('数据库未连接，跳过断开');
    return;
  }

  try {
    await pool.end();
    isConnected = false;
    logger.info('数据库连接已断开');
  } catch (error) {
    logger.error('断开数据库连接失败', { error });
    throw error;
  }
}

/**
 * 执行查询
 */
export async function query<T = any>(
  text: string,
  params?: any[],
  client?: any
): Promise<{ rows: T[]; rowCount: number }> {
  const startTime = Date.now();
  
  try {
    const result = client
      ? await client.query(text, params)
      : await pool.query(text, params);
    
    const duration = Date.now() - startTime;
    
    logger.debug('数据库查询', {
      query: text,
      params,
      duration: `${duration}ms`,
      rows: result.rowCount,
    });
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('数据库查询失败', {
      query: text,
      params,
      duration: `${duration}ms`,
      error: error instanceof Error ? error.message : String(error),
    });
    
    throw error;
  }
}

/**
 * 获取事务客户端
 */
export async function getTransactionClient(): Promise<any> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    return client;
  } catch (error) {
    client.release();
    throw error;
  }
}

/**
 * 提交事务
 */
export async function commitTransaction(client: any): Promise<void> {
  try {
    await client.query('COMMIT');
  } finally {
    client.release();
  }
}

/**
 * 回滚事务
 */
export async function rollbackTransaction(client: any): Promise<void> {
  try {
    await client.query('ROLLBACK');
  } finally {
    client.release();
  }
}

/**
 * 数据库健康检查
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch (error) {
    logger.error('数据库健康检查失败', { error });
    return false;
  }
}

/**
 * 导出数据库工具
 */
export default {
  pool,
  connectDatabase,
  disconnectDatabase,
  query,
  getTransactionClient,
  commitTransaction,
  rollbackTransaction,
  checkDatabaseHealth,
};