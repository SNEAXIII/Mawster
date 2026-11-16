import pytest

from src.security.secrets import Settings


def _settings(secrets_dir, **files: str) -> Settings:
    for name, content in files.items():
        (secrets_dir / name).write_text(content, encoding="utf-8")
    return Settings(_env_file=None, _secrets_dir=secrets_dir)


def test_secret_file_is_read_and_stripped(tmp_path, monkeypatch):
    monkeypatch.delenv("SECRET_KEY", raising=False)
    assert _settings(tmp_path, mawster_secret_key="from-file\n").SECRET_KEY == "from-file"


def test_env_var_wins_over_secret_file(tmp_path, monkeypatch):
    monkeypatch.setenv("SECRET_KEY", "from-env")
    assert _settings(tmp_path, mawster_secret_key="from-file").SECRET_KEY == "from-env"


def test_rabbitmq_url_is_built_from_the_password_secret(tmp_path, monkeypatch):
    monkeypatch.delenv("RABBITMQ_URL", raising=False)
    settings = _settings(tmp_path, mawster_rabbitmq_pass="p@ss/word\n")
    assert settings.RABBITMQ_URL == "amqp://mawster:p%40ss%2Fword@rabbitmq:5672/"


def test_explicit_rabbitmq_url_wins_over_the_password_secret(tmp_path, monkeypatch):
    monkeypatch.setenv("RABBITMQ_URL", "amqp://explicit/")
    assert _settings(tmp_path, mawster_rabbitmq_pass="ignored").RABBITMQ_URL == "amqp://explicit/"


def test_empty_rabbitmq_url_is_rejected(tmp_path, monkeypatch):
    monkeypatch.setenv("RABBITMQ_URL", "")
    with pytest.raises(ValueError, match="RABBITMQ_URL"):
        Settings(_env_file=None, _secrets_dir=tmp_path)
