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
    leifeng:      { x: 150, z: -620, y: 48,  name: '雷峰塔',       desc: '位于西湖南岸夕照山上，为五层八面楼阁式塔。新塔建于2002年，塔身铜瓦铜斗拱，塔内完整保护着千年古塔遗址，是"雷峰夕照"景观的主体建筑。' },
    santanyinyue: { x: 100, z: -200, y: 0,   name: '三潭印月',     desc: '位于西湖湖心偏南，由小瀛洲岛与三座石塔组成。三塔鼎立湖面，是西湖的标志性景观，也是"西湖十景"之一，以月夜塔中点烛、水中映月的奇景闻名。' },
    gushan:       { x: -150,z: 400,  y: 38,  name: '孤山',         desc: '位于西湖偏北岸，是湖中最大的天然岛屿。岛上楼台亭阁错落，人文古迹密集，包括西泠印社、文澜阁、放鹤亭等，被誉为"西湖文化精华的荟萃之地"。' },
    duanqiao:     { x: 1150,z: 400,  y: 0,   name: '断桥残雪',     desc: '位于白堤东端，是一座单孔石拱桥。断桥是"西湖十景"之一，以冬雪时节桥面积雪半融、远望似断非断的景色著称，也是《白蛇传》中许仙与白娘子邂逅之地。' },
    quyuan:       { x: 310, z: 1000, y: 0,   name: '曲院风荷',     desc: '位于西湖西北角，是一处以荷花为主题的园林景区。园内大片荷池连片，九曲桥穿行其间，夏日荷花盛开时尤为壮观，是"曲院风荷"十景所在地。' },
    baidi:        { x: 740, z: 400,  y: 0,   name: '白堤',         desc: '全长约1公里，东起断桥西接孤山，唐代诗人白居易任杭州刺史时所筑。堤上桃柳相间，春来一株杨柳一株桃，是"白堤春晓"的所在地。' },
    sudi:         { x: 280, z: 150,  y: 0,   name: '苏堤',         desc: '苏堤全长近三公里，纵贯西湖，堤上共建有六座单孔石拱桥，自南向北依次为映波、锁澜、望山、压堤、东浦、跨虹。六桥起伏有致，为苏堤增添了韵律感，是"苏堤春晓"的核心组成部分。' },
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

// 精细石拱桥（苏堤六桥专用）
function createDetailedArchBridge(spec) {
    const { span, width, archH, color, name } = spec;
    const g = new THREE.Group();
    const stoneMat = new THREE.MeshStandardMaterial({ color, roughness: 0.65, metalness: 0.05 });
    const stoneDark = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.8).getHex(), roughness: 0.7 });
    const railMat = new THREE.MeshStandardMaterial({ color: 0x999999, roughness: 0.6 });

    allMaterials.push(stoneMat, stoneDark, railMat);

    // 拱券（纵联分节并列砌筑）
    const archRing = new THREE.Mesh(new THREE.TorusGeometry(span / 2, 0.35, 8, 16, Math.PI), stoneMat);
    archRing.position.y = 2.0;
    archRing.castShadow = true;
    g.add(archRing);

    // 拱券券石线（9道券石并列）
    for (let i = 0; i < 9; i++) {
        const offset = (i - 4) * 0.07;
        const voussoir = new THREE.Mesh(new THREE.TorusGeometry(span / 2, 0.03, 8, 16, Math.PI), stoneDark);
        voussoir.position.set(0, 2.0, offset);
        g.add(voussoir);
    }

    // 拱顶螭首
    const dragon = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.25), stoneDark);
    dragon.position.set(0, 2.0 + archH * 0.4, 0);
    g.add(dragon);

    // 桥面（带弧度）
    const deckLen = span + 3;
    const deck = new THREE.Mesh(new THREE.BoxGeometry(deckLen, 0.3, width - 0.4), stoneMat);
    deck.position.y = 2.0 + archH * 0.35;
    deck.castShadow = true; deck.receiveShadow = true;
    g.add(deck);

    // 桥面沥青覆层
    const asphalt = new THREE.Mesh(new THREE.BoxGeometry(deckLen - 0.2, 0.06, width - 0.8),
        new THREE.MeshStandardMaterial({ color: 0x3A3A3A, roughness: 0.9 }));
    asphalt.position.y = 2.0 + archH * 0.35 + 0.18;
    g.add(asphalt);

    // 台阶痕迹（两侧残留石阶边）
    for (let s = -1; s <= 1; s += 2) {
        for (let i = 0; i < 4; i++) {
            const step = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.5), stoneMat);
            step.position.set(s * (span / 2 - i * 0.3), 2.0 + archH * 0.35 + 0.2, (width / 2 - 0.2) * s);
            g.add(step);
        }
    }

    // 栏板+望柱（两侧）
    const numPanels = Math.floor(span / 1.3) + 2;
    for (let side = -1; side <= 1; side += 2) {
        const rz = side * (width / 2 - 0.25);

        // 望柱（覆莲头）
        for (let i = 0; i < numPanels + 1; i++) {
            const rx = -span / 2 - 1.5 + i * ((span + 3) / numPanels);
            const prog = (rx + span / 2 + 1.5) / (span + 3);
            const curveY = Math.sin(prog * Math.PI) * archH * 0.55 + 2.0;

            const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.8, 8), railMat);
            post.position.set(rx, curveY + 0.15, rz);
            post.castShadow = true;
            g.add(post);

            // 覆莲柱头
            const lotus = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.12, 6), stoneMat);
            lotus.position.set(rx, curveY + 0.6, rz);
            g.add(lotus);
        }

        // 栏板（横档）
        const railTop = new THREE.Mesh(new THREE.BoxGeometry(span + 2.8, 0.06, 0.1), railMat);
        railTop.position.set(0, 2.0 + archH * 0.35 + 0.55, rz);
        g.add(railTop);

        const railMid = new THREE.Mesh(new THREE.BoxGeometry(span + 2.8, 0.06, 0.1), railMat);
        railMid.position.set(0, 2.0 + archH * 0.35 + 0.25, rz);
        g.add(railMid);
    }

    // 特殊细节（按桥名）
    if (name === '映波桥') {
        // 跃狮雕刻（简化：栏板外侧四个小方块）
        for (let i = 0; i < 4; i++) {
            const lion = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.1), stoneDark);
            lion.position.set(-span / 2 + 1.5 + i * (span / 4), 2.0 + archH * 0.35 + 0.3, width / 2 + 0.1);
            g.add(lion);
        }
    }
    if (name === '压堤桥') {
        // 八字形挡墙（桥面最窄）
        for (let s = -1; s <= 1; s += 2) {
            const buttress = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.8, 2), stoneMat);
            buttress.position.set(s * (span / 2 + 0.5), 1.0, 0);
            buttress.castShadow = true;
            g.add(buttress);
        }
    }
    if (name === '东浦桥') {
        // 系船铁环（桥两侧）
        for (let s = -1; s <= 1; s += 2) {
            const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.02, 8, 12), new THREE.MeshStandardMaterial({ color: 0x5A3A2A, roughness: 0.5, metalness: 0.6 }));
            ring.position.set(s * (span / 2 - 0.5), 1.0, width / 2 + 0.15);
            g.add(ring);
        }
    }
    if (name === '跨虹桥') {
        // 新旧石料色差（桥腹用另一种颜色）
        const belly = new THREE.Mesh(new THREE.BoxGeometry(span * 0.6, 0.3, width * 0.5),
            new THREE.MeshStandardMaterial({ color: 0xA0A0A0, roughness: 0.7 }));
        belly.position.set(0, 0.8, 0);
        g.add(belly);
    }

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

    // 六桥尺寸（基于详细描述）
    const bridgeSpecs = [
        { z: -750, name: '映波桥', span: 7.4, width: 7.0, archH: 2.8, color: 0x889898, desc: '映波桥：苏堤南起第一桥，全长17米，净跨7.4米，宽7米。栏板雕刻跃狮四只和蝴蝶纹，拱顶螭首清晰可辨。' },
        { z: -460, name: '锁澜桥', span: 6.2, width: 6.4, archH: 2.5, color: 0x8E908E, desc: '锁澜桥：苏堤南起第二桥，全长16.9米，净跨6.2米。望柱覆莲雕刻最为立体，栏板素雅仅两端饰卷草纹。' },
        { z: -170, name: '望山桥', span: 4.7, width: 7.0, archH: 2.2, color: 0x889090, desc: '望山桥：苏堤第三桥，全长16.9米，拱券矢高最小（约2.2米），桥面较平。西侧栏板有造船撞击擦痕。' },
        { z: 120,  name: '压堤桥', span: 6.3, width: 4.0, archH: 2.4, color: 0x8E9088, desc: '压堤桥：苏堤第四桥，全长16.9米，桥面最窄仅4米。两侧引道呈八字形挡墙，桥下水面最深约3米。' },
        { z: 410,  name: '东浦桥', span: 5.9, width: 4.3, archH: 2.3, color: 0x889090, desc: '东浦桥：苏堤第五桥，全长16.8米。拱肋侧面有系船铁环，栏板外侧可见历次抬高桥面的接缝痕迹。' },
        { z: 700,  name: '跨虹桥', span: 8.1, width: 4.3, archH: 3.5, color: 0x8A9A8A, desc: '跨虹桥：苏堤第六桥，全长21.1米，拱高最大约3.5米。桥身条石较大，桥腹可见新旧石料色差。' }
    ];

    bridgeSpecs.forEach(b => {
        const bridge = createDetailedArchBridge(b);
        bridge.position.set(cx, 0.25, b.z);
        bridge.name = b.name;
        layers.buildings.add(bridge);
        buildingRefs.push({ mesh: bridge, data: { name: b.name, desc: b.desc, x: cx, z: b.z } });
    });

    treeRow(cx - 6, sz, cx - 6, ez, 80, 6);
    treeRow(cx + 6, sz, cx + 6, ez, 80, 6);
}

