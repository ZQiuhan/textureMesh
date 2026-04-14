import React, { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { TextureMesh } from "./utils/TextureMesh";

const Warp = styled.div`
    width: 100vw;
    height: 100vh;
    overflow: hidden;
`;

export interface Demo5Props {}
const meshPath = "/textureMesh/mesh/mesh.ply";
const metaPath = "/textureMesh/mesh/meta.json";
const panoramaDirectory = "/textureMesh/mesh/Panoramas";

/**
 * Demo5 - mesh 纹理映射
 */
const Demo5: React.FC<Demo5Props> = () => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const [initialized, setInitialized] = useState(false);
    useEffect(() => {
        let camera: THREE.PerspectiveCamera;
        let scene: THREE.Scene;
        let renderer: THREE.WebGLRenderer;
        let controls: OrbitControls;

        const container = containerRef.current!;

        // =====================
        // Renderer
        // =====================
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(container.clientWidth, container.clientHeight);
        container.appendChild(renderer.domElement);

        // =====================
        // Scene
        // =====================
        scene = new THREE.Scene();
        sceneRef.current = scene;

        // 添加坐标轴辅助
        const axesHelper = new THREE.AxesHelper(10);
        scene.add(axesHelper);
        scene.background = new THREE.Color(0xe1ebfa);
        // 添加网格辅助
        const gridHelper = new THREE.GridHelper(20, 20);
        scene.add(gridHelper);

        // // 创建立方体
        // const cube = new THREE.Mesh(
        //     new THREE.BoxGeometry(1, 1, 1),
        //     new THREE.MeshBasicMaterial({
        //         color: 0x00ff00,
        //         wireframe: true,
        //     })
        // );
        // scene.add(cube);
        //
        // // 添加一些额外的物体来测试控制器
        // const sphere = new THREE.Mesh(
        //     new THREE.SphereGeometry(0.5, 32, 16),
        //     new THREE.MeshBasicMaterial({
        //         color: 0xff0000,
        //         wireframe: true,
        //     })
        // );
        // sphere.position.set(1.5, 0, 0);
        // scene.add(sphere);
        //
        // const cylinder = new THREE.Mesh(
        //     new THREE.CylinderGeometry(0.3, 0.3, 1, 32),
        //     new THREE.MeshBasicMaterial({
        //         color: 0x0000ff,
        //         wireframe: true,
        //     })
        // );
        // cylinder.position.set(-1.5, 0, 0);
        // scene.add(cylinder);

        // =====================
        // Camera
        // =====================
        camera = new THREE.PerspectiveCamera(
            45, // 改为45度视角，更自然
            container.clientWidth / container.clientHeight,
            0.1,
            100
        );
        camera.position.set(3, 2, 5); // 设置合适的相机位置
        camera.lookAt(0, 0, 0);
        camera.up.set(0, -1, 0);
        // =====================
        // Controls
        // =====================
        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableZoom = true; // 启用缩放
        controls.enablePan = true; // 启用平移
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.autoRotate = false;
        controls.enableRotate = true;
        controls.target.set(0, 0, 0); // 设置目标点为原点

        // =====================
        // Resize
        // =====================
        const onWindowResize = () => {
            camera.aspect = container.clientWidth / container.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(container.clientWidth, container.clientHeight);
        };

        window.addEventListener("resize", onWindowResize);
        setInitialized( true)
        // =====================
        // Animate
        // =====================
        const animate = () => {
            controls.update();
            renderer.render(scene, camera);
            requestAnimationFrame(animate);
        };

        animate();

        // =====================
        // Cleanup
        // =====================
        return () => {
            window.removeEventListener("resize", onWindowResize);
            controls.dispose();
            renderer.dispose();
            scene.clear();
            container.removeChild(renderer.domElement);
        };
    }, []);

    useEffect(() => {
        if (!initialized || !sceneRef.current) return;
        const scene = sceneRef.current;
        const textureMesh = new TextureMesh({
            scene: scene,
            meshPath: meshPath,
            metaPath: metaPath,
            panoramaDirectory: panoramaDirectory,
        });
        textureMesh.start();
    }, [initialized]);

    return <Warp ref={containerRef} />;
};

export default Demo5;