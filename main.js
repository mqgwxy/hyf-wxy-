/**
 * 杭州西湖数字孪生交互系统 - 完整版
 *
 * 技术栈: Three.js r160 + GLTFLoader + 程序化建模
 * 比例: 1单位≈1米
 * 坐标系: X=东, Y=高, Z=北(正)/南(负)
 *
 * 功能:
 * - GLB/GLTF模型加载（程序化建模 + 外部模型支持）
 * - 5层图层切换（建筑/植被/水域/地形/标注）
 * - 昼夜循环切换
 * - 3种视角（自由轨道/飞行鸟瞰/正俯视）
 * - 景点点击导航 + Raycaster拾取详情
 * - 动画小船 + 飞鸟
 * - 线框模式
 * - 场景GLB导出（浏览器端）
 * - 键盘快捷键
 *
 * 浙江树人学院 期中计算机图形学作业
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

// ==================== 全局状态 ====================
let scene, camera, renderer, controls;
let westLake, raycaster, mouse;
let isDaytime = true;
let isWireframe = false;
let animatedBoats = [];
let animatedBirds = [];
let clock = new THREE.Clock();

// ==================== 图层系统 ====================
const layers = {
    buildings:  new THREE.Group(),
    vegetation: new THREE.Group(),
    water:      new THREE.Group(),
    terrain:    new THREE.Group(),
    labels:     new THREE.Group()
};

// 保存所有可切换线框的材质引用
const allMaterials = [];

// GLTF加载器
const gltfLoader = new GLTFLoader();
const gltfCache = new Map();

// ==================== 核心地标坐标（1单位=1米） ====================
const LANDMARKS = {
    leifeng:      { x: 150, z: -620, y: 48,  name: '雷峰塔',       desc: '五层八面楼阁式铜瓦钢塔，通高71.68米，2002年重建。塔正北正对三潭印月。' },
    santanyinyue: { x: 100, z: -200, y: 0,   name: '三潭印月',     desc: '湖心"田"字形小瀛洲岛，三座青石塔呈等边三角形立于水中，塔间距62米。' },
    gushan:       { x: -150,z: 400,  y: 38,  name: '孤山',         desc: '西湖最大天然岛，海拔38米，东西长约1000米，散布西泠印社、文澜阁等园林建筑。' },
    duanqiao:     { x: 1150,z: 400,  y: 0,   name: '断桥残雪',     desc: '白堤东端单孔石拱桥，长28.8米宽8.6米，青石砌筑，栏板素面覆莲望柱。' },
    quyuan:       { x: 310, z: 1000, y: 0,   name: '曲院风荷',     desc: '总面积12.65万平方米，荷花池约38亩，九曲桥长约150米，青瓦白墙仿古酒坊。' },
    baidi:        { x: 740, z: 400,  y: 0,   name: '白堤',         desc: '全长987米，东起断桥西接孤山，唐代诗人白居易曾在此修筑石涵洞。' },
    sudi:         { x: 280, z: 150,  y: 0,   name: '苏堤',         desc: '全长约2.8千米，北宋苏轼任杭州知州时所建，六座单孔石拱桥纵贯西湖南北。' },
    lingyin:      { x: -900,z: 1300, y: 0,   name: '灵隐寺',       desc: '杭州最著名寺庙，创建于东晋咸和元年（326年），中国佛教禅宗十大古刹之一。' },
    huachi:       { x: 650, z: -400, y: 0,   name: '花港观鱼',     desc: '西湖十景之一，以花、港、鱼为特色，位于苏堤南段西侧。' },
    nanping:      { x: 450, z: -900, y: 0,   name: '南屏晚钟',     desc: '西湖十景之一，指南屏山净慈寺傍晚的钟声，钟楼高约15米。' }
};

// 每个地标的建筑引用（用于raycaster检测）
const buildingRefs = [];

// ==================== 初始化 ====================
function init() {
    // 场景
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.Fog(0x87CEEB, 800, 4500);

    // 添加所有图层
    Object.values(layers).forEach(layer => scene.add(layer));

    // 相机
    camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 1, 8000);
    camera.position.set(800, 600, 1200);

    // 渲染器
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    document.getElementById('canvas-container').appendChild(renderer.domElement);

    // 轨道控制器
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(200, 0, 100);
    controls.maxPolarAngle = Math.PI / 2.05;
    controls.minDistance = 30;
    controls.maxDistance = 3500;
    controls.update();

    // 射线检测
    raycaster = new THREE.Raycaster();
    raycaster.far = 2000;
    mouse = new THREE.Vector2();

    // 构建场景
    setupLights();
    createTerrain();
    createWestLake();
    createSudiCauseway();
    createIslands();
    createAllBuildings();
    createVegetation();
    createAnimatedBoats();
    createAnimatedBirds();
    setupEventListeners();

    // 加载GLB模型（如果存在）
    loadGLBModels();

    // 隐藏加载屏
    setTimeout(() => {
        document.getElementById('loading').style.display = 'none';
    }, 2000);

    animate();
}

// ==================== 光照系统 ====================
let sunLight, ambientLight, hemiLight;

function setupLights() {
    ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
    scene.add(ambientLight);

    sunLight = new THREE.DirectionalLight(0xfff5e6, 1.0);
    sunLight.position.set(800, 1200, 600);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 4096;
    sunLight.shadow.mapSize.height = 4096;
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 6000;
    sunLight.shadow.camera.left = -2500;
    sunLight.shadow.camera.right = 2500;
    sunLight.shadow.camera.top = 2500;
    sunLight.shadow.camera.bottom = -2500;
    sunLight.shadow.bias = -0.0001;
    scene.add(sunLight);

    const fill = new THREE.DirectionalLight(0xc8e0ff, 0.25);
    fill.position.set(-400, 300, -400);
    scene.add(fill);

    hemiLight = new THREE.HemisphereLight(0x87CEEB, 0x3d6b3d, 0.3);
    scene.add(hemiLight);
}

// ==================== 昼夜切换 ====================
function toggleDayNight() {
    isDaytime = !isDaytime;

    if (isDaytime) {
        scene.background = new THREE.Color(0x87CEEB);
        scene.fog = new THREE.Fog(0x87CEEB, 800, 4500);
        ambientLight.intensity = 0.45;
        sunLight.intensity = 1.0;
        hemiLight.intensity = 0.3;
        sunLight.color.set(0xfff5e6);
        renderer.toneMappingExposure = 1.1;
    } else {
        scene.background = new THREE.Color(0x0a1030);
        scene.fog = new THREE.Fog(0x0a1030, 400, 3000);
        ambientLight.intensity = 0.12;
        sunLight.intensity = 0.15;
        hemiLight.intensity = 0.08;
        sunLight.color.set(0x334488);
        renderer.toneMappingExposure = 0.5;
    }

    document.getElementById('btn-daynight').textContent = isDaytime ? '🌙 昼夜切换' : '☀ 昼夜切换';
}

// ==================== 线框模式 ====================
function toggleWireframe() {
    isWireframe = !isWireframe;
    allMaterials.forEach(mat => {
        if (mat && mat.wireframe !== undefined) {
            mat.wireframe = isWireframe;
            mat.needsUpdate = true;
        }
    });
    document.getElementById('btn-wireframe').classList.toggle('active', isWireframe);
}

// ==================== 地形 ====================
function createTerrain() {
    const groundGeom = new THREE.PlaneGeometry(5000, 5000, 1, 1);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x4a7a3a, roughness: 0.9, metalness: 0.02 });
    const ground = new THREE.Mesh(groundGeom, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.5;
    ground.receiveShadow = true;
    ground.name = 'ground';
    layers.terrain.add(ground);
    allMaterials.push(groundMat);

    const mountains = [
        { x: -1800, z: -1500, r: 350, h: 250 },
        { x: 1800, z: -1200, r: 400, h: 300 },
        { x: -1600, z: 1400, r: 300, h: 200 },
        { x: 1600, z: 1600, r: 350, h: 220 },
        { x: 1000, z: -1600, r: 300, h: 180 },
        { x: -1000, z: -1500, r: 250, h: 150 },
        { x: 400, z: -700, r: 120, h: 90 },
        { x: 0, z: 1800, r: 280, h: 170 },
        { x: -1200, z: -500, r: 200, h: 130 },
    ];

    mountains.forEach(m => {
        const geom = new THREE.ConeGeometry(m.r, m.h, 12, 4);
        const mat = new THREE.MeshStandardMaterial({ color: 0x4d7c3a, roughness: 0.9 });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.set(m.x, m.h / 2 - 0.5, m.z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.name = 'mountain';
        layers.terrain.add(mesh);
        allMaterials.push(mat);
    });
}

// ==================== 湖面 ====================
function createWestLake() {
    const shape = new THREE.Shape();
    shape.moveTo(-1200, -1500);
    shape.bezierCurveTo(-1400, -1200, -1350, -600, -1200, -100);
    shape.bezierCurveTo(-1050, 400, -900, 800, -600, 1100);
    shape.bezierCurveTo(-350, 1350, 50, 1500, 350, 1400);
    shape.bezierCurveTo(700, 1300, 1000, 1000, 1200, 600);
    shape.bezierCurveTo(1400, 200, 1350, -200, 1300, -600);
    shape.bezierCurveTo(1250, -1000, 1100, -1350, 800, -1500);
    shape.bezierCurveTo(400, -1650, -400, -1600, -1200, -1500);

    const lakeGeom = new THREE.ShapeGeometry(shape);
    const lakeMat = new THREE.MeshStandardMaterial({
        color: 0x3a8fd4, transparent: true, opacity: 0.7,
        roughness: 0.06, metalness: 0.35
    });
    westLake = new THREE.Mesh(lakeGeom, lakeMat);
    westLake.rotation.x = -Math.PI / 2;
    westLake.position.y = 0.1;
    westLake.receiveShadow = true;
    westLake.name = 'westLake';
    layers.water.add(westLake);
    allMaterials.push(lakeMat);

    // 北里湖
    const blShape = new THREE.Shape();
    blShape.moveTo(900, 200);
    blShape.bezierCurveTo(1050, 250, 1150, 350, 1100, 500);
    blShape.bezierCurveTo(1050, 600, 900, 600, 800, 550);
    blShape.bezierCurveTo(700, 500, 750, 350, 900, 200);
    const blGeom = new THREE.ShapeGeometry(blShape);
    const bl = new THREE.Mesh(blGeom, lakeMat);
    bl.rotation.x = -Math.PI / 2;
    bl.position.y = 0.12;
    layers.water.add(bl);
}

// ==================== 通用构建函数 ====================

function mktree(s = 1) {
    const g = new THREE.Group();
    const tMat = new THREE.MeshStandardMaterial({ color: 0x6B4226, roughness: 0.9 });
    const cMat = new THREE.MeshStandardMaterial({ color: 0x3d7a2e, roughness: 0.8 });
    allMaterials.push(tMat, cMat);

    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2 * s, 0.35 * s, 2.5 * s, 8), tMat);
    trunk.position.y = 1.25 * s;
    trunk.castShadow = true;
    g.add(trunk);

    const crown = new THREE.Mesh(new THREE.SphereGeometry(2 * s, 8, 8), cMat);
    crown.position.y = 3.2 * s;
    crown.castShadow = true;
    g.add(crown);
    return g;
}

function addTree(x, z, s) {
    const t = mktree(s || (0.7 + Math.random() * 0.6));
    t.position.set(x, 0, z);
    layers.vegetation.add(t);
}

function pave(size = 3, roofColor = 0x2d4a1e) {
    const g = new THREE.Group();
    const wMat = new THREE.MeshStandardMaterial({ color: 0x8B2500, roughness: 0.7 });
    const rMat = new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.7 });
    const sMat = new THREE.MeshStandardMaterial({ color: 0x909090, roughness: 0.7 });
    const fMat = new THREE.MeshStandardMaterial({ color: 0xDAA520, roughness: 0.3, metalness: 0.6 });
    allMaterials.push(wMat, rMat, sMat, fMat);

    const base = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.65, size * 0.75, size * 0.15, 8), sMat);
    base.position.y = size * 0.08;
    base.castShadow = true; base.receiveShadow = true;
    g.add(base);

    for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const p = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.05, size * 0.06, size * 0.85, 8), wMat);
        p.position.set(Math.cos(a) * size * 0.6, size * 0.48, Math.sin(a) * size * 0.6);
        p.castShadow = true;
        g.add(p);
    }

    const roof = new THREE.Mesh(new THREE.ConeGeometry(size * 0.8, size * 0.55, 8), rMat);
    roof.position.y = size * 1.0;
    roof.castShadow = true;
    g.add(roof);

    const fin = new THREE.Mesh(new THREE.SphereGeometry(size * 0.07, 8, 8), fMat);
    fin.position.y = size * 1.28;
    g.add(fin);
    return g;
}

function whiteWall(len, h) {
    const g = new THREE.Group();
    const wMat = new THREE.MeshStandardMaterial({ color: 0xf5f0e8, roughness: 0.6 });
    const tMat = new THREE.MeshStandardMaterial({ color: 0x404040, roughness: 0.7 });
    allMaterials.push(wMat, tMat);

    const wall = new THREE.Mesh(new THREE.BoxGeometry(len, h, 0.25), wMat);
    wall.position.y = h / 2;
    wall.castShadow = true; wall.receiveShadow = true;
    g.add(wall);

    const cap = new THREE.Mesh(new THREE.BoxGeometry(len + 0.15, 0.12, 0.35), tMat);
    cap.position.y = h + 0.06;
    g.add(cap);

    for (let i = 0; i < Math.floor(len / 2.5); i++) {
        const wx = -len / 2 + 1.3 + i * (len / Math.floor(len / 2.5));
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.04, 8, 16), new THREE.MeshStandardMaterial({ color: 0x1a1a1a }));
        ring.position.set(wx, h * 0.55, 0.14);
        g.add(ring);
    }
    return g;
}

function archBridge(params = {}) {
    const { span = 8, width = 6, archHeight = 2.5, deckY = 2.5, color = 0x909090, rampLen = 2 } = params;
    const g = new THREE.Group();
    const sMat = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
    allMaterials.push(sMat);

    const arch = new THREE.Mesh(new THREE.TorusGeometry(span / 2, 0.3, 8, 16, Math.PI), sMat);
    arch.position.y = deckY - archHeight * 0.5;
    arch.castShadow = true;
    g.add(arch);

    const deck = new THREE.Mesh(new THREE.BoxGeometry(width - 0.4, 0.35, span + rampLen * 2), sMat);
    deck.position.y = deckY;
    deck.castShadow = true; deck.receiveShadow = true;
    g.add(deck);

    for (let i = 0; i < Math.floor(span) + 2; i++) {
        const rx = -span / 2 - rampLen + 0.3 + i * ((span + rampLen * 2) / (Math.floor(span) + 1));
        const prog = (rx + span / 2 + rampLen) / (span + rampLen * 2);
        const curve = Math.sin(prog * Math.PI) * archHeight;
        [-width / 2 + 0.25, width / 2 - 0.25].forEach(rz => {
            const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.8, 8), sMat);
            post.position.set(rx, deckY - curve + 0.15, rz);
            post.castShadow = true;
            g.add(post);
            const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), sMat);
            head.position.set(rx, deckY - curve + 0.6, rz);
            g.add(head);
        });
    }
    [-width / 2 + 0.25, width / 2 - 0.25].forEach(rz => {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(span + rampLen * 2 - 0.3, 0.08, 0.1), sMat);
        rail.position.set(0, deckY + 0.55, rz);
        g.add(rail);
    });
    return g;
}

function zigzagBridge(sx, sz, segs, sl, dir) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x8B6914, roughness: 0.7 });
    allMaterials.push(mat);
    let cx = sx, cz = sz, dx = dir === 'x' ? sl : 0, dz = dir === 'z' ? sl : 0, flip = 1;

    for (let i = 0; i < segs; i++) {
        const seg = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(dx) || 1.2, 0.15, Math.abs(dz) || 1.2), mat);
        seg.position.set(cx, 0.5, cz);
        seg.castShadow = true; seg.receiveShadow = true;
        g.add(seg);
        cx += dx / 2; cz += dz / 2;
        if (i < segs - 1) { flip *= -1; const t = dx; dx = dz * flip; dz = t * flip; cx += dx / 2; cz += dz / 2; }
    }
    return g;
}

function treeRow(sx, sz, ex, ez, n, off = 8) {
    for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        addTree(sx + (ex - sx) * t + (Math.random() - 0.5) * off, sz + (ez - sz) * t + (Math.random() - 0.5) * off, 0.6 + Math.random() * 0.5);
    }
}

// ==================== GLB模型加载（支持外部AI生成资产） ====================
function loadGLBModels() {
    const modelList = [
        { path: 'models/pavilion.glb', name: 'pavilion' },
        { path: 'models/stone_pagoda.glb', name: 'stone_pagoda' },
        { path: 'models/arch_bridge.glb', name: 'arch_bridge' },
        { path: 'models/tree.glb', name: 'tree' },
        { path: 'models/building.glb', name: 'building' },
        { path: 'models/leifeng_tower.glb', name: 'leifeng_tower' }
    ];

    modelList.forEach(({ path, name }) => {
        gltfLoader.load(path,
            (gltf) => {
                console.log(`✓ GLB模型加载成功: ${name}`);
                gltfCache.set(name, gltf.scene);
            },
            undefined,
            () => {
                // 静默失败 - 模型不存在时使用程序化构建
                console.log(`ℹ GLB模型未找到，使用程序化模型: ${name}`);
            }
        );
    });
}

function getGLBModel(name) {
    if (gltfCache.has(name)) {
        return gltfCache.get(name).clone();
    }
    return null;
}

// ==================== 苏堤 + 六桥 ====================
function createSudiCauseway() {
    const cx = 280, sz = -900, ez = 1300;
    const diLen = ez - sz;
    const diMat = new THREE.MeshStandardMaterial({ color: 0x8B7355, roughness: 0.85 });
    allMaterials.push(diMat);

    const di = new THREE.Mesh(new THREE.BoxGeometry(7, 0.6, diLen), diMat);
    di.position.set(cx, 0.15, (sz + ez) / 2);
    di.castShadow = true; di.receiveShadow = true;
    di.name = '苏堤';
    layers.buildings.add(di);
    buildingRefs.push({ mesh: di, data: LANDMARKS.sudi });

    const bridges = [
        { z: -750, name: '映波桥', span: 7.4, archH: 2.0, color: 0x889898 },
        { z: -460, name: '锁澜桥', span: 6.3, archH: 1.6, color: 0x909090 },
        { z: -170, name: '望山桥', span: 7.0, archH: 1.8, color: 0x889090 },
        { z: 120,  name: '压堤桥', span: 5.5, archH: 1.4, color: 0x909898 },
        { z: 410,  name: '东浦桥', span: 6.0, archH: 1.5, color: 0x889090 },
        { z: 700,  name: '跨虹桥', span: 8.1, archH: 2.5, color: 0x889898 }
    ];

    bridges.forEach(b => {
        const bridge = archBridge({ span: b.span, width: 6, archHeight: b.archH, deckY: 2.0, color: b.color, rampLen: 1.5 });
        bridge.position.set(cx, 0.25, b.z);
        bridge.name = b.name;
        layers.buildings.add(bridge);
        buildingRefs.push({ mesh: bridge, data: { name: b.name, desc: `苏堤六桥之${b.name}`, x: cx, z: b.z } });
    });

    treeRow(cx - 6, sz, cx - 6, ez, 80, 6);
    treeRow(cx + 6, sz, cx + 6, ez, 80, 6);
}

// ==================== 三潭印月（小瀛洲 + 三石塔） ====================
function createXiaoyingzhouIsland() {
    const pos = LANDMARKS.santanyinyue;
    const g = new THREE.Group();
    g.name = '小瀛洲岛（三潭印月）';

    const iw = 25, ih = 30, cw = 3.5;
    const qw = (iw - cw) / 2, qh = (ih - cw) / 2;

    const baseMat = new THREE.MeshStandardMaterial({ color: 0x9B8B6E, roughness: 0.9 });
    allMaterials.push(baseMat);
    const base = new THREE.Mesh(new THREE.BoxGeometry(iw, 0.7, ih), baseMat);
    base.position.y = 0.35;
    base.castShadow = true; base.receiveShadow = true;
    g.add(base);

    // 十字水道
    const wMat = new THREE.MeshStandardMaterial({ color: 0x4DB8E8, transparent: true, opacity: 0.8, roughness: 0.08, metalness: 0.2 });
    const hCh = new THREE.Mesh(new THREE.PlaneGeometry(iw - 0.5, cw - 0.5), wMat);
    hCh.rotation.x = -Math.PI / 2; hCh.position.y = 0.75;
    g.add(hCh);
    const vCh = new THREE.Mesh(new THREE.PlaneGeometry(cw - 0.5, ih - 0.5), wMat);
    vCh.rotation.x = -Math.PI / 2; vCh.position.y = 0.75;
    g.add(vCh);

    // 四块绿地
    const greenMat = new THREE.MeshStandardMaterial({ color: 0x4a8c3f, roughness: 0.8 });
    allMaterials.push(greenMat);
    const qw2 = qw / 2 + cw / 4, qh2 = qh / 2 + cw / 4;
    [[qw2, qh2], [-qw2, qh2], [qw2, -qh2], [-qw2, -qh2]].forEach(([x, z]) => {
        const q = new THREE.Mesh(new THREE.BoxGeometry(qw - 0.6, 0.4, qh - 0.6), greenMat);
        q.position.set(x, 1.0, z);
        q.castShadow = true; q.receiveShadow = true;
        g.add(q);
        for (let i = 0; i < 4; i++) {
            const t = mktree(0.5 + Math.random() * 0.3);
            t.position.set(x + (Math.random() - 0.5) * (qw - 3), 0.7, z + (Math.random() - 0.5) * (qh - 3));
            g.add(t);
        }
        const pav = pave(1.5);
        pav.position.set(x, 1.2, z);
        g.add(pav);
    });

    // 白墙
    [[0, ih / 2 - 0.4, 0], [0, -ih / 2 + 0.4, 0], [iw / 2 - 0.4, 0, Math.PI / 2], [-iw / 2 + 0.4, 0, Math.PI / 2]].forEach(([px, pz, ry]) => {
        const w = whiteWall(ry === 0 ? iw : ih - 0.6, 1.4);
        w.position.set(px, 0.7, pz);
        w.rotation.y = ry;
        g.add(w);
    });

    // 十字桥
    [[qw2, 0, 0], [-qw2, 0, 0], [0, qh2, Math.PI / 2], [0, -qh2, Math.PI / 2]].forEach(([bx, bz, ry]) => {
        const br = archBridge({ span: cw + 1.2, width: 1.8, archHeight: 0.6, deckY: 1.2 });
        br.position.set(bx, 0, bz);
        br.rotation.y = ry;
        g.add(br);
    });

    g.position.set(pos.x, 0, pos.z);
    layers.buildings.add(g);
    buildingRefs.push({ mesh: g, data: LANDMARKS.santanyinyue });
}

// ==================== 三座石塔 ====================
function createSinglePagoda() {
    const g = new THREE.Group();
    const sMat = new THREE.MeshStandardMaterial({ color: 0x7a8a7a, roughness: 0.6 });
    const dMat = new THREE.MeshStandardMaterial({ color: 0x5a6a5a, roughness: 0.65 });
    allMaterials.push(sMat, dMat);

    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.75, 0.2, 6), sMat);
    base.position.y = 0.1; base.castShadow = true; base.receiveShadow = true;
    g.add(base);

    for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.65, 8), sMat);
        p.position.set(Math.cos(a) * 0.55, 0.52, Math.sin(a) * 0.55);
        p.castShadow = true;
        g.add(p);
    }

    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.72, 0.35, 6), dMat)).position.y = 0.9;

    const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.6, 32, 32), sMat);
    sphere.position.y = 1.5; sphere.castShadow = true;
    g.add(sphere);

    // 葫芦顶
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), sMat)).position.y = 2.15;
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.25, 8), sMat)).position.y = 2.3;
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 16), sMat)).position.y = 2.48;
    g.add(new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 8), dMat)).position.y = 2.6;

    return g;
}

function createThreePagodas() {
    const pos = LANDMARKS.santanyinyue;
    const spacing = 12;
    const th = spacing * Math.sqrt(3) / 2;
    const cx = pos.x, cz = pos.z - 18;

    [
        { x: cx - spacing / 2, z: cz - th / 3 },
        { x: cx + spacing / 2, z: cz - th / 3 },
        { x: cx, z: cz + th * 2 / 3 }
    ].forEach(({ x, z }) => {
        const pagoda = createSinglePagoda();
        pagoda.position.set(x, 0.15, z);
        pagoda.name = '三潭石塔';
        layers.buildings.add(pagoda);
        buildingRefs.push({ mesh: pagoda, data: { name: '三潭石塔', desc: '高2.5米青石塔，球形塔身五孔，葫芦顶' } });
    });
}

// ==================== 孤山 ====================
function createGushan() {
    const pos = LANDMARKS.gushan;
    const g = new THREE.Group();
    g.name = '孤山';

    const hillMat = new THREE.MeshStandardMaterial({ color: 0x5a8a4a, roughness: 0.85 });
    allMaterials.push(hillMat);

    const hillData = [
        { x: 0, z: 0, r: 9, h: 12 },
        { x: 4, z: 2, r: 7, h: 8.4 },
        { x: -5, z: -1, r: 8, h: 9.6 },
        { x: 3, z: -3, r: 6, h: 6 },
        { x: -3, z: 3, r: 6, h: 6.6 }
    ];

    hillData.forEach(d => {
        const hill = new THREE.Mesh(new THREE.ConeGeometry(d.r, d.h, 12), hillMat);
        hill.position.set(d.x, d.h / 2, d.z);
        hill.castShadow = true; hill.receiveShadow = true;
        g.add(hill);
    });

    // 建筑
    const blds = [[-5, 1.5, 0.2, 1.0], [3, -2, -0.3, 0.9], [-1, -3, 0.1, 0.85], [4, 3, -0.15, 1.05], [-6, -1, 0.4, 0.95]];
    blds.forEach(([x, z, ry, s]) => {
        const bld = new THREE.Group();
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf5f0e8, roughness: 0.6 });
        const roofMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.7 });
        allMaterials.push(bodyMat, roofMat);

        bld.add(new THREE.Mesh(new THREE.BoxGeometry(2.2 * s, 1.8 * s, 1.8 * s), bodyMat)).position.y = 0.9 * s;
        bld.add(new THREE.Mesh(new THREE.ConeGeometry(1.8 * s, 0.9 * s, 4), roofMat)).position.y = 2.1 * s;

        const gy = getHillH(x, z, hillData);
        bld.position.set(x, gy, z);
        bld.rotation.y = ry;
        g.add(bld);
    });

    for (let i = 0; i < 18; i++) {
        const tx = (Math.random() - 0.5) * 15, tz = (Math.random() - 0.5) * 9;
        const t = mktree(0.4 + Math.random() * 0.5);
        t.position.set(tx, getHillH(tx, tz, hillData), tz);
        g.add(t);
    }

    g.position.set(pos.x, 0, pos.z);
    layers.buildings.add(g);
    buildingRefs.push({ mesh: g, data: LANDMARKS.gushan });
}

function getHillH(x, z, hd) {
    let m = 0;
    hd.forEach(d => {
        const dx = x - d.x, dz = z - d.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < d.r) {
            const h = d.h * (1 - dist / d.r) * Math.cos((dist / d.r) * Math.PI / 2);
            if (h > m) m = h;
        }
    });
    return m;
}

// ==================== 其他小岛 ====================
function createOtherIslands() {
    [
        { x: -40, z: 80, s: 6 },
        { x: 180, z: 50, s: 4.5 }
    ].forEach(d => {
        const mat = new THREE.MeshStandardMaterial({ color: 0x3a7a2e });
        allMaterials.push(mat);
        const m = new THREE.Mesh(new THREE.CylinderGeometry(d.s * 0.6, d.s * 0.8, 2.0, 16), mat);
        m.position.set(d.x, 0.4, d.z);
        m.castShadow = true; m.receiveShadow = true;
        layers.buildings.add(m);

        for (let i = 0; i < 4; i++) {
            addTree(d.x + (Math.random() - 0.5) * d.s, d.z + (Math.random() - 0.5) * d.s, 0.4 + Math.random() * 0.4);
        }
    });
}

function createIslands() {
    createXiaoyingzhouIsland();
    createThreePagodas();
    createGushan();
    createOtherIslands();
}

// ==================== 断桥残雪 ====================
function createDuanqiao() {
    const pos = LANDMARKS.duanqiao;
    const g = new THREE.Group();
    g.name = '断桥残雪';
    const sMat = new THREE.MeshStandardMaterial({ color: 0x8a8a8a, roughness: 0.65 });
    allMaterials.push(sMat);

    const dl = 16, dw = 5;
    g.add(new THREE.Mesh(new THREE.TorusGeometry(3, 0.3, 8, 16, Math.PI), sMat)).position.y = 2.0;
    const deck = new THREE.Mesh(new THREE.BoxGeometry(dl, 0.28, dw), sMat);
    deck.position.y = 2.8; deck.castShadow = true; deck.receiveShadow = true;
    g.add(deck);

    for (let s = -1; s <= 1; s += 2) {
        for (let i = 0; i < 3; i++) {
            const step = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.16, dw + 0.2), sMat);
            step.position.set(s * (dl / 2 - 0.4 - i * 0.8), 3.4 - i * 0.3, 0);
            step.castShadow = true;
            g.add(step);
        }
        const rz = s * (dw / 2 - 0.2);
        for (let i = 0; i < 14; i++) {
            const rx = -dl / 2 + 0.5 + i * 1.15;
            const ratio = rx / (dl / 2);
            const ry = 2.8 + (1 - ratio * ratio) * 2.5 * 0.4;
            const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.6, 8), sMat);
            p.position.set(rx, ry + 0.05, rz);
            g.add(p);
            g.add(new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 4), sMat)).position.set(rx, ry + 0.45, rz);
        }
        const rail = new THREE.Mesh(new THREE.BoxGeometry(dl - 0.3, 0.06, 0.08), sMat);
        rail.position.set(0, 4.0, rz);
        g.add(rail);
    }

    g.position.set(pos.x, 0.25, pos.z);
    layers.buildings.add(g);
    buildingRefs.push({ mesh: g, data: LANDMARKS.duanqiao });
}

// ==================== 白堤 ====================
function createBaidiCauseway() {
    const gs = LANDMARKS.gushan, dq = LANDMARKS.duanqiao;
    const sx = gs.x + 12, sz = gs.z, ex = dq.x, ez = dq.z;
    const n = 6;
    const bMat = new THREE.MeshStandardMaterial({ color: 0x9B8B6E, roughness: 0.85 });
    allMaterials.push(bMat);

    for (let i = 0; i < n; i++) {
        const t1 = i / n, t2 = (i + 1) / n;
        const bx = sx + (ex - sx) * t1, bz = sz + (ez - sz) * t1;
        const bx2 = sx + (ex - sx) * t2, bz2 = sz + (ez - sz) * t2;
        const mx = (bx + bx2) / 2, mz = (bz + bz2) / 2;
        const dx = bx2 - bx, dz = bz2 - bz;
        const sl = Math.sqrt(dx * dx + dz * dz);
        const seg = new THREE.Mesh(new THREE.BoxGeometry(sl, 0.5, 5), bMat);
        seg.position.set(mx, 0.15, mz);
        seg.rotation.y = Math.atan2(dz, dx);
        seg.castShadow = true; seg.receiveShadow = true;
        seg.name = '白堤';
        layers.buildings.add(seg);
    }
    buildingRefs.push({ mesh: layers.buildings.children[layers.buildings.children.length - 1], data: LANDMARKS.baidi });

    treeRow(sx, sz + 3, ex, ez + 3, 30, 5);
    treeRow(sx, sz - 3, ex, ez - 3, 30, 5);
}

// ==================== 雷峰塔 ====================
function createLeifengPagoda() {
    const pos = LANDMARKS.leifeng;
    const g = new THREE.Group();
    g.name = '雷峰塔';

    const copperMat = new THREE.MeshStandardMaterial({ color: 0xB87333, roughness: 0.35, metalness: 0.7 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0xA0622E, roughness: 0.3, metalness: 0.6 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xFFD700, roughness: 0.15, metalness: 0.9 });
    allMaterials.push(copperMat, roofMat, goldMat);

    const br = 9, fh = 6, n = 5;

    // 台基
    const plat = new THREE.Mesh(new THREE.CylinderGeometry(br + 1.5, br + 2, 6, 8), new THREE.MeshStandardMaterial({ color: 0x8B7355, roughness: 0.8 }));
    plat.position.y = 3; plat.castShadow = true; plat.receiveShadow = true;
    g.add(plat);

    // 玻璃罩
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x88CCFF, transparent: true, opacity: 0.25, roughness: 0.08, metalness: 0.15 });
    const glass = new THREE.Mesh(new THREE.BoxGeometry(br * 2.5, 4, br * 2.5), glassMat);
    glass.position.y = 2;
    g.add(glass);

    // 五层塔身
    for (let i = 0; i < n; i++) {
        const fy = 6 + i * fh;
        const r = br - i * 1.2;
        const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r + 0.2, fh * 0.65, 8), copperMat);
        body.position.y = fy; body.castShadow = true;
        g.add(body);

        const balcony = new THREE.Mesh(new THREE.TorusGeometry(r + 0.3, 0.2, 8, 8), copperMat);
        balcony.position.y = fy - fh * 0.12; balcony.rotation.x = Math.PI / 2;
        g.add(balcony);

        for (let j = 0; j < 16; j++) {
            const a = (j / 16) * Math.PI * 2;
            const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 8), copperMat);
            rail.position.set(Math.cos(a) * (r + 0.35), fy + 0.05, Math.sin(a) * (r + 0.35));
            g.add(rail);
        }

        const eaves = new THREE.Mesh(new THREE.CylinderGeometry(r + 1.2, r + 0.3, 0.4, 8), roofMat);
        eaves.position.y = fy + fh * 0.42; eaves.castShadow = true;
        g.add(eaves);

        for (let j = 0; j < 8; j++) {
            const a = (j / 8) * Math.PI * 2 + Math.PI / 8;
            const bell = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), goldMat);
            bell.position.set(Math.cos(a) * (r + 1.0), fy + fh * 0.36, Math.sin(a) * (r + 1.0));
            g.add(bell);
        }
    }

    // 塔刹
    const sby = 6 + n * fh;
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.3, 1.2, 8), goldMat)).position.y = sby;
    g.add(new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.6, 8), goldMat)).position.y = sby + 1.2;
    g.add(new THREE.Mesh(new THREE.ConeGeometry(0.35, 2.4, 8), goldMat)).position.y = sby + 2.5;
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), goldMat)).position.y = sby + 4.0;

    g.position.set(pos.x, pos.y, pos.z);
    layers.buildings.add(g);
    buildingRefs.push({ mesh: g, data: LANDMARKS.leifeng });
}

// ==================== 曲院风荷 ====================
function createQuyuanFenghe() {
    const pos = LANDMARKS.quyuan;
    const g = new THREE.Group();
    g.name = '曲院风荷';

    // 荷花池
    const pondMat = new THREE.MeshStandardMaterial({ color: 0x3a7a3a, transparent: true, opacity: 0.5, roughness: 0.15 });
    const pond = new THREE.Mesh(new THREE.CircleGeometry(12, 32), pondMat);
    pond.rotation.x = -Math.PI / 2; pond.position.y = 0.15; pond.receiveShadow = true;
    g.add(pond);

    // 荷叶+荷花
    for (let i = 0; i < 80; i++) {
        const a = Math.random() * Math.PI * 2, d = Math.random() * 11;
        const lx = Math.cos(a) * d, lz = Math.sin(a) * d;
        g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.2 + Math.random() * 0.4, 0.04, 0.06, 12), new THREE.MeshStandardMaterial({ color: 0x2d6a2d }))).position.set(lx, 0.2, lz);
        if (Math.random() < 0.35) {
            for (let p = 0; p < 4; p++) {
                g.add(new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 6), new THREE.MeshStandardMaterial({ color: Math.random() < 0.5 ? 0xFFB7C5 : 0xFFF0F5 }))).position.set(lx + (Math.random() - 0.5) * 0.35, 0.3 + p * 0.12, lz + (Math.random() - 0.5) * 0.35);
            }
        }
    }

    g.add(zigzagBridge(-3, -8, 14, 3.0, 'x'));

    // 酒坊院落
    const cy = new THREE.Group();
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xf5f0e8, roughness: 0.6 });
    const dRoof = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.7 });
    allMaterials.push(wallMat, dRoof);

    const hall = new THREE.Mesh(new THREE.BoxGeometry(7, 2.8, 4), wallMat);
    hall.position.y = 1.4; hall.castShadow = true;
    cy.add(hall);
    cy.add(new THREE.Mesh(new THREE.ConeGeometry(5, 1.6, 4), dRoof)).position.y = 3.3;

    for (let s = -1; s <= 1; s += 2) {
        const wing = new THREE.Mesh(new THREE.BoxGeometry(3.5, 2.0, 2.5), wallMat);
        wing.position.set(s * 4.2, 1.0, 0); wing.castShadow = true;
        cy.add(wing);
        cy.add(new THREE.Mesh(new THREE.ConeGeometry(2.5, 1.0, 4), dRoof)).position.set(s * 4.2, 2.2, 0);
    }
    const cw = whiteWall(11, 1.6);
    cw.position.set(0, 0.8, -3);
    cy.add(cw);
    cy.position.set(6, 0, 6);
    g.add(cy);

    const stele = pave(2.5, 0x3a3a3a);
    stele.position.set(-4, 0, 15);
    g.add(stele);

    const yx = pave(3.0, 0x3a3a3a);
    yx.position.set(8, 0, -12);
    g.add(yx);

    g.position.set(pos.x, 0, pos.z);
    layers.buildings.add(g);
    buildingRefs.push({ mesh: g, data: LANDMARKS.quyuan });
}

// ==================== 其他景点 ====================
function createLingyinTemple() {
    const pos = LANDMARKS.lingyin;
    const g = new THREE.Group();
    g.name = '灵隐寺';

    const rMat = new THREE.MeshStandardMaterial({ color: 0x8B0000, roughness: 0.6 });
    allMaterials.push(rMat);

    const hall = new THREE.Mesh(new THREE.BoxGeometry(20, 12, 16), rMat);
    hall.position.y = 6; hall.castShadow = true; hall.receiveShadow = true;
    g.add(hall);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(24, 1.5, 20), new THREE.MeshStandardMaterial({ color: 0x6B0000, roughness: 0.7 }));
    roof.position.y = 13; roof.castShadow = true;
    g.add(roof);

    for (let s = -1; s <= 1; s += 2) {
        const side = new THREE.Mesh(new THREE.BoxGeometry(10, 7, 8), rMat);
        side.position.set(s * 16, 3.5, 0); side.castShadow = true;
        g.add(side);
    }

    g.position.set(pos.x, 0, pos.z);
    layers.buildings.add(g);
    buildingRefs.push({ mesh: g, data: LANDMARKS.lingyin });
}

function createHuagangGuanyu() {
    const pos = LANDMARKS.huachi;
    const g = new THREE.Group();
    g.name = '花港观鱼';

    for (let i = 0; i < 3; i++) {
        const pond2 = new THREE.Mesh(new THREE.CircleGeometry(4, 24), new THREE.MeshStandardMaterial({ color: 0x3a8a4a, transparent: true, opacity: 0.5, roughness: 0.1 }));
        pond2.rotation.x = -Math.PI / 2; pond2.position.set((i - 1) * 10, 0.12, 0);
        g.add(pond2);
        const pav = pave(2.0);
        pav.position.set((i - 1) * 10, 0, 3);
        g.add(pav);
    }

    g.position.set(pos.x, 0, pos.z);
    layers.buildings.add(g);
    buildingRefs.push({ mesh: g, data: LANDMARKS.huachi });
}

function createNanpingBell() {
    const pos = LANDMARKS.nanping;
    const g = new THREE.Group();
    g.name = '南屏晚钟';

    const tMat = new THREE.MeshStandardMaterial({ color: 0x8B7355, roughness: 0.8 });
    allMaterials.push(tMat);

    const tower = new THREE.Mesh(new THREE.CylinderGeometry(4, 5, 15, 8), tMat);
    tower.position.y = 7.5; tower.castShadow = true;
    g.add(tower);

    const bell = new THREE.Mesh(new THREE.CylinderGeometry(2, 1, 4, 16), new THREE.MeshStandardMaterial({ color: 0xDAA520, roughness: 0.3, metalness: 0.7 }));
    bell.position.y = 14;
    g.add(bell);

    g.position.set(pos.x, 0, pos.z);
    layers.buildings.add(g);
    buildingRefs.push({ mesh: g, data: LANDMARKS.nanping });
}

// ==================== POI 标记 ====================
function createLabels() {
    Object.entries(LANDMARKS).forEach(([key, data]) => {
        if (['baidi', 'sudi'].includes(key)) return;

        const marker = new THREE.Mesh(
            new THREE.SphereGeometry(2.5, 16, 16),
            new THREE.MeshBasicMaterial({ color: 0xFF4500, transparent: true, opacity: 0.7, depthTest: false })
        );
        marker.position.set(data.x, key === 'leifeng' ? 52 : 20, data.z);
        marker.name = `label-${key}`;
        layers.labels.add(marker);
    });
}

// ==================== 所有建筑 ====================
function createAllBuildings() {
    createBaidiCauseway();
    createDuanqiao();
    createLeifengPagoda();
    createQuyuanFenghe();
    createLingyinTemple();
    createHuagangGuanyu();
    createNanpingBell();
    createLabels();
}

// ==================== 植被 ====================
function createVegetation() {
    // 湖岸周边的树
    for (let i = 0; i < 120; i++) {
        const angle = (i / 120) * Math.PI * 2;
        const radius = 1200 + Math.random() * 150;
        const wx = Math.cos(angle) * radius;
        const wz = Math.sin(angle) * radius * 0.7;
        if (Math.abs(wx) < 1500 && Math.abs(wz) < 1700) {
            addTree(wx, wz, 0.5 + Math.random() * 0.7);
        }
    }
    // 散落树木
    for (let i = 0; i < 30; i++) {
        addTree(-300 + Math.random() * 800, -800 + Math.random() * 1400, 0.4 + Math.random() * 0.5);
    }
}

// ==================== 动画小船 ====================
function createAnimatedBoats() {
    const boatPaths = [
        { start: { x: 400, z: -600 }, end: { x: 200, z: 600 }, speed: 0.03 },
        { start: { x: -200, z: 0 }, end: { x: 600, z: -400 }, speed: 0.025 },
        { start: { x: 100, z: 800 }, end: { x: 500, z: -200 }, speed: 0.02 },
        { start: { x: -500, z: -300 }, end: { x: 300, z: 400 }, speed: 0.028 }
    ];

    boatPaths.forEach(path => {
        const boat = new THREE.Group();

        // 船体
        const hullMat = new THREE.MeshStandardMaterial({ color: 0x8B6914, roughness: 0.7 });
        const hull = new THREE.Mesh(new THREE.BoxGeometry(4, 0.6, 1.5), hullMat);
        hull.position.y = 0.8;
        hull.castShadow = true;
        boat.add(hull);

        // 船篷
        const canopy = new THREE.Mesh(new THREE.ConeGeometry(1.2, 1.0, 4, 1, false, 0, Math.PI),
            new THREE.MeshStandardMaterial({ color: 0x5c3d2e, roughness: 0.8 }));
        canopy.position.set(1, 1.4, 0);
        canopy.rotation.z = Math.PI / 2;
        canopy.castShadow = true;
        boat.add(canopy);

        boat.userData = {
            path,
            progress: Math.random(),
            speed: path.speed * (0.8 + Math.random() * 0.4)
        };

        boat.position.y = 0.5;
        layers.buildings.add(boat);
        animatedBoats.push(boat);
    });
}

function updateBoats(dt) {
    animatedBoats.forEach(boat => {
        const { path, speed } = boat.userData;
        boat.userData.progress += speed * dt;

        if (boat.userData.progress > 1.0) boat.userData.progress -= 1.0;
        if (boat.userData.progress < 0) boat.userData.progress += 1.0;

        const p = boat.userData.progress;
        const x = path.start.x + (path.end.x - path.start.x) * p;
        const z = path.start.z + (path.end.z - path.start.z) * p;

        boat.position.x = x;
        boat.position.z = z;
        boat.rotation.y = Math.atan2(path.end.z - path.start.z, path.end.x - path.start.x) + Math.sin(p * Math.PI * 2) * 0.3;
    });
}

// ==================== 动画飞鸟 ====================
function createAnimatedBirds() {
    for (let i = 0; i < 25; i++) {
        const bird = new THREE.Group();

        const body = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.6, 4),
            new THREE.MeshStandardMaterial({ color: 0x333333 }));
        body.rotation.x = -Math.PI / 2;
        bird.add(body);

        const wingL = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.04, 0.2),
            new THREE.MeshStandardMaterial({ color: 0x444444 }));
        wingL.position.set(0.4, 0, 0);
        bird.add(wingL);

        const wingR = wingL.clone();
        wingR.position.set(-0.4, 0, 0);
        bird.add(wingR);

        bird.userData = {
            centerX: (Math.random() - 0.5) * 2000,
            centerZ: -500 + Math.random() * 2000,
            radius: 100 + Math.random() * 300,
            height: 40 + Math.random() * 100,
            speed: 0.2 + Math.random() * 0.6,
            phase: Math.random() * Math.PI * 2
        };

        bird.position.set(bird.userData.centerX, bird.userData.height, bird.userData.centerZ);
        layers.labels.add(bird);
        animatedBirds.push(bird);
    }
}

function updateBirds(dt) {
    animatedBirds.forEach(bird => {
        bird.userData.phase += bird.userData.speed * dt * 0.5;
        const phase = bird.userData.phase;
        const r = bird.userData.radius;

        bird.position.x = bird.userData.centerX + Math.cos(phase) * r;
        bird.position.z = bird.userData.centerZ + Math.sin(phase) * r * 0.6;
        bird.position.y = bird.userData.height + Math.sin(phase * 1.7) * 15;

        bird.rotation.y = -phase + Math.PI / 2;
    });
}

// ==================== 视角切换 ====================
function setViewMode(mode) {
    document.querySelectorAll('.control-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));

    switch (mode) {
        case 'orbit':
            animateCamera(800, 600, 1200, 200, 0, 100);
            break;
        case 'fly':
            animateCamera(200, 350, 0, 200, 0, 0);
            break;
        case 'top':
            animateCamera(200, 1800, 100, 200, 0, 100);
            break;
    }
}

function animateCamera(px, py, pz, tx, ty, tz) {
    const sp = { x: camera.position.x, y: camera.position.y, z: camera.position.z };
    const st = { x: controls.target.x, y: controls.target.y, z: controls.target.z };
    const dur = 1200, stTime = Date.now();

    function upd() {
        const p = Math.min((Date.now() - stTime) / dur, 1);
        const e = 1 - Math.pow(1 - p, 3);
        camera.position.set(sp.x + (px - sp.x) * e, sp.y + (py - sp.y) * e, sp.z + (pz - sp.z) * e);
        controls.target.set(st.x + (tx - st.x) * e, st.y + (ty - st.y) * e, st.z + (tz - st.z) * e);
        if (p < 1) requestAnimationFrame(upd);
    }
    upd();
}

// ==================== POI 飞入 ====================
function flyToPoi(key) {
    const d = LANDMARKS[key];
    if (!d) return;

    document.getElementById('info-panel').querySelector('h1').textContent = d.name;

    const px = d.x + (key === 'leifeng' ? 80 : 60);
    const py = key === 'leifeng' ? 80 : 50;
    const pz = d.z + 60;
    animateCamera(px, py, pz, d.x, key === 'leifeng' ? 40 : 5, d.z);
}

// ==================== 图层控制 ====================
function toggleLayer(layerName) {
    const layer = layers[layerName];
    if (!layer) return;
    layer.visible = !layer.visible;

    const btn = document.querySelector(`[data-layer="${layerName}"]`);
    if (btn) btn.classList.toggle('on', layer.visible);
}

function setAllLayers(visible) {
    Object.keys(layers).forEach(name => {
        layers[name].visible = visible;
        const btn = document.querySelector(`[data-layer="${name}"]`);
        if (btn) btn.classList.toggle('on', visible);
    });
}

// ==================== 射线检测（点击建筑显示详情） ====================
function onCanvasClick(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    const meshTargets = buildingRefs.map(r => r.mesh).flatMap(g => {
        if (g.isGroup) {
            const children = [];
            g.traverse(c => { if (c.isMesh) children.push(c); });
            return children;
        }
        return [g];
    });

    const intersects = raycaster.intersectObjects(meshTargets, true);

    const card = document.getElementById('detail-card');
    if (intersects.length > 0) {
        const obj = intersects[0].object;
        let found = null;
        buildingRefs.forEach(ref => {
            if (ref.mesh === obj || (ref.mesh.isGroup && ref.mesh.children.includes(obj))) {
                found = ref;
            }
            if (!found && ref.mesh.isGroup) {
                ref.mesh.traverse(c => { if (c === obj) found = ref; });
            }
        });

        if (found) {
            const d = found.data;
            card.querySelector('h3').textContent = d.name || '未知建筑';
            card.querySelector('.detail-desc').textContent = d.desc || '';
            const tags = card.querySelector('.detail-tags');
            tags.innerHTML = '';
            if (d.x !== undefined) {
                tags.innerHTML = `<span class="detail-tag">坐标: (${d.x}, ${d.z})</span>`;
            }
            card.classList.add('visible');
            card.style.left = (event.clientX + 20) + 'px';
            card.style.top = (event.clientY - 40) + 'px';
            return;
        }
    }
    card.classList.remove('visible');
}

// ==================== GLB场景导出（浏览器端） ====================
function exportSceneGLB() {
    const exporter = new GLTFExporter();
    exporter.parse(scene, (gltf) => {
        const blob = new Blob([gltf], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `westlake_scene_${Date.now()}.glb`;
        a.click();
        URL.revokeObjectURL(url);
        console.log('✓ 场景GLB导出成功');
    }, (err) => {
        console.error('GLB导出失败:', err);
    }, { binary: true, maxTextureSize: 2048 });
}

// ==================== 事件监听 ====================
function setupEventListeners() {
    // 窗口大小
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // 视角按钮
    document.querySelectorAll('.control-btn[data-mode]').forEach(btn => {
        btn.addEventListener('click', () => setViewMode(btn.dataset.mode));
    });

    // 重置
    document.getElementById('reset-btn').addEventListener('click', () => {
        setViewMode('orbit');
        document.getElementById('info-panel').querySelector('h1').textContent = '杭州西湖';
    });

    // 景点列表
    document.querySelectorAll('.poi-item').forEach(item => {
        item.addEventListener('click', () => flyToPoi(item.dataset.poi));
    });

    // 图层按钮
    document.querySelectorAll('#layer-panel button[data-layer]').forEach(btn => {
        btn.addEventListener('click', () => toggleLayer(btn.dataset.layer));
    });

    // 昼夜切换
    document.getElementById('btn-daynight').addEventListener('click', toggleDayNight);

    // 线框模式
    document.getElementById('btn-wireframe').addEventListener('click', toggleWireframe);

    // GLB导出
    document.getElementById('btn-export-glb').addEventListener('click', exportSceneGLB);

    // 射线点击
    renderer.domElement.addEventListener('click', onCanvasClick);

    // 键盘快捷键
    window.addEventListener('keydown', (event) => {
        switch (event.key.toLowerCase()) {
            case '1': toggleLayer('buildings'); break;
            case '2': toggleLayer('vegetation'); break;
            case '3': toggleLayer('water'); break;
            case '4': toggleLayer('terrain'); break;
            case '5': toggleLayer('labels'); break;
            case 'd': toggleDayNight(); break;
            case 'w': toggleWireframe(); break;
            case 'r':
                setViewMode('orbit');
                document.getElementById('info-panel').querySelector('h1').textContent = '杭州西湖';
                break;
            case 'e': exportSceneGLB(); break;
            case '0': setAllLayers(true); break;
            case 'escape':
                document.getElementById('detail-card').classList.remove('visible');
                break;
        }
    });

    // 数字孪生数据刷新
    setInterval(updateDigitalTwinData, 5000);
}

function updateDigitalTwinData() {
    document.getElementById('visitor-count').textContent = (12000 + Math.floor(Math.random() * 3000)).toLocaleString();
    document.getElementById('temperature').textContent = (22 + Math.floor(Math.random() * 7)) + '°C';
    document.getElementById('weather').textContent = ['晴', '多云', '阴', '小雨'][Math.floor(Math.random() * 4)];
    document.getElementById('aqi').textContent = ['优', '良', '中'][Math.floor(Math.random() * 3)];
}

// ==================== 动画循环 ====================
function animate() {
    requestAnimationFrame(animate);

    const dt = Math.min(clock.getDelta(), 0.1);

    // 湖面波动
    if (westLake && layers.water.visible) {
        westLake.material.opacity = 0.65 + Math.sin(Date.now() * 0.0008) * 0.05;
    }

    // 动画小船
    if (layers.buildings.visible) {
        updateBoats(dt);
    }

    // 动画飞鸟
    if (layers.labels.visible) {
        updateBirds(dt);
    }

    controls.update();
    renderer.render(scene, camera);
}

// ==================== 启动 ====================
init();
console.log('🏞 杭州西湖数字孪生系统已就绪');
console.log('  图层切换: 按键1-5 | 昼夜: D | 线框: W | 导出GLB: E | 重置: R');
console.log('  点击建筑查看详情 | 滚轮缩放 | 右键平移');
console.log('  浙江树人学院 - 期中计算机图形学作业');
