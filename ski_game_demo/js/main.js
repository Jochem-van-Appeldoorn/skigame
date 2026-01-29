// Eenvoudige 3D ski demo met Three.js
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x87CEEB, 0.0025);

const camera = new THREE.PerspectiveCamera(60, innerWidth/innerHeight, 0.1, 3000);
// Zet camera hoger en verder achter de speler zodat die niet onder de sneeuw terechtkomt
// hoger en iets dichter achter de speler voor ruim zicht op de piste
camera.position.set(0, 28, -22);

const renderer = new THREE.WebGLRenderer({antialias:true, powerPreference: 'high-performance'});
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1));
renderer.setClearColor(0x87CEEB);
document.body.appendChild(renderer.domElement);

// Skin System & Save Data
const SKIN_DATA = {
  red: { name: 'Classic Red', color: 0xff3333, price: 0 },
  blue: { name: 'Arctic Blue', color: 0x3399ff, price: 500 },
  green: { name: 'Forest Green', color: 0x33ff66, price: 750 },
  gold: { name: 'Golden Racer', color: 0xffd700, price: 1500 },
  purple: { name: 'Royal Purple', color: 0xcc66ff, price: 2000 },
  rainbow: { name: 'Rainbow Legend', colors: [0xff0000, 0xff7f00, 0xffff00, 0x00ff00, 0x0000ff, 0x4b0082, 0x9400d3], price: 5000 }
};

let gameData = {
  totalScore: 0,
  bestScore: 0,
  equippedSkin: 'red',
  ownedSkins: ['red']
};

// Load saved data
function loadGameData() {
  const saved = localStorage.getItem('skiGameData');
  if (saved) {
    try {
      gameData = JSON.parse(saved);
    } catch(e) {
      console.error('Failed to load save data');
    }
  }
}

// Save data
function saveGameData() {
  localStorage.setItem('skiGameData', JSON.stringify(gameData));
}

loadGameData();

// Game state
let gameStarted = false;
let isInMenu = true;

// Zorg dat overlay standaard verborgen is (defensive)
const overlay = (document.getElementById && document.getElementById('overlay')) || null;
if(overlay){
  // Gebruik inline style zodat we niet afhankelijk zijn van externe CSS
  overlay.style.display = 'none';
}

window.addEventListener('resize', ()=>{
  camera.aspect = innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// Licht
const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0);
hemi.position.set(0,50,0);
scene.add(hemi);
const dir = new THREE.DirectionalLight(0xffffff, 0.6);
dir.position.set(-5,10,5);
scene.add(dir);

// Helling (grote plane gekanteld)
const slopeAngle = Math.PI/6; // 30 graden
// Grotere plane zodat de piste langer en breder is (meer uitdaging)
// Vergroot de lengte zodat de witte ondergrond verder doorloopt en niet stopt
const planeGeo = new THREE.PlaneGeometry(480, 15000, 48, 48);
const planeMat = new THREE.MeshStandardMaterial({color:0xffffff});
const slope = new THREE.Mesh(planeGeo, planeMat);
slope.rotation.x = -Math.PI/2 + slopeAngle; // kantel
// leg de top van de helling rond y=0 voor eenvoudigere hoogte-berekeningen
slope.position.y = 0;
scene.add(slope);

// Halve breedte van de piste (gebruik bij spawn/recycle van bomen)
const PISTE_HALF_WIDTH = 120;
const TREE_EDGE_MARGIN = 15;   // afstand vanaf piste-rand
const TREE_CENTER_GAP = 0;    // vrije ruimte midden van de piste
const SLALOM_CENTER_GAP = 8;  // vrije ruimte midden alleen bij slalom zones
const SLALOM_NET_INNER_X = 16; // binnen-grens: nog verder naar binnen


// Skier (speler)
const playerGeo = new THREE.BoxGeometry(0.6, 0.4, 1.2);
const playerMat = new THREE.MeshStandardMaterial({color: SKIN_DATA[gameData.equippedSkin].color});
let player = new THREE.Mesh(playerGeo, playerMat);
player.position.set(0, 2, 0);
scene.add(player);

// Update player skin color
function updatePlayerSkin(skinId) {
  const skinData = SKIN_DATA[skinId];
  if (!skinData) return;
  
  if (player && player.traverse) {
    const isRainbow = skinId === 'rainbow';
    const colors = isRainbow ? skinData.colors : [skinData.color];
    let colorIndex = 0;
    
    player.traverse((child) => {
      if (child.isMesh && child.material) {
        const isTagged = child.userData && child.userData.skinTarget === true;
        const name = (child.name || '').toLowerCase();
        const isLikelyTarget = name.includes('ski') || name.includes('skis') || name.includes('shirt') || name.includes('jacket') || name.includes('torso');
        if (isTagged || isLikelyTarget) {
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach((mat) => {
            if (mat && mat.color) {
              if (isRainbow) {
                // Rainbow: wissel kleuren af per mesh
                mat.color.setHex(colors[colorIndex % colors.length]);
                colorIndex++;
              } else {
                mat.color.setHex(skinData.color);
              }
            }
          });
        }
      }
    });
  }
}

// Start Z (gebruik voor scoreberekening)
const startZ = player.position.z;

// Probeer een GLTF-model te laden als `assets/models/skier.glb`.
// Als dat niet beschikbaar is, blijft de box als fallback.
let modelLoaded = false;
const modelStatusEl = document.getElementById('model-status');
if(typeof THREE.GLTFLoader !== 'undefined'){
  try{
    const loader = new THREE.GLTFLoader();
    loader.load('assets/models/skier.glb', (gltf)=>{
      const model = gltf.scene || gltf;
      model.traverse(c=>{ if(c.isMesh) c.castShadow = true; });
      model.scale.setScalar(1.2);
      model.position.copy(player.position);
      model.rotation.y = Math.PI; // orienteer naar camera
      scene.add(model);
      // verwijder fallback box en update referentie
      scene.remove(player);
      player = model;
      updatePlayerSkin(gameData.equippedSkin);
      modelLoaded = true;
      if(modelStatusEl) modelStatusEl.textContent = 'Model: loaded';
    }, undefined, (err)=>{
      console.warn('GLTF load failed, using fallback box', err);
    });
  }catch(e){ console.warn('GLTFLoader init failed', e); }
}else{
  console.info('GLTFLoader niet gevonden; gebruik fallback speler');
}

// Als na korte tijd geen model is geladen, vervang fallback box met een nette placeholder groep
setTimeout(()=>{
  if(!modelLoaded){
    // bouw een betere skier placeholder (realistischer)
    const placeholder = new THREE.Group();

    const skinMat = new THREE.MeshStandardMaterial({color:0xffc99c, metalness:0.1, roughness:0.7});
    const jacketMat = new THREE.MeshStandardMaterial({color:0xff1a1a, metalness:0.05, roughness:0.6});
    const pantsMat = new THREE.MeshStandardMaterial({color:0x1c1c1c, roughness:0.7});
    const gloveMat = new THREE.MeshStandardMaterial({color:0x111111, roughness:0.6});
    const helmetMat = new THREE.MeshStandardMaterial({color:0x333333, roughness:0.4});

    // Hoofd + helm
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.30, 20, 20), skinMat);
    head.position.set(0, 1.05, -0.1);
    head.castShadow = true;
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.34, 18, 18), helmetMat);
    helmet.position.set(0, 1.08, -0.1);
    helmet.scale.set(1.0, 0.85, 1.0);
    helmet.castShadow = true;

    // Nek
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.12, 0.18, 12), skinMat);
    neck.position.set(0, 0.88, -0.05);
    neck.castShadow = true;

    // Torso (jacket) - iets taps
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.36, 0.70, 16), jacketMat);
    torso.position.set(0, 0.45, 0);
    torso.castShadow = true;
    torso.userData.skinTarget = true;

    // Heupen
    const hips = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.30, 0.25, 14), pantsMat);
    hips.position.set(0, 0.05, 0);
    hips.castShadow = true;

    // Benen (boven en onder) - breder voor beter proporties met skis
    const leftThigh = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.17, 0.45, 12), pantsMat);
    leftThigh.position.set(-0.15, -0.25, 0);
    leftThigh.castShadow = true;
    const rightThigh = leftThigh.clone();
    rightThigh.position.x = 0.15;

    const leftCalf = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.15, 0.45, 12), pantsMat);
    leftCalf.position.set(-0.15, -0.70, 0);
    leftCalf.castShadow = true;
    const rightCalf = leftCalf.clone();
    rightCalf.position.x = 0.15;

    // Armen (schouders + onderarmen)
    const leftArm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.55, 12), jacketMat);
    leftArm.position.set(-0.38, 0.55, -0.05);
    leftArm.rotation.z = -0.5;
    leftArm.castShadow = true;
    leftArm.userData.skinTarget = true;

    const rightArm = leftArm.clone();
    rightArm.position.x = 0.38;
    rightArm.rotation.z = 0.5;

    const leftGlove = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 10), gloveMat);
    leftGlove.position.set(-0.52, 0.25, -0.10);
    leftGlove.castShadow = true;
    const rightGlove = leftGlove.clone();
    rightGlove.position.x = 0.52;

    // Skis - simpel, realistisch design (gekleurde planken)
    const skiMat = new THREE.MeshStandardMaterial({color:0xff69b4, metalness:0.6, roughness:0.3}); // Roze kleur
    
    // Linker ski - dunne, lange plank
    const leftSki = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.03, 1.85), skiMat);
    leftSki.position.set(-0.38, -0.96, 0);
    leftSki.castShadow = true;
    leftSki.userData.skinTarget = true;

    // Rechter ski
    const rightSki = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.03, 1.85), skiMat);
    rightSki.position.set(0.38, -0.96, 0);
    rightSki.castShadow = true;
    rightSki.userData.skinTarget = true;
    rightSki.userData.skinTarget = true;

    placeholder.add(
      head, helmet, neck,
      torso, hips,
      leftThigh, rightThigh, leftCalf, rightCalf,
      leftArm, rightArm,
      leftGlove, rightGlove,
      leftSki, rightSki
    );
    placeholder.position.copy(player.position);
    scene.remove(player);
    player = placeholder;
    scene.add(player);
    updatePlayerSkin(gameData.equippedSkin);
    if(modelStatusEl) modelStatusEl.textContent = 'Model: placeholder';
    console.info('Geen GLB gevonden — verbeterde placeholder gebruikt.');
  }
}, 700);

