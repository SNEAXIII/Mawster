import pytest

from src.fixtures.paths import ALLOWED_ROOT, json_path_from_argv

DEFAULT = ALLOWED_ROOT / "src" / "fixtures" / "champions.json"


def test_default_is_used_without_the_json_flag(monkeypatch):
    monkeypatch.setattr("sys.argv", ["load_champions.py"])
    assert json_path_from_argv(DEFAULT) == DEFAULT.resolve()


def test_json_flag_accepts_a_file_inside_the_project(monkeypatch):
    inside = ALLOWED_ROOT / "src" / "fixtures" / "masteries.json"
    monkeypatch.setattr("sys.argv", ["load_champions.py", "--json", str(inside)])
    assert json_path_from_argv(DEFAULT) == inside.resolve()


def test_traversal_out_of_the_project_is_refused(monkeypatch):
    escape = str(ALLOWED_ROOT / ".." / ".." / ".." / "etc" / "passwd")
    monkeypatch.setattr("sys.argv", ["load_champions.py", "--json", escape])
    with pytest.raises(SystemExit, match="outside"):
        json_path_from_argv(DEFAULT)


def test_absolute_path_out_of_the_project_is_refused(monkeypatch):
    monkeypatch.setattr("sys.argv", ["load_champions.py", "--json", "/etc/passwd"])
    with pytest.raises(SystemExit, match="outside"):
        json_path_from_argv(DEFAULT)


def test_missing_file_inside_the_project_is_refused(monkeypatch):
    ghost = str(ALLOWED_ROOT / "src" / "fixtures" / "does_not_exist.json")
    monkeypatch.setattr("sys.argv", ["load_champions.py", "--json", ghost])
    with pytest.raises(SystemExit, match="No such fixture file"):
        json_path_from_argv(DEFAULT)


def test_a_directory_is_not_a_fixture_file(monkeypatch):
    monkeypatch.setattr("sys.argv", ["load_champions.py", "--json", str(ALLOWED_ROOT / "src")])
    with pytest.raises(SystemExit, match="No such fixture file"):
        json_path_from_argv(DEFAULT)
