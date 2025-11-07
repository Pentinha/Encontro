(function(){
  const svg = document.getElementById('scene');
  const path = document.getElementById('track');
  const highlight = document.getElementById('highlight');
  const dot = document.getElementById('dot');
  const glint = document.getElementById('glint');
  const overlay = document.getElementById('overlay');
  const finalHeart = document.getElementById('finalHeart');
  const startBtn = document.getElementById('startBtn');
  const resetBtn = document.getElementById('resetBtn');
  const btnOk = document.getElementById('btnOk');
  const btnHide = document.getElementById('btnHide');
  const mapWrap = document.getElementById('mapWrap');

  const messages = [
    { el: document.getElementById('msg1'), t: 0.12 },
    { el: document.getElementById('msg2'), t: 0.36 },
    { el: document.getElementById('msg3'), t: 0.63 },
    { el: document.getElementById('msg4'), t: 0.86 },
  ];

  function preparePath(){
    const L = path.getTotalLength();
    highlight.style.strokeDasharray = `${0} ${L+10}`;
  }
  preparePath();
  window.addEventListener('resize', preparePath);

  function pointAt(t){
    const L = path.getTotalLength();
    const p = path.getPointAtLength(Math.max(0, Math.min(L, t * L)));
    return p;
  }

  function positionMessages(){
    if(!svg || !mapWrap) return;
    const svgCTM = svg.getScreenCTM();
    const containerRect = mapWrap.getBoundingClientRect();

    messages.forEach(m=>{
      const p = pointAt(m.t);

      let screenX = 0, screenY = 0;
      if(svgCTM){
        screenX = svgCTM.a * p.x + svgCTM.e;
        screenY = svgCTM.d * p.y + svgCTM.f;
      } else {
        const svgRect = svg.getBoundingClientRect();
        const vb = svg.viewBox.baseVal;
        const scaleX = svgRect.width / vb.width;
        const scaleY = svgRect.height / vb.height;
        screenX = svgRect.left + p.x * scaleX;
        screenY = svgRect.top + p.y * scaleY;
      }

      const localX = screenX - containerRect.left;
      const localY = screenY - containerRect.top;
      const clampX = Math.max(8, Math.min(containerRect.width - 8, localX));
      const clampY = Math.max(8, Math.min(containerRect.height - 8, localY));

      m.el.style.left = clampX + 'px';
      m.el.style.top = clampY + 'px';
    });
  }

  positionMessages();
  window.addEventListener('resize', positionMessages);
  window.addEventListener('scroll', positionMessages);

  let anim = null;
  let duration = 3800; 
  let startTime = null;
  let playing = false;

  function animateStart(from = 0){
    if(playing) return;
    const L = path.getTotalLength();
    const highlightLen = L;
    startTime = performance.now();
    playing = true;

    function tick(now){
      if(!playing) return;
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration); 
      const p = path.getPointAtLength(t * L);
      dot.setAttribute('cx', p.x);
      dot.setAttribute('cy', p.y);
      glint.setAttribute('cx', p.x - 4);
      glint.setAttribute('cy', p.y - 4);

      const reveal = t * highlightLen;
      highlight.style.strokeDasharray = `${reveal} ${highlightLen - reveal}`;

      messages.forEach(m=>{
        if(t >= m.t - 0.05){ 
          m.el.classList.add('show');
        }
      });

      const scale = 1 + Math.sin(t * Math.PI * 2) * 0.06;
      dot.style.transform = `translate(-50%,-50%) scale(${scale})`;

      if(t < 1){
        if((now - startTime) % 200 < 16) positionMessages();
        anim = requestAnimationFrame(tick);
      } else {
        playing = false;
        positionMessages();
        revealFinal();
      }
    }
    anim = requestAnimationFrame(tick);
  }

  function revealFinal(){
    overlay.classList.add('show');
    overlay.setAttribute('aria-hidden', 'false');
    finalHeart.classList.add('pulse');
    burstParticles();
  }

  function resetAll(){
    if(anim) cancelAnimationFrame(anim);
    playing = false;

    preparePath();
    const p0 = path.getPointAtLength(0);
    dot.setAttribute('cx', p0.x);
    dot.setAttribute('cy', p0.y);
    glint.setAttribute('cx', p0.x - 4);
    glint.setAttribute('cy', p0.y - 4);

    messages.forEach(m=> m.el.classList.remove('show'));
    overlay.classList.remove('show');
    overlay.setAttribute('aria-hidden', 'true');
    finalHeart.classList.remove('pulse');
    positionMessages();
  }

  function burstParticles(){
    const count = 18;
    const svgPoint = { x: 910, y: 200 };
    
    if(!svg || !mapWrap) return;
    
    const svgCTM = svg.getScreenCTM();
    const containerRect = mapWrap.getBoundingClientRect();
    
    let screenX = 0, screenY = 0;
    if(svgCTM){
      screenX = svgCTM.a * svgPoint.x + svgCTM.e;
      screenY = svgCTM.d * svgPoint.y + svgCTM.f;
    } else {
      const svgRect = svg.getBoundingClientRect();
      const vb = svg.viewBox.baseVal;
      const scaleX = svgRect.width / vb.width;
      const scaleY = svgRect.height / vb.height;
      screenX = svgRect.left + svgPoint.x * scaleX;
      screenY = svgRect.top + svgPoint.y * scaleY;
    }

    const heartPos = {
      x: screenX - containerRect.left,
      y: screenY - containerRect.top
    };

    for(let i=0;i<count;i++){
      const el = document.createElement('div');
      el.className = 'petal';
      el.innerHTML = '';
      el.style.width = el.style.height = `${8 + Math.random()*14}px`;
      el.style.left = `${heartPos.x + (Math.random()*60-30)}px`;
      el.style.top = `${heartPos.y + (Math.random()*40-20)}px`;
      el.style.opacity = 0.9;
      el.style.borderRadius = '50%';
      el.style.background = `radial-gradient(circle at 30% 30%, #fff, rgba(255,150,190,0.9) 28%, rgba(255,120,160,0.9) 88%)`;
      el.style.position = 'absolute';
      el.style.pointerEvents = 'none';
      el.style.transform = `translate(-50%,-50%)`;
      el.style.zIndex = 40;
      mapWrap.appendChild(el);

      const ang = (Math.PI*2) * Math.random();
      const dist = 60 + Math.random()*120;
      const dx = Math.cos(ang) * dist;
      const dy = Math.sin(ang) * dist - 20;
      el.animate([
        { transform: `translate(-50%,-50%) translate(0px,0px) scale(1)`, opacity:1 },
        { transform: `translate(-50%,-50%) translate(${dx}px, ${dy}px) scale(0.6)`, opacity:0.05 }
      ], {
        duration: 900 + Math.random()*700,
        easing: 'cubic-bezier(.2,.9,.25,1)'
      }).onfinish = ()=> el.remove();
    }
  }

  startBtn.addEventListener('click', ()=> {
    resetAll();
    setTimeout(()=> animateStart(0), 60);
  });

  resetBtn.addEventListener('click', ()=> resetAll());

  svg.addEventListener('click', (e)=>{
    if(playing) return;
    resetAll();
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const loc = pt.matrixTransform(svg.getScreenCTM().inverse());
    const L = path.getTotalLength();
    let best = 0, bestd=Infinity;
    const samples = 120;
    for(let i=0;i<=samples;i++){
      const p = path.getPointAtLength((i/samples) * L);
      const dx = p.x - loc.x, dy = p.y - loc.y;
      const d = dx*dx + dy*dy;
      if(d < bestd){ bestd = d; best = i/samples; }
    }
    const startP = pointAt(best);
    dot.setAttribute('cx', startP.x);
    dot.setAttribute('cy', startP.y);
    glint.setAttribute('cx', startP.x - 4);
    glint.setAttribute('cy', startP.y - 4);

    const remainingFrac = 1 - best;
    const customDuration = Math.max(1000, duration * remainingFrac);
    animateFromFraction(best, customDuration);
  });

  function animateFromFraction(fracStart, customDuration){
    if(playing) return;
    const L = path.getTotalLength();
    const highlightLen = L;
    startTime = performance.now();
    playing = true;
    const t0 = fracStart;
    const dur = customDuration;

    function tick(now){
      if(!playing) return;
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / dur); 
      const t = t0 + (1 - t0) * progress;
      const p = path.getPointAtLength(t * L);
      dot.setAttribute('cx', p.x);
      dot.setAttribute('cy', p.y);
      glint.setAttribute('cx', p.x - 4);
      glint.setAttribute('cy', p.y - 4);

      const reveal = t * highlightLen;
      highlight.style.strokeDasharray = `${reveal} ${highlightLen - reveal}`;

      messages.forEach(m=>{
        if(t >= m.t - 0.05){ m.el.classList.add('show'); }
      });

      const scale = 1 + Math.sin(progress * Math.PI * 2) * 0.06;
      dot.style.transform = `translate(-50%,-50%) scale(${scale})`;

      if(progress < 1){
        if((now - startTime) % 200 < 16) positionMessages();
        anim = requestAnimationFrame(tick);
      } else {
        playing = false;
        positionMessages();
        revealFinal();
      }
    }
    anim = requestAnimationFrame(tick);
  }

  btnOk.addEventListener('click', ()=> {
    finalHeart.classList.remove('pulse');
    finalHeart.style.transform = 'scale(1.05)';
    setTimeout(()=> overlay.classList.remove('show'), 600);
  });
  btnHide.addEventListener('click', ()=> overlay.classList.remove('show'));

  (function init(){
    const p0 = path.getPointAtLength(0);
    dot.setAttribute('cx', p0.x);
    dot.setAttribute('cy', p0.y);
    glint.setAttribute('cx', p0.x - 4);
    glint.setAttribute('cy', p0.y - 4);
    setTimeout(positionMessages, 80);
  })();

})();