// ==================== 三潭印月（小瀛洲岛，精细版） ====================
function createXiaoyingzhouIsland() {
    const pos = LANDMARKS.santanyinyue;
    const g = new THREE.Group();
    g.name = '小瀛洲岛（三潭印月）';

    // 岛尺寸：田字形，外环堤长928m，本场景缩小比例
    const iw = 30, ih = 34;  // 岛长宽
    const cw = 4;  // 十字水道宽度
    const dykeW = 4;  // 堤宽

    // 材质
    const dykeMat = new THREE.MeshStandardMaterial({ color: 0xA89878, roughness: 0.85 }); // 青石板堤
    const greenMat = new THREE.MeshStandardMaterial({ color: 0x4a8c3f, roughness: 0.8 });  // 绿地
    const wMat = new THREE.MeshStandardMaterial({ color: 0x4DB8E8, transparent: true, opacity: 0.75, roughness: 0.08, metalness: 0.2 });
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xF5F0E0, roughness: 0.55 });
    const roofGray = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.6 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x6B4226, roughness: 0.7 });
    const pillarRed = new THREE.MeshStandardMaterial({ color: 0xCC3333, roughness: 0.5 });
    allMaterials.push(dykeMat, greenMat, wMat, wallMat, roofGray, woodMat, pillarRed);

    // 外环堤（环形）
    const dykeOuter = new THREE.Mesh(new THREE.TorusGeometry((iw + ih) / 4, dykeW / 2, 8, 4), dykeMat);
    dykeOuter.rotation.x = Math.PI / 2;
    dykeOuter.position.y = 0.3;
    dykeOuter.scale.set(iw / ((iw + ih) / 2), 1, ih / ((iw + ih) / 2));
    dykeOuter.castShadow = true; dykeOuter.receiveShadow = true;
    g.add(dykeOuter);

    // 基底填实
    const baseFill = new THREE.Mesh(new THREE.BoxGeometry(iw, 0.5, ih), dykeMat);
    baseFill.position.y = 0.25;
    baseFill.castShadow = true; baseFill.receiveShadow = true;
    g.add(baseFill);

    // 十字内堤
    const crossH = new THREE.Mesh(new THREE.BoxGeometry(iw - 2, 0.3, cw), dykeMat);
    crossH.position.y = 0.5;
    g.add(crossH);
    const crossV = new THREE.Mesh(new THREE.BoxGeometry(cw, 0.3, ih - 2), dykeMat);
    crossV.position.y = 0.5;
    g.add(crossV);

    // 十字水道（水面）
    const waterH = new THREE.Mesh(new THREE.PlaneGeometry(iw - 2, cw - 1), wMat);
    waterH.rotation.x = -Math.PI / 2; waterH.position.y = 0.68;
    g.add(waterH);
    const waterV = new THREE.Mesh(new THREE.PlaneGeometry(cw - 1, ih - 2), wMat);
    waterV.rotation.x = -Math.PI / 2; waterV.position.y = 0.68;
    g.add(waterV);

    // 四个象限绿地 + 亭
    const quadrants = [
        { x: 1, z: 1, name: '东北' }, { x: -1, z: 1, name: '西北' },
        { x: 1, z: -1, name: '东南' }, { x: -1, z: -1, name: '西南' }
    ];
    const qw = (iw - cw * 2) / 2, qh = (ih - cw * 2) / 2;

    quadrants.forEach(({ x, z }, idx) => {
        const cx = x * (cw / 2 + qw / 2), cz = z * (cw / 2 + qh / 2);

        // 绿地
        const green = new THREE.Mesh(new THREE.BoxGeometry(qw - 1, 0.3, qh - 1), greenMat);
        green.position.set(cx, 0.85, cz);
        green.castShadow = true; green.receiveShadow = true;
        g.add(green);

        // 树
        for (let i = 0; i < 5; i++) {
            const t = mktree(0.45 + Math.random() * 0.35);
            t.position.set(cx + (Math.random() - 0.5) * (qw - 3), 0.85, cz + (Math.random() - 0.5) * (qh - 3));
            g.add(t);
        }

        // 小亭阁
        if (idx === 0) {
            // 东北象限：九曲桥入口 + 开网亭（六角）
            const kaiwang = createHexPavilion(1.5, roofGray, pillarRed);
            kaiwang.position.set(cx + qw * 0.3, 0.85, cz);
            g.add(kaiwang);
        } else if (idx === 1) {
            // 西北象限：亭亭亭（四角方亭，台基高1.2米）
            const tingting = createSquarePavilion(1.6, roofGray, pillarRed, 1.2);
            tingting.position.set(cx - qw * 0.3, 1.45, cz + qh * 0.3);
            g.add(tingting);
        } else if (idx === 2) {
            // 东南象限：普通亭阁
            const pav = pave(1.5, 0x4a4a4a);
            pav.position.set(cx + qw * 0.2, 0.85, cz - qh * 0.2);
            g.add(pav);
        } else {
            // 西南象限：白粉漏墙
            const louqiang = createLeakWall(5, 1.8);
            louqiang.position.set(cx - qw * 0.2, 0.85, cz - qh * 0.3);
            g.add(louqiang);
        }
    });

    // 九曲桥（岛北，从码头到亭亭亭方向）
    const zigzag = zigzagBridge(-iw / 2 + 2, ih / 2 - 1, 8, 3.5, 'z');
    zigzag.position.set(0, 0, 0);
    g.add(zigzag);

    // 我心相印亭（南端，双亭+月洞墙）
    const southY = -ih / 2 + 3;
    const pav1 = createSquarePavilion(1.3, roofGray, new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5 }), 0.6);
    pav1.position.set(-1.8, 0.85, southY);
    g.add(pav1);
    const pav2 = createSquarePavilion(1.3, roofGray, new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5 }), 0.6);
    pav2.position.set(1.8, 0.85, southY);
    g.add(pav2);

    // 月洞门墙（连接两亭）
    const moonWall = new THREE.Group();
    const mWallMesh = new THREE.Mesh(new THREE.BoxGeometry(3.6, 2.2, 0.25), wallMat);
    mWallMesh.position.y = 1.25;
    moonWall.add(mWallMesh);
    // 圆形月洞门（用环表示）
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.04, 8, 16), roofGray);
    ring.position.y = 1.25;
    ring.position.z = 0.14;
    moonWall.add(ring);
    moonWall.position.set(0, 0.85, southY);
    g.add(moonWall);

    g.position.set(pos.x, 0, pos.z);
    layers.buildings.add(g);
    buildingRefs.push({ mesh: g, data: LANDMARKS.santanyinyue });
}

