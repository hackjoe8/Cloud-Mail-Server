# Cloud Mail Server 二次开发现状梳理

本文档用于接手 `hackjoe8/Cloud-Mail-Server` 后快速定位二次开发入口。内容基于当前仓库代码读取整理，重点覆盖功能、模块、API、数据表、配置、启动部署和已发现风险点。

## 1. 仓库状态

- 本地路径：`C:\Users\Administrator\Desktop\cloud-mail-server`
- 远程仓库：`https://github.com/hackjoe8/Cloud-Mail-Server.git`
- 当前分支：`main`
- 项目结构：

| 路径 | 作用 |
| --- | --- |
| `cloud-mail-server/` | 后端服务，Node.js + Hono，负责 Web/API/SMTP/任务调度 |
| `mail-vue/` | 前端管理面板，Vue 3 + Vite + Element Plus + Pinia |
| `deploy/` | Docker Compose、初始化脚本、证书挂载目录 |
| `API.md` | 当前较完整的 API 文档 |
| `README.md` / `DEPLOY.md` | 项目和部署说明 |

## 2. 推荐二开方式

推荐先按 Docker 部署方式跑通基线，再做功能改动。原因是该项目依赖 PostgreSQL、Redis、MinIO、SMTP 端口和前后端联动，单独启动后端需要手动准备较多环境。

```powershell
cd C:\Users\Administrator\Desktop\cloud-mail-server\deploy
copy .env.example .env
docker compose up -d postgres redis minio
docker compose --profile init run --rm minio-init
docker compose up -d cloud-mail-server
docker compose --profile init run --rm cloud-mail-init
docker compose --profile init run --rm cloud-mail-configure-storage
docker compose --profile init run --rm cloud-mail-refresh-cache
docker compose ps
```

本地前端开发可单独运行：

```powershell
cd C:\Users\Administrator\Desktop\cloud-mail-server\mail-vue
pnpm install
pnpm dev
```

本地后端开发可单独运行：

```powershell
cd C:\Users\Administrator\Desktop\cloud-mail-server\cloud-mail-server
pnpm install
pnpm dev
```

前端开发环境默认请求：

```text
VITE_BASE_URL=http://127.0.0.1:8787/api
```

## 3. 技术栈

| 层 | 技术 |
| --- | --- |
| 后端运行时 | Node.js 22、ESM、Hono、tsx |
| HTTP 服务 | `@hono/node-server` |
| SMTP 服务 | `smtp-server`，支持 25、STARTTLS、SMTPS/465 |
| 数据库 | PostgreSQL，代码用 D1 风格适配层兼容原 Cloudflare D1 调用 |
| 缓存/KV | Redis，封装成 KV Namespace 风格 |
| 对象存储 | MinIO/S3，兼容原 R2 访问逻辑 |
| ORM | Drizzle ORM 的 sqlite-core schema 定义 + D1 adapter |
| 前端 | Vue 3、Vite、Element Plus、Pinia、Vue Router |
| 测试 | 后端 `tsx test/*.test.js`，前端 `node test/*.test.js` |
| 部署 | Docker Compose，一体镜像内置前端静态资源 |

## 4. 当前核心功能

| 功能 | 说明 | 主要代码入口 |
| --- | --- | --- |
| 用户注册登录 | 邮箱注册、登录、JWT、登出、当前用户信息 | `cloud-mail-server/src/api/login-api.js`、`my-api.js` |
| 用户管理 | 用户列表、新增、删除、禁用、改密、角色修改、恢复、邮箱管理 | `cloud-mail-server/src/api/user-api.js` |
| 角色权限 | 角色增删改、默认角色、权限树、按钮级权限 | `cloud-mail-server/src/api/role-api.js`、`src/security/security.js` |
| 邮箱账号 | 邮箱列表、新增、删除、改名、全收、置顶 | `cloud-mail-server/src/api/account-api.js` |
| 收件箱 | SMTP 入站收信、邮件列表、最新邮件轮询、已读、附件 | `src/runtime/smtp/start-smtp-server.js`、`src/service/email-service.js` |
| 发信 | Web 发信、附件、内联图片、外部 SMTP relay | `cloud-mail-server/src/api/email-api.js`、`src/runtime/smtp/send-outbound-email.js` |
| 全局邮件管理 | 管理员查看所有邮件、条件删除、批量删除、最新邮件 | `cloud-mail-server/src/api/all-email-api.js` |
| 星标邮件 | 收藏、列表、取消收藏 | `cloud-mail-server/src/api/star-api.js` |
| 系统设置 | 注册开关、验证码、域名列表、SMTP、S3、公告、Telegram、背景等 | `cloud-mail-server/src/api/setting-api.js` |
| 域名白名单 | 邮箱后缀/域名列表管理，支持通配域名 | `mail-vue/src/views/domain-list/index.vue` |
| 注册码 | 注册码增删查、使用历史、清理无效码 | `cloud-mail-server/src/api/reg-key-api.js` |
| 数据分析 | 用户数、邮件趋势、发件占比、当日发送量 | `cloud-mail-server/src/api/analysis-api.js` |
| 公开 Token | 公开查询邮件、批量加用户、生成取件链接 | `cloud-mail-server/src/api/public-api.js` |
| 取件链接 | 管理员/公开 Token 生成取件 URL，公开读取邮件 | `cloud-mail-server/src/api/pickup-api.js` |
| OAuth | LinuxDo 登录和绑定 | `cloud-mail-server/src/api/oauth-api.js` |
| Telegram | Telegram 邮件 HTML/文本查看页 | `cloud-mail-server/src/api/telegram-api.js` |
| Resend Webhook | 兼容邮件状态回调 | `cloud-mail-server/src/api/resend-api.js` |
| 静态资源/附件 | `/attachments/*`、`/static/*`、`/api/oss/*` | `cloud-mail-server/src/server.js`、`r2-api.js` |
| 定时任务 | 清理验证码、重置发件数、补全收信状态、清 OAuth 临时用户 | `cloud-mail-server/src/runtime/tasks/daily-tasks.js` |

