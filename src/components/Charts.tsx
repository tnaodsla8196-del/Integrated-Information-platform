import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, LabelList 
} from 'recharts';
import { Employee } from '../types';
import { cn } from '../lib/utils';

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
