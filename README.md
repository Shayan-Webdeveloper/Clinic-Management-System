# ClinicCare — Clinic Management System

A modern, responsive clinic management system built with **HTML**, **CSS**, **Bootstrap 5**, **JavaScript**, and **Supabase**.

![ClinicCare](https://img.shields.io/badge/Stack-HTML%20%7C%20Bootstrap%20%7C%20Supabase-0d9488)

## Features

- **Authentication** — Staff login, signup, password reset with role-based access (Admin, Doctor, Receptionist, Nurse)
- **Patient Management** — Add, edit, search, archive patients with full profiles
- **Doctor Management** — Doctor profiles, specializations, fees, schedules
- **Appointments** — Schedule, reschedule, status workflow with real-time updates
- **Visit Records (EMR Lite)** — Diagnosis, symptoms, notes, follow-ups
- **Prescriptions** — Create and print prescriptions
- **Billing** — Invoices, payments, daily/monthly revenue reports
- **Dashboard** — Stats, today's schedule, recent patients

## Quick Start

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a free project
2. Wait for the project to finish provisioning

### 2. Run the Database Schema

1. Open **SQL Editor** in your Supabase dashboard
2. Copy the contents of `supabase/schema.sql`
3. Paste and click **Run**

### 3. Configure Authentication

In Supabase Dashboard → **Authentication** → **Providers**:
- Enable **Email** provider
- (Optional) Disable "Confirm email" for faster testing under **Email** settings

### 4. Add Your API Keys

Edit `js/config.js`:

```javascript
const SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key-here';
```

Find these in **Project Settings → API**.

### 5. Run the App

Open the project in a local server (required for Supabase auth):

```bash
# Using Python
cd clinic-management-system
python -m http.server 8080

# Or using Node.js
npx serve .
```

Visit `http://localhost:8080`

### 6. Create Your First Account

1. Open the app and click **Create account**
2. Register as **Admin** for full access
3. Sign in and start adding doctors and patients

## Project Structure

```
clinic-management-system/
├── index.html          # Login / Register page
├── app.html            # Main dashboard application
├── css/
│   └── style.css       # Modern SaaS styling
├── js/
│   ├── config.js       # Supabase credentials
│   ├── supabase-client.js
│   ├── auth.js
│   ├── dashboard.js
│   ├── patients.js
│   ├── doctors.js
│   ├── appointments.js
│   ├── visits.js
│   ├── prescriptions.js
│   ├── billing.js
│   ├── app.js          # Router & navigation
│   └── utils.js
└── supabase/
    └── schema.sql      # Database schema + RLS policies
```

## User Roles

| Role | Permissions |
|------|-------------|
| **Admin** | Full access — manage doctors, all records |
| **Doctor** | View schedule, record visits, write prescriptions |
| **Receptionist** | Patients, appointments, billing |
| **Nurse** | View records, assist with visits |

## Appointment Status Flow

```
Scheduled → Checked In → In Progress → Completed
                ↓
           Cancelled / No Show
```

## Optional: File Storage

To enable lab report / X-ray uploads:

1. In Supabase Dashboard → **Storage**, create a bucket named `patient-files`
2. Set it to **private**
3. Add storage policies for authenticated users

## Optional: Realtime Notifications

Realtime is enabled for the `appointments` table. Appointment changes sync automatically across open browser tabs.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML5, CSS3, Bootstrap 5.3, Bootstrap Icons |
| Backend | Supabase (PostgreSQL, Auth, Realtime, Storage) |
| Security | Row Level Security (RLS) policies |

## License

MIT — free to use and modify for your clinic.
