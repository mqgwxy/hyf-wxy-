/**
 * 西湖场景 GLB 模型生成器
 * 使用 Three.js GLTFExporter 生成基础3D模型
 * 这些模型可被腾讯混元3D等AI工具生成的资产替换
 *
 * 用法: node tools/generate-models.mjs
 */

import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Node.js GLTFExporter 需要 FileReader polyfill
class FileReader {
    readAsArrayBuffer(blob) {
        blob.arrayBuffer().then(buffer => {
            this.result = buffer;
            if (this.onload) this.onload();
        }).catch(err => {
            if (this.onerror) this.onerror(err);
        });
    }
}
globalThis.FileReader = FileReader;

const __dirname = dirname(fileURLToPath(import.meta.url));
const modelsDir = resolve(__dirname, '..', 'models');
mkdirSync(modelsDir, { recursive: true });

function exportGLB(object, filename) {
    const exporter = new GLTFExporter();
    exporter.parse(object, (gltf) => {
        const buffer = Buffer.from(gltf);
        const filepath = resolve(modelsDir, filename);
        writeFileSync(filepath, buffer);
        console.log(`✓ 已生成: ${filename} (${(buffer.length / 1024).toFixed(1)} KB)`);
    }, (err) => {
        console.error(`✗ 导出失败 ${filename}:`, err);
    }, { binary: true });
}

// ==================== 1. 中国亭子 (Pavilion) ====================
function createPavilion() {
    const group = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x8B2500, roughness: 0.7 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x2d4a1e, roughness: 0.6 });
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x909090, roughness: 0.75 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xDAA520, roughness: 0.3, metalness: 0.6 });

    // 台基
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.5, 0.5, 8), stoneMat);
    base.position.y = 0.25;
    group.add(base);

    // 六根柱子
    for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 2.5, 8), woodMat);
        pillar.position.set(Math.cos(angle) * 1.8, 1.5, Math.sin(angle) * 1.8);
        group.add(pillar);
    }

    // 屋顶
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.5, 1.8, 8), roofMat);
    roof.position.y = 3.0;
    group.add(roof);

    // 宝顶
    const finial = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), goldMat);
    finial.position.y = 4.0;
    group.add(finial);

    return group;
}

// ==================== 2. 石塔 (Stone Pagoda) ====================
function createStonePagoda() {
    const group = new THREE.Group();
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x7a8a7a, roughness: 0.6 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x5a6a5a, roughness: 0.65 });

    // 六角台基
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, 0.25, 6), stoneMat);
    base.position.y = 0.13;
    group.add(base);

    // 球形塔身
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.65, 32, 32), stoneMat);
    sphere.position.y = 1.6;
    group.add(sphere);

    // 葫芦顶
    const gourdLow = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 16), stoneMat);
    gourdLow.position.y = 2.3;
    group.add(gourdLow);

    const gourdNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.25, 8), stoneMat);
    gourdNeck.position.y = 2.5;
    group.add(gourdNeck);

    const gourdUp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 16), stoneMat);
    gourdUp.position.y = 2.65;
    group.add(gourdUp);

    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 8), darkMat);
    tip.position.y = 2.78;
    group.add(tip);

    return group;
}

// ==================== 3. 石拱桥 (Stone Arch Bridge) ====================
function createBridge() {
    const group = new THREE.Group();
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x8a8a8a, roughness: 0.7 });

    // 拱圈
    const arch = new THREE.Mesh(new THREE.TorusGeometry(4, 0.3, 8, 16, Math.PI), stoneMat);
    arch.position.y = 2.0;
    group.add(arch);

    // 桥面
    const deck = new THREE.Mesh(new THREE.BoxGeometry(14, 0.3, 5), stoneMat);
    deck.position.y = 2.8;
    group.add(deck);

    // 栏杆
    for (let i = 0; i < 12; i++) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.7, 8), stoneMat);
        post.position.set(-6.5 + i * 1.2, 2.5, 2.3);
        group.add(post);
        const post2 = post.clone();
        post2.position.z = -2.3;
        group.add(post2);
    }

    return group;
}

// ==================== 4. 树木 (Tree) ====================
function createTree() {
    const group = new THREE.Group();
    const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.35, 2.5, 8),
        new THREE.MeshStandardMaterial({ color: 0x6B4226, roughness: 0.9 })
    );
    trunk.position.y = 1.25;
    group.add(trunk);

    // 三层树冠
    for (let i = 0; i < 3; i++) {
        const crown = new THREE.Mesh(
            new THREE.SphereGeometry(1.5 - i * 0.3, 8, 6),
            new THREE.MeshStandardMaterial({ color: 0x3d7a2e, roughness: 0.8 })
        );
        crown.position.set((Math.random() - 0.5) * 0.3, 2.5 + i * 0.8, (Math.random() - 0.5) * 0.3);
        group.add(crown);
    }

    return group;
}

// ==================== 5. 白墙建筑 (White-Walled Building) ====================
function createBuilding() {
    const group = new THREE.Group();
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xf5f0e8, roughness: 0.6 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.7 });

    // 主体
    const body = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 3), wallMat);
    body.position.y = 1.5;
    group.add(body);

    // 青瓦屋顶
    const roof = new THREE.Mesh(new THREE.ConeGeometry(3.5, 1.5, 4), roofMat);
    roof.position.y = 3.3;
    group.add(roof);

    // 门
    const door = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 2, 0.1),
        new THREE.MeshStandardMaterial({ color: 0x5c3d2e, roughness: 0.7 })
    );
    door.position.set(0, 1, 1.55);
    group.add(door);

    return group;
}

// ==================== 6. 雷峰塔 (Leifeng Pagoda - 简化版) ====================
function createLeifengTower() {
    const group = new THREE.Group();
    const copperMat = new THREE.MeshStandardMaterial({ color: 0xB87333, roughness: 0.35, metalness: 0.7 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0xA0622E, roughness: 0.3, metalness: 0.6 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xFFD700, roughness: 0.15, metalness: 0.9 });

    // 台基
    const platform = new THREE.Mesh(new THREE.CylinderGeometry(10, 11, 4, 8), new THREE.MeshStandardMaterial({ color: 0x8B7355, roughness: 0.8 }));
    platform.position.y = 2;
    group.add(platform);

    // 五层塔身
    for (let i = 0; i < 5; i++) {
        const r = 8 - i * 1.2;
        const fy = 5 + i * 6;

        const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r + 0.3, 4, 8), copperMat);
        body.position.y = fy;
        group.add(body);

        const eaves = new THREE.Mesh(new THREE.CylinderGeometry(r + 1.5, r + 0.5, 0.5, 8), roofMat);
        eaves.position.y = fy + 2.5;
        group.add(eaves);
    }

    // 塔刹
    const spire = new THREE.Mesh(new THREE.ConeGeometry(1, 8, 8), goldMat);
    spire.position.y = 36;
    group.add(spire);

    const spireTop = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 8), goldMat);
    spireTop.position.y = 42;
    group.add(spireTop);

    return group;
}

// ==================== 执行导出 ====================
console.log('开始生成GLB模型...\n');

exportGLB(createPavilion(), 'pavilion.glb');
exportGLB(createStonePagoda(), 'stone_pagoda.glb');
exportGLB(createBridge(), 'arch_bridge.glb');
exportGLB(createTree(), 'tree.glb');
exportGLB(createBuilding(), 'building.glb');
exportGLB(createLeifengTower(), 'leifeng_tower.glb');

console.log('\n全部模型生成完成！输出目录: models/');
console.log('提示: 这些是基础占位模型，可使用腾讯混元3D等AI工具生成更精细的版本替换。');
