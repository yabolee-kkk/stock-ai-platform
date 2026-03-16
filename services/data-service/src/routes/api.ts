import express from 'express';
import stockController from '../controllers/stock.controller';
import logger from '../utils/logger';

const router = express.Router();

// Log all requests
router.use((req, res, next) => {
  logger.debug(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  next();
});

// Health check (must be before /stocks/:code to avoid route conflict)
router.get('/stocks/health', stockController.healthCheck);

// Cache management routes
router.get('/stocks/cache/stats', stockController.getCacheStats);
router.delete('/stocks/cache', stockController.clearCache);

// Stock data routes
router.get('/stocks/:code', stockController.getStock);
router.get('/stocks/batch', stockController.getBatchStocks);
router.get('/stocks/search', stockController.searchStocks);

// Root endpoint
router.get('/', (req, res) => {
  res.json({
    service: 'StockAI Data Service',
    version: '0.1.0',
    endpoints: {
      '/api/stocks/health': 'Service health check',
      '/api/stocks/cache/stats': 'Get cache statistics',
      '/api/stocks/cache': 'Clear cache (DELETE, query: code=600418 optional)',
      '/api/stocks/:code': 'Get single stock data',
      '/api/stocks/batch': 'Get batch stock data (query: codes=600418,002475)',
      '/api/stocks/search': 'Search stocks (query: q=江淮)',
    },
    documentation: 'https://github.com/yabolee-kkk/stock-ai-platform',
  });
});

// 404 handler
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.originalUrl,
  });
});

export default router;