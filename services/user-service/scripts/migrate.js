#!/usr/bin/env node

/**
 * @file 数据库迁移脚本
 * @description 创建和更新用户服务数据库表
 * @author StockAI开发团队
 * @created 2026-03-15
 */

const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

// 加载环境变量
require('dotenv').config({
  path: path.resolve(__dirname, '../.env'),
});

/**
 * 数据库迁移类
 */
class DatabaseMigrator {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 1, // 迁移时只需要一个连接
    });
    
    this.migrations = [
      this.createUsersTable,
      this.createTemplateConfigsTable,
      this.createApiKeysTable,
      this.createAuditLogsTable,
      this.createIndexes,
      this.insertDefaultTemplates,
    ];
  }
  
  /**
   * 运行所有迁移
   */
  async run() {
    console.log('🚀 开始数据库迁移...');
    
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // 创建迁移记录表
      await this.createMigrationTable(client);
      
      // 运行所有迁移
      for (const migration of this.migrations) {
        const migrationName = migration.name;
        
        // 检查是否已运行
        const result = await client.query(
          'SELECT * FROM migrations WHERE name = $1',
          [migrationName]
        );
        
        if (result.rows.length === 0) {
          console.log(`📝 运行迁移: ${migrationName}`);
          await migration.call(this, client);
          
          // 记录迁移
          await client.query(
            'INSERT INTO migrations (name, executed_at) VALUES ($1, $2)',
            [migrationName, new Date()]
          );
          
          console.log(`✅ 迁移完成: ${migrationName}`);
        } else {
          console.log(`⏭️  跳过已运行的迁移: ${migrationName}`);
        }
      }
      
      await client.query('COMMIT');
      console.log('🎉 所有数据库迁移完成！');
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ 数据库迁移失败:', error.message);
      throw error;
      
    } finally {
      client.release();
      await this.pool.end();
    }
  }
  
  /**
   * 创建迁移记录表
   */
  async createMigrationTable(client) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }
  
  /**
   * 创建用户表
   */
  async createUsersTable(client) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        -- 主键和标识
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(100) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        phone VARCHAR(20) UNIQUE,
        
        -- 密码和认证
        password_hash VARCHAR(255) NOT NULL,
        auth_type VARCHAR(20) DEFAULT 'email',
        email_verified BOOLEAN DEFAULT FALSE,
        phone_verified BOOLEAN DEFAULT FALSE,
        
        -- 用户信息
        display_name VARCHAR(100),
        avatar_url TEXT,
        bio TEXT,
        location VARCHAR(100),
        
        -- 状态和权限
        role VARCHAR(20) DEFAULT 'user',
        status VARCHAR(20) DEFAULT 'active',
        permissions JSONB DEFAULT '[]',
        
        -- 偏好设置（用户核心需求）
        preferences JSONB DEFAULT '{
          "templates": {
            "stockInfo": {
              "defaultTemplateId": "stock_info_concise",
              "customConfig": {}
            },
            "analysis": {
              "defaultTemplateId": "analysis_technical",
              "customConfig": {}
            },
            "report": {
              "defaultTemplateId": "report_detailed",
              "customConfig": {}
            },
            "comparison": {
              "defaultTemplateId": "comparison_basic",
              "customConfig": {}
            },
            "portfolio": {
              "defaultTemplateId": "portfolio_overview",
              "customConfig": {}
            },
            "alert": {
              "defaultTemplateId": "alert_standard",
              "customConfig": {}
            }
          },
          "display": {
            "compactMode": false,
            "showCharts": true,
            "colorScheme": "auto",
            "fontSize": "medium",
            "language": "zh-CN",
            "timezone": "Asia/Shanghai",
            "dateFormat": "YYYY-MM-DD",
            "numberFormat": "comma"
          },
          "notifications": {
            "priceAlerts": true,
            "volumeAlerts": false,
            "newsAlerts": true,
            "reportAlerts": false,
            "email": {
              "enabled": true,
              "frequency": "immediate"
            },
            "push": {
              "enabled": true,
              "frequency": "daily"
            },
            "sms": {
              "enabled": false,
              "frequency": "weekly"
            }
          },
          "investment": {
            "riskTolerance": "moderate",
            "investmentHorizon": "medium",
            "sectors": [],
            "regions": ["CN"],
            "dividendPreference": false,
            "growthPreference": true
          },
          "other": {}
        }',
        
        -- 账户安全
        last_login_at TIMESTAMP,
        last_login_ip VARCHAR(45),
        failed_login_attempts INTEGER DEFAULT 0,
        locked_until TIMESTAMP,
        
        -- 元数据
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP,
        
        -- 索引
        CHECK (role IN ('user', 'premium', 'admin', 'super_admin')),
        CHECK (status IN ('active', 'inactive', 'suspended', 'pending')),
        CHECK (auth_type IN ('email', 'google', 'github', 'wechat', 'phone'))
      )
    `);
    
    console.log('✅ 用户表创建完成');
  }
  
  /**
   * 创建模板配置表
   */
  async createTemplateConfigsTable(client) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS template_configs (
        -- 主键
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        
        -- 模板信息
        name VARCHAR(100) NOT NULL,
        description TEXT,
        type VARCHAR(50) NOT NULL,
        version VARCHAR(20) DEFAULT '1.0.0',
        
        -- 模板配置
        config JSONB NOT NULL DEFAULT '{}',
        
        -- 可见性和默认设置
        is_default BOOLEAN DEFAULT FALSE,
        is_public BOOLEAN DEFAULT TRUE,
        
        -- 元数据
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        
        -- 约束和索引
        CHECK (type IN ('stock_info', 'analysis', 'report', 'comparison', 'portfolio', 'alert')),
        UNIQUE (type, name, version)
      )
    `);
    
    console.log('✅ 模板配置表创建完成');
  }
  
  /**
   * 创建API密钥表
   */
  async createApiKeysTable(client) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS api_keys (
        -- 主键
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        
        -- 关联用户
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        
        -- API密钥信息
        name VARCHAR(100) NOT NULL,
        key_hash VARCHAR(255) NOT NULL UNIQUE,
        
        -- 使用信息
        last_used_at TIMESTAMP,
        expires_at TIMESTAMP,
        
        -- 元数据
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        revoked_at TIMESTAMP,
        
        -- 索引
        INDEX idx_api_keys_user_id (user_id),
        INDEX idx_api_keys_key_hash (key_hash)
      )
    `);
    
    console.log('✅ API密钥表创建完成');
  }
  
  /**
   * 创建审计日志表
   */
  async createAuditLogsTable(client) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        -- 主键
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        
        -- 操作信息
        action VARCHAR(100) NOT NULL,
        resource_type VARCHAR(50) NOT NULL,
        resource_id VARCHAR(100),
        
        -- 用户信息
        user_id UUID REFERENCES users(id),
        user_ip VARCHAR(45),
        user_agent TEXT,
        
        -- 操作详情
        details JSONB DEFAULT '{}',
        
        -- 元数据
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        
        -- 索引
        INDEX idx_audit_logs_action (action),
        INDEX idx_audit_logs_user_id (user_id),
        INDEX idx_audit_logs_created_at (created_at)
      )
    `);
    
    console.log('✅ 审计日志表创建完成');
  }
  
  /**
   * 创建索引
   */
  async createIndexes(client) {
    // 用户表索引
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
      CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
      CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
      CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
      CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at);
    `);
    
    // 模板配置表索引
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_template_configs_type ON template_configs(type);
      CREATE INDEX IF NOT EXISTS idx_template_configs_is_default ON template_configs(is_default);
      CREATE INDEX IF NOT EXISTS idx_template_configs_is_public ON template_configs(is_public);
    `);
    
    console.log('✅ 所有索引创建完成');
  }
  
  /**
   * 插入默认模板
   */
  async insertDefaultTemplates(client) {
    const defaultTemplates = [
      // 股票信息模板
      {
        name: '简洁版',
        description: '股票核心信息快速查看',
        type: 'stock_info',
        is_default: true,
        config: {
          layout: 'compact',
          sections: ['price', 'change', 'volume', 'market_cap'],
          show_charts: false,
          show_advanced: false,
        },
      },
      {
        name: '详细版',
        description: '完整股票信息深度分析',
        type: 'stock_info',
        is_default: false,
        config: {
          layout: 'detailed',
          sections: ['price', 'change', 'volume', 'market_cap', 'pe_ratio', 'dividend', 'financials'],
          show_charts: true,
          show_advanced: true,
          chart_type: 'candlestick',
          timeframe: '1d',
        },
      },
      
      // 分析模板
      {
        name: '技术分析版',
        description: '技术指标和图表分析',
        type: 'analysis',
        is_default: true,
        config: {
          indicators: ['sma', 'ema', 'macd', 'rsi', 'bollinger'],
          timeframes: ['1d', '1w', '1m'],
          show_signals: true,
          show_support_resistance: true,
        },
      },
      {
        name: '基本面版',
        description: '财务数据和基本面分析',
        type: 'analysis',
        is_default: false,
        config: {
          metrics: ['revenue', 'profit', 'eps', 'pe_ratio', 'pb_ratio', 'roe'],
          periods: ['quarterly', 'yearly'],
          show_comparison: true,
          show_trend: true,
        },
      },
      
      // 报告模板
      {
        name: '简要报告',
        description: '简洁的投资建议报告',
        type: 'report',
        is_default: false,
        config: {
          length: 'short',
          sections: ['summary', 'recommendation', 'risks'],
          include_charts: false,
          include_tables: false,
        },
      },
      {
        name: '详细报告',
        description: '完整的投资分析报告',
        type: 'report',
        is_default: true,
        config: {
          length: 'detailed',
          sections: ['executive_summary', 'company_overview', 'financial_analysis', 'risk_assessment', 'investment_recommendation'],
          include_charts: true,
          include_tables: true,
          chart_count: 5,
          table_count: 3,
        },
      },
    ];
    
    for (const template of defaultTemplates) {
      // 检查是否已存在
      const existing = await client.query(
        `SELECT id FROM template_configs WHERE type = $1 AND name = $2`,
        [template.type, template.name]
      );
      
      if (existing.rows.length === 0) {
        await client.query(
          `INSERT INTO template_configs 
           (name, description, type, is_default, config, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            template.name,
            template.description,
            template.type,
            template.is_default,
            JSON.stringify(template.config),
            new Date(),
            new Date(),
          ]
        );
      }
    }
    
    console.log('✅ 默认模板插入完成');
  }
  
  /**
   * 回滚迁移
   */
  async rollback() {
    console.log('🔄 开始回滚数据库迁移...');
    
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // 删除所有表（按依赖顺序）
      await client.query('DROP TABLE IF EXISTS audit_logs CASCADE');
      await client.query('DROP TABLE IF EXISTS api_keys CASCADE');
      await client.query('DROP TABLE IF EXISTS template_configs CASCADE');
      await client.query('DROP TABLE IF EXISTS users CASCADE');
      await client.query('DROP TABLE IF EXISTS migrations CASCADE');
      
      await client.query('COMMIT');
      console.log('✅ 数据库回滚完成！');
      
    } catch (error) {
      await client.query('ROLLBACK');
