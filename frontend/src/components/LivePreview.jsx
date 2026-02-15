import React, { useEffect, useRef } from 'react';

const LivePreview = ({ html, css }) => {
    const iframeRef = useRef(null);

    useEffect(() => {
        if (!iframeRef.current) return;

        const iframe = iframeRef.current;
        const document = iframe.contentDocument;

        if (!document) return;

        const content = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; }
    body { margin: 16px; font-family: system-ui, -apple-system, sans-serif; line-height: 1.5; }
    ${css || ''}
  </style>
</head>
<body>
  ${html || ''}
</body>
</html>
    `;

        document.open();
        document.write(content);
        document.close();
    }, [html, css]);

    return (
        <iframe
            ref={iframeRef}
            title="Live Preview"
            sandbox="allow-scripts allow-same-origin"
            className="w-full h-full border-none bg-white"
        />
    );
};

export default LivePreview;
