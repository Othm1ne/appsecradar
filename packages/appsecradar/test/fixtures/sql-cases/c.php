<?php
$r = $db->query("SELECT * FROM users WHERE id = '$id'");
$r = mysqli_query($conn, 'SELECT * FROM users WHERE id = ' . $_GET['id']);
$s = $db->prepare("SELECT * FROM users WHERE id = ?");