// Obstakels
const obstacles = [];
function makeTree(){
  // Maak een eenvoudige kerstboom (meerdere lagen conussen + ornamenten)
  const g = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({color:0x6b3f1a});
  const foliageMat = new THREE.MeshStandardMaterial({color:0x0f6b1f});

  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.9, 8), trunkMat);
  trunk.position.y = 0.45;

  // Stacked cones for a fuller tree
  const cone1 = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.2, 12), foliageMat);
  cone1.position.y = 1.15;
  const cone2 = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.0, 12), foliageMat);
  cone2.position.y = 0.65;
  const cone3 = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.8, 12), foliageMat);
  cone3.position.y = 0.2;

  g.add(trunk, cone1, cone2, cone3);

  // Voeg enkele ornamenten toe (kleurige bolletjes)
  const ornamentColors = [0xffd700, 0xff4444, 0x44ccff, 0xff66cc];
  for(let i=0;i<8;i++){
    const mat = new THREE.MeshStandardMaterial({color: ornamentColors[i % ornamentColors.length]});
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.06,8,8), mat);
    const a = Math.random() * Math.PI * 2;
    const r = 0.25 + Math.random() * 0.6;
    const h = 0.3 + Math.random() * 1.0;
    s.position.set(Math.cos(a) * r, h, Math.sin(a) * r * 0.2);
    g.add(s);
  }

  // Kleine ster bovenop
  const star = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), new THREE.MeshStandardMaterial({color:0xffe27a, emissive:0xffe27a, emissiveIntensity:0.4}));
  star.position.y = 1.6;
  g.add(star);

  // Vergroot de boom meer zodat hij op afstand goed zichtbaar is
  g.scale.setScalar(2.4);

  return g;
}

function makeRock(){
  // Maak een realistische steen/rotsblok
  const g = new THREE.Group();
  
  // Variatie in grijstinten voor natuurlijk effect
  const grayShades = [0x606060, 0x707070, 0x808080, 0x555555, 0x656565];
  const rockColor = grayShades[Math.floor(Math.random() * grayShades.length)];
  const rockMat = new THREE.MeshStandardMaterial({
    color: rockColor,
    roughness: 0.9,
    metalness: 0.1
  });
  
  // Hoofdsteen (onregelmatige vorm met icosahedron)
  const mainRock = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.0, 1),
    rockMat
  );
  mainRock.position.y = 0.8;
  // Random rotatie voor meer variatie
  mainRock.rotation.set(
    Math.random() * Math.PI,
    Math.random() * Math.PI,
    Math.random() * Math.PI
  );
  // Random scale voor natuurlijker effect
  mainRock.scale.set(
    0.8 + Math.random() * 0.4,
    0.7 + Math.random() * 0.3,
    0.8 + Math.random() * 0.4
  );
  mainRock.castShadow = true;
  g.add(mainRock);
  
  // Voeg enkele kleinere stenen toe voor detail (dichter bij centrum voor betere hitbox)
  for(let i = 0; i < 2 + Math.floor(Math.random() * 3); i++){
    const smallRock = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.3 + Math.random() * 0.3, 0),
      rockMat
    );
    const angle = Math.random() * Math.PI * 2;
    const dist = 0.3 + Math.random() * 0.3; // dichter bij centrum (was 0.6 + 0.4)
    smallRock.position.set(
      Math.cos(angle) * dist,
      0.1 + Math.random() * 0.2, // lager (was 0.2 + 0.3)
      Math.sin(angle) * dist
    );
    smallRock.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI
    );
    smallRock.castShadow = true;
    g.add(smallRock);
  }
  
  // Vergroot de hele rotsgroep (kleiner gemaakt voor betere collision)
  g.scale.setScalar(1.4 + Math.random() * 0.6);
  
  return g;
}

// Decoratieve NPC-achtige modellen (niet-collideerbaar): bikini-figuren met kerstmuts
const decoratives = [];
function makeBikiniWoman(){
  const g = new THREE.Group();
  
  // Betere skinmat met lichtere, meer realistische tint
  const skinMat = new THREE.MeshStandardMaterial({color:0xf4c4a0, metalness:0.0, roughness:0.7});
  const redMat = new THREE.MeshStandardMaterial({color:0xcc0000, metalness:0.15, roughness:0.4});
  const whiteMat = new THREE.MeshStandardMaterial({color:0xffffff});
  const hairMat = new THREE.MeshStandardMaterial({color:0xb8860b}); // donkerblond
  const eyeMat = new THREE.MeshStandardMaterial({color:0x4a90e2}); // blauwe ogen
  const lipsMat = new THREE.MeshStandardMaterial({color:0xff6b9d}); // roze lippen

  // Hoofd (groter, meer gedetailleerd)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.38, 20, 20), skinMat);
  head.position.set(0, 1.25, 0);
  head.scale.set(1.0, 1.1, 0.9); // mooier gezichtsoppervlak
  head.castShadow = true;
  
  // Haren (beter: alleen achterkant en bovenkant, niet voor gezicht)
  const hairGroup = new THREE.Group();
  
  // Hoofd bedekking (alleen bovenkant, niet voorkant)
  const hairTop = new THREE.Mesh(new THREE.SphereGeometry(0.40, 20, 20), hairMat);
  hairTop.position.set(0, 1.38, -0.15);
  hairTop.scale.set(0.9, 0.75, 0.85); // smaller, only on back half
  hairTop.castShadow = true;
  
  // Haarachterkant (volume) - veel verder naar achteren
  const hairBack = new THREE.Mesh(new THREE.SphereGeometry(0.42, 18, 18), hairMat);
  hairBack.position.set(0, 1.10, -0.50); // verder naar achteren
  hairBack.scale.set(1.4, 1.3, 1.1);
  hairBack.castShadow = true;
  
  // Haarzijkanten (alleen achter oren)
  const hairLeftSide = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.75, 0.25), hairMat);
  hairLeftSide.position.set(-0.42, 0.85, -0.15); // verder naar achteren
  hairLeftSide.rotation.z = 0.1;
  hairLeftSide.castShadow = true;
  
  const hairRightSide = hairLeftSide.clone();
  hairRightSide.position.x = 0.42;
  hairRightSide.rotation.z = -0.1;
  hairRightSide.castShadow = true;
  
  hairGroup.add(hairTop, hairBack, hairLeftSide, hairRightSide);
  
  // Ogen
  const eyeMaterial = new THREE.MeshStandardMaterial({color: 0x4a90e2});
  const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 12), eyeMaterial);
  leftEye.position.set(-0.12, 1.32, 0.30);
  leftEye.castShadow = true;
  
  const rightEye = leftEye.clone();
  rightEye.position.x = 0.12;
  rightEye.castShadow = true;
  
  // Pupillen
  const pupilMat = new THREE.MeshStandardMaterial({color: 0x000000});
  const leftPupil = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), pupilMat);
  leftPupil.position.set(-0.12, 1.32, 0.36);
  
  const rightPupil = leftPupil.clone();
  rightPupil.position.x = 0.12;
  
  // Neus
  const noseMat = new THREE.MeshStandardMaterial({color: 0xf0a080});
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.15, 8), noseMat);
  nose.position.set(0, 1.2, 0.32);
  nose.rotation.x = Math.PI / 2;
  
  // Lippen
  const lips = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, 0.08), lipsMat);
  lips.position.set(0, 1.05, 0.34);

  // Bovenlichaam (meer curvy)
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.70, 0.28), skinMat);
  torso.position.set(0, 0.65, 0);
  torso.scale.set(1.0, 1.1, 1.0);
  torso.castShadow = true;
  
  // Billen (veel meer curved/sexy)
  const hips = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.55, 0.40), skinMat);
  hips.position.set(0, 0.12, 0.05); // verder naar achter voor meer curve
  hips.scale.set(1.0, 1.0, 1.1);
  hips.castShadow = true;
  
  // Benen (dunnere, mooiere proporties)
  const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.75, 0.24), skinMat);
  leftLeg.position.set(-0.22, -0.38, 0);
  leftLeg.castShadow = true;
  
  const rightLeg = leftLeg.clone();
  rightLeg.position.x = 0.22;
  rightLeg.castShadow = true;

  // Bikini bovenstuk (wraps around body)
  const bikiniTopBra = new THREE.Group();
  
  // Front bikini top
  const topFront = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.24, 0.18), redMat);
  topFront.position.set(0, 0.91, 0.10);
  topFront.castShadow = true;
  
  // Linker cup (breast detail) - front
  const leftCup = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 14), redMat);
  leftCup.position.set(-0.20, 0.95, 0.14);
  leftCup.scale.set(0.9, 1.05, 0.8);
  leftCup.castShadow = true;
  
  // Rechter cup (breast detail) - front
  const rightCup = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 14), redMat);
  rightCup.position.set(0.20, 0.95, 0.14);
  rightCup.scale.set(0.9, 1.05, 0.8);
  rightCup.castShadow = true;
  
  // Back straps (bikini back)
  const backLeftStrap = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.28, 0.08), redMat);
  backLeftStrap.position.set(-0.28, 0.91, -0.08);
  backLeftStrap.castShadow = true;
  
  const backRightStrap = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.28, 0.08), redMat);
  backRightStrap.position.set(0.28, 0.91, -0.08);
  backRightStrap.castShadow = true;
  
  bikiniTopBra.add(topFront, leftCup, rightCup, backLeftStrap, backRightStrap);
  
  // Bikini onderstuk (sexy curves - wraps around)
  const bikiniBottom = new THREE.Group();
  
  // Front bottom
  const bottomFront = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.18, 0.20), redMat);
  bottomFront.position.set(0, 0.32, 0.10);
  bottomFront.castShadow = true;
  
  // Linker bilkuil - front
  const leftGlute = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12), redMat);
  leftGlute.position.set(-0.24, 0.28, 0.16);
  leftGlute.scale.set(0.8, 0.9, 0.9);
  leftGlute.castShadow = true;
  
  // Rechter bilkuil - front
  const rightGlute = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12), redMat);
  rightGlute.position.set(0.24, 0.28, 0.16);
  rightGlute.scale.set(0.8, 0.9, 0.9);
  rightGlute.castShadow = true;
  
  // Back straps for bottom
  const backBottomLeft = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.20, 0.08), redMat);
  backBottomLeft.position.set(-0.28, 0.32, -0.10);
  backBottomLeft.castShadow = true;
  
  const backBottomRight = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.20, 0.08), redMat);
  backBottomRight.position.set(0.28, 0.32, -0.10);
  backBottomRight.castShadow = true;
  
  bikiniBottom.add(bottomFront, leftGlute, rightGlute, backBottomLeft, backBottomRight);
  
  // Witte bont rand op bikini top (luxe detail)
  const topFur = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.05, 6, 20), whiteMat);
  topFur.position.set(0, 1.05, 0.12);
  topFur.rotation.x = Math.PI / 2;
  
  // Witte bont rand op bikini bottom
  const bottomFur = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.05, 6, 20), whiteMat);
  bottomFur.position.set(0, 0.22, 0.13);
  bottomFur.rotation.x = Math.PI / 2;

  // Armen (slanker, sexier)
  const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.75, 0.18), skinMat);
  leftArm.position.set(-0.40, 0.62, -0.05);
  leftArm.rotation.z = 0.5;
  leftArm.castShadow = true;
  
  const rightArm = leftArm.clone();
  rightArm.position.x = 0.40;
  rightArm.rotation.z = -0.5;
  rightArm.castShadow = true;

  // Santa hat: cone + white rim
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.65, 14), redMat);
  hat.position.set(0, 1.55, 0);
  hat.rotation.z = 0.25;
  hat.castShadow = true;
  
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.07, 10, 14), whiteMat);
  rim.position.set(0, 1.28, 0);

  g.add(head, hairGroup, leftEye, rightEye, leftPupil, rightPupil, nose, lips,
        torso, hips, leftLeg, rightLeg, leftArm, rightArm, 
        bikiniTopBra, bikiniBottom, topFur, bottomFur, hat, rim);

  // Maak de figuur groter zodat je 'm makkelijker ziet
  g.scale.setScalar(2.0);

  return g;
}

