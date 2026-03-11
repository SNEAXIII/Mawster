import os

os.environ["MODE"] = "testing"

from src.fixtures.reset_db import reset  # noqa: E402

import uvicorn  # noqa: E402

if __name__ == "__main__":
    reset()
    uvicorn.run("main:app", host="127.0.0.1", port=8001, reload=True)
