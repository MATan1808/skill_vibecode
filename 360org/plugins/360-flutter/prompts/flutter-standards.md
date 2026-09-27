# Flutter & Dart Standards (360org)

1. **Architecture**:
   - Clean Architecture (Data, Domain, Presentation).
   - Widget tree chia nhỏ, ưu tiên `const` triệt để.

2. **Code Safety**:
   - Tránh bang operator (`!`).
   - Kiểm tra `context.mounted` sau mọi `await` trong State/Widget lifecycle.