// Maak verschillende varianten van decorative figuren (Lara Croft kerst-bikini stijl)
function makeDecorativeFigure(){
  const g = new THREE.Group();
  
  // Kerst-bikini kleuren (rood/wit thema met variaties)
  const bikiniColors = [0xcc0000, 0xff0000, 0x990000, 0xffffff];
  const hairColors = [0x8b4513, 0x2c1608, 0xb8860b, 0x000000]; // Bruin, zwart, blond
  const bootColors = [0x654321, 0x3a2819, 0x000000];
  
  const skinMat = new THREE.MeshStandardMaterial({color:0xf5d0b0, metalness:0.1, roughness:0.7});
  const bikiniMat = new THREE.MeshStandardMaterial({
    color: bikiniColors[Math.floor(Math.random() * bikiniColors.length)], 
    metalness:0.2, 
    roughness:0.4
  });
  const whiteFurMat = new THREE.MeshStandardMaterial({color:0xffffff, roughness:0.9});
  const hairMat = new THREE.MeshStandardMaterial({
    color: hairColors[Math.floor(Math.random() * hairColors.length)],
    roughness:0.8
  });
  const bootMat = new THREE.MeshStandardMaterial({
    color: bootColors[Math.floor(Math.random() * bootColors.length)],
    roughness:0.7,
    metalness:0.1
  });

  // Hoofd - atletisch vrouwelijk gezicht
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 20, 20), skinMat);
  head.position.set(0, 1.38, 0);
  head.scale.set(0.95, 1.0, 0.85);
  head.castShadow = true;
  
  // Paardenstaart - iconic Lara Croft
  const ponytail = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.65, 12), hairMat);
  ponytail.position.set(0, 1.25, -0.35);
  ponytail.rotation.x = -0.3;
  ponytail.castShadow = true;
  
  // Haarachter volume
  const hairBack = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 16), hairMat);
  hairBack.position.set(0, 1.42, -0.12);
  hairBack.scale.set(0.9, 0.75, 0.95);
  hairBack.castShadow = true;
  
  // Haar bovenkant (bedekt voorhoofd en bovenkant hoofd)
  const hairTop = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 16), hairMat);
  hairTop.position.set(0, 1.48, 0.05);
  hairTop.scale.set(1.0, 0.7, 1.1);
  hairTop.castShadow = true;
  
  // Pony/franje
  const bangs = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.12, 0.08), hairMat);
  bangs.position.set(0, 1.52, 0.22);
  bangs.castShadow = true;
  
  // Ogen - wit oogwit
  const eyeWhiteMat = new THREE.MeshStandardMaterial({color:0xffffff, roughness:0.3});
  const leftEyeWhite = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 16), eyeWhiteMat);
  leftEyeWhite.position.set(-0.11, 1.42, 0.24);
  leftEyeWhite.scale.set(1.1, 0.9, 0.5);
  
  const rightEyeWhite = leftEyeWhite.clone();
  rightEyeWhite.position.x = 0.11;
  
  // Iris - gekleurde ogen
  const eyeColors = [0x4a90e2, 0x228b22, 0x8b4513, 0x33aa88];
  const irisMat = new THREE.MeshStandardMaterial({color: eyeColors[Math.floor(Math.random() * eyeColors.length)]});
  const leftIris = new THREE.Mesh(new THREE.CircleGeometry(0.045, 16), irisMat);
  leftIris.position.set(-0.11, 1.42, 0.285);
  
  const rightIris = leftIris.clone();
  rightIris.position.x = 0.11;
  
  // Pupillen - zwart
  const pupilMat = new THREE.MeshStandardMaterial({color:0x000000});
  const leftPupil = new THREE.Mesh(new THREE.CircleGeometry(0.022, 12), pupilMat);
  leftPupil.position.set(-0.11, 1.42, 0.286);
  
  const rightPupil = leftPupil.clone();
  rightPupil.position.x = 0.11;
  
  // Lichtreflectie in ogen
  const highlightMat = new THREE.MeshBasicMaterial({color:0xffffff});
  const leftHighlight = new THREE.Mesh(new THREE.CircleGeometry(0.015, 8), highlightMat);
  leftHighlight.position.set(-0.095, 1.44, 0.287);
  
  const rightHighlight = leftHighlight.clone();
  rightHighlight.position.x = 0.125;
  
  // Wenkbrauwen
  const browMat = new THREE.MeshStandardMaterial({color:0x3a2818});
  const leftBrow = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.02), browMat);
  leftBrow.position.set(-0.11, 1.51, 0.27);
  leftBrow.rotation.z = -0.15;
  
  const rightBrow = leftBrow.clone();
  rightBrow.position.x = 0.11;
  rightBrow.rotation.z = 0.15;

  // Hals
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.20, 12), skinMat);
  neck.position.set(0, 1.15, 0);
  neck.castShadow = true;
  
  // Torso - atletisch en curvy
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.60, 16), skinMat);
  torso.position.set(0, 0.73, 0);
  torso.castShadow = true;
  
  // Taille - smal
  const waist = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.22, 0.18, 16), skinMat);
  waist.position.set(0, 0.40, 0);
  waist.castShadow = true;
  
  // Heupen - atletisch vrouwelijk
  const hips = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.24, 0.35, 16), skinMat);
  hips.position.set(0, 0.15, 0);
  hips.castShadow = true;
  
  // Dijen - gespierd
  const leftThigh = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.50, 12), skinMat);
  leftThigh.position.set(-0.14, -0.25, 0);
  leftThigh.castShadow = true;
  
  const rightThigh = leftThigh.clone();
  rightThigh.position.x = 0.14;
  rightThigh.castShadow = true;
  
  // Knieën tot enkels (in laarzen)
  const leftCalf = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.10, 0.45, 12), skinMat);
  leftCalf.position.set(-0.14, -0.73, 0);
  leftCalf.castShadow = true;
  
  const rightCalf = leftCalf.clone();
  rightCalf.position.x = 0.14;
  rightCalf.castShadow = true;

  // Kerst bikini top met bont
  const bikiniTopLeft = new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 14), bikiniMat);
  bikiniTopLeft.position.set(-0.15, 0.82, 0.10);
  bikiniTopLeft.scale.set(0.85, 0.95, 0.75);
  bikiniTopLeft.castShadow = true;
  
  const bikiniTopRight = bikiniTopLeft.clone();
  bikiniTopRight.position.x = 0.15;
  bikiniTopRight.castShadow = true;
  
  // Witte bont rand op top
  const topFur = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.04, 8, 16), whiteFurMat);
  topFur.position.set(0, 0.90, 0.08);
  topFur.rotation.x = Math.PI / 2;
  
  // Bikini bottom met bont
  const bikiniBottom = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.16, 16), bikiniMat);
  bikiniBottom.position.set(0, 0.05, 0);
  bikiniBottom.castShadow = true;
  
  const bottomFur = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.04, 8, 16), whiteFurMat);
  bottomFur.position.set(0, 0.12, 0);
  bottomFur.rotation.x = Math.PI / 2;

  // Armen - atletisch
  const leftArm = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.65, 12), skinMat);
  leftArm.position.set(-0.33, 0.68, 0);
  leftArm.rotation.z = 0.25;
  leftArm.castShadow = true;
  
  const rightArm = leftArm.clone();
  rightArm.position.x = 0.33;
  rightArm.rotation.z = -0.25;
  rightArm.castShadow = true;
  
  // Handen
  const leftHand = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 10), skinMat);
  leftHand.position.set(-0.40, 0.35, 0);
  leftHand.scale.set(0.8, 1.0, 0.7);
  leftHand.castShadow = true;
  
  const rightHand = leftHand.clone();
  rightHand.position.x = 0.40;
  rightHand.castShadow = true;

  // Laarzen - knie-hoog
  const leftBoot = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.50, 12), bootMat);
  leftBoot.position.set(-0.14, -0.98, 0);
  leftBoot.castShadow = true;
  
  const rightBoot = leftBoot.clone();
  rightBoot.position.x = 0.14;
  rightBoot.castShadow = true;
  
  // Laarzenzolen
  const leftSole = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, 0.26), new THREE.MeshStandardMaterial({color:0x222222}));
  leftSole.position.set(-0.14, -1.24, 0.02);
  leftSole.castShadow = true;
  
  const rightSole = leftSole.clone();
  rightSole.position.x = 0.14;
  rightSole.castShadow = true;

  // Santa muts (70% kans)
  if(Math.random() < 0.7){
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.55, 14), new THREE.MeshStandardMaterial({color:0xcc0000}));
    hat.position.set(0, 1.65, 0);
    hat.rotation.z = (Math.random() - 0.5) * 0.35;
    hat.castShadow = true;
    
    const pompom = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 10), whiteFurMat);
    pompom.position.set(hat.rotation.z * 0.4, 1.92, 0);
    
    const hatRim = new THREE.Mesh(new THREE.TorusGeometry(0.30, 0.05, 8, 14), whiteFurMat);
    hatRim.position.set(0, 1.40, 0);
    
    g.add(hat, pompom, hatRim);
  }

  g.add(head, ponytail, hairBack, hairTop, bangs,
        leftEyeWhite, rightEyeWhite, leftIris, rightIris, 
        leftPupil, rightPupil, leftHighlight, rightHighlight,
        leftBrow, rightBrow,
        neck, torso, waist, hips, 
        leftThigh, rightThigh, leftCalf, rightCalf,
        bikiniTopLeft, bikiniTopRight, topFur, bikiniBottom, bottomFur,
        leftArm, rightArm, leftHand, rightHand,
        leftBoot, rightBoot, leftSole, rightSole);

  // Schaal voor goede zichtbaarheid
  g.scale.setScalar(1.6 + Math.random() * 0.3);

  return g;
}

