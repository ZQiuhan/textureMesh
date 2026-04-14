import { TextureMesh } from "./TextureMesh";
import * as THREE from 'three';
import { Matrix4, Vector3 } from "three";
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter';
import { PLYLoader } from "three/examples/jsm/loaders/PLYLoader";

export class TextureProjector extends TextureMesh {
    private texturedMesh: THREE.Mesh | null = null;
    private projectionCameras: THREE.Camera[] = [];
    private cubemapFaceTextures: THREE.Texture[][] = [];
    private cameraAssignments: Map<number, number> = new Map(); // 顶点索引 -> 相机索引

    async projectTexturesAndExport() {
        await this.parseMeta();
        await this.loadMesh();

        // 加载全景图并转换为立方体贴图面纹理
        await this.loadCubemapFaces();

        // 创建投影相机（每个位置6个方向）
        this.createProjectionCameras();

        // 烘焙纹理到UV
        await this.bakeProjectedTextures();

        // 导出模型
        await this.exportTexturedModel();
    }

    async loadMesh(): Promise<THREE.Mesh> {
        return new Promise((resolve, reject) => {
            const { meshPath } = this.meshOptions;
            const loader = new PLYLoader();

            loader.load(
                meshPath,
                (geometry) => {
                    geometry.computeVertexNormals();

                    // 确保几何体有索引
                    if (!geometry.index) {
                        console.warn("几何体没有索引，将创建索引");
                        const positionCount = geometry.attributes.position.count;
                        const indices = [];
                        for (let i = 0; i < positionCount; i += 3) {
                            indices.push(i, i + 1, i + 2);
                        }
                        geometry.setIndex(indices);
                    }

                    const material = new THREE.MeshStandardMaterial({
                        color: 0xffffff,
                        side: THREE.DoubleSide,
                        roughness: 0.5,
                        metalness: 0.1
                    });

                    this.texturedMesh = new THREE.Mesh(geometry, material);
                    this.meshOptions.scene.add(this.texturedMesh);

                    resolve(this.texturedMesh);
                },
                undefined,
                reject
            );
        });
    }

    async loadCubemapFaces() {
        console.log("加载全景图并转换为立方体贴图面...");
        const loader = new THREE.TextureLoader();

        for (let i = 0; i < this.panoramaPos.length; i++) {
            const { url } = this.panoramaPos[i];

            // 调用基类静态方法获取6个面的 Blob URL
            const faceBlobUrls = await TextureMesh.convertPanoramaToCubemap(url, 1024,Infinity,true,true);

            const faceTextures: THREE.Texture[] = [];
            const faceKeys = this.getCameraDirections().map(item=>item.name) ;

            for (const key of faceKeys) {
                const texture = await new Promise<THREE.Texture>((resolve, reject) => {
                    loader.load(
                        // @ts-ignore
                        faceBlobUrls[key],
                        (tex) => {
                            tex.wrapS = THREE.ClampToEdgeWrapping;
                            tex.wrapT = THREE.ClampToEdgeWrapping;
                            tex.minFilter = THREE.LinearFilter;
                            tex.magFilter = THREE.LinearFilter;
                            tex.colorSpace = THREE.SRGBColorSpace;
                            resolve(tex);
                        },
                        undefined,
                        reject
                    );
                });
                faceTextures.push(texture);
            }

            this.cubemapFaceTextures.push(faceTextures);
            console.log(`位置 ${i+1}/${this.panoramaPos.length} 的立方体贴图加载完成`);
        }
    }

    createProjectionCameras() {
        console.log("创建投影相机...");
        const directions = this.getCameraDirections();

        for (let i = 0; i < this.panoramaPos.length; i++) {
            const { pos, rotation } = this.panoramaPos[i];

            for (let j = 0; j < directions.length; j++) {
                const dir = directions[j];
                const camera = new THREE.PerspectiveCamera(90, 1, 0.1, 100);
                camera.position.copy(pos);

                // 使用四元数计算旋转（避免欧拉角顺序问题）
                const dirQuat = new THREE.Quaternion().setFromEuler(dir.rotation);
                const finalQuat = rotation.clone().multiply(dirQuat);
                camera.quaternion.copy(finalQuat);

                camera.updateMatrixWorld();
                camera.updateProjectionMatrix();

                this.projectionCameras.push(camera);
            }
        }

        console.log(`创建了 ${this.projectionCameras.length} 个投影相机`);
    }

