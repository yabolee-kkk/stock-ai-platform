/**
 * @file 用户服务入口文件
 * @description StockAI平台用户服务，负责用户认证、权限管理、偏好设置等
 * @author StockAI开发团队
 * @created 2026-03-15
 * @version 0.1.0
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { config } from '@/config/env';
import { logger } from '@/utils/logger';
import { errorHandler } from '@/middlewares/errorHandler';
import { requestLogger } from '@/middlewares/requestLogger';
import { rateLimiter } from '@/middlewares/rateLimiter';
import { connectDatabase } from '@/config/database';
import { connectRedis } from '@/config/redis';
import { apiRouter } from '@/routes/api';

/**
 * 用户服务应用类
 */
class UserServiceApp {
  private app: express.Application;
  private server: any;

  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * 设置中间件
   */
  private setupMiddleware(): void {
    // 安全中间件
    this.app.use(helmet());
    
    // CORS配置
    this.app.use(cors({
      origin: config.cors.origin,
      credentials: config.cors.credentials,
    }));
    
    // 请求体解析
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // 压缩响应
    this.app.use(compression());
    
    // 请求日志
    this.app.use(requestLogger);
    
    // 速率限制
    this.app.use(rateLimiter);
  }

  /**
   * 设置路由
   */
  private setupRoutes(): void {
    // 健康检查端点
    this.app.get('/health', (req, res) => {
      res.status(200).json({
        status: 'healthy',
        service: config.service.name,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      });
    });
    
    // API路由
    this.app.use('/api', apiRouter);
    
    // 404处理
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Cannot ${req.method} ${req.originalUrl}`,
        timestamp: new Date().toISOString(),
      });
    });
  }

  /**
   * 设置错误处理
   */
  private setupErrorHandling(): void {
    this.app.use(errorHandler);
  }

  /**
   * 启动服务
   */
  public async start(): Promise<void> {
    try {
      // 连接数据库
      await connectDatabase();
      logger.info('数据库连接成功');
      
      // 连接Redis
      await connectRedis();
      logger.info('Redis连接成功');
      
      // 启动HTTP服务器
      this.server = this.app.listen(config.server.port, config.server.host, () => {
        logger.info(`用户服务启动成功`, {
          port: config.server.port,
          host: config.server.host,
          environment: config.server.env,
          pid: process.pid,
        });
        
        logger.info(`健康检查端点: http://${config.server.host}:${config.server.port}/health`);
        logger.info(`API文档: http://${config.server.host}:${config.server.port}/api/docs`);
      });
      
      // 优雅关闭处理
      this.setupGracefulShutdown();
      
    } catch (error) {
      logger.error('服务启动失败', { error });
      process.exit(1);
    }
  }

  /**
   * 设置优雅关闭
   */
  private setupGracefulShutdown(): void {
    const signals = ['SIGTERM', 'SIGINT', 'SIGHUP'];
    
    signals.forEach(signal => {
      process.on(signal, async () => {
        logger.info(`收到 ${signal} 信号，开始优雅关闭...`);
        
        // 关闭HTTP服务器
        if (this.server) {
          this.server.close(() => {
            logger.info('HTTP服务器已关闭');
            process.exit(0);
          });
        }
        
        // 设置超时强制退出
        setTimeout(() => {
          logger.warn('优雅关闭超时，强制退出');
          process.exit(1);
        }, 10000);
      });
    });
    
    // 未捕获异常处理
    process.on('uncaughtException', (error) => {
      logger.error('未捕获异常', { error });
      process.exit(1);
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('未处理的Promise拒绝', { reason, promise });
    });
  }

  /**
   * 停止服务
   */
  public async stop(): Promise<void> {
    if (this.server) {
      this.server.close();
      logger.info('用户服务已停止');
    }
  }
}

/**
 * 启动用户服务
 */
async function main(): Promise<void> {
  const app = new UserServiceApp();
  await app.start();
}

// 启动应用
if (require.main === module) {
  main().catch((error) => {
    console.error('应用启动失败:', error);
    process.exit(1);
  });
}

export { UserServiceApp };
export default main;