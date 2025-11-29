// Constants
const C = 3e8; // Speed of light in m/s

// State
const state = {
  mode: 'view', // 'view', 'tower', 'link'
  towers: [],
  links: [],
  selectedId: null, // ID of selected tower or link
  selectionType: null, // 'tower' or 'link'
  linkDraft: null, // { startTowerId: string }
};

// DOM Elements
const els = {
  map: document.getElementById('map'),
  btnView: document.getElementById('btn-mode-view'),
  btnTower: document.getElementById('btn-mode-tower'),
  btnLink: document.getElementById('btn-mode-link'),
  panel: document.getElementById('properties-panel'),
  panelTitle: document.getElementById('panel-title'),
  panelContent: document.getElementById('panel-content'),
  btnClose: document.getElementById('btn-close-panel'),
  toast: document.getElementById('toast'),
};

// Initialize Map
const map = L.map('map', {
  zoomControl: false,
  attributionControl: false
}).setView([20.5937, 78.9629], 5); // Default to India, can be anywhere

// Add Dark Tiles (using CartoDB Dark Matter for a better base, but standard OSM with CSS filter is also fine. Let's use standard OSM and rely on CSS filter)
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '© OpenStreetMap'
}).addTo(map);

// Custom Zoom Control
L.control.zoom({
  position: 'bottomright'
}).addTo(map);

// Icons
const towerIcon = L.divIcon({
  className: 'custom-tower-icon',
  html: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3));">
        <path d="M12 2L2 22h20L12 2zm0 3.5L18.5 20H5.5L12 5.5z" fill="#3b82f6"/>
        <circle cx="12" cy="14" r="2" fill="white"/>
    </svg>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32]
});

const selectedTowerIcon = L.divIcon({
  className: 'custom-tower-icon-selected',
  html: `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 0 10px #3b82f6);">
        <path d="M12 2L2 22h20L12 2zm0 3.5L18.5 20H5.5L12 5.5z" fill="#60a5fa"/>
        <circle cx="12" cy="14" r="2" fill="white"/>
    </svg>`,
  iconSize: [40, 40],
  iconAnchor: [20, 40],
  popupAnchor: [0, -40]
});

// Event Listeners
els.btnView.addEventListener('click', () => setMode('view'));
els.btnTower.addEventListener('click', () => setMode('tower'));
els.btnLink.addEventListener('click', () => setMode('link'));
els.btnClose.addEventListener('click', deselectAll);

map.on('click', handleMapClick);

// Functions

function setMode(mode) {
  state.mode = mode;
  state.linkDraft = null; // Reset link draft

  // Update UI
  [els.btnView, els.btnTower, els.btnLink].forEach(btn => btn.classList.remove('active'));
  if (mode === 'view') els.btnView.classList.add('active');
  if (mode === 'tower') els.btnTower.classList.add('active');
  if (mode === 'link') els.btnLink.classList.add('active');

  showToast(`Mode: ${mode.charAt(0).toUpperCase() + mode.slice(1)}`);
}

function handleMapClick(e) {
  if (state.mode === 'tower') {
    addTower(e.latlng);
  } else if (state.mode === 'view') {
    deselectAll();
  }
}

function addTower(latlng) {
  const id = crypto.randomUUID();
  const tower = {
    id,
    latlng,
    frequency: 5.8, // Default GHz
    name: `Tower ${state.towers.length + 1}`,
    marker: null
  };

  const marker = L.marker(latlng, { icon: towerIcon }).addTo(map);

  // Bind events
  marker.on('click', (e) => {
    L.DomEvent.stopPropagation(e); // Prevent map click
    handleTowerClick(tower);
  });

  tower.marker = marker;
  state.towers.push(tower);

  // Select the new tower
  selectTower(tower);
  setMode('view'); // Switch back to view after placing
}

function handleTowerClick(tower) {
  if (state.mode === 'link') {
    if (!state.linkDraft) {
      // Start linking
      state.linkDraft = { startTowerId: tower.id };
      showToast('Select second tower to connect');
    } else {
      // Finish linking
      if (state.linkDraft.startTowerId === tower.id) {
        showToast('Cannot connect tower to itself', 'error');
        state.linkDraft = null;
        return;
      }
      createLink(state.linkDraft.startTowerId, tower.id);
      state.linkDraft = null;
    }
  } else {
    selectTower(tower);
  }
}

function selectTower(tower) {
  deselectAll();
  state.selectedId = tower.id;
  state.selectionType = 'tower';

  // Visual update
  tower.marker.setIcon(selectedTowerIcon);

  renderPropertiesPanel();
}