// 辅助：六角攒尖亭
function createHexPavilion(size, roofMat, pillarMat) {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.7, size * 0.8, 0.2, 6), new THREE.MeshStandardMaterial({ color: 0x909090, roughness: 0.7 }));
    base.position.y = 0.1; base.castShadow = true; base.receiveShadow = true;
    g.add(base);

    for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, size * 0.9, 8), pillarMat);
        col.position.set(Math.cos(a) * size * 0.58, size * 0.5, Math.sin(a) * size * 0.58);
        col.castShadow = true;
        g.add(col);
    }
    const roof = new THREE.Mesh(new THREE.ConeGeometry(size * 0.85, size * 0.6, 6), roofMat);
    roof.position.y = size * 1.05; roof.castShadow = true;
    g.add(roof);
    const finial = new THREE.Mesh(new THREE.SphereGeometry(size * 0.08, 8, 8), new THREE.MeshStandardMaterial({ color: 0xDAA520, roughness: 0.3, metalness: 0.7 }));
    finial.position.y = size * 1.38;
    g.add(finial);
    return g;
}

// 辅助：四角方亭
function createSquarePavilion(size, roofMat, pillarMat, baseH = 0.6) {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(size * 0.85, baseH, size * 0.85), new THREE.MeshStandardMaterial({ color: 0x8B8B7A, roughness: 0.7 }));
    base.position.y = baseH / 2; base.castShadow = true; base.receiveShadow = true;
    g.add(base);

    const halfW = size * 0.3;
    for (let sx = -1; sx <= 1; sx += 2) {
        for (let sz = -1; sz <= 1; sz += 2) {
            const col = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, size * 0.85, 8), pillarMat);
            col.position.set(sx * halfW, baseH + size * 0.42, sz * halfW);
            col.castShadow = true;
            g.add(col);
        }
    }
    // 歇山顶简化（用四棱锥+三角山花）
    const roofH = size * 0.5;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(size * 0.7, roofH, 4), roofMat);
    roof.position.y = baseH + size * 0.85 + roofH / 2;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    g.add(roof);
    const finial = new THREE.Mesh(new THREE.SphereGeometry(size * 0.06, 8, 8), new THREE.MeshStandardMaterial({ color: 0xDAA520, roughness: 0.3, metalness: 0.7 }));
    finial.position.y = baseH + size * 0.85 + roofH + 0.1;
    g.add(finial);
    return g;
}

// 辅助：白粉漏墙
function createLeakWall(length, height) {
    const g = new THREE.Group();
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xF5F0E0, roughness: 0.55 });
    const capMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.6 });
    allMaterials.push(wallMat, capMat);

    const wall = new THREE.Mesh(new THREE.BoxGeometry(length, height, 0.2), wallMat);
    wall.position.y = height / 2; wall.castShadow = true; wall.receiveShadow = true;
    g.add(wall);

    const cap = new THREE.Mesh(new THREE.BoxGeometry(length + 0.2, 0.1, 0.3), capMat);
    cap.position.y = height + 0.05;
    g.add(cap);

    // 四个漏窗（方、六边、圆、海棠形——用不同形状表示）
    const windowShapes = [
        { shape: 'square', x: -length * 0.3, y: height * 0.55, s: 0.35 },
        { shape: 'hexagon', x: -length * 0.1, y: height * 0.5, s: 0.3 },
        { shape: 'circle', x: length * 0.1, y: height * 0.55, s: 0.32 },
        { shape: 'circle', x: length * 0.3, y: height * 0.5, s: 0.28 }
    ];
    windowShapes.forEach(ws => {
        const hole = new THREE.Mesh(new THREE.TorusGeometry(ws.s, 0.03, ws.shape === 'hexagon' ? 6 : 8, ws.shape === 'square' ? 4 : 16), capMat);
        hole.position.set(ws.x, ws.y, 0.12);
        g.add(hole);
    });
    return g;
}