// Après-ski hut
function makeAlpineHut(){
  const g = new THREE.Group();
  
  // Materialen
  const woodMat = new THREE.MeshStandardMaterial({color:0x8b6f47, roughness:0.8});
  const darkWoodMat = new THREE.MeshStandardMaterial({color:0x654321, roughness:0.9});
  const roofMat = new THREE.MeshStandardMaterial({color:0x8b0000, roughness:0.7});
  const stoneMat = new THREE.MeshStandardMaterial({color:0x666666, roughness:0.95});
  
  // Fundering (stenen basis)
  const foundation = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.4, 3.2), stoneMat);
  foundation.position.set(0, 0.2, 0);
  foundation.castShadow = true;
  
  // Hoofdgebouw met meer detail
  const main = new THREE.Mesh(new THREE.BoxGeometry(3.5, 2.2, 3.0), woodMat);
  main.position.set(0, 1.3, 0);
  main.castShadow = true;
  
  // Houten balken (verticaal)
  const beamMat = new THREE.MeshStandardMaterial({color:0x5a4a3a});
  for(let i = -1; i <= 1; i++){
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.2, 0.15), beamMat);
    beam.position.set(i * 1.2, 1.3, 1.51);
    beam.castShadow = true;
    g.add(beam);
  }
  
  // Dak met meer detail
  const roof = new THREE.Mesh(new THREE.ConeGeometry(2.8, 1.6, 4), roofMat);
  roof.position.set(0, 3.0, 0);
  roof.castShadow = true;
  
  // Dakrand accenten
  const roofTrim = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.1, 0.1), darkWoodMat);
  roofTrim.position.set(0, 2.3, 1.55);
  g.add(roofTrim);
  
  // Deur met frame
  const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.75, 0.08), darkWoodMat);
  doorFrame.position.set(0, 0.875, 1.52);
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.75, 1.5, 0.06), new THREE.MeshStandardMaterial({color:0x5a3a2a}));
  door.position.set(0, 0.75, 1.53);
  // Deurknop
  const doorknob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), new THREE.MeshStandardMaterial({color:0xffd700, metalness:0.8}));
  doorknob.position.set(0.3, 0.75, 1.56);
  
  // Ramen met frames
  const windowMat = new THREE.MeshStandardMaterial({color:0xffd700, emissive:0xffaa00, emissiveIntensity:0.4, transparent:true, opacity:0.9});
  const frameMat = new THREE.MeshStandardMaterial({color:0x3a3a3a});
  
  // Linker raam
  const winFrame1 = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.08), frameMat);
  winFrame1.position.set(-1.2, 1.5, 1.52);
  const win1 = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.05), windowMat);
  win1.position.set(-1.2, 1.5, 1.54);
  
  // Rechter raam
  const winFrame2 = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.08), frameMat);
  winFrame2.position.set(1.2, 1.5, 1.52);
  const win2 = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.05), windowMat);
  win2.position.set(1.2, 1.5, 1.54);
  
  // Bloembakken onder ramen
  const flowerBox1 = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.15, 0.2), darkWoodMat);
  flowerBox1.position.set(-1.2, 1.1, 1.6);
  const flowerBox2 = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.15, 0.2), darkWoodMat);
  flowerBox2.position.set(1.2, 1.1, 1.6);
  
  // Kleine bloemen in bakken (rode en witte bolletjes)
  for(let box of [-1.2, 1.2]){
    for(let i = 0; i < 3; i++){
      const flower = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), new THREE.MeshStandardMaterial({color: i % 2 === 0 ? 0xff3333 : 0xffffff}));
      flower.position.set(box + (i - 1) * 0.25, 1.25, 1.65);
      g.add(flower);
    }
  }
  
  // Balkon/veranda
  const balcony = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.1, 0.8), woodMat);
  balcony.position.set(0, 0.45, 1.9);
  const railing = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.4, 0.08), darkWoodMat);
  railing.position.set(0, 0.65, 2.2);
  
  // Schoorsteen met detail
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.4, 0.5), stoneMat);
  chimney.position.set(1.2, 3.5, -0.4);
  chimney.castShadow = true;
  const chimneyTop = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 0.6), stoneMat);
  chimneyTop.position.set(1.2, 4.3, -0.4);
  
  g.add(foundation, main, roof, roofTrim, doorFrame, door, doorknob,
        winFrame1, win1, winFrame2, win2, flowerBox1, flowerBox2,
        balcony, railing, chimney, chimneyTop);
  g.scale.setScalar(1.5);
  
  return g;
}

// Slalom vlag
function makeSlalomFlag(color){
  const g = new THREE.Group();
  
  // Paal
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.6, 6), new THREE.MeshStandardMaterial({color:0x333333}));
  pole.position.y = 0.8;
  
  // Vlag (rechthoek)
  const flagMat = new THREE.MeshStandardMaterial({color: color});
  const flag = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.05), flagMat);
  flag.position.set(0.5, 1.3, 0);
  
  g.add(pole, flag);
  return g;
}

// Halve cirkel poort voor slalom start/finish
function makeGiantSlalomGate(side){
  const g = new THREE.Group();
  let color;
  
  // Start en finish zijn halve cirkels
  if(side === 'start' || side === 'end'){
    if(side === 'start'){
      color = 0x00ff00; // groen voor start
    } else {
      color = 0xff6600; // oranje voor eind
    }
    
    const mat = new THREE.MeshStandardMaterial({
      color: color,
      metalness: 0.6,
      roughness: 0.2,
      emissive: color,
      emissiveIntensity: 0.4
    });
    
    // Halve cirkel boog
    const tube = 0.15;
    const radius = 2.2;
    
    const arch = new THREE.Mesh(
      new THREE.TorusGeometry(radius, tube, 8, 16, 0, Math.PI),
      mat
    );
    arch.rotation.y = Math.PI / 2;
    arch.position.y = 2.5;
    arch.castShadow = true;
    
    // Steunpalen
    const poleLeft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.25, 3.5, 6),
      mat
    );
    poleLeft.position.set(-radius, 1.75, 0);
    poleLeft.castShadow = true;
    
    const poleRight = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.25, 3.5, 6),
      mat
    );
    poleRight.position.set(radius, 1.75, 0);
    poleRight.castShadow = true;
    
    g.add(arch, poleLeft, poleRight);
  } else {
    // Normale slalom gates zijn vlaggen
    color = side === 'left' ? 0xff3333 : 0x3333ff; // rood/blauw
    const flag = makeSlalomFlag(color);
    flag.position.x = side === 'left' ? -5.5 : 5.5;
    g.add(flag);
  }
  
  return g;
}

