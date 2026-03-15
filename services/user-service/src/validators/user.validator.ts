/**
 * @file 用户验证器
 * @description 用户相关请求的数据验证规则
 * @author StockAI开发团队
 * @created 2026-03-15
 */

import { body, param, query } from 'express-validator';
import { UserRole, UserStatus, TemplateType } from '@/models/user.types';

/**
 * 用户注册验证规则
 */
export const registerValidator = [
  body('username')
    .trim()
    .notEmpty().withMessage('用户名不能为空')
    .isLength({ min: 3, max: 50 }).withMessage('用户名长度必须在3-50个字符之间')
    .matches(/^[a-zA-Z0-9_\-\.]+$/).withMessage('用户名只能包含字母、数字、下划线、连字符和点号'),
  
  body('email')
    .trim()
    .notEmpty().withMessage('邮箱不能为空')
    .isEmail().withMessage('邮箱格式不正确')
    .normalizeEmail(),
  
  body('password')
    .trim()
    .notEmpty().withMessage('密码不能为空')
    .isLength({ min: 8, max: 100 }).withMessage('密码长度必须在8-100个字符之间')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('密码必须包含大小写字母和数字'),
  
  body('phone')
    .optional()
    .trim()
    .matches(/^\+?[1-9]\d{1,14}$/).withMessage('手机号格式不正确'),
  
  body('displayName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 }).withMessage('显示名称长度必须在1-100个字符之间'),
  
  body('preferences')
    .optional()
    .isObject().withMessage('偏好设置必须是对象'),
];

/**
 * 用户登录验证规则
 */
export const loginValidator = [
  body('username')
    .optional()
    .trim()
    .notEmpty().withMessage('用户名不能为空'),
  
  body('email')
    .optional()
    .trim()
    .notEmpty().withMessage('邮箱不能为空')
    .isEmail().withMessage('邮箱格式不正确'),
  
  body('phone')
    .optional()
    .trim()
    .notEmpty().withMessage('手机号不能为空'),
  
  body('password')
    .trim()
    .notEmpty().withMessage('密码不能为空'),
  
  // 确保至少有一个标识符
  body().custom((value, { req }) => {
    const { username, email, phone } = req.body;
    if (!username && !email && !phone) {
      throw new Error('必须提供用户名、邮箱或手机号之一');
    }
    return true;
  }),
];

/**
 * 更新用户信息验证规则
 */
export const updateUserValidator = [
  body('username')
    .optional()
    .trim()
    .notEmpty().withMessage('用户名不能为空')
    .isLength({ min: 3, max: 50 }).withMessage('用户名长度必须在3-50个字符之间')
    .matches(/^[a-zA-Z0-9_\-\.]+$/).withMessage('用户名只能包含字母、数字、下划线、连字符和点号'),
  
  body('email')
    .optional()
    .trim()
    .notEmpty().withMessage('邮箱不能为空')
    .isEmail().withMessage('邮箱格式不正确')
    .normalizeEmail(),
  
  body('phone')
    .optional()
    .trim()
    .matches(/^\+?[1-9]\d{1,14}$/).withMessage('手机号格式不正确'),
  
  body('displayName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 }).withMessage('显示名称长度必须在1-100个字符之间'),
  
  body('avatarUrl')
    .optional()
    .trim()
    .isURL().withMessage('头像URL格式不正确'),
  
  body('bio')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('个人简介不能超过500个字符'),
  
  body('location')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('位置不能超过100个字符'),
  
  body('preferences')
    .optional()
    .isObject().withMessage('偏好设置必须是对象'),
];

/**
 * 更新模板偏好验证规则（用户核心需求）
 */
export const updateTemplatePreferenceValidator = [
  body('type')
    .trim()
    .notEmpty().withMessage('模板类型不能为空')
    .isIn(Object.values(TemplateType)).withMessage('无效的模板类型'),
  
  body('templateId')
    .trim()
    .notEmpty().withMessage('模板ID不能为空')
    .isLength({ min: 1, max: 100 }).withMessage('模板ID长度必须在1-100个字符之间'),
  
  body('customConfig')
    .optional()
    .isObject().withMessage('自定义配置必须是对象'),
];

/**
 * 刷新令牌验证规则
 */
export const refreshTokenValidator = [
  body('refreshToken')
    .trim()
    .notEmpty().withMessage('刷新令牌不能为空'),
];

/**
 * 生成API密钥验证规则
 */
export const generateApiKeyValidator = [
  body('name')
    .trim()
    .notEmpty().withMessage('API密钥名称不能为空')
    .isLength({ min: 1, max: 50 }).withMessage('API密钥名称长度必须在1-50个字符之间'),
];

/**
 * 用户ID参数验证规则
 */
export const userIdParamValidator = [
  param('id')
    .trim()
    .notEmpty().withMessage('用户ID不能为空')
    .isUUID().withMessage('用户ID必须是有效的UUID'),
];

/**
 * 分页查询验证规则
 */
export const paginationValidator = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('页码必须是大于0的整数')
    .toInt(),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('每页数量必须是1-100之间的整数')
    .toInt(),
  
  query('role')
    .optional()
    .trim()
    .isIn(Object.values(UserRole)).withMessage('无效的用户角色'),
  
  query('status')
    .optional()
    .trim()
    .isIn(Object.values(UserStatus)).withMessage('无效的用户状态'),
  
  query('search')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('搜索关键词不能超过100个字符'),
];

/**
 * 密码重置请求验证规则
 */
export const resetPasswordRequestValidator = [
  body('email')
    .trim()
    .notEmpty().withMessage('邮箱不能为空')
    .isEmail().withMessage('邮箱格式不正确')
    .normalizeEmail(),
];

/**
 * 密码重置验证规则
 */
export const resetPasswordValidator = [
  body('email')
    .trim()
    .notEmpty().withMessage('邮箱不能为空')
    .isEmail().withMessage('邮箱格式不正确')
    .normalizeEmail(),
  
  body('newPassword')
    .trim()
    .notEmpty().withMessage('新密码不能为空')
    .isLength({ min: 8, max: 100 }).withMessage('密码长度必须在8-100个字符之间')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('密码必须包含大小写字母和数字'),
  
  body('token')
    .trim()
    .notEmpty().withMessage('重置令牌不能为空'),
];

/**
 * 邮箱验证请求验证规则
 */
export const verifyEmailValidator = [
  body('token')
    .trim()
    .notEmpty().withMessage('验证令牌不能为空'),
];

/**
 * 导出所有验证器
 */
export default {
  registerValidator,
  loginValidator,
  updateUserValidator,
  updateTemplatePreferenceValidator,
  refreshTokenValidator,
  generateApiKeyValidator,
  userIdParamValidator,
  paginationValidator,
  resetPasswordRequestValidator,
  resetPasswordValidator,
  verifyEmailValidator,
};