function createLink(t1Id, t2Id) {
  const t1 = state.towers.find(t => t.id === t1Id);
  const t2 = state.towers.find(t => t.id === t2Id);

  if (t1.frequency !== t2.frequency) {
    showToast(`Frequency mismatch! ${t1.frequency}GHz vs ${t2.frequency}GHz`, 'error');
    return;
  }

  // Check if link already exists
  const exists = state.links.some(l =>
    (l.sourceId === t1Id && l.targetId === t2Id) ||
    (l.sourceId === t2Id && l.targetId === t1Id)
  );

  if (exists) {
    showToast('Link already exists', 'error');
    return;
  }

  const id = crypto.randomUUID();
  const link = {
    id,
    sourceId: t1Id,
    targetId: t2Id,
    poly: null,
    fresnelPoly: null
  };

  drawLink(link);
  state.links.push(link);
  showToast('Link created successfully', 'success');
}

function drawLink(link) {
  const t1 = state.towers.find(t => t.id === link.sourceId);
  const t2 = state.towers.find(t => t.id === link.targetId);

  const poly = L.polyline([t1.latlng, t2.latlng], {
    color: '#3b82f6',
    weight: 3,
    opacity: 0.8
  }).addTo(map);

  poly.on('click', (e) => {
    L.DomEvent.stopPropagation(e);
    selectLink(link);
  });

  // Hover effect
  const dist = (map.distance(t1.latlng, t2.latlng) / 1000).toFixed(2);
  poly.bindTooltip(`${dist} km | ${t1.frequency} GHz`, { sticky: true, direction: 'top' });

  poly.on('mouseover', () => {
    poly.setStyle({ weight: 5, color: '#60a5fa' });
    poly.openTooltip();
  });
  poly.on('mouseout', () => {
    if (state.selectedId !== link.id) {
      poly.setStyle({ weight: 3, color: '#3b82f6' });
    }
    poly.closeTooltip();
  });

  link.poly = poly;
}

function selectLink(link) {
  deselectAll();
  state.selectedId = link.id;
  state.selectionType = 'link';

  // Highlight
  link.poly.setStyle({ color: '#f59e0b', weight: 4 });

  // Show Fresnel
  drawFresnelZone(link);

  renderPropertiesPanel();
}

function drawFresnelZone(link) {
  const t1 = state.towers.find(t => t.id === link.sourceId);
  const t2 = state.towers.find(t => t.id === link.targetId);

  // Calculate geometry
  const p1 = map.latLngToLayerPoint(t1.latlng);
  const p2 = map.latLngToLayerPoint(t2.latlng);

  const distanceMeters = map.distance(t1.latlng, t2.latlng);
  const freqHz = t1.frequency * 1e9;
  const lambda = C / freqHz;

  // Generate ellipse points
  const points = [];
  const steps = 50;

  // Vector from p1 to p2
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  const ux = dx / len; // Unit vector
  const uy = dy / len;

  // Perpendicular vector
  const px = -uy;
  const py = ux;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const d1 = t * distanceMeters;
    const d2 = (1 - t) * distanceMeters;

    // Fresnel radius at this point
    // r = sqrt( (lambda * d1 * d2) / (d1 + d2) )
    // d1 + d2 = distanceMeters
    const r = Math.sqrt((lambda * d1 * d2) / distanceMeters);

    // Convert r (meters) to pixels
    // We need a scale factor. 
    // map.distance gives meters. 
    // len gives pixels.
    // scale = pixels / meter
    const scale = len / distanceMeters;
    const rPixels = r * scale;

    // Base point on line
    const bx = p1.x + dx * t;
    const by = p1.y + dy * t;

    // Upper point
    points.push(map.layerPointToLatLng(L.point(bx + px * rPixels, by + py * rPixels)));
  }

  // Go back for lower half
  for (let i = steps; i >= 0; i--) {
    const t = i / steps;
    const d1 = t * distanceMeters;
    const d2 = (1 - t) * distanceMeters;
    const r = Math.sqrt((lambda * d1 * d2) / distanceMeters);

    const scale = len / distanceMeters;
    const rPixels = r * scale;

    const bx = p1.x + dx * t;
    const by = p1.y + dy * t;

    points.push(map.layerPointToLatLng(L.point(bx - px * rPixels, by - py * rPixels)));
  }

  if (link.fresnelPoly) {
    map.removeLayer(link.fresnelPoly);
  }

  link.fresnelPoly = L.polygon(points, {
    color: '#10b981',
    fillColor: '#10b981',
    fillOpacity: 0.2,
    weight: 1,
    dashArray: '5, 5'
  }).addTo(map);
}

