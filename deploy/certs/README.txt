将 SMTP TLS 证书放到此目录，并在 deploy/.env 中配置：

- SMTP_TLS_KEY_PATH=/app/certs/privkey.key
- SMTP_TLS_CERT_PATH=/app/certs/fullchain.pem

如果使用 PFX：

- SMTP_TLS_PFX_PATH=/app/certs/mail.pfx
- SMTP_TLS_PFX_PASSPHRASE=你的口令

目录会以只读方式挂载到容器内的 /app/certs 。
