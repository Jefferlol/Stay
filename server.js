// ============================================================
// 🌹 Stay - Secure Express Server (Full Feature)
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
const SESSION_DURATION = 2 * 60 * 60 * 1000;
const loginAttempts = new Map();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;

const ALLOWED_IMAGE_TYPES = {
    'image/jpeg': { ext: '.jpg', magic: [0xFF, 0xD8, 0xFF] },
    'image/png':  { ext: '.png', magic: [0x89, 0x50, 0x4E, 0x47] },
    'image/webp': { ext: '.webp', magic: [0x52, 0x49, 0x46, 0x46] }
};

const ALLOWED_VIDEO_TYPES = {
    'video/mp4':       { ext: '.mp4' },
    'video/webm':      { ext: '.webm' },
    'video/quicktime': { ext: '.mov' }
};

const ALLOWED_AUDIO_TYPES = {
    'audio/mpeg':  { ext: '.mp3' },
    'audio/mp3':   { ext: '.mp3' },
    'audio/mp4':   { ext: '.m4a' },
    'audio/x-m4a': { ext: '.m4a' },
    'audio/aac':   { ext: '.aac' },
    'audio/ogg':   { ext: '.ogg' },
    'audio/wav':   { ext: '.wav' },
    'audio/x-wav': { ext: '.wav' },
    'audio/webm':  { ext: '.webm' },
    'audio/flac':  { ext: '.flac' }
};

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB for videos

const DATA_DIR = path.join(__dirname, 'data');
const PAIRS_FILE   = path.join(DATA_DIR, 'pairs.json');
const LETTERS_FILE = path.join(DATA_DIR, 'letters.json');
const PLACES_FILE  = path.join(DATA_DIR, 'places.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

// Ensure data files exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
[PAIRS_FILE, LETTERS_FILE, PLACES_FILE].forEach(f => {
    if (!fs.existsSync(f)) fs.writeFileSync(f, '[]', 'utf8');
});
if (!fs.existsSync(SETTINGS_FILE)) {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify({
        coupleStatus: false,
        anniversaryDate: null,
        birthdayStacey: "08-15",
        birthdayMe: "03-20",
        backgroundMusic: "Song2.m4a",
        finalMessageTitle: "Te quiero, <span class='accent'>Stacey</span>",
        finalMessageText: "Cada momento contigo es un tesoro que guardo en mi corazón.",
        secretWord: "teamo"
    }, null, 2), 'utf8');
}

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
    if (!token || !sessions.has(token)) return res.status(401).json({ error: 'No autorizado' });
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
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#x27;').trim().substring(0, 500);
}

function loadJSON(file) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return file === SETTINGS_FILE ? {} : []; }
}
function saveJSON(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

function isUploadedFile(filePath) { return path.basename(filePath).startsWith('upload_'); }

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
        if (file.fieldname === 'photo')       dir = path.join(__dirname, 'Imagenes Juntos');
        else if (file.fieldname === 'lyrics')  dir = path.join(__dirname, 'Letras de canciones');
        else if (file.fieldname === 'audio' || file.fieldname === 'bgmusic')
            dir = path.join(__dirname, 'Pistas de Canciones');
        else if (file.fieldname === 'placePhoto') dir = path.join(__dirname, 'Imagenes Juntos');
        else return cb(new Error('Campo no válido'));
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const ts = Date.now();
        const rand = crypto.randomBytes(8).toString('hex');
        let ext;
        if (file.fieldname === 'audio' || file.fieldname === 'bgmusic') {
            ext = ALLOWED_AUDIO_TYPES[file.mimetype]?.ext || '.mp3';
        } else if (file.fieldname === 'photo' || file.fieldname === 'placePhoto') {
            ext = ALLOWED_IMAGE_TYPES[file.mimetype]?.ext || ALLOWED_VIDEO_TYPES[file.mimetype]?.ext || '.jpg';
        } else {
            ext = ALLOWED_IMAGE_TYPES[file.mimetype]?.ext || '.jpg';
        }
        cb(null, `upload_${ts}_${rand}${ext}`);
    }
});

