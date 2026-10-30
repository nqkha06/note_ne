# Hướng dẫn cho agent

Repo này là renderer tương thích cho URL note cũ của STU. App chỉ đọc bảng
`note_links` từ MySQL/MariaDB legacy; không được gọi stu-api, PostgreSQL hoặc ghi
view/count.

- Dùng pnpm 10, không dùng npm/yarn.
- Chỉ đọc biến môi trường trong `src/config.ts`.
- Mọi truy vấn phải parameterized và tài khoản production phải chỉ có quyền SELECT.
- Chỉ render HTML từ `note_links.content` sau khi qua allowlist sanitizer; không
  cho phép script, event handler, inline style hoặc URL scheme nguy hiểm.
- Mỗi thay đổi phải qua `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
- Không commit `.env*` ngoài `.env.example`.
