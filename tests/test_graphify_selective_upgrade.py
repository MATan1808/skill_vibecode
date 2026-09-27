from __future__ import annotations

import sys
from pathlib import Path


CORE = Path(__file__).parent.parent / "360org" / "plugins" / "360-graphify" / "core"
sys.path.insert(0, str(CORE))

from graphify.extract import (  # noqa: E402
    _file_stem,
    _make_id,
    extract,
    extract_csharp,
    extract_go,
    extract_kotlin,
    extract_php,
    extract_scala,
)


def _edge_labels(result: dict, relation: str, context: str | None = None) -> set[tuple[str, str]]:
    labels = {node["id"]: node["label"].strip("()").lstrip(".") for node in result["nodes"]}
    return {
        (labels.get(edge["source"], edge["source"]), labels.get(edge["target"], edge["target"]))
        for edge in result["edges"]
        if edge.get("relation") == relation
        and (context is None or edge.get("context") == context)
    }


def test_javascript_class_extends_emits_inheritance(tmp_path: Path) -> None:
    source = tmp_path / "src" / "inheritance.js"
    source.parent.mkdir()
    source.write_text("class Animal {}\nclass Dog extends Animal {}\n", encoding="utf-8")
    result = extract([source], cache_root=tmp_path)
    dog = _make_id(_file_stem(Path("src/inheritance.js")), "Dog")
    animal = _make_id(_file_stem(Path("src/inheritance.js")), "Animal")
    assert any(
        (edge["source"], edge["target"], edge["relation"]) == (dog, animal, "inherits")
        for edge in result["edges"]
    )


def test_php_interface_enum_trait_heritage(tmp_path: Path) -> None:
    source = tmp_path / "heritage.php"
    source.write_text(
        "<?php\n"
        "interface Identifiable {}\n"
        "interface Nameable extends Identifiable {}\n"
        "enum Suit: string implements Nameable {\n"
        "  case Hearts = 'H';\n"
        "  public function label(): string { return 'x'; }\n"
        "}\n"
        "trait Named {}\n"
        "trait Greets { use Named; }\n",
        encoding="utf-8",
    )
    result = extract_php(source)
    assert ("Nameable", "Identifiable") in _edge_labels(result, "inherits")
    assert ("Suit", "Nameable") in _edge_labels(result, "implements")
    assert ("Greets", "Named") in _edge_labels(result, "mixes_in")
    assert ("Suit", "label") in _edge_labels(result, "method")


def test_scala_qualified_heritage_uses_tail_name(tmp_path: Path) -> None:
    source = tmp_path / "qualified.scala"
    source.write_text("class Foo extends pkg.Base with other.Trait1\n", encoding="utf-8")
    result = extract_scala(source)
    assert ("Foo", "Base") in _edge_labels(result, "inherits")
    assert ("Foo", "Trait1") in _edge_labels(result, "mixes_in")
    assert ("Foo", "pkg.Base") not in _edge_labels(result, "inherits")


def test_kotlin_qualified_supertype_uses_tail_name(tmp_path: Path) -> None:
    source = tmp_path / "qualified.kt"
    source.write_text("class Foo : com.example.Base(), com.example.Iface\n", encoding="utf-8")
    result = extract_kotlin(source)
    assert ("Foo", "Base") in _edge_labels(result, "inherits")
    assert ("Foo", "Iface") in _edge_labels(result, "implements")
    assert ("Foo", "com") not in _edge_labels(result, "inherits")


def test_csharp_interface_extends_is_inheritance(tmp_path: Path) -> None:
    source = tmp_path / "Interfaces.cs"
    source.write_text(
        "public interface IBase {}\n"
        "public interface IDerived : IBase {}\n"
        "public class Impl : IBase {}\n",
        encoding="utf-8",
    )
    result = extract_csharp(source)
    assert ("IDerived", "IBase") in _edge_labels(result, "inherits")
    assert ("IDerived", "IBase") not in _edge_labels(result, "implements")
    assert ("Impl", "IBase") in _edge_labels(result, "implements")


def test_go_type_union_is_reference_not_embedding(tmp_path: Path) -> None:
    source = tmp_path / "constraint.go"
    source.write_text(
        "package p\n"
        "type MyInt int\n"
        "type MyFloat float64\n"
        "type Number interface { MyInt | MyFloat }\n",
        encoding="utf-8",
    )
    result = extract_go(source)
    assert ("Number", "MyInt") not in _edge_labels(result, "embeds")
    assert ("Number", "MyFloat") not in _edge_labels(result, "embeds")
    assert ("Number", "MyInt") in _edge_labels(result, "references", "type_constraint")
    assert ("Number", "MyFloat") in _edge_labels(result, "references", "type_constraint")
