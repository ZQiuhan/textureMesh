import { ProjectData } from "../declaration/meta";
import * as THREE from "three";
import { Color, Group, Matrix4, Quaternion } from "three";
import { CubemapFaces } from "../Demo";
import { PLYLoader } from "three/examples/jsm/loaders/PLYLoader";

export interface TextureMeshOptions {
    scene: THREE.Scene;
    meshPath: string;
    metaPath: string;
    panoramaDirectory: string;
}

export interface PanoramaPos {
    url: string;
    pos: THREE.Vector3;
    rotation: Quaternion
}

export interface FrustumOptions {
    position: THREE.Vector3;      // 位置
    rotation: THREE.Euler;        // 旋转
    fov: number;                  // 视场角（角度制）
    near?: number;                // near 默认0.1
    far?: number;                 // far 默认1
    frustumColor?: number;        // 视锥体颜色，默认0x00ff00
    textureUrl?: string;          // 远端纹理URL（如果没有提供texture）
    showFarPlaneTexture?: boolean; // 是否在远平面显示纹理，默认true
}

/**
 * 定义六个方向的相机配置
 * 原始模型：Y轴向下（-Y朝上）
 * Three.js：Y轴向上（+Y朝上）
 */
interface CameraDirectionConfig {
    name: string;           // 方向名称
    color: number;          // 视锥体颜色
    lookAt: THREE.Vector3;  // 原始坐标系中的朝向（Y轴向下）
    threeRotation: THREE.Euler; // Three.js中需要的旋转值
    description: string;    // 说明
}

export class TextureMesh {
    meshOptions: TextureMeshOptions;
    panoramaPos: PanoramaPos[] = [];

    constructor(params: TextureMeshOptions) {
        this.meshOptions = params;
    }

    private async parseMeta() {
        const metaPath = this.meshOptions.metaPath;
        // 加载文件为json
        const meta: ProjectData = await fetch(metaPath).then((res) => res.json());
        this.panoramaPos = meta.stationList.map(item => {
            const pos = new THREE.Vector3(item.pose.x, item.pose.y, item.pose.z);
            // meta 中 q0123 对应 zyxw
            const rotation = new Quaternion(item.pose.q2, item.pose.q1, item.pose.q0, item.pose.q3);
            const url = `${this.meshOptions.panoramaDirectory}/${item.stationPanorama}`;
            return {
                url,
                pos,
                rotation
            }
        });
    }

    async start() {
        await this.parseMeta();
        this.loadMesh();
        await this.loadPanorama();
    }

    loadMesh() {
        const { scene, meshPath } = this.meshOptions;
        const plyLoader = new PLYLoader();
        plyLoader.load(
            meshPath,
            (geometry) => {
                // 计算法线以获得正确光照效果
                geometry.computeVertexNormals();

                // 方法1：使用默认材质
                const material = new THREE.MeshStandardMaterial({
                    color: 0xffffff,
                    vertexColors: geometry.hasAttribute('color'), // 如果PLY包含顶点颜色
                    flatShading: true, // 设为true可以显示三角面片效果
                    side: THREE.DoubleSide, // 如果需要双面渲染
                    opacity: 0.5,
                    transparent: true,
                });

                const mesh = new THREE.Mesh(geometry, material);
                scene.add(mesh);

                // 如果需要显示三角面片的边框
                this.addWireframe(mesh, geometry);
            },
            (xhr) => {
                // 加载进度
                console.log((xhr.loaded / xhr.total * 100) + '% loaded');
            },
            (error) => {
                console.error('加载PLY失败:', error);
            }
        );
    }

