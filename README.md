# Phần mềm Quản lý Chấm công – Ngày phép

Phần mềm chấm công và quản lý ngày phép năm cho viên chức đơn vị sự nghiệp công lập.

Phần mềm chấm công dành cho **đơn vị sự nghiệp công lập**. Chạy ngay trên trình duyệt, **không cần cài đặt, không cần Internet, không cần máy chủ**.

## Cài đặt trên Windows

**Cách 1 – Bộ cài đặt (khuyên dùng)**

1. Vào tab **Actions** của kho GitHub → chọn lần chạy **Build Windows** mới nhất → mục *Artifacts* tải **QLChamCong-Windows** (file .zip) và giải nén.
   (Nếu có mục **Releases** thì tải trực tiếp từ đó.)
2. Chạy **`CaiDat-ChamCong-NgayPhep-x.y.z.exe`** → chọn thư mục cài → *Install*.
   Nếu Windows hiện cảnh báo *"Windows protected your PC"*, bấm **More info → Run anyway** (do phần mềm chưa mua chữ ký số).
3. Mở phần mềm bằng biểu tượng **Quản lý Chấm công – Ngày phép** trên màn hình Desktop hoặc menu Start.

- Bộ cài dùng được cho Windows 7, 8, 10, 11, cả bản 32-bit và 64-bit.
- **`ChamCong-NgayPhep-KhongCanCai-x.y.z.exe`**: bản chạy ngay, không cần cài đặt (chép vào USB dùng được).
- Dữ liệu tự động ghi vào **`Documents\QLChamCong\du-lieu-cham-cong.json`**. Mỗi ngày phần mềm tự sao lưu 1 bản vào thư mục **`Documents\QLChamCong\SaoLuu`** (giữ 60 ngày gần nhất). Gỡ phần mềm hoặc cài bản mới **không làm mất dữ liệu**.
- Muốn chuyển sang máy khác: chép thư mục `Documents\QLChamCong` sang máy mới, hoặc dùng *Sao lưu ra file* / *Khôi phục từ file* trong mục Cài đặt.

**Cách 2 – Không cần cài:** mở file `index.html` bằng Chrome, Edge hoặc Cốc Cốc. Cách này dữ liệu chỉ lưu trong trình duyệt.

## Bắt đầu sử dụng

Lần đầu mở phần mềm, **trình thiết lập 3 bước** tự hiện ra: (1) thông tin đơn vị, (2) danh sách viên chức (dán từ Excel được, tự bỏ cột STT), (3) số ngày phép năm. Sau đó có thể bắt đầu chấm công ngay. Mở lại trình thiết lập trong mục **Hướng dẫn sử dụng**.

Các bước chi tiết:

1. Vào **Cài đặt & Dữ liệu** để khai báo tên đơn vị, người ký, ngày lễ.
2. Vào **Danh sách viên chức** để thêm từng người hoặc **Nhập nhiều** (dán từ Excel: Họ tên; Chức vụ; Phòng).
3. Đầu năm, vào **Phép năm** để nhập số ngày phép được hưởng của từng người.
4. Hằng ngày, chấm nghỉ bằng một trong hai cách:
   - **Chấm nghỉ theo ngày**: chọn ngày, tích chọn những viên chức nghỉ, bấm **Sáng / Chiều / Cả ngày**, chọn loại nghỉ, rồi bấm **Lưu**.
   - **Nhập văn bản**: dán nội dung (ví dụ "Ngày 05/11: Nguyễn Văn An nghỉ phép buổi sáng") rồi bấm **Phân tích**.

> Muốn dùng thử nhanh: ở màn hình Tổng quan bấm **"Dùng thử với dữ liệu mẫu"**.

## Chấm nghỉ theo ngày (tích chọn)

- Chọn ngày bằng lịch hoặc nút ‹ ›. Nút này tự bỏ qua thứ bảy, chủ nhật và ngày lễ.
- Mỗi viên chức có ô tích và 3 nút **Sáng / Chiều / Cả ngày**. Bấm lại nút đang chọn thì bỏ chọn. Bỏ tích nghĩa là người đó đi làm bình thường.
- Loại nghỉ mặc định là **P – Nghỉ phép**. Có thể đổi cho từng người (ốm, công tác, học tập, nghỉ bù…).
- Cột **Phép năm còn lại** cho xem trước số phép sau khi lưu (ví dụ `12 → 11,5`). Nếu vượt số ngày phép, phần mềm sẽ hỏi lại trước khi lưu.
- **Nghỉ nhiều ngày**: điền ô "đến hết ngày" để ghi một lần cho cả khoảng ngày.
- Mở lại một ngày đã chấm thì thấy ngay ai đang nghỉ để sửa. Có thể hoàn tác trong mục *Nhập văn bản → Nhật ký*.

## Phép năm

- Nhập **số ngày phép được hưởng** của từng viên chức cho mỗi năm, kèm **số ngày năm trước chuyển sang** nếu có.
- Có các nút nhập nhanh: áp dụng cùng một số ngày cho tất cả, lấy số ngày của năm trước, chuyển phép còn lại của năm trước sang.
- Mỗi lần chấm **P (nghỉ phép)**, dù bằng tích chọn, bảng chấm công hay văn bản, phần mềm tự trừ: nửa ngày trừ 0,5, cả ngày trừ 1.
- Bảng phép năm có số ngày đã nghỉ theo từng tháng, số còn lại, chi tiết từng ngày nghỉ (bấm vào tên), và in hoặc xuất Excel được.

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
- **Chấm nghỉ theo ngày**: tích chọn viên chức nghỉ sáng, chiều hoặc cả ngày.
- **Phép năm**: nhập từ đầu năm, tự trừ khi nghỉ phép, cảnh báo khi vượt.
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
electron/               Ứng dụng Windows (Electron): cửa sổ, lưu file dữ liệu, sao lưu tự động
build/                  Biểu tượng phần mềm
tests/parser.test.js    Kiểm thử bộ phân tích (chạy: npm test)
```

Chạy thử bản desktop: `npm install` rồi `npm start`. Đóng gói bộ cài Windows (chạy trên Windows): `npm run dist`, file nằm trong thư mục `dist/`.
GitHub Actions (`.github/workflows/build-windows.yml`) tự build bộ cài mỗi lần đẩy code. Gắn tag `v1.1.0` thì tự tạo bản phát hành (Release).
