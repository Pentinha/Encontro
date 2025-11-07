(function() {
  'use strict';

  const JourneyMap = {
    config: {
      duration: 3800, // Duração total para percorrer o caminho de 0 a 1
      messages: [
        { id: 'msg1', t: 0.12 },
        { id: 'msg2', t: 0.36 },
        { id: 'msg3', t: 0.63 },
        { id: 'msg4', t: 0.86 },
      ],
      // Pontos de parada: 0 (início), 4 mensagens, 1 (fim)
      stops: [
        { t: 0 },
        { t: 0.12, msgId: 'msg1' },
        { t: 0.36, msgId: 'msg2' },
        { t: 0.63, msgId: 'msg3' },
        { t: 0.86, msgId: 'msg4' },
        { t: 1 }
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
      this.dom.overlay = document.getElementById('overlay');
      this.dom.finalHeart = document.getElementById('finalHeart');
      this.dom.startBtn = document.getElementById('startBtn');
      this.dom.resetBtn = document.getElementById('resetBtn');
      this.dom.btnOk = document.getElementById('btnOk');
      this.dom.btnHide = document.getElementById('btnHide');
      this.dom.mapWrap = document.getElementById('mapWrap');
      this.dom.dialogTitle = document.getElementById('dialogTitle');
      this.dom.announce = document.querySelector('.sr-announce');
      this.dom.bubbleDesc = document.getElementById('bubbleDesc');
      this.dom.hint = document.getElementById('hint');
      this.dom.footer = document.querySelector('footer');
      
      this.config.messages = this.config.messages.map(msg => ({
        ...msg,
        el: document.getElementById(msg.id),
        shown: false,
      }));
    },

    bindEvents() {
      this.dom.startBtn.addEventListener('click', () => {
        this.reset();
        setTimeout(() => this.advanceToNextStop(), 60);
      });

      this.dom.resetBtn.addEventListener('click', () => this.reset());
      this.dom.btnOk.addEventListener('click', () => this.hideFinal());
      this.dom.btnHide.addEventListener('click', () => this.hideFinal(true));

      this.dom.svg.addEventListener('click', (e) => this.handleClickOnMap(e));

      window.addEventListener('resize', () => {
        clearTimeout(this.state.resizeTimer);
        this.state.resizeTimer = setTimeout(() => {
          this.preparePath();
          this.positionMessages();
        }, this.config.resizeDebounce);
      });
    },

    prepareScene() {
      this.preparePath();
      this.render(0);
      this.updateUIForStop(0);
      setTimeout(() => this.positionMessages(), 80);
    },

    preparePath() {
      this.state.pathLength = this.dom.path.getTotalLength();
      this.dom.highlight.style.strokeDasharray = `0 ${this.state.pathLength + 10}`;
    },

    pointAt(t) {
      const L = this.state.pathLength;
      return this.dom.path.getPointAtLength(Math.max(0, Math.min(L, t * L)));
    },

    positionMessages() {
      if (!this.dom.svg || !this.dom.mapWrap) return;
      const svgCTM = this.dom.svg.getScreenCTM();
      const containerRect = this.dom.mapWrap.getBoundingClientRect();
      if (!svgCTM) return;

      this.config.messages.forEach(m => {
        const p = this.pointAt(m.t);
        
        const screenX = svgCTM.a * p.x + svgCTM.e;
        const screenY = svgCTM.d * p.y + svgCTM.f;

        const localX = screenX - containerRect.left;
        const localY = screenY - containerRect.top;
        const clampX = Math.max(8, Math.min(containerRect.width - 8, localX));
        const clampY = Math.max(8, Math.min(containerRect.height - 8, localY));

        m.el.style.left = `${clampX}px`;
        m.el.style.top = `${clampY}px`;
      });
    },

    advanceToNextStop() {
      if (this.state.playing) return;
      if (this.state.currentStop >= this.config.stops.length - 1) {
        return;
      }

      const t0 = this.config.stops[this.state.currentStop].t;
      this.state.currentStop++;
      const t1 = this.config.stops[this.state.currentStop].t;
      
      // Calcula a duração deste segmento baseado na sua fração do total
      const segmentDuration = (t1 - t0) * this.config.duration;
      
      this.animate(t0, t1, Math.max(300, segmentDuration)); // Garante uma duração mínima
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
          this.render(t1); // Garante a posição final exata
          this.showCurrentMessage();
          if (t1 === 1) {
            this.revealFinal();
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
      
      // Oculta mensagens que estão "para trás"
      this.config.messages.forEach(m => {
        if (t < m.t - 0.05) {
           m.el.classList.remove('show');
           m.shown = false;
        }
      });

      const scale = 1 + Math.sin(t * Math.PI * 2) * 0.06;
      this.dom.dot.style.transform = `translate(-50%,-50%) scale(${scale})`;
    },
    
    showCurrentMessage() {
      const currentStopConfig = this.config.stops[this.state.currentStop];
      if (currentStopConfig && currentStopConfig.msgId) {
        const msgConfig = this.config.messages.find(m => m.id === currentStopConfig.msgId);
        if (msgConfig && !msgConfig.shown) {
          msgConfig.el.classList.add('show');
          msgConfig.shown = true;
          this.announce(msgConfig.el.textContent);
        }
      }
    },

    reset() {
      if (this.state.animFrame) cancelAnimationFrame(this.state.animFrame);
      this.state.playing = false;
      this.state.currentStop = 0;

      this.preparePath();
      this.render(0);

      this.config.messages.forEach(m => {
        m.el.classList.remove('show');
        m.shown = false;
      });
      this.dom.overlay.classList.remove('show');
      this.dom.overlay.setAttribute('aria-hidden', 'true');
      this.dom.finalHeart.classList.remove('pulse');
      this.updateUIForStop(0);
      this.announce('');
    },

    revealFinal() {
      this.dom.overlay.classList.add('show');
      this.dom.overlay.setAttribute('aria-hidden', 'false');
      this.dom.finalHeart.classList.add('pulse');
      this.burstParticles();
      this.announce(this.dom.dialogTitle.textContent);
      
      this.dom.hint.textContent = 'Jornada completa!';
    },

    hideFinal(immediate = false) {
      this.dom.finalHeart.classList.remove('pulse');
      if (!immediate) {
        this.dom.finalHeart.style.transform = 'scale(1.05)';
        setTimeout(() => {
          this.dom.overlay.classList.remove('show');
          this.dom.overlay.setAttribute('aria-hidden', 'true');
          this.dom.finalHeart.style.transform = 'scale(1)';
        }, 600);
      } else {
        this.dom.overlay.classList.remove('show');
        this.dom.overlay.setAttribute('aria-hidden', 'true');
      }
    },
    
    handleClickOnMap(e) {
      if (this.state.playing) return;
      // Em vez de calcular o ponto mais próximo, apenas avançamos para a próxima parada
      this.advanceToNextStop();
    },
    
    updateUIForStop(stopIndex) {
      if (stopIndex === 0) {
        this.dom.bubbleDesc.textContent = 'Clique em "Começar" e depois clique no mapa para avançar por cada etapa da jornada.';
        this.dom.hint.textContent = 'Dica: Clique em começar a jornada você vai gostar.';
        this.dom.footer.textContent = 'Toque/click no mapa para iniciar também.';
        this.dom.startBtn.style.display = 'flex';
        this.dom.resetBtn.style.display = 'flex';
      } else {
        this.dom.bubbleDesc.textContent = 'Clique no mapa para continuar a jornada e revelar a próxima mensagem.';
        this.dom.hint.textContent = 'Clique no mapa para avançar.';
        this.dom.footer.textContent = 'Toque/click no mapa para avançar.';
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