const fileFilter = (req, file, cb) => {
    if (file.fieldname === 'photo' || file.fieldname === 'placePhoto') {
        // Accept images AND videos for photo field
        if (!ALLOWED_IMAGE_TYPES[file.mimetype] && !ALLOWED_VIDEO_TYPES[file.mimetype]) {
            return cb(new Error('Solo JPG, PNG, WebP, MP4, WebM o MOV.'), false);
        }
    } else if (file.fieldname === 'lyrics') {
        if (!ALLOWED_IMAGE_TYPES[file.mimetype]) {
            return cb(new Error('Solo JPG, PNG y WebP para letras.'), false);
        }
    } else if (file.fieldname === 'audio' || file.fieldname === 'bgmusic') {
        if (!ALLOWED_AUDIO_TYPES[file.mimetype]) {
            return cb(new Error('Solo MP3, M4A, OGG, WAV para audio.'), false);
        }
    } else {
        return cb(new Error('Campo no válido'), false);
    }
    cb(null, true);
};

const upload = multer({ storage, fileFilter, limits: { fileSize: MAX_FILE_SIZE, files: 4 } });

const uploadFields = upload.fields([
    { name: 'photo', maxCount: 1 },
    { name: 'lyrics', maxCount: 1 },
    { name: 'audio', maxCount: 1 },
    { name: 'bgmusic', maxCount: 1 },
    { name: 'placePhoto', maxCount: 1 }
]);

function handleUpload(req, res) {
    return new Promise((resolve, reject) => {
        uploadFields(req, res, (err) => {
            if (err) {
                if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE')
                    return reject({ status: 400, error: 'Archivo muy grande. Máximo 100 MB.' });
                return reject({ status: 400, error: err.message });
            }
            resolve();
        });
    });
}

// ==========================================
// ROUTES: AUTH
// ==========================================

app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));

