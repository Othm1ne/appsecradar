import os

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["https://myapp.com"], allow_credentials=True)


@app.delete("/users/{user_id}")
def delete_user(user_id: int, user=Depends(get_current_user), db=Depends(get_db)):
    db.execute("DELETE FROM users WHERE id = %s AND id = %s", (user_id, user.id))
    return {"deleted": True}


if __name__ == "__main__":
    app.run(debug=os.environ.get("DEBUG") == "1")
