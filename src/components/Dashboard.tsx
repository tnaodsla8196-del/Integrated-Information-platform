// Refreshed build: 2026-06-15 Filter out retired employees from dashboard and sync metrics
import { 
  Users, Target, UserMinus, UserPlus, Clock, Calendar, Clipboard,
  TrendingUp, RefreshCcw, ChevronRight, Loader2, Save, Search, Download, BarChart3, CheckSquare, Square
} from 'lucide-react';
import { motion } from 'motion/react';
import { StatCard, StatCardProps } from './StatCard';
import { OrganizationChart, RankChart, OrganizationalTree, TenureDistributionChart, YearlyMonthlyFlowChart, FlowChartItem } from './Charts';
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
  { id: 'leaver', label: '입/퇴사자 현황', icon: UserMinus },
  { id: 'expected-leaver', label: '퇴사예정', icon: Clipboard },
  { id: 'org', label: '조직/직급', icon: TrendingUp },
  { id: 'attendance', label: '근태/연차', icon: Clock },
];

const parseYearMonth = (dateStr?: string): { year: number; month: number } | null => {
  if (!dateStr) return null;
  const trimmed = dateStr.trim();
  const match = trimmed.match(/^(\d{4})[\/.\-](\d{1,2})/);
  if (match) {
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    if (!isNaN(year) && !isNaN(month) && month >= 1 && month <= 12) {
      return { year, month };
    }
  }
  const normalized = trimmed.replace(/\./g, '/');
  const d = new Date(normalized);
  if (isNaN(d.getTime())) return null;
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
};

const SPREADSHEET_ID = '1kHoQPjudplszOtD39wnZHMHGAaEghTNkVuqNjNQf37o';