app.post('/api/login', (req, res) => {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    if (isRateLimited(ip)) return res.status(429).json({ error: 'Demasiados intentos. Espera 15 minutos.' });
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

// ==========================================
// ROUTES: PAIRS
// ==========================================

app.get('/api/pairs', (req, res) => res.json(loadJSON(PAIRS_FILE)));

app.post('/api/pairs', requireAuth, async (req, res) => {
    try { await handleUpload(req, res); } catch (e) { return res.status(e.status || 400).json({ error: e.error }); }

    const photoFile = req.files?.photo?.[0], lyricsFile = req.files?.lyrics?.[0], audioFile = req.files?.audio?.[0];
    if (!photoFile || !lyricsFile) {
        [photoFile, lyricsFile, audioFile].forEach(f => f && safeDeleteFile(f.path));
        return res.status(400).json({ error: 'Se requieren la foto y la letra.' });
    }

    // Magic byte check for images only (not videos)
    if (ALLOWED_IMAGE_TYPES[lyricsFile.mimetype]) {
        const info = ALLOWED_IMAGE_TYPES[lyricsFile.mimetype];
        if (!validateMagicBytes(lyricsFile.path, info.magic)) {
            [photoFile, lyricsFile, audioFile].forEach(f => f && safeDeleteFile(f.path));
            return res.status(400).json({ error: 'La letra no es una imagen válida.' });
        }
    }
    if (ALLOWED_IMAGE_TYPES[photoFile.mimetype]) {
        const info = ALLOWED_IMAGE_TYPES[photoFile.mimetype];
        if (!validateMagicBytes(photoFile.path, info.magic)) {
            [photoFile, lyricsFile, audioFile].forEach(f => f && safeDeleteFile(f.path));
            return res.status(400).json({ error: 'La foto no es una imagen válida.' });
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

    const pairs = loadJSON(PAIRS_FILE);
    pairs.push(pair);
    saveJSON(PAIRS_FILE, pairs);
    res.status(201).json(pair);
});

app.put('/api/pairs/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    if (!UUID_RE.test(id)) return res.status(400).json({ error: 'ID inválido' });

    const pairs = loadJSON(PAIRS_FILE);
    const idx = pairs.findIndex(p => p.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Par no encontrado' });

    try { await handleUpload(req, res); } catch (e) { return res.status(e.status || 400).json({ error: e.error }); }

    const pair = pairs[idx];
    const photoFile = req.files?.photo?.[0], lyricsFile = req.files?.lyrics?.[0], audioFile = req.files?.audio?.[0];

    if (photoFile) { safeDeleteUploadedFile(pair.photoPath); pair.photoPath = `Imagenes Juntos/${photoFile.filename}`; }
    if (lyricsFile) { safeDeleteUploadedFile(pair.lyricsPath); pair.lyricsPath = `Letras de canciones/${lyricsFile.filename}`; }
    if (audioFile) { safeDeleteUploadedFile(pair.songPath); pair.songPath = `Pistas de Canciones/${audioFile.filename}`; }
    if (req.body.songTitle !== undefined) pair.songTitle = sanitizeText(req.body.songTitle);

    pairs[idx] = pair;
    saveJSON(PAIRS_FILE, pairs);
    res.json(pair);
});

app.delete('/api/pairs/:id', requireAuth, (req, res) => {
    const { id } = req.params;
    if (!UUID_RE.test(id)) return res.status(400).json({ error: 'ID inválido' });
    const pairs = loadJSON(PAIRS_FILE);
    const idx = pairs.findIndex(p => p.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Par no encontrado' });
    const pair = pairs[idx];
    safeDeleteUploadedFile(pair.photoPath);
    safeDeleteUploadedFile(pair.lyricsPath);
    safeDeleteUploadedFile(pair.songPath);
    pairs.splice(idx, 1);
    saveJSON(PAIRS_FILE, pairs);
    res.json({ message: 'Eliminado' });
});

app.put('/api/pairs/reorder', requireAuth, (req, res) => {
    const { order } = req.body; // array of IDs in desired order
    if (!Array.isArray(order)) return res.status(400).json({ error: 'Se requiere un array de IDs' });
    const pairs = loadJSON(PAIRS_FILE);
    const map = new Map(pairs.map(p => [p.id, p]));
    const reordered = order.map(id => map.get(id)).filter(Boolean);
    // Append any that weren't in the order
    pairs.forEach(p => { if (!order.includes(p.id)) reordered.push(p); });
    saveJSON(PAIRS_FILE, reordered);
    res.json(reordered);
});

// ==========================================
// ROUTES: LETTERS
// ==========================================

app.get('/api/letters', (req, res) => res.json(loadJSON(LETTERS_FILE)));

app.post('/api/letters', requireAuth, (req, res) => {
    const { title, content, date } = req.body;
    if (!title || !content) return res.status(400).json({ error: 'Título y contenido requeridos' });
    const letter = {
        id: crypto.randomUUID(),
        title: sanitizeText(title),
        content: sanitizeText(content),
        date: date || new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString()
    };
    const letters = loadJSON(LETTERS_FILE);
    letters.push(letter);
    saveJSON(LETTERS_FILE, letters);
    res.status(201).json(letter);
});

app.put('/api/letters/:id', requireAuth, (req, res) => {
    const { id } = req.params;
    if (!UUID_RE.test(id)) return res.status(400).json({ error: 'ID inválido' });
    const letters = loadJSON(LETTERS_FILE);
    const idx = letters.findIndex(l => l.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Carta no encontrada' });
    if (req.body.title !== undefined) letters[idx].title = sanitizeText(req.body.title);
    if (req.body.content !== undefined) letters[idx].content = sanitizeText(req.body.content);
    if (req.body.date !== undefined) letters[idx].date = req.body.date;
    saveJSON(LETTERS_FILE, letters);
    res.json(letters[idx]);
});

app.delete('/api/letters/:id', requireAuth, (req, res) => {
    const { id } = req.params;
    if (!UUID_RE.test(id)) return res.status(400).json({ error: 'ID inválido' });
    const letters = loadJSON(LETTERS_FILE);
    const idx = letters.findIndex(l => l.id === id);
    if (idx === -1) return res.status(404).json({ error: 'No encontrada' });
    letters.splice(idx, 1);
    saveJSON(LETTERS_FILE, letters);
    res.json({ message: 'Eliminada' });
});

// ==========================================
// ROUTES: PLACES
// ==========================================

app.get('/api/places', (req, res) => res.json(loadJSON(PLACES_FILE)));

app.post('/api/places', requireAuth, async (req, res) => {
    try { await handleUpload(req, res); } catch (e) { return res.status(e.status || 400).json({ error: e.error }); }
    const { name, lat, lng, description, date } = req.body;
    if (!name || !lat || !lng) return res.status(400).json({ error: 'Nombre y coordenadas requeridos' });
    const placePhoto = req.files?.placePhoto?.[0];
    const place = {
        id: crypto.randomUUID(),
        name: sanitizeText(name),
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        description: sanitizeText(description || ''),
        date: date || '',
        photoPath: placePhoto ? `Imagenes Juntos/${placePhoto.filename}` : null,
        createdAt: new Date().toISOString()
    };
    const places = loadJSON(PLACES_FILE);
    places.push(place);
    saveJSON(PLACES_FILE, places);
    res.status(201).json(place);
});

app.delete('/api/places/:id', requireAuth, (req, res) => {
    const { id } = req.params;
    if (!UUID_RE.test(id)) return res.status(400).json({ error: 'ID inválido' });
    const places = loadJSON(PLACES_FILE);
    const idx = places.findIndex(p => p.id === id);
    if (idx === -1) return res.status(404).json({ error: 'No encontrado' });
    safeDeleteUploadedFile(places[idx].photoPath);
    places.splice(idx, 1);
    saveJSON(PLACES_FILE, places);
    res.json({ message: 'Eliminado' });
});

// ==========================================
// ROUTES: SETTINGS
// ==========================================

app.get('/api/settings', (req, res) => res.json(loadJSON(SETTINGS_FILE)));

app.put('/api/settings', requireAuth, (req, res) => {
    const settings = loadJSON(SETTINGS_FILE);
    const allowed = ['anniversaryDate', 'birthdayStacey', 'birthdayMe', 'finalMessageTitle', 'finalMessageText', 'secretWord'];
    allowed.forEach(key => {
        if (req.body[key] !== undefined) settings[key] = typeof req.body[key] === 'string' ? req.body[key].substring(0, 500) : req.body[key];
    });
    saveJSON(SETTINGS_FILE, settings);
    res.json(settings);
});

app.post('/api/settings/couple', requireAuth, (req, res) => {
    const settings = loadJSON(SETTINGS_FILE);
    if (settings.coupleStatus) return res.status(400).json({ error: '¡Ya son novios! 💕' });
    settings.coupleStatus = true;
    settings.anniversaryDate = new Date().toISOString();
    saveJSON(SETTINGS_FILE, settings);
    res.json(settings);
});

app.post('/api/settings/music', requireAuth, async (req, res) => {
    try { await handleUpload(req, res); } catch (e) { return res.status(e.status || 400).json({ error: e.error }); }
    const bgFile = req.files?.bgmusic?.[0];
    if (!bgFile) return res.status(400).json({ error: 'Archivo de audio requerido' });
    const settings = loadJSON(SETTINGS_FILE);
    // Don't delete old Song2.m4a (it's an original file)
    if (settings.backgroundMusic && isUploadedFile(settings.backgroundMusic)) {
        safeDeleteFile(path.join(__dirname, 'Pistas de Canciones', path.basename(settings.backgroundMusic)));
    }
    settings.backgroundMusic = `Pistas de Canciones/${bgFile.filename}`;
    saveJSON(SETTINGS_FILE, settings);
    res.json(settings);
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
});
