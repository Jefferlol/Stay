// ============================================================
// 🌹 Stay - Secure Express Server
// ============================================================
// Security: timing-safe auth, rate limiting, magic byte validation,
//   file size limits, sanitized filenames, security headers,
//   path traversal prevention, dotfiles denied
// ============================================================

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// CONFIGURATION
// ==========================================

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'StaceyAdmin2026!';

const sessions = new Map();
const SESSION_DURATION = 2 * 60 * 60 * 1000; // 2 hours

const loginAttempts = new Map();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;

// Allowed image types with magic byte signatures
const ALLOWED_IMAGE_TYPES = {
    'image/jpeg': { ext: '.jpg', magic: [0xFF, 0xD8, 0xFF] },
    'image/png':  { ext: '.png', magic: [0x89, 0x50, 0x4E, 0x47] },
    'image/webp': { ext: '.webp', magic: [0x52, 0x49, 0x46, 0x46] }
};

// Allowed audio types (no magic byte check — varied headers)
const ALLOWED_AUDIO_TYPES = {
    'audio/mpeg':    { ext: '.mp3' },
    'audio/mp3':     { ext: '.mp3' },
    'audio/mp4':     { ext: '.m4a' },
    'audio/x-m4a':   { ext: '.m4a' },
    'audio/aac':     { ext: '.aac' },
    'audio/ogg':     { ext: '.ogg' },
    'audio/wav':     { ext: '.wav' },
    'audio/x-wav':   { ext: '.wav' },
    'audio/webm':    { ext: '.webm' },
    'audio/flac':    { ext: '.flac' }
};

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB (audio can be large)

const DATA_DIR = path.join(__dirname, 'data');
const PAIRS_FILE = path.join(DATA_DIR, 'pairs.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(PAIRS_FILE)) fs.writeFileSync(PAIRS_FILE, '[]', 'utf8');

// ==========================================
// MIDDLEWARE
// ==========================================

app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
});

app.use(express.json({ limit: '1mb' }));

// ==========================================
// HELPERS
// ==========================================

function safeCompare(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) {
        crypto.timingSafeEqual(bufA, Buffer.alloc(bufA.length));
        return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
}

function isRateLimited(ip) {
    const now = Date.now();
    const attempts = loginAttempts.get(ip) || [];
    const recent = attempts.filter(t => now - t < RATE_LIMIT_WINDOW);
    loginAttempts.set(ip, recent);
    return recent.length >= MAX_LOGIN_ATTEMPTS;
}

function recordAttempt(ip) {
    const attempts = loginAttempts.get(ip) || [];
    attempts.push(Date.now());
    loginAttempts.set(ip, attempts);
}

function requireAuth(req, res, next) {
    const h = req.headers['authorization'];
    const token = h && h.startsWith('Bearer ') ? h.slice(7) : null;
    if (!token || !sessions.has(token)) {
        return res.status(401).json({ error: 'No autorizado' });
    }
    if (Date.now() > sessions.get(token).expiresAt) {
        sessions.delete(token);
        return res.status(401).json({ error: 'Sesión expirada' });
    }
    next();
}

function validateMagicBytes(filePath, expectedMagic) {
    try {
        const fd = fs.openSync(filePath, 'r');
        const buf = Buffer.alloc(expectedMagic.length);
        fs.readSync(fd, buf, 0, expectedMagic.length, 0);
        fs.closeSync(fd);
        return expectedMagic.every((b, i) => buf[i] === b);
    } catch { return false; }
}

function sanitizeText(text) {
    if (typeof text !== 'string') return '';
    return text
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#x27;')
        .trim().substring(0, 200);
}

function loadPairs() {
    try { return JSON.parse(fs.readFileSync(PAIRS_FILE, 'utf8')); }
    catch { return []; }
}

function savePairs(pairs) {
    fs.writeFileSync(PAIRS_FILE, JSON.stringify(pairs, null, 2), 'utf8');
}

/** Only delete files that were uploaded via admin (not originals) */
function isUploadedFile(filePath) {
    return path.basename(filePath).startsWith('upload_');
}

function safeDeleteFile(filePath) {
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(path.resolve(__dirname))) return;
    try { if (fs.existsSync(resolved)) fs.unlinkSync(resolved); } catch {}
}

