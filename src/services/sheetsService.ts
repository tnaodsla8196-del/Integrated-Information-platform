import { Employee, EmploymentStatus } from '../types';
import { supabase } from '../lib/supabaseClient';

const SPREADSHEET_ID = '1kHoQPjudplszOtD39wnZHMHGAaEghTNkVuqNjNQf37o';

const MOCK_EMPLOYEES: Employee[] = [
  { id: 'NF210101', name: '류인호', hq: '구매관리본부', team: '임원실', rank: '전무이사', hireDate: '2021/01/01', status: '재직', gender: '남', employmentType: '계약직', totalLeave: 17, usedLeave: 2, remainingLeave: 15, duration: '05년04개월', residentNumber: '750221-1535321', yearsInRank: '임원', remarksType: '선택 없음', remarksMemo: '' },
  { id: 'NF211002', name: '김우석', hq: 'R&D마케팅센터', team: '임원실', rank: '이사', hireDate: '2021/10/01', status: '재직', gender: '남', employmentType: '계약직', totalLeave: 16, usedLeave: 4.5, remainingLeave: 11.5, duration: '04년07개월', residentNumber: '800919-1065934', yearsInRank: '임원', remarksType: '선택 없음', remarksMemo: '' },
  { id: 'NF220301', name: '지수형', hq: '영업관리본부', team: '임원실', rank: '전무이사', hireDate: '2022/03/02', status: '재직', gender: '남', employmentType: '계약직', totalLeave: 16, usedLeave: 0, remainingLeave: 16, duration: '04년02개월', residentNumber: '700127-1634918', yearsInRank: '임원', remarksType: '선택 없음', remarksMemo: '' },
  { id: 'NF230701', name: '이관형', hq: '대표실', team: '임원실', rank: '대표이사', hireDate: '2023/07/03', status: '재직', gender: '남', employmentType: '계약직', totalLeave: 15, usedLeave: 0, remainingLeave: 15, duration: '02년10개월', residentNumber: '680903-1047811', yearsInRank: '임원', remarksType: '선택 없음', remarksMemo: '' }
];

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

const mapDbToEmployee = (db: any): Employee => ({
  id: db.id,
  name: db.name || '',
  hq: db.hq || '',
  team: db.team || '',
  rank: db.rank || '',
  hireDate: db.hire_date || '',
  resignationDate: db.resignation_date || '',
  status: db.status || '재직',
  gender: db.gender || '남',
  employmentType: db.employment_type || '상용직',
  totalLeave: typeof db.total_leave === 'number' ? db.total_leave : parseFloat(db.total_leave || 0),
  usedLeave: typeof db.used_leave === 'number' ? db.used_leave : parseFloat(db.used_leave || 0),
  remainingLeave: typeof db.remaining_leave === 'number' ? db.remaining_leave : parseFloat(db.remaining_leave || 0),
  duration: db.duration || '',
  residentNumber: db.resident_number || '',
  probationStatus: db.probation_status || '수습종료',
  promotionStatus: db.promotion_status || '미대상',
  yearsInRank: db.years_in_rank || '',
  remarksType: db.remarks_type || '선택 없음',
  remarksMemo: db.remarks_memo || '',
});

const mapEmployeeToDb = (emp: Employee): any => ({
  id: emp.id,
  name: emp.name,
  hq: emp.hq,
  team: emp.team,
  rank: emp.rank,
  hire_date: emp.hireDate,
  resignation_date: emp.resignationDate || null,
  status: emp.status,
  gender: emp.gender,
  employment_type: emp.employmentType,
  total_leave: emp.totalLeave || 0,
  used_leave: emp.usedLeave || 0,
  remaining_leave: emp.remainingLeave || 0,
  duration: emp.duration || '',
  resident_number: emp.residentNumber || '',
  probation_status: emp.probationStatus || '수습종료',
  promotion_status: emp.promotionStatus || '미대상',
  years_in_rank: emp.yearsInRank || '',
  remarks_type: emp.remarksType || '선택 없음',
  remarks_memo: emp.remarksMemo || '',
});

const calculateGeneratedLeave = (hireDateStr: string, sheetTotalLeave: number): number => {
  if (!hireDateStr) return sheetTotalLeave;
  
  const normalizedDateStr = hireDateStr.replace(/\./g, '/');
  const hireDate = new Date(normalizedDateStr);
  if (isNaN(hireDate.getTime())) return sheetTotalLeave;

  const today = new Date();
  const hireYear = hireDate.getFullYear();

  const diffYears = today.getFullYear() - hireDate.getFullYear();
  const diffMonths = diffYears * 12 + today.getMonth() - hireDate.getMonth();
  const dayAdjust = today.getDate() < hireDate.getDate() ? -1 : 0;
  const completedMonths = Math.max(0, diffMonths + dayAdjust);

  // 1. 2026년도 입사자: 1개월 만근 시마다 +1일 (최대 11일)
  if (hireYear === 2026) {
    return Math.min(11, completedMonths);
  }

  // 2. 2025년도 입사자 중 1년 미만인 자 (completedMonths < 12)
  if (hireYear === 2025 && completedMonths < 12) {
    return Math.min(11, completedMonths);
  }

  // 3. 그 외 (2025년도 중 1년 이상인 자, 2024년도 및 그 전 입사자): 구글 시트 값 그대로 사용
  return sheetTotalLeave;
};

