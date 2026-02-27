import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Returns true only when we have a real, non-placeholder Supabase URL
export const isSupabaseConfigured = (): boolean => {
    return !!supabaseUrl &&
        !supabaseUrl.includes('your-project') &&
        !supabaseUrl.includes('your_supabase') &&
        supabaseUrl.startsWith('https://');
};

if (!isSupabaseConfigured()) {
    console.warn(
        'Supabase credentials not found or are placeholder values. ' +
        'Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.'
    );
}

// Create client; if URL is empty use a safe placeholder so the SDK doesn't crash
export const supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder'
);

// Storage bucket names
export const STORAGE_BUCKETS = {
    TEMPLATES: 'templates',
    SALES_FILES: 'sales-files',
    OUTPUT_FILES: 'output-files',
} as const;
