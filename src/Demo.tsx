import React, { useEffect, useRef, useState } from 'react';
import styled from "styled-components";
import {
    AxesHelper, BackSide, BoxGeometry, BufferGeometry,
    DoubleSide,
    Euler,
    Group, Line, LineBasicMaterial, Matrix4,
    Mesh,
    MeshBasicMaterial,
    PerspectiveCamera,
    Points,
    PointsMaterial,
    Quaternion,
    Scene,
    SphereGeometry,
    TextureLoader,
    Vector3,
    WebGLRenderer
} from "three";
import { Button, Card, Checkbox, Divider, Form, InputNumber, Popover, Slider, Space, Upload } from "antd";
import { DeleteOutlined, EyeInvisibleOutlined, EyeOutlined, ReloadOutlined, UploadOutlined } from '@ant-design/icons';
import { PLYLoader } from "three/examples/jsm/loaders/PLYLoader";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
const { Item } = Form;

// 样式定义
const WarpContainer = styled.div`
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: row;
    position: relative;
`;
const Warp = styled.div`
    width: 50%;
    height: 100%;
    position: relative;
    overflow: hidden;
`;
const ImageWarp = styled.div`
    width: 50%;
    height: 100%;
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    justify-content: center;
    text-align: center;
    align-items: center;
    background-color: black;

    img {
        width: 100%;
        height: 50%
    }
`;
const ControlPanel = styled.div`
    position: absolute;
    top: 20px;
    left: 20px;
    z-index: 100;
    display: flex;
    flex-direction: column;
    gap: 16px;
`;

const StyledCard = styled(Card)`
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(8px);
    border-radius: 8px;
    border: none;

    .ant-card-head {
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);

        .ant-card-head-title {
            font-size: 16px;
        }
    }

    .ant-card-body {
        padding: 16px;
    }

    .ant-form-item {
        margin-bottom: 12px;

        .ant-form-item-label {

            label {
                color: inherit;
            }
        }

        .ant-input, .ant-input-number-input, .ant-input-textarea {
            background: rgba(255, 255, 255, 0.1);
            border-color: rgba(255, 255, 255, 0.2);

            &::placeholder {
            }
        }

        .ant-upload {
            .ant-upload-select {
                background: rgba(255, 255, 255, 0.1);
                border-color: rgba(255, 255, 255, 0.2);
            }


        }
    }
`;

const ToolBar = styled.div`
    position: absolute;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 12px;
    padding: 12px;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(8px);
    border-radius: 8px;
`;

const StatusBar = styled.div`
    position: absolute;
    top: 20px;
    right: 20px;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(8px);
    border-radius: 8px;
    padding: 12px;
    color: #fff;
`;

// 类型定义
export interface CloudPanoramaPositionDemoProps {
}

interface PanoramaConfig {
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number; w: number };
}

/**
 * 点云全景对齐
 * @constructor
 */
