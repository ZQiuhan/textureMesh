import { TextureMesh } from "./TextureMesh";
import * as THREE from 'three';
import { Matrix4 } from "three";
import JSZip from "jszip";
import { PLYLoader } from "three/examples/jsm/loaders/PLYLoader";

export class COLMAPExporter extends TextureMesh {
    private mesh: THREE.Mesh | null = null;

    async exportToCOLMAP(outputPath: string = 'colmap_project') {
        await this.parseMeta();

        // 加载并保存mesh引用
        await this.loadMeshForExport();

        const files: Map<string, Blob | string> = new Map();

        // 创建文件夹结构
        const imageFiles: Map<string, Blob> = new Map();

        // 1. 生成并导出图片
        await this.exportPanoramaImages(imageFiles);

        // 2. 生成 cameras.txt
        const camerasContent = this.generateCamerasTxt();
        files.set('cameras.txt', camerasContent);

        // 3. 生成 images.txt（使用mesh顶点作为3D点）
        const imagesContent = await this.generateImagesTxtWithMeshPoints();
        files.set('images.txt', imagesContent);

        // 4. 生成 points3D.txt（从mesh提取）
        const points3DContent = await this.generatePoints3DFromMesh();
        files.set('points3D.txt', points3DContent);

        // 5. 生成 project.ini
        const projectIni = this.generateProjectIni();
        files.set('project.ini', projectIni);

        // 下载所有文件
        await this.downloadCOLMAPProject(files, imageFiles, outputPath);
    }

    async loadMeshForExport(): Promise<void> {
        return new Promise((resolve, reject) => {
            const { scene } = this.meshOptions;

            // 尝试从场景中获取mesh
            const mesh = scene.children.find(child => child instanceof THREE.Mesh) as THREE.Mesh;

            if (mesh) {
                this.mesh = mesh;
                resolve();
            } else {
                // 如果场景中还没有，需要加载
                const { meshPath } = this.meshOptions;
                const loader = new PLYLoader();
                loader.load(
                    meshPath,
                    (geometry) => {
                        geometry.computeVertexNormals();
                        const material = new THREE.MeshStandardMaterial({
                            color: 0xffffff,
                            vertexColors: geometry.hasAttribute('color'),
                        });
                        this.mesh = new THREE.Mesh(geometry, material);
                        resolve();
                    },
                    undefined,
                    reject
                );
            }
        });
    }

    async exportPanoramaImages(imageFiles: Map<string, Blob>): Promise<void> {
        for (let i = 0; i < this.panoramaPos.length; i++) {
            const { url } = this.panoramaPos[i];

            // 转换全景图为cubemap
            const cubeMap = await TextureMesh.convertPanoramaToCubemap(url, 1024);

            const directions = [
                { name: 'up', key: 'py' },
                { name: 'down', key: 'ny' },
                { name: 'left', key: 'nx' },
                { name: 'right', key: 'px' },
                { name: 'front', key: 'pz' },
                { name: 'back', key: 'nz' }
            ];

            for (const dir of directions) {
                const imageUrl = cubeMap[dir.key as keyof typeof cubeMap];
                const response = await fetch(imageUrl);
                const blob = await response.blob();
                imageFiles.set(`images/camera_${i}_${dir.name}.jpg`, blob);
            }
        }
    }

    generateCamerasTxt(): string {
        let content = "# Camera list with one line of data per camera:\n";
        content += "# CAMERA_ID, MODEL, WIDTH, HEIGHT, PARAMS[]\n";

        const fov = 90;
        const width = 1024;
        const height = 1024;
        const f = width / (2 * Math.tan((fov * Math.PI) / 360));
        const cx = width / 2;
        const cy = height / 2;

        content += `1 PINHOLE ${width} ${height} ${f.toFixed(6)} ${f.toFixed(6)} ${cx.toFixed(6)} ${cy.toFixed(6)}\n`;

        return content;
    }