// Voeg zijkant nets toe aan slalom zone
function addSlalomNetBoundaries(zoneInfo){
  const netHeight = 3;
  const zoneDepth = zoneInfo.end - zoneInfo.start;
  const innerNetWidth = 0.5;
  const innerNetX = SLALOM_NET_INNER_X;
  
  // Bereken correcte Y positie voor center van zone - net staat OP de grond
  const groundY = 2 - Math.tan(slopeAngle) * zoneInfo.center;
  const netY = groundY; // Center net op grondniveau (rotatie tilt het naar achteren)

  // Binnen-netten (grens waar props kunnen spawnen)
  const innerMat = new THREE.MeshStandardMaterial({
    color: 0xffff00,
    transparent: true,
    opacity: 0.85,
    wireframe: false,
    emissive: 0xffff00,
    emissiveIntensity: 0.9,
    side: THREE.DoubleSide
  });
  
  const innerLeft = new THREE.Mesh(
    new THREE.BoxGeometry(innerNetWidth, netHeight, zoneDepth),
    innerMat
  );
  innerLeft.position.set(-innerNetX - innerNetWidth / 2, netY, zoneInfo.center);
  innerLeft.rotation.x = slopeAngle; // volg de helling
  innerLeft.castShadow = true;
  slalomNets.add(innerLeft);

  const innerRight = new THREE.Mesh(
    new THREE.BoxGeometry(innerNetWidth, netHeight, zoneDepth),
    innerMat
  );
  innerRight.position.set(innerNetX + innerNetWidth / 2, netY, zoneInfo.center);
  innerRight.rotation.x = slopeAngle; // volg de helling
  innerRight.castShadow = true;
  slalomNets.add(innerRight);
}

const hutGroup = new THREE.Group();
const slalomGroup = new THREE.Group();
const slalomGates = []; // Track alle slalomvlaggen voor bonus punten
const slalomZones = []; // Track slalom sectie zones
const slalomNets = new THREE.Group(); // Visuele nets voor slalom boundaries
const slalomSpectatorGroup = new THREE.Group();
scene.add(hutGroup, slalomGroup, slalomNets, slalomSpectatorGroup);

function spawnAlpineHuts(){
  for(let i = 0; i < 8; i++){
    const hut = makeAlpineHut();
    const side = Math.random() < 0.5 ? -1 : 1;
    hut.position.set(side * (70 + Math.random() * 30), 0, player.position.z + 150 + i * 180);
    const hutY = 2 - Math.tan(slopeAngle) * hut.position.z;
    hut.position.y = hutY;
    hutGroup.add(hut);
  }
}

function spawnGiantSlalomSections(){
  // Plaats slalom secties langs de piste - goed gescheiden met voldoende buffer
  for(let section = 0; section < 8; section++){
    // Elke slalom sectie is langer nu (12 gates met gemiddeld 60 units = 720), met 800 units spacing ertussen
    const sectionStart = 600 + section * 1600;  // grotere spacing (1600 units)
    const sectionEnd = sectionStart + 800;      // zone lengte (12 gates * ~65 gemiddeld)
    const sectionCenter = (sectionStart + sectionEnd) / 2;
    
    // Slalom zone info opslaan - DUIDELIJK GEDEFINIEERD met buffers
    const zoneInfo = {
      start: sectionStart,
      end: sectionEnd,
      center: sectionCenter,
      width: 16,
      // Exclusie buffers voor boom-verwijdering: EXACT tussen start en end gates, geen buffer
      excludeStart: sectionStart,
      excludeEnd: sectionEnd,
      startGatePassed: false,
      endGatePassed: false
    };
    slalomZones.push(zoneInfo);
    
    // Voeg zijkant nets toe EERST
    addSlalomNetBoundaries(zoneInfo);
    
    // Start gate (ingangpoort)
    const startGate = makeGiantSlalomGate('start');
    startGate.position.set(0, 2 - Math.tan(slopeAngle) * sectionStart, sectionStart);
    startGate.scale.set(3.5, 3.5, 3.5);
    startGate.castShadow = true;
    slalomGroup.add(startGate);
    slalomGates.push({
      obj: startGate,
      gateType: 'startGate',
      sectionIndex: section,
      position: new THREE.Vector3(startGate.position.x, startGate.position.y, startGate.position.z),
      visited: false,
      zoneInfo: zoneInfo
    });
    
    // Slalom gates in de zone - meer vlaggetjes voor langere slalom
    let cumulativeDistance = 0;
    for(let gate = 0; gate < 12; gate++){
      const side = gate % 2 === 0 ? 'left' : 'right';
      const g = makeGiantSlalomGate(side);
      // Variatie in afstand tussen vlaggen (55-70 units voor goede spreiding)
      const gateDistance = 55 + Math.random() * 15;
      cumulativeDistance += gateDistance;
      g.position.z = sectionStart + cumulativeDistance;
      const gateY = 2 - Math.tan(slopeAngle) * g.position.z;
      g.position.y = gateY;
      g.scale.set(1.2, 1.2, 1.2);
      slalomGroup.add(g);
      
      slalomGates.push({
        obj: g,
        gateType: 'slalom',
        side: side,
        sectionIndex: section,
        position: new THREE.Vector3(g.position.x, g.position.y, g.position.z),
        visited: false,
        zoneInfo: zoneInfo
      });
    }
    
    // End gate (uitgangspoort)
    const endGate = makeGiantSlalomGate('end');
    endGate.position.set(0, 2 - Math.tan(slopeAngle) * sectionEnd, sectionEnd);
    endGate.scale.set(3.5, 3.5, 3.5);
    endGate.castShadow = true;
    slalomGroup.add(endGate);
    slalomGates.push({
      obj: endGate,
      gateType: 'endGate',
      sectionIndex: section,
      position: new THREE.Vector3(endGate.position.x, endGate.position.y, endGate.position.z),
      visited: false,
      zoneInfo: zoneInfo
    });
  }
}

function spawnObstacles(count=200){
  console.log("spawnObstacles: slalomZones.length =", slalomZones.length);
  
  let spawned = 0;
  let attempts = 0;
  const maxAttempts = count * 20;
  
  while(spawned < count && attempts < maxAttempts){
    attempts++;
    
    // Verdeel bomen gelijkmatig over de hele piste
    // Mix tussen dichtbij EN ver weg
    let z;
    if(spawned < count * 0.3){
      // 30% van bomen dichtbij (voor direct zichtbaar)
      z = player.position.z + Math.random() * 600 + 30;
    } else {
      // 70% van bomen verspreid over grotere afstand
      z = player.position.z + Math.random() * 2500 + 600;
    }
    
    // Check of deze Z positie in een slalom zone valt
    let inSlalomZone = false;
    for(const zone of slalomZones){
      if(z >= zone.excludeStart && z <= zone.excludeEnd){
        inSlalomZone = true;
        break;
      }
    }
    
    // Spawn positie bepalen: in slalom zones met center gap, anders over hele piste
    let x;
    if(inSlalomZone){
      // In slalom zone: laat center gap vrij voor vlaggetjes, spawn verder naar buiten
      if (Math.random() < 0.5) {
        // LINKER KANT (van piste rand tot center gap, verder naar buiten)
        x = -PISTE_HALF_WIDTH + TREE_EDGE_MARGIN + Math.random() * (PISTE_HALF_WIDTH - 20 - TREE_EDGE_MARGIN);
      } else {
        // RECHTER KANT (van center gap tot piste rand, verder naar buiten)
        x = 20 + Math.random() * (PISTE_HALF_WIDTH - 20 - TREE_EDGE_MARGIN);
      }
    } else {
      // Buiten slalom zone: spawn over hele piste breedte
      x = -PISTE_HALF_WIDTH + TREE_EDGE_MARGIN + Math.random() * (2 * PISTE_HALF_WIDTH - 2 * TREE_EDGE_MARGIN);
    }
    
    // Altijd spawnen - alleen bomen (stenen tijdelijk uitgeschakeld)
    const obstacle = makeTree();
    const y = 2 - Math.tan(slopeAngle) * z;
    obstacle.position.set(x, y + 0.45, z);
    scene.add(obstacle);
    obstacles.push(obstacle);
    spawned++;
  }
  console.log("spawnObstacles: spawned", spawned, "trees at positions 30-3100");
}


spawnAlpineHuts();
spawnGiantSlalomSections();
spawnObstacles();

function spawnDecoratives(count=10){
  for(let i=0;i<count;i++){
    // Gebruik alleen de nieuwe Roblox-stijl figuren
    const d = makeDecorativeFigure();
    // spreid decoraties aan de z-as iets voor/naast de speler, en buiten collision-baan
    const side = (Math.random() < 0.5 ? -1 : 1) * (18 + Math.random() * 12);
    const z = player.position.z + Math.random() * 360 + 60 + (i * 8);
    const y = 2 - Math.tan(slopeAngle) * z;
    d.position.set(side, y + 0.05, z);
    d.rotation.y = Math.random() * Math.PI * 2;
    scene.add(d);
    decoratives.push(d);
  }
}

