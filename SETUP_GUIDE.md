# Quick Setup Guide - Sales Template Updater

## Step-by-Step Setup

### 1. Install Dependencies ✅
Already completed! Dependencies are installed.

### 2. Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Click "Start your project"
3. Sign in with GitHub (or create account)
4. Click "New Project"
5. Fill in:
   - **Name**: Sales Template Updater
   - **Database Password**: (choose a strong password)
   - **Region**: Choose closest to you
   - **Pricing Plan**: Free
6. Click "Create new project"
7. Wait 2-3 minutes for setup to complete

### 3. Set Up Database Schema

1. In your Supabase project, click **SQL Editor** (left sidebar)
2. Click **New Query**
3. Open the file `supabase-schema.sql` in this project
4. Copy ALL the contents
5. Paste into the SQL Editor
6. Click **Run** (or press Ctrl+Enter)
7. You should see "Success. No rows returned"

### 4. Create Storage Buckets

1. Click **Storage** (left sidebar)
2. Click **New bucket**
3. Create bucket:
   - **Name**: `templates`
   - **Public**: OFF (keep private)
   - Click **Create bucket**
4. Repeat for:
   - `sales-files` (private)
   - `output-files` (private)

### 5. Set Up Storage Policies

For each bucket (`templates`, `sales-files`, `output-files`):

1. Click on the bucket name
2. Click **Policies** tab
3. Click **New Policy**
4. Click **For full customization**

**Policy 1: Users can upload to their own folder**
- Policy name: `Users can upload own files`
- Target roles: `authenticated`
- Policy command: `INSERT`
- USING expression:
```sql
bucket_id = 'templates' AND (storage.foldername(name))[1] = auth.uid()::text
```
- Click **Review** → **Save policy**

**Policy 2: Users can read their own files**
- Policy name: `Users can read own files`
- Target roles: `authenticated`
- Policy command: `SELECT`
- USING expression:
```sql
bucket_id = 'templates' AND (storage.foldername(name))[1] = auth.uid()::text
```
- Click **Review** → **Save policy**

**Policy 3: Admins can read all files**
- Policy name: `Admins can read all`
- Target roles: `authenticated`
- Policy command: `SELECT`
- USING expression:
```sql
bucket_id = 'templates' AND EXISTS (
  SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
)
```
- Click **Review** → **Save policy**

Repeat these 3 policies for `sales-files` and `output-files` buckets (change `bucket_id` accordingly).

### 6. Create Admin User

1. Click **Authentication** (left sidebar)
2. Click **Users** tab
3. Click **Add user** → **Create new user**
4. Fill in:
   - **Email**: `admin@app.local`
   - **Password**: `admin123` (or your choice)
   - **Auto Confirm User**: ON
5. Click **Create user**
6. **IMPORTANT**: Copy the User ID (UUID) that appears

7. Go back to **SQL Editor**
8. Run this query (replace with your copied User ID):
```sql
INSERT INTO users (id, username, role, status)
VALUES ('PASTE_YOUR_USER_ID_HERE', 'admin', 'admin', 'active');
```

### 7. Get Supabase Credentials

1. Click **Settings** (left sidebar, bottom)
2. Click **API**
3. Copy these two values:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon public** key (under "Project API keys")

### 8. Configure Environment Variables

1. In this project folder, create a file named `.env`
2. Add these lines (replace with your actual values):
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```
3. Save the file

### 9. Start the Application

Run this command:
```bash
npm run dev
```

You should see:
```
VITE v5.x.x  ready in xxx ms

➜  Local:   http://localhost:3000/
```

### 10. Test the Application

1. Open [http://localhost:3000](http://localhost:3000)
2. You should see the login page
3. Login with:
   - **Username**: `admin`
   - **Password**: `admin123` (or what you set)
4. You should be redirected to the Admin Dashboard

## Next Steps

### Create a Test User

1. In Admin Dashboard, go to **User Management** tab
2. Click **Create User**
3. Enter:
   - **Username**: `testuser`
   - **Password**: `test123`
4. Click **Create User**

### Add Some SKU Mappings

1. Go to **SKU Mapping** tab
2. Click **Add Mapping**
3. Enter:
   - **Market SKU**: `SKU001`
   - **VARIANT DESCRIPTION**: `Product A`
4. Click **Add Mapping**
5. Add a few more mappings for testing

### Test User Workflow

1. Sign out (top right)
2. Login as `testuser` / `test123`
3. You should see the User Dashboard
4. Try uploading a template and sales file

## Troubleshooting

### "Supabase credentials not found"
- Make sure `.env` file exists in the project root
- Check that values don't have quotes or extra spaces
- Restart the dev server: Stop (Ctrl+C) and run `npm run dev` again

### "Failed to create user" in Admin panel
- Check that you ran the database schema SQL
- Verify RLS policies are enabled
- Check browser console for detailed errors

### Template/Sales upload fails
- Verify storage buckets are created
- Check storage policies are set correctly
- Ensure file has required columns with exact names

### Can't login
- Verify admin user was created in Supabase Auth
- Verify user record was inserted in `users` table
- Check that username and password match

## Production Deployment

When ready to deploy:

1. Run `npm run build`
2. Deploy the `dist` folder to:
   - Vercel
   - Netlify
   - GitHub Pages
   - Any static hosting

3. Set environment variables in your hosting platform:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

## Need Help?

- Check the main `README.md` for detailed documentation
- Review Supabase documentation: [https://supabase.com/docs](https://supabase.com/docs)
- Check browser console for error messages
