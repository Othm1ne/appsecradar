cur.execute(f"SELECT * FROM users WHERE name = '{name}'")
cur.execute("SELECT * FROM users WHERE name = '%s'" % name)
cur.execute(f"""
    SELECT * FROM users
    WHERE id = {user_id}
""")
cur.execute("SELECT * FROM users WHERE name = %s", (name,))
label = "Select an option from the list"
cur.execute(f"DELETE FROM sessions WHERE age > {MAX_AGE_DAYS}")
cur.execute(f"SELECT * FROM users LIMIT {50}")
