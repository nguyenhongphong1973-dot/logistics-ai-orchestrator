# Logistics AI Orchestrator

Bảng ticket + thư viện prompt cho mô hình **1 CEO-AI điều phối – 9 agent nghiệp vụ** của công ty logistics/forwarding.

Không build, không thư viện ngoài, không gọi mạng. Mở `public/index.html` bằng trình duyệt là chạy — dữ liệu ticket lưu trong `localStorage` của trình duyệt.

## 3 màn hình

| Tab | Nội dung |
|---|---|
| **Bảng Ticket** | Kanban 5 cột: Đã giao → Đang làm → Chờ nghiệm thu → PASS / ESCALATE. Tạo ticket theo đúng 7 trường (Agent, Input, Deliverable, Tiêu chí đạt, Deadline, Ưu tiên), tự đánh số `JOB-YYYY-####`. Ticket quá deadline tự gắn cờ **LATE**. |
| **KPI / Báo cáo** | Tổng ticket, % PASS lần đầu, thời gian xử lý trung bình, số ESCALATE, tồn đọng, bảng theo từng agent, danh sách LATE. |
| **Thư viện Prompt** | Nguyên văn 10 system prompt (CEO-AI + A1–A9) + quy ước dùng chung, có nút copy để dán vào Project/Skill AI tương ứng. |

## Quy trình ticket

```
ASSIGNED → IN_PROGRESS → SUBMITTED ──PASS──▶ DONE
                              │
                              ├──RETURN──▶ IN_PROGRESS (returnCount++)
                              │            RETURN lần 2 → cảnh báo nên ESCALATE
                              └──ESCALATE──▶ ESCALATE (chuyển người thật)
```

Ngưỡng escalate theo bản gốc: **độ tin cậy < 0.70**, **RETURN từ lần 2**, hoặc rủi ro tiền/pháp lý vượt phạm vi agent.

## Sao lưu dữ liệu

Ticket chỉ lưu trong trình duyệt (localStorage) — dùng nút **Xuất JSON** để tải file sao lưu, **Nhập JSON** để khôi phục hoặc chuyển sang máy khác.

## Thêm/sửa agent

Sửa `public/agents.js` — mỗi agent là một object `{ id, name, short, prompt }`. Không cần build lại.

## Nguyên tắc không được phá (từ bản gốc)

1. Người duyệt cuối cùng luôn là người thật với: tờ khai hải quan, B/L final, thanh toán, cam kết giá, thư khiếu nại gửi đi.
2. Mỗi agent chỉ có tool tối thiểu đủ dùng.
3. Ghi log mọi ticket — không log thì không có audit trail.
4. Ngưỡng escalate bằng số, không bằng cảm tính.
5. Không để agent tự gọi agent — mọi luồng qua CEO-AI.
