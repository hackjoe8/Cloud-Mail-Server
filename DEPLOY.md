# Cloud Mail Server 部署说明

本文档记录当前服务器排查结果、Docker Compose 部署方式、更新步骤和回滚步骤。不要把 SSH 密码、服务器 IP、管理员密码、JWT 密钥、数据库密码写入本文档。

## 当前服务器环境

- 系统：Ubuntu 26.04 LTS x86_64
- 内核：Linux 7.0.0-15-generic
- CPU：2 vCPU，Intel Xeon Platinum
- 内存：3.4 GiB
- 磁盘：根分区 79G，当前约 13% 使用
- Docker：29.5.2
- Docker Compose：v5.1.4
- 宝塔：已安装，目录位于 `/www/server`

## 当前部署信息

- 项目目录：`/opt/cloud-mail-server`
- Compose 目录：`/opt/cloud-mail-server/deploy`
- Compose 文件：`/opt/cloud-mail-server/deploy/docker-compose.yml`
- 环境变量文件：`/opt/cloud-mail-server/deploy/.env`
- Git 远端：`https://github.com/hackjoe8/Cloud-Mail-Server.git`
- Compose 项目名：`cloud-mail`

当前服务：

- `cloud-mail-cloud-mail-server-1`
- `cloud-mail-postgres-1`
- `cloud-mail-redis-1`
- `cloud-mail-minio-1`

端口：

- `25:25` SMTP
- `465:465` SMTP SSL
- `8787:8787` Web/API

数据卷由 Docker Compose 管理，更新代码和重建 `cloud-mail-server` 镜像不会删除 PostgreSQL、Redis、MinIO 数据卷。

## 本次更新记录

- 更新时间：`2026-06-04`
- 更新后提交：`fe679db fix: include pnpm workspace config in runtime image`
- 更新前备份目录：`/opt/cloud-mail-server-backups/pre-update-20260604-132607`
- 更新方式：保留现有 `.env` 和数据卷，只重建并重启 `cloud-mail-server`
- 验证结果：
  - `docker compose ps` 显示 4 个服务健康
  - `curl http://127.0.0.1:8787/healthz` 返回 `{"ok":true}`
  - `curl http://127.0.0.1:8787/api/pickup-public/not-a-real-token/list` 返回取件接口业务响应

## 更新部署

推荐更新方式：只更新应用镜像，不重新跑初始化 profile，避免覆盖已有数据库和存储配置。

```bash
cd /opt/cloud-mail-server

BACKUP="/opt/cloud-mail-server-backups/pre-update-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP"
cp -a deploy/.env "$BACKUP/deploy.env"
cp -a deploy/docker-compose.yml "$BACKUP/docker-compose.yml.before"
git status --short > "$BACKUP/git-status-before.txt"
git diff > "$BACKUP/local-diff-before.patch" || true

git fetch origin main
git pull --ff-only origin main

cd /opt/cloud-mail-server/deploy
docker compose --env-file .env config --quiet
docker compose --env-file .env build cloud-mail-server
docker compose --env-file .env up -d cloud-mail-server
docker compose --env-file .env ps
```

更新后验证：

```bash
curl -fsS http://127.0.0.1:8787/healthz
curl -sS http://127.0.0.1:8787/api/pickup-public/not-a-real-token/list
docker logs --tail 100 cloud-mail-cloud-mail-server-1
```

## 新服务器首次部署

前提：服务器已安装 Docker 和 Docker Compose。

```bash
apt update
apt install -y git curl

git clone https://github.com/hackjoe8/Cloud-Mail-Server.git /opt/cloud-mail-server
cd /opt/cloud-mail-server/deploy
cp .env.example .env
```

编辑 `.env`，至少确认以下配置：

```bash
nano /opt/cloud-mail-server/deploy/.env
```

必须确认：

- `DOMAIN`
- `ADMIN`
- `JWT_SECRET`
- `POSTGRES_PASSWORD`
- `DATABASE_URL`
- `MINIO_ROOT_USER`
- `MINIO_ROOT_PASSWORD`
- `S3_BUCKET`
- `SMTP_BIND_PORT`
- `SMTP_SECURE_BIND_PORT`
- `API_BIND_PORT`

首次初始化部署：

```bash
cd /opt/cloud-mail-server/deploy
chmod +x deploy.sh
./deploy.sh
```

`deploy.sh` 会启动 PostgreSQL、Redis、MinIO、后端服务，并执行初始化 profile。首次部署适合使用；已有生产数据的更新不建议反复执行初始化 profile。

## 常用命令

查看状态：

```bash
cd /opt/cloud-mail-server/deploy
docker compose --env-file .env ps
```

查看日志：

```bash
docker logs --tail 200 -f cloud-mail-cloud-mail-server-1
```

重启应用服务：

```bash
cd /opt/cloud-mail-server/deploy
docker compose --env-file .env restart cloud-mail-server
```

重新构建应用服务：

```bash
cd /opt/cloud-mail-server/deploy
docker compose --env-file .env build cloud-mail-server
docker compose --env-file .env up -d cloud-mail-server
```

查看本地监听端口：

```bash
ss -lntp
```

## 回滚

回滚前先确认旧提交号：

```bash
cd /opt/cloud-mail-server
git log --oneline -10
```

切到旧提交并重建应用容器：

```bash
cd /opt/cloud-mail-server
git switch --detach <旧提交号>

cd /opt/cloud-mail-server/deploy
docker compose --env-file .env build cloud-mail-server
docker compose --env-file .env up -d cloud-mail-server
docker compose --env-file .env ps
```

回到主分支最新版本：

```bash
cd /opt/cloud-mail-server
git switch main
git pull --ff-only origin main

cd /opt/cloud-mail-server/deploy
docker compose --env-file .env build cloud-mail-server
docker compose --env-file .env up -d cloud-mail-server
```

## 注意事项

- `.env` 不入库，复装前必须从旧服务器或备份恢复。
- 更新生产环境时优先只重建 `cloud-mail-server`，不要删除 Compose 数据卷。
- 反向代理由宝塔或其他网关单独配置，应用容器只负责暴露 `8787`。
- `deploy.sh` 适合首次初始化；已有数据环境更新时优先使用本文档的“更新部署”命令。
- Docker 构建依赖 pnpm 11，`pnpm-workspace.yaml` 中的 `allowBuilds` 用于允许必要依赖执行 build scripts。
