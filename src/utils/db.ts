import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

const url = new URL(process.env.DATABASE_URL!);

const adapter = new PrismaMariaDb({
  host: url.hostname,
  port: Number(url.port) || 3306,
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database: url.pathname.replace('/', ''),
  connectTimeout: 20000,
  ...(url.hostname !== 'localhost' && url.hostname !== '127.0.0.1' ? { ssl: { rejectUnauthorized: false } } : {})
});

export const prisma = new PrismaClient({ adapter });
