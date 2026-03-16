# Data Service - StockAI Platform

数据服务是StockAI平台的核心组件，负责股票数据的获取、缓存和提供API接口。

## 🚀 功能特性

- **实时股票数据**：从东方财富、新浪财经等免费数据源获取实时行情
- **批量查询**：支持一次性查询多只股票数据
- **智能缓存**：5分钟内存缓存，减少API调用频率
- **搜索功能**：支持股票代码和名称搜索
- **健康检查**：服务状态监控和自检
- **缓存管理**：缓存统计和清理功能

## 📁 项目结构

```
data-service/
├── src/
│   ├── config/          # 配置文件
│   │   └── env.ts       # 环境变量配置
│   ├── controllers/     # 控制器
│   │   └── stock.controller.ts
│   ├── middlewares/     # 中间件
│   │   └── errorHandler.ts
│   ├── routes/          # 路由定义
│   │   └── api.ts
│   ├── services/        # 业务逻辑
│   │   └── data-fetcher.service.ts
│   ├── utils/           # 工具类
│   │   └── logger.ts
│   └── index.ts         # 服务入口
├── scripts/             # 脚本文件
├── tests/               # 测试文件
├── .env.example         # 环境变量示例
├── package.json         # 依赖配置
├── tsconfig.json        # TypeScript配置
├── .eslintrc.json       # ESLint配置
└── README.md            # 本文档
```

## 🛠️ 快速开始

### 1. 安装依赖
```bash
cd services/data-service
npm install
```

### 2. 配置环境变量
```bash
cp .env.example .env
# 编辑 .env 文件，根据需要修改配置
```

### 3. 启动服务
```bash
# 开发模式（热重载）
npm run dev

# 生产模式
npm run build
npm start
```

## 🌐 API 接口

### 获取单只股票数据
```
GET /api/stocks/:code
```

**示例：**
```bash
curl http://localhost:3001/api/stocks/600418
```

**响应：**
```json
{
  "success": true,
  "data": {
    "code": "600418",
    "name": "江淮汽车",
    "current": 51.27,
    "change": 0.12,
    "changePercent": 0.23,
    "high": 52.10,
    "low": 50.80,
    "open": 51.15,
    "close": 51.15,
    "volume": 1234567,
    "amount": 63200000,
    "timestamp": "2026-03-16T09:19:00.000Z",
    "market": "sh"
  },
  "timestamp": "2026-03-16T09:19:45.123Z"
}
```

### 批量获取股票数据
```
GET /api/stocks/batch?codes=600418,002475,600126
```

**示例：**
```bash
curl "http://localhost:3001/api/stocks/batch?codes=600418,002475"
```

### 搜索股票
```
GET /api/stocks/search?q=江淮
```

### 缓存统计
```
GET /api/stocks/cache/stats
```

### 清理缓存
```
DELETE /api/stocks/cache
DELETE /api/stocks/cache?code=600418
```

### 健康检查
```
GET /api/stocks/health
GET /health
```

## ⚙️ 配置说明

### 环境变量
| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| PORT | 3001 | 服务端口 |
| NODE_ENV | development | 运行环境 |
| DATABASE_URL | postgresql://... | PostgreSQL连接字符串 |
| REDIS_URL | redis://localhost:6379 | Redis连接字符串 |
| EASTMONEY_API_BASE | https://quote.eastmoney.com | 东方财富API地址 |
| SINA_API_BASE | https://hq.sinajs.cn | 新浪财经API地址 |
| CACHE_TTL_SECONDS | 300 | 缓存有效期（秒） |
| MAX_CACHE_ENTRIES | 1000 | 最大缓存条目数 |

### 数据源策略
1. **优先使用东方财富API**：稳定性和数据质量较好
2. **新浪财经作为备用**：当东方财富不可用时自动切换
3. **智能缓存**：相同股票5分钟内不会重复请求

## 🧪 测试

```bash
# 运行测试
npm test

# 测试覆盖率
npm run test:coverage

# 监视模式
npm run test:watch
```

## 📊 监控指标

服务提供以下监控端点：
- `/health` - 基础健康检查
- `/api/stocks/health` - 详细健康状态（含数据源测试）
- `/api/stocks/cache/stats` - 缓存统计信息

## 🔧 开发指南

### 添加新的数据源
1. 在 `src/services/data-fetcher.service.ts` 中添加新的获取方法
2. 在配置中添加相应的环境变量
3. 更新 `getStockData` 方法以使用新数据源

### 扩展数据字段
1. 更新 `StockData` 接口定义
2. 修改所有数据源解析逻辑
3. 更新API响应格式

### 性能优化
- 调整 `CACHE_TTL_SECONDS` 优化缓存策略
- 使用Redis替代内存缓存（需实现）
- 实现数据预加载机制

## 🐛 故障排除

### 常见问题
1. **数据获取失败**
   - 检查网络连接
   - 确认数据源API是否可用
   - 查看服务日志

2. **缓存不生效**
   - 检查 `CACHE_TTL_SECONDS` 设置
   - 确认缓存是否已满（查看统计信息）

3. **服务启动失败**
   - 检查端口是否被占用
   - 确认环境变量配置正确
   - 查看启动日志

### 日志查看
```bash
# 查看服务日志
tail -f logs/data-service.log

# 查看错误日志
tail -f logs/exceptions.log
```

## 📈 未来规划

- [ ] Redis缓存支持
- [ ] 历史数据存储和查询
- [ ] 数据源监控和自动切换
- [ ] WebSocket实时推送
- [ ] 数据质量评估
- [ ] 多语言支持

## 📄 许可证

MIT License

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 开启 Pull Request