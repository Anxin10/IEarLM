import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import PatientList from './components/PatientList';
import PatientDetail from './components/PatientDetail';
import { AIDiagnosis } from './components/AIDiagnosis';
import RagConfig from './components/RagConfig';
import LoginPage from './components/LoginPage';
import UserManagement from './components/UserManagement';
import PatientModal from './components/PatientModal';
//jx新增 deletePatient  
import { fetchPatients, fetchDashboardStats, createPatient ,deletePatient} from './services/apiService';

import { User, UserRole, Patient, Language, DashboardStats } from './types';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);

  const [lang, setLang] = useState<Language>('zh');
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Fetch initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        const [patientsData, statsData] = await Promise.all([
          fetchPatients(),
          fetchDashboardStats()
        ]);
        setPatients(patientsData);
        setDashboardStats(statsData);
      } catch (error) {
        console.error("Failed to load initial data", error);
      }
    };
    loadData();
  }, []);

  // Checksum Generator (Base36-ish simplified)
  const generateChecksum = (input: string): string => {
    let sum = 0;
    for (let i = 0; i < input.length; i++) {
      sum += input.charCodeAt(i);
    }
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    return chars[sum % chars.length];
  };

  const handleAddPatient = async (data: Partial<Patient>) => {
    // Generate ID: IEAR-LM-<YYMM>-<SEQ>-<Gender>
    // e.g., IEAR-LM-2601-0042-M

    const today = new Date();
    const yy = today.getFullYear().toString().slice(-2);
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yymm = `${yy}${mm}`;

    const prefix = `IEAR-LM-${yymm}`;

    // Calculate SEQ based on existing patients in the list
    // Note: In a real multi-user scenario, the backend should assign the ID or SEQ.
    // For now, we estimate based on frontend list length for immediate feedback, 
    // but ideally the backend should handle this to avoid race conditions.
    const dailyCount = patients.filter(p => p.id.includes(prefix)).length + 1;
    const seq = String(dailyCount).padStart(4, '0');
    const genderSuffix = data.gender === 'Female' ? 'F' : 'M';

    const newId = `${prefix}-${seq}-${genderSuffix}`;

    try {
      // Call Backend API
      await createPatient({
        ...data,
        id: newId,
        name: data.name || 'Anonymous',
        gender: data.gender || 'Male',
        birthDate: data.birthDate || '1980-01-01', // Ensure birthDate is passed
      });

      // Refresh list from Backend
      // Or optimistically add to list
      const newPatient: Patient = {
        id: newId,
        dbId: 0, // Placeholder, will be refreshed
        name: data.name || 'Anonymous',
        age: data.age || 0,
        gender: data.gender || 'Male',
        visitDate: new Date().toISOString().split('T')[0],
        diagnosis: data.diagnosis || 'Loading...',
        status: data.status || 'Stable',
        imageUrl: data.imageUrl || 'https://picsum.photos/800/600',
        notes: data.notes || '',
        segmentationData: []
      };
      setPatients([newPatient, ...patients]);

      // Refresh actual data from server in background to get DB IDs etc.
      fetchPatients().then(setPatients);

    } catch (error) {
      console.error("Failed to create patient", error);
      alert("建立病患失敗");
    }
  };

  const handleUpdatePatient = (data: Partial<Patient>) => {
    // This function updates the state but DOES NOT open the modal.
    // It is used by PatientDetail for auto-saving exam data.
    if (data.id) {
      setPatients(prev => prev.map(p => p.id === data.id ? { ...p, ...data } as Patient : p));
    } else if (editingPatient) {
      setPatients(prev => prev.map(p => p.id === editingPatient.id ? { ...p, ...data } as Patient : p));
      setEditingPatient(null);
    }
  };

  //JX新增
  const handleDeletePatient = (id: string) => {
    // 1. 【UI 優先】先從畫面移除 (讓使用者覺得很快)
    setPatients(prev => prev.filter(p => p.id !== id));

    // 2. 找出資料庫真正的 ID
    const targetPatient = patients.find(p => p.id === id);
    const dbId = (targetPatient as any)?.dbId;

    console.log("正在嘗試刪除...", { 畫面ID: id, 資料庫ID: dbId });

    // 防呆：如果沒有 dbId，就只做畫面刪除，不送請求
    if (!dbId) {
        console.warn("找不到資料庫 ID (dbId)，僅執行前端畫面刪除，未通知後端。");
        return;
    }

    // 3. 【背景執行】發送請求
    // 注意：如果您的瀏覽器不是在本機跑 (例如用手機或別人電腦)，localhost 會連不到
    // 建議改成您電腦的區網 IP，例如 'http://10.147.20.69:9000/api/v1/patients'
    //const API_URL = 'http://localhost:9000/api/v1/patients'; 
    const API_URL = 'http://10.147.20.69:9000/api/v1/patients';

    fetch(API_URL, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json' // 必填
        },
        body: JSON.stringify({ 
            id: dbId  // 這是後端要的格式
        })
    })
    .then(async response => {
        if (!response.ok) {
            const errorText = await response.text();
            console.error("刪除失敗 (伺服器回傳錯誤):", response.status, errorText);
            // 這裡可以選擇是否要把病患加回去畫面，或者跳出 Alert
            alert("伺服器刪除失敗，請檢查連線");
        } else {
            console.log("後端刪除成功，ID:", dbId);
        }
    })
    .catch(error => {
        console.error("連線錯誤 (完全連不上):", error);
        alert("無法連線到伺服器");
    });
    
    
    // Password verification is now handled in PatientList component
    //setPatients(prev => prev.filter(p => p.id !== id));
    
  };

  // This function opens the modal (UI Trigger)
  const handleEditClick = (patient: Patient) => {
    setEditingPatient(patient);
    setIsModalOpen(true);
  };

  const handleCreateClick = () => {
    setEditingPatient(null);
    setIsModalOpen(true);
  };

  if (!user) {
    return (
      <LoginPage
        onLogin={setUser}
        lang={lang}
        setLang={setLang}
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
      />
    );
  }

  return (
    <HashRouter>
      <Layout
        user={user}
        onLogout={() => setUser(null)}
        onUpdateUser={(updatedUser) => setUser(updatedUser)}
        lang={lang}
        setLang={setLang}
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
      >
        <Routes>
          {/* Redirect root to dashboard as requested */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          <Route path="/dashboard" element={<Dashboard stats={dashboardStats || {
            totalPatients: 0,
            criticalCases: 0,
            aiAccuracy: 0,
            monthlyVisits: [],
            diseaseDistribution: []
          }} isDarkMode={isDarkMode} lang={lang} />} />
          <Route
            path="/patients"
            element={
              user ? (
                <PatientList
                  patients={patients}
                  role={user.role}
                  currentUser={user}
                  onDelete={handleDeletePatient}
                  onEdit={handleEditClick} // Opens Modal
                  onCreate={handleCreateClick}
                  lang={lang}
                />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          <Route
            path="/patients/:id"
            element={
              <PatientDetail
                patients={patients}
                role={user.role}
                onEdit={handleUpdatePatient} // Just updates data, NO Modal
                onDelete={handleDeletePatient}
                lang={lang}
              />
            }
          />
          <Route path="/diagnosis" element={<AIDiagnosis lang={lang} user={user} />} />
          <Route path="/rag-config" element={<RagConfig lang={lang} />} />

          <Route
            path="/users"
            element={
              // Allow Managers to access, UserManagement will handle specific permissions
              (user.role === UserRole.OWNER || user.role === UserRole.MANAGER)
                ? <UserManagement lang={lang} currentUser={user} />
                : <Navigate to="/" replace />
            }
          />

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Layout>

      <PatientModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingPatient(null); }}
        onSave={editingPatient ? handleUpdatePatient : handleAddPatient}
        initialData={editingPatient}
        lang={lang}
        isDarkMode={isDarkMode}
      />
    </HashRouter>
  );
};

export default App;