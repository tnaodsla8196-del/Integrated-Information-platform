export type Rank = 'CEO' | '이사' | '리드' | '매니저' | '시니어' | '주니어';
export type EmploymentStatus = '재직' | '휴직' | '퇴직';
export type Gender = '남' | '여';
export type EmploymentType = '상용직' | '계약직' | '파견직';
export type ProbationStatus = '수습' | '수습종료' | '수습없음';

export interface Employee {
  id: string;
  name: string;
  hq: string; // 본부
  team: string; // 팀명
  rank: string; // 직급 (flexible string for different ranks)
  hireDate: string;
  resignationDate?: string;
  status: EmploymentStatus;
  gender: Gender;
  employmentType: EmploymentType;
  totalLeave?: number;
  usedLeave?: number;
  remainingLeave?: number;
  duration?: string;
  residentNumber?: string;
  probationStatus?: ProbationStatus;
  promotionStatus?: '대상' | '제외' | '완료' | '미대상' | '승진' | string;
  yearsInRank?: string;
  remarksType?: '선택 없음' | '출산휴가' | '육아휴직' | '기타';
  remarksMemo?: string;
}

export interface HRKPI {
  month: string;
  turnoverRate: number;
  retentionRate: number;
  hiringSatisfaction: number;
}