const CloudPanoramaPositionDemo: React.FC<CloudPanoramaPositionDemoProps> = () => {
    const warpRef = useRef<HTMLDivElement>(null);
    const panoRef = useRef<Mesh | null>(null);
    const cubeRef = useRef<Mesh | null>(null);
    const pointCloudRef = useRef<Points | null>(null);
    const sceneRef = useRef<Scene | null>(null);
    const cameraRef = useRef<PerspectiveCamera | null>(null);
    const controlsRef = useRef<OrbitControls | null>(null);
    const rendererRef = useRef<WebGLRenderer | null>(null);

    const [ form ] = Form.useForm();
    const [ opacity, setOpacity ] = useState(1);
    const [ showPointCloud, setShowPointCloud ] = useState(true);
    const [ showPanorama, setShowPanorama ] = useState(true);
    const [ isLoaded, setIsLoaded ] = useState(false);
    const position = { x: 0, y: 0, z: 0 };
    const euler = new Euler(0, 0, 0);
    const [ currentPanoramaConfig, setCurrentPanoramaConfig ] = useState<PanoramaConfig>({
        position,
        rotation: new Quaternion().setFromEuler(euler)
    });
    const [ uploadFiles, setUploadFiles ] = useState({
        pointCloud: null as File | null,
        panorama: null as File | null,
        panoramaJson: null as File | null,
    });
    const [ resultImageUrl, setResultImageUrl ] = useState<string | null>(null);
    const imageDomRef = useRef<HTMLImageElement | null>(null);
    const originPanoramaSizeRef = useRef<{ width: number; height: number } | null>(null);
    const pointsRef = useRef<Vector3[]>([]);
    const axesHelperRef = useRef<AxesHelper | null>(null);
    const tempObjGroupRef = useRef<Group >(new Group());
    useEffect(() => {
        if (uploadFiles.panoramaJson) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const json = JSON.parse(e.target?.result as string);
                const newConfig: PanoramaConfig = {
                    position: {
                        x: json.position.x,
                        y: json.position.y,
                        z: json.position.z
                    },
                    rotation: new Quaternion().setFromEuler(new Euler(json.rotation.x, json.rotation.y, json.rotation.z))
                };
                setCurrentPanoramaConfig(newConfig);
                // 修改 form
                form.setFieldsValue({
                    positionX: newConfig.position.x,
                    positionY: newConfig.position.y,
                    positionZ: newConfig.position.z,
                    rotationX: newConfig.rotation.x,
                    rotationY: newConfig.rotation.y,
                    rotationZ: newConfig.rotation.z,
                    rotationW: newConfig.rotation.w
                });
            };
            reader.readAsText(uploadFiles.panoramaJson);

        }

    }, [ uploadFiles.panoramaJson ]);
    useEffect(() => {
        if (!axesHelperRef.current) return;
        const axesHelper = axesHelperRef.current;
        axesHelper.position.copy(currentPanoramaConfig.position);
    }, [ currentPanoramaConfig.position ]);
    // 初始化Three.js场景
    useEffect(() => {
        if (!warpRef.current) return;

        const scene = new Scene();
        sceneRef.current = scene;
        const axesHelper = new AxesHelper(10);
        axesHelper.position.copy(currentPanoramaConfig.position);
        scene.add(axesHelper);
        scene.add(tempObjGroupRef.current);
        axesHelperRef.current = axesHelper;
        const camera = new PerspectiveCamera(
            90,
            warpRef.current.clientWidth / warpRef.current.clientHeight,
            0.1,
            2000
        );


        const cameraPosition = new Vector3(
            currentPanoramaConfig.position.x,
            currentPanoramaConfig.position.y,
            currentPanoramaConfig.position.z
        );
        camera.up.set(0, 0, 1);
        camera.position.copy(cameraPosition);
        cameraRef.current = camera;

        const renderer = new WebGLRenderer({ antialias: true });
        renderer.sortObjects = true;
        renderer.setSize(
            warpRef.current.clientWidth,
            warpRef.current.clientHeight
        );
        renderer.setPixelRatio(window.devicePixelRatio);
        warpRef.current.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.1;
        controls.rotateSpeed = 0.4;
        controls.zoomSpeed = 0.6;
        controls.minDistance = 0.1;
        controls.maxDistance = 500;
        controls.target.copy(cameraPosition);
        controlsRef.current = controls;

        // 动画循环
        const animate = () => {
            requestAnimationFrame(animate);
            controls.update();
            renderer.render(scene, camera);
        };
        animate();

        // 窗口大小调整
        const handleResize = () => {
            if (!warpRef.current || !cameraRef.current || !rendererRef.current) return;
            const w = warpRef.current.clientWidth;
            const h = warpRef.current.clientHeight;
            cameraRef.current.aspect = w / h;
            cameraRef.current.updateProjectionMatrix();
            rendererRef.current.setSize(w, h);
        };

        window.addEventListener("resize", handleResize);

        return () => {
            window.removeEventListener("resize", handleResize);
            renderer.dispose();
            warpRef.current?.removeChild(renderer.domElement);
        };
    }, []);

    // 透明度更新
    useEffect(() => {
        if (panoRef.current) {
            (panoRef.current.material as any).opacity = opacity;
        }
        if (cubeRef.current) {
            if (Array.isArray(cubeRef.current.material)) {
                cubeRef.current.material.forEach((item :any) => {
                    item.opacity = opacity;
                });
            } else {
                cubeRef.current.material.opacity = opacity;
            }
        }
    }, [ opacity ]);

    // 显示/隐藏控制
    useEffect(() => {
        if (pointCloudRef.current) {
            pointCloudRef.current.visible = showPointCloud;
        }
        if (panoRef.current) {
            panoRef.current.visible = showPanorama;
        }
        if (cubeRef.current) {
            cubeRef.current.visible = showPanorama;
        }
    }, [ showPointCloud, showPanorama ]);

    // 处理文件上传
    const handleFileUpload = (type: 'pointCloud' | 'panorama' | "panoramaJson", file: File) => {
        setUploadFiles(prev => ({
            ...prev,
            [type]: file
        }));
        return false; // 阻止默认上传行为
    };

    // 加载点云
    const loadPointCloud = async (file: File) => {
        if (!sceneRef.current) return;

        return new Promise<void>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const arrayBuffer = event.target?.result as ArrayBuffer;
                const plyLoader = new PLYLoader();

                try {
                    const data = plyLoader.parse(arrayBuffer);
                    const positions = data.getAttribute('position');
                    const pointArray: Vector3[] = [];
                    for (let i = 0; i < positions.count; i++) {
                        const x = positions.getX(i);
                        const y = positions.getY(i);
                        const z = positions.getZ(i);
                        pointArray.push(new Vector3(x, y, z));
                    }
                    pointsRef.current = pointArray;
                    const points = new Points(
                        data,
                        new PointsMaterial({
                            vertexColors: true,
                            size: 0.01,
                        })
                    );
                    points.renderOrder = 1;
                    // 移除旧的点云
                    if (pointCloudRef.current) {
                        sceneRef.current?.remove(pointCloudRef.current);
                    }

                    sceneRef.current?.add(points);
                    pointCloudRef.current = points;
                    resolve();
                } catch (error) {
                    console.error('点云加载失败:', error);
                    reject(error);
                }
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    };

    // 加载全景图（球体）
    const loadPanoramaSphere = async (file: File, config: PanoramaConfig) => {
        if (!sceneRef.current) return;

        return new Promise<void>((resolve) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const url = event.target?.result as string;
                const img = new Image();
                img.onload = () => {
                    originPanoramaSizeRef.current = {
                        width: img.width,
                        height: img.height
                    };
                    // 先补全为 2:1 equirectangular
                    const equirectCanvas = ensureEquirectangular2to1(img);

                    // 再把 canvas 转成 dataURL 给 TextureLoader
                    const fixedUrl = equirectCanvas.toDataURL("image/jpeg");
                    setResultImageUrl(fixedUrl);
                    const textureLoader = new TextureLoader();
                    textureLoader.load(fixedUrl, (texture:any) => {

                        texture.flipY = false;
                        const sphereGeo = new SphereGeometry(2, 64, 64);

                        const sphereMat = new MeshBasicMaterial({
                            map: texture,
                            side: DoubleSide,
                            transparent: true,
                            opacity: opacity,
                        });

                        const sphere = new Mesh(sphereGeo, sphereMat);

                        // Matrix transform
                        const matrix = new Matrix4()
                            .multiply(new Matrix4().makeTranslation(
                                config.position.x,
                                config.position.y,
                                config.position.z
                            ));
                        sphere.applyMatrix4(matrix);

                        // Rotation
                        const euler = new Euler().setFromQuaternion(
                            new Quaternion(
                                config.rotation.x,
                                config.rotation.y,
                                config.rotation.z,
                                config.rotation.w
                            )
                                .multiply(new Quaternion().setFromEuler(new Euler(0, Math.PI, 0)))
                        );

                        sphere.setRotationFromEuler(euler);
                        // Remove old pano
                        if (panoRef.current) sceneRef.current?.remove(panoRef.current);
                        if (cubeRef.current) sceneRef.current?.remove(cubeRef.current);

                        panoRef.current = sphere;
                        sceneRef.current?.add(sphere);

                        resolve();
                    });
                };
                img.src = url;
            };
            reader.readAsDataURL(file);
        });
    };

    // 提交表单，加载资源
    const handleSubmit = async () => {
        tempObjGroupRef.current.clear();
        try {
            const values = await form.validateFields();

            // 保存当前全景配置
            const newConfig: PanoramaConfig = {
                position: {
                    x: values.positionX,
                    y: values.positionY,
                    z: values.positionZ
                },
                rotation: {
                    x: values.rotationX,
                    y: values.rotationY,
                    z: values.rotationZ,
                    w: values.rotationW
                }
            };
            setCurrentPanoramaConfig(newConfig);
            setIsLoaded(false);

            // 加载点云（如果有）
            if (uploadFiles.pointCloud) {
                await loadPointCloud(uploadFiles.pointCloud);
            }

            // 加载全景图（必须有）
            if (uploadFiles.panorama) {
                await loadPanoramaSphere(uploadFiles.panorama, newConfig);

                // 相机跳转到全景位置
                if (cameraRef.current) {
                    const cameraPosition = new Vector3(
                        newConfig.position.x,
                        newConfig.position.y,
                        newConfig.position.z
                    );
                    cameraRef.current.position.copy(cameraPosition);
                    if (controlsRef.current) {
                        controlsRef.current.target.copy(cameraPosition);
                    }
                }
            }

            setIsLoaded(true);
        } catch (error) {
            console.error('加载失败:', error);
        }
    };

    // 转换全景图为立方体贴图
    const handleConvertPanoramaToCubemap = async () => {
        if (!uploadFiles.panorama || !panoRef.current) return;

        try {
            // 读取图片文件
            const imgUrl = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target?.result as string);
                uploadFiles.panorama && reader.readAsDataURL(uploadFiles.panorama);
            });

            const result = await convertPanoramaToCubemap(imgUrl, 1024);
            const loader = new TextureLoader();

            const materials = [
                new MeshBasicMaterial({
                    map: loader.load(result.px),
                    side: BackSide,
                    transparent: true,
                    opacity: opacity,
                    depthWrite: false,
                    depthTest: false,
                }),
                new MeshBasicMaterial({
                    map: loader.load(result.nx),
                    side: BackSide,
                    transparent: true,
                    opacity: opacity,
                    depthWrite: false,
                    depthTest: false,
                }),
                new MeshBasicMaterial({
                    map: loader.load(result.py),
                    side: BackSide,
                    transparent: true,
                    opacity: opacity,
                    depthWrite: false,
                    depthTest: false,
                }),
                new MeshBasicMaterial({
                    map: loader.load(result.ny),
                    side: BackSide,
                    transparent: true,
                    opacity: opacity,
                    depthWrite: false,
                    depthTest: false,
                }),
                new MeshBasicMaterial({
                    map: loader.load(result.pz),
                    side: BackSide,
                    transparent: true,
                    opacity: opacity,
                    depthWrite: false,
                    depthTest: false,
                }),
                new MeshBasicMaterial({
                    map: loader.load(result.nz),
                    side: BackSide,
                    transparent: true,
                    opacity: opacity,
                    depthWrite: false,
                    depthTest: false,
                }),
            ];

            const geometry = new BoxGeometry(2, 2, 2);
            const cube = new Mesh(geometry, materials);
            cube.renderOrder = 9998;
            cubeRef.current = cube;

            // 继承原全景的位置和旋转
            cube.position.copy(panoRef.current.position);

            cube.setRotationFromQuaternion(new Quaternion(
                    currentPanoramaConfig.rotation.x,
                    currentPanoramaConfig.rotation.y,
                    currentPanoramaConfig.rotation.z,
                    currentPanoramaConfig.rotation.w
                )
                    .multiply(new Quaternion().setFromEuler(new Euler(Math.PI, 0, 0)))
                    .multiply(new Quaternion().setFromEuler(new Euler(0, Math.PI, 0)))
            );
            // 替换显示
            if (sceneRef.current && panoRef.current) {
                sceneRef.current.remove(panoRef.current);
                sceneRef.current.add(cube);
                panoRef.current = null;
            }
        } catch (error) {
            console.error('转换失败:', error);
        }
    };

    // 恢复相机位置到全景位置
    const resetCameraPosition = () => {
        if (cameraRef.current && controlsRef.current) {
            const cameraPosition = new Vector3(
                currentPanoramaConfig.position.x,
                currentPanoramaConfig.position.y,
                currentPanoramaConfig.position.z
            );
            cameraRef.current.position.copy(cameraPosition);
            controlsRef.current.target.copy(cameraPosition);
        }
    };

    // 移除点云
    const removePointCloud = () => {
        if (pointCloudRef.current && sceneRef.current) {
            sceneRef.current.remove(pointCloudRef.current);
            pointCloudRef.current = null;
            setShowPointCloud(false);
        }
    };

    // 移除全景
    const removePanorama = () => {
        if (panoRef.current && sceneRef.current) {
            sceneRef.current.remove(panoRef.current);
            panoRef.current = null;
        }
        if (cubeRef.current && sceneRef.current) {
            sceneRef.current.remove(cubeRef.current);
            cubeRef.current = null;
        }
        setShowPanorama(false);
    };
    useEffect(() => {
        if (!imageDomRef.current) {
            return;
        }

        const clickEventHandler = (e: MouseEvent) => {
            if (!imageDomRef.current || !originPanoramaSizeRef.current) {
                return;
            }
            const imageRect = imageDomRef.current.getBoundingClientRect();
            console.log(e.offsetX, e.offsetY);
            const realX = (e.offsetX / imageRect.width) * originPanoramaSizeRef.current.width;
            const realY = (e.offsetY / imageRect.height) * originPanoramaSizeRef.current.width / 2;
            const panoramaSize = {
                width: originPanoramaSizeRef.current.width,
                height: originPanoramaSizeRef.current.width / 2, // 全景肯定是2：1
            };
            //  找到对应的三维点击方向，在三维空间中的全景站点位置发送射线，并用 line 渲染出射线
            // 归一化到 0~1
            const u = realX / panoramaSize.width;
            const v = realY / panoramaSize.height;

            // 转成球面（经纬度）
            const phi = u * 2 * Math.PI - Math.PI;      // [-PI, PI]
            const theta = v * Math.PI;                  // [0, PI]

            // 球面转方向向量（以全景内部视角）
            const dirLocal = new Vector3(
                Math.sin(theta) * Math.cos(phi),
                Math.cos(theta),
                Math.sin(theta) * Math.sin(phi)
            );
            const euler = new Euler().setFromQuaternion(
                new Quaternion(
                    currentPanoramaConfig.rotation.x,
                    currentPanoramaConfig.rotation.y,
                    currentPanoramaConfig.rotation.z,
                    currentPanoramaConfig.rotation.w
                )
            );
            const quaternion = new Quaternion().setFromEuler(euler)
                .multiply(new Quaternion().setFromEuler(new Euler(Math.PI, 0, 0)))
                .multiply(new Quaternion().setFromEuler(new Euler(0, Math.PI, 0)));
            const dirWorld = dirLocal.normalize().applyMatrix4(
                new Matrix4().makeRotationFromQuaternion(quaternion)).normalize();
            // 全景中心点
            const origin = new Vector3(
                currentPanoramaConfig.position.x,
                currentPanoramaConfig.position.y,
                currentPanoramaConfig.position.z
            );
            // === 新增：在 Three.js 中渲染一条射线（Line） ===
            const length = 5000;
            const geometry = new BufferGeometry().setFromPoints([
                origin,
                origin.clone().add(dirWorld.clone().multiplyScalar(length))
            ]);

            const material = new LineBasicMaterial({
                color: 0xff0000,
                depthTest: false,
                depthWrite: false,
                transparent: true,
            });
            const line = new Line(geometry, material);
            line.renderOrder = 99999;
            tempObjGroupRef.current?.add(line);


            if (pointsRef.current) {


                const { point: nearestPoint, found } = findNearestPointInAngleRange(
                    pointsRef.current,
                    origin,
                    dirWorld,
                    0.5 * Math.PI / 180,
                );

                if (found && nearestPoint) {
                    const sphereGeo = new SphereGeometry(0.02, 16, 16);
                    const sphereMat = new MeshBasicMaterial({
                        color: 0xffff00,
                        depthTest: false,
                        depthWrite: false,
                        transparent: true,
                    });
                    const hitSphere = new Mesh(sphereGeo, sphereMat);
                    hitSphere.renderOrder = 99999;
                    hitSphere.position.copy(nearestPoint);
                    tempObjGroupRef.current?.add(hitSphere);
                }
            }
        };
        imageDomRef.current.addEventListener("click", clickEventHandler);
        return () => {
            imageDomRef.current?.removeEventListener("click", clickEventHandler);
        };
    }, [ currentPanoramaConfig ]);
    return (
        <WarpContainer>
            <Warp ref={warpRef}>
                <ControlPanel>
                    <Popover
                        content={
                            <StyledCard
                                title="文件上传"
                                bordered={false}
                            >
                                <Form
                                    form={form}
                                    layout="vertical"
                                    initialValues={{
                                        positionX: currentPanoramaConfig.position.x,
                                        positionY: currentPanoramaConfig.position.y,
                                        positionZ: currentPanoramaConfig.position.z,
                                        rotationX: currentPanoramaConfig.rotation.x,
                                        rotationY: currentPanoramaConfig.rotation.y,
                                        rotationZ: currentPanoramaConfig.rotation.z,
                                        rotationW: currentPanoramaConfig.rotation.w,
                                    }}>
                                    <Item label="点云文件（PLY）" name="pointCloud">
                                        <Upload
                                            // name="pointCloud"
                                            accept=".ply"
                                            beforeUpload={(file) => {
                                                handleFileUpload('pointCloud', file);
                                            }}
                                            // showUploadList={{ showPreviewIcon: false }}
                                        >
                                            <Button icon={<UploadOutlined/>} style={{ width: '100%' }}>
                                                选择PLY点云文件
                                            </Button>
                                        </Upload>
                                    </Item>

                                    <Item label="全景图片" name="panorama" rules={[ { required: true, message: '请选择全景图片' } ]}>
                                        <Upload
                                            name="panorama"
                                            accept="image/*"
                                            beforeUpload={(file) => handleFileUpload('panorama', file)}
                                            showUploadList={{ showPreviewIcon: false }}
                                        >
                                            <Button icon={<UploadOutlined/>} style={{ width: '100%' }}>
                                                选择全景图片
                                            </Button>
                                        </Upload>
                                    </Item>
                                    <Item label="全景位姿文件" name="panoramaJson" rules={[ { required: true, message: '请选择全景位姿文件' } ]}>
                                        <Upload
                                            name="panoramaJson"
                                            accept=".json"
                                            beforeUpload={(file) => handleFileUpload('panoramaJson', file)}
                                            showUploadList={{ showPreviewIcon: false }}
                                        >
                                            <Button icon={<UploadOutlined/>} style={{ width: '100%' }}>
                                                选择全景位姿文件
                                            </Button>
                                        </Upload>
                                    </Item>
                                    <Divider style={{ background: 'rgba(255,255,255,0.1)', margin: '16px 0' }}/>

                                    <Item label="全景位置XYZ" style={{ marginBottom: 8 }}>
                                        <Space style={{ width: '100%' }}>
                                            <Item name="positionX" noStyle rules={[ { required: true } ]}>
                                                <InputNumber placeholder="X" step={0.00001} precision={6}/>
                                            </Item>
                                            <Item name="positionY" noStyle rules={[ { required: true } ]}>
                                                <InputNumber placeholder="Y" step={0.00001} precision={6}/>
                                            </Item>
                                            <Item name="positionZ" noStyle rules={[ { required: true } ]}>
                                                <InputNumber placeholder="Z" step={0.00001} precision={6}/>
                                            </Item>
                                        </Space>
                                    </Item>

                                    <Item label="全景旋转（四元数XYZW）" style={{ marginBottom: 8 }}>
                                        <Space style={{ width: '100%' }}>
                                            <Item name="rotationX" noStyle rules={[ { required: true } ]}>
                                                <InputNumber placeholder="X" step={0.0000001} precision={7}/>
                                            </Item>
                                            <Item name="rotationY" noStyle rules={[ { required: true } ]}>
                                                <InputNumber placeholder="Y" step={0.0000001} precision={7}/>
                                            </Item>
                                            <Item name="rotationZ" noStyle rules={[ { required: true } ]}>
                                                <InputNumber placeholder="Z" step={0.0000001} precision={7}/>
                                            </Item>
                                            <Item name="rotationW" noStyle rules={[ { required: true } ]}>
                                                <InputNumber placeholder="W" step={0.0000001} precision={7}/>
                                            </Item>
                                        </Space>
                                    </Item>

                                    <Button
                                        type="primary"
                                        onClick={handleSubmit}
                                        style={{ width: '100%', marginTop: 8 }}
                                    >
                                        加载并显示
                                    </Button>
                                </Form>
                            </StyledCard>
                        }
                        title="Title"
                        trigger="click">
                        <Button>文件上传</Button>
                    </Popover>
                    <Popover
                        content={<StyledCard
                            title="显示控制"
                            bordered={false}
                            style={{ width: 300 }}>
                            <div style={{ marginBottom: 12 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                    <span>全景透明度</span>
                                    <span>{opacity.toFixed(2)}</span>
                                </div>
                                <Slider
                                    min={0}
                                    max={1}
                                    step={0.01}
                                    value={opacity}
                                    onChange={setOpacity}
                                />
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                                <Checkbox
                                    checked={showPointCloud}
                                    onChange={(e) => setShowPointCloud(e.target.checked)}
                                >
                                    显示点云
                                </Checkbox>
                                {pointCloudRef.current && (
                                    <Button
                                        icon={<DeleteOutlined/>}
                                        size="small"
                                        onClick={removePointCloud}
                                        style={{ marginLeft: 8 }}
                                        danger
                                    />
                                )}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                                <Checkbox
                                    checked={showPanorama}
                                    onChange={(e) => setShowPanorama(e.target.checked)}
                                >
                                    显示全景
                                </Checkbox>
                                {(panoRef.current || cubeRef.current) && (
                                    <Button
                                        icon={<DeleteOutlined/>}
                                        size="small"
                                        onClick={removePanorama}
                                        style={{ marginLeft: 8 }}
                                        danger
                                    />
                                )}
                            </div>

                            {(panoRef.current || cubeRef.current) && (
                                <Button
                                    onClick={handleConvertPanoramaToCubemap}
                                    style={{ width: '100%', marginBottom: 8 }}
                                >
                                    转换全景为立方体贴图
                                </Button>
                            )}
                        </StyledCard>} title="Title" trigger="click">
                        <Button>显示控制</Button>
                    </Popover>

                </ControlPanel>

                <ToolBar>
                    <Button
                        icon={<ReloadOutlined/>}
                        onClick={resetCameraPosition}
                        disabled={!isLoaded}
                    >恢复相机到全景位置</Button>
                    <Button
                        icon={showPointCloud ? <EyeOutlined/> : <EyeInvisibleOutlined/>}
                        onClick={() => setShowPointCloud(!showPointCloud)}
                        disabled={!pointCloudRef.current}
                    >{showPointCloud ? "隐藏点云" : "显示点云"}</Button>
                    <Button
                        icon={showPanorama ? <EyeOutlined/> : <EyeInvisibleOutlined/>}
                        onClick={() => setShowPanorama(!showPanorama)}
                        disabled={!(panoRef.current || cubeRef.current)}
                    >{showPanorama ? "隐藏全景" : "显示全景"}</Button>
                </ToolBar>

                <StatusBar>
                    <div>状态: {isLoaded ? '已加载完成' : '未加载'}</div>
                    {pointCloudRef.current && <div>点云: 已加载</div>}
                    {(panoRef.current || cubeRef.current) && <div>全景: 已加载</div>}
                </StatusBar>
            </Warp>

            <ImageWarp>
                <img ref={imageDomRef} src={resultImageUrl ?? ""} alt=""/>
            </ImageWarp>
        </WarpContainer>
    );
};

// 以下是原有的全景图转立方体贴图工具函数
export interface CubemapFaces {
    px: string; // positive X - 右侧 (+X轴方向)
    nx: string; // negative X - 左侧 (-X轴方向)
    py: string; // positive Y - 上方 (+Y轴方向)
    ny: string; // negative Y - 下方 (-Y轴方向)
    pz: string; // positive Z - 前方 (+Z轴方向)
    nz: string; // negative Z - 后方 (-Z轴方向)
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = (e) => reject(e);
        img.src = src;
    });
}

