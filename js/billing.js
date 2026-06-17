// Billing & payments module

const Billing = {
  invoices: [],

  async render() {
    document.getElementById('page-content').innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Billing</h1>
          <p class="page-subtitle">Invoices, payments, and revenue tracking</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-primary" onclick="Billing.openCreateModal()">
            <i class="bi bi-plus-lg me-1"></i> New Invoice
          </button>
        </div>
      </div>

      <div class="row g-4 mb-4" id="billing-stats"></div>

      <div class="card card-modern">
        <div class="card-body p-0" id="invoices-table-container">
          <div class="text-center py-5"><div class="spinner-border text-primary"></div></div>
        </div>
      </div>

      ${this.getModalHTML()}`;

    await this.loadInvoices();
  },

  async loadInvoices() {
    const { data, error } = await getSupabase()
      .from('invoices')
      .select('*, patients(name, patient_code)')
      .order('created_at', { ascending: false });

    if (error) { Utils.showToast(error.message, 'error'); return; }
    this.invoices = data || [];
    this.renderStats();
    this.renderTable();
  },

  renderStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const todayRevenue = this.invoices
      .filter(i => i.payment_status === 'paid' && new Date(i.created_at) >= today)
      .reduce((s, i) => s + parseFloat(i.total_amount || 0), 0);

    const monthRevenue = this.invoices
      .filter(i => i.payment_status === 'paid' && new Date(i.created_at) >= monthStart)
      .reduce((s, i) => s + parseFloat(i.total_amount || 0), 0);

    const outstanding = this.invoices
      .filter(i => i.payment_status !== 'paid')
      .reduce((s, i) => s + parseFloat(i.total_amount || 0), 0);

    document.getElementById('billing-stats').innerHTML = `
      <div class="col-md-4">
        <div class="stat-card">
          <div class="stat-icon bg-success-subtle text-success"><i class="bi bi-cash-stack"></i></div>
          <div class="stat-info">
            <span class="stat-label">Today's Revenue</span>
            <span class="stat-value">${Utils.formatCurrency(todayRevenue)}</span>
          </div>
        </div>
      </div>
      <div class="col-md-4">
        <div class="stat-card">
          <div class="stat-icon bg-primary-subtle text-primary"><i class="bi bi-graph-up"></i></div>
          <div class="stat-info">
            <span class="stat-label">Monthly Revenue</span>
            <span class="stat-value">${Utils.formatCurrency(monthRevenue)}</span>
          </div>
        </div>
      </div>
      <div class="col-md-4">
        <div class="stat-card">
          <div class="stat-icon bg-danger-subtle text-danger"><i class="bi bi-exclamation-circle"></i></div>
          <div class="stat-info">
            <span class="stat-label">Outstanding</span>
            <span class="stat-value">${Utils.formatCurrency(outstanding)}</span>
          </div>
        </div>
      </div>`;
  },

  renderTable() {
    const container = document.getElementById('invoices-table-container');
    if (!this.invoices.length) {
      container.innerHTML = `<div class="empty-state py-5"><i class="bi bi-receipt"></i><p>No invoices yet</p></div>`;
      return;
    }

    container.innerHTML = `<div class="table-responsive">
      <table class="table table-hover mb-0">
        <thead><tr>
          <th>Invoice #</th><th>Patient</th><th>Amount</th><th>Status</th><th>Date</th><th></th>
        </tr></thead>
        <tbody>${this.invoices.map(i => `
          <tr>
            <td><code>${i.invoice_number}</code></td>
            <td>${Utils.escapeHtml(i.patients?.name)}<br><small class="text-muted">${i.patients?.patient_code}</small></td>
            <td class="fw-medium">${Utils.formatCurrency(i.total_amount)}</td>
            <td>${Utils.statusBadge(i.payment_status)}</td>
            <td>${Utils.formatDate(i.created_at)}</td>
            <td>
              <button class="btn btn-sm btn-light me-1" onclick="Billing.viewInvoice('${i.id}')"><i class="bi bi-eye"></i></button>
              ${i.payment_status !== 'paid' ? `<button class="btn btn-sm btn-success" onclick="Billing.openPaymentModal('${i.id}')"><i class="bi bi-credit-card"></i></button>` : ''}
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
  },

  getModalHTML() {
    return `
    <div class="modal fade" id="invoiceModal" tabindex="-1">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header"><h5 class="modal-title">New Invoice</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
          <form id="invoiceForm">
            <div class="modal-body">
              <div class="mb-3">
                <label class="form-label">Patient *</label>
                <select class="form-select" id="invoice-patient" required></select>
              </div>
              <div class="row g-3">
                <div class="col-md-4">
                  <label class="form-label">Consultation Fee</label>
                  <input type="number" class="form-control" id="invoice-consultation" min="0" step="0.01" value="0">
                </div>
                <div class="col-md-4">
                  <label class="form-label">Lab Charges</label>
                  <input type="number" class="form-control" id="invoice-lab" min="0" step="0.01" value="0">
                </div>
                <div class="col-md-4">
                  <label class="form-label">Medication Charges</label>
                  <input type="number" class="form-control" id="invoice-medication" min="0" step="0.01" value="0">
                </div>
                <div class="col-md-4">
                  <label class="form-label">Discount</label>
                  <input type="number" class="form-control" id="invoice-discount" min="0" step="0.01" value="0">
                </div>
              </div>
              <input type="hidden" id="invoice-appointment-id">
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-light" data-bs-dismiss="modal">Cancel</button>
              <button type="submit" class="btn btn-primary">Create Invoice</button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <div class="modal fade" id="paymentModal" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header"><h5 class="modal-title">Record Payment</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
          <form id="paymentForm">
            <div class="modal-body">
              <input type="hidden" id="payment-invoice-id">
              <p id="payment-invoice-info" class="text-muted"></p>
              <div class="mb-3">
                <label class="form-label">Amount *</label>
                <input type="number" class="form-control" id="payment-amount" min="0" step="0.01" required>
              </div>
              <div class="mb-3">
                <label class="form-label">Payment Method</label>
                <select class="form-select" id="payment-method">
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="upi">UPI</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-light" data-bs-dismiss="modal">Cancel</button>
              <button type="submit" class="btn btn-success">Record Payment</button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <div class="modal fade" id="invoiceViewModal" tabindex="-1">
      <div class="modal-dialog"><div class="modal-content">
        <div class="modal-header"><h5 class="modal-title">Invoice Details</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
        <div class="modal-body" id="invoice-view-content"></div>
      </div></div>
    </div>`;
  },

  async openCreateModal(patientId = '') {
    const patients = await Patients.getAllForSelect();
    document.getElementById('invoice-patient').innerHTML =
      patients.map(p => `<option value="${p.id}" ${p.id === patientId ? 'selected' : ''}>${p.name} (${p.patient_code})</option>`).join('');
    document.getElementById('invoice-appointment-id').value = '';
    document.getElementById('invoiceForm').reset();

    document.getElementById('invoiceForm').onsubmit = async (e) => {
      e.preventDefault();
      const payload = {
        patient_id: document.getElementById('invoice-patient').value,
        appointment_id: document.getElementById('invoice-appointment-id').value || null,
        consultation_fee: parseFloat(document.getElementById('invoice-consultation').value) || 0,
        lab_charges: parseFloat(document.getElementById('invoice-lab').value) || 0,
        medication_charges: parseFloat(document.getElementById('invoice-medication').value) || 0,
        discount: parseFloat(document.getElementById('invoice-discount').value) || 0,
        payment_status: 'pending'
      };

      Utils.showLoading(true);
      const { error } = await getSupabase().from('invoices').insert(payload);
      Utils.showLoading(false);

      if (error) { Utils.showToast(error.message, 'error'); return; }
      Utils.showToast('Invoice created');
      bootstrap.Modal.getInstance(document.getElementById('invoiceModal')).hide();
      await this.loadInvoices();
    };

    new bootstrap.Modal(document.getElementById('invoiceModal')).show();
  },

  async createFromAppointment(appointmentId) {
    const { data: appt } = await getSupabase()
      .from('appointments')
      .select('*, doctors(consultation_fee)')
      .eq('id', appointmentId)
      .single();

    if (!appt) return;
    await this.openCreateModal(appt.patient_id);
    document.getElementById('invoice-appointment-id').value = appointmentId;
    document.getElementById('invoice-consultation').value = appt.doctors?.consultation_fee || 0;
  },

  openPaymentModal(invoiceId) {
    const inv = this.invoices.find(i => i.id === invoiceId);
    if (!inv) return;

    document.getElementById('payment-invoice-id').value = invoiceId;
    document.getElementById('payment-amount').value = inv.total_amount;
    document.getElementById('payment-invoice-info').textContent =
      `Invoice ${inv.invoice_number} — Total: ${Utils.formatCurrency(inv.total_amount)}`;

    document.getElementById('paymentForm').onsubmit = async (e) => {
      e.preventDefault();
      const payload = {
        invoice_id: invoiceId,
        amount: parseFloat(document.getElementById('payment-amount').value),
        payment_method: document.getElementById('payment-method').value
      };

      Utils.showLoading(true);
      const { error } = await getSupabase().from('payments').insert(payload);
      Utils.showLoading(false);

      if (error) { Utils.showToast(error.message, 'error'); return; }
      Utils.showToast('Payment recorded');
      bootstrap.Modal.getInstance(document.getElementById('paymentModal')).hide();
      await this.loadInvoices();
    };

    new bootstrap.Modal(document.getElementById('paymentModal')).show();
  },

  async viewInvoice(id) {
    const inv = this.invoices.find(i => i.id === id);
    if (!inv) return;

    const { data: payments } = await getSupabase()
      .from('payments')
      .select('*')
      .eq('invoice_id', id)
      .order('paid_at', { ascending: false });

    document.getElementById('invoice-view-content').innerHTML = `
      <div class="mb-3"><strong>${inv.invoice_number}</strong> ${Utils.statusBadge(inv.payment_status)}</div>
      <table class="table table-sm">
        <tr><td>Patient</td><td>${Utils.escapeHtml(inv.patients?.name)}</td></tr>
        <tr><td>Consultation</td><td>${Utils.formatCurrency(inv.consultation_fee)}</td></tr>
        <tr><td>Lab</td><td>${Utils.formatCurrency(inv.lab_charges)}</td></tr>
        <tr><td>Medication</td><td>${Utils.formatCurrency(inv.medication_charges)}</td></tr>
        <tr><td>Discount</td><td>-${Utils.formatCurrency(inv.discount)}</td></tr>
        <tr class="fw-bold"><td>Total</td><td>${Utils.formatCurrency(inv.total_amount)}</td></tr>
      </table>
      ${payments?.length ? `<h6 class="mt-3">Payments</h6><ul class="list-unstyled">${payments.map(p =>
        `<li>${Utils.formatCurrency(p.amount)} via ${p.payment_method} — ${Utils.formatDateTime(p.paid_at)}</li>`
      ).join('')}</ul>` : '<p class="text-muted">No payments recorded</p>'}`;

    new bootstrap.Modal(document.getElementById('invoiceViewModal')).show();
  }
};
