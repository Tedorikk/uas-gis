-- [NIM] [NAMA] - UAS WebGIS 2024/2425
-- Setup Database Script

-- Create database
CREATE DATABASE IF NOT EXISTS webgisuas2425 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

-- Use database
USE webgisuas2425;

-- The table will be created automatically by Prisma
-- This is just for reference

-- Sample data (optional)
-- INSERT INTO spatial_data (nama, kategori, deskripsi, tipe_geom, koordinat, latitude, longitude, createdAt, updatedAt) 
-- VALUES 
-- ('Rumah Saya', 'Tempat Tinggal', 'Lokasi rumah di Pontianak', 'point', 
--  JSON_ARRAY(109.3425, -0.0263), -0.0263, 109.3425, NOW(), NOW()),
-- ('Jalan Utama', 'Infrastruktur', 'Jalan utama menuju kampus', 'line', 
--  JSON_ARRAY(JSON_ARRAY(109.3425, -0.0263), JSON_ARRAY(109.3435, -0.0273)), NULL, NULL, NOW(), NOW());
