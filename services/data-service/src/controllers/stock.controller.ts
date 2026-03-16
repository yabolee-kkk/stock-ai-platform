import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import dataFetcherService, { BatchStockData, StockData } from '../services/data-fetcher.service';
import logger from '../utils/logger';

class StockController {
  /**
   * Get single stock data
   * GET /api/stocks/:code
   */
  async getStock(req: Request, res: Response): Promise<void> {
    try {
      const { code } = req.params;
      
      // Validate stock code
      if (!code || !/^\d{6}$/.test(code)) {
        res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          error: 'Invalid stock code format. Should be 6 digits.',
        });
        return;
      }

      logger.info(`Fetching stock data for: ${code}`);
      const stockData = await dataFetcherService.getStockData(code);

      if (!stockData) {
        res.status(StatusCodes.NOT_FOUND).json({
          success: false,
          error: `Stock data not found for code: ${code}`,
        });
        return;
      }

      res.status(StatusCodes.OK).json({
        success: true,
        data: stockData,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error in getStock:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Get batch stock data
   * GET /api/stocks/batch?codes=600418,002475,600126
   */
  async getBatchStocks(req: Request, res: Response): Promise<void> {
    try {
      const { codes } = req.query;
      
      if (!codes || typeof codes !== 'string') {
        res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          error: 'Missing or invalid codes parameter',
        });
        return;
      }

      const codeList = codes.split(',').map(code => code.trim());
      
      // Validate each code
      const invalidCodes = codeList.filter(code => !/^\d{6}$/.test(code));
      if (invalidCodes.length > 0) {
        res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          error: `Invalid stock codes: ${invalidCodes.join(', ')}`,
        });
        return;
      }

      // Limit batch size
      if (codeList.length > 50) {
        res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          error: 'Batch size limit exceeded. Maximum 50 stocks per request.',
        });
        return;
      }

      logger.info(`Fetching batch stock data for ${codeList.length} stocks`);
      const batchData = await dataFetcherService.getBatchStockData(codeList);

      // Calculate statistics
      const totalCodes = codeList.length;
      const successfulCodes = Object.values(batchData).filter(data => data !== null).length;
      const failedCodes = totalCodes - successfulCodes;

      res.status(StatusCodes.OK).json({
        success: true,
        data: batchData,
        metadata: {
          total: totalCodes,
          successful: successfulCodes,
          failed: failedCodes,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error('Error in getBatchStocks:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Search stocks
   * GET /api/stocks/search?q=江淮
   */
  async searchStocks(req: Request, res: Response): Promise<void> {
    try {
      const { q } = req.query;
      
      if (!q || typeof q !== 'string') {
        res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          error: 'Missing or invalid search query',
        });
        return;
      }

      // Validate query length
      if (q.length < 2) {
        res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          error: 'Search query must be at least 2 characters',
        });
        return;
      }

      logger.info(`Searching stocks with query: ${q}`);
      const results = await dataFetcherService.searchStocks(q);

      res.status(StatusCodes.OK).json({
        success: true,
        data: results,
        metadata: {
          count: results.length,
          query: q,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error('Error in searchStocks:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Get cache statistics
   * GET /api/stocks/cache/stats
   */
  async getCacheStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = dataFetcherService.getCacheStats();
      
      res.status(StatusCodes.OK).json({
        success: true,
        data: stats,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error in getCacheStats:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Clear cache
   * DELETE /api/stocks/cache?code=600418 (optional)
   */
  async clearCache(req: Request, res: Response): Promise<void> {
    try {
      const { code } = req.query;
      
      if (code && typeof code !== 'string') {
        res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          error: 'Invalid code parameter',
        });
        return;
      }

      if (code && !/^\d{6}$/.test(code)) {
        res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          error: 'Invalid stock code format',
        });
        return;
      }

      const stockCode = code as string | undefined;
      dataFetcherService.clearCache(stockCode);

      const message = stockCode 
        ? `Cache cleared for stock: ${stockCode}`
        : 'All cache cleared';

      logger.info(message);
      res.status(StatusCodes.OK).json({
        success: true,
        message,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error in clearCache:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Health check endpoint
   * GET /api/stocks/health
   */
  async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      // Test data fetching with a known stock
      const testCode = '600418'; // 江淮汽车
      const testData = await dataFetcherService.getStockData(testCode);
      
      const healthStatus = {
        status: 'healthy',
        service: 'data-service',
        timestamp: new Date().toISOString(),
        version: '0.1.0',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cache: dataFetcherService.getCacheStats(),
        dataSource: testData ? 'operational' : 'degraded',
      };

      const statusCode = testData ? StatusCodes.OK : StatusCodes.SERVICE_UNAVAILABLE;
      
      res.status(statusCode).json({
        success: !!testData,
        data: healthStatus,
      });
    } catch (error) {
      logger.error('Error in healthCheck:', error);
      res.status(StatusCodes.SERVICE_UNAVAILABLE).json({
        success: false,
        error: 'Service unhealthy',
      });
    }
  }
}

export default new StockController();