function deselectAll() {
  // Reset tower icons
  state.towers.forEach(t => {
    if (t.marker) t.marker.setIcon(towerIcon);
  });

  // Reset link styles and remove fresnel
  state.links.forEach(l => {
    if (l.poly) l.poly.setStyle({ color: '#3b82f6', weight: 3 });
    if (l.fresnelPoly) {
      map.removeLayer(l.fresnelPoly);
      l.fresnelPoly = null;
    }
  });

  state.selectedId = null;
  state.selectionType = null;

  els.panel.classList.add('hidden');
}

function renderPropertiesPanel() {
  els.panel.classList.remove('hidden');
  els.panelContent.innerHTML = '';

  if (state.selectionType === 'tower') {
    const tower = state.towers.find(t => t.id === state.selectedId);
    els.panelTitle.textContent = 'Tower Properties';

    const html = `
            <div class="form-group">
                <label>Name</label>
                <input type="text" class="form-control" value="${tower.name}" onchange="updateTower('${tower.id}', 'name', this.value)">
            </div>
            <div class="form-group">
                <label>Frequency (GHz)</label>
                <input type="number" step="0.1" class="form-control" value="${tower.frequency}" onchange="updateTower('${tower.id}', 'frequency', this.value)">
            </div>
            <div class="form-group">
                <label>Coordinates</label>
                <div style="font-size: 0.8rem; color: var(--text-secondary);">
                    ${tower.latlng.lat.toFixed(5)}, ${tower.latlng.lng.toFixed(5)}
                </div>
            </div>
            <button class="btn-danger" onclick="deleteTower('${tower.id}')">Delete Tower</button>
        `;
    els.panelContent.innerHTML = html;

  } else if (state.selectionType === 'link') {
    const link = state.links.find(l => l.id === state.selectedId);
    const t1 = state.towers.find(t => t.id === link.sourceId);
    const t2 = state.towers.find(t => t.id === link.targetId);
    const dist = (map.distance(t1.latlng, t2.latlng) / 1000).toFixed(2); // km

    els.panelTitle.textContent = 'Link Properties';

    const html = `
            <div class="form-group">
                <label>Source</label>
                <div class="form-control" style="opacity: 0.7">${t1.name}</div>
            </div>
            <div class="form-group">
                <label>Target</label>
                <div class="form-control" style="opacity: 0.7">${t2.name}</div>
            </div>
            <div class="form-group">
                <label>Distance</label>
                <div class="form-control" style="opacity: 0.7">${dist} km</div>
            </div>
            <div class="form-group">
                <label>Frequency</label>
                <div class="form-control" style="opacity: 0.7">${t1.frequency} GHz</div>
            </div>
            <button class="btn-danger" onclick="deleteLink('${link.id}')">Delete Link</button>
        `;
    els.panelContent.innerHTML = html;
  }
}

// Global helpers for inline onclicks
window.updateTower = (id, field, value) => {
  const tower = state.towers.find(t => t.id === id);
  if (!tower) return;

  if (field === 'frequency') {
    value = parseFloat(value);
    // Check connected links
    const connectedLinks = state.links.filter(l => l.sourceId === id || l.targetId === id);
    if (connectedLinks.length > 0) {
      // Warn user that links might break or just update them?
      // Requirement: "UI should prevent connecting towers with different frequencies."
      // If we change freq, we should probably check validity or delete links.
      // Let's just allow it but warn, or maybe auto-delete links?
      // For simplicity, let's allow it but show a warning toast if it breaks links.
      // Actually, let's strictly enforce it by deleting links if freq changes.
      if (!confirm('Changing frequency will remove connected links. Continue?')) {
        renderPropertiesPanel(); // Reset input
        return;
      }
      connectedLinks.forEach(l => deleteLink(l.id));
    }
  }

  tower[field] = value;
  showToast('Updated successfully', 'success');
};

window.deleteTower = (id) => {
  // Remove links first
  const linksToRemove = state.links.filter(l => l.sourceId === id || l.targetId === id);
  linksToRemove.forEach(l => deleteLink(l.id));

  const tower = state.towers.find(t => t.id === id);
  if (tower.marker) map.removeLayer(tower.marker);

  state.towers = state.towers.filter(t => t.id !== id);
  deselectAll();
  showToast('Tower deleted');
};

window.deleteLink = (id) => {
  const link = state.links.find(l => l.id === id);
  if (link) {
    if (link.poly) map.removeLayer(link.poly);
    if (link.fresnelPoly) map.removeLayer(link.fresnelPoly);
    state.links = state.links.filter(l => l.id !== id);
    deselectAll();
    showToast('Link deleted');
  }
};

function showToast(msg, type = 'info') {
  els.toast.textContent = msg;
  els.toast.className = `toast ${type}`;

  setTimeout(() => {
    els.toast.classList.add('hidden');
  }, 3000);
}
