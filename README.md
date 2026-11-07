# Phần mềm Quản lý Chấm công Viên chức

Phần mềm chấm công dành cho **đơn vị sự nghiệp công lập**. Chạy ngay trên trình duyệt, **không cần cài đặt, không cần Internet, không cần máy chủ**.

## Cách sử dụng

1. Tải thư mục về máy, mở file **`index.html`** bằng Chrome, Edge hoặc Cốc Cốc.
2. Vào **Cài đặt & Dữ liệu** để khai báo tên đơn vị, người ký, ngày lễ.
3. Vào **Danh sách viên chức** để thêm từng người hoặc **Nhập nhiều** (dán từ Excel: Họ tên; Chức vụ; Phòng).
4. Vào **Nhập văn bản**, dán nội dung chấm công rồi bấm **Phân tích văn bản**, kiểm tra lại, sau đó bấm **Ghi vào dữ liệu**.

> Muốn dùng thử nhanh: ở màn hình Tổng quan bấm **"Dùng thử với dữ liệu mẫu"**.

## Nhập chấm công bằng văn bản

Có thể viết tự do bằng tiếng Việt, có dấu hoặc không dấu. Ví dụ:

```
Ngày 05/11/2026: Nguyễn Văn An nghỉ phép buổi sáng, Trần Thị Bình đi công tác cả ngày
Lê Văn Cường nghỉ ốm từ 03/11 đến 06/11
Ngày 10/11/2026
- Phạm Thị Dung nghỉ phép sáng, chiều đi học bồi dưỡng
- Chị Lan nghỉ con ốm
- Hoàng Văn Hùng, Võ Minh Khoa đi tập huấn buổi chiều
Hoàng Văn Hùng trực cơ quan thứ bảy ngày 15/11
Cộng 1,5 ngày bù cho Võ Minh Khoa ngày 16/11 do làm thêm giờ
```

| Thành phần | Cách viết được hiểu |
|---|---|
| Ngày | `05/11/2026`, `5/11`, `ngày 5 tháng 11 năm 2026`, `từ 3/11 đến 6/11`, `3-6/11`, `ngày 3, 4 và 5/11`, `hôm nay`, `hôm qua` |
| Buổi | `sáng`, `chiều`, `cả ngày` (không ghi thì tính cả ngày) |
| Loại | nghỉ phép (P), nghỉ bù (NB), ốm (Ô), con ốm (Cô), thai sản (TS), tai nạn (T), công tác (CT), học tập/tập huấn/hội nghị (H), việc riêng/cưới/tang (R), không lương (Ro), không phép/vắng (KP), đi làm (xoá ngày nghỉ) |
| Ngày bù | `trực`, `làm thêm`, `đi làm thứ bảy/chủ nhật` → tự cộng ngày bù; hoặc `cộng 2 ngày bù cho …` |
| Tên | Họ tên đầy đủ, hoặc tên gọi (`chị Lan`, `anh Hùng`) nếu không trùng; hoặc "Tên gọi khác" khai báo trong danh sách |

- Dòng chỉ ghi ngày sẽ áp dụng cho các dòng phía dưới.
- Khoảng ngày tự bỏ qua thứ bảy, chủ nhật và ngày lễ.
- Tên chưa có trong danh sách sẽ được báo, có nút thêm nhanh.
- Mỗi lần ghi đều lưu nhật ký, có thể **hoàn tác** lần ghi gần nhất.

## Chức năng chính

- **Bảng chấm công** theo tháng (ký hiệu theo mẫu C01-HD), chấm theo buổi sáng/chiều, chế độ **chấm nhanh** (chọn ký hiệu rồi bấm vào ô), ghi chú từng ô.
- **In** bảng chấm công khổ A4 ngang có phần ký tên; **xuất Excel**.
- **Thống kê tổng hợp** theo tháng và theo năm: công làm việc, công tác, học tập, phép, nghỉ bù, lễ, BHXH, không lương, tổng ngày hưởng lương, phép năm còn lại.
- **Ngày bù**: cộng thêm ngày bù cho một người hoặc cả đơn vị, theo dõi số phát sinh / đã nghỉ / còn tồn lũy kế. Có tuỳ chọn cộng ngày bù vào tổng công tháng.
- **Ngày lễ**: lễ dương lịch tự động; nạp lịch nghỉ Tết, Giỗ Tổ gợi ý theo năm (cần đối chiếu thông báo chính thức), thêm hoặc xoá tuỳ ý.
- **Sao lưu / khôi phục** dữ liệu ra file `.json`.

## Quy tắc tính công

- Ngày làm việc (thứ 2 đến thứ 6, hoặc thêm thứ 7 nếu bật trong cài đặt) không có ghi nhận gì thì tính là **đi làm (+)**.
- Mỗi buổi = 0,5 ngày công.
- **Tổng hưởng lương** = Đi làm + Công tác + Học tập + Phép + Nghỉ bù + Lễ + Việc riêng có lương.
- Làm việc vào ngày nghỉ không cộng vào công tháng mà được quy thành **ngày bù**. Ngày bù còn tồn = tổng bù phát sinh − tổng đã nghỉ bù (NB).
- Mặc định chỉ tính công đến hôm nay (có thể tắt trong Cài đặt).

## Lưu ý về dữ liệu

Dữ liệu được lưu trong trình duyệt (localStorage) của máy đang dùng. Nếu xoá dữ liệu trình duyệt hoặc đổi máy thì sẽ mất, vì vậy hãy **sao lưu định kỳ** trong mục Cài đặt & Dữ liệu.

## Dành cho người phát triển

```
index.html              Giao diện chính
assets/css/style.css    Giao diện
assets/js/core.js       Ký hiệu, lịch làm việc, hàm tính công
assets/js/parser.js     Bộ phân tích văn bản tiếng Việt
assets/js/store.js      Lưu trữ dữ liệu
assets/js/app.js        Các màn hình
tests/parser.test.js    Kiểm thử bộ phân tích (chạy: node tests/parser.test.js)
```
