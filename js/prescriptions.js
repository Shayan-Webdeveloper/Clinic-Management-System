// Prescription management module

const Prescriptions = {
  prescriptions: [],

  async render() {
    document.getElementById('page-content').innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Prescriptions</h1>
          <p class="page-subtitle">Manage and print patient prescriptions</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-primary" onclick="Prescriptions.openCreateModal()">
            <i class="bi bi-plus-lg me-1"></i> New Prescription
          </button>
        </div>
      </div>

      <div class="card card-modern">
        <div class="card-body p-0" id="prescriptions-table-container">
          <div class="text-center py-5"><div class="spinner-border text-primary"></div></div>
        </div>
      </div>

      ${this.getModalHTML()}`;

    await this.loadPrescriptions();
  },

  async loadPrescriptions() {
    const { data, error } = await getSupabase()
      .from('prescriptions')
      .select('*, visits(patient_id, patients(name, patient_code), doctors(name), diagnosis, created_at)')
      .order('created_at', { ascending: false });

    if (error) { Utils.showToast(error.message, 'error'); return; }
    this.prescriptions = data || [];
    this.renderTable();
  },

  renderTable() {
    const container = document.getElementById('prescriptions-table-container');
    if (!this.prescriptions.length) {
      container.innerHTML = `<div class="empty-state py-5"><i class="bi bi-capsule"></i><p>No prescriptions yet</p></div>`;
      return;
    }

    container.innerHTML = `<div class="table-responsive">
      <table class="table table-hover mb-0">
        <thead><tr>
          <th>Date</th><th>Patient</th><th>Doctor</th><th>Medication</th><th>Dosage</th><th></th>
        </tr></thead>
        <tbody>${this.prescriptions.map(p => `
          <tr>
            <td>${Utils.formatDate(p.created_at)}</td>
            <td>${Utils.escapeHtml(p.visits?.patients?.name || '—')}<br>
              <small class="text-muted">${p.visits?.patients?.patient_code || ''}</small></td>
            <td>${Utils.escapeHtml(p.visits?.doctors?.name || '—')}</td>
            <td class="fw-medium">${Utils.escapeHtml(p.medication)}</td>
            <td>${Utils.escapeHtml(p.dosage || '—')} · ${Utils.escapeHtml(p.frequency || '')}</td>
            <td>
              <button class="btn btn-sm btn-light" onclick="Prescriptions.printPrescription('${p.id}')">
                <i class="bi bi-printer"></i>
              </button>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
  },

  getModalHTML() {
    return `<div class="modal fade" id="prescriptionModal" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">New Prescription</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <form id="prescriptionForm">
            <div class="modal-body">
              <div class="mb-3">
                <label class="form-label">Visit Record *</label>
                <select class="form-select" id="prescription-visit" required></select>
              </div>
              <div class="mb-3">
                <label class="form-label">Medication *</label>
                <input type="text" class="form-control" id="prescription-medication" required>
              </div>
              <div class="row g-3">
                <div class="col-md-4">
                  <label class="form-label">Dosage</label>
                  <input type="text" class="form-control" id="prescription-dosage" placeholder="500mg">
                </div>
                <div class="col-md-4">
                  <label class="form-label">Frequency</label>
                  <input type="text" class="form-control" id="prescription-frequency" placeholder="Twice daily">
                </div>
                <div class="col-md-4">
                  <label class="form-label">Duration</label>
                  <input type="text" class="form-control" id="prescription-duration" placeholder="7 days">
                </div>
              </div>
              <div class="mt-3">
                <label class="form-label">Notes</label>
                <textarea class="form-control" id="prescription-notes" rows="2"></textarea>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-light" data-bs-dismiss="modal">Cancel</button>
              <button type="submit" class="btn btn-primary">Save Prescription</button>
            </div>
          </form>
        </div>
      </div>
    </div>`;
  },

  async openCreateModal(visitId = '') {
    const { data: visits } = await getSupabase()
      .from('visits')
      .select('id, created_at, diagnosis, patients(name, patient_code), doctors(name)')
      .order('created_at', { ascending: false })
      .limit(50);

    document.getElementById('prescription-visit').innerHTML =
      (visits || []).map(v =>
        `<option value="${v.id}" ${v.id === visitId ? 'selected' : ''}>${v.patients?.name} — ${Utils.formatDate(v.created_at)} (${v.doctors?.name})</option>`
      ).join('') || '<option value="">No visits available</option>';

    document.getElementById('prescriptionForm').onsubmit = async (e) => {
      e.preventDefault();
      const payload = {
        visit_id: document.getElementById('prescription-visit').value,
        medication: document.getElementById('prescription-medication').value.trim(),
        dosage: document.getElementById('prescription-dosage').value.trim() || null,
        frequency: document.getElementById('prescription-frequency').value.trim() || null,
        duration: document.getElementById('prescription-duration').value.trim() || null,
        notes: document.getElementById('prescription-notes').value.trim() || null
      };

      Utils.showLoading(true);
      const { error } = await getSupabase().from('prescriptions').insert(payload);
      Utils.showLoading(false);

      if (error) { Utils.showToast(error.message, 'error'); return; }
      Utils.showToast('Prescription saved');
      bootstrap.Modal.getInstance(document.getElementById('prescriptionModal')).hide();
      await this.loadPrescriptions();
    };

    new bootstrap.Modal(document.getElementById('prescriptionModal')).show();
  },

  printPrescription(id) {
    const p = this.prescriptions.find(x => x.id === id);
    if (!p) return;

    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><title>Prescription</title>
      <style>body{font-family:Georgia,serif;padding:40px;max-width:600px;margin:0 auto}
      .header{text-align:center;border-bottom:2px solid #333;padding-bottom:20px;margin-bottom:30px}
      .rx{font-size:24px;margin:20px 0}table{width:100%;margin:20px 0}td{padding:8px 0}
      .footer{margin-top:40px;border-top:1px solid #ccc;padding-top:20px;text-align:right}</style></head><body>
      <div class="header"><h2>ClinicCare</h2><p>Medical Prescription</p></div>
      <p><strong>Patient:</strong> ${p.visits?.patients?.name || '—'} (${p.visits?.patients?.patient_code || ''})</p>
      <p><strong>Doctor:</strong> ${p.visits?.doctors?.name || '—'}</p>
      <p><strong>Date:</strong> ${Utils.formatDate(p.created_at)}</p>
      <div class="rx">℞</div>
      <table>
        <tr><td><strong>Medication</strong></td><td>${p.medication}</td></tr>
        <tr><td><strong>Dosage</strong></td><td>${p.dosage || '—'}</td></tr>
        <tr><td><strong>Frequency</strong></td><td>${p.frequency || '—'}</td></tr>
        <tr><td><strong>Duration</strong></td><td>${p.duration || '—'}</td></tr>
        ${p.notes ? `<tr><td><strong>Notes</strong></td><td>${p.notes}</td></tr>` : ''}
      </table>
      <div class="footer"><p>Doctor's Signature: _________________</p></div>
      </body></html>`);
    win.document.close();
    win.print();
  }
};
