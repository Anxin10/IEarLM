
import { Patient, DashboardStats, EarExamRecord } from '../types';

// --- Data Generators ---

// Synchronized with AIDiagnosis.tsx and AIDiagnosisForm.tsx
const diagnosesPool = [
    "Eardrum perforation", 
    "Atrophic scar", 
    "Middle ear effusion", 
    "Middle ear tumor", 
    "Retraction", 
    "Tympanosclerosis", 
    "Ventilation tube", 
    "Otitis media", 
    "Tympanoplasty", 
    "Myringitis", 
    "Normal", 
    "Atresia", 
    "Blood clot", 
    "Cerumen", 
    "Foreign body", 
    "Otitis externa", 
    "Otomycosis", 
    "EAC tumor"
];

// Mapping helper to generate detailed findings based on the diagnosis string
// This ensures that when a user opens the detail view, the checkboxes are already correctly checked.
const mapDiagnosisToFindings = (diagnosis: string) => {
    const findings = { EAC: [] as any[], TM: [] as any[] };
    const lesionBase = { percentage: 0 }; 

    // Define the full catalog mapping
    const map: Record<string, any> = {
        // "Normal" is removed. If diagnosis is Normal, it maps to nothing (empty findings).
        "Otitis media": { code: 'TM_OTITIS_MEDIA', label_zh: '中耳炎', label_en: 'Otitis media', is_normal: false, region: 'TM' },
        "Middle ear effusion": { code: 'TM_MIDDLE_EAR_EFFUSION', label_zh: '中耳積水', label_en: 'Middle ear effusion', is_normal: false, region: 'TM' },
        "Eardrum perforation": { code: 'TM_EARDRUM_PERFORATION', label_zh: '耳膜破洞', label_en: 'Eardrum perforation', is_normal: false, region: 'TM' },
        "Myringitis": { code: 'TM_MYRINGITIS', label_zh: '耳膜炎', label_en: 'Myringitis', is_normal: false, region: 'TM' },
        "Tympanosclerosis": { code: 'TM_TYMPANOSCLEROSIS', label_zh: '耳膜硬化', label_en: 'Tympanosclerosis', is_normal: false, region: 'TM' },
        "Retraction": { code: 'TM_RETRACTION', label_zh: '耳膜內縮', label_en: 'Retraction', is_normal: false, region: 'TM' },
        "Atrophic scar": { code: 'TM_ATROPHIC_SCAR', label_zh: '萎縮性疤痕', label_en: 'Atrophic scar', is_normal: false, region: 'TM' },
        "Middle ear tumor": { code: 'TM_MIDDLE_EAR_TUMOR', label_zh: '中耳腫瘤', label_en: 'Middle ear tumor', is_normal: false, region: 'TM' },
        "Ventilation tube": { code: 'TM_VENTILATION_TUBE', label_zh: '中耳通氣管', label_en: 'Ventilation tube', is_normal: false, region: 'TM' },
        "Tympanoplasty": { code: 'TM_TYMPANOPLASTY', label_zh: '耳膜修補', label_en: 'Tympanoplasty', is_normal: false, region: 'TM' },
        
        "Cerumen": { code: 'EAC_CERUMEN', label_zh: '外耳道耳垢', label_en: 'Cerumen', is_normal: false, region: 'EAC' },
        "Otitis externa": { code: 'EAC_OTITIS_EXTERNA', label_zh: '外耳道炎', label_en: 'Otitis externa', is_normal: false, region: 'EAC' },
        "Otomycosis": { code: 'EAC_OTOMYCOSIS', label_zh: '耳黴菌', label_en: 'Otomycosis', is_normal: false, region: 'EAC' },
        "Foreign body": { code: 'EAC_FOREIGN_BODY', label_zh: '耳異物', label_en: 'Foreign body', is_normal: false, region: 'EAC' },
        "Blood clot": { code: 'EAC_BLOOD_CLOT', label_zh: '外耳道血塊', label_en: 'Blood clot', is_normal: false, region: 'EAC' },
        "Atresia": { code: 'EAC_ATRESIA', label_zh: '外耳道閉鎖', label_en: 'Atresia', is_normal: false, region: 'EAC' },
        "EAC tumor": { code: 'EAC_TUMOR', label_zh: '外耳道腫瘤', label_en: 'EAC tumor', is_normal: false, region: 'EAC' },
    };

    const item = map[diagnosis];
    if (item) {
        if (item.region === 'EAC') {
            findings.EAC.push({ ...item, ...lesionBase });
        } else {
            findings.TM.push({ ...item, ...lesionBase });
        }
    }

    return findings;
};

const firstNames = ['Alex', 'Brian', 'Chloe', 'Daniel', 'Eva', 'Frank', 'Grace', 'Henry', 'Ivy', 'Jack', 'Kevin', 'Laura', 'Mike', 'Nina', 'Oscar', 'Paul', 'Queen', 'Rachel', 'Sam', 'Tina'];
const lastNames = ['Wang', 'Liu', 'Chen', 'Yang', 'Huang', 'Zhao', 'Wu', 'Zhou', 'Xu', 'Sun', 'Ma', 'Zhu', 'Hu', 'Guo', 'Lin', 'Chang', 'Cheng'];

