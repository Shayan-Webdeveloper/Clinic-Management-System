// Doctor management module

const Doctors = {
  doctors: [],

  async render() {
    document.getElementById('page-content').innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Doctors</h1>
          <p class="page-subtitle">Manage doctor profiles and schedules</p>
        </div>
        ${Auth.hasRole('admin', 'receptionist') ? `
        <div class="page-actions">
          <button class="btn btn-primary" onclick="Doctors.openCreateModal()">
            <i class="bi bi-plus-lg me-1"></i> Add Doctor
          </button>
        </div>` : ''}
      </div>

      <div class="row g-4" id="doctors-grid">
        <div class="col-12 text-center py-5"><div class="spinner-border text-primary"></div></div>
      </div>

      ${this.getModalHTML()}`;

    await this.loadDoctors();
  },

  async loadDoctors() {
    const { data, error } = await getSupabase()
      .from('doctors')
      .select('*')
      .order('name');

    if (error) { Utils.showToast(error.message, 'error'); return; }
    this.doctors = data || [];
    this.renderGrid();
  },

  renderGrid() {
    const grid = document.getElementById('doctors-grid');
    if (!this.doctors.length) {
      grid.innerHTML = `<div class="col-12"><div class="empty-state py-5"><i class="bi bi-person-badge"></i>
        <p>No doctors registered yet</p></div></div>`;
      return;
    }

    grid.innerHTML = this.doctors.map(d => `
      <div class="col-md-6 col-xl-4">
        <div class="card card-modern doctor-card h-100">
          <div class="card-body">
            <div class="d-flex align-items-start gap-3 mb-3">
              <div class="avatar-lg bg-primary-subtle text-primary">${Utils.getInitials(d.name)}</div>
              <div class="flex-grow-1">
                <h5 class="mb-1">${Utils.escapeHtml(d.name)}</h5>
                <p class="text-primary mb-0 small">${Utils.escapeHtml(d.specialization || 'General')}</p>
                ${d.is_active
                  ? '<span class="badge bg-success-subtle text-success mt-1">Active</span>'
                  : '<span class="badge bg-secondary-subtle text-secondary mt-1">Inactive</span>'}
              </div>
              ${Auth.hasRole('admin') ? `
              <div class="dropdown">
                <button class="btn btn-sm btn-light" data-bs-toggle="dropdown"><i class="bi bi-three-dots"></i></button>
                <ul class="dropdown-menu dropdown-menu-end">
                  <li><a class="dropdown-item" href="#" onclick="Doctors.openEditModal('${d.id}'); return false;"><i class="bi bi-pencil me-2"></i>Edit</a></li>
                  <li><a class="dropdown-item" href="#" onclick="Doctors.viewSchedule('${d.id}'); return false;"><i class="bi bi-calendar me-2"></i>View Schedule</a></li>
                </ul>
              </div>` : ''}
            </div>
            <div class="doctor-meta">
              <div><i class="bi bi-mortarboard me-2 text-muted"></i>${Utils.escapeHtml(d.qualifications || '—')}</div>
              <div><i class="bi bi-telephone me-2 text-muted"></i>${Utils.escapeHtml(d.phone || '—')}</div>
              <div><i class="bi bi-currency-dollar me-2 text-muted"></i>${Utils.formatCurrency(d.consultation_fee)} / visit</div>
            </div>
          </div>
          <div class="card-footer bg-transparent border-0 pt-0">
            <button class="btn btn-outline-primary btn-sm w-100" onclick="App.navigate('appointments'); Appointments.filterByDoctor('${d.id}')">
              <i class="bi bi-calendar-check me-1"></i> View Appointments
            </button>
          </div>
        </div>
      </div>`).join('');
  },

  getModalHTML() {
    return `<div class="modal fade" id="doctorModal" tabindex="-1">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="doctorModalTitle">Add Doctor</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <form id="doctorForm">
            <div class="modal-body">
              <input type="hidden" id="doctor-id">
              <div class="row g-3">
                <div class="col-md-6">
                  <label class="form-label">Full Name *</label>
                  <input type="text" class="form-control" id="doctor-name" required>
                </div>
                <div class="col-md-6">
                  <label class="form-label">Specialization</label>
                  <input type="text" class="form-control" id="doctor-specialization" placeholder="e.g. Cardiology">
                </div>
                <div class="col-md-6">
                  <label class="form-label">Qualifications</label>
                  <input type="text" class="form-control" id="doctor-qualifications" placeholder="e.g. MD, MBBS">
                </div>
                <div class="col-md-6">
                  <label class="form-label">Phone</label>
                  <input type="tel" class="form-control" id="doctor-phone">
                </div>
                <div class="col-md-6">
                  <label class="form-label">Email</label>
                  <input type="email" class="form-control" id="doctor-email">
                </div>
                <div class="col-md-6">
                  <label class="form-label">Consultation Fee ($)</label>
                  <input type="number" class="form-control" id="doctor-fee" min="0" step="0.01" value="0">
                </div>
                <div class="col-12">
                  <label class="form-label">Working Hours</label>
                  <textarea class="form-control" id="doctor-availability" rows="2" placeholder="Mon-Fri 9AM-5PM"></textarea>
                </div>
                <div class="col-12">
                  <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="doctor-active" checked>
                    <label class="form-check-label" for="doctor-active">Active</label>
                  </div>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-light" data-bs-dismiss="modal">Cancel</button>
              <button type="submit" class="btn btn-primary">Save Doctor</button>
            </div>
          </form>
        </div>
      </div>
    </div>`;
  },

  openCreateModal() {
    document.getElementById('doctorModalTitle').textContent = 'Add Doctor';
    document.getElementById('doctorForm').reset();
    document.getElementById('doctor-id').value = '';
    document.getElementById('doctor-active').checked = true;
    this.bindForm();
    new bootstrap.Modal(document.getElementById('doctorModal')).show();
  },

  async openEditModal(id) {
    const d = this.doctors.find(x => x.id === id);
    if (!d) return;
    document.getElementById('doctorModalTitle').textContent = 'Edit Doctor';
    document.getElementById('doctor-id').value = d.id;
    document.getElementById('doctor-name').value = d.name || '';
    document.getElementById('doctor-specialization').value = d.specialization || '';
    document.getElementById('doctor-qualifications').value = d.qualifications || '';
    document.getElementById('doctor-phone').value = d.phone || '';
    document.getElementById('doctor-email').value = d.email || '';
    document.getElementById('doctor-fee').value = d.consultation_fee || 0;
    document.getElementById('doctor-availability').value =
      typeof d.availability === 'object' ? (d.availability?.schedule || '') : (d.availability || '');
    document.getElementById('doctor-active').checked = d.is_active !== false;
    this.bindForm();
    new bootstrap.Modal(document.getElementById('doctorModal')).show();
  },

  bindForm() {
    document.getElementById('doctorForm').onsubmit = async (e) => {
      e.preventDefault();
      const id = document.getElementById('doctor-id').value;
      const payload = {
        name: document.getElementById('doctor-name').value.trim(),
        specialization: document.getElementById('doctor-specialization').value.trim() || null,
        qualifications: document.getElementById('doctor-qualifications').value.trim() || null,
        phone: document.getElementById('doctor-phone').value.trim() || null,
        email: document.getElementById('doctor-email').value.trim() || null,
        consultation_fee: parseFloat(document.getElementById('doctor-fee').value) || 0,
        availability: { schedule: document.getElementById('doctor-availability').value.trim() },
        is_active: document.getElementById('doctor-active').checked,
        updated_at: new Date().toISOString()
      };

      Utils.showLoading(true);
      const sb = getSupabase();
      const { error } = id
        ? await sb.from('doctors').update(payload).eq('id', id)
        : await sb.from('doctors').insert(payload);
      Utils.showLoading(false);

      if (error) { Utils.showToast(error.message, 'error'); return; }
      Utils.showToast(id ? 'Doctor updated' : 'Doctor added');
      bootstrap.Modal.getInstance(document.getElementById('doctorModal')).hide();
      await this.loadDoctors();
    };
  },

  async viewSchedule(id) {
    App.navigate('appointments');
    Appointments.filterByDoctor(id);
  },

  async getAllForSelect() {
    const { data } = await getSupabase()
      .from('doctors')
      .select('id, name, specialization, consultation_fee')
      .eq('is_active', true)
      .order('name');
    return data || [];
  }
};
