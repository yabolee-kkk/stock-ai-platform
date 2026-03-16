import axios from 'axios';
import NodeCache from 'node-cache';
import logger from '../utils/logger';
import config from '../config/env';

// Define stock data interface
export interface StockData {
  code: string;
  name: string;
  current: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  close: number;
  volume: number;
  amount: number;
  timestamp: Date;
  market: string;
}

export interface BatchStockData {
  [code: string]: StockData | null;
}

// Cache configuration
const cache = new NodeCache({
  stdTTL: config.cache.ttlSeconds,
  checkperiod: 60,
  maxKeys: config.cache.maxEntries,
});

class DataFetcherService {
  private eastmoneyBaseUrl: string;
  private sinaBaseUrl: string;

  constructor() {
    this.eastmoneyBaseUrl = config.dataSources.eastmoney.baseUrl;
    this.sinaBaseUrl = config.dataSources.sina.baseUrl;
    logger.info('DataFetcherService initialized');
  }

  /**
   * Get single stock data
   */
  async getStockData(code: string): Promise<StockData | null> {
    // Check cache first
    const cacheKey = `stock_${code}`;
    const cachedData = cache.get<StockData>(cacheKey);
    if (cachedData) {
      logger.debug(`Cache hit for stock: ${code}`);
      return cachedData;
    }

    logger.debug(`Fetching stock data for: ${code}`);
    
    try {
      // Try EastMoney API first
      const data = await this.fetchFromEastMoney(code);
      if (data) {
        // Cache the result
        cache.set(cacheKey, data);
        return data;
      }

      // Fallback to Sina API
      const sinaData = await this.fetchFromSina(code);
      if (sinaData) {
        cache.set(cacheKey, sinaData);
        return sinaData;
      }

      logger.warn(`Failed to fetch data for stock: ${code}`);
      return null;
    } catch (error) {
      logger.error(`Error fetching stock data for ${code}:`, error);
      return null;
    }
  }

  /**
   * Get batch stock data
   */
  async getBatchStockData(codes: string[]): Promise<BatchStockData> {
    const result: BatchStockData = {};
    const uncachedCodes: string[] = [];
    
    // Check cache for each code
    for (const code of codes) {
      const cacheKey = `stock_${code}`;
      const cachedData = cache.get<StockData>(cacheKey);
      if (cachedData) {
        result[code] = cachedData;
      } else {
        uncachedCodes.push(code);
      }
    }

    // Fetch uncached codes in parallel
    if (uncachedCodes.length > 0) {
      logger.debug(`Fetching batch data for ${uncachedCodes.length} uncached stocks`);
      
      const fetchPromises = uncachedCodes.map(code => this.getStockData(code));
      const fetchedData = await Promise.all(fetchPromises);
      
      // Combine results
      uncachedCodes.forEach((code, index) => {
        result[code] = fetchedData[index];
      });
    }

    return result;
  }

  /**
   * Search stocks by keyword
   */
  async searchStocks(keyword: string): Promise<StockData[]> {
    logger.debug(`Searching stocks with keyword: ${keyword}`);
    
    // For now, implement a simple search
    // In production, this would query a database or external API
    const mockResults: StockData[] = [
      {
        code: '600418',
        name: '江淮汽车',
        current: 51.27,
        change: 0.12,
        changePercent: 0.23,
        high: 52.10,
        low: 50.80,
        open: 51.15,
        close: 51.15,
        volume: 1234567,
        amount: 63200000,
        timestamp: new Date(),
        market: 'sh',
      },
      {
        code: '002475',
        name: '立讯精密',
        current: 32.45,
        change: -0.35,
        changePercent: -1.07,
        high: 33.20,
        low: 32.10,
        open: 32.80,
        close: 32.80,
        volume: 2345678,
        amount: 76100000,
        timestamp: new Date(),
        market: 'sz',
      },
    ];

    // Filter by keyword (case-insensitive)
    const filteredResults = mockResults.filter(stock =>
      stock.code.includes(keyword) ||
      stock.name.toLowerCase().includes(keyword.toLowerCase())
    );

    return filteredResults;
  }

  /**
   * Clear cache for specific stock or all cache
   */
  clearCache(code?: string): void {
    if (code) {
      const cacheKey = `stock_${code}`;
      cache.del(cacheKey);
      logger.debug(`Cleared cache for stock: ${code}`);
    } else {
      cache.flushAll();
      logger.debug('Cleared all cache');
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    hits: number;
    misses: number;
    keys: number;
    size: number;
  } {
    const stats = cache.getStats();
    return {
      hits: stats.hits,
      misses: stats.misses,
      keys: stats.keys,
      size: stats.ksize,
    };
  }

  /**
   * Fetch stock data from EastMoney API
   * 注意：由于外部API限制，目前返回模拟数据
   */
  private async fetchFromEastMoney(code: string): Promise<StockData | null> {
    logger.debug(`Fetching mock data for stock: ${code} (EastMoney API simulation)`);
    
    // 直接返回模拟数据，避免外部API调用失败
    // TODO: 未来可以切换回真实API调用
    const mockData: StockData = {
      code,
      name: this.getStockNameByCode(code),
      current: 51.27 + Math.random() * 2 - 1,
      change: 0.12,
      changePercent: 0.23,
      high: 52.10,
      low: 50.80,
      open: 51.15,
      close: 51.15,
      volume: Math.floor(Math.random() * 1000000) + 500000,
      amount: Math.floor(Math.random() * 50000000) + 30000000,
      timestamp: new Date(),
      market: code.startsWith('6') ? 'sh' : 'sz',
    };

    return mockData;
  }

  /**
   * Fetch stock data from Sina API (fallback)
   * 注意：由于外部API限制，目前返回模拟数据
   */
  private async fetchFromSina(code: string): Promise<StockData | null> {
    logger.debug(`Fetching mock data for stock: ${code} (Sina API simulation)`);
    
    // 直接返回模拟数据，避免外部API调用失败
    // TODO: 未来可以切换回真实API调用
    const mockData: StockData = {
      code,
      name: this.getStockNameByCode(code),
      current: 51.27,
      change: 0.12,
      changePercent: 0.23,
      high: 52.10,
      low: 50.80,
      open: 51.15,
      close: 51.15,
      volume: 1234567,
      amount: 63200000,
      timestamp: new Date(),
      market: code.startsWith('6') ? 'sh' : 'sz',
    };

    return mockData;
  }

  /**
   * Helper method to get stock name by code
   */
  private getStockNameByCode(code: string): string {
    const stockMap: Record<string, string> = {
      '600418': '江淮汽车',
      '002475': '立讯精密',
      '600126': '杭钢股份',
      '300450': '先导智能',
      '300520': '科大国创',
      '003029': '吉大正元',
      '002456': '欧菲光',
      '000158': '常山北明',
      '002130': '沃尔核材',
      '600089': '特变电工',
      '300409': '道氏技术',
      '600111': '北方稀土',
      '000831': '中国稀土',
      '002436': '兴森科技',
      '300042': '朗科科技',
      '002463': '沪电股份',
      '002050': '三花智控',
      '600410': '华胜天成',
      '603009': '北特科技',
    };

    return stockMap[code] || `股票${code}`;
  }
}

export default new DataFetcherService();