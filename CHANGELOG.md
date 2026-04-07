# Changelog

## 2026-04-06

本次为 GitHub 发布整理版，已同步最近两个月的主要可用更新，并补齐发布文档与脱敏处理。

### 新增

- 新增独立的 **邮箱后缀 / 域名白名单管理页**
  - 支持单条编辑
  - 支持批量导入
  - 支持批量删除
  - 支持通配域名规则
- 新增域名规则工具与测试：
  - 域名标准化
  - 通配匹配
  - 生效域名列表解析
- 新增前端测试：
  - 域名管理页入口检查
  - 域名工具函数测试
  - 全邮箱最新邮件轮询参数测试
- 新增后端测试：
  - SMTP 运行时配置测试
  - SMTP 收件人与 relay 分类测试
  - 出站 MIME 规范化测试

### SMTP / 收发增强

- 支持认证客户端通过 SMTP 提交向站外邮箱 relay
- 支持 `SMTP_REQUIRE_AUTH`
- 支持 `SMTP_ENABLE_STARTTLS`
- 支持 `SMTP_ALLOW_INSECURE_AUTH`
- 支持 `SMTP_SECURE_ENABLED` 与 `SMTP_SECURE_PORT`
- 支持 TLS 证书文件与 PFX 配置
- 支持更完整的 SMTP 运行时配置合并逻辑

### 安全与设置

- 增强内部收信接口签名配置：
  - `INBOUND_SHARED_SECRET`
  - `INBOUND_MAX_SKEW_SECONDS`
- 新增永久公共 Token 读取与校验逻辑
- 设置项增加：
  - 域名列表
  - SMTP 认证相关配置
  - SMTPS 开关与端口
- 面板对敏感配置展示做脱敏处理

### 部署与运维

- 更新 `deploy/.env.example`，补全最新部署参数
- 更新 `deploy/docker-compose.yml`
  - 补充 SMTPS 端口映射
  - 挂载证书目录
  - 传递新增 SMTP / inbound 配置
- 新增 `deploy/deploy.sh`
  - 自动启动核心服务
  - 串行执行初始化步骤
  - 避免残留初始化容器
- 新增 `deploy/certs/README.txt` 说明证书挂载方式

### 数据与运行时

- 扩展 `setting` 相关字段与初始化逻辑
- 补充数据库列兼容与索引创建
- 更新运行时配置解析，提升部署参数覆盖能力

### 前端体验

- 系统设置中抽离域名管理能力到独立页面
- 调整邮箱列表与全邮箱页面逻辑
- 补充全邮箱最新邮件轮询参数工具
- 更新多语言文案与权限路由

### GitHub 发布整理

- 移除本地 `.env` 与私有环境配置
- 保留脱敏后的 `.env.example`
- 同步 README 与部署文档
- 新增本更新日志，便于后续继续维护发布记录
