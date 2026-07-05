// Center-stage fight announcements (READY? 3-2-1 FIGHT!, K.O., FINISH THEM,
// PERFECT, FATALITY) — big, animated, dead center like a proper fighting
// game, replacing the small label that hid between the health bars.
// Pure DOM/CSS: the scene calls set(text, variant) per frame; the banner
// only re-animates when the message actually changes.
export type BannerVariant = 'pop' | 'count' | 'slam' | 'pulse' | 'shine';

const STYLE_ID = 'mk3d-banner-style';

const CSS = `
.mk3d-banner {
  position: absolute;
  left: 50%;
  top: 34%;
  transform: translate(-50%, -50%);
  pointer-events: none;
  z-index: 2;
  font-family: "Arial Black", Impact, "Helvetica Neue", sans-serif;
  font-weight: 900;
  letter-spacing: 0.06em;
  text-align: center;
  white-space: nowrap;
  opacity: 0;
}
.mk3d-banner span { display: inline-block; }
.mk3d-pop span {
  font-size: 64px;
  color: #f4ead0;
  -webkit-text-stroke: 2px #1a1208;
  text-shadow: 0 4px 0 #1a1208, 0 6px 18px rgba(0,0,0,.6);
  animation: mk3dPop .5s cubic-bezier(.2,1.6,.4,1) forwards;
}
.mk3d-count span {
  font-size: 120px;
  color: #ffd75e;
  -webkit-text-stroke: 3px #40260a;
  text-shadow: 0 6px 0 #40260a, 0 10px 26px rgba(0,0,0,.7);
  animation: mk3dCount 1s ease-out forwards;
}
.mk3d-slam span {
  font-size: 96px;
  color: #ff4b2e;
  -webkit-text-stroke: 3px #2a0705;
  text-shadow: 0 5px 0 #2a0705, 0 0 34px rgba(255,75,46,.55), 0 10px 30px rgba(0,0,0,.7);
  animation: mk3dSlam 1.5s cubic-bezier(.15,1.4,.3,1) forwards;
}
.mk3d-pulse span {
  font-size: 72px;
  color: #ff5e4a;
  -webkit-text-stroke: 2px #2a0705;
  text-shadow: 0 4px 0 #2a0705, 0 0 30px rgba(255,94,74,.5);
  animation: mk3dPulse 0.9s ease-in-out infinite;
}
.mk3d-shine span {
  font-size: 84px;
  color: #ffe98a;
  -webkit-text-stroke: 2px #4a3208;
  text-shadow: 0 4px 0 #4a3208, 0 0 40px rgba(255,233,138,.8);
  animation: mk3dShine 1.8s ease-out forwards;
}
.mk3d-banner.mk3d-show { opacity: 1; }
@keyframes mk3dPop {
  0% { transform: scale(2.4); opacity: 0; }
  55% { transform: scale(0.94); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes mk3dCount {
  0% { transform: scale(2.8); opacity: 0; }
  25% { transform: scale(1); opacity: 1; }
  75% { transform: scale(1); opacity: 1; }
  100% { transform: scale(0.7); opacity: 0; }
}
@keyframes mk3dSlam {
  0% { transform: scale(3.6) rotate(-5deg); opacity: 0; }
  35% { transform: scale(1) rotate(0deg); opacity: 1; }
  70% { transform: scale(1.05); opacity: 1; }
  100% { transform: scale(1); opacity: 0; }
}
@keyframes mk3dPulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}
@keyframes mk3dShine {
  0% { transform: scale(0.4); opacity: 0; }
  30% { transform: scale(1.15); opacity: 1; }
  55% { transform: scale(1); opacity: 1; }
  100% { transform: scale(1); opacity: 0; }
}
`;

export class AnnouncerBanner {
  private el: HTMLDivElement;
  private span: HTMLSpanElement;
  private lastKey = '';

  constructor(host: HTMLElement, anchor: HTMLElement) {
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = CSS;
      document.head.appendChild(style);
    }
    this.el = document.createElement('div');
    this.el.className = 'mk3d-banner';
    this.span = document.createElement('span');
    this.el.appendChild(this.span);
    // pin over the game canvas like the HUD root
    const a = anchor.style;
    const wrap = document.createElement('div');
    wrap.style.cssText = `position:absolute;left:${a.left};top:${a.top};width:${a.width};height:${a.height};pointer-events:none;overflow:hidden;`;
    wrap.appendChild(this.el);
    host.appendChild(wrap);
    this.wrap = wrap;
  }

  private wrap: HTMLDivElement;

  /** idempotent per frame — re-animates only when the message changes */
  set(text: string, variant: BannerVariant = 'pop'): void {
    const key = text ? `${variant}:${text}` : '';
    if (key === this.lastKey) return;
    this.lastKey = key;
    if (!text) {
      this.el.classList.remove('mk3d-show');
      return;
    }
    this.span.textContent = text;
    this.el.className = `mk3d-banner mk3d-${variant}`;
    // restart the CSS animation even for same-variant changes (3 -> 2 -> 1)
    const span = this.span;
    span.style.animation = 'none';
    void span.offsetWidth;
    span.style.animation = '';
    this.el.classList.add('mk3d-show');
  }

  dispose(): void {
    this.wrap.remove();
  }
}
