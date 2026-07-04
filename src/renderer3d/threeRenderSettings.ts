// Render settings + debug panel (SPEC T12, V11). Controls live here,
// isolated from renderer logic: the panel only mutates a RenderSettings
// object and fires onChange — ThreeFightRenderer decides what that means.
export interface RenderSettings {
  resolutionScale: number;
  shadowMapSize: number;
  aoEnabled: boolean;
  bloomEnabled: boolean;
  bloomStrength: number;
  exposure: number;
  keyIntensity: number;
  fillIntensity: number;
  rimIntensity: number;
  cameraPreset: 'default' | 'low' | 'high' | 'ortho';
  hitboxes: boolean;
  skeleton: boolean;
}

export const DEFAULT_SETTINGS: RenderSettings = {
  resolutionScale: 1,
  shadowMapSize: 2048,
  aoEnabled: true,
  bloomEnabled: true, // night scene: lamp glow + magic projectiles want it (V8: watch fps)
  bloomStrength: 0.35,
  exposure: 1.02, // dark-ish base; lamps/neon carry, fighters stay readable
  keyIntensity: 0.6,
  fillIntensity: 0.3,
  rimIntensity: 1.5, // black outfits vs dark walls — rim does the separating
  cameraPreset: 'default',
  hitboxes: false,
  skeleton: false,
};

interface PanelHandle {
  el: HTMLElement;
  setFps(fps: number, frameMs: number): void;
}

export function createSettingsPanel(
  host: HTMLElement,
  settings: RenderSettings,
  onChange: (s: RenderSettings) => void,
): PanelHandle {
  const el = document.createElement('div');
  el.style.cssText =
    'position:absolute;top:8px;right:8px;width:230px;padding:10px;z-index:5;' +
    'background:rgba(12,14,20,.88);color:#dfe3ee;font:11px monospace;' +
    'border:1px solid #333a4d;border-radius:4px;display:none;';

  const fps = document.createElement('div');
  fps.style.cssText = 'margin-bottom:6px;color:#9fe08a;';
  fps.textContent = 'fps: —';
  el.appendChild(fps);

  const row = (label: string, input: HTMLElement): void => {
    const r = document.createElement('label');
    r.style.cssText = 'display:flex;justify-content:space-between;gap:6px;margin:3px 0;align-items:center;';
    const span = document.createElement('span');
    span.textContent = label;
    r.append(span, input);
    el.appendChild(r);
  };

  const slider = (label: string, key: keyof RenderSettings, min: number, max: number, step: number): void => {
    const i = document.createElement('input');
    i.type = 'range';
    i.min = String(min);
    i.max = String(max);
    i.step = String(step);
    i.value = String(settings[key]);
    i.style.width = '110px';
    i.oninput = () => {
      (settings[key] as number) = Number(i.value);
      onChange(settings);
    };
    row(label, i);
  };

  const check = (label: string, key: keyof RenderSettings): void => {
    const i = document.createElement('input');
    i.type = 'checkbox';
    i.checked = settings[key] as boolean;
    i.onchange = () => {
      (settings[key] as boolean) = i.checked;
      onChange(settings);
    };
    row(label, i);
  };

  const select = (label: string, key: keyof RenderSettings, values: string[]): void => {
    const s = document.createElement('select');
    for (const v of values) {
      const o = document.createElement('option');
      o.value = v;
      o.textContent = v;
      s.appendChild(o);
    }
    s.value = String(settings[key]);
    const numeric = typeof settings[key] === 'number';
    s.onchange = () => {
      (settings[key] as unknown) = numeric ? Number(s.value) : s.value;
      onChange(settings);
    };
    row(label, s);
  };

  slider('res scale', 'resolutionScale', 0.5, 2, 0.25);
  select('shadows', 'shadowMapSize', ['1024', '2048', '4096']);
  check('AO', 'aoEnabled');
  check('bloom', 'bloomEnabled');
  slider('bloom str', 'bloomStrength', 0, 1.5, 0.05);
  slider('exposure', 'exposure', 0.4, 2.5, 0.05);
  slider('key light', 'keyIntensity', 0, 8, 0.1);
  slider('fill light', 'fillIntensity', 0, 5, 0.1);
  slider('rim light', 'rimIntensity', 0, 8, 0.1);
  select('camera', 'cameraPreset', ['default', 'low', 'high', 'ortho']);
  check('hitboxes', 'hitboxes');
  check('skeleton', 'skeleton');

  host.appendChild(el);
  return {
    el,
    setFps: (v, ms) => {
      fps.textContent = `fps: ${v.toFixed(0)}  frame: ${ms.toFixed(1)}ms`;
    },
  };
}