// ==================== 三座石塔（精细版） ====================
function createSinglePagoda() {
    const g = new THREE.Group();

    // 青石材质（灰白，带风化感）
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x9EA89E, roughness: 0.55, metalness: 0.05 });
    const stoneDarker = new THREE.MeshStandardMaterial({ color: 0x8A948A, roughness: 0.6, metalness: 0.05 });
    const mossMat = new THREE.MeshStandardMaterial({ color: 0x5A7A4A, roughness: 0.9, metalness: 0 });
    allMaterials.push(stoneMat, stoneDarker, mossMat);

    // 塔基下层（扁圆形，直径1.2m，高0.4m）
    const baseLower = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.65, 0.4, 16), stoneMat);
    baseLower.position.y = 0.2; baseLower.castShadow = true; baseLower.receiveShadow = true;
    g.add(baseLower);

    // 塔基上层（直径0.9m，高0.3m）
    const baseUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 0.3, 16), stoneDarker);
    baseUpper.position.y = 0.55; baseUpper.castShadow = true; baseUpper.receiveShadow = true;
    g.add(baseUpper);

    // 塔身球形（直径0.92m，中空，5孔）
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.46, 32, 24), stoneMat);
    sphere.position.y = 1.05; sphere.castShadow = true;
    g.add(sphere);

    // 五个圆孔（孔径0.25m，边缘凸起弦纹）
    for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const holeOuter = new THREE.Mesh(new THREE.TorusGeometry(0.125, 0.015, 8, 16), stoneDarker);
        holeOuter.position.set(Math.cos(a) * 0.46, 1.05, Math.sin(a) * 0.46);
        holeOuter.lookAt(new THREE.Vector3(Math.cos(a) * 2, 1.05, Math.sin(a) * 2));
        g.add(holeOuter);
    }

    // 苔藓斑点（用小扁球模拟）
    for (let i = 0; i < 5; i++) {
        const mossAngle = Math.random() * Math.PI * 2;
        const mossPhi = 0.3 + Math.random() * 1.0;
        const moss = new THREE.Mesh(new THREE.SphereGeometry(0.04, 4, 4), mossMat);
        moss.position.set(
            Math.sin(mossPhi) * Math.cos(mossAngle) * 0.46,
            1.05 + Math.cos(mossPhi) * 0.46,
            Math.sin(mossPhi) * Math.sin(mossAngle) * 0.46
        );
        g.add(moss);
    }

    // 莲瓣纹浮雕（上下各一圈）
    for (let ring = -1; ring <= 1; ring += 2) {
        for (let i = 0; i < 16; i++) {
            const a = (i / 16) * Math.PI * 2;
            const petal = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.04, 0.06), stoneDarker);
            petal.position.set(
                Math.cos(a) * 0.48, 1.05 + ring * 0.4, Math.sin(a) * 0.48
            );
            petal.rotation.y = -a;
            petal.rotation.z = ring * 0.3;
            g.add(petal);
        }
    }

    // 六角石盖（六边各长0.3m，厚0.1m）
    const stoneCap = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 0.1, 6), stoneDarker);
    stoneCap.position.y = 1.55; stoneCap.castShadow = true;
    g.add(stoneCap);

    // 六角小亭式顶：六根小石柱
    const pillarR = 0.25;
    for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const miniCol = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.4, 8), stoneMat);
        miniCol.position.set(Math.cos(a) * pillarR, 1.8, Math.sin(a) * pillarR);
        miniCol.castShadow = true;
        g.add(miniCol);
    }

    // 六角攒尖小顶
    const miniRoof = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.35, 6), stoneDarker);
    miniRoof.position.y = 2.1; miniRoof.castShadow = true;
    g.add(miniRoof);

    // 葫芦形宝顶（高0.3m）
    const gourdLower = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 12), stoneMat);
    gourdLower.position.y = 2.35;
    g.add(gourdLower);
    const gourdStem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.1, 8), stoneDarker);
    gourdStem.position.y = 2.42;
    g.add(gourdStem);
    const gourdUpper = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 12), stoneMat);
    gourdUpper.position.y = 2.5;
    g.add(gourdUpper);
    // 铁质刹杆
    const ironPin = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.1, 8), new THREE.MeshStandardMaterial({ color: 0x6B4433, roughness: 0.5, metalness: 0.6 }));
    ironPin.position.y = 2.57;
    g.add(ironPin);

    // 水下基座（略露出水面约0.1m）
    const underwater = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.6, 0.3, 16), new THREE.MeshStandardMaterial({ color: 0x6A8A6A, roughness: 0.9, transparent: true, opacity: 0.6 }));
    underwater.position.y = -0.05;
    g.add(underwater);

    return g;
}

function createThreePagodas() {
    const pos = LANDMARKS.santanyinyue;
    // 等边三角形，间距约62米 → 场景缩放为spacing
    const spacing = 14;
    const th = spacing * Math.sqrt(3) / 2;
    const cx = pos.x, cz = pos.z - 22;

    const positions = [
        { x: cx - spacing / 2, z: cz - th / 3 },
        { x: cx + spacing / 2, z: cz - th / 3 },
        { x: cx, z: cz + th * 2 / 3 }
    ];

    positions.forEach(({ x, z }) => {
        const pagoda = createSinglePagoda();
        pagoda.position.set(x, 0.15, z);
        pagoda.name = '三潭石塔';
        layers.buildings.add(pagoda);
        buildingRefs.push({ mesh: pagoda, data: { name: '三潭石塔', desc: '青石质球形塔，高2.5米，塔身均布五孔。塔顶六角小亭式，葫芦宝顶。三塔间距62米呈等边三角形，月夜塔中点烛、水中映月为西湖绝景。' } });
    });
}

// ==================== 孤山（精细版，含西泠印社、文澜阁、放鹤亭） ====================
function createGushan() {
    const pos = LANDMARKS.gushan;
    const g = new THREE.Group();
    g.name = '孤山';

    const hillMat = new THREE.MeshStandardMaterial({ color: 0x5a8a4a, roughness: 0.85 });
    allMaterials.push(hillMat);

    // 山体：东西长1000米→缩放到场景，由多个锥体构成
    const hillData = [
        { x: 0, z: 0, r: 10, h: 13 },
        { x: 5, z: 2, r: 8, h: 9.5 },
        { x: -6, z: -1, r: 9, h: 10.5 },
        { x: 4, z: -3, r: 7, h: 7 },
        { x: -4, z: 3, r: 7, h: 7.5 },
        { x: -8, z: -2, r: 6, h: 5 },
        { x: 7, z: 4, r: 5, h: 4.5 }
    ];

    hillData.forEach(d => {
        const hill = new THREE.Mesh(new THREE.ConeGeometry(d.r, d.h, 12), hillMat);
        hill.position.set(d.x, d.h / 2, d.z);
        hill.castShadow = true; hill.receiveShadow = true;
        g.add(hill);
    });

    // ===== 西泠印社（山顶区域） =====
    const xlGroup = new THREE.Group();
    xlGroup.name = '西泠印社';

    // 拱形石门洞入口
    const archGate = new THREE.Group();
    const gateL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.5, 0.4), new THREE.MeshStandardMaterial({ color: 0x8A8A80, roughness: 0.6 }));
    gateL.position.set(-1.0, 1.25, 0); archGate.add(gateL);
    const gateR = gateL.clone(); gateR.position.x = 1.0; archGate.add(gateR);
    const gateTop = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.2, 0.4), new THREE.MeshStandardMaterial({ color: 0x7A7A70, roughness: 0.6 }));
    gateTop.position.y = 2.5; archGate.add(gateTop);
    archGate.position.set(3, getHillH(3, -2, hillData), -2);
    xlGroup.add(archGate);

    // 柏堂（面阔五间20米→缩放）
    const baitang = createHallBuilding(8, 4, 3.5, 0x555555, 0xF5F0E0);
    baitang.position.set(-1, getHillH(-1, -2.5, hillData), -2.5);
    xlGroup.add(baitang);

    // 华严经塔（八角十一层石塔，通高8米）
    const huayanPagoda = createHuayanPagoda();
    huayanPagoda.position.set(-5, getHillH(-5, 1, hillData), 1);
    xlGroup.add(huayanPagoda);

    // 仰贤亭（六角）
    const yangxian = createHexPavilion(1.8, new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.6 }), new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.5 }));
    yangxian.position.set(2, getHillH(2, 1.5, hillData), 1.5);
    xlGroup.add(yangxian);

    xlGroup.position.set(0, 0, 0);
    g.add(xlGroup);

    // ===== 文澜阁（孤山南麓） =====
    const wlg = new THREE.Group();
    wlg.name = '文澜阁';

    // 门厅
    const gateHall = createHallBuilding(4, 2.5, 2.2, 0x333333, 0xF5F0E0);
    gateHall.position.set(0, getHillH(0, -4, hillData), -4);
    wlg.add(gateHall);

    // 藏书楼主楼（重檐硬山顶，面阔六间25米→缩放）
    const mainHall = new THREE.Group();
    const hBody = new THREE.Mesh(new THREE.BoxGeometry(10, 4, 5), new THREE.MeshStandardMaterial({ color: 0xF5F0E0, roughness: 0.6 }));
    hBody.position.y = 2; hBody.castShadow = true; hBody.receiveShadow = true;
    mainHall.add(hBody);
    // 下层屋檐
    const lowerEaves = new THREE.Mesh(new THREE.CylinderGeometry(6, 5.2, 0.6, 4), new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6 }));
    lowerEaves.position.y = 4.2; lowerEaves.rotation.y = Math.PI / 4;
    mainHall.add(lowerEaves);
    // 上层屋檐（重檐）
    const upperBody = new THREE.Mesh(new THREE.BoxGeometry(8, 2.5, 4), new THREE.MeshStandardMaterial({ color: 0xF5F0E0, roughness: 0.6 }));
    upperBody.position.y = 5.5;
    mainHall.add(upperBody);
    const upperEaves = new THREE.Mesh(new THREE.CylinderGeometry(4.8, 4.2, 0.5, 4), new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6 }));
    upperEaves.position.y = 7.0; upperEaves.rotation.y = Math.PI / 4;
    mainHall.add(upperEaves);
    // 匾额
    const plaque = new THREE.Mesh(new THREE.BoxGeometry(3, 0.5, 0.1), new THREE.MeshStandardMaterial({ color: 0x1A1A1A, roughness: 0.5 }));
    plaque.position.set(0, 7.3, 2.5);
    mainHall.add(plaque);

    mainHall.position.set(0.5, getHillH(0.5, -5.5, hillData), -5.5);
    wlg.add(mainHall);

    // 假山水池
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x7A8A8A, roughness: 0.8 });
    const rock = new THREE.Mesh(new THREE.ConeGeometry(1.8, 3.5, 8), rockMat);
    rock.position.set(0, getHillH(0, -3, hillData), -3);
    rock.castShadow = true;
    wlg.add(rock);

    wlg.position.set(2, 0, -1);
    g.add(wlg);

    // ===== 放鹤亭（东北麓） =====
    const fanghe = createSquarePavilion(
        2.2,
        new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.6 }),
        new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.5 }),
        0.8
    );
    fanghe.position.set(7, getHillH(7, 4.5, hillData), 4.5);
    fanghe.name = '放鹤亭';
    g.add(fanghe);

    // 散布树木
    for (let i = 0; i < 25; i++) {
        const tx = (Math.random() - 0.5) * 16, tz = (Math.random() - 0.5) * 12;
        const th = getHillH(tx, tz, hillData);
        if (th > 0.3) {
            const t = mktree(0.4 + Math.random() * 0.6);
            t.position.set(tx, th, tz);
            g.add(t);
        }
    }

    g.position.set(pos.x, 0, pos.z);
    layers.buildings.add(g);
    buildingRefs.push({ mesh: g, data: LANDMARKS.gushan });
}