    getCameraDirections() {
        return [
            // 右 (px)
            { name: 'px', rotation: new THREE.Euler(0, Math.PI, Math.PI) },
            // 左 (nx)
            { name: 'nx', rotation: new THREE.Euler(0, 0, Math.PI) },
            // 上 (py)
            // { name: 'py', rotation: new THREE.Euler(-Math.PI / 2, 0, Math.PI / 2) },
            // 下 (ny)
            // { name: 'ny', rotation: new THREE.Euler(Math.PI / 2, 0, -Math.PI / 2) },
            // // 前 (pz)
            // { name: 'pz', rotation: new THREE.Euler(0, -Math.PI / 2, Math.PI) },
            // // 后 (nz)
            // { name: 'nz', rotation: new THREE.Euler(0, Math.PI / 2, Math.PI) }
        ];
    }
    async bakeProjectedTextures() {
        if (!this.texturedMesh) return;
        console.log("开始烘焙纹理...");

        const geometry = this.texturedMesh.geometry;
        const positionAttr = geometry.attributes.position;
        const indexAttr = geometry.index;

        if (!indexAttr) {
            console.warn("几何体没有索引");
            return;
        }

        const vertexCount = positionAttr.count;
        const triangleCount = indexAttr.count / 3;
        const uvs = new Float32Array(vertexCount * 2);

        // 初始化UV为默认值
        for (let i = 0; i < vertexCount; i++) {
            uvs[i * 2] = 0.5;
            uvs[i * 2 + 1] = 0.5;
        }

        // 遍历每个三角形
        for (let tri = 0; tri < triangleCount; tri++) {
            const i1 = indexAttr.getX(tri * 3);
            const i2 = indexAttr.getX(tri * 3 + 1);
            const i3 = indexAttr.getX(tri * 3 + 2);

            // 获取三角形三个顶点
            const v1 = new THREE.Vector3(
                positionAttr.getX(i1),
                positionAttr.getY(i1),
                positionAttr.getZ(i1)
            );
            const v2 = new THREE.Vector3(
                positionAttr.getX(i2),
                positionAttr.getY(i2),
                positionAttr.getZ(i2)
            );
            const v3 = new THREE.Vector3(
                positionAttr.getX(i3),
                positionAttr.getY(i3),
                positionAttr.getZ(i3)
            );

            // 找到能让整个三角形可见的相机
            let bestCameraIdx = -1;

            for (let camIdx = 0; camIdx < this.projectionCameras.length; camIdx++) {
                const camera = this.projectionCameras[camIdx];

                // 检查三个顶点是否都在视锥体内
                const proj1 = v1.clone().project(camera);
                const proj2 = v2.clone().project(camera);
                const proj3 = v3.clone().project(camera);

                const isVisible1 = proj1.x >= -1 && proj1.x <= 1 &&
                    proj1.y >= -1 && proj1.y <= 1 &&
                    proj1.z >= -1 && proj1.z <= 1;
                const isVisible2 = proj2.x >= -1 && proj2.x <= 1 &&
                    proj2.y >= -1 && proj2.y <= 1 &&
                    proj2.z >= -1 && proj2.z <= 1;
                const isVisible3 = proj3.x >= -1 && proj3.x <= 1 &&
                    proj3.y >= -1 && proj3.y <= 1 &&
                    proj3.z >= -1 && proj3.z <= 1;

                if (isVisible1 && isVisible2 && isVisible3) {
                    bestCameraIdx = camIdx;
                    break; // 找到第一个可用的相机就使用
                }
            }

            if (bestCameraIdx !== -1) {
                const camera = this.projectionCameras[bestCameraIdx];
                const region = this.getAtlasRegion(bestCameraIdx);

                // 投影三个顶点并设置UV
                const vertices = [i1, i2, i3];
                const points = [v1, v2, v3];

                for (let j = 0; j < 3; j++) {
                    const vertexIdx = vertices[j];
                    const projected = points[j].clone().project(camera);

                    // 转换到UV坐标
                    const u = (projected.x + 1) / 2;
                    const v = (1 - projected.y) / 2;

                    uvs[vertexIdx * 2] = region.uOffset + u * region.uScale;
                    uvs[vertexIdx * 2 + 1] = region.vOffset + v * region.vScale;
                }
            }
        }

        // 应用UV
        geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

        // 创建纹理图集
        const atlasTexture = await this.createTextureAtlasFromFaces();

        // 应用烘焙材质
        this.texturedMesh.material = new THREE.MeshStandardMaterial({
            map: atlasTexture,
            side: THREE.DoubleSide,
            roughness: 0.5,
            metalness: 0.1
        });

        console.log("纹理烘焙完成！");
    }

