// Patient management module

const Patients = {
  patients: [],
  searchQuery: '',
  showArchived: false,

  async render() {
    document.getElementById('page-content').innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Patients</h1>
          <p class="page-subtitle">Manage patient records and medical history</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-primary" onclick="Patients.openCreateModal()">
            <i class="bi bi-plus-lg me-1"></i> Add Patient
          </button>
        </div>
      </div>

      <div class="card card-modern">
        <div class="card-header">
          <div class="row g-2 align-items-center">
            <div class="col-md-6">
              <div class="search-box">
                <i class="bi bi-search"></i>
                <input type="text" class="form-control" id="patient-search"
                  placeholder="Search by name, phone, or patient ID..." value="${Utils.escapeHtml(this.searchQuery)}">
              </div>
            </div>
            <div class="col-md-6 text-md-end">
              <div class="form-check form-switch d-inline-block">
                <input class="form-check-input" type="checkbox" id="show-archived" ${this.showArchived ? 'checked' : ''}>
                <label class="form-check-label" for="show-archived">Show archived</label>
              </div>
            </div>
          </div>
        </div>
        <div class="card-body p-0" id="patients-table-container">
          <div class="text-center py-5"><div class="spinner-border text-primary"></div></div>
        </div>
      </div>

      ${this.getModalHTML()}`;

    document.getElementById('patient-search').addEventListener('input',
      Utils.debounce(e => { this.searchQuery = e.target.value; this.loadPatients(); }, 300));
    document.getElementById('show-archived').addEventListener('change', e => {
      this.showArchived = e.target.checked;
      this.loadPatients();
    });

    await this.loadPatients();
  },

  async loadPatients() {
    const sb = getSupabase();
    let query = sb.from('patients').select('*').order('created_at', { ascending: false });

    if (!this.showArchived) query = query.eq('is_archived', false);

    const { data, error } = await query;
    if (error) { Utils.showToast(error.message, 'error'); return; }

    this.patients = data || [];
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      this.patients = this.patients.filter(p =>
        p.name?.toLowerCase().includes(q) ||
        p.phone?.includes(q) ||
        p.patient_code?.toLowerCase().includes(q) ||
        p.email?.toLowerCase().includes(q)
      );
    }
    this.renderTable();
  },

  renderTable() {
    const container = document.getElementById('patients-table-container');
    if (!this.patients.length) {
      container.innerHTML = `<div class="empty-state py-5"><i class="bi bi-people"></i><p>No patients found</p>
        <button class="btn btn-primary btn-sm" onclick="Patients.openCreateModal()">Add first patient</button></div>`;
      return;
    }

    container.innerHTML = `<div class="table-responsive">
      <table class="table table-hover mb-0">
        <thead><tr>
          <th>Patient ID</th><th>Name</th><th>Contact</th><th>Age</th><th>Blood Group</th><th>Status</th><th></th>
        </tr></thead>
        <tbody>${this.patients.map(p => `
          <tr class="${p.is_archived ? 'text-muted' : ''}">
            <td><code>${p.patient_code}</code></td>
            <td>
              <div class="d-flex align-items-center gap-2">
                <div class="avatar-sm">${Utils.getInitials(p.name)}</div>
                <span class="fw-medium">${Utils.escapeHtml(p.name)}</span>
              </div>
            </td>
            <td>${Utils.escapeHtml(p.phone || '—')}<br><small class="text-muted">${Utils.escapeHtml(p.email || '')}</small></td>
            <td>${Utils.calculateAge(p.dob)}</td>
            <td>${p.blood_group || '—'}</td>
            <td>${p.is_archived ? '<span class="badge bg-secondary-subtle text-secondary">Archived</span>' : '<span class="badge bg-success-subtle text-success">Active</span>'}</td>
            <td>
              <div class="dropdown">
                <button class="btn btn-sm btn-light" data-bs-toggle="dropdown"><i class="bi bi-three-dots-vertical"></i></button>
                <ul class="dropdown-menu dropdown-menu-end">
                  <li><a class="dropdown-item" href="#" onclick="Patients.viewPatient('${p.id}'); return false;"><i class="bi bi-eye me-2"></i>View</a></li>
                  <li><a class="dropdown-item" href="#" onclick="Patients.openEditModal('${p.id}'); return false;"><i class="bi bi-pencil me-2"></i>Edit</a></li>
                  <li><a class="dropdown-item" href="#" onclick="App.navigate('appointments'); Appointments.openCreateModal('${p.id}'); return false;"><i class="bi bi-calendar-plus me-2"></i>Book Appointment</a></li>
                  <li><hr class="dropdown-divider"></li>
                  <li><a class="dropdown-item ${p.is_archived ? 'text-success' : 'text-warning'}" href="#" onclick="Patients.toggleArchive('${p.id}', ${!p.is_archived}); return false;">
                    <i class="bi bi-${p.is_archived ? 'arrow-counterclockwise' : 'archive'} me-2"></i>${p.is_archived ? 'Restore' : 'Archive'}
                  </a></li>
                </ul>
              </div>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
  },

  getModalHTML() {
    return `<div class="modal fade" id="patientModal" tabindex="-1">
      <div class="modal-dialog modal-lg modal-dialog-scrollable">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="patientModalTitle">Add Patient</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <form id="patientForm">
            <div class="modal-body">
              <input type="hidden" id="patient-id">
              <div class="row g-3">
                <div class="col-md-8">
                  <label class="form-label">Full Name *</label>
                  <input type="text" class="form-control" id="patient-name" required>
                </div>
                <div class="col-md-4">
                  <label class="form-label">Gender</label>
                  <select class="form-select" id="patient-gender">
                    <option value="">Select</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div class="col-md-4">
                  <label class="form-label">Date of Birth</label>
                  <input type="date" class="form-control" id="patient-dob">
                </div>
                <div class="col-md-4">
                  <label class="form-label">Phone</label>
                  <input type="tel" class="form-control" id="patient-phone">
                </div>
                <div class="col-md-4">
                  <label class="form-label">Email</label>
                  <input type="email" class="form-control" id="patient-email">
                </div>
                <div class="col-md-4">
                  <label class="form-label">Blood Group</label>
                  <select class="form-select" id="patient-blood">
                    <option value="">Select</option>
                    ${['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(b => `<option value="${b}">${b}</option>`).join('')}
                  </select>
                </div>
                <div class="col-md-8">
                  <label class="form-label">Address</label>
                  <input type="text" class="form-control" id="patient-address">
                </div>
                <div class="col-md-6">
                  <label class="form-label">Emergency Contact</label>
                  <input type="text" class="form-control" id="patient-emergency">
                </div>
                <div class="col-12">
                  <label class="form-label">Medical History Notes</label>
                  <textarea class="form-control" id="patient-history" rows="3"></textarea>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-light" data-bs-dismiss="modal">Cancel</button>
              <button type="submit" class="btn btn-primary">Save Patient</button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <div class="modal fade" id="patientViewModal" tabindex="-1">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Patient Details</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body" id="patient-view-content"></div>
        </div>
      </div>
    </div>`;
  },

  openCreateModal() {
    document.getElementById('patientModalTitle').textContent = 'Add Patient';
    document.getElementById('patientForm').reset();
    document.getElementById('patient-id').value = '';
    this.bindForm();
    new bootstrap.Modal(document.getElementById('patientModal')).show();
  },

  async openEditModal(id) {
    const p = this.patients.find(x => x.id === id) ||
      (await getSupabase().from('patients').select('*').eq('id', id).single()).data;
    if (!p) return;

    document.getElementById('patientModalTitle').textContent = 'Edit Patient';
    document.getElementById('patient-id').value = p.id;
    document.getElementById('patient-name').value = p.name || '';
    document.getElementById('patient-gender').value = p.gender || '';
    document.getElementById('patient-dob').value = p.dob || '';
    document.getElementById('patient-phone').value = p.phone || '';
    document.getElementById('patient-email').value = p.email || '';
    document.getElementById('patient-blood').value = p.blood_group || '';
    document.getElementById('patient-address').value = p.address || '';
    document.getElementById('patient-emergency').value = p.emergency_contact || '';
    document.getElementById('patient-history').value = p.medical_history || '';
    this.bindForm();
    new bootstrap.Modal(document.getElementById('patientModal')).show();
  },

  bindForm() {
    const form = document.getElementById('patientForm');
    form.onsubmit = async (e) => {
      e.preventDefault();
      const id = document.getElementById('patient-id').value;
      const payload = {
        name: document.getElementById('patient-name').value.trim(),
        gender: document.getElementById('patient-gender').value || null,
        dob: document.getElementById('patient-dob').value || null,
        phone: document.getElementById('patient-phone').value.trim() || null,
        email: document.getElementById('patient-email').value.trim() || null,
        blood_group: document.getElementById('patient-blood').value || null,
        address: document.getElementById('patient-address').value.trim() || null,
        emergency_contact: document.getElementById('patient-emergency').value.trim() || null,
        medical_history: document.getElementById('patient-history').value.trim() || null,
        updated_at: new Date().toISOString()
      };

      Utils.showLoading(true);
      const sb = getSupabase();
      let error;
      if (id) {
        ({ error } = await sb.from('patients').update(payload).eq('id', id));
      } else {
        ({ error } = await sb.from('patients').insert(payload));
      }
      Utils.showLoading(false);

      if (error) { Utils.showToast(error.message, 'error'); return; }
      Utils.showToast(id ? 'Patient updated' : 'Patient added');
      bootstrap.Modal.getInstance(document.getElementById('patientModal')).hide();
      await this.loadPatients();
    };
  },

  async viewPatient(id) {
    const sb = getSupabase();
    const { data: p } = await sb.from('patients').select('*').eq('id', id).single();
    if (!p) return;

    const { data: appts } = await sb.from('appointments')
      .select('*, doctors(name)')
      .eq('patient_id', id)
      .order('appointment_date', { ascending: false })
      .limit(5);

    document.getElementById('patient-view-content').innerHTML = `
      <div class="patient-profile-header mb-4">
        <div class="avatar-lg">${Utils.getInitials(p.name)}</div>
        <div>
          <h4 class="mb-1">${Utils.escapeHtml(p.name)}</h4>
          <p class="text-muted mb-0">${p.patient_code} · ${p.gender || '—'} · ${Utils.calculateAge(p.dob)}</p>
        </div>
      </div>
      <div class="row g-3">
        <div class="col-md-6"><label class="text-muted small">Phone</label><p>${Utils.escapeHtml(p.phone || '—')}</p></div>
        <div class="col-md-6"><label class="text-muted small">Email</label><p>${Utils.escapeHtml(p.email || '—')}</p></div>
        <div class="col-md-6"><label class="text-muted small">Date of Birth</label><p>${Utils.formatDate(p.dob)}</p></div>
        <div class="col-md-6"><label class="text-muted small">Blood Group</label><p>${p.blood_group || '—'}</p></div>
        <div class="col-12"><label class="text-muted small">Address</label><p>${Utils.escapeHtml(p.address || '—')}</p></div>
        <div class="col-12"><label class="text-muted small">Emergency Contact</label><p>${Utils.escapeHtml(p.emergency_contact || '—')}</p></div>
        <div class="col-12"><label class="text-muted small">Medical History</label><p>${Utils.escapeHtml(p.medical_history || 'No notes recorded')}</p></div>
      </div>
      ${appts?.length ? `<hr><h6>Recent Appointments</h6>
        <ul class="list-unstyled">${appts.map(a => `
          <li class="d-flex justify-content-between py-2 border-bottom">
            <span>${Utils.formatDateTime(a.appointment_date)} — ${a.doctors?.name}</span>
            ${Utils.statusBadge(a.status)}
          </li>`).join('')}</ul>` : ''}`;

    new bootstrap.Modal(document.getElementById('patientViewModal')).show();
  },

  async toggleArchive(id, archive) {
    const { error } = await getSupabase()
      .from('patients')
      .update({ is_archived: archive, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) { Utils.showToast(error.message, 'error'); return; }
    Utils.showToast(archive ? 'Patient archived' : 'Patient restored');
    await this.loadPatients();
  },

  async getAllForSelect() {
    const { data } = await getSupabase()
      .from('patients')
      .select('id, name, patient_code')
      .eq('is_archived', false)
      .order('name');
    return data || [];
  }
};
