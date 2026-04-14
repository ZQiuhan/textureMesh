export interface StationPose {
    x: number;
    y: number;
    z: number;
    q0: number;
    q1: number;
    q2: number;
    q3: number;
}

export interface Station {
    stationUuid: string;
    stationPanorama: string;
    pose: StationPose;
}

export interface CalibrationParameters {
    rotationMatrix: [number, number, number, number, number, number, number, number, number];
    translationVector: [number, number, number];
    voxelLeafSizeX: number;
    voxelLeafSizeY: number;
    voxelLeafSizeZ: number;
    statisticalMeanK: number;
    statisticalStddevMulThresh: number;
    clusterTolerance: number;
    minClusterSize: number;
    maxClusterSize: number;
}

export interface ProjectData {
    projectUuid: string;
    projectName: string;
    createdTime: number;
    updateTime: number;
    pointCloud: string;
    stationList: Station[];
    calibrationParameters: CalibrationParameters;
}