## 5. 后端入口和运行链路

### 5.1 主入口

| 文件 | 作用 |
| --- | --- |
| `cloud-mail-server/src/server.js` | Node 服务器入口，启动 HTTP 网关、静态资源、API 代理、SMTP、定时任务 |
| `cloud-mail-server/src/runtime/create-runtime-env.js` | 从环境变量创建 PostgreSQL、Redis、运行配置 |
| `cloud-mail-server/src/runtime/bootstrap/init-db.js` | 建表、补列、初始化权限/角色/设置 |
| `cloud-mail-server/src/hono/webs.js` | 统一导入 API 模块和安全中间件 |
| `cloud-mail-server/src/security/security.js` | 登录鉴权、公开接口例外、公开 Token、权限校验 |

### 5.2 HTTP 网关规则

| 外部路径 | 处理逻辑 |
| --- | --- |
| `GET /healthz` | 健康检查 |
| `GET /attachments/*` | 从对象存储读取附件 |
| `GET /static/*` | 从对象存储读取静态对象 |
| `POST /api/internal/inbound-email` | 内部 HMAC 签名收信入口 |
| `/api/*` | 去掉 `/api` 前缀后交给 Hono 业务路由 |
| 其他路径 | 优先读取前端静态文件，不存在则回退 `index.html` |

### 5.3 SMTP 链路

| 项 | 说明 |
| --- | --- |
| 默认监听 | `0.0.0.0:25` |
| 可选 SMTPS | `465`，通过 `SMTP_SECURE_ENABLED=true` 开启 |
| STARTTLS | 通过 `SMTP_ENABLE_STARTTLS=true` 和证书路径开启 |
| 本地域名 | 来自环境变量 `DOMAIN`，也会被系统设置里的域名列表刷新 |
| 未认证客户端 | 只能投递到本站域名，防止开放中继 |
| 已认证客户端 | 可向站外收件人 relay |
| 收信入库 | `handleInboundRawMime()` 解析原始 MIME，写入邮件和附件 |

## 6. API 总览

业务 API 外部统一带 `/api` 前缀，代码内部路由不写 `/api`。完整参数见 `API.md`。

