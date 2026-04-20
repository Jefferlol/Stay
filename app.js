import Heart3D from './heart.js';

document.addEventListener('DOMContentLoaded', () => {
    // Initialize 3D Scene
    const heartScene = new Heart3D('canvas-container');

    // Register GSAP ScrollTrigger
    gsap.registerPlugin(ScrollTrigger);

    // ===== Day / Night Theme =====
    function applyDayNightTheme() {
        const h = new Date().getHours();
        document.body.classList.remove('theme-dawn', 'theme-day', 'theme-sunset', 'theme-night');
        if (h >= 5 && h < 8)       document.body.classList.add('theme-dawn');
        else if (h >= 8 && h < 17)  document.body.classList.add('theme-day');
        else if (h >= 17 && h < 20) document.body.classList.add('theme-sunset');
        else                         document.body.classList.add('theme-night');
    }
    applyDayNightTheme();
    setInterval(applyDayNightTheme, 5 * 60 * 1000);

    // ===== Entry Animations with GSAP =====
    const timeline = gsap.timeline({ defaults: { ease: "power3.out", duration: 1.5 } });

    timeline
        .to('.glass-card', { opacity: 1, y: 0, duration: 1.5 }, "+=0.5")
        .from('.stagger', { y: 20, opacity: 0, stagger: 0.2, duration: 1 }, "-=0.8");

    // ===== Card Parallax on Mouse Move =====
    const card = document.querySelector('.glass-card');
    document.addEventListener('mousemove', (e) => {
        const x = (window.innerWidth / 2 - e.pageX) / 25;
        const y = (window.innerHeight / 2 - e.pageY) / 25;
        gsap.to(card, { rotationY: x, rotationX: -y, duration: 1, ease: "power2.out" });
    });

    // ===== Background Music =====
    const music = document.getElementById('bg-music');
    const musicToggle = document.getElementById('music-toggle');
    const musicIcon = document.getElementById('music-icon');
    const volumeSlider = document.getElementById('volume-slider');
    const volumeLabel = document.querySelector('.volume-label');
    let isPlaying = false;

    music.volume = 0.5;

    function updateSliderGradient(slider) {
        const val = slider.value;
        slider.style.background = `linear-gradient(to right, var(--primary) ${val}%, rgba(255, 255, 255, 0.15) ${val}%)`;
    }

    function updateVolumeIcon(vol) {
        if (vol === 0) volumeLabel.textContent = '🔇';
        else if (vol < 33) volumeLabel.textContent = '🔈';
        else if (vol < 66) volumeLabel.textContent = '🔉';
        else volumeLabel.textContent = '🔊';
    }

    updateSliderGradient(volumeSlider);

    volumeSlider.addEventListener('input', (e) => {
        const vol = parseInt(e.target.value);
        music.volume = vol / 100;
        songAudio.volume = vol / 100;
        updateSliderGradient(e.target);
        updateVolumeIcon(vol);
    });

    const startMusic = () => {
        if (!isPlaying) {
            music.play().then(() => {
                isPlaying = true;
                musicToggle.classList.add('playing');
                musicIcon.textContent = '🎶';
            }).catch(() => {});
        }
        document.removeEventListener('click', startMusic);
        document.removeEventListener('scroll', startMusic);
        document.removeEventListener('touchstart', startMusic);
    };

    document.addEventListener('click', startMusic, { once: false });
    document.addEventListener('scroll', startMusic, { once: true });
    document.addEventListener('touchstart', startMusic, { once: true });

    musicToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        if (currentSongCard) {
            if (songAudio.paused) {
                songAudio.play(); currentSongCard.classList.add('now-playing');
                musicToggle.classList.add('playing'); musicIcon.textContent = '🎶';
            } else {
                songAudio.pause(); currentSongCard.classList.remove('now-playing');
                musicToggle.classList.remove('playing'); musicIcon.textContent = '🎵';
            }
        } else {
            if (isPlaying) {
                music.pause(); isPlaying = false;
                musicToggle.classList.remove('playing'); musicIcon.textContent = '🎵';
            } else {
                music.play().then(() => {
                    isPlaying = true; musicToggle.classList.add('playing'); musicIcon.textContent = '🎶';
                });
            }
        }
    });

    // ===== Song Track Player =====
    const songAudio = new Audio();
    let currentSongCard = null;
    songAudio.volume = music.volume;

    songAudio.addEventListener('ended', () => {
        if (currentSongCard) currentSongCard.classList.remove('now-playing');
        currentSongCard = null;
        musicToggle.classList.remove('playing'); musicIcon.textContent = '🎵';
    });

    function playSongFromCard(lyricsCard) {
        const songSrc = lyricsCard.getAttribute('data-song');
        if (currentSongCard === lyricsCard) {
            if (songAudio.paused) { songAudio.play(); lyricsCard.classList.add('now-playing'); musicToggle.classList.add('playing'); musicIcon.textContent = '🎶'; }
            else { songAudio.pause(); lyricsCard.classList.remove('now-playing'); musicToggle.classList.remove('playing'); musicIcon.textContent = '🎵'; }
            return;
        }
        if (isPlaying) { music.pause(); isPlaying = false; }
        if (currentSongCard) currentSongCard.classList.remove('now-playing');
        currentSongCard = lyricsCard;
        songAudio.src = songSrc;
        songAudio.volume = parseInt(volumeSlider.value) / 100;
        songAudio.play().then(() => {
            lyricsCard.classList.add('now-playing'); musicToggle.classList.add('playing'); musicIcon.textContent = '🎶';
        }).catch(err => console.warn('Could not play:', err));
    }

    // Attach click handlers to static cards (final message, hero)
    document.querySelectorAll('.final-message[data-song], .glass-card[data-song]').forEach(card => {
        card.style.cursor = 'pointer';
        card.addEventListener('click', (e) => { e.stopPropagation(); playSongFromCard(card); });
    });

    // ===== Scroll Indicator =====
    const scrollIndicator = document.getElementById('scroll-indicator');
    window.addEventListener('scroll', () => {
        scrollIndicator.classList.toggle('hidden', window.scrollY > 100);
    });

    // ===== Canvas opacity on scroll =====
    const canvas = document.getElementById('canvas-container');
    window.addEventListener('scroll', () => {
        canvas.style.opacity = 1 - Math.min(window.scrollY / window.innerHeight, 1) * 0.7;
    });

    // ===== Gallery Header Animation =====
    gsap.to('.gallery-header', {
        scrollTrigger: { trigger: '.gallery-header', start: 'top 80%', toggleActions: 'play none none none' },
        opacity: 1, y: 0, duration: 1.2, ease: 'power3.out'
    });

    // ===== Final Message Animation =====
    const finalCard = document.querySelector('.final-card');
    gsap.to(finalCard, {
        scrollTrigger: { trigger: '.final-message', start: 'top 80%', toggleActions: 'play none none none' },
        opacity: 1, y: 0, duration: 1.5, ease: 'power3.out',
        onComplete: () => finalCard.classList.add('visible')
    });

    // ===== Floating Hearts =====
    const heartsContainer = document.getElementById('floating-hearts');
    const heartEmojis = ['💕', '❤️', '💖', '💗', '💝', '🩷', '♥️', '💘'];
    function createFloatingHeart() {
        const heart = document.createElement('span');
        heart.classList.add('float-heart');
        heart.textContent = heartEmojis[Math.floor(Math.random() * heartEmojis.length)];
        heart.style.left = Math.random() * 100 + '%';
        heart.style.fontSize = (0.8 + Math.random() * 1.2) + 'rem';
        heart.style.animationDuration = (6 + Math.random() * 8) + 's';
        heart.style.animationDelay = Math.random() * 2 + 's';
        heartsContainer.appendChild(heart);
        setTimeout(() => heart.remove(), 16000);
    }
    setInterval(createFloatingHeart, 2500);
    for (let i = 0; i < 5; i++) setTimeout(createFloatingHeart, i * 600);

    // ===== Helper: check if path is a video =====
    function isVideoPath(p) { return /\.(mp4|webm|mov)$/i.test(p); }

    // ===== Load ALL Pairs from Server =====
    let allPairs = [];

    async function loadDynamicPairs() {
        try {
            const res = await fetch('/api/pairs');
            if (!res.ok) return;
            allPairs = await res.json();
            if (!allPairs.length) return;

            const container = document.getElementById('dynamic-pairs');
            if (!container) return;

            allPairs.forEach((pair, i) => {
                const isReverse = i % 2 !== 0;
                const row = document.createElement('div');
                row.className = `pair-row${isReverse ? ' reverse' : ''}`;
                row.dataset.index = i;
                row.style.opacity = '0';
                row.style.transform = 'translateY(50px)';

                const songAttr = pair.songPath ? `data-song="${pair.songPath}"` : '';
                const isVideo = isVideoPath(pair.photoPath);

                const mediaEl = isVideo
                    ? `<video src="${pair.photoPath}" autoplay muted loop playsinline></video>`
                    : `<img src="${pair.photoPath}" alt="Nosotros juntos" loading="lazy">`;

                row.innerHTML = `
                    <div class="pair-photo">${mediaEl}</div>
                    <div class="pair-lyrics" ${songAttr} style="cursor:pointer">
                        <img src="${pair.lyricsPath}" alt="${pair.songTitle}" loading="lazy">
                        <span class="song-title">${pair.songTitle}</span>
                    </div>
                `;

                container.appendChild(row);

                // Click-to-play handler
                if (pair.songPath) {
                    const lyricsCard = row.querySelector('.pair-lyrics');
                    lyricsCard.addEventListener('click', (e) => { e.stopPropagation(); playSongFromCard(lyricsCard); });
                }

                // GSAP scroll animations
                const photo = row.querySelector('.pair-photo');
                const lyrics = row.querySelector('.pair-lyrics');
                gsap.to(row, { scrollTrigger: { trigger: row, start: 'top 85%', toggleActions: 'play none none none' }, opacity: 1, y: 0, duration: 1, ease: 'power3.out' });
                gsap.from(photo, { scrollTrigger: { trigger: row, start: 'top 85%', toggleActions: 'play none none none' }, x: isReverse ? 60 : -60, opacity: 0, duration: 1, delay: 0.2, ease: 'power3.out' });
                gsap.from(lyrics, { scrollTrigger: { trigger: row, start: 'top 85%', toggleActions: 'play none none none' }, x: isReverse ? -60 : 60, opacity: 0, duration: 1, delay: 0.4, ease: 'power3.out' });
            });
            ScrollTrigger.refresh();
        } catch (err) { console.log('Dynamic pairs: API not available'); }
    }

    // ===== Love Counter =====
    async function initCounter() {
        try {
            const settings = await (await fetch('/api/settings')).json();

            // Only show counter if couple status is active
            const counterSection = document.getElementById('counter-section');
            if (!settings.coupleStatus || !settings.anniversaryDate) {
                counterSection.style.display = 'none';
            } else {
                counterSection.style.display = '';
                const counterCard = document.querySelector('.counter-card');
                gsap.to(counterCard, {
                    scrollTrigger: { trigger: counterCard, start: 'top 85%', toggleActions: 'play none none none' },
                    opacity: 1, y: 0, duration: 1.2, ease: 'power3.out'
                });

                const startDate = new Date(settings.anniversaryDate);

                function updateCounter() {
                    const now = new Date();
                    let diff = now - startDate;
                    if (diff < 0) diff = 0;

                    const totalSeconds = Math.floor(diff / 1000);
                    const totalMinutes = Math.floor(totalSeconds / 60);
                    const totalHours = Math.floor(totalMinutes / 60);

                    let years = now.getFullYear() - startDate.getFullYear();
                    let months = now.getMonth() - startDate.getMonth();
                    let days = now.getDate() - startDate.getDate();

                    if (days < 0) { months--; const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0); days += prevMonth.getDate(); }
                    if (months < 0) { years--; months += 12; }

                    document.getElementById('c-years').textContent = years;
                    document.getElementById('c-months').textContent = months;
                    document.getElementById('c-days').textContent = days;
                    document.getElementById('c-hours').textContent = totalHours % 24;
                    document.getElementById('c-mins').textContent = totalMinutes % 60;
                    document.getElementById('c-secs').textContent = totalSeconds % 60;
                }

                updateCounter();
                setInterval(updateCounter, 1000);
            }

            // --- Load dynamic settings for final message and bg music ---
            if (settings.backgroundMusic && settings.backgroundMusic !== 'Song2.m4a') {
                music.src = settings.backgroundMusic;
            }
            if (settings.finalMessageTitle) {
                document.getElementById('final-title').innerHTML = settings.finalMessageTitle;
            }
            if (settings.finalMessageText) {
                document.getElementById('final-text').textContent = settings.finalMessageText;
            }

            // --- Special Dates ---
            checkSpecialDates(settings);

            // --- Store secret word for easter eggs ---
            window._secretWord = (settings.secretWord || 'tequiero').toLowerCase();

        } catch (err) { console.log('Settings not available'); }
    }

    // ===== Special Dates (Confetti + Banner) =====
    function checkSpecialDates(settings) {
        const now = new Date();
        const mmdd = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

        let message = null;

        // Anniversary
        if (settings.anniversaryDate) {
            const anniv = new Date(settings.anniversaryDate);
            const annivMmdd = `${String(anniv.getMonth() + 1).padStart(2, '0')}-${String(anniv.getDate()).padStart(2, '0')}`;
            if (mmdd === annivMmdd) message = '🎉💕 ¡Feliz aniversario, amor! Otro año más juntos 💕🎉';
        }

        // Valentine's Day
        if (mmdd === '02-14') message = '💝 ¡Feliz día de San Valentín, mi amor! 💝';

        // Birthdays
        if (settings.birthdayStacey && mmdd === settings.birthdayStacey) message = '🎂🎀 ¡Feliz cumpleaños, Stacey! Te quiero 🎂🎀';
        if (settings.birthdayMe && mmdd === settings.birthdayMe) message = '🎂🎉 ¡Feliz cumpleaños, mi amor! 🎂🎉';

        if (message) {
            const banner = document.getElementById('special-banner');
            document.getElementById('special-banner-text').textContent = message;
            banner.style.display = 'block';
            launchConfetti();
        }
    }

    function launchConfetti() {
        const container = document.getElementById('confetti-container');
        const colors = ['#ff4d6d', '#ffca3a', '#c77dff', '#22c55e', '#ff6b8a', '#f4a261'];
        for (let i = 0; i < 80; i++) {
            const piece = document.createElement('div');
            piece.className = 'confetti-piece';
            piece.style.left = Math.random() * 100 + '%';
            piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            piece.style.width = (6 + Math.random() * 8) + 'px';
            piece.style.height = (6 + Math.random() * 8) + 'px';
            piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';
            piece.style.animationDuration = (2 + Math.random() * 3) + 's';
            piece.style.animationDelay = Math.random() * 2 + 's';
            container.appendChild(piece);
            setTimeout(() => piece.remove(), 7000);
        }
    }

    // ===== Easter Eggs =====
    // 1. Click heart 5 times
    let heartClicks = 0;
    const easterHeart = document.getElementById('easter-heart');
    if (easterHeart) {
        easterHeart.addEventListener('click', (e) => {
            e.stopPropagation();
            heartClicks++;
            if (heartClicks >= 5) {
                heartClicks = 0;
                showEasterEgg('¡Cada latido es por ti!', 'Mi corazón late solo por ti, Stacey. 5 clicks = 5 veces "te quiero" 💕');
            }
        });
    }

    // 2. Konami code
    const konamiCode = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
    let konamiIndex = 0;

    // 3. Secret word typed
    let typedWord = '';

    document.addEventListener('keydown', (e) => {
        // Konami
        if (e.key === konamiCode[konamiIndex]) {
            konamiIndex++;
            if (konamiIndex === konamiCode.length) {
                konamiIndex = 0;
                showEasterEgg('🎮 ¡Código secreto desbloqueado!', 'Eres la Player 2 perfecta para mi vida. Game Over nunca, porque contigo es modo infinito. ♾️💖');
            }
        } else { konamiIndex = 0; }

        // Secret word
        if (e.key.length === 1) {
            typedWord += e.key.toLowerCase();
            if (typedWord.length > 20) typedWord = typedWord.slice(-20);
            if (window._secretWord && typedWord.endsWith(window._secretWord)) {
                typedWord = '';
                showEasterEgg('💌 Palabra secreta', '¡Escribiste la palabra mágica! Cada letra es una prueba de que pensamos igual. Te quiero infinito. 💕');
                launchConfetti();
            }
        }
    });

    function showEasterEgg(title, sub) {
        document.getElementById('easter-message').textContent = title;
        document.getElementById('easter-sub').textContent = sub;
        document.getElementById('easter-overlay').style.display = 'flex';
    }

    // ===== Love Letters =====
    async function loadLetters() {
        try {
            const res = await fetch('/api/letters');
            const letters = await res.json();
            if (!letters.length) return;

            document.getElementById('letters-section').style.display = 'block';
            const grid = document.getElementById('letters-grid');
            grid.innerHTML = '';

            letters.forEach(letter => {
                const env = document.createElement('div');
                env.className = 'letter-envelope';
                env.innerHTML = `
                    <div class="letter-seal">💌</div>
                    <div class="letter-title-text">${letter.title}</div>
                    <div class="letter-date">${letter.date || ''}</div>
                `;
                env.addEventListener('click', () => openLetter(letter));
                grid.appendChild(env);
            });
        } catch {}
    }

    // Letter overlay
    const letterOverlay = document.createElement('div');
    letterOverlay.className = 'letter-content-overlay';
    letterOverlay.id = 'letter-overlay';
    letterOverlay.innerHTML = `
        <div class="letter-opened">
            <h3 id="letter-open-title"></h3>
            <div class="letter-opened-date" id="letter-open-date"></div>
            <div class="letter-body" id="letter-open-body"></div>
            <button class="letter-close-btn" id="letter-close-btn">Cerrar 💕</button>
        </div>
    `;
    document.body.appendChild(letterOverlay);

    document.getElementById('letter-close-btn').addEventListener('click', () => letterOverlay.classList.remove('visible'));
    letterOverlay.addEventListener('click', (e) => { if (e.target === letterOverlay) letterOverlay.classList.remove('visible'); });

    function openLetter(letter) {
        document.getElementById('letter-open-title').textContent = letter.title;
        document.getElementById('letter-open-date').textContent = letter.date || '';
        document.getElementById('letter-open-body').textContent = letter.content;
        letterOverlay.classList.add('visible');
    }

    // ===== Interactive Map =====
    async function loadMap() {
        try {
            const res = await fetch('/api/places');
            const places = await res.json();
            if (!places.length) return;

            document.getElementById('map-section').style.display = 'block';
            const mapEl = document.getElementById('map-container');

            // Wait a frame for the container to have dimensions
            await new Promise(r => setTimeout(r, 100));

            const map = L.map(mapEl).setView([places[0].lat, places[0].lng], 12);

            L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
                attribution: '©OpenStreetMap ©CARTO',
                maxZoom: 19
            }).addTo(map);

            const heartIcon = L.divIcon({
                html: '<div class="heart-marker">❤️</div>',
                iconSize: [30, 30],
                className: ''
            });

            const bounds = [];
            places.forEach(place => {
                bounds.push([place.lat, place.lng]);
                const photoHtml = place.photoPath
                    ? `<img class="popup-photo" src="${place.photoPath}" alt="${place.name}">`
                    : '';
                const popup = `
                    ${photoHtml}
                    <div class="popup-title">${place.name}</div>
                    ${place.date ? `<div class="popup-date">${place.date}</div>` : ''}
                    ${place.description ? `<div class="popup-desc">${place.description}</div>` : ''}
                `;
                L.marker([place.lat, place.lng], { icon: heartIcon }).addTo(map).bindPopup(popup, { maxWidth: 250 });
            });

            if (bounds.length > 1) map.fitBounds(bounds, { padding: [40, 40] });

            // Refresh map size after scroll trigger reveals it
            setTimeout(() => map.invalidateSize(), 500);
            window.addEventListener('scroll', () => map.invalidateSize(), { passive: true });

            // Render place cards below the map
            const cardsContainer = document.getElementById('places-cards');
            if (cardsContainer) {
                cardsContainer.innerHTML = '';
                places.forEach(place => {
                    const card = document.createElement('div');
                    card.className = 'place-card';

                    const photoEl = place.photoPath
                        ? `<img class="place-card-photo" src="${place.photoPath}" alt="${place.name}" loading="lazy">`
                        : `<div class="place-card-no-photo">📍</div>`;

                    const dateEl = place.date
                        ? `<div class="place-card-date">📅 ${place.date}</div>`
                        : '';

                    const descEl = place.description
                        ? `<p class="place-card-desc">${place.description}</p>`
                        : '';

                    card.innerHTML = `
                        ${photoEl}
                        <div class="place-card-body">
                            <h3 class="place-card-name">${place.name}</h3>
                            ${dateEl}
                            ${descEl}
                        </div>
                    `;
                    cardsContainer.appendChild(card);
                });
            }

        } catch {}
    }

    // ===== Slideshow =====
    let ssIndex = 0, ssPlaying = true, ssTimer = null, ssProgressTimer = null;

    const ssOverlay = document.getElementById('slideshow-overlay');
    const ssPhoto = document.getElementById('slideshow-photo');
    const ssVideo = document.getElementById('slideshow-video');
    const ssLyrics = document.getElementById('slideshow-lyrics');
    const ssTitle = document.getElementById('slideshow-title');
    const ssBg = document.getElementById('slideshow-bg');
    const ssBar = document.getElementById('slideshow-bar');
    const ssPlayBtn = document.getElementById('ss-play');
    const SS_DURATION = 5000; // 5 seconds per slide

    document.getElementById('slideshow-fab').addEventListener('click', () => {
        if (!allPairs.length) return;
        ssIndex = 0;
        ssOverlay.style.display = 'flex';
        ssPlaying = true;
        ssPlayBtn.textContent = '⏸';
        showSlide(ssIndex);
        startSSTimer();
    });

    document.getElementById('ss-close').addEventListener('click', closeSlideshow);
    document.getElementById('ss-next').addEventListener('click', () => { nextSlide(); resetSSTimer(); });
    document.getElementById('ss-prev').addEventListener('click', () => { prevSlide(); resetSSTimer(); });
    document.getElementById('ss-play').addEventListener('click', () => {
        ssPlaying = !ssPlaying;
        ssPlayBtn.textContent = ssPlaying ? '⏸' : '▶';
        if (ssPlaying) startSSTimer(); else clearSSTimers();
    });

    // Close with Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && ssOverlay.style.display !== 'none') closeSlideshow();
    });

    function showSlide(i) {
        const pair = allPairs[i];
        if (!pair) return;

        const isVideo = isVideoPath(pair.photoPath);

        if (isVideo) {
            ssPhoto.style.display = 'none';
            ssVideo.style.display = 'block';
            ssVideo.src = pair.photoPath;
            ssVideo.play();
            ssBg.style.backgroundImage = 'none';
            ssBg.style.background = '#000';
        } else {
            ssVideo.style.display = 'none';
            ssVideo.pause();
            ssPhoto.style.display = 'block';
            ssPhoto.src = pair.photoPath;
            ssBg.style.backgroundImage = `url(${pair.photoPath})`;
        }

        ssLyrics.src = pair.lyricsPath;
        ssTitle.textContent = pair.songTitle;

        // Play corresponding song
        if (pair.songPath) {
            if (isPlaying) { music.pause(); isPlaying = false; }
            if (currentSongCard) currentSongCard.classList.remove('now-playing');
            currentSongCard = null;
            songAudio.src = pair.songPath;
            songAudio.volume = parseInt(volumeSlider.value) / 100;
            songAudio.play().catch(() => {});
        }
    }

    function nextSlide() { ssIndex = (ssIndex + 1) % allPairs.length; showSlide(ssIndex); }
    function prevSlide() { ssIndex = (ssIndex - 1 + allPairs.length) % allPairs.length; showSlide(ssIndex); }

    function startSSTimer() {
        clearSSTimers();
        let start = Date.now();
        ssProgressTimer = setInterval(() => {
            const elapsed = Date.now() - start;
            ssBar.style.width = Math.min((elapsed / SS_DURATION) * 100, 100) + '%';
        }, 50);
        ssTimer = setTimeout(() => { nextSlide(); startSSTimer(); }, SS_DURATION);
    }

    function clearSSTimers() { clearTimeout(ssTimer); clearInterval(ssProgressTimer); ssBar.style.width = '0'; }

    function resetSSTimer() { if (ssPlaying) startSSTimer(); }

    function closeSlideshow() {
        ssOverlay.style.display = 'none';
        clearSSTimers();
        songAudio.pause();
        if (currentSongCard) currentSongCard.classList.remove('now-playing');
        currentSongCard = null;
        ssVideo.pause();
        musicToggle.classList.remove('playing');
        musicIcon.textContent = '🎵';
    }


    // ===== Initialize Everything =====
    loadDynamicPairs();
    initCounter();
    loadLetters();
    loadMap();
});
