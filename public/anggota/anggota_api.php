<?php
// anggota_api.php
$mysqli = new mysqli("localhost", "root", "", "db_uas_gis");
if ($mysqli->connect_errno) {
    http_response_code(500);
    echo json_encode(["error" => "Gagal koneksi ke database"]);
    exit;
}

header("Content-Type: application/json");

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    // Ambil semua data anggota
    $result = $mysqli->query("SELECT a.*, k.no_kk FROM anggota_keluarga a JOIN kk k ON a.id_kk = k.id ORDER BY a.id DESC");
    $data = [];
    while ($row = $result->fetch_assoc()) {
        $data[] = $row;
    }
    echo json_encode($data);
} elseif ($method === 'POST') {
    $input = json_decode(file_get_contents("php://input"), true);
    $stmt = $mysqli->prepare("INSERT INTO anggota_keluarga (id_kk, nama, NIK, jenis_kelamin, tempat_lahir, tgl_lahir, agama, status, hubungan, pendidikan, pekerjaan) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->bind_param("issssssssss", $input['id_kk'], $input['nama'], $input['NIK'], $input['jenis_kelamin'], $input['tempat_lahir'], $input['tgl_lahir'], $input['agama'], $input['status'], $input['hubungan'], $input['pendidikan'], $input['pekerjaan']);
    $stmt->execute();
    echo json_encode(["success" => true]);
} elseif ($method === 'PUT') {
    $input = json_decode(file_get_contents("php://input"), true);
    $stmt = $mysqli->prepare("UPDATE anggota_keluarga SET id_kk=?, nama=?, NIK=?, jenis_kelamin=?, tempat_lahir=?, tgl_lahir=?, agama=?, status=?, hubungan=?, pendidikan=?, pekerjaan=? WHERE id=?");
    $stmt->bind_param("issssssssssi", $input['id_kk'], $input['nama'], $input['NIK'], $input['jenis_kelamin'], $input['tempat_lahir'], $input['tgl_lahir'], $input['agama'], $input['status'], $input['hubungan'], $input['pendidikan'], $input['pekerjaan'], $input['id']);
    $stmt->execute();
    echo json_encode(["success" => true]);
} elseif ($method === 'DELETE') {
    parse_str(file_get_contents("php://input"), $input);
    $stmt = $mysqli->prepare("DELETE FROM anggota_keluarga WHERE id=?");
    $stmt->bind_param("i", $input['id']);
    $stmt->execute();
    echo json_encode(["success" => true]);
} else {
    http_response_code(405);
}