const getLeaveUsageMap = async (): Promise<Map<string, number>> => {
  const leaveUsageMap = new Map<string, number>();
  const LEAVE_SHEET_ID = '1fsypp6-z5wZ73GhzVNu8FE8EtmVYgv7LVuRzHIaSUUA';
  
  try {
    const targetUrl = `https://docs.google.com/spreadsheets/d/${LEAVE_SHEET_ID}/export?format=csv`;
    const res = await fetch(targetUrl);
    if (!res.ok) throw new Error(`HTTP error fetching leave sheet: ${res.status}`);
    
    const text = await res.text();
    const lines = text.split(/\r?\n/);
    if (lines.length <= 1) return leaveUsageMap;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const row = parseCSVLine(line);
      // Row fields index breakdown:
      // 4: 사용일수, 8: ERP사번, 9: 근태항목, 10: 근태구분, 11: 상태
      if (row.length < 12) continue;

      const useDaysStr = row[4];
      const sapId = (row[8] || '').trim().toLowerCase();
      const category = (row[9] || '').trim();
      const type = (row[10] || '').trim();
      const status = (row[11] || '').trim();

      if (
        sapId &&
        category === '법정휴가' &&
        (type === '연차' || type === '오전반차' || type === '오후반차') &&
        status === '결재종결'
      ) {
        const useDays = parseFloat(useDaysStr);
        if (!isNaN(useDays)) {
          const currentSum = leaveUsageMap.get(sapId) || 0;
          leaveUsageMap.set(sapId, currentSum + useDays);
        }
      }
    }
  } catch (err) {
    console.error('Failed to fetch and parse attendance sheet from Google CSV:', err);
  }
  return leaveUsageMap;
};

const mergeLeaveUsage = async (employees: Employee[]): Promise<Employee[]> => {
  const leaveUsageMap = await getLeaveUsageMap();
  return employees.map(emp => {
    // 사번 대소문자 미스매칭 매핑 보강
    const realUsedLeave = leaveUsageMap.get(emp.id?.toLowerCase()) || 0;
    const calculatedTotal = calculateGeneratedLeave(emp.hireDate, emp.totalLeave);
    const remainingLeave = calculatedTotal - realUsedLeave;
    return {
      ...emp,
      totalLeave: calculatedTotal,
      usedLeave: realUsedLeave,
      remainingLeave: remainingLeave
    };
  });
};

