import { Button, Upload } from "antd";

export interface CubemapFaces {
    px: string;
    nx: string;
    py: string;
    ny: string;
    pz: string;
    nz: string;
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

import React from 'react';
import styled from "styled-components";

const Warp = styled.div`

`;
export interface Demo2Props {

}

/**
 * Demo2
 * @author zanzm
 * @date 2026/3/3 14:05
 */
const Demo2: React.FC<Demo2Props> = (props: Demo2Props) => {
    const onBeforeUpload = async (file: File) => {
        const faces = await convertPanoramaToCubemap(URL.createObjectURL(file));
        console.log(faces);
    };
    return <Warp>
        <Upload beforeUpload={onBeforeUpload}>

        <Button>
            上传
        </Button>
        </Upload>
    </Warp>;
};

export default Demo2;
