import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Page, User, Project, FormType, FormField, UserRole, FormRecord, StatusUpdate } from './types';
import { ShieldIcon, SAFETY_MODULES, FORM_CONFIGS } from './constants';

// Dexie will be available globally from the script tag in index.html
declare const Dexie: any;

// Initialize the local 'outbox' database
const localDb = new Dexie("meil_safety_offline");
localDb.version(1).stores({
  upload_queue: '++id, data, file',
});

// --- HELPER: MOCK DATA GENERATION ---
const generateMockData = (projects: Project[], users: User[]): FormRecord[] => {
    const mockRecords: FormRecord[] = [];
    const formTypes = Object.values(FormType).filter(ft => FORM_CONFIGS[ft]?.length > 0);
    const statuses: FormRecord['status'][] = ['Open', 'In Progress', 'Closed'];

    for (let i = 0; i < 50; i++) {
        const randomFormType = formTypes[Math.floor(Math.random() * formTypes.length)];
        const randomProject = projects[Math.floor(Math.random() * projects.length)];
        const randomUser = users[0]; // Assume Rajbir submitted all for simplicity
        const randomDate = new Date(Date.now() - Math.floor(Math.random() * 90) * 24 * 60 * 60 * 1000); // last 90 days
        const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];

        const recordData: Record<string, any> = {
            [`${randomFormType.substring(0,3).toLowerCase()}Id`]: `${randomFormType.substring(0,3).toUpperCase()}${Date.now() + i}`,
            createdBy: randomUser.fullName,
            project: randomProject.name,
            date: randomDate.toISOString().slice(0, 16),
            severityLevel: ['Safe', 'Medium', 'Critical'][Math.floor(Math.random() * 3)],
            description: `This is a mock description for record #${i+1}.`,
        };

        mockRecords.push({
            id: recordData[`${randomFormType.substring(0,3).toLowerCase()}Id`],
            formType: randomFormType,
            projectId: randomProject.id,
            submittedById: randomUser.id,
            data: recordData,
            submittedAt: randomDate.toISOString(),
            status: randomStatus,
            updates: [],
        });
    }
    return mockRecords;
};


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

