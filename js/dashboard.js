// Dashboard module

const Dashboard = {
  async render() {
    const sb = getSupabase();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      { count: patientCount },
      { count: doctorCount },
      { data: todayAppts },
      { data: recentPatients },
      { data: invoices }
    ] = await Promise.all([
      sb.from('patients').select('*', { count: 'exact', head: true }).eq('is_archived', false),
      sb.from('doctors').select('*', { count: 'exact', head: true }).eq('is_active', true),
      sb.from('appointments')
        .select('*, patients(name, patient_code), doctors(name, specialization)')
        .gte('appointment_date', today.toISOString())
        .lt('appointment_date', tomorrow.toISOString())
        .order('appointment_date'),
      sb.from('patients')
        .select('*')
        .eq('is_archived', false)
        .order('created_at', { ascending: false })
        .limit(5),
      sb.from('invoices')
        .select('total_amount, payment_status, created_at')
        .gte('created_at', new Date(today.getFullYear(), today.getMonth(), 1).toISOString())
    ]);

    const todayTotal = todayAppts?.length || 0;
    const completedToday = todayAppts?.filter(a => a.status === 'completed').length || 0;
    const monthlyRevenue = (invoices || [])
      .filter(i => i.payment_status === 'paid')
      .reduce((sum, i) => sum + parseFloat(i.total_amount || 0), 0);
    const pendingPayments = (invoices || [])
      .filter(i => i.payment_status !== 'paid')
      .reduce((sum, i) => sum + parseFloat(i.total_amount || 0), 0);

    const role = Auth.profile?.role;
    const greeting = this.getGreeting();

    document.getElementById('page-content').innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">${greeting}, ${Utils.escapeHtml(Auth.profile?.full_name || 'User')}</h1>
          <p class="page-subtitle">Here's what's happening at your clinic today.</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-primary" onclick="App.navigate('appointments'); Appointments.openCreateModal()">
            <i class="bi bi-plus-lg me-1"></i> New Appointment
          </button>
        </div>
      </div>

      <div class="row g-4 mb-4">
        <div class="col-sm-6 col-xl-3">
          <div class="stat-card">
            <div class="stat-icon bg-primary-subtle text-primary"><i class="bi bi-people"></i></div>
            <div class="stat-info">
              <span class="stat-label">Total Patients</span>
              <span class="stat-value">${patientCount || 0}</span>
            </div>
          </div>
        </div>
        <div class="col-sm-6 col-xl-3">
          <div class="stat-card">
            <div class="stat-icon bg-success-subtle text-success"><i class="bi bi-calendar-check"></i></div>
            <div class="stat-info">
              <span class="stat-label">Today's Appointments</span>
              <span class="stat-value">${todayTotal}</span>
              <span class="stat-meta">${completedToday} completed</span>
            </div>
          </div>
        </div>
        <div class="col-sm-6 col-xl-3">
          <div class="stat-card">
            <div class="stat-icon bg-info-subtle text-info"><i class="bi bi-person-badge"></i></div>
            <div class="stat-info">
              <span class="stat-label">Active Doctors</span>
              <span class="stat-value">${doctorCount || 0}</span>
            </div>
          </div>
        </div>
        <div class="col-sm-6 col-xl-3">
          <div class="stat-card">
            <div class="stat-icon bg-warning-subtle text-warning"><i class="bi bi-currency-dollar"></i></div>
            <div class="stat-info">
              <span class="stat-label">Monthly Revenue</span>
              <span class="stat-value">${Utils.formatCurrency(monthlyRevenue)}</span>
              <span class="stat-meta">${Utils.formatCurrency(pendingPayments)} pending</span>
            </div>
          </div>
        </div>
      </div>

      <div class="row g-4">
        <div class="col-lg-8">
          <div class="card card-modern h-100">
            <div class="card-header d-flex justify-content-between align-items-center">
              <h5 class="card-title mb-0">Today's Schedule</h5>
              <a href="#" class="text-primary text-decoration-none small" onclick="App.navigate('appointments'); return false;">View all</a>
            </div>
            <div class="card-body p-0">
              ${this.renderTodayAppointments(todayAppts)}
            </div>
          </div>
        </div>
        <div class="col-lg-4">
          <div class="card card-modern h-100">
            <div class="card-header d-flex justify-content-between align-items-center">
              <h5 class="card-title mb-0">Recent Patients</h5>
              <a href="#" class="text-primary text-decoration-none small" onclick="App.navigate('patients'); return false;">View all</a>
            </div>
            <div class="card-body p-0">
              ${this.renderRecentPatients(recentPatients)}
            </div>
          </div>
          ${role === 'doctor' ? this.renderDoctorQuickActions() : ''}
        </div>
      </div>`;
  },

  getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  },

  renderTodayAppointments(appts) {
    if (!appts?.length) {
      return `<div class="empty-state py-5"><i class="bi bi-calendar-x"></i><p>No appointments scheduled for today</p></div>`;
    }
    return `<div class="table-responsive">
      <table class="table table-hover mb-0">
        <thead><tr><th>Time</th><th>Patient</th><th>Doctor</th><th>Status</th></tr></thead>
        <tbody>${appts.map(a => `
          <tr>
            <td>${new Date(a.appointment_date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</td>
            <td>
              <div class="d-flex align-items-center gap-2">
                <div class="avatar-sm">${Utils.getInitials(a.patients?.name)}</div>
                <div><div class="fw-medium">${Utils.escapeHtml(a.patients?.name)}</div>
                <small class="text-muted">${a.patients?.patient_code || ''}</small></div>
              </div>
            </td>
            <td>${Utils.escapeHtml(a.doctors?.name)}</td>
            <td>${Utils.statusBadge(a.status)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
  },

  renderRecentPatients(patients) {
    if (!patients?.length) {
      return `<div class="empty-state py-4"><p>No patients yet</p></div>`;
    }
    return `<ul class="list-group list-group-flush">
      ${patients.map(p => `
        <li class="list-group-item d-flex align-items-center gap-3 py-3">
          <div class="avatar-sm">${Utils.getInitials(p.name)}</div>
          <div class="flex-grow-1">
            <div class="fw-medium">${Utils.escapeHtml(p.name)}</div>
            <small class="text-muted">${p.patient_code} · ${Utils.calculateAge(p.dob)}</small>
          </div>
          <button class="btn btn-sm btn-light" onclick="App.navigate('patients'); Patients.viewPatient('${p.id}')">
            <i class="bi bi-eye"></i>
          </button>
        </li>`).join('')}
    </ul>`;
  },

  renderDoctorQuickActions() {
    return `<div class="card card-modern mt-4">
      <div class="card-body">
        <h6 class="mb-3">Quick Actions</h6>
        <div class="d-grid gap-2">
          <button class="btn btn-outline-primary btn-sm" onclick="App.navigate('visits')">
            <i class="bi bi-journal-medical me-1"></i> Record Visit
          </button>
          <button class="btn btn-outline-primary btn-sm" onclick="App.navigate('prescriptions')">
            <i class="bi bi-capsule me-1"></i> Write Prescription
          </button>
        </div>
      </div>
    </div>`;
  }
};