function safeDeleteUploadedFile(relativePath) {
    if (!relativePath || !isUploadedFile(relativePath)) return;
    safeDeleteFile(path.join(__dirname, relativePath));
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ==========================================
// MULTER
// ==========================================

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        let dir;
        if (file.fieldname === 'photo')  dir = path.join(__dirname, 'Imagenes Juntos');
        else if (file.fieldname === 'lyrics') dir = path.join(__dirname, 'Letras de canciones');
        else if (file.fieldname === 'audio')  dir = path.join(__dirname, 'Pistas de Canciones');
        else return cb(new Error('Campo no válido'));
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const ts = Date.now();
        const rand = crypto.randomBytes(8).toString('hex');
        const ext = file.fieldname === 'audio'
            ? (ALLOWED_AUDIO_TYPES[file.mimetype]?.ext || '.mp3')
            : (ALLOWED_IMAGE_TYPES[file.mimetype]?.ext || '.jpg');
        cb(null, `upload_${ts}_${rand}${ext}`);
    }
});

const fileFilter = (req, file, cb) => {
    if (file.fieldname === 'photo' || file.fieldname === 'lyrics') {
        if (!ALLOWED_IMAGE_TYPES[file.mimetype]) {
            return cb(new Error('Tipo no permitido para imagen. Solo JPG, PNG y WebP.'), false);
        }
    } else if (file.fieldname === 'audio') {
        if (!ALLOWED_AUDIO_TYPES[file.mimetype]) {
            return cb(new Error('Tipo no permitido para audio. Solo MP3, M4A, OGG, WAV, etc.'), false);
        }
    } else {
        return cb(new Error('Campo de archivo no válido'), false);
    }
    cb(null, true);
};

const upload = multer({ storage, fileFilter, limits: { fileSize: MAX_FILE_SIZE, files: 3 } });

const uploadFields = upload.fields([
    { name: 'photo', maxCount: 1 },
    { name: 'lyrics', maxCount: 1 },
    { name: 'audio', maxCount: 1 }
]);

// Wrapper to handle multer errors consistently
function handleUpload(req, res) {
    return new Promise((resolve, reject) => {
        uploadFields(req, res, (err) => {
            if (err) {
                if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
                    return reject({ status: 400, error: 'Archivo muy grande. Máximo 50 MB.' });
                }
                return reject({ status: 400, error: err.message });
            }
            resolve();
        });
    });
}

// ==========================================
// ROUTES
// ==========================================

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// --- Auth ---

app.post('/api/login', (req, res) => {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    if (isRateLimited(ip)) {
        return res.status(429).json({ error: 'Demasiados intentos. Espera 15 minutos.' });
    }
    const { password } = req.body;
    if (!password || !safeCompare(password, ADMIN_PASSWORD)) {
        recordAttempt(ip);
        return res.status(401).json({ error: 'Contraseña incorrecta' });
    }
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, { createdAt: Date.now(), expiresAt: Date.now() + SESSION_DURATION });
    res.json({ token, expiresIn: SESSION_DURATION });
});

app.post('/api/logout', requireAuth, (req, res) => {
    sessions.delete(req.headers['authorization']?.slice(7));
    res.json({ message: 'Sesión cerrada' });
});

// --- Pairs CRUD ---

app.get('/api/pairs', (req, res) => {
    res.json(loadPairs());
});

// CREATE
app.post('/api/pairs', requireAuth, async (req, res) => {
    try {
        await handleUpload(req, res);
    } catch (e) {
        return res.status(e.status || 400).json({ error: e.error });
    }

    const photoFile  = req.files?.photo?.[0];
    const lyricsFile = req.files?.lyrics?.[0];
    const audioFile  = req.files?.audio?.[0];

    if (!photoFile || !lyricsFile) {
        if (photoFile) safeDeleteFile(photoFile.path);
        if (lyricsFile) safeDeleteFile(lyricsFile.path);
        if (audioFile) safeDeleteFile(audioFile.path);
        return res.status(400).json({ error: 'Se requieren la foto y la letra.' });
    }

    // Validate image magic bytes
    for (const f of [photoFile, lyricsFile]) {
        const info = ALLOWED_IMAGE_TYPES[f.mimetype];
        if (!validateMagicBytes(f.path, info.magic)) {
            safeDeleteFile(photoFile.path);
            safeDeleteFile(lyricsFile.path);
            if (audioFile) safeDeleteFile(audioFile.path);
            return res.status(400).json({ error: `${f.fieldname} no es una imagen válida.` });
        }
    }

    const pair = {
        id: crypto.randomUUID(),
        photoPath: `Imagenes Juntos/${photoFile.filename}`,
        lyricsPath: `Letras de canciones/${lyricsFile.filename}`,
        songPath: audioFile ? `Pistas de Canciones/${audioFile.filename}` : null,
        songTitle: sanitizeText(req.body.songTitle || 'Sin título'),
        createdAt: new Date().toISOString()
    };

    const pairs = loadPairs();
    pairs.push(pair);
    savePairs(pairs);
    res.status(201).json(pair);
});

