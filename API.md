# Cloud Mail Server API 接口文档

本文档基于当前代码梳理，来源包括：

- `cloud-mail-server/src/api/*.js`
- `cloud-mail-server/src/server.js`
- `cloud-mail-server/src/security/security.js`
- `mail-vue/src/request/*.js`

## 全局约定

- 后端默认端口：`8787`
- 业务 API 统一外部前缀：`/api`
- 后端 `src/api/*.js` 中的路由没有写 `/api`，由 `src/server.js` 网关统一转发时去掉 `/api` 前缀。
- 默认请求头：`Authorization: <token>`
- 默认响应格式：

```json
{
  "code": 200,
  "message": "success",
  "data": null
}
```

说明：

- `GET` / `DELETE` 参数通常走 query string。
- `POST` / `PUT` 参数通常走 JSON body。
- `/api/oss/*`、`/api/telegram/getEmail/:token`、`/api/webhooks`、`/api/init/:secret`、`/api/internal/inbound-email`、`/healthz`、`/attachments/*`、`/static/*` 的响应不是标准 JSON。

## 认证和权限

### 无需 JWT 的接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/api/login` | 登录 |
| `POST` | `/api/register` | 注册 |
| `GET` | `/api/setting/websiteConfig` | 获取站点公开配置 |
| `GET` | `/api/oss/*` | 读取对象存储文件 |
| `POST` | `/api/webhooks` | Resend webhook |
| `GET` | `/api/init/:secret` | 初始化数据库 |
| `POST` | `/api/public/genToken` | 管理员用邮箱密码生成公开 token，不需要 JWT |
| `GET` | `/api/telegram/getEmail/:token` | Telegram 邮件内容页 |
| `POST` | `/api/oauth/linuxDo/login` | LinuxDo OAuth 登录 |
| `PUT` | `/api/oauth/bindUser` | 绑定 OAuth 用户 |
| `GET` | `/api/pickup-public/:token/list` | 取件 URL 公开读取指定邮箱邮件列表 |
| `GET` | `/healthz` | 健康检查 |
| `GET` | `/attachments/*` | 读取附件对象 |
| `GET` | `/static/*` | 读取静态对象 |

### 公开 token 接口

