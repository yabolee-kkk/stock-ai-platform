import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import config from './config/env';
import logger from './utils/logger';
import apiRouter from './routes/api';

class DataService {
  private app: express.Application;
  private port: number;

  constructor() {
    this.app = express();
    this.port = config.server.port;
    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private initializeMiddleware(): void {
    // Security middleware
    this.app.use(helmet());
    
    // CORS configuration
    this.app.use(cors({
      origin: config.server.nodeEnv === 'production' 
        ? ['https://stockai.example.com'] 
        : '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: config.rateLimit.windowMs,
      max: config.rateLimit.maxRequests,
      message: {
        success: false,
        error: 'Too many requests, please try again later.',
      },
      standardHeaders: true,
      legacyHeaders: false,
    });
    
    this.app.use('/api/', limiter);

    // Body parsing
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Compression
    this.app.use(compression());

    // Request logging
    this.app.use((req, res, next) => {
      const startTime = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`, {
          ip: req.ip,
          userAgent: req.get('user-agent'),
          duration,
          statusCode: res.statusCode,
        });
      });

      next();
    });
  }

  private initializeRoutes(): void {
    // API routes
    this.app.use('/api', apiRouter);

    // Basic health check at root
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        service: 'data-service',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      });
    });
  }

  private initializeErrorHandling(): void {
    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        success: false,
        error: 'Resource not found',
        path: req.originalUrl,
      });
    });

    // Global error handler
    this.app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
      logger.error('Unhandled error:', error);

      if (res.headersSent) {
        return next(error);
      }

      res.status(500).json({
        success: false,
        error: config.server.nodeEnv === 'production'
          ? 'Internal server error'
          : error.message,
        stack: config.server.nodeEnv === 'development'
          ? error.stack
          : undefined,
      });
    });
  }

  public start(): void {
    this.app.listen(this.port, () => {
      logger.info(`Data Service started on port ${this.port}`, {
        port: this.port,
        nodeEnv: config.server.nodeEnv,
        dataSources: {
          eastmoney: config.dataSources.eastmoney.baseUrl,
          sina: config.dataSources.sina.baseUrl,
        },
        cache: {
          ttl: config.cache.ttlSeconds,
          maxEntries: config.cache.maxEntries,
        },
      });

      // Log startup completion
      logger.info('Data Service initialization complete', {
        timestamp: new Date().toISOString(),
        version: '0.1.0',
      });
    });

    // Handle graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down gracefully...');
      this.shutdown();
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT received, shutting down gracefully...');
      this.shutdown();
    });
  }

  private shutdown(): void {
    logger.info('Data Service shutdown complete');
    process.exit(0);
  }
}

// Start the service
const dataService = new DataService();
dataService.start();

// Export for testing
export default dataService;