// Spawn kerst-decoratie (meer poppetjes voor meer variatie)
spawnDecoratives(18);

function spawnSlalomSpectators(perZone = 6){
  slalomZones.forEach(zone => {
    for(let i = 0; i < perZone; i++){
      const d = makeDecorativeFigure();
      const side = Math.random() < 0.5 ? -1 : 1;
      const z = zone.start + 60 + Math.random() * (zone.end - zone.start - 120);
      const x = side * (SLALOM_NET_INNER_X + 6 + Math.random() * 14);
      const y = 2 - Math.tan(slopeAngle) * z;
      d.position.set(x, y + 0.05, z);
      d.rotation.y = Math.random() * Math.PI * 2;
      slalomSpectatorGroup.add(d);
    }
  });
}

spawnSlalomSpectators(6);

function reseedPropsNearPlayer(){
  const firstZoneStart = slalomZones.length
    ? Math.min(...slalomZones.map(z => z.excludeStart))
    : null;
  const maxTreeZ = firstZoneStart !== null
    ? Math.max(player.position.z + 220, firstZoneStart - 60)
    : player.position.z + 1400;
  const minTreeZ = player.position.z + 120;
  const slalomBuffer = 80; // extra vrije ruimte rond start/finish poorten
  const clearRadius = 140; // kleine cirkel rond speler vrijhouden
  // Obstakels opnieuw verspreiden vlak voor de speler
  obstacles.forEach(o => {
    let z;
    let x;
    let attempts = 0;
    do {
      z = minTreeZ + Math.random() * (maxTreeZ - minTreeZ);
      x = -PISTE_HALF_WIDTH + TREE_EDGE_MARGIN + Math.random() * (2 * PISTE_HALF_WIDTH - 2 * TREE_EDGE_MARGIN);
      attempts++;
    } while (
      attempts < 40 && (
        slalomZones.some(zone => z >= (zone.excludeStart - slalomBuffer) && z <= (zone.excludeEnd + slalomBuffer)) ||
        Math.hypot(x - player.position.x, z - player.position.z) < clearRadius
      )
    );
    const y = 2 - Math.tan(slopeAngle) * z;
    o.position.set(x, y + 0.45, z);
  });

  // Hutten opnieuw in de buurt plaatsen
  hutGroup.children.forEach(h => {
    const z = player.position.z + 500 + Math.random() * 1800;
    const side = (Math.random() < 0.5 ? -1 : 1);
    const x = side * (PISTE_HALF_WIDTH - 20 - Math.random() * 20);
    const y = 2 - Math.tan(slopeAngle) * z;
    h.position.set(x, y + 0.2, z);
  });

  // Decoratieve figuren opnieuw vlakbij plaatsen
  decoratives.forEach((d, i) => {
    const side = (Math.random() < 0.5 ? -1 : 1) * (18 + Math.random() * 12);
    const z = player.position.z + 300 + Math.random() * 600 + (i * 8);
    const y = 2 - Math.tan(slopeAngle) * z;
    d.position.set(side, y + 0.05, z);
    d.rotation.y = Math.random() * Math.PI * 2;
  });
}

// Camera volgt speler
function updateCamera(){
  if(firstPersonMode){
    // First person: camera voor op het gezicht, kijkend vooruit
    // Camera positie voor de skier (ogen/gezicht)
    const headPos = new THREE.Vector3(
      player.position.x,
      player.position.y + 0.8, // hoogte van ogen
      player.position.z - 0.6  // voor de skier
    );
    
    // Camera volgt smooth
    camera.position.lerp(headPos, 0.4);
    
    // Kijk naar beneden en vooruit (forward pitch) - meer immersief
    const lookTarget = new THREE.Vector3(
      player.position.x + Math.sin(player.rotation.y) * 10,
      player.position.y - 2, // lager kijken (naar beneden gekanteld)
      player.position.z + Math.cos(player.rotation.y) * 20
    );
    camera.lookAt(lookTarget);
  } else {
    // Third person: klassieke achteraanzicht
    const desired = new THREE.Vector3(player.position.x, player.position.y + 12.0, player.position.z - 8);
    camera.position.lerp(desired, 0.55);
    camera.lookAt(player.position.x, player.position.y - 6.0, player.position.z + 8);
  }
}

// Invoer
const keys = { left:false, right:false };
let firstPersonMode = false; // First person camera mode
let debugMenuOpen = false; // Debug menu toggle

addEventListener('keydown', e=>{
  const k = e.key;
  if(k === 'ArrowLeft' || k === 'Left' || k === 'a' || k === 'A') keys.left = true;
  if(k === 'ArrowRight' || k === 'Right' || k === 'd' || k === 'D') keys.right = true;
  if(k === 'F1') {
    e.preventDefault();
    // Toggle debug menu
    debugMenuOpen = !debugMenuOpen;
    const debugMenu = document.getElementById('debug-menu');
    if (debugMenu) debugMenu.style.display = debugMenuOpen ? 'block' : 'none';
  }
  if(k === 'q' || k === 'Q') {
    firstPersonMode = !firstPersonMode;
    console.log(firstPersonMode ? 'First person ON' : 'Third person ON');
  }
  if(k === 'r' || k === 'R') {
    location.reload();
  }
});
addEventListener('keyup', e=>{
  const k = e.key;
  if(k === 'ArrowLeft' || k === 'Left' || k === 'a' || k === 'A') keys.left = false;
  if(k === 'ArrowRight' || k === 'Right' || k === 'd' || k === 'D') keys.right = false;
});

// Spelvariabelen en physics (snelheid in units/second)
// Realistischere physics
let speed = 45.0; // units per second (vooruit)
let maxSpeed = 1500.0; // max snelheid
let downhillAccel = 20.0; // zwaartekracht effect
let snowFriction = 0.98; // sneeuwwrijving - meer remming voor realistisch acceleratie pattern
let airResistance = 0.998; // lucht weerstand - bijna geen
let steerVelocity = 0; // intern voor smooth turning
let steerPower = 20.0; // grotere waarde = snellere zijdelingse beweging
let steerDamping = 0.80; // damping van stuursnelheid (realisme)
let brakeFactor = 0.98; // remming door te sturen (carving/bremsen) - veel minder
let alive = true;
let score = 0;
let bonusPoints = 0; // Bonus punten in de pot, alleen toevoegen bij finish

const scoreEl = document.getElementById('score');
const restartBtn = document.getElementById('restart');
if(restartBtn){ 
  restartBtn.addEventListener('click', ()=>{
    showMainMenu();
  }); 
}

// Botsingscontrole met bounding boxes
const playerBox = new THREE.Box3();
const tmpBox = new THREE.Box3();

function checkCollisions(){
  playerBox.setFromObject(player);
  
  // Check collision met bomen
  for(const o of obstacles){
    tmpBox.setFromObject(o);
    if(playerBox.intersectsBox(tmpBox)) return true;
  }
  
  // Check collision met hutten
  for(const child of hutGroup.children){
    tmpBox.setFromObject(child);
    if(playerBox.intersectsBox(tmpBox)) return true;
  }
  
  // Check collision met decoratieve figuren
  for(const d of decoratives){
    tmpBox.setFromObject(d);
    if(playerBox.intersectsBox(tmpBox)) return true;
  }
  
  return false;
}

// Toon bonus score bericht
function showBonusMessage(){
  const bonusMsg = document.getElementById('bonus-message');
  if(bonusMsg && bonusPoints > 0){
    bonusMsg.textContent = 'BONUS: +' + bonusPoints + ' PUNTEN!';
    bonusMsg.style.display = 'block';
    // Verberg na 2 seconden
    setTimeout(() => {
      bonusMsg.style.display = 'none';
    }, 2000);
  }
}

// Touch-besturing: tik linker/rechter helft
addEventListener('pointerdown', (e)=>{
  if(e.clientX < innerWidth/2) keys.left = true;
  else keys.right = true;
});
addEventListener('pointerup', ()=>{ keys.left = false; keys.right = false; });

// Recycle obstakels simpel (verschuif achteraan)
function recycleObstaclesIfNeeded(){
  const recycleBehind = player.position.z - 60; // alles dat ver achter de speler is
  for(const o of obstacles){
    if(o.position.z < recycleBehind){
      // Plaats gerecyclede bomen opnieuw vlak voor de speler
      let validPosition = false;
      let attempts = 0;
      const maxAttempts = 20;
      
      while(!validPosition && attempts < maxAttempts){
        attempts++;
        
        // Genereer nieuwe positie
        const newZ = player.position.z + Math.random() * 480 + 60;
        
        // Check of nieuwe positie in slalom zone ligt
        let inSlalomZone = false;
        for(const zone of slalomZones){
          // Gebruik de exclusie buffers van de zone
          if(newZ >= zone.excludeStart && newZ <= zone.excludeEnd){
            inSlalomZone = true;
            break;
          }
        }
        
        // Spawn positie bepalen: in slalom zones met center gap, anders over hele piste
        let newX;
        if(inSlalomZone){
          // In slalom zone: laat center gap vrij voor vlaggetjes, spawn verder naar buiten
          if (Math.random() < 0.5) {
            // LINKER KANT (van piste rand tot center gap, verder naar buiten)
            newX = -PISTE_HALF_WIDTH + TREE_EDGE_MARGIN + Math.random() * (PISTE_HALF_WIDTH - 20 - TREE_EDGE_MARGIN);
          } else {
            // RECHTER KANT (van center gap tot piste rand, verder naar buiten)
            newX = 20 + Math.random() * (PISTE_HALF_WIDTH - 20 - TREE_EDGE_MARGIN);
          }
        } else {
          // Buiten slalom zone: spawn over hele piste breedte
          newX = -PISTE_HALF_WIDTH + TREE_EDGE_MARGIN + Math.random() * (2 * PISTE_HALF_WIDTH - 2 * TREE_EDGE_MARGIN);
        }
        
        // Altijd plaatsen
        validPosition = true;
        o.position.x = newX;
        o.position.z = newZ;
        
        // Hoogte bijwerken
        const y = 2 - Math.tan(slopeAngle) * o.position.z;
        o.position.y = y + 0.45;
      }
      
      // Als we na veel pogingen geen geldige positie vonden, plaats dan ver buiten beeld
      if(!validPosition){
        o.position.x = (Math.random() < 0.5 ? -1 : 1) * 300; // ver buiten de piste
        o.position.z = player.position.z + Math.random() * 480 + 60;
        const y = 2 - Math.tan(slopeAngle) * o.position.z;
        o.position.y = y + 0.45;
      }
    }
  }
}