const syncGoogleSheetsToSupabase = async (): Promise<Employee[]> => {
  try {
    const targetUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv`;
    const res = await fetch(targetUrl);
    if (!res.ok) throw new Error('Failed to fetch CSV from Google Sheets');
    
    const text = await res.text();
    const lines = text.split(/\r?\n/);
    if (lines.length <= 1) return [];

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    // Fetch existing records from Supabase to preserve manual edits
    const existingMap = new Map<string, any>();
    if (supabaseUrl && supabaseAnonKey) {
      try {
        const { data: existingRows } = await supabase
          .from('employees')
          .select('*');
        if (existingRows) {
          existingRows.forEach(row => {
            existingMap.set(row.id, row);
          });
        }
      } catch (err) {
        console.error('Failed to fetch existing records for merge:', err);
      }
    } else {
      // Fallback: load existing edits from localStorage to prevent data reset
      try {
        const local = localStorage.getItem('hr_employees');
        if (local) {
          const list = JSON.parse(local) as Employee[];
          list.forEach(emp => {
            existingMap.set(emp.id, {
              remarks_type: emp.remarksType,
              remarks_memo: emp.remarksMemo,
              promotion_status: emp.promotionStatus,
              probation_status: emp.probationStatus,
              status: emp.status,
              employment_type: emp.employmentType,
            });
          });
        }
      } catch (err) {
        console.error('Failed to load local storage for merge:', err);
      }
    }

    const leaveUsageMap = await getLeaveUsageMap();

    const employeesToUpsert: any[] = [];
    const employeesList: Employee[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const row = parseCSVLine(line);
      if (row.length < 8) continue;
      
      const id = row[0] || `EMP-${i}`;
      const genderVal = (row[9] || '남').trim();
      const empTypeVal = (row[14] || '상용직').trim();
      const yearsInRankVal = (row[15] || '').trim();

      const existing = existingMap.get(id);
      const remarksType = existing ? existing.remarks_type : '선택 없음';
      const remarksMemo = existing ? existing.remarks_memo : '';
      const promotionStatus = existing ? existing.promotion_status : undefined;
      const probationStatus = existing ? existing.probation_status : undefined;
      const hasResignationDate = !!(row[6] && row[6].trim());
      const status = hasResignationDate ? '퇴직' : (existing ? existing.status : (((row[7] || '').trim() as EmploymentStatus) || '재직'));
      const employmentType = existing ? existing.employment_type : ((empTypeVal.includes('계약직') ? '계약직' : '상용직') as any);
      
      const usedLeave = leaveUsageMap.get(id.toLowerCase()) || 0;
      const sheetTotalLeave = isNaN(parseFloat(row[10])) ? 0 : parseFloat(row[10]);
      const totalLeave = calculateGeneratedLeave(row[5] || '', sheetTotalLeave);

      const baseEmployee: Employee = {
        id: id,
        name: row[1] || '',
        hq: row[2] || '',
        team: row[3] || '',
        rank: row[4] || '',
        hireDate: row[5] || '',
        resignationDate: row[6] || '',
        status: status,
        duration: row[8] || '',
        gender: (genderVal === '여' ? '여' : '남') as any,
        totalLeave: totalLeave,
        usedLeave: usedLeave,
        remainingLeave: totalLeave - usedLeave,
        residentNumber: row[14] || '',
        employmentType: employmentType,
        yearsInRank: yearsInRankVal,
        remarksType: remarksType,
        remarksMemo: remarksMemo,
        promotionStatus: promotionStatus,
        probationStatus: probationStatus,
      };

      employeesList.push(baseEmployee);
      employeesToUpsert.push(mapEmployeeToDb(baseEmployee));
    }

    if (supabaseUrl && supabaseAnonKey && employeesToUpsert.length > 0) {
      const { error } = await supabase
        .from('employees')
        .upsert(employeesToUpsert, { onConflict: 'id' });
      
      if (error) {
        console.error('Error upserting synced data to Supabase:', error);
      } else {
        console.log('Successfully synced Sheets data to Supabase!');
      }
    }

    return employeesList;
  } catch (error) {
    console.error('Failed to sync from Google Sheets:', error);
    throw error;
  }
};

export const fetchEmployeesFromSheets = async (
  accessToken: string,
  forceSync: boolean = false
): Promise<Employee[]> => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase credentials not set. Fetching directly from Google Sheets with localStorage fallback.');
    try {
      const list = await syncGoogleSheetsToSupabase();
      const mergedList = await mergeLeaveUsage(list);
      localStorage.setItem('hr_employees', JSON.stringify(mergedList));
      return mergedList;
    } catch (error) {
      console.error('Failed direct Sheets fetch fallback:', error);
      const local = localStorage.getItem('hr_employees');
      if (local) return JSON.parse(local);
      return MOCK_EMPLOYEES;
    }
  }

  try {
    const list = await syncGoogleSheetsToSupabase();
    return await mergeLeaveUsage(list);
  } catch (error) {
    console.error('Error auto-syncing from Sheets, falling back to cached Supabase data:', error);
    try {
      const { data, error: dbError } = await supabase
        .from('employees')
        .select('*')
        .order('name');

      if (dbError) throw dbError;

      const list = data.map(mapDbToEmployee);
      const mergedList = await mergeLeaveUsage(list);
      localStorage.setItem('hr_employees', JSON.stringify(mergedList));
      return mergedList;
    } catch (fallbackError) {
      console.error('Fallback fetch from Supabase failed:', fallbackError);
      const local = localStorage.getItem('hr_employees');
      if (local) return JSON.parse(local);
      return MOCK_EMPLOYEES;
    }
  }
};

export const updateEmployeeInSheets = async (
  accessToken: string,
  employee: Employee,
  index: number
): Promise<void> => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const local = localStorage.getItem('hr_employees');
  if (local) {
    const list = JSON.parse(local) as Employee[];
    const idx = list.findIndex(e => e.id === employee.id);
    if (idx !== -1) {
      list[idx] = employee;
      localStorage.setItem('hr_employees', JSON.stringify(list));
    }
  }

  if (!supabaseUrl || !supabaseAnonKey) return;

  try {
    const dbData = mapEmployeeToDb(employee);
    const { error } = await supabase
      .from('employees')
      .upsert(dbData, { onConflict: 'id' });

    if (error) throw error;
  } catch (error) {
    console.error('Error in updateEmployeeInSheets:', error);
    throw error;
  }
};

export const bulkUpdateEmployeesInSheets = async (
  accessToken: string,
  employees: Employee[]
): Promise<void> => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  localStorage.setItem('hr_employees', JSON.stringify(employees));

  if (!supabaseUrl || !supabaseAnonKey) return;

  try {
    const dbData = employees.map(mapEmployeeToDb);
    const { error } = await supabase
      .from('employees')
      .upsert(dbData, { onConflict: 'id' });

    if (error) throw error;
  } catch (error) {
    console.error('Error in bulkUpdateEmployeesInSheets:', error);
    throw error;
  }
};
