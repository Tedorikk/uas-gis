const express = require('express');
const { PrismaClient } = require('@prisma/client');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static('public'));

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes

// Home route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// CREATE - Menambah data spasial baru
app.post('/api/spatial-data', async (req, res) => {
  try {
    const { nama, kategori, deskripsi, tipe_geom, koordinat, latitude, longitude } = req.body;
    
    // Validasi input
    if (!nama || !kategori || !tipe_geom || !koordinat) {
      return res.status(400).json({ 
        error: 'Nama, kategori, tipe geometri, dan koordinat harus diisi',
        required: ['nama', 'kategori', 'tipe_geom', 'koordinat']
      });
    }

    // Validasi tipe geometri
    const validTypes = ['point', 'line', 'polygon'];
    if (!validTypes.includes(tipe_geom)) {
      return res.status(400).json({ 
        error: 'Tipe geometri tidak valid',
        validTypes 
      });
    }

    // Validasi koordinat berdasarkan tipe
    if (tipe_geom === 'point' && (!latitude || !longitude)) {
      return res.status(400).json({ 
        error: 'Latitude dan longitude diperlukan untuk data point' 
      });
    }

    if (tipe_geom === 'line' && (!Array.isArray(koordinat) || koordinat.length < 2)) {
      return res.status(400).json({ 
        error: 'Line harus memiliki minimal 2 koordinat' 
      });
    }

    if (tipe_geom === 'polygon' && (!Array.isArray(koordinat) || koordinat.length < 4)) {
      return res.status(400).json({ 
        error: 'Polygon harus memiliki minimal 4 koordinat (termasuk titik penutup)' 
      });
    }

    const newData = await prisma.spatialData.create({
      data: {
        nama: nama.trim(),
        kategori: kategori.trim(),
        deskripsi: deskripsi ? deskripsi.trim() : '',
        tipe_geom,
        koordinat,
        latitude: latitude || null,
        longitude: longitude || null
      }
    });

    console.log(`Data baru ditambahkan: ${newData.nama} (ID: ${newData.id})`);

    res.status(201).json({
      success: true,
      message: 'Data berhasil disimpan',
      data: newData
    });
  } catch (error) {
    console.error('Error creating data:', error);
    res.status(500).json({ 
      success: false,
      error: 'Gagal menyimpan data',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// READ - Mendapatkan semua data spasial dengan filter dan pencarian
app.get('/api/spatial-data', async (req, res) => {
  try {
    const { kategori, search, tipe_geom, limit = 100, offset = 0 } = req.query;
    
    let whereClause = {};
    
    // Filter berdasarkan kategori
    if (kategori && kategori !== 'all') {
      whereClause.kategori = {
        contains: kategori
      };
    }
    
    // Filter berdasarkan tipe geometri
    if (tipe_geom && tipe_geom !== 'all') {
      whereClause.tipe_geom = tipe_geom;
    }
    
    // Pencarian berdasarkan nama atau deskripsi
    if (search && search.trim() !== '') {
      whereClause.OR = [
        {
          nama: {
            contains: search.trim()
          }
        },
        {
          deskripsi: {
            contains: search.trim()
          }
        }
      ];
    }

    const data = await prisma.spatialData.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset)
    });

    // Hitung total data untuk pagination
    const total = await prisma.spatialData.count({ where: whereClause });

    res.json({ 
      success: true,
      data,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: (parseInt(offset) + parseInt(limit)) < total
      }
    });
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).json({ 
      success: false,
      error: 'Gagal mengambil data',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// READ - Mendapatkan data berdasarkan ID
app.get('/api/spatial-data/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (isNaN(parseInt(id))) {
      return res.status(400).json({ 
        success: false,
        error: 'ID harus berupa angka' 
      });
    }

    const data = await prisma.spatialData.findUnique({
      where: { id: parseInt(id) }
    });

    if (!data) {
      return res.status(404).json({ 
        success: false,
        error: 'Data tidak ditemukan' 
      });
    }

    res.json({ 
      success: true,
      data 
    });
  } catch (error) {
    console.error('Error fetching data by ID:', error);
    res.status(500).json({ 
      success: false,
      error: 'Gagal mengambil data',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// UPDATE - Mengubah data spasial
app.put('/api/spatial-data/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nama, kategori, deskripsi, koordinat, latitude, longitude } = req.body;

    if (isNaN(parseInt(id))) {
      return res.status(400).json({ 
        success: false,
        error: 'ID harus berupa angka' 
      });
    }

    const existingData = await prisma.spatialData.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingData) {
      return res.status(404).json({ 
        success: false,
        error: 'Data tidak ditemukan' 
      });
    }

    // Validasi input yang akan diupdate
    if (nama && nama.trim() === '') {
      return res.status(400).json({ 
        success: false,
        error: 'Nama tidak boleh kosong' 
      });
    }

    if (kategori && kategori.trim() === '') {
      return res.status(400).json({ 
        success: false,
        error: 'Kategori tidak boleh kosong' 
      });
    }

    const updateData = {};
    if (nama !== undefined) updateData.nama = nama.trim();
    if (kategori !== undefined) updateData.kategori = kategori.trim();
    if (deskripsi !== undefined) updateData.deskripsi = deskripsi.trim();
    if (koordinat !== undefined) updateData.koordinat = koordinat;
    if (latitude !== undefined) updateData.latitude = latitude;
    if (longitude !== undefined) updateData.longitude = longitude;

    const updatedData = await prisma.spatialData.update({
      where: { id: parseInt(id) },
      data: updateData
    });

    console.log(`Data diperbarui: ${updatedData.nama} (ID: ${updatedData.id})`);

    res.json({
      success: true,
      message: 'Data berhasil diperbarui',
      data: updatedData
    });
  } catch (error) {
    console.error('Error updating data:', error);
    res.status(500).json({ 
      success: false,
      error: 'Gagal memperbarui data',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// DELETE - Menghapus data spasial
app.delete('/api/spatial-data/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (isNaN(parseInt(id))) {
      return res.status(400).json({ 
        success: false,
        error: 'ID harus berupa angka' 
      });
    }

    const existingData = await prisma.spatialData.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingData) {
      return res.status(404).json({ 
        success: false,
        error: 'Data tidak ditemukan' 
      });
    }

    await prisma.spatialData.delete({
      where: { id: parseInt(id) }
    });

    console.log(`Data dihapus: ${existingData.nama} (ID: ${existingData.id})`);

    res.json({ 
      success: true,
      message: 'Data berhasil dihapus' 
    });
  } catch (error) {
    console.error('Error deleting data:', error);
    res.status(500).json({ 
      success: false,
      error: 'Gagal menghapus data',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Endpoint untuk mendapatkan kategori unik
app.get('/api/categories', async (req, res) => {
  try {
    const categories = await prisma.spatialData.findMany({
      select: { kategori: true },
      distinct: ['kategori'],
      orderBy: { kategori: 'asc' }
    });

    res.json({ 
      success: true,
      categories: categories.map(cat => cat.kategori) 
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ 
      success: false,
      error: 'Gagal mengambil kategori',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Endpoint untuk statistik data
app.get('/api/stats', async (req, res) => {
  try {
    const totalData = await prisma.spatialData.count();
    const pointCount = await prisma.spatialData.count({ where: { tipe_geom: 'point' } });
    const lineCount = await prisma.spatialData.count({ where: { tipe_geom: 'line' } });
    const polygonCount = await prisma.spatialData.count({ where: { tipe_geom: 'polygon' } });
    
    const categoriesCount = await prisma.spatialData.groupBy({
      by: ['kategori'],
      _count: { kategori: true },
      orderBy: { _count: { kategori: 'desc' } }
    });

    res.json({
      success: true,
      stats: {
        total: totalData,
        byType: {
          point: pointCount,
          line: lineCount,
          polygon: polygonCount
        },
        byCategory: categoriesCount.map(item => ({
          kategori: item.kategori,
          count: item._count.kategori
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ 
      success: false,
      error: 'Gagal mengambil statistik',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint tidak ditemukan'
  });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nShutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`🚀 Server berjalan di http://localhost:${PORT}`);
  console.log(`📚 Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}`);
  console.log(`👤 Author: ${process.env.AUTHOR_NAME} (${process.env.AUTHOR_NIM})`);
});
