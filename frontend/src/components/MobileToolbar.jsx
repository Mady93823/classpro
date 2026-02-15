import React from 'react';

const MobileToolbar = ({ onInsert }) => {
    const buttons = [
        { char: '<', label: '<', color: 'from-emerald-500 to-emerald-600', shadow: 'shadow-emerald-500/30' },
        { char: '>', label: '>', color: 'from-emerald-500 to-emerald-600', shadow: 'shadow-emerald-500/30' },
        { char: '/', label: '/', color: 'from-teal-500 to-teal-600', shadow: 'shadow-teal-500/30' },
        { char: '{', label: '{', color: 'from-blue-500 to-blue-600', shadow: 'shadow-blue-500/30' },
        { char: '}', label: '}', color: 'from-blue-500 to-blue-600', shadow: 'shadow-blue-500/30' },
        { char: '(', label: '(', color: 'from-purple-500 to-purple-600', shadow: 'shadow-purple-500/30' },
        { char: ')', label: ')', color: 'from-purple-500 to-purple-600', shadow: 'shadow-purple-500/30' },
        { char: ';', label: ';', color: 'from-orange-500 to-orange-600', shadow: 'shadow-orange-500/30' },
        { char: ':', label: ':', color: 'from-orange-500 to-orange-600', shadow: 'shadow-orange-500/30' },
        { char: '"', label: '"', color: 'from-pink-500 to-pink-600', shadow: 'shadow-pink-500/30' },
    ];

    return (
        <div className="bg-slate-900/50 backdrop-blur-sm px-2.5 py-2.5">
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5">
                {buttons.map(({ char, label, color, shadow }) => (
                    <button
                        key={char}
                        onClick={() => onInsert(char)}
                        className={`flex-shrink-0 bg-gradient-to-br ${color} text-white font-extrabold text-base rounded-lg px-4 py-2.5 min-w-[52px] active:scale-95 transform transition-all duration-150 shadow-md ${shadow} hover:shadow-lg active:shadow-sm border border-white/10`}
                        style={{ minHeight: '48px', minWidth: '48px' }}
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