function createCanvas(w: number, h: number): HTMLCanvasElement {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
}

function ensureEquirectangular2to1(img: HTMLImageElement): HTMLCanvasElement {
    const w = img.naturalWidth;
    const h = img.naturalHeight;

    const targetH = Math.floor(w / 2);

    if (h === targetH) {
        const c = createCanvas(w, h);
        c.getContext("2d")!.drawImage(img, 0, 0);
        return c;
    }

    const c = createCanvas(w, targetH);
    const ctx = c.getContext("2d")!;

    ctx.drawImage(img, 0, 0, w, h);

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, h, w, targetH - h);

    return c;
}

function bilinearSample(srcData: ImageData, srcW: number, srcH: number, u: number, v: number) {
    u = u % srcW;
    if (u < 0) u += srcW;
    v = Math.max(0, Math.min(srcH - 1, v));

    const x0 = Math.floor(u);
    const x1 = (x0 + 1) % srcW;
    const y0 = Math.floor(v);
    const y1 = Math.min(srcH - 1, y0 + 1);

    const dx = u - x0;
    const dy = v - y0;

    const idx = (x: number, y: number) => (y * srcW + x) * 4;
    const d = srcData.data;

    function c(off: number) {
        const v00 = d[idx(x0, y0) + off];
        const v10 = d[idx(x1, y0) + off];
        const v01 = d[idx(x0, y1) + off];
        const v11 = d[idx(x1, y1) + off];

        const a = v00 * (1 - dx) + v10 * dx;
        const b = v01 * (1 - dx) + v11 * dx;
        return a * (1 - dy) + b * dy;
    }

    return [ c(0), c(1), c(2), c(3) ];
}

