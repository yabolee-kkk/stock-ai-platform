-- StockAI-Platform 数据库初始化脚本
-- 创建时间: 2026-03-15
-- 版本: 1.0.0

-- 创建扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 创建用户表
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    subscription_tier VARCHAR(50) DEFAULT 'free',
    subscription_expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_subscription ON users(subscription_tier, subscription_expires_at);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- 创建用户会话表
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    device_info JSONB,
    ip_address INET,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    INDEX idx_user_sessions_user_id (user_id),
    INDEX idx_user_sessions_expires_at (expires_at)
);

-- 创建API密钥表
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    key_hash VARCHAR(255) UNIQUE NOT NULL,
    scopes JSONB NOT NULL DEFAULT '[]',
    rate_limit INTEGER DEFAULT 1000,
    is_active BOOLEAN DEFAULT TRUE,
    last_used_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    INDEX idx_api_keys_user_id (user_id),
    INDEX idx_api_keys_key_hash (key_hash)
);

-- 创建股票基本信息表
CREATE TABLE IF NOT EXISTS stocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    market VARCHAR(10) NOT NULL, -- 'SH'/'SZ'/'HK'/'US'
    industry VARCHAR(100),
    concept TEXT[],
    listing_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(symbol, market),
    INDEX idx_stocks_symbol (symbol),
    INDEX idx_stocks_market (market),
    INDEX idx_stocks_industry (industry)
);

-- 创建用户记忆表
CREATE TABLE IF NOT EXISTS user_memories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    memory_type VARCHAR(50) NOT NULL, -- 'query'/'attention'/'position'/'decision'/'preference'
    content JSONB NOT NULL,
    tags TEXT[],
    importance_score INTEGER DEFAULT 0,
    accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    INDEX idx_user_memories_user_id (user_id),
    INDEX idx_user_memories_memory_type (memory_type),
    INDEX idx_user_memories_created_at (created_at),
    INDEX idx_user_memories_tags USING GIN (tags)
);

-- 创建预警规则表
CREATE TABLE IF NOT EXISTS alert_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rule_type VARCHAR(50) NOT NULL, -- 'price'/'volume'/'technical'/'news'
    rule_config JSONB NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    last_triggered_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    INDEX idx_alert_rules_user_id (user_id),
    INDEX idx_alert_rules_is_active (is_active)
);

-- 创建模板配置表
CREATE TABLE IF NOT EXISTS template_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    template_type VARCHAR(50) NOT NULL, -- 'stock_info'/'analysis'/'report'
    template_name VARCHAR(100) NOT NULL,
    template_config JSONB NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, template_type, template_name),
    INDEX idx_template_configs_user_id (user_id),
    INDEX idx_template_configs_template_type (template_type)
);

-- 创建订阅套餐表
CREATE TABLE IF NOT EXISTS subscription_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price_monthly DECIMAL(10, 2) NOT NULL,
    price_yearly DECIMAL(10, 2),
    features JSONB NOT NULL,
    limits JSONB NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    INDEX idx_subscription_plans_is_active (is_active)
);

-- 创建用户订阅表
CREATE TABLE IF NOT EXISTS user_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES subscription_plans(id),
    status VARCHAR(20) DEFAULT 'active', -- 'active'/'canceled'/'expired'
    current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    INDEX idx_user_subscriptions_user_id (user_id),
    INDEX idx_user_subscriptions_status (status),
    INDEX idx_user_subscriptions_period_end (current_period_end)
);

-- 创建操作日志表
CREATE TABLE IF NOT EXISTS operation_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id VARCHAR(100),
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    INDEX idx_operation_logs_user_id (user_id),
    INDEX idx_operation_logs_action (action),
    INDEX idx_operation_logs_created_at (created_at)
);

