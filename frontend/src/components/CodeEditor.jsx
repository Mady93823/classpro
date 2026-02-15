import React, { useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';

const CodeEditor = forwardRef(({ language, value, onChange, readOnly = false }, ref) => {
    const editorRef = useRef(null);
    const extensions = language === 'html' ? [html()] : [css()];

    // Expose insertText method to parent components
    useImperativeHandle(ref, () => ({
        insertText: (text) => {
            if (editorRef.current && editorRef.current.view) {
                const view = editorRef.current.view;
                const { from, to } = view.state.selection.main;

                view.dispatch({
                    changes: { from, to, insert: text },
                    selection: { anchor: from + text.length }
                });

                // Focus back on the editor
                view.focus();
            }
        }
    }));

    return (
        <div className="h-full overflow-auto">
            <CodeMirror
                ref={editorRef}
                value={value}
                height="100%"
                extensions={extensions}
                onChange={onChange}
                readOnly={readOnly}
                theme="dark"
                basicSetup={{
                    lineNumbers: true,
                    foldGutter: false,
                    highlightActiveLineGutter: false,
                    lineWrapping: true,
                    highlightActiveLine: !readOnly,
                }}
                className="text-base"
                style={{ fontSize: '16px' }} // Increased from 14px to prevent iOS zoom
            />
        </div>
    );
});

CodeEditor.displayName = 'CodeEditor';

export default CodeEditor;
