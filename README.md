# Sales Template Updater

A multi-user web application for processing daily sales files and updating pre-uploaded templates with role-based access control.

## Features

### User Features (Distributors)
- ✅ Upload and manage personal templates
- ✅ Upload daily sales files
- ✅ Automatic sales data summarization
- ✅ Map DS Names to SURVEYOR values
- ✅ Download processed files with preserved template structure
- ✅ View upload history
- ✅ Warning notifications for unmapped SKUs

### Admin Features
- ✅ Create and manage user accounts
- ✅ Enable/disable users
- ✅ Reset user passwords
- ✅ Global SKU mapping management (one-to-many support)
- ✅ Download distributor reports (raw and mapped summaries)
- ✅ View all user activities

## Technology Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + Storage)
- **State Management**: Zustand
- **Routing**: React Router v6
- **Excel Processing**: XLSX library
- **Form Handling**: React Hook Form

## Prerequisites

- Node.js 18+ and npm
- Supabase account (free tier works)

## Setup Instructions

### 1. Clone and Install Dependencies

```bash
cd "c:\Users\HP\Documents\ITC\Stock issue\code\Stock issue template"
npm install
```

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the contents of `supabase-schema.sql`
3. Go to **Storage** and create three buckets:
   - `templates` (private)
   - `sales-files` (private)
   - `output-files` (private)
4. For each bucket, add storage policies:
   - Users can upload/read their own files
   - Admins can read all files

### 3. Create Admin User

1. In Supabase Dashboard, go to **Authentication** → **Users**
2. Click **Add User** and create:
   - Email: `admin@app.local`
   - Password: `admin123` (or your choice)
3. Copy the User ID
4. Go to **SQL Editor** and run:
```sql
INSERT INTO users (id, username, role, status)
VALUES ('PASTE_USER_ID_HERE', 'admin', 'admin', 'active');
```

### 4. Configure Environment Variables

1. Copy `.env.example` to `.env`:
```bash
copy .env.example .env
```

2. Edit `.env` and add your Supabase credentials:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Find these in Supabase Dashboard → **Settings** → **API**

### 5. Run the Application

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Usage Guide

### For Distributors (Users)

1. **Login** with your username and password
2. **Upload Template**:
   - Click "Upload Template" and select your Excel file
   - Template must contain: `SURVEYOR`, `VARIANT DESCRIPTION`, `QUANTITY (in M)`
3. **Upload Sales File**:
   - Click "Upload Sales File" and select your daily sales Excel
   - Sales file must contain: `DS Name`, `Market SKU`, `Invoice Qty`
4. **Handle Unmapped SKUs**:
   - If any Market SKUs don't have mappings, you'll see a warning
   - Processing continues with mapped SKUs only
5. **Map DS Names**:
   - Map each DS Name from sales to a SURVEYOR from your template
   - All mappings must be complete to proceed
6. **Download**:
   - File is automatically generated and downloaded
   - File name matches your original template name
7. **View History**:
   - Switch to "Upload History" tab to see past uploads
   - Download previous processed files

### For Admins

1. **User Management**:
   - Create new distributor accounts
   - Enable/disable users
   - Reset passwords
2. **SKU Mapping**:
   - Add mappings: Market SKU → VARIANT DESCRIPTION
   - One Market SKU can map to multiple VARIANT DESCRIPTIONs
   - Mappings are global and apply to all users
3. **Distributor Reports**:
   - Select a distributor and upload date
   - Download raw summary (DS Name, Market SKU, Qty)
   - Download mapped summary (SURVEYOR, VARIANT DESCRIPTION, Qty)

## File Structure

```
src/
├── components/
│   ├── admin/
│   │   ├── UserManagement.tsx      # User CRUD operations
│   │   ├── SKUMapping.tsx          # Global SKU mapping
│   │   └── DistributorReports.tsx  # Report downloads
│   ├── auth/
│   │   └── ProtectedRoute.tsx      # Route authorization
│   └── shared/
│       ├── Layout.tsx               # App layout wrapper
│       ├── Navbar.tsx               # Navigation bar
│       └── FileUploader.tsx         # File upload component
├── lib/
│   ├── supabase.ts                  # Supabase client
│   ├── excelProcessor.ts            # Excel parsing & processing
│   └── types.ts                     # TypeScript definitions
├── pages/
│   ├── Login.tsx                    # Login page
│   ├── UserDashboard.tsx            # User main page
│   └── AdminDashboard.tsx           # Admin main page
├── stores/
│   └── authStore.ts                 # Authentication state
├── App.tsx                          # Main app component
├── main.tsx                         # Entry point
└── index.css                        # Global styles
```

## Processing Logic

1. **Sales File Upload**:
   - Parse Excel file
   - Clean data (trim, remove blanks, convert to numeric)
   - Filter out zero/null quantities
   - Group by (DS Name + Market SKU)
   - Sum Invoice Qty for each group
   - Store summary in database

2. **SKU Mapping Check**:
   - Get all unique Market SKUs from sales
   - Check against global SKU mappings
   - Show warning for unmapped SKUs
   - Continue with mapped SKUs only

3. **DS Mapping**:
   - Extract unique SURVEYOR values from template
   - User maps each DS Name to a SURVEYOR
   - Store mappings in database

4. **Template Update**:
   - For each template row:
     - Find matching sales where DS Name maps to SURVEYOR
     - Find matching sales where Market SKU maps to VARIANT DESCRIPTION
     - Update QUANTITY (in M) with total
     - Set to 0 if no match found
   - Preserve all other columns and formatting

5. **File Generation**:
   - Generate Excel with same structure as template
   - Save with original template filename
   - Upload to storage
   - Provide download link

## Important Rules

### Template Structure
- ✅ Structure is NEVER changed
- ✅ Only `QUANTITY (in M)` column is updated
- ✅ All formatting is preserved
- ✅ Output filename = Template filename

### SKU Mapping
- ✅ One Market SKU can map to multiple VARIANT DESCRIPTIONs
- ✅ Mappings are global (apply to all users)
- ✅ Mappings persist until admin changes them
- ✅ Unmapped SKUs are ignored (with warning)

### DS Mapping
- ✅ All DS Names must be mapped
- ✅ Download disabled until mapping complete
- ✅ Mappings can be remembered per user (optional enhancement)

## Security

- Row Level Security (RLS) enforced in Supabase
- Users can only access their own data
- Admins have elevated permissions
- File storage is private with access controls
- Passwords are hashed by Supabase Auth

## Troubleshooting

### "Supabase credentials not found"
- Make sure `.env` file exists with correct values
- Restart dev server after changing `.env`

### "Template must contain required columns"
- Verify template has: `SURVEYOR`, `VARIANT DESCRIPTION`, `QUANTITY (in M)`
- Check for exact spelling and case

### "Sales file is empty or invalid"
- Verify sales file has: `DS Name`, `Market SKU`, `Invoice Qty`
- Check for exact spelling and case
- Ensure file has data rows (not just headers)

### "Failed to reset password"
- Password reset requires Supabase admin API access
- Use Supabase Dashboard to reset passwords manually

## Build for Production

```bash
npm run build
```

Deploy the `dist` folder to any static hosting service (Vercel, Netlify, etc.)

## License

MIT

## Support

For issues or questions, contact your system administrator.