    async loadPanorama() {
        const { scene } = this.meshOptions;

        for (let i = 0; i < this.panoramaPos.length; i++) {
            if(i!=2){
                continue
            }
            const { url, pos } = this.panoramaPos[i];
            const originalRotation = this.panoramaPos[i].rotation;
            const cubeMap = await TextureMesh.convertPanoramaToCubemap(url, 512);

            const directions = [
                {
                    name: '上',
                    key: 'py',
                    color: 0x4287f5, // 蓝色
                    rotation: new THREE.Euler(-Math.PI / 2, 0, Math.PI / 2), // 向上看
                },
                {
                    name: '下',
                    key: 'ny',
                    color: 0xf5a442, // 橙色
                    rotation: new THREE.Euler(Math.PI / 2, 0, -Math.PI / 2), // 向下看
                },
                {
                    name: '左',
                    key: 'nx',
                    color: 0x42f554, // 绿色
                    rotation: new THREE.Euler(0, 0, Math.PI), // 向左看
                },
                {
                    name: '右',
                    key: 'px',
                    color: 0xf54242, // 红色
                    rotation: new THREE.Euler(0, Math.PI, Math.PI), // 向右看
                },
                {
                    name: '前',
                    key: 'pz',
                    color: 0xf5e642, // 黄色
                    rotation: new THREE.Euler(0, -Math.PI / 2, Math.PI), // 向前看
                },
                {
                    name: '后',
                    key: 'nz',
                    color: 0xbf42f5, // 紫色
                    rotation: new THREE.Euler(0, Math.PI / 2, Math.PI), // 向后看
                }
            ];
            directions.forEach(item => {
                const { name, key, color, rotation } = item;
                // @ts-ignore
                const textureUrl = cubeMap[key];
                const euler = new THREE.Euler()
                    .setFromRotationMatrix(
                        new Matrix4()
                            .makeRotationFromQuaternion(originalRotation)
                            .multiply(new Matrix4().makeRotationFromEuler(rotation))
                    );
                const frustum = TextureMesh.createFrustum({
                    position: pos,
                    rotation: euler,
                    near: 0.1,
                    far: 0.5,
                    fov: 90,
                    frustumColor: color,
                    textureUrl: textureUrl,
                    showFarPlaneTexture: true
                })
                scene.add(frustum);

            })
        }
    }

    static createFrustum(option: FrustumOptions): Group {
        const {
            position,
            rotation,
            near = 0.1,
            far = 1,
            fov,
            frustumColor = 0x00ff00,
            textureUrl,
            showFarPlaneTexture
        } = option;

        const camera = new THREE.PerspectiveCamera(fov, 1, near, far);
        camera.position.copy(position);
        camera.rotation.copy(rotation);

        const frustumHelper = new THREE.CameraHelper(camera);
        if (frustumColor) {
            const color = new Color(frustumColor);
            frustumHelper.setColors(color, color, color, color, color);
        }

        const group = new Group();
        group.add(frustumHelper);

        if (textureUrl && showFarPlaneTexture) {
            // 计算远平面的尺寸
            const farHeight = 2 * Math.tan((fov * Math.PI) / 360) * far;
            const farWidth = farHeight; // aspect = 1

            // 创建平面几何体
            const geometry = new THREE.PlaneGeometry(farWidth, farHeight);

            // 加载纹理
            const texture = new THREE.TextureLoader().load(textureUrl);
            // texture.flipY = true
            const material = new THREE.MeshBasicMaterial({
                map: texture,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.8,
            });

            const farPlaneMesh = new THREE.Mesh(geometry, material);

            // 将平面放置在远平面位置（沿相机的局部Z轴正向）
            farPlaneMesh.position.set(0, 0, -far);
            farPlaneMesh.rotation.y = Math.PI;
            // 将远平面添加到camera对象上，这样它会跟随相机的位置和旋转
            camera.add(farPlaneMesh);

            // 将相机添加到group而不是直接添加frustumHelper
            // 注意：需要重新组织group结构
            group.clear();
            group.add(camera);
            group.add(frustumHelper);
        }

        return group;
    }


    addWireframe(mesh: THREE.Mesh, geometry: THREE.BufferGeometry) {
        // 方法A：使用EdgesGeometry + LineSegments
        const edges = new THREE.EdgesGeometry(geometry);
        const line = new THREE.LineSegments(
            edges,
            new THREE.LineBasicMaterial({ color: 0x000000 })
        );
        mesh.add(line); // 将线框添加为mesh的子元素
    }


