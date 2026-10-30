export type AppConfig = {
  host: string;
  port: number;
  mysql: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    connectionLimit: number;
    ssl: boolean;
  };
};

type Env = Readonly<Record<string, string | undefined>>;

function read(env: Env, key: string) {
  const value = env[key]?.trim();
  return value ? value : undefined;
}

function required(env: Env, key: string) {
  const value = read(env, key);
  if (!value) throw new Error(`${key} là bắt buộc.`);
  return value;
}

function integer(env: Env, key: string, fallback: number, min: number, max: number) {
  const raw = read(env, key);
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${key} phải là số nguyên từ ${min} đến ${max}.`);
  }
  return value;
}

export function loadConfig(env: Env = process.env): AppConfig {
  const sslMode = read(env, "MYSQL_SSL_MODE") ?? "disabled";
  if (sslMode !== "disabled" && sslMode !== "required") {
    throw new Error("MYSQL_SSL_MODE phải là disabled hoặc required.");
  }

  return {
    host: read(env, "HOST") ?? "0.0.0.0",
    port: integer(env, "PORT", 3001, 1, 65_535),
    mysql: {
      host: required(env, "MYSQL_HOST"),
      port: integer(env, "MYSQL_PORT", 3306, 1, 65_535),
      database: required(env, "MYSQL_DATABASE"),
      user: required(env, "MYSQL_USER"),
      password: env.MYSQL_PASSWORD ?? "",
      connectionLimit: integer(env, "MYSQL_CONNECTION_LIMIT", 5, 1, 20),
      ssl: sslMode === "required",
    },
  };
}
