import os
import signal
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
        # check=False: no listener on the port is the normal case, not a failure.
        result = subprocess.run(
            ["lsof", "-ti", f":{port}"], capture_output=True, text=True, check=False
        )
        for pid in result.stdout.strip().splitlines():
            subprocess.run(["kill", "-9", pid.strip()], capture_output=True, check=False)

    @property
    def start_new_session(self) -> bool:
        return True

    def terminate_proc(self, p: subprocess.Popen) -> None:
        os.killpg(os.getpgid(p.pid), signal.SIGTERM)

    def kill_proc(self, p: subprocess.Popen) -> None:
        os.killpg(os.getpgid(p.pid), signal.SIGKILL)


class LinuxHeadlessModel(LinuxModel):
    def cypress_cmd(self, cmd: list[str]) -> list[str]:
        return ["xvfb-run", "-a", *cmd]
