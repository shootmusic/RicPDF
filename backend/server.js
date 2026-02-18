const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const { createWorker } = require('tesseract.js');
const sharp = require('sharp');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

// Konfigurasi multer untuk upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = './uploads';
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir);
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Route: Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'RiCPDF Backend is running 🔥',
        timestamp: new Date().toISOString()
    });
});

// Route: Upload gambar
app.post('/api/upload', upload.single('image'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        res.json({
            success: true,
            file: {
                filename: req.file.filename,
                path: req.file.path,
                size: req.file.size
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Route: OCR processing
app.post('/api/ocr', async (req, res) => {
    try {
        const { image } = req.body;
        
        if (!image) {
            return res.status(400).json({ error: 'No image provided' });
        }

        // Decode base64 image
        const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        
        // Simpan sementara
        const tempPath = `./temp_${Date.now()}.jpg`;
        fs.writeFileSync(tempPath, buffer);

        // Proses OCR
        const worker = await createWorker('ind');
        const { data: { text } } = await worker.recognize(tempPath);
        await worker.terminate();

        // Hapus file sementara
        fs.unlinkSync(tempPath);

        res.json({
            success: true,
            text: text,
            confidence: 'high'
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Route: Generate PDF
app.post('/api/pdf', async (req, res) => {
    try {
        const { images, options = {} } = req.body;
        
        if (!images || !images.length) {
            return res.status(400).json({ error: 'No images provided' });
        }

        // Buat PDF
        const doc = new PDFDocument({
            size: options.size || 'A4',
            layout: options.layout || 'portrait',
            margin: options.margin || 50
        });

        // Set response headers
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=document.pdf');

        // Pipe PDF ke response
        doc.pipe(res);

        // Proses setiap gambar
        for (let i = 0; i < images.length; i++) {
            const imageData = images[i].replace(/^data:image\/\w+;base64,/, '');
            const buffer = Buffer.from(imageData, 'base64');

            // Optimasi gambar pake sharp
            const optimizedBuffer = await sharp(buffer)
                .resize(1200, null, { withoutEnlargement: true })
                .jpeg({ quality: 90 })
                .toBuffer();

            // Simpan sementara
            const tempPath = `./temp_img_${i}_${Date.now()}.jpg`;
            fs.writeFileSync(tempPath, optimizedBuffer);

            // Tambah ke PDF
            if (i > 0) {
                doc.addPage();
            }

            doc.image(tempPath, {
                fit: [500, 700],
                align: 'center',
                valign: 'center'
            });

            // Hapus file sementara
            fs.unlinkSync(tempPath);
        }

        doc.end();

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Route: Enhance image
app.post('/api/enhance', async (req, res) => {
    try {
        const { image } = req.body;
        
        if (!image) {
            return res.status(400).json({ error: 'No image provided' });
        }

        // Decode base64
        const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');

        // Enhance dengan sharp
        const enhanced = await sharp(buffer)
            .greyscale() // Ubah ke hitam putih
            .normalize() // Normalisasi kontras
            .sharpen() // Tajamin
            .jpeg({ quality: 95 })
            .toBuffer();

        // Convert ke base64
        const enhancedBase64 = `data:image/jpeg;base64,${enhanced.toString('base64')}`;

        res.json({
            success: true,
            image: enhancedBase64
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Route: Batch process
app.post('/api/batch', async (req, res) => {
    try {
        const { images } = req.body;
        const results = [];

        for (let i = 0; i < images.length; i++) {
            const image = images[i];
            
            // OCR
            const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');
            const tempPath = `./temp_${i}_${Date.now()}.jpg`;
            fs.writeFileSync(tempPath, buffer);

            const worker = await createWorker('ind');
            const { data: { text } } = await worker.recognize(tempPath);
            await worker.terminate();

            results.push({
                index: i,
                text: text
            });

            fs.unlinkSync(tempPath);
        }

        res.json({
            success: true,
            results: results
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Route: Serve uploaded files
app.use('/uploads', express.static('uploads'));

// Error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ 
        error: 'Something went wrong!',
        message: err.message 
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`
    ╔══════════════════════════════╗
    ║   RiCPDF Backend Running     ║
    ║   Port: ${PORT}                    ║
    ║   Mode: ${process.env.NODE_ENV || 'development'}        ║
    ╚══════════════════════════════╝
    🔥 Mr.X was here!
    `);
});
