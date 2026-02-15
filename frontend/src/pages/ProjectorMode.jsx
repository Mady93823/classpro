import React, { useState, useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';
import LivePreview from '../components/LivePreview';

const ProjectorMode = () => {
    const { classId } = useParams();
    const { state } = useLocation();
    const { socket } = useSocket();

    const [students, setStudents] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [currentCode, setCurrentCode] = useState({ html: '', css: '', studentName: '' });
    const [isTransitioning, setIsTransitioning] = useState(false);

    useEffect(() => {
        if (!socket) return;

        // Get classCode from state or sessionStorage (for popup window)
        const classCode = state?.classCode || sessionStorage.getItem('projectorClassCode');

        if (!classCode) {
            console.error('No class code available');
            return;
        }

        socket.emit('teacher_join_room', { classCode });
        socket.emit('get_student_list', { classCode });

        socket.on('student_list', ({ students: studentList }) => {
            setStudents(studentList);
            if (studentList.length > 0) {
                switchToStudent(0, studentList);
            }
        });

        socket.on('student_joined', ({ studentName, socketId, studentId }) => {
            setStudents(prev => {
                const updated = [...prev, { studentName, socketId, studentId }];
                return updated;
            });
        });

        socket.on('student_code_update', ({ html, css }) => {
            setCurrentCode(prev => ({ ...prev, html, css }));
        });

        socket.on('student_left', ({ socketId }) => {
            setStudents(prev => {
                const updated = prev.filter(s => s.socketId !== socketId);
                // Auto-switch to valid student if current one left
                if (updated.length > 0 && currentIndex >= updated.length) {
                    const newIndex = updated.length - 1;
                    setCurrentIndex(newIndex);
                    switchToStudent(newIndex, updated);
                } else if (updated.length === 0) {
                    setCurrentCode({ html: '', css: '', studentName: '' });
                }
                return updated;
            });
        });

        return () => {
            socket.off('student_list');
            socket.off('student_joined');
            socket.off('student_code_update');
            socket.off('student_left');
        };
    }, [socket, state?.classCode]);

    const switchToStudent = (index, studentList = students) => {
        // Validate index is within bounds
        if (!studentList || studentList.length === 0) return;
        if (index < 0 || index >= studentList.length) return;

        setIsTransitioning(true);
        const student = studentList[index];

        setTimeout(() => {
            setCurrentIndex(index);
            setCurrentCode({ html: '', css: '', studentName: student.studentName });
            socket.emit('subscribe_to_student', { studentSocketId: student.socketId });
            setIsTransitioning(false);
        }, 150);
    };

    useEffect(() => {
        const handleKeyPress = (e) => {
            // Prevent switching during transition or when no students
            if (isTransitioning || students.length === 0) return;

            if (e.key === 'ArrowLeft') {
                const newIndex = currentIndex - 1;
                // Only switch if valid index
                if (newIndex >= 0) {
                    switchToStudent(newIndex);
                }
            } else if (e.key === 'ArrowRight') {
                const newIndex = currentIndex + 1;
                // Only switch if valid index
                if (newIndex < students.length) {
                    switchToStudent(newIndex);
                }
            }
        };

        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [currentIndex, students.length, isTransitioning]);

    // Calculate if can navigate
    const canGoPrev = currentIndex > 0;
    const canGoNext = currentIndex < students.length - 1;

    return (
        <div className="relative h-screen w-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black overflow-hidden">
            {students.length > 0 ? (
                <>
                    {/* Student Info Overlay - Bottom Left */}
                    <div className={`absolute bottom-8 left-8 z-20 transition-all duration-300 ${isTransitioning ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
                        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-8 py-4 rounded-2xl shadow-2xl backdrop-blur-xl border border-white border-opacity-20">
                            <div className="flex items-center gap-4">
                                {/* Student Avatar */}
                                <div className="bg-white bg-opacity-20 rounded-full w-14 h-14 flex items-center justify-center text-3xl font-bold backdrop-blur-sm">
                                    {currentCode.studentName?.charAt(0)?.toUpperCase() || '?'}
                                </div>

                                {/* Student Info */}
                                <div>
                                    <div className="text-2xl font-bold tracking-wide">{currentCode.studentName}</div>
                                    <div className="text-sm text-emerald-100 font-medium mt-1">
                                        Student {currentIndex + 1} of {students.length}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Navigation Hints - Top Center */}
                    <div className="absolute top-6 left-1/2 transform -translate-x-1/2 z-20">
                        <div className="bg-black bg-opacity-60 text-white px-6 py-3 rounded-full backdrop-blur-md border border-white border-opacity-10 shadow-xl">
                            <div className="flex items-center gap-6 text-sm font-medium">
                                <div className={`flex items-center gap-2 ${!canGoPrev ? 'opacity-30' : 'opacity-100'}`}>
                                    <kbd className="px-3 py-1 bg-white bg-opacity-20 rounded-lg font-mono text-xs">←</kbd>
                                    <span>Previous</span>
                                </div>
                                <div className="w-px h-4 bg-white bg-opacity-30"></div>
                                <div className={`flex items-center gap-2 ${!canGoNext ? 'opacity-30' : 'opacity-100'}`}>
                                    <span>Next</span>
                                    <kbd className="px-3 py-1 bg-white bg-opacity-20 rounded-lg font-mono text-xs">→</kbd>
                                </div>
                                <div className="w-px h-4 bg-white bg-opacity-30"></div>
                                <div className="flex items-center gap-2">
                                    <kbd className="px-3 py-1 bg-white bg-opacity-20 rounded-lg font-mono text-xs">ESC</kbd>
                                    <span>Exit</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Left Navigation Arrow */}
                    {canGoPrev && (
                        <button
                            onClick={() => switchToStudent(currentIndex - 1)}
                            className="absolute left-4 top-1/2 transform -translate-y-1/2 z-20 bg-emerald-600 hover:bg-emerald-700 text-white p-4 rounded-full shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95"
                            disabled={isTransitioning}
                        >
                            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                    )}

                    {/* Right Navigation Arrow */}
                    {canGoNext && (
                        <button
                            onClick={() => switchToStudent(currentIndex + 1)}
                            className="absolute right-4 top-1/2 transform -translate-y-1/2 z-20 bg-emerald-600 hover:bg-emerald-700 text-white p-4 rounded-full shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95"
                            disabled={isTransitioning}
                        >
                            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    )}

                    {/* Live Preview with Fade Transition */}
                    <div className={`h-full w-full transition-opacity duration-300 ${isTransitioning ? 'opacity-50' : 'opacity-100'}`}>
                        <LivePreview html={currentCode.html} css={currentCode.css} />
                    </div>
                </>
            ) : (
                <div className="h-full flex items-center justify-center">
                    <div className="text-center">
                        {/* Empty State Icon */}
                        <div className="mb-6 opacity-40">
                            <svg className="w-32 h-32 mx-auto text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                        </div>

                        {/* Empty State Text */}
                        <h2 className="text-3xl font-bold text-white mb-3">Waiting for Students...</h2>
                        <p className="text-gray-400 text-lg">Students will appear here when they join the class</p>

                        {/* Animated Pulse */}
                        <div className="mt-8 flex items-center justify-center gap-2">
                            <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
                            <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                            <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProjectorMode;
