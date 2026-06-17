// Visit records (EMR Lite) module

const Visits = {
  visits: [],

  async render() {
    document.getElementById('page-content').innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Visit Records</h1>
          <p class="page-subtitle">Medical visit notes and diagnoses</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-primary" onclick="Visits.openCreateModal()">
            <i class="bi bi-plus-lg me-1"></i> New Visit Record
          </button>
        </div>
      </div>

      <div class="card card-modern">
        <div class="card-body p-0" id="visits-table-container">
          <div class="text-center py-5"><div class="spinner-border text-primary"></div></div>
        </div>
      </div>

      ${this.getModalHTML()}`;

    await this.loadVisits();
  },

  async loadVisits() {
    const { data, error } = await getSupabase()
      .from('visits')
      .select('*, patients(name, patient_code), doctors(name), appointments(appointment_date)')
      .order('created_at', { ascending: false });

    if (error) { Utils.showToast(error.message, 'error'); return; }
    this.visits = data || [];
    this.renderTable();
  },

  renderTable() {
    const container = document.getElementById('visits-table-container');
    if (!this.visits.length) {
      container.innerHTML = `<div class="empty-state py-5"><i class="bi bi-journal-medical"></i><p>No visit records yet</p></div>`;
      return;
    }

    container.innerHTML = `<div class="table-responsive">
      <table class="table table-hover mb-0">
        <thead><tr>
          <th>Date</th><th>Patient</th><th>Doctor</th><th>Diagnosis</th><th>Follow-up</th><th></th>
        </tr></thead>
        <tbody>${this.visits.map(v => `
          <tr>
            <td>${Utils.formatDateTime(v.created_at)}</td>
            <td>${Utils.escapeHtml(v.patients?.name)}<br><small class="text-muted">${v.patients?.patient_code}</small></td>
            <td>${Utils.escapeHtml(v.doctors?.name)}</td>
            <td class="text-truncate" style="max-width:200px">${Utils.escapeHtml(v.diagnosis || '—')}</td>
            <td>${Utils.formatDate(v.followup_date)}</td>
            <td>
              <button class="btn btn-sm btn-light me-1" onclick="Visits.viewVisit('${v.id}')"><i class="bi bi-eye"></i></button>
              <button class="btn btn-sm btn-light" onclick="App.navigate('prescriptions'); Prescriptions.openCreateModal('${v.id}')"><i class="bi bi-capsule"></i></button>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
  },

  getModalHTML() {
    return `<div class="modal fade" id="visitModal" tabindex="-1">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Record Visit</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <form id="visitForm">
            <div class="modal-body">
              <div class="row g-3">
                <div class="col-md-6">
                  <label class="form-label">Patient *</label>
                  <select class="form-select" id="visit-patient" required></select>
                </div>
                <div class="col-md-6">
                  <label class="form-label">Doctor *</label>
                  <select class="form-select" id="visit-doctor" required></select>
                </div>
                <div class="col-12">
                  <label class="form-label">Symptoms</label>
                  <textarea class="form-control" id="visit-symptoms" rows="2"></textarea>
                </div>
                <div class="col-12">
                  <label class="form-label">Diagnosis</label>
                  <textarea class="form-control" id="visit-diagnosis" rows="2"></textarea>
                </div>
                <div class="col-12">
                  <label class="form-label">Doctor Notes</label>
                  <textarea class="form-control" id="visit-notes" rows="3"></textarea>
                </div>
                <div class="col-md-6">
                  <label class="form-label">Follow-up Date</label>
                  <input type="date" class="form-control" id="visit-followup">
                </div>
              </div>
              <input type="hidden" id="visit-appointment-id">
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-light" data-bs-dismiss="modal">Cancel</button>
              <button type="submit" class="btn btn-primary">Save Visit Record</button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <div class="modal fade" id="visitViewModal" tabindex="-1">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header"><h5 class="modal-title">Visit Details</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
          <div class="modal-body" id="visit-view-content"></div>
        </div>
      </div>
    </div>`;
  },

  async openCreateModal(patientId = '', appointmentId = '', doctorId = '') {
    const [patients, doctors] = await Promise.all([
      Patients.getAllForSelect(),
      Doctors.getAllForSelect()
    ]);

    document.getElementById('visit-patient').innerHTML =
      patients.map(p => `<option value="${p.id}" ${p.id === patientId ? 'selected' : ''}>${p.name}</option>`).join('');
    document.getElementById('visit-doctor').innerHTML =
      doctors.map(d => `<option value="${d.id}" ${d.id === doctorId ? 'selected' : ''}>${d.name}</option>`).join('');
    document.getElementById('visit-appointment-id').value = appointmentId;
    document.getElementById('visitForm').reset();
    if (patientId) document.getElementById('visit-patient').value = patientId;
    if (doctorId) document.getElementById('visit-doctor').value = doctorId;

    document.getElementById('visitForm').onsubmit = async (e) => {
      e.preventDefault();
      const payload = {
        patient_id: document.getElementById('visit-patient').value,
        doctor_id: document.getElementById('visit-doctor').value,
        appointment_id: document.getElementById('visit-appointment-id').value || null,
        symptoms: document.getElementById('visit-symptoms').value.trim() || null,
        diagnosis: document.getElementById('visit-diagnosis').value.trim() || null,
        doctor_notes: document.getElementById('visit-notes').value.trim() || null,
        followup_date: document.getElementById('visit-followup').value || null
      };

      Utils.showLoading(true);
      const { error } = await getSupabase().from('visits').insert(payload);
      Utils.showLoading(false);

      if (error) { Utils.showToast(error.message, 'error'); return; }
      Utils.showToast('Visit record saved');
      bootstrap.Modal.getInstance(document.getElementById('visitModal')).hide();
      await this.loadVisits();
    };

    new bootstrap.Modal(document.getElementById('visitModal')).show();
  },

  async viewVisit(id) {
    const v = this.visits.find(x => x.id === id);
    if (!v) return;

    const { data: rx } = await getSupabase()
      .from('prescriptions')
      .select('*')
      .eq('visit_id', id);

    document.getElementById('visit-view-content').innerHTML = `
      <div class="row g-3">
        <div class="col-md-6"><label class="text-muted small">Patient</label><p class="fw-medium">${Utils.escapeHtml(v.patients?.name)}</p></div>
        <div class="col-md-6"><label class="text-muted small">Doctor</label><p class="fw-medium">${Utils.escapeHtml(v.doctors?.name)}</p></div>
        <div class="col-12"><label class="text-muted small">Symptoms</label><p>${Utils.escapeHtml(v.symptoms || '—')}</p></div>
        <div class="col-12"><label class="text-muted small">Diagnosis</label><p>${Utils.escapeHtml(v.diagnosis || '—')}</p></div>
        <div class="col-12"><label class="text-muted small">Notes</label><p>${Utils.escapeHtml(v.doctor_notes || '—')}</p></div>
        <div class="col-md-6"><label class="text-muted small">Follow-up</label><p>${Utils.formatDate(v.followup_date)}</p></div>
      </div>
      ${rx?.length ? `<hr><h6>Prescriptions</h6><ul>${rx.map(r =>
        `<li><strong>${Utils.escapeHtml(r.medication)}</strong> — ${r.dosage || ''} ${r.frequency || ''} for ${r.duration || ''}</li>`
      ).join('')}</ul>` : ''}`;

    new bootstrap.Modal(document.getElementById('visitViewModal')).show();
  }
};
