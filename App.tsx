


import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Page, User, Project, FormType, FormField, UserRole, FormRecord, StatusUpdate, DraftRecord, TrainingMaterial, Notification, TrainingAssignment, SafetyDrill, WorkerDrill } from './types';
import { ShieldIcon, SAFETY_MODULES, FORM_CONFIGS, DocumentIcon, VideoIcon, ImageIcon } from './constants';
import { supabase } from './supabaseClient';
import { Session } from '@supabase/supabase-js';

// Dexie will be available globally from the script tag in index.html
declare const Dexie: any;

// Initialize the local 'outbox' database
const localDb = new Dexie("meil_safety_offline");
localDb.version(2).stores({
  upload_queue: '++id, data, file',
  drafts: '++id, form_type, project_id',
});

// --- UI COMPONENTS ---
const BackButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
    <button 
        onClick={onClick} 
        className="absolute top-3 left-3 z-20 w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-md hover:bg-gray-100 transition-transform active:scale-95"
        aria-label="Go back"
    >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
        </svg>
    </button>
);

const PieChart: React.FC<{ data: { label: string; value: number; color: string }[] }> = ({ data }) => {
    if (data.length === 0 || data.every(d => d.value === 0)) {
        return <div className="text-center text-gray-500 flex items-center justify-center h-full">No severity data available.</div>;
    }

    const total = data.reduce((sum, item) => sum + item.value, 0);
    const radius = 65;
    const cx = 80;
    const cy = 80;
    let startAngle = -90; // Start from top

    const polarToCartesian = (centerX: number, centerY: number, r: number, angleInDegrees: number) => {
        const angleInRadians = (angleInDegrees * Math.PI) / 180.0;
        return {
            x: centerX + (r * Math.cos(angleInRadians)),
            y: centerY + (r * Math.sin(angleInRadians)),
        };
    };

    const describeArc = (x: number, y: number, r: number, startAngle: number, endAngle: number) => {
        const start = polarToCartesian(x, y, r, endAngle);
        const end = polarToCartesian(x, y, r, startAngle);
        const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
        // To avoid collapsing the arc when it's a full circle
        if (endAngle - startAngle >= 360) {
            endAngle = startAngle + 359.99;
        }
        const d = [ "M", start.x, start.y, "A", r, r, 0, largeArcFlag, 0, end.x, end.y, "L", x, y, "Z" ].join(" ");
        return d;
    };

    return (
        <div className="w-full h-56 bg-gray-50 p-4 rounded-lg flex items-center justify-center sm:justify-around">
            <svg width="160" height="160" viewBox="0 0 160 160">
                {data.map((slice) => {
                    if (slice.value === 0) return null;
                    const sliceAngle = (slice.value / total) * 360;
                    const endAngle = startAngle + sliceAngle;
                    const pathData = describeArc(cx, cy, radius, startAngle, endAngle);
                    startAngle = endAngle;
                    return <path key={slice.label} d={pathData} fill={slice.color} />;
                })}
            </svg>
            <div className="flex flex-col space-y-2 ml-4">
                {data.map(slice => (
                    <div key={slice.label} className="flex items-center space-x-2">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: slice.color }}></div>
                        <span className="text-xs text-gray-700 font-medium">{slice.label} ({slice.value})</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

const ReportsBarChart: React.FC<{ data: { label: string; value: number }[] }> = ({ data }) => {
    const maxValue = Math.max(...data.map(d => d.value), 1);
    const colors = ['#1FA97C', '#F9A825', '#EF5350', '#42A5F5', '#AB47BC', '#FF7043'];

    if (data.length === 0) {
        return <div className="text-center text-gray-500 flex items-center justify-center h-full">No module data available.</div>;
    }

    return (
        <div className="w-full h-56 bg-gray-50 p-4 rounded-lg">
            <svg width="100%" height="100%" viewBox={`0 0 400 200`}>
                {data.map((d, i) => {
                    const barHeight = (d.value / maxValue) * 180;
                    const barWidth = 350 / data.length - 10;
                    const x = (barWidth + 10) * i + 25;
                    return (
                        <g key={d.label}>
                            <rect
                                x={x}
                                y={180 - barHeight}
                                width={barWidth}
                                height={barHeight}
                                fill={colors[i % colors.length]}
                                rx="2"
                            />
                            <text x={x + barWidth / 2} y="195" textAnchor="middle" fontSize="10" fill="#666">{d.label.substring(0,3)}</text>
                            <text x={x + barWidth / 2} y={175 - barHeight} textAnchor="middle" fontSize="12" fill="#333" fontWeight="bold">{d.value}</text>
                        </g>
                    );
                })}
                 <line x1="20" y1="180" x2="380" y2="180" stroke="#ccc" strokeWidth="1" />
            </svg>
        </div>
    );
};

const TrendLineChart: React.FC<{ datasets: { label: string; data: { date: Date; count: number }[]; color: string }[] }> = ({ datasets }) => {
    if (!datasets || datasets.length === 0 || datasets.every(ds => ds.data.length < 1)) {
        return <div className="text-center text-gray-500 py-10">Not enough data for a trend.</div>;
    }

    const allDataPoints = datasets.flatMap(ds => ds.data);
    if (allDataPoints.length === 0) {
        return <div className="text-center text-gray-500 py-10">Not enough data for a trend.</div>;
    }
    
    const sortedData = [...allDataPoints].sort((a, b) => a.date.getTime() - b.date.getTime());
    
    const maxCount = Math.max(...allDataPoints.map(d => d.count), 1);
    const minDate = sortedData[0].date.getTime();
    const maxDate = sortedData[sortedData.length - 1].date.getTime();
    const dateRange = maxDate - minDate;

    const getX = (date: Date) => {
        if (dateRange === 0) return 200; // Center if only one date
        return ((date.getTime() - minDate) / dateRange) * 360 + 20;
    };

    const getY = (count: number) => 170 - (count / maxCount) * 150;

    return (
        <div className="w-full h-64 bg-gray-50 p-4 rounded-lg">
            <svg width="100%" height="100%" viewBox="0 0 400 200">
                <text x="15" y={getY(maxCount)} textAnchor="end" fontSize="10" fill="#666">{maxCount}</text>
                <text x="15" y={getY(0)} textAnchor="end" fontSize="10" fill="#666">0</text>
                
                {datasets.map(dataset => {
                    if (dataset.data.length === 0) return null;
                    const points = dataset.data
                        .sort((a, b) => a.date.getTime() - b.date.getTime())
                        .map(d => `${getX(d.date)},${getY(d.count)}`)
                        .join(' ');
                    
                    return (
                        <g key={dataset.label}>
                            <polyline fill="none" stroke={dataset.color} strokeWidth="2" points={points} />
                            {dataset.data.map((d, i) => (
                                <circle key={i} cx={getX(d.date)} cy={getY(d.count)} r="3" fill={dataset.color} />
                            ))}
                        </g>
                    );
                })}
                <line x1="20" y1="170" x2="380" y2="170" stroke="#ccc" strokeWidth="1" />
                <text x="20" y="185" fontSize="10" fill="#666">{sortedData[0].date.toLocaleDateString('en-US', { month: 'short' })}</text>
                <text x="380" y="185" textAnchor="end" fontSize="10" fill="#666">{sortedData[sortedData.length - 1].date.toLocaleDateString('en-US', { month: 'short' })}</text>
            </svg>
            <div className="flex justify-center space-x-4 mt-2">
                {datasets.map(ds => (
                    <div key={ds.label} className="flex items-center space-x-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: ds.color }}></div>
                        <span className="text-xs text-gray-700 font-medium">{ds.label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};


// FIX: Corrected a typo in the viewBox attribute of the SVG element. An extra double quote was causing JSX parsing errors.
const CheckCircleIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-green-500 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const XCircleIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-red-500 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const Modal: React.FC<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'info' | 'confirm';
    onClose: () => void;
    onConfirm?: () => void;
}> = ({ isOpen, title, message, type, onClose, onConfirm }) => {
    if (!isOpen) return null;

    const Icon = type === 'success' ? CheckCircleIcon : type === 'error' ? XCircleIcon : null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl p-6 w-11/12 max-w-sm text-center" onClick={e => e.stopPropagation()}>
                {Icon && <Icon />}
                <h3 className="text-lg font-bold text-gray-800 mt-4">{title}</h3>
                <p className="text-sm text-gray-600 mt-2">{message}</p>
                {type === 'confirm' ? (
                    <div className="flex justify-center space-x-4 mt-6">
                        <button onClick={onClose} className="w-full bg-gray-200 text-gray-800 py-2 rounded-lg font-semibold hover:bg-gray-300 transition">Cancel</button>
                        <button onClick={onConfirm} className="w-full bg-red-600 text-white py-2 rounded-lg font-semibold hover:bg-red-700 transition">Delete</button>
                    </div>
                ) : (
                    <button onClick={onClose} className="mt-6 w-full bg-[#2E2E2E] text-white py-2 rounded-lg font-semibold hover:bg-gray-700 transition shadow-md">OK</button>
                )}
            </div>
        </div>
    );
};


// --- MAIN APP ---
const App: React.FC = () => {
    const [page, setPage] = useState<Page>(Page.Splash);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [currentFormType, setCurrentFormType] = useState<FormType | null>(null);
    const [projectToEdit, setProjectToEdit] = useState<Project | null>(null);
    const [submittedForms, setSubmittedForms] = useState<FormRecord[]>([]);
    const [trainingMaterials, setTrainingMaterials] = useState<TrainingMaterial[]>([]);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [currentModule, setCurrentModule] = useState<FormType | null>(null);
    const [selectedIssue, setSelectedIssue] = useState<FormRecord | null>(null);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [isLoading, setIsLoading] = useState(true);
    const [session, setSession] = useState<Session | null>(null);
    const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'info' as 'info' | 'success' | 'error' | 'confirm', onClose: null as (() => void) | null, onConfirm: null as (() => void) | null });
    const [drafts, setDrafts] = useState<DraftRecord[]>([]);
    const [draftToEdit, setDraftToEdit] = useState<DraftRecord | null>(null);
    const [selectedDrill, setSelectedDrill] = useState<SafetyDrill | null>(null);
    
    // New state for worker dashboard
    const [trainingAssignments, setTrainingAssignments] = useState<TrainingAssignment[]>([]);
    const [safetyDrills, setSafetyDrills] = useState<SafetyDrill[]>([]);
    const [workerDrills, setWorkerDrills] = useState<WorkerDrill[]>([]);
    const [projectWorkerDrills, setProjectWorkerDrills] = useState<WorkerDrill[]>([]); // For managers


    // --- REMOVED FAULTY SERVICE WORKER REGISTRATION ---
    // The service worker registration was causing console errors due to cross-origin restrictions in the development environment.
    // This has been removed to resolve the error. If offline functionality is required, it must be re-implemented carefully.

    const showModal = (title: string, message: string, type: 'info' | 'success' | 'error' | 'confirm', onCloseCallback: (() => void) | null = null, onConfirmCallback: (() => void) | null = null) => {
        setModal({ isOpen: true, title, message, type, onClose: onCloseCallback, onConfirm: onConfirmCallback });
    };

    const closeModal = () => {
        if (modal.onClose) {
            modal.onClose();
        }
        setModal({ ...modal, isOpen: false, onClose: null, onConfirm: null });
    };

    const navigateAndReplace = useCallback((newPage: Page, data?: any) => {
        if (data?.project) setSelectedProject(data.project);
        setPage(newPage);
        // Do not change the URL to prevent cross-origin errors in sandboxed environments.
        // State is still managed, allowing back/forward navigation to work.
        window.history.replaceState({ page: newPage, data }, '');
    }, []);

    // --- AUTH & SESSION ---
    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            if (session?.user) {
                fetchUserProfile(session.user.id);
            } else {
                setCurrentUser(null);
                navigateAndReplace(Page.Auth);
                setIsLoading(false);
            }
        });
        
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                 setSession(session);
                 fetchUserProfile(session.user.id);
            } else {
                navigateAndReplace(Page.Auth);
                setIsLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, [navigateAndReplace]);

    const fetchUserProfile = async (userId: string) => {
        setIsLoading(true);
        const { data, error } = await supabase.from('users').select('*').eq('id', userId).single();
        if (error) {
            console.error('Error fetching user profile:', error);
            handleLogout();
        } else if (data) {
            const user: User = {
                id: data.id,
                fullName: data.full_name,
                employeeId: data.employee_id,
                emergencyContact: data.emergency_contact,
                role: data.role,
                profilePhotoUrl: data.profile_photo_url,
            };
            setCurrentUser(user);
            navigateAndReplace(Page.ProjectHub);
        }
        setIsLoading(false);
    };

    // --- DATA FETCHING ---
    const fetchProjects = useCallback(async () => {
        if (!currentUser) return;
        setIsLoading(true);
        const { data, error } = await supabase.from('projects').select('*, created_by(id, full_name)').order('created_at', { ascending: false });
        if (error) console.error('Error fetching projects:', error);
        else setProjects(data as Project[]);
        setIsLoading(false);
    }, [currentUser]);

    const fetchForms = useCallback(async () => {
        if (!currentUser) return;
        setIsLoading(true);
        const { data, error } = await supabase.from('form_records').select('*, submitted_by_id(id, full_name)').order('submitted_at', { ascending: false });
        if (error) console.error('Error fetching forms:', error);
        else setSubmittedForms(data as FormRecord[]);
        setIsLoading(false);
    }, [currentUser]);

    const fetchDrafts = useCallback(async () => {
        const allDrafts = await localDb.drafts.toArray();
        setDrafts(allDrafts);
    }, []);
    
    const fetchTrainingMaterials = useCallback(async () => {
        if (!currentUser) return;
        const { data: materialsData, error } = await supabase.from('training_materials').select('*').order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching training materials:', error);
            if (error.code === '42P01') { 
                 console.warn("Training materials table not found. Please create it in Supabase.");
                 setTrainingMaterials([]);
            }
        } else {
            const materialIds = materialsData.map(m => m.id);
            if (materialIds.length > 0) {
                const { data: viewsData, error: viewsError } = await supabase
                    .from('training_material_views')
                    .select('material_id')
                    .in('material_id', materialIds);

                if (viewsError) {
                    console.error("Error fetching training views:", viewsError);
                    setTrainingMaterials(materialsData as TrainingMaterial[]); // Set data without counts on error
                } else {
                    const viewCounts = viewsData.reduce((acc: Record<string, number>, view) => {
                        acc[view.material_id] = (acc[view.material_id] || 0) + 1;
                        return acc;
                    }, {});
                    const materialsWithCounts = materialsData.map(material => ({
                        ...material,
                        view_count: viewCounts[material.id] || 0,
                    }));
                    setTrainingMaterials(materialsWithCounts as TrainingMaterial[]);
                }
            } else {
                setTrainingMaterials(materialsData as TrainingMaterial[]);
            }
        }
    }, [currentUser]);


    const fetchNotifications = useCallback(async () => {
        if (!currentUser) return;
        const { data, error } = await supabase.from('notifications').select('*').eq('is_read', false).order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching notifications:', error);
            if (error.code === '42P01') { 
                 console.warn("Notifications table not found. Please create it in Supabase to enable dynamic alerts.");
                 setNotifications([]);
            }
        } else {
            setNotifications(data as Notification[]);
        }
    }, [currentUser]);
    
    const fetchTrainingAssignments = useCallback(async () => {
        if (!currentUser || currentUser.role !== 'Workers') return;
        const { data, error } = await supabase.from('training_assignments').select('*, training_materials(*)').eq('worker_id', currentUser.id);
        if (error) {
            console.error("Error fetching training assignments:", error);
            if (error.code === '42P01') console.warn("training_assignments table not found.");
            setTrainingAssignments([]);
        } else {
            setTrainingAssignments(data as TrainingAssignment[]);
        }
    }, [currentUser]);

    const fetchSafetyDrills = useCallback(async () => {
        if (!currentUser || !selectedProject) return;
        const { data, error } = await supabase.from('safety_drills').select('*').eq('project_id', selectedProject.id).order('created_at', { ascending: false });
         if (error) {
            console.error("Error fetching safety drills:", error.message || error);
            if (error.code === '42P01') console.warn("safety_drills table not found.");
            setSafetyDrills([]);
        } else {
            setSafetyDrills(data as SafetyDrill[]);
        }
    }, [currentUser, selectedProject]);

    const fetchWorkerDrills = useCallback(async () => {
        if (!currentUser || currentUser.role !== 'Workers') return;
        const { data, error } = await supabase.from('worker_drills').select('*').eq('worker_id', currentUser.id);
        if (error) {
            console.error("Error fetching worker drills:", error);
            if (error.code === '42P01') console.warn("worker_drills table not found.");
            setWorkerDrills([]);
        } else {
            setWorkerDrills(data as WorkerDrill[]);
        }
    }, [currentUser]);

    const fetchProjectWorkerDrills = useCallback(async () => {
        if (!currentUser || !selectedProject || currentUser.role === 'Workers' || safetyDrills.length === 0) {
            setProjectWorkerDrills([]);
            return;
        }
        const drillIds = safetyDrills.map(d => d.id);
        const { data, error } = await supabase.from('worker_drills').select('*').in('drill_id', drillIds);
        
        if (error) {
            console.error("Error fetching project worker drills:", error);
            setProjectWorkerDrills([]);
        } else {
            setProjectWorkerDrills(data as WorkerDrill[]);
        }
    }, [currentUser, selectedProject, safetyDrills]);

    useEffect(() => {
        if (currentUser) {
            fetchProjects();
            fetchForms();
            fetchDrafts();
            fetchTrainingMaterials();
            fetchNotifications();
            fetchSafetyDrills(); 
            if (currentUser.role === 'Workers') {
                fetchTrainingAssignments();
                fetchWorkerDrills();
            }
        }
    }, [currentUser, selectedProject, fetchProjects, fetchForms, fetchDrafts, fetchTrainingMaterials, fetchNotifications, fetchSafetyDrills, fetchTrainingAssignments, fetchWorkerDrills]);
    
    useEffect(() => {
        if (currentUser?.role !== 'Workers' && safetyDrills.length > 0) {
            fetchProjectWorkerDrills();
        }
    }, [safetyDrills, currentUser, fetchProjectWorkerDrills]);


    // --- OFFLINE STATUS ---
    useEffect(() => {
        const handleOnline = () => { setIsOnline(true); fetchForms(); fetchProjects(); fetchTrainingMaterials(); fetchNotifications(); }
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [fetchForms, fetchProjects, fetchTrainingMaterials, fetchNotifications]);

    // --- NAVIGATION ---
    useEffect(() => {
        const handlePopState = (event: PopStateEvent) => {
            if (event.state && event.state.page !== undefined) {
                const { page: newPage, data } = event.state;
                
                // When restoring state, explicitly set or nullify values
                // based on what's in the history data for that page. This prevents
                // state from a previous page "leaking" into the current one, causing crashes.
                setSelectedProject(data?.project || null);
                setCurrentModule(data?.formType !== undefined ? data.formType : null);
                setSelectedIssue(data?.issue || null);
                setProjectToEdit(data?.projectToEdit || null);
                setCurrentFormType(data?.currentFormType || null);
                setDraftToEdit(data?.draftToEdit || null);
                setSelectedDrill(data?.drill || null);
                
                setPage(newPage);
            } else if (!event.state) {
                 // This can happen on initial load or if history is cleared.
                 setPage(currentUser ? Page.ProjectHub : Page.Auth);
            }
        };

        window.addEventListener('popstate', handlePopState);
        if (!window.history.state) {
            // Do not change the URL to prevent cross-origin errors in sandboxed environments.
            window.history.replaceState({ page }, '');
        }

        return () => window.removeEventListener('popstate', handlePopState);
    }, [currentUser, page]);

    const goBack = useCallback(() => {
        if (page === Page.Form) {
            setDraftToEdit(null); // Clear any draft being edited when navigating back
        }
        window.history.back();
    }, [page]);

    const navigateTo = useCallback((newPage: Page, data?: any) => {
        if (data?.project) setSelectedProject(data.project);
        if (data?.formType !== undefined) setCurrentModule(data.formType);
        if (data?.issue) setSelectedIssue(data.issue);
        if (data?.projectToEdit) setProjectToEdit(data.projectToEdit);
        if (data?.currentFormType) setCurrentFormType(data.currentFormType);
        if (data?.draftToEdit) setDraftToEdit(data.draftToEdit);
        if (data?.drill) setSelectedDrill(data.drill);

        let targetPage = newPage;
        if (newPage === Page.SafetyOfficerDashboard && data?.project) { 
            if (!currentUser) { setPage(Page.Auth); return; }
            switch (currentUser.role) {
                case 'Site Safety Officer': targetPage = Page.SafetyOfficerDashboard; break;
                case 'HO middle Managers': targetPage = Page.HOManagerDashboard; break;
                case 'Top Managers': targetPage = Page.TopManagerDashboard; break;
                case 'Workers': targetPage = Page.WorkerDashboard; break;
                default: targetPage = Page.SafetyOfficerDashboard;
            }
        }
        setPage(targetPage);
        // Do not change the URL to prevent cross-origin errors in sandboxed environments.
        window.history.pushState({ page: targetPage, data }, '');
    }, [currentUser]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        setCurrentUser(null);
        setSelectedProject(null);
        setProjects([]);
        setSubmittedForms([]);
        navigateAndReplace(Page.Auth);
    };
    
    // --- CRUD OPERATIONS ---
    const handleUpdateUser = async (updatedData: Partial<User>, photoFile?: File) => {
        if (!currentUser) return;
        setIsLoading(true);
        
        let photo_url = currentUser.profilePhotoUrl;

        if (photoFile) {
            const filePath = `profiles/${currentUser.id}/${Date.now()}_${photoFile.name}`;
            const { error: uploadError } = await supabase.storage.from('safety-uploads').upload(filePath, photoFile);
            if (uploadError) {
                showModal('Error uploading photo', uploadError.message, 'error');
                setIsLoading(false);
                return;
            }
            const { data: { publicUrl } } = supabase.storage.from('safety-uploads').getPublicUrl(filePath);
            photo_url = publicUrl;
        }

        const { data, error } = await supabase.from('users').update({
            full_name: updatedData.fullName,
            emergency_contact: updatedData.emergencyContact,
            profile_photo_url: photo_url
        }).eq('id', currentUser.id).select().single();
        
        if (error) {
            showModal('Error updating profile', error.message, 'error');
        } else if (data) {
            setCurrentUser(prev => ({ ...prev!, fullName: data.full_name, emergencyContact: data.emergency_contact, profilePhotoUrl: data.profile_photo_url }));
            showModal('Success', 'Profile updated successfully!', 'success', goBack);
        }
        setIsLoading(false);
    };
    
    const addProject = async (project: Pick<Project, 'name' | 'severity' | 'location' | 'department'>) => {
        if (!currentUser) return;
        setIsLoading(true);
        const { error } = await supabase.from('projects').insert({
            name: project.name,
            project_id: `PRJ${Date.now()}`,
            severity: project.severity,
            location: project.location,
            department: project.department,
            created_by: currentUser.id,
        });
        setIsLoading(false);
        if (error) {
            showModal("Error creating project", error.message, 'error');
        } else {
            showModal(
                "Project Created",
                `The project "${project.name}" has been successfully created.`,
                'success',
                () => {
                    fetchProjects();
                    navigateAndReplace(Page.ProjectHub);
                }
            );
        }
    };
    
    const handleUpdateProject = async (updatedProject: Project) => {
        setIsLoading(true);
        const { error } = await supabase.from('projects').update({
            name: updatedProject.name,
            severity: updatedProject.severity,
            location: updatedProject.location,
            department: updatedProject.department,
            status: updatedProject.status,
        }).eq('id', updatedProject.id);
        setIsLoading(false);
        if (error) {
            showModal("Error updating project", error.message, 'error');
        } else {
            showModal("Project Updated", "The project has been successfully updated.", 'success', () => {
                fetchProjects();
                navigateAndReplace(Page.ProjectHub);
            });
        }
    };

    const deleteProject = async (projectId: string, projectName: string) => {
        showModal(
            "Confirm Deletion",
            `Are you sure you want to delete "${projectName}"? This action cannot be undone.`,
            'confirm',
            closeModal, // on close
            async () => { // on confirm
                closeModal();
                setIsLoading(true);
                const { error } = await supabase.from('projects').delete().eq('id', projectId);
                setIsLoading(false);
                if (error) {
                    showModal("Error deleting project", error.message, 'error');
                } else {
                    showModal("Success", "Project deleted successfully.", 'success');
                    fetchProjects();
                }
            }
        );
    };

    const handleDeleteDraft = async (draftId: number) => {
        await localDb.drafts.delete(draftId);
        await fetchDrafts();
        showModal("Success", "Draft deleted successfully.", 'success');
    };

    const handleSaveOrUpdateDraft = async (draftData: Omit<DraftRecord, 'id' | 'saved_at'>, existingId?: number) => {
        const draftWithTimestamp = { ...draftData, saved_at: new Date().toISOString() };
        if (existingId) {
            await localDb.drafts.put({ id: existingId, ...draftWithTimestamp });
            await fetchDrafts();
            showModal("Draft Updated", "Your draft has been updated.", 'success', () => { setDraftToEdit(null); goBack(); });
        } else {
            await localDb.drafts.add(draftWithTimestamp);
            await fetchDrafts();
            showModal("Draft Saved", "Your report has been saved as a draft.", 'success', goBack);
        }
    };
    
    // Core submission logic, can be called from multiple places. Throws on error.
    const submitSingleRecordLogic = async (formType: FormType, projectId: string, user: User, recordData: Record<string, any>, fileData: Record<string, File | null>): Promise<void> => {
        const submissionPayload = { data: { ...recordData } };
        const fileEntries = Object.entries(fileData).filter(([, file]) => file instanceof File);
    
        for (const [fieldName, file] of fileEntries) {
            if (file) {
                const filePath = `uploads/${user.id}/${Date.now()}_${file.name}`;
                const { error: uploadError } = await supabase.storage.from('safety-uploads').upload(filePath, file);
                if (uploadError) throw new Error(`File upload failed: ${uploadError.message}`);
                const { data: urlData } = supabase.storage.from('safety-uploads').getPublicUrl(filePath);
                submissionPayload.data[fieldName] = urlData.publicUrl;
            }
        }
    
        const { error: insertError } = await supabase.from('form_records').insert({
            form_type: formType,
            project_id: projectId,
            submitted_by_id: user.id,
            data: submissionPayload.data,
            status: 'Open'
        });
    
        if (insertError) throw new Error(`Database insert failed: ${insertError.message}`);
    };

    const handleAddFormRecord = async (recordData: Record<string, any>, fileData: Record<string, File | null>, draftIdToDelete?: number) => {
        if (!currentFormType || !selectedProject || !currentUser) return;
        
        setIsLoading(true);
        
        if (!isOnline) {
            try {
                 const submissionPayload = {
                    formType: currentFormType,
                    projectId: selectedProject.id,
                    submittedById: currentUser.id,
                    data: recordData,
                };
                // For offline, we can only support one file for simplicity in the queue.
                const firstFile = Object.values(fileData).find(f => f instanceof File) || null;
                await localDb.upload_queue.add({ data: submissionPayload, file: firstFile });
                if (navigator.serviceWorker.ready) {
                    const registration = await navigator.serviceWorker.ready;
                    await (registration as any).sync.register('sync-reports');
                }
                showModal("Offline Mode", "You are offline. Report saved and will upload when you're back online.", 'info');
            } catch (error) {
                console.error("Failed to save report locally:", error);
                showModal("Save Failed", "Could not save report locally.", 'error');
            } finally {
                setIsLoading(false);
            }
        } else {
            try {
                await submitSingleRecordLogic(currentFormType, selectedProject.id, currentUser, recordData, fileData);

                if (draftIdToDelete) {
                    await localDb.drafts.delete(draftIdToDelete);
                    await fetchDrafts();
                }
                await fetchForms();
                showModal("Success", "Record submitted successfully!", 'success');
            } catch (error: any) {
                console.error("Online submission failed:", error);
                showModal("Submission Failed", error.message, 'error');
            } finally {
                setIsLoading(false);
            }
        }
        
        setDraftToEdit(null); // Clear edited draft
        
        let dashboardPage: Page;
        switch(currentUser.role) {
            case 'Site Safety Officer': dashboardPage = Page.SafetyOfficerDashboard; break;
            case 'Workers': dashboardPage = Page.WorkerDashboard; break;
            default: dashboardPage = Page.SafetyOfficerDashboard; break;
        }
        navigateAndReplace(dashboardPage, { project: selectedProject });
    };

    const handleBulkDeleteDrafts = async (draftIds: number[]) => {
        showModal(
            "Confirm Deletion",
            `Are you sure you want to delete ${draftIds.length} selected drafts? This action cannot be undone.`,
            'confirm',
            closeModal,
            async () => {
                closeModal();
                setIsLoading(true);
                await localDb.drafts.bulkDelete(draftIds);
                await fetchDrafts();
                setIsLoading(false);
                showModal("Success", `${draftIds.length} drafts deleted successfully.`, 'success');
            }
        );
    };

    const handleBulkSubmitDrafts = async (draftIds: number[]) => {
        if (!currentUser) return;
        if (!isOnline) {
            showModal("Offline Mode", "Bulk submission is not available while offline.", 'info');
            return;
        }
    
        setIsLoading(true);
        const draftsToSubmit = await localDb.drafts.where('id').anyOf(draftIds).toArray();
        let successCount = 0;
        let errorCount = 0;
        
        for (const draft of draftsToSubmit) {
            try {
                await submitSingleRecordLogic(draft.form_type, draft.project_id, currentUser, draft.data, draft.fileData);
                await localDb.drafts.delete(draft.id!);
                successCount++;
            } catch (error) {
                console.error(`Failed to submit draft ${draft.id}:`, error);
                errorCount++;
            }
        }
    
        await fetchDrafts();
        await fetchForms();
        setIsLoading(false);
    
        const message = `${successCount} drafts submitted successfully.` + (errorCount > 0 ? ` ${errorCount} failed.` : '');
        showModal("Bulk Submission Complete", message, 'info');
    };

    const handleDeleteFormRecord = async (issueId: string, issueIdentifier: string) => {
        showModal(
            "Confirm Deletion",
            `Are you sure you want to delete report "${issueIdentifier}"? This action cannot be undone.`,
            'confirm',
            closeModal, // on close
            async () => { // on confirm
                closeModal();
                setIsLoading(true);

                // Use a remote procedure call (RPC) to delete the record.
                // This is often required to handle deletions that need special permissions
                // defined in a backend function, bypassing restrictive Row Level Security.
                // The user must create a corresponding SQL function in their Supabase project.
                const { error } = await supabase.rpc('delete_form_record_by_id', { record_id: issueId });
                
                setIsLoading(false);

                if (error) {
                    showModal(
                        "Deletion Failed", 
                        `The record could not be deleted. This might be due to permissions on the backend. (Error: ${error.message})`, 
                        'error'
                    );
                } else {
                    // Only update the local state if the database deletion was successful.
                    setSubmittedForms(prevForms => prevForms.filter(form => form.id !== issueId));
                    showModal("Success", "Record deleted successfully.", 'success');
                }
            }
        );
    };
    
    const handleAddTrainingMaterial = async (title: string, description: string, file: File) => {
        if (!currentUser || !selectedProject) return;
        setIsLoading(true);

        try {
            const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
            const filePath = `training_materials/${selectedProject.id}/${Date.now()}_${sanitizedFileName}`;
            const { error: uploadError } = await supabase.storage.from('safety-uploads').upload(filePath, file);
            if (uploadError) throw new Error(`File upload failed: ${uploadError.message}`);
            
            const { data: urlData } = supabase.storage.from('safety-uploads').getPublicUrl(filePath);

            const getFileType = (fileName: string): TrainingMaterial['file_type'] => {
                const extension = fileName.split('.').pop()?.toLowerCase() || '';
                if (['pdf'].includes(extension)) return 'pdf';
                if (['mp4', 'mov', 'avi', 'wmv'].includes(extension)) return 'video';
                if (['jpg', 'jpeg', 'png', 'gif', 'svg'].includes(extension)) return 'image';
                return 'other';
            };
            
            const { error: insertError } = await supabase.from('training_materials').insert({
                project_id: selectedProject.id,
                uploaded_by: currentUser.id,
                title,
                description,
                file_url: urlData.publicUrl,
                file_type: getFileType(file.name),
            });

            if (insertError) throw new Error(`Database insert failed: ${insertError.message}`);
            
            await fetchTrainingMaterials();
            showModal("Success", "Training material uploaded successfully!", 'success');
        } catch (error: any) {
            showModal("Upload Failed", error.message, 'error');
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleDeleteTrainingMaterial = async (material: TrainingMaterial) => {
         showModal(
            "Confirm Deletion",
            `Are you sure you want to delete "${material.title}"?`,
            'confirm',
            closeModal,
            async () => {
                closeModal();
                setIsLoading(true);
                try {
                    // Extract file path from URL
                    const url = new URL(material.file_url);
                    const filePath = url.pathname.split('/safety-uploads/').pop();
                    
                    if (filePath) {
                        const { error: storageError } = await supabase.storage.from('safety-uploads').remove([filePath]);
                        if (storageError) console.error("Could not delete file from storage, proceeding with DB deletion:", storageError.message);
                    }
                    
                    const { error: dbError } = await supabase.from('training_materials').delete().eq('id', material.id);
                    if (dbError) throw new Error(dbError.message);

                    await fetchTrainingMaterials();
                    showModal("Success", "Material deleted successfully.", 'success');
                } catch (error: any) {
                    showModal("Deletion Failed", error.message, 'error');
                } finally {
                    setIsLoading(false);
                }
            }
        );
    };

    const handleRecordTrainingView = async (materialId: string) => {
        if (!currentUser) return;
        // Upsert to avoid duplicates. It's okay if this fails silently in the background.
        const { error } = await supabase.from('training_material_views').upsert(
            { material_id: materialId, worker_id: currentUser.id },
            { onConflict: 'material_id,worker_id' }
        );
        if (error) {
            console.error("Failed to record training view:", error);
        }
    };

    const handleAddDrill = async (title: string, description: string, dueDate: string, steps: string[]) => {
        if (!currentUser || !selectedProject) return;
        setIsLoading(true);

        try {
            const { error } = await supabase.from('safety_drills').insert({
                project_id: selectedProject.id,
                title,
                description,
                due_date: dueDate || null,
                steps: steps.filter(s => s.trim() !== ''), // Ensure no empty steps are saved
            });
            if (error) throw new Error(error.message);

            await fetchSafetyDrills();
            showModal("Success", "Safety drill created successfully!", 'success', goBack);
        } catch (error: any) {
            showModal("Creation Failed", error.message, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteDrill = async (drillId: string) => {
        showModal(
            "Confirm Deletion",
            "Are you sure you want to delete this safety drill?",
            'confirm',
            closeModal,
            async () => {
                closeModal();
                setIsLoading(true);
                try {
                    const { error } = await supabase.from('safety_drills').delete().eq('id', drillId);
                    if (error) throw new Error(error.message);
                    
                    await fetchSafetyDrills(); // This will refresh the list
                    showModal("Success", "Drill deleted successfully.", 'success');
                } catch (error: any) {
                    showModal("Deletion Failed", error.message, 'error');
                } finally {
                    setIsLoading(false);
                }
            }
        );
    };

    const handleStatusUpdate = async (issueId: string, newStatus: FormRecord['status'], notes: string) => {
        if (!currentUser) return;
        setIsLoading(true);
        
        const newUpdate: StatusUpdate = {
            updatedBy: currentUser.fullName,
            timestamp: new Date().toISOString(),
            status: newStatus,
            notes: notes,
        };

        const existingUpdates = selectedIssue?.updates || [];
        
        const { error } = await supabase.from('form_records').update({
            status: newStatus,
            updates: [...existingUpdates, newUpdate]
        }).eq('id', issueId);

        setIsLoading(false);
        if (error) {
            showModal("Error updating status", error.message, 'error');
        } else {
            await fetchForms();
            // Also update the selected issue locally for immediate UI feedback
            if (selectedIssue && selectedIssue.id === issueId) {
                setSelectedIssue(prev => ({...prev!, status: newStatus, updates: [...prev!.updates, newUpdate]}));
            }
            showModal("Success", "Status updated successfully!", 'success');
        }
    };
    
    const handleUpdateDrillProgress = async (drill: SafetyDrill, stepIndex: number) => {
        if (!currentUser) return;

        const workerDrill = workerDrills.find(wd => wd.drill_id === drill.id);
        const completedSteps = workerDrill?.completed_steps || [];
        const newCompletedSteps = completedSteps.includes(stepIndex)
            ? completedSteps.filter(i => i !== stepIndex)
            : [...completedSteps, stepIndex];

        const newStatus = newCompletedSteps.length === drill.steps.length ? 'Completed' : 'Pending';
        const completed_at = newStatus === 'Completed' ? new Date().toISOString() : null;
        
        const { error } = await supabase.from('worker_drills').upsert({
            worker_id: currentUser.id,
            drill_id: drill.id,
            status: newStatus,
            completed_steps: newCompletedSteps,
            completed_at: completed_at,
        }, { onConflict: 'worker_id,drill_id' });

        if (error) {
            showModal("Error", "Could not update drill progress. Please try again.", 'error');
        } else {
            if (newStatus === 'Completed') {
                showModal("Drill Complete!", "Great job finishing the safety drill!", 'success');
            }
            await fetchWorkerDrills(); // Refresh local state to update UI
        }
    };

    // --- UTILITIES ---
    const downloadFile = (blob: Blob, filename: string) => {
        try {
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.href = url;
            link.download = `${filename}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Download failed:", error);
            showModal("Download Error", "Could not download the file.", 'error');
        }
    };
    
    const exportToCsv = (records: FormRecord[], filename: string) => {
        if (!records || records.length === 0) {
            showModal("No Data", "There is no data to export with the current filters.", 'info');
            return;
        }
    
        const allDataKeys = new Set<string>();
        records.forEach(rec => {
            if (rec.data) {
                Object.keys(rec.data).forEach(key => allDataKeys.add(key));
            }
        });
    
        const headers = [
            'Record ID', 'Form Type', 'Project ID', 'Submitter ID', 'Submitter Name', 
            'Submitted At', 'Status', ...Array.from(allDataKeys)
        ];
    
        const escapeCell = (cell: any): string => {
            if (cell === null || cell === undefined) {
                return '';
            }
            let str = String(cell);
            if (typeof cell === 'object') {
                try {
                    str = JSON.stringify(cell);
                } catch {
                    str = '[Circular Reference]';
                }
            }
            
            str = str.replace(/"/g, '""');
            if (str.includes(',') || str.includes('\n') || str.includes('"')) {
                str = `"${str}"`;
            }
            return str;
        };
        
        const csvRows = records.map(record => {
            const baseData = [
                record.id,
                record.form_type,
                record.project_id,
                (typeof record.submitted_by_id === 'object' && record.submitted_by_id) ? record.submitted_by_id.id : record.submitted_by_id,
                (typeof record.submitted_by_id === 'object' && record.submitted_by_id) ? record.submitted_by_id.full_name : 'N/A',
                record.submitted_at,
                record.status,
            ];
            const dynamicData = Array.from(allDataKeys).map(key => record.data ? record.data[key] : '');
            return [...baseData, ...dynamicData].map(escapeCell).join(',');
        });
    
        csvRows.unshift(headers.join(','));
        const csvString = csvRows.join('\n');
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        
        downloadFile(blob, filename);
    };

    // --- PAGE RENDERER ---
    const pagesRequiringProject = useMemo(() => [
        Page.SafetyOfficerDashboard, Page.HOManagerDashboard, Page.TopManagerDashboard,
        Page.WorkerDashboard, Page.Form, Page.TrainingMaterials, Page.ModuleLanding,
        Page.IssueList, Page.ReportsDashboard, Page.DraftList,
        Page.SafetyDrillsManagement, Page.CreateSafetyDrill, Page.SafetyDrillDetail
    ], []);

    const needsProject = pagesRequiringProject.includes(page);

    useEffect(() => {
        // This effect handles redirection if a page requiring a project is accessed without one.
        // This commonly occurs on a browser refresh when in-memory state is lost.
        if (needsProject && !selectedProject && currentUser) {
            console.warn("Redirecting to Project Hub: no project selected for a protected page.");
            navigateAndReplace(Page.ProjectHub);
        }
    }, [page, selectedProject, needsProject, currentUser, navigateAndReplace]);

    const renderPage = () => {
        const showBackButton = ![Page.Splash, Page.Auth, Page.ProjectHub].includes(page) && 
                               !(page.toString().toLowerCase().includes('dashboard'));
        
        if (isLoading && page !== Page.Auth) {
            return (
                <div className="flex flex-col items-center justify-center h-screen bg-white">
                    <ShieldIcon className="w-20 h-20 animate-pulse" />
                    <p className="text-gray-600 mt-4">Loading...</p>
                </div>
            );
        }

        if (needsProject && !selectedProject) {
            return (
                <div className="flex flex-col items-center justify-center h-screen bg-white">
                    <ShieldIcon className="w-20 h-20 animate-pulse" />
                    <p className="text-gray-600 mt-4">No project selected. Redirecting...</p>
                </div>
            );
        }

        const pageContent = () => {
             switch (page) {
                case Page.Splash: return <SplashScreen onFinish={() => setPage(Page.Auth)} />;
                case Page.Auth: return <AuthScreen onNavigate={navigateTo} showModal={showModal} />;
                case Page.ProjectHub: return <ProjectHubScreen user={currentUser!} projects={projects} onNavigate={navigateTo} onLogout={handleLogout} onDelete={deleteProject} onRefresh={fetchProjects} />;
                case Page.NewProject: return <NewProjectScreen onAddProject={addProject} currentUser={currentUser!} />;
                case Page.SafetyOfficerDashboard: return <SafetyOfficerDashboard user={currentUser!} project={selectedProject!} onNavigate={navigateTo} onLogout={handleLogout} submittedForms={submittedForms} />;
                case Page.HOManagerDashboard: return <HOManagerDashboard user={currentUser!} project={selectedProject!} onNavigate={navigateTo} onLogout={handleLogout} submittedForms={submittedForms} safetyDrills={safetyDrills} projectWorkerDrills={projectWorkerDrills} />;
                case Page.TopManagerDashboard: return <TopManagerDashboard user={currentUser!} project={selectedProject!} onNavigate={navigateTo} onLogout={handleLogout} submittedForms={submittedForms} onExport={exportToCsv} safetyDrills={safetyDrills} projectWorkerDrills={projectWorkerDrills} />;
                case Page.WorkerDashboard: return <WorkerDashboard user={currentUser!} project={selectedProject!} onNavigate={navigateTo} onLogout={handleLogout} submittedForms={submittedForms} trainingMaterials={trainingMaterials} notifications={notifications} trainingAssignments={trainingAssignments} safetyDrills={safetyDrills} workerDrills={workerDrills} onUpdateDrillProgress={handleUpdateDrillProgress} onRecordTrainingView={handleRecordTrainingView} />;
                case Page.Form: return <FormScreen formType={currentFormType!} user={currentUser!} onAddFormRecord={handleAddFormRecord} projects={projects} onSaveOrUpdateDraft={handleSaveOrUpdateDraft} draftToEdit={draftToEdit} />;
                case Page.EditProfile: return <EditProfileScreen user={currentUser!} onUpdateUser={handleUpdateUser} />;
                case Page.EditProject: return <EditProjectScreen project={projectToEdit!} onUpdateProject={handleUpdateProject} />;
                case Page.TrainingMaterials: return <TrainingMaterialsScreen project={selectedProject!} materials={trainingMaterials} onAdd={handleAddTrainingMaterial} onDelete={handleDeleteTrainingMaterial} />;
                case Page.ModuleLanding: 
                    const draftsForModule = drafts.filter(d => d.form_type === currentModule! && d.project_id === selectedProject!.id).length;
                    return <ModuleLandingScreen moduleType={currentModule!} project={selectedProject!} onNavigate={navigateTo} draftsCount={draftsForModule} />;
                case Page.IssueList: return <IssueListScreen moduleType={currentModule} project={selectedProject!} issues={submittedForms} onNavigate={navigateTo} currentUser={currentUser!} onExport={exportToCsv} onDelete={handleDeleteFormRecord} />;
                case Page.IssueDetail: return <IssueDetailScreen issue={selectedIssue!} onStatusUpdate={handleStatusUpdate} currentUser={currentUser!} showModal={showModal} />;
                case Page.ModuleSelection: return <ModuleSelectionScreen onNavigate={navigateTo} />;
                case Page.ReportsDashboard: return <ReportsDashboardScreen project={selectedProject!} allIssues={submittedForms} onExport={exportToCsv} onNavigate={navigateTo} />;
                case Page.DraftList: return <DraftListScreen moduleType={currentModule!} project={selectedProject!} drafts={drafts} onNavigate={navigateTo} onDeleteDraft={(id) => showModal("Confirm Deletion", "Are you sure you want to delete this draft?", 'confirm', closeModal, () => { closeModal(); handleDeleteDraft(id); })} onBulkDeleteDrafts={handleBulkDeleteDrafts} onBulkSubmitDrafts={handleBulkSubmitDrafts} />;
                case Page.SafetyDrillsManagement: return <SafetyDrillsManagementScreen project={selectedProject!} drills={safetyDrills} onNavigate={navigateTo} onDelete={handleDeleteDrill} />;
                case Page.CreateSafetyDrill: return <CreateSafetyDrillScreen project={selectedProject!} onAddDrill={handleAddDrill} />;
                case Page.SafetyDrillDetail:
                    const workerDrillForDetail = workerDrills.find(wd => wd.drill_id === selectedDrill!.id);
                    return <SafetyDrillDetailScreen drill={selectedDrill!} workerDrill={workerDrillForDetail} onUpdateDrillProgress={handleUpdateDrillProgress} />;
                default: return <AuthScreen onNavigate={navigateTo} showModal={showModal}/>;
            }
        };

        return (
            <div className="relative">
                <Modal
                    isOpen={modal.isOpen}
                    title={modal.title}
                    message={modal.message}
                    type={modal.type}
                    onClose={closeModal}
                    onConfirm={modal.onConfirm ? () => modal.onConfirm!() : undefined}
                />
                {showBackButton && <BackButton onClick={goBack} />}
                {isLoading && <div className="fixed top-0 left-0 w-full h-full bg-black/20 z-50 flex items-center justify-center"><div className="bg-white p-4 rounded-lg shadow-xl">Loading...</div></div>}
                {!isOnline && (
                    <div className="sticky top-0 z-50 bg-yellow-500 text-white text-center py-1 text-sm font-semibold">
                        Offline Mode - Reports will be saved locally.
                    </div>
                )}
                {pageContent()}
            </div>
        );
    };

    return (
        <div className="bg-[#FAF9F6] min-h-screen font-sans">
            <div 
                className="max-w-md mx-auto bg-white shadow-2xl min-h-screen"
                style={{ paddingTop: 'env(safe-area-inset-top)' }}
            >
                {renderPage()}
            </div>
        </div>
    );
};

// --- SCREENS ---
const PageHeader: React.FC<{ title: string; children?: React.ReactNode }> = ({ title, children }) => (
    <div className="bg-white p-4 pt-14 text-center shadow-md sticky top-0 z-10">
        <h1 className="text-xl font-bold text-gray-800 truncate">{title}</h1>
        {children}
    </div>
);

const SplashScreen: React.FC<{ onFinish: () => void }> = ({ onFinish }) => {
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const startLoading = setTimeout(() => setLoading(false), 100); // Start animation after a brief moment
        const finishTimer = setTimeout(() => onFinish(), 2200); // Total splash time

        return () => {
            clearTimeout(startLoading);
            clearTimeout(finishTimer);
        };
    }, [onFinish]);

    return (
        <div className="flex flex-col items-center justify-center h-screen bg-[#1FA97C]">
            <div className="flex flex-col items-center justify-center bg-white p-12 rounded-3xl shadow-lg w-4/5 max-w-xs">
                <ShieldIcon className="w-24 h-24" />
                <h1 className="text-2xl font-bold text-gray-800 mt-4">MEIL Safety</h1>
                <div className="w-full bg-gray-200 rounded-full h-2.5 mt-8 overflow-hidden">
                    <div
                        className="bg-[#1FA97C] h-2.5 rounded-full transition-all duration-[2000ms] ease-linear"
                        style={{ width: loading ? '0%' : '100%' }}
                    ></div>
                </div>
            </div>
        </div>
    );
};

const AuthScreen: React.FC<{ 
    onNavigate: (page: Page) => void; 
    showModal: (title: string, message: string, type: 'info' | 'success' | 'error', onClose?: (() => void) | null) => void;
}> = ({ onNavigate, showModal }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [employeeId, setEmployeeId] = useState('');
    const [password, setPassword] = useState('');
    const [signupForm, setSignupForm] = useState({ fullName: '', employeeId: '', emergencyContact: '', password: '', confirmPassword: '', role: 'Site Safety Officer' as UserRole, email: '' });
    const [loading, setLoading] = useState(false);

    const handleSignupChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setSignupForm({ ...signupForm, [e.target.name]: e.target.value });
    
    const handleAuthAction = async () => {
        setLoading(true);
        if (isLogin) {
            if (!employeeId || !password) {
                showModal('Login Failed', "Please enter your Employee ID and password.", 'error');
                setLoading(false);
                return;
            }

            const { data: userEmail, error: rpcError } = await supabase.rpc('get_email_from_employee_id', { p_employee_id: employeeId });

            if (rpcError) {
                showModal('System Error', `Login system error: ${rpcError.message}. Please contact support.`, 'error');
                setLoading(false);
                return;
            }
    
            if (!userEmail) {
                showModal('Login Failed', 'User does not exist. Please check your Employee ID or create an account.', 'error');
                setLoading(false);
                return;
            }

            const { error: signInError } = await supabase.auth.signInWithPassword({ email: userEmail, password });
            if (signInError) {
                showModal('Login Failed', 'Invalid credentials. Please check your password and try again.', 'error');
            }

        } else {
            if (signupForm.password !== signupForm.confirmPassword) {
                showModal('Sign Up Failed', "Passwords don't match!", 'error');
                setLoading(false);
                return;
            }
            const { error } = await supabase.auth.signUp({
                email: signupForm.email,
                password: signupForm.password,
                options: {
                    data: {
                        full_name: signupForm.fullName,
                        role: signupForm.role,
                        employee_id: signupForm.employeeId,
                        emergency_contact: signupForm.emergencyContact,
                    }
                }
            });

            if (error) {
                showModal('Sign Up Failed', error.message, 'error');
            } else {
                showModal(
                    'Registration Successful',
                    'Your account has been created. You can now sign in with your Employee ID and password.',
                    'success',
                    () => setIsLogin(true)
                );
            }
        }
        setLoading(false);
    };

    const roles: UserRole[] = ['Site Safety Officer', 'HO middle Managers', 'Top Managers', 'Workers'];
    const commonInputClasses = "w-full pl-10 pr-3 py-3 bg-gray-50 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1FA97C]/50 focus:border-[#1FA97C] transition text-gray-900 placeholder-gray-500";
    const commonSignupInputClasses = "w-full p-3 bg-gray-50 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1FA97C]/50 focus:border-[#1FA97C] transition text-gray-900 placeholder-gray-500";

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col justify-center items-center p-4" style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, #E5E7EB 1px, transparent 0)`,
            backgroundSize: `20px 20px`,
        }}>
            <div className="w-full max-w-md bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl p-8 space-y-6">
                <div className="text-center">
                    <ShieldIcon className="w-16 h-16 mx-auto" />
                    <h1 className="text-3xl font-bold text-gray-800 mt-2">MEIL Safety</h1>
                    <p className="text-gray-500">{isLogin ? 'Sign in to your account' : 'Create a new account'}</p>
                </div>

                <div className="space-y-4">
                    {isLogin ? (
                        <>
                            <div className="relative">
                                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>
                                </span>
                                <input type="text" placeholder="Employee ID" className={commonInputClasses} value={employeeId} onChange={e => setEmployeeId(e.target.value)} />
                            </div>
                            <div className="relative">
                                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
                                </span>
                                <input type="password" placeholder="Password" className={commonInputClasses} value={password} onChange={e => setPassword(e.target.value)} />
                            </div>
                        </>
                    ) : (
                        <>
                             <input name="fullName" onChange={handleSignupChange} type="text" placeholder="Full Name" className={commonSignupInputClasses} required />
                             <input name="employeeId" onChange={handleSignupChange} type="text" placeholder="Employee ID" className={commonSignupInputClasses} required />
                             <input name="email" onChange={handleSignupChange} type="email" placeholder="Email Address (for recovery)" className={commonSignupInputClasses} required />
                             <select name="role" onChange={handleSignupChange} className={`appearance-none ${commonSignupInputClasses}`} value={signupForm.role}>
                                {roles.map(r => <option key={r} value={r}>{r}</option>)}
                             </select>
                             <input name="emergencyContact" onChange={handleSignupChange} type="text" placeholder="Emergency Contact" className={commonSignupInputClasses} />
                             <input name="password" onChange={handleSignupChange} type="password" placeholder="Password" className={commonSignupInputClasses} required />
                             <input name="confirmPassword" onChange={handleSignupChange} type="password" placeholder="Confirm Password" className={commonSignupInputClasses} required />
                        </>
                    )}
                </div>

                <button onClick={handleAuthAction} disabled={loading} className="w-full bg-[#2E2E2E] text-white py-3 rounded-lg font-semibold hover:bg-gray-700 transition shadow-md disabled:bg-gray-400 active:scale-95">
                    {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Create Account')}
                </button>
                
                <p className="text-center text-sm text-gray-600">
                    {isLogin ? "Don't have an account?" : "Already have an account?"}
                    <button onClick={() => setIsLogin(!isLogin)} className="font-semibold text-[#1FA97C] hover:underline ml-1">
                        {isLogin ? 'Sign Up' : 'Sign In'}
                    </button>
                </p>
            </div>
        </div>
    );
};

const AppHeader: React.FC<{ title: string; user?: User; onLogout?: () => void; onNavigate?: (page: Page) => void; }> = ({ title, user, onLogout, onNavigate }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    return (
        <div className="bg-white p-4 flex justify-between items-center shadow-md sticky top-0 z-10">
            <div className="flex items-center space-x-3">
                <ShieldIcon className="w-8 h-8"/>
                <div><h1 className="text-lg font-bold text-gray-800">{title}</h1>{user && <p className="text-xs text-gray-500">{user.fullName} | {user.employeeId}</p>}</div>
            </div>
            <div className="relative">
                <button onClick={() => setIsMenuOpen(!isMenuOpen)}><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg></button>
                {isMenuOpen && user && (
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg py-1 z-20 border border-gray-100">
                        <div className="flex items-center px-4 py-3 space-x-3 border-b">
                            {user.profilePhotoUrl ? <img src={user.profilePhotoUrl} alt="Profile" className="w-10 h-10 rounded-full object-cover" /> : <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center font-bold text-gray-600 text-lg">{user.fullName.charAt(0).toUpperCase()}</div>}
                            <div><p className="text-sm font-semibold text-gray-800 truncate">{user.fullName}</p><p className="text-xs text-gray-500">{user.role}</p></div>
                        </div>
                        <a href="#" onClick={(e) => { e.preventDefault(); if(onNavigate) onNavigate(Page.EditProfile); setIsMenuOpen(false); }} className="flex items-center space-x-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg><span>Edit Profile</span></a>
                        <button onClick={() => { if(onLogout) onLogout(); setIsMenuOpen(false); }} className="w-full text-left flex items-center space-x-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" /></svg><span>Logout</span></button>
                    </div>
                )}
            </div>
        </div>
    );
};

const ProjectHubScreen: React.FC<{ user: User; projects: Project[]; onNavigate: (page: Page, data?: any) => void; onLogout: () => void; onDelete: (id: string, name: string) => void; onRefresh: () => void; }> = ({ user, projects, onNavigate, onLogout, onDelete, onRefresh }) => {
    const getSeverityClasses = (severity: 'Safe' | 'Medium' | 'Critical') => ({ 'Safe': 'text-green-600 bg-green-100', 'Medium': 'text-yellow-600 bg-yellow-100', 'Critical': 'text-red-600 bg-red-100' }[severity]);
    return (
        <div className="bg-[#FAF9F6] min-h-screen">
            <AppHeader title="MEIL Project Hub" user={user} onLogout={onLogout} onNavigate={onNavigate} />
            <div className="p-4 space-y-4">
                 {user.role !== 'Workers' ? (
                    <div className="grid grid-cols-2 gap-4">
                        <button onClick={() => onNavigate(Page.NewProject)} className="bg-[#2E2E2E] text-white p-3 rounded-lg font-semibold flex items-center justify-center space-x-2 shadow-sm"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110 2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg><span>New Project</span></button>
                        <button onClick={onRefresh} className="bg-white text-gray-700 p-3 rounded-lg font-semibold border flex items-center justify-center space-x-2 shadow-sm"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 110 2H4a1 1 0 01-1-1V4a1 1 0 011-1zm10 8a1 1 0 011-1h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 111.885-.666A5.002 5.002 0 0014.001 13H11a1 1 0 01-1-1z" clipRule="evenodd" /></svg><span>Refresh Hub</span></button>
                    </div>
                ) : <button onClick={onRefresh} className="w-full bg-white text-gray-700 p-3 rounded-lg font-semibold border flex items-center justify-center space-x-2 shadow-sm"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 110 2H4a1 1 0 01-1-1V4a1 1 0 011-1zm10 8a1 1 0 011-1h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 111.885-.666A5.002 5.002 0 0014.001 13H11a1 1 0 01-1-1z" clipRule="evenodd" /></svg><span>Refresh Hub</span></button>}
                {projects.length > 0 ? projects.map(p => (
                    <div key={p.id} className="bg-[#2E2E2E] text-white p-4 rounded-xl shadow-lg space-y-3">
                        <div className="flex justify-between items-start">
                            <div><h2 className="font-bold text-lg">{p.name}</h2><p className="text-xs text-gray-400">Project Code: {p.project_id}</p><p className="text-sm text-gray-300 mt-1">{p.location}</p></div>
                            <div className="text-right flex flex-col items-end space-y-1"><span className={`text-xs font-semibold px-2 py-1 rounded-full ${p.status === 'Ongoing' ? 'bg-green-500/20 text-green-300' : 'bg-gray-500/20 text-gray-300'}`}>{p.status}</span><span className={`text-xs font-semibold px-2 py-1 rounded-full ${getSeverityClasses(p.severity)}`}>{p.severity}</span></div>
                        </div>
                        <div className="flex space-x-2">
                            <button onClick={() => onNavigate(Page.SafetyOfficerDashboard, { project: p })} className="flex-1 bg-white text-gray-800 py-2 rounded-lg font-semibold text-sm">Open</button>
                            {user.role !== 'Workers' && (<><button onClick={() => onNavigate(Page.EditProject, { projectToEdit: p })} className="flex-1 bg-blue-500/80 hover:bg-blue-500 text-white py-2 rounded-lg font-semibold text-sm">Edit</button><button onClick={() => onDelete(p.id, p.name)} className="flex-1 bg-red-500/80 hover:bg-red-500 text-white py-2 rounded-lg font-semibold text-sm">Delete</button></>)}
                        </div>
                    </div>
                )) : <div className="text-center py-10"><p className="text-gray-500">No projects found. Create one to get started!</p></div>}
            </div>
        </div>
    );
};

const NewProjectScreen: React.FC<{ onAddProject: (p: any) => void; currentUser: User }> = ({ onAddProject, currentUser }) => {
    const [project, setProject] = useState({ name: '', severity: 'Safe' as Project['severity'], location: '', department: '' });
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setProject({ ...project, [e.target.name]: e.target.value });
    const commonInputClasses = "w-full p-3 bg-gray-100 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1FA97C] transition text-gray-900 placeholder-gray-500";
    return (
        <div className="bg-[#FAF9F6] min-h-screen">
            <PageHeader title="New Project" />
            <div className="p-6 space-y-4">
                <div><label className="text-sm font-medium text-gray-600">Project Name</label><input name="name" value={project.name} onChange={handleChange} placeholder="Enter your project name" className={commonInputClasses}/></div>
                <div><label className="text-sm font-medium text-gray-600">Project ID</label><div className="p-3 bg-gray-200 rounded-lg text-gray-500">PRJ{Date.now()}</div></div>
                <div><label className="text-sm font-medium text-gray-600">Created By</label><div className="p-3 bg-gray-200 rounded-lg text-gray-500">{currentUser.fullName}</div></div>
                <div><label className="text-sm font-medium text-gray-600">Date & Time</label><div className="p-3 bg-gray-200 rounded-lg text-gray-500">{new Date().toLocaleString()}</div></div>
                <div><label className="text-sm font-medium text-gray-600">Severity Level</label><select name="severity" value={project.severity} onChange={handleChange} className={commonInputClasses}><option>Safe</option><option>Medium</option><option>Critical</option></select></div>
                <div><label className="text-sm font-medium text-gray-600">Location / Area</label><input name="location" value={project.location} onChange={handleChange} placeholder="Specific location" className={commonInputClasses}/></div>
                <div><label className="text-sm font-medium text-gray-600">Department or Section</label><input name="department" value={project.department} onChange={handleChange} placeholder="Department or section" className={commonInputClasses}/></div>
                <button onClick={() => onAddProject(project)} className="w-full mt-6 bg-[#2E2E2E] text-white py-3 rounded-lg font-semibold hover:bg-gray-700 transition shadow-md">Create</button>
            </div>
        </div>
    );
};

const EditProjectScreen: React.FC<{ project: Project; onUpdateProject: (p: Project) => void; }> = ({ project, onUpdateProject }) => {
    const [formData, setFormData] = useState<Project>(project);
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setFormData({ ...formData, [e.target.name]: e.target.value });
    const commonInputClasses = "w-full p-3 bg-gray-100 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1FA97C] transition text-gray-900 placeholder-gray-500";
    const readonlyClasses = "p-3 bg-gray-200 rounded-lg text-gray-500 text-sm";
    
    const creatorName = useMemo(() => {
        if (typeof formData.created_by === 'object' && formData.created_by?.full_name) {
            return formData.created_by.full_name;
        }
        return 'N/A';
    }, [formData.created_by]);

    return (
        <div className="bg-[#FAF9F6] min-h-screen">
            <PageHeader title="Edit Project" />
            <div className="p-6 space-y-4">
                <div><label className="text-sm font-medium text-gray-600">Project Name</label><input name="name" value={formData.name} onChange={handleChange} placeholder="Enter your project name" className={commonInputClasses}/></div>
                <div><label className="text-sm font-medium text-gray-600">Project ID</label><div className={readonlyClasses}>{formData.project_id}</div></div>
                <div><label className="text-sm font-medium text-gray-600">Created By</label><div className={readonlyClasses}>{creatorName}</div></div>
                <div><label className="text-sm font-medium text-gray-600">Date & Time</label><div className={readonlyClasses}>{new Date(formData.created_at).toLocaleString()}</div></div>
                <div><label className="text-sm font-medium text-gray-600">Severity Level</label><select name="severity" value={formData.severity} onChange={handleChange} className={commonInputClasses}><option>Safe</option><option>Medium</option><option>Critical</option></select></div>
                <div><label className="text-sm font-medium text-gray-600">Status</label><select name="status" value={formData.status} onChange={handleChange} className={commonInputClasses}><option>Ongoing</option><option>Completed</option></select></div>
                <div><label className="text-sm font-medium text-gray-600">Location / Area</label><input name="location" value={formData.location} onChange={handleChange} placeholder="Specific location" className={commonInputClasses}/></div>
                <div><label className="text-sm font-medium text-gray-600">Department or Section</label><input name="department" value={formData.department} onChange={handleChange} placeholder="Department or section" className={commonInputClasses}/></div>
                <button onClick={() => onUpdateProject(formData)} className="w-full mt-6 bg-[#2E2E2E] text-white py-3 rounded-lg font-semibold hover:bg-gray-700 transition shadow-md">Save Changes</button>
            </div>
        </div>
    );
};

const SafetyOfficerDashboard: React.FC<{ user: User; project: Project; onNavigate: (page: Page, data?: any) => void; onLogout: () => void; submittedForms: FormRecord[] }> = ({ user, project, onNavigate, onLogout, submittedForms }) => {
    const moduleStats = useMemo(() => {
        const statsByModule: Record<FormType, { safe: number; medium: number; critical: number }> = {} as any;
        const projectForms = submittedForms.filter(f => f.project_id === project.id);

        for (const module of SAFETY_MODULES) {
            const moduleForms = projectForms.filter(f => f.form_type === module.title);
            const counts = { safe: 0, medium: 0, critical: 0 };
            for (const form of moduleForms) {
                if (form.data.severityLevel === 'Safe') counts.safe++;
                else if (form.data.severityLevel === 'Medium') counts.medium++;
                else if (form.data.severityLevel === 'Critical') counts.critical++;
            }
            statsByModule[module.title] = counts;
        }
        return statsByModule;
    }, [submittedForms, project.id]);

    return (
        <div className="bg-[#FAF9F6] min-h-screen">
            <AppHeader title="Safety Officer" user={user} onLogout={onLogout} onNavigate={onNavigate}/>
            <div className="p-4 space-y-3">
                 <button onClick={() => onNavigate(Page.ProjectHub)} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-semibold text-sm flex items-center justify-center space-x-2 shadow-sm hover:bg-gray-50 mb-2 w-full"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg><span>Back to Project Hub</span></button>
                <p className="text-center font-semibold text-gray-700">Project: {project.name}</p>
                
                 <button onClick={() => onNavigate(Page.TrainingMaterials, { project })} className="w-full bg-[#42A5F5] text-white p-4 rounded-xl shadow-lg text-left">
                    <h3 className="font-bold text-lg">Manage Training Materials</h3>
                    <p className="text-xs mt-1 text-blue-100">Upload and manage training content for workers.</p>
                </button>

                <button onClick={() => onNavigate(Page.SafetyDrillsManagement, { project })} className="w-full bg-[#F9A825] text-white p-4 rounded-xl shadow-lg text-left">
                    <h3 className="font-bold text-lg">Manage Safety Drills</h3>
                    <p className="text-xs mt-1 text-yellow-100">Create and assign safety drills to workers.</p>
                </button>
                
                {SAFETY_MODULES.map(module => {
                    const stats = moduleStats[module.title] || { safe: 0, medium: 0, critical: 0 };
                    const isReportsModule = module.title === FormType.Reports;
                    return (
                        <button key={module.title} onClick={() => onNavigate(isReportsModule ? Page.ReportsDashboard : Page.ModuleLanding, { project, formType: module.title })} className="w-full bg-[#2E2E2E] text-white p-4 rounded-xl shadow-lg text-left disabled:opacity-50 disabled:cursor-not-allowed">
                            <h3 className="font-bold text-lg">{module.title}</h3>
                             {isReportsModule ? (
                                <p className="text-xs mt-1 text-gray-400">Generate summaries and analyze performance</p>
                             ) : (
                                <div className="flex space-x-4 text-xs mt-1 text-gray-300">
                                    <span className="text-green-400">● {stats.safe} Safe</span>
                                    <span className="text-yellow-400">● {stats.medium} Medium</span>
                                    <span className="text-red-400">● {stats.critical} Critical</span>
                                </div>
                             )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};


const DashboardCard: React.FC<{ title: string, children: React.ReactNode, className?: string }> = ({ title, children, className }) => (<div className={`bg-white p-4 rounded-xl shadow-lg ${className}`}><h3 className="font-bold text-lg text-gray-800 mb-3">{title}</h3>{children}</div>);

const HOManagerDashboard: React.FC<{ user: User, project: Project, onNavigate: (page: Page, data?: any) => void; onLogout: () => void; submittedForms: FormRecord[], safetyDrills: SafetyDrill[], projectWorkerDrills: WorkerDrill[] }> = ({ user, project, onNavigate, onLogout, submittedForms, safetyDrills, projectWorkerDrills }) => {
    const projectForms = useMemo(() => submittedForms.filter(f => f.project_id === project.id), [submittedForms, project.id]);
    
    const reportsByModule = useMemo(() => {
        const counts = projectForms.reduce((acc, form) => {
            acc[form.form_type] = (acc[form.form_type] || 0) + 1;
            return acc;
        }, {} as Record<FormType, number>);
        
        return Object.entries(counts).map(([label, value]) => ({ label, value })).sort((a,b) => b.value - a.value).slice(0, 6);
    }, [projectForms]);
    
    const drillPerformance = useMemo(() => {
        const totalCompletions = projectWorkerDrills.filter(pwd => pwd.status === 'Completed').length;
        const participatingWorkers = new Set(projectWorkerDrills.map(pwd => pwd.worker_id)).size;
        
        return {
            totalDrills: safetyDrills.length,
            totalCompletions,
            participatingWorkers,
        };
    }, [safetyDrills, projectWorkerDrills]);

    return (
        <div className="bg-[#FAF9F6] min-h-screen">
            <AppHeader title="HO Manager Dashboard" user={user} onLogout={onLogout} onNavigate={onNavigate} />
            <div className="p-4 space-y-4">
                <button onClick={() => onNavigate(Page.ProjectHub)} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-semibold text-sm flex items-center justify-center space-x-2 shadow-sm hover:bg-gray-50 mb-2 w-full"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg><span>Back to Project Hub</span></button>
                <p className="text-center font-semibold text-gray-700">Project: {project.name}</p>
                <DashboardCard title="Training Content"><p className="text-sm text-gray-600 mb-4">Upload and manage training content for this project.</p><button onClick={() => onNavigate(Page.TrainingMaterials, { project })} className="w-full bg-[#42A5F5] text-white py-3 rounded-lg font-semibold hover:bg-blue-600 transition shadow-md">Manage Materials</button></DashboardCard>
                <DashboardCard title="Drill Performance">
                     <div className="grid grid-cols-3 gap-2 text-center">
                        <div><p className="text-2xl font-bold text-blue-600">{drillPerformance.totalDrills}</p><p className="text-xs text-gray-500">Total Drills</p></div>
                        <div><p className="text-2xl font-bold text-green-600">{drillPerformance.totalCompletions}</p><p className="text-xs text-gray-500">Completions</p></div>
                        <div><p className="text-2xl font-bold text-purple-600">{drillPerformance.participatingWorkers}</p><p className="text-xs text-gray-500">Participants</p></div>
                    </div>
                </DashboardCard>
                <DashboardCard title="Field Performance Analysis"><p className="text-sm text-gray-600 mb-4">Top reported issue types for this project.</p><ReportsBarChart data={reportsByModule} /></DashboardCard>
                <DashboardCard title="Generate Custom Report"><p className="text-sm text-gray-600 mb-4">Filter all reports by date and type for deep analysis.</p><button onClick={() => onNavigate(Page.ReportsDashboard, { project })} className="w-full bg-[#1FA97C] text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition shadow-md">Open Report Generator</button></DashboardCard>
            </div>
        </div>
    );
};

const TopManagerDashboard: React.FC<{ user: User, project: Project, onNavigate: (page: Page, data?: any) => void; onLogout: () => void; submittedForms: FormRecord[]; onExport: (records: FormRecord[], filename: string) => void; safetyDrills: SafetyDrill[]; projectWorkerDrills: WorkerDrill[]; }> = ({ user, project, onNavigate, onLogout, submittedForms, onExport, safetyDrills, projectWorkerDrills }) => {
    const projectForms = useMemo(() => submittedForms.filter(f => f.project_id === project.id), [submittedForms, project.id]);

    const complianceData = useMemo(() => {
        const total = projectForms.length;
        if (total === 0) return { compliance: 'N/A', total, closed: 0 };
        const closed = projectForms.filter(f => f.status === 'Closed').length;
        const compliance = ((closed / total) * 100).toFixed(1);
        return { compliance, total, closed };
    }, [projectForms]);

    const openIssuesBySeverity = useMemo(() => {
        const openIssues = projectForms.filter(f => f.status !== 'Closed');
        return {
            critical: openIssues.filter(f => f.data.severityLevel === 'Critical').length,
            medium: openIssues.filter(f => f.data.severityLevel === 'Medium').length,
        };
    }, [projectForms]);
    
     const drillPerformance = useMemo(() => {
        const totalCompletions = projectWorkerDrills.filter(pwd => pwd.status === 'Completed').length;
        const participatingWorkers = new Set(projectWorkerDrills.map(pwd => pwd.worker_id)).size;
        
        return {
            totalDrills: safetyDrills.length,
            totalCompletions,
            participatingWorkers,
        };
    }, [safetyDrills, projectWorkerDrills]);

    const trendData = useMemo(() => {
        const reportsByMonth = projectForms.reduce((acc, form) => {
            const month = new Date(form.submitted_at).toLocaleString('default', { month: 'short', year: 'numeric' });
            acc[month] = (acc[month] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const closedByMonth = projectForms
            .filter(form => form.status === 'Closed' && form.updates?.length > 0)
            .reduce((acc, form) => {
                const closeUpdate = [...form.updates].reverse().find(u => u.status === 'Closed');
                if (closeUpdate) {
                    const month = new Date(closeUpdate.timestamp).toLocaleString('default', { month: 'short', year: 'numeric' });
                    acc[month] = (acc[month] || 0) + 1;
                }
                return acc;
            }, {} as Record<string, number>);

        const submittedData = Object.entries(reportsByMonth)
            .map(([dateStr, count]) => ({ date: new Date(dateStr), count }))
            .sort((a, b) => a.date.getTime() - b.date.getTime());

        const closedData = Object.entries(closedByMonth)
            .map(([dateStr, count]) => ({ date: new Date(dateStr), count }))
            .sort((a, b) => a.date.getTime() - b.date.getTime());

        return [
            { label: 'Submitted', data: submittedData, color: '#42A5F5' },
            { label: 'Closed', data: closedData, color: '#1FA97C' }
        ];
    }, [projectForms]);

    return (
        <div className="bg-[#FAF9F6] min-h-screen">
            <AppHeader title="Top Management Dashboard" user={user} onLogout={onLogout} onNavigate={onNavigate} />
            <div className="p-4 space-y-4">
                <button onClick={() => onNavigate(Page.ProjectHub)} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-semibold text-sm flex items-center justify-center space-x-2 shadow-sm hover:bg-gray-50 mb-2 w-full"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg><span>Back to Project Hub</span></button>
                <p className="text-center font-semibold text-gray-700">Project: {project.name}</p>
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white p-3 rounded-xl shadow text-center">
                        <p className="text-2xl font-bold text-green-600">{complianceData.compliance}%</p>
                        <p className="text-xs text-gray-500">Safety Compliance</p>
                        <p className="text-xs text-gray-400 mt-1">({complianceData.closed}/{complianceData.total} closed)</p>
                    </div>
                    <div className="bg-white p-3 rounded-xl shadow text-center">
                        <p className="text-2xl font-bold text-red-600">{openIssuesBySeverity.critical}</p>
                        <p className="text-xs text-gray-500">Active High-Risk Issues</p>
                        <p className="text-xs text-gray-400 mt-1">Medium: {openIssuesBySeverity.medium}</p>
                    </div>
                </div>
                <DashboardCard title="Strategic Safety Summary">
                    <p className="text-sm text-gray-600 mb-2">Monthly trend of submitted vs. closed reports.</p>
                    <TrendLineChart datasets={trendData} />
                </DashboardCard>
                 <DashboardCard title="Training Content"><p className="text-sm text-gray-600 mb-4">Oversee training content performance for this project.</p><button onClick={() => onNavigate(Page.TrainingMaterials, { project })} className="w-full bg-[#42A5F5] text-white py-3 rounded-lg font-semibold hover:bg-blue-600 transition shadow-md">View Materials</button></DashboardCard>
                 <DashboardCard title="Drill Performance">
                     <div className="grid grid-cols-3 gap-2 text-center">
                        <div><p className="text-2xl font-bold text-blue-600">{drillPerformance.totalDrills}</p><p className="text-xs text-gray-500">Total Drills</p></div>
                        <div><p className="text-2xl font-bold text-green-600">{drillPerformance.totalCompletions}</p><p className="text-xs text-gray-500">Completions</p></div>
                        <div><p className="text-2xl font-bold text-purple-600">{drillPerformance.participatingWorkers}</p><p className="text-xs text-gray-500">Participants</p></div>
                    </div>
                </DashboardCard>
                <DashboardCard title="Project Data Actions">
                    <div className="space-y-3">
                        <p className="text-sm text-gray-600">Filter all reports for strategic insights or export the full dataset for this project.</p>
                        <button onClick={() => onNavigate(Page.ReportsDashboard, { project })} className="w-full bg-[#1FA97C] text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition shadow-md">Open Report Generator</button>
                        <button onClick={() => onExport(projectForms, `${project.name.replace(/\s/g, '_')}_FullExport`)} className="w-full bg-blue-500 text-white py-3 rounded-lg font-semibold hover:bg-blue-600 transition shadow-md">Export All Project Data</button>
                    </div>
                </DashboardCard>
            </div>
        </div>
    );
};

const WorkerDashboard: React.FC<{ 
    user: User; 
    project: Project; 
    onNavigate: (page: Page, data?: any) => void; 
    onLogout: () => void; 
    submittedForms: FormRecord[]; 
    trainingMaterials: TrainingMaterial[]; 
    notifications: Notification[];
    trainingAssignments: TrainingAssignment[];
    safetyDrills: SafetyDrill[];
    workerDrills: WorkerDrill[];
    onUpdateDrillProgress: (drill: SafetyDrill, stepIndex: number) => void;
    onRecordTrainingView: (materialId: string) => void;
}> = ({ user, project, onNavigate, onLogout, submittedForms, trainingMaterials, notifications, trainingAssignments, safetyDrills, workerDrills, onUpdateDrillProgress, onRecordTrainingView }) => {
    
    const goodPracticesCount = useMemo(() => {
        return submittedForms.filter(form => {
            const isGoodPractice = form.form_type === FormType.GoodPractices;
            const submittedByMe = (typeof form.submitted_by_id === 'string' ? form.submitted_by_id : form.submitted_by_id.id) === user.id;
            return isGoodPractice && submittedByMe;
        }).length;
    }, [submittedForms, user.id]);

    const projectTrainingMaterials = useMemo(() => {
        return trainingMaterials.filter(tm => tm.project_id === project.id);
    }, [trainingMaterials, project.id]);

    const trainingStats = useMemo(() => {
        const projectAssignments = trainingAssignments.filter(ta => ta.training_materials?.project_id === project.id);
        return {
            completed: projectAssignments.filter(a => a.status === 'Completed').length,
            pending: projectAssignments.filter(a => a.status === 'In Progress').length,
            upcoming: projectAssignments.filter(a => a.status === 'Not Started').length
        };
    }, [trainingAssignments, project.id]);

    const drillStats = useMemo(() => {
        const projectDrills = safetyDrills.filter(d => d.project_id === project.id);
        const myDrillStatuses = new Map(workerDrills.map(wd => [wd.drill_id, wd.status]));
        
        return {
            completed: projectDrills.filter(d => myDrillStatuses.get(d.id) === 'Completed').length,
            pending: projectDrills.filter(d => myDrillStatuses.get(d.id) === 'Pending').length,
            upcoming: projectDrills.filter(d => !myDrillStatuses.has(d.id)).length,
        };
    }, [safetyDrills, workerDrills, project.id]);

    const getFileIcon = (fileType: TrainingMaterial['file_type']) => {
        switch (fileType) {
            case 'pdf': return <DocumentIcon className="w-8 h-8 text-red-500 flex-shrink-0" />;
            case 'video': return <VideoIcon className="w-8 h-8 text-blue-500 flex-shrink-0" />;
            case 'image': return <ImageIcon className="w-8 h-8 text-green-500 flex-shrink-0" />;
            default: return <DocumentIcon className="w-8 h-8 text-gray-500 flex-shrink-0" />;
        }
    };

    return (
        <div className="bg-[#FAF9F6] min-h-screen">
            <AppHeader title="Worker Safety Hub" user={user} onLogout={onLogout} onNavigate={onNavigate} />
            <div className="p-4 space-y-4">
                <button onClick={() => onNavigate(Page.ProjectHub)} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-semibold text-sm flex items-center justify-center space-x-2 shadow-sm hover:bg-gray-50 mb-2 w-full"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg><span>Back to Project Hub</span></button>
                <p className="text-center font-semibold text-gray-700">Project: {project.name}</p>
                
                 <div className="grid grid-cols-2 gap-4">
                    <DashboardCard title="Training Status" className="bg-gray-800 text-white col-span-1">
                        <div className="grid grid-cols-3 gap-1 text-center">
                            <div><p className="text-xl font-bold text-green-400">{trainingStats.completed}</p><p className="text-xs text-gray-300">Completed</p></div>
                            <div><p className="text-xl font-bold text-yellow-400">{trainingStats.pending}</p><p className="text-xs text-gray-300">Pending</p></div>
                            <div><p className="text-xl font-bold text-blue-400">{trainingStats.upcoming}</p><p className="text-xs text-gray-300">Upcoming</p></div>
                        </div>
                    </DashboardCard>
                     <DashboardCard title="Drill Status" className="bg-gray-800 text-white col-span-1">
                        <div className="grid grid-cols-3 gap-1 text-center">
                            <div><p className="text-xl font-bold text-green-400">{drillStats.completed}</p><p className="text-xs text-gray-300">Completed</p></div>
                            <div><p className="text-xl font-bold text-yellow-400">{drillStats.pending}</p><p className="text-xs text-gray-300">Pending</p></div>
                            <div><p className="text-xl font-bold text-blue-400">{drillStats.upcoming}</p><p className="text-xs text-gray-300">Upcoming</p></div>
                        </div>
                    </DashboardCard>
                </div>
                
                <DashboardCard title="Safety Drills">
                    {safetyDrills.length > 0 ? (
                        <div className="space-y-3 max-h-56 overflow-y-auto pr-2">
                            {safetyDrills.map(drill => {
                                const myDrillRecord = workerDrills.find(wd => wd.drill_id === drill.id);
                                const completedSteps = myDrillRecord?.completed_steps || [];
                                const totalSteps = drill.steps.length;
                                const isCompleted = totalSteps > 0 && completedSteps.length === totalSteps;
                                const progress = totalSteps > 0 ? (completedSteps.length / totalSteps) * 100 : 0;
                                
                                return (
                                    <button 
                                        key={drill.id} 
                                        className={`w-full text-left p-3 rounded-lg transition-all hover:shadow-lg active:scale-[0.98] ${isCompleted ? 'bg-green-50 border border-green-200' : 'bg-gray-50'}`}
                                        onClick={() => onNavigate(Page.SafetyDrillDetail, { drill })}
                                        aria-label={`View details for drill: ${drill.title}`}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="pr-2">
                                                <p className={`font-semibold text-sm ${isCompleted ? 'text-green-800' : 'text-gray-800'}`}>{drill.title}</p>
                                                <p className="text-xs text-gray-500 truncate">{drill.description}</p>
                                            </div>
                                            <div className="flex-shrink-0">
                                                {isCompleted ? (
                                                    <span className="text-xs font-semibold px-2 py-1 rounded-full flex items-center space-x-1 bg-green-100 text-green-700">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                                                        <span>Completed</span>
                                                    </span>
                                                ) : (
                                                    <span className="text-xs font-semibold px-2 py-1 rounded-full bg-yellow-100 text-yellow-700">
                                                        {completedSteps.length}/{totalSteps} steps
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        
                                        {!isCompleted && totalSteps > 0 && (
                                            <div className="my-2">
                                                <div className="w-full bg-gray-200 rounded-full h-1.5">
                                                    <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${progress}%` }}></div>
                                                </div>
                                            </div>
                                        )}
                                    </button>
                                )
                            })}
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500 text-center py-4">No safety drills assigned for this project yet.</p>
                    )}
                </DashboardCard>

                <DashboardCard title="Performance Record">
                    <div className="flex items-center space-x-4">
                        <div className="bg-green-100 p-3 rounded-full"><span className="text-2xl">🏆</span></div>
                        <div>
                            <p className="text-3xl font-bold text-green-600">{goodPracticesCount}</p>
                            <p className="text-sm text-gray-600">Good Practices Reported</p>
                        </div>
                    </div>
                </DashboardCard>

                <DashboardCard title="Training Manuals">
                    {projectTrainingMaterials.length > 0 ? (
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                            {projectTrainingMaterials.map(material => (
                                <a key={material.id} href={material.file_url} target="_blank" rel="noopener noreferrer" onClick={() => onRecordTrainingView(material.id)} className="flex items-center space-x-3 p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
                                    {getFileIcon(material.file_type)}
                                    <div>
                                        <p className="font-semibold text-sm text-gray-800">{material.title}</p>
                                        <p className="text-xs text-gray-500">{material.description}</p>
                                    </div>
                                </a>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500 text-center py-4">No training materials uploaded for this project yet.</p>
                    )}
                </DashboardCard>

                <DashboardCard title="Notifications">
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                         {notifications.length > 0 ? notifications.map(notification => (
                            <div key={notification.id} className="bg-blue-100 border-l-4 border-blue-500 text-blue-800 p-3" role="alert">
                                <p className="font-bold text-sm">{notification.title}</p>
                                <p className="text-xs mt-1">{notification.message}</p>
                            </div>
                         )) : (
                            <p className="text-sm text-gray-500 text-center py-4">No new notifications.</p>
                         )}
                    </div>
                </DashboardCard>

                <button onClick={() => onNavigate(Page.Form, { project, currentFormType: FormType.GoodPractices })} className="w-full bg-[#2E2E2E] text-white p-4 rounded-xl shadow-lg text-left"><h3 className="font-bold text-lg">Report Good Practice</h3><p className="text-xs mt-1 text-gray-300">Spotted something safe? Let us know!</p></button>
            </div>
        </div>
    );
};

const FormScreen: React.FC<{ 
    formType: FormType; 
    user: User | null; 
    onAddFormRecord: (data: Record<string, any>, files: Record<string, File | null>, draftIdToDelete?: number) => void; 
    projects: Project[];
    onSaveOrUpdateDraft: (draftData: Omit<DraftRecord, 'id' | 'saved_at'>, existingId?: number) => void;
    draftToEdit: DraftRecord | null;
}> = ({ formType, user, onAddFormRecord, projects, onSaveOrUpdateDraft, draftToEdit }) => {
    const getInitialState = useCallback(() => {
        const initialState: { [key: string]: any } = {};
        FORM_CONFIGS[formType]?.forEach(field => {
            if (field.type === 'readonly') {
                if (field.name.toLowerCase().includes('id')) initialState[field.name] = `${formType.substring(0,3).toUpperCase()}${Date.now()}`;
                else if (field.name.toLowerCase().includes('by')) initialState[field.name] = user?.fullName || 'N/A';
            } else if (field.type === 'date') {
                 // Format date for <input type="datetime-local"> which needs YYYY-MM-DDTHH:mm
                const now = new Date();
                now.setMinutes(now.getMinutes() - now.getTimezoneOffset()); // Adjust for local timezone
                initialState[field.name] = now.toISOString().slice(0, 16);
            } else {
                 initialState[field.name] = '';
            }
        });
        return initialState;
    }, [formType, user]);

    const [formData, setFormData] = useState(getInitialState);
    const [fileData, setFileData] = useState<Record<string, File | null>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [photoPreviews, setPhotoPreviews] = useState<Record<string, string>>({});

    useEffect(() => {
        if (draftToEdit) {
            setFormData(draftToEdit.data);
            setFileData(draftToEdit.fileData);
            // Recreate photo previews from files if they exist
            const newPreviews: Record<string, string> = {};
            for (const [key, file] of Object.entries(draftToEdit.fileData)) {
                if (file) {
                    newPreviews[key] = URL.createObjectURL(file);
                }
            }
            setPhotoPreviews(newPreviews);
        } else {
            // This is important to reset the form when navigating to create a new one
            setFormData(getInitialState());
            setFileData({});
            setPhotoPreviews({});
        }
    }, [draftToEdit, getInitialState]);


    const formConfig = useMemo(() => {
        const config = FORM_CONFIGS[formType] || [];
        return config.map(field => {
            if (field.name === 'project') {
                return { ...field, options: projects.map(p => p.name) };
            }
            return field;
        });
    }, [formType, projects]);

    const validate = (): boolean => {
        const newErrors: Record<string, string> = {};
        let isValid = true;
        formConfig.forEach(field => {
            if (field.required && !formData[field.name]) {
                newErrors[field.name] = 'This field is required';
                isValid = false;
            }
        });
        setErrors(newErrors);
        return isValid;
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        if (errors[name]) setErrors(prev => { const newErrors = { ...prev }; delete newErrors[name]; return newErrors; });
        if (type === 'file') {
            const files = (e.target as HTMLInputElement).files;
            if (files && files[0]) {
                const file = files[0];
                setFileData(prev => ({ ...prev, [name]: file }));
                setPhotoPreviews(prev => ({...prev, [name]: URL.createObjectURL(file)}));
            }
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleSubmit = (isDraft: boolean) => {
        if (!isDraft && !validate()) return;
        
        if (isDraft) {
            const selectedProjectObj = projects.find(p => p.name === formData.project);
            if (!selectedProjectObj) {
                setErrors(prev => ({ ...prev, project: 'Please select a project to save a draft.' }));
                return;
            }
            const draftData: Omit<DraftRecord, 'id' | 'saved_at'> = {
                form_type: formType,
                project_id: selectedProjectObj.id,
                data: formData,
                fileData: fileData
            };
            onSaveOrUpdateDraft(draftData, draftToEdit?.id);
        } else {
            onAddFormRecord(formData, fileData, draftToEdit?.id);
        }
    };

    const commonInputClasses = "w-full p-3 bg-gray-100 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1FA97C] transition text-gray-900 placeholder-gray-500";
    const errorInputClasses = "border-red-500 ring-1 ring-red-500";

    const renderField = (field: FormField) => {
        const { name, label, type, options, placeholder } = field;
        const hasError = !!errors[name];

        if (type === 'readonly') return <div className="p-3 bg-gray-200 rounded-lg text-gray-600 text-sm truncate">{formData[name]}</div>;
        if (type === 'textarea') return <textarea name={name} value={formData[name]} onChange={handleChange} placeholder={placeholder} className={`${commonInputClasses} ${hasError ? errorInputClasses : ''} min-h-[100px]`}></textarea>;
        if (type === 'select') return (<select name={name} value={formData[name]} onChange={handleChange} className={`${commonInputClasses} ${hasError ? errorInputClasses : ''}`}><option value="" disabled>Select {label.toLowerCase()}</option>{options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}</select>);
        if (type === 'photo') {
             const previewUrl = photoPreviews[name];
             const file = fileData[name];
             return (<div><label htmlFor={name} className={`w-full p-4 bg-gray-100 rounded-lg border-2 border-dashed  flex flex-col justify-center items-center cursor-pointer h-28 ${hasError ? 'border-red-500' : 'border-gray-300'}`}>{previewUrl ? <img src={previewUrl} alt="Preview" className="max-h-full rounded" /> : <><p className="text-sm font-semibold text-gray-600">Click to upload</p><p className="text-xs text-gray-500">PNG, JPG, MP4 up to 100MB</p></>}</label><input id={name} name={name} type="file" accept="image/*,video/*" onChange={handleChange} className="hidden" />{file && <span className="text-xs text-gray-600 mt-1 block truncate">{file.name}</span>}</div>);
        }
        return <input type={type === 'date' ? 'datetime-local' : type} name={name} value={formData[name]} onChange={handleChange} placeholder={placeholder} className={`${commonInputClasses} ${hasError ? errorInputClasses : ''}`} />;
    };
    const hasPairedPhotos = formConfig.some(f => f.name === 'beforePhoto') && formConfig.some(f => f.name === 'afterPhoto');

    return (
        <div className="bg-[#FAF9F6] min-h-screen">
            <PageHeader title={formType} />
            <div className="p-6">
                <div className="bg-white p-6 rounded-2xl shadow-lg space-y-4">
                    {formConfig.length > 0 ? formConfig.map(field => {
                        const hasError = !!errors[field.name];
                        if (hasPairedPhotos && field.name === 'afterPhoto') return null;
                        if (hasPairedPhotos && field.name === 'beforePhoto') {
                            const afterField = formConfig.find(f => f.name === 'afterPhoto')!;
                            return (<div key="photo-grid"><div className="grid grid-cols-2 gap-4"><div className="space-y-1"><label className="text-sm font-medium text-gray-600">{field.label}</label>{renderField(field)}{!!errors[field.name] && <p className="text-red-500 text-xs mt-1">{errors[field.name]}</p>}</div><div className="space-y-1"><label className="text-sm font-medium text-gray-600">{afterField.label}</label>{renderField(afterField)}{!!errors[afterField.name] && <p className="text-red-500 text-xs mt-1">{errors[afterField.name]}</p>}</div></div></div>);
                        }
                        return (<div key={field.name} className="space-y-1"><label className="text-sm font-medium text-gray-600">{field.label}</label>{renderField(field)}{hasError && <p className="text-red-500 text-xs mt-1">{errors[field.name]}</p>}</div>);
                    }) : <p className="text-center text-gray-500">This form is not yet configured.</p>}
                    {formConfig.length > 0 && (<div className="pt-4 space-y-3"><button onClick={() => handleSubmit(false)} className="w-full bg-[#2E2E2E] text-white py-3 rounded-lg font-semibold hover:bg-gray-700 transition shadow-md">Submit Record</button><button onClick={() => handleSubmit(true)} className="w-full bg-white text-gray-700 py-3 rounded-lg font-semibold border hover:bg-gray-100 transition shadow-sm">Save as Draft</button></div>)}
                </div>
            </div>
        </div>
    );
};

const EditProfileScreen: React.FC<{ user: User; onUpdateUser: (data: Partial<User>, photoFile?: File) => void; }> = ({ user, onUpdateUser }) => {
    const [formData, setFormData] = useState({ fullName: user.fullName || '', emergencyContact: user.emergencyContact || '' });
    const [photoFile, setPhotoFile] = useState<File | undefined>();
    const [photoPreview, setPhotoPreview] = useState<string | undefined>(user.profilePhotoUrl);

    useEffect(() => {
        setFormData({
            fullName: user.fullName || '',
            emergencyContact: user.emergencyContact || '',
        });
        setPhotoPreview(user.profilePhotoUrl);
    }, [user]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, [e.target.name]: e.target.value });
    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files?.[0]) { setPhotoFile(e.target.files[0]); setPhotoPreview(URL.createObjectURL(e.target.files[0])); } };
    const handleSave = () => { onUpdateUser(formData, photoFile); };
    const commonInputClasses = "w-full p-3 bg-gray-100 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1FA97C] transition text-gray-900 placeholder-gray-500";
    return (
        <div className="bg-[#FAF9F6] min-h-screen">
            <PageHeader title="Edit Profile" />
            <div className="p-6">
                <div className="bg-white p-6 rounded-2xl shadow-lg space-y-6">
                    <div className="flex flex-col items-center space-y-2">
                        <label htmlFor="photo-upload" className="cursor-pointer">{photoPreview ? <img src={photoPreview} alt="Profile Preview" className="w-24 h-24 rounded-full object-cover ring-2 ring-offset-2 ring-[#1FA97C]" /> : <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center font-bold text-gray-600 text-4xl ring-2 ring-offset-2 ring-gray-300">{user.fullName.charAt(0).toUpperCase()}</div>}</label>
                        <input id="photo-upload" type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
                        <button onClick={() => document.getElementById('photo-upload')?.click()} className="text-sm font-semibold text-[#1FA97C] hover:underline">Change Photo</button>
                    </div>
                    <div className="space-y-1"><label className="text-sm font-medium text-gray-600">Full Name</label><input name="fullName" value={formData.fullName} onChange={handleChange} className={commonInputClasses} /></div>
                    <div className="space-y-1"><label className="text-sm font-medium text-gray-600">Emergency Contact</label><input name="emergencyContact" value={formData.emergencyContact} onChange={handleChange} className={commonInputClasses} /></div>
                    <div className="space-y-1"><label className="text-sm font-medium text-gray-600">Employee ID</label><div className="p-3 bg-gray-200 rounded-lg text-gray-500">{user.employeeId || 'N/A'}</div></div>
                    <div className="space-y-1"><label className="text-sm font-medium text-gray-600">Role</label><div className="p-3 bg-gray-200 rounded-lg text-gray-500">{user.role}</div></div>
                    <button onClick={handleSave} className="w-full mt-4 bg-[#2E2E2E] text-white py-3 rounded-lg font-semibold hover:bg-gray-700 transition shadow-md">Save Changes</button>
                </div>
            </div>
        </div>
    );
};

const ModuleLandingScreen: React.FC<{ moduleType: FormType; project: Project; onNavigate: (page: Page, data?: any) => void; draftsCount: number; }> = ({ moduleType, project, onNavigate, draftsCount }) => (
    <div className="bg-[#FAF9F6] min-h-screen">
        <PageHeader title={moduleType}><p className="text-sm font-semibold text-gray-500 mt-1">Project: {project.name}</p></PageHeader>
        <div className="p-6 space-y-4">
            <button onClick={() => onNavigate(Page.Form, { currentFormType: moduleType })} className="w-full bg-[#2E2E2E] text-white p-6 rounded-xl shadow-lg text-left flex items-center space-x-4"><svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110 2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg><div><h3 className="font-bold text-lg">Report</h3><p className="text-sm text-gray-300">Create and submit a new record.</p></div></button>
            {draftsCount > 0 && (
                 <button onClick={() => onNavigate(Page.DraftList, { formType: moduleType })} className="w-full bg-yellow-500 text-white p-6 rounded-xl shadow-lg text-left border flex items-center space-x-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>
                    <div>
                        <h3 className="font-bold text-lg">View Drafts</h3>
                        <p className="text-sm text-yellow-100">{draftsCount} draft(s) waiting to be completed.</p>
                    </div>
                </button>
            )}
            <button onClick={() => onNavigate(Page.IssueList, { formType: moduleType })} className="w-full bg-white text-gray-800 p-6 rounded-xl shadow-lg text-left border flex items-center space-x-4"><svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" /><path fillRule="evenodd" d="M4 5a2 2 0 012-2h8a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 011-1h6a1 1 0 110 2H8a1 1 0 01-1-1zm-1 4a1 1 0 100 2h6a1 1 0 100-2H6z" clipRule="evenodd" /></svg><div><h3 className="font-bold text-lg">View Records</h3><p className="text-sm text-gray-500">Review all submitted records.</p></div></button>
        </div>
    </div>
);

const DraftListScreen: React.FC<{ 
    moduleType: FormType; 
    project: Project; 
    drafts: DraftRecord[]; 
    onNavigate: (page: Page, data?: any) => void;
    onDeleteDraft: (draftId: number) => void;
    onBulkDeleteDrafts: (draftIds: number[]) => void;
    onBulkSubmitDrafts: (draftIds: number[]) => void;
}> = ({ moduleType, project, drafts, onNavigate, onDeleteDraft, onBulkDeleteDrafts, onBulkSubmitDrafts }) => {
    const [selectedDraftIds, setSelectedDraftIds] = useState<number[]>([]);

    const relevantDrafts = useMemo(() => drafts.filter(draft => 
        draft.project_id === project.id && draft.form_type === moduleType
    ).sort((a,b) => new Date(b.saved_at).getTime() - new Date(a.saved_at).getTime()), [drafts, project.id, moduleType]);

    useEffect(() => {
        // Clear selection if the list of relevant drafts changes (e.g., after deletion)
        setSelectedDraftIds([]);
    }, [relevantDrafts.length]);

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedDraftIds(relevantDrafts.map(d => d.id!));
        } else {
            setSelectedDraftIds([]);
        }
    };

    const handleSelectOne = (draftId: number) => {
        setSelectedDraftIds(prev => 
            prev.includes(draftId)
                ? prev.filter(id => id !== draftId)
                : [...prev, draftId]
        );
    };
    
    const handleBulkDelete = () => {
        onBulkDeleteDrafts(selectedDraftIds);
        setSelectedDraftIds([]);
    };

    const handleBulkSubmit = () => {
        onBulkSubmitDrafts(selectedDraftIds);
        setSelectedDraftIds([]);
    };

    const areAllSelected = relevantDrafts.length > 0 && selectedDraftIds.length === relevantDrafts.length;

    return (
        <div className="bg-[#FAF9F6] min-h-screen flex flex-col">
            <PageHeader title={`${moduleType} Drafts`}><p className="text-sm font-semibold text-gray-500 mt-1">Project: {project.name}</p></PageHeader>
            <div className={`flex-grow p-4 space-y-3 ${selectedDraftIds.length > 0 ? 'pb-28' : ''}`}>
                {relevantDrafts.length > 0 && (
                     <div className="flex items-center space-x-3 p-2 bg-gray-100 rounded-lg border">
                        <input 
                            type="checkbox"
                            id="select-all"
                            checked={areAllSelected}
                            onChange={handleSelectAll}
                            className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            aria-label="Select all drafts"
                        />
                        <label htmlFor="select-all" className="text-sm font-medium text-gray-700">Select All</label>
                    </div>
                )}
                {relevantDrafts.length > 0 ? (relevantDrafts.map(draft => {
                    const isSelected = selectedDraftIds.includes(draft.id!);
                    return (
                        <div key={draft.id} className={`w-full bg-white p-4 rounded-xl shadow-md text-left flex items-center transition-colors ${isSelected ? 'bg-blue-50 ring-2 ring-blue-500' : ''}`}>
                            <input
                                 type="checkbox"
                                 checked={isSelected}
                                 onChange={() => handleSelectOne(draft.id!)}
                                 className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 mr-4 flex-shrink-0"
                                 aria-label={`Select draft ${draft.data.observationId || draft.id}`}
                            />
                            <div className="flex-grow flex justify-between items-center">
                                <div>
                                    <p className="font-bold text-gray-800">{draft.data.observationId || draft.data.trainingId || 'Draft'}</p>
                                    <p className="text-sm text-gray-500">Saved: {new Date(draft.saved_at).toLocaleString()}</p>
                                </div>
                                <div className="flex space-x-2">
                                    <button onClick={() => onNavigate(Page.Form, { draftToEdit: draft, currentFormType: moduleType })} className="bg-blue-500 text-white px-3 py-1 rounded-lg text-sm font-semibold">Edit</button>
                                    <button onClick={() => onDeleteDraft(draft.id!)} className="bg-red-500 text-white px-3 py-1 rounded-lg text-sm font-semibold">Delete</button>
                                </div>
                            </div>
                        </div>
                    );
                })) : (<div className="text-center py-10"><p className="text-gray-500">No drafts found for this module.</p></div>)}
            </div>
             {selectedDraftIds.length > 0 && (
                <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white p-4 border-t-2 border-[#1FA97C] shadow-[0_-4px_10px_rgba(0,0,0,0.1)] z-20">
                    <p className="text-center text-sm font-semibold text-gray-700 mb-3">{selectedDraftIds.length} draft(s) selected</p>
                    <div className="flex space-x-3">
                        <button onClick={handleBulkDelete} className="w-full bg-red-600 text-white py-2 rounded-lg font-semibold hover:bg-red-700 transition">Delete Selected</button>
                        <button onClick={handleBulkSubmit} className="w-full bg-green-600 text-white py-2 rounded-lg font-semibold hover:bg-green-700 transition">Submit Selected</button>
                    </div>
                </div>
            )}
        </div>
    );
};

const ModuleSelectionScreen: React.FC<{ onNavigate: (page: Page, data?: any) => void; }> = ({ onNavigate }) => (
    <div className="bg-[#FAF9F6] min-h-screen">
        <PageHeader title="Select Module to Review" />
        <div className="p-4 space-y-3">
            {SAFETY_MODULES.map(module => (<button key={module.title} onClick={() => FORM_CONFIGS[module.title]?.length > 0 && onNavigate(Page.IssueList, { formType: module.title })} className="w-full bg-white text-gray-800 p-4 rounded-xl shadow-md text-left disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition" disabled={FORM_CONFIGS[module.title]?.length === 0}><h3 className="font-semibold text-md">{module.title}</h3>{FORM_CONFIGS[module.title]?.length === 0 && <p className="text-xs text-gray-400">Not yet configured</p>}</button>))}
        </div>
    </div>
);

const IssueListScreen: React.FC<{ 
    moduleType: FormType | null; 
    project: Project; 
    issues: FormRecord[]; 
    onNavigate: (page: Page, data?: any) => void; 
    currentUser: User; 
    onExport: (records: FormRecord[], filename: string) => void; 
    onDelete: (issueId: string, issueIdentifier: string) => void;
}> = ({ moduleType, project, issues, onNavigate, currentUser, onExport, onDelete }) => {
    const [severityFilter, setSeverityFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    const isMyReportsView = currentUser.role === 'Workers';

    const relevantIssues = useMemo(() => issues.filter(issue => {
        if (issue.project_id !== project.id) return false;
        if (isMyReportsView) return (typeof issue.submitted_by_id === 'string' ? issue.submitted_by_id : issue.submitted_by_id.id) === currentUser.id;
        if (moduleType) return issue.form_type === moduleType;
        return true;
    }), [issues, project.id, moduleType, currentUser.id, isMyReportsView]);

    const filteredIssues = useMemo(() => {
        return relevantIssues.filter(issue => {
            const severityMatch = !severityFilter || issue.data.severityLevel === severityFilter;
            const statusMatch = !statusFilter || issue.status === statusFilter;
            return severityMatch && statusMatch;
        });
    }, [relevantIssues, severityFilter, statusFilter]);

    const getSeverityClasses = (severity: string) => ({ 'Critical': 'text-red-500', 'Medium': 'text-yellow-500' }[severity] || 'text-gray-500');
    const getStatusClasses = (status: string) => ({ 'Open': 'bg-red-100 text-red-700', 'In Progress': 'bg-yellow-100 text-yellow-700', 'Closed': 'bg-green-100 text-green-700' }[status] || 'bg-gray-100 text-gray-700');
    
    const title = isMyReportsView ? "My Submitted Reports" : `${moduleType || 'All'} Reports`;
    const commonSelectClasses = "w-full p-2 bg-gray-100 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#1FA97C]";
    const canDelete = currentUser.role === 'Site Safety Officer' || currentUser.role === 'HO middle Managers' || currentUser.role === 'Top Managers';

    return (
        <div className="bg-[#FAF9F6] min-h-screen">
            <PageHeader title={title}><p className="text-sm font-semibold text-gray-500 mt-1">Project: {project.name}</p></PageHeader>
            <div className="p-4 space-y-3">
                <div className="bg-white p-3 rounded-xl shadow-md grid grid-cols-2 gap-3">
                    <select value={severityFilter} onChange={e => setSeverityFilter(e.target.value)} className={commonSelectClasses}><option value="">All Severities</option><option>Safe</option><option>Medium</option><option>Critical</option></select>
                    <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={commonSelectClasses}><option value="">All Statuses</option><option>Open</option><option>In Progress</option><option>Closed</option></select>
                </div>
                <button onClick={() => onExport(filteredIssues, `${project.name.replace(/\s/g, '_')}_${moduleType?.replace(/\s/g, '_') || 'MyReports'}_Export`)} className="w-full bg-blue-500 text-white py-2 rounded-lg font-semibold text-sm">Export Filtered to CSV</button>

                {filteredIssues.length > 0 ? (filteredIssues.map(issue => {
                    const submitterName = typeof issue.submitted_by_id === 'object' && issue.submitted_by_id?.full_name ? issue.submitted_by_id.full_name : 'Unknown';
                    const issueIdentifier = issue.data.observationId || issue.data.trainingId || issue.data.caseId || issue.id.substring(0,8);
                    
                    return (
                         <div key={issue.id} className="w-full bg-white p-4 rounded-xl shadow-md text-left transition group">
                            <div onClick={() => onNavigate(Page.IssueDetail, { issue })} className="cursor-pointer">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-bold text-gray-800 group-hover:text-[#1FA97C]">{issueIdentifier}</p>
                                        <p className="text-sm text-gray-500">Submitted: {new Date(issue.submitted_at).toLocaleDateString()}</p>
                                        {!isMyReportsView && <p className="text-xs text-blue-500 mt-1">{issue.form_type}</p>}
                                        {!isMyReportsView && <p className="text-xs text-gray-500 mt-1">By: {submitterName}</p>}
                                    </div>
                                    <div className="text-right flex-shrink-0 ml-2">
                                        <span className={`text-sm font-bold ${getSeverityClasses(issue.data.severityLevel)}`}>{issue.data.severityLevel}</span>
                                        <span className={`text-xs font-semibold px-2 py-1 rounded-full mt-1 inline-block ${getStatusClasses(issue.status)}`}>{issue.status}</span>
                                    </div>
                                </div>
                            </div>
                            {canDelete && (
                                <div className="mt-3 pt-3 border-t border-gray-100 flex justify-end">
                                    <button 
                                        onClick={() => onDelete(issue.id, issueIdentifier)}
                                        className="bg-red-100 text-red-700 px-3 py-1 rounded-lg text-xs font-semibold hover:bg-red-200 transition"
                                    >
                                        Delete
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })) : (<div className="text-center py-10"><p className="text-gray-500">No issues match the current filters.</p></div>)}
            </div>
        </div>
    );
};

const IssueDetailScreen: React.FC<{ 
    issue: FormRecord; 
    onStatusUpdate: (issueId: string, newStatus: FormRecord['status'], notes: string) => void; 
    currentUser: User | null; 
    showModal: (title: string, message: string, type: 'info' | 'success' | 'error', onClose?: (() => void) | null) => void;
}> = ({ issue, onStatusUpdate, currentUser, showModal }) => {
    const formConfig = FORM_CONFIGS[issue.form_type] || [];
    const [newStatus, setNewStatus] = useState<FormRecord['status']>(issue.status);
    const [notes, setNotes] = useState('');

    const handleUpdate = () => {
        if (!notes) { 
            showModal("Notes Required", "Please add notes for the status update.", 'error'); 
            return; 
        }
        onStatusUpdate(issue.id, newStatus, notes);
        setNotes('');
    };

    const canUpdateStatus = currentUser?.role === 'Site Safety Officer' || currentUser?.role === 'HO middle Managers' || currentUser?.role === 'Top Managers';
    
    const submitterName = typeof issue.submitted_by_id === 'object' && issue.submitted_by_id?.full_name ? issue.submitted_by_id.full_name : 'Unknown User';

    const getStatusTextClasses = (status: string) => ({ 'Open': 'text-red-600', 'In Progress': 'text-yellow-600', 'Closed': 'text-green-600' }[status] || 'text-gray-600');
    const getStatusSelectClasses = (status: string) => ({ 'Open': 'bg-red-100 text-red-700 border-red-200', 'In Progress': 'bg-yellow-100 text-yellow-700 border-yellow-200', 'Closed': 'bg-green-100 text-green-700 border-green-200' }[status] || 'bg-gray-100');

    const renderValue = (field: FormField) => {
        const value = issue.data[field.name];
        if (field.type === 'photo') return value ? <a href={value} target="_blank" rel="noopener noreferrer"><img src={value} alt={field.label} className="rounded-lg max-h-48 mt-1" /></a> : <p className="text-gray-500 text-sm">No photo uploaded.</p>;
        if ((field.name.toLowerCase().includes('date') || field.name.toLowerCase().includes('at')) && typeof value === 'string' && value) return new Date(value).toLocaleString();
        return value || 'N/A';
    };
    return (
        <div className="bg-[#FAF9F6] min-h-screen">
            <PageHeader title="Report Details" />
            <div className="p-6 space-y-6">
                 <div className="bg-white p-6 rounded-2xl shadow-lg space-y-4">
                    <h2 className="text-xl font-bold text-gray-800 border-b pb-2">{issue.form_type}</h2>
                    <div className="space-y-1">
                        <label className="text-sm font-bold text-gray-600">Submitted By</label>
                        <div className="text-gray-800 break-words">{submitterName}</div>
                    </div>
                    {formConfig.map(field => (
                        <div key={field.name} className="space-y-1">
                            <label className="text-sm font-bold text-gray-600">{field.label}</label>
                            <div className="text-gray-800 break-words">{renderValue(field)}</div>
                        </div>
                    ))}
                 </div>
                 <div className="bg-white p-6 rounded-2xl shadow-lg space-y-4">
                    <h3 className="text-lg font-bold text-gray-800">Status & History</h3>
                    <div className="space-y-3">
                        {issue.updates.map((update, index) => (
                            <div key={index} className="border-l-2 pl-3 border-gray-200">
                                <p className={`font-semibold ${getStatusTextClasses(update.status)}`}>{update.status}</p>
                                <p className="text-sm text-gray-800">{update.notes}</p>
                                <p className="text-xs text-gray-500 mt-1">by {update.updatedBy} on {new Date(update.timestamp).toLocaleString()}</p>
                            </div>
                        ))}
                        {issue.updates.length === 0 && <p className="text-sm text-gray-500">No updates yet.</p>}
                    </div>
                    {canUpdateStatus && (
                        <div className="pt-4 border-t space-y-3">
                            <h4 className="font-semibold text-gray-800">Update Status</h4>
                            <select value={newStatus} onChange={e => setNewStatus(e.target.value as FormRecord['status'])} className={`w-full p-2 rounded-lg text-sm font-semibold border ${getStatusSelectClasses(newStatus)} focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#1FA97C] transition-colors`}>
                                <option value="Open">Open</option>
                                <option value="In Progress">In Progress</option>
                                <option value="Closed">Closed</option>
                            </select>
                            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add notes about the action taken..." className="w-full p-2 bg-gray-100 rounded-lg text-sm min-h-[80px] border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1FA97C]"></textarea>
                            <button onClick={handleUpdate} className="w-full bg-[#1FA97C] text-white py-2 rounded-lg font-semibold hover:bg-green-700 transition">Add Update</button>
                        </div>
                    )}
                 </div>
            </div>
        </div>
    );
};

const ReportsDashboardScreen: React.FC<{ project: Project, allIssues: FormRecord[], onExport: (records: FormRecord[], filename: string) => void; onNavigate: (page: Page, data?: any) => void; }> = ({ project, allIssues, onExport, onNavigate }) => {
    const today = new Date();
    const thirtyDaysAgo = new Date(new Date().setDate(today.getDate() - 30));
    
    const [startDate, setStartDate] = useState(thirtyDaysAgo.toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]);
    const [selectedModules, setSelectedModules] = useState<FormType[]>([]);
    const [isFilterVisible, setIsFilterVisible] = useState(true);
    const commonInputClasses = "w-full p-2 bg-gray-100 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1FA97C]";
    const dateInputClasses = commonInputClasses + " text-black";
    const dateLabelClasses = "text-xs font-semibold text-gray-800 block mb-1";

    const projectIssues = useMemo(() => allIssues.filter(issue => issue.project_id === project.id), [allIssues, project.id]);

    const filteredIssues = useMemo(() => {
        return projectIssues.filter(issue => {
            const issueDate = new Date(issue.submitted_at);
            const start = new Date(startDate);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            const dateMatch = issueDate >= start && issueDate <= end;
            const moduleMatch = selectedModules.length === 0 || selectedModules.includes(issue.form_type);
            return dateMatch && moduleMatch;
        });
    }, [projectIssues, startDate, endDate, selectedModules]);

    const toggleModule = (module: FormType) => {
        setSelectedModules(prev => prev.includes(module) ? prev.filter(m => m !== module) : [...prev, module]);
    };

    const summaryStats = useMemo(() => ({
        total: filteredIssues.length,
        open: filteredIssues.filter(i => i.status === 'Open').length,
        inProgress: filteredIssues.filter(i => i.status === 'In Progress').length,
        closed: filteredIssues.filter(i => i.status === 'Closed').length,
        critical: filteredIssues.filter(i => i.data.severityLevel === 'Critical').length,
        medium: filteredIssues.filter(i => i.data.severityLevel === 'Medium').length,
        safe: filteredIssues.filter(i => i.data.severityLevel === 'Safe').length,
    }), [filteredIssues]);
    
    const barChartData = useMemo(() => {
        const counts = filteredIssues.reduce((acc, form) => {
            acc[form.form_type] = (acc[form.form_type] || 0) + 1;
            return acc;
        }, {} as Record<FormType, number>);
        
        return Object.entries(counts).map(([label, value]) => ({ label, value })).sort((a,b) => b.value - a.value);
    }, [filteredIssues]);

    const pieChartData = useMemo(() => {
        const counts = filteredIssues.reduce((acc, form) => {
            const severity = form.data.severityLevel || 'Safe';
            acc[severity] = (acc[severity] || 0) + 1;
            return acc;
        }, {} as Record<'Safe' | 'Medium' | 'Critical', number>);

        return [
            { label: 'Critical', value: counts.Critical || 0, color: '#EF5350' },
            { label: 'Medium', value: counts.Medium || 0, color: '#F9A825' },
            { label: 'Safe', value: counts.Safe || 0, color: '#1FA97C' },
        ].filter(d => d.value > 0);
    }, [filteredIssues]);

    return (
        <div className="bg-[#FAF9F6] min-h-screen">
            <PageHeader title="Reports Dashboard"><p className="text-sm font-semibold text-gray-500 mt-1">Project: {project.name}</p></PageHeader>
            <div className="p-4 space-y-4">
                <div className="bg-white p-4 rounded-xl shadow-md">
                     <button onClick={() => setIsFilterVisible(!isFilterVisible)} className="w-full flex justify-between items-center">
                        <h3 className="font-bold text-gray-800">Filters</h3>
                        <svg className={`w-5 h-5 text-gray-500 transition-transform ${isFilterVisible ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                     </button>
                    {isFilterVisible && (
                        <div className="mt-3 space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className={dateLabelClasses}>Start Date</label>
                                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={dateInputClasses} />
                                </div>
                                <div>
                                    <label className={dateLabelClasses}>End Date</label>
                                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={dateInputClasses} />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-gray-600 block mb-1">Module Types (select to filter)</label>
                                <div className="flex flex-wrap gap-2 mt-1">
                                    {SAFETY_MODULES.filter(m => m.title !== FormType.Reports).map(m => (
                                        <button key={m.title} onClick={() => toggleModule(m.title)} className={`px-2 py-1 text-xs rounded-full border ${selectedModules.includes(m.title) ? 'bg-[#2E2E2E] text-white border-[#2E2E2E]' : 'bg-white text-gray-600'}`}>
                                            {m.title}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white p-3 rounded-xl shadow text-center"><p className="text-2xl font-bold text-gray-800">{summaryStats.total}</p><p className="text-xs text-gray-500">Total Reports</p></div>
                    <div className="bg-white p-3 rounded-xl shadow text-center"><p className="text-2xl font-bold text-red-600">{summaryStats.open}</p><p className="text-xs text-gray-500">Open Issues</p></div>
                    <div className="bg-white p-3 rounded-xl shadow text-center"><p className="text-2xl font-bold text-yellow-600">{summaryStats.inProgress}</p><p className="text-xs text-gray-500">In Progress</p></div>
                     <div className="bg-white p-3 rounded-xl shadow text-center"><p className="text-2xl font-bold text-green-600">{summaryStats.closed}</p><p className="text-xs text-gray-500">Closed</p></div>
                </div>
                
                <DashboardCard title="Issues by Severity"><PieChart data={pieChartData} /></DashboardCard>
                <DashboardCard title="Reports by Module"><ReportsBarChart data={barChartData} /></DashboardCard>

                <div>
                    <button onClick={() => onExport(filteredIssues, `${project.name.replace(/\s/g, '_')}_Report`)} className="w-full bg-blue-500 text-white py-2 rounded-lg font-semibold text-sm mb-3">Export / Share Filtered Data</button>
                    {filteredIssues.map(issue => (
                        <button key={issue.id} onClick={() => onNavigate(Page.IssueDetail, { issue })} className="w-full bg-white p-3 mb-2 rounded-xl shadow-md text-left flex justify-between items-center hover:bg-gray-50 transition">
                             <div><p className="font-bold text-gray-800 text-sm">{issue.data.observationId || issue.id.substring(0,8)}</p><p className="text-xs text-blue-500 mt-1">{issue.form_type}</p></div>
                             <p className="text-xs text-gray-500">{new Date(issue.submitted_at).toLocaleDateString()}</p>
                        </button>
                    ))}
                    {filteredIssues.length === 0 && <p className="text-center text-gray-500 py-6">No reports match the current filters.</p>}
                </div>
            </div>
        </div>
    );
};

const TrainingMaterialsScreen: React.FC<{
    project: Project;
    materials: TrainingMaterial[];
    onAdd: (title: string, description: string, file: File) => void;
    onDelete: (material: TrainingMaterial) => void;
}> = ({ project, materials, onAdd, onDelete }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [file, setFile] = useState<File | null>(null);

    const projectMaterials = useMemo(() => materials.filter(m => m.project_id === project.id), [materials, project.id]);
    
    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (title && file) {
            onAdd(title, description, file);
            // Reset state after submission.
            // The native e.currentTarget.reset() was removed as it can cause
            // conflicts with React's controlled component state management.
            setTitle('');
            setDescription('');
            setFile(null);
        }
    };

    const getFileIcon = (fileType: TrainingMaterial['file_type']) => {
        switch (fileType) {
            case 'pdf': return <DocumentIcon className="w-8 h-8 text-red-500 flex-shrink-0" />;
            case 'video': return <VideoIcon className="w-8 h-8 text-blue-500 flex-shrink-0" />;
            case 'image': return <ImageIcon className="w-8 h-8 text-green-500 flex-shrink-0" />;
            default: return <DocumentIcon className="w-8 h-8 text-gray-500 flex-shrink-0" />;
        }
    };
    
    const commonInputClasses = "w-full p-3 bg-gray-100 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1FA97C] transition text-gray-900 placeholder-gray-500";

    return (
        <div className="bg-[#FAF9F6] min-h-screen">
            <PageHeader title="Training Materials"><p className="text-sm font-semibold text-gray-500 mt-1">Project: {project.name}</p></PageHeader>
            <div className="p-4 space-y-4">
                <DashboardCard title="Upload New Material">
                    <form onSubmit={handleSubmit} className="space-y-3">
                        <input type="text" placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} className={commonInputClasses} required />
                        <textarea placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} className={`${commonInputClasses} min-h-[60px]`} />
                        <input type="file" onChange={e => setFile(e.target.files?.[0] || null)} className={`${commonInputClasses} p-2 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100`} required />
                        <button type="submit" className="w-full bg-[#1FA97C] text-white py-2 rounded-lg font-semibold hover:bg-green-700 transition">Upload</button>
                    </form>
                </DashboardCard>

                <DashboardCard title="Existing Materials">
                    {projectMaterials.length > 0 ? (
                        <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                            {projectMaterials.map(material => (
                                <div key={material.id} className="flex items-center space-x-3 p-2 bg-gray-50 rounded-lg">
                                    {getFileIcon(material.file_type)}
                                    <div className="flex-grow">
                                        <p className="font-semibold text-sm text-gray-800">{material.title}</p>
                                        <div className="flex space-x-4">
                                            <p className="text-xs text-gray-500">{new Date(material.created_at).toLocaleDateString()}</p>
                                            <p className="text-xs text-blue-500 font-semibold">Views: {material.view_count || 0}</p>
                                        </div>
                                    </div>
                                    <button onClick={() => onDelete(material)} className="bg-red-100 text-red-700 px-3 py-1 rounded-lg text-xs font-semibold hover:bg-red-200 transition">Delete</button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500 text-center py-4">No training materials uploaded yet.</p>
                    )}
                </DashboardCard>
            </div>
        </div>
    );
};

const CreateSafetyDrillScreen: React.FC<{ onAddDrill: (title: string, description: string, dueDate: string, steps: string[]) => void; project: Project; }> = ({ onAddDrill, project }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [steps, setSteps] = useState<string[]>(['']);

    const handleStepChange = (index: number, value: string) => {
        const newSteps = [...steps];
        newSteps[index] = value;
        setSteps(newSteps);
    };

    const handleAddStep = () => {
        setSteps([...steps, '']);
    };

    const handleRemoveStep = (index: number) => {
        if (steps.length > 1) {
            setSteps(steps.filter((_, i) => i !== index));
        }
    };
    
    const commonInputClasses = "w-full p-3 bg-gray-100 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1FA97C] transition text-gray-900 placeholder-gray-500";
    
    const handleSubmit = () => {
        if (!title || !description || steps.some(s => s.trim() === '')) {
            alert("Title, Description, and all Steps are required.");
            return;
        }
        onAddDrill(title, description, dueDate, steps);
    };

    return (
        <div className="bg-[#FAF9F6] min-h-screen">
            <PageHeader title="Create Safety Drill" />
            <div className="p-6 space-y-4">
                <div className="bg-white p-6 rounded-2xl shadow-lg space-y-4">
                    <div className="p-3 bg-gray-200 rounded-lg text-gray-600 text-center font-semibold">Project: {project.name}</div>
                    <div><label className="text-sm font-medium text-gray-600">Drill Title</label><input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g., Fire Evacuation Drill" className={commonInputClasses}/></div>
                    <div><label className="text-sm font-medium text-gray-600">Description</label><textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe the drill procedures" className={`${commonInputClasses} min-h-[100px]`}></textarea></div>
                    <div><label className="text-sm font-medium text-gray-600">Due Date (Optional)</label><input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={commonInputClasses}/></div>
                    
                    <div>
                        <label className="text-sm font-medium text-gray-600">Drill Steps</label>
                        <div className="space-y-2 mt-1">
                            {steps.map((step, index) => (
                                <div key={index} className="flex items-center space-x-2">
                                    <input 
                                        type="text"
                                        value={step}
                                        onChange={e => handleStepChange(index, e.target.value)}
                                        placeholder={`Step ${index + 1}`}
                                        className={commonInputClasses}
                                    />
                                    <button 
                                        onClick={() => handleRemoveStep(index)} 
                                        className="bg-red-100 text-red-600 p-2 rounded-full hover:bg-red-200 disabled:opacity-50"
                                        disabled={steps.length <= 1}
                                        aria-label="Remove step"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </div>
                            ))}
                        </div>
                         <button onClick={handleAddStep} className="mt-2 text-sm font-semibold text-[#1FA97C] hover:underline">+ Add another step</button>
                    </div>

                    <button onClick={handleSubmit} className="w-full mt-6 bg-[#2E2E2E] text-white py-3 rounded-lg font-semibold hover:bg-gray-700 transition shadow-md">Create Drill</button>
                </div>
            </div>
        </div>
    );
};

const SafetyDrillsManagementScreen: React.FC<{
    project: Project;
    drills: SafetyDrill[];
    onNavigate: (page: Page, data?: any) => void;
    onDelete: (drillId: string) => void;
}> = ({ project, drills, onNavigate, onDelete }) => {
    return (
        <div className="bg-[#FAF9F6] min-h-screen">
            <PageHeader title="Manage Safety Drills"><p className="text-sm font-semibold text-gray-500 mt-1">Project: {project.name}</p></PageHeader>
            <div className="p-4 space-y-4">
                <button onClick={() => onNavigate(Page.CreateSafetyDrill)} className="w-full bg-[#1FA97C] text-white p-4 rounded-xl shadow-lg flex items-center justify-center space-x-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110 2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                    <span>Create New Drill</span>
                </button>
                <DashboardCard title="Existing Drills">
                    {drills.length > 0 ? (
                        <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                            {drills.map(drill => (
                                <div key={drill.id} className="flex items-center space-x-3 p-2 bg-gray-50 rounded-lg">
                                    <div className="flex-grow">
                                        <p className="font-semibold text-sm text-gray-800">{drill.title}</p>
                                        <p className="text-xs text-gray-500">{drill.description}</p>
                                        {drill.due_date && <p className="text-xs text-red-500 mt-1">Due: {new Date(drill.due_date).toLocaleDateString()}</p>}
                                    </div>
                                    <button onClick={() => onDelete(drill.id)} className="bg-red-100 text-red-700 px-3 py-1 rounded-lg text-xs font-semibold hover:bg-red-200 transition">Delete</button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500 text-center py-4">No safety drills created for this project yet.</p>
                    )}
                </DashboardCard>
            </div>
        </div>
    );
};

const SafetyDrillDetailScreen: React.FC<{
    drill: SafetyDrill;
    workerDrill: WorkerDrill | undefined;
    onUpdateDrillProgress: (drill: SafetyDrill, stepIndex: number) => void;
}> = ({ drill, workerDrill, onUpdateDrillProgress }) => {
    const completedSteps = workerDrill?.completed_steps || [];
    const totalSteps = drill.steps.length;
    const isCompleted = totalSteps > 0 && completedSteps.length === totalSteps;
    const progress = totalSteps > 0 ? (completedSteps.length / totalSteps) * 100 : 0;

    return (
        <div className="bg-[#FAF9F6] min-h-screen">
            <PageHeader title="Safety Drill Details" />
            <div className="p-6">
                <div className={`bg-white p-6 rounded-2xl shadow-lg space-y-4 border-t-4 ${isCompleted ? 'border-green-500' : 'border-blue-500'}`}>
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <h2 className="text-xl font-bold text-gray-800">{drill.title}</h2>
                            {drill.due_date && <p className="text-sm text-red-500 mt-1">Due: {new Date(drill.due_date).toLocaleDateString()}</p>}
                        </div>
                         <div className="flex-shrink-0">
                            {isCompleted ? (
                                <span className="text-sm font-semibold px-3 py-1 rounded-full flex items-center space-x-1 bg-green-100 text-green-700">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                                    <span>Completed</span>
                                </span>
                            ) : (
                                <span className="text-sm font-semibold px-3 py-1 rounded-full bg-yellow-100 text-yellow-700">
                                    {completedSteps.length}/{totalSteps} steps
                                </span>
                            )}
                        </div>
                    </div>
                    
                    {!isCompleted && totalSteps > 0 && (
                        <div className="my-2">
                            <div className="w-full bg-gray-200 rounded-full h-2.5">
                                <div className="bg-blue-500 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
                            </div>
                        </div>
                    )}
                    
                    <p className="text-gray-600 text-sm">{drill.description}</p>
                    
                    <div className="pt-4 border-t border-gray-100">
                         <h3 className="text-md font-semibold text-gray-700 mb-3">Steps to Complete:</h3>
                         <div className="space-y-3">
                            {drill.steps.map((step, index) => (
                                <label key={index} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition">
                                    <input 
                                        type="checkbox" 
                                        checked={completedSteps.includes(index)} 
                                        onChange={() => onUpdateDrillProgress(drill, index)}
                                        className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span className={`text-md ${completedSteps.includes(index) ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{step}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default App;