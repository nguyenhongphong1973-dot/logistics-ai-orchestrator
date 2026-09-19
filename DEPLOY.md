# Triển khai bản dùng chung nhiều người (Cloudflare Pages + D1)

Bản này thay `localStorage` bằng database thật (Cloudflare D1, miễn phí) + đăng nhập,
để nhiều người cùng công ty thao tác chung 1 bảng ticket. Cần làm 1 lần, ~10-15 phút.

## Bước 1 — Tạo tài khoản Cloudflare (nếu chưa có)

https://dash.cloudflare.com/sign-up — miễn phí, không cần thẻ.

## Bước 2 — Cài Wrangler CLI trên máy bạn

```bash
git clone https://github.com/nguyenhongphong1973-dot/logistics-ai-orchestrator
cd logistics-ai-orchestrator
npm install
npx wrangler login   # mở trình duyệt, đăng nhập Cloudflare
```

## Bước 3 — Tạo database D1 thật

```bash
npx wrangler d1 create logistics_ai_orchestrator
```

Lệnh này in ra một khối như:

```toml
[[d1_databases]]
binding = "DB"
database_name = "logistics_ai_orchestrator"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

Copy đúng `database_id` đó, mở file `wrangler.toml` trong repo, thay vào chỗ
`REPLACE_WITH_YOUR_D1_DATABASE_ID`.

## Bước 4 — Khởi tạo bảng dữ liệu trên database thật

```bash
npx wrangler d1 execute logistics_ai_orchestrator --remote --file=schema.sql
```

## Bước 5 — Tạo Cloudflare Pages project và deploy

```bash
npx wrangler pages project create logistics-ai-orchestrator --production-branch=main
npx wrangler pages deploy docs --project-name=logistics-ai-orchestrator
```

## Bước 6 — Gắn D1 vào Pages project (bắt buộc, làm trên dashboard)

Cloudflare Pages Functions cần binding D1 khai báo trên **dashboard**, không tự đọc `wrangler.toml`:

1. Vào https://dash.cloudflare.com → **Workers & Pages** → chọn project `logistics-ai-orchestrator`
2. **Settings → Functions → D1 database bindings → Add binding**
3. Variable name: `DB` — D1 database: chọn `logistics_ai_orchestrator` → **Save**
4. Vào tab **Deployments** → bấm **Retry deployment** (hoặc deploy lại bước 5) để binding có hiệu lực

## Bước 7 — Mở app và tạo tài khoản quản trị đầu tiên

Cloudflare cho link dạng `https://logistics-ai-orchestrator.pages.dev`. Mở link đó,
màn hình đầu tiên sẽ là **"Tạo tài khoản quản trị đầu tiên"** — điền username/mật khẩu, xong.

Sau đó vào **Quản lý tài khoản** trong app để tạo thêm tài khoản cho từng đồng nghiệp.

## Cập nhật code sau này

Mỗi lần tôi sửa code và push lên GitHub, bạn (hoặc tôi hướng dẫn) chạy lại:

```bash
git pull
npx wrangler pages deploy docs --project-name=logistics-ai-orchestrator
```

Database không mất dữ liệu khi deploy lại — chỉ code cập nhật.

## Nếu dùng GitHub Pages (bản cũ, không có backend)

GitHub Pages chỉ phục vụ file tĩnh, **không chạy được** thư mục `functions/` (API).
Bản đăng nhập/database chỉ chạy trên Cloudflare Pages theo hướng dẫn trên — không dùng
được với link `github.io` nữa.