| 分组 | 路径 |
| --- | --- |
| 登录注册 | `POST /api/login`、`POST /api/register`、`DELETE /api/logout` |
| 当前用户 | `GET /api/my/loginUserInfo`、`PUT /api/my/resetPassword`、`DELETE /api/my/delete` |
| 用户管理 | `GET /api/user/list`、`POST /api/user/add`、`DELETE /api/user/delete`、`PUT /api/user/setPwd`、`PUT /api/user/setStatus`、`PUT /api/user/setType`、`PUT /api/user/resetSendCount`、`PUT /api/user/restore`、`GET /api/user/allAccount`、`DELETE /api/user/deleteAccount` |
| 邮箱账号 | `GET /api/account/list`、`POST /api/account/add`、`DELETE /api/account/delete`、`PUT /api/account/setName`、`PUT /api/account/setAllReceive`、`PUT /api/account/setAsTop` |
| 邮件 | `GET /api/email/list`、`GET /api/email/latest`、`DELETE /api/email/delete`、`GET /api/email/attList`、`POST /api/email/send`、`PUT /api/email/read` |
| 全局邮件 | `GET /api/allEmail/list`、`GET /api/allEmail/latest`、`DELETE /api/allEmail/delete`、`DELETE /api/allEmail/batchDelete` |
| 星标 | `POST /api/star/add`、`GET /api/star/list`、`DELETE /api/star/cancel` |
| 角色权限 | `POST /api/role/add`、`PUT /api/role/setDefault`、`PUT /api/role/set`、`GET /api/role/permTree`、`DELETE /api/role/delete`、`GET /api/role/list`、`GET /api/role/selectUse` |
| 注册码 | `POST /api/regKey/add`、`GET /api/regKey/list`、`DELETE /api/regKey/delete`、`DELETE /api/regKey/clearNotUse`、`GET /api/regKey/history` |
| 设置 | `PUT /api/setting/set`、`GET /api/setting/query`、`GET /api/setting/websiteConfig`、`PUT /api/setting/setBackground`、`DELETE /api/setting/deleteBackground` |
| 分析 | `GET /api/analysis/echarts` |
| 公开接口 | `POST /api/public/genToken`、`POST /api/public/emailList`、`POST /api/public/addUser`、`POST /api/public/pickup/link` |
| 取件 | `POST /api/pickup/link`、`POST /api/pickup/batchLinks`、`GET /api/pickup-public/:token/list` |
| OAuth | `POST /api/oauth/linuxDo/login`、`PUT /api/oauth/bindUser` |
| 对象读取 | `GET /api/oss/*` |
| Webhook | `POST /api/webhooks` |
| Telegram | `GET /api/telegram/getEmail/:token` |
| 初始化 | `GET /api/init/:secret` |
| 内部收信 | `POST /api/internal/inbound-email` |

## 7. 认证和权限

| 类型 | 说明 |
| --- | --- |
| 登录态 | 请求头 `Authorization: <JWT>` |
| 登录态缓存 | Redis KV：`AUTH_INFO + userId` |
| 管理员 | `ADMIN` 环境变量对应邮箱自动拥有 `*` 权限 |
| 无需 JWT | `/login`、`/register`、`/setting/websiteConfig`、`/oss`、`/webhooks`、`/init`、`/public/genToken`、`/telegram`、`/test`、`/oauth`、`/pickup-public` |
| 公开 Token | `/public/*` 除 `/public/genToken` 外，要求 `Authorization` 等于临时公开 Token 或系统永久 Token |
| 按钮权限 | `security.js` 中 `requirePerms` + `premKey` 控制 |

注意：`security.js` 里权限路径写的是 `/role/tree`，实际 API 是 `/role/permTree`，当前 `/api/role/permTree` 只需要登录，不会按 `role:query` 做路径匹配。

## 8. 数据表

当前 Node/PostgreSQL 初始化由 `cloud-mail-server/src/runtime/bootstrap/init-db.js` 执行。

| 表 | 作用 |
| --- | --- |
| `user` | 用户账号、密码盐、状态、角色、发送次数、软删除 |
| `account` | 用户邮箱账号、显示名、全收开关、排序、软删除 |
| `email` | 邮件主体、收发件人、主题、正文、状态、已读、软删除 |
| `attachments` | 附件和内联资源对象 key、类型、大小、MIME、Content-ID |
| `star` | 邮件收藏关系 |
| `setting` | 全局系统设置，包含注册、发送、域名、SMTP、S3、公告等 |
| `perm` | 权限定义 |
| `role` | 角色定义、发送限制、邮箱数量、可用域名 |
| `role_perm` | 角色和权限关联 |
| `reg_key` | 注册码、可用次数、过期时间、关联角色 |
| `verify_record` | 验证码/Turnstile 次数记录 |
| `oauth` | OAuth 临时用户和绑定关系 |
| `inbound_event` | 内部收信事件幂等记录 |

关键唯一约束和索引：

| 索引 | 作用 |
| --- | --- |
| `idx_account_email_nocase` | 邮箱账号大小写不敏感唯一 |
| `idx_user_email_nocase` | 用户邮箱大小写不敏感唯一 |
| `idx_setting_code` | 注册码大小写不敏感唯一 |
| `idx_email_user_account_type_is_del_email_id` | 当前用户指定邮箱邮件列表 |
| `idx_email_user_type_is_del_email_id` | 当前用户全收邮件列表 |
| `idx_email_type_status_email_id` | 邮件状态和类型查询 |
| `idx_attachments_email_id_type` | 附件列表查询 |
| `idx_star_user_email` | 收藏列表查询 |

## 9. 重要环境变量

