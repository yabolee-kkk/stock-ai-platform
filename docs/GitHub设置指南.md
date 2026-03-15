# GitHub仓库设置指南

## 步骤1：创建GitHub仓库

### 方法一：通过GitHub网站创建
1. 访问 [GitHub](https://github.com)
2. 登录您的账户
3. 点击右上角 "+" → "New repository"
4. 填写仓库信息：
   - **Repository name**: `stock-ai-platform`
   - **Description**: 智能股票投资助手平台 - 云端SaaS服务
   - **Visibility**: Public (推荐) 或 Private
   - **Initialize with README**: ❌ 不要勾选（我们已有README）
   - **Add .gitignore**: ❌ 不要勾选（我们已有.gitignore）
   - **Choose a license**: MIT License (可选)
5. 点击 "Create repository"

### 方法二：通过GitHub CLI创建（如果已安装）
```bash
# 安装GitHub CLI (如果未安装)
# Ubuntu/Debian: sudo apt install gh
# macOS: brew install gh

# 登录GitHub
gh auth login

# 创建仓库
gh repo create stock-ai-platform \
  --description "智能股票投资助手平台 - 云端SaaS服务" \
  --public \
  --remote origin \
  --source=. \
  --push
```

## 步骤2：连接本地仓库到GitHub

### 如果您已创建GitHub仓库
获取仓库URL后，执行以下命令：

```bash
cd /home/borong/.openclaw/workspace/stock-ai-platform

# 添加远程仓库
git remote add origin https://github.com/<您的用户名>/stock-ai-platform.git

# 或者使用SSH（推荐）
git remote add origin git@github.com:<您的用户名>/stock-ai-platform.git

# 推送到GitHub
git push -u origin main
```

### 如果您需要我帮您推送
请提供：
1. **GitHub用户名**：
2. **仓库URL**（如果已创建）：
3. **访问权限**：Personal Access Token 或 SSH密钥

## 步骤3：配置GitHub Actions CI/CD（可选）

### 创建CI/CD工作流
在项目根目录创建 `.github/workflows/ci.yml`：

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        
    - name: Install dependencies
      run: npm ci
      
    - name: Run tests
      run: npm test
      
    - name: Lint code
      run: npm run lint
      
    - name: Type check
      run: npm run type-check

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Build Docker images
      run: docker-compose build
      
    - name: Run Docker containers
      run: docker-compose up -d
      
    - name: Health check
      run: |
        sleep 30
        docker-compose ps
```

## 步骤4：配置项目设置

### 建议的GitHub设置
1. **分支保护规则**：
   - 要求代码审查
   - 要求CI通过
   - 禁止强制推送
   
2. **Issue模板**：
   - Bug报告模板
   - 功能请求模板
   
3. **Pull Request模板**：
   - 描述更改内容
   - 关联Issue
   - 测试说明

### 推荐的GitHub功能
1. **Projects**：用于项目管理
2. **Actions**：自动化构建和部署
3. **Packages**：Docker镜像管理
4. **Wiki**：项目文档
5. **Discussions**：社区讨论

## 步骤5：团队协作设置

### 邀请团队成员
```bash
# 通过GitHub CLI邀请成员
gh repo collaborator add <用户名> --permission write

# 或通过GitHub网站：
# Settings → Collaborators → Add people
```

### 权限级别
- **Read**：只能查看
- **Triage**：可管理issue和PR
- **Write**：可推送代码，创建分支
- **Maintain**：可管理仓库设置
- **Admin**：完全控制

## 步骤6：Git工作流配置

### 推荐的分支策略
```
main           - 生产环境代码（保护分支）
develop        - 开发主分支
feature/*      - 功能开发分支
bugfix/*       - 修复分支
release/*      - 发布分支
hotfix/*       - 热修复分支
```

### Git钩子配置（可选）
```bash
# 安装husky（如果需要）
npm install husky --save-dev

# 设置Git钩子
npx husky install
npx husky add .husky/pre-commit "npm run lint"
npx husky add .husky/pre-push "npm run test"
```

## 步骤7：安全配置

### GitHub安全功能
1. **Dependabot**：依赖更新和安全扫描
2. **Code scanning**：代码安全扫描
3. **Secret scanning**：密钥泄露扫描
4. **Security policies**：安全策略

### 配置Dependabot
创建 `.github/dependabot.yml`：
```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
```

## 故障排除

### 常见问题
1. **推送被拒绝**
   ```bash
   # 如果远程有文件冲突
   git pull --rebase origin main
   git push -u origin main
   ```

2. **权限不足**
   - 检查SSH密钥配置
   - 确认有仓库写入权限
   - 使用Personal Access Token代替密码

3. **大文件问题**
   ```bash
   # 如果文件太大无法推送
   git filter-branch --tree-filter 'rm -f 大文件路径' HEAD
   ```

### 获取帮助
- GitHub文档：https://docs.github.com
- GitHub社区：https://github.community
- Stack Overflow：使用标签 `git` 和 `github`

---

## 🦞 需要您的操作

请选择以下选项之一：

### 选项A：我已创建GitHub仓库
请提供仓库URL：
- HTTPS：`https://github.com/<用户名>/stock-ai-platform.git`
- SSH：`git@github.com:<用户名>/stock-ai-platform.git`

### 选项B：请帮我创建GitHub仓库
请提供：
1. GitHub用户名：__________
2. 仓库名称（默认：stock-ai-platform）：__________
3. 仓库描述（默认：智能股票投资助手平台 - 云端SaaS服务）：__________
4. 可见性：Public / Private

### 选项C：使用其他Git平台
请指定平台：
- GitLab
- Bitbucket
- 其他：__________

**当前状态**：本地Git仓库已初始化，等待连接到远程仓库。