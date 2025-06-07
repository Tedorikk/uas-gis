// [NIM] [NAMA] - UAS WebGIS 2024/2425
// Frontend JavaScript untuk Aplikasi WebGIS

// Konfigurasi peta - Sesuaikan koordinat dengan lokasi rumah/kost di Pontianak
const DEFAULT_CENTER = [-0.0263, 109.3425]; // Koordinat Pontianak
const DEFAULT_ZOOM = 13;

// Inisialisasi peta
const map = L.map('map').setView(DEFAULT_CENTER, DEFAULT_ZOOM);

// Base map OpenStreetMap
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
}).addTo(map);

// Layer untuk menyimpan data spasial
const spatialLayer = L.layerGroup().addTo(map);

// Variabel untuk mode drawing
let currentMode = 'view';
let drawingInProgress = false;
let currentPath = [];
let minPointsReached = false;
let tempPolyline = null;
let tempPolygon = null;

// Cache untuk data yang sudah dimuat
let dataCache = [];
let categoriesCache = [];

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
});

// Inisialisasi aplikasi
async function initializeApp() {
    showLoading(true);
    try {
        await Promise.all([
            loadCategories(),
            loadSpatialData(),
            loadStats()
        ]);
        showToast('Aplikasi berhasil dimuat!', 'success');
    } catch (error) {
        console.error('Error initializing app:', error);
        showToast('Gagal memuat aplikasi', 'error');
    } finally {
        showLoading(false);
    }
}

// Setup event listeners
function setupEventListeners() {
    // Form submission
    document.getElementById('spatialForm').addEventListener('submit', handleFormSubmit);
    
    // Map events
    map.on('click', handleMapClick);
    
    // Search input
    document.getElementById('searchInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            loadSpatialData();
        }
    });
    
    // Filter changes
    document.getElementById('categoryFilter').addEventListener('change', loadSpatialData);
    document.getElementById('typeFilter').addEventListener('change', loadSpatialData);
    
    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);
    
    // Prevent context menu on map when drawing
    map.getContainer().addEventListener('contextmenu', function(e) {
        if (currentMode !== 'view') {
            e.preventDefault();
        }
    });
}

// Handle keyboard shortcuts
function handleKeyboardShortcuts(e) {
    if (drawingInProgress) {
        if (e.key === 'Enter' && minPointsReached) {
            e.preventDefault();
            finishDrawing();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelDrawing();
        }
    }
    
    // Global shortcuts
    if (e.ctrlKey) {
        switch(e.key) {
            case 'f':
                e.preventDefault();
                document.getElementById('searchInput').focus();
                break;
            case 'r':
                e.preventDefault();
                loadSpatialData();
                break;
        }
    }
}

// Fungsi untuk mengatur mode drawing
function setDrawingMode(mode) {
    // Reset drawing state saat ganti mode
    if (drawingInProgress) {
        if (!confirm('Sedang dalam mode drawing. Yakin ingin mengganti mode?')) {
            return;
        }
        cancelDrawing();
    }
    
    currentMode = mode;
    drawingInProgress = false;
    currentPath = [];
    minPointsReached = false;
    
    // Clear temporary objects
    clearTemporaryLayers();
    
    // Update button states
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.remove('active', 'drawing');
    });
    
    const currentButton = document.getElementById(mode + 'Mode');
    if (currentButton) {
        currentButton.classList.add('active');
    }
    
    // Show/hide finish section
    const finishSection = document.getElementById('finishSection');
    if (mode === 'line' || mode === 'polygon') {
        finishSection.style.display = 'block';
        updateDrawingStatus();
    } else {
        finishSection.style.display = 'none';
    }
    
    // Change cursor style
    const mapContainer = document.getElementById('map');
    mapContainer.className = mode === 'view' ? '' : 'crosshair';
    
    // Show appropriate message
    if (mode !== 'view') {
        showToast(`Mode ${mode.toUpperCase()} aktif. Klik di peta untuk menambah titik.`, 'info');
    }
}