    getAtlasRegion(cameraIndex: number): { uOffset: number; vOffset: number; uScale: number; vScale: number } {
        const total = this.projectionCameras.length;
        const cols = Math.ceil(Math.sqrt(total));
        const rows = Math.ceil(total / cols);

        const col = cameraIndex % cols;
        const row = Math.floor(cameraIndex / cols);

        return {
            uOffset: col / cols,
            vOffset: row / rows,
            uScale: 1 / cols,
            vScale: 1 / rows
        };
    }

    async createTextureAtlasFromFaces(): Promise<THREE.Texture> {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        const atlasSize = 4096;
        canvas.width = atlasSize;
        canvas.height = atlasSize;

        const total = this.projectionCameras.length;
        const cols = Math.ceil(Math.sqrt(total));
        const rows = Math.ceil(total / cols);
        const cellWidth = atlasSize / cols;
        const cellHeight = atlasSize / rows;

        // 填充背景色
        ctx.fillStyle = '#808080';
        ctx.fillRect(0, 0, atlasSize, atlasSize);

        for (let i = 0; i < total; i++) {
            const posIndex = Math.floor(i / 6);
            const faceIndex = i % 6;
            const texture = this.cubemapFaceTextures[posIndex][faceIndex];

            const img = await this.textureToImage(texture);
            const col = i % cols;
            const row = Math.floor(i / cols);

            // 绘制纹理到图集
            ctx.drawImage(
                img,
                col * cellWidth,
                row * cellHeight,
                cellWidth,
                cellHeight
            );
        }

        const atlasTexture = new THREE.CanvasTexture(canvas);
        atlasTexture.wrapS = THREE.ClampToEdgeWrapping;
        atlasTexture.wrapT = THREE.ClampToEdgeWrapping;
        atlasTexture.minFilter = THREE.LinearMipmapLinearFilter;
        atlasTexture.magFilter = THREE.LinearFilter;
        atlasTexture.colorSpace = THREE.SRGBColorSpace;
        atlasTexture.needsUpdate = true;

        return atlasTexture;
    }

    async textureToImage(texture: THREE.Texture): Promise<HTMLImageElement> {
        return new Promise((resolve) => {
            const img = new Image();
            if (texture.image instanceof HTMLImageElement) {
                img.src = texture.image.src;
                img.onload = () => resolve(img);
            } else if (texture.image instanceof ImageBitmap) {
                const canvas = document.createElement('canvas');
                canvas.width = texture.image.width;
                canvas.height = texture.image.height;
                const ctx = canvas.getContext('2d')!;
                ctx.drawImage(texture.image, 0, 0);
                img.src = canvas.toDataURL();
                img.onload = () => resolve(img);
            } else {
                const canvas = document.createElement('canvas');
                canvas.width = texture.image.width || 1024;
                canvas.height = texture.image.height || 1024;
                const ctx = canvas.getContext('2d')!;
                ctx.drawImage(texture.image, 0, 0);
                img.src = canvas.toDataURL();
                img.onload = () => resolve(img);
            }
        });
    }

    async exportTexturedModel() {
        if (!this.texturedMesh) {
            throw new Error("没有可导出的模型");
        }

        console.log("导出带纹理的模型...");

        const exportScene = new THREE.Scene();
        exportScene.add(this.texturedMesh.clone());

        await this.exportAsOBJ(exportScene);
        await this.exportAsGLTF(exportScene);
        await this.exportTextures();
    }

    async exportAsOBJ(scene: THREE.Scene) {
        const exporter = new OBJExporter();
        const objData = exporter.parse(scene);

        const blob = new Blob([objData], { type: 'text/plain' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'textured_model.obj';
        link.click();

        console.log("OBJ文件已导出");
    }

    async exportAsGLTF(scene: THREE.Scene) {
        const exporter = new GLTFExporter();

        exporter.parse(
            scene,
            (gltf) => {
                const output = JSON.stringify(gltf, null, 2);
                const blob = new Blob([output], { type: 'application/json' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = 'textured_model.gltf';
                link.click();
            },
            (error) => {
                console.error('GLTF导出错误:', error);
            },
            { binary: false, embedImages: true }
        );

        console.log("GLTF文件已导出");
    }

    async exportTextures() {
        if (this.texturedMesh && this.texturedMesh.material) {
            const material = this.texturedMesh.material as THREE.MeshStandardMaterial;
            if (material.map) {
                const texture = material.map;
                const img = await this.textureToImage(texture);
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d')!;
                ctx.drawImage(img, 0, 0);

                canvas.toBlob((blob) => {
                    if (blob) {
                        const link = document.createElement('a');
                        link.href = URL.createObjectURL(blob);
                        link.download = 'texture_atlas.png';
                        link.click();
                    }
                });
            }
        }
    }

    async start() {
        await super.start();
        await this.projectTexturesAndExport();
    }
}