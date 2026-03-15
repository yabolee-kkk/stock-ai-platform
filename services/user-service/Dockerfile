# 生产环境Dockerfile - 多阶段构建
FROM node:18-alpine AS builder

# 设置工作目录
WORKDIR /app

# 安装系统依赖
RUN apk add --no-cache \
    python3 \
    make \
    g++

# 复制package.json和package-lock.json
COPY package*.json ./

# 安装所有依赖（包括开发依赖，用于构建）
RUN npm ci --only=production

# 复制源代码
COPY . .

# 构建TypeScript代码
RUN npm run build

# 清理开发依赖
RUN npm prune --production

# 运行时阶段
FROM node:18-alpine AS runtime

# 设置工作目录
WORKDIR /app

# 安装运行时依赖
RUN apk add --no-cache \
    postgresql-client \
    curl

# 创建非root用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# 从构建阶段复制文件
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/.env.example ./

# 创建日志目录
RUN mkdir -p /app/logs && \
    chown -R nodejs:nodejs /app/logs

# 切换到非root用户
USER nodejs

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# 生产环境启动命令
CMD ["node", "dist/index.js"]