| 变量 | 说明 |
| --- | --- |
| `DOMAIN` | 收信域名数组，例如 `["example.com","*.example.net"]` |
| `ADMIN` | 管理员邮箱 |
| `JWT_SECRET` | JWT 和初始化接口密钥 |
| `DATABASE_URL` | PostgreSQL 连接 |
| `REDIS_URL` | Redis 连接 |
| `PG_SSL` | PostgreSQL 是否 SSL |
| `PG_POOL_MAX` / `PG_POOL_MIN` | PostgreSQL 连接池 |
| `ENABLE_CRON` | 是否启用定时任务 |
| `CRON_EXPR` / `CRON_TIMEZONE` | 定时任务表达式和时区 |
| `AUTO_INIT` | 启动时是否自动初始化数据库 |
| `INBOUND_SHARED_SECRET` | 内部收信 HMAC 密钥 |
| `INBOUND_MAX_SKEW_SECONDS` | 内部收信签名时间偏移 |
| `SMTP_ENABLED` | 是否启动 SMTP |
| `SMTP_HOST` / `SMTP_PORT` | SMTP 监听地址和端口 |
| `SMTP_REQUIRE_AUTH` | SMTP 是否要求认证 |
| `SMTP_AUTH_USER` / `SMTP_AUTH_PASS` | SMTP 认证账号密码 |
| `SMTP_ENABLE_STARTTLS` | 是否启用 STARTTLS |
| `SMTP_ALLOW_INSECURE_AUTH` | 是否允许明文 AUTH |
| `SMTP_TLS_KEY_PATH` / `SMTP_TLS_CERT_PATH` | TLS 证书路径 |
| `SMTP_TLS_PFX_PATH` / `SMTP_TLS_PFX_PASSPHRASE` | PFX 证书路径和密码 |
| `SMTP_SECURE_ENABLED` / `SMTP_SECURE_PORT` | SMTPS 开关和端口 |
| `SMTP_MAX_SIZE` | 单封邮件最大字节数 |
| `WEB_DIST_DIR` | 前端静态资源目录 |
| `LINUXDO_CLIENT_ID` 等 | LinuxDo OAuth 配置 |

前端环境：

| 文件 | 作用 |
| --- | --- |
| `mail-vue/.env.dev` | 本地开发，默认请求 `http://127.0.0.1:8787/api` |
| `mail-vue/.env.release` | 发布构建，请求 `/api` |
| `mail-vue/.env.remote` | 远程模式，请求空 baseURL |

## 10. 前端路由和页面

基础路由在 `mail-vue/src/router/index.js`，权限路由在 `mail-vue/src/perm/perm.js`。

| 路径 | 页面 | 权限 |
| --- | --- | --- |
| `/login` | 登录/注册 | 公开 |
| `/pickup/:token` | 公开取件页 | 公开 |
| `/inbox` | 收件箱 | 登录 |
| `/message` | 邮件详情 | 登录 |
| `/settings` | 个人设置 | 登录 |
| `/starred` | 星标邮件 | 登录 |
| `/sent` | 已发送 | `email:send` |
| `/drafts` | 草稿 | `email:send` |
| `/all-users` | 用户管理 | `user:query` |
| `/role` | 权限管理 | `role:query` |
| `/email-list` | 邮箱后缀/域名列表 | `setting:query` |
| `/system-setting` | 系统设置 | `setting:query` |
| `/invite-code` | 注册码 | `reg-key:query` |
| `/all-mail` | 全部邮件 | `all-email:query` |
| `/analysis` | 数据分析 | `analysis:query` |
| `/test` | 测试页 | 当前路由公开，但后端 `test-api.js` 为空 |

## 11. 前端请求封装

| 文件 | 对应后端分组 |
| --- | --- |
| `mail-vue/src/request/login.js` | 登录注册 |
| `mail-vue/src/request/my.js` | 当前用户 |
| `mail-vue/src/request/user.js` | 用户管理 |
| `mail-vue/src/request/account.js` | 邮箱账号 |
| `mail-vue/src/request/email.js` | 邮件 |
| `mail-vue/src/request/all-email.js` | 全局邮件 |
| `mail-vue/src/request/star.js` | 星标 |
| `mail-vue/src/request/role.js` | 角色权限 |
| `mail-vue/src/request/setting.js` | 系统设置 |
| `mail-vue/src/request/reg-key.js` | 注册码 |
| `mail-vue/src/request/analysis.js` | 数据分析 |
| `mail-vue/src/request/pickup.js` | 取件链接 |
| `mail-vue/src/request/ouath.js` | OAuth，文件名有拼写错误但代码按现状引用 |

