import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config();

interface AppConfig {
  server: {
    port: number;
    nodeEnv: string;
  };
  database: {
    url: string;
  };
  redis: {
    url: string;
  };
  dataSources: {
    eastmoney: {
      baseUrl: string;
    };
    sina: {
      baseUrl: string;
    };
  };
  cache: {
    ttlSeconds: number;
    maxEntries: number;
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
  logging: {
    level: string;
    filePath: string;
  };
}

const config: AppConfig = {
  server: {
    port: parseInt(process.env.PORT || '3001', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
  },
  database: {
    url: process.env.DATABASE_URL || 'postgresql://stockai:stockai_password@localhost:5432/stockai_platform',
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  dataSources: {
    eastmoney: {
      baseUrl: process.env.EASTMONEY_API_BASE || 'https://quote.eastmoney.com',
    },
    sina: {
      baseUrl: process.env.SINA_API_BASE || 'https://hq.sinajs.cn',
    },
  },
  cache: {
    ttlSeconds: parseInt(process.env.CACHE_TTL_SECONDS || '300', 10),
    maxEntries: parseInt(process.env.MAX_CACHE_ENTRIES || '1000', 10),
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '60', 10),
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    filePath: process.env.LOG_FILE_PATH || 'logs/data-service.log',
  },
};

// Validate required configuration
const validateConfig = () => {
  const requiredEnvVars = [];
  
  if (!process.env.DATABASE_URL) {
    requiredEnvVars.push('DATABASE_URL');
  }
  
  if (requiredEnvVars.length > 0) {
    console.warn(`Warning: Missing required environment variables: ${requiredEnvVars.join(', ')}`);
    console.warn('Using default values which may not work in production.');
  }
};

validateConfig();

export default config;