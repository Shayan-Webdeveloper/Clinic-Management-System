// Shared utilities

const Utils = {
  formatDate(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  },

  formatDateTime(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  },

  formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency: 'USD'
    }).format(amount || 0);
  },

  todayISO() {
    return new Date().toISOString().split('T')[0];
  },

  nowISO() {
    return new Date().toISOString();
  },

  statusBadge(status) {
    const map = {
      scheduled: 'primary',
      checked_in: 'info',
      in_progress: 'warning',
      completed: 'success',
      cancelled: 'secondary',
      no_show: 'danger',
      paid: 'success',
      partial: 'warning',
      pending: 'danger'
    };
    const cls = map[status] || 'secondary';
    const label = (status || '').replace(/_/g, ' ');
    return `<span class="badge bg-${cls}-subtle text-${cls} text-capitalize">${label}</span>`;
  },

  roleBadge(role) {
    const map = { admin: 'danger', doctor: 'primary', receptionist: 'success', nurse: 'info' };
    const cls = map[role] || 'secondary';
    return `<span class="badge bg-${cls}-subtle text-${cls} text-capitalize">${role || 'staff'}</span>`;
  },

  showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const id = 'toast-' + Date.now();
    const icon = type === 'success' ? 'check-circle' : type === 'error' ? 'x-circle' : 'info-circle';
    container.insertAdjacentHTML('beforeend', `
      <div id="${id}" class="toast align-items-center text-bg-${type === 'error' ? 'danger' : type} border-0" role="alert">
        <div class="d-flex">
          <div class="toast-body"><i class="bi bi-${icon} me-2"></i>${message}</div>
          <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>
      </div>`);
    const toast = new bootstrap.Toast(document.getElementById(id), { delay: 3500 });
    toast.show();
    document.getElementById(id).addEventListener('hidden.bs.toast', () => document.getElementById(id).remove());
  },

  showLoading(show = true) {
    const el = document.getElementById('global-loader');
    if (el) el.classList.toggle('d-none', !show);
  },

  debounce(fn, delay = 300) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  },

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  },

  getInitials(name) {
    return (name || '?').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  },

  calculateAge(dob) {
    if (!dob) return '—';
    const diff = Date.now() - new Date(dob).getTime();
    return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000)) + ' yrs';
  }
};
