rows, _ := db.Query(fmt.Sprintf("SELECT * FROM users WHERE id = %s", id))
rows, _ := db.Query("SELECT * FROM users WHERE id = $1", id)
