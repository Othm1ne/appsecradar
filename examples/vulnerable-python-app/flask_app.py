import sqlite3

from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_login import login_required

app = Flask(__name__)
CORS(app, supports_credentials=True)

db = sqlite3.connect("app.db", check_same_thread=False)


@app.route("/api/notes", methods=["POST"])
def create_note():
    content = request.json["content"]
    db.execute(f"INSERT INTO notes (content) VALUES ('{content}')")
    db.commit()
    return jsonify(ok=True)


# Protected correctly
@app.route("/api/notes/<int:note_id>", methods=["DELETE"])
@login_required
def delete_note(note_id):
    db.execute("DELETE FROM notes WHERE id = ?", (note_id,))
    return jsonify(ok=True)


@app.route("/webhook", methods=["POST"])
def stripe_webhook():
    event = request.get_json()
    if event["type"] == "checkout.session.completed":
        pass  # upgrade the user
    return "", 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", debug=True)
