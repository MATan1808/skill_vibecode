---
name: 360-airouter
description: Kỹ năng phát triển và vận hành OmniRouter — AI gateway proxy đa vendor (Gemini, Claude, GPT, Grok...) cho 360org. Bao gồm cấu hình Combo, Response Validation, tool name normalization, và debugging.
metadata:
  origin: 360org
  repo: /Volumes/DATA/DEV/OmniRouter
---

# 360org — AIRouter (OmniRouter Development Skill)

OmniRouter là một AI proxy gateway đa vendor, chạy tại `localhost:3000` (hoặc remote URL), nhận request theo chuẩn OpenAI/Anthropic API và định tuyến sang Gemini, Claude, GPT, Grok, DeepSeek... với fallback/combo routing.

---

## 1. Kiến trúc tổng quan

```
Client (Claude Code / IDE / app)
        ↓ OpenAI hoặc Anthropic API format
  OmniRouter (proxy gateway)
        ↓ translator A → xAI Responses format (internal)
  Upstream Model (Gemini / Claude / GPT / Grok)
        ↑ translator B (response normalize)
  Client ← response normalized
```

**Key files:**
- `open-sse/services/combo.ts` — Combo routing engine (priority, weighted, round-robin, fusion...)
- `open-sse/services/claudeCodeToolRemapper.ts` — Tool name PascalCase ↔ lowercase mapping
- `open-sse/services/claudeCodeExtraRemap.ts` — Extra tool alias cho third-party agents
- `open-sse/services/claudeCodeCompatible.ts` — Claude Code compatibility layer
- `src/shared/validation/schemas/combo.ts` — Combo config Zod schema
- `src/sse/handlers/chat.ts` — Main chat/completions request handler

---

## 2. Cấu hình Combo

Combo là tập hợp model + routing strategy. Mỗi combo có thể cấu hình:

```json
{
  "name": "my-combo",
  "strategy": "priority",
  "models": ["gemini/gemini-2.5-flash", "anthropic/claude-fable-5"],
  "config": {
    "maxRetries": 3,
    "responseValidation": {
      "forbiddenSubstrings": ["I cannot help"],
      "requiredSubstrings": [],
      "minContentLength": 10
    }
  },
  "system_message": "...",
  "tool_filter_regex": ".*"
}
```

**Lưu ý:** `responseValidation` hoạt động trên **response body của model** (LLM output), không phải tool call. Nó dùng để failover sang model kế tiếp nếu response chứa forbidden substring hoặc thiếu required content.

---

## 3. Tool Name Normalization (quan trọng!)

**Vấn đề:** Một số model (đặc biệt Gemini API khi trả tool call) dùng `bash`, `read`, `write` (lowercase) thay vì `Bash`, `Read`, `Write` (PascalCase mà Claude Code yêu cầu).

**Giải pháp built-in của OmniRouter:**

File `open-sse/services/claudeCodeToolRemapper.ts` chứa:
- `TOOL_RENAME_MAP`: `bash → Bash`, `read → Read`, `write → Write`...
- `remapToolNamesInRequest(body)`: normalize lowercase → PascalCase trong request (dành cho third-party client)
- `remapToolNamesInResponse(text, forceLowercase, toolNameMap)`: normalize PascalCase → lowercase trong response (dành cho third-party client)

**Để fix bug Gemini trả lowercase khi client là Claude Code thật:**

Cần thêm một bước **normalize response từ upstream model**: scan `"name":"bash"` → `"name":"Bash"` trong stream chunks trước khi trả về client.

Xem **Section 5** để biết cách implement.

---

## 4. Response Validation vs Tool Name Fix

| Tính năng | Mục đích | Có fix được lowercase? |
|---|---|---|
| `responseValidation.forbiddenSubstrings` | Failover nếu LLM output chứa string cấm | ❌ Chỉ failover, không sửa |
| `responseValidation.jsonPathPredicates` | Failover nếu JSON path không khớp | ❌ Chỉ failover, không sửa |
| `tool_filter_regex` | Lọc tool definitions gửi lên upstream | ❌ Không liên quan |
| **Tool name normalizer (custom)** | Sửa `bash` → `Bash` trong response stream | ✅ Fix được |

---

## 5. Implement Tool Name Normalizer cho Claude Code client

