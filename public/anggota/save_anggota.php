<?php
// save_anggota.php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: http://localhost:3000");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Terima data JSON
$data = json_decode(file_get_contents('php://input'), true);

if (!$data) {
  echo json_encode(['status' => 'error', 'message' => 'No data received']);
  exit;
}

// Contoh koneksi ke MySQL
$mysqli = new mysqli("localhost", "root", "password", "db_uas_sigd");
if ($mysqli->connect_error) {
  echo json_encode(['status' => 'error', 'message' => 'DB connection failed']);
  exit;
}

// Ambil data dari request (ubah sesuai struktur tabel)
$nama = $mysqli->real_escape_string($data['nama'] ?? '');
$usia = intval($data['usia'] ?? 0);
$hubungan = $mysqli->real_escape_string($data['hubungan'] ?? '');

// Insert ke tabel anggota_keluarga
$query = "INSERT INTO anggota_keluarga (nama, usia, hubungan) VALUES ('$nama', $usia, '$hubungan')";

if ($mysqli->query($query)) {
  echo json_encode(['status' => 'success', 'message' => 'Data saved']);
} else {
  echo json_encode(['status' => 'error', 'message' => 'Insert failed']);
}

$mysqli->close();
?>
