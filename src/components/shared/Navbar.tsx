import React, { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { User } from '../../lib/types';

export const Navbar: React.FC = () => {
    const { user, signOut, updateProfile } = useAuthStore();
    const navigate = useNavigate();
    const location = useLocation();

    // Profile dropdown state
    const [showProfile, setShowProfile] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [wdCode, setWdCode] = useState('');
    const [wdName, setWdName] = useState('');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [profileError, setProfileError] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Contextual data state
    const [loadingInfo, setLoadingInfo] = useState(false);
    const [managerName, setManagerName] = useState<string | null>(null);
    const [mappedWDs, setMappedWDs] = useState<User[]>([]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setShowProfile(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const fetchProfileInfo = async () => {
        if (!user) return;
        setLoadingInfo(true);
        try {
            if (user.role === 'user' && user.manager_id) {
                const { data } = await supabase.from('users').select('username').eq('id', user.manager_id).single();
                if (data) setManagerName(data.username);
            } else if (user.role === 'manager') {
                const { data } = await supabase
                    .from('users')
                    .select('*')
                    .eq('manager_id', user.id)
                    .eq('role', 'user')
                    .eq('status', 'active');
                if (data) setMappedWDs(data as User[]);
            }
        } catch (e) {
            console.error('Error fetching profile info', e);
        } finally {
            setLoadingInfo(false);
        }
    };

    const openProfile = () => {
        setWdCode(user?.wd_code || '');
        setWdName(user?.wd_name || '');
        setProfileError('');
        setSaved(false);
        setEditMode(false);
        setShowProfile(v => {
            const nextShow = !v;
            if (nextShow) {
                fetchProfileInfo();
            }
            return nextShow;
        });
    };

    const handleSave = async () => {
        setProfileError('');
        if (!wdCode.trim()) { setProfileError('WD Code is required.'); return; }
        if (!wdName.trim()) { setProfileError('WD Name is required.'); return; }
        setSaving(true);
        try {
            await updateProfile({ wd_code: wdCode.trim(), wd_name: wdName.trim() });
            setSaved(true);
            setTimeout(() => { 
                setSaved(false); 
                setEditMode(false); 
            }, 1400);
        } catch (e: any) {
            setProfileError(e?.message || 'Failed to save.');
        } finally {
            setSaving(false);
        }
    };

    const handleSignOut = async () => {
        await signOut();
        navigate('/login');
    };

    const showHomeButton = location.pathname !== '/home'
        && location.pathname !== '/manager-home'
        && location.pathname !== '/admin';

    const homeRoute = user?.role === 'admin' ? '/admin'
        : user?.role === 'manager' ? '/manager-home'
            : '/home';

    if (!user) return null;

    const profileIncomplete = user.role === 'user' && (!user.wd_code || !user.wd_name);
    
    // Auto-open edit mode if incomplete
    const isEditing = profileIncomplete || editMode;

    return (
        <nav className="bg-slate-900 shadow-xl border-b border-amber-500/20">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    {/* Left: Logo + Home */}
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate(homeRoute)} className="flex items-center gap-2 group">
                            <span className="text-2xl font-black bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent tracking-tight group-hover:from-amber-300 group-hover:to-orange-400 transition-all duration-200">
                                LeanX
                            </span>
                        </button>
                        <span className="text-xs font-semibold uppercase tracking-widest text-slate-400 hidden sm:block">
                            Distributor Central
                        </span>

                        {showHomeButton && (
                            <button
                                onClick={() => navigate(homeRoute)}
                                className="ml-4 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 hover:border-amber-500/50 transition-all duration-200 text-sm font-medium"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                                </svg>
                                Home
                            </button>
                        )}
                    </div>

                    {/* Right: Profile button + Sign out */}
                    <div className="flex items-center gap-3">

                        {/* Profile Button - For user and manager */}
                        {user.role === 'user' || user.role === 'manager' ? (
                            <div className="relative" ref={dropdownRef}>
                                <button
                                    id="btn-navbar-profile"
                                    onClick={openProfile}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all duration-200 text-sm font-medium ${
                                        showProfile
                                            ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                                            : 'bg-slate-800 border-slate-700 hover:border-amber-500/40 hover:bg-slate-700 text-slate-300 hover:text-amber-300'
                                    }`}
                                >
                                    {/* Avatar circle */}
                                    <div className="relative">
                                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-xs font-black">
                                            {user.username.charAt(0).toUpperCase()}
                                        </div>
                                        {profileIncomplete && (
                                            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-slate-900 animate-pulse" />
                                        )}
                                    </div>
                                    <span className="hidden sm:block font-bold">{user.username}</span>
                                    {user.wd_code && user.role === 'user' && (
                                        <span className="hidden sm:inline text-xs text-amber-500/70 font-semibold">
                                            ({user.wd_code})
                                        </span>
                                    )}
                                    {user.role === 'manager' && (
                                        <span className="hidden sm:inline px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] uppercase font-bold tracking-wider">
                                            Manager
                                        </span>
                                    )}
                                    <svg className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${showProfile ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>

                                {/* Dropdown Panel */}
                                {showProfile && (
                                    <div className="absolute right-0 top-full mt-2 w-80 bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl shadow-black/40 z-50 overflow-hidden animate-fadeIn">
                                        {/* Header */}
                                        <div className="px-5 py-4 border-b border-slate-700 bg-slate-800/50 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-black text-sm shadow-md">
                                                    {user.username.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-slate-100">{user.username}</p>
                                                    <p className="text-xs text-slate-400">
                                                        {user.role === 'user' ? 'Distributor Profile' : 'Manager Profile'}
                                                    </p>
                                                </div>
                                            </div>
                                            {user.role === 'user' && !isEditing && (
                                                <button 
                                                    onClick={() => setEditMode(true)}
                                                    className="text-amber-400 hover:text-amber-300 text-xs font-bold transition-colors"
                                                >
                                                    Edit
                                                </button>
                                            )}
                                        </div>

                                        {/* DISTRIBUTOR PROFILE VIEWS */}
                                        {user.role === 'user' && (
                                            <>
                                                {/* Editing form state */}
                                                {isEditing ? (
                                                    <div className="px-5 py-4 space-y-4">
                                                        {profileIncomplete && (
                                                            <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                                                                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                                </svg>
                                                                Required to place MDO orders
                                                            </div>
                                                        )}

                                                        <div>
                                                            <label htmlFor="navbar-wd-code" className="block text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-1.5">
                                                                WD Code <span className="text-red-400">*</span>
                                                            </label>
                                                            <input
                                                                id="navbar-wd-code"
                                                                type="text"
                                                                value={wdCode}
                                                                onChange={e => setWdCode(e.target.value)}
                                                                placeholder="e.g. WD001"
                                                                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-600 text-slate-100 text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400/50 transition-all font-mono"
                                                            />
                                                        </div>

                                                        <div>
                                                            <label htmlFor="navbar-wd-name" className="block text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-1.5">
                                                                WD / Distributor Name <span className="text-red-400">*</span>
                                                            </label>
                                                            <input
                                                                id="navbar-wd-name"
                                                                type="text"
                                                                value={wdName}
                                                                onChange={e => setWdName(e.target.value)}
                                                                placeholder="e.g. ABC Distributors"
                                                                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-600 text-slate-100 text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400/50 transition-all"
                                                            />
                                                        </div>

                                                        {profileError && (
                                                            <p className="text-xs text-red-400 bg-red-400/10 px-2 py-1.5 rounded">{profileError}</p>
                                                        )}

                                                        <div className="flex gap-2 pt-1">
                                                            <button
                                                                id="navbar-btn-save-profile"
                                                                onClick={handleSave}
                                                                disabled={saving || saved}
                                                                className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2 ${
                                                                    saved
                                                                        ? 'bg-green-500 text-white'
                                                                        : 'bg-gradient-to-r from-amber-400 to-orange-500 text-white hover:from-amber-300 hover:to-orange-400'
                                                                } disabled:opacity-75 disabled:cursor-not-allowed`}
                                                            >
                                                                {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Profile'}
                                                            </button>
                                                            {!profileIncomplete && (
                                                                <button 
                                                                    onClick={() => setEditMode(false)}
                                                                    className="px-4 py-2 rounded-xl bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors text-sm font-semibold"
                                                                >
                                                                    Cancel
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    /* Read-only state for users */
                                                    <div className="px-5 py-4 space-y-4">
                                                        <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-3">
                                                            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1">Company Details</p>
                                                            <p className="text-base font-black text-slate-100">{user.wd_name}</p>
                                                            <p className="text-sm font-mono text-amber-500/80 font-semibold">{user.wd_code}</p>
                                                        </div>
                                                        
                                                        <div className="flex items-center gap-3 text-sm border-t border-slate-700/60 pt-4">
                                                            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
                                                                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                                            </div>
                                                            <div>
                                                                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Assigned Manager</p>
                                                                <p className="text-slate-300 font-semibold">
                                                                    {loadingInfo ? <span className="animate-pulse">Loading...</span> : (managerName || <span className="text-slate-500 italic">None assigned</span>)}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        )}

                                        {/* MANAGER PROFILE VIEW */}
                                        {user.role === 'manager' && (
                                            <div className="px-5 py-4">
                                                <div className="flex items-center justify-between mb-3">
                                                    <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Mapped Distributors</p>
                                                    <span className="bg-slate-700 text-slate-300 text-[10px] px-2 py-0.5 rounded-full font-bold">
                                                        {mappedWDs.length}
                                                    </span>
                                                </div>
                                                
                                                {loadingInfo ? (
                                                    <div className="py-4 flex justify-center">
                                                        <svg className="animate-spin h-5 w-5 text-amber-500" viewBox="0 0 24 24" fill="none">
                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                                                        </svg>
                                                    </div>
                                                ) : mappedWDs.length > 0 ? (
                                                    <div className="max-h-60 overflow-y-auto space-y-2 pr-2 scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-800">
                                                        {mappedWDs.map(wd => (
                                                            <div key={wd.id} className="bg-slate-900 border border-slate-700 rounded-lg p-2.5 flex justify-between items-center group hover:border-amber-500/30 transition-colors">
                                                                <div className="min-w-0 pr-2">
                                                                    <p className="text-sm font-bold text-slate-200 truncate">{wd.wd_name || wd.username}</p>
                                                                    <p className="text-[10px] font-mono text-slate-400 truncate">{wd.wd_code || 'No code set'}</p>
                                                                </div>
                                                                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${wd.wd_code ? 'bg-green-500' : 'bg-red-500'}`} title={wd.wd_code ? 'Ready' : 'Profile Incomplete'} />
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 text-center">
                                                        <svg className="w-8 h-8 text-slate-600 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                                                        <p className="text-sm font-semibold text-slate-400">No WDs mapped to you yet.</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ) : (
                            /* Non-user/manager roles (Admin): just show username + role badge */
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-slate-400">Welcome,</span>
                                <span className="font-semibold text-slate-100">{user.username}</span>
                                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30">
                                    ADMIN
                                </span>
                            </div>
                        )}

                        {/* Sign Out */}
                        <button
                            onClick={handleSignOut}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition-all duration-200 text-sm"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            Sign Out
                        </button>
                    </div>
                </div>
            </div>
        </nav>
    );
};
