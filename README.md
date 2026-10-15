# ✈ Máy Bay Giấy: Không Chiến Sân Trường

*Paper Plane Dogfight: Schoolyard Skies*: game không chiến máy bay giấy 3D chạy ngay trong trình duyệt (three.js), không cần cài đặt.

## Chơi

Mở `index.html` bằng trình duyệt (cần mạng để tải three.js từ CDN), hoặc chơi online: https://thetrihuynh.github.io/paper-plane-dogfight/

## Tính năng

- 12 chương truyện nối tiếp (Phe Xanh đấu Phe Đỏ): gió mùa, bảo vệ sân trường khỏi bom nước, sương mù, Tàu Mẹ, đêm trăng, Song Nhạn, trận 3 đấu 1 với Red Eagle, và màn Phản công hộ tống Hạc Lớn với một lựa chọn quyết định hai kết thúc khác nhau, có cảnh phim mở đầu và kết thúc
- Xuất kích chơi liền 12 chương, hoặc chọn chơi riêng từng chương
- Xưởng gấp máy bay: 7 kiểu gấp có thật (Phi Tiêu, Suzanne, Nakamura, Nhào Lộn, Chim Én, Bumerang, Vòng Ống), tự chọn màu giấy và màu viền
- Chế độ siêu thanh (cánh gập lại), né tên lửa lăn vòng, súng với vòng ngắm đón đầu, tên lửa khoá mục tiêu
- Hai toà tháp Hightower canh trời: bay dưới 10 m hoặc dưới mái là khuất tầm tháp, tên lửa khoá chậm hẳn (cả hai phe). Hộp tiếp tế rơi xuống các khe thấp dưới tán cây, mái nhà
- Luồn qua khe: gốc và hầm lá cây đa, tầng lá bàng, ghế đá, rổ bóng rổ… để cắt đuôi tên lửa
- Radar kiểu máy bay chiến đấu, hộp tiếp tế, vật phẩm tăng sức mạnh, huy chương và kỷ lục

## Điều khiển

| Phím | Chức năng |
|---|---|
| Chuột | Ngắm hướng bay |
| W/S, A/D (hoặc mũi tên) | Lên/xuống, rẽ trái/phải (giữ W/S để nhào lộn) |
| Shift · X | Tăng tốc · Phanh gió |
| Chuột trái / Space | Súng |
| Chuột phải / F · G | Tên lửa · Đổi súng ↔ tên lửa |
| B | Siêu thanh |
| V | Lăn né + pháo sáng |
| R (giữ) · Tab | Bám mục tiêu · Đổi mục tiêu |
| T · C | Nhìn mục tiêu · Đổi góc máy |
| N · H | Tầm radar · Kiểu HUD |
| Esc / P · M | Tạm dừng · Tắt tiếng |

## Cấu trúc mã

Mở thẳng `index.html` là chơi được, không cần máy chủ. Trang nạp three.js rồi nạp lần lượt các file dưới đây (thứ tự quan trọng, chúng dùng chung một phạm vi toàn cục):

| File | Nội dung |
|---|---|
| `js/core.js` | hằng số, renderer, tiện ích, texture, vật liệu |
| `js/world.js` | sân trường, cây, khe bay, Trường Bên Kia Sông, lưới va chạm |
| `js/effects.js` | giấy vụn, khói, lửa |
| `js/aircraft.js` | mẫu máy bay, các loại máy bay, xưởng gấp, mô hình bay |
| `js/weapons.js` | súng, tên lửa, bom nước, hộp tiếp tế, vòng thưởng, pháo sáng |
| `js/escort.js` | màn Phản công: Hạc Lớn, pháo phòng không, SAM |
| `js/audio.js` · `js/input.js` | âm thanh, radio · bàn phím, chuột, cảm ứng |
| `js/game.js` | trạng thái game, luồng chương, kết quả, bầu trời |
| `js/chapters/ch01.js` … `ch12.js` | **mỗi chương một file**: truyện, địch, bầu trời, lời thoại |
| `js/player.js` | điều khiển người chơi |
| `js/cinematic.js` | camera điện ảnh, cảnh phim Red Eagle, Hạc Lớn, cảnh kết |
| `js/ai.js` | AI địch và đồng đội, kỹ năng trùm |
| `js/camera.js` · `js/hud.js` · `js/main.js` | camera · HUD, radar · vòng lặp chính |

Vào thẳng một chương: `index.html?chuong=9` (nút bắt đầu thành "CHƠI CHƯƠNG 9").

## Tệp khác

- `race.html`: chế độ đua
- `dogfight_v1_backup.html`: bản đầu tiên (lưu trữ)
