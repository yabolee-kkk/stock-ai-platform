#!/bin/bash

# StockAI用户服务启动脚本
# 用法: ./scripts/start.sh [dev|prod|docker]

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查命令是否存在
check_command() {
    if ! command -v $1 &> /dev/null; then
        print_error "命令 '$1' 未找到，请先安装"
        exit 1
    fi
}

# 开发模式启动
start_dev() {
    print_info "启动开发模式..."
    
    # 检查环境变量
    if [ ! -f .env ]; then
        print_warning "未找到 .env 文件，正在从 .env.example 创建..."
        cp .env.example .env
        print_info "请编辑 .env 文件并设置正确的配置"
    fi
    
    # 安装依赖
    print_info "安装依赖..."
    npm install
    
    # 启动开发服务器
    print_info "启动开发服务器..."
    npm run dev
}

# 生产模式启动
start_prod() {
    print_info "启动生产模式..."
    
    # 检查环境变量
    if [ ! -f .env ]; then
        print_error "生产环境需要 .env 文件"
        print_info "请从 .env.example 创建并配置 .env 文件"
        exit 1
    fi
    
    # 构建
    print_info "构建项目..."
    npm run build
    
    # 启动生产服务器
    print_info "启动生产服务器..."
    npm start
}

# Docker模式启动
start_docker() {
    print_info "使用Docker启动..."
    
    # 检查Docker
    check_command docker
    check_command docker-compose
    
    # 检查Docker Compose文件
    if [ ! -f docker-compose.dev.yml ]; then
        print_error "未找到 docker-compose.dev.yml 文件"
        exit 1
    fi
    
    # 启动服务
    print_info "启动Docker服务..."
    docker-compose -f docker-compose.dev.yml up -d
    
    # 显示状态
    print_info "服务状态:"
    docker-compose -f docker-compose.dev.yml ps
    
    print_success "服务已启动!"
    print_info "用户服务: http://localhost:3000"
    print_info "健康检查: http://localhost:3000/api/health"
    print_info "API文档: http://localhost:3000/api/docs"
    print_info "pgAdmin: http://localhost:5050 (admin@stockai.local / admin123)"
    print_info "Redis Commander: http://localhost:8081"
}

# 数据库迁移
run_migrations() {
    print_info "运行数据库迁移..."
    
    if [ ! -f .env ]; then
        print_error "需要 .env 文件来连接数据库"
        exit 1
    fi
    
    # 运行迁移
    npm run db:migrate
    
    print_success "数据库迁移完成!"
}

# 运行测试
run_tests() {
    print_info "运行测试..."
    
    # 运行测试
    npm test
    
    # 运行覆盖率测试
    print_info "生成测试覆盖率报告..."
    npm run test:coverage
    
    print_success "测试完成!"
}

# 清理
cleanup() {
    print_info "清理..."
    
    # 停止Docker服务
    if [ -f docker-compose.dev.yml ]; then
        docker-compose -f docker-compose.dev.yml down
    fi
    
    # 清理构建文件
    rm -rf dist
    rm -rf coverage
    rm -rf logs/*
    
    print_success "清理完成!"
}

# 显示帮助
show_help() {
    echo "StockAI用户服务管理脚本"
    echo ""
    echo "用法: $0 [命令]"
    echo ""
    echo "命令:"
    echo "  dev         启动开发模式"
    echo "  prod        启动生产模式"
    echo "  docker      使用Docker启动"
    echo "  migrate     运行数据库迁移"
    echo "  test        运行测试"
    echo "  clean       清理构建文件和Docker容器"
    echo "  help        显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  $0 dev      启动开发服务器"
    echo "  $0 docker   使用Docker启动所有服务"
    echo "  $0 test     运行测试"
}

# 主函数
main() {
    case "$1" in
        dev)
            start_dev
            ;;
        prod)
            start_prod
            ;;
        docker)
            start_docker
            ;;
        migrate)
            run_migrations
            ;;
        test)
            run_tests
            ;;
        clean)
            cleanup
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            print_error "未知命令: $1"
            echo ""
            show_help
            exit 1
            ;;
    esac
}

# 执行主函数
main "$@"