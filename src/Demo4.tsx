import React, { useEffect, useRef } from "react";
import styled from "styled-components";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

const Warp = styled.div`
    width: 100vw;
    height: 100vh;
    overflow: hidden;
`;

export interface Demo4Props {}

/**
 * Demo4 - SkyBox + OrbitControls
 */
const Demo4: React.FC<Demo4Props> = () => {
    const containerRef = useRef<HTMLDivElement | null>(null);

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

        // =====================
        // Camera
        // =====================
        camera = new THREE.PerspectiveCamera(
            90,
            container.clientWidth / container.clientHeight,
            0.1,
            100
        );
        camera.position.z = 0.01;

        // =====================
        // Controls
        // =====================
        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableZoom = false;
        controls.enablePan = false;
        controls.enableDamping = true;
        controls.rotateSpeed = -0.25;

        // =====================
        // 贴图拆分函数
        // =====================
        const getTexturesFromAtlasFile = (
            atlasImgUrl: string,
            tilesNum: number
        ) => {
            const textures: THREE.Texture[] = [];

            for (let i = 0; i < tilesNum; i++) {
                textures[i] = new THREE.Texture();
            }

            new THREE.ImageLoader().load(atlasImgUrl, (image) => {
                const tileWidth = image.height;

                for (let i = 0; i < textures.length; i++) {
                    const canvas = document.createElement("canvas");
                    const context = canvas.getContext("2d")!;
                    canvas.height = tileWidth;
                    canvas.width = tileWidth;

                    context.drawImage(
                        image,
                        tileWidth * i,
                        0,
                        tileWidth,
                        tileWidth,
                        0,
                        0,
                        tileWidth,
                        tileWidth
                    );

                    textures[i].colorSpace = THREE.SRGBColorSpace;
                    textures[i].image = canvas;
                    textures[i].needsUpdate = true;
                }
            });

            return textures;
        };

        // =====================
        // SkyBox
        // =====================
        // const textures = getTexturesFromAtlasFile(
        //     "/textures/cube/sun_temple_stripe.jpg", // public目录
        //     6
        // );
        //
        // const materials: THREE.MeshBasicMaterial[] = [];
        //
        // for (let i = 0; i < 6; i++) {
        //     materials.push(
        //         new THREE.MeshBasicMaterial({
        //             map: textures[i],
        //         })
        //     );
        // }
        // const loader = new THREE.TextureLoader();
        //
        // const materials = [
        //     new THREE.MeshBasicMaterial({ map: loader.load("/textures/cube2/0_pano_px.jpg") ,side:THREE.DoubleSide}), // 右
        //     new THREE.MeshBasicMaterial({ map: loader.load("/textures/cube2/0_pano_nx.jpg") ,side:THREE.DoubleSide}), // 左
        //     new THREE.MeshBasicMaterial({ map: loader.load("/textures/cube2/0_pano_py.jpg") ,side:THREE.DoubleSide}), // 上
        //     new THREE.MeshBasicMaterial({ map: loader.load("/textures/cube2/0_pano_ny.jpg") ,side:THREE.DoubleSide}), // 下
        //     new THREE.MeshBasicMaterial({ map: loader.load("/textures/cube2/0_pano_pz.jpg") ,side:THREE.DoubleSide}), // 前
        //     new THREE.MeshBasicMaterial({ map: loader.load("/textures/cube2/0_pano_nz.jpg") ,side:THREE.DoubleSide}), // 后
        // ];
        // const skyBox = new THREE.Mesh(
        //     new THREE.BoxGeometry(1, 1, 1),
        //     materials
        // );

        // skyBox.geometry.scale(1, 1, 1);
        // scene.add(skyBox);
        const loader = new THREE.CubeTextureLoader();
        loader.setPath("");

        const texture = loader.load([
            // "/textures/cube1/px.jpg",
            // "/textures/cube1/nx.jpg",
            // "/textures/cube1/py.jpg",
            // "/textures/cube1/ny.jpg",
            // "/textures/cube1/pz.jpg",
            // "/textures/cube1/nz.jpg",
            "/textures/cube2/0_pano_px.jpg",
            "/textures/cube2/0_pano_nx.jpg",
            "/textures/cube2/0_pano_py.jpg",
            "/textures/cube2/0_pano_ny.jpg",
            "/textures/cube2/0_pano_pz.jpg",
            "/textures/cube2/0_pano_nz.jpg",
        ]);
        scene.background = texture;
        // =====================
        // Resize
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

        window.addEventListener("resize", onWindowResize);

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

    return <Warp ref={containerRef} />;
};

export default Demo4;