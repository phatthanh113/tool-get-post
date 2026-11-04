# Tính năng mới: Lấy Frame từ YouTube Video

## 🎥 Mô tả

Extension hiện đã hỗ trợ lấy frame hiện tại từ video YouTube và sử dụng trong editor, **tương tự như cách thêm ảnh từ Google Images**.

## 📋 Cách sử dụng

### Bước 1: Mở video YouTube

- Truy cập https://www.youtube.com
- Mở video bất kỳ
- Tua đến frame mà bạn muốn capture

### Bước 2: Capture frame

- **Chuột phải** vào video đang phát
- Chọn **"🎥 Thêm frame video vào Editor"** từ context menu

### Bước 3: Xử lý trong Editor

- Extension sẽ **tự động quyết định** đẩy frame vào đâu:
  - ✅ Nếu **chưa có ảnh nào** → Đẩy vào **Base Image** (ảnh nền)
  - ✅ Nếu **đã có Base** nhưng **chưa có Third** → Đẩy vào **Third Image**
  - ✅ Nếu **cả hai đã có** → **Thay thế Base Image** (Third giữ nguyên)
- Logic này **giống hệt** với cách thêm ảnh từ Google Images
- Bạn có thể:
  - Thêm nhiều frame từ các video khác nhau
  - Kết hợp với ảnh từ Google Images
  - Điều chỉnh kích thước, vị trí
  - Tải xuống ảnh hoặc chuyển thành video

## 🔧 Chi tiết kỹ thuật

### Files đã thay đổi:

1. **manifest.json**

   - Thêm content script cho YouTube: `youtube-content.js`
   - Pattern: `https://www.youtube.com/*`

2. **youtube-content.js** (MỚI)

   - Capture frame từ video element
   - Chuyển đổi frame thành data URL (JPEG, quality 95%)
   - Gửi về background script

3. **background.js**

   - Thêm context menu mới: `captureYouTubeFrame`
   - Context: `video` trên YouTube
   - Xử lý message từ youtube-content.js
   - **Tự động quyết định** đẩy vào base/third (giống Google Images)

4. **get_img_bg.js**
   - Hỗ trợ nhận frame từ YouTube
   - Load vào baseImage hoặc thirdImage tùy trạng thái

## ⚙️ Workflow

```
User click chuột phải trên video YouTube
    ↓
background.js nhận context menu click
    ↓
Gửi message "captureVideoFrame" đến youtube-content.js
    ↓
youtube-content.js capture frame từ <video> element
    ↓
Chuyển frame thành data URL (base64)
    ↓
Gửi data URL về background.js
    ↓
background.js kiểm tra trạng thái get_img_bg.html
    ↓
Tự động quyết định: base hoặc third?
    - Chưa có base → base
    - Có base, chưa có third → third
    - Cả hai đã có → thay base
    ↓
Gửi frame với imageType tương ứng
    ↓
get_img_bg.js load frame vào baseImage/thirdImage
    ↓
drawImages() vẽ lên canvas ✨
```

## 🎯 Use Cases

1. **Tạo thumbnail cho bài viết**

   - Lấy frame đẹp từ video YouTube
   - Thêm ảnh overlay hoặc ảnh thứ 3
   - Xuất ảnh thumbnail chất lượng cao

2. **So sánh hình ảnh**

   - Capture nhiều frame từ các video khác nhau
   - Ghép thành collage trong editor (layout 1:3)

3. **Tạo nội dung social media**
   - Lấy frame từ video viral
   - Kết hợp với ảnh từ Google Images
   - Chia sẻ trên mạng xã hội

## ⚠️ Lưu ý

- Frame được capture ở độ phân giải hiện tại của video
- Chất lượng tốt nhất khi video đang phát ở HD/Full HD
- Data URL có thể lớn (vài MB) cho video chất lượng cao
- Chỉ hoạt động trên https://www.youtube.com/*
- **Giống Google Images**: Tự động chọn base/third dựa trên trạng thái

## 🐛 Troubleshooting

**Không thấy context menu?**

- Reload extension trong chrome://extensions
- Refresh trang YouTube
- Đảm bảo đang chuột phải vào video, không phải player controls

**Frame bị mờ/chất lượng thấp?**

- Đợi video load hoàn toàn
- Chuyển sang chất lượng cao hơn (720p, 1080p)
- Pause video trước khi capture để frame rõ hơn

**Không load được frame vào editor?**

- Kiểm tra console log (F12)
- Đảm bảo get_img_bg.html đã load xong
- Thử reload extension

**Frame bị đẩy sai vị trí?**

- Logic tự động: chưa có base → base, có base chưa có third → third
- Nếu muốn thay đổi, xóa ảnh cũ trước khi capture frame mới
