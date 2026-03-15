/**
 * 测试环境配置
 * @description Jest测试环境全局配置
 * @author StockAI开发团队
 * @created 2026-03-15
 */

// 设置测试环境变量
process.env.NODE_ENV = 'test';
process.env.PORT = '0';
process.env.LOG_LEVEL = 'error';

// 模拟环境变量
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only';
process.env.JWT_ACCESS_EXPIRY = '15m';
process.env.JWT_REFRESH_EXPIRY = '7d';
process.env.JWT_ISSUER = 'stock-ai-platform-test';
process.env.BCRYPT_SALT_ROUNDS = '10';

// 清除模块缓存
beforeEach(() => {
  jest.resetModules();
});

// 全局测试超时
jest.setTimeout(10000);

// 全局模拟console，避免测试输出污染
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// 模拟日期
const mockDate = new Date('2026-03-15T10:00:00.000Z');
global.Date.now = jest.fn(() => mockDate.getTime());
global.Date.prototype.getTime = jest.fn(function() {
  return mockDate.getTime();
});

// 模拟UUID
jest.mock('crypto', () => ({
  randomUUID: jest.fn(() => 'mock-uuid-1234-5678-9012'),
  randomBytes: jest.fn(() => Buffer.from('mock-bytes')),
}));

// 模拟bcrypt
jest.mock('bcrypt', () => ({
  hash: jest.fn(() => Promise.resolve('$2b$10$mockhash')),
  compare: jest.fn(() => Promise.resolve(true)),
}));

// 模拟Redis
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn(() => Promise.resolve()),
    quit: jest.fn(() => Promise.resolve()),
    isOpen: true,
    on: jest.fn(),
    get: jest.fn(() => Promise.resolve(null)),
    set: jest.fn(() => Promise.resolve()),
    setEx: jest.fn(() => Promise.resolve()),
    del: jest.fn(() => Promise.resolve()),
    exists: jest.fn(() => Promise.resolve(0)),
    expire: jest.fn(() => Promise.resolve()),
    ttl: jest.fn(() => Promise.resolve(-1)),
    incrBy: jest.fn(() => Promise.resolve(1)),
    ping: jest.fn(() => Promise.resolve()),
    flushDb: jest.fn(() => Promise.resolve()),
  })),
}));

// 模拟PostgreSQL
jest.mock('pg', () => {
  const mockClient = {
    connect: jest.fn(() => Promise.resolve()),
    release: jest.fn(),
    query: jest.fn(() => Promise.resolve({ rows: [], rowCount: 0 })),
  };

  const mockPool = {
    connect: jest.fn(() => Promise.resolve(mockClient)),
    query: jest.fn(() => Promise.resolve({ rows: [], rowCount: 0 })),
    end: jest.fn(() => Promise.resolve()),
    on: jest.fn(),
  };

  return {
    Pool: jest.fn(() => mockPool),
  };
});

// 模拟JWT
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(() => 'mock.jwt.token'),
  verify: jest.fn(() => ({
    userId: 'test-user-id',
    username: 'testuser',
    email: 'test@example.com',
    role: 'user',
    type: 'access',
  })),
  decode: jest.fn(() => ({
    userId: 'test-user-id',
    exp: Math.floor(Date.now() / 1000) + 900,
  })),
}));

// 在每个测试后清理模拟
afterEach(() => {
  jest.clearAllMocks();
});

// 在所有测试后清理
afterAll(() => {
  jest.restoreAllMocks();
});