import { Employee, EmploymentStatus, HRKPI } from '../types';

const hqs = [
  '경영관리본부', '영업관리본부', 'R&D마케팅센터', '구매관리본부', '직영점', 
  '서울경기1센터', '서울경기2센터', '충청센터', '호남센터', '경북센터', '부산경남센터'
];
const teams = ['관리팀', '운영팀', '영업팀', '기획팀', '지원팀'];
const ranks = ['대표이사', '전무이사', '이사', '상무이사', '센터장', '수석매니저', '책임매니저', '선임매니저', '매니저', '사원(직영)'];
const names = ['김철수', '이영희', '박지민', '최수호', '정다은', '강민호', '윤서연', '한지후', '오유진', '임도윤'];

export const generateEmployees = (count: number): Employee[] => {
  const employees: Employee[] = [];
  for (let i = 0; i < count; i++) {
    const hqIdx = Math.floor(Math.random() * hqs.length);
    const teamIdx = Math.floor(Math.random() * teams.length);
    const statusIdx = Math.random() > 0.1 ? 0 : Math.floor(Math.random() * 2) + 1; 
    const statuses: EmploymentStatus[] = ['재직', '휴직', '퇴직'];
    
    let rank = ranks[Math.floor(Math.random() * ranks.length)];
    if (i === 0) rank = 'CEO'; 

    const now = new Date();
    
    let finalHireDate: string;
    if (i < 5) {
      const day = 1 + Math.floor(Math.random() * 20);
      finalHireDate = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    } else {
      const hireYear = 2020 + Math.floor(Math.random() * 6);
      const hireMonth = 1 + Math.floor(Math.random() * 12);
      const hireDay = 1 + Math.floor(Math.random() * 28);
      finalHireDate = `${hireYear}-${hireMonth.toString().padStart(2, '0')}-${hireDay.toString().padStart(2, '0')}`;
    }

    employees.push({
      id: `EMP-${(i + 1).toString().padStart(3, '0')}`,
      name: `${names[Math.floor(Math.random() * names.length)]}${i}`,
      hq: hqs[hqIdx],
      team: teams[teamIdx],
      rank: rank,
      status: statuses[statusIdx],
      hireDate: finalHireDate,
      gender: Math.random() > 0.5 ? '남' : '여',
      employmentType: Math.random() > 0.2 ? '상용직' : '계약직',
    });
  }
  return employees;
};

export const employees = generateEmployees(150);

export const hrKPIs: HRKPI[] = [
  { month: '1월', turnoverRate: 1.2, retentionRate: 98, hiringSatisfaction: 4.2 },
  { month: '2월', turnoverRate: 0.8, retentionRate: 99, hiringSatisfaction: 4.5 },
  { month: '3월', turnoverRate: 1.5, retentionRate: 97, hiringSatisfaction: 4.0 },
  { month: '4월', turnoverRate: 0.5, retentionRate: 99.5, hiringSatisfaction: 4.8 },
  { month: '5월', turnoverRate: 1.0, retentionRate: 98.5, hiringSatisfaction: 4.3 },
];
