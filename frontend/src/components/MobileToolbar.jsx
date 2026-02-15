import React from 'react';

const MobileToolbar = ({ onInsert }) => {
    const buttons = [
        { char: '<', label: '<', color: 'from-emerald-500 to-emerald-600' },
        { char: '>', label: '>', color: 'from-emerald-500 to-emerald-600' },
        { char: '/', label: '/', color: 'from-teal-500 to-teal-600' },
        { char: '{', label: '{', color: 'from-blue-500 to-blue-600' },
        { char: '}', label: '}', color: 'from-blue-500 to-blue-600' },
        { char: '(', label: '(', color: 'from-purple-500 to-purple-600' },
        { char: ')', label: ')', color: 'from-purple-500 to-purple-600' },
        { char: ';', label: ';', color: 'from-orange-500 to-orange-600' },
        { char: ':', label: ':', color: 'from-orange-500 to-orange-600' },
        { char: '"', label: '"', color: 'from-pink-500 to-pink-600' },
    ];

    return (
        <div className="bg-gray-800 border-t-2 border-gray-700 px-2 py-3 shadow-2xl">
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                {buttons.map(({ char, label, color }) => (
                    <button
                        key={char}
                        onClick={() => onInsert(char)}
                        className={`flex-shrink-0 bg-gradient-to-br ${color} text-white font-bold text-lg rounded-xl px-5 py-3 min-w-[56px] active:scale-95 transform transition-all duration-200 shadow-lg hover:shadow-xl active:shadow-md`}
                        style={{ minHeight: '48px', minWidth: '48px' }} // Touch target: 48px minimum
                    >
                        {label}
                    </button>
                ))}
            </div>
            <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
        </div>
    );
};

export default MobileToolbar;