    async generateImagesTxtWithMeshPoints(): Promise<string> {
        let content = "# Image list with two lines of data per image:\n";
        content += "# IMAGE_ID, QW, QX, QY, QZ, TX, TY, TZ, CAMERA_ID, NAME\n";
        content += "# POINTS2D[] as (X, Y, POINT3D_ID)\n";

        let imageId = 1;
        const directions = this.getCameraDirections();

        // 从mesh提取3D点
        const points3D = this.extractPointsFromMesh();

        for (let i = 0; i < this.panoramaPos.length; i++) {
            const { pos, rotation } = this.panoramaPos[i];

            for (let j = 0; j < directions.length; j++) {
                const dir = directions[j];

                // 计算相机姿态
                const cameraRotation = new THREE.Euler()
                    .setFromRotationMatrix(
                        new Matrix4()
                            .makeRotationFromQuaternion(rotation)
                            .multiply(new Matrix4().makeRotationFromEuler(dir.rotation))
                    );

                const quaternion = new THREE.Quaternion().setFromEuler(cameraRotation);

                // 第一行：图像信息
                content += `${imageId} `;
                content += `${quaternion.w.toFixed(6)} ${quaternion.x.toFixed(6)} `;
                content += `${quaternion.y.toFixed(6)} ${quaternion.z.toFixed(6)} `;
                content += `${pos.x.toFixed(6)} ${pos.y.toFixed(6)} ${pos.z.toFixed(6)} `;
                content += `1 `; // camera_id
                content += `camera_${i}_${dir.name}.jpg\n`;

                // 第二行：投影3D点到该相机
                const keypoints = this.projectPointsToCamera(points3D, pos, cameraRotation);
                if (keypoints.length > 0) {
                    for (const kp of keypoints) {
                        content += `${kp.x.toFixed(2)} ${kp.y.toFixed(2)} ${kp.point3D_id} `;
                    }
                }
                content += `\n`;

                imageId++;
            }
        }

        return content;
    }

    extractPointsFromMesh(): Array<{id: number, pos: THREE.Vector3, color: THREE.Color}> {
        if (!this.mesh) {
            console.warn('Mesh not loaded, using sample points');
            return this.generateSample3DPoints();
        }

        const points: Array<{id: number, pos: THREE.Vector3, color: THREE.Color}> = [];
        const geometry = this.mesh.geometry;
        const positionAttribute = geometry.attributes.position;
        const colorAttribute = geometry.attributes.color;

        const vertexCount = positionAttribute.count;

        // 采样顶点（如果顶点太多，可以降采样）
        const sampleRate = Math.max(1, Math.floor(vertexCount / 5000)); // 最多5000个点

        for (let i = 0; i < vertexCount; i += sampleRate) {
            const pos = new THREE.Vector3(
                positionAttribute.getX(i),
                positionAttribute.getY(i),
                positionAttribute.getZ(i)
            );

            let color = new THREE.Color(0x808080); // 默认灰色
            if (colorAttribute) {
                color = new THREE.Color(
                    colorAttribute.getX(i),
                    colorAttribute.getY(i),
                    colorAttribute.getZ(i)
                );
            }

            points.push({
                id: points.length + 1,
                pos: pos,
                color: color
            });
        }

        console.log(`Extracted ${points.length} points from mesh`);
        return points;
    }

    async generatePoints3DFromMesh(): Promise<string> {
        let content = "# 3D point list with one line of data per point:\n";
        content += "# POINT3D_ID, X, Y, Z, R, G, B, ERROR, TRACK[] as (IMAGE_ID, POINT2D_IDX)\n";

        const points3D = this.extractPointsFromMesh();
        const directions = this.getCameraDirections();

        // 为每个3D点计算它在哪些相机中可见
        for (const point of points3D) {
            content += `${point.id} `;
            content += `${point.pos.x.toFixed(6)} ${point.pos.y.toFixed(6)} ${point.pos.z.toFixed(6)} `;

            // 颜色 (0-255)
            const r = Math.floor(point.color.r * 255);
            const g = Math.floor(point.color.g * 255);
            const b = Math.floor(point.color.b * 255);
            content += `${r} ${g} ${b} `;

            // 误差（设为较小值）
            content += `0.5 `;

            // 追踪信息：哪些图像观测到了这个点
            let imageId = 1;
            const tracks: string[] = [];

            for (let i = 0; i < this.panoramaPos.length; i++) {
                const { pos, rotation } = this.panoramaPos[i];

                for (let j = 0; j < directions.length; j++) {
                    const dir = directions[j];
                    const cameraRotation = new THREE.Euler()
                        .setFromRotationMatrix(
                            new Matrix4()
                                .makeRotationFromQuaternion(rotation)
                                .multiply(new Matrix4().makeRotationFromEuler(dir.rotation))
                        );

                    // 检查点是否在相机视野内
                    const projected = this.projectSinglePoint(point, pos, cameraRotation);
                    if (projected) {
                        // 这里POINT2D_IDX是特征点在该图像中的索引
                        // 简化起见，设为0（表示第一个特征点）
                        tracks.push(`${imageId} 0`);
                    }

                    imageId++;
                }
            }

            // 至少需要2个观测
            if (tracks.length >= 2) {
                content += tracks.join(' ') + '\n';
            } else {
                // 如果观测太少，仍然保留点但只写一个空追踪
                content += '\n';
            }
        }

        return content;
    }

