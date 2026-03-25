import subprocess
from IOsModel import IOsModel  # pylint: disable=import-error


class LinuxModel(IOsModel):
    @property
    def npm(self) -> str:
        return "npm"

    @property
    def npx(self) -> str:
        return "npx"

    def cypress_cmd(self, cmd: list[str]) -> list[str]:
        return cmd

    def kill_port(self, port: int) -> None:
        result = subprocess.run(["lsof", "-ti", f":{port}"], capture_output=True, text=True)
        for pid in result.stdout.strip().splitlines():
            subprocess.run(["kill", "-9", pid.strip()], capture_output=True)

    @property
    def start_new_session(self) -> bool:
        return True


class LinuxHeadlessModel(LinuxModel):
    def cypress_cmd(self, cmd: list[str]) -> list[str]:
        return ["xvfb-run", "-a"] + cmd
