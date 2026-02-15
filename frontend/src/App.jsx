import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import TeacherLogin from './pages/TeacherLogin';
import TeacherDashboard from './pages/TeacherDashboard';
import TeacherLiveView from './pages/TeacherLiveView';
import ProjectorMode from './pages/ProjectorMode';
import StudentJoin from './pages/StudentJoin';

// Protected route wrapper
const ProtectedRoute = ({ children }) => {
    const token = localStorage.getItem('token');
    return token ? children : <Navigate to="/teacher" replace />;
};

function App() {
    return (
        <BrowserRouter>
            <Routes>
                {/* Student Join is the HOMEPAGE */}
                <Route path="/" element={<StudentJoin />} />

                {/* Teacher routes */}
                <Route path="/teacher" element={<TeacherLogin />} />

                <Route
                    path="/dashboard"
                    element={
                        <ProtectedRoute>
                            <TeacherDashboard />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/live/:classId"
                    element={
                        <ProtectedRoute>
                            <TeacherLiveView />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/projector/:classId"
                    element={
                        <ProtectedRoute>
                            <ProjectorMode />
                        </ProtectedRoute>
                    }
                />

                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
