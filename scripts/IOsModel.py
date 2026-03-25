from abc import ABC, abstractmethod
import subprocess


class IOsModel(ABC):
    @property
    @abstractmethod
    def npm(self) -> str: ...

    @property
    @abstractmethod
    def npx(self) -> str: ...

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

    @abstractmethod
    def terminate_proc(self, p: subprocess.Popen) -> None:
        """Send SIGTERM (or equivalent) to the process (group)."""

    @abstractmethod
    def kill_proc(self, p: subprocess.Popen) -> None:
        """Send SIGKILL (or equivalent) to the process (group)."""
