// 杭州西湖数字孪生交互系统 - Three.js 主程序
// West Lake Digital Twin Interactive System

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let scene, camera, renderer, controls;
let westLake, pois = {};
let currentMode = 'orbit';
const POI_POSITIONS = {
    baidi: { x: -80, z: 20, name: '白堤', desc: '白堤全长1千米，唐代诗人白居易曾在此堤上修筑石涵洞。' },
    sudi: { x: 40, z: 60, name: '苏堤', desc: '苏堤全长2.6千米，是北宋诗人苏东坡任杭州知州时所建。' },
    duanqiao: { x: -40, z: -20, name: '断桥', desc: '断桥是西湖中最著名的一座桥，位于白堤北端。' },
    leifeng: { x: 120, z: 80, name: '雷峰塔', desc: '雷峰塔位于西湖南岸，是中国首座彩色铜雕宝塔。' },
    lingyin: { x: -100, z: 150, name: '灵隐寺', desc: '灵隐寺是杭州最著名的寺庙，创建于东晋咸和元年。' },
    huachi: { x: 60, z: 120, name: '花港观鱼', desc: '花港观鱼是西湖十景之一，以花、港、鱼为特色。' },
    nanping: { x: 100, z: 140, name: '南屏晚钟', desc: '南屏晚钟是西湖十景之一，指净慈寺傍晚的钟声。' }
};

// 初始化场景
function init() {
    // 创建场景
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.Fog(0x87CEEB, 200, 500);

    // 创建相机
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(150, 100, 200);

    // 创建渲染器
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.getElementById('canvas-container').appendChild(renderer.domElement);

    // 创建控制器
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2.1;
    controls.minDistance = 30;
    controls.maxDistance = 400;

    // 添加光照
    setupLights();

    // 创建地形和湖泊
    createTerrain();
    createWestLake();
    createIslands();
    createCauseways();
    createPois();
    createVegetation();

    // 事件监听
    setupEventListeners();

    // 启动动画
    animate();

    // 隐藏加载界面
    setTimeout(() => {
        document.getElementById('loading').style.display = 'none';
    }, 1500);
}

// 设置光照
function setupLights() {
    // 环境光
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    // 主光源（太阳）
    const sunLight = new THREE.DirectionalLight(0xffffff, 1.0);
    sunLight.position.set(100, 150, 100);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 500;
    sunLight.shadow.camera.left = -200;
    sunLight.shadow.camera.right = 200;
    sunLight.shadow.camera.top = 200;
    sunLight.shadow.camera.bottom = -200;
    scene.add(sunLight);

    // 补光
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-50, 50, -50);
    scene.add(fillLight);
}

