import React, { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { TextureMesh } from "./utils/TextureMesh";
import { COLMAPExporter } from "./utils/COLMAPExporter";

const Warp = styled.div`
    width: 100vw;
    height: 100vh;
    overflow: hidden;
    position: relative;
`;

const ControlPanel = styled.div`
    position: absolute;
    top: 20px;
    right: 20px;
    background: rgba(0, 0, 0, 0.7);
    color: white;
    padding: 15px;
    border-radius: 8px;
    z-index: 1000;
    font-family: Arial, sans-serif;
`;

const ModeButton = styled.button<{ active: boolean }>`
    background: ${props => props.active ? '#4CAF50' : '#f0f0f0'};
    color: ${props => props.active ? 'white' : 'black'};
    border: none;
    padding: 10px 20px;
    margin: 5px;
    border-radius: 5px;
    cursor: pointer;
    font-size: 14px;
    font-weight: bold;
    transition: all 0.3s;

    &:hover {
        opacity: 0.8;
    }
`;

const SpeedIndicator = styled.div`
    margin-top: 10px;
    padding: 5px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 4px;
    text-align: center;
`;

const Instructions = styled.div`
    position: absolute;
    bottom: 20px;
    left: 20px;
    background: rgba(0, 0, 0, 0.5);
    color: white;
    padding: 10px;
    border-radius: 5px;
    z-index: 1000;
    font-size: 12px;
`;

export interface Demo5Props {}
const meshPath = "/textureMesh/mesh/mesh.ply";
const metaPath = "/textureMesh/mesh/meta.json";
const panoramaDirectory = "/textureMesh/mesh/Panoramas";

type ControlMode = 'orbit' | 'firstPerson';

/**
 * Demo5 - mesh 纹理映射
 */
const Demo5: React.FC<Demo5Props> = () => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const controlsRef = useRef<OrbitControls | null>(null);
    const [initialized, setInitialized] = useState(false);
    const [controlMode, setControlMode] = useState<ControlMode>('orbit');
    const [moveSpeed, setMoveSpeed] = useState(0.1);

    // 第一人称控制相关状态
    const isDraggingRef = useRef(false);
    const lastMousePosRef = useRef({ x: 0, y: 0 });
    const keyStateRef = useRef<{ [key: string]: boolean }>({});

    // 切换控制模式
    const switchControlMode = (mode: ControlMode) => {
        if (!cameraRef.current || !sceneRef.current) return;

        const camera = cameraRef.current;
        const container = containerRef.current!;

        // 保存当前相机位置
        const currentPosition = camera.position.clone();

        // 如果是 OrbitControls，保存其 target
        let currentTarget = new THREE.Vector3(0, 0, 0);
        if (controlsRef.current instanceof OrbitControls) {
            currentTarget = controlsRef.current.target.clone();
        }

        // 清理当前控制器
        if (controlsRef.current) {
            controlsRef.current.dispose();
            controlsRef.current = null;
        }

        // 创建新控制器
        if (mode === 'orbit') {
            const orbitControls = new OrbitControls(camera, container);
            orbitControls.enableZoom = true;
            orbitControls.enablePan = true;
            orbitControls.enableDamping = true;
            orbitControls.dampingFactor = 0.05;
            orbitControls.autoRotate = false;
            orbitControls.enableRotate = true;
            orbitControls.target.copy(currentTarget);

            controlsRef.current = orbitControls;

            // 恢复相机位置
            camera.position.copy(currentPosition);
            orbitControls.target.copy(currentTarget);
            orbitControls.update();
        } else {
            // // 切换到第一人称模式
        }

        setControlMode(mode);
    };

    // 处理鼠标事件
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleMouseDown = (e: MouseEvent) => {
            if (controlMode === 'firstPerson' && e.button === 0) { // 左键
                isDraggingRef.current = true;
                lastMousePosRef.current = { x: e.clientX, y: e.clientY };
                container.style.cursor = 'grabbing';
                e.preventDefault();
            }
        };

        const handleMouseMove = (e: MouseEvent) => {
            if (controlMode === 'firstPerson' && isDraggingRef.current && cameraRef.current) {
                const camera = cameraRef.current;
                const deltaX = e.clientX - lastMousePosRef.current.x;
                const deltaY = e.clientY - lastMousePosRef.current.y;

                const sensitivity = 0.002;

                // 创建水平旋转（绕世界 Y 轴）
                const horizontalQuat = new THREE.Quaternion().setFromAxisAngle(
                    new THREE.Vector3(0, 1, 0),
                    deltaX * sensitivity
                );

                // 创建垂直旋转（绕相机的局部 X 轴）
                const verticalAxis = new THREE.Vector3(1, 0, 0);
                const verticalQuat = new THREE.Quaternion().setFromAxisAngle(
                    verticalAxis,
                    -deltaY * sensitivity
                );

                // 应用旋转
                camera.quaternion.multiplyQuaternions(horizontalQuat, camera.quaternion);
                camera.quaternion.multiply(verticalQuat);

                // 只限制俯仰角，不影响偏航角
                // 将当前四元数转换为欧拉角来检查俯仰角
                const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');

                // 如果俯仰角超出限制，只调整俯仰部分
                if (euler.x > Math.PI / 2) {
                    euler.x = Math.PI / 2;
                    camera.quaternion.setFromEuler(euler);
                } else if (euler.x < -Math.PI / 2) {
                    euler.x = -Math.PI / 2;
                    camera.quaternion.setFromEuler(euler);
                }

                lastMousePosRef.current = { x: e.clientX, y: e.clientY };
            }
        };

        const handleMouseUp = (e: MouseEvent) => {
            if (controlMode === 'firstPerson' && e.button === 0) {
                isDraggingRef.current = false;
                container.style.cursor = 'default';
            }
            lastMousePosRef.current= { x: 0, y: 0 };
        };

        container.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            container.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [controlMode]);

    // 处理鼠标滚轮调整速度
    useEffect(() => {
        const handleWheel = (e: WheelEvent) => {
            if (controlMode === 'firstPerson') {
                e.preventDefault();
                const delta = Math.sign(e.deltaY) * -0.01;
                const newSpeed = Math.max(0.01, Math.min(1.0, moveSpeed + delta));
                setMoveSpeed(newSpeed);
            }
        };

        const container = containerRef.current;
        if (container) {
            container.addEventListener('wheel', handleWheel, { passive: false });
        }

        return () => {
            if (container) {
                container.removeEventListener('wheel', handleWheel);
            }
        };
    }, [controlMode, moveSpeed]);

    // 键盘控制
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (controlMode === 'firstPerson') {
                keyStateRef.current[e.code] = true;

                // 防止页面滚动
                if (['KeyW', 'KeyS', 'KeyA', 'KeyD', 'KeyQ', 'KeyE'].includes(e.code)) {
                    e.preventDefault();
                }
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (controlMode === 'firstPerson') {
                keyStateRef.current[e.code] = false;

                if (['KeyW', 'KeyS', 'KeyA', 'KeyD', 'KeyQ', 'KeyE'].includes(e.code)) {
                    e.preventDefault();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        // 移动更新循环
        let animationId: number;
        const updateMovement = () => {
            if (controlMode === 'firstPerson' && cameraRef.current) {
                const camera = cameraRef.current;

                // 计算移动方向
                const forward = new THREE.Vector3(0, 0, -1);
                const right = new THREE.Vector3(1, 0, 0);
                const up = new THREE.Vector3(0, -1, 0); // 注意：你的场景 Y 轴向下，所以向上移动是 -Y

                forward.applyQuaternion(camera.quaternion);
                right.applyQuaternion(camera.quaternion);

                // WASD 移动
                if (keyStateRef.current['KeyW']) {
                    camera.position.addScaledVector(forward, moveSpeed);
                }
                if (keyStateRef.current['KeyS']) {
                    camera.position.addScaledVector(forward, -moveSpeed);
                }
                if (keyStateRef.current['KeyA']) {
                    camera.position.addScaledVector(right, -moveSpeed);
                }
                if (keyStateRef.current['KeyD']) {
                    camera.position.addScaledVector(right, moveSpeed);
                }

                // QE 上下移动（在 Y 轴方向上）
                if (keyStateRef.current['KeyQ']) {
                    camera.position.y += moveSpeed; // 注意：Y 轴向下，所以 Q 是向下移动
                }
                if (keyStateRef.current['KeyE']) {
                    camera.position.y -= moveSpeed; // Y 轴向下，所以 E 是向上移动
                }
            }

            animationId = requestAnimationFrame(updateMovement);
        };

        animationId = requestAnimationFrame(updateMovement);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            cancelAnimationFrame(animationId);
        };
    }, [controlMode, moveSpeed]);

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

        // =====================
        // Camera
        // =====================
        camera = new THREE.PerspectiveCamera(
            45,
            container.clientWidth / container.clientHeight,
            0.1,
            100
        );
        camera.position.set(3, 2, 5);
        camera.lookAt(0, 0, 0);
        camera.up.set(0, -1, 0); // 保持 Y 轴向下
        cameraRef.current = camera;

        // =====================
        // Controls
        // =====================
        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableZoom = true;
        controls.enablePan = true;
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.autoRotate = false;
        controls.enableRotate = true;
        controls.target.set(0, 0, 0);
        controlsRef.current = controls;

        // =====================
        // Resize
        // =====================
        const onWindowResize = () => {
            camera.aspect = container.clientWidth / container.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(container.clientWidth, container.clientHeight);
        };

        window.addEventListener("resize", onWindowResize);
        setInitialized(true);

        // =====================
        // Animate
        // =====================
        const animate = () => {
            if (controlsRef.current instanceof OrbitControls) {
                controlsRef.current.update();
            }

            renderer.render(scene, camera);
            requestAnimationFrame(animate);
        };

        animate();

        // =====================
        // Cleanup
        // =====================
        return () => {
            window.removeEventListener("resize", onWindowResize);
            if (controlsRef.current) {
                controlsRef.current.dispose();
            }
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
        (async ()=>{
            const exporter = new COLMAPExporter({
                scene: scene,
                meshPath: meshPath,
                metaPath: metaPath,
                panoramaDirectory: panoramaDirectory,
            });
            // 选择导出格式
            // await exporter.exportToCOLMAP();
        })()

    }, [initialized]);

    return (
        <>
            <Warp ref={containerRef} />
            <ControlPanel>
                <h3 style={{ margin: '0 0 10px 0', textAlign: 'center' }}>控制模式</h3>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <ModeButton
                        active={controlMode === 'orbit'}
                        onClick={() => switchControlMode('orbit')}
                    >
                        环绕轨道
                    </ModeButton>
                    <ModeButton
                        active={controlMode === 'firstPerson'}
                        onClick={() => switchControlMode('firstPerson')}
                    >
                        第一人称
                    </ModeButton>
                </div>
                {controlMode === 'firstPerson' && (
                    <SpeedIndicator>
                        移动速度: {moveSpeed.toFixed(2)}
                    </SpeedIndicator>
                )}
            </ControlPanel>
            {controlMode === 'firstPerson' && (
                <Instructions>
                    <div><strong>第一人称控制说明：</strong></div>
                    <div>WASD - 前后左右移动</div>
                    <div>QE - 上下移动</div>
                    <div>鼠标左键拖拽 - 视角旋转</div>
                    <div>鼠标滚轮 - 调整移动速度</div>
                </Instructions>
            )}
        </>
    );
};

export default Demo5;