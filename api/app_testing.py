import os

os.environ["MODE"] = "testing"

from src.fixtures.reset_db import reset  # noqa: E402
from src.security.secrets import SECRET  # noqa: E402

import uvicorn  # noqa: E402

if __name__ == "__main__":
    reset()
    port = int(os.environ.get("PORT", "8001"))
    print(
        f"\n🧪 TEST MODE\n"
        f"  API      : http://localhost:{port}\n"
        f"  DB       : {SECRET.MARIADB_DATABASE} @ {SECRET.MARIADB_HOST}:{SECRET.MARIADB_PORT}\n"
        f"  DB user  : {SECRET.MARIADB_USER}\n"
    )
    uvicorn.run("main:app", host="127.0.0.1", port=port, reload=True)
