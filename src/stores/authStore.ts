import { create } from 'zustand';
import { supabase } from '../lib/supabase';
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
            // Check if in demo mode
            const isDemo = import.meta.env.VITE_SUPABASE_URL?.includes('your-project');

            if (isDemo) {
                // Check sessionStorage for demo user
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
        const isDemo = import.meta.env.VITE_SUPABASE_URL?.includes('your-project');

        if (isDemo) {
            // Demo mode authentication
            const demoUser = DEMO_USERS[identifier.toLowerCase()];

            if (demoUser && (password === 'demo' || password === 'admin123' || password === 'user123')) {
                // Simulate network delay
                await new Promise(resolve => setTimeout(resolve, 500));
                set({ user: demoUser });
                sessionStorage.setItem('demoUser', JSON.stringify(demoUser));
                return;
            }
            throw new Error('Invalid credentials. Try: admin/demo or user/demo');
        }

        // Real Supabase Authentication
        const { data, error } = await supabase.auth.signInWithPassword({
            email: identifier,
            password: password
        });

        if (error) throw error;

        // Profile will be loaded by onAuthStateChange listener or subsequent fetch
        // But we fetch it here to be sure
        if (data.user) {
            const { data: profile, error: profileError } = await supabase
                .from('users')
                .select('*')
                .eq('id', data.user.id)
                .single();

            if (profileError || !profile) {
                // Determine role based on specific email if profile doesn't exist yet (though trigger should handle it)
                // Fallback implementation if trigger fails or delays
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
        const isDemo = import.meta.env.VITE_SUPABASE_URL?.includes('your-project');

        if (isDemo) {
            throw new Error('Sign up not available in demo mode');
        }

        const { data, error } = await supabase.auth.signUp({
            email,
            password,
        });

        if (error) throw error;

        // Triggers in Supabase will handle profile creation
        // We can optionally sign them in immediately if auto-confirm is on
        if (data.user) {
            // If email confirmation is required, user won't be signed in yet
            // Check if session exists
            if (data.session) {
                set({ user: { id: data.user.id, username: email.split('@')[0], role: 'user', status: 'active' } as User });
            }
        }
    },

    signOut: async () => {
        const isDemo = import.meta.env.VITE_SUPABASE_URL?.includes('your-project');

        if (isDemo) {
            sessionStorage.removeItem('demoUser');
            set({ user: null });
        } else {
            await supabase.auth.signOut();
            set({ user: null });
        }
    },
}));