// Clear temporary layers
function clearTemporaryLayers() {
    if (tempPolyline) {
        map.removeLayer(tempPolyline);
        tempPolyline = null;
    }
    if (tempPolygon) {
        map.removeLayer(tempPolygon);
        tempPolygon = null;
    }
}

// Update drawing status
function updateDrawingStatus() {
    const statusElement = document.getElementById('drawingStatus');
    const pointCountElement = document.getElementById('pointCount');
    const finishBtn = document.getElementById('finishBtn');
    const statusContainer = document.getElementById('drawingStatusContainer');
    
    const pointCount = currentPath.length;
    pointCountElement.textContent = `Titik: ${pointCount}`;
    
    // Remove existing status classes
    statusContainer.classList.remove('status-drawing', 'status-ready');
    
    if (currentMode === 'line') {
        minPointsReached = pointCount >= 2;
        if (pointCount === 0) {
            statusElement.textContent = 'Klik di peta untuk menambah titik line';
        } else if (pointCount === 1) {
            statusElement.textContent = 'Tambahkan minimal 1 titik lagi';
            statusContainer.classList.add('status-drawing');
        } else {
            statusElement.textContent = 'Line siap disimpan!';
            statusContainer.classList.add('status-ready');
        }
    } else if (currentMode === 'polygon') {
        minPointsReached = pointCount >= 3;
        if (pointCount === 0) {
            statusElement.textContent = 'Klik di peta untuk menambah titik polygon';
        } else if (pointCount < 3) {
            statusElement.textContent = `Tambahkan ${3 - pointCount} titik lagi`;
            statusContainer.classList.add('status-drawing');
        } else {
            statusElement.textContent = 'Polygon siap disimpan!';
            statusContainer.classList.add('status-ready');
        }
    }
    
    // Enable/disable finish button
    finishBtn.disabled = !minPointsReached;
    
    // Update mode button visual
    const modeButton = document.getElementById(currentMode + 'Mode');
    if (modeButton) {
        if (drawingInProgress && pointCount > 0) {
            modeButton.classList.add('drawing');
        } else {
            modeButton.classList.remove('drawing');
        }
    }
}

// Handle map click events
function handleMapClick(e) {
    if (currentMode === 'view') return;
    
    const { lat, lng } = e.latlng;
    
    switch (currentMode) {
        case 'point':
            createPoint(lat, lng);
            break;
        case 'line':
            addLinePoint(lat, lng);
            break;
        case 'polygon':
            addPolygonPoint(lat, lng);
            break;
    }
}

// Create point
function createPoint(lat, lng) {
    const koordinat = [lng, lat]; // GeoJSON format [lng, lat]
    showFormPanel('point', koordinat, lat, lng);
}

// Add line point
function addLinePoint(lat, lng) {
    currentPath.push([lat, lng]);
    drawingInProgress = true;
    
    if (tempPolyline) {
        map.removeLayer(tempPolyline);
    }
    
    tempPolyline = L.polyline(currentPath, {
        color: '#e74c3c',
        weight: 3,
        dashArray: '10, 5',
        opacity: 0.8
    }).addTo(map);
    
    updateDrawingStatus();
    
    // Add temporary marker for last point
    const marker = L.circleMarker([lat, lng], {
        radius: 5,
        fillColor: '#e74c3c',
        color: 'white',
        weight: 2,
        fillOpacity: 0.8
    }).addTo(map);
    
    // Remove marker after a short delay
    setTimeout(() => {
        if (map.hasLayer(marker)) {
            map.removeLayer(marker);
        }
    }, 2000);
}

// Add polygon point
function addPolygonPoint(lat, lng) {
    currentPath.push([lat, lng]);
    drawingInProgress = true;
    
    // Clear existing temporary layers
    clearTemporaryLayers();
    
    if (currentPath.length >= 3) {
        tempPolygon = L.polygon(currentPath, {
            color: '#3498db',
            fillColor: '#3498db',
            fillOpacity: 0.3,
            weight: 3,
            dashArray: '10, 5',
            opacity: 0.8
        }).addTo(map);
    } else if (currentPath.length >= 2) {
        tempPolyline = L.polyline(currentPath, {
            color: '#3498db',
            weight: 3,
            dashArray: '10, 5',
            opacity: 0.8
        }).addTo(map);
    }
    
    updateDrawingStatus();
    
    // Add temporary marker for last point
    const marker = L.circleMarker([lat, lng], {
        radius: 5,
        fillColor: '#3498db',
        color: 'white',
        weight: 2,
        fillOpacity: 0.8
    }).addTo(map);
    
    // Remove marker after a short delay
    setTimeout(() => {
        if (map.hasLayer(marker)) {
            map.removeLayer(marker);
        }
    }, 2000);
}