// Recycle hutten
function recycleHutsIfNeeded(){
  const recycleBehind = player.position.z - 60;
  for(const hut of hutGroup.children){
    if(hut.position.z < recycleBehind){
      const side = Math.random() < 0.5 ? -1 : 1;
      hut.position.set(side * (70 + Math.random() * 30), 0, player.position.z + 150 + Math.random() * 600);
      const hutY = 2 - Math.tan(slopeAngle) * hut.position.z;
      hut.position.y = hutY;
    }
  }
}

// Recycle decoratieve figuren
function recycleDecorativesIfNeeded(){
  const recycleBehind = player.position.z - 60;
  for(const d of decoratives){
    if(d.position.z < recycleBehind){
      const side = (Math.random() < 0.5 ? -1 : 1) * (18 + Math.random() * 12);
      d.position.z = player.position.z + Math.random() * 360 + 60;
      d.position.x = side;
      const y = 2 - Math.tan(slopeAngle) * d.position.z;
      d.position.y = y + 0.05;
      d.rotation.y = Math.random() * Math.PI * 2;
    }
  }
}

// Snow particle system (visuele polish)
const snowCount = 700;
const snowGeo = new THREE.BufferGeometry();
const positions = new Float32Array(snowCount * 3);
// store stable offsets so we don't re-randomize x/y each frame (avoids jitter/stops)
const snowOffsetX = new Float32Array(snowCount);
const snowOffsetY = new Float32Array(snowCount);
for(let i=0;i<snowCount;i++){
  // maak sneeuwbreder zodat het de bredere piste bedekt (offsets around 0)
  snowOffsetX[i] = (Math.random() - 0.5) * 120; // x offset
  snowOffsetY[i] = -2 + Math.random() * 6; // y offset: blijf binnen beeld (-2 tot +4)
  positions[i*3 + 0] = player.position.x + snowOffsetX[i];
  positions[i*3 + 1] = player.position.y + snowOffsetY[i];
  positions[i*3 + 2] = player.position.z + Math.random() * 200 + 20; // z ahead/near player
}
snowGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
const snowMat = new THREE.PointsMaterial({color:0xffffff, size:0.22, transparent:true, opacity:1.0, depthWrite:false});
const snow = new THREE.Points(snowGeo, snowMat);
snow.frustumCulled = false;
scene.add(snow);

// Crash handling
let crashed = false;
let crashStart = 0;
const crashDur = 1400; // ms

// Best score
function showGameOver(){
  const overlayScore = document.getElementById('overlay-score');
  // Maak overlay zichtbaar via inline style (robuust, ongeacht CSS)
  if(overlay){ overlay.style.display = 'flex'; }
  
  // Update game data
  gameData.totalScore += score;
  if (score > gameData.bestScore) {
    gameData.bestScore = score;
  }
  saveGameData();
  
  // Legacy support
  const bestKey = 'ski_best_score';
  const prevBest = parseInt(localStorage.getItem(bestKey) || '0', 10);
  let best = prevBest;
  if(score > prevBest){
    localStorage.setItem(bestKey, String(score));
    best = score;
  }
  overlayScore.textContent = 'Score: ' + score + '  •  Beste: ' + best;
  restartBtn.style.display = 'inline-block';

  // Automatisch terug naar main menu na korte pauze
  setTimeout(() => {
    showMainMenu();
  }, 180);
}

// Check slalom gates voor bonus punten
function checkSlalomGates(){
  for(const gate of slalomGates){
    // Skip als al bezocht
    if(gate.visited) continue;
    
    const dist = player.position.distanceTo(gate.position);
    const playerZ = player.position.z;
    const gateZ = gate.position.z;
    
    // Check if player passed through gate zone
    if(dist < 12){
      if(gate.gateType === 'startGate'){
        // Start gate - moet erdoorheen gaan
        if(playerZ > gateZ){
          gate.visited = true;
          gate.zoneInfo.startGatePassed = true;
          console.log('Slalom START! Ga nu door alle vlaggen en kom uit bij de EIND poort!');
        }
      } else if(gate.gateType === 'slalom'){
        // Normale slalom gate - check juiste kant
        const playerX = player.position.x;
        const gateX = gate.position.x;
        
        let correctSide = false;
        if(gate.side === 'left' && playerX < 0){
          correctSide = true;
        } else if(gate.side === 'right' && playerX > 0){
          correctSide = true;
        }
        
        if(correctSide && playerZ > gateZ){
          gate.visited = true;
          bonusPoints += 25; // Voeg toe aan bonus pot
          console.log('Gate passed! +25 bonus punten in de pot');
        }
      } else if(gate.gateType === 'endGate'){
        // End gate - moet erdoorheen gaan EN start moet gepasseerd zijn
        if(playerZ > gateZ && gate.zoneInfo.startGatePassed){
          gate.visited = true;
          gate.zoneInfo.endGatePassed = true;
          // Groot bonus voor complete slalom - toevoegen aan bonus pot
          bonusPoints += 200;
          console.log('SLALOM COMPLETE! +200 BONUS PUNTEN in de pot! Totaal bonus: ' + bonusPoints);
          // Toon bonus bericht
          showBonusMessage();
          // Reset bonus pot na toevoegen aan score
          bonusPoints = 0;
          // Reset zone voor next time
          gate.zoneInfo.startGatePassed = false;
        }
      }
    }
  }
}

