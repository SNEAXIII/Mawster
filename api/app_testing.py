import os

from src.fixtures.reset_db import reset

os.environ["MODE"] = "testing"

import uvicorn

if __name__ == "__main__":
    reset()
    uvicorn.run("main:app", host="127.0.0.1", port=8001, reload=True)
