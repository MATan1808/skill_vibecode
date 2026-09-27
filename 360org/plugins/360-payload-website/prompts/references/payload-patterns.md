# Payload Patterns — Collections, Blocks, i18n

## Tạo custom block (pattern chuẩn của dự án)

Mỗi block = 1 thư mục `src/blocks/<Tên>/` với 2 file:

**`config.ts`** — khai báo block cho Payload:
```ts
import type { Block } from 'payload'

export const BarriersGrid: Block = {
  slug: 'barriersGrid',
  interfaceName: 'BarriersGridBlock',
  labels: { singular: 'Barriers Grid', plural: 'Barriers Grids' },
  fields: [
    { name: 'eyebrow', type: 'text', localized: true },
    { name: 'headline', type: 'text', localized: true, required: true },
    {
      name: 'barriers',
      type: 'array',
      minRows: 1, maxRows: 6,
      fields: [
        { name: 'icon', type: 'text' },               // emoji hoặc icon name
        { name: 'title', type: 'text', localized: true, required: true },
        { name: 'pain', type: 'textarea', localized: true },
        { name: 'solution', type: 'text', localized: true }, // hiện khi hover
      ],
    },
  ],
}
```

**`Component.tsx`** — render (Server Component mặc định):
```tsx
import type { BarriersGridBlock } from '@/payload-types'

export const BarriersGridComponent: React.FC<BarriersGridBlock> = ({ eyebrow, headline, barriers }) => (
  <section className="...">
    {eyebrow && <p className="...">{eyebrow}</p>}
    <h2>{headline}</h2>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {barriers?.map((b, i) => (/* thẻ số + icon + title + pain + solution */))}
    </div>
  </section>
)
```

**Đăng ký** trong `src/blocks/RenderBlocks.tsx` (map `slug` → Component) và thêm block vào field `layout` của collection `Pages`.

## Auto-fetch block (PricingTable, EcosystemGrid)

Các block hiển thị dữ liệu từ collection tự query trong Server Component:
```tsx
import { getPayload } from 'payload'
import config from '@payload-config'

export async function PricingTableComponent() {
  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'agentic-packages',
    sort: 'order',
    locale: /* lấy từ params */,
  })
  return (/* render 3 cột, gói highlighted có badge */)
}
```

## i18n (Payload localization)

Trong `payload.config.ts`:
```ts
localization: {
  locales: [
    { label: 'Tiếng Việt', code: 'vi' },
    { label: 'English', code: 'en' },
  ],
  defaultLocale: 'vi',
  fallback: true,
}
```
- Field user-facing → `localized: true`.
- Frontend đọc locale từ route (`/` = vi, `/en/...` = en) qua `middleware.ts`.
- Format VN: ngày `dd/MM/yyyy`, tiền `1.500.000đ`.

## Sau khi đổi schema — LUÔN chạy

```bash
pnpm generate:types        # cập nhật src/payload-types.ts (import types cho Component)
pnpm generate:importmap    # nếu thêm custom component vào admin
```
Quên `generate:types` → TS báo lỗi `BarriersGridBlock` không tồn tại.
