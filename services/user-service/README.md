# StockAI 用户服务

StockAI智能股票投资助手平台的用户服务，负责用户认证、权限管理、模板偏好设置等功能。

## 🚀 快速开始

### 环境要求
- Node.js 18+ 
- PostgreSQL 14+
- Redis 6+
- Docker & Docker Compose (可选)

### 安装依赖
```bash
npm install
```

### 环境配置
```bash
# 复制环境变量模板
cp .env.example .env

# 编辑环境变量
vi .env
```

### 启动服务
```bash
# 开发模式
npm run dev

# 生产模式
npm run build
npm start
```

## 📁 项目结构

```
src/
├── config/           # 配置文件
│   ├── env.ts       # 环境变量管理
│   ├── database.ts  # PostgreSQL连接
│   └── redis.ts     # Redis连接
├── models/          # 数据模型
│   ├── user.types.ts # 类型定义
│   └── user.model.ts # 用户数据操作
├── services/        # 业务服务
│   └── auth.service.ts # 认证服务
├── controllers/     # 控制器
│   └── user.controller.ts # 用户控制器
├── validators/      # 验证器
│   └── user.validator.ts # 请求验证
├── middlewares/     # 中间件
│   ├── errorHandler.ts   # 错误处理
│   ├── auth.middleware.ts # 认证中间件
│   ├── requestLogger.ts  # 请求日志
│   └── rateLimiter.ts    # 速率限制
├── utils/           # 工具函数
│   └── logger.ts    # 日志系统
├── routes/          # 路由定义
│   └── api.ts       # API路由
└── index.ts         # 应用入口
```

## 🔐 认证系统

### JWT令牌
- **访问令牌**: 15分钟有效期
- **刷新令牌**: 7天有效期（存储在Redis）
- **令牌黑名单**: 已撤销的访问令牌

### 认证流程
1. 用户注册或登录获取访问令牌和刷新令牌
2. 访问令牌过期后使用刷新令牌获取新访问令牌
3. 用户注销时令牌被加入黑名单

## 🎨 模板偏好系统（核心功能）

### 模板类型
支持6种专业的股票信息展示模板：

| 类型 | 描述 | 默认模板 |
|------|------|----------|
| `stock_info` | 股票基本信息 | `简洁版` |
| `analysis` | 技术分析报告 | `技术分析版` |
| `report` | 详细分析报告 | `详细版` |
| `comparison` | 股票对比分析 | `基础对比版` |
| `portfolio` | 投资组合视图 | `组合概览版` |
| `alert` | 提醒通知模板 | `标准提醒版` |

### 用户偏好管理
用户可以为每种模板类型设置：
1. **默认模板**: 选择系统预设的模板
2. **自定义配置**: JSON格式的个性化配置

### API端点
- `GET /api/users/me/templates` - 获取模板偏好
- `PUT /api/users/me/templates` - 更新模板偏好

**请求示例**:
```json
{
  "type": "stock_info",
  "templateId": "详细版",
  "customConfig": {
    "showAdvancedMetrics": true,
    "chartType": "candlestick",
    "timeframe": "1d"
  }
}
```

## 📡 API端点

### 公共端点
| 方法 | 端点 | 描述 | 速率限制 |
|------|------|------|----------|
| POST | `/api/auth/register` | 用户注册 | 10次/24小时 |
| POST | `/api/auth/login` | 用户登录 | 5次/15分钟 |
| POST | `/api/auth/refresh` | 刷新令牌 | 100次/小时 |
| GET  | `/api/health` | 健康检查 | 无限制 |

### 受保护端点（需要认证）
| 方法 | 端点 | 描述 | 权限 |
|------|------|------|------|
| GET  | `/api/users/me` | 获取当前用户信息 | 所有用户 |
| PUT  | `/api/users/me` | 更新用户信息 | 所有用户 |
| POST | `/api/auth/logout` | 用户注销 | 所有用户 |
| GET  | `/api/users/me/templates` | 获取模板偏好 | 所有用户 |
| PUT  | `/api/users/me/templates` | 更新模板偏好 | 所有用户 |
| POST | `/api/users/me/api-keys` | 生成API密钥 | 所有用户 |

### 管理员端点
| 方法 | 端点 | 描述 | 权限 |
|------|------|------|------|
| GET  | `/api/admin/users` | 获取用户列表 | 管理员 |
| DELETE | `/api/users/:id` | 删除用户 | 管理员或用户本人 |