    projectSinglePoint(
        point: {id: number, pos: THREE.Vector3, color: THREE.Color},
        cameraPos: THREE.Vector3,
        cameraRot: THREE.Euler
    ): {x: number, y: number} | null {

        const width = 1024;
        const height = 1024;

        const camera = new THREE.PerspectiveCamera(90, 1, 0.1, 100);
        camera.position.copy(cameraPos);
        camera.rotation.copy(cameraRot);
        camera.updateMatrixWorld();

        const projected = point.pos.clone().project(camera);

        if (projected.x >= -1 && projected.x <= 1 &&
            projected.y >= -1 && projected.y <= 1 &&
            projected.z >= -1 && projected.z <= 1) {

            const pixelX = (projected.x + 1) * width / 2;
            const pixelY = (1 - projected.y) * height / 2;

            if (pixelX >= 0 && pixelX < width && pixelY >= 0 && pixelY < height) {
                return { x: pixelX, y: pixelY };
            }
        }

        return null;
    }

    generateProjectIni(): string {
        let content = "[General]\n";
        content += "database_path = database.db\n";
        content += "image_path = images/\n\n";

        content += "[Options]\n";
        content += "use_gpu = true\n";
        content += "gpu_index = 0\n";

        return content;
    }

    projectPointsToCamera(
        points3D: Array<{id: number, pos: THREE.Vector3, color: THREE.Color}>,
        cameraPos: THREE.Vector3,
        cameraRot: THREE.Euler
    ): Array<{x: number, y: number, point3D_id: number}> {

        const keypoints = [];
        const width = 1024;
        const height = 1024;

        const camera = new THREE.PerspectiveCamera(90, 1, 0.1, 100);
        camera.position.copy(cameraPos);
        camera.rotation.copy(cameraRot);
        camera.updateMatrixWorld();

        for (const point of points3D) {
            const projected = point.pos.clone().project(camera);

            if (projected.x >= -1 && projected.x <= 1 &&
                projected.y >= -1 && projected.y <= 1 &&
                projected.z >= -1 && projected.z <= 1) {

                const pixelX = (projected.x + 1) * width / 2;
                const pixelY = (1 - projected.y) * height / 2;

                if (pixelX >= 0 && pixelX < width && pixelY >= 0 && pixelY < height) {
                    keypoints.push({
                        x: pixelX,
                        y: pixelY,
                        point3D_id: point.id
                    });
                }
            }
        }

        return keypoints;
    }

    getCameraDirections() {
        return [
            { name: 'up', rotation: new THREE.Euler(-Math.PI/2, 0, Math.PI/2) },
            { name: 'down', rotation: new THREE.Euler(Math.PI/2, 0, -Math.PI/2) },
            { name: 'left', rotation: new THREE.Euler(0, 0, Math.PI) },
            { name: 'right', rotation: new THREE.Euler(0, Math.PI, Math.PI) },
            { name: 'front', rotation: new THREE.Euler(0, -Math.PI/2, Math.PI) },
            { name: 'back', rotation: new THREE.Euler(0, Math.PI/2, Math.PI) }
        ];
    }

    generateSample3DPoints(): Array<{id: number, pos: THREE.Vector3, color: THREE.Color}> {
        // 如果mesh为空时的备用方案
        const points = [];
        const count = 1000;

        // 在立方体范围内生成点
        for (let i = 0; i < count; i++) {
            points.push({
                id: i + 1,
                pos: new THREE.Vector3(
                    (Math.random() - 0.5) * 10,
                    (Math.random() - 0.5) * 10,
                    (Math.random() - 0.5) * 10
                ),
                color: new THREE.Color(0.5, 0.5, 0.5)
            });
        }

        return points;
    }

    async downloadCOLMAPProject(
        files: Map<string, string | Blob>,
        imageFiles: Map<string, Blob>,
        projectName: string
    ) {
        const zip = new JSZip();

        // 添加文本文件
        files.forEach((content, filename) => {
            zip.file(filename, content);
        });

        // 添加图片文件
        imageFiles.forEach((blob, filepath) => {
            zip.file(filepath, blob);
        });

        // 添加空的database.db占位符（可选）
        zip.file('database.db', new Blob([]));

        // 生成并下载zip
        const blob = await zip.generateAsync({ type: 'blob' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${projectName}.zip`;
        link.click();
        URL.revokeObjectURL(link.href);

        console.log(`COLMAP project exported: ${projectName}.zip`);
        console.log(`- Total cameras: ${this.panoramaPos.length * 6}`);
        console.log(`- Total images: ${imageFiles.size}`);
    }
}