# Odoo OWL Frontend Components & Best Practices (v14 - v19)

> Nguồn: tài liệu chính thức OWL (`github.com/odoo/owl`, thư mục `doc/v2` và `doc/v3`, đọc trực tiếp từ
> source — không phải trang render) + tổng hợp cross-check từ repo cộng đồng
> [`fhidalgodev/odoo-development-skill`](https://github.com/fhidalgodev/odoo-development-skill).

OWL (Odoo Web Library) là framework Javascript reactive hiện đại của Odoo (tương tự React/Vue) sử dụng Virtual DOM. Tài liệu này hướng dẫn xây component OWL cao cấp, đúng chuẩn kỹ thuật của chính framework gốc (không chỉ chuẩn tối thiểu để chạy được), hỗ trợ đa phiên bản từ v14 đến v19.

---

## 0. BẮT BUỘC: Xác định đúng phiên bản OWL đang chạy trước khi viết code

```
╔══════════════════════════════════════════════════════════════════════════════╗
║  v14: odoo.define (không OWL, hoặc OWL rất sơ khai)                          ║
║  v15: OWL 1.x                                                                ║
║  v16 - v19: OWL 2.x  ← tài liệu §3-6 dưới đây target                         ║
║  OWL 3.x: CHƯA vào Odoo stable nào — mới ở nhánh master repo odoo/owl        ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

> ✅ **Fact đã verify từ source thật (2026-07-10):** Odoo **19.0 stable ship OWL 2.8.0** — grep
> `addons/web/static/lib/owl/owl.js` trong source v19 cho `const version = "2.8.0"`, vẫn export `useState`
> và còn `t-esc`. Nghĩa là claim "v19 = OWL 3.x" lan truyền trong tài liệu cộng đồng là **SAI** với v19.0
> stable hiện tại. Mặc định viết OWL 2.x cho mọi version 16→19; §7 (OWL 3) chỉ dùng để chuẩn bị trước cho
> tương lai và cho codebase đã tự verify được là chạy Owl 3.

**Cảnh báo quan trọng về v19:** tài liệu migration chính thức `migration_owl2_to_owl3.md` trong repo `odoo/owl`
tự ghi rõ đây là **DRAFT**, đang trong "Phase 1: preparation" với timeline merge vào master Odoo dự kiến sau
một fork saas cụ thể. Nghĩa là **không phải mọi codebase Odoo 19.x đều đã chạy cú pháp Owl 3
(`signal`/`proxy`/`computed`/`effect`)** — nhiều nơi vẫn có thể đang ở giai đoạn "Owl 3 with compatibility layer"
hoặc thậm chí vẫn Owl 2. **Trước khi áp cú pháp ở §7, PHẢI verify version thực tế** thay vì đoán theo số version
Odoo:

```bash
# Cách 1: đọc trực tiếp header/package version trong core
grep -m1 '"version"' odoo/addons/web/static/lib/owl/owl.js 2>/dev/null
# hoặc tìm file package version của owl nếu build qua npm
find . -path '*/node_modules/@odoo/owl/package.json' -exec grep '"version"' {} \;

# Cách 2 (nhanh, đáng tin hơn): grep xem core addons/web dùng useState (Owl2) hay signal()/proxy() (Owl3)
grep -rl "from \"@odoo/owl\"" odoo/addons/web/static/src/core | head -1 | xargs grep -E "useState|proxy\(|signal\("
```

Nếu không chắc, **mặc định viết theo Owl 2** (an toàn hơn, tương thích ngược tốt hơn) và chỉ chuyển sang cú
pháp Owl 3 ở §7 khi đã verify được.

---

## 1. Đăng ký Assets (Assets Bundling)

- **v14:** Đăng ký file JS/SCSS bằng cách kế thừa template XML `web.assets_backend` trong file XML.
- **v15 - v19:** Đăng ký trực tiếp trong file `__manifest__.py` thông qua từ khóa `assets`. **Không dùng XML kế thừa assets.**

### Bảng phân định Asset Bundles chuẩn trong Odoo:

| Asset Bundle | Mục đích & Ngữ cảnh sử dụng |
|---|---|
| `web.assets_backend` | Toàn bộ giao diện quản trị Backend Odoo (Form, List, Kanban, OWL components). |
| `web.assets_frontend` | Toàn bộ giao diện khách hàng Website công khai (Portal, Login, Public Pages, JS handler frontend). |
| `web_editor.assets_wysiwyg` | **Website Builder WYSIWYG & Editor Tools**: Nạp các widget chỉnh sửa thanh sidebar, LinkTools (`web_editor.LinkTools`), Snippets options, colorpicker... Bắt buộc dùng bundle này khi mở rộng/kế thừa template Link/Button options trong Website Builder. |
| `website.assets_wysiwyg` | Các component nội bộ riêng của website snippets frontend. |

```python
# __manifest__.py
{
    'name': 'Hospital Management OWL UI',
    'depends': ['web', 'website', 'web_editor'],
    'assets': {
        'web.assets_backend': [
            'hms_hospital/static/src/components/**/*.js',
            'hms_hospital/static/src/components/**/*.xml',
            'hms_hospital/static/src/components/**/*.scss',
        ],
        'web.assets_frontend': [
            # Chạy trên website công khai, không phải backend
            'hms_hospital/static/src/js/frontend_handler.js',
        ],
        'web_editor.assets_wysiwyg': [
            # Kế thừa LinkTools, Website Builder sidebar options
            'hms_hospital/static/src/js/link_tools_ext.js',
            'hms_hospital/static/src/xml/link_tools_ext.xml',
        ],
    },
}
```

Cấu trúc thư mục chuẩn:

```
module_name/static/src/
├── components/
│   └── component_name/
│       ├── component_name.js
│       ├── component_name.xml
│       └── component_name.scss
├── fields/       # custom field widgets
├── views/        # custom view types / view extensions
└── systray/      # systray items
```

---

## 2. Cú pháp Component (v14-15 vs v16-19)

### ⚠️ Odoo 14.0 - 15.0 (OWL 1.x)
```javascript
// static/src/components/patient_dashboard/patient_dashboard.js
odoo.define('hms_hospital.PatientDashboard', function (require) {
    'use strict';
    const AbstractAction = require('web.AbstractAction');
    const core = require('web.core');
    const { Component } = owl;
    const { useState } = owl.hooks;

    class PatientDashboard extends Component {
        setup() {
            this.state = useState({ patientCount: 0 });
        }
    }
    PatientDashboard.template = 'hms_hospital.PatientDashboardTemplate';

    const PatientDashboardAction = AbstractAction.extend({
        start: function () {
            const self = this;
            this.component = new PatientDashboard(this);
            return this.component.mount(this.$el[0]).then(function () {
                return self._super.apply(self, arguments);
            });
        },
    });
    core.action_registry.add('patient_dashboard_action', PatientDashboardAction);
});
```

### 🚀 Odoo 16.0 - 18.0 (OWL 2.x) — chuẩn phổ biến nhất hiện nay
```javascript
// static/src/components/patient_dashboard/patient_dashboard.js
import { Component, useState, onWillStart } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";

export class PatientDashboard extends Component {
    static template = "hms_hospital.PatientDashboard";

    setup() {
        this.orm = useService("orm");
        this.state = useState({ patients: [], loading: true });
        onWillStart(async () => {
            await this.loadPatients();
        });
    }

    async loadPatients() {
        this.state.loading = true;
        try {
            this.state.patients = await this.orm.searchRead(
                "hms.patient",
                [["active", "=", true]],
                ["name", "age", "gender"]
            );
        } catch (error) {
            console.error("Lỗi khi tải danh sách bệnh nhân:", error);
        } finally {
            this.state.loading = false;
        }
    }
}

registry.category("actions").add("patient_dashboard_action", PatientDashboard);
```

```xml
<?xml version="1.0" encoding="UTF-8"?>
<templates xml:space="preserve">
    <t t-name="hms_hospital.PatientDashboard" owl="1">
        <div class="o_patient_dashboard p-4 bg-light min-vh-100">
            <div class="dashboard_header d-flex justify-content-between align-items-center mb-4 p-3 bg-white shadow-sm rounded-lg">
                <h2 class="text-primary font-weight-bold mb-0">Bảng Điều Khiển Bệnh Viện</h2>
                <button class="btn btn-primary" t-on-click="loadPatients">
                    <i class="fa fa-refresh mr-1"/> Tải lại
                </button>
            </div>
            <div t-if="state.loading" class="d-flex justify-content-center py-5">
                <div class="spinner-border text-primary" role="status"/>
            </div>
            <div t-else="" class="row">
                <div t-foreach="state.patients" t-as="patient" t-key="patient.id" class="col-md-4 mb-3">
                    <div class="card h-100 border-0 shadow-hover">
                        <div class="card-body">
                            <h5 class="card-title"><t t-esc="patient.name"/></h5>
                            <p class="card-text">Tuổi: <strong><t t-esc="patient.age"/></strong></p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </t>
</templates>
```

---

## 3. Hooks Reference đầy đủ (OWL 2.x — v16-18)

### 3.1 Lifecycle hooks (bảng đầy đủ)

| Hook | Gọi khi nào | Ghi chú |
|---|---|---|
| `setup()` | Ngay sau constructor | Nơi duy nhất được gọi các hook khác |
| `onWillStart(async fn)` | Trước lần render đầu, async | Nhiều `onWillStart` chạy **song song** (Promise.all ngầm), không tuần tự |
| `onWillRender(fn)` | Ngay trước mỗi lần render (kể cả lần đầu) | Dùng để precompute giá trị đắt trước khi template đọc |
| `onRendered(fn)` | Ngay sau khi render (trước khi patch DOM) | Ít dùng, dễ nhầm với `onMounted`/`onPatched` |
| `onMounted(fn)` | Sau khi component gắn vào DOM lần đầu | Nơi thêm listener, đo đạc DOM, khởi tạo thư viện ngoài |
| `onWillUpdateProps(async fn)` | Trước khi props mới được áp dụng | Nhận `nextProps`; dùng để đồng bộ state phụ thuộc props |
| `onWillPatch(fn)` | Ngay trước khi DOM bị patch (không gọi ở lần render đầu) | Đọc state DOM cũ (vd. vị trí scroll) trước khi nó đổi |
| `onPatched(fn)` | Ngay sau khi DOM được patch | Có thể update state nhưng cẩn thận vòng lặp vô hạn |
| `onWillUnmount(fn)` | Ngay trước khi gỡ khỏi DOM | Gỡ listener đã thêm ở `onMounted` |
| `onWillDestroy(fn)` | Ngay trước khi component bị huỷ (kể cả khi chưa từng mount) | Dọn dẹp tài nguyên chắc chắn chạy — dùng thay `onWillUnmount` nếu cleanup phải luôn xảy ra |
| `onError(fn)` | Bắt lỗi runtime từ chính component hoặc component con | Xem §5 (error boundary) |

**Thứ tự gọi trong cây component:** `mounted`/`patched` gọi theo thứ tự **con trước, cha sau**; `willUnmount`/`willDestroy` gọi theo thứ tự **cha trước, con sau**.

**Quy tắc duy nhất của hook:** mọi hook phải được gọi trong `setup()` hoặc trực tiếp ở class field — **không** được gọi bên trong callback của hook khác (vd. gọi `useState` bên trong `onWillStart` là sai, vì lúc đó component đã setup xong).

```js
// ĐÚNG
class C extends Component {
  state = useState({ value: 0 });          // class field — ok
  setup() {
    this.orm = useService("orm");          // trong setup — ok
  }
}

// SAI — hook gọi trễ, sau khi setup đã kết thúc
class C extends Component {
  setup() {
    onWillStart(async () => {
      this.mouse = useMouse();             // LỖI
    });
  }
}
```

### 3.2 `useState` — hook quan trọng nhất

`useState(obj)` trả về bản Proxy phản ứng của `obj`. Component chỉ re-render khi **key nó thực sự đọc ở lần
render trước** bị thay đổi — đây là reactivity theo key, không phải theo toàn bộ object:

```js
this.state = useState({ selected: "a", countA: 0, countB: 0 });
```

Nếu template chỉ đọc `state.countA` khi `state.selected === "a"`, thì thay đổi `state.countB` trong lúc đang
hiển thị "a" **sẽ không** trigger re-render — vì subscription đã bị xoá và không đọc lại `countB`.

**Props reactive:** kể từ Owl 2, `useState` áp dụng tự động lên props reactive được truyền cho component con —
component con chỉ re-render khi phần state nó *thực sự đọc* thay đổi, không phải mỗi khi component cha
re-render. Đây là lý do Owl 2 nhanh hơn Owl 1 (Owl 1 re-render toàn bộ cây con khi cha re-render).

### 3.3 `useRef` + `t-ref`

```xml
<input t-ref="someInput"/>
```
```js
this.inputRef = useRef("someInput");
// this.inputRef.el là HTMLElement thực, chỉ có giá trị khi component đang mounted
```

`t-ref` hỗ trợ interpolation động: `t-ref="div_{{someCondition ? '1' : '2'}}"`.

### 3.4 `useSubEnv` / `useChildSubEnv`

`env` dùng để chia sẻ thông tin cho **toàn bộ cây con** mà không cần truyền props thủ công qua nhiều tầng
(model của form view, service dùng chung...). `env` bị **đóng băng (frozen)** — không sửa trực tiếp.

```js
setup() {
  const model = makeModel();
  useSubEnv({ model });          // model có ở this.env cho CHÍNH component này + toàn bộ con
  useChildSubEnv({ key: "v" });  // chỉ có ở this.env của các component CON, không có ở chính nó
}
```

### 3.5 `useExternalListener`

```js
useExternalListener(window, "click", this.closeMenu, { capture: true });
```
Tự động `addEventListener`/`removeEventListener` theo đúng vòng đời mount/unmount — tránh leak listener, lỗi
rất hay gặp khi tự viết `onMounted`/`onWillUnmount` thủ công.

### 3.6 `useEffect` (chữ ký Owl 2 — khác Owl 3!)

```js
useEffect(
  (el) => {
    if (el) el.focus();
    return () => { /* cleanup trước lần chạy tiếp theo hoặc khi unmount */ };
  },
  () => [this.someRef.el]   // hàm dependency — chỉ re-run khi các giá trị này đổi
);
```

Nếu bỏ hàm dependency thứ 2, effect chạy lại ở **mọi** patch. Nếu dependency là mảng rỗng `() => []`, effect
chỉ chạy 1 lần khi mount và cleanup khi unmount (tương đương `useEffect(fn, [])` bên React).

```js
// Ví dụ chuẩn: useAutofocus
function useAutofocus(name) {
  let ref = useRef(name);
  useEffect(
    (el) => el && el.focus(),
    () => [ref.el]
  );
}
```

### 3.7 `useComponent` / `useEnv` — building block viết custom hook

```js
function useSomething() {
  const component = useComponent();  // instance component hiện tại
  const env = useEnv();              // env hiện tại
}
```

### 3.8 `reactive()` độc lập — state ngoài component (Store pattern)

`useState` chỉ là `reactive(obj, this.render.bind(this))`. Có thể tự dùng `reactive()` để tạo store dùng
chung toàn app, không gắn với 1 component nào:

```js
// store.js
export const store = reactive({
  list: [],
  add(item) { this.list.push(item); },
});
export function useStore() {
  return useState(store);   // mỗi component tự "đăng ký" theo dõi phần nó cần
}
```
```js
// bất kỳ đâu trong app
import { store } from "./store";
store.add("item mới");  // mọi component đang dùng useStore() và có đọc `list` sẽ tự re-render
```

Đây là cách xây "global store" nhẹ, không cần Redux/Pinia-style boilerplate.

### 3.9 Escape hatches: `markRaw` / `toRaw`

```js
// markRaw: loại 1 object khỏi hệ thống reactivity — dùng khi render list lớn với item bất biến
this.items = useState([
  markRaw({ label: "text", value: 42 }), // ...hàng nghìn object tương tự
]);
```
Chỉ dùng `markRaw` khi đã đo hiệu năng và xác nhận việc tạo Proxy cho hàng nghìn object là nút thắt cổ chai —
dùng bừa sẽ làm UI desync với state (đổi giá trị object đã markRaw sẽ **không** trigger re-render).

`toRaw(reactiveObj)` lấy lại object gốc không phản ứng — hữu ích khi debug hoặc so sánh identity
(`obj !== reactiveObj` vì reactive trả về Proxy khác).

---

## 4. Template Syntax đầy đủ (QWeb + Owl-specific)

### 4.1 Bảng directive đầy đủ

| Directive | Công dụng |
|---|---|
| `t-esc` | Xuất text đã escape (an toàn XSS) |
| `t-out` | Xuất dữ liệu — escape mặc định, chỉ raw HTML nếu giá trị được đánh dấu `markup()` |
| `t-set` / `t-value` | Gán biến trong scope template |
| `t-if` / `t-elif` / `t-else` | Điều kiện |
| `t-foreach` / `t-as` / `t-key` | Vòng lặp — **`t-key` bắt buộc** từ Owl 2 trở đi |
| `t-att-*` / `t-attf-*` / `t-att` | Thuộc tính động |
| `t-call` | Gọi sub-template |
| `t-component` / `t-props` | Sub-component động |
| `t-ref` | Tham chiếu tới DOM node |
| `t-on-*` | Event handler |
| `t-call-slot` / `t-set-slot` / `t-slot-scope` | Slot |
| `t-model` | 2-way binding form input |
| `t-tag` | Tag HTML động |
| `t-debug` / `t-log` | Debug (breakpoint / console.log lúc render) |

### 4.2 Toán tử thay thế ký tự XML không hợp lệ trong biểu thức

| Từ | Thay cho |
|---|---|
| `and` | `&&` |
| `or` | `\|\|` |
| `gt` / `gte` | `>` / `>=` |
| `lt` / `lte` | `<` / `<=` |

```xml
<p t-if="10 + 2 gt 5">ok</p>
```

### 4.3 `t-out` object-syntax cho class/style động

```xml
<div t-att-class="{ active: state.active, hidden: !state.visible }"/>
<!-- <div class="active"></div> nếu active=true, visible=true -->

<div t-att-style="{ color: 'red', fontSize: '20px' }"/>
<!-- <div style="color: red; font-size: 20px;"></div> -->
```

### 4.4 `t-foreach` — biến phụ trợ

Ngoài tên đặt ở `t-as`, Owl cung cấp thêm (thay `$as` bằng tên thật):

- `$as_index` — chỉ số hiện tại (bắt đầu từ 0)
- `$as_first` / `$as_last` — boolean vị trí đầu/cuối
- `$as_value` — với object/Map: giá trị (còn `$as` là key)

```xml
<tr t-foreach="lines" t-as="line" t-key="line.id" t-att-class="line_first ? 'first-row' : ''">
```

### 4.5 Event handling — modifier đầy đủ

```xml
<button t-on-click.stop.prevent="this.onClick">Đi</button>
```

| Modifier | Ý nghĩa |
|---|---|
| `.stop` | `event.stopPropagation()` trước khi gọi handler |
| `.prevent` | `event.preventDefault()` trước khi gọi handler |
| `.self` | Chỉ gọi nếu `event.target` chính là phần tử này (không phải phần tử con nổi bọt lên) |
| `.capture` | Bind ở capture phase |
| `.synthetic` | Gộp handler vào **1 listener duy nhất** ở `document.body` — tối ưu khi render list rất lớn (hàng trăm/nghìn dòng có cùng 1 loại event) |
| `.passive` | Hint trình duyệt handler không gọi `preventDefault` — dùng cho `scroll`/`touch*` để cuộn mượt hơn |

Thứ tự modifier có ý nghĩa: `.prevent.self` chặn **mọi** click; `.self.prevent` chỉ chặn click đúng vào chính
phần tử đó.

### 4.6 Slots — component generic (thường bị bỏ qua, rất mạnh)

```xml
<!-- Component cha dùng Navbar, truyền nội dung tuỳ biến -->
<Navbar>
  <span>Hello Owl</span>
</Navbar>
```
```xml
<!-- Định nghĩa Navbar: t-call-slot render đúng vị trí -->
<div class="navbar">
  <t t-call-slot="default"/>
</div>
```

**Named slots** (nhiều vùng nội dung tuỳ biến):
```xml
<InfoBox>
  <t t-set-slot="title">Tiêu đề tuỳ biến</t>
  <t t-set-slot="content"><div>Nội dung...</div></t>
</InfoBox>
```
```xml
<div class="info-box">
  <div class="info-box-title"><t t-call-slot="title"/></div>
  <div class="info-box-content"><t t-call-slot="content"/></div>
</div>
```

**Quan trọng:** nội dung slot được render trong **context của nơi định nghĩa nó** (component cha), không phải
trong context component sở hữu slot — nên event handler trong slot content tự động bind đúng vào cha, không
cần truyền callback qua props.

**Slot params** (cha truyền thêm data cho slot, ngoài content — vd. tiêu đề tab cho 1 component Notebook đa
trang) dùng thêm attribute trên `t-set-slot`; **Slot scope** (chiều ngược lại — component con truyền data
xuống cho nội dung slot đọc) dùng `t-slot-scope`. Chỉ cần khi build component generic tái sử dụng cao (tab,
accordion, dropdown menu...) — component nghiệp vụ thông thường không cần.

### 4.7 `t-call` sub-template

```xml
<t t-name="other-template">
    <p><t t-out="var"/></p>
</t>
<t t-name="main-template">
    <t t-call="other-template" var="'owl'"/>
</t>
```
Biến truyền vào `t-call` là props, **scoped riêng cho sub-template**, không leak ngược lại context cha.

---

## 5. Kế thừa & Vá (Patch) Component có sẵn của Odoo

```javascript
// static/src/components/patches/form_controller_patch.js
import { FormController } from "@web/views/form/form_controller";
import { patch } from "@web/core/utils/patch";

patch(FormController.prototype, {
    setup() {
        super.setup(...arguments);
        this.notification = this.env.services.notification;
    },

    async saveButtonClicked() {
        const result = await super.saveButtonClicked(...arguments);
        if (result) {
            this.notification.add("Lưu dữ liệu thành công!", { title: "Thành công", type: "success" });
        }
        return result;
    }
});
```

**Nguyên tắc bắt buộc khi patch:** luôn gọi `super.method(...arguments)` trừ khi cố ý ghi đè hoàn toàn hành
vi gốc; patch ở đúng file riêng trong `static/src/**/patches/` để dễ audit khi Odoo core đổi API; không patch
những internal method không có trong tài liệu chính thức (dễ vỡ khi Odoo minor-update).

---

## 6. Xử lý bất đồng bộ đúng chuẩn (Concurrency Model)

Owl batch mọi rendering và chỉ patch DOM 1 lần mỗi animation frame — nhưng **bất kỳ component con nào có
`onWillStart` async đang chạy sẽ trì hoãn patch của toàn bộ cây**, vì Owl chờ hết mọi `onWillStart` trong cây
mới patch. Áp dụng đúng để tránh UI bị đơ:

1. **Tối thiểu hoá component bất đồng bộ.** Phần lớn component nên đồng bộ; chỉ dùng `onWillStart` khi thực
   sự cần chờ trước lần render đầu.
2. **Lazy-load thư viện nặng trong `onWillStart`, khởi tạo trong `onMounted`:**
   ```js
   setup() {
     onWillStart(async () => { this.lib = await import("some-heavy-editor-lib"); });
     onMounted(() => { this.lib.init(this.someRef.el); });
   }
   ```
3. **Load data cần cho lần render đầu trong `onWillStart`**; data có thể đổi sau đó (theo props/filter) thì xử
   lý qua `onWillUpdateProps` + `useState`, không load lại toàn bộ trong `onPatched` (dễ gây vòng lặp render).

---

## 7. OWL 3 (v19) — Kiến trúc Signal-based Reactivity mới

> ⚠️ Xem cảnh báo verify version ở §0 trước khi áp phần này. Đây là kiến trúc **đích** mà Odoo đang chuyển
> sang cho v19.x, không phải cú pháp chắc chắn đã ổn định ở mọi bản v19.0.

Owl 3 thay hệ thống Proxy-per-component (`useState`) bằng 4 primitive reactivity tách rời khỏi component,
đọc/ghi tường minh, có thể dùng ở bất kỳ đâu (component, plugin, module JS thuần):

```js
import { signal, proxy, computed, effect } from "@odoo/owl";

const count = signal(0);              // container đơn giản — đọc count(), ghi count.set(v)
const state = proxy({ color: "red" }); // object reactive — đọc/ghi property trực tiếp
const total = computed(() => count() + state.value); // giá trị suy ra, tự tính lại khi dependency đổi
effect(() => console.log(total()));    // tự chạy lại khi bất kỳ signal/computed/proxy nó đọc thay đổi
```

Component ví dụ kiểu Owl 3:
```js
import { Component, signal, xml } from "@odoo/owl";

class Counter extends Component {
  static template = xml`
    <button t-on-click="this.increment">Click! [<t t-out="this.count()"/>]</button>`;
  count = signal(0);
  increment() { this.count.set(this.count() + 1); }
}
```

### 7.1 Cheat-sheet chuyển đổi Owl 2 → Owl 3

| Owl 2 | Owl 3 | Ghi chú |
|---|---|---|
| `useState(obj)` | `proxy(obj)` | Thay thế cơ học, import đổi tên |
| `reactive(obj)` | `proxy(obj)` | `reactive(obj, cb)` (2 tham số) → tách thành `proxy(obj)` + `useEffect`/`effect` riêng |
| `this.props.x` | `props = useProps({x: t...}); this.props.x` | Phải "import" props tường minh, có thể kèm schema validate bằng `t.*` |
| `this.env` | Plugin system (`providePlugins`/`usePlugin`) | Thay đổi lớn nhất — không cơ học, cần thiết kế lại thành plugin |
| `onWillUpdateProps` | `computed()` (nếu suy ra state) hoặc `useEffect` (nếu side-effect) | Prop phải khai là `t.signal(...)` để computed subscribe đúng |
| `t-esc` | `t-out` | Owl 3 xử lý object tốt hơn, không cần ép `String()` như trước |
| `t-ref="name"` + `useRef("name")` | `t-ref="this.x"` + `x = signal.ref()` | Ref giờ là 1 signal |
| `t-model="state.value"` | `t-model="this.input"` + `input = signal(...)` | t-model giờ cần 1 signal, không nhận proxy |
| `onWillRender` | `computed()` | Nếu chỉ precompute giá trị |
| `onRendered` | `onMounted` (thường vậy) | |
| `this.render()` | `signal.set(...)` / mutate proxy | Không còn method `render()` ép buộc — reactivity tự lo |
| `useExternalListener` | `useListener` | Đổi tên + nhận `EventTarget` hoặc 1 ref signal |
| `useComponent()` | Không còn — dùng `useProps()`/props trực tiếp | |

### 7.2 Thay đổi ngữ nghĩa quan trọng: `onPatched`/`onWillPatch` bị thu hẹp phạm vi

Ở Owl 2, `patched` fire theo instance — cha luôn patch cùng con nếu state cha sở hữu đổi (kể cả state đó chỉ
được đọc bởi 1 slot/con sâu bên trong). Ở Owl 3, subscription theo **nơi thực sự đọc signal khi render**, nên
`patched` của cha **không fire** nếu chỉ có con/slot đọc và re-render.

```js
class A extends Component {                       // A sở hữu slot content
  static template = xml`<t t-call-slot="default"/>`;
  setup() { onPatched(() => console.log("A patched")); }
}
class Root extends Component {
  static components = { A };
  static template = xml`
    <A><div t-on-click="() => this.message.set(this.message() + '!')">
      <t t-out="this.message()"/>
    </div></A>`;
  message = signal("hello");
  setup() { onPatched(() => console.log("Root patched")); }  // KHÔNG fire khi click!
}
```

**Cách migrate đúng:** nếu mục đích là "phản ứng khi 1 giá trị đổi" (không phải "chính component này vừa
render lại DOM"), dùng `effect()`/`useEffect()` thay vì `onPatched` — effect subscribe trực tiếp theo signal
đọc được, không phụ thuộc component nào render.

### 7.3 `useProps` — validate props bằng `t.*`

```js
props = useProps({
  count: t.number(),
  label: t.string().optional("untitled"),
  onSelect: t.function().optional(),
  items: t.array(t.string()).optional(() => []),   // default dạng factory cho mutable value
});
```
Chỉ chạy validate ở dev mode — production mode bỏ qua để tối ưu hiệu năng, giống prop-types React.

---

## 8. UX/UI Tiêu chuẩn Cao cấp & Mượt mà

1. **Hiệu ứng Hover & Transition:**
   ```scss
   .shadow-hover {
       transition: transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
       &:hover { transform: translateY(-4px); box-shadow: 0 10px 20px rgba(0,0,0,0.08) !important; }
   }
   ```
2. **Icon chuẩn:** dùng FontAwesome tích hợp sẵn (`fa-heartbeat`, `fa-user-md`...) để đồng bộ UX, không tự
   nhúng icon-font khác gây phình bundle.
3. **Responsive:** Grid Bootstrap (`row`, `col-12`, `col-md-6`, `col-lg-4`).
4. **List lớn (hàng trăm+ dòng):** cân nhắc `.synthetic` cho event handler lặp lại (§4.5) và `markRaw` cho
   item bất biến (§3.9) trước khi kết luận UI "chậm do OWL" — thường là do tạo quá nhiều Proxy không cần thiết.

---

## 9. Testing OWL Components

Xem [references/testing-and-debugging.md](testing-and-debugging.md)
cho cách viết Odoo Tours/QUnit-hoot chạy component thật trong trình duyệt. Nguyên tắc riêng cho OWL:
- Test qua DOM thật (mount component vào `document.body` hoặc dùng `getFixture()` của bộ test Odoo), không
  mock nội bộ `state`/`props` rồi assert trực tiếp — vì reactivity chỉ có ý nghĩa khi DOM thực sự patch.
- Với `onWillStart` async, luôn `await` tick render (`await nextTick()` trong bộ test Odoo) trước khi assert
  DOM, nếu không sẽ đọc phải DOM ở trạng thái loading.
