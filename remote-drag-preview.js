var createTokenPreview = function(tokenId, show, x, y, userId) {
  //console.log("createTokenPreview", tokenId, show, x, y, userId)

  let t = canvas.tokens.get(tokenId);
  if (!t) return;
  if (t.document.hidden) return;
  let c = t.clone();
  c.document.x = x;
  c.document.y = y;
  c.document.alpha = .4;
  let dx = c.center.x - t.center.x;
  let dy = c.center.y - t.center.y;
  for (let p of t.layer.preview.children.filter(t=>t.id==tokenId && t._remotePreview))  p.destroy();
  if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
  if (!show) return;
  c.draw()//.then(c => {
    //console.log(c)
  c.layer.preview.addChild(c);
  c._dragPassthrough=true;
  c.visible = true;
  c._remotePreview = true;
  if (!game.settings.get('remote-drag-preview', 'drawArrow')) return;
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
  //console.log(canvas.grid.children)
    
    canvas.grid.addChild(line);
    //});
}

Hooks.once("socketlib.ready", () => {
	window.socketForTokenPreviews = socketlib.registerModule("remote-drag-preview");
	window.socketForTokenPreviews.register("createTokenPreview", createTokenPreview);
});

Hooks.on("refreshToken", (token)=>{
  if (token._remotePreview) return;
  if (token._animation || token.isPreview) 
    for (let marker of canvas.grid.children.filter(c => c.name == `${token.id}-line`))
        canvas.grid.removeChild(marker);
  
  if (!token.layer.preview.children.find(t=>t.id==token.id)) return;
  if (game.user.isGM && !game.settings.get('remote-drag-preview', 'showGM')) return;
  window.emitTokenPreview(token.id, token.isPreview, token.x, token.y, game.user.id)
});

Hooks.on("updateToken", (token)=>{
  for (let t of token.layer.preview.children.filter(t=>t.id==token.id && t._remotePreview)) t.destroy();
  for (let marker of  canvas.grid.children.filter(c => c.name == `${token.id}-line`)) canvas.grid.removeChild(marker);
});

Hooks.on('preUpdateToken',  (token, update, options) =>{
  if (!game.settings.get('remote-drag-preview', 'disableMoveAnimation')) return;
  options.animate = false;
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
      }, value);
    }
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
  }, game.settings.get('remote-drag-preview', 'delay'));
});