import React, { useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { EditorView } from '@codemirror/view';

const CodeEditor = forwardRef(({ language, value, onChange, readOnly = false }, ref) => {
    const editorRef = useRef(null);
    const extensions = language === 'html' ? [html()] : [css()];

    // Custom theme for better syntax highlighting
    const customTheme = EditorView.theme({
        "&": {
            backgroundColor: "#0f172a",
            color: "#e2e8f0"
        },
        ".cm-content": {
            caretColor: "#10b981",
            fontSize: "16px"
        },
        ".cm-cursor": {
            borderLeftColor: "#10b981",
            borderLeftWidth: "2px"
        },
        ".cm-activeLine": {
            backgroundColor: "#1e293b"
        },
        ".cm-gutters": {
            backgroundColor: "#0f172a",
            color: "#64748b",
            border: "none"
        },
        ".cm-lineNumbers .cm-gutterElement": {
            color: "#475569"
        },
        // HTML/CSS Syntax Colors
        "&.cm-focused .cm-matchingBracket": {
            backgroundColor: "#334155",
            outline: "1px solid #10b981"
        },
        // Make tags distinct from content
        ".cm-tag": {
            color: "#10b981" // Emerald for HTML tags
        },
        ".cm-attribute": {
            color: "#3b82f6" // Blue for attributes
        },
        ".cm-string": {
            color: "#f59e0b" // Amber for strings/content
        },
        ".cm-meta": {
            color: "#8b5cf6" // Purple for meta
        },
        ".cm-propertyName": {
            color: "#06b6d4" // Cyan for CSS properties
        },
        ".cm-variableName": {
            color: "#14b8a6" // Teal for variables
        },
        ".cm-comment": {
            color: "#64748b",
            fontStyle: "italic"
        }
    }, { dark: true });

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
                extensions={[...extensions, customTheme]}
                onChange={onChange}
                readOnly={readOnly}
                basicSetup={{
                    lineNumbers: true,
                    foldGutter: false,
                    highlightActiveLineGutter: false,
                    lineWrapping: true,
                    highlightActiveLine: !readOnly,
                }}
                className="text-base codemirror-custom"
            />
        </div>
    );
});

CodeEditor.displayName = 'CodeEditor';

export default CodeEditor;
