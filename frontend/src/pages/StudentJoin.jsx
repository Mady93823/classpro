import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';
import CodeEditor from '../components/CodeEditor';
import MobileToolbar from '../components/MobileToolbar';
import LivePreview from '../components/LivePreview';
import { debounce } from '../utils/debounce';
import { saveStudentSession, getStudentSession, clearStudentSession, updateSessionCode } from '../utils/sessionStorage';

const StudentJoin = () => {
    const navigate = useNavigate();
    const { socket, isConnected } = useSocket();

    const [joined, setJoined] = useState(false);
    const [formData, setFormData] = useState({ studentName: '', classCode: '' });
    const [code, setCode] = useState({ html: '', css: '' });
    const [activeTab, setActiveTab] = useState('html');
    const [error, setError] = useState('');
    const [studentId, setStudentId] = useState(null);
    const [isClassInactive, setIsClassInactive] = useState(false);
    const [isReconnecting, setIsReconnecting] = useState(true);

    // Refs for CodeMirror editors
    const htmlEditorRef = useRef(null);
    const cssEditorRef = useRef(null);

    // Auto-reconnect on mount
    useEffect(() => {
        if (!socket || !isConnected) return;

        const session = getStudentSession();
        if (session && session.studentId && session.studentName && session.classCode) {
            // Attempt auto-reconnect
            socket.emit('rejoin_class', {
                studentId: session.studentId,
                studentName: session.studentName,
                classCode: session.classCode
            });
        } else {
            setIsReconnecting(false);
        }
    }, [socket, isConnected]);

    // Socket event listeners
    useEffect(() => {
        if (!socket) return;

        socket.on('join_success', ({ studentId: newStudentId }) => {
            setJoined(true);
            setError('');
            setStudentId(newStudentId);
            setIsClassInactive(false);

            // Save session to localStorage
            saveStudentSession({
                studentId: newStudentId,
                studentName: formData.studentName,
                classCode: formData.classCode,
                html: code.html,
                css: code.css
            });
        });

        socket.on('rejoin_success', ({ sessionId }) => {
            const session = getStudentSession();
            setJoined(true);
            setError('');
            setStudentId(sessionId);
            setIsClassInactive(false);
            setIsReconnecting(false);

            // Restore session data
            if (session) {
                setFormData({
                    studentName: session.studentName,
                    classCode: session.classCode
                });
                setCode({
                    html: session.html || '',
                    css: session.css || ''
                });
            }
        });

        socket.on('rejoin_error', ({ message, isClassInactive: inactive }) => {
            setError(message);
            setIsReconnecting(false);
            if (inactive) {
                setIsClassInactive(true);
                // Keep form data from session for easy rejoin
                const session = getStudentSession();
                if (session) {
                    setFormData({
                        studentName: session.studentName,
                        classCode: session.classCode
                    });
                }
            }
        });

        socket.on('join_error', ({ message }) => {
            setError(message);
            setIsReconnecting(false);
        });

        return () => {
            socket.off('join_success');
            socket.off('rejoin_success');
            socket.off('rejoin_error');
            socket.off('join_error');
        };
    }, [socket, formData.studentName, formData.classCode, code.html, code.css]);

    const debouncedEmit = debounce((html, css) => {
        if (socket && joined) {
            socket.emit('code_update', { html, css });
        }
    }, 500);

    useEffect(() => {
        if (joined) {
            debouncedEmit(code.html, code.css);
            // Save code to localStorage
            updateSessionCode(code.html, code.css);
        }
    }, [code.html, code.css, joined]);

    const handleJoin = (e) => {
        e.preventDefault();
        if (!socket) return;

        setError('');
        setIsClassInactive(false);

        socket.emit('join_class', {
            studentName: formData.studentName,
            classCode: formData.classCode.toUpperCase()
        });
    };

    const handleLogout = () => {
        // Clear session and reload
        clearStudentSession();
        setJoined(false);
        setFormData({ studentName: '', classCode: '' });
        setCode({ html: '', css: '' });
        setStudentId(null);
        setError('');
        setIsClassInactive(false);

        // Disconnect socket
        if (socket) {
            socket.disconnect();
        }

        // Reload page to reconnect socket
        window.location.reload();
    };

    const handleInsert = (char) => {
        // Use the appropriate editor ref based on active tab
        const editorRef = activeTab === 'html' ? htmlEditorRef : cssEditorRef;

        if (editorRef.current) {
            editorRef.current.insertText(char);
        }
    };

    if (!joined) {
        // Show reconnecting state
        if (isReconnecting) {
            return (
                <div className="min-h-screen bg-gradient-to-br from-emerald-500 via-teal-600 to-green-600 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl p-8 text-center max-w-md">
                        <div className="inline-block bg-emerald-100 rounded-full p-4 mb-4">
                            <svg className="animate-spin h-12 w-12 text-emerald-600" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        </div>
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">Reconnecting...</h2>
                        <p className="text-gray-600">Restoring your session</p>
                    </div>
                </div>
            );
        }

        return (
            <div className="min-h-screen bg-gradient-to-br from-emerald-500 via-teal-600 to-green-600 flex items-center justify-center p-4 relative overflow-hidden">
                {/* Animated Pattern Background */}
                <div className="absolute inset-0 bg-grid-pattern opacity-10"></div>

                {/* Floating Shapes */}
                <div className="absolute top-10 left-10 w-20 h-20 bg-white rounded-2xl opacity-20 animate-float"></div>
                <div className="absolute bottom-20 right-10 w-32 h-32 bg-white rounded-full opacity-10 animate-float-delayed"></div>

                <div className="relative w-full max-w-md z-10">
                    <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-8 text-center">
                            <div className="inline-block bg-white rounded-2xl p-4 mb-4 shadow-lg">
                                <svg className="w-12 h-12 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                                </svg>
                            </div>
                            <h1 className="text-3xl font-bold text-white mb-2">Join Classroom</h1>
                            <p className="text-emerald-100 text-sm">Start coding in real-time</p>
                        </div>

                        {/* Form Section */}
                        <div className="p-8">
                            {error && (
                                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-xl mb-6 animate-shake">
                                    <div className="flex items-center">
                                        <svg className="w-5 h-5 text-red-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                        </svg>
                                        <span className="text-sm font-medium text-red-700">{error}</span>
                                    </div>
                                </div>
                            )}

                            {isClassInactive && (
                                <div className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded-xl mb-6">
                                    <div className="flex items-center">
                                        <svg className="w-5 h-5 text-orange-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                        </svg>
                                        <span className="text-sm font-medium text-orange-700">Class is not currently live. Join when class starts.</span>
                                    </div>
                                </div>
                            )}

                            {!isConnected && (
                                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-xl mb-6">
                                    <div className="flex items-center">
                                        <svg className="animate-spin h-5 w-5 text-yellow-600 mr-3" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        <span className="text-sm font-medium text-yellow-700">Connecting to server...</span>
                                    </div>
                                </div>
                            )}

                            <form onSubmit={handleJoin} className="space-y-6">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center">
                                        <svg className="w-5 h-5 mr-2 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                        Your Name
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.studentName}
                                        onChange={(e) => setFormData({ ...formData, studentName: e.target.value })}
                                        className="w-full px-5 py-4 text-lg bg-gray-50 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-emerald-200 focus:border-emerald-500 outline-none transition-all duration-300"
                                        placeholder="Enter your name"
                                        style={{ minHeight: '56px' }} // 48px+ touch target
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center">
                                        <svg className="w-5 h-5 mr-2 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                        </svg>
                                        Class Code
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        maxLength={6}
                                        value={formData.classCode}
                                        onChange={(e) => setFormData({ ...formData, classCode: e.target.value.toUpperCase() })}
                                        className="w-full px-5 py-4 text-center text-3xl font-bold font-mono bg-gray-50 border-2 border-gray-200 rounded-2xl uppercase tracking-widest focus:ring-4 focus:ring-emerald-200 focus:border-emerald-500 outline-none transition-all duration-300"
                                        placeholder="ABC123"
                                        style={{ minHeight: '64px' }} // Larger for important input
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={!isConnected}
                                    className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white py-5 px-6 rounded-2xl text-lg font-bold hover:from-emerald-600 hover:to-teal-700 focus:outline-none focus:ring-4 focus:ring-emerald-300 transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-xl hover:shadow-2xl"
                                    style={{ minHeight: '64px' }} // 48px+ touch target
                                >
                                    {isConnected ? '🚀 Join Classroom' : 'Connecting...'}
                                </button>
                            </form>

                            {/* Teacher Login Button */}
                            <div className="mt-6 text-center">
                                <button
                                    onClick={() => navigate('/teacher')}
                                    className="text-sm text-gray-600 hover:text-emerald-600 font-medium transition-colors duration-300 flex items-center justify-center gap-2 mx-auto"
                                >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                    Are you a teacher? Login here
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <style>{`
          @keyframes float {
            0%, 100% { transform: translateY(0) rotate(0deg); }
            50% { transform: translateY(-20px) rotate(5deg); }
          }
          .animate-float {
            animation: float 6s ease-in-out infinite;
          }
          .animate-float-delayed {
            animation: float 8s ease-in-out infinite;
            animation-delay: 1s;
          }
          .bg-grid-pattern {
            background-image: 
              linear-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255, 255, 255, 0.1) 1px, transparent 1px);
            background-size: 50px 50px;
          }
        `}</style>
            </div>
        );
    }

    return (
        <div className="h-screen flex flex-col bg-gray-900">
            {/* Status Bar */}
            <div className="flex-shrink-0 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-4 py-3 flex justify-between items-center shadow-lg">
                <div className="flex items-center gap-3">
                    <div className="bg-white bg-opacity-20 rounded-lg px-3 py-1 backdrop-blur-sm">
                        <span className="text-sm font-semibold">📚 {formData.classCode}</span>
                    </div>
                    <div className="bg-white bg-opacity-20 rounded-lg px-3 py-1 backdrop-blur-sm">
                        <span className="text-sm font-medium">👤 {formData.studentName}</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className={`px-3 py-1 rounded-lg font-medium text-xs ${isConnected
                        ? 'bg-green-500 bg-opacity-90'
                        : 'bg-red-500 bg-opacity-90'
                        }`}>
                        {isConnected ? '● Live' : '● Offline'}
                    </div>
                    <button
                        onClick={handleLogout}
                        className="bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg px-3 py-1 text-xs font-medium transition-all"
                        title="Logout"
                    >
                        🚪 Logout
                    </button>
                </div>
            </div>

            {/* Tab Navigation - THUMB ZONE (Easy to Reach) */}
            <div className="flex-shrink-0 flex bg-gray-800 border-b border-gray-700 shadow-lg">
                {['html', 'css', 'preview'].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`flex-1 py-4 text-base font-bold uppercase tracking-wide transition-all duration-300 transform active:scale-95 ${activeTab === tab
                            ? 'bg-emerald-600 text-white shadow-lg'
                            : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
                            }`}
                        style={{ minHeight: '56px' }} // 48px+ touch target
                    >
                        {tab === 'html' && '📝 HTML'}
                        {tab === 'css' && '🎨 CSS'}
                        {tab === 'preview' && '👁️ Preview'}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden bg-gray-900">
                {activeTab === 'html' && (
                    <div className="h-full">
                        <CodeEditor
                            ref={htmlEditorRef}
                            language="html"
                            value={code.html}
                            onChange={(value) => setCode({ ...code, html: value })}
                        />
                    </div>
                )}
                {activeTab === 'css' && (
                    <div className="h-full">
                        <CodeEditor
                            ref={cssEditorRef}
                            language="css"
                            value={code.css}
                            onChange={(value) => setCode({ ...code, css: value })}
                        />
                    </div>
                )}
                {activeTab === 'preview' && (
                    <div className="h-full bg-white">
                        <LivePreview html={code.html} css={code.css} />
                    </div>
                )}
            </div>

            {/* Mobile Toolbar - FIXED AT BOTTOM (Thumb Zone) */}
            <div className="flex-shrink-0">
                <MobileToolbar onInsert={handleInsert} />
            </div>
        </div>
    );
};

export default StudentJoin;