    static async convertPanoramaToCubemap(
        src: string,
        faceSize: number = 1024,
        minBlurY: number = Infinity,
    ): Promise<CubemapFaces> {

        const img = await this.loadImageElement(src);
        const normalized = this.ensureEquirectangular2to1(img);
        const srcW = normalized.width;
        const srcH = normalized.height;

        const ctxSrc = normalized.getContext("2d")!;
        const srcData = ctxSrc.getImageData(0, 0, srcW, srcH);

        const faceNames = [ "px", "nx", "py", "ny", "pz", "nz" ] as const;
        const output: any = {};

        for (const face of faceNames) {
            const canvas = this.createCanvas(faceSize, faceSize);
            const ctx = canvas.getContext("2d")!;
            const imgData = ctx.createImageData(faceSize, faceSize);
            const dst = imgData.data;

            for (let j = 0; j < faceSize; j++) {
                for (let i = 0; i < faceSize; i++) {
                    const idx = (j * faceSize + i) * 4;

                    const [ vx, vy, vz ] = this.dirFromCubeFace(face, i, j, faceSize);
                    const [ u, v ] = this.dirToUV(vx, vy, vz, srcW, srcH);

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
                        const [ r, g, b, a ] = this.bilinearSample(srcData, srcW, srcH, u, v);
                        dst[idx] = r;
                        dst[idx + 1] = g;
                        dst[idx + 2] = b;
                        dst[idx + 3] = a;
                    }
                }
            }

            ctx.putImageData(imgData, 0, 0);
            output[face] = await this.convertCanvasToBlobURL(canvas);
        }

        return output as CubemapFaces;
    }

    static async loadImageElement(src: string): Promise<HTMLImageElement> {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => resolve(img);
            img.onerror = (e) => reject(e);
            img.src = src;
        });
    }

    static ensureEquirectangular2to1(img: HTMLImageElement): HTMLCanvasElement {
        const w = img.naturalWidth;
        const h = img.naturalHeight;

        const targetH = Math.floor(w / 2);

        if (h === targetH) {
            const c = this.createCanvas(w, h);
            c.getContext("2d")!.drawImage(img, 0, 0);
            return c;
        }

        const c = this.createCanvas(w, targetH);
        const ctx = c.getContext("2d")!;

        ctx.drawImage(img, 0, 0, w, h);

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, h, w, targetH - h);

        return c;
    }

    static createCanvas(w: number, h: number): HTMLCanvasElement {
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        return c;
    }

    static dirFromCubeFace(face: string, i: number, j: number, size: number): [ number, number, number ] {
        const a = (2 * (i + 0.5)) / size - 1;
        const b = (2 * (j + 0.5)) / size - 1;
        const y = -b;

        switch (face) {
            case "px":
                return this.normalize([ 1, y, -a ]);
            case "nx":
                return this.normalize([ -1, y, a ]);
            case "py":
                return this.normalize([ a, 1, -y ]);
            case "ny":
                return this.normalize([ a, -1, y ]);
            case "pz":
                return this.normalize([ a, y, 1 ]);
            case "nz":
                return this.normalize([ -a, y, -1 ]);
        }
        return [ 0, 0, 1 ];
    }

    static normalize([ x, y, z ]: [ number, number, number ]): [ number, number, number ] {
        const l = Math.hypot(x, y, z);
        return [ x / l, y / l, z / l ];
    }

    static bilinearSample(srcData: ImageData, srcW: number, srcH: number, u: number, v: number) {
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

    static async convertCanvasToBlobURL(canvas: HTMLCanvasElement): Promise<string> {
        return new Promise((resolve) => {
            canvas.toBlob((blob) => {
                if (!blob) throw new Error("toBlob failed");
                resolve(URL.createObjectURL(blob));
            });
        });
    }

    static dirToUV(vx: number, vy: number, vz: number, srcW: number, srcH: number): [ number, number ] {
        const phi = Math.atan2(vz, vx);
        const theta = Math.acos(vy);

        const u = ((phi + Math.PI) / (2 * Math.PI)) * srcW;
        const v = (theta / Math.PI) * srcH;
        return [ u, v ];
    }
}