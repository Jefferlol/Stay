import * as THREE from 'three';

class Heart3D {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        
        this.heart = null;
        this.init();
    }

    init() {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.container.appendChild(this.renderer.domElement);

        this.camera.position.z = 15;

        this.addLights();
        this.createHeart();
        this.addParticles();
        this.animate();

        window.addEventListener('resize', () => this.onWindowResize());
        window.addEventListener('mousemove', (e) => this.onMouseMove(e));
    }

    addLights() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);

        const pointLight = new THREE.PointLight(0xff4d6d, 1);
        pointLight.position.set(10, 10, 10);
        this.scene.add(pointLight);

        const spotLight = new THREE.SpotLight(0xffca3a, 0.5);
        spotLight.position.set(-10, 20, 10);
        this.scene.add(spotLight);
    }

    createHeart() {
        const count = 15000;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        const sizes = new Float32Array(count);

        for (let i = 0; i < count; i++) {
            // Heart shape formula (parametric)
            const t = Math.random() * Math.PI * 2;
            const p = Math.random() * Math.PI * 2;
            
            // Basic heart outline
            let x = 16 * Math.pow(Math.sin(t), 3);
            let y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
            let z = 0;

            // Adding 3D depth using the second angle p
            const r = Math.random();
            x *= r;
            y *= r;
            z = (Math.random() - 0.5) * 10 * Math.sin(t) * r;

            const i3 = i * 3;
            positions[i3] = x * 0.5;
            positions[i3 + 1] = y * 0.5;
            positions[i3 + 2] = z * 0.5;

            // Colors: gradient from red to pink
            colors[i3] = 1; // R
            colors[i3 + 1] = 0.3 + Math.random() * 0.3; // G
            colors[i3 + 2] = 0.4 + Math.random() * 0.3; // B

            sizes[i] = Math.random() * 2;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        
        const material = new THREE.PointsMaterial({
            size: 0.08,
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        });

        this.heart = new THREE.Points(geometry, material);
        this.heart.rotation.x = 0;
        this.scene.add(this.heart);
    }

    addParticles() {
        const count = 200;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);

        for (let i = 0; i < count * 3; i++) {
            positions[i] = (Math.random() - 0.5) * 40;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const material = new THREE.PointsMaterial({
            size: 0.1,
            color: 0xff4d6d,
            transparent: true,
            opacity: 0.6
        });

        this.particles = new THREE.Points(geometry, material);
        this.scene.add(this.particles);
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    onMouseMove(event) {
        const mouseX = (event.clientX / window.innerWidth) * 2 - 1;
        const mouseY = -(event.clientY / window.innerHeight) * 2 + 1;

        if (this.heart) {
            gsap.to(this.heart.rotation, {
                y: mouseX * 0.5,
                x: mouseY * 0.5,
                duration: 2,
                ease: "power2.out"
            });
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        if (this.heart) {
            this.heart.rotation.y += 0.005;
            
            // Pulse beat animation for point cloud
            const time = Date.now() * 0.002;
            const pulse = 1 + Math.sin(time * 2) * 0.1;
            this.heart.scale.set(1.2 * pulse, 1.2 * pulse, 1.2 * pulse);
            
            // Subtle rotation tilt
            this.heart.rotation.z = Math.sin(time) * 0.1;
        }

        if (this.particles) {
            this.particles.rotation.y += 0.001;
        }

        this.renderer.render(this.scene, this.camera);
    }
}

export default Heart3D;
