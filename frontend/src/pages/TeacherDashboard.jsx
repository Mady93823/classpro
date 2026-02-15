import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';

const TeacherDashboard = () => {
    const navigate = useNavigate();
    const [classes, setClasses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newClassName, setNewClassName] = useState('');

    useEffect(() => {
        fetchClasses();
    }, []);

    const fetchClasses = async () => {
        try {
            const { data } = await api.get('/api/classes');
            setClasses(data.classes);
        } catch (err) {
            console.error('Fetch classes error:', err);
        } finally {
            setLoading(false);
        }
    };

    const createClass = async (e) => {
        e.preventDefault();
        try {
            await api.post('/api/classes', { className: newClassName });
            setNewClassName('');
            setShowCreateModal(false);
            fetchClasses();
        } catch (err) {
            alert(err.response?.data?.message || 'Create class failed');
        }
    };

    const toggleActive = async (classId, currentStatus) => {
        try {
            await api.patch(`/api/classes/${classId}`, { isActive: !currentStatus });
            fetchClasses();
        } catch (err) {
            alert(err.response?.data?.message || 'Update failed');
        }
    };

    const deleteClass = async (classId) => {
        if (!confirm('Delete this class?')) return;
        try {
            await api.delete(`/api/classes/${classId}`);
            fetchClasses();
        } catch (err) {
            alert(err.response?.data?.message || 'Delete failed');
        }
    };

    const logout = () => {
        localStorage.clear();
        navigate('/');
    };

    if (loading) {
        return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <nav className="bg-white shadow-sm border-b">
                <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-gray-800">Classroom Live</h1>
                    <button
                        onClick={logout}
                        className="px-4 py-2 text-gray-600 hover:text-gray-800"
                    >
                        Logout
                    </button>
                </div>
            </nav>

            <div className="max-w-7xl mx-auto px-4 py-8">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-semibold text-gray-800">My Classes</h2>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="bg-primary text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition"
                    >
                        + Create Class
                    </button>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {classes.map((cls) => (
                        <div key={cls._id} className="bg-white rounded-xl shadow-md overflow-hidden">
                            <div className="p-6">
                                <h3 className="text-xl font-semibold text-gray-800 mb-2">
                                    {cls.className}
                                </h3>
                                <div className="flex items-center justify-between mb-4">
                                    <span className="font-mono text-2xl text-primary font-bold">
                                        {cls.classCode}
                                    </span>
                                    <button
                                        onClick={() => navigator.clipboard.writeText(cls.classCode)}
                                        className="text-sm text-gray-600 hover:text-primary"
                                    >
                                        📋 Copy
                                    </button>
                                </div>

                                <div className="flex items-center gap-2 mb-4">
                                    <span className="text-sm text-gray-600">Active:</span>
                                    <button
                                        onClick={() => toggleActive(cls._id, cls.isActive)}
                                        className={`px-3 py-1 rounded-full text-xs font-medium ${cls.isActive
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-gray-100 text-gray-700'
                                            }`}
                                    >
                                        {cls.isActive ? 'Yes' : 'No'}
                                    </button>
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        onClick={() => navigate(`/live/${cls._id}`, { state: { classCode: cls.classCode } })}
                                        className="flex-1 bg-primary text-white py-2 rounded-lg hover:bg-blue-700 transition text-sm"
                                    >
                                        Go Live
                                    </button>
                                    <button
                                        onClick={() => deleteClass(cls._id)}
                                        className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition text-sm"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {classes.length === 0 && (
                    <div className="text-center py-12">
                        <p className="text-gray-500">No classes yet. Create your first class!</p>
                    </div>
                )}
            </div>

            {showCreateModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl p-6 w-full max-w-md">
                        <h3 className="text-xl font-semibold mb-4">Create New Class</h3>
                        <form onSubmit={createClass}>
                            <input
                                type="text"
                                required
                                value={newClassName}
                                onChange={(e) => setNewClassName(e.target.value)}
                                placeholder="Class name (e.g., HTML Basics 101)"
                                className="w-full px-4 py-3 border rounded-lg mb-4 focus:ring-2 focus:ring-primary outline-none"
                            />
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700"
                                >
                                    Create
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TeacherDashboard;
