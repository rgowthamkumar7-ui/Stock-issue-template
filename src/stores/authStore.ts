import { create } from 'zustand';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { User } from '../lib/types';

interface AuthState {
    user: User | null;
    loading: boolean;
    signIn: (identifier: string, password: string) => Promise<void>;
    signUp: (email: string, password: string) => Promise<void>;
    signOut: () => Promise<void>;
    checkAuth: () => Promise<void>;
}

// Demo users
const DEMO_USERS: Record<string, User> = {
    admin: {
        id: 'demo-admin-id',
        username: 'admin',
        role: 'admin',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    },
    user: {
        id: 'demo-user-id',
        username: 'user',
        role: 'user',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    },
};

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    loading: true,

    checkAuth: async () => {
        try {
            // If Supabase is not configured, fall back to demo/session mode
            if (!isSupabaseConfigured()) {
                const storedUser = sessionStorage.getItem('demoUser');
                if (storedUser) {
                    set({ user: JSON.parse(storedUser), loading: false });
                    return;
                }
                set({ user: null, loading: false });
                return;
            }

            // Real Supabase Auth Check
            const { data: { session } } = await supabase.auth.getSession();

            if (session?.user) {
                // Fetch user profile
                const { data: profile, error } = await supabase
                    .from('users')
                    .select('*')
                    .eq('id', session.user.id)
                    .single();

                if (profile && !error) {
                    set({ user: profile, loading: false });
                } else {
                    console.error('Profile load error:', error);
                    set({ user: null, loading: false });
                }
            } else {
                set({ user: null, loading: false });
            }
        } catch (error) {
            console.error('Check auth error:', error);
            set({ user: null, loading: false });
        }
    },

    signIn: async (identifier: string, password: string) => {
        if (!isSupabaseConfigured()) {
            // Demo / offline mode authentication
            const demoUser = DEMO_USERS[identifier.toLowerCase()];

            if (demoUser && (password === 'demo' || password === 'admin123' || password === 'user123')) {
                await new Promise(resolve => setTimeout(resolve, 500));
                set({ user: demoUser });
                sessionStorage.setItem('demoUser', JSON.stringify(demoUser));
                return;
            }
            throw new Error('Invalid credentials. Try: admin/demo or user/demo');
        }

        // Real Supabase Authentication
        let data: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>['data'];
        let error: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>['error'];

        try {
            const result = await supabase.auth.signInWithPassword({
                email: identifier,
                password: password,
            });
            data = result.data;
            error = result.error;
        } catch (networkErr) {
            // Network-level failure (no internet, CORS, DNS etc.)
            throw new Error(
                'Unable to reach the server. Please check your internet connection and try again.'
            );
        }

        if (error) {
            // Make common Supabase errors more human-readable
            if (error.message === 'Failed to fetch') {
                throw new Error(
                    'Unable to reach the server. Please check your internet connection and try again.'
                );
            }
            throw error;
        }

        if (data.user) {
            const { data: profile, error: profileError } = await supabase
                .from('users')
                .select('*')
                .eq('id', data.user.id)
                .single();

            if (profileError || !profile) {
                // Fallback if the DB trigger hasn't created the profile yet
                const role = identifier === 'gowthamitcgk@gmail.com' ? 'admin' : 'user';
                const newProfile = {
                    id: data.user.id,
                    username: identifier.split('@')[0],
                    role: role,
                    status: 'active'
                };
                set({ user: newProfile as User });
            } else {
                set({ user: profile });
            }
        }
    },

    signUp: async (email: string, password: string) => {
        if (!isSupabaseConfigured()) {
            throw new Error('Sign up not available in demo mode');
        }

        let data: Awaited<ReturnType<typeof supabase.auth.signUp>>['data'];
        let error: Awaited<ReturnType<typeof supabase.auth.signUp>>['error'];

        try {
            const result = await supabase.auth.signUp({ email, password });
            data = result.data;
            error = result.error;
        } catch (networkErr) {
            throw new Error(
                'Unable to reach the server. Please check your internet connection and try again.'
            );
        }

        if (error) {
            if (error.message === 'Failed to fetch') {
                throw new Error(
                    'Unable to reach the server. Please check your internet connection and try again.'
                );
            }
            throw error;
        }

        if (data.user) {
            if (data.session) {
                set({ user: { id: data.user.id, username: email.split('@')[0], role: 'user', status: 'active' } as User });
            }
        }
    },

    signOut: async () => {
        if (!isSupabaseConfigured()) {
            sessionStorage.removeItem('demoUser');
            set({ user: null });
        } else {
            await supabase.auth.signOut();
            set({ user: null });
        }
    },
}));
