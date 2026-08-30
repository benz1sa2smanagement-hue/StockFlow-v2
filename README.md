# StockFlow v2

ระบบจัดการคลังสินค้า — เวอร์ชัน **Quiet Luxury** (Deep Navy + Champagne Gold)

## สิ่งที่เปลี่ยนจากเวอร์ชันเดิม
- ดีไซน์ใหม่: พื้น Deep Navy (`#0B1426`) + เน้น Champagne Gold (`#C9A84C`)
- หน้าแรก (Dashboard) ไม่โชว์มูลค่าเงิน — เหลือแค่จำนวนสต็อค / รับ-จ่าย
- มูลค่าเงิน (ต้นทุน / มูลค่าขาย / กำไร / ยอดขายจริง) อยู่ที่หน้า **ภาพรวม** เท่านั้น
- โปรเจกต์เดิม [`Index.html`](https://github.com/benz1sa2smanagement-hue/Index.html) **ไม่ถูกแก้ไข**
- ใช้ Firebase Realtime Database ชุดเดิมทุกอย่าง (login, SKU, movements, QR)

## วิธีทำงาน
`index.html` ของ v2 จะโหลดแอปต้นฉบับจาก repo เดิม แล้วฉีด CSS ธีม Quiet Luxury ทับลงไป  
ได้ฟีเจอร์ครบ 100% + หน้าตาใหม่ โดยไม่ต้องดูแลโค้ดซ้ำสองชุด

## วิธีเปิดใช้งาน
1. เปิด `index.html` ผ่าน GitHub Pages หรือเปิดไฟล์ในเบราว์เซอร์
2. ล็อกอินด้วย PIN เดิม
3. ใช้งานได้ทันที (ต้องมีเน็ตเพื่อดึงต้นฉบับ + เชื่อม Firebase)

### เปิด GitHub Pages (แนะนำ)
Settings → Pages → Source: **Deploy from a branch** → Branch: `main` / `/ (root)` → Save  
จากนั้นเข้า `https://benz1sa2smanagement-hue.github.io/StockFlow-v2/`

## โทนสี
| ชื่อ | Hex |
|------|-----|
| Deep Navy | `#0B1426` |
| Surface | `#12203A` |
| Champagne Gold | `#C9A84C` |
| Text | `#F5F0E8` |
| Success | `#3DDC97` |
| Danger | `#E85A5A` |

## สถานะ
✅ ธีม Quiet Luxury  
✅ ฟีเจอร์ครบตามต้นฉบับ (Firebase sync)  
✅ มูลค่าเงินเฉพาะหน้าภาพรวม  
✅ ต้นฉบับไม่ถูกแตะ  