// Finish drawing
function finishDrawing() {
    if (!minPointsReached) {
        const minPoints = currentMode === 'line' ? 2 : 3;
        showToast(`Minimal ${minPoints} titik diperlukan untuk ${currentMode}`, 'warning');
        return;
    }
    
    let koordinat;
    
    if (currentMode === 'line') {
        koordinat = currentPath.map(point => [point[1], point[0]]); // Convert to [lng, lat]
        showFormPanel('line', koordinat);
    } else if (currentMode === 'polygon') {
        // Close polygon dengan menambahkan titik pertama di akhir
        const closedPath = [...currentPath, currentPath[0]];
        koordinat = closedPath.map(point => [point[1], point[0]]); // Convert to [lng, lat]
        showFormPanel('polygon', koordinat);
    }
    
    // Update temporary layer style untuk preview
    updateTemporaryLayerStyle();
}

// Cancel drawing
function cancelDrawing() {
    if (drawingInProgress && currentPath.length > 0) {
        if (!confirm('Batal menggambar? Semua titik yang sudah ditandai akan hilang.')) {
            return;
        }
    }
    
    resetDrawingState();
    setDrawingMode('view');
    showToast('Drawing dibatalkan', 'info');
}

// Reset drawing state
function resetDrawingState() {
    drawingInProgress = false;
    currentPath = [];
    minPointsReached = false;
    
    clearTemporaryLayers();
    
    // Remove drawing class from mode button
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.remove('drawing');
    });
    
    if (document.getElementById('finishSection').style.display !== 'none') {
        updateDrawingStatus();
    }
}

// Update temporary layer style
function updateTemporaryLayerStyle() {
    const style = {
        dashArray: null,
        weight: 4,
        opacity: 1
    };
    
    if (tempPolyline) {
        tempPolyline.setStyle({
            ...style,
            color: currentMode === 'line' ? '#27ae60' : '#3498db'
        });
    }
    
    if (tempPolygon) {
        tempPolygon.setStyle({
            ...style,
            color: '#27ae60',
            fillColor: '#27ae60',
            fillOpacity: 0.4
        });
    }
}

// Show form panel
function showFormPanel(type, koordinat, lat = null, lng = null) {
    const panel = document.getElementById('formPanel');
    const title = document.getElementById('formTitle');
    const form = document.getElementById('spatialForm');
    
    panel.style.display = 'block';
    title.textContent = `Simpan Data ${type.toUpperCase()}`;
    document.getElementById('dataId').value = '';
    
    // Reset form
    form.reset();
    
    // Store geometry data
    form.dataset.tipeGeom = type;
    form.dataset.koordinat = JSON.stringify(koordinat);
    if (lat !== null && lng !== null) {
        form.dataset.latitude = lat;
        form.dataset.longitude = lng;
    }
    
    // Auto focus pada field nama
    setTimeout(() => {
        document.getElementById('nama').focus();
    }, 100);
    
    // Update temporary layer style
    updateTemporaryLayerStyle();
}

// Hide form panel
function hideFormPanel() {
    document.getElementById('formPanel').style.display = 'none';
    resetDrawingState();
    setDrawingMode('view');
}

