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

const syncGoogleSheetsToSupabase = async (): Promise<Employee[]> => {
  try {
    const targetUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv`;
    const res = await fetch(targetUrl);
    if (!res.ok) throw new Error('Failed to fetch CSV from Google Sheets');
    
    const text = await res.text();
    const lines = text.split(/\r?\n/);
    if (lines.length <= 1) return [];

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

      const baseEmployee: Employee = {
        id: id,
        name: row[1] || '',
        hq: row[2] || '',
        team: row[3] || '',
        rank: row[4] || '',
        hireDate: row[5] || '',
        resignationDate: row[6] || '',
        status: ((row[7] || '').trim() as EmploymentStatus) || '재직',
        duration: row[8] || '',
        gender: (genderVal === '여' ? '여' : '남') as any,
        totalLeave: isNaN(parseFloat(row[10])) ? 0 : parseFloat(row[10]),
        usedLeave: isNaN(parseFloat(row[11])) ? 0 : parseFloat(row[11]),
        remainingLeave: isNaN(parseFloat(row[12])) ? 0 : parseFloat(row[12]),
        residentNumber: row[14] || '',
        employmentType: (empTypeVal.includes('계약직') ? '계약직' : '상용직') as any,
        yearsInRank: yearsInRankVal,
        remarksType: '선택 없음',
        remarksMemo: '',
      };

      employeesList.push(baseEmployee);
      employeesToUpsert.push(mapEmployeeToDb(baseEmployee));
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
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
    console.warn('Supabase credentials not set. Falling back to local storage.');
    const local = localStorage.getItem('hr_employees');
    if (local) return JSON.parse(local);
    localStorage.setItem('hr_employees', JSON.stringify(MOCK_EMPLOYEES));
    return MOCK_EMPLOYEES;
  }

  try {
    if (forceSync) {
      return await syncGoogleSheetsToSupabase();
    }

    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .order('name');

    if (error) throw error;

    if (!data || data.length === 0) {
      return await syncGoogleSheetsToSupabase();
    }

    const list = data.map(mapDbToEmployee);
    localStorage.setItem('hr_employees', JSON.stringify(list));
    return list;
  } catch (error) {
    console.error('Error in fetchEmployeesFromSheets:', error);
    const local = localStorage.getItem('hr_employees');
    if (local) return JSON.parse(local);
    return MOCK_EMPLOYEES;
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
