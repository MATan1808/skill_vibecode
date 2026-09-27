# Validation, Reporting & Verification (adapted from Cloudflare security-audit-skill)

## Phase 3: Validate findings (adversarial)

Sau khi collect findings từ Phase 2, **consolidate duplicates trước**. Cùng root cause → merge trước khi validate.

Với mỗi finding còn lại, áp dụng adversarial validation — cố gắng **bác bỏ** finding, không xác nhận:

### 5 validation tests

1. **Exploitation test**: Đọc actual code tại mỗi step của trace. Data flow có đúng như claim? Có construct được exact input không?
2. **Impact test**: Attacker thực sự được gì? "Học được field names" hoặc "gây error" không đủ — phải có meaningful impact.
3. **Baseline test**: Pattern tương tự có bị exploit trên site WP khác chưa? Nếu không bao giờ → hiểu tại sao trước khi report.
4. **Mitigation test**: Layer khác đã prevent exploitation chưa? WP core, plugin security layer, server-level control?
5. **Parser/runtime behavior test**: Exploit phụ thuộc parser/runtime interpret specific input → verify với actual implementation, không đoán.

### Verdict format
- **CONFIRMED**: [lý do là real, với code evidence]
- **REJECTED**: [finding sai điều gì, với code evidence]

Short report với 3 real findings > long report với 30 theoretical ones.

---

## Phase 4: Report format

### Output files

**`audit-report-YYYY-MM-DD-<domain>.md`** — Main report:
- Executive summary (1 đoạn, honest assessment)
- Findings table (severity, title, one-line description)
- Mỗi finding: file path, concrete attack scenario, impact, recommended fix
- Hardening notes section (NOT findings — defense-in-depth suggestions)
- Positive patterns section (những gì site làm tốt — calibrates trust)

**`findings-detail-YYYY-MM-DD-<domain>.md`** — Cho mỗi finding MEDIUM+:
- Complete data flow từ input đến sink với file:line references
- Exact HTTP request/action để trigger
- Attacker được gì cụ thể
- Cách fix cụ thể

**Format bắt buộc** (Sếp prefer .md, không docx/PDF):
```
symptom → root cause → evidence table (checks passed/failed) → storage breakdown
→ attack summary (attempted vs succeeded) → actions taken → remaining recommendations
```

Trích dẫn trực tiếp log lines quyết định. Nêu rõ khi finding chỉ là review flag, không phải proof of compromise.

---

## Phase 5: Structured output (findings.json)

Schema cho mỗi finding:

```json
{
  "verdict": "confirmed",
  "id": "wp-<site>-<001>",
  "title": "Tên ngắn finding",
  "severity": {
    "overall_severity": "critical|high|medium|low|informational",
    "likelihood": "critical|high|medium|low|informational",
    "impact": "critical|high|medium|low|informational"
  },
  "category": "injection|access-control|resource-file|crypto-secrets|business-logic|feature-abuse|chained|client-side|malware-ioc|configuration",
  "confidence": "high|medium|low",
  "confidence_reason": "Lý do confidence level",
  "file": "path/to/file.php",
  "line": 42,
  "root_cause": "Mô tả defect cụ thể",
  "intended_behavior": "Code đáng lẽ phải làm gì",
  "trace": [
    {
      "step": 1,
      "file": "path/to/entry.php",
      "line": 10,
      "scope": "function_name",
      "description": "Input enters here"
    }
  ],
  "attack_scenario": "Exact steps attacker thực hiện",
  "impact": "Attacker đạt được gì",
  "remediation": {
    "summary": "Fix ngắn gọn",
    "code_changes": [
      {
        "file": "path/to/fix.php",
        "description": "Thay đổi cần làm"
      }
    ]
  }
}
```

Severity levels: `critical`, `high`, `medium`, `low`, `informational` (lowercase).

---

## Phase 6: Independent verification

Với mỗi confirmed finding, verify độc lập:

1. File và line number có đúng không?
2. Root cause description có đúng với code không?
3. Execution payloads thực sự work — endpoint có tồn tại, auth pass đúng như mô tả?
4. Conditions đủ — có prerequisites nào finding bỏ sót?
5. Remediation có fix được attack mà không break normal functionality?

Verdict:
- **VERIFIED** — tất cả claims checked out
- **CORRECTED: [field]: [sai] → [đúng]** — factual error trong field cụ thể
- **REJECTED: [reason]** — finding fundamentally wrong

---

## Severity thresholds (WordPress context)

| Severity | Ví dụ |
|---|---|
| CRITICAL | Unauthenticated RCE, full DB dump, admin takeover không cần credentials, active backdoor |
| HIGH | Authenticated RCE, SQL injection có data exfiltration, stored XSS fire cho mọi user, auth bypass, RBAC completely defeated |
| MEDIUM | Targeted XSS conditions cụ thể, CSRF có meaningful state change, credentials disclosure, business logic bypass limited scope |
| LOW | Info disclosure non-secret, DoS cần sustained effort, missing security headers có limited impact |
| INFORMATIONAL | Confirmed nhưng minimal impact, useful building block cho chain, hardening notes |

---

## Anti-patterns cần tránh

1. **Liệt kê mọi deviation khỏi OWASP là finding** — OWASP là checklist, không phải bug list
2. **Rate defense-in-depth gaps là HIGH/CRITICAL** — nếu Layer A đã block, Layer B thiếu = hardening note
3. **Ignore deployment model** — WP Cloudflare WAF, server-level rate limit là valid defense
4. **Treat designed behavior là bug** — admin trusted = admin-does-admin-things không phải finding
5. **Pad report với LOW findings** — 10 LOW < 3 MEDIUM useful
6. **"Potential" findings không có proof** — exploit được hoặc không. Cần "potentially" = chưa đủ research
7. **Bỏ qua cái codebase làm tốt** — nói rõ auth solid → builds trust trong findings thật
8. **Construct exploits từ incorrect parser assumptions** — verify behavior trước khi claim
9. **Bỏ qua business logic** — scanner không tìm được logic errors; đó là giá trị của manual audit
10. **Dừng ở "parameterized queries → no SQLi"** — check EVERY raw query, dynamic identifiers, FTS
