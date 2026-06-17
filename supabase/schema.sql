-- ============================================================
-- Clinic Management System — Supabase Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL → New query)
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PROFILES (extends auth.users with role)
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'receptionist'
    CHECK (role IN ('admin', 'doctor', 'receptionist', 'nurse')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'receptionist')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- DOCTORS
-- ============================================================
CREATE TABLE IF NOT EXISTS doctors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  specialization TEXT,
  qualifications TEXT,
  phone TEXT,
  email TEXT,
  consultation_fee DECIMAL(10,2) DEFAULT 0,
  availability JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PATIENTS
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS patient_code_seq START 1000;

CREATE TABLE IF NOT EXISTS patients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_code TEXT UNIQUE,
  name TEXT NOT NULL,
  dob DATE,
  gender TEXT CHECK (gender IN ('male', 'female', 'other')),
  phone TEXT,
  email TEXT,
  address TEXT,
  emergency_contact TEXT,
  blood_group TEXT,
  medical_history TEXT,
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION generate_patient_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.patient_code IS NULL THEN
    NEW.patient_code := 'PAT-' || LPAD(nextval('patient_code_seq')::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_patient_code ON patients;
CREATE TRIGGER set_patient_code
  BEFORE INSERT ON patients
  FOR EACH ROW EXECUTE FUNCTION generate_patient_code();

-- ============================================================
-- APPOINTMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE RESTRICT,
  appointment_date TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'checked_in', 'in_progress', 'completed', 'cancelled', 'no_show')),
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor ON appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);

-- ============================================================
-- VISITS (EMR Lite)
-- ============================================================
CREATE TABLE IF NOT EXISTS visits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE RESTRICT,
  diagnosis TEXT,
  symptoms TEXT,
  doctor_notes TEXT,
  followup_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PRESCRIPTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS prescriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  visit_id UUID NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  medication TEXT NOT NULL,
  dosage TEXT,
  frequency TEXT,
  duration TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INVOICES & PAYMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_number TEXT UNIQUE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  consultation_fee DECIMAL(10,2) DEFAULT 0,
  lab_charges DECIMAL(10,2) DEFAULT 0,
  medication_charges DECIMAL(10,2) DEFAULT 0,
  discount DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('paid', 'partial', 'pending')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 10000;

CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invoice_number IS NULL THEN
    NEW.invoice_number := 'INV-' || LPAD(nextval('invoice_number_seq')::TEXT, 6, '0');
  END IF;
  NEW.total_amount := COALESCE(NEW.consultation_fee, 0) + COALESCE(NEW.lab_charges, 0)
    + COALESCE(NEW.medication_charges, 0) - COALESCE(NEW.discount, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_invoice_number ON invoices;
CREATE TRIGGER set_invoice_number
  BEFORE INSERT OR UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION generate_invoice_number();

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  payment_method TEXT DEFAULT 'cash'
    CHECK (payment_method IN ('cash', 'card', 'upi', 'bank_transfer', 'other')),
  paid_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);

-- Auto-update invoice payment status
CREATE OR REPLACE FUNCTION update_invoice_payment_status()
RETURNS TRIGGER AS $$
DECLARE
  total_paid DECIMAL(10,2);
  inv_total DECIMAL(10,2);
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO total_paid
  FROM payments WHERE invoice_id = NEW.invoice_id;
  SELECT total_amount INTO inv_total FROM invoices WHERE id = NEW.invoice_id;

  UPDATE invoices SET
    payment_status = CASE
      WHEN total_paid >= inv_total THEN 'paid'
      WHEN total_paid > 0 THEN 'partial'
      ELSE 'pending'
    END,
    updated_at = NOW()
  WHERE id = NEW.invoice_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_payment_insert ON payments;
CREATE TRIGGER on_payment_insert
  AFTER INSERT OR UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_invoice_payment_status();

-- ============================================================
-- ATTACHMENTS (Supabase Storage references)
-- ============================================================
CREATE TABLE IF NOT EXISTS attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  visit_id UUID REFERENCES visits(id) ON DELETE SET NULL,
  file_url TEXT NOT NULL,
  file_name TEXT,
  file_type TEXT,
  uploaded_by UUID REFERENCES profiles(id),
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;

-- Helper: get current user role
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Staff can view all profiles" ON profiles
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Doctors policies
CREATE POLICY "Authenticated users can view doctors" ON doctors
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admin can manage doctors" ON doctors
  FOR ALL USING (get_user_role() = 'admin');
CREATE POLICY "Staff can insert doctors" ON doctors
  FOR INSERT WITH CHECK (get_user_role() IN ('admin', 'receptionist'));

-- Patients policies
CREATE POLICY "Staff can view patients" ON patients
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Staff can insert patients" ON patients
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Staff can update patients" ON patients
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Appointments policies
CREATE POLICY "Staff can view appointments" ON appointments
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Staff can manage appointments" ON appointments
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Visits policies
CREATE POLICY "Staff can view visits" ON visits
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Doctors and staff can manage visits" ON visits
  FOR ALL USING (get_user_role() IN ('admin', 'doctor', 'nurse', 'receptionist'));

-- Prescriptions policies
CREATE POLICY "Staff can view prescriptions" ON prescriptions
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Doctors can manage prescriptions" ON prescriptions
  FOR ALL USING (get_user_role() IN ('admin', 'doctor'));

-- Invoices & payments policies
CREATE POLICY "Staff can view invoices" ON invoices
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Staff can manage invoices" ON invoices
  FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Staff can view payments" ON payments
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Staff can manage payments" ON payments
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Attachments policies
CREATE POLICY "Staff can view attachments" ON attachments
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Staff can manage attachments" ON attachments
  FOR ALL USING (auth.uid() IS NOT NULL);

-- ============================================================
-- STORAGE BUCKET (run separately in Storage settings or via API)
-- Create bucket named "patient-files" with public access disabled
-- ============================================================

-- Enable Realtime for appointments
ALTER PUBLICATION supabase_realtime ADD TABLE appointments;
