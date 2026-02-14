# Sales Template Auto Updater - Implementation Plan

## Technology Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for build tooling
- **Tailwind CSS** for styling
- **React Router** for navigation
- **Zustand** for state management
- **React Hook Form** for form handling
- **XLSX** library for Excel file processing

### Backend
- **Supabase** for:
  - Authentication (email/password)
  - PostgreSQL Database
  - File Storage
  - Row Level Security (RLS)

## Database Schema

### 1. users (extends Supabase auth.users)
```sql
- id (uuid, PK, references auth.users)
- username (text, unique)
- role (enum: 'admin', 'user')
- status (enum: 'active', 'disabled')
- created_at (timestamp)
- updated_at (timestamp)
```

### 2. user_templates
```sql
- id (uuid, PK)
- user_id (uuid, FK -> users.id)
- file_name (text)
- file_path (text) -- Supabase storage path
- upload_date (timestamp)
- created_at (timestamp)
```

### 3. sku_mapping (Global - Admin managed)
```sql
- id (uuid, PK)
- market_sku (text)
- variant_description (text)
- created_at (timestamp)
- created_by (uuid, FK -> users.id)
```

### 4. upload_history
```sql
- id (uuid, PK)
- user_id (uuid, FK -> users.id)
- sales_file_name (text)
- sales_file_path (text)
- template_file_name (text)
- output_file_name (text)
- output_file_path (text)
- upload_date (timestamp)
- status (enum: 'processing', 'completed', 'failed')
- error_message (text, nullable)
```

### 5. sales_summary
```sql
- id (uuid, PK)
- upload_id (uuid, FK -> upload_history.id)
- ds_name (text)
- market_sku (text)
- total_qty (numeric)
- created_at (timestamp)
```

### 6. salesman_mapping
```sql
- id (uuid, PK)
- upload_id (uuid, FK -> upload_history.id)
- ds_name (text)
- surveyor_name (text)
- created_at (timestamp)
```

## Application Structure

```
src/
├── components/
│   ├── auth/
│   │   ├── LoginForm.tsx
│   │   └── ProtectedRoute.tsx
│   ├── admin/
│   │   ├── UserManagement.tsx
│   │   ├── SKUMapping.tsx
│   │   └── DistributorReports.tsx
│   ├── user/
│   │   ├── TemplateUpload.tsx
│   │   ├── SalesUpload.tsx
│   │   ├── DSMapping.tsx
│   │   └── UploadHistory.tsx
│   ├── shared/
│   │   ├── Layout.tsx
│   │   ├── Navbar.tsx
│   │   └── FileUploader.tsx
├── lib/
│   ├── supabase.ts
│   ├── excelProcessor.ts
│   └── types.ts
├── stores/
│   └── authStore.ts
├── pages/
│   ├── AdminDashboard.tsx
│   ├── UserDashboard.tsx
│   └── Login.tsx
├── App.tsx
└── main.tsx
```

## Core Processing Logic

### Step 1: Sales File Upload & Summarization
1. User uploads sales file (Excel)
2. Parse file and extract: DS Name, Market SKU, Invoice Qty
3. Clean data: trim spaces, remove blanks, convert to numeric
4. Group by (DS Name + Market SKU) and SUM(Invoice Qty)
5. Store in `sales_summary` table

### Step 2: SKU Mapping Check
1. Get all unique Market SKUs from sales summary
2. Check against `sku_mapping` table
3. If unmapped SKUs exist:
   - Show popup with list
   - Continue processing with mapped SKUs only
   - Ignore unmapped SKUs

### Step 3: DS Name → SURVEYOR Mapping
1. Get all unique SURVEYOR values from user's template
2. Show popup with DS Names from sales
3. User maps each DS Name to a SURVEYOR
4. Store in `salesman_mapping` table
5. Enable download button only after complete mapping

### Step 4: Template Update
1. Load user's template file
2. For each row in template:
   - Read SURVEYOR and VARIANT DESCRIPTION
   - Find matching sales summary where:
     - DS Name maps to SURVEYOR (via salesman_mapping)
     - Market SKU maps to VARIANT DESCRIPTION (via sku_mapping)
   - Update QUANTITY (in M) column
   - If no match found, set to 0
3. Preserve all formatting and structure
4. Save with original template filename

### Step 5: File Download
1. Generate output file with same name as template
2. Store in Supabase storage
3. Provide download link to user

## Implementation Phases

### Phase 1: Project Setup ✓
- [x] Initialize Vite + React + TypeScript
- [x] Install dependencies
- [x] Configure Tailwind CSS
- [x] Set up Supabase client

### Phase 2: Database & Authentication
- [ ] Create Supabase project
- [ ] Set up database schema
- [ ] Configure RLS policies
- [ ] Implement authentication

### Phase 3: Admin Features
- [ ] User management (create, disable, reset password)
- [ ] SKU mapping interface
- [ ] Distributor reports download

### Phase 4: User Features
- [ ] Template upload/replace
- [ ] Sales file upload
- [ ] DS → SURVEYOR mapping UI
- [ ] File processing & download
- [ ] Upload history view

### Phase 5: Excel Processing
- [ ] Sales file parser
- [ ] Template reader
- [ ] Template updater (preserve structure)
- [ ] Summary generator

### Phase 6: Testing & Refinement
- [ ] End-to-end testing
- [ ] Error handling
- [ ] UI/UX polish
- [ ] Performance optimization

## Key Features

### Security
- Row Level Security (RLS) in Supabase
- Users can only access their own data
- Admin has elevated permissions
- Secure file storage with access controls

### Validation
- File format validation
- Required column checks
- Data type validation
- Duplicate upload prevention

### User Experience
- Clear error messages
- Progress indicators
- Confirmation dialogs
- Responsive design

## Next Steps
1. Set up Supabase project
2. Create database schema
3. Build authentication flow
4. Implement admin dashboard
5. Implement user dashboard
6. Build Excel processing logic
7. Test complete workflow
