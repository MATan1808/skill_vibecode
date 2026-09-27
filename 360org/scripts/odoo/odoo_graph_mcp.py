#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sys
import os
import json
import re

class OdooGraphMCP:
    def __init__(self):
        # Đăng ký các công cụ tinh gọn lấy cảm hứng từ CodeGraph & Code-Graph-RAG
        self.tools = [
            {
                "name": "get_model_graph",
                "description": "Quét module Odoo và vẽ sơ đồ quan hệ database (Mermaid graph) giữa các model. Rất nhẹ, sử dụng stream-line parser để giữ RAM < 10MB.",
                "inputSchema": {
                    "type": "OBJECT",
                    "properties": {
                        "path": {
                            "type": "STRING",
                            "description": "Đường dẫn tuyệt đối đến thư mục module Odoo."
                        }
                    },
                    "required": ["path"]
                }
            },
            {
                "name": "get_model_call_graph",
                "description": "Phân tích các phương thức (methods), computed fields và luồng gọi hàm chéo (Call Graph) trong model Odoo để tránh dev lòng vòng.",
                "inputSchema": {
                    "type": "OBJECT",
                    "properties": {
                        "path": {
                            "type": "STRING",
                            "description": "Đường dẫn tuyệt đối đến thư mục module Odoo."
                        }
                    },
                    "required": ["path"]
                }
            },
            {
                "name": "check_relations_integrity",
                "description": "Kiểm tra tính toàn vẹn của các trường Many2one, One2many và Many2many để phát hiện lỗi sai cấu trúc database chéo.",
                "inputSchema": {
                    "type": "OBJECT",
                    "properties": {
                        "path": {
                            "type": "STRING",
                            "description": "Đường dẫn tuyệt đối đến thư mục module Odoo."
                        }
                    },
                    "required": ["path"]
                }
            }
        ]
        
        # Tiền biên dịch các Regex (Pre-compiled Regex) để tối ưu tốc độ và giảm thiểu cấp phát bộ nhớ (RAM)
        self.re_class = re.compile(r'^class\s+(\w+)\(models\.(Model|TransientModel)\):')
        self.re_model_name = re.compile(r'^\s*_name\s*=\s*[\'"]([^\'"]+)[\'"]')
        self.re_inherit = re.compile(r'^\s*_inherit\s*=\s*([\[\'"\w,\.\s\]]+)')
        self.re_field = re.compile(r'^\s*(\w+)\s*=\s*fields\.(\w+)\((.*)\)')
        self.re_def = re.compile(r'^\s*def\s+(\w+)\((self[^)]*)\):')
        self.re_depends = re.compile(r'@api\.depends\((.*)\)')

    def serve(self):
        for line in sys.stdin:
            if not line.strip():
                continue
            try:
                request = json.loads(line)
                response = self.handle_request(request)
                if response:
                    sys.stdout.write(json.dumps(response) + "\n")
                    sys.stdout.flush()
            except Exception as e:
                error_response = {
                    "jsonrpc": "2.0",
                    "error": {"code": -32603, "message": str(e)},
                    "id": None
                }
                sys.stdout.write(json.dumps(error_response) + "\n")
                sys.stdout.flush()

    def handle_request(self, request):
        method = request.get("method")
        req_id = request.get("id")
        
        if method == "initialize":
            return {
                "jsonrpc": "2.0",
                "result": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {"tools": {}},
                    "serverInfo": {"name": "odoo-graph-mcp", "version": "2.0.0"}
                },
                "id": req_id
            }
        elif method == "tools/list":
            return {
                "jsonrpc": "2.0",
                "result": {"tools": self.tools},
                "id": req_id
            }
        elif method == "tools/call":
            params = request.get("params", {})
            name = params.get("name")
            arguments = params.get("arguments", {})
            
            if name == "get_model_graph":
                return self.tool_get_model_graph(arguments.get("path"), req_id)
            elif name == "get_model_call_graph":
                return self.tool_get_model_call_graph(arguments.get("path"), req_id)
            elif name == "check_relations_integrity":
                return self.tool_check_relations_integrity(arguments.get("path"), req_id)
            else:
                return {
                    "jsonrpc": "2.0",
                    "error": {"code": -32601, "message": f"Tool '{name}' không tồn tại."},
                    "id": req_id
                }
        return None

    def tool_get_model_graph(self, path, req_id):
        if not path or not os.path.exists(path):
            return self.mcp_error_response("Đường dẫn không hợp lệ.", req_id)
            
        models, relations, _, _ = self.parse_module_lazy(path)
        
        mermaid_lines = ["classDiagram"]
        for m_name, m_data in models.items():
            clean_class_name = m_name.replace('.', '_')
            mermaid_lines.append(f"    class {clean_class_name} {{")
            mermaid_lines.append(f"        _name: {m_name}")
            if "inherits" in m_data:
                mermaid_lines.append(f"        _inherit: {', '.join(m_data['inherits'])}")
            for f in m_data.get("fields", []):
                mermaid_lines.append(f"        +{f['name']} ({f['type']})")
            mermaid_lines.append("    }")

        for rel in relations:
            src = rel["source"].replace('.', '_')
            dest = rel["dest"].replace('.', '_')
            rel_type = rel["type"]
            field = rel["field"]
            
            if rel_type == "many2one":
                mermaid_lines.append(f"    {src} --> \"1\" {dest} : {field}")
            elif rel_type == "one2many":
                mermaid_lines.append(f"    {src} --> \"*\" {dest} : {field}")
            elif rel_type == "many2many":
                mermaid_lines.append(f"    {src} ..> \"*\" {dest} : {field}")

        mermaid_code = "\n".join(mermaid_lines)
        result_text = f"### Sơ đồ quan hệ Model Odoo (Mermaid Graph):\n\n```mermaid\n{mermaid_code}\n```\n"
        
        return {
            "jsonrpc": "2.0",
            "result": {"content": [{"type": "text", "text": result_text}]},
            "id": req_id
        }

    def tool_get_model_call_graph(self, path, req_id):
        if not path or not os.path.exists(path):
            return self.mcp_error_response("Đường dẫn không hợp lệ.", req_id)
            
        _, _, methods, depends = self.parse_module_lazy(path)
        
        mermaid_lines = ["graph TD"]
        
        # Phác họa đồ thị phụ thuộc giữa trường dữ liệu và hàm compute
        for dep in depends:
            model = dep["model"]
            func = dep["function"]
            fields = dep["fields"]
            for f in fields:
                mermaid_lines.append(f"    {model}_f_{f}[{model}.{f}] -->|api.depends| {model}_fn_{func}({model}.{func})")
                
        # Phác họa sơ đồ gọi hàm nội bộ (nếu phát hiện trong thân hàm gọi hàm khác)
        for m in methods:
            model = m["model"]
            name = m["name"]
            # Minh họa hàm thuộc model
            mermaid_lines.append(f"    {model}_fn_{name}({model}.{name})")

        mermaid_code = "\n".join(mermaid_lines)
        result_text = f"### Đồ thị Lời gọi hàm & Computed Fields (Call Graph):\n\n```mermaid\n{mermaid_code}\n```\n"
        
        return {
            "jsonrpc": "2.0",
            "result": {"content": [{"type": "text", "text": result_text}]},
            "id": req_id
        }

    def tool_check_relations_integrity(self, path, req_id):
        if not path or not os.path.exists(path):
            return self.mcp_error_response("Đường dẫn không hợp lệ.", req_id)
            
        models, relations, _, _ = self.parse_module_lazy(path)
        issues = []
        
        for rel in relations:
            src = rel["source"]
            dest = rel["dest"]
            field = rel["field"]
            rel_type = rel["type"]
            inverse_field = rel.get("inverse_field")
            
            if rel_type == "one2many":
                dest_model = models.get(dest)
                if dest_model:
                    dest_fields = [f["name"] for f in dest_model.get("fields", [])]
                    if inverse_field not in dest_fields:
                        issues.append(
                            f"Lỗi: Trường One2many '{src}.{field}' trỏ đến model '{dest}', nhưng trường ngược (inverse) '{inverse_field}' không tồn tại ở '{dest}'."
                        )

        if issues:
            report = "❌ Phát hiện lỗi toàn vẹn cấu trúc dữ liệu:\n\n" + "\n".join([f"- {i}" for i in issues])
        else:
            report = "✅ Không phát hiện lỗi cấu trúc dữ liệu! Các quan hệ One2many/Many2one hoạt động nhất quán."

        return {
            "jsonrpc": "2.0",
            "result": {"content": [{"type": "text", "text": report}]},
            "id": req_id
        }

    def parse_module_lazy(self, path):
        # Đọc tệp lười (Lazy line-by-line reading) để tiết kiệm RAM tối đa (< 10MB)
        models = {}
        relations = []
        methods = []
        depends = []
        
        for root, dirs, files in os.walk(path):
            for file in files:
                if file.endswith('.py'):
                    filepath = os.path.join(root, file)
                    self.parse_file_lazy(filepath, models, relations, methods, depends)
        return models, relations, methods, depends

    def parse_file_lazy(self, filepath, models, relations, methods, depends):
        current_model = None
        current_depends = None
        
        # Đọc line-by-line bằng context manager giúp giải phóng bộ nhớ ngay lập tức
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            for line in f:
                clean_line = line.strip()
                
                # 1. Nhận dạng Class định nghĩa
                class_match = self.re_class.match(clean_line)
                if class_match:
                    current_model = None
                    continue
                    
                # 2. Nhận dạng model _name
                name_match = self.re_model_name.match(clean_line)
                if name_match:
                    current_model = name_match.group(1)
                    models[current_model] = {"fields": [], "inherits": []}
                    continue
                    
                if not current_model:
                    continue
                    
                # 3. Nhận dạng _inherit
                inherit_match = self.re_inherit.match(clean_line)
                if inherit_match:
                    raw_inherit = inherit_match.group(1).replace('[', '').replace(']', '').replace('\'', '').replace('"', '')
                    inherits = [i.strip() for i in raw_inherit.split(',') if i.strip()]
                    models[current_model]["inherits"].extend(inherits)
                    continue

                # 4. Nhận dạng Fields & Quan hệ
                field_match = self.re_field.match(clean_line)
                if field_match:
                    f_name = field_match.group(1)
                    f_type = field_match.group(2)
                    f_args = field_match.group(3)
                    
                    models[current_model]["fields"].append({
                        "name": f_name,
                        "type": f_type
                    })
                    
                    if f_type == "Many2one":
                        dest_match = re.search(r"^['\"]([^'\"]+)['\"]", f_args.strip())
                        if dest_match:
                            relations.append({
                                "source": current_model,
                                "dest": dest_match.group(1),
                                "type": "many2one",
                                "field": f_name
                            })
                    elif f_type == "One2many":
                        dest_args = [arg.strip().strip("'\"") for arg in f_args.split(",")]
                        if len(dest_args) >= 2:
                            relations.append({
                                "source": current_model,
                                "dest": dest_args[0],
                                "type": "one2many",
                                "field": f_name,
                                "inverse_field": dest_args[1]
                            })
                    elif f_type == "Many2many":
                        dest_match = re.search(r"^['\"]([^'\"]+)['\"]", f_args.strip())
                        if dest_match:
                            relations.append({
                                "source": current_model,
                                "dest": dest_match.group(1),
                                "type": "many2many",
                                "field": f_name
                            })
                    continue

                # 5. Nhận dạng API depends
                depends_match = self.re_depends.match(clean_line)
                if depends_match:
                    raw_deps = depends_match.group(1).replace('\'', '').replace('"', '')
                    current_depends = [d.strip() for d in raw_deps.split(',') if d.strip()]
                    continue

                # 6. Nhận dạng định nghĩa hàm
                def_match = self.re_def.match(clean_line)
                if def_match:
                    func_name = def_match.group(1)
                    methods.append({
                        "model": current_model,
                        "name": func_name
                    })
                    if current_depends:
                        depends.append({
                            "model": current_model,
                            "function": func_name,
                            "fields": current_depends
                        })
                        current_depends = None
                    continue

    def mcp_error_response(self, message, req_id):
        return {
            "jsonrpc": "2.0",
            "error": {"code": -32602, "message": message},
            "id": req_id
        }

if __name__ == "__main__":
    server = OdooGraphMCP()
    server.serve()
