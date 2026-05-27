import { 
  Users, Target, UserMinus, Clock, Calendar, Clipboard,
  TrendingUp, RefreshCcw, ChevronRight, Loader2, Save, Search, Download
} from 'lucide-react';
import { motion } from 'motion/react';
import { StatCard, StatCardProps } from './StatCard';
import { OrganizationChart, RankChart, OrganizationalTree } from './Charts';
import { useNavigate, useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { fetchEmployeesFromSheets, updateEmployeeInSheets, bulkUpdateEmployeesInSheets } from '../services/sheetsService';
import { Employee, EmploymentStatus } from '../types';
import { cn } from '../lib/utils';

interface DashboardProps {
  token: string;
}

const TABS = [
  { id: 'dashboard', label: '대시보드', icon: Users },
  { id: 'status', label: '인력현황', icon: Users },
  { id: 'tenure', label: '재직기간', icon: Calendar },
  { id: 'hiring', label: '채용현황', icon: Target },
  { id: 'leaver', label: '퇴사자', icon: UserMinus },
  { id: 'org', label: '조직/직급', icon: TrendingUp },
  { id: 'attendance', label: '근태/연차', icon: Clock },
];

const SPREADSHEET_ID = '1kHoQPjudplszOtD39wnZHMHGAaEghTNkVuqNjNQf37o';

const calculateProbationEndDate = (hireDateStr: string): string => {
  if (!hireDateStr) return '';
  const date = new Date(hireDateStr);
  if (isNaN(date.getTime())) return '';
  date.setMonth(date.getMonth() + 3);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}/${mm}/${dd}`;
};

const getProbationStatus = (emp: Employee): '수습' | '수습종료' => {
  if (emp.probationStatus) return emp.probationStatus;
  if (!emp.hireDate) return '수습종료';
  
  const hireDate = new Date(emp.hireDate);
  if (isNaN(hireDate.getTime())) return '수습종료';
  
  const endDate = new Date(hireDate);
  endDate.setMonth(endDate.getMonth() + 3);
  
  const now = new Date();
  return now < endDate ? '수습' : '수습종료';
};

const getYearsOfService = (hireDateStr: string): number => {
  if (!hireDateStr) return 0;
  const hireDate = new Date(hireDateStr.replace(/\./g, '/'));
  if (isNaN(hireDate.getTime())) return 0;
  
  const today = new Date();
  const diffTime = Math.abs(today.getTime() - hireDate.getTime());
  const diffDays = diffTime / (1000 * 60 * 60 * 24);
  return diffDays / 365.25;
};

const formatDuration = (durationStr?: string): string => {
  if (!durationStr) return '';
  return durationStr
    .replace(/^0+/, '')
    .replace(/년0+/, '년 ')
    .replace(/년/, '년 ');
};

const getYearsFromPColumn = (yearsStr?: string): number => {
  if (!yearsStr) return 0;
  const num = parseFloat(yearsStr.replace(/[^0-9.]/g, ''));
  return isNaN(num) ? 0 : num;
};

const formatTenureYear = (yearsInRank?: string): string => {
  if (!yearsInRank) return '';
  if (yearsInRank.includes('임원')) return '임원';
  const num = parseFloat(yearsInRank.replace(/[^0-9.]/g, ''));
  if (isNaN(num)) return yearsInRank;
  return `${num}년차`;
};

const getPromotionStatus = (emp: Employee): '승진' | '미대상' => {
  if (emp.promotionStatus) return emp.promotionStatus;
  
  const years = getYearsFromPColumn(emp.yearsInRank);
  const rank = emp.rank || '';
  
  if (rank.includes('수석매니저') || rank.includes('센터장') || rank.includes('부센터장')) {
    return '미대상';
  }
  if (rank.includes('책임매니저')) {
    return years >= 6 ? '승진' : '미대상';
  }
  if (rank.includes('선임매니저')) {
    return years >= 6 ? '승진' : '미대상';
  }
  if (rank.includes('매니저')) {
    return years >= 3 ? '승진' : '미대상';
  }
  return '미대상';
};

export const Dashboard = ({ token }: DashboardProps) => {
  const { tabId } = useParams();
  const navigate = useNavigate();
  const activeTab = tabId || 'dashboard';
  const now = new Date();
  
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedTime, setLastSyncedTime] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<Employee>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [promotionFilter, setPromotionFilter] = useState<'all' | 'promoted' | 'none'>('all');

  const loadData = async (forceSync = false) => {
    setIsSyncing(true);
    try {
      const data = await fetchEmployeesFromSheets(token, forceSync);
      setEmployees(data);
      const syncTime = new Date().toLocaleTimeString('ko-KR', { hour12: false });
      setLastSyncedTime(syncTime);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setIsLoading(false);
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadData(false);
    }
  }, [token]);

  const handleProbationStatusChange = async (emp: Employee, newStatus: '수습' | '수습종료') => {
    const index = employees.findIndex(e => e.id === emp.id);
    if (index === -1) return;

    const updatedEmployee = { ...emp, probationStatus: newStatus };
    
    // Optimistic update
    const newEmployees = [...employees];
    newEmployees[index] = updatedEmployee;
    setEmployees(newEmployees);

    try {
      await updateEmployeeInSheets(token, updatedEmployee, index);
    } catch (err) {
      alert('업데이트 실패: ' + err);
      loadData();
    }
  };

  const handlePromotionStatusChange = async (emp: Employee, newStatus: '승진' | '미대상') => {
    const index = employees.findIndex(e => e.id === emp.id);
    if (index === -1) return;

    const updatedEmployee = { ...emp, promotionStatus: newStatus };
    
    // Optimistic update
    const newEmployees = [...employees];
    newEmployees[index] = updatedEmployee;
    setEmployees(newEmployees);

    try {
      await updateEmployeeInSheets(token, updatedEmployee, index);
    } catch (err) {
      alert('업데이트 실패: ' + err);
      loadData();
    }
  };

  const activeCount = employees.filter(e => e.status === '재직').length;
  const thisMonthHires = employees.filter(e => {
    const hireDate = new Date(e.hireDate);
    return hireDate.getMonth() === now.getMonth() && hireDate.getFullYear() === now.getFullYear();
  }).length;
  
  const totalUsedLeave = employees.reduce((acc, e) => acc + (e.usedLeave || 0), 0);
  const totalTotalLeave = employees.reduce((acc, e) => acc + (e.totalLeave || 0), 0);
  const leaveUsageRate = Math.round((totalUsedLeave / (totalTotalLeave || 1)) * 100);

  const stats: StatCardProps[] = [
    { title: '전체 인원', value: activeCount, unit: '명', trend: { label: '전월 대비', value: 0, isUp: true } },
    { title: '이번 달 입사', value: thisMonthHires, unit: '명', footer: { label: '이번 달 누적', value: `${thisMonthHires}건` } },
    { title: '이번 달 퇴사', value: employees.filter(e => e.status === '퇴직').length, unit: '명', trend: { label: 'YTD', value: 0, isUp: false } },
    { title: '평균 근속', value: 3.2, unit: '년' },
    { title: '전체 연차 사용률', value: leaveUsageRate, unit: '%', trend: { label: '전체 소진율', value: leaveUsageRate, isUp: true } },
  ];

  const handleUpdateStatus = async (id: string, newStatus: EmploymentStatus) => {
    const confirm = window.confirm(`상태를 "${newStatus}"(으)로 변경하시겠습니까?`);
    if (!confirm) return;

    const index = employees.findIndex(e => e.id === id);
    if (index === -1) return;

    const updatedEmployee = { ...employees[index], status: newStatus };
    
    // Optimistic update
    const newEmployees = [...employees];
    newEmployees[index] = updatedEmployee;
    setEmployees(newEmployees);

    try {
      await updateEmployeeInSheets(token, updatedEmployee, index);
    } catch (err) {
      alert('업데이트 실패: ' + err);
      loadData();
    }
  };

  const handleSaveEdit = async (id: string) => {
    const index = employees.findIndex(e => e.id === id);
    if (index === -1) return;

    // Recalculate remaining leave
    const total = editValues.totalLeave ?? employees[index].totalLeave ?? 0;
    const used = editValues.usedLeave ?? employees[index].usedLeave ?? 0;
    const remaining = total - used;

    const updatedEmployee = { 
      ...employees[index], 
      ...editValues,
      remainingLeave: remaining
    };
    
    // Optimistic update
    const newEmployees = [...employees];
    newEmployees[index] = updatedEmployee;
    setEmployees(newEmployees);
    setEditingId(null);

    try {
      await updateEmployeeInSheets(token, updatedEmployee, index);
    } catch (err) {
      alert('업데이트 실패: ' + err);
      loadData();
    }
  };

  const handleResetAllStatus = async () => {
    if (!window.confirm('모든 인원의 상태를 "재직"으로 초기화하시겠습니까?\n이 작업은 구글 시트의 데이터를 즉시 변경합니다.')) return;
    setIsSyncing(true);
    try {
      const updatedEmployees = employees.map(e => ({ ...e, status: '재직' as EmploymentStatus }));
      await bulkUpdateEmployeesInSheets(token, updatedEmployees);
      setEmployees(updatedEmployees);
      alert('성공적으로 모두 "재직" 상태로 초기화되었습니다.');
    } catch (err) {
      alert('초기화 실패: ' + err);
      loadData();
    } finally {
      setIsSyncing(false);
    }
  };

  const formatTeamName = (name: string) => {
    if (!name) return '';
    return name.replace('노랑통닭 ', '');
  };

  const formatRankName = (name: string) => {
    if (!name) return '';
    if (window.innerWidth < 640 && name.includes('매니저') && name !== '매니저') {
      return name.replace('매니저', '');
    }
    return name;
  };

  const handleDownloadHTML = () => {
    const html = document.documentElement.outerHTML;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const date = new Date().toISOString().split('T')[0];
    a.href = url;
    a.download = `HR_Dashboard_${date}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const filteredEmployees = employees.filter(e => {
    // Tab filter
    if (activeTab === 'leaver' && e.status !== '퇴직') return false;
    if (activeTab === 'status' && e.status === '퇴직') return false;
    if (activeTab === 'tenure' && e.status === '퇴직') return false;
    if (activeTab === 'hiring' && e.status === '퇴직') return false;
    
    // Search filter
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      const matches = 
        e.name.toLowerCase().includes(lowerSearch) ||
        e.hq.toLowerCase().includes(lowerSearch) ||
        (e.team || '').toLowerCase().includes(lowerSearch) ||
        (e.rank || '').toLowerCase().includes(lowerSearch);
      if (!matches) return false;
    }
    
    // Promotion filter (only applicable for status tab)
    if (activeTab === 'status' && promotionFilter !== 'all') {
      const promoStatus = getPromotionStatus(e);
      if (promotionFilter === 'promoted' && promoStatus !== '승진') return false;
      if (promotionFilter === 'none' && promoStatus !== '미대상') return false;
    }
    
    return true;
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-blue-500 mb-4" size={32} />
        <p className="text-slate-500 font-medium">데이터를 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col min-h-screen">
      {/* Simple Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">HR Insight Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {now.getFullYear()}년 {now.getMonth() + 1}월 {now.getDate()}일 기준 · 실시간 연동 중
          </p>
        </div>
        
        <div className="flex items-center gap-2 sm:gap-3">
          {lastSyncedTime && (
            <div className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 border border-emerald-100 rounded-lg text-[10px] sm:text-xs font-medium text-emerald-700 shadow-sm shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>구글 데이터 동기화 완료 ({lastSyncedTime})</span>
            </div>
          )}
          <button 
            onClick={handleDownloadHTML}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
            title="현재 화면을 HTML로 저장"
          >
            <Download size={16} />
            <span className="hidden sm:inline">HTML 저장</span>
          </button>
          <button 
            disabled={isSyncing}
            onClick={() => loadData(true)}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50"
          >
            <RefreshCcw size={16} className={isSyncing ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">데이터 동기화</span>
            <span className="sm:hidden">동기화</span>
          </button>
          <div className="h-8 w-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold ring-4 ring-blue-50 shrink-0">ON</div>
        </div>
      </header>

      {/* Simplified Navigation */}
      <nav className="flex items-center gap-1 border-b border-slate-200 mb-8 overflow-x-auto no-scrollbar bg-white sticky top-0 z-10 sm:relative sm:top-auto">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => navigate(`/${tab.id}`)}
              className={cn(
                "flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-3 py-3 sm:px-5 sm:py-4 transition-all relative min-w-[60px] sm:min-w-0",
                activeTab === tab.id 
                  ? "text-blue-600 after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-full after:h-0.5 after:bg-blue-600" 
                  : "text-slate-400 hover:text-slate-600"
              )}
            >
              <Icon size={18} className={activeTab === tab.id ? "text-blue-600" : "text-slate-400"} />
              <span className={cn(
                "text-[9px] sm:text-[13px] font-medium transition-all",
                activeTab === tab.id ? "text-blue-600" : "text-slate-500",
                "hidden sm:block", // Always show labels on web/tablet
                activeTab === tab.id && "block sm:block" // On mobile, show only active label
              )}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Main Content */}
      <main className="flex-grow">
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              {stats.map((stat, i) => (
                <StatCard key={i} {...stat} />
              ))}
            </div>

            {/* Charts Section - Hidden on mobile */}
            <div className="hidden sm:grid grid-cols-1 lg:grid-cols-2 gap-6">
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="dashboard-card"
              >
                <div className="flex justify-between items-center mb-6">
                  <h2 className="section-title mb-0">조직별 인원 현황 (통합)</h2>
                  <button onClick={() => navigate('/org')} className="text-xs font-medium text-blue-600 hover:underline flex items-center gap-0.5">
                    상세보기 <ChevronRight size={12} />
                  </button>
                </div>
                <OrganizationChart data={employees} />
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="dashboard-card"
              >
                <div className="flex justify-between items-center mb-6">
                  <h2 className="section-title mb-0">직급별 인원 분포</h2>
                  <button onClick={() => navigate('/org')} className="text-xs font-medium text-blue-600 hover:underline flex items-center gap-0.5">
                    상세보기 <ChevronRight size={12} />
                  </button>
                </div>
                <RankChart data={employees} />
              </motion.div>
            </div>
            
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="dashboard-card"
            >
              <h2 className="section-title">최근 입사자 현황</h2>
              <div className="overflow-x-auto no-scrollbar">
                <table className="w-full text-[11px] sm:text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="px-4 py-2 sm:px-4 sm:py-3 text-left font-semibold text-slate-600">성명</th>
                      <th className="hidden sm:table-cell px-4 py-3 text-left font-semibold text-slate-600">본부</th>
                      <th className="px-4 py-2 sm:px-4 sm:py-3 text-left font-semibold text-slate-600">팀명</th>
                      <th className="px-4 py-2 sm:px-4 sm:py-3 text-left font-semibold text-slate-600">직급</th>
                      <th className="px-4 py-2 sm:px-4 sm:py-3 text-left font-semibold text-slate-600">입사일</th>
                      <th className="hidden sm:table-cell px-4 py-3 text-left font-semibold text-slate-600">수습만료일</th>
                      <th className="px-4 py-2 sm:px-4 sm:py-3 text-center font-semibold text-slate-600">비고</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees
                      .sort((a, b) => new Date(b.hireDate).getTime() - new Date(a.hireDate).getTime())
                      .slice(0, 5)
                      .map((emp, idx) => {
                        const probationEndDate = calculateProbationEndDate(emp.hireDate);
                        const probationVal = getProbationStatus(emp);
                        return (
                          <tr key={`${emp.id}-${idx}`} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                            <td className="px-4 py-2 sm:px-4 sm:py-3 font-semibold text-slate-900">{emp.name}</td>
                            <td className="hidden sm:table-cell px-4 py-3 text-slate-500">{emp.hq}</td>
                            <td className="px-4 py-2 sm:px-4 sm:py-3 text-slate-500">{formatTeamName(emp.team)}</td>
                            <td className="px-4 py-2 sm:px-4 sm:py-3 text-slate-500">{formatRankName(emp.rank)}</td>
                            <td className="px-4 py-2 sm:px-4 sm:py-3 text-slate-500 font-mono text-xs">{emp.hireDate}</td>
                            <td className="hidden sm:table-cell px-4 py-3 text-slate-500 font-mono text-xs">{probationEndDate}</td>
                            <td className="px-4 py-2 sm:px-4 sm:py-3 text-center">
                              <select
                                className={cn(
                                  "border rounded px-1.5 py-0.5 text-[9px] sm:text-xs font-semibold focus:bg-white outline-none cursor-pointer",
                                  probationVal === '수습' 
                                    ? "bg-amber-50 text-amber-700 border-amber-200" 
                                    : "bg-emerald-50 text-emerald-700 border-emerald-200"
                                )}
                                value={probationVal}
                                onChange={(e) => handleProbationStatusChange(emp, e.target.value as any)}
                              >
                                <option value="수습">수습</option>
                                <option value="수습종료">수습종료</option>
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </div>
        )}

        {(activeTab === 'status' || activeTab === 'tenure' || activeTab === 'leaver' || activeTab === 'attendance') && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="dashboard-card"
          >
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full md:w-auto">
                <div className="flex items-center gap-2 shrink-0">
                  <h2 className="section-title mb-0">
                    {TABS.find(t => t.id === activeTab)?.label} 상세 목록
                  </h2>
                  {activeTab === 'status' && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100 shadow-sm shrink-0">
                      승진 대상: {employees.filter(e => e.status !== '퇴직' && getPromotionStatus(e) === '승진').length}명
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  <div className="relative flex-grow sm:flex-grow-0">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input
                      type="text"
                      placeholder="이름, 본부, 팀 검색"
                      className="pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-blue-500 w-full sm:w-64 focus:bg-white transition-all shadow-sm"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  {activeTab === 'status' && (
                    <select
                      value={promotionFilter}
                      onChange={(e) => setPromotionFilter(e.target.value as any)}
                      className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 outline-blue-500 focus:bg-white transition-all shadow-sm cursor-pointer"
                    >
                      <option value="all">승진여부: 전체</option>
                      <option value="promoted">승진 대상자</option>
                      <option value="none">미대상자</option>
                    </select>
                  )}
                  {activeTab === 'status' && (
                    <button 
                      onClick={handleResetAllStatus}
                      className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-500 px-2.5 py-1.5 rounded-lg border border-slate-200 transition-colors shadow-sm cursor-pointer shrink-0"
                    >
                      데이터 초기화
                    </button>
                  )}
                </div>
              </div>
              <span className="text-xs text-slate-400 font-mono shrink-0">검색 결과: {filteredEmployees.length}명</span>
            </div>
            <div className="overflow-x-auto no-scrollbar -mx-4 sm:mx-0 shadow-sm sm:shadow-none border sm:border-0 border-slate-100 rounded-xl sm:rounded-none">
              <table className="w-full text-[10px] sm:text-[13px] border-collapse min-w-full bg-white">
                <thead>
                  <tr className="border-b border-slate-100 text-left">
                    <th className="px-3 py-3 sm:px-5 sm:py-4 font-semibold text-slate-500 bg-slate-50/50 min-w-[70px]">성명</th>
                    <th className={cn(
                      "px-3 py-3 sm:px-5 sm:py-4 font-semibold text-slate-500 bg-slate-50/50",
                      "hidden md:table-cell"
                    )}>본부</th>
                    <th className={cn(
                      "px-3 py-3 sm:px-5 sm:py-4 font-semibold text-slate-500 bg-slate-50/50",
                      activeTab === 'attendance' ? "hidden sm:table-cell" : "table-cell"
                    )}>팀명</th>
                    <th className={cn(
                      "px-3 py-3 sm:px-5 sm:py-4 font-semibold text-slate-500 bg-slate-50/50",
                      activeTab === 'attendance' ? "hidden sm:table-cell" : "table-cell"
                    )}>직급</th>
                    {activeTab === 'status' && (
                      <th className="hidden sm:table-cell px-3 py-3 sm:px-5 sm:py-4 font-semibold text-slate-500 bg-slate-50/50">연차</th>
                    )}
                    {activeTab === 'tenure' && (
                      <th className="hidden sm:table-cell px-3 py-3 sm:px-5 sm:py-4 font-semibold text-slate-500 bg-slate-50/50">재직기간</th>
                    )}
                    {activeTab === 'status' && (
                      <>
                        <th className="hidden sm:table-cell px-3 py-3 sm:px-5 sm:py-4 font-semibold text-slate-500 bg-slate-50/50">형태</th>
                        <th className="hidden sm:table-cell px-3 py-3 sm:px-5 sm:py-4 font-semibold text-slate-500 bg-slate-50/50 text-center">승진 여부</th>
                        <th className="hidden sm:table-cell px-3 py-3 sm:px-5 sm:py-4 font-semibold text-slate-500 bg-slate-50/50">특이사항</th>
                      </>
                    )}
                    <th className={cn(
                      "px-3 py-3 sm:px-5 sm:py-4 font-semibold text-slate-500 bg-slate-50/50",
                      activeTab === 'attendance' ? "hidden lg:table-cell" : "hidden sm:table-cell"
                    )}>입사일</th>
                    {activeTab === 'attendance' ? (
                      <>
                        <th className="px-3 py-3 sm:px-5 sm:py-4 font-semibold text-slate-500 bg-slate-50/50 text-center">발생</th>
                        <th className="px-3 py-3 sm:px-5 sm:py-4 font-semibold text-slate-500 bg-slate-50/50 text-center">사용</th>
                        <th className="px-3 py-3 sm:px-5 sm:py-4 font-semibold text-slate-500 bg-slate-50/50 text-center">잔여</th>
                      </>
                    ) : (
                      <th className="px-3 py-3 sm:px-5 sm:py-4 font-semibold text-slate-500 bg-slate-50/50 text-center">상태</th>
                    )}
                    <th className="px-3 py-3 sm:px-5 sm:py-4 font-semibold text-slate-500 bg-slate-50/50 text-right">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees
                    .sort((a, b) => {
                      if (a.team !== b.team) return a.team.localeCompare(b.team);
                      if (activeTab !== 'attendance') {
                        const rankPriority: Record<string, number> = {
                          '대표이사': 0, '전무이사': 1, '전무': 1, '상무이사': 2, '상무': 2, '이사': 3,
                          '센터장': 4, '수석매니저': 5, '책임매니저': 6, '선임매니저': 7, '매니저': 8
                        };
                        const getPrio = (r: string) => {
                          if (rankPriority[r] !== undefined) return rankPriority[r];
                          if (r.includes('(직영)')) return 10;
                          return 100;
                        };
                        return getPrio(a.rank) - getPrio(b.rank);
                      }
                      return 0;
                    })
                    .map((emp, idx) => {
                      const isPromoted = activeTab === 'status' && getPromotionStatus(emp) === '승진';
                      return (
                        <tr 
                          key={`${emp.id}-${idx}`} 
                          className={`border-b border-slate-50 transition-colors group ${
                            isPromoted 
                              ? "bg-blue-50/30 hover:bg-blue-50/50" 
                              : "hover:bg-slate-50/50"
                          }`}
                        >
                      <td className="px-3 py-3 sm:px-5 sm:py-4 font-bold text-slate-900 min-w-[70px] text-[11px] sm:text-[14px]">
                        <div className="flex items-center gap-1.5">
                          {editingId === emp.id ? (
                            <input 
                              className="border border-slate-200 rounded px-1 py-0.5 w-12 sm:w-24 outline-blue-500 focus:bg-white text-[10px] sm:text-sm"
                              value={editValues.name || emp.name}
                              onChange={(e) => setEditValues({ ...editValues, name: e.target.value })}
                            />
                          ) : (
                            <>
                              <span>{emp.name}</span>
                              {isPromoted && (
                                <span className="inline-flex items-center justify-center bg-blue-50 text-blue-600 border border-blue-100 text-[9px] px-1.5 py-0.5 rounded-full font-bold shrink-0">
                                  ★ 대상
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                      <td className={cn(
                        "px-3 py-3 sm:px-5 sm:py-4 text-slate-500",
                        "hidden md:table-cell"
                      )}>
                        {editingId === emp.id ? (
                          <input 
                            className="border border-slate-200 rounded px-1 py-0.5 outline-blue-500 focus:bg-white text-[10px] sm:text-sm"
                            value={editValues.hq || emp.hq}
                            onChange={(e) => setEditValues({ ...editValues, hq: e.target.value })}
                          />
                        ) : emp.hq}
                      </td>
                      <td className={cn(
                        "px-3 py-3 sm:px-5 sm:py-4 text-slate-500",
                        activeTab === 'attendance' ? "hidden sm:table-cell" : "table-cell"
                      )}>
                        {editingId === emp.id ? (
                          <input 
                            className="border border-slate-200 rounded px-1 py-0.5 outline-blue-500 focus:bg-white text-[10px] sm:text-sm"
                            value={editValues.team || emp.team}
                            onChange={(e) => setEditValues({ ...editValues, team: e.target.value })}
                          />
                        ) : formatTeamName(emp.team)}
                      </td>
                      <td className={cn(
                        "px-3 py-3 sm:px-5 sm:py-4 text-slate-500",
                        activeTab === 'attendance' ? "hidden sm:table-cell" : "table-cell"
                      )}>
                        {editingId === emp.id ? (
                          <input 
                            className="border border-slate-200 rounded px-1 py-0.5 outline-blue-500 w-12 sm:w-24 focus:bg-white text-[10px] sm:text-sm"
                            value={editValues.rank || emp.rank}
                            onChange={(e) => setEditValues({ ...editValues, rank: e.target.value })}
                          />
                        ) : formatRankName(emp.rank)}
                      </td>
                      {activeTab === 'status' && (
                        <td className="hidden sm:table-cell px-3 py-3 sm:px-5 sm:py-4 text-slate-500 font-semibold font-mono text-xs">
                          {formatTenureYear(emp.yearsInRank)}
                        </td>
                      )}
                      {activeTab === 'tenure' && (
                        <td className="hidden sm:table-cell px-3 py-3 sm:px-5 sm:py-4 text-slate-500 font-medium font-mono text-xs">
                          {formatDuration(emp.duration)}
                        </td>
                      )}
                      {activeTab === 'status' && (
                        <td className="hidden sm:table-cell px-3 py-3 sm:px-5 sm:py-4 text-slate-500">
                          {editingId === emp.id ? (
                            <select
                              className="border border-slate-200 rounded px-1 py-0.5 outline-blue-500 text-[10px] sm:text-xs font-semibold focus:bg-white"
                              value={editValues.employmentType || emp.employmentType}
                              onChange={(e) => setEditValues({ ...editValues, employmentType: e.target.value as any })}
                            >
                              <option value="상용직">상용직</option>
                              <option value="계약직">계약직</option>
                            </select>
                          ) : (
                            emp.employmentType || '상용직'
                          )}
                        </td>
                      )}
                      {activeTab === 'status' && (
                        <td className="hidden sm:table-cell px-3 py-3 sm:px-5 sm:py-4 text-center">
                          <select
                            className={`border rounded px-1.5 py-0.5 text-[9px] sm:text-xs font-semibold focus:bg-white outline-none cursor-pointer ${
                              getPromotionStatus(emp) === '승진'
                                ? "bg-blue-50 text-blue-700 border-blue-200"
                                : "bg-slate-50 text-slate-600 border-slate-200"
                            }`}
                            value={getPromotionStatus(emp)}
                            onChange={(e) => handlePromotionStatusChange(emp, e.target.value as any)}
                          >
                            <option value="승진">승진</option>
                            <option value="미대상">미대상</option>
                          </select>
                        </td>
                      )}
                      {activeTab === 'status' && (
                        <td className="hidden sm:table-cell px-3 py-3 sm:px-5 sm:py-4">
                          {editingId === emp.id ? (
                            <div className="flex flex-col gap-1.5 min-w-[130px]">
                              <select
                                className="border border-slate-200 rounded px-1.5 py-0.5 outline-blue-500 text-[10px] sm:text-xs font-semibold focus:bg-white cursor-pointer"
                                value={editValues.remarksType || emp.remarksType || '선택 없음'}
                                onChange={(e) => setEditValues({ ...editValues, remarksType: e.target.value as any })}
                              >
                                <option value="선택 없음">선택 없음</option>
                                <option value="출산휴가">출산휴가</option>
                                <option value="육아휴직">육아휴직</option>
                                <option value="기타">기타</option>
                              </select>
                              <input
                                className="border border-slate-200 rounded px-1.5 py-0.5 outline-blue-500 focus:bg-white text-[10px] sm:text-xs w-full"
                                value={editValues.remarksMemo ?? emp.remarksMemo ?? ''}
                                onChange={(e) => setEditValues({ ...editValues, remarksMemo: e.target.value })}
                                placeholder="메모 입력"
                              />
                            </div>
                          ) : (
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 text-xs text-slate-700">
                              {emp.remarksType && emp.remarksType !== '선택 없음' && (
                                <span className={cn(
                                  "inline-flex items-center px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold border shrink-0",
                                  emp.remarksType === '출산휴가' ? "bg-rose-50 text-rose-700 border-rose-200" :
                                  emp.remarksType === '육아휴직' ? "bg-purple-50 text-purple-700 border-purple-200" :
                                  "bg-slate-100 text-slate-700 border-slate-200"
                                )}>
                                  {emp.remarksType}
                                </span>
                              )}
                              {emp.remarksMemo ? (
                                <span className="font-medium text-slate-600 truncate max-w-[120px] sm:max-w-[160px]" title={emp.remarksMemo}>
                                  {emp.remarksMemo}
                                </span>
                              ) : (
                                (!emp.remarksType || emp.remarksType === '선택 없음') && <span className="text-slate-400">-</span>
                              )}
                            </div>
                          )}
                        </td>
                      )}
                      <td className={cn(
                        "px-3 py-3 sm:px-5 sm:py-4 text-slate-400 font-malgun text-[9px] sm:text-xs font-semibold",
                        activeTab === 'attendance' ? "hidden lg:table-cell" : "hidden sm:table-cell"
                      )}>{emp.hireDate}</td>
                      {activeTab === 'attendance' ? (
                        <>
                          <td className="px-3 py-3 sm:px-5 sm:py-4 text-center">
                            {editingId === emp.id ? (
                              <input 
                                type="number"
                                className="border border-slate-200 rounded px-1 py-0.5 w-8 sm:w-16 text-center text-[10px] sm:text-sm"
                                value={editValues.totalLeave ?? emp.totalLeave}
                                onChange={(e) => setEditValues({ ...editValues, totalLeave: parseFloat(e.target.value) })}
                              />
                            ) : (emp.totalLeave || 0)}
                          </td>
                          <td className="px-3 py-3 sm:px-5 sm:py-4 text-center text-rose-500 font-medium">
                            {editingId === emp.id ? (
                              <input 
                                type="number"
                                className="border border-slate-200 rounded px-1 py-0.5 w-8 sm:w-16 text-center text-[10px] sm:text-sm"
                                value={editValues.usedLeave ?? emp.usedLeave}
                                onChange={(e) => setEditValues({ ...editValues, usedLeave: parseFloat(e.target.value) })}
                              />
                            ) : (emp.usedLeave || 0)}
                          </td>
                          <td className="px-3 py-3 sm:px-5 sm:py-4 text-center text-blue-600 font-bold">
                             {(editingId === emp.id) ? (
                               (editValues.totalLeave ?? emp.totalLeave ?? 0) - (editValues.usedLeave ?? emp.usedLeave ?? 0)
                             ) : (emp.remainingLeave || 0)}
                          </td>
                        </>
                      ) : (
                        <td className="px-3 py-3 sm:px-5 sm:py-4 text-center">
                          {editingId === emp.id ? (
                            <select
                              className="border border-slate-200 rounded px-1 py-0.5 outline-blue-500 text-[10px] sm:text-xs font-semibold focus:bg-white"
                              value={editValues.status || emp.status}
                              onChange={(e) => setEditValues({ ...editValues, status: e.target.value as EmploymentStatus })}
                            >
                              <option value="재직">재직</option>
                              <option value="휴직">휴직</option>
                              <option value="퇴직">퇴직</option>
                            </select>
                          ) : (
                            <span className={cn(
                              "inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] sm:text-[11px] font-semibold",
                              emp.status === '재직' ? "bg-emerald-50 text-emerald-700" : 
                              emp.status === '퇴직' ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"
                            )}>
                              {emp.status}
                            </span>
                          )}
                        </td>
                      )}
                      <td className="px-3 py-3 sm:px-5 sm:py-4 text-right">
                        {editingId === emp.id ? (
                          <div className="flex justify-end gap-1">
                             <button 
                              onClick={() => handleSaveEdit(emp.id)}
                              className="text-white hover:bg-blue-700 p-1 sm:p-1.5 bg-blue-600 rounded-lg shadow-sm"
                            >
                              <Save size={10} className="sm:w-[14px] sm:h-[14px]" />
                            </button>
                            <button 
                              onClick={() => setEditingId(null)}
                              className="text-slate-400 hover:text-slate-600 p-1 sm:p-1.5 bg-slate-100 rounded-lg text-[9px] sm:text-xs"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => {
                                setEditingId(emp.id);
                                setEditValues(emp);
                              }}
                              className="text-[10px] sm:text-xs text-blue-500 sm:text-slate-400 hover:text-blue-600 underline font-medium"
                            >
                              수정
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {activeTab === 'hiring' && (
          <div className="space-y-6">
            {/* Hiring Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="dashboard-card flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">전체 채용 인원</p>
                  <h3 className="text-2xl font-bold text-slate-800 mt-1">
                    {employees.filter(e => e.status !== '퇴직').length}명
                  </h3>
                </div>
                <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                  <Users size={20} />
                </div>
              </div>
              <div className="dashboard-card flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">수습 진행 중</p>
                  <h3 className="text-2xl font-bold text-amber-600 mt-1">
                    {employees.filter(e => e.status !== '퇴직' && getProbationStatus(e) === '수습').length}명
                  </h3>
                </div>
                <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                  <Clock size={20} />
                </div>
              </div>
              <div className="dashboard-card flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">수습 종료</p>
                  <h3 className="text-2xl font-bold text-emerald-600 mt-1">
                    {employees.filter(e => e.status !== '퇴직' && getProbationStatus(e) === '수습종료').length}명
                  </h3>
                </div>
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                  <Target size={20} />
                </div>
              </div>
            </div>

            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="dashboard-card"
            >
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <h2 className="section-title mb-0">채용현황 상세 목록</h2>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input
                      type="text"
                      placeholder="이름, 본부, 팀 검색"
                      className="pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-blue-500 w-full sm:w-64 focus:bg-white transition-all shadow-sm"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
                <span className="text-xs text-slate-400 font-mono">신규 입사자 순 정렬 · 검색 결과: {filteredEmployees.length}명</span>
              </div>
              
              <div className="overflow-x-auto no-scrollbar -mx-4 sm:mx-0 shadow-sm sm:shadow-none border sm:border-0 border-slate-100 rounded-xl sm:rounded-none">
                <table className="w-full text-[11px] sm:text-sm border-collapse min-w-full bg-white">
                  <thead>
                    <tr className="border-b border-slate-100 text-left">
                      <th className="px-3 py-3 sm:px-5 sm:py-4 font-semibold text-slate-500 bg-slate-50/50 min-w-[70px]">성명</th>
                      <th className="hidden md:table-cell px-3 py-3 sm:px-5 sm:py-4 font-semibold text-slate-500 bg-slate-50/50">본부</th>
                      <th className="px-3 py-3 sm:px-5 sm:py-4 font-semibold text-slate-500 bg-slate-50/50">팀명</th>
                      <th className="px-3 py-3 sm:px-5 sm:py-4 font-semibold text-slate-500 bg-slate-50/50">직급</th>
                      <th className="px-3 py-3 sm:px-5 sm:py-4 font-semibold text-slate-500 bg-slate-50/50">입사일</th>
                      <th className="hidden md:table-cell px-3 py-3 sm:px-5 sm:py-4 font-semibold text-slate-500 bg-slate-50/50">수습만료일</th>
                      <th className="px-3 py-3 sm:px-5 sm:py-4 font-semibold text-slate-500 bg-slate-50/50 text-center">비고</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEmployees
                      .sort((a, b) => new Date(b.hireDate).getTime() - new Date(a.hireDate).getTime())
                      .map((emp, idx) => {
                        const probationEndDate = calculateProbationEndDate(emp.hireDate);
                        const probationVal = getProbationStatus(emp);
                        return (
                          <tr key={`${emp.id}-${idx}`} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                            <td className="px-3 py-3 sm:px-5 sm:py-4 font-semibold text-slate-900">{emp.name}</td>
                            <td className="hidden md:table-cell px-3 py-3 sm:px-5 sm:py-4 text-slate-500">{emp.hq}</td>
                            <td className="px-3 py-3 sm:px-5 sm:py-4 text-slate-500">{formatTeamName(emp.team)}</td>
                            <td className="px-3 py-3 sm:px-5 sm:py-4 text-slate-500">{formatRankName(emp.rank)}</td>
                            <td className="px-3 py-3 sm:px-5 sm:py-4 text-slate-500 font-mono text-xs">{emp.hireDate}</td>
                            <td className="hidden md:table-cell px-3 py-3 sm:px-5 sm:py-4 text-slate-500 font-mono text-xs">{probationEndDate}</td>
                            <td className="px-3 py-3 sm:px-5 sm:py-4 text-center">
                              <select
                                className={cn(
                                  "border rounded px-1.5 py-0.5 text-[9px] sm:text-xs font-semibold focus:bg-white outline-none cursor-pointer",
                                  probationVal === '수습' 
                                    ? "bg-amber-50 text-amber-700 border-amber-200" 
                                    : "bg-emerald-50 text-emerald-700 border-emerald-200"
                                )}
                                value={probationVal}
                                onChange={(e) => handleProbationStatusChange(emp, e.target.value as any)}
                              >
                                <option value="수습">수습</option>
                                <option value="수습종료">수습종료</option>
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </div>
        )}

        {activeTab === 'org' && (
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 sm:p-8">
            <div className="w-full space-y-8">
              {/* Top: Organizational Tree */}
              <div className="dashboard-card overflow-hidden hidden sm:block">
                <h3 className="section-title">조직도</h3>
                <div className="bg-slate-50/50 rounded-xl border border-slate-100/50">
                  <OrganizationalTree data={employees} />
                </div>
              </div>

              {/* Bottom: Two columns Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="dashboard-card">
                  <h3 className="section-title">조직별 인원 현황 (본사/센터 통합)</h3>
                  <OrganizationChart data={employees} />
                </div>
                <div className="dashboard-card">
                  <h3 className="section-title">직급 구성비</h3>
                  <RankChart data={employees} />
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="mt-12 flex flex-col sm:flex-row items-center justify-between py-6 border-t border-slate-100 gap-4">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Sync Active</span>
          </div>
          <a 
            href={`https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}`}
            target="_blank" 
            rel="noreferrer"
            className="text-xs text-slate-400 hover:text-blue-600 transition-colors underline decoration-slate-200"
          >
            원본 시트 열기
          </a>
        </div>
        <p className="text-xs text-slate-300 font-medium">
          © 2026 People Dashboard · Real-time Sheets Integration
        </p>
      </footer>
    </div>
  );
};