// 创建地形
function createTerrain() {
    // 地面
    const groundGeometry = new THREE.PlaneGeometry(600, 600, 100, 100);
    const groundMaterial = new THREE.MeshStandardMaterial({
        color: 0x228B22,
        roughness: 0.8,
        metalness: 0.1
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.5;
    ground.receiveShadow = true;
    scene.add(ground);

    // 周围山体
    const mountainPositions = [
        { x: -200, z: -200, scale: 80 },
        { x: 200, z: -200, scale: 100 },
        { x: -220, z: 100, scale: 70 },
        { x: 220, z: 150, scale: 90 },
        { x: 0, z: -250, scale: 110 }
    ];

    mountainPositions.forEach(pos => {
        const mountainGeometry = new THREE.ConeGeometry(pos.scale, pos.scale * 1.2, 8);
        const mountainMaterial = new THREE.MeshStandardMaterial({
            color: 0x3d5c3d,
            roughness: 0.9
        });
        const mountain = new THREE.Mesh(mountainGeometry, mountainMaterial);
        mountain.position.set(pos.x, pos.scale * 0.3, pos.z);
        mountain.castShadow = true;
        scene.add(mountain);
    });
}

// 创建西湖湖面
function createWestLake() {
    const lakeShape = new THREE.Shape();
    lakeShape.moveTo(-150, -100);
    lakeShape.bezierCurveTo(-180, -50, -180, 50, -150, 100);
    lakeShape.bezierCurveTo(-100, 150, 100, 150, 150, 100);
    lakeShape.bezierCurveTo(180, 50, 180, -50, 150, -100);
    lakeShape.bezierCurveTo(100, -150, -100, -150, -150, -100);

    const lakeGeometry = new THREE.ShapeGeometry(lakeShape);
    const lakeMaterial = new THREE.MeshStandardMaterial({
        color: 0x1E90FF,
        transparent: true,
        opacity: 0.7,
        roughness: 0.1,
        metalness: 0.3
    });
    westLake = new THREE.Mesh(lakeGeometry, lakeMaterial);
    westLake.rotation.x = -Math.PI / 2;
    westLake.position.y = 0.1;
    scene.add(westLake);

    // 湖面波光效果（使用多个透明平面模拟）
    for (let i = 0; i < 5; i++) {
        const waveGeometry = new THREE.CircleGeometry(30 + i * 20, 32);
        const waveMaterial = new THREE.MeshBasicMaterial({
            color: 0x87CEEB,
            transparent: true,
            opacity: 0.1 - i * 0.015,
            wireframe: false
        });
        const wave = new THREE.Mesh(waveGeometry, waveMaterial);
        wave.rotation.x = -Math.PI / 2;
        wave.position.set(Math.random() * 40 - 20, 0.2 + i * 0.05, Math.random() * 40 - 20);
        scene.add(wave);
    }
}

// 创建小岛
function createIslands() {
    const islandData = [
        { x: 30, z: 30, scale: 15, name: '小瀛洲' },
        { x: -20, z: 60, scale: 10, name: '湖心亭' },
        { x: 0, z: 40, scale: 8, name: '阮公墩' }
    ];

    islandData.forEach(data => {
        // 岛本体
        const islandGeometry = new THREE.CylinderGeometry(data.scale * 0.8, data.scale, 4, 16);
        const islandMaterial = new THREE.MeshStandardMaterial({ color: 0x228B22 });
        const island = new THREE.Mesh(islandGeometry, islandMaterial);
        island.position.set(data.x, 1, data.z);
        island.castShadow = true;
        island.receiveShadow = true;
        scene.add(island);

        // 树木
        for (let i = 0; i < 5; i++) {
            createTree(data.x + (Math.random() - 0.5) * data.scale,
                       data.z + (Math.random() - 0.5) * data.scale);
        }
    });
}

// 创建堤坝（苏堤、白堤）
function createCauseways() {
    // 苏堤 - 从北到南贯穿湖面
    const suDiGeometry = new THREE.BoxGeometry(8, 1.5, 120);
    const causewayMaterial = new THREE.MeshStandardMaterial({ color: 0x8B7355 });
    const suDi = new THREE.Mesh(suDiGeometry, causewayMaterial);
    suDi.position.set(40, 0.3, 10);
    suDi.castShadow = true;
    scene.add(suDi);

    // 苏堤上的六座桥
    for (let i = 0; i < 6; i++) {
        const bridgeGeometry = new THREE.BoxGeometry(12, 2, 6);
        const bridgeMaterial = new THREE.MeshStandardMaterial({ color: 0xA0522D });
        const bridge = new THREE.Mesh(bridgeGeometry, bridgeMaterial);
        bridge.position.set(40, 1.5, -40 + i * 20);
        bridge.castShadow = true;
        scene.add(bridge);
    }

    // 白堤 - 从断桥到孤山路
    const baiDiGeometry = new THREE.BoxGeometry(6, 1.2, 60);
    const baiDi = new THREE.Mesh(baiDiGeometry, causewayMaterial);
    baiDi.position.set(-60, 0.3, 30);
    baiDi.rotation.y = Math.PI / 6;
    baiDi.castShadow = true;
    scene.add(baiDi);
}

// 创建景点建筑
function createPois() {
    Object.entries(POI_POSITIONS).forEach(([key, data]) => {
        const group = new THREE.Group();
        group.position.set(data.x, 0, data.z);
        group.userData = { name: data.name, desc: data.desc };

        switch (key) {
            case 'duanqiao':
                // 断桥 - 拱形结构
                const bridgeGeom = new THREE.TorusGeometry(8, 1.5, 8, 12, Math.PI);
                const bridgeMat = new THREE.MeshStandardMaterial({ color: 0x808080 });
                const bridge = new THREE.Mesh(bridgeGeom, bridgeMat);
                bridge.rotation.x = Math.PI / 2;
                bridge.position.y = 3;
                group.add(bridge);
                break;

            case 'leifeng':
                // 雷峰塔 - 五层宝塔
                for (let i = 0; i < 5; i++) {
                    const towerBase = new THREE.CylinderGeometry(8 - i * 1.2, 9 - i * 1.2, 4, 8);
                    const towerMat = new THREE.MeshStandardMaterial({ color: 0xCD853F });
                    const tower = new THREE.Mesh(towerBase, towerMat);
                    tower.position.y = i * 4 + 2;
                    tower.castShadow = true;
                    group.add(tower);
                }
                // 塔顶
                const roofGeom = new THREE.ConeGeometry(4, 5, 8);
                const roofMat = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
                const roof = new THREE.Mesh(roofGeom, roofMat);
                roof.position.y = 22;
                group.add(roof);
                break;

            case 'lingyin':
                // 灵隐寺 - 大殿
                const templeGeom = new THREE.BoxGeometry(25, 15, 20);
                const templeMat = new THREE.MeshStandardMaterial({ color: 0x8B0000 });
                const temple = new THREE.Mesh(templeGeom, templeMat);
                temple.position.y = 7.5;
                temple.castShadow = true;
                group.add(temple);
                // 屋顶
                const roofBaseGeom = new THREE.BoxGeometry(30, 2, 25);
                const roofBase = new THREE.Mesh(roofBaseGeom, templeMat);
                roofBase.position.y = 16;
                roofBase.castShadow = true;
                group.add(roofBase);
                break;

            default:
                // 通用亭子
                const pavilionBase = new THREE.CylinderGeometry(5, 6, 2, 8);
                const pavilionMat = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
                const pavilion = new THREE.Mesh(pavilionBase, pavilionMat);
                pavilion.position.y = 1;
                group.add(pavilion);

                // 亭顶
                const pavilionRoof = new THREE.ConeGeometry(8, 4, 8);
                const roofMaterial = new THREE.MeshStandardMaterial({ color: 0x228B22 });
                const pavilionTop = new THREE.Mesh(pavilionRoof, roofMaterial);
                pavilionTop.position.y = 4;
                group.add(pavilionTop);
        }

        // 添加标记点
        const markerGeom = new THREE.SphereGeometry(2, 16, 16);
        const markerMat = new THREE.MeshBasicMaterial({ color: 0xFF4500 });
        const marker = new THREE.Mesh(markerGeom, markerMat);
        marker.position.y = 20;
        group.add(marker);

        pois[key] = group;
        scene.add(group);
    });
}

// 创建树木
function createTree(x, z) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    // 树干
    const trunkGeom = new THREE.CylinderGeometry(0.3, 0.5, 4, 8);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
    const trunk = new THREE.Mesh(trunkGeom, trunkMat);
    trunk.position.y = 2;
    trunk.castShadow = true;
    group.add(trunk);

    // 树冠
    const crownGeom = new THREE.SphereGeometry(3, 8, 8);
    const crownMat = new THREE.MeshStandardMaterial({ color: 0x228B22 });
    const crown = new THREE.Mesh(crownGeom, crownMat);
    crown.position.y = 5;
    crown.castShadow = true;
    group.add(crown);

    scene.add(group);
}

// 创建植被（沿堤岸）
function createVegetation() {
    // 苏堤两岸
    for (let i = 0; i < 30; i++) {
        createTree(35 + (Math.random() - 0.5) * 4, -45 + i * 4);
        createTree(45 + (Math.random() - 0.5) * 4, -45 + i * 4);
    }

    // 白堤两岸
    for (let i = 0; i < 15; i++) {
        createTree(-65 + i * 3 + (Math.random() - 0.5) * 2, 25 + (Math.random() - 0.5) * 4);
        createTree(-55 + i * 3 + (Math.random() - 0.5) * 2, 35 + (Math.random() - 0.5) * 4);
    }

    // 湖边垂柳
    for (let i = 0; i < 50; i++) {
        const angle = (i / 50) * Math.PI * 2;
        const radius = 145;
        const wx = Math.cos(angle) * radius;
        const wz = Math.sin(angle) * radius * 0.7;
        if (Math.abs(wx) < 160 && Math.abs(wz) < 110) {
            createTree(wx, wz);
        }
    }
}

// 视角切换
function setViewMode(mode) {
    currentMode = mode;
    document.querySelectorAll('.control-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    switch (mode) {
        case 'orbit':
            controls.enabled = true;
            animateCamera(150, 100, 200, 0, 0, 0);
            break;
        case 'fly':
            animateCamera(0, 60, 0, 0, 0, 0);
            break;
        case 'top':
            animateCamera(0, 200, 0, 0, 0, 0);
            break;
    }
}

// 相机动画
function animateCamera(px, py, pz, tx, ty, tz) {
    const startPos = { x: camera.position.x, y: camera.position.y, z: camera.position.z };
    const targetPos = { x: px, y: py, z: pz };
    const duration = 1000;
    const startTime = Date.now();

    function update() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);

        camera.position.x = startPos.x + (targetPos.x - startPos.x) * eased;
        camera.position.y = startPos.y + (targetPos.y - startPos.y) * eased;
        camera.position.z = startPos.z + (targetPos.z - startPos.z) * eased;

        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }
    update();
}

