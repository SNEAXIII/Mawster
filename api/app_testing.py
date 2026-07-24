import os

os.environ["MODE"] = "testing"

import uvicorn

from src.fixtures.reset_db import reset
from src.security.secrets import SECRET

if __name__ == "__main__":
    reset()
    port = int(os.environ.get("PORT", "8001"))
    print(
        f"\n🧪 TEST MODE\n"
        f"  API      : http://localhost:{port}\n"
        f"  DB       : {SECRET.MARIADB_DATABASE} @ {SECRET.MARIADB_HOST}:{SECRET.MARIADB_PORT}\n"
        f"  DB user  : {SECRET.MARIADB_USER}\n"
    )
    # reload=False: the WatchFiles autoreloader has no place in E2E/CI — a stray
    # file change mid-run would restart the server and break in-flight tests.
    uvicorn.run("main:app", host="127.0.0.1", port=port, reload=False)