const calculateProbationEndDate = (hireDateStr: string, probationVal?: string): string => {
  if (probationVal === '수습없음') return '-';
  if (!hireDateStr) return '';
  const date = new Date(hireDateStr.replace(/\./g, '/'));
  if (isNaN(date.getTime())) return '';
  date.setMonth(date.getMonth() + 3);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}/${mm}/${dd}`;
};

const getProbationStatus = (emp: Employee): '수습' | '수습종료' | '수습없음' => {
  if (emp.probationStatus) return emp.probationStatus;
  if (!emp.hireDate) return '수습종료';
  
  const hireDate = new Date(emp.hireDate.replace(/\./g, '/'));
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
  return durationStr;
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

const getPromotionStatus = (emp: Employee): '대상' | '제외' | '완료' | '미대상' => {
  let status = emp.promotionStatus;
  if (status === '승진') status = '대상'; // Legacy migration
  if (status) return status as any;
  
  const years = getYearsFromPColumn(emp.yearsInRank);
  const rank = emp.rank || '';
  
  if (rank.includes('수석매니저') || rank.includes('센터장') || rank.includes('부센터장')) {
    return '미대상';
  }
  if (rank.includes('책임매니저')) {
    return years >= 6 ? '대상' : '미대상';
  }
  if (rank.includes('선임매니저')) {
    return years >= 6 ? '대상' : '미대상';
  }
  if (rank.includes('매니저')) {
    return years >= 3 ? '대상' : '미대상';
  }
  return '미대상';
};

const calculateLeaveByHireDate = (hireDateStr: string, today: Date = new Date()): number => {
  if (!hireDateStr) return 0;
  const hireDate = new Date(hireDateStr.replace(/\./g, '/'));
  if (isNaN(hireDate.getTime())) return 0;

  // Calculate difference in months
  const diffTime = today.getTime() - hireDate.getTime();
  if (diffTime < 0) return 0;

  const diffYears = diffTime / (1000 * 60 * 60 * 24 * 365.25);
  
  if (diffYears < 1) {
    // Under 1 year: 1 day per completed month of service, max 11 days
    const diffMonths = (today.getFullYear() - hireDate.getFullYear()) * 12 + today.getMonth() - hireDate.getMonth();
    const dayAdjust = today.getDate() < hireDate.getDate() ? -1 : 0;
    const completedMonths = Math.max(0, diffMonths + dayAdjust);
    return Math.min(11, completedMonths);
  } else {
    // 1 year or more: 15 days + 1 day per 2 years after the 1st year (max 25)
    const completedYears = Math.floor(diffYears);
    const generated = 15 + Math.floor((completedYears - 1) / 2);
    return Math.min(25, generated);
  }
};

const calculateLeaveByFiscalYear = (hireDateStr: string, today: Date = new Date()): number => {
  if (!hireDateStr) return 0;
  const hireDate = new Date(hireDateStr.replace(/\./g, '/'));
  if (isNaN(hireDate.getTime())) return 0;

  const currentYear = today.getFullYear();
  const hireYear = hireDate.getFullYear();

  if (currentYear < hireYear) return 0;

  if (currentYear === hireYear) {
    // Hired in the current year: 1 day per completed month of service, up to 11 days
    const diffMonths = (today.getFullYear() - hireDate.getFullYear()) * 12 + today.getMonth() - hireDate.getMonth();
    const dayAdjust = today.getDate() < hireDate.getDate() ? -1 : 0;
    const completedMonths = Math.max(0, diffMonths + dayAdjust);
    return Math.min(11, completedMonths);
  } else if (currentYear === hireYear + 1) {
    // First January 1st after hiring: prorated portion of 15 days
    const monthsWorkedInFirstYear = 12 - hireDate.getMonth();
    const prorated = 15 * (monthsWorkedInFirstYear / 12);
    return parseFloat(prorated.toFixed(1));
  } else {
    // Subsequent January 1sts: full annual leave based on fiscal years of service
    const fiscalYears = currentYear - hireYear;
    const generated = 15 + Math.floor((fiscalYears - 1) / 2);
    return Math.min(25, generated);
  }
};

// 2025년 입사자별 2026년 부여 연차 (1년 미만 11일 + 2026년 회계연도 비례연차 - 2025년 기사용 연차)
// 고범희(NF230702) 등 퇴직자는 구글 시트 원본 데이터 유지
const LEAVE_GENERATED_2025: Record<string, number> = {
  'NF250101': 17,    // 김종민: 26 - 9 = 17
  'NF250102': 19.5,  // 민경기: 26 - 6.5 = 19.5
  'NF250201': 15.5,  // 전지민: 25 - 9.5 = 15.5
  'NF250303': 14,    // 조영도: 23 - 9 = 14
  'NF250401': 16,    // 이재웅: 23 - 7 = 16
  'NF250501': 14,    // 정경화: 21 - 7 = 14
  'NT250501': 21,    // 박선후: 21 - 0 = 21
  'NF250601': 19,    // 김성국: 20 - 1 = 19
  'NF250602': 15,    // 장명훈: 20 - 5 = 15
  'NF250701': 15.5,  // 박상율: 19 - 3.5 = 15.5
  'NF250801': 14.5,  // 김성진: (11 - 2.5) + 6 = 14.5 (2025년 사용 2.5, 이월 1.5)
  'NF251001': 13,    // 김선현: 15 - 2 = 13 (기존 9 -> 13 정정)
  'NF251003': 14,    // 김지우: 15 - 1 = 14 (기존 9 -> 14 정정)
};

const calculateGeneratedLeave = (hireDateStr: string, sheetTotalLeave: number, today: Date = new Date(), empId?: string): number => {
  if (!hireDateStr) return sheetTotalLeave;
  
  const normalizedDateStr = hireDateStr.replace(/\./g, '/');
  const hireDate = new Date(normalizedDateStr);
  if (isNaN(hireDate.getTime())) return sheetTotalLeave;

  const hireYear = hireDate.getFullYear();

  const diffYears = today.getFullYear() - hireDate.getFullYear();
  const diffMonths = diffYears * 12 + today.getMonth() - hireDate.getMonth();
  const dayAdjust = today.getDate() < hireDate.getDate() ? -1 : 0;
  const completedMonths = Math.max(0, diffMonths + dayAdjust);

  // 1. 2026년도 입사자: 1개월 만근 시마다 +1일 (최대 11일)
  if (hireYear === 2026) {
    return Math.min(11, completedMonths);
  }

  // 2. 2025년도 입사자: (1년 미만 11일 + 2026년 회계연도 비례연차) - 2025년 기사용 연차
  if (hireYear === 2025 && empId) {
    const customLeave = LEAVE_GENERATED_2025[empId.toUpperCase()];
    if (customLeave !== undefined) {
      return customLeave;
    }
  }

  // 2024년도 및 그 전 입사자: 구글 시트 값 그대로 사용 (회계연도 비례정산 등 반영을 위함)
  return sheetTotalLeave;
};

const isFutureDate = (dateStr?: string): boolean => {
  if (!dateStr) return false;
  const normalizedDateStr = dateStr.replace(/\./g, '/').trim();
  const date = new Date(normalizedDateStr);
  if (isNaN(date.getTime())) return false;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return date > today;
};

export const Dashboard = ({ token }: DashboardProps) => {
  const { tabId } = useParams();
  const navigate = useNavigate();
  const rawTab = tabId || 'dashboard';
  // Redirect legacy 'tenure' and 'hiring' tabs into the unified 'status' tab
  const activeTab = rawTab === 'tenure' || rawTab === 'hiring' ? 'status' : rawTab;
  const now = new Date();
  
  const [employees, setEmployees] = useState<Employee[]>([]);
  
  const getErrorMessage = (err: any) => {
    if (!err) return 'Unknown error';
    if (typeof err === 'object') {
      return err.message || JSON.stringify(err);
    }
    return String(err);
  };
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedTime, setLastSyncedTime] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<Employee>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [promotionFilter, setPromotionFilter] = useState<'all' | '대상' | '제외' | '완료' | '미대상'>('all');
  const [probationFilter, setProbationFilter] = useState<'all' | '수습' | '수습종료' | '수습없음'>('all');
  const [statusViewMode, setStatusViewMode] = useState<'all' | 'hr' | 'tenure-hiring'>('all');
  const [showStatusTenureChart, setShowStatusTenureChart] = useState(false);
  const [attendanceStatusFilter, setAttendanceStatusFilter] = useState<'all' | 'active' | 'retired'>('active');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  // 입/퇴사자 현황 탭 전용 상태
  const [flowMode, setFlowMode] = useState<'hires' | 'leavers'>('hires');
  const [includeLeaversInHires, setIncludeLeaversInHires] = useState<boolean>(true);
  const [selectedFlowYear, setSelectedFlowYear] = useState<string>(String(now.getFullYear()));
  const [selectedFlowMonth, setSelectedFlowMonth] = useState<number | 'all'>('all');
  const [flowHqFilter, setFlowHqFilter] = useState<string>('all');
  const [flowProbationFilter, setFlowProbationFilter] = useState<'all' | '수습' | '수습종료' | '수습없음'>('all');

  useEffect(() => {
    if (rawTab === 'tenure' || rawTab === 'hiring') {
      navigate('/status', { replace: true });
    }
  }, [rawTab, navigate]);

  useEffect(() => {
    setSortConfig(null);
  }, [activeTab, flowMode]);

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const renderSortableHeader = (label: string, key: string, alignment: 'left' | 'center' | 'right' = 'left', className = '') => {
    const isSorted = sortConfig && sortConfig.key === key;
    const direction = isSorted ? sortConfig.direction : null;
    
    return (
      <th 
        onClick={() => requestSort(key)}
        className={cn(
          "px-2.5 py-3 sm:px-4 sm:py-3.5 font-semibold text-slate-500 bg-slate-50/50 cursor-pointer hover:bg-slate-100/70 hover:text-slate-700 transition-colors select-none whitespace-nowrap",
          alignment === 'center' && "text-center",
          alignment === 'right' && "text-right",
          className
        )}
      >
        <div className={cn(
          "inline-flex items-center gap-1 whitespace-nowrap",
          alignment === 'center' && "justify-center",
          alignment === 'right' && "justify-end"
        )}>
          <span>{label}</span>
          <span className="text-[10px] text-slate-400 font-mono">
            {direction === 'asc' ? '▲' : direction === 'desc' ? '▼' : '⇅'}
          </span>
        </div>
      </th>
    );
  };

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

  const handleProbationStatusChange = async (emp: Employee, newStatus: '수습' | '수습종료' | '수습없음') => {
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
      console.warn('Probation update error:', err);
    }
  };

  const handlePromotionStatusChange = async (emp: Employee, newStatus: '대상' | '제외' | '완료' | '미대상') => {
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
      alert('업데이트 실패: ' + getErrorMessage(err));
      loadData();
    }
  };

  const activeCount = employees.filter(e => e.status !== '퇴직').length;
  const thisMonthHires = employees.filter(e => {
    const hireDate = new Date(e.hireDate);
    return hireDate.getMonth() === now.getMonth() && hireDate.getFullYear() === now.getFullYear();
  }).length;
  
  const totalUsedLeave = employees.reduce((acc, e) => acc + (e.usedLeave || 0), 0);
  const totalTotalLeave = employees.reduce((acc, e) => acc + (e.totalLeave || 0), 0);
  const leaveUsageRate = Math.round((totalUsedLeave / (totalTotalLeave || 1)) * 100);

  const activeEmployees = employees.filter(e => e.status !== '퇴직');
  const totalTenureYears = activeEmployees.reduce((acc, e) => acc + getYearsOfService(e.hireDate), 0);
  const averageTenure = activeEmployees.length > 0 
    ? parseFloat((totalTenureYears / activeEmployees.length).toFixed(1)) 
    : 0;

  const stats: StatCardProps[] = [
    { title: '전체 인원', value: activeCount, unit: '명', trend: { label: '전월 대비', value: 0, isUp: true } },
    { title: '이번 달 입사', value: thisMonthHires, unit: '명', footer: { label: '이번 달 누적', value: `${thisMonthHires}건` } },
    { title: '이번 달 퇴사', value: employees.filter(e => e.status === '퇴직').length, unit: '명', trend: { label: 'YTD', value: 0, isUp: false } },
    { title: '평균 근속', value: averageTenure, unit: '년' },
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
      alert('업데이트 실패: ' + getErrorMessage(err));
      loadData();
    }
  };

  const handleSaveEdit = async (id: string) => {
    const index = employees.findIndex(e => e.id === id);
    if (index === -1) return;

    const used = editValues.usedLeave ?? employees[index].usedLeave ?? 0;
    const total = calculateGeneratedLeave(employees[index].hireDate, employees[index].totalLeave, new Date(), employees[index].id);
    const remaining = total - used;

    const updatedEmployee = { 
      ...employees[index], 
      ...editValues,
      totalLeave: total,
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
      alert('업데이트 실패: ' + getErrorMessage(err));
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
      alert('초기화 실패: ' + getErrorMessage(err));
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
    if (activeTab === 'expected-leaver' && !(e.status === '재직' && isFutureDate(e.resignationDate))) return false;
    if (activeTab === 'status' && e.status === '퇴직') return false;
    if (activeTab === 'attendance') {
      if (attendanceStatusFilter === 'active' && e.status === '퇴직') return false;
      if (attendanceStatusFilter === 'retired' && e.status !== '퇴직') return false;
    }
    
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
    
    // Promotion filter (applicable for status tab)
    if (activeTab === 'status' && promotionFilter !== 'all') {
      const promoStatus = getPromotionStatus(e);
      if (promoStatus !== promotionFilter) return false;
    }

    // Probation filter (applicable for status tab)
    if (activeTab === 'status' && probationFilter !== 'all') {
      const probStatus = getProbationStatus(e);
      if (probStatus !== probationFilter) return false;
    }
    
    return true;
  });

  // ============================================================================
  // 입/퇴사자 현황 (flowMode: 'hires' | 'leavers') 연도별 · 월별 데이터 집계
  // ============================================================================
  const hqOptions = Array.from(new Set(employees.map(e => e.hq).filter(Boolean))).sort();

  // 연도 목록 추출 (입사자 모드: 입사일 기준 / 퇴사자 모드: 퇴사일 기준)
  const availableFlowYears = (() => {
    const yearSet = new Set<number>([now.getFullYear()]);
    employees.forEach(e => {
      if (flowMode === 'hires') {
        const ym = parseYearMonth(e.hireDate);
        if (ym && ym.year >= 2000 && ym.year <= 2100) yearSet.add(ym.year);
      } else {
        if (e.status === '퇴직') {
          const ym = parseYearMonth(e.resignationDate);
          if (ym && ym.year >= 2000 && ym.year <= 2100) yearSet.add(ym.year);
        }
      }
    });
    return Array.from(yearSet).sort((a, b) => b - a).map(String);
  })();

  // 특정 연도의 입사자/퇴사자 카운트 계산 (연도 버튼 표시용)
  const getYearCounts = (yearStr: string) => {
    if (flowMode === 'hires') {
      const matchingAll = employees.filter(e => {
        if (flowHqFilter !== 'all' && e.hq !== flowHqFilter) return false;
        const ym = parseYearMonth(e.hireDate);
        if (!ym) return false;
        return yearStr === 'all' ? true : String(ym.year) === yearStr;
      });
      const activeCnt = matchingAll.filter(e => e.status !== '퇴직').length;
      const retiredCnt = matchingAll.filter(e => e.status === '퇴직').length;
      return {
        display: includeLeaversInHires ? matchingAll.length : activeCnt,
        totalAll: matchingAll.length,
        activeCnt,
        retiredCnt,
      };
    } else {
      const matchingLeavers = employees.filter(e => {
        if (e.status !== '퇴직') return false;
        if (flowHqFilter !== 'all' && e.hq !== flowHqFilter) return false;
        const ym = parseYearMonth(e.resignationDate);
        if (yearStr === 'all') return true;
        return ym ? String(ym.year) === yearStr : false;
      });
      return {
        display: matchingLeavers.length,
        totalAll: matchingLeavers.length,
        activeCnt: 0,
        retiredCnt: matchingLeavers.length,
      };
    }
  };

  // 현재 선택된 연도(selectedFlowYear) 기준 대상 코호트
  const selectedYearStats = getYearCounts(selectedFlowYear);

  // 1월 ~ 12월 월별 집계 데이터
  const monthlyFlowData: FlowChartItem[] = Array.from({ length: 12 }, (_, idx) => {
    const m = idx + 1;
    if (flowMode === 'hires') {
      const monthAll = employees.filter(e => {
        if (flowHqFilter !== 'all' && e.hq !== flowHqFilter) return false;
        const ym = parseYearMonth(e.hireDate);
        if (!ym) return false;
        if (selectedFlowYear !== 'all' && String(ym.year) !== selectedFlowYear) return false;
        return ym.month === m;
      });
      const activeCount = monthAll.filter(e => e.status !== '퇴직').length;
      const retiredCount = monthAll.filter(e => e.status === '퇴직').length;
      const total = includeLeaversInHires ? monthAll.length : activeCount;
      return {
        label: `${m}월`,
        key: m,
        total,
        activeCount,
        retiredCount,
      };
    } else {
      const monthLeavers = employees.filter(e => {
        if (e.status !== '퇴직') return false;
        if (flowHqFilter !== 'all' && e.hq !== flowHqFilter) return false;
        const ym = parseYearMonth(e.resignationDate);
        if (!ym) return false;
        if (selectedFlowYear !== 'all' && String(ym.year) !== selectedFlowYear) return false;
        return ym.month === m;
      });
      return {
        label: `${m}월`,
        key: m,
        total: monthLeavers.length,
        activeCount: 0,
        retiredCount: monthLeavers.length,
      };
    }
  });

  // 입/퇴사자 상세 테이블용 최종 필터링 목록
  const flowFilteredEmployees = employees.filter(e => {
    if (flowHqFilter !== 'all' && e.hq !== flowHqFilter) return false;

    if (flowMode === 'hires') {
      // 중도퇴사자 포함 체크 해제 시 현재 퇴직 상태인 인원 제외
      if (!includeLeaversInHires && e.status === '퇴직') return false;
      const ym = parseYearMonth(e.hireDate);
      if (!ym) return false;
      if (selectedFlowYear !== 'all' && String(ym.year) !== selectedFlowYear) return false;
      if (selectedFlowMonth !== 'all' && ym.month !== selectedFlowMonth) return false;
      if (flowProbationFilter !== 'all' && getProbationStatus(e) !== flowProbationFilter) return false;
    } else {
      if (e.status !== '퇴직') return false;
      const ym = parseYearMonth(e.resignationDate);
      if (selectedFlowYear !== 'all') {
        if (!ym || String(ym.year) !== selectedFlowYear) return false;
      }
      if (selectedFlowMonth !== 'all') {
        if (!ym || ym.month !== selectedFlowMonth) return false;
      }
    }

    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      const matches =
        e.name.toLowerCase().includes(lowerSearch) ||
        e.hq.toLowerCase().includes(lowerSearch) ||
        (e.team || '').toLowerCase().includes(lowerSearch) ||
        (e.rank || '').toLowerCase().includes(lowerSearch);
      if (!matches) return false;
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
          <h1 
            onClick={() => navigate('/dashboard')}
            className="text-xl font-bold text-slate-900 tracking-tight cursor-pointer hover:text-blue-600 transition-colors inline-block"
          >
            HR Insight Dashboard
          </h1>
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
                <OrganizationChart data={employees.filter(e => e.status !== '퇴직')} />
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
                <RankChart data={employees.filter(e => e.status !== '퇴직')} />
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
                <table className="w-[500px] sm:w-full text-xs sm:text-sm border-collapse table-fixed sm:table-auto">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="w-[16%] sm:w-auto px-2 py-2 sm:px-4 sm:py-3 text-left font-semibold text-slate-600 text-xs sm:text-sm">성명</th>
                      <th className="hidden sm:table-cell px-4 py-3 text-left font-semibold text-slate-600 text-xs sm:text-sm">본부</th>
                      <th className="w-[26%] sm:w-auto px-2 py-2 sm:px-4 sm:py-3 text-left font-semibold text-slate-600 text-xs sm:text-sm">팀명</th>
                      <th className="w-[18%] sm:w-auto px-2 py-2 sm:px-4 sm:py-3 text-left font-semibold text-slate-600 text-xs sm:text-sm">직급</th>
                      <th className="w-[20%] sm:w-auto px-2 py-2 sm:px-4 sm:py-3 text-left font-semibold text-slate-600 text-xs sm:text-sm">입사일</th>
                      <th className="hidden sm:table-cell px-4 py-3 text-left font-semibold text-slate-600 text-xs sm:text-sm">수습만료일</th>
                      <th className="w-[20%] sm:w-auto px-2 py-2 sm:px-4 sm:py-3 text-center font-semibold text-slate-600 text-xs sm:text-sm">비고</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees
                      .filter(e => e.status !== '퇴직')
                      .sort((a, b) => new Date(b.hireDate).getTime() - new Date(a.hireDate).getTime())
                      .slice(0, 5)
                      .map((emp, idx) => {
                        const probationVal = getProbationStatus(emp);
                        const probationEndDate = calculateProbationEndDate(emp.hireDate, probationVal);
                        return (
                          <tr key={`${emp.id}-${idx}`} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                            <td className="px-2 py-2 sm:px-4 sm:py-3 font-semibold text-slate-900 truncate text-xs sm:text-sm">{emp.name}</td>
                            <td className="hidden sm:table-cell px-4 py-3 text-slate-500 text-xs sm:text-sm">{emp.hq}</td>
                            <td className="px-2 py-2 sm:px-4 sm:py-3 text-slate-500 truncate text-xs sm:text-sm">{formatTeamName(emp.team)}</td>
                            <td className="px-2 py-2 sm:px-4 sm:py-3 text-slate-500 truncate text-xs sm:text-sm">{formatRankName(emp.rank)}</td>
                            <td className="px-2 py-2 sm:px-4 sm:py-3 text-slate-500 font-semibold text-xs sm:text-sm truncate">{emp.hireDate}</td>
                            <td className="hidden sm:table-cell px-4 py-3 text-slate-500 font-semibold text-xs sm:text-sm">{probationEndDate}</td>
                            <td className="px-2 py-2 sm:px-4 sm:py-3 text-center">
                              <select
                                className={cn(
                                  "border rounded px-1.5 py-0.5 text-xs sm:text-sm font-semibold focus:bg-white outline-none cursor-pointer",
                                  probationVal === '수습' && "bg-amber-50 text-amber-700 border-amber-200",
                                  probationVal === '수습종료' && "bg-emerald-50 text-emerald-700 border-emerald-200",
                                  probationVal === '수습없음' && "bg-slate-100 text-slate-600 border-slate-300"
                                )}
                                value={probationVal}
                                onChange={(e) => handleProbationStatusChange(emp, e.target.value as any)}
                              >
                                <option value="수습">수습</option>
                                <option value="수습종료">수습종료</option>
                                <option value="수습없음">수습없음</option>
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

        {(activeTab === 'status' || activeTab === 'expected-leaver' || activeTab === 'attendance') && (
          <div className="space-y-6">
            {/* 통합 인력현황 상단 요약 & 원클릭 필터 카드 (기존 인력현황 + 재직기간 + 채용현황 통합) */}
            {activeTab === 'status' && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
                  <button
                    onClick={() => {
                      setPromotionFilter('all');
                      setProbationFilter('all');
                    }}
                    className={cn(
                      "dashboard-card flex items-center justify-between text-left transition-all cursor-pointer",
                      promotionFilter === 'all' && probationFilter === 'all'
                        ? "ring-2 ring-blue-500/30 border-blue-300 bg-blue-50/20"
                        : "hover:border-slate-300"
                    )}
                  >
                    <div>
                      <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">전체 재직 인원</p>
                      <h3 className="text-2xl font-bold text-slate-800 mt-1">{activeEmployees.length}명</h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">클릭 시 전체 보기</p>
                    </div>
                    <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl shrink-0">
                      <Users size={20} />
                    </div>
                  </button>

                  <button
                    onClick={() => setProbationFilter(probationFilter === '수습' ? 'all' : '수습')}
                    className={cn(
                      "dashboard-card flex items-center justify-between text-left transition-all cursor-pointer",
                      probationFilter === '수습'
                        ? "ring-2 ring-amber-500/30 border-amber-300 bg-amber-50/20"
                        : "hover:border-slate-300"
                    )}
                  >
                    <div>
                      <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">수습 진행 중</p>
                      <h3 className="text-2xl font-bold text-amber-600 mt-1">
                        {activeEmployees.filter(e => getProbationStatus(e) === '수습').length}명
                      </h3>
                      <p className="text-[11px] text-amber-600/80 mt-0.5">채용·수습 필터</p>
                    </div>
                    <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl shrink-0">
                      <Clock size={20} />
                    </div>
                  </button>

                  <button
                    onClick={() => setProbationFilter(probationFilter === '수습종료' ? 'all' : '수습종료')}
                    className={cn(
                      "dashboard-card flex items-center justify-between text-left transition-all cursor-pointer",
                      probationFilter === '수습종료'
                        ? "ring-2 ring-emerald-500/30 border-emerald-300 bg-emerald-50/20"
                        : "hover:border-slate-300"
                    )}
                  >
                    <div>
                      <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">수습 종료</p>
                      <h3 className="text-2xl font-bold text-emerald-600 mt-1">
                        {activeEmployees.filter(e => getProbationStatus(e) === '수습종료').length}명
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        수습없음 {activeEmployees.filter(e => getProbationStatus(e) === '수습없음').length}명
                      </p>
                    </div>
                    <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl shrink-0">
                      <Target size={20} />
                    </div>
                  </button>

                  <button
                    onClick={() => setPromotionFilter(promotionFilter === '대상' ? 'all' : '대상')}
                    className={cn(
                      "dashboard-card flex items-center justify-between text-left transition-all cursor-pointer",
                      promotionFilter === '대상'
                        ? "ring-2 ring-indigo-500/30 border-indigo-300 bg-indigo-50/20"
                        : "hover:border-slate-300"
                    )}
                  >
                    <div>
                      <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">승진 대상</p>
                      <h3 className="text-2xl font-bold text-indigo-600 mt-1">
                        {activeEmployees.filter(e => getPromotionStatus(e) === '대상').length}명
                      </h3>
                      <p className="text-[11px] text-indigo-600/80 mt-0.5">인사·승진 필터</p>
                    </div>
                    <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl shrink-0">
                      <TrendingUp size={20} />
                    </div>
                  </button>

                  <div className="dashboard-card flex flex-col justify-between col-span-2 sm:col-span-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">평균 재직기간</p>
                        <h3 className="text-2xl font-bold text-slate-800 mt-1">{averageTenure}년</h3>
                      </div>
                      <div className="p-2.5 bg-slate-100 text-slate-600 rounded-xl shrink-0">
                        <Calendar size={20} />
                      </div>
                    </div>
                    <button
                      onClick={() => setShowStatusTenureChart(!showStatusTenureChart)}
                      className={cn(
                        "mt-2 w-full py-1 px-2 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer border",
                        showStatusTenureChart
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                      )}
                    >
                      <BarChart3 size={12} />
                      <span>{showStatusTenureChart ? '근속 분포도 접기' : '근속 분포도 보기'}</span>
                    </button>
                  </div>
                </div>

                {showStatusTenureChart && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="dashboard-card"
                  >
                    <TenureDistributionChart data={activeEmployees} />
                  </motion.div>
                )}
              </>
            )}

            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="dashboard-card"
            >
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4 border-b border-slate-100 pb-4">
                <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                  <h2 className="section-title mb-0 shrink-0">
                    {activeTab === 'status' ? '통합 인력현황 (인사·재직기간·채용/수습)' : `${TABS.find(t => t.id === activeTab)?.label} 상세 목록`}
                  </h2>
                  
                  <div className="flex flex-wrap items-center gap-2 flex-grow sm:flex-grow-0 ml-0 lg:ml-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                      <input
                        type="text"
                        placeholder="이름, 본부, 팀, 직급 검색"
                        className="pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-blue-500 w-full sm:w-56 focus:bg-white transition-all shadow-sm h-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                    {activeTab === 'attendance' && (
                      <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 shadow-sm shrink-0 h-8">
                        <button
                          onClick={() => setAttendanceStatusFilter('active')}
                          className={cn(
                            "px-2.5 py-1 rounded-md text-[10px] sm:text-xs font-semibold transition-all cursor-pointer h-7 flex items-center",
                            attendanceStatusFilter === 'active'
                              ? "bg-white text-slate-800 shadow-sm"
                              : "text-slate-500 hover:text-slate-700"
                          )}
                        >
                          재직자
                        </button>
                        <button
                          onClick={() => setAttendanceStatusFilter('retired')}
                          className={cn(
                            "px-2.5 py-1 rounded-md text-[10px] sm:text-xs font-semibold transition-all cursor-pointer h-7 flex items-center",
                            attendanceStatusFilter === 'retired'
                              ? "bg-white text-slate-800 shadow-sm"
                              : "text-slate-500 hover:text-slate-700"
                          )}
                        >
                          퇴직자
                        </button>
                        <button
                          onClick={() => setAttendanceStatusFilter('all')}
                          className={cn(
                            "px-2.5 py-1 rounded-md text-[10px] sm:text-xs font-semibold transition-all cursor-pointer h-7 flex items-center",
                            attendanceStatusFilter === 'all'
                              ? "bg-white text-slate-800 shadow-sm"
                              : "text-slate-500 hover:text-slate-700"
                          )}
                        >
                          전체
                        </button>
                      </div>
                    )}
                    {activeTab === 'status' && (
                      <>
                        {/* 컬럼 뷰 프리셋 토글 */}
                        <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 shadow-sm shrink-0 h-8">
                          <button
                            onClick={() => setStatusViewMode('all')}
                            className={cn(
                              "px-2.5 py-1 rounded-md text-[10px] sm:text-xs font-semibold transition-all cursor-pointer h-7 flex items-center",
                              statusViewMode === 'all'
                                ? "bg-white text-blue-600 shadow-sm"
                                : "text-slate-500 hover:text-slate-700"
                            )}
                          >
                            통합 전체
                          </button>
                          <button
                            onClick={() => setStatusViewMode('hr')}
                            className={cn(
                              "px-2.5 py-1 rounded-md text-[10px] sm:text-xs font-semibold transition-all cursor-pointer h-7 flex items-center",
                              statusViewMode === 'hr'
                                ? "bg-white text-blue-600 shadow-sm"
                                : "text-slate-500 hover:text-slate-700"
                            )}
                          >
                            인사·승진
                          </button>
                          <button
                            onClick={() => setStatusViewMode('tenure-hiring')}
                            className={cn(
                              "px-2.5 py-1 rounded-md text-[10px] sm:text-xs font-semibold transition-all cursor-pointer h-7 flex items-center",
                              statusViewMode === 'tenure-hiring'
                                ? "bg-white text-blue-600 shadow-sm"
                                : "text-slate-500 hover:text-slate-700"
                            )}
                          >
                            근속·수습
                          </button>
                        </div>

                        <select
                          value={promotionFilter}
                          onChange={(e) => setPromotionFilter(e.target.value as any)}
                          className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 outline-blue-500 focus:bg-white transition-all shadow-sm cursor-pointer h-8"
                        >
                          <option value="all">승진여부: 전체</option>
                          <option value="대상">대상</option>
                          <option value="제외">제외</option>
                          <option value="완료">완료</option>
                          <option value="미대상">미대상</option>
                        </select>

                        <select
                          value={probationFilter}
                          onChange={(e) => setProbationFilter(e.target.value as any)}
                          className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 outline-blue-500 focus:bg-white transition-all shadow-sm cursor-pointer h-8"
                        >
                          <option value="all">수습여부: 전체</option>
                          <option value="수습">수습 진행 중</option>
                          <option value="수습종료">수습종료</option>
                          <option value="수습없음">수습없음</option>
                        </select>

                        <button 
                          onClick={handleResetAllStatus}
                          className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-500 px-2.5 rounded-lg border border-slate-200 transition-colors shadow-sm cursor-pointer shrink-0 h-8"
                        >
                          데이터 초기화
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <span className="text-xs text-slate-400 font-mono shrink-0">검색 결과: {filteredEmployees.length}명</span>
              </div>
              <div className="overflow-x-auto no-scrollbar -mx-4 sm:mx-0 shadow-sm sm:shadow-none border sm:border-0 border-slate-100 rounded-xl sm:rounded-none">
                <table className="w-full text-xs sm:text-sm border-collapse min-w-full bg-white">
                  <thead>
                    <tr className="border-b border-slate-100 text-left">
                      {activeTab === 'attendance' ? (
                        <>
                          {renderSortableHeader('팀명', 'team', 'left', 'text-xs sm:text-sm')}
                          {renderSortableHeader('직급', 'rank', 'left', 'text-xs sm:text-sm')}
                          {renderSortableHeader('성명', 'name', 'left', 'min-w-[70px] text-xs sm:text-sm')}
                          {renderSortableHeader('입사일', 'hireDate', 'left', 'text-xs sm:text-sm')}
                          {renderSortableHeader('퇴사일', 'resignationDate', 'left', 'text-xs sm:text-sm')}
                          {renderSortableHeader('발생', 'totalLeave', 'center', 'text-xs sm:text-sm')}
                          {renderSortableHeader('사용', 'usedLeave', 'center', 'text-xs sm:text-sm')}
                          {renderSortableHeader('잔여', 'remainingLeave', 'center', 'text-xs sm:text-sm')}
                          <th className="px-2.5 py-3 sm:px-4 sm:py-3.5 font-semibold text-slate-500 bg-slate-50/50 text-right text-xs sm:text-sm whitespace-nowrap">관리</th>
                        </>
                      ) : (
                        <>
                          {renderSortableHeader('성명', 'name', 'left', 'min-w-[70px] text-xs sm:text-sm')}
                          {renderSortableHeader('본부', 'hq', 'left', 'hidden md:table-cell text-xs sm:text-sm')}
                          {renderSortableHeader('팀명', 'team', 'left', 'table-cell text-xs sm:text-sm')}
                          {renderSortableHeader('직급', 'rank', 'left', activeTab === 'status' ? 'hidden sm:table-cell text-xs sm:text-sm' : 'table-cell text-xs sm:text-sm')}
                          {activeTab === 'status' && statusViewMode !== 'tenure-hiring' && renderSortableHeader('연차', 'yearsInRank', 'left', 'table-cell text-xs sm:text-sm')}
                          {activeTab === 'status' && renderSortableHeader('형태', 'employmentType', 'left', 'hidden sm:table-cell text-xs sm:text-sm')}
                          {renderSortableHeader('입사일', 'hireDate', 'left', 'hidden sm:table-cell text-xs sm:text-sm')}
                          {activeTab === 'status' && statusViewMode !== 'hr' && renderSortableHeader('재직기간', 'duration', 'left', 'hidden sm:table-cell text-xs sm:text-sm')}
                          {activeTab === 'status' && statusViewMode !== 'hr' && renderSortableHeader('수습현황 (만료일)', 'probationStatus', 'center', 'hidden sm:table-cell text-xs sm:text-sm')}
                          {activeTab === 'status' && statusViewMode !== 'tenure-hiring' && (
                            renderSortableHeader('승진 여부', 'promotionStatus', 'center', 'table-cell text-xs sm:text-sm')
                          )}
                          {activeTab === 'expected-leaver' && renderSortableHeader('퇴사일', 'resignationDate', 'left', 'hidden sm:table-cell text-xs sm:text-sm')}
                          {renderSortableHeader('상태', 'status', 'center', activeTab === 'status' ? 'hidden sm:table-cell text-xs sm:text-sm' : 'table-cell text-xs sm:text-sm')}
                          <th className="px-2.5 py-3 sm:px-4 sm:py-3.5 font-semibold text-slate-500 bg-slate-50/50 text-right text-xs sm:text-sm whitespace-nowrap">관리</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEmployees
                      .sort((a, b) => {
                        const rankPriority: Record<string, number> = {
                          '대표이사': 0, '전무이사': 1, '전무': 1, '상무이사': 2, '상무': 2, '이사': 3,
                          '센터장': 4, '부센터장': 4.5, '수석매니저': 5, '책임매니저': 6, '선임매니저': 7, '매니저': 8
                        };
                        const getPrio = (r: string) => {
                          if (rankPriority[r] !== undefined) return rankPriority[r];
                          if (r.includes('(직영)')) return 10;
                          return 100;
                        };

                        if (sortConfig) {
                          const { key, direction } = sortConfig;
                          let comparison = 0;

                          if (key === 'team') {
                            comparison = a.team.localeCompare(b.team);
                          } else if (key === 'rank') {
                            comparison = getPrio(a.rank) - getPrio(b.rank);
                          } else if (key === 'name') {
                            comparison = a.name.localeCompare(b.name);
                          } else if (key === 'hq') {
                            comparison = a.hq.localeCompare(b.hq);
                          } else if (key === 'hireDate') {
                            comparison = a.hireDate.localeCompare(b.hireDate);
                          } else if (key === 'status') {
                            comparison = a.status.localeCompare(b.status);
                          } else if (key === 'employmentType') {
                            comparison = (a.employmentType || '').localeCompare(b.employmentType || '');
                          } else if (key === 'totalLeave') {
                            comparison = (a.totalLeave || 0) - (b.totalLeave || 0);
                          } else if (key === 'usedLeave') {
                            comparison = (a.usedLeave || 0) - (b.usedLeave || 0);
                          } else if (key === 'remainingLeave') {
                            comparison = (a.remainingLeave || 0) - (b.remainingLeave || 0);
                          } else if (key === 'yearsInRank') {
                            comparison = getYearsFromPColumn(a.yearsInRank) - getYearsFromPColumn(b.yearsInRank);
                          } else if (key === 'duration') {
                            const getDurationMonths = (dur?: string) => {
                              if (!dur) return 0;
                              const y = dur.match(/(\d+)년/);
                              const m = dur.match(/(\d+)개월/);
                              return (y ? parseInt(y[1]) : 0) * 12 + (m ? parseInt(m[1]) : 0);
                            };
                            comparison = getDurationMonths(a.duration) - getDurationMonths(b.duration);
                          } else if (key === 'probationStatus') {
                            const pOrder: Record<string, number> = { '수습': 0, '수습종료': 1, '수습없음': 2 };
                            comparison = (pOrder[getProbationStatus(a)] ?? 3) - (pOrder[getProbationStatus(b)] ?? 3);
                          } else if (key === 'promotionStatus') {
                            const getPromoPriority = (emp: Employee) => {
                              const status = getPromotionStatus(emp);
                              if (status === '대상') return 0;
                              if (status === '완료') return 1;
                              if (status === '제외') return 2;
                              return 3;
                            };
                            const pA = getPromoPriority(a);
                            const pB = getPromoPriority(b);
                            if (pA !== pB) {
                              comparison = pA - pB;
                            } else if (pA === 0) {
                              const getPromoRankPrio = (rankStr: string) => {
                                if (rankStr.includes('매니저') && !rankStr.includes('선임') && !rankStr.includes('책임') && !rankStr.includes('수석')) return 0;
                                if (rankStr.includes('선임매니저')) return 1;
                                if (rankStr.includes('책임매니저')) return 2;
                                return 3;
                              };
                              comparison = getPromoRankPrio(a.rank) - getPromoRankPrio(b.rank);
                            }
                          } else if (key === 'resignationDate') {
                            comparison = (a.resignationDate || '').localeCompare(b.resignationDate || '');
                          }

                          if (comparison !== 0) {
                            return direction === 'asc' ? comparison : -comparison;
                          }
                        }

                        // Default sorting fallback: team asc, then rank priority asc, then name asc
                        if (a.team !== b.team) return a.team.localeCompare(b.team);
                        const rankDiff = getPrio(a.rank) - getPrio(b.rank);
                        if (rankDiff !== 0) return rankDiff;
                        return a.name.localeCompare(b.name);
                      })
                      .map((emp, idx) => {
                        const isPromoted = activeTab === 'status' && getPromotionStatus(emp) === '대상';
                        const probationVal = getProbationStatus(emp);
                        const probationEndDate = calculateProbationEndDate(emp.hireDate, probationVal);

                        if (activeTab === 'attendance') {
                          const totalLeave = emp.totalLeave || 0;
                          const usedLeave = emp.usedLeave || 0;
                          const remainingLeave = emp.remainingLeave || 0;

                          return (
                            <tr 
                              key={`${emp.id}-${idx}`} 
                              className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors group"
                            >
                              {/* 팀명 */}
                              <td className="px-2.5 py-3 sm:px-4 sm:py-3.5 text-slate-500 text-xs sm:text-sm font-medium whitespace-nowrap">
                                {editingId === emp.id ? (
                                  <input 
                                    className="border border-slate-200 rounded px-1.5 py-0.5 outline-blue-500 focus:bg-white text-xs sm:text-sm w-full"
                                    value={editValues.team || emp.team}
                                    onChange={(e) => setEditValues({ ...editValues, team: e.target.value })}
                                  />
                                ) : formatTeamName(emp.team)}
                              </td>
                              {/* 직급 */}
                              <td className="px-2.5 py-3 sm:px-4 sm:py-3.5 text-slate-500 text-xs sm:text-sm font-medium whitespace-nowrap">
                                {editingId === emp.id ? (
                                  <input 
                                    className="border border-slate-200 rounded px-1.5 py-0.5 outline-blue-500 focus:bg-white text-xs sm:text-sm w-full"
                                    value={editValues.rank || emp.rank}
                                    onChange={(e) => setEditValues({ ...editValues, rank: e.target.value })}
                                  />
                                ) : formatRankName(emp.rank)}
                              </td>
                              {/* 성명 */}
                              <td className="px-2.5 py-3 sm:px-4 sm:py-3.5 font-bold text-slate-900 text-xs sm:text-sm whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  {editingId === emp.id ? (
                                    <input 
                                      className="border border-slate-200 rounded px-1.5 py-0.5 outline-blue-500 focus:bg-white text-xs sm:text-sm w-full"
                                      value={editValues.name || emp.name}
                                      onChange={(e) => setEditValues({ ...editValues, name: e.target.value })}
                                    />
                                  ) : (
                                    <>
                                      <span>{emp.name}</span>
                                      {emp.status === '퇴직' && (
                                        <span className="inline-flex items-center justify-center bg-rose-50 text-rose-600 border border-rose-100 text-[9px] px-1.5 py-0.5 rounded-full font-bold shrink-0">
                                          퇴직
                                        </span>
                                      )}
                                    </>
                                  )}
                                </div>
                              </td>
                              {/* 입사일 */}
                              <td className="px-2.5 py-3 sm:px-4 sm:py-3.5 text-slate-500 text-xs sm:text-sm font-medium whitespace-nowrap">
                                {editingId === emp.id ? (
                                  <input 
                                    className="border border-slate-200 rounded px-1.5 py-0.5 outline-blue-500 focus:bg-white text-xs sm:text-sm w-full"
                                    value={editValues.hireDate || emp.hireDate}
                                    onChange={(e) => setEditValues({ ...editValues, hireDate: e.target.value })}
                                  />
                                ) : emp.hireDate}
                              </td>
                              {/* 퇴사일 */}
                              <td className="px-2.5 py-3 sm:px-4 sm:py-3.5 text-slate-500 text-xs sm:text-sm font-medium whitespace-nowrap">
                                {editingId === emp.id ? (
                                  <input 
                                    className="border border-slate-200 rounded px-1.5 py-0.5 outline-blue-500 focus:bg-white text-xs sm:text-sm w-full"
                                    value={editValues.resignationDate || emp.resignationDate || ''}
                                    onChange={(e) => setEditValues({ ...editValues, resignationDate: e.target.value })}
                                  />
                                ) : (emp.resignationDate || '-')}
                              </td>
                              {/* 발생 */}
                              <td className="px-2.5 py-3 sm:px-4 sm:py-3.5 text-center font-semibold text-slate-600 text-xs sm:text-sm whitespace-nowrap">
                                {totalLeave}
                              </td>
                              {/* 사용 */}
                              <td className="px-2.5 py-3 sm:px-4 sm:py-3.5 text-center text-rose-500 font-semibold text-xs sm:text-sm whitespace-nowrap">
                                {usedLeave}
                              </td>
                              {/* 잔여 */}
                              <td className="px-2.5 py-3 sm:px-4 sm:py-3.5 text-center text-blue-600 font-semibold text-xs sm:text-sm whitespace-nowrap">
                                {remainingLeave}
                              </td>
                              {/* 관리 */}
                              <td className="px-2.5 py-3 sm:px-4 sm:py-3.5 text-right text-xs sm:text-sm whitespace-nowrap">
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
                                      className="text-slate-400 hover:text-slate-600 p-1 sm:p-1.5 bg-slate-100 rounded-lg text-xs"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex justify-end gap-2">
                                    <button 
                                      onClick={() => {
                                        setEditingId(emp.id);
                                        setEditValues(emp);
                                      }}
                                      className="text-xs text-blue-600 hover:text-blue-700 underline font-medium"
                                    >
                                      수정
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        }

                        return (
                          <tr 
                            key={`${emp.id}-${idx}`} 
                            className={`border-b border-slate-50 transition-colors group ${
                              isPromoted 
                                ? "bg-blue-50/30 hover:bg-blue-50/50" 
                                : "hover:bg-slate-50/50"
                            }`}
                          >
                            <td className="px-2.5 py-3 sm:px-4 sm:py-3.5 font-bold text-slate-900 min-w-[70px] text-xs sm:text-sm whitespace-nowrap">
                              <div className="flex items-center gap-1.5 whitespace-nowrap">
                                {editingId === emp.id ? (
                                  <input 
                                    className="border border-slate-200 rounded px-1.5 py-0.5 w-16 sm:w-24 outline-blue-500 focus:bg-white text-xs sm:text-sm"
                                    value={editValues.name || emp.name}
                                    onChange={(e) => setEditValues({ ...editValues, name: e.target.value })}
                                  />
                                ) : (
                                  <>
                                    <span>{emp.name}</span>
                                    {isPromoted && (
                                      <span className="hidden sm:inline-flex items-center justify-center bg-blue-50 text-blue-700 border-blue-100 text-xs px-1.5 py-0.5 rounded-full font-bold shrink-0">
                                        ★ 대상
                                      </span>
                                    )}
                                  </>
                                )}
                              </div>
                            </td>
                            <td className="px-2.5 py-3 sm:px-4 sm:py-3.5 text-slate-500 text-xs sm:text-sm hidden md:table-cell whitespace-nowrap">
                              {editingId === emp.id ? (
                                <input 
                                  className="border border-slate-200 rounded px-1.5 py-0.5 outline-blue-500 focus:bg-white text-xs sm:text-sm"
                                  value={editValues.hq || emp.hq}
                                  onChange={(e) => setEditValues({ ...editValues, hq: e.target.value })}
                                />
                              ) : emp.hq}
                            </td>
                            <td className="px-2.5 py-3 sm:px-4 sm:py-3.5 text-slate-500 text-xs sm:text-sm whitespace-nowrap">
                              {editingId === emp.id ? (
                                <input 
                                  className="border border-slate-200 rounded px-1.5 py-0.5 outline-blue-500 focus:bg-white text-xs sm:text-sm"
                                  value={editValues.team || emp.team}
                                  onChange={(e) => setEditValues({ ...editValues, team: e.target.value })}
                                />
                              ) : formatTeamName(emp.team)}
                            </td>
                            <td className={cn(
                              "px-2.5 py-3 sm:px-4 sm:py-3.5 text-slate-500 text-xs sm:text-sm whitespace-nowrap",
                              activeTab === 'status' ? "hidden sm:table-cell" : "table-cell"
                            )}>
                              {editingId === emp.id ? (
                                <input 
                                  className="border border-slate-200 rounded px-1.5 py-0.5 outline-blue-500 w-16 sm:w-24 focus:bg-white text-xs sm:text-sm"
                                  value={editValues.rank || emp.rank}
                                  onChange={(e) => setEditValues({ ...editValues, rank: e.target.value })}
                                />
                              ) : formatRankName(emp.rank)}
                            </td>
                            {activeTab === 'status' && statusViewMode !== 'tenure-hiring' && (
                              <td className="px-2.5 py-3 sm:px-4 sm:py-3.5 text-slate-500 font-semibold text-xs sm:text-sm whitespace-nowrap">
                                {formatTenureYear(emp.yearsInRank)}
                              </td>
                            )}
                            {activeTab === 'status' && (
                              <td className="hidden sm:table-cell px-2.5 py-3 sm:px-4 sm:py-3.5 text-slate-500 text-xs sm:text-sm font-semibold whitespace-nowrap">
                                {editingId === emp.id ? (
                                  <select
                                    className="border border-slate-200 rounded px-1.5 py-0.5 outline-blue-500 text-xs sm:text-sm font-semibold focus:bg-white"
                                    value={editValues.employmentType || emp.employmentType}
                                    onChange={(e) => setEditValues({ ...editValues, employmentType: e.target.value as any })}
                                  >
                                    <option value="상용직">상용직</option>
                                    <option value="계약직">계약직</option>
                                    <option value="파견직">파견직</option>
                                  </select>
                                ) : (
                                  emp.employmentType || '상용직'
                                )}
                              </td>
                            )}
                            <td className="hidden sm:table-cell px-2.5 py-3 sm:px-4 sm:py-3.5 text-slate-500 font-semibold text-xs sm:text-sm whitespace-nowrap">
                              {emp.hireDate}
                            </td>
                            {activeTab === 'status' && statusViewMode !== 'hr' && (
                              <td className="hidden sm:table-cell px-2.5 py-3 sm:px-4 sm:py-3.5 text-blue-600 font-semibold text-xs sm:text-sm whitespace-nowrap">
                                {formatDuration(emp.duration) || '-'}
                              </td>
                            )}
                            {activeTab === 'status' && statusViewMode !== 'hr' && (
                              <td className="hidden sm:table-cell px-2.5 py-3 sm:px-4 sm:py-3.5 text-center text-xs sm:text-sm whitespace-nowrap">
                                <div className="flex flex-col items-center gap-0.5 whitespace-nowrap">
                                  <select
                                    className={cn(
                                      "border rounded px-1.5 py-0.5 text-xs font-semibold focus:bg-white outline-none cursor-pointer",
                                      probationVal === '수습' && "bg-amber-50 text-amber-700 border-amber-200",
                                      probationVal === '수습종료' && "bg-emerald-50 text-emerald-700 border-emerald-200",
                                      probationVal === '수습없음' && "bg-slate-100 text-slate-600 border-slate-300"
                                    )}
                                    value={probationVal}
                                    onChange={(e) => handleProbationStatusChange(emp, e.target.value as any)}
                                  >
                                    <option value="수습">수습</option>
                                    <option value="수습종료">수습종료</option>
                                    <option value="수습없음">수습없음</option>
                                  </select>
                                  {probationEndDate && probationEndDate !== '-' && (
                                    <span className="text-[10px] text-slate-400 font-mono">
                                      만료: {probationEndDate}
                                    </span>
                                  )}
                                </div>
                              </td>
                            )}
                            {activeTab === 'status' && statusViewMode !== 'tenure-hiring' && (
                              <td className="px-2.5 py-3 sm:px-4 sm:py-3.5 text-center text-xs sm:text-sm whitespace-nowrap">
                                {editingId === emp.id ? (
                                  <select
                                    className="border border-slate-200 rounded px-1.5 py-0.5 outline-blue-500 text-xs sm:text-sm font-semibold focus:bg-white cursor-pointer"
                                    value={editValues.promotionStatus || emp.promotionStatus || getPromotionStatus(emp)}
                                    onChange={(e) => setEditValues({ ...editValues, promotionStatus: e.target.value as any })}
                                  >
                                    <option value="대상">대상</option>
                                    <option value="제외">제외</option>
                                    <option value="완료">완료</option>
                                    <option value="미대상">미대상</option>
                                  </select>
                                ) : (
                                  <select
                                    className={cn(
                                      "border rounded px-1.5 py-0.5 text-xs sm:text-sm font-semibold focus:bg-white outline-none cursor-pointer",
                                      getPromotionStatus(emp) === '대상' && "bg-blue-50 text-blue-700 border-blue-200",
                                      getPromotionStatus(emp) === '완료' && "bg-emerald-50 text-emerald-700 border-emerald-200",
                                      getPromotionStatus(emp) === '제외' && "bg-rose-50 text-rose-700 border-rose-200",
                                      getPromotionStatus(emp) === '미대상' && "bg-slate-50 text-slate-600 border-slate-200"
                                    )}
                                    value={getPromotionStatus(emp)}
                                    onChange={(e) => handlePromotionStatusChange(emp, e.target.value as any)}
                                  >
                                    <option value="대상">대상</option>
                                    <option value="제외">제외</option>
                                    <option value="완료">완료</option>
                                    <option value="미대상">미대상</option>
                                  </select>
                                )}
                              </td>
                            )}
                            {activeTab === 'expected-leaver' && (
                              <td className="hidden sm:table-cell px-2.5 py-3 sm:px-4 sm:py-3.5 text-slate-500 font-semibold text-xs sm:text-sm whitespace-nowrap">
                                {emp.resignationDate || '-'}
                              </td>
                            )}
                            <td className={cn(
                              "px-2.5 py-3 sm:px-4 sm:py-3.5 text-center text-xs sm:text-sm whitespace-nowrap",
                              activeTab === 'status' ? "hidden sm:table-cell" : "table-cell"
                            )}>
                              {editingId === emp.id ? (
                                <select
                                  className="border border-slate-200 rounded px-1.5 py-0.5 outline-blue-500 text-xs sm:text-sm font-semibold focus:bg-white"
                                  value={editValues.status || emp.status}
                                  onChange={(e) => setEditValues({ ...editValues, status: e.target.value as EmploymentStatus })}
                                >
                                  <option value="재직">재직</option>
                                  <option value="휴직">휴직</option>
                                  <option value="퇴직">퇴직</option>
                                </select>
                              ) : (
                                (() => {
                                  const isExpectedLeaver = emp.status === '재직' && isFutureDate(emp.resignationDate);
                                  return (
                                    <span className={cn(
                                      "inline-flex items-center px-2 py-0.5 rounded-full text-xs sm:text-sm font-semibold border whitespace-nowrap",
                                      isExpectedLeaver 
                                        ? "bg-amber-50 text-amber-700 border-amber-200" 
                                        : emp.status === '재직' 
                                          ? "bg-emerald-50 text-emerald-700 border-emerald-100" 
                                          : emp.status === '퇴직' 
                                            ? "bg-rose-50 text-rose-700 border-rose-100" 
                                            : "bg-amber-50 text-amber-700 border-amber-100"
                                    )}>
                                      {isExpectedLeaver ? '퇴사예정' : emp.status}
                                    </span>
                                  );
                                })()
                              )}
                            </td>
                            <td className="px-2.5 py-3 sm:px-4 sm:py-3.5 text-right text-xs sm:text-sm whitespace-nowrap">
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
                                    className="text-slate-400 hover:text-slate-600 p-1 sm:p-1.5 bg-slate-100 rounded-lg text-xs sm:text-sm"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ) : (
                                <div className="flex justify-end gap-2">
                                  <button 
                                    onClick={() => {
                                      setEditingId(emp.id);
                                      setEditValues(emp);
                                    }}
                                    className="text-xs sm:text-sm text-blue-600 hover:text-blue-700 underline font-medium"
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
          </div>
        )}

        {activeTab === 'leaver' && (() => {
          const yearLabel = selectedFlowYear === 'all' ? '전체 연도' : `${selectedFlowYear}년`;
          const monthLabel = selectedFlowMonth === 'all' ? '전체 월' : `${selectedFlowMonth}월`;
          const peakMonthItem = [...monthlyFlowData].sort((a, b) => b.total - a.total)[0];
          const activeMonthsCount = monthlyFlowData.filter(m => m.total > 0).length || 1;
          const monthlyAvg = (selectedYearStats.display / (selectedFlowYear === String(now.getFullYear()) ? Math.max(1, now.getMonth() + 1) : 12)).toFixed(1);
          const retentionRate = selectedYearStats.totalAll > 0
            ? Math.round((selectedYearStats.activeCnt / selectedYearStats.totalAll) * 100)
            : 100;

          // 선택 연도 재직 입사자 중 수습 현황
          const cohortActiveHires = employees.filter(e => {
            if (e.status === '퇴직') return false;
            if (flowHqFilter !== 'all' && e.hq !== flowHqFilter) return false;
            const ym = parseYearMonth(e.hireDate);
            if (!ym) return false;
            return selectedFlowYear === 'all' ? true : String(ym.year) === selectedFlowYear;
          });
          const cohortProbationActive = cohortActiveHires.filter(e => getProbationStatus(e) === '수습').length;
          const cohortProbationDone = cohortActiveHires.filter(e => getProbationStatus(e) === '수습종료').length;

          // 퇴사자 모드 전용 지표 (조기퇴사율 및 평균 근속)
          const cohortLeavers = employees.filter(e => {
            if (e.status !== '퇴직') return false;
            if (flowHqFilter !== 'all' && e.hq !== flowHqFilter) return false;
            const ym = parseYearMonth(e.resignationDate);
            if (selectedFlowYear === 'all') return true;
            return ym ? String(ym.year) === selectedFlowYear : false;
          });
          const getDurationYearsFromStr = (dur?: string): number => {
            if (!dur) return 0;
            const y = dur.match(/(\d+)년/);
            const m = dur.match(/(\d+)개월/);
            return (y ? parseInt(y[1], 10) : 0) + (m ? parseInt(m[1], 10) / 12 : 0);
          };
          const earlyLeaversCount = cohortLeavers.filter(e => getDurationYearsFromStr(e.duration) < 1).length;
          const earlyLeaverPct = cohortLeavers.length > 0 ? Math.round((earlyLeaversCount / cohortLeavers.length) * 100) : 0;
          const avgLeaverTenure = cohortLeavers.length > 0
            ? (cohortLeavers.reduce((acc, e) => acc + getDurationYearsFromStr(e.duration), 0) / cohortLeavers.length).toFixed(1)
            : '0.0';

          return (
            <div className="space-y-6">
              {/* 1. 상단 모드 전환 바 (입사자 현황 vs 퇴사자 현황) + 중도퇴사자 포함 체크박스 */}
              <div className="dashboard-card p-4 sm:p-5">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200">
                      <button
                        onClick={() => {
                          setFlowMode('hires');
                          setSelectedFlowMonth('all');
                        }}
                        className={cn(
                          "flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer",
                          flowMode === 'hires'
                            ? "bg-blue-600 text-white shadow-sm"
                            : "text-slate-600 hover:text-slate-900"
                        )}
                      >
                        <UserPlus size={16} />
                        <span>입사자 현황 (채용)</span>
                      </button>
                      <button
                        onClick={() => {
                          setFlowMode('leavers');
                          setSelectedFlowMonth('all');
                        }}
                        className={cn(
                          "flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer",
                          flowMode === 'leavers'
                            ? "bg-rose-600 text-white shadow-sm"
                            : "text-slate-600 hover:text-slate-900"
                        )}
                      >
                        <UserMinus size={16} />
                        <span>퇴사자 현황</span>
                      </button>
                    </div>

                    {/* 입사자 현황 전용: 중도퇴사자 포함 체크박스 토글 */}
                    {flowMode === 'hires' && (
                      <button
                        type="button"
                        onClick={() => setIncludeLeaversInHires(!includeLeaversInHires)}
                        className={cn(
                          "flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs sm:text-sm font-bold transition-all cursor-pointer select-none",
                          includeLeaversInHires
                            ? "bg-amber-50/90 border-amber-300 text-amber-900 shadow-sm"
                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                        )}
                      >
                        {includeLeaversInHires ? (
                          <CheckSquare size={17} className="text-amber-600 shrink-0" />
                        ) : (
                          <Square size={17} className="text-slate-400 shrink-0" />
                        )}
                        <span>중도퇴사자 포함</span>
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[11px] font-bold",
                          includeLeaversInHires
                            ? "bg-amber-200/70 text-amber-900"
                            : "bg-slate-100 text-slate-500"
                        )}>
                          {includeLeaversInHires
                            ? `포함됨 (+${selectedYearStats.retiredCnt}명)`
                            : `제외됨 (-${selectedYearStats.retiredCnt}명)`}
                        </span>
                      </button>
                    )}
                  </div>

                  {/* 우측 조직(본부) 필터 */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs">
                      <span className="text-slate-400 font-medium">조직:</span>
                      <select
                        value={flowHqFilter}
                        onChange={(e) => setFlowHqFilter(e.target.value)}
                        className="bg-transparent font-semibold text-slate-700 outline-none cursor-pointer"
                      >
                        <option value="all">전체 조직</option>
                        {hqOptions.map(hq => (
                          <option key={hq} value={hq}>{hq}</option>
                        ))}
                      </select>
                    </div>
                    {(selectedFlowYear !== String(now.getFullYear()) || selectedFlowMonth !== 'all' || flowHqFilter !== 'all') && (
                      <button
                        onClick={() => {
                          setSelectedFlowYear(String(now.getFullYear()));
                          setSelectedFlowMonth('all');
                          setFlowHqFilter('all');
                          setFlowProbationFilter('all');
                        }}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                      >
                        필터 초기화
                      </button>
                    )}
                  </div>
                </div>

                {/* 2. 연도 선택 알약 버튼 바 */}
                <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-bold text-slate-500 mr-1 flex items-center gap-1">
                      <Calendar size={14} className="text-slate-400" />
                      조회 연도:
                    </span>
                    <button
                      onClick={() => {
                        setSelectedFlowYear('all');
                        setSelectedFlowMonth('all');
                      }}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border",
                        selectedFlowYear === 'all'
                          ? flowMode === 'hires'
                            ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                            : "bg-rose-600 text-white border-rose-600 shadow-sm"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                      )}
                    >
                      전체 연도 ({getYearCounts('all').display}명)
                    </button>
                    {availableFlowYears.map(yr => {
                      const yCounts = getYearCounts(yr);
                      const isSelected = selectedFlowYear === yr;
                      return (
                        <button
                          key={yr}
                          onClick={() => {
                            setSelectedFlowYear(yr);
                            setSelectedFlowMonth('all');
                          }}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border flex items-center gap-1.5",
                            isSelected
                              ? flowMode === 'hires'
                                ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                                : "bg-rose-600 text-white border-rose-600 shadow-sm"
                              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                          )}
                        >
                          <span>{yr}년</span>
                          <span className={cn(
                            "px-1.5 py-0.2 rounded text-[11px]",
                            isSelected
                              ? "bg-white/20 text-white"
                              : "bg-slate-100 text-slate-600"
                          )}>
                            {yCounts.display}명
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {flowMode === 'hires' && (
                    <p className="text-[11px] text-slate-500 font-medium">
                      {includeLeaversInHires
                        ? `💡 ${yearLabel} 입사자 중 중도퇴사자(${selectedYearStats.retiredCnt}명)를 포함한 총 채용 인원(${selectedYearStats.totalAll}명) 기준입니다.`
                        : `💡 ${yearLabel} 입사자 중 중도퇴사자(${selectedYearStats.retiredCnt}명)를 제외하고 현재 재직 중인 인원(${selectedYearStats.activeCnt}명) 기준입니다.`}
                    </p>
                  )}
                </div>
              </div>

              {/* 3. 선택 연도 KPI 요약 카드 (4종) */}
              {flowMode === 'hires' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="dashboard-card flex items-center justify-between border-l-4 border-l-blue-600">
                    <div>
                      <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                        {yearLabel} 입사 인원 {includeLeaversInHires ? '(중도퇴사 포함)' : '(현재 재직 기준)'}
                      </p>
                      <h3 className="text-2xl font-bold text-slate-900 mt-1">
                        {selectedYearStats.display}명
                      </h3>
                      <p className="text-xs text-slate-500 mt-1 font-medium">
                        현재 재직 <span className="text-blue-600 font-bold">{selectedYearStats.activeCnt}명</span> · 중도퇴사 <span className="text-rose-500 font-bold">{selectedYearStats.retiredCnt}명</span>
                      </p>
                    </div>
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-xl shrink-0">
                      <UserPlus size={22} />
                    </div>
                  </div>

                  <div className="dashboard-card flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                        {yearLabel} 채용 유지율 (Retention)
                      </p>
                      <h3 className="text-2xl font-bold text-emerald-600 mt-1">
                        {retentionRate}%
                      </h3>
                      <p className="text-xs text-slate-500 mt-1 font-medium">
                        총 입사 {selectedYearStats.totalAll}명 중 {selectedYearStats.activeCnt}명 재직 중
                      </p>
                    </div>
                    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl shrink-0">
                      <Target size={22} />
                    </div>
                  </div>

                  <div className="dashboard-card flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                        월평균 입사 · 최다 입사월
                      </p>
                      <h3 className="text-2xl font-bold text-slate-800 mt-1">
                        월 {monthlyAvg}명
                      </h3>
                      <p className="text-xs text-slate-500 mt-1 font-medium">
                        최다 입사: <span className="text-slate-800 font-bold">{peakMonthItem && peakMonthItem.total > 0 ? `${peakMonthItem.label} (${peakMonthItem.total}명)` : '-'}</span> (입사발생 {activeMonthsCount}개 월)
                      </p>
                    </div>
                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl shrink-0">
                      <Calendar size={22} />
                    </div>
                  </div>

                  <div className="dashboard-card flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                        {yearLabel} 입사자 수습 현황
                      </p>
                      <h3 className="text-2xl font-bold text-amber-600 mt-1">
                        수습 {cohortProbationActive}명
                      </h3>
                      <p className="text-xs text-slate-500 mt-1 font-medium">
                        수습종료 <span className="text-emerald-600 font-bold">{cohortProbationDone}명</span> · 수습없음 {Math.max(0, cohortActiveHires.length - cohortProbationActive - cohortProbationDone)}명
                      </p>
                    </div>
                    <div className="p-3 bg-amber-50 text-amber-600 rounded-xl shrink-0">
                      <Clock size={22} />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="dashboard-card flex items-center justify-between border-l-4 border-l-rose-600">
                    <div>
                      <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                        {yearLabel} 총 퇴사 인원
                      </p>
                      <h3 className="text-2xl font-bold text-rose-600 mt-1">
                        {selectedYearStats.display}명
                      </h3>
                      <p className="text-xs text-slate-500 mt-1 font-medium">
                        전체 누적 퇴사자 {getYearCounts('all').display}명 중
                      </p>
                    </div>
                    <div className="p-3 bg-rose-50 text-rose-600 rounded-xl shrink-0">
                      <UserMinus size={22} />
                    </div>
                  </div>

                  <div className="dashboard-card flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                        월평균 퇴사 · 최다 퇴사월
                      </p>
                      <h3 className="text-2xl font-bold text-slate-800 mt-1">
                        월 {monthlyAvg}명
                      </h3>
                      <p className="text-xs text-slate-500 mt-1 font-medium">
                        최다 퇴사: <span className="text-rose-600 font-bold">{peakMonthItem && peakMonthItem.total > 0 ? `${peakMonthItem.label} (${peakMonthItem.total}명)` : '-'}</span>
                      </p>
                    </div>
                    <div className="p-3 bg-slate-100 text-slate-600 rounded-xl shrink-0">
                      <Calendar size={22} />
                    </div>
                  </div>

                  <div className="dashboard-card flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                        1년 미만 조기 퇴사자
                      </p>
                      <h3 className="text-2xl font-bold text-amber-600 mt-1">
                        {earlyLeaversCount}명 <span className="text-sm font-semibold text-slate-400">({earlyLeaverPct}%)</span>
                      </h3>
                      <p className="text-xs text-slate-500 mt-1 font-medium">
                        입사 후 1년 내 퇴사 비중
                      </p>
                    </div>
                    <div className="p-3 bg-amber-50 text-amber-600 rounded-xl shrink-0">
                      <Clock size={22} />
                    </div>
                  </div>

                  <div className="dashboard-card flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                        퇴사자 평균 재직기간
                      </p>
                      <h3 className="text-2xl font-bold text-slate-800 mt-1">
                        {avgLeaverTenure}년
                      </h3>
                      <p className="text-xs text-slate-500 mt-1 font-medium">
                        입사일 ~ 퇴사일 기준 평균 근속
                      </p>
                    </div>
                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl shrink-0">
                      <TrendingUp size={22} />
                    </div>
                  </div>
                </div>
              )}

              {/* 4. 월별 (1월 ~ 12월) 추이 차트 & 월별 클릭 선택 그리드 */}
              <div className="dashboard-card space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="section-title mb-0 flex items-center gap-2">
                      <span>{yearLabel} 월별 {flowMode === 'hires' ? '입사자' : '퇴사자'} 추이 (1월 ~ 12월)</span>
                      {selectedFlowMonth !== 'all' && (
                        <span className={cn(
                          "px-2.5 py-0.5 rounded-full text-xs font-bold",
                          flowMode === 'hires' ? "bg-blue-50 text-blue-700" : "bg-rose-50 text-rose-700"
                        )}>
                          {selectedFlowMonth}월 선택됨
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      막대 그래프 또는 아래의 월별 카드를 클릭하면 해당 월의 {flowMode === 'hires' ? '입사자' : '퇴사자'} 명단만 아래 목록에 표시됩니다.
                    </p>
                  </div>
                  {selectedFlowMonth !== 'all' && (
                    <button
                      onClick={() => setSelectedFlowMonth('all')}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0"
                    >
                      전체 월 보기 (선택 해제)
                    </button>
                  )}
                </div>

                <YearlyMonthlyFlowChart
                  data={monthlyFlowData}
                  mode={flowMode}
                  selectedKey={selectedFlowMonth}
                  onSelectKey={(k) => setSelectedFlowMonth(k === 'all' ? 'all' : Number(k))}
                  showLeaverBreakdown={flowMode === 'hires' && includeLeaversInHires}
                />

                {/* 1월 ~ 12월 월별 선택 버튼 그리드 */}
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-2 pt-2">
                  {monthlyFlowData.map((mItem) => {
                    const isSelected = selectedFlowMonth === mItem.key;
                    const hasCount = mItem.total > 0;
                    return (
                      <button
                        key={`month-btn-${mItem.key}`}
                        onClick={() => setSelectedFlowMonth(isSelected ? 'all' : Number(mItem.key))}
                        className={cn(
                          "p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between",
                          isSelected
                            ? flowMode === 'hires'
                              ? "border-blue-600 bg-blue-50/80 ring-2 ring-blue-500/20 shadow-sm"
                              : "border-rose-600 bg-rose-50/80 ring-2 ring-rose-500/20 shadow-sm"
                            : hasCount
                              ? "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                              : "border-slate-100 bg-slate-50/50 opacity-60 hover:opacity-100"
                        )}
                      >
                        <div className="flex items-center justify-between w-full mb-1">
                          <span className={cn(
                            "text-xs font-bold",
                            isSelected
                              ? flowMode === 'hires' ? "text-blue-700" : "text-rose-700"
                              : "text-slate-600"
                          )}>
                            {mItem.label}
                          </span>
                          {flowMode === 'hires' && includeLeaversInHires && (mItem.retiredCount ?? 0) > 0 && (
                            <span className="text-[9px] px-1 py-0.2 bg-rose-50 text-rose-600 border border-rose-200 rounded font-bold">
                              퇴사 {mItem.retiredCount}
                            </span>
                          )}
                        </div>
                        <div className="flex items-baseline justify-between w-full">
                          <span className={cn(
                            "text-base sm:text-lg font-extrabold",
                            isSelected
                              ? flowMode === 'hires' ? "text-blue-700" : "text-rose-700"
                              : hasCount ? "text-slate-900" : "text-slate-400"
                          )}>
                            {mItem.total}<span className="text-[11px] font-semibold ml-0.5">명</span>
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 5. 입/퇴사자 상세 목록 테이블 */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="dashboard-card"
              >
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4 border-b border-slate-100 pb-4">
                  <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                    <h2 className="section-title mb-0 shrink-0">
                      {yearLabel} {monthLabel !== '전체 월' ? monthLabel : ''} {flowMode === 'hires' ? '입사자' : '퇴사자'} 상세 명단
                    </h2>
                    <span className={cn(
                      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border",
                      flowMode === 'hires'
                        ? "bg-blue-50 text-blue-700 border-blue-200"
                        : "bg-rose-50 text-rose-700 border-rose-200"
                    )}>
                      총 {flowFilteredEmployees.length}명
                    </span>

                    <div className="flex flex-wrap items-center gap-2 flex-grow sm:flex-grow-0 ml-0 lg:ml-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                          type="text"
                          placeholder="이름, 본부, 팀, 직급 검색"
                          className="pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-blue-500 w-full sm:w-56 focus:bg-white transition-all shadow-sm h-8"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                        />
                      </div>

                      {flowMode === 'hires' && (
                        <select
                          value={flowProbationFilter}
                          onChange={(e) => setFlowProbationFilter(e.target.value as any)}
                          className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 outline-blue-500 focus:bg-white transition-all shadow-sm cursor-pointer h-8"
                        >
                          <option value="all">수습여부: 전체</option>
                          <option value="수습">수습 진행 중</option>
                          <option value="수습종료">수습종료</option>
                          <option value="수습없음">수습없음</option>
                        </select>
                      )}
                    </div>
                  </div>

                  <span className="text-xs text-slate-400 font-mono shrink-0">
                    {flowMode === 'hires' ? '입사일순 정렬' : '퇴사일순 정렬'} · 조회 인원: {flowFilteredEmployees.length}명
                  </span>
                </div>

                <div className="overflow-x-auto no-scrollbar -mx-4 sm:mx-0 shadow-sm sm:shadow-none border sm:border-0 border-slate-100 rounded-xl sm:rounded-none">
                  <table className="w-full text-xs sm:text-sm border-collapse min-w-full bg-white">
                    <thead>
                      <tr className="border-b border-slate-100 text-left">
                        <th className="px-2.5 py-3 sm:px-4 sm:py-3.5 font-semibold text-slate-500 bg-slate-50/50 text-xs sm:text-sm whitespace-nowrap">
                          {flowMode === 'hires' ? '입사년월' : '퇴사년월'}
                        </th>
                        {renderSortableHeader('성명', 'name', 'left', 'min-w-[80px] text-xs sm:text-sm')}
                        {renderSortableHeader('팀명', 'team', 'left', 'text-xs sm:text-sm')}
                        {renderSortableHeader('직급', 'rank', 'left', 'text-xs sm:text-sm')}
                        {renderSortableHeader('형태', 'employmentType', 'left', 'hidden sm:table-cell text-xs sm:text-sm')}
                        {renderSortableHeader('입사일', 'hireDate', 'left', 'text-xs sm:text-sm')}
                        {(flowMode === 'leavers' || includeLeaversInHires) &&
                          renderSortableHeader('퇴사일', 'resignationDate', 'left', 'hidden sm:table-cell text-xs sm:text-sm')}
                        {renderSortableHeader('재직기간', 'duration', 'left', 'hidden sm:table-cell text-xs sm:text-sm')}
                        {flowMode === 'hires' && (
                          <>
                            <th className="hidden md:table-cell px-2.5 py-3 sm:px-4 sm:py-3.5 font-semibold text-slate-500 bg-slate-50/50 text-xs sm:text-sm whitespace-nowrap">
                              수습만료일
                            </th>
                            <th className="px-2.5 py-3 sm:px-4 sm:py-3.5 font-semibold text-slate-500 bg-slate-50/50 text-center text-xs sm:text-sm whitespace-nowrap">
                              수습현황
                            </th>
                          </>
                        )}
                        {renderSortableHeader('상태', 'status', 'center', 'text-xs sm:text-sm')}
                        <th className="px-2.5 py-3 sm:px-4 sm:py-3.5 font-semibold text-slate-500 bg-slate-50/50 text-right text-xs sm:text-sm whitespace-nowrap">
                          관리
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {flowFilteredEmployees.length === 0 ? (
                        <tr>
                          <td colSpan={11} className="px-6 py-12 text-center text-slate-400 text-sm">
                            해당 조건({yearLabel} {monthLabel !== '전체 월' ? monthLabel : ''})에 해당하는 {flowMode === 'hires' ? '입사자' : '퇴사자'}가 없습니다.
                          </td>
                        </tr>
                      ) : (
                        flowFilteredEmployees
                          .sort((a, b) => {
                            if (sortConfig) {
                              const { key, direction } = sortConfig;
                              let comp = 0;
                              if (key === 'name') comp = a.name.localeCompare(b.name);
                              else if (key === 'team') comp = a.team.localeCompare(b.team);
                              else if (key === 'rank') comp = a.rank.localeCompare(b.rank);
                              else if (key === 'employmentType') comp = (a.employmentType || '').localeCompare(b.employmentType || '');
                              else if (key === 'hireDate') comp = (a.hireDate || '').localeCompare(b.hireDate || '');
                              else if (key === 'resignationDate') comp = (a.resignationDate || '').localeCompare(b.resignationDate || '');
                              else if (key === 'duration') comp = (a.duration || '').localeCompare(b.duration || '');
                              else if (key === 'status') comp = a.status.localeCompare(b.status);
                              if (comp !== 0) return direction === 'asc' ? comp : -comp;
                            }
                            if (flowMode === 'hires') {
                              return (b.hireDate || '').localeCompare(a.hireDate || '');
                            } else {
                              return (b.resignationDate || '').localeCompare(a.resignationDate || '');
                            }
                          })
                          .map((emp, idx) => {
                            const ym = parseYearMonth(flowMode === 'hires' ? emp.hireDate : emp.resignationDate);
                            const ymBadge = ym ? `${ym.year}.${String(ym.month).padStart(2, '0')}` : '-';
                            const probationVal = getProbationStatus(emp);
                            const probationEndDate = calculateProbationEndDate(emp.hireDate, probationVal);
                            const isMidTermLeaver = flowMode === 'hires' && emp.status === '퇴직';

                            return (
                              <tr
                                key={`${emp.id}-${idx}`}
                                className={cn(
                                  "border-b border-slate-50 transition-colors",
                                  isMidTermLeaver
                                    ? "bg-rose-50/20 hover:bg-rose-50/40"
                                    : "hover:bg-slate-50/50"
                                )}
                              >
                                <td className="px-2.5 py-3 sm:px-4 sm:py-3.5 text-xs sm:text-sm font-mono font-bold text-slate-600 whitespace-nowrap">
                                  <span className={cn(
                                    "px-2 py-0.5 rounded-md border text-xs whitespace-nowrap",
                                    flowMode === 'hires'
                                      ? "bg-slate-50 text-slate-700 border-slate-200"
                                      : "bg-rose-50/60 text-rose-700 border-rose-200"
                                  )}>
                                    {ymBadge}
                                  </span>
                                </td>
                                <td className="px-2.5 py-3 sm:px-4 sm:py-3.5 font-bold text-slate-900 text-xs sm:text-sm whitespace-nowrap">
                                  {editingId === emp.id ? (
                                    <input
                                      className="border border-slate-200 rounded px-1.5 py-0.5 w-20 outline-blue-500 focus:bg-white text-xs sm:text-sm"
                                      value={editValues.name || emp.name}
                                      onChange={(e) => setEditValues({ ...editValues, name: e.target.value })}
                                    />
                                  ) : (
                                    <div className="flex flex-col items-start gap-0.5">
                                      <span className="whitespace-nowrap">{emp.name}</span>
                                      {isMidTermLeaver && (
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200 whitespace-nowrap leading-none">
                                          중도퇴사
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </td>
                                <td className="px-2.5 py-3 sm:px-4 sm:py-3.5 text-slate-500 text-xs sm:text-sm whitespace-nowrap">
                                  {formatTeamName(emp.team)}
                                </td>
                                <td className="px-2.5 py-3 sm:px-4 sm:py-3.5 text-slate-500 text-xs sm:text-sm whitespace-nowrap">
                                  {formatRankName(emp.rank)}
                                </td>
                                <td className="hidden sm:table-cell px-2.5 py-3 sm:px-4 sm:py-3.5 text-slate-500 font-semibold text-xs sm:text-sm whitespace-nowrap">
                                  {emp.employmentType || '상용직'}
                                </td>
                                <td className="px-2.5 py-3 sm:px-4 sm:py-3.5 text-slate-600 font-semibold text-xs sm:text-sm whitespace-nowrap">
                                  {editingId === emp.id ? (
                                    <input
                                      className="border border-slate-200 rounded px-1.5 py-0.5 w-24 outline-blue-500 focus:bg-white text-xs sm:text-sm"
                                      value={editValues.hireDate || emp.hireDate}
                                      onChange={(e) => setEditValues({ ...editValues, hireDate: e.target.value })}
                                    />
                                  ) : emp.hireDate}
                                </td>
                                {(flowMode === 'leavers' || includeLeaversInHires) && (
                                  <td className="hidden sm:table-cell px-2.5 py-3 sm:px-4 sm:py-3.5 text-rose-600 font-semibold text-xs sm:text-sm whitespace-nowrap">
                                    {editingId === emp.id ? (
                                      <input
                                        className="border border-slate-200 rounded px-1.5 py-0.5 w-24 outline-blue-500 focus:bg-white text-xs sm:text-sm"
                                        value={editValues.resignationDate ?? emp.resignationDate ?? ''}
                                        onChange={(e) => setEditValues({ ...editValues, resignationDate: e.target.value })}
                                      />
                                    ) : (emp.resignationDate || '-')}
                                  </td>
                                )}
                                <td className="hidden sm:table-cell px-2.5 py-3 sm:px-4 sm:py-3.5 text-blue-600 font-semibold text-xs sm:text-sm whitespace-nowrap">
                                  {formatDuration(emp.duration) || '-'}
                                </td>
                                {flowMode === 'hires' && (
                                  <>
                                    <td className="hidden md:table-cell px-2.5 py-3 sm:px-4 sm:py-3.5 text-slate-500 font-semibold text-xs sm:text-sm whitespace-nowrap">
                                      {emp.status === '퇴직' ? '-' : probationEndDate}
                                    </td>
                                    <td className="px-2.5 py-3 sm:px-4 sm:py-3.5 text-center whitespace-nowrap">
                                      {emp.status === '퇴직' ? (
                                        <span className="text-xs text-slate-400">-</span>
                                      ) : (
                                        <select
                                          className={cn(
                                            "border rounded px-1.5 py-0.5 text-xs font-semibold focus:bg-white outline-none cursor-pointer",
                                            probationVal === '수습' && "bg-amber-50 text-amber-700 border-amber-200",
                                            probationVal === '수습종료' && "bg-emerald-50 text-emerald-700 border-emerald-200",
                                            probationVal === '수습없음' && "bg-slate-100 text-slate-600 border-slate-300"
                                          )}
                                          value={probationVal}
                                          onChange={(e) => handleProbationStatusChange(emp, e.target.value as any)}
                                        >
                                          <option value="수습">수습</option>
                                          <option value="수습종료">수습종료</option>
                                          <option value="수습없음">수습없음</option>
                                        </select>
                                      )}
                                    </td>
                                  </>
                                )}
                                <td className="px-2.5 py-3 sm:px-4 sm:py-3.5 text-center text-xs sm:text-sm whitespace-nowrap">
                                  {editingId === emp.id ? (
                                    <select
                                      className="border border-slate-200 rounded px-1.5 py-0.5 outline-blue-500 text-xs sm:text-sm font-semibold focus:bg-white"
                                      value={editValues.status || emp.status}
                                      onChange={(e) => setEditValues({ ...editValues, status: e.target.value as EmploymentStatus })}
                                    >
                                      <option value="재직">재직</option>
                                      <option value="휴직">휴직</option>
                                      <option value="퇴직">퇴직</option>
                                    </select>
                                  ) : (
                                    <span className={cn(
                                      "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap",
                                      emp.status === '재직'
                                        ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                        : emp.status === '퇴직'
                                          ? "bg-rose-50 text-rose-700 border-rose-100"
                                          : "bg-amber-50 text-amber-700 border-amber-100"
                                    )}>
                                      {emp.status}
                                    </span>
                                  )}
                                </td>
                                <td className="px-2.5 py-3 sm:px-4 sm:py-3.5 text-right text-xs sm:text-sm whitespace-nowrap">
                                  {editingId === emp.id ? (
                                    <div className="flex justify-end gap-1">
                                      <button
                                        onClick={() => handleSaveEdit(emp.id)}
                                        className="text-white hover:bg-blue-700 p-1 sm:p-1.5 bg-blue-600 rounded-lg shadow-sm"
                                      >
                                        <Save size={12} />
                                      </button>
                                      <button
                                        onClick={() => setEditingId(null)}
                                        className="text-slate-400 hover:text-slate-600 p-1 sm:p-1.5 bg-slate-100 rounded-lg text-xs"
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => {
                                        setEditingId(emp.id);
                                        setEditValues(emp);
                                      }}
                                      className="text-xs text-blue-600 hover:text-blue-700 underline font-medium"
                                    >
                                      수정
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            </div>
          );
        })()}

        {activeTab === 'org' && (
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 sm:p-8">
            <div className="w-full space-y-8">
              {/* Top: Organizational Tree */}
              <div className="dashboard-card overflow-hidden hidden sm:block">
                <h3 className="section-title">조직도</h3>
                <div className="bg-slate-50/50 rounded-xl border border-slate-100/50">
                  <OrganizationalTree data={employees.filter(e => e.status !== '퇴직')} />
                </div>
              </div>

              {/* Middle: Tenure Distribution Chart */}
              <div className="dashboard-card">
                <TenureDistributionChart data={employees.filter(e => e.status !== '퇴직')} />
              </div>

              {/* Bottom: Two columns Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="dashboard-card">
                  <h3 className="section-title">조직별 인원 현황 (본사/센터 통합)</h3>
                  <OrganizationChart data={employees.filter(e => e.status !== '퇴직')} />
                </div>
                <div className="dashboard-card">
                  <h3 className="section-title">직급 구성비</h3>
                  <RankChart data={employees.filter(e => e.status !== '퇴직')} />
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
