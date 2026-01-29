3D Ski Game (eenvoudige demo)

Dit is een kleine HTML + Three.js demo van een 3D ski-achtige game.

Run: open `index.html` in een browser of start een kleine HTTP-server:

```bash
# Python 3
python -m http.server 8000
# ga naar http://localhost:8000
```

Controls:
- Pijl-links / Pijl-rechts: stuur

Opmerkingen:
- De game gebruikt een simpele box als speler en conussen als obstakels.
- Voor betere physics en modellen kun je later Three.js loaders en een physics engine toevoegen.

GLTF speler model
------------------
Je kunt een `glb`/`gltf` model plaatsen in `assets/models/skier.glb` om de rode box te vervangen.
Als het bestand niet aanwezig is laadt het spel automatisch de fallback-box.

Bronnen voor gratis 3D-modellen: zoek naar "glb" of "gltf" op websites zoals Sketchfab (let op licentie).

Wat is er nieuw
----------------
- Crash-animatie en Game Over overlay met beste score-opslag (localStorage).
- Sneeuw-deeltjes voor visuele polish.

Run (lokaal)
-----------
Open `index.html` in een moderne browser of start een eenvoudige server:

```bash
# Python 3
python -m http.server 8000
# ga naar http://localhost:8000
```

Mobiel
------
De demo ondersteunt touch: tik aan de linker of rechterkant van het scherm om te sturen.
