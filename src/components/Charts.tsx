import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, LabelList 
} from 'recharts';
import { Employee } from '../types';
import { cn } from '../lib/utils';
import { useState } from 'react';
import { X } from 'lucide-react';

const getTeamColor = (index: number) => {
  const colors = [
    '#3B82F6', '#60A5FA', '#93C5FD', '#F59E0B', '#10B981', 
    '#94A3B8', '#F43F5E', '#8B5CF6', '#EC4899', '#14B8A6'
  ];
  return colors[index % colors.length];
};

const RANK_COLORS = ['#1D4ED8', '#3B82F6', '#60A5FA', '#93C5FD', '#BFDBFE', '#DBEAFE', '#EFF6FF'];

const LeftAlignedTick = (props: any) => {
  const { y, payload } = props;
  return (
    <text
      x={6}
      y={y}
      dy={4}
      textAnchor="start"
      fill="#475569"
      className="text-[9px] sm:text-[11px] font-bold"
    >
      {payload.value}
    </text>
  );
};

export const OrganizationalTree = ({ data }: { data: Employee[] }) => {
  // Helper to group teams by HQ
  const hqStructure = {
    '영업관리본부': [
      '창업지원팀', '운영지원팀', '교육팀', 
      '서울경기1센터', '서울경기2센터', '충청센터', 
      '호남센터', '경북센터', '부산경남센터'
    ],
    '구매관리본부': ['원자재팀', '부자재팀', '품질팀'],
    '경영관리본부': ['회계세무팀', '인사자금팀', '총무팀', '기획법무팀', '해외사업팀'],
    'R&D마케팅센터': ['연구개발팀', '마케팅팀', '직영팀']
  };

  return (
    <div className="w-full overflow-x-auto no-scrollbar py-6 sm:py-12 px-2 sm:px-4 font-sans">
      <div className="flex flex-col items-center min-w-[750px] sm:min-w-[1000px] relative origin-top scale-[0.7] sm:scale-100 mb-[-150px] sm:mb-0">
        
        {/* CEO Row */}
        <div className="mb-12 sm:mb-16 relative">
          <div className="bg-[#FFD43B] text-slate-800 px-8 sm:px-12 py-3 sm:py-4 rounded shadow-md font-extrabold text-base sm:text-xl border border-slate-200">
            대표이사
          </div>
          <div className="absolute left-1/2 bottom-[-48px] sm:bottom-[-64px] w-px h-12 sm:h-16 bg-slate-300"></div>
        </div>

        {/* HQs Row */}
        <div className="w-full flex justify-between relative px-2 sm:px-4 gap-4 sm:gap-8">
          {/* Horizontal connecting line for HQs */}
          <div className="absolute top-0 left-[10%] right-[10%] h-px bg-slate-300"></div>
          
          {Object.entries(hqStructure).map(([hq, teams]) => (
            <div key={hq} className="flex-1 flex flex-col items-center relative pt-12 sm:pt-16">
              {/* Vertical line from main line to node */}
              <div className="absolute top-0 left-1/2 w-px h-12 sm:h-16 bg-slate-300"></div>
              
              {/* HQ Node */}
              <div className="bg-[#FFD43B] text-slate-800 px-2 sm:px-4 py-2 sm:py-3 rounded shadow-sm font-bold text-[10px] sm:text-sm mb-4 sm:mb-6 w-full text-center border border-slate-200">
                {hq}
              </div>

              {/* Teams List (Vertical with connector) */}
              <div className="flex flex-col items-start w-full pl-2 sm:pl-4 space-y-1.5 sm:space-y-2 relative border-l border-slate-300">
                {teams.map((team) => (
                  <div key={team} className="relative w-full pl-4 sm:pl-6">
                    {/* Horizontal connector to team box */}
                    <div className="absolute top-1/2 left-0 w-4 sm:w-6 h-px bg-slate-300"></div>
                    <div className={cn(
                      "bg-[#F1F5F9] border border-slate-200 px-2 py-1.5 sm:px-3 sm:py-2 rounded text-[9px] sm:text-[11px] text-slate-700 font-bold text-center shadow-sm w-full",
                      team.includes('센터') ? "bg-white border-blue-100 text-blue-700" : ""
                    )}>
                      {team}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const OrganizationChart = ({ data }: { data: Employee[] }) => {
  const allList = [
    '경영관리본부', '영업관리본부', 'R&D마케팅센터', '구매관리본부', '직영점',
    '서울경기1센터', '서울경기2센터', '충청센터', '호남센터', '경북센터', '부산경남센터'
  ];
  
  const counts = data.reduce((acc, emp) => {
    if (allList.includes(emp.hq)) {
      acc[emp.hq] = (acc[emp.hq] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const chartData = allList.map((name, index) => ({
    name,
    value: counts[name] || 0,
    fill: getTeamColor(index)
  })).filter(d => d.value > 0).sort((a, b) => b.value - a.value);

  return (
    <div className="h-[300px] sm:h-[450px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={chartData}
          margin={{ top: 5, right: 45, left: window.innerWidth < 640 ? 4 : 10, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#F1F5F9" />
          <XAxis type="number" hide />
          <YAxis 
            dataKey="name" 
            type="category" 
            axisLine={false} 
            tickLine={false}
            tick={<LeftAlignedTick />}
            width={window.innerWidth < 640 ? 80 : 125}
            interval={0}
          />
          <Tooltip 
            cursor={{ fill: '#F8FAFC' }}
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
            <LabelList 
              dataKey="value" 
              position="right" 
              formatter={(val: number) => `${val}명`}
              style={{ fontSize: 10, fontWeight: 600, fill: '#64748B' }}
              offset={10}
            />
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export const HQChart = ({ data }: { data: Employee[] }) => {
  const hqList = ['경영관리본부', '영업관리본부', 'R&D마케팅센터', '구매관리본부', '직영점'];
  
  const counts = data.reduce((acc, emp) => {
    if (hqList.includes(emp.hq)) {
      acc[emp.hq] = (acc[emp.hq] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const chartData = hqList.map((name, index) => ({
    name,
    value: counts[name] || 0,
    fill: getTeamColor(index)
  })).filter(d => d.value > 0);

  return (
    <div className="h-[220px] sm:h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={chartData}
          margin={{ top: 5, right: 60, left: window.innerWidth < 640 ? 4 : 10, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#F1F5F9" />
          <XAxis type="number" hide />
          <YAxis 
            dataKey="name" 
            type="category" 
            axisLine={false} 
            tickLine={false}
            tick={<LeftAlignedTick />}
            width={window.innerWidth < 640 ? 80 : 125}
            interval={0}
          />
          <Tooltip 
            cursor={{ fill: '#F8FAFC' }}
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
            <LabelList 
              dataKey="value" 
              position="right" 
              formatter={(val: number) => `${val}명`}
              style={{ fontSize: 10, fontWeight: 600, fill: '#64748B' }}
              offset={10}
            />
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export const CenterChart = ({ data }: { data: Employee[] }) => {
  const centerList = ['서울경기1센터', '서울경기2센터', '충청센터', '호남센터', '경북센터', '부산경남센터'];
  
  const counts = data.reduce((acc, emp) => {
    if (centerList.includes(emp.hq)) {
      acc[emp.hq] = (acc[emp.hq] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const chartData = centerList.map((name, index) => ({
    name,
    value: counts[name] || 0,
    fill: getTeamColor(index + 5)
  })).filter(d => d.value > 0);

  return (
    <div className="h-[220px] sm:h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={chartData}
          margin={{ top: 5, right: 60, left: window.innerWidth < 640 ? 4 : 10, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#F1F5F9" />
          <XAxis type="number" hide />
          <YAxis 
            dataKey="name" 
            type="category" 
            axisLine={false} 
            tickLine={false}
            tick={<LeftAlignedTick />}
            width={window.innerWidth < 640 ? 80 : 125}
            interval={0}
          />
          <Tooltip 
            cursor={{ fill: '#F8FAFC' }}
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
            <LabelList 
              dataKey="value" 
              position="right" 
              formatter={(val: number) => `${val}명`}
              style={{ fontSize: 10, fontWeight: 600, fill: '#64748B' }}
              offset={10}
            />
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export const RankChart = ({ data }: { data: Employee[] }) => {
  const categories = [
    { name: '임원', ranks: ['대표이사', '전무이사', '이사', '상무이사', '전무', '상무'] },
    { name: '센터장', ranks: ['센터장'] },
    { name: window.innerWidth < 640 ? '수석' : '수석매니저', ranks: ['수석매니저'] },
    { name: window.innerWidth < 640 ? '책임' : '책임매니저', ranks: ['책임매니저'] },
    { name: window.innerWidth < 640 ? '선임' : '선임매니저', ranks: ['선임매니저'] },
    { name: '매니저', ranks: ['매니저'] },
    { name: '직영점', isSpecial: (r: string) => r.includes('(직영)') },
  ];

  const groupedCounts = data.reduce((acc, emp) => {
    const rank = emp.rank || '';
    let categoryFound = false;
    
    for (const cat of categories) {
      if (cat.ranks?.includes(rank) || cat.isSpecial?.(rank)) {
        acc[cat.name] = (acc[cat.name] || 0) + 1;
        categoryFound = true;
        break;
      }
    }
    
    if (!categoryFound) {
      acc['기타'] = (acc['기타'] || 0) + 1;
    }
    
    return acc;
  }, {} as Record<string, number>);

  const chartData = categories.map(cat => ({
    name: cat.name,
    value: groupedCounts[cat.name] || 0
  })).filter(d => d.value > 0);

  if (groupedCounts['기타']) {
    chartData.push({ name: '기타', value: groupedCounts['기타'] });
  }

  const maleCount = data.filter(e => e.gender === '남').length;
  const femaleCount = data.filter(e => e.gender === '여').length;
  const total = maleCount + femaleCount || data.length || 1;
  const malePercent = Math.round((maleCount / total) * 100);
  const femalePercent = Math.round((femaleCount / total) * 100);

  return (
    <div className="w-full flex flex-col gap-5">
      <div className="w-full flex flex-col sm:flex-row items-center justify-center relative">
        <div className="h-[320px] sm:h-[280px] w-full sm:w-[65%] flex items-center justify-center relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={window.innerWidth < 640 ? 60 : 70}
                outerRadius={window.innerWidth < 640 ? 80 : 100}
                paddingAngle={2}
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={RANK_COLORS[index % RANK_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  borderRadius: '8px', 
                  border: 'none', 
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  fontSize: '12px'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute top-[50%] left-[50%] -translate-x-[50%] -translate-y-[50%] text-center pointer-events-none flex flex-col items-center">
            <p className="text-[10px] text-slate-400 font-bold leading-none uppercase">인원</p>
            <p className="text-xl sm:text-2xl font-bold text-slate-900">{data.length}</p>
          </div>
        </div>

        {window.innerWidth >= 640 && (
          <div className="flex flex-col gap-2 pl-4 sm:w-[35%]">
            {chartData.map((entry, index) => (
              <div key={entry.name} className="flex items-center gap-2">
                <div 
                  className="w-2 h-2 rounded-full" 
                  style={{ backgroundColor: RANK_COLORS[index % RANK_COLORS.length] }}
                />
                <span className="text-xs font-medium text-slate-500">
                  {entry.name} <span className="ml-1 font-bold text-slate-900">{entry.value}명</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Gender Distribution */}
      <div className="pt-4 border-t border-slate-100 w-full">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-slate-700">성별 인원 분포 (남 / 여)</span>
          <div className="flex gap-4 text-[11px] font-semibold">
            <span className="text-blue-600 flex items-center gap-1">
              남성 <span className="text-slate-900">{maleCount}명</span> ({malePercent}%)
            </span>
            <span className="text-rose-500 flex items-center gap-1">
              여성 <span className="text-slate-900">{femaleCount}명</span> ({femalePercent}%)
            </span>
          </div>
        </div>
        <div className="w-full h-2.5 bg-slate-100 rounded-full flex overflow-hidden">
          <div 
            className="bg-blue-500 h-full transition-all duration-300" 
            style={{ width: `${malePercent}%` }} 
          />
          <div 
            className="bg-rose-400 h-full transition-all duration-300" 
            style={{ width: `${femalePercent}%` }} 
          />
        </div>
      </div>
    </div>
  );
};

export const TenureDistributionChart = ({ data }: { data: Employee[] }) => {
  const [selectedHq, setSelectedHq] = useState<string>('전체');
  const [selectedType, setSelectedType] = useState<string>('전체');
  const [selectedBucket, setSelectedBucket] = useState<string>('전체');

  // Extract unique HQs
  const hqList = Array.from(new Set(data.map(e => e.hq).filter(Boolean))).sort();

  // Filter data
  const filteredData = data.filter(emp => {
    if (selectedHq !== '전체' && emp.hq !== selectedHq) return false;
    if (selectedType !== '전체' && emp.employmentType !== selectedType) return false;
    return true;
  });

  const calculateTenureYears = (hireDateStr: string): number => {
    if (!hireDateStr) return 0;
    const hireDate = new Date(hireDateStr.replace(/\./g, '/'));
    if (isNaN(hireDate.getTime())) return 0;
    const today = new Date();
    const diffDays = (today.getTime() - hireDate.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays / 365.25;
  };

  const getTenureBucket = (years: number): string => {
    if (years < 1) return '1년 미만';
    const intYears = Math.floor(years);
    if (intYears >= 10) return '10년 이상';
    return `${intYears}년`;
  };

  const BUCKETS = [
    '1년 미만', '1년', '2년', '3년', '4년', '5년', '6년', '7년', '8년', '9년', '10년 이상'
  ];

  const BUCKET_COLORS: Record<string, string> = {
    '1년 미만': '#60A5FA',
    '1년': '#3B82F6',
    '2년': '#2563EB',
    '3년': '#1D4ED8',
    '4년': '#0D9488',
    '5년': '#059669',
    '6년': '#F59E0B',
    '7년': '#D97706',
    '8년': '#EA580C',
    '9년': '#DC2626',
    '10년 이상': '#7C3AED',
  };

  // Group counts
  const bucketCounts = filteredData.reduce((acc, emp) => {
    const years = calculateTenureYears(emp.hireDate);
    const bucket = getTenureBucket(years);
    acc[bucket] = (acc[bucket] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const totalFiltered = filteredData.length || 1;
  const totalYears = filteredData.reduce((sum, e) => sum + calculateTenureYears(e.hireDate), 0);
  const avgTenure = filteredData.length > 0 ? (totalYears / filteredData.length).toFixed(1) : '0';

  // Chart data: keep buckets with values
  const chartData = BUCKETS.map(name => ({
    name,
    value: bucketCounts[name] || 0,
    percentage: Math.round(((bucketCounts[name] || 0) / totalFiltered) * 100),
    fill: BUCKET_COLORS[name] || '#3B82F6'
  })).filter(d => d.value > 0);

  // Bucket details for selected drill-down
  const bucketEmployees = selectedBucket === '전체' 
    ? [] 
    : filteredData.filter(emp => getTenureBucket(calculateTenureYears(emp.hireDate)) === selectedBucket);

  return (
    <div className="w-full space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h3 className="section-title mb-0">재직기간별 인원 현황 및 분포도</h3>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded-lg text-xs font-bold">
              평균 근속 <span className="text-blue-900">{avgTenure}년</span>
            </span>
            <span className="text-xs text-slate-400 font-semibold">
              (총 {filteredData.length}명)
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            입사일 기준 근속 연수별 인원 분포와 조직별 현황을 분석합니다.
          </p>
        </div>

        {/* Filter dropdowns */}
        <div className="flex flex-wrap items-center gap-2">
          {/* HQ Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs">
            <span className="text-slate-400 font-medium">조직:</span>
            <select
              value={selectedHq}
              onChange={(e) => {
                setSelectedHq(e.target.value);
                setSelectedBucket('전체');
              }}
              className="bg-transparent font-semibold text-slate-700 outline-none cursor-pointer"
            >
              <option value="전체">전체 조직 ({data.length}명)</option>
              {hqList.map(hq => (
                <option key={hq} value={hq}>{hq} ({data.filter(e => e.hq === hq).length}명)</option>
              ))}
            </select>
          </div>

          {/* Employment Type Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs">
            <span className="text-slate-400 font-medium">형태:</span>
            <select
              value={selectedType}
              onChange={(e) => {
                setSelectedType(e.target.value);
                setSelectedBucket('전체');
              }}
              className="bg-transparent font-semibold text-slate-700 outline-none cursor-pointer"
            >
              <option value="전체">전체 형태</option>
              <option value="상용직">상용직</option>
              <option value="계약직">계약직</option>
              <option value="파견직">파견직</option>
            </select>
          </div>

          {/* Reset button */}
          {(selectedHq !== '전체' || selectedType !== '전체' || selectedBucket !== '전체') && (
            <button
              onClick={() => {
                setSelectedHq('전체');
                setSelectedType('전체');
                setSelectedBucket('전체');
              }}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
            >
              <X size={12} />
              초기화
            </button>
          )}
        </div>
      </div>

      {/* Tenure Bucket Summary Chips Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-11 gap-2">
        {BUCKETS.map(bucket => {
          const count = bucketCounts[bucket] || 0;
          const pct = Math.round((count / totalFiltered) * 100);
          const isSelected = selectedBucket === bucket;
          const color = BUCKET_COLORS[bucket] || '#3B82F6';

          return (
            <button
              key={bucket}
              onClick={() => setSelectedBucket(isSelected ? '전체' : bucket)}
              className={cn(
                "p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between relative overflow-hidden",
                isSelected 
                  ? "border-blue-500 bg-blue-50/70 shadow-sm ring-2 ring-blue-500/20" 
                  : count > 0 
                    ? "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50" 
                    : "border-slate-100 bg-slate-50/50 opacity-60"
              )}
            >
              <div className="flex items-center justify-between w-full mb-1">
                <span className="text-[11px] font-semibold text-slate-600 truncate">{bucket}</span>
                <span 
                  className="w-2 h-2 rounded-full shrink-0" 
                  style={{ backgroundColor: color }}
                />
              </div>
              <div className="flex items-baseline justify-between w-full">
                <span className={cn(
                  "text-lg font-bold",
                  isSelected ? "text-blue-700" : count > 0 ? "text-slate-800" : "text-slate-400"
                )}>
                  {count}<span className="text-xs font-medium ml-0.5">명</span>
                </span>
                <span className="text-[10px] font-semibold text-slate-400">{pct}%</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Charts Grid: Bar Chart & Donut Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Bar Chart (7 Cols) */}
        <div className="lg:col-span-7 bg-slate-50/50 rounded-xl border border-slate-100 p-4 sm:p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-xs font-bold text-slate-700">근속 연수별 인원 분포 (막대 차트)</h4>
              <p className="text-[11px] text-slate-400">구간별 인원수 분포 현황</p>
            </div>
            {selectedBucket !== '전체' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-md">
                선택: {selectedBucket} ({bucketCounts[selectedBucket] || 0}명)
              </span>
            )}
          </div>

          <div className="h-[280px] sm:h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 20, right: 10, left: -15, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 11, fontWeight: 600, fill: '#64748B' }}
                  interval={0}
                  angle={window.innerWidth < 640 ? -35 : 0}
                  textAnchor={window.innerWidth < 640 ? 'end' : 'middle'}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#94A3B8' }}
                  allowDecimals={false}
                />
                <Tooltip 
                  cursor={{ fill: '#E2E8F0', opacity: 0.4 }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      return (
                        <div className="bg-white p-3 rounded-lg shadow-lg border border-slate-100 text-xs">
                          <p className="font-bold text-slate-800 mb-1">{d.name}</p>
                          <p className="text-blue-600 font-semibold">인원: <span className="text-slate-900">{d.value}명</span> ({d.percentage}%)</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar 
                  dataKey="value" 
                  radius={[4, 4, 0, 0]} 
                  barSize={window.innerWidth < 640 ? 18 : 28}
                  onClick={(entry) => setSelectedBucket(selectedBucket === entry.name ? '전체' : entry.name)}
                  className="cursor-pointer"
                >
                  <LabelList 
                    dataKey="value" 
                    position="top" 
                    formatter={(val: number) => `${val}명`}
                    style={{ fontSize: 11, fontWeight: 700, fill: '#334155' }}
                    offset={5}
                  />
                  {chartData.map((entry) => (
                    <Cell 
                      key={`cell-${entry.name}`} 
                      fill={entry.fill} 
                      opacity={selectedBucket === '전체' || selectedBucket === entry.name ? 1 : 0.4}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right: Pie/Donut Chart (5 Cols) */}
        <div className="lg:col-span-5 bg-slate-50/50 rounded-xl border border-slate-100 p-4 sm:p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h4 className="text-xs font-bold text-slate-700">근속 연수별 비율 구성</h4>
              <p className="text-[11px] text-slate-400">전체 인원 대비 구성비</p>
            </div>
          </div>

          <div className="w-full flex flex-col items-center justify-center relative">
            <div className="h-[240px] sm:h-[260px] w-full flex items-center justify-center relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={window.innerWidth < 640 ? 60 : 70}
                    outerRadius={window.innerWidth < 640 ? 85 : 100}
                    paddingAngle={2}
                    dataKey="value"
                    onClick={(entry) => setSelectedBucket(selectedBucket === entry.name ? '전체' : entry.name)}
                    className="cursor-pointer"
                  >
                    {chartData.map((entry) => (
                      <Cell 
                        key={`donut-${entry.name}`} 
                        fill={entry.fill} 
                        opacity={selectedBucket === '전체' || selectedBucket === entry.name ? 1 : 0.4}
                      />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      borderRadius: '8px', 
                      border: 'none', 
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      fontSize: '12px'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute top-[50%] left-[50%] -translate-x-[50%] -translate-y-[50%] text-center pointer-events-none flex flex-col items-center">
                <p className="text-[10px] text-slate-400 font-bold leading-none uppercase">평균 근속</p>
                <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5">{avgTenure}년</p>
              </div>
            </div>

            {/* Custom Legend */}
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 pt-2 border-t border-slate-200/60 w-full max-h-[120px] overflow-y-auto no-scrollbar">
              {chartData.map((entry) => (
                <button
                  key={`legend-${entry.name}`}
                  onClick={() => setSelectedBucket(selectedBucket === entry.name ? '전체' : entry.name)}
                  className={cn(
                    "flex items-center gap-1.5 text-xs transition-opacity cursor-pointer px-1.5 py-0.5 rounded",
                    selectedBucket === entry.name ? "bg-blue-100/70 font-bold" : "opacity-80 hover:opacity-100"
                  )}
                >
                  <div 
                    className="w-2.5 h-2.5 rounded-full shrink-0" 
                    style={{ backgroundColor: entry.fill }}
                  />
                  <span className="text-slate-600">{entry.name}</span>
                  <span className="font-bold text-slate-900">({entry.value}명)</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Drill-down Employee Detail Table when a Bucket is selected */}
      {selectedBucket !== '전체' && (
        <div className="bg-slate-50/70 rounded-xl border border-blue-100 p-4 sm:p-5 transition-all">
          <div className="flex items-center justify-between mb-4 border-b border-slate-200/60 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: BUCKET_COLORS[selectedBucket] || '#3B82F6' }} />
              <h4 className="text-sm font-bold text-slate-800">
                '{selectedBucket}' 해당 인원 목록 ({bucketEmployees.length}명)
              </h4>
            </div>
            <button
              onClick={() => setSelectedBucket('전체')}
              className="text-xs text-slate-500 hover:text-slate-800 font-semibold flex items-center gap-1 cursor-pointer"
            >
              <X size={14} />
              닫기
            </button>
          </div>

          <div className="overflow-x-auto no-scrollbar bg-white rounded-lg border border-slate-200/60 shadow-sm">
            <table className="w-full text-xs sm:text-sm border-collapse min-w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-left font-semibold text-slate-500">
                  <th className="px-3 py-2.5 sm:px-4 sm:py-3">성명</th>
                  <th className="px-3 py-2.5 sm:px-4 sm:py-3">본부</th>
                  <th className="px-3 py-2.5 sm:px-4 sm:py-3">팀명</th>
                  <th className="px-3 py-2.5 sm:px-4 sm:py-3">직급</th>
                  <th className="px-3 py-2.5 sm:px-4 sm:py-3">형태</th>
                  <th className="px-3 py-2.5 sm:px-4 sm:py-3">입사일</th>
                  <th className="px-3 py-2.5 sm:px-4 sm:py-3">상세 재직기간</th>
                </tr>
              </thead>
              <tbody>
                {bucketEmployees.map((emp, idx) => (
                  <tr key={`${emp.id}-${idx}`} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="px-3 py-2.5 sm:px-4 sm:py-3 font-semibold text-slate-900">{emp.name}</td>
                    <td className="px-3 py-2.5 sm:px-4 sm:py-3 text-slate-600">{emp.hq}</td>
                    <td className="px-3 py-2.5 sm:px-4 sm:py-3 text-slate-600">{emp.team}</td>
                    <td className="px-3 py-2.5 sm:px-4 sm:py-3 text-slate-600">{emp.rank}</td>
                    <td className="px-3 py-2.5 sm:px-4 sm:py-3 text-slate-600">{emp.employmentType || '상용직'}</td>
                    <td className="px-3 py-2.5 sm:px-4 sm:py-3 text-slate-500 font-semibold">{emp.hireDate}</td>
                    <td className="px-3 py-2.5 sm:px-4 sm:py-3 text-blue-600 font-semibold">{emp.duration || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
