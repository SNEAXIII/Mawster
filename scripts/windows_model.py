import subprocess
from IOsModel import IOsModel  # pylint: disable=import-error


class WindowsModel(IOsModel):
    @property
    def npm(self) -> str:
        return "npm.cmd"

    @property
    def npx(self) -> str:
        return "npx.cmd"

    def cypress_cmd(self, cmd: list[str]) -> list[str]:
        return cmd

    def kill_port(self, port: int) -> None:
        result = subprocess.run(["netstat", "-ano"], capture_output=True, text=True)
        pids: set[str] = set()
        for line in result.stdout.splitlines():
            if "LISTENING" in line and f":{port} " in line:
                parts = line.split()
                pids.add(parts[-1])
        for pid in pids:
            subprocess.run(["taskkill", "/F", "/PID", pid], capture_output=True)

    @property
    def start_new_session(self) -> bool:
        return False
