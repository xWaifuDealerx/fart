// =================================================================
// house-walls.js — block the player from walking through house walls.
// =================================================================
// Builds AABBs that match the three-floor house geometry and shoves
// the player out if they cross into a wall. Doorway gap on the front
// is left open. House is at HOUSE_POS, footprint 9×9.
// =================================================================
(function(){
  'use strict';
  function whenReady(){
    if(!window.Player || !window.HOUSE_POS){ setTimeout(whenReady, 300); return; }
    init();
  }
  whenReady();

  function init(){
    const Player = window.Player;
    const HOUSE = window.HOUSE_POS;
    const W = 9, D = 9;
    const wallT = 0.3;
    // Door is 3.6m wide centered on the front wall
    const DOOR_W = 3.6;

    // Build wall rectangles (XZ axis-aligned boxes, with min/max).
    // Front wall is split into two pieces around the doorway.
    const frontZ = HOUSE.z - D/2 + 0.15;
    const backZ  = HOUSE.z + D/2 - 0.15;
    const leftX  = HOUSE.x - W/2 + 0.15;
    const rightX = HOUSE.x + W/2 - 0.15;

    const walls = [
      // Front-left wall (from west corner to door-left edge)
      { x0: leftX - wallT/2, x1: HOUSE.x - DOOR_W/2, z0: frontZ - wallT/2, z1: frontZ + wallT/2 },
      // Front-right wall (from door-right edge to east corner)
      { x0: HOUSE.x + DOOR_W/2, x1: rightX + wallT/2, z0: frontZ - wallT/2, z1: frontZ + wallT/2 },
      // Back wall
      { x0: leftX - wallT/2, x1: rightX + wallT/2, z0: backZ - wallT/2, z1: backZ + wallT/2 },
      // Left wall
      { x0: leftX - wallT/2, x1: leftX + wallT/2, z0: frontZ - wallT/2, z1: backZ + wallT/2 },
      // Right wall
      { x0: rightX - wallT/2, x1: rightX + wallT/2, z0: frontZ - wallT/2, z1: backZ + wallT/2 },
    ];

    // Player collision radius (printer body)
    const R = 0.45;

    // Check every animation frame and push the player out of any wall.
    function inWall(x, z, w){
      return x + R > w.x0 && x - R < w.x1 && z + R > w.z0 && z - R < w.z1;
    }
    function clampOutOfWall(){
      // Skip while flying / yachting — those modes manage Player.pos.
      if(Player.boat && (Player.boat.isPlane || Player.boat.isYacht)) return;
      const px = Player.pos.x, pz = Player.pos.z;
      // Only do collision when within the house footprint + 1m
      if(Math.abs(px - HOUSE.x) > W/2 + 2 || Math.abs(pz - HOUSE.z) > D/2 + 2) return;
      for(const w of walls){
        if(inWall(px, pz, w)){
          // Push out along the shallowest axis
          const dxLeft  = (w.x0 - R) - px;       // negative
          const dxRight = (w.x1 + R) - px;       // positive
          const dzFront = (w.z0 - R) - pz;       // negative
          const dzBack  = (w.z1 + R) - pz;       // positive
          const candidates = [
            { d: Math.abs(dxLeft),  ax: 'x', v: dxLeft },
            { d: Math.abs(dxRight), ax: 'x', v: dxRight },
            { d: Math.abs(dzFront), ax: 'z', v: dzFront },
            { d: Math.abs(dzBack),  ax: 'z', v: dzBack },
          ];
          candidates.sort((a, b) => a.d - b.d);
          const best = candidates[0];
          if(best.ax === 'x') Player.pos.x += best.v;
          else                Player.pos.z += best.v;
        }
      }
    }
    function tick(){
      clampOutOfWall();
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    console.log('[house-walls] wall collision active around HOUSE_POS', HOUSE);
  }
})();