// UPDATE
app.put('/api/pairs/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    if (!UUID_RE.test(id)) return res.status(400).json({ error: 'ID inválido' });

    const pairs = loadPairs();
    const idx = pairs.findIndex(p => p.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Par no encontrado' });

    try {
        await handleUpload(req, res);
    } catch (e) {
        return res.status(e.status || 400).json({ error: e.error });
    }

    const pair = pairs[idx];
    const photoFile  = req.files?.photo?.[0];
    const lyricsFile = req.files?.lyrics?.[0];
    const audioFile  = req.files?.audio?.[0];

    // Validate image magic bytes for new images
    if (photoFile) {
        const info = ALLOWED_IMAGE_TYPES[photoFile.mimetype];
        if (!validateMagicBytes(photoFile.path, info.magic)) {
            safeDeleteFile(photoFile.path);
            if (lyricsFile) safeDeleteFile(lyricsFile.path);
            if (audioFile) safeDeleteFile(audioFile.path);
            return res.status(400).json({ error: 'La foto no es una imagen válida.' });
        }
    }
    if (lyricsFile) {
        const info = ALLOWED_IMAGE_TYPES[lyricsFile.mimetype];
        if (!validateMagicBytes(lyricsFile.path, info.magic)) {
            if (photoFile) safeDeleteFile(photoFile.path);
            safeDeleteFile(lyricsFile.path);
            if (audioFile) safeDeleteFile(audioFile.path);
            return res.status(400).json({ error: 'La letra no es una imagen válida.' });
        }
    }

    // Update fields — only replace files that were re-uploaded
    if (photoFile) {
        safeDeleteUploadedFile(pair.photoPath); // only deletes if it was an upload
        pair.photoPath = `Imagenes Juntos/${photoFile.filename}`;
    }
    if (lyricsFile) {
        safeDeleteUploadedFile(pair.lyricsPath);
        pair.lyricsPath = `Letras de canciones/${lyricsFile.filename}`;
    }
    if (audioFile) {
        safeDeleteUploadedFile(pair.songPath);
        pair.songPath = `Pistas de Canciones/${audioFile.filename}`;
    }

    if (req.body.songTitle !== undefined) {
        pair.songTitle = sanitizeText(req.body.songTitle);
    }

    pairs[idx] = pair;
    savePairs(pairs);
    res.json(pair);
});

// DELETE
app.delete('/api/pairs/:id', requireAuth, (req, res) => {
    const { id } = req.params;
    if (!UUID_RE.test(id)) return res.status(400).json({ error: 'ID inválido' });

    const pairs = loadPairs();
    const idx = pairs.findIndex(p => p.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Par no encontrado' });

    const pair = pairs[idx];

    // Only delete uploaded files — protect originals
    safeDeleteUploadedFile(pair.photoPath);
    safeDeleteUploadedFile(pair.lyricsPath);
    safeDeleteUploadedFile(pair.songPath);

    pairs.splice(idx, 1);
    savePairs(pairs);
    res.json({ message: 'Par eliminado correctamente' });
});

// ==========================================
// STATIC FILES
// ==========================================

app.use(express.static(__dirname, { dotfiles: 'deny', index: 'index.html' }));

// ==========================================
// CLEANUP
// ==========================================

setInterval(() => {
    const now = Date.now();
    for (const [token, session] of sessions) {
        if (now > session.expiresAt) sessions.delete(token);
    }
}, 30 * 60 * 1000);

// ==========================================
// START
// ==========================================

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌹 Stay server running on port ${PORT}`);
    console.log(`📱 Admin panel: http://localhost:${PORT}/admin`);
    console.log(`🔒 Set ADMIN_PASSWORD env var to change the default password`);
});