// Handle form submission
async function handleFormSubmit(e) {
    e.preventDefault();
    showLoading(true);
    
    try {
        const form = e.target;
        const dataId = document.getElementById('dataId').value;
        const nama = document.getElementById('nama').value.trim();
        const kategori = document.getElementById('kategori').value.trim();
        const deskripsi = document.getElementById('deskripsi').value.trim();
        
        // Validasi
        if (!nama || !kategori) {
            showToast('Nama dan kategori harus diisi', 'warning');
            return;
        }
        
        const tipeGeom = form.dataset.tipeGeom;
        const koordinat = JSON.parse(form.dataset.koordinat);
        const latitude = form.dataset.latitude ? parseFloat(form.dataset.latitude) : null;
        const longitude = form.dataset.longitude ? parseFloat(form.dataset.longitude) : null;
        
        const data = {
            nama,
            kategori,
            deskripsi,
            tipe_geom: tipeGeom,
            koordinat,
            latitude,
            longitude
        };
        
        let response;
        if (dataId) {
            // Update existing data
            response = await fetch(`/api/spatial-data/${dataId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        } else {
            // Create new data
            response = await fetch('/api/spatial-data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        }
        
        const result = await response.json();
        
        if (result.success) {
            showToast(result.message, 'success');
            hideFormPanel();
            await Promise.all([
                loadSpatialData(),
                loadCategories(),
                loadStats()
            ]);
        } else {
            showToast(result.error || 'Terjadi kesalahan', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Terjadi kesalahan saat menyimpan data', 'error');
    } finally {
        showLoading(false);
    }
}

// Load spatial data
async function loadSpatialData() {
    try {
        showLoading(true);
        
        const search = document.getElementById('searchInput').value.trim();
        const kategori = document.getElementById('categoryFilter').value;
        const tipeGeom = document.getElementById('typeFilter').value;
        
        const params = new URLSearchParams();
        if (search) params.append('search', search);
        if (kategori && kategori !== 'all') params.append('kategori', kategori);
        if (tipeGeom && tipeGeom !== 'all') params.append('tipe_geom', tipeGeom);
        
        const response = await fetch(`/api/spatial-data?${params}`);
        const result = await response.json();
        
        if (result.success) {
            dataCache = result.data;
            displaySpatialData(result.data);
            
            if (result.data.length === 0) {
                showToast('Tidak ada data yang ditemukan', 'info');
            }
        } else {
            console.error('Error loading data:', result.error);
            showToast('Gagal memuat data: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Terjadi kesalahan saat memuat data', 'error');
    } finally {
        showLoading(false);
    }
}

// Display spatial data on map
function displaySpatialData(data) {
    // Clear existing layers
    spatialLayer.clearLayers();
    
    if (!data || data.length === 0) {
        return;
    }
    
    data.forEach(item => {
        try {
            let layer = createLayerFromData(item);
            
            if (layer) {
                // Add popup content
                const popupContent = createPopupContent(item);
                layer.bindPopup(popupContent, {
                    maxWidth: 300,
                    className: 'custom-popup'
                });
                
                // Add tooltip for hover
                const tooltipContent = `<strong>${item.nama}</strong><br>Kategori: ${item.kategori}`;
                layer.bindTooltip(tooltipContent, {
                    sticky: true,
                    className: 'custom-tooltip'
                });
                
                spatialLayer.addLayer(layer);
            }
        } catch (error) {
            console.error('Error creating layer for item:', item, error);
        }
    });
    
    // Fit map to data bounds if there are features
    if (spatialLayer.getLayers().length > 0) {
        try {
            const group = new L.featureGroup(spatialLayer.getLayers());
            map.fitBounds(group.getBounds(), { padding: [20, 20] });
        } catch (error) {
            console.error('Error fitting bounds:', error);
        }
    }
}

// Create layer from data
function createLayerFromData(item) {
    const koordinat = item.koordinat;
    const colors = {
        point: '#e74c3c',
        line: '#3498db', 
        polygon: '#27ae60'
    };
    
    switch (item.tipe_geom) {
        case 'point':
            if (item.latitude && item.longitude) {
                return L.marker([item.latitude, item.longitude], {
                    icon: L.divIcon({
                        className: 'custom-marker',
                        html: `<div style="background-color: ${colors.point}; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
                        iconSize: [20, 20],
                        iconAnchor: [10, 10]
                    })
                });
            }
            break;
            
        case 'line':
            if (Array.isArray(koordinat) && koordinat.length >= 2) {
                const latlngs = koordinat.map(coord => [coord[1], coord[0]]);
                return L.polyline(latlngs, {
                    color: colors.line,
                    weight: 4,
                    opacity: 0.8
                });
            }
            break;
            
        case 'polygon':
            if (Array.isArray(koordinat) && koordinat.length >= 3) {
                const latlngs = koordinat.map(coord => [coord[1], coord[0]]);
                return L.polygon(latlngs, {
                    color: colors.polygon,
                    fillColor: colors.polygon,
                    fillOpacity: 0.3,
                    weight: 3,
                    opacity: 0.8
                });
            }
            break;
    }
    
    return null;
}

