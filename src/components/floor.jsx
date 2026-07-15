import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';

const Floor = () => {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const animationFrameRef = useRef(null);
  const clockRef = useRef(new THREE.Clock());
  const [selectedSection, setSelectedSection] = useState(null);
  const [isPlaying, setIsPlaying] = useState(true);
  
  // Store all animated objects with direct references
  const waterfallStacksRef = useRef([]);
  const waterfallsRef = useRef([]);
  const pillarsRef = useRef([]);
  const fourArmsRef = useRef([]);
  const leggingsRef = useRef([]);
  const floorBorderRef = useRef(null);

  const createWalls = (scene) => {
    const wallMaterial = new THREE.MeshLambertMaterial({ color: 0x4a4a4a });
    const wallHeight = 8;
    const wallThickness = 0.5;

    // Back wall
    const backWallGeometry = new THREE.BoxGeometry(50, wallHeight, wallThickness);
    const backWall = new THREE.Mesh(backWallGeometry, wallMaterial);
    backWall.position.set(0, wallHeight/2, -20);
    backWall.receiveShadow = true;
    scene.add(backWall);

    // Left wall
    const leftWallGeometry = new THREE.BoxGeometry(wallThickness, wallHeight, 40);
    const leftWall = new THREE.Mesh(leftWallGeometry, wallMaterial);
    leftWall.position.set(-25, wallHeight/2, 0);
    leftWall.receiveShadow = true;
    scene.add(leftWall);

    // Right wall
    const rightWall = new THREE.Mesh(leftWallGeometry, wallMaterial);
    rightWall.position.set(25, wallHeight/2, 0);
    rightWall.receiveShadow = true;
    scene.add(rightWall);

    // Front wall
    const frontWallGeometry = new THREE.BoxGeometry(50, wallHeight, wallThickness);
    const frontWall = new THREE.Mesh(frontWallGeometry, wallMaterial);
    frontWall.position.set(0, wallHeight/2, 20);
    frontWall.receiveShadow = true;
    scene.add(frontWall);

    // Create opening in left wall for entrance
    const leftWallWithOpening1 = new THREE.BoxGeometry(wallThickness, wallHeight, 12);
    const leftWall1 = new THREE.Mesh(leftWallWithOpening1, wallMaterial);
    leftWall1.position.set(-25, wallHeight/2, -6);
    leftWall1.receiveShadow = true;
    scene.add(leftWall1);

    const leftWallWithOpening2 = new THREE.BoxGeometry(wallThickness, wallHeight, 20);
    const leftWall2 = new THREE.Mesh(leftWallWithOpening2, wallMaterial);
    leftWall2.position.set(-25, wallHeight/2, 10);
    leftWall2.receiveShadow = true;
    scene.add(leftWall2);

    // Red entrance door
    const doorGeometry = new THREE.BoxGeometry(wallThickness, 6, 8);
    const doorMaterial = new THREE.MeshLambertMaterial({ color: 0xff3333 });
    const door = new THREE.Mesh(doorGeometry, doorMaterial);
    door.position.set(-25, 3, 2);
    scene.add(door);

    addSectionLabel(scene, "ENTRANCE", [-20, 6.5, 2], 0xff3333);
  };

  const createFloorGrid = (scene) => {
    const gridHelper = new THREE.GridHelper(50, 10, 0x666666, 0x999999);
    gridHelper.position.y = 0.05;
    scene.add(gridHelper);

    const fineGrid = new THREE.GridHelper(50, 50, 0x888888, 0xbbbbbb);
    fineGrid.position.y = 0.04;
    scene.add(fineGrid);
  };

  const createClothingDisplays = (scene) => {
    // Clear previous references
    waterfallStacksRef.current = [];
    waterfallsRef.current = [];
    pillarsRef.current = [];
    fourArmsRef.current = [];
    leggingsRef.current = [];

    // 2 STACK WATERFALL DISPLAYS
    for (let i = 0; i < 4; i++) {
      const x = -18 + i * 12;
      const z = -15;
      
      const baseGeometry = new THREE.BoxGeometry(1.5, 0.3, 1.5);
      const baseMaterial = new THREE.MeshPhongMaterial({ color: 0x666666 });
      const base = new THREE.Mesh(baseGeometry, baseMaterial);
      base.position.set(x, 0.15, z);
      base.castShadow = true;
      scene.add(base);

      const waterfallGroup = new THREE.Group();
      
      // Upper tier
      for (let j = 0; j < 5; j++) {
        const clothGeometry = new THREE.PlaneGeometry(1.2, 2);
        const clothMaterial = new THREE.MeshPhongMaterial({ 
          color: new THREE.Color().setHSL(0.6 + j * 0.1, 0.8, 0.7),
          transparent: true,
          opacity: 0.9,
          side: THREE.DoubleSide
        });
        const cloth = new THREE.Mesh(clothGeometry, clothMaterial);
        cloth.position.set(0, 3 + j * 0.1, -0.3 + j * 0.1);
        cloth.rotation.x = -0.2;
        cloth.castShadow = true;
        cloth.userData = { originalRotationX: -0.2, originalPositionZ: -0.3 + j * 0.1 };
        waterfallGroup.add(cloth);
      }

      // Lower tier
      for (let j = 0; j < 5; j++) {
        const clothGeometry = new THREE.PlaneGeometry(1.2, 2);
        const clothMaterial = new THREE.MeshPhongMaterial({ 
          color: new THREE.Color().setHSL(0.8 + j * 0.1, 0.8, 0.6),
          transparent: true,
          opacity: 0.9,
          side: THREE.DoubleSide
        });
        const cloth = new THREE.Mesh(clothGeometry, clothMaterial);
        cloth.position.set(0, 1.5 + j * 0.1, -0.3 + j * 0.1);
        cloth.rotation.x = -0.2;
        cloth.castShadow = true;
        cloth.userData = { originalRotationX: -0.2, originalPositionZ: -0.3 + j * 0.1 };
        waterfallGroup.add(cloth);
      }

      waterfallGroup.position.set(x, 0, z);
      scene.add(waterfallGroup);
      waterfallStacksRef.current.push(waterfallGroup);
    }
    addSectionLabel(scene, "2 STACK WATERFALL", [0, 6, -10], 0x00aaff);

    // SINGLE WATERFALL DISPLAYS
    for (let i = 0; i < 3; i++) {
      const x = -22;
      const z = -8 + i * 8;
      
      const waterfallGroup = new THREE.Group();
      
      for (let j = 0; j < 8; j++) {
        const clothGeometry = new THREE.PlaneGeometry(1, 1.8);
        const clothMaterial = new THREE.MeshPhongMaterial({ 
          color: new THREE.Color().setHSL(0.3 + j * 0.08, 0.9, 0.6),
          transparent: true,
          opacity: 0.8,
          side: THREE.DoubleSide
        });
        const cloth = new THREE.Mesh(clothGeometry, clothMaterial);
        cloth.position.set(0, 1 + j * 0.15, j * 0.08);
        cloth.rotation.x = -0.1;
        cloth.castShadow = true;
        cloth.userData = { originalRotationX: -0.1, originalPositionZ: j * 0.08 };
        waterfallGroup.add(cloth);
      }

      waterfallGroup.position.set(x, 0, z);
      scene.add(waterfallGroup);
      waterfallsRef.current.push(waterfallGroup);
    }
    addSectionLabel(scene, "WATERFALL DISPLAY", [-18, 4, 0], 0x00ff88);

    // PILLAR DISPLAYS - Rectangular with 2 hangers per side
    const pillarPositions = [[-10, -5], [10, 5]];
    
    pillarPositions.forEach((pos, index) => {
      const [x, z] = pos;
      
      // Rectangular pillar
      const pillarWidth = index === 1 ? 3.0 : 2.0;
      const pillarDepth = index === 1 ? 3.0 : 2.0;
      const pillarGeometry = new THREE.BoxGeometry(pillarWidth, 8, pillarDepth);
      const pillarMaterial = new THREE.MeshPhongMaterial({ color: 0x8a8a8a });
      const pillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
      pillar.position.set(x, 4, z);
      pillar.castShadow = true;
      scene.add(pillar);

      const clothingGroup = new THREE.Group();
      const hangerDistance = pillarWidth / 2 + 0.8;
      
      const sides = [
        { offset: [hangerDistance, 0, 0], rotation: 0 },
        { offset: [-hangerDistance, 0, 0], rotation: Math.PI },
        { offset: [0, 0, hangerDistance], rotation: Math.PI/2 },
        { offset: [0, 0, -hangerDistance], rotation: -Math.PI/2 }
      ];
      
      sides.forEach((side, sideIndex) => {
        for (let hangerNum = 0; hangerNum < 2; hangerNum++) {
          const hangerOffset = hangerNum === 0 ? -0.8 : 0.8;
          
          const railGeometry = new THREE.CylinderGeometry(0.05, 0.05, 1.6);
          const railMaterial = new THREE.MeshPhongMaterial({ color: 0x444444 });
          const rail = new THREE.Mesh(railGeometry, railMaterial);
          
          if (sideIndex < 2) {
            rail.position.set(side.offset[0], 3, side.offset[2] + hangerOffset);
            rail.rotation.z = Math.PI / 2;
          } else {
            rail.position.set(side.offset[0] + hangerOffset, 3, side.offset[2]);
            rail.rotation.x = Math.PI / 2;
          }
          clothingGroup.add(rail);
          
          const numClothesPerHanger = 4;
          for (let i = 0; i < numClothesPerHanger; i++) {
            const clothGeometry = new THREE.BoxGeometry(0.4, 1.2, 0.08);
            const clothMaterial = new THREE.MeshPhongMaterial({ 
              color: new THREE.Color().setHSL(
                (sideIndex * 0.2 + hangerNum * 0.1 + i * 0.05) % 1, 
                0.8, 
                0.6
              ) 
            });
            const cloth = new THREE.Mesh(clothGeometry, clothMaterial);
            
            const clothOffset = -0.6 + (i / (numClothesPerHanger - 1)) * 1.2;
            if (sideIndex < 2) {
              cloth.position.set(
                side.offset[0], 
                2.4, 
                side.offset[2] + hangerOffset + clothOffset
              );
              cloth.rotation.y = side.rotation;
            } else {
              cloth.position.set(
                side.offset[0] + hangerOffset + clothOffset, 
                2.4, 
                side.offset[2]
              );
              cloth.rotation.y = side.rotation;
            }
            
            cloth.castShadow = true;
            cloth.userData = { originalPositionY: 2.4, originalRotationZ: 0 };
            clothingGroup.add(cloth);
          }
        }
      });
      
      clothingGroup.position.set(x, 0, z);
      scene.add(clothingGroup);
      pillarsRef.current.push(clothingGroup);
    });
    addSectionLabel(scene, "PILLAR DISPLAYS", [0, 6, 0], 0xffaa00);

    // 4-ARM DISPLAYS
    for (let i = 0; i < 2; i++) {
      const x = -6 + i * 12;
      const z = 0;
      
      const poleGeometry = new THREE.CylinderGeometry(0.1, 0.1, 6);
      const poleMaterial = new THREE.MeshPhongMaterial({ color: 0x555555 });
      const pole = new THREE.Mesh(poleGeometry, poleMaterial);
      pole.position.set(x, 3, z);
      pole.castShadow = true;
      scene.add(pole);

      const armGroup = new THREE.Group();
      for (let j = 0; j < 4; j++) {
        const angle = (j / 4) * Math.PI * 2;
        
        const armGeometry = new THREE.CylinderGeometry(0.05, 0.05, 3);
        const arm = new THREE.Mesh(armGeometry, poleMaterial);
        arm.position.set(
          Math.cos(angle) * 1.5,
          0,
          Math.sin(angle) * 1.5
        );
        arm.rotation.z = Math.PI / 2;
        arm.rotation.y = angle;
        armGroup.add(arm);

        for (let k = 0; k < 6; k++) {
          const clothGeometry = new THREE.BoxGeometry(0.5, 1.2, 0.08);
          const clothMaterial = new THREE.MeshPhongMaterial({ 
            color: new THREE.Color().setHSL(0.7 + k * 0.05, 0.9, 0.6) 
          });
          const cloth = new THREE.Mesh(clothGeometry, clothMaterial);
          cloth.position.set(
            Math.cos(angle) * (2 + k * 0.15),
            0,
            Math.sin(angle) * (2 + k * 0.15)
          );
          cloth.rotation.y = angle + Math.PI/2;
          cloth.castShadow = true;
          armGroup.add(cloth);
        }
      }
      armGroup.position.set(x, 3, z);
      armGroup.userData = { originalRotationY: 0 };
      scene.add(armGroup);
      fourArmsRef.current.push(armGroup);
    }
    addSectionLabel(scene, "4 ARM DISPLAYS", [0, 6, 5], 0xff6600);

    // LEGGINGS SECTION
    for (let i = 0; i < 2; i++) {
      const x = 15 + (i % 2) * 6;
      const z = -8 + Math.floor(i / 2) * 8;
      
      const rackGeometry = new THREE.BoxGeometry(3, 0.2, 1);
      const rackMaterial = new THREE.MeshPhongMaterial({ color: 0x666666 });
      const rack = new THREE.Mesh(rackGeometry, rackMaterial);
      rack.position.set(x, 2, z);
      scene.add(rack);

      const leggingsGroup = new THREE.Group();
      for (let j = 0; j < 6; j++) {
        const leggingGeometry = new THREE.CylinderGeometry(0.3, 0.15, 2.5);
        const leggingMaterial = new THREE.MeshPhongMaterial({ 
          color: new THREE.Color().setHSL(0.9, 0.7, 0.3 + j * 0.1) 
        });
        const legging = new THREE.Mesh(leggingGeometry, leggingMaterial);
        legging.position.set(-1.25 + j * 0.5, -1.25, 0);
        legging.castShadow = true;
        legging.userData = { originalRotationZ: 0 };
        leggingsGroup.add(legging);
      }
      leggingsGroup.position.set(x, 2, z);
      scene.add(leggingsGroup);
      leggingsRef.current.push(leggingsGroup);
    }
    addSectionLabel(scene, "LEGGINGS", [18, 4, -5], 0xff0088);

    addSectionLabel(scene, "PALAZZO SECTION", [15, 4, 12], 0x8800ff);
    addSectionLabel(scene, "KURTI SECTION", [-15, 4, 12], 0x00ff44);

    console.log("Animation objects created:");
    console.log("Waterfall stacks:", waterfallStacksRef.current.length);
    console.log("Waterfalls:", waterfallsRef.current.length);
    console.log("Pillars:", pillarsRef.current.length);
    console.log("Four arms:", fourArmsRef.current.length);
    console.log("Leggings:", leggingsRef.current.length);
  };

  const addSectionLabel = (scene, text, position, color) => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const context = canvas.getContext('2d');
    
    context.fillStyle = '#' + color.toString(16).padStart(6, '0');
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    context.fillStyle = 'white';
    context.font = 'bold 28px Arial';
    context.textAlign = 'center';
    context.fillText(text, canvas.width / 2, canvas.height / 2 + 10);
    
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.MeshBasicMaterial({ 
      map: texture,
      transparent: true
    });
    const geometry = new THREE.PlaneGeometry(8, 2);
    const label = new THREE.Mesh(geometry, material);
    label.position.set(...position);
    
    scene.add(label);
  };

  // Animation function - defined outside useEffect
  const updateAnimations = (elapsedTime) => {
    if (!isPlaying) return;

    // Animate floor border
    if (floorBorderRef.current) {
      floorBorderRef.current.rotation.z = elapsedTime * 0.3;
    }

    // Animate waterfall stacks
    waterfallStacksRef.current.forEach((stack, i) => {
      stack.children.forEach((cloth, j) => {
        if (cloth.userData.originalRotationX !== undefined) {
          cloth.rotation.x = cloth.userData.originalRotationX + Math.sin(elapsedTime * 2 + i + j * 0.5) * 0.1;
          cloth.position.z = cloth.userData.originalPositionZ + Math.sin(elapsedTime * 1.5 + i + j) * 0.05;
        }
      });
    });

    // Animate single waterfalls
    waterfallsRef.current.forEach((waterfall, i) => {
      waterfall.children.forEach((cloth, j) => {
        if (cloth.userData.originalRotationX !== undefined) {
          cloth.rotation.x = cloth.userData.originalRotationX + Math.sin(elapsedTime * 2.5 + i + j * 0.3) * 0.08;
          cloth.position.z = cloth.userData.originalPositionZ + Math.sin(elapsedTime * 2 + i + j) * 0.03;
        }
      });
    });

    // Animate pillar clothes
    pillarsRef.current.forEach((pillar, i) => {
      pillar.children.forEach((item, j) => {
        if (item.userData.originalPositionY !== undefined) {
          item.rotation.z = Math.sin(elapsedTime * 2 + i + j * 0.3) * 0.05;
          item.position.y = item.userData.originalPositionY + Math.sin(elapsedTime * 1.5 + i + j) * 0.02;
        }
      });
    });

    // Animate 4-arm displays
    fourArmsRef.current.forEach((arm, i) => {
      arm.rotation.y = elapsedTime * 0.8 + i * Math.PI / 2;
    });

    // Animate leggings
    leggingsRef.current.forEach((legging, i) => {
      legging.children.forEach((item, j) => {
        if (item.userData.originalRotationZ !== undefined) {
          item.rotation.z = Math.sin(elapsedTime * 3 + i + j) * 0.1;
        }
      });
    });
  };

  useEffect(() => {
    if (!mountRef.current) return;
    if (sceneRef.current) {
      console.log("Scene already exists, skipping initialization");
      return;
    }
    if (mountRef.current.children.length > 0) {
      console.log("Canvas already exists, skipping initialization");
      return;
    }

    console.log("Initializing 3D scene - SINGLE INSTANCE");

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    scene.fog = new THREE.Fog(0x1a1a2e, 20, 80);
    sceneRef.current = scene;

    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      75,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 20, 30);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Renderer setup
    if (mountRef.current.querySelector('canvas')) {
      console.log("Canvas already exists, aborting");
      return;
    }
    
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x1a1a2e);
    rendererRef.current = renderer;
    mountRef.current.appendChild(renderer.domElement);
    
    console.log("Canvas created and appended");

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    const pointLight1 = new THREE.PointLight(0xffffff, 0.6, 50);
    pointLight1.position.set(-15, 15, -15);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0xffffff, 0.6, 50);
    pointLight2.position.set(15, 15, 15);
    scene.add(pointLight2);

    // Mall Floor
    const floorGeometry = new THREE.PlaneGeometry(50, 40);
    const floorMaterial = new THREE.MeshLambertMaterial({ 
      color: 0xffffff,
      transparent: false,
      opacity: 1.0
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.02;
    floor.receiveShadow = true;
    scene.add(floor);

    // Floor border - animated
    const borderGeometry = new THREE.RingGeometry(24, 25, 32);
    const borderMaterial = new THREE.MeshBasicMaterial({ 
      color: 0x00ff00, // Make it green so it's super obvious
      side: THREE.DoubleSide
    });
    const border = new THREE.Mesh(borderGeometry, borderMaterial);
    border.rotation.x = -Math.PI / 2;
    border.position.y = 0.03;
    scene.add(border);
    floorBorderRef.current = border;

    // Create components
    createFloorGrid(scene);
    createWalls(scene);
    createClothingDisplays(scene);

    // Mouse controls
    let mouseDown = false;
    let mouseX = 0;
    let mouseY = 0;

    const onMouseDown = (event) => {
      mouseDown = true;
      mouseX = event.clientX;
      mouseY = event.clientY;
    };

    const onMouseMove = (event) => {
      if (!mouseDown) return;
      
      const deltaX = event.clientX - mouseX;
      const deltaY = event.clientY - mouseY;
      
      const spherical = new THREE.Spherical();
      spherical.setFromVector3(camera.position);
      spherical.theta -= deltaX * 0.01;
      spherical.phi += deltaY * 0.01;
      spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));
      
      camera.position.setFromSpherical(spherical);
      camera.lookAt(0, 0, 0);
      
      mouseX = event.clientX;
      mouseY = event.clientY;
    };

    const onMouseUp = () => {
      mouseDown = false;
    };

    const onWheel = (event) => {
      const scale = event.deltaY > 0 ? 1.1 : 0.9;
      camera.position.multiplyScalar(scale);
      camera.position.y = Math.max(8, Math.min(50, camera.position.y));
    };

    renderer.domElement.addEventListener('mousedown', onMouseDown);
    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('mouseup', onMouseUp);
    renderer.domElement.addEventListener('wheel', onWheel);

    // Animation loop
    const animate = () => {
      if (!sceneRef.current || !rendererRef.current || !cameraRef.current) return;
      
      animationFrameRef.current = requestAnimationFrame(animate);
      
      const elapsedTime = clockRef.current.getElapsedTime();
      updateAnimations(elapsedTime);
      
      renderer.render(scene, camera);
    };

    animate();

    // Cleanup
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      
      if (renderer?.domElement) {
        renderer.domElement.removeEventListener('mousedown', onMouseDown);
        renderer.domElement.removeEventListener('mousemove', onMouseMove);
        renderer.domElement.removeEventListener('mouseup', onMouseUp);
        renderer.domElement.removeEventListener('wheel', onWheel);
      }
      
      if (mountRef.current && renderer?.domElement && mountRef.current.contains(renderer.domElement)) {
        mountRef.current.removeChild(renderer.domElement);
      }
      
      if (renderer) {
        renderer.dispose();
        rendererRef.current = null;
      }
      
      sceneRef.current = null;
      cameraRef.current = null;
      waterfallStacksRef.current = [];
      waterfallsRef.current = [];
      pillarsRef.current = [];
      fourArmsRef.current = [];
      leggingsRef.current = [];
      floorBorderRef.current = null;
    };
  }, []);

  const focusSection = (section) => {
    setSelectedSection(selectedSection === section ? null : section);
    
    if (cameraRef.current) {
      const positions = {
        waterfallStacks: { pos: [0, 15, -5], lookAt: [0, 0, -15] },
        waterfalls: { pos: [-15, 12, 5], lookAt: [-22, 0, 0] },
        pillars: { pos: [0, 18, 15], lookAt: [0, 0, 0] },
        fourArms: { pos: [0, 12, 12], lookAt: [0, 0, 0] },
        leggings: { pos: [20, 12, 2], lookAt: [18, 0, -5] },
        palazzo: { pos: [15, 12, 20], lookAt: [15, 0, 12] },
        kurti: { pos: [-15, 12, 20], lookAt: [-15, 0, 12] }
      };
      
      if (positions[section]) {
        const { pos, lookAt } = positions[section];
        cameraRef.current.position.set(...pos);
        cameraRef.current.lookAt(...lookAt);
      }
    }
  };

  return (
    <div className="relative w-full h-screen bg-gray-900">
      <div ref={mountRef} className="w-full h-full" />
      
      {/* Control Panel */}
      <div className="absolute top-4 left-4 bg-black bg-opacity-80 p-4 rounded-lg text-white max-w-xs">
        <h2 className="text-xl font-bold mb-3">🏬 Mall 2nd Floor</h2>
        
        <div className="mb-4">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`w-full px-4 py-2 rounded font-semibold mb-2 ${
              isPlaying 
                ? 'bg-red-600 hover:bg-red-700' 
                : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {isPlaying ? '⏸️ Pause' : '▶️ Play'} Animations
          </button>
          
          <button
            onClick={() => {
              console.log('=== ANIMATION DEBUG ===');
              console.log('isPlaying:', isPlaying);
              console.log('Waterfall stacks:', waterfallStacksRef.current.length);
              console.log('Waterfalls:', waterfallsRef.current.length);
              console.log('Pillars:', pillarsRef.current.length);
              console.log('Four arms:', fourArmsRef.current.length);
              console.log('Leggings:', leggingsRef.current.length);
              console.log('Floor border:', floorBorderRef.current ? 'EXISTS' : 'MISSING');
              console.log('Scene:', sceneRef.current ? 'EXISTS' : 'MISSING');
              console.log('=== END DEBUG ===');
            }}
            className="w-full px-3 py-1 rounded text-sm bg-orange-600 hover:bg-orange-500"
          >
            🔧 Debug Animations
          </button>
        </div>

        <div className="mb-4">
          <h3 className="font-semibold mb-2">📍 Focus on Section:</h3>
          {[
            { key: 'waterfallStacks', label: '🌊 Waterfall Stacks' },
            { key: 'waterfalls', label: '💧 Waterfalls' },
            { key: 'pillars', label: '🏛️ Pillars' },
            { key: 'fourArms', label: '🔄 4-Arms' },
            { key: 'leggings', label: '👖 Leggings' }
          ].map(section => (
            <button
              key={section.key}
              onClick={() => focusSection(section.key)}
              className={`block w-full text-left px-3 py-2 mb-1 rounded text-sm ${
                selectedSection === section.key 
                  ? 'bg-blue-600 shadow-lg'
                  : 'bg-gray-600 hover:bg-gray-500'
              }`}
            >
              {section.label}
            </button>
          ))}
          
          <button
            onClick={() => {
              setSelectedSection(null);
              if (cameraRef.current) {
                cameraRef.current.position.set(0, 20, 30);
                cameraRef.current.lookAt(0, 0, 0);
              }
            }}
            className="block w-full text-left px-3 py-2 mt-2 rounded text-sm bg-purple-600 hover:bg-purple-500"
          >
            🏠 Reset Overview
          </button>
        </div>

        <div className="text-xs text-gray-300">
          <p>🖱️ Drag: Rotate camera</p>
          <p>🖱️ Scroll: Zoom in/out</p>
          <p>📍 Click sections to focus</p>
        </div>
      </div>

      {/* Status Info */}
      <div className="absolute top-4 right-4 bg-black bg-opacity-80 p-4 rounded-lg text-white">
        <h3 className="font-bold text-lg mb-2">Status</h3>
        <p className={`text-sm ${isPlaying ? 'text-green-300' : 'text-red-300'}`}>
          Animations: {isPlaying ? 'Playing ✓' : 'Paused ⏸️'}
        </p>
        <p className="text-sm text-blue-300">
          Scene: {sceneRef.current ? 'Single Instance Loaded ✓' : 'Loading...'}
        </p>
        <p className="text-xs text-gray-400">
          Objects: {waterfallStacksRef.current.length + waterfallsRef.current.length + pillarsRef.current.length + fourArmsRef.current.length + leggingsRef.current.length} animated groups
        </p>
        {selectedSection && (
          <p className="text-sm text-yellow-300">
            Focused: {selectedSection} 🎯
          </p>
        )}
        <p className="text-xs text-gray-400 mt-2">
          Floor: 50×40ft White with grid
        </p>
      </div>

      {/* Floor Layout Info */}
      <div className="absolute bottom-4 right-4 bg-black bg-opacity-80 p-3 rounded-lg text-white max-w-xs">
        <h3 className="font-bold text-lg mb-2">📐 Floor Layout</h3>
        <div className="text-sm space-y-1">
          <p><strong>Floor Size:</strong> 50ft × 40ft</p>
          <p><strong>Total Area:</strong> 2,000 sq ft</p>
          <p><strong>Floor Color:</strong> White</p>
          <p className={`text-xs ${isPlaying ? 'text-green-300' : 'text-red-300'}`}>
            🎯 Look for: {isPlaying ? 'Green spinning border!' : 'Static green border'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Floor;