// 跳转到景点
function flyToPoi(poiKey) {
    const poi = POI_POSITIONS[poiKey];
    if (!poi) return;

    const targetGroup = pois[poiKey];
    if (!targetGroup) return;

    // 更新信息面板
    document.getElementById('info-panel').querySelector('h1').textContent = poi.name;

    // 相机飞向景点
    const duration = 1500;
    const startPos = { x: camera.position.x, y: camera.position.y, z: camera.position.z };
    const targetPos = { x: poi.x + 30, y: 40, z: poi.z + 30 };
    const startTime = Date.now();

    function update() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);

        camera.position.x = startPos.x + (targetPos.x - startPos.x) * eased;
        camera.position.y = startPos.y + (targetPos.y - startPos.y) * eased;
        camera.position.z = startPos.z + (targetPos.z - startPos.z) * eased;

        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }
    update();

    // 景点闪烁提示
    if (targetGroup && targetGroup.children[0]) {
        const originalColor = targetGroup.children[0].material?.color;
        let blinkCount = 0;
        const blinkInterval = setInterval(() => {
            targetGroup.children.forEach(child => {
                if (child.material) {
                    child.material.emissive = child.material.emissive || new THREE.Color(0x000000);
                    child.material.emissive.setHex(child.material.emissive.getHex() === 0xFFFF00 ? 0x000000 : 0xFFFF00);
                }
            });
            blinkCount++;
            if (blinkCount >= 6) {
                clearInterval(blinkInterval);
                targetGroup.children.forEach(child => {
                    if (child.material && child.material.emissive) {
                        child.material.emissive.setHex(0x000000);
                    }
                });
            }
        }, 200);
    }
}

