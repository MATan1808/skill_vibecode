# Stack & Quy ước (vuaai.net playbook)

## Cấu trúc thư mục `src/` (thực tế từ vuaai.net)

```
src/
├─ app/                 Next.js App Router: (frontend) + (payload)
├─ blocks/              Payload custom blocks — 1 thư mục / block
│   ├─ HeroAgentic/     (config.ts + Component.tsx)
│   ├─ BarriersGrid/    6 rào cản, grid 3×2
│   ├─ ComparisonTable/ Nhân sự AI vs truyền thống
│   ├─ ComboShowcase/   VuaAI × VuaHệThống
│   ├─ PricingTable/    auto-fetch agentic-packages
│   ├─ EcosystemGrid/   auto-fetch ecosystem-partners
│   ├─ AgentSimulation/ demo agent tương tác
│   └─ ... (Content, MediaBlock, CallToAction, Banner, Code, ArchiveBlock)
├─ collections/         Payload collections
│   ├─ AgenticPackages.ts    3 gói: basic/advanced/vip
│   ├─ EcosystemPartners.ts  thẻ hệ sinh thái 360 CORP
│   ├─ CustomerLogos.ts      logo khách hàng
│   ├─ Pages/  Posts/  Media.ts  Categories.ts  Users/
├─ heros/               HighImpact / MediumImpact / LowImpact
├─ Header/  Footer/     Global layout (logo + nav + lang switcher)
├─ plugins/             Cấu hình plugin Payload tập trung
├─ access/  fields/  hooks/  utilities/  components/
├─ cssVariables.js      Theme tokens (brand colors)
├─ middleware.ts        i18n / redirect middleware
└─ payload.config.ts    Config Payload chính
```

## Quy ước Payload

1. **Collection custom** → `src/collections/<Tên>.ts` (hoặc `<Tên>/index.ts` nếu nhiều field).
2. **Block custom** → `src/blocks/<Tên>/` gồm `config.ts` (Payload block config) + `Component.tsx` (render React). Đăng ký trong `src/blocks/RenderBlocks.tsx`.
3. **i18n bắt buộc:** mọi field user-facing (`text`, `textarea`, `richText`) đặt `localized: true`.
4. **Theme tokens:** CSS variables ở `src/cssVariables.js` + Tailwind theme extension. Brand 360 CORP: xanh lá `#22C55E`, xanh dương `#2563EB`.
5. **SEO:** plugin `@payloadcms/plugin-seo`, meta title template `%s | VuaAI`.
6. **Sau khi đổi schema** → `pnpm generate:types` (cập nhật `src/payload-types.ts`), và `pnpm generate:importmap` nếu thêm component vào admin.

## Lệnh thường dùng (trong container dev)

```bash
pnpm dev                  # next dev (port 3000 trong container)
pnpm generate:types       # sinh TS types sau khi đổi schema
pnpm generate:importmap   # sinh import map cho admin custom components
pnpm build && pnpm start  # build + chạy production local
pnpm lint  /  pnpm lint:fix
pnpm test  /  pnpm test:int  /  pnpm test:e2e
```

## Collection signature: `agentic-packages`

```ts
{
  name: string (localized),
  tier: 'basic' | 'advanced' | 'vip' (unique),
  priceMonthly: number,            // VND
  priceLabel: string (localized),  // "1.500.000đ/tháng"
  tagline: string (localized),
  features: { text: string (localized), highlight: boolean }[],
  ctaLabel: string (localized),
  ctaUrl: string,
  highlighted: boolean,            // badge "Phổ biến nhất"
  order: number,
}
```

## Collection signature: `ecosystem-partners`

```ts
{
  name: string,
  tagline: string (localized),
  description: string (localized),
  url: string,
  logo: relationship('media'),
  category: 'ai' | 'erp' | 'website' | 'branding' | 'other',
  isCurrentSite: boolean,
  order: number,
}
```