## 🛡️ 安全特性

### 多层速率限制
1. **全局限制**: 100次/15分钟（每个IP）
2. **用户限制**: 500次/小时（每个用户）
3. **认证限制**: 5次/15分钟（登录/注册）
4. **API密钥限制**: 1000次/小时（每个API密钥）

### 密码安全
- bcrypt加密（12轮盐值）
- 密码强度验证（大小写字母+数字）
- 账户锁定机制（5次失败尝试锁定15分钟）

### 日志系统
- **审计日志**: 重要操作记录
- **安全日志**: 安全事件记录
- **性能日志**: 请求性能监控
- **业务日志**: 业务操作记录

## 🧪 测试

### 运行测试
```bash
# 运行所有测试
npm test

# 运行测试并监控覆盖率
npm run test:coverage

# 监控模式运行测试
npm run test:watch
```

### 测试覆盖率要求
- 语句覆盖率: ≥ 70%
- 分支覆盖率: ≥ 70%
- 函数覆盖率: ≥ 70%
- 行覆盖率: ≥ 70%

## 🐳 Docker部署

### 使用Docker Compose
```bash
# 启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f user-service

# 停止服务
docker-compose down
```

### Docker镜像构建
```bash
# 构建镜像
docker build -t stock-ai/user-service:latest .

# 运行容器
docker run -p 3000:3000 --env-file .env stock-ai/user-service:latest
```

## 📊 数据库

### PostgreSQL表结构
```sql
-- 用户表
CREATE TABLE users (
    id UUID PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    auth_type VARCHAR(20) DEFAULT 'email',
    email_verified BOOLEAN DEFAULT FALSE,
    phone_verified BOOLEAN DEFAULT FALSE,
    display_name VARCHAR(100),
    avatar_url TEXT,
    bio TEXT,
    location VARCHAR(100),
    role VARCHAR(20) DEFAULT 'user',
    status VARCHAR(20) DEFAULT 'active',
    permissions JSONB DEFAULT '[]',
    preferences JSONB DEFAULT '{}', -- 包含模板偏好
    last_login_at TIMESTAMP,
    last_login_ip VARCHAR(45),
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);
```

### 数据库迁移
```bash
# 运行迁移
npm run db:migrate

# 运行种子数据
npm run db:seed
```

## 🔧 环境变量

| 变量名 | 描述 | 默认值 |
|--------|------|--------|
| `NODE_ENV` | 运行环境 | `development` |
| `PORT` | 服务端口 | `3000` |
| `DATABASE_URL` | 数据库连接URL | - |
| `REDIS_URL` | Redis连接URL | - |
| `JWT_SECRET` | JWT密钥 | - |
| `BCRYPT_SALT_ROUNDS` | 密码加密强度 | `12` |
| `LOG_LEVEL` | 日志级别 | `info` |
| `CORS_ORIGIN` | CORS允许的源 | `http://localhost:3000,http://localhost:8080` |

## 📈 监控和日志

### 健康检查
```bash
# 健康检查端点
curl http://localhost:3000/api/health

# 响应示例
{
  "status": "healthy",
  "service": "user-service",
  "timestamp": "2026-03-15T10:00:00.000Z",
  "uptime": 1234.56
}
```

### 日志文件
- `logs/error-*.log` - 错误日志
- `logs/combined-*.log` - 所有日志
- `logs/audit-*.log` - 审计日志

## 🚨 错误处理

### 错误响应格式
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "错误描述",
    "timestamp": "2026-03-15T10:00:00.000Z",
    "requestId": "req-123456",
    "path": "/api/users/me"
  }
}
```

### 常见错误码
- `VALIDATION_ERROR` - 请求参数验证失败
- `AUTHENTICATION_ERROR` - 认证失败
- `AUTHORIZATION_ERROR` - 权限不足
- `NOT_FOUND_ERROR` - 资源不存在
- `CONFLICT_ERROR` - 资源冲突
- `RATE_LIMIT_ERROR` - 请求过于频繁

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 📞 支持

- 问题报告: [GitHub Issues](https://github.com/yabolee-kkk/stock-ai-platform/issues)
- 文档: [项目文档](https://github.com/yabolee-kkk/stock-ai-platform/docs)
- 讨论: [GitHub Discussions](https://github.com/yabolee-kkk/stock-ai-platform/discussions)