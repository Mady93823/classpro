import React from 'react';

const StudentList = ({ students, selectedStudent, onSelectStudent }) => {
    return (
        <div className="h-full bg-gray-50 border-r border-gray-200 overflow-y-auto">
            <div className="p-4 bg-white border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-800">
                    Students ({students.length}/60)
                </h2>
            </div>
            <div className="p-2">
                {students.length === 0 ? (
                    <p className="text-center text-gray-500 text-sm mt-8">
                        No students joined yet
                    </p>
                ) : (
                    students.map((student) => (
                        <button
                            key={student.socketId}
                            onClick={() => onSelectStudent(student)}
                            className={`w-full text-left p-3 rounded-lg mb-2 transition ${selectedStudent?.socketId === student.socketId
                                    ? 'bg-primary text-white'
                                    : 'bg-white hover:bg-gray-100 text-gray-800'
                                }`}
                        >
                            <div className="font-medium truncate">{student.studentName}</div>
                            <div className={`text-xs mt-1 ${selectedStudent?.socketId === student.socketId
                                    ? 'text-blue-100'
                                    : 'text-gray-500'
                                }`}>
                                {student.socketId.substring(0, 8)}...
                            </div>
                        </button>
                    ))
                )}
            </div>
        </div>
    );
};

export default StudentList;