// 辅助：殿堂建筑
function createHallBuilding(width, depth, height, roofColor, wallColor) {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.6 });
    const roofMat = new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.6 });
    allMaterials.push(bodyMat, roofMat);

    const body = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), bodyMat);
    body.position.y = height / 2; body.castShadow = true; body.receiveShadow = true;
    g.add(body);

    // 歇山顶（四棱锥+两侧山花简化）
    const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(width, depth) * 0.6, height * 0.5, 4), roofMat);
    roof.position.y = height + height * 0.25; roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    g.add(roof);
    return g;
}

// 辅助：华严经塔（八角十一层石塔）
function createHuayanPagoda() {
    const g = new THREE.Group();
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x8A8E88, roughness: 0.6, metalness: 0.05 });
    allMaterials.push(stoneMat);

    // 须弥座
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, 0.4, 8), stoneMat);
    base.position.y = 0.2; base.castShadow = true; base.receiveShadow = true;
    g.add(base);

    // 十一层，每层收分
    let currentH = 0.5;
    for (let i = 0; i < 11; i++) {
        const layerR = 0.65 - i * 0.04;
        const layerH = 0.55;
        const body = new THREE.Mesh(new THREE.CylinderGeometry(layerR, layerR + 0.02, layerH, 8), stoneMat);
        body.position.y = currentH + layerH / 2; body.castShadow = true;
        g.add(body);

        // 出檐
        const eaves = new THREE.Mesh(new THREE.CylinderGeometry(layerR + 0.15, layerR, 0.08, 8), stoneMat);
        eaves.position.y = currentH + layerH;
        g.add(eaves);

        currentH += layerH + 0.05;
    }

    // 塔刹（宝瓶形）
    const spire = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 8), stoneMat);
    spire.position.y = currentH + 0.2;
    g.add(spire);

    return g;
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

// ==================== 断桥残雪（精细版） ====================
function createDuanqiao() {
    const pos = LANDMARKS.duanqiao;
    const g = new THREE.Group();
    g.name = '断桥残雪';

    // 材质：青石（灰青色，有风化感）
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x8A8E90, roughness: 0.6, metalness: 0.05 });
    const stoneDark = new THREE.MeshStandardMaterial({ color: 0x7A7E80, roughness: 0.65, metalness: 0.05 });
    const asphaltMat = new THREE.MeshStandardMaterial({ color: 0x3A3A3A, roughness: 0.9 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x6B4226, roughness: 0.7 });
    allMaterials.push(stoneMat, stoneDark, asphaltMat);

    // 尺寸：桥长28.8米，宽8.6米，净跨6.1米，矢高3.2米
    const bridgeLen = 18;     // 拱桥主体
    const bridgeW = 7.5;     // 总宽
    const span = 6.1;
    const rise = 3.2;        // 矢高

    // 拱券（纵联分节并列，7节×5道）
    const arch = new THREE.Mesh(new THREE.TorusGeometry(span / 2, 0.35, 8, 16, Math.PI), stoneMat);
    arch.position.y = 2.5;
    arch.castShadow = true;
    g.add(arch);

    // 券石分线
    for (let i = 0; i < 7; i++) {
        const offset = (i - 3) * 0.07;
        const line = new THREE.Mesh(new THREE.TorusGeometry(span / 2, 0.02, 8, 16, Math.PI), stoneDark);
        line.position.set(0, 2.5, offset);
        g.add(line);
    }

    // 拱顶螭首（残缺）
    const dragon = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.2), stoneDark);
    dragon.position.set(0, 2.5 + rise * 0.4, 0);
    g.add(dragon);

    // 桥面（弧形拱起，最高处距水位4.5米）
    const deck = new THREE.Mesh(new THREE.BoxGeometry(bridgeLen, 0.3, bridgeW - 0.5), stoneMat);
    deck.position.y = 2.5 + rise * 0.4;
    deck.castShadow = true; deck.receiveShadow = true;
    g.add(deck);

    // 中央沥青路面
    const asphalt = new THREE.Mesh(new THREE.BoxGeometry(bridgeLen - 0.3, 0.05, bridgeW - 2.4), asphaltMat);
    asphalt.position.y = 2.5 + rise * 0.4 + 0.18;
    asphalt.receiveShadow = true;
    g.add(asphalt);

    // 引道（南北各延伸约10米）
    for (let s = -1; s <= 1; s += 2) {
        const ramp = new THREE.Mesh(new THREE.BoxGeometry(5, 0.3, bridgeW - 0.5), stoneMat);
        ramp.position.set(s * (bridgeLen / 2 + 2.5), 1.5, 0);
        ramp.castShadow = true; ramp.receiveShadow = true;
        g.add(ramp);
    }

    // 栏杆：每侧8块栏板+9根望柱
    for (let side = -1; side <= 1; side += 2) {
        const rz = side * (bridgeW / 2 - 0.35);

        // 望柱（柱头覆莲，素面）
        for (let i = 0; i < 9; i++) {
            const rx = -bridgeLen / 2 + 0.5 + i * (bridgeLen / 8);
            const prog = (rx + bridgeLen / 2) / bridgeLen;
            const curveY = Math.sin(prog * Math.PI) * rise * 0.5 + 2.5;

            const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.7, 8), stoneMat);
            post.position.set(rx, curveY + 0.15, rz);
            post.castShadow = true;
            g.add(post);

            // 覆莲柱头
            const lotus = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.1, 6), stoneDark);
            lotus.position.set(rx, curveY + 0.55, rz);
            g.add(lotus);
        }

        // 栏板横杆
        const topRail = new THREE.Mesh(new THREE.BoxGeometry(bridgeLen - 0.3, 0.06, 0.1), stoneMat);
        topRail.position.set(0, 2.5 + rise * 0.4 + 0.5, rz);
        g.add(topRail);
    }

    // 北侧台阶残留（23级，宽0.3m高0.12m）
    for (let i = 0; i < 5; i++) {
        const step = new THREE.Mesh(new THREE.BoxGeometry(bridgeW - 0.8, 0.12, 0.3), stoneMat);
        step.position.set(-bridgeLen / 2 - 2 + i * 0.3, 1.4 - i * 0.12, 0);
        step.castShadow = true;
        g.add(step);
    }
    // 南侧台阶残留（33级）
    for (let i = 0; i < 6; i++) {
        const step = new THREE.Mesh(new THREE.BoxGeometry(bridgeW - 0.8, 0.12, 0.3), stoneMat);
        step.position.set(bridgeLen / 2 + 2 - i * 0.3, 1.4 - i * 0.12, 0);
        step.castShadow = true;
        g.add(step);
    }

    // "断桥残雪"石碑（桥东北侧）
    const steleGroup = new THREE.Group();
    const steleBody = new THREE.Mesh(new THREE.BoxGeometry(0.6, 2.0, 0.2), stoneDark);
    steleBody.position.y = 1.0;
    steleGroup.add(steleBody);
    const steleBase = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.3, 0.4), stoneMat);
    steleBase.position.y = 0.15;
    steleGroup.add(steleBase);
    steleGroup.position.set(bridgeLen / 2 + 1.5, 0.5, -bridgeW / 2 - 1.5);
    g.add(steleGroup);

    // "云水光中"水榭（简化）
    const waterside = new THREE.Group();
    const wsBase = new THREE.Mesh(new THREE.BoxGeometry(5, 0.5, 3), woodMat);
    wsBase.position.y = 0.25; wsBase.castShadow = true;
    waterside.add(wsBase);
    for (let sx = -1; sx <= 1; sx += 2) {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 2.0, 8), new THREE.MeshStandardMaterial({ color: 0xCC2222, roughness: 0.5 }));
        col.position.set(sx * 1.8, 1.2, 0); col.castShadow = true;
        waterside.add(col);
    }
    const wsRoof = new THREE.Mesh(new THREE.ConeGeometry(3.2, 1.0, 4), new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.6 }));
    wsRoof.position.y = 2.3; wsRoof.rotation.y = Math.PI / 4;
    waterside.add(wsRoof);
    waterside.position.set(bridgeLen / 2 + 4, 0.5, -bridgeW / 2 - 1.5);
    g.add(waterside);

    // 桥墩分水尖（迎水面三角形）
    for (let s = -1; s <= 1; s += 2) {
        const pier = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.0, 0.6), stoneDark);
        pier.position.set(s * (span / 2 - 0.3), 1.0, 0);
        pier.castShadow = true;
        g.add(pier);
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

