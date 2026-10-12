import uvicorn
import os
import sys

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.config import HOST, PORT

if __name__ == "__main__":
    print(f"Starting TrustTrace AI Backend Server on http://{HOST}:{PORT} ...")
    uvicorn.run("app.main:app", host=HOST, port=PORT, reload=False)
