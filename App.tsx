
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Shield, 
  Terminal as TerminalIcon, 
  Trophy, 
  LogOut, 
  User as UserIcon, 
  Cpu, 
  Plus,
  Zap,
  CheckCircle2,
  Lock,
  Unlock,
  UserPlus,
  RefreshCcw,
  ShieldCheck,
  ChevronLeft,
  Trash2,
  AlertOctagon,
  Activity,
  ListPlus,
  XCircle,
  Paperclip,
  Download,
  ArrowLeft,
  ArrowRight,
  MessageSquare,
  FileText,
  Key
} from 'lucide-react';
import { Role, User, Challenge, Category, Difficulty } from './types';
import { INITIAL_CHALLENGES, SYSTEM_LOGS } from './constants';
import Terminal from './components/Terminal';
import { CyberButton, CyberCard, Badge } from './components/UI';
import { getSecurityHint, getChallengeGen } from './services/geminiService';

const HOSTS = [
  { username: "JIGYESH", password: "ctfmaster" },
  { username: "amanCTF", password: "ctfmatch" }
];

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [challenges, setChallenges] = useState<Challenge[]>(INITIAL_CHALLENGES);
  const [registeredStudents, setRegisteredStudents] = useState<User[]>([]);
  const [isCtfActive, setIsCtfActive] = useState<boolean>(false);
  const [hostPassOverrides, setHostPassOverrides] = useState<Record<string, string>>({});
  
  // UI State
  const [activeTab, setActiveTab] = useState<'challenges' | 'leaderboard' | 'admin'>('challenges');
  const [loginRole, setLoginRole] = useState<Role>(Role.STUDENT);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  
  // Admin State
  const [newStudentUsername, setNewStudentUsername] = useState('');
  const [newStudentPassword, setNewStudentPassword] = useState('');
  
  // Host Password Reset State
  const [resetCurrentPass, setResetCurrentPass] = useState('');
  const [resetNewPass, setResetNewPass] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [manualChallenge, setManualChallenge] = useState({
    title: '', 
    description: '', 
    category: Category.OSINT, 
    difficulty: Difficulty.EASY, 
    points: 100, 
    flag: '', 
    attachment: '',
    manualHints: [] as string[],
  });
  
  const [currentHintInput, setCurrentHintInput] = useState('');

  // Challenge Interaction
  const [selectedChallengeIndex, setSelectedChallengeIndex] = useState<number | null>(null);
  const [flagInput, setFlagInput] = useState('');
  const [submissionMsg, setSubmissionMsg] = useState<{ text: string; success: boolean } | null>(null);
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [isLoadingAi, setIsLoadingAi] = useState(false);

  const selectedChallenge = selectedChallengeIndex !== null ? challenges[selectedChallengeIndex] : null;

  // Persistence (Simulated Backend via LocalStorage)
  useEffect(() => {
    const savedChalls = localStorage.getItem('kf_ctf_challenges');
    const savedStudents = localStorage.getItem('kf_ctf_students');
    const savedActive = localStorage.getItem('kf_ctf_active');
    const savedHostOverrides = localStorage.getItem('kf_ctf_host_overrides');
    
    if (savedChalls) setChallenges(JSON.parse(savedChalls));
    if (savedStudents) setRegisteredStudents(JSON.parse(savedStudents));
    if (savedActive) setIsCtfActive(JSON.parse(savedActive));
    if (savedHostOverrides) setHostPassOverrides(JSON.parse(savedHostOverrides));
  }, []);

  useEffect(() => {
    localStorage.setItem('kf_ctf_challenges', JSON.stringify(challenges));
    localStorage.setItem('kf_ctf_students', JSON.stringify(registeredStudents));
    localStorage.setItem('kf_ctf_active', JSON.stringify(isCtfActive));
    localStorage.setItem('kf_ctf_host_overrides', JSON.stringify(hostPassOverrides));
  }, [challenges, registeredStudents, isCtfActive, hostPassOverrides]);

  // Auth Logic
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    if (loginRole === Role.HOST) {
      const host = HOSTS.find(h => {
        const currentPass = hostPassOverrides[h.username] || h.password;
        return h.username === loginUsername && currentPass === loginPassword;
      });
      if (host) {
        setCurrentUser({ username: host.username, role: Role.HOST, score: 0, solvedIds: [] });
        setActiveTab('challenges');
        setSelectedChallengeIndex(null);
        return;
      }
      setLoginError('INVALID ROOT CREDENTIALS.');
    } else {
      const student = registeredStudents.find(s => s.username === loginUsername && s.password === loginPassword);
      if (student) {
        setCurrentUser({ ...student });
        setActiveTab('challenges');
        setSelectedChallengeIndex(null);
        return;
      }
      setLoginError('STUDENT IDENTITY NOT FOUND.');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setSelectedChallengeIndex(null);
    setAiResponse(null);
    setLoginUsername('');
    setLoginPassword('');
    setActiveTab('challenges');
  };

  const registerStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentUsername || !newStudentPassword) return;
    if (registeredStudents.some(s => s.username === newStudentUsername)) {
      alert("Operative already registered.");
      return;
    }
    const newStudent: User = { username: newStudentUsername, password: newStudentPassword, role: Role.STUDENT, score: 0, solvedIds: [] };
    setRegisteredStudents(prev => [...prev, newStudent]);
    setNewStudentUsername('');
    setNewStudentPassword('');
  };

  const handleHostPasswordReset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || currentUser.role !== Role.HOST) return;
    
    const host = HOSTS.find(h => h.username === currentUser.username);
    if (!host) return;

    const currentActualPass = hostPassOverrides[host.username] || host.password;
    
    if (resetCurrentPass !== currentActualPass) {
      alert("Current password mismatch. Operation aborted.");
      return;
    }

    if (!resetNewPass) {
      alert("New passkey cannot be empty.");
      return;
    }

    setHostPassOverrides(prev => ({ ...prev, [host.username]: resetNewPass }));
    setResetCurrentPass('');
    setResetNewPass('');
    alert("Host passkey successfully re-seeded.");
  };

  // Challenge Creation
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("File too large. Maximum 5MB for local storage backend.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setManualChallenge(prev => ({ ...prev, attachment: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddManualChallenge = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualChallenge.title || !manualChallenge.flag) {
        alert("Title and Flag are required.");
        return;
    }
    const newChall: Challenge = {
      ...manualChallenge,
      description: manualChallenge.title, 
      id: Math.random().toString(36).substr(2, 9),
      solves: 0,
      author: 'Host',
      createdAt: Date.now()
    };
    setChallenges(prev => [newChall, ...prev]);
    setManualChallenge({ title: '', description: '', category: Category.OSINT, difficulty: Difficulty.EASY, points: 100, flag: '', attachment: '', manualHints: [] });
    if (fileInputRef.current) fileInputRef.current.value = '';
    alert("Mission Deployed Successfully.");
  };

  const deleteChallenge = (id: string) => {
    if (confirm("DANGER: Permanently delete this mission and wipe it from the backend manifest?")) {
      const updatedChallenges = challenges.filter(c => c.id !== id);
      setChallenges(updatedChallenges);
      setSelectedChallengeIndex(null);
    }
  };

  // Flag Submission Logic
  const submitFlag = () => {
    if (!selectedChallenge || !currentUser) return;
    if (currentUser.role === Role.HOST) {
        alert("Host access detected. Simulation mode only.");
        return;
    }
    if (currentUser.solvedIds.includes(selectedChallenge.id)) return;

    if (flagInput.trim() === selectedChallenge.flag) {
      const newSolvedIds = [...currentUser.solvedIds, selectedChallenge.id];
      const newScore = currentUser.score + selectedChallenge.points;
      const updatedUser = { ...currentUser, score: newScore, solvedIds: newSolvedIds };
      
      setCurrentUser(updatedUser);
      setRegisteredStudents(prev => prev.map(s => s.username === currentUser.username ? updatedUser : s));
      setChallenges(prev => prev.map(c => c.id === selectedChallenge.id ? { ...c, solves: c.solves + 1 } : c));
      setSubmissionMsg({ text: "FLAG AUTHENTICATED. ACCESS GRANTED.", success: true });
    } else {
      setSubmissionMsg({ text: "INVALID FLAG. ACCESS DENIED.", success: false });
      setTimeout(() => setSubmissionMsg(prev => prev?.success ? prev : null), 1500);
    }
  };

  const navNext = () => {
    if (selectedChallengeIndex !== null && selectedChallengeIndex < challenges.length - 1) {
      setSelectedChallengeIndex(selectedChallengeIndex + 1);
      setSubmissionMsg(null);
      setAiResponse(null);
      setFlagInput('');
    }
  };

  const navPrev = () => {
    if (selectedChallengeIndex !== null && selectedChallengeIndex > 0) {
      setSelectedChallengeIndex(selectedChallengeIndex - 1);
      setSubmissionMsg(null);
      setAiResponse(null);
      setFlagInput('');
    }
  };

  const leaderboardData = useMemo(() => {
    return [...registeredStudents]
      .filter(s => s.role === Role.STUDENT)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }, [registeredStudents]);

  useEffect(() => {
    if (selectedChallenge && currentUser?.solvedIds.includes(selectedChallenge.id)) {
        setFlagInput(selectedChallenge.flag);
        setSubmissionMsg({ text: "FLAG AUTHENTICATED. ACCESS GRANTED.", success: true });
    }
  }, [selectedChallengeIndex, currentUser]);

  const renderAttachment = (dataUrl: string) => {
    if (dataUrl.startsWith('data:image/')) {
      return <img src={dataUrl} alt="Intel Asset" className="max-h-96 w-full object-contain mx-auto rounded border border-green-500/20 shadow-lg" />;
    } else if (dataUrl.startsWith('data:video/')) {
      return <video src={dataUrl} controls className="max-h-96 w-full rounded border border-green-500/20 shadow-lg" />;
    } else {
      return (
        <div className="flex flex-col items-center justify-center p-12 bg-green-500/5 border border-dashed border-green-500/20 rounded">
          <FileText size={64} className="text-green-500/40 mb-4" />
          <span className="text-xs text-green-900 uppercase font-mono tracking-widest">Encrypted Binary Stream Intercepted</span>
        </div>
      );
    }
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-black">
        <div className="w-full max-w-md animate-in fade-in duration-700">
          <div className="text-center mb-8">
            <Shield className="w-16 h-16 text-green-500 mx-auto mb-4 animate-pulse" />
            <h1 className="text-4xl font-bold text-green-500 tracking-tighter crt-glow font-mono uppercase">KEYFORGE CTF</h1>
            <p className="text-green-800 font-mono text-xs uppercase tracking-[0.3em] mt-2">Local Defense Portal</p>
          </div>
          <CyberCard>
            <div className="flex border-b border-green-500/30 mb-6">
              <button onClick={() => setLoginRole(Role.STUDENT)} className={`flex-1 py-3 text-[10px] font-bold uppercase transition-all ${loginRole === Role.STUDENT ? 'text-green-400 border-b-2 border-green-500 bg-green-500/5' : 'text-green-900 opacity-50'}`}>Student</button>
              <button onClick={() => setLoginRole(Role.HOST)} className={`flex-1 py-3 text-[10px] font-bold uppercase transition-all ${loginRole === Role.HOST ? 'text-red-500 border-b-2 border-red-500 bg-red-500/5' : 'text-green-900 opacity-50'}`}>Host</button>
            </div>
            <form onSubmit={handleLogin} className="space-y-4">
              <input 
                type="text" 
                required 
                autoFocus 
                value={loginUsername} 
                onChange={(e) => setLoginUsername(e.target.value)} 
                className="w-full bg-black/50 border border-green-500/30 text-green-400 p-4 rounded focus:border-green-500 outline-none font-mono text-sm shadow-inner" 
                placeholder="UID / OPERATIVE_ID" 
              />
              <input 
                type="password" 
                required 
                value={loginPassword} 
                onChange={(e) => setLoginPassword(e.target.value)} 
                className="w-full bg-black/50 border border-green-500/30 text-green-400 p-4 rounded focus:border-green-500 outline-none font-mono text-sm shadow-inner" 
                placeholder="PASSKEY_PHRASE" 
              />
              {loginError && <p className="text-[10px] text-red-500 font-bold uppercase text-center animate-shake border border-red-500/20 p-2 bg-red-500/5">{loginError}</p>}
              <CyberButton type="submit" className="w-full h-12" variant={loginRole === Role.HOST ? 'danger' : 'primary'}>Initialize Link</CyberButton>
            </form>
          </CyberCard>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-black">
      <nav className="border-b border-green-500/20 bg-black px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <Shield className="w-6 h-6 text-green-500" />
          <h2 className="text-xl font-bold text-green-500 crt-glow font-mono uppercase tracking-tighter">KEYFORGE_v1</h2>
        </div>
        <div className="flex items-center gap-8">
          <button onClick={() => setActiveTab('challenges')} className={`text-xs font-bold uppercase transition-colors ${activeTab === 'challenges' ? 'text-green-400' : 'text-green-900 hover:text-green-500'}`}>Intelligence</button>
          <button onClick={() => setActiveTab('leaderboard')} className={`text-xs font-bold uppercase transition-colors ${activeTab === 'leaderboard' ? 'text-green-400' : 'text-green-900 hover:text-green-500'}`}>Leaderboard</button>
          {currentUser.role === Role.HOST && <button onClick={() => setActiveTab('admin')} className={`text-xs font-bold uppercase transition-colors ${activeTab === 'admin' ? 'text-red-500' : 'text-red-900'}`}>Operations</button>}
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <div className="text-[9px] text-green-900 font-mono uppercase tracking-tighter">{currentUser.username} {currentUser.role === Role.HOST ? '[ROOT]' : ''}</div>
            {currentUser.role === Role.STUDENT && <div className="text-xs font-bold text-green-400 font-mono">{currentUser.score} PTS</div>}
          </div>
          <CyberButton onClick={handleLogout} variant="outline" className="!p-2"><LogOut size={14} /></CyberButton>
        </div>
      </nav>

      <main className="flex-1 p-6 container mx-auto">
        {activeTab === 'challenges' && (
          <div className="flex flex-col items-center">
            {selectedChallengeIndex === null ? (
              <div className="w-full max-w-6xl animate-in fade-in duration-500">
                <h1 className="text-2xl font-bold text-green-400 font-mono uppercase mb-8 border-b border-green-500/20 pb-4 flex items-center gap-2">
                   {isCtfActive ? <Unlock size={20} className="text-green-500" /> : <Lock size={20} className="text-red-500" />} Mission Grid
                </h1>
                {!isCtfActive && currentUser.role === Role.STUDENT ? (
                    <div className="flex flex-col items-center justify-center py-40 space-y-4">
                        <Lock size={48} className="text-red-500 animate-pulse" />
                        <h2 className="text-xl font-bold text-red-500 font-mono uppercase tracking-[0.2em]">CTF STREAM DEACTIVATED</h2>
                        <p className="text-green-900 font-mono text-[10px] uppercase">Awaiting host authorization sequence.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {challenges.map((ch, idx) => (
                        <div key={ch.id} onClick={() => setSelectedChallengeIndex(idx)}
                          className={`cyber-border p-5 cursor-pointer transition-all hover:scale-[1.02] relative bg-black/60 shadow-lg group ${currentUser.solvedIds.includes(ch.id) ? 'border-green-400 bg-green-500/10' : 'hover:bg-green-500/5'}`}>
                          {currentUser.solvedIds.includes(ch.id) && <CheckCircle2 className="absolute top-3 right-3 text-green-400 w-4 h-4 shadow-glow" />}
                          
                          {/* Host Delete Button on Grid */}
                          {currentUser.role === Role.HOST && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); deleteChallenge(ch.id); }}
                              className="absolute top-3 right-3 text-red-900 hover:text-red-500 p-1 bg-black/40 border border-red-900/20 rounded opacity-0 group-hover:opacity-100 transition-all z-10"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}

                          <div className="flex justify-between mb-3">
                            <Badge color={ch.difficulty === Difficulty.HARD ? 'red' : 'green'}>{ch.difficulty}</Badge>
                            <span className="text-xs font-bold text-green-500 font-mono">{ch.points}P</span>
                          </div>
                          <h4 className="text-sm font-bold text-green-300 uppercase truncate mb-4">{ch.title}</h4>
                          <div className="flex justify-between items-center text-[9px] text-green-900 border-t border-green-500/10 pt-3">
                             <span className="uppercase font-bold tracking-widest">{ch.category}</span>
                             <span className="font-mono">{ch.solves} SOLVED</span>
                          </div>
                        </div>
                      ))}
                      {challenges.length === 0 && <p className="col-span-full py-20 text-center text-green-900 font-mono text-xs uppercase italic tracking-widest">No host missions deployed to stream.</p>}
                    </div>
                )}
              </div>
            ) : (
              <div className="w-full max-w-3xl animate-in slide-in-from-bottom-4 duration-400">
                <div className="flex items-center justify-between mb-4 bg-green-500/5 p-2 rounded border border-green-500/10">
                  <button onClick={() => setSelectedChallengeIndex(null)} className="text-green-500 hover:text-green-300 flex items-center gap-1 text-[10px] uppercase font-bold tracking-widest transition-all">
                    <ChevronLeft size={14} /> Mission Grid
                  </button>
                  <div className="flex items-center gap-12">
                    <button onClick={navPrev} disabled={selectedChallengeIndex === 0} className="text-green-500 disabled:opacity-10 hover:text-green-300 transition-all p-2 group"><ArrowLeft size={48} className="group-hover:scale-110 transition-transform" /></button>
                    <span className="text-xl font-mono text-green-400 uppercase font-bold tracking-[0.2em] crt-glow bg-black/40 px-4 py-1 rounded border border-green-500/20">#{selectedChallengeIndex + 1}</span>
                    <button onClick={navNext} disabled={selectedChallengeIndex === challenges.length - 1} className="text-green-500 disabled:opacity-10 hover:text-green-300 transition-all p-2 group"><ArrowRight size={48} className="group-hover:scale-110 transition-transform" /></button>
                  </div>
                </div>
                <CyberCard>
                  <div className="mb-6 space-y-8">
                    {/* Updated Header with Title and prominently placed Delete Button for Host */}
                    <div className="flex items-center justify-between gap-4 border-b border-green-500/20 pb-4">
                      <h3 className="text-2xl font-bold text-green-400 crt-glow uppercase flex items-center gap-4">
                        <span className="text-green-600 font-mono tracking-tighter">&gt;</span> {selectedChallenge?.title}
                      </h3>
                      {currentUser.role === Role.HOST && (
                        <CyberButton 
                          variant="outline" 
                          className="!p-2 border-red-900/40 text-red-900 hover:text-red-500 hover:border-red-500 bg-red-500/5 transition-all group"
                          onClick={() => deleteChallenge(selectedChallenge!.id)}
                        >
                          <div className="flex items-center gap-2 px-2">
                             <Trash2 size={16} className="group-hover:scale-110" />
                             <span className="text-[9px] font-bold">DELETE MISSION</span>
                          </div>
                        </CyberButton>
                      )}
                    </div>

                    <div className="bg-green-500/5 border-l-2 border-green-500 p-6 shadow-inner">
                       <p className="text-green-300 font-mono text-sm leading-relaxed whitespace-pre-wrap">{selectedChallenge?.description}</p>
                    </div>
                    
                    {selectedChallenge?.attachment && (
                      <div className="bg-black/90 border border-green-500/20 p-6 rounded overflow-hidden">
                        <div className="mb-6">{renderAttachment(selectedChallenge.attachment)}</div>
                        <CyberButton 
                          variant="outline" 
                          className="w-full !py-4 text-xs font-bold border-2 shadow-[0_0_15px_rgba(0,255,65,0.1)]" 
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = selectedChallenge.attachment!;
                            link.download = `captured_intel_${selectedChallenge.id}`;
                            link.click();
                          }}
                        >
                          <Download size={18} /> DECRYPT & DOWNLOAD ATTACHMENT
                        </CyberButton>
                      </div>
                    )}

                    {selectedChallenge?.manualHints && selectedChallenge.manualHints.length > 0 && (
                      <div className="space-y-2 border-t border-green-500/10 pt-4">
                        <span className="text-[10px] text-green-800 font-bold uppercase flex items-center gap-2"><ListPlus size={12} /> INTERCEPTED HOST INTEL:</span>
                        {selectedChallenge.manualHints.map((h, i) => <div key={i} className="text-[11px] text-green-500/60 font-mono italic p-3 bg-black/40 border border-green-500/5">- {h}</div>)}
                      </div>
                    )}
                  </div>
                  <div className="space-y-4 pt-4 border-t border-green-500/20">
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={flagInput} 
                        disabled={currentUser.solvedIds.includes(selectedChallenge!.id)} 
                        onChange={(e) => setFlagInput(e.target.value)} 
                        placeholder="KF{CAPTURE_THE_FLAG}"
                        className={`flex-1 bg-black border p-4 text-lg text-green-500 focus:outline-none font-mono disabled:opacity-50 transition-all 
                          ${submissionMsg?.success ? 'border-green-500 shadow-[0_0_15px_rgba(0,255,65,0.3)]' : 
                            submissionMsg && !submissionMsg.success ? 'border-red-500 animate-shake shadow-[0_0_10px_rgba(255,0,0,0.3)]' : 
                            'border-green-500/30 focus:border-green-500'}`} 
                      />
                      <CyberButton onClick={submitFlag} disabled={currentUser.solvedIds.includes(selectedChallenge!.id)} className="px-10 h-16">
                        {currentUser.solvedIds.includes(selectedChallenge!.id) ? <CheckCircle2 size={24} /> : <Zap size={24} />}
                      </CyberButton>
                    </div>
                    {submissionMsg && <p className={`text-xs text-center font-bold uppercase tracking-[0.2em] p-4 border-2 animate-in fade-in zoom-in-95 ${submissionMsg.success ? 'border-green-500 text-green-400 bg-green-500/10' : 'border-red-500 text-red-400 bg-red-500/10'}`}>{submissionMsg.text}</p>}
                  </div>
                </CyberCard>
              </div>
            )}
            <div className="w-full max-w-4xl mt-20"><Terminal logs={SYSTEM_LOGS} /></div>
          </div>
        )}

        {activeTab === 'leaderboard' && (
          <div className="max-w-2xl mx-auto animate-in zoom-in-95 duration-500">
             <h1 className="text-3xl font-bold text-green-400 crt-glow text-center uppercase font-mono tracking-tighter mb-8">System Rankings</h1>
             <CyberCard>
                <div className="divide-y divide-green-500/10">
                  {leaderboardData.map((s, idx) => (
                    <div key={s.username} className={`flex items-center justify-between p-6 transition-all hover:bg-green-500/5 ${s.username === currentUser.username ? 'bg-green-500/10 border-l-4 border-green-500 shadow-inner' : ''}`}>
                      <div className="flex items-center gap-8">
                        <span className={`text-2xl font-bold font-mono ${idx < 3 ? 'text-green-500' : 'text-green-900'}`}>{idx + 1}</span>
                        <span className="text-green-300 font-mono uppercase font-bold text-lg tracking-widest">{s.username}</span>
                      </div>
                      <span className="text-green-500 font-bold text-2xl font-mono">{s.score} <span className="text-[10px] text-green-900 tracking-widest">PTS</span></span>
                    </div>
                  ))}
                  {leaderboardData.length === 0 && <p className="text-center py-20 text-green-900 font-mono uppercase text-xs tracking-[0.3em]">No telemetry data recorded in current session.</p>}
                </div>
             </CyberCard>
          </div>
        )}

        {activeTab === 'admin' && currentUser.role === Role.HOST && (
          <div className="space-y-8 animate-in slide-in-from-right duration-500">
             <div className="bg-red-500/10 p-8 border border-red-500/20 rounded shadow-lg">
                <div className="flex items-center justify-between flex-wrap gap-6">
                   <h1 className="text-3xl font-bold text-red-500 uppercase font-mono tracking-tighter flex items-center gap-4"><Cpu size={32} /> HOST COMMAND CENTER</h1>
                   <div className="flex gap-4">
                      <CyberButton variant={isCtfActive ? 'danger' : 'primary'} onClick={() => setIsCtfActive(!isCtfActive)} className="px-12 h-14 shadow-[0_0_20px_rgba(0,255,65,0.2)]">
                         {isCtfActive ? <Lock size={20} /> : <Unlock size={20} />} {isCtfActive ? 'STOP CTF' : 'ACTIVATE CTF'}
                      </CyberButton>
                      <CyberButton variant="outline" className="border-red-500/50 text-red-500 h-14 px-6" onClick={() => { if(confirm("DANGER: WIPE ALL MISSION DATA FROM BACKEND?")) setChallenges([]); }}><Trash2 size={20} /></CyberButton>
                   </div>
                </div>
             </div>

             <div className="grid lg:grid-cols-2 gap-8">
                <div className="space-y-8">
                  <CyberCard title="Host Credential Re-seed">
                    <form onSubmit={handleHostPasswordReset} className="space-y-4">
                       <div className="space-y-1">
                          <label className="text-[10px] text-red-900 font-bold uppercase block tracking-widest">Current Passkey</label>
                          <input 
                            type="password" 
                            required
                            value={resetCurrentPass} 
                            onChange={e => setResetCurrentPass(e.target.value)} 
                            className="w-full bg-black border border-red-500/20 p-3 text-xs text-red-400 font-mono outline-none focus:border-red-500 shadow-inner" 
                            placeholder="AUTH_REQUIRED" 
                          />
                       </div>
                       <div className="space-y-1">
                          <label className="text-[10px] text-red-900 font-bold uppercase block tracking-widest">New Passkey Phrase</label>
                          <input 
                            type="password" 
                            required
                            value={resetNewPass} 
                            onChange={e => setResetNewPass(e.target.value)} 
                            className="w-full bg-black border border-red-500/20 p-3 text-xs text-red-400 font-mono outline-none focus:border-red-500 shadow-inner" 
                            placeholder="NEW_ENCRYPTION_KEY" 
                          />
                       </div>
                       <CyberButton type="submit" variant="danger" className="w-full h-12 uppercase font-bold tracking-[0.2em]"><Key size={16} /> RE-SEED ROOT KEY</CyberButton>
                    </form>
                  </CyberCard>

                  <CyberCard title="Mission Manifest (Active)">
                     <div className="max-h-[500px] overflow-y-auto space-y-2 pr-3 custom-scroll">
                        {challenges.map(ch => (
                           <div key={ch.id} className="text-[11px] border border-green-500/10 p-4 flex justify-between items-center bg-black/40 hover:bg-green-500/5 transition-all group">
                             <div className="flex flex-col gap-1">
                                <span className="font-bold text-green-400 uppercase tracking-widest truncate max-w-[200px]">{ch.title}</span>
                                <div className="flex gap-3 text-[8px] text-green-900 font-mono">
                                  <span>{ch.points}P</span>
                                  <span>{ch.category}</span>
                                  <span>SOLVES: {ch.solves}</span>
                                </div>
                             </div>
                             <button onClick={() => deleteChallenge(ch.id)} className="text-red-900 hover:text-red-500 transition-colors p-2 border border-red-900/20 rounded">
                               <Trash2 size={16} />
                             </button>
                           </div>
                        ))}
                        {challenges.length === 0 && <p className="text-center py-10 text-green-900 font-mono uppercase text-[10px] italic tracking-widest">No missions deployed to stream.</p>}
                     </div>
                  </CyberCard>

                  <CyberCard title="Student Operative Registry">
                     <form onSubmit={registerStudent} className="space-y-4 mb-8">
                        <div className="flex flex-col sm:flex-row gap-3">
                          <input value={newStudentUsername} onChange={e => setNewStudentUsername(e.target.value)} className="flex-1 bg-black border border-green-500/20 p-4 text-xs text-green-400 font-mono outline-none focus:border-green-500" placeholder="NEW OPERATIVE_ID" />
                          <input type="password" value={newStudentPassword} onChange={e => setNewStudentPassword(e.target.value)} className="flex-1 bg-black border border-green-500/20 p-4 text-xs text-green-400 font-mono outline-none focus:border-green-500" placeholder="INITIAL_PASSKEY" />
                          <CyberButton type="submit" className="px-6"><UserPlus size={20} /></CyberButton>
                        </div>
                     </form>
                     <div className="max-h-64 overflow-y-auto space-y-2 pr-3 custom-scroll">
                        {registeredStudents.map(s => (
                          <div key={s.username} className="text-[11px] border border-green-500/10 p-4 flex justify-between items-center bg-black/40 hover:bg-green-500/5 transition-all group">
                             <div className="flex flex-col">
                                <span className="font-bold text-green-400 uppercase tracking-widest">{s.username}</span>
                                <span className="text-[9px] text-green-900 font-mono">ENCRYPTED_PHRASE: *****</span>
                             </div>
                             <div className="flex items-center gap-6">
                                <div className="text-right">
                                   <div className="text-green-500 font-bold font-mono">{s.score}P</div>
                                   <div className="text-[8px] text-green-900 uppercase">{s.solvedIds.length} SOLVED</div>
                                </div>
                                <button onClick={() => setRegisteredStudents(prev => prev.filter(u => u.username !== s.username))} className="text-red-900 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"><Trash2 size={16} /></button>
                             </div>
                          </div>
                        ))}
                        {registeredStudents.length === 0 && <p className="text-center py-10 text-green-900 font-mono uppercase text-[10px] italic tracking-widest">No operative identities in local registry.</p>}
                     </div>
                  </CyberCard>
                </div>

                <CyberCard title="CTF MISSION FORGE">
                   <form onSubmit={handleAddManualChallenge} className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-[10px] text-green-800 font-bold uppercase block tracking-widest">Mission Parameters / Intel Question</label>
                        <textarea placeholder="Describe the vulnerability or the task student must solve..." value={manualChallenge.title} onChange={e => setManualChallenge({...manualChallenge, title: e.target.value})} className="w-full bg-black border border-green-500/20 p-4 text-xs text-green-400 font-mono h-40 outline-none focus:border-green-500 transition-all shadow-inner resize-none" />
                      </div>
                      
                      <div className="flex gap-2">
                          <input placeholder="Add encrypted hint..." value={currentHintInput} onChange={e => setCurrentHintInput(e.target.value)} className="flex-1 bg-black border border-green-500/20 p-3 text-[11px] text-green-400 font-mono outline-none" />
                          <button type="button" onClick={() => { if(currentHintInput) { setManualChallenge(p => ({...p, manualHints: [...p.manualHints, currentHintInput]})); setCurrentHintInput(''); } }} className="bg-green-500/10 text-green-500 px-6 text-[10px] uppercase font-bold border border-green-500/20 hover:bg-green-500/20">Add Intel</button>
                      </div>
                      
                      <div className="flex flex-wrap gap-2 min-h-[1.5rem]">
                        {manualChallenge.manualHints.map((h, i) => <span key={i} className="text-[9px] border border-green-500/20 px-3 py-1 text-green-600 flex items-center gap-2 bg-green-500/5 font-mono">{h} <XCircle size={10} className="cursor-pointer text-red-900 hover:text-red-500" onClick={() => setManualChallenge(p => ({...p, manualHints: p.manualHints.filter((_, idx) => idx !== i)}))} /></span>)}
                      </div>

                      <div className="p-4 border border-green-500/10 bg-green-500/5 rounded">
                        <label className="text-[10px] text-green-700 font-bold uppercase block mb-3 tracking-widest">Digital Asset Backend Storage</label>
                        <div className="flex gap-3 items-center">
                          <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                          <button type="button" onClick={() => fileInputRef.current?.click()} className="flex-1 border-2 border-green-500/20 p-4 text-[10px] text-green-500 font-mono uppercase hover:bg-green-500/10 flex items-center justify-center gap-3 transition-all">
                             <Paperclip size={16} /> {manualChallenge.attachment ? 'ASSET_LOADED' : 'ATTACH_OPERATIONAL_INTEL'}
                          </button>
                          {manualChallenge.attachment && (
                            <button type="button" onClick={() => setManualChallenge(p => ({...p, attachment: ''}))} className="text-red-900 hover:text-red-500 p-2"><Trash2 size={24} /></button>
                          )}
                        </div>
                        <p className="text-[8px] text-green-900 font-mono uppercase mt-2">Max 5MB (Image/Video/Any) — Saved to local backend.</p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <select value={manualChallenge.category} onChange={e => setManualChallenge({...manualChallenge, category: e.target.value as Category})} className="bg-black border border-green-500/20 p-3 text-xs text-green-400 uppercase font-bold outline-none cursor-pointer">
                            {Object.values(Category).map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <select value={manualChallenge.difficulty} onChange={e => setManualChallenge({...manualChallenge, difficulty: e.target.value as Difficulty})} className="bg-black border border-green-500/20 p-3 text-xs text-green-400 uppercase font-bold outline-none cursor-pointer">
                            {Object.values(Difficulty).map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <input type="number" placeholder="Points Bounty" value={manualChallenge.points} onChange={e => setManualChallenge({...manualChallenge, points: parseInt(e.target.value) || 0})} className="bg-black border border-green-500/20 p-3 text-xs text-green-400 font-mono outline-none" />
                        <input placeholder="MASTER_FLAG: KF{...}" value={manualChallenge.flag} onChange={e => setManualChallenge({...manualChallenge, flag: e.target.value})} className="bg-black border border-red-500/20 p-3 text-xs text-red-400 font-mono outline-none focus:border-red-500" />
                      </div>
                      <CyberButton type="submit" className="w-full h-16 uppercase font-bold text-sm tracking-[0.3em] shadow-lg"><Plus size={20} /> DEPLOY TO CTF STREAM</CyberButton>
                   </form>
                </CyberCard>
             </div>
          </div>
        )}
      </main>

      <footer className="border-t border-green-500/5 bg-black p-6 text-center mt-auto opacity-30 select-none">
          <div className="flex items-center justify-center gap-12 text-[10px] text-green-900 font-mono uppercase tracking-[0.5em]">
             <span>ENCRYPTION: AES-256-GCM</span>
             <span>ORIGIN: KEYFORGE CLUB</span>
             <span>CORE: v1.1.0-LOCAL-BACKEND</span>
          </div>
      </footer>
      
      <style>{`
        .custom-scroll::-webkit-scrollbar { width: 4px; }
        .custom-scroll::-webkit-scrollbar-track { background: transparent; }
        .custom-scroll::-webkit-scrollbar-thumb { background: #00ff41; border-radius: 10px; box-shadow: 0 0 5px #00ff41; }
        .animate-shake { animation: shake 0.2s ease-in-out infinite; }
        @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
        .crt-glow { text-shadow: 0 0 8px rgba(0, 255, 65, 0.8); }
        .shadow-glow { filter: drop-shadow(0 0 5px rgba(0, 255, 65, 0.8)); }
      `}</style>
    </div>
  );
};

export default App;