// 事件监听
function setupEventListeners() {
    // 窗口调整
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // 视角切换按钮
    document.querySelectorAll('.control-btn[data-mode]').forEach(btn => {
        btn.addEventListener('click', () => setViewMode(btn.dataset.mode));
    });

    // 重置按钮
    document.getElementById('reset-btn').addEventListener('click', () => {
        setViewMode('orbit');
        document.getElementById('info-panel').querySelector('h1').textContent = '杭州西湖';
    });

    // 景点点击
    document.querySelectorAll('.poi-item').forEach(item => {
        item.addEventListener('click', () => flyToPoi(item.dataset.poi));
    });

    // 模拟数据更新
    setInterval(updateDigitalTwinData, 3000);
}

// 数字孪生数据更新
function updateDigitalTwinData() {
    const visitors = 12000 + Math.floor(Math.random() * 2000);
    const temp = 22 + Math.floor(Math.random() * 5);
    const weathers = ['晴', '多云', '阴'];
    const aqis = ['优', '良', '中'];
    const aqiValues = ['优', '良', '中'];

    document.getElementById('visitor-count').textContent = visitors.toLocaleString();
    document.getElementById('temperature').textContent = temp + '°C';
    document.getElementById('weather').textContent = weathers[Math.floor(Math.random() * weathers.length)];
    document.getElementById('aqi').textContent = aqiValues[Math.floor(Math.random() * aqiValues.length)];
}

// 动画循环
function animate() {
    requestAnimationFrame(animate);

    // 湖面波动效果
    if (westLake) {
        westLake.material.opacity = 0.65 + Math.sin(Date.now() * 0.001) * 0.05;
    }

    controls.update();
    renderer.render(scene, camera);
}

// 启动
init();
