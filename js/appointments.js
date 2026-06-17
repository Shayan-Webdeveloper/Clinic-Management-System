// Appointment management module

const Appointments = {
  appointments: [],
  filters: { date: '', doctorId: '', status: '' },
 realtimeChannel: null,
  async render() {
    document.getElementById('page-content').innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Appointments</h1>
          <p class="page-subtitle">Schedule and manage patient appointments</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-primary" onclick="Appointments.openCreateModal()">
            <i class="bi bi-plus-lg me-1"></i> New Appointment
          </button>
        </div>
      </div>

      <div class="card card-modern">
        <div class="card-header">
          <div class="row g-2 align-items-end">
            <div class="col-md-3">
              <label class="form-label small">Date</label>
              <input type="date" class="form-control" id="appt-filter-date" value="${this.filters.date}">
            </div>
            <div class="col-md-3">
              <label class="form-label small">Doctor</label>
              <select class="form-select" id="appt-filter-doctor"><option value="">All Doctors</option></select>
            </div>
            <div class="col-md-3">
              <label class="form-label small">Status</label>
              <select class="form-select" id="appt-filter-status">
                <option value="">All Statuses</option>
                ${['scheduled','checked_in','in_progress','completed','cancelled','no_show'].map(s =>
                  `<option value="${s}" ${this.filters.status === s ? 'selected' : ''}>${s.replace(/_/g,' ')}</option>`
                ).join('')}
              </select>
            </div>
            <div class="col-md-3">
              <button class="btn btn-light w-100" onclick="Appointments.clearFilters()">Clear Filters</button>
            </div>
          </div>
        </div>
        <div class="card-body p-0" id="appointments-table-container">
          <div class="text-center py-5"><div class="spinner-border text-primary"></div></div>
        </div>
      </div>

      ${this.getModalHTML()}`;

    await this.populateDoctorFilter();
    this.bindFilters();
    await this.loadAppointments();
    this.setupRealtime();
  },

  async populateDoctorFilter() {
    const doctors = await Doctors.getAllForSelect();
    const sel = document.getElementById('appt-filter-doctor');
    doctors.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d.id;
      opt.textContent = d.name;
      if (this.filters.doctorId === d.id) opt.selected = true;
      sel.appendChild(opt);
    });
  },

  bindFilters() {
    document.getElementById('appt-filter-date').addEventListener('change', e => {
      this.filters.date = e.target.value;
      this.loadAppointments();
    });
    document.getElementById('appt-filter-doctor').addEventListener('change', e => {
      this.filters.doctorId = e.target.value;
      this.loadAppointments();
    });
    document.getElementById('appt-filter-status').addEventListener('change', e => {
      this.filters.status = e.target.value;
      this.loadAppointments();
    });
  },

  clearFilters() {
    this.filters = { date: '', doctorId: '', status: '' };
    document.getElementById('appt-filter-date').value = '';
    document.getElementById('appt-filter-doctor').value = '';
    document.getElementById('appt-filter-status').value = '';
    this.loadAppointments();
  },

  filterByDoctor(doctorId) {
    this.filters.doctorId = doctorId;
    this.render();
  },

  async loadAppointments() {
    const sb = getSupabase();
    let query = sb.from('appointments')
      .select('*, patients(name, patient_code, phone), doctors(name, specialization)')
      .order('appointment_date', { ascending: true });

    if (this.filters.date) {
      const start = new Date(this.filters.date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      query = query.gte('appointment_date', start.toISOString()).lt('appointment_date', end.toISOString());
    }
    if (this.filters.doctorId) query = query.eq('doctor_id', this.filters.doctorId);
    if (this.filters.status) query = query.eq('status', this.filters.status);

    const { data, error } = await query;
    if (error) { Utils.showToast(error.message, 'error'); return; }
    this.appointments = data || [];
    this.renderTable();
  },

  renderTable() {
    const container = document.getElementById('appointments-table-container');
    if (!this.appointments.length) {
      container.innerHTML = `<div class="empty-state py-5"><i class="bi bi-calendar-x"></i><p>No appointments found</p></div>`;
      return;
    }

    container.innerHTML = `<div class="table-responsive">
      <table class="table table-hover mb-0">
        <thead><tr>
          <th>Date & Time</th><th>Patient</th><th>Doctor</th><th>Status</th><th>Notes</th><th></th>
        </tr></thead>
        <tbody>${this.appointments.map(a => `
          <tr>
            <td><div class="fw-medium">${Utils.formatDate(a.appointment_date)}</div>
              <small class="text-muted">${new Date(a.appointment_date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</small></td>
            <td>
              <div>${Utils.escapeHtml(a.patients?.name)}</div>
              <small class="text-muted">${a.patients?.patient_code}</small>
            </td>
            <td>${Utils.escapeHtml(a.doctors?.name)}<br><small class="text-muted">${a.doctors?.specialization || ''}</small></td>
            <td>${Utils.statusBadge(a.status)}</td>
            <td class="text-truncate" style="max-width:150px">${Utils.escapeHtml(a.notes || '—')}</td>
            <td>
              <div class="dropdown">
                <button class="btn btn-sm btn-light" data-bs-toggle="dropdown"><i class="bi bi-three-dots-vertical"></i></button>
                <ul class="dropdown-menu dropdown-menu-end">
                  ${this.getStatusActions(a)}
                  <li><a class="dropdown-item" href="#" onclick="Appointments.openEditModal('${a.id}'); return false;"><i class="bi bi-pencil me-2"></i>Reschedule</a></li>
                  <li><a class="dropdown-item" href="#" onclick="App.navigate('visits'); Visits.openCreateModal('${a.patient_id}', '${a.id}', '${a.doctor_id}'); return false;"><i class="bi bi-journal-medical me-2"></i>Record Visit</a></li>
                  <li><a class="dropdown-item" href="#" onclick="App.navigate('billing'); Billing.createFromAppointment('${a.id}'); return false;"><i class="bi bi-receipt me-2"></i>Create Invoice</a></li>
                </ul>
              </div>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
  },

  getStatusActions(a) {
    const transitions = {
      scheduled: ['checked_in', 'cancelled', 'no_show'],
      checked_in: ['in_progress', 'cancelled'],
      in_progress: ['completed'],
      completed: [],
      cancelled: [],
      no_show: []
    };
    const next = transitions[a.status] || [];
    return next.map(s => `
      <li><a class="dropdown-item" href="#" onclick="Appointments.updateStatus('${a.id}', '${s}'); return false;">
        <i class="bi bi-arrow-right-circle me-2"></i>Mark as ${s.replace(/_/g, ' ')}
      </a></li>`).join('') + (next.length ? '<li><hr class="dropdown-divider"></li>' : '');
  },

  async updateStatus(id, status) {
    const { error } = await getSupabase()
      .from('appointments')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) { Utils.showToast(error.message, 'error'); return; }
    Utils.showToast(`Appointment marked as ${status.replace(/_/g, ' ')}`);
    await this.loadAppointments();
  },

  getModalHTML() {
    return `<div class="modal fade" id="appointmentModal" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="appointmentModalTitle">New Appointment</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <form id="appointmentForm">
            <div class="modal-body">
              <input type="hidden" id="appointment-id">
              <div class="mb-3">
                <label class="form-label">Patient *</label>
                <select class="form-select" id="appointment-patient" required></select>
              </div>
              <div class="mb-3">
                <label class="form-label">Doctor *</label>
                <select class="form-select" id="appointment-doctor" required></select>
              </div>
              <div class="row g-3">
                <div class="col-md-6">
                  <label class="form-label">Date *</label>
                  <input type="date" class="form-control" id="appointment-date" required>
                </div>
                <div class="col-md-6">
                  <label class="form-label">Time *</label>
                  <input type="time" class="form-control" id="appointment-time" required>
                </div>
              </div>
              <div class="mt-3">
                <label class="form-label">Notes</label>
                <textarea class="form-control" id="appointment-notes" rows="2"></textarea>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-light" data-bs-dismiss="modal">Cancel</button>
              <button type="submit" class="btn btn-primary">Save Appointment</button>
            </div>
          </form>
        </div>
      </div>
    </div>`;
  },

  async openCreateModal(patientId = '') {
    document.getElementById('appointmentModalTitle').textContent = 'New Appointment';
    document.getElementById('appointmentForm').reset();
    document.getElementById('appointment-id').value = '';

    const [patients, doctors] = await Promise.all([
      Patients.getAllForSelect(),
      Doctors.getAllForSelect()
    ]);

    const pSel = document.getElementById('appointment-patient');
    pSel.innerHTML = '<option value="">Select patient</option>' +
      patients.map(p => `<option value="${p.id}" ${p.id === patientId ? 'selected' : ''}>${p.name} (${p.patient_code})</option>`).join('');

    const dSel = document.getElementById('appointment-doctor');
    dSel.innerHTML = '<option value="">Select doctor</option>' +
      doctors.map(d => `<option value="${d.id}">${d.name} — ${d.specialization || 'General'}</option>`).join('');

    document.getElementById('appointment-date').value = Utils.todayISO();
    this.bindForm();
    new bootstrap.Modal(document.getElementById('appointmentModal')).show();
  },

  async openEditModal(id) {
    const a = this.appointments.find(x => x.id === id);
    if (!a) return;
    await this.openCreateModal(a.patient_id);
    document.getElementById('appointmentModalTitle').textContent = 'Reschedule Appointment';
    document.getElementById('appointment-id').value = a.id;
    document.getElementById('appointment-doctor').value = a.doctor_id;
    const dt = new Date(a.appointment_date);
    document.getElementById('appointment-date').value = dt.toISOString().split('T')[0];
    document.getElementById('appointment-time').value = dt.toTimeString().slice(0, 5);
    document.getElementById('appointment-notes').value = a.notes || '';
  },

  bindForm() {
    document.getElementById('appointmentForm').onsubmit = async (e) => {
      e.preventDefault();
      const id = document.getElementById('appointment-id').value;
      const date = document.getElementById('appointment-date').value;
      const time = document.getElementById('appointment-time').value;
      const appointmentDate = new Date(`${date}T${time}`).toISOString();

      const payload = {
        patient_id: document.getElementById('appointment-patient').value,
        doctor_id: document.getElementById('appointment-doctor').value,
        appointment_date: appointmentDate,
        notes: document.getElementById('appointment-notes').value.trim() || null,
        updated_at: new Date().toISOString()
      };

      if (!id) {
        payload.status = 'scheduled';
        payload.created_by = Auth.currentUser?.id;
      }

      Utils.showLoading(true);
      const sb = getSupabase();
      const { error } = id
        ? await sb.from('appointments').update(payload).eq('id', id)
        : await sb.from('appointments').insert(payload);
      Utils.showLoading(false);

      if (error) { Utils.showToast(error.message, 'error'); return; }
      Utils.showToast(id ? 'Appointment updated' : 'Appointment scheduled');
      bootstrap.Modal.getInstance(document.getElementById('appointmentModal')).hide();
      await this.loadAppointments();
    };
  },

  setupRealtime() {
  // Prevent duplicate subscriptions
  if (this.realtimeChannel) return;

  const sb = getSupabase();

  this.realtimeChannel = sb
    .channel('appointments-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'appointments'
      },
      () => {
        this.loadAppointments();
      }
    )
    .subscribe();
}
};