function normalize([ x, y, z ]: [ number, number, number ]): [ number, number, number ] {
    const l = Math.hypot(x, y, z);
    return [ x / l, y / l, z / l ];
}

function dirFromCubeFace(face: string, i: number, j: number, size: number): [ number, number, number ] {
    const a = (2 * (i + 0.5)) / size - 1;
    const b = (2 * (j + 0.5)) / size - 1;
    const y = -b;

    switch (face) {
        case "px":
            return normalize([ 1, y, -a ]);
        case "nx":
            return normalize([ -1, y, a ]);
        case "py":
            return normalize([ a, 1, -y ]);
        case "ny":
            return normalize([ a, -1, y ]);
        case "pz":
            return normalize([ a, y, 1 ]);
        case "nz":
            return normalize([ -a, y, -1 ]);
    }
    return [ 0, 0, 1 ];
}

function dirToUV(vx: number, vy: number, vz: number, srcW: number, srcH: number): [ number, number ] {
    const phi = Math.atan2(vz, vx);
    const theta = Math.acos(vy);

    const u = ((phi + Math.PI) / (2 * Math.PI)) * srcW;
    const v = (theta / Math.PI) * srcH;
    return [ u, v ];
}

async function convertCanvasToBlobURL(canvas: HTMLCanvasElement): Promise<string> {
    return new Promise((resolve) => {
        canvas.toBlob((blob) => {
            if (!blob) throw new Error("toBlob failed");
            resolve(URL.createObjectURL(blob));
        });
    });
}

