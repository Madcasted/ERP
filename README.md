# ERP

Next.js ERP starter with PostgreSQL via Docker.

## เริ่มต้น

1. คัดลอกไฟล์ environment

   ```bash
   cp .env.example .env
   ```

2. ติดตั้ง dependencies

   ```bash
   yarn install
   ```

3. สร้าง Prisma Client

   ```bash
   yarn prisma:generate
   ```

4. สร้างฐานข้อมูลเริ่มต้น

   ```bash
   yarn prisma:migrate
   yarn seed
   ```

5. รัน Docker Compose

   ```bash
   docker compose up --build
   ```

6. เข้าใช้งาน

   - Next.js: http://localhost:3000
   - Adminer: http://localhost:8080

## โครงสร้างหลัก

- `app/` - หน้า Next.js และ API routes
- `prisma/schema.prisma` - โมเดลฐานข้อมูล
- `docker-compose.yml` - Postgres + Next.js + Adminer

## หมายเหตุ

- `DATABASE_URL` ในไฟล์ `.env` ถูกตั้งให้เชื่อมต่อกับ service `db` ภายใน Docker network
- ใช้งาน Adminer เพื่อดูตารางและข้อมูลได้ที่ `http://localhost:8080`