// Helper to generate a random date within the last 6 months
const getRandomDate = () => {
    const end = new Date('2026-01-06');
    const start = new Date('2025-08-01');
    const date = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
    return date.toISOString().split('T')[0];
};

const generatePatients = (count: number): Patient[] => {
    const patients: Patient[] = [];
    
    for (let i = 0; i < count; i++) {
        const isMale = Math.random() > 0.5;
        const diagnosis = diagnosesPool[Math.floor(Math.random() * diagnosesPool.length)];
        const fName = firstNames[Math.floor(Math.random() * firstNames.length)];
        const lName = lastNames[Math.floor(Math.random() * lastNames.length)];
        
        // Determine status based on diagnosis roughly
        let status: 'Critical' | 'Stable' | 'Recovered' = 'Stable';
        if (['Foreign body', 'Otitis media', 'Eardrum perforation', 'EAC tumor', 'Middle ear tumor'].includes(diagnosis) && Math.random() > 0.7) status = 'Critical';
        if (diagnosis === 'Normal') status = 'Recovered';

        // Mock exam status
        let leftStatus: any = 'completed';
        let rightStatus: any = 'completed';
        
        // Randomly make some pending/draft
        if (Math.random() > 0.8) { leftStatus = 'pending'; rightStatus = 'pending'; }
        else if (Math.random() > 0.9) { leftStatus = 'draft'; rightStatus = 'pending'; }

        // Determine visit date (Latest ones first for ID generation purposes roughly)
        const visitDate = getRandomDate();
        const datePart = visitDate.replace(/-/g, '').substring(2, 6); // YYMM
        const idSeq = (count - i).toString().padStart(4, '0');
        
        // Generate detailed findings based on the diagnosis string
        const leftFindings = mapDiagnosisToFindings(diagnosis);
        const rightFindings = mapDiagnosisToFindings('Normal'); // Default right ear to Normal

        patients.push({
            id: `IEAR-LM-${datePart}-${idSeq}-${isMale ? 'M' : 'F'}`,
            name: `${fName} ${lName}`,
            birthDate: '1980-01-01', // Simplified
            age: Math.floor(Math.random() * 70) + 5,
            gender: isMale ? 'Male' : 'Female',
            visitDate: visitDate,
            diagnosis: `L: ${diagnosis} / R: Normal`, // Create initial summary string
            status: status,
            imageUrl: `https://placehold.co/800x600/1e293b/FFFFFF?text=${diagnosis.replace(/ /g, '+')}`,
            notes: `Auto-generated case: ${diagnosis}.`,
            exams: {
                left: { 
                    status: leftStatus, 
                    diagnosis: diagnosis, 
                    notes: 'Generated.', 
                    segmentationData: [],
                    detailedFindings: leftFindings // Populate structure
                },
                right: { 
                    status: rightStatus, 
                    diagnosis: 'Normal', 
                    notes: 'Normal.', 
                    segmentationData: [],
                    detailedFindings: rightFindings // Populate structure
                }
            }
        });
    }
    
    // Sort by date desc
    return patients.sort((a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime());
};

// Generate 250 patients for realistic data volume
export const mockPatients: Patient[] = generatePatients(250);

// --- Stats Calculator (Ensures Consistency) ---

const calculateStats = (data: Patient[]): DashboardStats => {
    const totalPatients = data.length;
    const criticalCases = data.filter(p => p.status === 'Critical').length;
    
    // Disease Distribution
    const diseaseMap: Record<string, number> = {};
    data.forEach(p => {
        // Parse the raw diagnosis from left ear for stats (simplification)
        const d = p.exams?.left.diagnosis || 'Normal';
        diseaseMap[d] = (diseaseMap[d] || 0) + 1;
    });
    
    const diseaseDistribution = Object.keys(diseaseMap)
        .map(name => ({ name, value: diseaseMap[name] }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 7); // Top 7

    // Monthly Visits
    const visitsMap: Record<string, number> = {};
    data.forEach(p => {
        const date = new Date(p.visitDate);
        const month = date.toLocaleString('en-US', { month: 'short' });
        // Simple bucket, assumes data spans within a year correctly sorted by generator
        visitsMap[month] = (visitsMap[month] || 0) + 1;
    });

    // Hardcoded order for chart to look correct chronologically (Aug -> Jan)
    const monthOrder = ['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan'];
    const monthlyVisits = monthOrder.map(m => ({
        name: m,
        visits: visitsMap[m] || 0
    }));

    return {
        totalPatients,
        criticalCases,
        aiAccuracy: 96.2, // Hardcoded metric
        monthlyVisits,
        diseaseDistribution
    };
};

export const mockStats: DashboardStats = calculateStats(mockPatients);
