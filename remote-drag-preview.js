var createTokenPreview = function(tokenId, show, x, y, userId) {
  //console.log(tokenId, show, x, y, userId) 
  let t = canvas.tokens.get(tokenId);
  if (!t) return;
  t.border.clear()
  if (t.document.hidden) return;
  t.mesh.alpha = game.settings.get('remote-drag-preview', 'tokenAlpha');
  let c = t.layer.preview.children.find(t=>t.id==tokenId && t._remotePreview);
  if (c) {
    c.border.clear()
    c.document.x = x;
    c.document.y = y;
    if (game.release.generation < 11) {
      c.position.set(x, y);
      c.mesh?.refresh();
    } else {
      c.renderFlags.set({refresh: true});
    }
  } else {
    c = t.clone();
    c.document.x = x;
    c.document.y = y;
    c.draw()
    c.layer.preview.addChild(c);
    c._dragPassthrough=true;
    c.visible = true;
    c._remotePreview = true;
  }
  c.document.alpha = game.settings.get('remote-drag-preview', 'previewAlpha');
  let dx = c.center.x - t.center.x;
  let dy = c.center.y - t.center.y;
  
  
  if (!show && c) return c.destroy();
  
  //for (let p of t.layer.preview.children.filter(t=>t.id==tokenId && t._remotePreview))  p.destroy();
  //if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
  
  if (game.settings.get('remote-drag-preview', 'drawArrow')) {
    //console.log( canvas.grid.children.filter(c => c.name == `${t.id}-line`))
    for (let marker of canvas.grid.children.filter(c => c.name == `${t.id}-line`))
        canvas.grid.removeChild(marker);
    const arrowLength = 30; // how long is the arrow in px.
    const arrowWidth = 15;  // how wide is the arrow in px.
    const width = 10;       // width of the line.
    const alpha = 1;
    const fill = game.users.get(userId).color;
    for (let marker of canvas.grid.children.filter(c => c.name == `${t.id}-line`)) canvas.grid.removeChild(marker);
    const line = new PIXI.Graphics();
    line.lineStyle({
      width,
      alpha, 
      color: fill.replace("#", "0x"),
      join: "round",
      cap: "round"
    });
    line.moveTo(t.center.x, t.center.y);
    let l = Math.sqrt(dx * dx + dy * dy);
    if (l !== 0) {
      let nx = dx/l; 
      let ny = dy/l;  
      let ex = t.center.x + nx * l;
      let ey = t.center.y + ny * l;
      let sx = t.center.x + nx * (l - arrowLength);
      let sy = t.center.y + ny * (l - arrowLength);
      line.lineTo(ex, ey);
      line.moveTo(ex, ey);
      line.lineTo(sx - ny * arrowWidth, sy + nx * arrowWidth);
      line.moveTo(ex, ey);
      line.lineTo(sx + ny * arrowWidth, sy - nx * arrowWidth);
    }
    line.name = `${t.id}-line`;
    line.alpha = 1;
    canvas.grid.addChild(line);
  }
}

Hooks.once("socketlib.ready", () => {
	window.socketForTokenPreviews = socketlib.registerModule("remote-drag-preview");
	window.socketForTokenPreviews.register("createTokenPreview", createTokenPreview);
});

Hooks.on("refreshToken", (token)=>{
  if (token._remotePreview) return;
  if (!token.isPreview) return;
  if (!token.layer.preview.children.find(t=>t.id==token.id)) return;
  if (game.user.isGM && !game.settings.get('remote-drag-preview', 'showGM')) return;
  window.emitTokenPreview(token.id, token.isPreview, token.x, token.y, game.user.id)
});
/*
Hooks.on("updateToken", (token, update, options, user)=>{
  for (let t of token.layer.preview.children.filter(t=>t.id==token.id && t._remotePreview)) t.destroy();
  for (let marker of  canvas.grid.children.filter(c => c.name == `${token.id}-line`)) canvas.grid.removeChild(marker);
});
*/
Hooks.on('preUpdateToken',  (token, update, options) =>{
  if (!game.settings.get('remote-drag-preview', 'disableMoveAnimation')) return true;
  options.animate = false;
});

Hooks.on('destroyToken', (token) =>{
  let ruler = canvas.controls.ruler.toJSON()
  //ruler._state = 0;
  game.user.broadcastActivity({ruler})
  for (let marker of canvas.grid.children.filter(c => c.name == `${token.id}-line`)) canvas.grid.removeChild(marker);
  if (token._remotePreview) return;
  window.emitTokenPreview(token.id, false, token.x, token.y, game.user.id)
  //for (let t of token.layer.preview.children.filter(t=>t.id==token.id && t._remotePreview)) t.destroy();
});


Hooks.on('sightRefresh', () =>{
  let ruler = canvas.controls.ruler.toJSON()
  //ruler._state = 0;
  game.user.broadcastActivity({ruler})
});

Hooks.once("init", async () => {
  
  game.settings.register('remote-drag-preview', 'showGM', {
    name: `Show GM previews`,
    hint: `Show the previews of GM movements to players`,
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    onChange: value => { }
  });
  game.settings.register('remote-drag-preview', 'delay', {
    name: `Update Delay`,
    hint: `How long in milliseconds the drag needs to be stopped before sending the preview`,
    scope: "world",
    config: true,
    type: Number,
    default: 100,
    onChange: value => {
      window.emitTokenPreview = foundry.utils.debounce((tokenId, show, x, y, userId) => {
        window.socketForTokenPreviews.executeForOthers("createTokenPreview", tokenId, show, x, y, userId);
        if (game.modules.get('drag-ruler')?.active) game.user.broadcastActivity({ruler: canvas.controls.ruler.toJSON()})
      }, value);
    }
  });
  game.settings.register('remote-drag-preview', 'previewAlpha', {
    name: `Preview Alpha`,
    hint: `set visibility of the previews`,
    scope: "world",
    config: true,
    type: Number,
    default: 1,
    onChange: value => {}
  });
  game.settings.register('remote-drag-preview', 'tokenAlpha', {
    name: `Token Alpha`,
    hint: `set visibility of the preview's source token`,
    scope: "world",
    config: true,
    type: Number,
    default: 0,
    onChange: value => {}
  });
  game.settings.register('remote-drag-preview', 'drawArrow', {
    name: `Draw Arrow`,
    hint: `Draw an arrow from token to preview`,
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    onChange: value => { }
  });
  game.settings.register('remote-drag-preview', 'disableMoveAnimation', {
    name: `Disable Token Move Animation`,
    hint: `Disables token animationwhen on move`,
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    onChange: value => { }
  });
  window.emitTokenPreview = foundry.utils.debounce((tokenId, show, x, y, userId) => {
    window.socketForTokenPreviews.executeForOthers("createTokenPreview", tokenId, show, x, y, userId);
    if (game.modules.get('drag-ruler')?.active) game.user.broadcastActivity({ruler: canvas.controls.ruler.toJSON()})
  }, game.settings.get('remote-drag-preview', 'delay'));
});



    /*
    let token = canvas.tokens.get(tokenId)
    let center = token.center;
    let destination = {x: x, y: y}
    let ruler = {
      "class": "Ruler",
      "name": canvas.controls.ruler.name,
      "waypoints": [ center ],
      "destination": canvas.grid.type?canvas.grid.getSnappedPosition(destination.x, destination.y):{x:destination.x+token.w/2, y:destination.y+token.h/2} ,
      "_state": 2
    }
    console.log(ruler)
    */
    