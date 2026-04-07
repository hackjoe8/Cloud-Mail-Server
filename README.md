# Cloud Mail 服务器版

纯服务器部署版本，面向 **自托管 SMTP 收发 + Web 邮箱面板** 场景，不依赖 Cloudflare 收信链路。

当前这份 GitHub 发布仓库已经同步到最近两个月的可用代码，并额外做了发布整理：

- 同步后端、前端、部署脚本的最新可运行改动
- 移除本地 `.env` / 私有部署配置，仅保留示例配置
- 补充更新日志，方便直接查看本次发布包含的功能点

## Clone

HTTPS：

```bash
git clone https://github.com/xvhuan/Cloud-Mail-Server.git
```

SSH：

```bash
git clone git@github.com:xvhuan/Cloud-Mail-Server.git
```

## 最近更新重点

- 支持 **域名白名单/邮箱后缀列表** 的独立管理页面
- 支持 **通配域名**（如 `*.example.com`）校验与批量导入
- SMTP 提交能力增强：
  - 支持认证后向站外收件人 relay
  - 支持 `STARTTLS`
  - 支持 `SMTPS/465`
  - 支持证书文件 / PFX 配置
  - 支持受控开启明文 AUTH
- 增强内部收信 API 的签名与时钟偏移校验
- 新增永久公共 Token、面板脱敏展示与更多系统设置项
- Docker 部署补充：
  - `deploy.sh` 一键初始化
  - `deploy/certs/` 证书挂载说明
  - 更完整的 `.env.example`
- 补充后端/前端测试用例，覆盖域名规则、SMTP 行为、页面入口与最新邮件轮询逻辑

完整记录见：[CHANGELOG.md](./CHANGELOG.md)

## 核心特性

- 前后端一体：后端镜像构建时自动打包 `mail-vue`
- SMTP 直接收信：默认开放 `25`
- SMTP 服务器直发：站外邮件由服务器直连目标 MX（需放通出站 25）
- 可选 SMTP 提交增强：`AUTH` / `STARTTLS` / `SMTPS`
- Web/API 服务：默认开放 `8787`
- `PostgreSQL`、`Redis`、`MinIO` 全部走 Docker 内置网络，不占用宿主机数据库/缓存端口

## 目录结构

- `cloud-mail-server/`：后端服务与 SMTP 运行时
- `mail-vue/`：前端源码
- `deploy/`：Docker 编排、部署脚本、证书目录说明
- `CHANGELOG.md`：发布更新日志

## 配置安全说明

为避免泄露个人环境信息，仓库 **不包含你的本地 `.env` 与私有部署配置**。

保留在仓库中的配置文件均为：

- 脱敏后的示例配置
- 构建所需的通用前端环境预设
- 不含真实密钥、真实域名、真实密码的占位值

部署前请务必自行复制并填写：

```bash
cd deploy
cp .env.example .env
```

## 快速开始

```bash
cd deploy
cp .env.example .env
./deploy.sh
```

查看状态：

```bash
docker compose ps
docker compose logs -f cloud-mail-server
```

## 对外端口

- `25/tcp`：SMTP 收信
- `465/tcp`：SMTPS 提交（可选启用）
- `8787/tcp`：Web/API

其余服务端口（`5432/6379/9000/9001`）只在容器内网可见。

## 文档入口

- 部署文档：[deploy/README.md](./deploy/README.md)
- 后端说明：[cloud-mail-server/README.md](./cloud-mail-server/README.md)
- 更新日志：[CHANGELOG.md](./CHANGELOG.md)

## 致谢

本项目基于原项目进行服务器化部署整理，致敬：

- `maillab/cloud-mail`：`https://github.com/maillab/cloud-mail`
