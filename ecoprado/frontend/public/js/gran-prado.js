const VENDORS_URL = '../public/data/vendors.json';
const API_URL = 'http://localhost:3001/api';

async function loadVendors() {
  try {
    const res = await fetch(VENDORS_URL, { cache: 'no-store' });
    const vendors = await res.json();
    renderVendors(vendors);
    setupFilters(vendors);
  } catch (e) {
    console.error('No se pudieron cargar vendedores:', e);
  }
}

function vendorCardHTML(v) {
  const badges = (v.badges || []).map(b => `<span class="mini-chip"><i class="bi bi-check2-circle me-1"></i>${b}</span>`).join('');
  const tags = (v.tags || []).join(' ');
  return `
  <div class="col-md-4" data-tags="${tags}">
    <div class="vendor-card">
      <div class="d-flex align-items-center gap-3">
        <img src="${v.avatar}" class="vendor-avatar" alt="${v.name}">
        <div>
          <div class="vendor-name">${v.name}</div>
          <div class="vendor-meta"><i class="bi bi-geo-alt me-1"></i>${v.location}</div>
        </div>
        <span class="ms-auto badge bg-success-subtle text-success border border-success-subtle">Gran Prado</span>
      </div>
      <div class="vendor-actions mt-3">${badges}</div>
    </div>
  </div>`;
}

function renderVendors(vendors) {
  const container = document.getElementById('vendors');
  if (!container) return;
  container.innerHTML = vendors.map(vendorCardHTML).join('');
}

function setupFilters(vendors) {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const f = btn.getAttribute('data-filter');
      document.querySelectorAll('#vendors [data-tags]').forEach(card => {
        if (f === 'all') { card.parentElement.style.display = ''; return; }
        const tags = card.getAttribute('data-tags');
        card.parentElement.style.display = tags && tags.includes(f) ? '' : 'none';
      });
    });
  });
}

async function submitVendorRegistration(e) {
  e.preventDefault();
  const name = document.getElementById('reg-name').value.trim();
  const giro = document.getElementById('reg-giro').value.trim();
  const location = document.getElementById('reg-location').value.trim();
  if (!name || !giro || !location) return;

  const payload = { name, giro, location };
  const btn = document.getElementById('reg-submit');
  btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Enviando';
  try {
    const res = await fetch(`${API_URL}/vendors/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(await res.text());
    alert('Solicitud enviada. Nos pondremos en contacto.');
  } catch (err) {
    // Fallback local
    const key = 'ecoprado_vendor_requests';
    const prev = JSON.parse(localStorage.getItem(key) || '[]');
    prev.push({ ...payload, at: new Date().toISOString() });
    localStorage.setItem(key, JSON.stringify(prev));
    alert('Solicitud guardada localmente (sin backend).');
  } finally {
    btn.disabled = false; btn.innerHTML = '<i class="bi bi-send me-2"></i>Solicitar verificación';
    e.target.reset();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  loadVendors();
  const form = document.getElementById('reg-form');
  if (form) form.addEventListener('submit', submitVendorRegistration);
});
