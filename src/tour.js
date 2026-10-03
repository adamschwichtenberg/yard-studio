/*
 * A guided tour: a coach card that walks through steps, a ring around the
 * control each step is about, and one-off tips when you open a panel while
 * the tour is on. The page stays fully usable underneath: steps move on by
 * themselves when you do the thing they ask (or with Next).
 *
 * step: { title, body (html), target: selector | () => Element, done?: () => bool,
 *         enter?: () => void, part: label shown above the title, next?: label }
 */
export class Tour {
  constructor({ steps, onEnd }) {
    this.steps = steps;
    this.onEnd = onEnd || (() => {});
    this.i = -1;
    this.seen = new Set();
    this.timer = 0;
    this.#build();
  }
  get active() { return this.i >= 0; }

  start(at = 0) {
    this.seen.clear();
    this.#go(at);
    clearInterval(this.timer);
    this.timer = setInterval(() => this.#poll(), 300);
    window.addEventListener('resize', this.onResize = () => this.#place());
  }
  end(finished = false) {
    if (!this.active) return;
    this.i = -1;
    clearInterval(this.timer);
    window.removeEventListener('resize', this.onResize);
    this.card.hidden = true;
    this.ring.hidden = true;
    this.hideTip();
    this.onEnd(finished);
  }
  next() { this.i + 1 < this.steps.length ? this.#go(this.i + 1) : this.end(true); }
  back() { if (this.i > 0) this.#go(this.i - 1); }

  /** A one-off pointer to something on screen, shown only while the tour runs. */
  tip(key, target, html) {
    if (!this.active || this.seen.has(key)) return;
    const el = typeof target === 'function' ? target() : document.querySelector(target);
    if (!el || !this.#visible(el)) return;
    this.seen.add(key);
    this.tipEl.querySelector('.tx').innerHTML = html;
    this.tipEl.hidden = false;
    this.tipFor = el;
    this.#placeTip();
    clearTimeout(this.tipTimer);
    this.tipTimer = setTimeout(() => this.hideTip(), 9000);
  }
  hideTip() { this.tipEl.hidden = true; this.tipFor = null; }

  // ---- internals
  #build() {
    const card = document.createElement('section');
    card.id = 'coach';
    card.className = 'panel';
    card.hidden = true;
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-live', 'polite');
    card.innerHTML = `<div class="hd"><span class="eyebrow part"></span><span class="count num"></span>
        <button class="x" aria-label="End the tour" title="End the tour">×</button></div>
      <div class="dots"></div>
      <h3></h3><div class="bd"></div>
      <div class="ft"><button class="btn ghost back">Back</button><span class="grow"></span><button class="btn solid nx">Next</button></div>`;
    document.body.appendChild(card);
    card.querySelector('.x').onclick = () => this.end(false);
    card.querySelector('.back').onclick = () => this.back();
    card.querySelector('.nx').onclick = () => this.next();
    this.card = card;
    const ring = document.createElement('div');
    ring.id = 'coachring';
    ring.hidden = true;
    document.body.appendChild(ring);
    this.ring = ring;
    const tip = document.createElement('div');
    tip.id = 'coachtip';
    tip.hidden = true;
    tip.innerHTML = `<span class="tx"></span><button class="ok">Got it</button>`;
    tip.querySelector('.ok').onclick = () => this.hideTip();
    document.body.appendChild(tip);
    this.tipEl = tip;
  }
  #go(i) {
    this.i = i;
    const s = this.steps[i];
    s.enter?.();
    const c = this.card;
    c.hidden = false;
    c.querySelector('.part').textContent = s.part || '';
    c.querySelector('.count').textContent = `${i + 1} / ${this.steps.length}`;
    c.querySelector('h3').textContent = s.title;
    c.querySelector('.bd').innerHTML = s.body;
    c.querySelector('.back').disabled = i === 0;
    c.querySelector('.nx').textContent = s.next || (i === this.steps.length - 1 ? 'Finish' : 'Next');
    // progress: one dot per part
    const parts = [...new Set(this.steps.map((x) => x.part))];
    c.querySelector('.dots').innerHTML = parts.map((p) => `<i class="${p === s.part ? 'on' : parts.indexOf(p) < parts.indexOf(s.part) ? 'past' : ''}" title="${p}"></i>`).join('');
    this.#place();
  }
  #target() {
    const s = this.steps[this.i];
    if (!s?.target) return null;
    const el = typeof s.target === 'function' ? s.target() : document.querySelector(s.target);
    return el && this.#visible(el) ? el : null;
  }
  #visible(el) {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const st = getComputedStyle(el);
    return st.visibility !== 'hidden' && st.display !== 'none' && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
  }
  #place() {
    if (!this.active) return;
    const el = this.#target();
    if (!el) { this.ring.hidden = true; return; }
    const r = el.getBoundingClientRect(), pad = 5;
    Object.assign(this.ring.style, { left: r.left - pad + 'px', top: r.top - pad + 'px', width: r.width + pad * 2 + 'px', height: r.height + pad * 2 + 'px' });
    this.ring.hidden = false;
    this.#placeTip();
  }
  #placeTip() {
    if (this.tipEl.hidden || !this.tipFor) return;
    const r = this.tipFor.getBoundingClientRect(), t = this.tipEl, w = Math.min(300, innerWidth - 32);
    t.style.width = w + 'px';
    const below = r.bottom + 10 + t.offsetHeight < innerHeight - 8;
    t.style.top = (below ? r.bottom + 10 : Math.max(8, r.top - t.offsetHeight - 10)) + 'px';
    t.style.left = Math.max(16, Math.min(innerWidth - w - 16, r.left + r.width / 2 - w / 2)) + 'px';
    t.classList.toggle('above', !below);
  }
  #poll() {
    if (!this.active) return;
    const s = this.steps[this.i];
    if (s.done && s.done()) { this.next(); return; }
    this.#place();
    if (this.tipFor && !this.#visible(this.tipFor)) this.hideTip();
  }
}
