import mysql, { type RowDataPacket } from "mysql2/promise";

import type { AppConfig } from "./config.js";
import type { LegacyNote } from "./note.js";

type NoteRow = RowDataPacket & {
  alias: string;
  title: string | null;
  content: string;
  password: string | null;
  status: string;
  isDeleted: number;
  isExpired: number;
};

export type NoteRepository = {
  findByAlias(alias: string): Promise<LegacyNote | null>;
  ping(): Promise<void>;
  close(): Promise<void>;
};

export function createNoteRepository(config: AppConfig["mysql"]): NoteRepository {
  const pool = mysql.createPool({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    connectionLimit: config.connectionLimit,
    waitForConnections: true,
    queueLimit: 20,
    charset: "utf8mb4",
    enableKeepAlive: true,
    ...(config.ssl ? { ssl: { rejectUnauthorized: true } } : {}),
  });

  return {
    async findByAlias(alias) {
      const [rows] = await pool.execute<NoteRow[]>(
        `SELECT
           alias,
           title,
           content,
           password,
           status,
           deleted_at IS NOT NULL AS isDeleted,
           expired_at IS NOT NULL AND expired_at <= UTC_TIMESTAMP() AS isExpired
         FROM note_links
         WHERE alias = ?
         ORDER BY id ASC
         LIMIT 1`,
        [alias],
      );
      const row = rows[0];
      if (!row) return null;
      return {
        alias: row.alias,
        title: row.title,
        content: row.content,
        password: row.password,
        status: row.status,
        isDeleted: row.isDeleted === 1,
        isExpired: row.isExpired === 1,
      };
    },
    async ping() {
      await pool.query("SELECT 1");
    },
    async close() {
      await pool.end();
    },
  };
}
