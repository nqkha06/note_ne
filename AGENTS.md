# Hướng dẫn cho agent

Repo này là renderer và trình sửa tương thích cho note cũ của STU. App đọc
`users`, `note_links` từ MySQL/MariaDB legacy và chỉ sửa nội dung note của chính
user đã đăng nhập; không được gọi stu-api, PostgreSQL hoặc ghi view/count.

- Dùng pnpm 10, không dùng npm/yarn.
- Chỉ đọc biến môi trường trong `src/config.ts`.
- Mọi truy vấn phải parameterized. Tài khoản production chỉ có SELECT trên
  `users`/`note_links` và UPDATE (`title`, `content`, `updated_at`) trên `note_links`;
  tuyệt đối không có INSERT/DELETE.
- Không thêm tính năng, route hoặc API tạo note mới.
- Mọi UPDATE phải ràng buộc đồng thời `id` và `user_id` lấy từ session đã xác thực.
- Chỉ render HTML từ `note_links.content` sau khi qua allowlist sanitizer; không
  cho phép script, event handler, inline style hoặc URL scheme nguy hiểm.
- Mỗi thay đổi phải qua `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
- Không commit `.env*` ngoài `.env.example`.