// Eenvoudige animatie loop (gebruik dt in seconden)
let last = performance.now();
let frameCounter = 0;
let rainbowHue = 0; // Hue voor animatie
function animate(t){
  requestAnimationFrame(animate);
  const now = performance.now();
  const dt = Math.min(0.033, (now - last) / 1000); // Cap at 30ms per frame
  last = now;

  // Rainbow animatie: hue roteren
  if (gameData.equippedSkin === 'rainbow') {
    rainbowHue += dt * 180; // 180 graden per seconde
    if (rainbowHue >= 360) rainbowHue -= 360;
    
    // Update rainbow kleuren op player
    player.traverse((child) => {
      if (child.isMesh && child.material) {
        const isTagged = child.userData && child.userData.skinTarget === true;
        const name = (child.name || '').toLowerCase();
        const isLikelyTarget = name.includes('ski') || name.includes('skis') || name.includes('shirt') || name.includes('jacket') || name.includes('torso');
        if (isTagged || isLikelyTarget) {
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach((mat, idx) => {
            if (mat && mat.color) {
              // Shift hue per mesh zodat ze niet allemaal dezelfde kleur hebben
              const hue = (rainbowHue + (idx * 60)) % 360;
              mat.color.setHSL(hue / 360, 1.0, 0.5);
            }
          });
        }
      }
    });
  }

  // Don't update game physics if in menu
  if (isInMenu || !gameStarted) {
    updateCamera();
    renderer.render(scene, camera);
    return;
  }

  frameCounter++;

  if(alive && !crashed){
    // Realistischere physics: zwaartekracht langs de helling minus wrijving
    // Zwaartekracht compenent langs helling = g * sin(angle)
    const gravityAlongSlope = 9.81 * Math.sin(slopeAngle);
    
    // Sneeuwwrijving is afhankelijk van normale kracht en snelheid
    // Eenvoudige model: friction = friction_coefficient * normal_force
    const friction = (1 - snowFriction) * gravityAlongSlope;
    
    // Acceleratie = gravity - friction (beiden in units/s^2, schaal voor goede acceleratie)
    const netAccel = (gravityAlongSlope - friction) * 0.4; // Tussen-maat: 0.08 → 0.4
    
    // Dynamic maxSpeed: hoe verder je komt, hoe sneller je mag gaan
    // Start bij 50, verhoog naar max 200 over ongeveer 15000 units (langzaam)
    const distanceTraveled = player.position.z - startZ;
    const speedProgression = Math.min(1.0, distanceTraveled / 15000);
    maxSpeed = 50 + (speedProgression * 150); // Loopt op van 50 naar 200 units/s, langzaam
    
    speed = Math.min(maxSpeed, speed + netAccel * dt);
    // Ook air resistance toepassen (snelheid daalt iets zonder acceleratie)
    speed *= Math.pow(airResistance, dt);

    // forward vector aangepast door helling (positieve z = afdaling)
    const forward = new THREE.Vector3(0,0,1).applyAxisAngle(new THREE.Vector3(1,0,0), slopeAngle);
    player.position.addScaledVector(forward, speed * dt);

    // smooth steering via velocity: left should steer negative x, right positive x
    const targetSteer = (keys.left ? 1 : 0) - (keys.right ? 1 : 0);
    steerVelocity += (targetSteer * steerPower - steerVelocity) * Math.min(1, 10 * dt);
    
    // Remming door te sturen: als je scherp stuurt, remt je af (carving-techniek)
    if(targetSteer !== 0){
      const steerIntensity = Math.abs(steerVelocity) / steerPower;
      speed *= Math.pow(brakeFactor, dt * steerIntensity * 2.0);
    }
    
    // Apply damping aan stuursnelheid voor realisme
    steerVelocity *= Math.pow(steerDamping, dt);
    player.position.x += steerVelocity * dt;

    // Draai de speler op basis van stuurrichting (minder schuin)
    const targetRotation = steerVelocity * 0.08; // meer schuin hangen
    const targetYaw = steerVelocity * 0.15; // draai op Y-as (andere kant)
    if(player.rotation) {
      player.rotation.z = THREE.MathUtils.lerp(player.rotation.z || 0, targetRotation, 0.15);
      // Beperk maximale hoek zodat hij niet te veel omvalt
      player.rotation.z = THREE.MathUtils.clamp(player.rotation.z, -0.5, 0.5);
      
      // Draai ook op Y-as voor natuurlijker effect
      player.rotation.y = THREE.MathUtils.lerp(player.rotation.y || 0, targetYaw, 0.12);
      // Beperk Y rotatie zodat hij niet helemaal omgedraaid is
      player.rotation.y = THREE.MathUtils.clamp(player.rotation.y, -0.8, 0.8);
    }

    // begrenzing op basis van piste breedte
    const clampMax = PISTE_HALF_WIDTH - 4;
    player.position.x = THREE.MathUtils.clamp(player.position.x, -clampMax, clampMax);

    // update hoogte volgens helling (approx): start height 2, hoogte daalt met z
    player.position.y = 2 - Math.tan(slopeAngle) * player.position.z;

    // score (afstand vanaf startZ) - baseline score
    const distanceScore = Math.floor(player.position.z - startZ);
    score = distanceScore + bonusPoints;
    
    // Check slalom bonus punten
    checkSlalomGates();
    
    scoreEl.textContent = 'Score: ' + score;

    // recycle all obstacles and props
    recycleObstaclesIfNeeded();
    recycleHutsIfNeeded();
    recycleDecorativesIfNeeded();

    if(checkCollisions()){
      crashed = true;
      crashStart = t;
      // keep alive false so we stop updating normally
      alive = false;
    }
  }

  // crash animation
  if(crashed){
    const elapsed = t - crashStart;
    const p = Math.min(1, elapsed / crashDur);
    // rotate and slide down a bit
    if(player){
      player.rotation.z = p * Math.PI * 1.4;
      // slide sideways and forward small amount
      player.position.x += (steerVelocity * 0.3) * dt;
      const forward = new THREE.Vector3(0,0,1).applyAxisAngle(new THREE.Vector3(1,0,0), slopeAngle);
      player.position.addScaledVector(forward, (speed * 0.25) * dt);
    }
    if(elapsed >= crashDur){
      crashed = false;
      showGameOver();
    }
  }

  // move snow particles relative to player (altijd actief)
  // Only update positions on every frame, but geometry update less often
  const posAttr = snow.geometry.getAttribute('position');
  const array = posAttr.array;
  
  // Always update positions for smooth movement
  for(let i=0;i<snowCount;i++){
    // keep x,y relative to player's position using stable offsets
    array[i*3 + 0] = player.position.x + snowOffsetX[i];
    array[i*3 + 1] = player.position.y + snowOffsetY[i];
    
    let z = array[i*3 + 2];
    // Move particle forward slightly (particle system is slower than player)
    z += speed * dt * 0.6;

    // If particle gets too far ahead or behind, wrap it
    if(z > player.position.z + 140) {
      z = player.position.z - 260 - Math.random() * 60;
    } else if(z < player.position.z - 300){
      z = player.position.z + 140 + Math.random() * 80;
    }

    array[i*3 + 2] = z;
  }
  
  // Mark for update every frame (WebGL needs this)
  posAttr.needsUpdate = true;

  updateCamera();
  renderer.render(scene, camera);
  
  // Debug menu update
  if (debugMenuOpen) {
    const distanceTraveled = Math.max(0, player.position.z - startZ);
    const fps = Math.round(1 / dt);
    document.getElementById('debug-fps').textContent = fps;
    document.getElementById('debug-speed').textContent = speed.toFixed(1);
    document.getElementById('debug-maxspeed').textContent = maxSpeed.toFixed(1);
    document.getElementById('debug-z').textContent = player.position.z.toFixed(1);
    document.getElementById('debug-distance').textContent = distanceTraveled.toFixed(0);
    document.getElementById('debug-score').textContent = score;
    document.getElementById('debug-steer').textContent = steerVelocity.toFixed(2);
    document.getElementById('debug-alive').textContent = alive ? 'true' : 'false';
    document.getElementById('debug-crashed').textContent = crashed ? 'true' : 'false';
  }
}

// Menu System
function updateMenuStats() {
  document.getElementById('total-score').textContent = gameData.totalScore;
  document.getElementById('menu-best-score').textContent = gameData.bestScore;
  document.getElementById('shop-score').textContent = gameData.totalScore;
}

function startGame() {
  document.getElementById('main-menu').classList.add('hidden');
  document.getElementById('ui').classList.remove('hidden');
  document.body.classList.remove('menu-open');
  gameStarted = true;
  isInMenu = false;
  resetGame();
  updatePlayerSkin(gameData.equippedSkin);
}

function showMainMenu() {
  document.getElementById('main-menu').classList.remove('hidden');
  document.getElementById('ui').classList.add('hidden');
  document.getElementById('skin-shop').classList.add('hidden');
  document.body.classList.add('menu-open');
  gameStarted = false;
  isInMenu = true;
  updateMenuStats();
  updateShopUI();
}

// Shop System
function updateShopUI() {
  const grid = document.querySelector('.skins-grid');
  const items = grid.querySelectorAll('.skin-item');
  
  items.forEach(item => {
    const skinId = item.dataset.skin;
    const btn = item.querySelector('.skin-btn');
    const owned = gameData.ownedSkins.includes(skinId);
    const equipped = gameData.equippedSkin === skinId;
    const price = SKIN_DATA[skinId].price;
    const canBuy = gameData.totalScore >= price;
    
    btn.classList.remove('owned', 'equipped');
    btn.disabled = false;
    
    if (equipped) {
      btn.textContent = 'UITGERUST';
      btn.classList.add('equipped');
      btn.disabled = true;
    } else if (owned) {
      btn.textContent = 'UITRUSTEN';
      btn.classList.add('owned');
    } else if (canBuy) {
      btn.textContent = 'KOOP';
    } else {
      btn.textContent = 'TE DUUR';
      btn.disabled = true;
    }
  });
}

function buySkin(skinId) {
  const price = SKIN_DATA[skinId].price;
  
  if (gameData.ownedSkins.includes(skinId)) {
    // Equip
    gameData.equippedSkin = skinId;
    updatePlayerSkin(skinId);
    saveGameData();
    updateShopUI();
  } else if (gameData.totalScore >= price) {
    // Buy
    gameData.totalScore -= price;
    gameData.ownedSkins.push(skinId);
    gameData.equippedSkin = skinId;
    updatePlayerSkin(skinId);
    saveGameData();
    updateMenuStats();
    updateShopUI();
  }
}

// Event Listeners
document.getElementById('start-game').addEventListener('click', startGame);
document.getElementById('open-shop').addEventListener('click', () => {
  document.getElementById('main-menu').classList.add('hidden');
  document.getElementById('skin-shop').classList.remove('hidden');
  updateShopUI();
});
document.getElementById('close-shop').addEventListener('click', () => {
  document.getElementById('skin-shop').classList.add('hidden');
  document.getElementById('main-menu').classList.remove('hidden');
});

// Skin buttons
document.querySelectorAll('.skin-item').forEach(item => {
  const btn = item.querySelector('.skin-btn');
  btn.addEventListener('click', () => {
    buySkin(item.dataset.skin);
  });
});

// Reset game function
function resetGame() {
  player.position.set(0, 2, 0);
  player.rotation.y = 0;
  speed = 45.0;
  steerVelocity = 0;
  alive = true;
  crashed = false;
  score = 0;
  bonusPoints = 0;

  reseedPropsNearPlayer();

  // Ensure equipped skin is applied
  updatePlayerSkin(gameData.equippedSkin);
  
  // Reset slalom gates
  slalomGates.forEach(gate => {
    gate.passed = false;
    if (gate.mesh.material) {
      gate.mesh.material.emissive.setHex(gate.color === 'red' ? 0x330000 : 0x000033);
    }
  });
  
  // Hide overlay
  if (overlay) overlay.style.display = 'none';
}

// Initialize - ensure main menu is shown on load
window.addEventListener('DOMContentLoaded', () => {
  const mainMenu = document.getElementById('main-menu');
  const skinShop = document.getElementById('skin-shop');
  const uiPanel = document.getElementById('ui');
  
  if (mainMenu) mainMenu.classList.remove('hidden');
  if (skinShop) skinShop.classList.add('hidden');
  if (uiPanel) uiPanel.classList.add('hidden');
  
  updateMenuStats();
  document.body.classList.add('menu-open');
});

// Start animation loop (runs in background)
requestAnimationFrame(animate);