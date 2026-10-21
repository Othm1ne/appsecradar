from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .deps import get_current_user, get_db

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"])


@app.delete("/users/{user_id}")
def delete_user(user_id: int, db=Depends(get_db)):
    db.execute("DELETE FROM users WHERE id = %s", (user_id,))
    return {"deleted": True}


# Protected correctly
@app.post("/items")
def create_item(name: str, user=Depends(get_current_user), db=Depends(get_db)):
    db.execute("INSERT INTO items (name, owner) VALUES (%s, %s)", (name, user.id))
    return {"ok": True}