export async function convertPanoramaToCubemap(
    src: string,
    faceSize: number = 1024,
    minBlurY: number = Infinity,
): Promise<CubemapFaces> {

    const img = await loadImageElement(src);
    const normalized = ensureEquirectangular2to1(img);
    const srcW = normalized.width;
    const srcH = normalized.height;

    const ctxSrc = normalized.getContext("2d")!;
    const srcData = ctxSrc.getImageData(0, 0, srcW, srcH);

    const faceNames = [ "px", "nx", "py", "ny", "pz", "nz" ] as const;
    const output: any = {};

    for (const face of faceNames) {
        const canvas = createCanvas(faceSize, faceSize);
        const ctx = canvas.getContext("2d")!;
        const imgData = ctx.createImageData(faceSize, faceSize);
        const dst = imgData.data;

        for (let j = 0; j < faceSize; j++) {
            for (let i = 0; i < faceSize; i++) {
                const idx = (j * faceSize + i) * 4;

                const [ vx, vy, vz ] = dirFromCubeFace(face, i, j, faceSize);
                const [ u, v ] = dirToUV(vx, vy, vz, srcW, srcH);

                let isOut = false;
                if (face === "ny" && v >= minBlurY) {
                    isOut = true;
                }

                if (isOut) {
                    dst[idx] = 0;
                    dst[idx + 1] = 0;
                    dst[idx + 2] = 0;
                    dst[idx + 3] = 255;
                } else {
                    const [ r, g, b, a ] = bilinearSample(srcData, srcW, srcH, u, v);
                    dst[idx] = r;
                    dst[idx + 1] = g;
                    dst[idx + 2] = b;
                    dst[idx + 3] = a;
                }
            }
        }

        ctx.putImageData(imgData, 0, 0);
        output[face] = await convertCanvasToBlobURL(canvas);
    }

    return output as CubemapFaces;
}

export default CloudPanoramaPositionDemo;

// 添加工具函数：在给定方向角度范围内找到最近点
function findNearestPointInAngleRange(
    points: Vector3[],
    center: Vector3,
    direction: Vector3,
    angleThreshold: number
): { point: Vector3 | null; found: boolean } {
    let nearestPoint: Vector3 | null = null;
    let minDistance = Number.MAX_VALUE;
    let found = false;

    for (const point of points) {
        const pointDir = new Vector3().subVectors(point, center);
        const distance = pointDir.length();
        if (distance < 0.001) continue;

        pointDir.normalize();
        const cosAngle = pointDir.dot(direction);
        const angle = Math.acos(cosAngle); // 弧度
        if (angle <= angleThreshold) {
            if (distance < minDistance) {
                minDistance = distance;
                nearestPoint = point;
                found = true;
            }
        }
    }

    return { point: nearestPoint, found };
}