import os
from abc import ABC, abstractmethod
from pathlib import Path


class IOsModel(ABC):
    def __init__(self):
        self.ROOT = Path(__file__).parent.parent
        self.API_DIR = self.ROOT / "api"
        self.FRONT_DIR = self.ROOT / "front"

        self.BASE_API_PORT = 8010
        self.BASE_FRONT_PORT = 3010
        self.DB_PREFIX = "mawster_test_"

        self.MARIADB_HOST = "127.0.0.1"
        self.MARIADB_PORT = int(os.environ.get("MARIADB_PORT", "3307"))
        self.MARIADB_ROOT_PASSWORD = os.environ.get("MARIADB_ROOT_PASSWORD", "rootpassword")  # NOSONAR
        self.MARIADB_CONTAINER = os.environ.get("MARIADB_CONTAINER", "mariadb-test")

        self.HEALTH_TIMEOUT = 20

    @property
    @abstractmethod
    def npm(self) -> str: ...

    @property
    @abstractmethod
    def npx(self) -> str: ...

    def worker_log_dir(self, worker: int) -> Path:
        return self.FRONT_DIR / "cypress" / "results" / "workers" / f"worker-{worker}"

    @abstractmethod
    def cypress_cmd(self, cmd: list[str]) -> list[str]:
        """Wrap cypress command (e.g. with xvfb-run on headless Linux)."""

    @abstractmethod
    def kill_port(self, port: int) -> None:
        """Kill any process listening on the given port."""

    @property
    @abstractmethod
    def start_new_session(self) -> bool:
        """Whether to use start_new_session=True in subprocess.Popen."""

