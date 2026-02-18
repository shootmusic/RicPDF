// RiCPDF - Main Application
class RiCPDF {
    constructor() {
        this.video = document.getElementById('camera');
        this.canvas = document.getElementById('canvas');
        this.preview = document.getElementById('preview');
        this.capturedImage = document.getElementById('capturedImage');
        this.modal = document.getElementById('cameraModal');
        this.result = document.getElementById('result');
        this.ocrText = document.getElementById('ocrText');
        this.fileList = document.getElementById('fileList');
        this.currentImage = null;
        this.documents = JSON.parse(localStorage.getItem('ricpdf_docs') || '[]');
        
        this.initEventListeners();
        this.loadDocuments();
    }

    initEventListeners() {
        document.getElementById('scanBtn').addEventListener('click', () => this.openCamera());
        document.getElementById('captureBtn').addEventListener('click', () => this.captureImage());
        document.getElementById('closeModal').addEventListener('click', () => this.closeCamera());
        document.getElementById('cropBtn').addEventListener('click', () => this.cropImage());
        document.getElementById('enhanceBtn').addEventListener('click', () => this.enhanceImage());
        document.getElementById('ocrBtn').addEventListener('click', () => this.doOCR());
        document.getElementById('pdfBtn').addEventListener('click', () => this.createPDF());
        document.getElementById('copyText').addEventListener('click', () => this.copyText());
    }

    async openCamera() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'environment' } 
            });
            this.video.srcObject = stream;
            this.modal.classList.remove('hidden');
        } catch (err) {
            alert('Gagal akses kamera: ' + err.message);
        }
    }

    closeCamera() {
        const stream = this.video.srcObject;
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        this.modal.classList.add('hidden');
    }

    captureImage() {
        const context = this.canvas.getContext('2d');
        this.canvas.width = this.video.videoWidth;
        this.canvas.height = this.video.videoHeight;
        context.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
        
        this.currentImage = this.canvas.toDataURL('image/jpeg', 0.9);
        this.capturedImage.src = this.currentImage;
        this.preview.classList.remove('hidden');
        this.closeCamera();
    }

    cropImage() {
        alert('Fitur crop akan segera hadir!');
        // Implementasi crop bisa pake Cropper.js
    }

    enhanceImage() {
        alert('Fitur enhance akan segera hadir!');
        // Implementasi enhance pake OpenCV.js atau Canvas filter
    }

    async doOCR() {
        if (!this.currentImage) {
            alert('Scan dokumen dulu bos!');
            return;
        }

        this.ocrText.value = 'Processing OCR...';
        
        try {
            const { data: { text } } = await Tesseract.recognize(
                this.currentImage,
                'ind',
                { logger: m => console.log(m) }
            );
            
            this.ocrText.value = text;
            this.result.classList.remove('hidden');
        } catch (err) {
            alert('OCR gagal: ' + err.message);
        }
    }

    async createPDF() {
        if (!this.currentImage) {
            alert('Scan dokumen dulu bos!');
            return;
        }

        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF();
        
        const img = new Image();
        img.src = this.currentImage;
        
        await new Promise(resolve => {
            img.onload = () => {
                const imgWidth = pdf.internal.pageSize.getWidth();
                const imgHeight = (img.height * imgWidth) / img.width;
                
                pdf.addImage(img, 'JPEG', 0, 0, imgWidth, imgHeight);
                resolve();
            };
        });

        const pdfBlob = pdf.output('blob');
        const pdfUrl = URL.createObjectURL(pdfBlob);
        
        // Simpan ke localStorage
        const doc = {
            id: Date.now(),
            name: `Dokumen_${new Date().toLocaleDateString().replace(/\//g, '-')}.pdf`,
            url: pdfUrl,
            date: new Date().toISOString()
        };
        
        this.documents.push(doc);
        localStorage.setItem('ricpdf_docs', JSON.stringify(this.documents));
        
        // Download PDF
        const link = document.createElement('a');
        link.href = pdfUrl;
        link.download = doc.name;
        link.click();
        
        this.loadDocuments();
    }

    copyText() {
        this.ocrText.select();
        document.execCommand('copy');
        alert('Teks berhasil dicopy!');
    }

    loadDocuments() {
        this.fileList.innerHTML = '';
        this.documents.slice().reverse().forEach(doc => {
            const div = document.createElement('div');
            div.className = 'file-item';
            div.innerHTML = `
                <strong>${doc.name}</strong><br>
                <small>${new Date(doc.date).toLocaleString()}</small>
            `;
            div.onclick = () => window.open(doc.url);
            this.fileList.appendChild(div);
        });
    }
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    new RiCPDF();
});
