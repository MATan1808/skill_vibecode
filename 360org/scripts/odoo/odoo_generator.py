#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import argparse
import sys

def create_file(path, content):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"  [+] Đã tạo: {path}")

def generate_module(name, summary, version, depends_list):
    print(f"\n🚀 Đang khởi tạo module Odoo chuẩn cho phiên bản: v{version}")
    base_dir = os.path.join(os.getcwd(), name)
    
    if os.path.exists(base_dir):
        print(f"❌ Lỗi: Thư mục '{name}' đã tồn tại trong workspace hiện tại.")
        sys.exit(1)
        
    os.makedirs(base_dir, exist_ok=True)
    
    # 1. Sinh file __init__.py chính
    create_file(
        os.path.join(base_dir, "__init__.py"),
        "# -*- coding: utf-8 -*-\n\nfrom . import models\nfrom . import controllers\n"
    )
    
    # 2. Sinh file __manifest__.py
    depends_str = ", ".join([f"'{d}'" for d in depends_list])
    
    # Chuẩn bị assets dựa theo phiên bản
    assets_block = ""
    if float(version) >= 15.0:
        assets_block = f""",
    'assets': {{
        'web.assets_backend': [
            '{name}/static/src/components/**/*.js',
            '{name}/static/src/components/**/*.xml',
            '{name}/static/src/components/**/*.scss',
        ],
    }}"""

    manifest_content = f"""# -*- coding: utf-8 -*-
{{
    'name': '{name.replace("_", " ").title()}',
    'version': '{version}.1.0.0',
    'summary': '{summary}',
    'category': 'Custom Modules',
    'author': 'Company Developer',
    'website': 'https://www.company.com',
    'license': 'LGPL-3',
    'depends': [{depends_str}],
    'data': [
        'security/ir.model.access.csv',
        'views/{name}_views.xml',
    ]{assets_block},
    'changelog': {{
        '{version}.1.0.0': 'Khởi tạo module, định nghĩa cấu trúc Model và giao diện OWL Component mẫu.',
    }},
    'installable': True,
    'application': True,
    'auto_install': False,
}}
"""
    create_file(os.path.join(base_dir, "__manifest__.py"), manifest_content)
    
    # 3. Sinh thư mục models/
    create_file(
        os.path.join(base_dir, "models", "__init__.py"),
        "# -*- coding: utf-8 -*-\n\nfrom . import test_model\n"
    )
    
    # Cú pháp constraint/index tùy thuộc vào phiên bản
    if float(version) >= 17.0:
        sql_constraint_comment = """# Cú pháp SQL Constraint Odoo 17+
    _sql_constraints = [
        ('name_unique', 'UNIQUE(name)', 'Trường name phải là duy nhất!')
    ]"""
    else:
        sql_constraint_comment = """# Cú pháp SQL Constraint Odoo v14-v16
    _sql_constraints = [
        ('name_unique', 'unique(name)', 'Trường name phải là duy nhất!')
    ]"""

    model_content = f"""# -*- coding: utf-8 -*-

from odoo import models, fields, api, _

class TestModel(models.Model):
    _name = '{name}.test'
    _description = 'Odoo Test Model'
    _order = 'sequence, id desc'

    name = fields.Char(string='Name', required=True)
    sequence = fields.Integer(string='Sequence', default=10)
    active = fields.Boolean(string='Active', default=True)
    description = fields.Text(string='Description')

    {sql_constraint_comment}
"""
    create_file(os.path.join(base_dir, "models", "test_model.py"), model_content)
    
    # 4. Sinh thư mục views/
    # XML view tùy thuộc phiên bản (invisible có attrs hay không)
    if float(version) >= 17.0:
        xml_invisible_field = f'<field name="description" invisible="not active"/>'
    else:
        xml_invisible_field = f'<field name="description" attrs="{{\'invisible\': [(\'active\', \'=\', False)]}}"/>'

    view_content = f"""<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <!-- Tree View -->
    <record id="view_{name}_test_tree" model="ir.ui.view">
        <name>{name}.test.tree</name>
        <model>{name}.test</model>
        <arch type="xml">
            <tree string="Test Records">
                <field name="sequence" widget="handle"/>
                <field name="name"/>
                <field name="active"/>
            </tree>
        </arch>
    </record>

    <!-- Form View -->
    <record id="view_{name}_test_form" model="ir.ui.view">
        <name>{name}.test.form</name>
        <model>{name}.test</model>
        <arch type="xml">
            <form string="Test Record">
                <sheet>
                    <group>
                        <group>
                            <field name="name"/>
                            <field name="active"/>
                        </group>
                        <group>
                            {xml_invisible_field}
                        </group>
                    </group>
                </sheet>
            </form>
        </arch>
    </record>

    <!-- Action -->
    <record id="action_{name}_test" model="ir.actions.act_window">
        <name>Test Records</name>
        <res_model>{name}.test</res_model>
        <view_mode>tree,form</view_mode>
        <help type="html">
            <p class="o_view_nocontent_smiling_face">
                Tạo bản ghi mới đầu tiên!
            </p>
        </help>
    </record>

    <!-- Menu -->
    <menuitem id="menu_{name}_root" name="{name.replace('_', ' ').title()}" sequence="10"/>
    <menuitem id="menu_{name}_test" name="Records" parent="menu_{name}_root" action="action_{name}_test" sequence="10"/>
</odoo>
"""
    create_file(os.path.join(base_dir, "views", f"{name}_views.xml"), view_content)
    
    # 5. Sinh thư mục security/
    csv_content = f"""id,name,model_id:id,group_id:id,perm_read,perm_write,perm_create,perm_unlink
access_{name}_test_admin,access.{name}.test.admin,model_{name.replace('_', '_')}_test,,1,1,1,1
"""
    create_file(os.path.join(base_dir, "security", "ir.model.access.csv"), csv_content)
    
    # 6. Sinh thư mục controllers/
    create_file(
        os.path.join(base_dir, "controllers", "__init__.py"),
        "# -*- coding: utf-8 -*-\n\nfrom . import main\n"
    )
    
    controller_content = f"""# -*- coding: utf-8 -*-

from odoo import http
from odoo.http import request

class {name.replace('_', ' ').title().replace(' ', '')}Controller(http.Controller):

    @http.route('/api/{name}/status', type='json', auth='public', methods=['GET'], csrf=False)
    def get_status(self, **kwargs):
        return {{
            'status': 'online',
            'module': '{name}',
            'version': '{version}'
        }}
"""
    create_file(os.path.join(base_dir, "controllers", "main.py"), controller_content)

    # 7. Sinh thư mục frontend OWL (nếu v15+)
    if float(version) >= 15.0:
        # File Javascript OWL component mẫu
        if float(version) >= 16.0:
            js_content = f"""/** @odoo-module **/

import {{ Component, useState }} from "@odoo/owl";
import {{ registry }} from "@web/core/registry";

export class TestOwlComponent extends Component {{
    setup() {{
        this.state = useState({{
            counter: 0
        }});
    }}

    increment() {{
        this.state.counter++;
    }}
}}

TestOwlComponent.template = "{name}.TestOwlComponent";
registry.category("actions").add("action_test_owl_{name}", TestOwlComponent);
"""
        else:
            # v15 OWL syntax
            js_content = f"""odoo.define('{name}.TestOwlComponent', function (require) {{
    'use strict';
    const {{ Component }} = owl;
    const {{ useState }} = owl.hooks;

    class TestOwlComponent extends Component {{
        setup() {{
            this.state = useState({{
                counter: 0
            }});
        }}

        increment() {{
            this.state.counter++;
        }}
    }}
    TestOwlComponent.template = '{name}.TestOwlComponent';
    return TestOwlComponent;
}});
"""
        create_file(
            os.path.join(base_dir, "static", "src", "components", "test_component", "test_component.js"),
            js_content
        )
        
        # File QWeb XML template
        xml_template = f"""<?xml version="1.0" encoding="UTF-8"?>
<templates xml:space="preserve">
    <t t-name="{name}.TestOwlComponent" owl="1">
        <div class="p-4 bg-white shadow-sm rounded border border-light">
            <h3 class="text-primary font-weight-bold mb-3">OWL Component Mẫu</h3>
            <p>Giá trị bộ đếm hiện tại: <strong><t t-esc="state.counter"/></strong></p>
            <button class="btn btn-primary" t-on-click="increment">
                <i class="fa fa-plus-circle mr-1"/> Tăng số lượng
            </button>
        </div>
    </t>
</templates>
"""
        create_file(
            os.path.join(base_dir, "static", "src", "components", "test_component", "test_component.xml"),
            xml_template
        )
        
        # File SCSS styling
        scss_content = f""".p-4 {{
    transition: all 0.3s ease;
    &:hover {{
        border-color: #7c7bad !important;
    }}
}}
"""
        create_file(
            os.path.join(base_dir, "static", "src", "components", "test_component", "test_component.scss"),
            scss_content
        )

    print(f"\n🎉 Hoàn thành! Module '{name}' đã được sinh thành công tại thư mục hiện tại.")

def main():
    parser = argparse.ArgumentParser(description="Odoo Module Scaffold Generator (v14-v19)")
    parser.add_argument("--name", required=True, help="Tên module (viết thường, ví dụ: hms_hospital)")
    parser.add_argument("--summary", default="Module Odoo được khởi tạo tự động", help="Tóm tắt tính năng module")
    parser.add_argument("--version", choices=["14", "15", "16", "17", "18", "19"], default="19", help="Phiên bản Odoo mục tiêu (mặc định: 19)")
    parser.add_argument("--depends", default="web", help="Các module phụ thuộc, phân cách bằng dấu phẩy (mặc định: web)")
    
    args = parser.parse_args()
    
    depends_list = [d.strip() for d in args.depends.split(",") if d.strip()]
    generate_module(args.name, args.summary, args.version, depends_list)

if __name__ == "__main__":
    main()