Khi OmniRouter nhận request từ **Claude Code thật** (client dùng TitleCase `Bash`) nhưng upstream model trả về **lowercase** (`bash`), cần thêm normalize layer trong response stream.

**Điểm inject:** `open-sse/services/claudeCodeExtraRemap.ts` — thêm reverse-direction normalizer:

```typescript
// Thêm vào EXTRA_TOOL_RENAME_MAP nếu muốn alias thêm
export const EXTRA_TOOL_RENAME_MAP: Record<string, string> = {
  subagents: "SubDispatch",
  session_status: "CheckStatus",
};
```

**Hoặc tạo một response-side normalizer riêng** trong `open-sse/services/`:

```typescript
// open-sse/services/upstreamToolNameFixer.ts
// Normalize tool names từ upstream model về PascalCase
// dùng cho khi client là Claude Code thật (không phải third-party)
import { TOOL_RENAME_MAP } from "./claudeCodeToolRemapper.ts";

// Build reverse map từ lowercase → TitleCase
const NORMALIZE_TO_PASCAL: Record<string, string> = {};
for (const [lower, pascal] of Object.entries(TOOL_RENAME_MAP)) {
  NORMALIZE_TO_PASCAL[lower] = pascal;
}

export function fixUpstreamToolNames(chunk: string): string {
  let result = chunk;
  for (const [lower, pascal] of Object.entries(NORMALIZE_TO_PASCAL)) {
    result = result.replaceAll(`"name":"${lower}"`, `"name":"${pascal}"`);
    result = result.replaceAll(`"name": "${lower}"`, `"name": "${pascal}"`);
  }
  return result;
}
```

**Nơi gọi:** Trong stream processing của `src/sse/handlers/chat.ts` hoặc `open-sse/services/claudeCodeCompatible.ts`, ở bước **sau khi nhận response từ upstream** và **trước khi forward về client**, thêm:

```typescript
// Nếu client là Claude Code thật (dùng PascalCase), normalize ngược lại
if (isClaudeCodeClient && chunkText.includes('"name"')) {
  chunkText = fixUpstreamToolNames(chunkText);
}
```

---

## 6. Debugging

```bash
# Chạy OmniRouter dev mode
cd /Volumes/DATA/DEV/OmniRouter
npm run dev

# Xem logs combo routing
# Tìm [COMBO] và [ROUTING] trong stdout

# Test tool name trong response
curl http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer $KEY" \
  -d '{"model": "my-combo", "messages": [...]}'
```

---

## 7. Quy tắc phát triển OmniRouter

- Luôn chạy `node tests/run-all.js` trước khi commit
- Không thay đổi `TOOL_RENAME_MAP` — đây là source of truth cho tool name mapping
- Mọi thay đổi combo config: test qua dashboard UI trước khi deploy
- Không bật global MCP hoặc permission wildcard
- Xem `AGENTS.md` trong repo OmniRouter để biết agent skills nào đã có

---

## Quy trình Phối hợp Đa Agent — 9 bước (Kế thừa từ dev-workflow-skills)

Áp dụng khi phát triển tính năng mới hoặc refactor OmniRouter:

```
/idea → /req → /spec → /plan → /build → /code-review → /test → /review → /ship
```

**7 Tài liệu bắt buộc** (tạo ở root project OmniRouter):
`IDEA.md` (PO viết) → `REQUIREMENTS.md` → `SPEC.md` → `ARCH.md` → `README.md` → `DEPLOY_GUIDE.md` → `CHANGELOGS.md`

**Phân bổ Model:**
- **Claude/Codex**: `/req`, `/spec`, `/plan`, `/review` — thiết kế routing strategy, combo config schema, API contract
- **Gemini**: `/build`, `/test`, `/ship` — sinh TypeScript service, viết test suite, cấu hình deploy

**Quy tắc đặc thù AIRouter:**
- `/spec`: Mô tả rõ luồng request từ client → combo engine → upstream → normalize → response
- `/build`: Mọi thay đổi combo config phải test qua dashboard UI trước; không sửa `TOOL_RENAME_MAP` tùy tiện
- `/test`: Chạy `node tests/run-all.js` — đây là bộ test chuẩn của OmniRouter
- `/review`: Kiểm tra tool name normalization đúng chiều (lowercase ↔ PascalCase), không global MCP/permission wildcard
- **Đường dẫn local**: repo tại `/Volumes/DATA/DEV/OmniRouter` — không hardcode vào skill
