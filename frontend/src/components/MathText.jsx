import React from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

// Мәтін ішіндегі $...$ формулаларын KaTeX-пен көрсетеді (ҰТО есептері LaTeX-пен жазылған)
export default function MathText({ text }) {
  const value = String(text ?? '');
  if (!value.includes('$')) return <>{value}</>;

  return (
    <>
      {value.split(/(\$[^$]+\$)/g).map((part, i) => {
        if (part.length > 2 && part.startsWith('$') && part.endsWith('$')) {
          const html = katex.renderToString(part.slice(1, -1), { throwOnError: false, output: 'html' });
          return <span key={i} className="math" dangerouslySetInnerHTML={{ __html: html }} />;
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </>
  );
}
