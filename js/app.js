// Main application router

const App = {
  currentPage: 'dashboard',

  pages: {
    dashboard: { title: 'Dashboard', icon: 'grid', render: () => Dashboard.render() },
    patients: { title: 'Patients', icon: 'people', render: () => Patients.render() },
    doctors: { title: 'Doctors', icon: 'person-badge', render: () => Doctors.render() },
    appointments: { title: 'Appointments', icon: 'calendar-check', render: () => Appointments.render() },
    visits: { title: 'Visits', icon: 'journal-medical', render: () => Visits.render() },
    prescriptions: { title: 'Prescriptions', icon: 'capsule', render: () => Prescriptions.render() },
    billing: { title: 'Billing', icon: 'receipt', render: () => Billing.render() }
  },

  async init() {
    initSupabase();
    await Auth.init();

    if (!Auth.requireAuth()) return;

    this.setupSidebar();
    this.setupUserMenu();
    this.setupMobileNav();

    const hash = window.location.hash.slice(1) || 'dashboard';
    await this.navigate(hash);

    window.addEventListener('hashchange', () => {
      const page = window.location.hash.slice(1) || 'dashboard';
      this.navigate(page);
    });
  },

  setupSidebar() {
    const nav = document.getElementById('sidebar-nav');
    nav.innerHTML = Object.entries(this.pages).map(([key, page]) => `
      <a href="#${key}" class="nav-item ${this.currentPage === key ? 'active' : ''}" data-page="${key}">
        <i class="bi bi-${page.icon}"></i>
        <span>${page.title}</span>
      </a>`).join('');

    nav.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        document.getElementById('sidebar').classList.remove('show');
        document.getElementById('sidebar-overlay').classList.remove('show');
      });
    });
  },

  setupUserMenu() {
    const profile = Auth.profile;
    document.getElementById('user-name').textContent = profile?.full_name || 'User';
    document.getElementById('user-role').innerHTML = Utils.roleBadge(profile?.role);
    document.getElementById('user-avatar').textContent = Utils.getInitials(profile?.full_name);
    document.getElementById('logout-btn').addEventListener('click', () => Auth.signOut());
  },

  setupMobileNav() {
    document.getElementById('sidebar-toggle').addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('show');
      document.getElementById('sidebar-overlay').classList.toggle('show');
    });
    document.getElementById('sidebar-overlay').addEventListener('click', () => {
      document.getElementById('sidebar').classList.remove('show');
      document.getElementById('sidebar-overlay').classList.remove('show');
    });
  },

  async navigate(page) {
    if (!this.pages[page]) page = 'dashboard';
    this.currentPage = page;

    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.page === page);
    });

    document.title = `${this.pages[page].title} — ClinicCare`;
    window.location.hash = page;

    Utils.showLoading(true);
    try {
      await this.pages[page].render();
    } catch (err) {
      console.error(err);
      document.getElementById('page-content').innerHTML =
        `<div class="alert alert-danger m-4">Failed to load page: ${err.message}</div>`;
    }
    Utils.showLoading(false);
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