// Create popup content
function createPopupContent(item) {
    const createdAt = new Date(item.createdAt).toLocaleDateString('id-ID');
    const updatedAt = new Date(item.updatedAt).toLocaleDateString('id-ID');
    
    return `
        <div style="min-width: 200px;">
            <h4 style="margin: 0 0 10px 0; color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 5px;">
                ${item.nama}
            </h4>
            <p style="margin: 5px 0;"><strong>Kategori:</strong> ${item.kategori}</p>
            <p style="margin: 5px 0;"><strong>Tipe:</strong> ${item.tipe_geom.toUpperCase()}</p>
            ${item.deskripsi ? `<p style="margin: 5px 0;"><strong>Deskripsi:</strong> ${item.deskripsi}</p>` : ''}
            <p style="margin: 5px 0; font-size: 0.8em; color: #666;">
                <strong>Dibuat:</strong> ${createdAt}
            </p>
            ${createdAt !== updatedAt ? `<p style="margin: 5px 0; font-size: 0.8em; color: #666;">
                <strong>Diperbarui:</strong> ${updatedAt}
            </p>` : ''}
            <div class="popup-buttons" style="margin-top: 10px;">
                <button class="edit-btn" onclick="editData(${item.id})" style="flex: 1; padding: 8px; border: none; border-radius: 4px; background: #f39c12; color: white; cursor: pointer; margin-right: 5px;">
                    ✏️ Edit
                </button>
                <button class="delete-btn" onclick="deleteData(${item.id})" style="flex: 1; padding: 8px; border: none; border-radius: 4px; background: #e74c3c; color: white; cursor: pointer;">
                    🗑️ Hapus
                </button>
            </div>
        </div>
    `;
}