const ReportsBarChart: React.FC<{ data: { label: string; value: number }[] }> = ({ data }) => {
    const maxValue = Math.max(...data.map(d => d.value), 1);
    const colors = ['#1FA97C', '#F9A825', '#EF5350', '#42A5F5', '#AB47BC', '#FF7043'];

    if (data.length === 0) {
        return <div className="text-center text-gray-500 py-10">No report data available.</div>;
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

const TrendLineChart: React.FC<{ data: { date: Date; count: number }[] }> = ({ data }) => {
     if (data.length < 2) {
        return <div className="text-center text-gray-500 py-10">Not enough data for a trend.</div>;
    }

    const sortedData = data.sort((a, b) => a.date.getTime() - b.date.getTime());
    const maxCount = Math.max(...sortedData.map(d => d.count), 1);
    const minDate = sortedData[0].date.getTime();
    const maxDate = sortedData[sortedData.length - 1].date.getTime();

    const points = sortedData.map(d => {
        const x = ((d.date.getTime() - minDate) / (maxDate - minDate)) * 360 + 20;
        const y = 180 - (d.count / maxCount) * 160;
        return `${x},${y}`;
    }).join(' ');

    return (
         <div className="w-full h-56 bg-gray-50 p-4 rounded-lg">
            <svg width="100%" height="100%" viewBox="0 0 400 200">
                <polyline
                    fill="none"
                    stroke="#1FA97C"
                    strokeWidth="2"
                    points={points}
                />
                {sortedData.map((d, i) => {
                    const x = ((d.date.getTime() - minDate) / (maxDate - minDate)) * 360 + 20;
                    const y = 180 - (d.count / maxCount) * 160;
                    return <circle key={i} cx={x} cy={y} r="3" fill="#1FA97C" />;
                })}
                 <line x1="20" y1="180" x2="380" y2="180" stroke="#ccc" strokeWidth="1" />
                 <text x="20" y="195" fontSize="10" fill="#666">{sortedData[0].date.toLocaleDateString('en-US', {month: 'short'})}</text>
                 <text x="380" y="195" textAnchor="end" fontSize="10" fill="#666">{sortedData[sortedData.length-1].date.toLocaleDateString('en-US', {month: 'short'})}</text>
            </svg>
        </div>
    );
};

// --- MAIN APP ---
const App: React.FC = () => {
    const [page, setPage] = useState<Page>(Page.Splash);
    const [history, setHistory] = useState<Page[]>([]);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [currentFormType, setCurrentFormType] = useState<FormType | null>(null);
    const [projectToEdit, setProjectToEdit] = useState<Project | null>(null);
    const [submittedForms, setSubmittedForms] = useState<FormRecord[]>([]);
    const [currentModule, setCurrentModule] = useState<FormType | null>(null);
    const [selectedIssue, setSelectedIssue] = useState<FormRecord | null>(null);
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    useEffect(() => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/service-worker.js')
                .then(registration => console.log('Service Worker registered with scope:', registration.scope))
                .catch(error => console.error('Service Worker registration failed:', error));
        }

        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const initialUsers: User[] = [
        { id: `user-Rajbir`, fullName: 'Rajbir Majhi', employeeId: '2401289262', emergencyContact: '1234567890', role: 'Site Safety Officer' }
    ];

    const initialProjects: Project[] = [
        { id: '1', name: 'Zudio Mall', projectId: 'PROJS1761418115883784', status: 'Ongoing', severity: 'Critical', location: 'Nandan Vihar, Patia, Bhubaneswar', department: 'Construction', createdBy: 'Rajbir Majhi', createdAt: new Date().toISOString() },
        { id: '2', name: 'Metro Line 3', projectId: 'PROJS1761418115883785', status: 'Ongoing', severity: 'Medium', location: 'Mumbai, Maharashtra', department: 'Civil Works', createdBy: 'Rajbir Majhi', createdAt: new Date().toISOString() },
        { id: '3', name: 'Highway Expansion', projectId: 'PROJS1761418115883786', status: 'Completed', severity: 'Safe', location: 'NH-44, Delhi-Agra', department: 'Infrastructure', createdBy: 'Rajbir Majhi', createdAt: new Date().toISOString() },
    ];

    useEffect(() => {
        setProjects(initialProjects);
        setSubmittedForms(generateMockData(initialProjects, initialUsers));
    }, []);

    const goBack = useCallback(() => {
        if (history.length > 0) {
            const lastPage = history[history.length - 1];
            setHistory(prev => prev.slice(0, -1));
            setPage(lastPage);
        } else {
             setPage(currentUser ? Page.ProjectHub : Page.Auth);
        }
    }, [history, currentUser]);

    const navigateTo = (newPage: Page, data?: any) => {
        setHistory(prev => [...prev, page]);
        
        if (data?.project) setSelectedProject(data.project);
        if (data?.formType !== undefined) setCurrentModule(data.formType);
        if (data?.issue) setSelectedIssue(data.issue);
        if (data?.projectToEdit) setProjectToEdit(data.projectToEdit);
        if (data?.currentFormType) setCurrentFormType(data.currentFormType);

        if (newPage === Page.SafetyOfficerDashboard && data?.project) { 
            if (!currentUser) {
                setPage(Page.Auth);
                return;
            }
            switch (currentUser.role) {
                case 'Site Safety Officer': setPage(Page.SafetyOfficerDashboard); break;
                case 'HO middle Managers': setPage(Page.HOManagerDashboard); break;
                case 'Top Managers': setPage(Page.TopManagerDashboard); break;
                case 'Workers': setPage(Page.WorkerDashboard); break;
                default: setPage(Page.SafetyOfficerDashboard);
            }
            return; 
        }

        setPage(newPage);
    };

    const handleLogin = (user: User) => {
        setCurrentUser(user);
        setHistory([]);
        navigateTo(Page.ProjectHub);
    };

    const handleLogout = () => {
        setCurrentUser(null);
        setSelectedProject(null);
        setHistory([]);
        setPage(Page.Auth);
    };

    const handleUpdateUser = (updatedData: Partial<User>) => {
        if (currentUser) {
            setCurrentUser(prev => ({ ...prev!, ...updatedData }));
            alert('Profile updated successfully!');
            goBack();
        }
    };
    
    const addProject = (project: Omit<Project, 'id' | 'projectId' | 'createdBy' | 'createdAt'>) => {
        const newProject: Project = {
            ...project,
            id: (projects.length + 1).toString(),
            projectId: `PRJ${Date.now()}`,
            createdBy: currentUser!.fullName,
            createdAt: new Date().toISOString(),
        };
        setProjects(prev => [newProject, ...prev]);
        setHistory([]);
        setPage(Page.ProjectHub);
    };
    
    const handleUpdateProject = (updatedProject: Project) => {
        setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
        setHistory([]);
        setPage(Page.ProjectHub);
    };

    const deleteProject = (projectId: string) => {
        setProjects(prev => prev.filter(p => p.id !== projectId));
    };

    const refreshProjects = () => {
        const shuffled = [...projects].sort(() => Math.random() - 0.5);
        setProjects(shuffled);
    };
    
    const handleAddFormRecord = async (recordData: Record<string, any>, fileData: Record<string, File | null>) => {
        if (!currentFormType || !selectedProject || !currentUser) return;

        const submissionPayload = {
            formType: currentFormType,
            projectId: selectedProject.id,
            submittedById: currentUser.id,
            submittedAt: new Date().toISOString(),
            ...recordData
        };
        
        const fileToUpload = Object.values(fileData).find(f => f instanceof File);

        if (!isOnline) {
            try {
                await localDb.upload_queue.add({
                    data: submissionPayload,
                    file: fileToUpload || null,
                });

                if (navigator.serviceWorker.ready) {
                    const registration = await navigator.serviceWorker.ready;
                    await (registration as any).sync.register('sync-reports');
                }
                
                alert("You are offline. Report saved locally and will be uploaded automatically when you're back online.");
            } catch (error) {
                console.error("Failed to save report locally:", error);
                alert("Could not save report locally. Please try again.");
                return;
            }
        } else {
            console.log("Online: Submitting directly (simulation)...", { submissionPayload, fileToUpload });
            const idField = Object.keys(recordData).find(k => k.toLowerCase().includes('id'));
            const newRecord: FormRecord = {
                id: idField ? recordData[idField] : `REC${Date.now()}`,
                formType: currentFormType,
                projectId: selectedProject.id,
                submittedById: currentUser.id,
                data: recordData,
                submittedAt: new Date().toISOString(),
                status: 'Open',
                updates: [],
            };
            setSubmittedForms(prev => [newRecord, ...prev]);
            alert("Record submitted successfully!");
        }
        
        const historyCopy = [...history];
        historyCopy.pop(); // remove form
        historyCopy.pop(); // remove module landing
        setHistory(historyCopy);
        
        switch(currentUser.role) {
            case 'Site Safety Officer': setPage(Page.SafetyOfficerDashboard); break;
            case 'Workers': setPage(Page.WorkerDashboard); break;
            default: setPage(Page.SafetyOfficerDashboard); break;
        }
    };

    const handleStatusUpdate = (issueId: string, newStatus: FormRecord['status'], notes: string) => {
        if (!currentUser) return;
        const newUpdate: StatusUpdate = {
            updatedBy: currentUser.fullName,
            timestamp: new Date().toISOString(),
            status: newStatus,
            notes: notes,
        };
        setSubmittedForms(prevForms =>
            prevForms.map(form => {
                if (form.id === issueId) {
                    const updatedForm = {
                        ...form,
                        status: newStatus,
                        updates: [...form.updates, newUpdate],
                    };
                    if (selectedIssue && selectedIssue.id === issueId) {
                        setSelectedIssue(updatedForm);
                    }
                    return updatedForm;
                }
                return form;
            })
        );
        alert("Status updated successfully!");
    };

    const exportToCsv = (records: FormRecord[], filename: string) => {
        if (records.length === 0) {
            alert("No data to export.");
            return;
        }
        const allKeys = new Set<string>();
        records.forEach(rec => {
            Object.keys(rec.data).forEach(key => allKeys.add(key));
        });
        const headers = ['id', 'formType', 'projectId', 'submittedById', 'submittedAt', 'status', ...Array.from(allKeys)];
        
        const csvRows = [
            headers.join(','),
            ...records.map(record => {
                const row = headers.map(header => {
                    let value: any;
                    if (['id', 'formType', 'projectId', 'submittedById', 'submittedAt', 'status'].includes(header)) {
                        value = (record as any)[header];
                    } else {
                        value = record.data[header];
                    }
                    const stringValue = value !== null && value !== undefined ? String(value) : '';
                    return `"${stringValue.replace(/"/g, '""')}"`;
                });
                return row.join(',');
            })
        ];

        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `${filename}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };
    
    const renderPage = () => {
        const showBackButton = ![Page.Splash, Page.Auth, Page.ProjectHub].includes(page) && 
                               !(page.toString().toLowerCase().includes('dashboard'));
        
        const pageContent = () => {
             switch (page) {
                case Page.Splash: return <SplashScreen onFinish={() => setPage(Page.Auth)} />;
                case Page.Auth: return <AuthScreen onLogin={handleLogin} onNavigate={navigateTo} />;
                case Page.ProjectHub: return <ProjectHubScreen user={currentUser!} projects={projects} onNavigate={navigateTo} onLogout={handleLogout} onDelete={deleteProject} onRefresh={refreshProjects} />;
                case Page.NewProject: return <NewProjectScreen onAddProject={addProject} currentUser={currentUser!} />;
                case Page.SafetyOfficerDashboard: return <SafetyOfficerDashboard user={currentUser!} project={selectedProject!} onNavigate={navigateTo} onLogout={handleLogout} submittedForms={submittedForms} />;
                case Page.HOManagerDashboard: return <HOManagerDashboard user={currentUser!} project={selectedProject!} onNavigate={navigateTo} onLogout={handleLogout} submittedForms={submittedForms} />;
                case Page.TopManagerDashboard: return <TopManagerDashboard user={currentUser!} project={selectedProject!} onNavigate={navigateTo} onLogout={handleLogout} submittedForms={submittedForms} />;
                case Page.WorkerDashboard: return <WorkerDashboard user={currentUser!} project={selectedProject!} onNavigate={navigateTo} onLogout={handleLogout} />;
                case Page.Form: return <FormScreen formType={currentFormType!} user={currentUser!} onAddFormRecord={handleAddFormRecord} />;
                case Page.EditProfile: return <EditProfileScreen user={currentUser!} onUpdateUser={handleUpdateUser} />;
                case Page.EditProject: return <EditProjectScreen project={projectToEdit!} onUpdateProject={handleUpdateProject} />;
                case Page.ModuleLanding: return <ModuleLandingScreen moduleType={currentModule!} project={selectedProject!} onNavigate={navigateTo} />;
                case Page.IssueList: return <IssueListScreen moduleType={currentModule} project={selectedProject!} issues={submittedForms} onNavigate={navigateTo} currentUser={currentUser!} onExport={exportToCsv} />;
                case Page.IssueDetail: return <IssueDetailScreen issue={selectedIssue!} onStatusUpdate={handleStatusUpdate} currentUser={currentUser!} />;
                case Page.ModuleSelection: return <ModuleSelectionScreen onNavigate={navigateTo} />;
                // FIX: Renamed component to match its definition 'ReportsDashboardScreen'.
                case Page.ReportsDashboard: return <ReportsDashboardScreen project={selectedProject!} allIssues={submittedForms} onExport={exportToCsv} onNavigate={navigateTo} />;
                default: return <AuthScreen onLogin={handleLogin} onNavigate={navigateTo} />;
            }
        };

        return (
            <div className="relative">
                {showBackButton && <BackButton onClick={goBack} />}
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
            <div className="max-w-md mx-auto bg-white shadow-2xl min-h-screen">
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
    useEffect(() => {
        const timer = setTimeout(() => onFinish(), 2500);
        return () => clearTimeout(timer);
    }, [onFinish]);

    return (
        <div className="flex flex-col items-center justify-center h-screen bg-[#1FA97C]">
            <div className="flex flex-col items-center justify-center bg-white p-12 rounded-3xl shadow-lg">
                <ShieldIcon className="w-24 h-24" />
                <h1 className="text-2xl font-bold text-gray-800 mt-4">MEIL Safety</h1>
            </div>
        </div>
    );
};

const AuthScreen: React.FC<{ onLogin: (user: User) => void; onNavigate: (page: Page) => void; }> = ({ onLogin }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [loginRole, setLoginRole] = useState<UserRole>('Site Safety Officer');
    const [signupForm, setSignupForm] = useState({ fullName: '', employeeId: '', emergencyContact: '', password: '', confirmPassword: '', role: 'Site Safety Officer' as UserRole });

    const handleSignupChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setSignupForm({ ...signupForm, [e.target.name]: e.target.value });
    
    const handleAuthAction = () => {
        if (isLogin) {
            onLogin({ id: `user-${loginRole.replace(/\s/g, '-')}`, fullName: 'Rajbir Majhi', employeeId: '2401289262', emergencyContact: '1234567890', role: loginRole, profilePhotoUrl: 'https://i.pravatar.cc/150?u=rajbir' });
        } else {
            if (signupForm.password !== signupForm.confirmPassword) { alert("Passwords don't match!"); return; }
            onLogin({ id: signupForm.employeeId, fullName: signupForm.fullName, employeeId: signupForm.employeeId, emergencyContact: signupForm.emergencyContact, role: signupForm.role });
        }
    };

    const commonInputClasses = "w-full p-3 bg-gray-100 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1FA97C] transition text-gray-900 placeholder-gray-500";
    const roles: UserRole[] = ['Site Safety Officer', 'HO middle Managers', 'Top Managers', 'Workers'];

    return (
        <div className="p-6 md:p-8 min-h-screen flex flex-col justify-center bg-[#FAF9F6]">
            <div className="text-center mb-8">
                <ShieldIcon className="w-20 h-20 mx-auto" />
                <h1 className="text-3xl font-bold text-gray-800 mt-4">{isLogin ? 'Sign In' : 'Create Account'}</h1>
            </div>
            <div className="space-y-4">
                {isLogin ? (
                    <>
                        <div>
                            <label className="text-sm font-medium text-gray-600">Employee ID</label>
                            <input type="text" placeholder="Enter your employee ID" className={commonInputClasses} defaultValue="2401289262" />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-600">Password</label>
                            <input type="password" placeholder="Enter your password" className={commonInputClasses} defaultValue="password" />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-600">Role (for Demo)</label>
                            <select value={loginRole} onChange={(e) => setLoginRole(e.target.value as UserRole)} className={commonInputClasses}>
                                {roles.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                        </div>
                    </>
                ) : (
                    <>
                         <input name="fullName" onChange={handleSignupChange} type="text" placeholder="Full Name" className={commonInputClasses} />
                         <input name="employeeId" onChange={handleSignupChange} type="text" placeholder="Employee ID" className={commonInputClasses} />
                         <select name="role" onChange={handleSignupChange} className={commonInputClasses} defaultValue="Site Safety Officer">
                            {roles.map(r => <option key={r} value={r}>{r}</option>)}
                         </select>
                         <input name="emergencyContact" onChange={handleSignupChange} type="text" placeholder="Emergency Contact" className={commonInputClasses} />
                         <input name="password" onChange={handleSignupChange} type="password" placeholder="Password" className={commonInputClasses} />
                         <input name="confirmPassword" onChange={handleSignupChange} type="password" placeholder="Confirm Password" className={commonInputClasses} />
                    </>
                )}
            </div>
            <button onClick={handleAuthAction} className="w-full mt-8 bg-[#2E2E2E] text-white py-3 rounded-lg font-semibold hover:bg-gray-700 transition shadow-md">{isLogin ? 'Sign In' : 'Sign Up'}</button>
            {isLogin ? (
                <>
                    <div className="my-6 flex items-center"><div className="flex-grow border-t border-gray-300"></div><span className="flex-shrink mx-4 text-gray-400 text-sm">OR</span><div className="flex-grow border-t border-gray-300"></div></div>
                    <button onClick={() => setIsLogin(false)} className="w-full bg-white text-gray-700 py-3 rounded-lg font-semibold border hover:bg-gray-100 transition shadow-sm">Create an Account</button>
                </>
            ) : (
                <p className="text-center mt-6 text-sm">Already have an account?<button onClick={() => setIsLogin(true)} className="font-semibold text-[#1FA97C] hover:underline ml-1">Sign In</button></p>
            )}
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

const ProjectHubScreen: React.FC<{ user: User; projects: Project[]; onNavigate: (page: Page, data?: any) => void; onLogout: () => void; onDelete: (id: string) => void; onRefresh: () => void; }> = ({ user, projects, onNavigate, onLogout, onDelete, onRefresh }) => {
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
                {projects.map(p => (
                    <div key={p.id} className="bg-[#2E2E2E] text-white p-4 rounded-xl shadow-lg space-y-3">
                        <div className="flex justify-between items-start">
                            <div><h2 className="font-bold text-lg">{p.name}</h2><p className="text-xs text-gray-400">Project Code: {p.projectId}</p><p className="text-sm text-gray-300 mt-1">{p.location}</p></div>
                            <div className="text-right flex flex-col items-end space-y-1"><span className={`text-xs font-semibold px-2 py-1 rounded-full ${p.status === 'Ongoing' ? 'bg-green-500/20 text-green-300' : 'bg-gray-500/20 text-gray-300'}`}>{p.status}</span><span className={`text-xs font-semibold px-2 py-1 rounded-full ${getSeverityClasses(p.severity)}`}>{p.severity}</span></div>
                        </div>
                        <div className="flex space-x-2">
                            <button onClick={() => onNavigate(Page.SafetyOfficerDashboard, { project: p })} className="flex-1 bg-white text-gray-800 py-2 rounded-lg font-semibold text-sm">Open</button>
                            {user.role !== 'Workers' && (<><button onClick={() => onNavigate(Page.EditProject, { projectToEdit: p })} className="flex-1 bg-blue-500/80 hover:bg-blue-500 text-white py-2 rounded-lg font-semibold text-sm">Edit</button><button onClick={() => onDelete(p.id)} className="flex-1 bg-red-500/80 hover:bg-red-500 text-white py-2 rounded-lg font-semibold text-sm">Delete</button></>)}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const NewProjectScreen: React.FC<{ onAddProject: (p: any) => void; currentUser: User }> = ({ onAddProject, currentUser }) => {
    const [project, setProject] = useState({ name: '', severity: 'Safe', location: '', department: '' });
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
    return (
        <div className="bg-[#FAF9F6] min-h-screen">
            <PageHeader title="Edit Project" />
            <div className="p-6 space-y-4">
                <div><label className="text-sm font-medium text-gray-600">Project Name</label><input name="name" value={formData.name} onChange={handleChange} placeholder="Enter your project name" className={commonInputClasses}/></div>
                <div><label className="text-sm font-medium text-gray-600">Project ID</label><div className={readonlyClasses}>{formData.projectId}</div></div>
                <div><label className="text-sm font-medium text-gray-600">Created By</label><div className={readonlyClasses}>{formData.createdBy}</div></div>
                <div><label className="text-sm font-medium text-gray-600">Date & Time</label><div className={readonlyClasses}>{new Date(formData.createdAt).toLocaleString()}</div></div>
                <div><label className="text-sm font-medium text-gray-600">Severity Level</label><select name="severity" value={formData.severity} onChange={handleChange} className={commonInputClasses}><option>Safe</option><option>Medium</option><option>Critical</option></select></div>
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
        const projectForms = submittedForms.filter(f => f.projectId === project.id);

        for (const module of SAFETY_MODULES) {
            const moduleForms = projectForms.filter(f => f.formType === module.title);
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
                {SAFETY_MODULES.map(module => {
                    const stats = moduleStats[module.title] || { safe: 0, medium: 0, critical: 0 };
                    const isReportsModule = module.title === FormType.Reports;
                    return (
                        <button key={module.title} onClick={() => onNavigate(isReportsModule ? Page.ReportsDashboard : Page.ModuleLanding, { formType: module.title })} className="w-full bg-[#2E2E2E] text-white p-4 rounded-xl shadow-lg text-left disabled:opacity-50 disabled:cursor-not-allowed">
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


const DashboardCard: React.FC<{ title: string, children: React.ReactNode }> = ({ title, children }) => (<div className="bg-white p-4 rounded-xl shadow-lg"><h3 className="font-bold text-lg text-gray-800 mb-3">{title}</h3>{children}</div>);

const HOManagerDashboard: React.FC<{ user: User, project: Project, onNavigate: (page: Page, data?: any) => void; onLogout: () => void; submittedForms: FormRecord[] }> = ({ user, project, onNavigate, onLogout, submittedForms }) => {
    const projectForms = useMemo(() => submittedForms.filter(f => f.projectId === project.id), [submittedForms, project.id]);
    
    const reportsByModule = useMemo(() => {
        const counts = projectForms.reduce((acc, form) => {
            acc[form.formType] = (acc[form.formType] || 0) + 1;
            return acc;
        }, {} as Record<FormType, number>);
        
        return Object.entries(counts).map(([label, value]) => ({ label, value })).sort((a,b) => b.value - a.value).slice(0, 6);
    }, [projectForms]);

    return (
        <div className="bg-[#FAF9F6] min-h-screen">
            <AppHeader title="HO Manager Dashboard" user={user} onLogout={onLogout} onNavigate={onNavigate} />
            <div className="p-4 space-y-4">
                <button onClick={() => onNavigate(Page.ProjectHub)} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-semibold text-sm flex items-center justify-center space-x-2 shadow-sm hover:bg-gray-50 mb-2 w-full"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg><span>Back to Project Hub</span></button>
                <p className="text-center font-semibold text-gray-700">Project: {project.name}</p>
                <DashboardCard title="Field Performance Analysis"><p className="text-sm text-gray-600 mb-4">Top reported issue types for this project.</p><ReportsBarChart data={reportsByModule} /></DashboardCard>
                <DashboardCard title="Review Reported Issues"><p className="text-sm text-gray-600 mb-4">Select a module to review all submitted reports.</p><button onClick={() => onNavigate(Page.ModuleSelection)} className="w-full bg-[#2E2E2E] text-white py-3 rounded-lg font-semibold hover:bg-gray-700 transition shadow-md">Review Reports</button></DashboardCard>
            </div>
        </div>
    );
};

const TopManagerDashboard: React.FC<{ user: User, project: Project, onNavigate: (page: Page, data?: any) => void; onLogout: () => void; submittedForms: FormRecord[] }> = ({ user, project, onNavigate, onLogout, submittedForms }) => {
    const projectForms = useMemo(() => submittedForms.filter(f => f.projectId === project.id), [submittedForms, project.id]);

    const trendData = useMemo(() => {
        const reportsByMonth = projectForms.reduce((acc, form) => {
            const month = new Date(form.submittedAt).toLocaleString('default', { month: 'short', year: 'numeric' });
            acc[month] = (acc[month] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        return Object.entries(reportsByMonth)
            .map(([dateStr, count]) => ({ date: new Date(dateStr), count }))
            .sort((a, b) => a.date.getTime() - b.date.getTime());
    }, [projectForms]);

    return (
        <div className="bg-[#FAF9F6] min-h-screen">
            <AppHeader title="Top Management Dashboard" user={user} onLogout={onLogout} onNavigate={onNavigate} />
            <div className="p-4 space-y-4">
                <button onClick={() => onNavigate(Page.ProjectHub)} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-semibold text-sm flex items-center justify-center space-x-2 shadow-sm hover:bg-gray-50 mb-2 w-full"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg><span>Back to Project Hub</span></button>
                <p className="text-center font-semibold text-gray-700">Project: {project.name}</p>
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white p-3 rounded-xl shadow text-center"><p className="text-2xl font-bold text-green-600">98.7%</p><p className="text-xs text-gray-500">Safety Compliance</p></div>
                    <div className="bg-white p-3 rounded-xl shadow text-center"><p className="text-2xl font-bold text-red-600">{projectForms.filter(f => f.status !== 'Closed' && f.data.severityLevel === 'Critical').length}</p><p className="text-xs text-gray-500">Active High-Risk Issues</p></div>
                </div>
                <DashboardCard title="Strategic Safety Summary"><TrendLineChart data={trendData} /></DashboardCard>
                <DashboardCard title="Review Reported Issues"><p className="text-sm text-gray-600 mb-4">Select a module to review all submitted reports.</p><button onClick={() => onNavigate(Page.ModuleSelection)} className="w-full bg-[#2E2E2E] text-white py-3 rounded-lg font-semibold hover:bg-gray-700 transition shadow-md">Review Reports</button></DashboardCard>
            </div>
        </div>
    );
};

const WorkerDashboard: React.FC<{ user: User, project: Project, onNavigate: (page: Page, data?: any) => void; onLogout: () => void; }> = ({ user, project, onNavigate, onLogout }) => (
    <div className="bg-[#FAF9F6] min-h-screen">
        <AppHeader title="Worker Safety Hub" user={user} onLogout={onLogout} onNavigate={onNavigate} />
        <div className="p-4 space-y-4">
            <button onClick={() => onNavigate(Page.ProjectHub)} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-semibold text-sm flex items-center justify-center space-x-2 shadow-sm hover:bg-gray-50 mb-2 w-full"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg><span>Back to Project Hub</span></button>
            <p className="text-center font-semibold text-gray-700">Project: {project.name}</p>
            <DashboardCard title="Today's Safety Briefing"><p className="text-sm text-gray-600">Please review the safety guidelines for today's tasks. Stay hydrated and report any unsafe conditions immediately.</p></DashboardCard>
            <button onClick={() => onNavigate(Page.IssueList, { formType: null })} className="w-full bg-white text-gray-800 p-4 rounded-xl shadow-lg text-left border flex items-center space-x-4"><svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-600" viewBox="0 0 20 20" fill="currentColor"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" /><path fillRule="evenodd" d="M4 5a2 2 0 012-2h8a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 011-1h6a1 1 0 110 2H8a1 1 0 01-1-1zm-1 4a1 1 0 100 2h6a1 1 0 100-2H6z" clipRule="evenodd" /></svg><div><h3 className="font-bold text-lg">View My Submitted Reports</h3><p className="text-xs mt-1 text-gray-500">Check the status and details of your reports.</p></div></button>
             <button onClick={() => onNavigate(Page.Form, { currentFormType: FormType.GoodPractices })} className="w-full bg-[#2E2E2E] text-white p-4 rounded-xl shadow-lg text-left"><h3 className="font-bold text-lg">Report Good Practice</h3><p className="text-xs mt-1 text-gray-300">Spotted something safe? Let us know!</p></button>
            <button onClick={() => onNavigate(Page.Form, { currentFormType: FormType.NearMissReports })} className="w-full bg-yellow-600 text-white p-4 rounded-xl shadow-lg text-left"><h3 className="font-bold text-lg">Report Near Miss</h3><p className="text-xs mt-1 text-yellow-200">Help prevent future incidents.</p></button>
        </div>
    </div>
);

const FormScreen: React.FC<{ formType: FormType; user: User | null; onAddFormRecord: (data: Record<string, any>, files: Record<string, File | null>) => void; }> = ({ formType, user, onAddFormRecord }) => {
    const formConfig = FORM_CONFIGS[formType] || [];
    const getInitialState = useCallback(() => {
        const initialState: { [key: string]: any } = {};
        formConfig.forEach(field => {
            if (field.type === 'readonly') {
                if (field.name.toLowerCase().includes('id')) initialState[field.name] = `${formType.substring(0,3).toUpperCase()}${Date.now()}`;
                else if (field.name.toLowerCase().includes('createdby')) initialState[field.name] = user?.fullName || 'N/A';
            } else initialState[field.name] = '';
        });
        return initialState;
    }, [formConfig, formType, user]);

    const [formData, setFormData] = useState(getInitialState);
    const [fileData, setFileData] = useState<Record<string, File | null>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [photoPreviews, setPhotoPreviews] = useState<Record<string, string>>({});

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
        
        if (errors[name]) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[name];
                return newErrors;
            });
        }

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
        if (!isDraft && !validate()) {
            return;
        }
        onAddFormRecord(formData, fileData);
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
                            const beforeHasError = !!errors[field.name];
                            const afterHasError = !!errors[afterField.name];
                            return (<div key="photo-grid"><div className="grid grid-cols-2 gap-4"><div className="space-y-1"><label className="text-sm font-medium text-gray-600">{field.label}</label>{renderField(field)}{beforeHasError && <p className="text-red-500 text-xs mt-1">{errors[field.name]}</p>}</div><div className="space-y-1"><label className="text-sm font-medium text-gray-600">{afterField.label}</label>{renderField(afterField)}{afterHasError && <p className="text-red-500 text-xs mt-1">{errors[afterField.name]}</p>}</div></div></div>);
                        }
                        return (<div key={field.name} className="space-y-1"><label className="text-sm font-medium text-gray-600">{field.label}</label>{renderField(field)}{hasError && <p className="text-red-500 text-xs mt-1">{errors[field.name]}</p>}</div>);
                    }) : <p className="text-center text-gray-500">This form is not yet configured.</p>}
                    {formConfig.length > 0 && (<div className="pt-4 space-y-3"><button onClick={() => handleSubmit(false)} className="w-full bg-[#2E2E2E] text-white py-3 rounded-lg font-semibold hover:bg-gray-700 transition shadow-md">Submit Record</button><button onClick={() => handleSubmit(true)} className="w-full bg-white text-gray-700 py-3 rounded-lg font-semibold border hover:bg-gray-100 transition shadow-sm">Save as Draft</button></div>)}
                </div>
            </div>
        </div>
    );
};

const EditProfileScreen: React.FC<{ user: User; onUpdateUser: (data: Partial<User>) => void; }> = ({ user, onUpdateUser }) => {
    const [formData, setFormData] = useState({ fullName: user.fullName, emergencyContact: user.emergencyContact });
    const [photoPreview, setPhotoPreview] = useState<string | undefined>(user.profilePhotoUrl);
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, [e.target.name]: e.target.value });
    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files?.[0]) setPhotoPreview(URL.createObjectURL(e.target.files[0])); };
    const handleSave = () => { onUpdateUser({ ...formData, profilePhotoUrl: photoPreview }); };
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
                    <div className="space-y-1"><label className="text-sm font-medium text-gray-600">Employee ID</label><div className="p-3 bg-gray-200 rounded-lg text-gray-500">{user.employeeId}</div></div>
                    <div className="space-y-1"><label className="text-sm font-medium text-gray-600">Role</label><div className="p-3 bg-gray-200 rounded-lg text-gray-500">{user.role}</div></div>
                    <button onClick={handleSave} className="w-full mt-4 bg-[#2E2E2E] text-white py-3 rounded-lg font-semibold hover:bg-gray-700 transition shadow-md">Save Changes</button>
                </div>
            </div>
        </div>
    );
};

const ModuleLandingScreen: React.FC<{ moduleType: FormType; project: Project; onNavigate: (page: Page, data?: any) => void; }> = ({ moduleType, project, onNavigate }) => (
    <div className="bg-[#FAF9F6] min-h-screen">
        <PageHeader title={moduleType}><p className="text-sm font-semibold text-gray-500 mt-1">Project: {project.name}</p></PageHeader>
        <div className="p-6 space-y-4">
            <button onClick={() => onNavigate(Page.Form, { currentFormType: moduleType })} className="w-full bg-[#2E2E2E] text-white p-6 rounded-xl shadow-lg text-left flex items-center space-x-4"><svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110 2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg><div><h3 className="font-bold text-lg">Report New Issue</h3><p className="text-sm text-gray-300">Create and submit a new report.</p></div></button>
            <button onClick={() => onNavigate(Page.IssueList, { formType: moduleType })} className="w-full bg-white text-gray-800 p-6 rounded-xl shadow-lg text-left border flex items-center space-x-4"><svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" /><path fillRule="evenodd" d="M4 5a2 2 0 012-2h8a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 011-1h6a1 1 0 110 2H8a1 1 0 01-1-1zm-1 4a1 1 0 100 2h6a1 1 0 100-2H6z" clipRule="evenodd" /></svg><div><h3 className="font-bold text-lg">View Reported Issues</h3><p className="text-sm text-gray-500">Review all submitted reports.</p></div></button>
        </div>
    </div>
);

const ModuleSelectionScreen: React.FC<{ onNavigate: (page: Page, data?: any) => void; }> = ({ onNavigate }) => (
    <div className="bg-[#FAF9F6] min-h-screen">
        <PageHeader title="Select Module to Review" />
        <div className="p-4 space-y-3">
            {SAFETY_MODULES.map(module => (<button key={module.title} onClick={() => FORM_CONFIGS[module.title]?.length > 0 && onNavigate(Page.IssueList, { formType: module.title })} className="w-full bg-white text-gray-800 p-4 rounded-xl shadow-md text-left disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition" disabled={FORM_CONFIGS[module.title]?.length === 0}><h3 className="font-semibold text-md">{module.title}</h3>{FORM_CONFIGS[module.title]?.length === 0 && <p className="text-xs text-gray-400">Not yet configured</p>}</button>))}
        </div>
    </div>
);

const IssueListScreen: React.FC<{ moduleType: FormType | null; project: Project; issues: FormRecord[]; onNavigate: (page: Page, data?: any) => void; currentUser: User; onExport: (records: FormRecord[], filename: string) => void; }> = ({ moduleType, project, issues, onNavigate, currentUser, onExport }) => {
    const [severityFilter, setSeverityFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    const isMyReportsView = currentUser.role === 'Workers';

    const relevantIssues = useMemo(() => issues.filter(issue => {
        if (issue.projectId !== project.id) return false;
        if (isMyReportsView) return issue.submittedById === currentUser.id;
        return issue.formType === moduleType;
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

    return (
        <div className="bg-[#FAF9F6] min-h-screen">
            <PageHeader title={title}><p className="text-sm font-semibold text-gray-500 mt-1">Project: {project.name}</p></PageHeader>
            <div className="p-4 space-y-3">
                <div className="bg-white p-3 rounded-xl shadow-md grid grid-cols-2 gap-3">
                    <select value={severityFilter} onChange={e => setSeverityFilter(e.target.value)} className={commonSelectClasses}><option value="">All Severities</option><option>Safe</option><option>Medium</option><option>Critical</option></select>
                    <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={commonSelectClasses}><option value="">All Statuses</option><option>Open</option><option>In Progress</option><option>Closed</option></select>
                </div>
                <button onClick={() => onExport(filteredIssues, `${project.name.replace(/\s/g, '_')}_${moduleType?.replace(/\s/g, '_') || 'MyReports'}_Export`)} className="w-full bg-blue-500 text-white py-2 rounded-lg font-semibold text-sm">Export Filtered to CSV</button>

                {filteredIssues.length > 0 ? (filteredIssues.map(issue => (
                    <button key={issue.id} onClick={() => onNavigate(Page.IssueDetail, { issue })} className="w-full bg-white p-4 rounded-xl shadow-md text-left flex justify-between items-center hover:bg-gray-50 transition">
                        <div><p className="font-bold text-gray-800">{issue.id}</p><p className="text-sm text-gray-500">Submitted: {new Date(issue.submittedAt).toLocaleDateString()}</p>{!isMyReportsView && <p className="text-xs text-blue-500 mt-1">{issue.formType}</p>}</div>
                        <div className="text-right"><span className={`text-sm font-bold ${getSeverityClasses(issue.data.severityLevel)}`}>{issue.data.severityLevel}</span><span className={`text-xs font-semibold px-2 py-1 rounded-full mt-1 inline-block ${getStatusClasses(issue.status)}`}>{issue.status}</span></div>
                    </button>
                ))) : (<div className="text-center py-10"><p className="text-gray-500">No issues match the current filters.</p></div>)}
            </div>
        </div>
    );
};

const IssueDetailScreen: React.FC<{ issue: FormRecord; onStatusUpdate: (issueId: string, newStatus: FormRecord['status'], notes: string) => void; currentUser: User | null; }> = ({ issue, onStatusUpdate, currentUser }) => {
    const formConfig = FORM_CONFIGS[issue.formType] || [];
    const [newStatus, setNewStatus] = useState<FormRecord['status']>(issue.status);
    const [notes, setNotes] = useState('');

    const handleUpdate = () => {
        if (!notes) {
            alert("Please add notes for the status update.");
            return;
        }
        onStatusUpdate(issue.id, newStatus, notes);
        setNotes('');
    };

    const canUpdateStatus = currentUser?.role === 'Site Safety Officer' || currentUser?.role === 'HO middle Managers' || currentUser?.role === 'Top Managers';
    
    const renderValue = (field: FormField) => {
        const value = issue.data[field.name];
        if (field.type === 'photo') return value ? <img src={value} alt={field.label} className="rounded-lg max-h-48 mt-1" /> : <p className="text-gray-500 text-sm">No photo uploaded.</p>;
        if (field.name.toLowerCase().includes('date') && typeof value === 'string' && value) return new Date(value).toLocaleString();
        return value || 'N/A';
    };
    return (
        <div className="bg-[#FAF9F6] min-h-screen">
            <PageHeader title="Report Details" />
            <div className="p-6 space-y-6">
                 <div className="bg-white p-6 rounded-2xl shadow-lg space-y-4">
                    <h2 className="text-xl font-bold text-gray-800 border-b pb-2">{issue.formType}</h2>
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
                            <div key={index} className="border-l-2 pl-3">
                                <p className="font-semibold text-gray-700">{update.status}</p>
                                <p className="text-sm text-gray-600">{update.notes}</p>
                                <p className="text-xs text-gray-400 mt-1">by {update.updatedBy} on {new Date(update.timestamp).toLocaleString()}</p>
                            </div>
                        ))}
                        {issue.updates.length === 0 && <p className="text-sm text-gray-500">No updates yet.</p>}
                    </div>
                    {canUpdateStatus && (
                        <div className="pt-4 border-t space-y-3">
                            <h4 className="font-semibold">Update Status</h4>
                            <select value={newStatus} onChange={e => setNewStatus(e.target.value as FormRecord['status'])} className="w-full p-2 bg-gray-100 rounded-lg text-sm"><option>Open</option><option>In Progress</option><option>Closed</option></select>
                            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add notes about the action taken..." className="w-full p-2 bg-gray-100 rounded-lg text-sm min-h-[80px]"></textarea>
                            <button onClick={handleUpdate} className="w-full bg-[#1FA97C] text-white py-2 rounded-lg font-semibold">Add Update</button>
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
    const commonInputClasses = "w-full p-2 bg-gray-100 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#1FA97C]";


    const projectIssues = useMemo(() => allIssues.filter(issue => issue.projectId === project.id), [allIssues, project.id]);

    const filteredIssues = useMemo(() => {
        return projectIssues.filter(issue => {
            const issueDate = new Date(issue.submittedAt);
            const start = new Date(startDate);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999); // Include the whole end day

            const dateMatch = issueDate >= start && issueDate <= end;
            const moduleMatch = selectedModules.length === 0 || selectedModules.includes(issue.formType);

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
        critical: filteredIssues.filter(i => i.data.severityLevel === 'Critical').length,
    }), [filteredIssues]);

    return (
        <div className="bg-[#FAF9F6] min-h-screen">
            <PageHeader title="Reports Dashboard"><p className="text-sm font-semibold text-gray-500 mt-1">Project: {project.name}</p></PageHeader>
            <div className="p-4 space-y-4">
                <div className="bg-white p-4 rounded-xl shadow-md space-y-3">
                    <h3 className="font-bold">Filters</h3>
                    <div className="grid grid-cols-2 gap-3">
                        <div><label className="text-xs">Start Date</label><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={commonInputClasses} /></div>
                        <div><label className="text-xs">End Date</label><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={commonInputClasses} /></div>
                    </div>
                    <div>
                        <label className="text-xs">Module Types (select all that apply)</label>
                        <div className="flex flex-wrap gap-2 mt-1">
                            {SAFETY_MODULES.filter(m => m.title !== FormType.Reports).map(m => (
                                <button key={m.title} onClick={() => toggleModule(m.title)} className={`px-2 py-1 text-xs rounded-full border ${selectedModules.includes(m.title) ? 'bg-[#2E2E2E] text-white border-[#2E2E2E]' : 'bg-white text-gray-600'}`}>
                                    {m.title}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white p-3 rounded-xl shadow text-center"><p className="text-2xl font-bold text-gray-800">{summaryStats.total}</p><p className="text-xs text-gray-500">Total Reports</p></div>
                    <div className="bg-white p-3 rounded-xl shadow text-center"><p className="text-2xl font-bold text-red-600">{summaryStats.open}</p><p className="text-xs text-gray-500">Open Issues</p></div>
                    <div className="bg-white p-3 rounded-xl shadow text-center"><p className="text-2xl font-bold text-yellow-600">{summaryStats.inProgress}</p><p className="text-xs text-gray-500">In Progress</p></div>
                    <div className="bg-white p-3 rounded-xl shadow text-center"><p className="text-2xl font-bold text-red-600">{summaryStats.critical}</p><p className="text-xs text-gray-500">Critical Severity</p></div>
                </div>

                <div>
                    {/* FIX: Changed to use the 'onExport' prop instead of the out-of-scope 'exportToCsv' function. */}
                    <button onClick={() => onExport(filteredIssues, `${project.name.replace(/\s/g, '_')}_Report`)} className="w-full bg-blue-500 text-white py-2 rounded-lg font-semibold text-sm mb-3">Export Filtered to CSV</button>
                    {filteredIssues.map(issue => (
                        <button key={issue.id} onClick={() => onNavigate(Page.IssueDetail, { issue })} className="w-full bg-white p-3 mb-2 rounded-xl shadow-md text-left flex justify-between items-center hover:bg-gray-50 transition">
                             <div><p className="font-bold text-gray-800 text-sm">{issue.id}</p><p className="text-xs text-blue-500 mt-1">{issue.formType}</p></div>
                             <p className="text-xs text-gray-500">{new Date(issue.submittedAt).toLocaleDateString()}</p>
                        </button>
                    ))}
                    {filteredIssues.length === 0 && <p className="text-center text-gray-500 py-6">No reports match the current filters.</p>}
                </div>
            </div>
        </div>
    );
};

export default App;