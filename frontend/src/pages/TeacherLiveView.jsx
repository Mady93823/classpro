import React, { useState, useEffect, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';
import StudentList from '../components/StudentList';
import CodeEditor from '../components/CodeEditor';
import LivePreview from '../components/LivePreview';

const TeacherLiveView = () => {
    const { classId } = useParams();
    const { state } = useLocation();
    const navigate = useNavigate();
    const { socket, isConnected } = useSocket();

    const [students, setStudents] = useState([]);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [studentCode, setStudentCode] = useState({ html: '', css: '' });

    // Panel widths as percentages
    const [htmlWidth, setHtmlWidth] = useState(33.33);
    const [cssWidth, setCssWidth] = useState(33.33);

    const containerRef = useRef(null);
    const isDraggingRef = useRef(false);
    const dragHandleRef = useRef(null);
    const startXRef = useRef(0);
    const startWidthsRef = useRef({ html: 33.33, css: 33.33 });

    useEffect(() => {
        if (!socket || !state?.classCode) return;

        socket.emit('teacher_join_room', { classCode: state.classCode });
        socket.emit('get_student_list', { classCode: state.classCode });

        socket.on('student_list', ({ students: studentList }) => {
            setStudents(studentList);
        });

        socket.on('student_joined', ({ studentName, socketId, studentId }) => {
            setStudents(prev => [...prev, { studentName, socketId, studentId, lastUpdate: Date.now() }]);
        });

        socket.on('student_code_snapshot', ({ html, css }) => {
            setStudentCode({ html, css });
        });

        socket.on('student_code_update', ({ html, css }) => {
            setStudentCode({ html, css });
        });

        socket.on('student_left', ({ socketId }) => {
            setStudents(prev => prev.filter(s => s.socketId !== socketId));
            if (selectedStudent?.socketId === socketId) {
                setSelectedStudent(null);
                setStudentCode({ html: '', css: '' });
            }
        });

        return () => {
            socket.off('student_list');
            socket.off('student_joined');
            socket.off('student_code_snapshot');
            socket.off('student_code_update');
            socket.off('student_left');
        };
    }, [socket, state?.classCode]);

    const handleSelectStudent = (student) => {
        setSelectedStudent(student);
        socket.emit('subscribe_to_student', { studentSocketId: student.socketId });
    };

    const openProjectorMode = () => {
        // Store classCode in sessionStorage so projector mode can access it
        sessionStorage.setItem('projectorClassCode', state?.classCode || '');
        window.open(`/projector/${classId}`, '_blank', 'fullscreen=yes');
    };

    const handleMouseDown = (handle) => (e) => {
        e.preventDefault();
        isDraggingRef.current = true;
        dragHandleRef.current = handle;
        startXRef.current = e.clientX;
        startWidthsRef.current = { html: htmlWidth, css: cssWidth };

        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    };

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isDraggingRef.current || !containerRef.current) return;

            const container = containerRef.current;
            const containerWidth = container.getBoundingClientRect().width;
            const deltaX = e.clientX - startXRef.current;
            const deltaPercent = (deltaX / containerWidth) * 100;

            if (dragHandleRef.current === 'first') {
                // Dragging between HTML and CSS
                let newHtmlWidth = startWidthsRef.current.html + deltaPercent;
                let newCssWidth = startWidthsRef.current.css - deltaPercent;

                // Enforce minimum 15% for each panel
                newHtmlWidth = Math.max(15, Math.min(70, newHtmlWidth));
                newCssWidth = Math.max(15, Math.min(70, newCssWidth));

                setHtmlWidth(newHtmlWidth);
                setCssWidth(newCssWidth);
            } else if (dragHandleRef.current === 'second') {
                // Dragging between CSS and Preview
                let newCssWidth = startWidthsRef.current.css + deltaPercent;

                // Enforce minimum 15% for CSS and Preview
                const previewWidth = 100 - htmlWidth - newCssWidth;
                if (previewWidth < 15) {
                    newCssWidth = 100 - htmlWidth - 15;
                } else if (newCssWidth < 15) {
                    newCssWidth = 15;
                }

                setCssWidth(Math.max(15, Math.min(70, newCssWidth)));
            }
        };

        const handleMouseUp = () => {
            if (isDraggingRef.current) {
                isDraggingRef.current = false;
                dragHandleRef.current = null;
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            }
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [htmlWidth, cssWidth]);

    const previewWidth = 100 - htmlWidth - cssWidth;

    return (
        <div className="h-screen flex flex-col bg-gray-50">
            <nav className="bg-white shadow-sm border-b px-4 py-3 flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/dashboard')} className="text-gray-600 hover:text-gray-800 transition">
                        ← Back
                    </button>
                    <h1 className="text-xl font-semibold">Live Session: {state?.classCode}</h1>
                    <div className={`px-3 py-1 rounded-full text-xs font-medium ${isConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {isConnected ? '● Connected' : '○ Disconnected'}
                    </div>
                </div>
                <button
                    onClick={openProjectorMode}
                    className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition flex items-center gap-2"
                >
                    <span>📽</span>
                    <span>Projector Mode</span>
                </button>
            </nav>

            <div className="flex-1 flex overflow-hidden">
                {/* Student List Sidebar */}
                <div className="w-64 flex-shrink-0 border-r border-gray-200 bg-white overflow-y-auto">
                    <StudentList
                        students={students}
                        selectedStudent={selectedStudent}
                        onSelectStudent={handleSelectStudent}
                    />
                </div>

                {/* Resizable Code Panels */}
                <div className="flex-1 flex flex-col">
                    {selectedStudent ? (
                        <div ref={containerRef} className="flex-1 flex overflow-hidden">
                            {/* HTML Panel */}
                            <div
                                className="flex flex-col overflow-hidden"
                                style={{ width: `${htmlWidth}%` }}
                            >
                                <div className="bg-gray-800 text-white px-4 py-2 text-sm font-medium flex items-center justify-between">
                                    <span>HTML</span>
                                    <span className="text-xs text-gray-400">Read Only</span>
                                </div>
                                <div className="flex-1 overflow-auto">
                                    <CodeEditor
                                        language="html"
                                        value={studentCode.html}
                                        readOnly={true}
                                    />
                                </div>
                            </div>

                            {/* Resize Handle 1 (HTML ↔ CSS) */}
                            <div
                                className="w-2 bg-gray-300 hover:bg-emerald-500 cursor-col-resize transition-all flex-shrink-0 relative group"
                                onMouseDown={handleMouseDown('first')}
                            >
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-0.5 h-8 bg-gray-500 group-hover:bg-white transition-colors"></div>
                                </div>
                            </div>

                            {/* CSS Panel */}
                            <div
                                className="flex flex-col overflow-hidden"
                                style={{ width: `${cssWidth}%` }}
                            >
                                <div className="bg-gray-800 text-white px-4 py-2 text-sm font-medium flex items-center justify-between">
                                    <span>CSS</span>
                                    <span className="text-xs text-gray-400">Read Only</span>
                                </div>
                                <div className="flex-1 overflow-auto">
                                    <CodeEditor
                                        language="css"
                                        value={studentCode.css}
                                        readOnly={true}
                                    />
                                </div>
                            </div>

                            {/* Resize Handle 2 (CSS ↔ Preview) */}
                            <div
                                className="w-2 bg-gray-300 hover:bg-emerald-500 cursor-col-resize transition-all flex-shrink-0 relative group"
                                onMouseDown={handleMouseDown('second')}
                            >
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-0.5 h-8 bg-gray-500 group-hover:bg-white transition-colors"></div>
                                </div>
                            </div>

                            {/* Preview Panel */}
                            <div
                                className="flex flex-col bg-white overflow-hidden"
                                style={{ width: `${previewWidth}%` }}
                            >
                                <div className="bg-gray-800 text-white px-4 py-2 text-sm font-medium flex items-center justify-between">
                                    <span>Live Preview</span>
                                    <span className="text-xs text-emerald-400">● Synced</span>
                                </div>
                                <div className="flex-1 overflow-auto">
                                    <LivePreview html={studentCode.html} css={studentCode.css} />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-full text-gray-500">
                            <div className="text-center">
                                <svg className="w-24 h-24 mx-auto text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                                <p className="text-lg font-medium mb-2 text-gray-700">Select a Student</p>
                                <p className="text-sm text-gray-400">Click on a student from the list to view their work</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TeacherLiveView;