// Edit data function
async function editData(id) {
    try {
        showLoading(true);
        
        const response = await fetch(`/api/spatial-data/${id}`);
        const result = await response.json();
        
        if (result.success) {
            const data = result.data;
            
            // Show form panel
            const panel = document.getElementById('formPanel');
            const title = document.getElementById('formTitle');
            
            panel.style.display = 'block';
            title.textContent = 'Edit Data';
            
            // Fill form with existing data
            document.getElementById('dataId').value = data.id;
            document.getElementById('nama').value = data.nama;
            document.getElementById('kategori').value = data.kategori;
            document.getElementById('deskripsi').value = data.deskripsi || '';
            
            // Set form data
            const form = document.getElementById('spatialForm');
            form.dataset.tipeGeom = data.tipe_geom;
            form.dataset.koordinat = JSON.stringify(data.koordinat);
            if (data.latitude && data.longitude) {
                form.dataset.latitude = data.latitude;
                form.dataset.longitude = data.longitude;
            }
            
            // Focus on nama field
            setTimeout(() => {
                document.getElementById('nama').focus();
            }, 100);
            
        } else {
            showToast('Error: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Terjadi kesalahan saat mengambil data', 'error');
    } finally {
        showLoading(false);
    }
}

// Delete data function
async function deleteData(id) {
    // Find data name for confirmation
    const item = dataCache.find(d => d.id === id);
    const namaData = item ? item.nama : 'data ini';
    
    if (!confirm(`Apakah yakin menghapus "${namaData}"?\n\nTindakan ini tidak dapat dibatalkan.`)) {
        return;
    }
    
    try {
        showLoading(true);
        
        const response = await fetch(`/api/spatial-data/${id}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast(result.message, 'success');
            await Promise.all([
                loadSpatialData(),
                loadCategories(),
                loadStats()
            ]);
        } else {
            showToast('Error: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Terjadi kesalahan saat menghapus data', 'error');
    } finally {
        showLoading(false);
    }
}

// Load categories for filter
async function loadCategories() {
    try {
        const response = await fetch('/api/categories');
        const result = await response.json();
        
        if (result.success) {
            categoriesCache = result.categories;
            const select = document.getElementById('categoryFilter');
            const currentValue = select.value;
            
            // Keep "Semua Kategori" option
            select.innerHTML = '<option value="all">📋 Semua Kategori</option>';
            
            result.categories.forEach(category => {
                const option = document.createElement('option');
                option.value = category;
                option.textContent = category;
                select.appendChild(option);
            });
            
            // Restore selected value
            select.value = currentValue;
        }
    } catch (error) {
        console.error('Error loading categories:', error);
    }
}

// Load statistics
async function loadStats() {
    try {
        const response = await fetch('/api/stats');
        const result = await response.json();
        
        if (result.success) {
            const stats = result.stats;
            document.getElementById('totalData').textContent = stats.total;
            document.getElementById('pointData').textContent = stats.byType.point;
            document.getElementById('lineData').textContent = stats.byType.line;
            document.getElementById('polygonData').textContent = stats.byType.polygon;
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Utility functions

// Show loading overlay
function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    overlay.style.display = show ? 'flex' : 'none';
}

// Show toast notification
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const icon = document.getElementById('toastIcon');
    const messageEl = document.getElementById('toastMessage');
    
    // Set icon based on type
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };
    
    icon.textContent = icons[type] || icons.info;
    messageEl.textContent = message;
    
    // Set class for styling
    toast.className = `toast ${type}`;
    toast.style.display = 'block';
    
    // Auto hide after 3 seconds
    setTimeout(() => {
        toast.style.display = 'none';
    }, 3000);
}

// Reset map view
function resetMapView() {
    map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    showToast('View peta direset', 'info');
}

// Toggle fullscreen
function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.error('Error attempting to enable fullscreen:', err);
        });
    } else {
        document.exitFullscreen();
    }
}

// Handle fullscreen change
document.addEventListener('fullscreenchange', () => {
    // Refresh map size when entering/exiting fullscreen
    setTimeout(() => {
        map.invalidateSize();
    }, 100);
});

// Auto-refresh data every 5 minutes
setInterval(() => {
    if (currentMode === 'view' && !drawingInProgress) {
        loadSpatialData();
        loadStats();
    }
}, 5 * 60 * 1000);


// anggota keluarga menu

function bukaModalAnggota() {
  document.getElementById('anggotaModal').style.display = 'block';
  document.getElementById('anggotaFrame').src = '/anggota/index.php';
}
function tutupModalAnggota() {
  document.getElementById('anggotaModal').style.display = 'none';
  document.getElementById('anggotaFrame').src = '';
}

// tambah baris untuk anggota keluarga
let anggotaIndex = 1;

function tambahAnggota() {
  const tbody = document.getElementById("anggotaTbody");

  const row = document.createElement("tr");
  row.innerHTML = `
    <td>${anggotaIndex++}</td>
    <td><input type="text" class="form-control" name="no_kk"></td>
    <td><input type="text" class="form-control" name="nama"></td>
    <td><input type="text" class="form-control" name="nik"></td>
    <td>
      <select class="form-select" name="jk">
        <option value="">Pilih</option>
        <option value="L">L</option>
        <option value="P">P</option>
      </select>
    </td>
    <td><input type="text" class="form-control" name="tempat_lahir"></td>
    <td><input type="date" class="form-control" name="tgl_lahir"></td>

    <td>
        <select name="Agama">
            <option value="Islam">Islam</option>
            <option value="Katolik">Katolik</option>
            <option value="Kristen_Protestan">Kristen Protestan</option>
            <option value="Buddha">Buddha</option>
            <option value="KongHuChu">Kong Hu Chu</option>
            <option value="Hindu">Hindu</option>
        </select>
    </td>

    <td>
        <select name="Status">
            <option value="kawin">Kawin</option>
            <option value="belum_kawin">Belum Kawin</option>
            <option value="cerai_hidup">Cerai Hidup</option>
            <option value="cerai_mati">Cerai Mati</option>
        </select>
    </td>
    <td>
        <select name="Hubungan">
            <option value="ayah">Ayah</option>
            <option value="ibu">Ibu</option>
            <option value="anak">Anak</option>
        </select>
    </td>
    <td><input type="text" class="form-control" name="pendidikan"></td>
    <td><input type="text" class="form-control" name="pekerjaan"></td>
    <td><button class="btn btn-primary btn-sm" onclick="simpanBarisIni(this)">💾</button></td>
  `;

  tbody.appendChild(row);
}

function simpanBarisIni(button) {
  const row = button.closest("tr");
  const inputs = row.querySelectorAll("input, select");

  const data = {};
  inputs.forEach((input) => {
    data[input.name] = input.value;
  });

  console.log("Data disimpan:", data);

  fetch('http://localhost/anggota/save_anggota.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  .then(res => res.json())
  .then(response => {
    if (response.status === 'success') {
      alert('Data berhasil disimpan!');
      // Set input jadi readonly & disabled setelah berhasil simpan
      inputs.forEach((input) => {
        input.setAttribute("readonly", true);
        input.setAttribute("disabled", true);
      });
      button.disabled = true;
    } else {
      alert('Gagal simpan: ' + response.message);
    }
  })
  .catch(err => {
    console.error('Error:', err);
    alert('Terjadi kesalahan saat menyimpan data.');
  });
}


function loadDataAnggota() {
  fetch('http://localhost/anggota/anggota_api.php')
    .then(res => res.json())
    .then(data => {
      const tbody = document.getElementById('anggotaTbody');
      tbody.innerHTML = '';
      data.forEach((item, index) => {
        const row = `
          <tr>
            <td>${index + 1}</td>
            <td>${item.no_kk}</td>
            <td>${item.nama}</td>
            <td>${item.NIK}</td>
            <td>${item.jenis_kelamin}</td>
            <td>${item.tempat_lahir}</td>
            <td>${item.tgl_lahir}</td>
            <td>${item.agama}</td>
            <td>${item.status}</td>
            <td>${item.hubungan}</td>
            <td>${item.pendidikan}</td>
            <td>${item.pekerjaan}</td>
            <td>
              <button onclick="editAnggota(${item.id})">Edit</button>
              <button onclick="hapusAnggota(${item.id})">Hapus</button>
            </td>
          </tr>
        `;
        tbody.insertAdjacentHTML('beforeend', row);
      });
    });
}

function editAnggota(id) {
  fetch('http://localhost/anggota/anggota_api.php?id=' + id)
    .then(res => res.json())
    .then(data => {
      const namaBaru = prompt("Edit Nama:", data.nama);
      const nikBaru = prompt("Edit NIK:", data.NIK);

      if (namaBaru === null || nikBaru === null) return; // Cancel

      const formData = new FormData();
      formData.append('id', id);
      formData.append('nama', namaBaru);
      formData.append('NIK', nikBaru);
      formData.append('_method', 'PUT'); // untuk simulasi PUT jika diperlukan

      fetch('http://localhost/anggota/anggota_api.php', {
        method: 'POST',
        body: formData
      })
      .then(res => res.text())
      .then(() => loadDataAnggota());
    });
}

function hapusAnggota(id) {
  if (!confirm('Yakin hapus data ini?')) return;
  fetch('http://localhost/anggota/anggota_api.php?delete=' + id, { method: 'GET' })
    .then(res => res.text())
    .then(() => loadDataAnggota());
}


// Console info
console.log('WebGIS UAS 2024/2025 - Aplikasi berhasil dimuat');
console.log('Keyboard shortcuts:');
console.log('- Ctrl+F: Focus search');
console.log('- Ctrl+R: Refresh data');
console.log('- Enter: Finish drawing (saat drawing)');
console.log('- Escape: Cancel drawing (saat drawing)');
