import Heart3D from './heart.js';

document.addEventListener('DOMContentLoaded', () => {
    // Initialize 3D Scene
    const heartScene = new Heart3D('canvas-container');

    // Register GSAP ScrollTrigger
    gsap.registerPlugin(ScrollTrigger);

    // ===== Entry Animations with GSAP =====
    const timeline = gsap.timeline({ defaults: { ease: "power3.out", duration: 1.5 } });

    timeline
        .to('.glass-card', {
            opacity: 1,
            y: 0,
            duration: 1.5
        }, "+=0.5")
        .from('.stagger', {
            y: 20,
            opacity: 0,
            stagger: 0.2,
            duration: 1
        }, "-=0.8");

    // ===== Card Parallax on Mouse Move =====
    const card = document.querySelector('.glass-card');
    document.addEventListener('mousemove', (e) => {
        const x = (window.innerWidth / 2 - e.pageX) / 25;
        const y = (window.innerHeight / 2 - e.pageY) / 25;
        
        gsap.to(card, {
            rotationY: x,
            rotationX: -y,
            duration: 1,
            ease: "power2.out"
        });
    });

    // ===== Background Music =====
    const music = document.getElementById('bg-music');
    const musicToggle = document.getElementById('music-toggle');
    const musicIcon = document.getElementById('music-icon');
    const volumeSlider = document.getElementById('volume-slider');
    const volumeLabel = document.querySelector('.volume-label');
    let isPlaying = false;

    // Set initial volume to 50%
    music.volume = 0.5;

    // Update slider gradient to reflect current value
    function updateSliderGradient(slider) {
        const val = slider.value;
        slider.style.background = `linear-gradient(to right, var(--primary) ${val}%, rgba(255, 255, 255, 0.15) ${val}%)`;
    }

    // Update volume icon based on level
    function updateVolumeIcon(vol) {
        if (vol === 0) {
            volumeLabel.textContent = '🔇';
        } else if (vol < 33) {
            volumeLabel.textContent = '🔈';
        } else if (vol < 66) {
            volumeLabel.textContent = '🔉';
        } else {
            volumeLabel.textContent = '🔊';
        }
    }

    // Initialize slider gradient
    updateSliderGradient(volumeSlider);

    // Volume slider handler
    volumeSlider.addEventListener('input', (e) => {
        const vol = parseInt(e.target.value);
        music.volume = vol / 100;
        updateSliderGradient(e.target);
        updateVolumeIcon(vol);
    });

    // Try to autoplay on first user interaction
    const startMusic = () => {
        if (!isPlaying) {
            music.play().then(() => {
                isPlaying = true;
                musicToggle.classList.add('playing');
                musicIcon.textContent = '🎶';
            }).catch(() => {
                // Autoplay blocked, user needs to click
            });
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
        if (isPlaying) {
            music.pause();
            isPlaying = false;
            musicToggle.classList.remove('playing');
            musicIcon.textContent = '🎵';
        } else {
            music.play().then(() => {
                isPlaying = true;
                musicToggle.classList.add('playing');
                musicIcon.textContent = '🎶';
            });
        }
    });

    // ===== Scroll Indicator =====
    const scrollIndicator = document.getElementById('scroll-indicator');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 100) {
            scrollIndicator.classList.add('hidden');
        } else {
            scrollIndicator.classList.remove('hidden');
        }
    });

    // ===== Canvas opacity on scroll =====
    const canvas = document.getElementById('canvas-container');
    window.addEventListener('scroll', () => {
        const scrollProgress = Math.min(window.scrollY / window.innerHeight, 1);
        canvas.style.opacity = 1 - scrollProgress * 0.7;
    });

    // ===== Gallery Header Animation =====
    gsap.to('.gallery-header', {
        scrollTrigger: {
            trigger: '.gallery-header',
            start: 'top 80%',
            toggleActions: 'play none none none'
        },
        opacity: 1,
        y: 0,
        duration: 1.2,
        ease: 'power3.out'
    });

    // ===== Pair Rows Scroll Animations =====
    const pairRows = document.querySelectorAll('.pair-row');
    pairRows.forEach((row, index) => {
        // Determine direction based on whether it's reversed
        const isReverse = row.classList.contains('reverse');
        
        gsap.to(row, {
            scrollTrigger: {
                trigger: row,
                start: 'top 85%',
                toggleActions: 'play none none none'
            },
            opacity: 1,
            y: 0,
            duration: 1,
            ease: 'power3.out'
        });

        // Animate photo and lyrics children with stagger
        const photo = row.querySelector('.pair-photo');
        const lyrics = row.querySelector('.pair-lyrics');

        gsap.from(photo, {
            scrollTrigger: {
                trigger: row,
                start: 'top 85%',
                toggleActions: 'play none none none'
            },
            x: isReverse ? 60 : -60,
            opacity: 0,
            duration: 1,
            delay: 0.2,
            ease: 'power3.out'
        });

        gsap.from(lyrics, {
            scrollTrigger: {
                trigger: row,
                start: 'top 85%',
                toggleActions: 'play none none none'
            },
            x: isReverse ? -60 : 60,
            opacity: 0,
            duration: 1,
            delay: 0.4,
            ease: 'power3.out'
        });
    });

    // ===== Final Message Animation =====
    const finalCard = document.querySelector('.final-card');
    gsap.to(finalCard, {
        scrollTrigger: {
            trigger: '.final-message',
            start: 'top 80%',
            toggleActions: 'play none none none'
        },
        opacity: 1,
        y: 0,
        duration: 1.5,
        ease: 'power3.out',
        onComplete: () => {
            finalCard.classList.add('visible');
        }
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

        // Remove after animation
        setTimeout(() => {
            heart.remove();
        }, 16000);
    }

    // Spawn floating hearts periodically
    setInterval(createFloatingHeart, 2500);
    // Initial batch
    for (let i = 0; i < 5; i++) {
        setTimeout(createFloatingHeart, i * 600);
    }
});
