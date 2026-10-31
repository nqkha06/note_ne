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

type UserRow = RowDataPacket & {
  id: number;
  name: string;
  email: string;
  password: string;
  status: string;
};

type OwnedNoteSummaryRow = RowDataPacket & {
  id: number;
  alias: string;
  title: string | null;
  status: string;
  createdAt: Date | string | null;
  updatedAt: Date | string | null;
  isExpired: number;
};

type OwnedNoteRow = OwnedNoteSummaryRow & { content: string };

export type LegacyUser = {
  id: number;
  name: string;
  email: string;
  password: string;
  status: string;
};

export type OwnedNoteSummary = {
  id: number;
  alias: string;
  title: string | null;
  status: string;
  createdAt: Date | string | null;
  updatedAt: Date | string | null;
  isExpired: boolean;
};

export type OwnedNote = OwnedNoteSummary & { content: string };

export type NoteRepository = {
  findByAlias(alias: string): Promise<LegacyNote | null>;
  findUserByEmail(email: string): Promise<LegacyUser | null>;
  findUserById(id: number): Promise<LegacyUser | null>;
  listByUserId(userId: number): Promise<OwnedNoteSummary[]>;
  findOwnedById(id: number, userId: number): Promise<OwnedNote | null>;
  updateOwned(id: number, userId: number, title: string | null, content: string): Promise<boolean>;
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
    async findUserByEmail(email) {
      const [rows] = await pool.execute<UserRow[]>(
        `SELECT id, name, email, password, status
         FROM users
         WHERE email = ?
         ORDER BY id ASC
         LIMIT 1`,
        [email],
      );
      return rows[0] ?? null;
    },
    async findUserById(id) {
      const [rows] = await pool.execute<UserRow[]>(
        `SELECT id, name, email, password, status
         FROM users
         WHERE id = ?
         LIMIT 1`,
        [id],
      );
      return rows[0] ?? null;
    },
    async listByUserId(userId) {
      const [rows] = await pool.execute<OwnedNoteSummaryRow[]>(
        `SELECT
           id, alias, title, status,
           created_at AS createdAt,
           updated_at AS updatedAt,
           expired_at IS NOT NULL AND expired_at <= UTC_TIMESTAMP() AS isExpired
         FROM note_links
         WHERE user_id = ? AND deleted_at IS NULL
         ORDER BY COALESCE(updated_at, created_at) DESC, id DESC`,
        [userId],
      );
      return rows.map((row) => ({ ...row, isExpired: row.isExpired === 1 }));
    },
    async findOwnedById(id, userId) {
      const [rows] = await pool.execute<OwnedNoteRow[]>(
        `SELECT
           id, alias, title, content, status,
           created_at AS createdAt,
           updated_at AS updatedAt,
           expired_at IS NOT NULL AND expired_at <= UTC_TIMESTAMP() AS isExpired
         FROM note_links
         WHERE id = ? AND user_id = ? AND deleted_at IS NULL
         LIMIT 1`,
        [id, userId],
      );
      const row = rows[0];
      return row ? { ...row, isExpired: row.isExpired === 1 } : null;
    },
    async updateOwned(id, userId, title, content) {
      const [result] = await pool.execute(
        `UPDATE note_links
         SET title = ?, content = ?, updated_at = UTC_TIMESTAMP()
         WHERE id = ? AND user_id = ? AND deleted_at IS NULL
         LIMIT 1`,
        [title, content, id, userId],
      );
      return "affectedRows" in result && result.affectedRows === 1;
    },
    async ping() {
      await pool.query("SELECT 1");
    },
    async close() {
      await pool.end();
    },
  };
}
