(function() {
  'use strict';

  const JourneyMap = {
    config: {
      duration: 3800, 
      messages: [
        { title: 'Sua companhia me alegra.', sub: null },
        { title: 'Mal posso esperar para ver o seu sorriso de perto', sub: null },
        { title: 'Quero criar nossas primeiras memórias logo.', sub: null },
        { title: 'Sinto que este é o início de tudo o que eu sempre quis', sub: null },
        { title: 'Nosso encontro começa aqui', sub: 'Mal posso esperar para te conhecer mais.' }
      ],
      stops: [
        { t: 0 },
        { t: 0.12, msgIndex: 0 },
        { t: 0.36, msgIndex: 1 },
        { t: 0.63, msgIndex: 2 },
        { t: 0.86, msgIndex: 3 },
        { t: 1, msgIndex: 4 }
      ],
      particleCount: 18,
      resizeDebounce: 150,
    },

    dom: {},
    state: {
      pathLength: 0,
      animFrame: null,
      startTime: null,
      playing: false,
      resizeTimer: null,
      currentStop: 0,
    },

    init() {
      if (!document.getElementById('scene')) return;
      
      this.cacheDom();
      this.bindEvents();
      this.prepareScene();
    },

    cacheDom() {
      this.dom.svg = document.getElementById('scene');
      this.dom.path = document.getElementById('track');
      this.dom.highlight = document.getElementById('highlight');
      this.dom.dot = document.getElementById('dot');
      this.dom.glint = document.getElementById('glint');
      this.dom.mapWrap = document.getElementById('mapWrap');
      this.dom.startBtn = document.getElementById('startBtn');
      this.dom.resetBtn = document.getElementById('resetBtn');
      this.dom.hint = document.getElementById('hint');
      this.dom.announce = document.querySelector('.sr-announce');
      this.dom.messageOverlay = document.getElementById('messageOverlay');
      this.dom.messageTitle = document.getElementById('messageTitle');
      this.dom.messageSubtitle = document.getElementById('messageSubtitle');
      this.dom.btnModalClose = document.getElementById('btnModalClose');
    },

    bindEvents() {
      this.dom.startBtn.addEventListener('click', () => this.startJourney());
      this.dom.resetBtn.addEventListener('click', () => this.reset());
      this.dom.svg.addEventListener('click', (e) => this.handleClickOnMap(e));
      this.dom.btnModalClose.addEventListener('click', () => this.hideMessageModal());
      window.addEventListener('resize', () => {
        clearTimeout(this.state.resizeTimer);
        this.state.resizeTimer = setTimeout(() => {
          this.preparePath();
        }, this.config.resizeDebounce);
      });
    },

    prepareScene() {
      this.preparePath();
      this.render(0);
      this.updateUIForStop(0);
    },

    preparePath() {
      this.state.pathLength = this.dom.path.getTotalLength();
      this.dom.highlight.style.strokeDasharray = `0 ${this.state.pathLength + 10}`;
    },

    pointAt(t) {
      const L = this.state.pathLength;
      return this.dom.path.getPointAtLength(Math.max(0, Math.min(L, t * L)));
    },

    startJourney() {
      if (this.state.currentStop !== 0) {
        this.reset();
      }
      this.dom.mapWrap.classList.add('journey-started');
      setTimeout(() => this.advanceToNextStop(), 60);
    },

    advanceToNextStop() {
      if (this.state.playing) return;
      if (this.state.currentStop >= this.config.stops.length - 1) {
        return;
      }

      const t0 = this.config.stops[this.state.currentStop].t;
      this.state.currentStop++;
      const t1 = this.config.stops[this.state.currentStop].t;
      
      const segmentDuration = (t1 - t0) * this.config.duration;
      
      this.animate(t0, t1, Math.max(300, segmentDuration));
    },

    animate(t0, t1, duration) {
      if (this.state.playing) return;
      
      this.state.playing = true;
      this.state.startTime = null;
      this.updateUIForStop(this.state.currentStop);

      const tick = (now) => {
        if (!this.state.playing) return;
        if (!this.state.startTime) this.state.startTime = now;

        const elapsed = now - this.state.startTime;
        const progress = Math.min(1, elapsed / duration);
        const currentT = t0 + (t1 - t0) * progress;

        this.render(currentT);

        if (progress < 1) {
          this.state.animFrame = requestAnimationFrame(tick);
        } else {
          this.state.playing = false;
          this.render(t1);
          this.showMessageModal(); 

          if (t1 === 1) {
            this.burstParticles();
            this.dom.hint.textContent = 'Jornada completa!';
          }
        }
      };
      this.state.animFrame = requestAnimationFrame(tick);
    },

    render(t) {
      const p = this.pointAt(t);
      this.dom.dot.setAttribute('cx', p.x);
      this.dom.dot.setAttribute('cy', p.y);
      this.dom.glint.setAttribute('cx', p.x - 4);
      this.dom.glint.setAttribute('cy', p.y - 4);

      const reveal = t * this.state.pathLength;
      this.dom.highlight.style.strokeDasharray = `${reveal} ${this.state.pathLength - reveal}`;

      const scale = 1 + Math.sin(t * Math.PI * 2) * 0.06;
      this.dom.dot.style.transform = `translate(-50%,-50%) scale(${scale})`;
    },
    
    showMessageModal() {
      const currentStopConfig = this.config.stops[this.state.currentStop];
      if (currentStopConfig && typeof currentStopConfig.msgIndex === 'number') {
        const msgIndex = currentStopConfig.msgIndex;
        const msg = this.config.messages[msgIndex];
        
        this.dom.messageTitle.textContent = msg.title;

        if (msg.sub) {
          this.dom.messageSubtitle.textContent = msg.sub;
          this.dom.messageSubtitle.style.display = 'block';
        } else {
          this.dom.messageSubtitle.textContent = '';
          this.dom.messageSubtitle.style.display = 'none';
        }

        if (msgIndex === this.config.messages.length - 1) {
          this.dom.btnModalClose.textContent = 'Sorrir 😊';
        } else {
          this.dom.btnModalClose.textContent = 'Continuar';
        }
        
        this.dom.messageOverlay.classList.add('show');
        this.dom.messageOverlay.setAttribute('aria-hidden', 'false');
        this.dom.btnModalClose.focus();
        this.announce(msg.title + (msg.sub || ''));
      }
    },

    hideMessageModal() {
      this.dom.messageOverlay.classList.remove('show');
      this.dom.messageOverlay.setAttribute('aria-hidden', 'true');
    },

    reset() {
      if (this.state.animFrame) cancelAnimationFrame(this.state.animFrame);
      this.state.playing = false;
      this.state.currentStop = 0;

      this.preparePath();
      this.render(0);

      this.hideMessageModal();
      this.dom.btnModalClose.textContent = 'Continuar'; 
      this.dom.mapWrap.classList.remove('journey-started');

      this.updateUIForStop(0);
      this.announce('');
    },
    
    handleClickOnMap(e) {
      if (this.state.playing || this.dom.messageOverlay.classList.contains('show')) {
        return;
      }
      
      if (this.state.currentStop === 0) {
        this.startJourney();
      } else {
        this.advanceToNextStop();
      }
    },
    
    updateUIForStop(stopIndex) {
      if (stopIndex === 0) {
        this.dom.hint.textContent = 'Dica: Clique em "Começar" e depois no mapa para avançar.';
        this.dom.startBtn.style.display = 'flex';
        this.dom.resetBtn.style.display = 'flex';
      } else {
        this.dom.hint.textContent = 'Clique no mapa para avançar.';
        this.dom.startBtn.style.display = 'none';
        this.dom.resetBtn.style.display = 'flex';
      }
    },

    burstParticles() {
      const svgPoint = { x: 910, y: 200 };
      const svgCTM = this.dom.svg.getScreenCTM();
      const containerRect = this.dom.mapWrap.getBoundingClientRect();
      if (!svgCTM) return;

      const screenX = svgCTM.a * svgPoint.x + svgCTM.e;
      const screenY = svgCTM.d * svgPoint.y + svgCTM.f;
      const heartPos = {
        x: screenX - containerRect.left,
        y: screenY - containerRect.top
      };

      for (let i = 0; i < this.config.particleCount; i++) {
        const el = document.createElement('div');
        el.className = 'petal';
        el.style.width = el.style.height = `${8 + Math.random() * 14}px`;
        el.style.left = `${heartPos.x + (Math.random() * 60 - 30)}px`;
        el.style.top = `${heartPos.y + (Math.random() * 40 - 20)}px`;
        el.style.background = `radial-gradient(circle at 30% 30%, #fff, rgba(255,150,190,0.9) 28%, rgba(255,120,160,0.9) 88%)`;
        el.style.position = 'absolute';
        el.style.pointerEvents = 'none';
        el.style.transform = `translate(-50%,-50%)`;
        el.style.zIndex = 40;
        this.dom.mapWrap.appendChild(el);

        const ang = (Math.PI * 2) * Math.random();
        const dist = 60 + Math.random() * 120;
        const dx = Math.cos(ang) * dist;
        const dy = Math.sin(ang) * dist - 20;

        el.animate([
          { transform: `translate(-50%,-50%) translate(0px,0px) scale(1)`, opacity: 1 },
          { transform: `translate(-50%,-50%) translate(${dx}px, ${dy}px) scale(0.6)`, opacity: 0.05 }
        ], {
          duration: 900 + Math.random() * 700,
          easing: 'cubic-bezier(.2,.9,.25,1)'
        }).onfinish = () => el.remove();
      }
    },
    
    announce(text) {
      if (this.dom.announce) {
        this.dom.announce.textContent = text;
      }
    },
  };

  document.addEventListener('DOMContentLoaded', () => JourneyMap.init());

})();

