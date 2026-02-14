-- Sales Template Updater Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends auth.users)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
  status TEXT NOT NULL CHECK (status IN ('active', 'disabled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User templates table
CREATE TABLE IF NOT EXISTS user_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  upload_date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- SKU mapping table (global - admin managed)
CREATE TABLE IF NOT EXISTS sku_mapping (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  market_sku TEXT NOT NULL,
  variant_description TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Upload history table
CREATE TABLE IF NOT EXISTS upload_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sales_file_name TEXT NOT NULL,
  sales_file_path TEXT NOT NULL,
  template_file_name TEXT NOT NULL,
  output_file_name TEXT NOT NULL,
  output_file_path TEXT,
  upload_date TIMESTAMPTZ DEFAULT NOW(),
  status TEXT NOT NULL CHECK (status IN ('processing', 'completed', 'failed')),
  error_message TEXT
);

-- Sales summary table
CREATE TABLE IF NOT EXISTS sales_summary (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  upload_id UUID NOT NULL REFERENCES upload_history(id) ON DELETE CASCADE,
  ds_name TEXT NOT NULL,
  market_sku TEXT NOT NULL,
  total_qty NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Salesman mapping table
CREATE TABLE IF NOT EXISTS salesman_mapping (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  upload_id UUID NOT NULL REFERENCES upload_history(id) ON DELETE CASCADE,
  ds_name TEXT NOT NULL,
  surveyor_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_templates_user_id ON user_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_sku_mapping_market_sku ON sku_mapping(market_sku);
CREATE INDEX IF NOT EXISTS idx_upload_history_user_id ON upload_history(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_summary_upload_id ON sales_summary(upload_id);
CREATE INDEX IF NOT EXISTS idx_salesman_mapping_upload_id ON salesman_mapping(upload_id);

-- Row Level Security (RLS) Policies

-- Helper function to check admin status (PREVENTS INFINITE RECURSION)
-- This function runs with security definer privileges, bypassing RLS checks
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = auth.uid()
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE sku_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE upload_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE salesman_mapping ENABLE ROW LEVEL SECURITY;

-- Users table policies
CREATE POLICY "Users can view their own data"
  ON users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all users"
  ON users FOR SELECT
  USING (is_admin());

CREATE POLICY "Admins can insert users"
  ON users FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update users"
  ON users FOR UPDATE
  USING (is_admin());

-- User templates policies
CREATE POLICY "Users can view their own templates"
  ON user_templates FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own templates"
  ON user_templates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all templates"
  ON user_templates FOR SELECT
  USING (is_admin());

-- SKU mapping policies (global - all can read, only admin can write)
CREATE POLICY "Everyone can view SKU mappings"
  ON sku_mapping FOR SELECT
  USING (true);

-- Only admins can insert/update/delete
CREATE POLICY "Admins can insert SKU mappings"
  ON sku_mapping FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update SKU mappings"
  ON sku_mapping FOR UPDATE
  USING (is_admin());

CREATE POLICY "Admins can delete SKU mappings"
  ON sku_mapping FOR DELETE
  USING (is_admin());

-- Upload history policies
CREATE POLICY "Users can view their own upload history"
  ON upload_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own upload history"
  ON upload_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own upload history"
  ON upload_history FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all upload history"
  ON upload_history FOR SELECT
  USING (is_admin());

-- Sales summary policies
CREATE POLICY "Users can view their own sales summary"
  ON sales_summary FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM upload_history
      WHERE upload_history.id = sales_summary.upload_id
      AND upload_history.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own sales summary"
  ON sales_summary FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM upload_history
      WHERE upload_history.id = sales_summary.upload_id
      AND upload_history.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all sales summaries"
  ON sales_summary FOR SELECT
  USING (is_admin());

-- Salesman mapping policies
CREATE POLICY "Users can view their own salesman mappings"
  ON salesman_mapping FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM upload_history
      WHERE upload_history.id = salesman_mapping.upload_id
      AND upload_history.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own salesman mappings"
  ON salesman_mapping FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM upload_history
      WHERE upload_history.id = salesman_mapping.upload_id
      AND upload_history.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all salesman mappings"
  ON salesman_mapping FOR SELECT
  USING (is_admin());

-- Create storage buckets (run these in Supabase Dashboard -> Storage)
-- 1. Create bucket: templates
-- 2. Create bucket: sales-files
-- 3. Create bucket: output-files

-- Storage policies (add these in Supabase Dashboard -> Storage -> Policies)
-- For 'templates' bucket:
--   - Users can upload to their own folder: bucket_id = 'templates' AND (storage.foldername(name))[1] = auth.uid()::text
--   - Users can read their own files: bucket_id = 'templates' AND (storage.foldername(name))[1] = auth.uid()::text
--   - Admins can read all: bucket_id = 'templates' AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')

-- Similar policies for 'sales-files' and 'output-files' buckets

-- Insert default admin user (password: admin123)
-- Note: You need to create this user in Supabase Auth first, then insert the record here
-- Or use the application's user creation feature
-- OPTIONAL: Manually insert an admin user if needed
-- Note: It's better to create the user in Supabase Auth Dashboard, then update their role to 'admin'
/*
INSERT INTO users (id, username, role, status)
VALUES (
  'REPLACE_WITH_ADMIN_USER_ID', -- This causes error if not replaced with real UUID
  'admin',
  'admin',
  'active'
) ON CONFLICT (id) DO NOTHING;
*/

-- Trigger to handle new user creation automatically (Regular Users)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, username, role, status)
  VALUES (new.id, split_part(new.email, '@', 1), 'user', 'active');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger execution
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- HELPER: Promote your specific admin user (Run this AFTER signing up)
-- UPDATE public.users SET role = 'admin' WHERE id IN (SELECT id FROM auth.users WHERE email = 'gowthamitcgk@gmail.com');
-- OR if username trigger worked:
-- UPDATE public.users SET role = 'admin' WHERE username = 'gowthamitcgk'; -- Replace 'admin' with their username (part before @ in email)
