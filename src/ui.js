/**
 * Plain-DOM control panel. Owns no scene state: it edits `state` and calls the
 * matching handler so main.js can react.
 */
export function createUI({ state, locations, species, ...on }) {
  const $ = (id) => document.getElementById(id);
  const els = {
    location: $('location'),
    lat: $('lat'),
    lon: $('lon'),
    date: $('date'),
    time: $('time'),
    timeLabel: $('time-label'),
    play: $('play'),
    speed: $('speed'),
    age: $('age'),
    ageLabel: $('age-label'),
    species: $('species'),
    selection: $('selection'),
    sky: $('sky'),
    grass: $('grass'),
    shadow: $('shadow'),
    ao: $('ao'),
    exposure: $('exposure'),
    exposureLabel: $('exposure-label'),
  };

  const fmtTime = (m) => {
    const mins = Math.floor(m);
    return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
  };

  // Location
  locations.forEach((l, i) => els.location.add(new Option(l.name, i)));
  els.location.addEventListener('change', () => {
    state.location = +els.location.value;
    const l = locations[state.location];
    if (l.lat != null) {
      state.lat = l.lat;
      state.lon = l.lon;
    }
    sync();
    on.onLocation();
  });
  for (const key of ['lat', 'lon']) {
    els[key].addEventListener('change', () => {
      const v = parseFloat(els[key].value);
      if (Number.isFinite(v)) state[key] = v;
      state.location = locations.length - 1; // custom
      sync();
      on.onLocation();
    });
  }

  // Date
  els.date.addEventListener('change', () => {
    if (!els.date.value) return;
    state.date = els.date.value;
    on.onDate();
  });
  document.querySelectorAll('.seasons button').forEach((b) =>
    b.addEventListener('click', () => {
      state.date = `${state.date.slice(0, 4)}-${b.dataset.date}`;
      els.date.value = state.date;
      on.onDate();
    }),
  );

  // Time
  els.time.addEventListener('input', () => {
    state.minutes = +els.time.value;
    els.timeLabel.textContent = fmtTime(state.minutes);
    on.onTime();
  });
  const api = { playing: false, speed: 30 };
  els.play.addEventListener('click', () => {
    api.playing = !api.playing;
    els.play.textContent = api.playing ? '❚❚ Pause' : '▶ Play day';
    els.play.classList.toggle('active', api.playing);
  });
  els.speed.addEventListener('change', () => (api.speed = +els.speed.value));

  // Trees
  const speciesButtons = {};
  for (const [key, sp] of Object.entries(species)) {
    const b = document.createElement('button');
    const sw = document.createElement('span');
    sw.className = 'swatch';
    sw.style.background = `#${sp.leafColor.toString(16).padStart(6, '0')}`;
    b.append(sw, sp.name);
    b.title = `${sp.latin} — mature ${sp.matureHeight} m × ${sp.matureSpread} m${sp.deciduous ? ', deciduous' : ', evergreen'}`;
    b.addEventListener('click', () => on.onPlace(key));
    els.species.append(b);
    speciesButtons[key] = b;
  }
  els.age.addEventListener('input', () => {
    state.years = +els.age.value;
    els.ageLabel.textContent = state.years;
    on.onAge();
  });
  $('sel-remove').addEventListener('click', () => on.onRemove());
  $('reset-trees').addEventListener('click', () => on.onResetTrees());

  // Render
  els.sky.addEventListener('change', () => {
    state.sky = els.sky.value;
    on.onSky();
  });
  els.grass.addEventListener('change', () => {
    state.grass = +els.grass.value;
    on.onGrass();
  });
  els.shadow.addEventListener('change', () => {
    state.shadow = +els.shadow.value;
    on.onShadow();
  });
  els.ao.addEventListener('change', () => {
    state.ao = els.ao.checked;
    on.onAO();
  });
  els.exposure.addEventListener('input', () => {
    state.exposure = +els.exposure.value;
    els.exposureLabel.textContent = state.exposure.toFixed(2);
    on.onExposure();
  });

  function sync() {
    els.location.value = state.location;
    els.lat.value = state.lat;
    els.lon.value = state.lon;
    els.date.value = state.date;
    els.time.value = state.minutes;
    els.timeLabel.textContent = fmtTime(state.minutes);
    els.age.value = state.years;
    els.ageLabel.textContent = state.years;
    els.sky.value = state.sky;
    els.grass.value = state.grass;
    els.shadow.value = state.shadow;
    els.ao.checked = state.ao;
    els.exposure.value = state.exposure;
    els.exposureLabel.textContent = state.exposure.toFixed(2);
  }
  sync();

  return Object.assign(api, {
    sync,
    setTime(m) {
      els.time.value = Math.floor(m);
      els.timeLabel.textContent = fmtTime(m);
    },
    setReadout(r) {
      for (const k of ['sunrise', 'sunset', 'altitude', 'azimuth']) $(k).textContent = r[k];
    },
    setPlacing(key) {
      for (const [k, b] of Object.entries(speciesButtons)) b.classList.toggle('active', k === key);
    },
    showSelection(info) {
      els.selection.hidden = !info;
      if (!info) return;
      $('sel-name').textContent = info.name;
      $('sel-latin').textContent = info.latin;
      $('sel-size').textContent = info.size;
    },
    setSkySource(text) {
      $('sky-source').textContent = text;
    },
  });
}