// ==================== 雷峰塔（2002年重建，精细版） ====================
function createLeifengPagoda() {
    const pos = LANDMARKS.leifeng;
    const g = new THREE.Group();
    g.name = '雷峰塔';

    // 材质定义
    const copperMat = new THREE.MeshStandardMaterial({ color: 0x8B5E3C, roughness: 0.35, metalness: 0.75 }); // 古铜色铜板
    const copperDark = new THREE.MeshStandardMaterial({ color: 0x6B3F1F, roughness: 0.4, metalness: 0.7 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x7A5A3A, roughness: 0.3, metalness: 0.65 }); // 铜瓦
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xC9A84C, roughness: 0.2, metalness: 0.85 }); // 鎏金（暗金）
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x9B8B6E, roughness: 0.75 });
    const platMat = new THREE.MeshStandardMaterial({ color: 0xA0A0A0, roughness: 0.6 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x88CCEE, transparent: true, opacity: 0.3, roughness: 0.05, metalness: 0.1 });
    const graniteMat = new THREE.MeshStandardMaterial({ color: 0xC8C0B8, roughness: 0.5, metalness: 0.05 });
    allMaterials.push(copperMat, copperDark, roofMat, goldMat, floorMat, platMat, glassMat, graniteMat);

    // 八边形尺寸
    const octSides = 8;
    const baseRadius = 14;     // 底层对径28米，半径14米
    const platformH = 9.8;     // 台基高9.8米

    // ===== 台基（遗址保护罩） =====
    const platBase = new THREE.Mesh(new THREE.CylinderGeometry(baseRadius + 4, baseRadius + 5, 1.5, octSides), graniteMat);
    platBase.position.y = 0.75;
    platBase.castShadow = true; platBase.receiveShadow = true;
    g.add(platBase);

    // 台基主体（八角形大玻璃罩）
    const glassBase = new THREE.Mesh(new THREE.CylinderGeometry(baseRadius + 2, baseRadius + 2, platformH, octSides), glassMat);
    glassBase.position.y = platformH / 2 + 1.5;
    g.add(glassBase);

    // 台基花岗岩包边框架
    for (let i = 0; i < octSides; i++) {
        const angle = (i / octSides) * Math.PI * 2;
        const frame = new THREE.Mesh(new THREE.BoxGeometry(0.3, platformH, 0.4), graniteMat);
        frame.position.set(
            Math.cos(angle) * (baseRadius + 2.15),
            platformH / 2 + 1.5,
            Math.sin(angle) * (baseRadius + 2.15)
        );
        g.add(frame);
    }

    // 台基顶平台（塔身首层地面）
    const topPlat = new THREE.Mesh(new THREE.CylinderGeometry(baseRadius + 3, baseRadius + 3, 0.6, octSides), platMat);
    topPlat.position.y = platformH + 1.5;
    topPlat.castShadow = true; topPlat.receiveShadow = true;
    g.add(topPlat);

    // 平台铜栏杆
    for (let i = 0; i < 32; i++) {
        const a = (i / 32) * Math.PI * 2;
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.0, 8), copperMat);
        post.position.set(Math.cos(a) * (baseRadius + 2.5), platformH + 2.8, Math.sin(a) * (baseRadius + 2.5));
        g.add(post);
        const topper = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 4), copperMat);
        topper.position.set(Math.cos(a) * (baseRadius + 2.5), platformH + 3.35, Math.sin(a) * (baseRadius + 2.5));
        g.add(topper);
    }

    // ===== 五层塔身 =====
    const totalFloors = 5;
    const floorHeights = [6.2, 5.6, 5.6, 5.6, 6.8]; // 每层高度
    const totalBodyH = floorHeights.reduce((a, b) => a + b, 0);
    let currentY = platformH + 2.0;

    for (let i = 0; i < totalFloors; i++) {
        const fh = floorHeights[i];
        const r = baseRadius - i * 1.5; // 逐层收分

        // 楼板
        const floorDisc = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.3, octSides), floorMat);
        floorDisc.position.y = currentY;
        floorDisc.receiveShadow = true;
        g.add(floorDisc);

        // 塔身墙体（八边形柱体，外包铜板）
        const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r + 0.15, fh - 0.6, octSides), copperMat);
        body.position.y = currentY + fh / 2;
        body.castShadow = true; body.receiveShadow = true;
        g.add(body);

        // 八边形棱柱（每边4柱）
        for (let j = 0; j < octSides; j++) {
            const a = (j / octSides) * Math.PI * 2 + Math.PI / octSides;
            const col = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, fh - 0.6, 8), copperDark);
            col.position.set(Math.cos(a) * (r - 0.5), currentY + fh / 2, Math.sin(a) * (r - 0.5));
            g.add(col);
        }

        // 平座（外挑回廊，每层外挑1.8米）
        const balconyR = r + 1.8;
        const balcony = new THREE.Mesh(new THREE.TorusGeometry(balconyR, 0.25, 8, octSides), copperMat);
        balcony.position.y = currentY + 0.3;
        balcony.rotation.x = Math.PI / 2;
        g.add(balcony);

        // 平座栏杆（每边约4根望柱）
        for (let j = 0; j < octSides * 4; j++) {
            const a = (j / (octSides * 4)) * Math.PI * 2;
            const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.8, 8), copperDark);
            rail.position.set(Math.cos(a) * (balconyR - 0.15), currentY + 1.0, Math.sin(a) * (balconyR - 0.15));
            g.add(rail);
        }
        // 栏板环
        const railRing = new THREE.Mesh(new THREE.TorusGeometry(balconyR - 0.15, 0.04, 8, octSides * 4), copperDark);
        railRing.position.y = currentY + 1.15;
        railRing.rotation.x = Math.PI / 2;
        g.add(railRing);

        // 斗拱层（简化：用短柱表达斗拱出挑）
        for (let j = 0; j < octSides * 3; j++) {
            const a = (j / (octSides * 3)) * Math.PI * 2;
            const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.1, 0.6), copperDark);
            bracket.position.set(
                Math.cos(a) * (r + 0.8), currentY + fh - 0.5,
                Math.sin(a) * (r + 0.8)
            );
            bracket.rotation.y = -a + Math.PI / 2;
            g.add(bracket);
        }

        // 屋檐（出挑2.2米）
        const eavesOuter = r + 2.2;
        const eaves = new THREE.Mesh(new THREE.CylinderGeometry(eavesOuter, r + 0.3, 0.5, octSides), roofMat);
        eaves.position.y = currentY + fh - 0.15;
        eaves.castShadow = true;
        g.add(eaves);

        // 风铃（每角一个）
        for (let j = 0; j < octSides; j++) {
            const a = (j / octSides) * Math.PI * 2 + Math.PI / octSides;
            const bellRod = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 6), copperDark);
            bellRod.position.set(Math.cos(a) * (eavesOuter - 0.3), currentY + fh - 0.6, Math.sin(a) * (eavesOuter - 0.3));
            g.add(bellRod);
            const bell = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), goldMat);
            bell.position.set(Math.cos(a) * (eavesOuter - 0.3), currentY + fh - 1.1, Math.sin(a) * (eavesOuter - 0.3));
            g.add(bell);
        }

        currentY += fh;
    }

    // ===== 塔刹（总高16.079米） =====
    const spireBaseY = currentY;
    // 覆钵（直径1.8米，高1.2米）— 用扁半球
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.5), goldMat);
    bowl.position.y = spireBaseY + 0.3;
    g.add(bowl);

    // 仰莲（三层莲瓣）
    for (let layer = 0; layer < 3; layer++) {
        const petalRing = new THREE.Mesh(new THREE.TorusGeometry(0.7 + layer * 0.15, 0.12, 6, 16), goldMat);
        petalRing.position.y = spireBaseY + 1.0 + layer * 0.2;
        petalRing.rotation.x = Math.PI / 2;
        g.add(petalRing);
    }

    // 七重相轮
    for (let i = 0; i < 7; i++) {
        const ringR = 0.6 - i * 0.07;
        const ring = new THREE.Mesh(new THREE.TorusGeometry(ringR, 0.08, 8, 16), goldMat);
        ring.position.y = spireBaseY + 2.0 + i * 0.35;
        ring.rotation.x = Math.PI / 2;
        g.add(ring);
    }

    // 刹杆
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 5, 8), goldMat);
    pole.position.y = spireBaseY + 4.5;
    g.add(pole);

    // 宝盖（伞状，直径1.5米）
    const canopy = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.5, 8, 1, true), goldMat);
    canopy.position.y = spireBaseY + 6.5;
    g.add(canopy);

    // 宝珠（直径0.8米）
    const jewel = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 16), goldMat);
    jewel.position.y = spireBaseY + 7.2;
    g.add(jewel);

    // 避雷针
    const lightning = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.8, 8), new THREE.MeshStandardMaterial({ color: 0xCCCCCC, roughness: 0.2, metalness: 0.9 }));
    lightning.position.y = spireBaseY + 7.8;
    g.add(lightning);

    g.position.set(pos.x, 0, pos.z);
    layers.buildings.add(g);
    buildingRefs.push({ mesh: g, data: LANDMARKS.leifeng });
}

