import React, { useEffect, useRef } from 'react';
import styled from "styled-components";
import * as THREE from 'three';

const Warp = styled.div`
    width: 100vw;
    height: 100vh;
    overflow: hidden;
`;

export interface Demo3Props {}

/**
 * Demo3 - Three.js Panorama Sphere
 */
const Demo3: React.FC<Demo3Props> = () => {

    const containerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {

        let camera: THREE.PerspectiveCamera;
        let scene: THREE.Scene;
        let renderer: THREE.WebGLRenderer;

        let isUserInteracting = false;
        let onPointerDownMouseX = 0;
        let onPointerDownMouseY = 0;
        let lon = 0;
        let onPointerDownLon = 0;
        let lat = 0;
        let onPointerDownLat = 0;
        let phi = 0;
        let theta = 0;

        const container = containerRef.current!;

        // 初始化
        camera = new THREE.PerspectiveCamera(
            90,
            container.clientWidth / container.clientHeight,
            1,
            1100
        );

        scene = new THREE.Scene();

        const geometry = new THREE.SphereGeometry(500, 60, 40);
        geometry.scale(-1, 1, 1);

        const texture = new THREE.TextureLoader().load(
            // '/textures/2294472375_24a3b8ef46_o.jpg' // 放到 public 目录
            '/textures/1709798444.jpg' // 放到 public 目录
        );
        // texture.colorSpace = THREE.SRGBColorSpace;

        const material = new THREE.MeshBasicMaterial({ map: texture });
        const mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(container.clientWidth, container.clientHeight);
        container.appendChild(renderer.domElement);

        // =====================
        // 事件
        // =====================

        const onWindowResize = () => {
            camera.aspect =
                container.clientWidth / container.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(
                container.clientWidth,
                container.clientHeight
            );
        };

        const onPointerDown = (event: PointerEvent) => {
            if (!event.isPrimary) return;

            isUserInteracting = true;

            onPointerDownMouseX = event.clientX;
            onPointerDownMouseY = event.clientY;

            onPointerDownLon = lon;
            onPointerDownLat = lat;

            document.addEventListener('pointermove', onPointerMove);
            document.addEventListener('pointerup', onPointerUp);
        };

        const onPointerMove = (event: PointerEvent) => {
            if (!event.isPrimary) return;

            lon =
                (onPointerDownMouseX - event.clientX) * 0.1 +
                onPointerDownLon;
            lat =
                (event.clientY - onPointerDownMouseY) * 0.1 +
                onPointerDownLat;
        };

        const onPointerUp = (event: PointerEvent) => {
            if (!event.isPrimary) return;

            isUserInteracting = false;

            document.removeEventListener('pointermove', onPointerMove);
            document.removeEventListener('pointerup', onPointerUp);
        };

        const onMouseWheel = (event: WheelEvent) => {
            const fov = camera.fov + event.deltaY * 0.05;
            camera.fov = THREE.MathUtils.clamp(fov, 10, 75);
            camera.updateProjectionMatrix();
        };

        container.addEventListener('pointerdown', onPointerDown);
        window.addEventListener('resize', onWindowResize);
        document.addEventListener('wheel', onMouseWheel);

        // =====================
        // 动画
        // =====================

        const animate = () => {
            if (!isUserInteracting) {
                lon += 0.1;
            }

            lat = Math.max(-85, Math.min(85, lat));
            phi = THREE.MathUtils.degToRad(90 - lat);
            theta = THREE.MathUtils.degToRad(lon);

            const x = 500 * Math.sin(phi) * Math.cos(theta);
            const y = 500 * Math.cos(phi);
            const z = 500 * Math.sin(phi) * Math.sin(theta);

            camera.lookAt(x, y, z);

            renderer.render(scene, camera);

            requestAnimationFrame(animate);
        };

        animate();

        // =====================
        // 清理
        // =====================
        return () => {
            container.removeEventListener('pointerdown', onPointerDown);
            window.removeEventListener('resize', onWindowResize);
            document.removeEventListener('wheel', onMouseWheel);

            renderer.dispose();
            scene.clear();
            container.removeChild(renderer.domElement);
        };

    }, []);

    return <Warp ref={containerRef} />;
};

export default Demo3;