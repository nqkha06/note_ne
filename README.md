# STU Note

App tương thích cho các URL note đã được chia sẻ từ Link4Sub cũ. Route
`https://note.example.com/:alias` đọc trực tiếp bảng `note_links` ở
MySQL/MariaDB legacy và hiển thị nội dung đơn giản. App có khu vực đăng nhập để
người dùng cũ xem và sửa note của chính mình. App không gọi stu-api, không đọc
PostgreSQL và không ghi view, access log hay revenue.

## Hành vi

- Note `status = active` hoặc `1`, chưa xóa, chưa hết hạn, không có mật khẩu:
  trả trang nội dung `200`.
- Note có mật khẩu: hiện form mở khóa, kiểm hash bcrypt/Argon2 của Laravel và
  cấp cookie HttpOnly trong 1 giờ khi nhập đúng; không đưa nội dung vào HTML
  trước khi xác thực.
- Note đã xóa, hết hạn, inactive hoặc rỗng: trả trang giải thích `410`.
- Alias không tồn tại: trả `404`.
- Nội dung HTML legacy được render qua allowlist sanitizer; script, event
  handler, inline style và URL scheme nguy hiểm đều bị loại bỏ.
- `/login` xác thực trực tiếp `users.email/password`; chỉ user `active` được vào.
- `/notes` liệt kê note chưa soft-delete của tài khoản đang đăng nhập.
- `/notes/:id/edit` cho sửa `title` và `content` bằng TinyMCE 8 self-hosted;
  alias, mật khẩu, trạng thái và hạn dùng không bị thay đổi.
- Không có route, API hay nút tạo note mới.
- Mọi trang note dùng `noindex`, `no-store`; JavaScript chỉ được dùng cho editor.

Nếu bảng có alias trùng, app chọn dòng có `id` nhỏ nhất. Đây cũng là thứ tự mà
quy trình migrate note hiện tại dùng khi cấp slug.

## Chạy local

Yêu cầu Node.js >= 20, pnpm 10 và MySQL/MariaDB chứa bảng `users`, `note_links`.

```bash
corepack enable
pnpm install
cp .env.example .env
set -a; source .env; set +a
pnpm dev
```

Kiểm tra:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Tài khoản MySQL production

Nên dùng user riêng với quyền tối thiểu. App cần đọc tài khoản/note và chỉ được
cập nhật ba cột nội dung; không cần quyền tạo hoặc xóa:

```sql
CREATE USER 'stu_note_editor'@'%' IDENTIFIED BY '<strong-random-password>';
GRANT SELECT ON legacy_stu.users TO 'stu_note_editor'@'%';
GRANT SELECT ON legacy_stu.note_links TO 'stu_note_editor'@'%';
GRANT UPDATE (title, content, updated_at) ON legacy_stu.note_links TO 'stu_note_editor'@'%';
```

Không cấp quyền `INSERT`, `DELETE`, quyền sửa cột khác hay quyền trên PostgreSQL.
Mọi ID/alias/email đều được truyền qua prepared statement, không nối chuỗi vào SQL.

## Deploy Dokploy

1. Tạo repo riêng cho thư mục này và tạo Docker Compose application từ
   `compose.dokploy.yml`.
2. Đặt `MYSQL_HOST` là hostname/container MariaDB legacy trên
   `dokploy-network`, cùng `MYSQL_USER` và `MYSQL_PASSWORD` giới hạn như trên.
   Tạo `SESSION_SECRET` ngẫu nhiên tối thiểu 32 ký tự và giữ ổn định giữa các lần deploy.
3. Gắn domain `note.example.com` vào service `note`, port `3001`.
4. Ở deployment `stu-web`, đặt `NOTE_URL=https://note.example.com` rồi redeploy.
   `https://example.com/note/:alias` sẽ trả 308 sang
   `https://note.example.com/:alias` và giữ nguyên query string.

MariaDB legacy phải tiếp tục chạy trong thời gian cần hỗ trợ link cũ; không thể
tắt service đó sau migration nếu app này còn phục vụ người dùng.

App dùng `BIND_HOST=0.0.0.0` để chọn địa chỉ lắng nghe. Không dùng biến `HOST`
vì một số nền tảng deploy tự gán biến đó thành hostname hoặc IP public không
thuộc container, dẫn tới lỗi `EADDRNOTAVAIL`.

## Giấy phép editor

TinyMCE được đóng gói từ dependency npm và chạy self-hosted với
`license_key: "gpl"` theo GPLv2+. Không dùng Tiny Cloud hoặc gửi nội dung note
ra dịch vụ ngoài. Nếu sản phẩm triển khai theo giấy phép thương mại, thay cấu
hình này bằng TinyMCE 8 commercial license key hợp lệ.