Axios 统一封装在 `mail-vue/src/axios/index.js`：

- 自动加 `Authorization`。
- 自动加 `accept-language`。
- 业务成功条件是 `code === 200`。
- `401` 会清理 token 并跳转登录页。
- `403`、`502`、其他业务错误会弹 Element Plus 消息。

## 12. Docker 部署链路

| 服务 | 作用 |
| --- | --- |
| `postgres` | PostgreSQL 16 |
| `redis` | Redis 7 |
| `minio` | S3 兼容对象存储 |
| `cloud-mail-server` | 后端 + 前端静态资源 + SMTP |
| `minio-init` | 创建 bucket |
| `cloud-mail-init` | 调 `/api/init/:secret` 初始化数据库 |
| `cloud-mail-configure-storage` | 写入 MinIO/S3 设置 |
| `cloud-mail-refresh-cache` | 调公开配置接口刷新缓存 |

镜像构建顺序：

1. 在 `cloud-mail-server/Dockerfile` 中先构建 `mail-vue`。
2. 再安装后端依赖。
3. 将前端 `dist` 复制到后端镜像 `/app/public`。
4. 运行 `pnpm start`，由 `src/server.js` 同时提供 Web、API、SMTP。

## 13. 测试命令

后端：

```powershell
cd C:\Users\Administrator\Desktop\cloud-mail-server\cloud-mail-server
pnpm test
```

前端当前存在独立 Node 测试文件，但 `package.json` 没有统一 test script，可直接运行：

```powershell
cd C:\Users\Administrator\Desktop\cloud-mail-server\mail-vue
node test\domain-utils.test.js
node test\domain-list-page.test.js
node test\all-email-latest-utils.test.js
```

构建验证：

```powershell
cd C:\Users\Administrator\Desktop\cloud-mail-server\mail-vue
pnpm build
```

## 14. 二开建议入口

| 需求类型 | 优先改动位置 |
| --- | --- |
| 新增后端接口 | `cloud-mail-server/src/api/*.js` + `src/service/*-service.js` |
| 新增数据库字段 | `src/runtime/bootstrap/init-db.js` + `src/entity/*.js` + 相关 service |
| 新增页面 | `mail-vue/src/views/` + `mail-vue/src/router/index.js` 或 `src/perm/perm.js` |
| 新增按钮权限 | `bootstrap/init-db.js` 权限种子 + `security.js` + 前端 `v-perm` |
| 修改系统设置 | `setting` 表、`setting-service.js`、`setting-api.js`、前端 `sys-setting` |
| 修改收信规则 | `runtime/smtp/start-smtp-server.js`、`runtime/inbound/handle-inbound.js` |
| 修改发信规则 | `service/email-service.js`、`runtime/smtp/send-outbound-email.js` |
| 修改对象存储 | `service/r2-service.js`、`service/s3-service.js` |
| 修改公开取件 | `service/pickup-service.js`、`views/pickup/index.vue` |

## 15. 当前已发现的风险点

| 风险点 | 影响 | 建议 |
| --- | --- | --- |
| `/role/tree` 和 `/role/permTree` 不一致 | `/role/permTree` 当前不会命中按钮权限校验 | 将 `security.js` 中 `/role/tree` 改成 `/role/permTree`，并同步 `premKey` |
| `src/service/user-service.js` 里存在 `if (password < 6)` | 语义上像密码长度判断，但实际是字符串和数字比较 | 改为 `password.length < 6` 并加测试 |
| `/api/webhooks` 没有签名校验 | 公网暴露时可被伪造状态回调 | 加 webhook secret 或来源签名校验 |
| `test-api.js` 为空但 `/test` 被鉴权排除 | 测试路由公开但后端没有实际功能 | 不需要时移除排除项和前端测试页 |
| Drizzle schema 使用 `sqlite-core`，实际跑 PostgreSQL | 依赖自定义 D1 兼容层，类型和迁移需要谨慎 | 新增字段时同时核对 SQL 初始化和实体定义 |
| `mail-vue/src/request/ouath.js` 拼写错误 | 不影响运行，但二开搜索 OAuth 时容易漏掉 | 可后续重命名并修引用 |

## 16. 完成度判断

二次开发前建议确认以下结果：

- `git status --short --branch` 显示分支和工作区状态正常。
- `pnpm --dir cloud-mail-server test` 通过。
- 前端三个 `node test/*.test.js` 通过。
- `pnpm --dir mail-vue build` 通过。
- Docker 部署后 `curl http://127.0.0.1:8787/healthz` 返回 `{"ok":true}`。
- 登录管理员后能看到收件箱、系统设置、用户管理、全部邮件等页面。
