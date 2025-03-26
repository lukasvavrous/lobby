import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';

const GaragePreview = ({ selectedSkin, username, players = [] }) => {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const myTankRef = useRef(null);
  const otherTanksRef = useRef({}); // { [playerId]: { object, textMesh } }
  
  // Offset nad tankem (v lokálních jednotkách modelu, tank má scale 0.01 => 250 = 2.5 m)
  const textOffset = new THREE.Vector3(0, 250, 0);

  // Pomocná funkce pro načtení FBX modelu tanku.
  const loadTankModel = (url) => {
    return new Promise((resolve, reject) => {
      const loader = new FBXLoader();
      loader.load(url, resolve, undefined, reject);
    });
  };

  // Vytvoří 3D text pro jméno.
  const createNameText = (name, font) => {
    const safeName = name || "Anonymous";
    const textGeo = new TextGeometry(safeName, {
      font,
      size: 75,   // V lokálních souřadnicích – po aplikaci scale 0.01 to bude 0.75 m.
      height: 15,
      curveSegments: 12,
      bevelEnabled: false
    });
    // Centrum geometrie
    textGeo.computeBoundingBox();
    textGeo.center();
    const textMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const textMesh = new THREE.Mesh(textGeo, textMat);
    // Inicializujeme pozici; bude aktualizována v animační smyčce.
    textMesh.position.set(0, 0, 0);
    // Pokud chcete, můžete zvýšit renderOrder, aby se text zobrazoval navrch.
    textMesh.renderOrder = 1;
    return textMesh;
  };

  // Vytvoří tank a k němu 3D text.
  const createTank = async (skin, name) => {
    const model = await loadTankModel('/assets/T90_1.fbx');
    const textureLoader = new THREE.TextureLoader();
    const tankTexture = textureLoader.load(`/assets/${skin}.png`);
    model.traverse(child => {
      if (child.isMesh) {
        child.material.map = tankTexture;
        child.castShadow = true;
      }
    });
    // Zmenšení modelu
    model.scale.set(0.01, 0.01, 0.01);
    model.position.set(0, 0.6, 0);

    // Načteme font a vytvoříme textMesh.
    const fontLoader = new FontLoader();
    return new Promise((resolve) => {
      fontLoader.load(
        process.env.PUBLIC_URL + '/assets/fonts/helvetiker_regular.typeface.json',
        (font) => {
          const textMesh = createNameText(name, font);
          // V tuto chvíli textMesh **nepřidáváme** jako child modelu – bude přidán samostatně.
          resolve({ object: model, textMesh });
        }
      );
    });
  };

  // Inicializace scény, kamery, rendereru, světel, podlahy, podstavce a vytvoření mého tanku.
  useEffect(() => {
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Scéna a kamera
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.set(0, 3, 6);
    cameraRef.current = camera;

    // OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.target.set(0, 0.6, 0);
    controls.update();
    controlsRef.current = controls;

    // Skybox
    const cubeLoader = new THREE.CubeTextureLoader();
    scene.background = cubeLoader.load([
      'assets/ala_world/posx.jpg',
      'assets/ala_world/negx.jpg',
      'assets/ala_world/posy.jpg',
      'assets/ala_world/negy.jpg',
      'assets/ala_world/posz.jpg',
      'assets/ala_world/negz.jpg',
    ]);

    // Světla
    scene.add(new THREE.AmbientLight(0x404040, 1));
    scene.add(new THREE.HemisphereLight(0xffffbb, 0x080820, 0.5));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(5, 10, 7.5);
    dirLight.castShadow = true;
    scene.add(dirLight);
    const spotLight = new THREE.SpotLight(0xffffff, 0.8);
    spotLight.position.set(-10, 15, 10);
    spotLight.angle = Math.PI / 6;
    spotLight.penumbra = 0.2;
    spotLight.castShadow = true;
    scene.add(spotLight);

    // Podlaha
    const textureLoader = new THREE.TextureLoader();
    const floorTex = textureLoader.load('assets/textures/grassyStoneTexture.jpg');
    floorTex.wrapS = THREE.RepeatWrapping;
    floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(15, 15);
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTex,
      side: THREE.DoubleSide,
      roughness: 0.8,
      metalness: 0.2,
    });
    const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(50, 50), floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = -0.5;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    // Podstavec
    const standTex = textureLoader.load('assets/textures/rustyMetalTexture.jpg');
    const standMat = new THREE.MeshStandardMaterial({
      map: standTex,
      side: THREE.DoubleSide,
      bumpMap: standTex,
      bumpScale: 0.05,
    });
    const standGeom = new THREE.CylinderGeometry(5, 5, 1, 256);
    const standMesh = new THREE.Mesh(standGeom, standMat);
    standMesh.position.y = -0.95;
    standMesh.receiveShadow = true;
    scene.add(standMesh);

    // Vytvoříme můj tank
    createTank(selectedSkin, username).then((tankData) => {
      myTankRef.current = tankData;
      // Umístíme můj tank do středu
      tankData.object.position.set(0, 0.6, 0);
      scene.add(tankData.object);
      // Přidáme text samostatně do scény
      scene.add(tankData.textMesh);
      controls.target.copy(tankData.object.position);
    });

    // Animace
    const clock = new THREE.Clock();
    let rafId;
    const animate = () => {
      const dt = clock.getDelta();

      // Rotace mého tanku
      if (myTankRef.current) {
        myTankRef.current.object.rotation.y += dt * Math.PI / 8;
      }

      // Rozmístění ostatních tanků
      positionOtherTanks();

      // Aktualizace pozice a orientace textu, aby směřoval ke kameře
      if (myTankRef.current && myTankRef.current.textMesh) {
        const worldPos = new THREE.Vector3();
        myTankRef.current.object.getWorldPosition(worldPos);
        myTankRef.current.textMesh.position.copy(worldPos).add(textOffset);
        myTankRef.current.textMesh.lookAt(camera.position);
      }
      Object.values(otherTanksRef.current).forEach(tankData => {
        const worldPos = new THREE.Vector3();
        tankData.object.getWorldPosition(worldPos);
        tankData.textMesh.position.copy(worldPos).add(textOffset);
        tankData.textMesh.lookAt(camera.position);
      });

      controls.update();
      renderer.render(scene, camera);
      rafId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(rafId);
      container.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, []);

  // Aktualizace textury mého tanku při změně skinu
  useEffect(() => {
    if (!myTankRef.current) return;
    const loader = new THREE.TextureLoader();
    const newTexture = loader.load(`/assets/${selectedSkin}.png`);
    myTankRef.current.object.traverse(child => {
      if (child.isMesh && child.material) {
        child.material.map = newTexture;
        child.material.needsUpdate = true;
      }
    });
  }, [selectedSkin]);

  // Vytváření / aktualizace tanků pro ostatní hráče podle players
  useEffect(() => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;
    const dict = otherTanksRef.current;
    // Odstranit tanky, které už nejsou v seznamu players
    const playerIds = players.map(p => p.id);
    Object.keys(dict).forEach(id => {
      if (!playerIds.includes(id)) {
        scene.remove(dict[id].object);
        scene.remove(dict[id].textMesh);
        delete dict[id];
      }
    });
    // Přidat nové tanky pro nové hráče
    players.forEach(async (p) => {
      if (!dict[p.id]) {
        const tankData = await createTank(p.skin, p.username);
        dict[p.id] = tankData;
        scene.add(tankData.object);
        scene.add(tankData.textMesh);
      }
    });
  }, [players]);

  // Rozmístění nepřátelských tanků v závislosti na jejich počtu
  const positionOtherTanks = () => {
    const dict = otherTanksRef.current;
    const enemyTanks = Object.values(dict);
    const n = enemyTanks.length;
    const center = new THREE.Vector3(0, 0.6, 0);
    if (n === 0) return;
    if (n === 1) {
      // Jeden nepřítel umístíme přímo před můj tank (směr záporné Z)
      const radius = 8;
      enemyTanks[0].object.position.set(0, 0.6, -radius);
      enemyTanks[0].object.lookAt(center);
      enemyTanks[0].object.rotation.y += Math.PI; // otočení o 180°
    } else {
      // Více nepřátel rozmístíme do kruhu s počátečním úhlem tak, aby jeden byl vpředu.
      const radius = 6 + n * 2;
      const startAngle = -Math.PI / 2;
      const angleStep = (2 * Math.PI) / n;
      for (let i = 0; i < n; i++) {
        const angle = startAngle + i * angleStep;
        const x = radius * Math.cos(angle);
        const z = radius * Math.sin(angle);
        enemyTanks[i].object.position.set(x, 0.6, z);
        enemyTanks[i].object.lookAt(center);
        enemyTanks[i].object.rotation.y += Math.PI;
      }
    }
  };

  return <div ref={containerRef} className="panel game-preview" />;
};

export default GaragePreview;
