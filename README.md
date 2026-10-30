# STU Note

App tương thích cho các URL note đã được chia sẻ từ Link4Sub cũ. Route
`https://note.example.com/:alias` đọc trực tiếp bảng `note_links` ở
MySQL/MariaDB legacy và hiển thị nội dung đơn giản. App không gọi stu-api,
không đọc PostgreSQL và không ghi view, access log hay revenue.

## Hành vi

- Note `status = active` hoặc `1`, chưa xóa, chưa hết hạn, không có mật khẩu:
  trả trang nội dung `200`.
- Note có mật khẩu: trả trang khóa `403`, không đưa nội dung vào HTML.
- Note đã xóa, hết hạn, inactive hoặc rỗng: trả trang giải thích `410`.
- Alias không tồn tại: trả `404`.
- Nội dung được render dạng text và escape toàn bộ HTML legacy để tránh XSS.
- Mọi trang note dùng `noindex`, `no-store`; app không có JavaScript phía client.

Nếu bảng có alias trùng, app chọn dòng có `id` nhỏ nhất. Đây cũng là thứ tự mà
quy trình migrate note hiện tại dùng khi cấp slug.

## Chạy local

Yêu cầu Node.js >= 20, pnpm 10 và MySQL/MariaDB chứa bảng `note_links`.

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

Nên dùng user riêng chỉ có quyền đọc đúng bảng cần thiết:

```sql
CREATE USER 'stu_note_reader'@'%' IDENTIFIED BY '<strong-random-password>';
GRANT SELECT ON legacy_stu.note_links TO 'stu_note_reader'@'%';
```

Không cấp quyền `INSERT`, `UPDATE`, `DELETE` hay quyền trên PostgreSQL. Alias
được truyền qua prepared statement, không nối chuỗi vào SQL.

## Deploy Dokploy

1. Tạo repo riêng cho thư mục này và tạo Docker Compose application từ
   `compose.dokploy.yml`.
2. Đặt `MYSQL_HOST` là hostname/container MariaDB legacy trên
   `dokploy-network`, cùng `MYSQL_USER` và `MYSQL_PASSWORD` read-only.
3. Gắn domain `note.example.com` vào service `note`, port `3001`.
4. Ở deployment `stu-web`, đặt `NOTE_URL=https://note.example.com` rồi redeploy.
   `https://example.com/note/:alias` sẽ trả 308 sang
   `https://note.example.com/:alias` và giữ nguyên query string.

MariaDB legacy phải tiếp tục chạy trong thời gian cần hỗ trợ link cũ; không thể
tắt service đó sau migration nếu app này còn phục vụ người dùng.

App dùng `BIND_HOST=0.0.0.0` để chọn địa chỉ lắng nghe. Không dùng biến `HOST`
vì một số nền tảng deploy tự gán biến đó thành hostname hoặc IP public không
thuộc container, dẫn tới lỗi `EADDRNOTAVAIL`.