以下接口不使用用户 JWT，但要求 `Authorization` 等于 KV 中的公开 token 或系统设置里的 `permanentToken`：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/api/public/emailList` | 公开查询邮件 |
| `POST` | `/api/public/addUser` | 公开批量添加用户 |
| `POST` | `/api/public/pickup/link` | 使用公开 token 或永久 Token 生成指定邮箱取件 URL |

### 需要 JWT 的普通接口

除上面公开接口外，其余 `/api/...` 业务接口都需要 `Authorization: <JWT>`。

部分接口还会校验按钮权限：

| 权限 key | 接口 |
| --- | --- |
| `email:delete` | `/api/email/delete` |
| `email:send` | `/api/email/send` |
| `account:add` | `/api/account/add` |
| `account:query` | `/api/account/list` |
| `account:delete` | `/api/account/delete` |
| `my:delete` | `/api/my/delete` |
| `role:add` | `/api/role/add` |
| `role:set` | `/api/role/set`, `/api/role/setDefault` |
| `role:query` | `/api/role/list` |
| `role:delete` | `/api/role/delete` |
| `user:query` | `/api/user/list`, `/api/user/allAccount` |
| `user:add` | `/api/user/add` |
| `user:reset-send` | `/api/user/resetSendCount` |
| `user:set-pwd` | `/api/user/setPwd` |
| `user:set-status` | `/api/user/setStatus` |
| `user:set-type` | `/api/user/setType` |
| `user:delete` | `/api/user/delete`, `/api/user/deleteAccount` |
| `all-email:query` | `/api/allEmail/list`, `/api/allEmail/latest` |
| `all-email:delete` | `/api/allEmail/delete`, `/api/allEmail/batchDelete` |
| `setting:query` | `/api/setting/query` |
| `setting:set` | `/api/setting/set`, `/api/setting/setBackground`, `/api/setting/deleteBackground` |
| `analysis:query` | `/api/analysis/echarts` |
| `reg-key:add` | `/api/regKey/add` |
| `reg-key:query` | `/api/regKey/list`, `/api/regKey/history` |
| `reg-key:delete` | `/api/regKey/delete`, `/api/regKey/clearNotUse` |

代码注意点：`security.js` 里权限路径写了 `/role/tree`，但实际路由是 `/role/permTree`，所以当前 `/api/role/permTree` 只要求登录，不做按钮权限校验。

## 枚举值

| 名称 | 值 |
| --- | --- |
| `user.status` | `0` 正常，`1` 禁用 |
| `email.type` | `0` 收件，`1` 发件 |
| `email.status` | `0` 已接收，`1` 已发送，`2` 已投递，`3` 退信，`4` 投诉，`5` 延迟，`6` 保存中，`7` 无收件人，`8` 失败 |
| `email.unread` | `0` 未读，`1` 已读 |
| `isDel` | `0` 正常，`1` 删除 |
| `setting.register` / `send` / `addEmail` / `manyEmail` 等开关 | 多数为 `0` 开启，`1` 关闭 |
| `setting.regKey` | `0` 必填注册码，`1` 关闭注册码，`2` 可选注册码 |
| `setting.registerVerify` / `addEmailVerify` | `0` 总是校验，`1` 关闭校验，`2` 达到次数后校验 |

## 登录注册

| 方法 | 路径 | 参数 | 返回/说明 |
| --- | --- | --- | --- |
| `POST` | `/api/login` | body `{ email, password }` | 返回 `{ token }` |
| `POST` | `/api/register` | body `{ email, password, token?, code? }` | `token` 为 Turnstile token；`code` 为注册码；返回 `{ regVerifyOpen }` |
| `DELETE` | `/api/logout` | 无 | 注销当前 token |

## 当前用户

| 方法 | 路径 | 参数 | 返回/说明 |
| --- | --- | --- | --- |
| `GET` | `/api/my/loginUserInfo` | 无 | 当前用户信息、主邮箱、角色、权限 key |
| `PUT` | `/api/my/resetPassword` | body `{ password }` | 修改当前用户密码 |
| `DELETE` | `/api/my/delete` | 无 | 软删除当前用户，并清理登录态 |

## 用户管理

| 方法 | 路径 | 参数 | 返回/说明 |
| --- | --- | --- | --- |
| `GET` | `/api/user/list` | query `{ num, size, email?, timeSort?, status?, isDel? }` | 分页查询用户；`size` 最大 `50` |
| `POST` | `/api/user/add` | body `{ email, type, password }` | 管理员新增用户；`type` 为角色 ID |
| `DELETE` | `/api/user/delete` | query `{ userIds }` | 物理删除用户，`userIds` 为逗号分隔 ID |
| `PUT` | `/api/user/setPwd` | body `{ userId, password }` | 重置指定用户密码，并清理其登录态 |
| `PUT` | `/api/user/setStatus` | body `{ userId, status }` | 设置用户状态；禁用时清理登录态 |
| `PUT` | `/api/user/setType` | body `{ userId, type }` | 修改用户角色 |
| `PUT` | `/api/user/resetSendCount` | body `{ userId }` | 重置用户发送次数 |
| `PUT` | `/api/user/restore` | body `{ userId, type? }` | 恢复软删除用户；`type` 有值时同时恢复邮件和邮箱 |
| `GET` | `/api/user/allAccount` | query `{ userId, num, size }` | 查询指定用户邮箱，排除主邮箱；`size` 最大 `30` |
| `DELETE` | `/api/user/deleteAccount` | query `{ accountId }` | 物理删除指定邮箱及其邮件 |

## 邮箱账户

| 方法 | 路径 | 参数 | 返回/说明 |
| --- | --- | --- | --- |
| `GET` | `/api/account/list` | query `{ accountId?, size, lastSort? }` | 当前用户邮箱列表，游标分页；`size` 最大 `30` |
| `POST` | `/api/account/add` | body `{ email, token? }` | 新增邮箱；`token` 为 Turnstile token；返回邮箱记录和 `addVerifyOpen` |
| `DELETE` | `/api/account/delete` | query `{ accountId }` | 软删除当前用户邮箱；不能删除主邮箱 |
| `PUT` | `/api/account/setName` | body `{ accountId, name }` | 修改邮箱显示名；`name` 最长 `30` |
| `PUT` | `/api/account/setAllReceive` | body `{ accountId }` | 切换该邮箱是否接收全部邮件，并关闭其他邮箱的该开关 |
| `PUT` | `/api/account/setAsTop` | body `{ accountId }` | 调整邮箱排序，使其靠前 |

## 邮件

| 方法 | 路径 | 参数 | 返回/说明 |
| --- | --- | --- | --- |
| `GET` | `/api/email/list` | query `{ accountId, type, size, emailId?, timeSort?, allReceive?, includeTotal?, includeLatest? }` | 当前用户邮件列表；`type`: `0` 收件、`1` 发件；`size` 最大 `50` |
| `GET` | `/api/email/latest` | query `{ emailId, accountId, allReceive? }` | 查询当前用户较新的收件邮件，最多 `20` 条 |
| `DELETE` | `/api/email/delete` | query `{ emailIds }` | 软删除当前用户邮件；`emailIds` 为逗号分隔 ID |
| `GET` | `/api/email/attList` | query `{ emailId }` | 查询当前用户指定邮件的普通附件 |
| `POST` | `/api/email/send` | body 见下方 | 发送邮件，返回保存后的发件记录数组 |
| `PUT` | `/api/email/read` | body `{ emailIds }` | 标记当前用户邮件已读；`emailIds` 为数组 |

`POST /api/email/send` body：

```json
{
  "accountId": 1,
  "name": "sender name",
  "sendType": "reply",
  "emailId": 100,
  "receiveEmail": ["to@example.com"],
  "text": "plain text",
  "content": "<p>html content</p>",
  "subject": "subject",
  "attachments": [
    {
      "filename": "a.txt",
      "type": "text/plain",
      "content": "base64"
    }
  ]
}
```

说明：

- `sendType: "reply"` 时会使用 `emailId` 查找原邮件。
- `receiveEmail` 是收件人邮箱数组。
- 正文里的 `data:image/...;base64,...` 会被转成内联附件。
- 普通附件最多 `10` 个；内联图片最多 `10` 个。

## 全局邮件管理

| 方法 | 路径 | 参数 | 返回/说明 |
| --- | --- | --- | --- |
| `GET` | `/api/allEmail/list` | query `{ emailId?, size?, timeSort?, type?, userEmail?, accountEmail?, name?, subject?, includeTotal?, includeLatest? }` | 管理端全局邮件列表；`size` 最大 `50` |
| `GET` | `/api/allEmail/latest` | query `{ emailId?, type?, userEmail?, accountEmail?, name?, subject? }` | 管理端查询较新的收件邮件，最多 `20` 条 |
| `DELETE` | `/api/allEmail/delete` | query `{ emailIds }` | 物理删除邮件及附件、收藏 |
| `DELETE` | `/api/allEmail/batchDelete` | query `{ sendName?, sendEmail?, toEmail?, subject?, startTime?, endTime?, type? }` | 按条件物理批量删除 |

`/api/allEmail/list` 的 `type` 含义：

- `send`：发件
- `receive`：收件
- `delete`：已删除
- `noone`：无收件人

`/api/allEmail/batchDelete` 的 `type` 是匹配模式：

- `include`：包含匹配，SQL LIKE `%value%`
- `left`：前缀匹配，SQL LIKE `value%`
- 其他或空：精确 LIKE `value`

## 星标

| 方法 | 路径 | 参数 | 返回/说明 |
| --- | --- | --- | --- |
| `POST` | `/api/star/add` | body `{ emailId }` | 收藏邮件 |
| `GET` | `/api/star/list` | query `{ emailId?, size }` | 收藏列表，按 `emailId` 游标倒序 |
| `DELETE` | `/api/star/cancel` | query `{ emailId }` | 取消收藏 |

## 角色和权限

| 方法 | 路径 | 参数 | 返回/说明 |
| --- | --- | --- | --- |
| `POST` | `/api/role/add` | body 见下方 | 新增角色 |
| `PUT` | `/api/role/set` | body 见下方，需 `roleId` | 修改角色 |
| `PUT` | `/api/role/setDefault` | body `{ roleId }` | 设置默认角色 |
| `DELETE` | `/api/role/delete` | query `{ roleId }` | 删除角色；默认角色不能删除，用户会迁移到当前默认角色 |
| `GET` | `/api/role/list` | 无 | 查询角色列表，包含 `permIds`、`banEmail`、`availDomain` |
| `GET` | `/api/role/selectUse` | 无 | 查询可选择角色 `{ name, roleId, isDefault }` |
| `GET` | `/api/role/permTree` | 无 | 查询权限树 |

角色 body 常用字段：

```json
{
  "roleId": 1,
  "name": "普通用户",
  "description": "",
  "permIds": [1, 2, 3],
  "banEmail": ["bad@example.com", "example.org", "*"],
  "banEmailType": 0,
  "availDomain": ["example.com", "*.example.net"],
  "sort": 0,
  "sendCount": 100,
  "sendType": "count",
  "accountCount": 10
}
```

说明：

- `banEmail` 支持完整邮箱、域名或 `*`。
- `availDomain` 为空表示不限制可用域名。
- `sendType` 代码中支持 `ban`、`internal`、`day`、`count` 等逻辑。

## 注册码

| 方法 | 路径 | 参数 | 返回/说明 |
| --- | --- | --- | --- |
| `POST` | `/api/regKey/add` | body `{ code, roleId, count, expireTime }` | 新增注册码 |
| `GET` | `/api/regKey/list` | query `{ code? }` | 查询注册码；`code` 为前缀匹配 |
| `DELETE` | `/api/regKey/delete` | query `{ regKeyIds }` | 删除注册码；逗号分隔 ID |
| `DELETE` | `/api/regKey/clearNotUse` | 无 | 清理次数为 `0` 或已过期的注册码 |
| `GET` | `/api/regKey/history` | query `{ regKeyId }` | 查询该注册码注册过的用户邮箱和时间 |

## 系统设置

| 方法 | 路径 | 参数 | 返回/说明 |
| --- | --- | --- | --- |
| `GET` | `/api/setting/query` | 无 | 查询完整设置；敏感字段会脱敏 |
| `GET` | `/api/setting/websiteConfig` | 无 | 查询前端公开配置；不需要登录 |
| `PUT` | `/api/setting/set` | body 局部设置对象 | 更新系统设置 |
| `PUT` | `/api/setting/setBackground` | body `{ background }` | 设置登录背景；支持外链或 base64 图片 |
| `DELETE` | `/api/setting/deleteBackground` | 无 | 删除登录背景 |

`PUT /api/setting/set` 支持的主要字段：

```json
{
  "register": 0,
  "receive": 0,
  "title": "Cloud Mail",
  "manyEmail": 0,
  "addEmail": 0,
  "autoRefresh": 5,
  "addEmailVerify": 1,
  "registerVerify": 1,
  "regVerifyCount": 1,
  "addVerifyCount": 1,
  "send": 0,
  "r2Domain": "/api/oss",
  "secretKey": "",
  "siteKey": "",
  "regKey": 1,
  "tgBotToken": "",
  "tgChatId": "",
  "tgBotStatus": 1,
  "forwardEmail": "",
  "forwardStatus": 1,
  "ruleEmail": "",
  "ruleType": 0,
  "loginOpacity": 0.88,
  "domainList": ["example.com", "*.example.net"],
  "resendTokens": {
    "example.com": "token"
  },
  "permanentToken": "",
  "smtpRequireAuth": 0,
  "smtpAuthUser": "",
  "smtpAuthPass": "",
  "smtpEnableStarttls": 0,
  "smtpTlsKeyPath": "",
  "smtpTlsCertPath": "",
  "smtpSecureEnabled": 0,
  "smtpSecurePort": 465,
  "noticeTitle": "",
  "noticeContent": "",
  "noticeType": "",
  "noticeDuration": 0,
  "noticePosition": "",
  "noticeOffset": 0,
  "noticeWidth": 400,
  "notice": 0,
  "noRecipient": 1,
  "loginDomain": 0,
  "bucket": "",
  "region": "",
  "endpoint": "",
  "s3AccessKey": "",
  "s3SecretKey": "",
  "forcePathStyle": 1,
  "customDomain": "",
  "tgMsgFrom": "only-name",
  "tgMsgTo": "show",
  "tgMsgText": "hide",
  "minEmailPrefix": 1,
  "emailPrefixFilter": []
}
```

说明：

- `domainList` 支持数组和通配域名，后端会保存到 `domainListRaw`。
- `resendTokens` 是按域名合并更新，值为空会删除对应域名 token。
- `smtpAuthPass` 为空或等于当前脱敏值时不会覆盖旧密码。
- `emailPrefixFilter` 可传数组，后端会转成逗号分隔字符串保存。

## 数据分析

| 方法 | 路径 | 参数 | 返回/说明 |
| --- | --- | --- | --- |
| `GET` | `/api/analysis/echarts` | query `{ timeZone }` | 返回用户数、邮件数、近 15 日趋势、发件人占比、当日发送量等统计 |

`timeZone` 建议传 IANA 时区，例如 `Asia/Shanghai`。

## 公开接口

| 方法 | 路径 | 参数 | 返回/说明 |
| --- | --- | --- | --- |
| `POST` | `/api/public/genToken` | body `{ email, password }` | 不需要 JWT，但会校验管理员邮箱和密码；返回 `{ token }` |
| `POST` | `/api/public/emailList` | body 见下方 | 使用公开 token 查询邮件 |
| `POST` | `/api/public/addUser` | body `{ list, expiresInSeconds? }` | 使用公开 token 批量添加用户，并返回每个新邮箱的取件 URL |
| `POST` | `/api/public/pickup/link` | body `{ email, expiresInSeconds? }` | 使用公开 token 或永久 Token 生成指定邮箱取件 URL |

`POST /api/public/emailList` body：

```json
{
  "toEmail": "%to@example.com%",
  "content": "%keyword%",
  "subject": "%subject%",
  "sendName": "%sender%",
  "sendEmail": "%from@example.com%",
  "timeSort": "desc",
  "num": 1,
  "size": 20,
  "type": 0,
  "isDel": 0,
  "includeBody": true
}
```

说明：

- `num` 从 `1` 开始。
- `size` 默认 `20`，最大 `50`。
- 字符串过滤条件直接进入 SQL LIKE，想做包含匹配需要自行带 `%`。
- `includeBody: false` 时不返回 `content` 和 `text`。

`POST /api/public/addUser` body：

```json
{
  "expiresInSeconds": 0,
  "list": [
    {
      "email": "user@example.com",
      "password": "optional",
      "roleName": "普通用户"
    }
  ]
}
```

说明：

- `password` 为空时自动生成随机密码。
- `roleName` 匹配不到时使用默认角色。
- `expiresInSeconds` 控制自动生成的取件 URL 有效期；小于等于 `0` 或不传时永久有效。

返回 `data`：

```json
{
  "list": [
    {
      "email": "user@example.com",
      "token": "pickup-jwt",
      "url": "https://example.com/pickup/pickup-jwt",
      "expiresInSeconds": 0
    }
  ],
  "text": "user@example.com----https://example.com/pickup/pickup-jwt"
}
```

`POST /api/public/pickup/link` 请求头：

```http
Authorization: <public token 或 permanentToken>
Content-Type: application/json
```

body：

```json
{
  "email": "user@example.com",
  "expiresInSeconds": 0
}
```

返回 `data`：

```json
{
  "email": "user@example.com",
  "token": "pickup-jwt",
  "url": "https://example.com/pickup/pickup-jwt",
  "expiresInSeconds": 0
}
```

## 取件 URL

| 方法 | 路径 | 参数 | 返回/说明 |
| --- | --- | --- | --- |
| `POST` | `/api/pickup/link` | body `{ email, expiresInSeconds? }` | 管理员 JWT 生成指定邮箱取件 URL |
| `POST` | `/api/pickup/batchLinks` | body `{ emails, expiresInSeconds? }` | 管理员 JWT 批量生成取件 URL，返回 `邮箱----取件URL` 文本 |
| `POST` | `/api/public/pickup/link` | body `{ email, expiresInSeconds? }` | 使用公开 token 或永久 Token 生成指定邮箱取件 URL |
| `GET` | `/api/pickup-public/:token/list` | query `{ emailId?, size? }` | 公开取件列表，只能读取 token 绑定邮箱的正常收件 |

说明：

- 管理员生成接口要求当前 JWT 用户邮箱等于环境变量 `admin`。
- `/api/public/pickup/link` 不使用用户 JWT，要求 `Authorization` 等于公开 token 或系统设置里的 `permanentToken`。
- 生成取件 URL 时优先匹配 `account.email`；如果不是账号邮箱，但 `email.toEmail` 已有正常收件记录，也允许生成。
- `expiresInSeconds` 小于等于 `0` 或不传时，生成永久取件 URL。
- 取件 URL 对应前端页面：`/pickup/:token`。
- 取件页首次加载按 `emailId` 倒序返回，默认显示最新一封；查看其他邮件时从列表切换。
- 批量生成接口支持 `emails` 传数组，也支持换行、空格、逗号、分号分隔的字符串。

## OAuth

| 方法 | 路径 | 参数 | 返回/说明 |
| --- | --- | --- | --- |
| `POST` | `/api/oauth/linuxDo/login` | body `{ code }` | 使用 LinuxDo 授权码登录；已绑定邮箱时返回 token，未绑定时 token 为 `null` |
| `PUT` | `/api/oauth/bindUser` | body `{ email, oauthUserId, code? }` | 给 OAuth 用户注册并绑定邮箱，返回 `{ userInfo, token }` |

## Webhook

| 方法 | 路径 | 参数 | 返回/说明 |
| --- | --- | --- | --- |
| `POST` | `/api/webhooks` | body `{ type, data }` | Resend 邮件状态回调；返回纯文本 `success` |

支持的 `type`：

- `email.delivered`
- `email.complained`
- `email.bounced`
- `email.delivery_delayed`
- `email.failed`

关键字段：

```json
{
  "type": "email.delivered",
  "data": {
    "email_id": "resend-email-id",
    "bounce": {},
    "failed": {
      "reason": "reason"
    }
  }
}
```

## 对象和静态资源

| 方法 | 路径 | 参数 | 返回/说明 |
| --- | --- | --- | --- |
| `GET` | `/api/oss/*` | path 通配 key | 从对象存储读取文件，不需要登录 |
| `GET` | `/attachments/*` | path 通配 key | Node 网关直接读取附件对象 |
| `GET` | `/static/*` | path 通配 key | Node 网关直接读取静态对象 |

## Telegram

| 方法 | 路径 | 参数 | 返回/说明 |
| --- | --- | --- | --- |
| `GET` | `/api/telegram/getEmail/:token` | path `{ token }` | 返回邮件 HTML 或文本页面；token 内包含 `emailId` |

## 初始化和健康检查

| 方法 | 路径 | 参数 | 返回/说明 |
| --- | --- | --- | --- |
| `GET` | `/api/init/:secret` | path `{ secret }` | `secret` 必须等于环境变量 `JWT_SECRET` / `jwt_secret` 对应值；成功返回纯文本 `success` |
| `GET` | `/healthz` | 无 | 返回 `{ "ok": true }` |

## 内部入站邮件接口

| 方法 | 路径 | 参数 | 返回/说明 |
| --- | --- | --- | --- |
| `POST` | `/api/internal/inbound-email` | body `{ envelopeTo, rawMimeBase64 }` | 内部收信入口；需要 HMAC 签名头 |

请求头：

| 请求头 | 说明 |
| --- | --- |
| `x-cm-timestamp` | Unix 秒级时间戳 |
| `x-cm-signature` | HMAC-SHA256 hex 签名 |
| `x-cm-event-id` | 幂等事件 ID |

签名算法：

```text
signature = hex(hmac_sha256(INBOUND_SHARED_SECRET, `${timestamp}.${rawBody}`))
```

body：

```json
{
  "envelopeTo": "user@example.com",
  "rawMimeBase64": "base64 encoded raw mime"
}
```

说明：

- 未配置 `INBOUND_SHARED_SECRET` 时该接口返回 `500`。
- 时间戳默认允许偏移 `300` 秒，可通过 `INBOUND_MAX_SKEW_SECONDS` 调整。
- `x-cm-event-id` 已处理过会返回 `{ "success": true, "duplicate": true }`。

## 二开注意点

- 当前 `src/api/test-api.js` 为空，没有测试接口。
- `src/security/security.js` 中 `/role/tree` 与实际 `/role/permTree` 不一致，二开时建议统一。
- `src/service/user-service.js` 的当前用户改密逻辑里写的是 `if (password < 6)`，从上下文看应为长度校验，二开时建议修成 `password.length < 6`。
- `/api/webhooks` 当前没有签名校验，若暴露到公网，建议加来源校验或 webhook secret。