-- 插入默认订阅套餐
INSERT INTO subscription_plans (name, description, price_monthly, price_yearly, features, limits, is_active) VALUES
(
    '免费版',
    '适合个人投资者试用',
    0.00,
    0.00,
    '{"basic_stock_info": true, "real_time_quotes": true, "basic_analysis": true, "price_alerts": true}',
    '{"api_calls_per_day": 100, "stocks_monitored": 10, "historical_data_days": 30, "alerts_count": 5}',
    true
),
(
    '专业版',
    '适合活跃投资者',
    99.00,
    990.00,
    '{"basic_stock_info": true, "real_time_quotes": true, "technical_analysis": true, "fundamental_analysis": true, "price_alerts": true, "volume_alerts": true, "news_alerts": true, "custom_templates": true}',
    '{"api_calls_per_day": 1000, "stocks_monitored": 50, "historical_data_days": 365, "alerts_count": 20, "custom_templates": 10}',
    true
),
(
    '高级版',
    '适合专业交易者',
    299.00,
    2990.00,
    '{"basic_stock_info": true, "real_time_quotes": true, "technical_analysis": true, "fundamental_analysis": true, "quantitative_analysis": true, "all_alerts": true, "custom_templates": true, "api_access": true, "priority_support": true}',
    '{"api_calls_per_day": 5000, "stocks_monitored": 200, "historical_data_years": 5, "alerts_count": 100, "custom_templates": 50}',
    true
)
ON CONFLICT DO NOTHING;

-- 插入默认模板配置
INSERT INTO template_configs (template_type, template_name, template_config, is_default, is_public) VALUES
(
    'stock_info',
    '简洁版',
    '{"sections": ["basic_info", "current_price", "daily_change"], "compact": true, "show_charts": false}',
    true,
    true
),
(
    'stock_info',
    '详细版',
    '{"sections": ["basic_info", "current_price", "daily_change", "trading_info", "company_info"], "compact": false, "show_charts": true}',
    false,
    true
),
(
    'analysis',
    '技术分析版',
    '{"sections": ["price_info", "technical_indicators", "chart_analysis", "trend_analysis"], "indicators": ["MA", "MACD", "RSI", "KDJ"]}',
    false,
    true
),
(
    'analysis',
    '基本面版',
    '{"sections": ["financial_data", "valuation", "profitability", "growth", "risk"], "metrics": ["pe_ratio", "pb_ratio", "roe", "revenue_growth"]}',
    false,
    true
)
ON CONFLICT DO NOTHING;

-- 创建更新时间触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为需要更新时间戳的表创建触发器
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_api_keys_updated_at BEFORE UPDATE ON api_keys FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_stocks_updated_at BEFORE UPDATE ON stocks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_memories_updated_at BEFORE UPDATE ON user_memories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_alert_rules_updated_at BEFORE UPDATE ON alert_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_template_configs_updated_at BEFORE UPDATE ON template_configs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_subscription_plans_updated_at BEFORE UPDATE ON subscription_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_subscriptions_updated_at BEFORE UPDATE ON user_subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 创建软删除视图
CREATE OR REPLACE VIEW active_users AS
SELECT * FROM users WHERE deleted_at IS NULL;

-- 注释表说明
COMMENT ON TABLE users IS '用户表，存储用户基本信息';
COMMENT ON TABLE user_sessions IS '用户会话表，存储登录会话信息';
COMMENT ON TABLE api_keys IS 'API密钥表，存储用户API访问密钥';
COMMENT ON TABLE stocks IS '股票基本信息表';
COMMENT ON TABLE user_memories IS '用户记忆表，存储用户行为记忆和偏好';
COMMENT ON TABLE alert_rules IS '预警规则表，存储用户设置的预警规则';
COMMENT ON TABLE template_configs IS '模板配置表，存储信息展示模板配置';
COMMENT ON TABLE subscription_plans IS '订阅套餐表';
COMMENT ON TABLE user_subscriptions IS '用户订阅表';
COMMENT ON TABLE operation_logs IS '操作日志表，记录用户操作日志';

-- 输出完成信息
SELECT 'Database initialization completed successfully' AS message;