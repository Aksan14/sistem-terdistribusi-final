# LogistikPro

Sistem logistik terdistribusi — 5 microservice Go + Next.js 14.

## Jalankan

```bash
docker compose up -d --build
```

Tunggu ~60 detik, lalu:

| Layanan | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| API Gateway | http://localhost:8000 |
| RabbitMQ UI | http://localhost:15672 (admin / admin123) |

## Buat akun admin pertama

```bash
curl -s -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Admin","email":"admin@logistik.com","password":"admin123","role":"admin"}'
```

## Perintah berguna

```bash
docker compose ps        # status semua service
docker compose logs -f   # log realtime
docker compose down      # stop
docker compose down -v   # stop + hapus data
```

## Arsitektur

```
Frontend :3000 → API Gateway :8000
                 ├── User Service    :8001 → PostgreSQL (userdb)
                 ├── Order Service   :8002 → PostgreSQL (orderdb) → RabbitMQ
                 ├── Tracking Service:8003 → PostgreSQL (trackingdb) ← RabbitMQ
                 └── Notif Service   :8004 → PostgreSQL (notifdb)   ← RabbitMQ
```

## Prasyarat

- Docker Engine v24+
- Docker Compose v2+
- 4GB RAM
