async function loadSidebar(contextLabel) {
  try {
    const container = document.getElementById('app-sidebar');
    if (!container) return;
    const res = await fetch('../components/sidebar.html', { cache: 'no-store' });
    const html = await res.text();
    container.innerHTML = html;

    // Context label
    const label = document.getElementById('sidebar-context');
    if (label && contextLabel) label.textContent = contextLabel;

    // Mark active by pathname
    const path = location.pathname.split('/').pop();
    const route = path.replace('.html', '');
    document.querySelectorAll('.sidebar .nav-item-custom').forEach(a => {
      const r = a.getAttribute('data-route');
      if ((route === 'dashboard' && r === 'dashboard') ||
          (route === 'marketplace' && r === 'marketplace') ||
          (route === 'gran-prado' && r === 'gran-prado')) {
        a.classList.add('active');
      }
    });

    // Username/role from dashboard storage if exists
    const name = (window.localStorage && localStorage.getItem('ecoprado_name')) || 'Usuario Demo';
    const role = (window.localStorage && localStorage.getItem('ecoprado_role')) || 'ciudadano';
    const userEl = document.getElementById('sidebar-username');
    const roleEl = document.getElementById('sidebar-role');
    if (userEl) userEl.textContent = name;
    if (roleEl) roleEl.textContent = `#${role}`;
  } catch (e) {
    console.error('No se pudo cargar la sidebar:', e);
  }
}

// Auto-context by page title
document.addEventListener('DOMContentLoaded', () => {
  let context = 'App';
  const path = location.pathname.split('/').pop();
  if (path.includes('dashboard')) context = 'Dashboard';
  if (path.includes('marketplace')) context = 'Marketplace';
  if (path.includes('gran-prado')) context = 'Gran Prado';
  loadSidebar(context);
});
