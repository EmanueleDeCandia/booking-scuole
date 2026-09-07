import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { Pool } from "pg";
import { PGlite } from "@electric-sql/pglite";
import path from "node:path";
import fs from "node:fs";

const databaseUrl = process.env.DATABASE_URL;

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
  __arenaNextJsPglite?: PGlite;
  __arenaDb?: any;
  __arenaSchemaInit?: Promise<void>;
};

let pool: Pool | undefined;
let pgliteClient: PGlite | undefined;

if (databaseUrl) {
  pool =
    globalForDb.__arenaNextJsPostgresqlPool ??
    new Pool({
      connectionString: databaseUrl,
    });
  if (process.env.NODE_ENV !== "production") {
    globalForDb.__arenaNextJsPostgresqlPool = pool;
  }
} else {
  if (!globalForDb.__arenaNextJsPglite) {
    const dataDir = path.join(process.cwd(), ".data", "pglite");
    try {
      fs.mkdirSync(dataDir, { recursive: true });
      const pidFile = path.join(dataDir, "postmaster.pid");
      if (fs.existsSync(pidFile)) {
        fs.unlinkSync(pidFile);
      }
    } catch {}

    try {
      const client = new PGlite(dataDir);
      client.waitReady.catch((err) => {
        console.warn("PGlite dataDir failed, fallback to in-memory:", err);
        try {
          fs.rmSync(dataDir, { recursive: true, force: true });
        } catch {}
        globalForDb.__arenaNextJsPglite = new PGlite();
        globalForDb.__arenaDb = drizzlePglite(globalForDb.__arenaNextJsPglite);
      });
      globalForDb.__arenaNextJsPglite = client;
    } catch {
      globalForDb.__arenaNextJsPglite = new PGlite();
    }
  }
  pgliteClient = globalForDb.__arenaNextJsPglite;
}

export const db = (
  globalForDb.__arenaDb ??
  (pool ? drizzlePg(pool) : drizzlePglite(pgliteClient!))
) as ReturnType<typeof drizzlePg>;

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaDb = db;
}

export async function ensureDbSchema() {
  if (pgliteClient) {
    try {
      await pgliteClient.waitReady;
    } catch {
      // client fallback già gestito
    }
  }

  if (globalForDb.__arenaSchemaInit) {
    return globalForDb.__arenaSchemaInit;
  }

  const initPromise = (async () => {
    const statements = [
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        phone TEXT,
        avatar_url TEXT,
        role TEXT NOT NULL DEFAULT 'user',
        status TEXT NOT NULL DEFAULT 'active',
        membership_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );`,
      `CREATE INDEX IF NOT EXISTS users_role_idx ON users(role);`,
      `CREATE TABLE IF NOT EXISTS bookings (
        id SERIAL PRIMARY KEY,
        user_id TEXT,
        day DATE NOT NULL,
        hour INTEGER NOT NULL,
        client_name TEXT NOT NULL,
        client_email TEXT,
        client_phone TEXT,
        service TEXT NOT NULL DEFAULT 'Consulenza',
        notes TEXT,
        status TEXT NOT NULL DEFAULT 'confirmed',
        attendance_status TEXT NOT NULL DEFAULT 'pending',
        reminder_minutes INTEGER NOT NULL DEFAULT 60,
        reminder_sent BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );`,
      `CREATE INDEX IF NOT EXISTS bookings_day_idx ON bookings(day);`,
      `CREATE UNIQUE INDEX IF NOT EXISTS bookings_day_hour_active_idx ON bookings(day, hour) WHERE status <> 'cancelled';`,
      `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS user_id TEXT;`,
      `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS attendance_status TEXT NOT NULL DEFAULT 'pending';`,
      `CREATE INDEX IF NOT EXISTS bookings_user_id_idx ON bookings(user_id);`,
      `CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        booking_id INTEGER REFERENCES bookings(id) ON DELETE CASCADE,
        kind TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        read BOOLEAN NOT NULL DEFAULT FALSE,
        scheduled_for TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );`,
      `CREATE INDEX IF NOT EXISTS notifications_read_idx ON notifications(read);`,
      `CREATE TABLE IF NOT EXISTS courses (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        instructor TEXT NOT NULL DEFAULT 'Maestro della Scuola',
        category TEXT NOT NULL DEFAULT 'Danza',
        color TEXT NOT NULL DEFAULT '#e8542f',
        max_capacity INTEGER NOT NULL DEFAULT 15,
        price INTEGER NOT NULL DEFAULT 50,
        status TEXT NOT NULL DEFAULT 'active',
        votes_sum INTEGER NOT NULL DEFAULT 0,
        votes_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );`,
      `CREATE INDEX IF NOT EXISTS courses_status_idx ON courses(status);`,
      `CREATE TABLE IF NOT EXISTS course_votes (
        id SERIAL PRIMARY KEY,
        course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        rating INTEGER NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );`,
      `CREATE INDEX IF NOT EXISTS course_votes_course_id_idx ON course_votes(course_id);`
    ];

    for (const stmt of statements) {
      try {
        if (pool) {
          await pool.query(stmt);
        } else if (pgliteClient) {
          await pgliteClient.exec(stmt);
        }
      } catch (err) {
        // Ignora se la colonna o l'indice esiste già
        console.warn("Schema initialization statement skipped/handled:", err);
      }
    }
  })();

  globalForDb.__arenaSchemaInit = initPromise;

  try {
    await initPromise;
    return initPromise;
  } catch (err) {
    globalForDb.__arenaSchemaInit = undefined; // Riprova in caso di errore
    throw err;
  }
}

