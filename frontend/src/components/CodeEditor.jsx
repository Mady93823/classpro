import React, { useRef, useCallback } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';

const CodeEditor = ({ language, value, onChange, readOnly = false }) => {
    const extensions = language === 'html' ? [html()] : [css()];

    return (
        <div className="h-full overflow-auto">
            <CodeMirror
                value={value}
                height="100%"
                extensions={extensions}
                onChange={onChange}
                readOnly={readOnly}
                theme="dark"
                basicSetup={{
                    lineNumbers: true,  // Always show line numbers (including read-only teacher view)
                    foldGutter: false,
                    highlightActiveLineGutter: false,
                    lineWrapping: true,  // Enable line wrapping
                    highlightActiveLine: !readOnly,
                }}
                className="text-sm"
                style={{ fontSize: '14px' }}
            />
        </div>
    );
};

export default CodeEditor;
