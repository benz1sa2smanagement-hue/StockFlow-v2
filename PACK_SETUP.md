# เปิดแท็บแพ็กใน StockFlow

ไฟล์ `pack.js` ถูกอัปโหลดแล้ว

## ขั้นตอน

1. แก้ไข `index.html`:
   - เพิ่มแท็บ **แพ็ก** ใน bottom nav: `data-page="pack"`
   - เพิ่มหน้า `#page-pack` ตามโครงสร้างใน repo ท้องถิ่น / zip
   - เพิ่ม `<script src="pack.js"></script>` หลัง `app.js`

2. เปิดแอป → ล็อกอิน → กด **แพ็ก**

## วิธีทำงานเมื่อแพ็กครบ

ระบบจะ POST ไป Firebase:

```
ws_{PIN}/rooms/{คลัง}/movements
{
  skuId, type: "out", pieces, qty,
  platform, user,
  note: "PackGuard · {OrderID}",
  packOrderId
}
```

หน้า Dashboard จะนับเป็นการจ่ายออกตามปกติ

## ไฟล์ที่เกี่ยวข้อง
- `pack.js` — โมดูลกันของผิด + ตัดสต็อก
- `app.js` — ไม่ต้องแก้ (ใช้ Firebase ชุดเดิม)