// ==================== 曲院风荷（精细版） ====================
function createQuyuanFenghe() {
    const pos = LANDMARKS.quyuan;
    const g = new THREE.Group();
    g.name = '曲院风荷';

    // ===== 荷花池区 =====
    const pondMat = new THREE.MeshStandardMaterial({ color: 0x3A8A4A, transparent: true, opacity: 0.55, roughness: 0.12, metalness: 0.1 });
    const pond = new THREE.Mesh(new THREE.CircleGeometry(14, 32), pondMat);
    pond.rotation.x = -Math.PI / 2; pond.position.y = 0.15; pond.receiveShadow = true;
    g.add(pond);

    // 荷池湖石驳岸
    for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3 + Math.random() * 0.3, 1),
            new THREE.MeshStandardMaterial({ color: 0x7A8A7A, roughness: 0.8 }));
        rock.position.set(Math.cos(a) * 13.5, 0.25, Math.sin(a) * 13.5);
        rock.castShadow = true;
        g.add(rock);
    }

    // 荷叶（叶片圆形浮水，直径0.4-0.7米）
    for (let i = 0; i < 120; i++) {
        const a = Math.random() * Math.PI * 2, d = Math.random() * 13;
        const lx = Math.cos(a) * d, lz = Math.sin(a) * d;

        // 荷叶（扁圆盘）
        const leafSize = 0.2 + Math.random() * 0.35;
        const leaf = new THREE.Mesh(
            new THREE.CylinderGeometry(leafSize, leafSize, 0.02, 12),
            new THREE.MeshStandardMaterial({ color: 0x2D6A2D, roughness: 0.7 })
        );
        leaf.position.set(lx, 0.21, lz);
        g.add(leaf);

        // 荷叶茎
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.04, 0.5, 6),
            new THREE.MeshStandardMaterial({ color: 0x3A6A30, roughness: 0.8 }));
        stem.position.set(lx, 0.0, lz);
        g.add(stem);

        // 荷花（约35%的叶旁有花）
        if (Math.random() < 0.35) {
            const petalColor = Math.random() < 0.55 ? 0xFFB7C5 : 0xFFF0F5;
            for (let p = 0; p < 5; p++) {
                const pa = (p / 5) * Math.PI * 2;
                const petal = new THREE.Mesh(new THREE.SphereGeometry(0.08, 4, 4),
                    new THREE.MeshStandardMaterial({ color: petalColor, roughness: 0.5 }));
                petal.position.set(
                    lx + Math.cos(pa) * 0.12,
                    0.28 + p * 0.06,
                    lz + Math.sin(pa) * 0.12
                );
                g.add(petal);
            }
            // 花蕊
            const center = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8),
                new THREE.MeshStandardMaterial({ color: 0xFFD700, roughness: 0.3 }));
            center.position.set(lx, 0.5, lz);
            g.add(center);
        }
    }

    // 九曲石桥（长150米→缩放，穿行荷池）
    const zigzag = zigzagBridge(-5, -8, 16, 3.2, 'x');
    zigzag.position.set(0, 0, 0);
    g.add(zigzag);

    // 木栈道（长200米，防腐木）
    for (let i = 0; i < 20; i++) {
        const plank = new THREE.Mesh(
            new THREE.BoxGeometry(0.15, 0.05, 1.5),
            new THREE.MeshStandardMaterial({ color: 0x8B6914, roughness: 0.8 })
        );
        plank.position.set(7 + i * 0.4, 0.4, -13 + Math.sin(i * 0.3) * 3);
        g.add(plank);
    }

    // ===== 酒坊建筑群（仿宋） =====
    const jiufang = new THREE.Group();
    jiufang.name = '麯院酒坊';

    const wallMat = new THREE.MeshStandardMaterial({ color: 0xF5F0E8, roughness: 0.55 });
    const dRoof = new THREE.MeshStandardMaterial({ color: 0x3A3A3A, roughness: 0.65 });
    allMaterials.push(wallMat, dRoof);

    // 酒坊主体（五开间两进深）
    const mainHall = new THREE.Mesh(new THREE.BoxGeometry(8, 3.2, 5), wallMat);
    mainHall.position.y = 1.6; mainHall.castShadow = true; mainHall.receiveShadow = true;
    jiufang.add(mainHall);
    const mainRoof = new THREE.Mesh(new THREE.ConeGeometry(5.5, 1.8, 4), dRoof);
    mainRoof.position.y = 3.6; mainRoof.rotation.y = Math.PI / 4;
    mainRoof.castShadow = true;
    jiufang.add(mainRoof);

    // 匾额
    const plaque = new THREE.Mesh(new THREE.BoxGeometry(2, 0.4, 0.08), new THREE.MeshStandardMaterial({ color: 0x1A1A1A, roughness: 0.4 }));
    plaque.position.set(0, 3.2, 2.6);
    jiufang.add(plaque);

    // 两翼厢房
    for (let s = -1; s <= 1; s += 2) {
        const wing = new THREE.Mesh(new THREE.BoxGeometry(4, 2.4, 3), wallMat);
        wing.position.set(s * 5.5, 1.2, 0); wing.castShadow = true;
        jiufang.add(wing);
        const wingRoof = new THREE.Mesh(new THREE.ConeGeometry(2.8, 1.2, 4), dRoof);
        wingRoof.position.set(s * 5.5, 2.5, 0); wingRoof.rotation.y = Math.PI / 4;
        wingRoof.castShadow = true;
        jiufang.add(wingRoof);
    }

    // 白墙围院
    const cw = whiteWall(13, 1.6);
    cw.position.set(0, 0.8, -3.5);
    jiufang.add(cw);

    // 酿酒缸（陶制大缸）
    for (let i = 0; i < 3; i++) {
        const jar = new THREE.Mesh(
            new THREE.CylinderGeometry(0.5, 0.45, 1.0, 16),
            new THREE.MeshStandardMaterial({ color: 0x6B3A2A, roughness: 0.5, metalness: 0.3 })
        );
        jar.position.set(-2 + i * 2, 0.5, 1.5);
        jar.castShadow = true;
        jiufang.add(jar);
    }

    jiufang.position.set(7, 0, 8);
    g.add(jiufang);

    // ===== 御碑亭（四角方亭，覆黄琉璃瓦） =====
    const stelePav = new THREE.Group();
    stelePav.name = '御碑亭';
    const yellowMat = new THREE.MeshStandardMaterial({ color: 0xDAA520, roughness: 0.35, metalness: 0.5 });
    allMaterials.push(yellowMat);

    const spBase = new THREE.Mesh(new THREE.BoxGeometry(3, 0.4, 3), new THREE.MeshStandardMaterial({ color: 0x8B8B7A, roughness: 0.7 }));
    spBase.position.y = 0.2; spBase.castShadow = true; spBase.receiveShadow = true;
    stelePav.add(spBase);
    for (let sx = -1; sx <= 1; sx += 2) {
        for (let sz = -1; sz <= 1; sz += 2) {
            const col = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.5, 8), wallMat);
            col.position.set(sx * 1.0, 1.5, sz * 1.0); col.castShadow = true;
            stelePav.add(col);
        }
    }
    const spRoof = new THREE.Mesh(new THREE.ConeGeometry(2.2, 1.2, 4), yellowMat);
    spRoof.position.y = 3.0; spRoof.rotation.y = Math.PI / 4;
    spRoof.castShadow = true;
    stelePav.add(spRoof);

    // 碑（高2.4米，宽1.1米）
    const steleBody = new THREE.Mesh(new THREE.BoxGeometry(0.7, 2.0, 0.15), new THREE.MeshStandardMaterial({ color: 0x7A7E7A, roughness: 0.55 }));
    steleBody.position.y = 1.2;
    stelePav.add(steleBody);
    // 赑屃碑座
    const bixi = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.35, 0.5), new THREE.MeshStandardMaterial({ color: 0x6A6E6A, roughness: 0.6 }));
    bixi.position.y = 0.35;
    stelePav.add(bixi);

    stelePav.position.set(-5, 0, 16);
    g.add(stelePav);

    // ===== 迎薰阁（两层楼阁，临岳湖，南端） =====
    const yxg = new THREE.Group();
    yxg.name = '迎薰阁';

    const yxBody = new THREE.Mesh(new THREE.BoxGeometry(5, 3.5, 5), wallMat);
    yxBody.position.y = 1.75; yxBody.castShadow = true;
    yxg.add(yxBody);

    // 二层
    const yxBody2 = new THREE.Mesh(new THREE.BoxGeometry(4.5, 3, 4.5), wallMat);
    yxBody2.position.y = 5.2; yxBody2.castShadow = true;
    yxg.add(yxBody2);

    // 平座栏杆
    for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.6, 8), wallMat);
        post.position.set(Math.cos(a) * 2.6, 4.8, Math.sin(a) * 2.6);
        yxg.add(post);
    }

    // 十字脊顶
    const yxRoof = new THREE.Mesh(new THREE.ConeGeometry(3.5, 1.5, 4), dRoof);
    yxRoof.position.y = 7.0; yxRoof.rotation.y = Math.PI / 4;
    yxRoof.castShadow = true;
    yxg.add(yxRoof);

    // 风铎（四角）
    for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        const bell = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), new THREE.MeshStandardMaterial({ color: 0xDAA520, roughness: 0.3, metalness: 0.7 }));
        bell.position.set(Math.cos(a) * 3.3, 6.5, Math.sin(a) * 3.3);
        yxg.add(bell);
    }

    yxg.position.set(9, 0, -14);
    g.add(yxg);

    // ===== 竹素园（西侧竹径） =====
    for (let i = 0; i < 15; i++) {
        const bambooMat = new THREE.MeshStandardMaterial({ color: 0x3A7A30, roughness: 0.7 });
        const bamboo = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 5 + Math.random() * 3, 8), bambooMat);
        bamboo.position.set(-8 + Math.random() * 2, 2.5 + Math.random(), -14 + i * 1.2);
        bamboo.castShadow = true;
        g.add(bamboo);
        allMaterials.push(bambooMat);
    }

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
        marker.position.set(data.x, key === 'leifeng' ? 42 : 20, data.z);
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
    animateCamera(px, py, pz, d.x, key === 'leifeng' ? 20 : 5, d.z);
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
